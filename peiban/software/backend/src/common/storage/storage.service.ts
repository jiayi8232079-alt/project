import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import COS from 'cos-nodejs-sdk-v5';
import { promises as fs } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { In, Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';

type StorageDriver = 'local' | 'cos';

interface StorageSettings {
  driver: StorageDriver;
  cosSecretId: string;
  cosSecretKey: string;
  cosBucket: string;
  cosRegion: string;
  cosPathPrefix: string;
  cosCustomDomain: string;
  cosUseHttps: boolean;
}

interface UploadResult {
  key: string;
  url: string;
  driver: StorageDriver;
}

interface ReadObjectResult {
  body: Buffer;
  contentType: string;
}

interface ExternalReadUrlOptions {
  sign?: boolean;
  expiresSeconds?: number;
}

const STORAGE_KEYS = [
  'storage_driver',
  'storage_cos_secret_id',
  'storage_cos_secret_key',
  'storage_cos_bucket',
  'storage_cos_region',
  'storage_cos_path_prefix',
  'storage_cos_custom_domain',
  'storage_cos_use_https',
] as const;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly configService: ConfigService,
  ) {}

  async getResolvedSettings(): Promise<StorageSettings> {
    const values = await this.loadStorageConfigValues();
    const driver = (values.storage_driver || 'local').toLowerCase() === 'cos'
      ? 'cos'
      : 'local';

    return {
      driver,
      cosSecretId: values.storage_cos_secret_id || '',
      cosSecretKey: values.storage_cos_secret_key || '',
      cosBucket: values.storage_cos_bucket || '',
      cosRegion: values.storage_cos_region || '',
      cosPathPrefix: this.trimSlashes(values.storage_cos_path_prefix || ''),
      cosCustomDomain: (values.storage_cos_custom_domain || '').trim(),
      cosUseHttps: (values.storage_cos_use_https || 'true').trim() !== 'false',
    };
  }

  async uploadTempFile(
    tempPath: string,
    objectKey: string,
    contentType?: string,
  ): Promise<UploadResult> {
    const buffer = await fs.readFile(tempPath);
    try {
      return await this.uploadBuffer(buffer, objectKey, contentType);
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
  }

  async uploadBuffer(
    content: Buffer | string,
    objectKey: string,
    contentType?: string,
  ): Promise<UploadResult> {
    const settings = await this.getResolvedSettings();
    const normalizedKey = this.normalizeObjectKey(objectKey);
    const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);

    if (settings.driver === 'local') {
      const target = this.resolveLocalUploadTarget(normalizedKey);
      await fs.mkdir(dirname(target), { recursive: true });
      await fs.writeFile(target, buffer);
      return {
        key: normalizedKey,
        url: `/uploads/${normalizedKey}`,
        driver: 'local',
      };
    }

    this.assertCosConfigured(settings);
    const cosKey = this.applyCosPrefix(settings.cosPathPrefix, normalizedKey);
    const client = this.createCosClient(settings);

    const ct = (contentType || '').toLowerCase();
    const cosPut: {
      Bucket: string;
      Region: string;
      Key: string;
      Body: Buffer;
      ContentType?: string;
      ContentDisposition?: string;
    } = {
      Bucket: settings.cosBucket,
      Region: settings.cosRegion,
      Key: cosKey,
      Body: buffer,
      ContentType: contentType,
    };
    if (ct.includes('text/html')) {
      cosPut.ContentDisposition = 'inline';
    }

    await new Promise<void>((resolve, reject) => {
      client.putObject(cosPut, (err: unknown) => {
        if (err) reject(err);
        else resolve();
      });
    }).catch((error: unknown) => {
      this.logger.error(`COS 上传失败: ${String(error)}`);
      throw new InternalServerErrorException('上传到对象存储失败');
    });

    return {
      key: cosKey,
      url: this.buildCosUrl(settings, cosKey),
      driver: 'cos',
    };
  }

  async resolveUrl(url?: string | null): Promise<string> {
    if (!url) return '';
    if (/^\/https?:\/\//i.test(url)) {
      return url.slice(1);
    }
    if (/^https?:\/\//i.test(url) || url.startsWith('/uploads/')) {
      return url;
    }

    const settings = await this.getResolvedSettings();
    if (settings.driver !== 'cos') {
      return url;
    }
    return this.buildCosUrl(settings, url);
  }

  async getExternalReadUrl(
    urlOrKey: string,
    options: ExternalReadUrlOptions = {},
  ): Promise<string> {
    const raw = String(urlOrKey || '').trim();
    if (!raw) return '';

    const settings = await this.getResolvedSettings();
    const apiBase = (this.configService.get<string>('API_BASE_URL', '') || '').trim();

    if (this.isLocalUploadUrl(raw) || settings.driver === 'local') {
      if (/^https?:\/\//i.test(raw)) return raw;
      if (!apiBase) return raw;
      const normalizedBase = apiBase.replace(/\/+$/, '');
      const localPath = raw.startsWith('/uploads/')
        ? raw
        : `/uploads/${this.extractLocalUploadPath(raw)}`;
      return `${normalizedBase}${localPath}`;
    }

    this.assertCosConfigured(settings);
    const cosKey = this.extractCosKey(raw, settings);
    if (!options.sign) {
      return this.buildCosUrl(settings, cosKey);
    }

    const client = this.createCosClient(settings) as any;
    return client.getObjectUrl({
      Bucket: settings.cosBucket,
      Region: settings.cosRegion,
      Key: cosKey,
      Sign: true,
      Expires: Math.max(Number(options.expiresSeconds || 3600), 300),
    });
  }

  async readObject(urlOrKey: string): Promise<ReadObjectResult> {
    const settings = await this.getResolvedSettings();

    if (this.isLocalUploadUrl(urlOrKey) || settings.driver === 'local') {
      const localRelativePath = this.extractLocalUploadPath(urlOrKey);
      const target = this.resolveLocalUploadTarget(localRelativePath);
      const body = await fs.readFile(target).catch(() => {
        throw new NotFoundException('文档文件不存在');
      });
      return {
        body,
        contentType: this.detectContentType(localRelativePath),
      };
    }

    this.assertCosConfigured(settings);
    const cosKey = this.extractCosKey(urlOrKey, settings);
    const client = this.createCosClient(settings);
    const data = await new Promise<{ Body?: Buffer | string; headers?: Record<string, any> }>(
      (resolve, reject) => {
        client.getObject(
          {
            Bucket: settings.cosBucket,
            Region: settings.cosRegion,
            Key: cosKey,
          },
          (err: unknown, result: any) => {
            if (err) reject(err);
            else resolve(result || {});
          },
        );
      },
    ).catch((error: unknown) => {
      this.logger.error(`COS 读取失败: ${String(error)}`);
      throw new NotFoundException('文档文件不存在');
    });

    const rawBody = data.Body;
    const body = Buffer.isBuffer(rawBody)
      ? rawBody
      : Buffer.from(typeof rawBody === 'string' ? rawBody : '');
    return {
      body,
      contentType:
        data.headers?.['content-type'] ||
        data.headers?.['Content-Type'] ||
        this.detectContentType(cosKey),
    };
  }

  async deleteObject(urlOrKey: string): Promise<void> {
    const settings = await this.getResolvedSettings();

    if (this.isLocalUploadUrl(urlOrKey) || settings.driver === 'local') {
      const localRelativePath = this.extractLocalUploadPath(urlOrKey);
      const target = this.resolveLocalUploadTarget(localRelativePath);
      await fs.unlink(target).catch(() => undefined);
      return;
    }

    this.assertCosConfigured(settings);
    const cosKey = this.extractCosKey(urlOrKey, settings);
    const client = this.createCosClient(settings);
    await new Promise<void>((resolve, reject) => {
      client.deleteObject(
        {
          Bucket: settings.cosBucket,
          Region: settings.cosRegion,
          Key: cosKey,
        },
        (err: unknown) => {
          if (err) reject(err);
          else resolve();
        },
      );
    }).catch((error: unknown) => {
      this.logger.warn(`COS 删除失败: ${String(error)}`);
    });
  }

  async testConnection(): Promise<{
    driver: StorageDriver;
    bucket?: string;
    region?: string;
    message: string;
  }> {
    const settings = await this.getResolvedSettings();
    if (settings.driver === 'local') {
      return {
        driver: 'local',
        message: '当前使用本地存储，无需测试云存储连通性',
      };
    }

    this.assertCosConfigured(settings);
    const client = this.createCosClient(settings);
    await new Promise<void>((resolve, reject) => {
      client.headBucket(
        {
          Bucket: settings.cosBucket,
          Region: settings.cosRegion,
        },
        (err: unknown) => {
          if (err) reject(err);
          else resolve();
        },
      );
    }).catch((error: unknown) => {
      this.logger.error(`COS 连通性测试失败: ${String(error)}`);
      throw new InternalServerErrorException(
        '对象存储连接失败，请检查密钥、桶名称和地域配置',
      );
    });

    return {
      driver: 'cos',
      bucket: settings.cosBucket,
      region: settings.cosRegion,
      message: '对象存储连接成功',
    };
  }

  private async loadStorageConfigValues(): Promise<Record<string, string>> {
    const configItems = await this.systemConfigRepository.find({
      where: { key: In([...STORAGE_KEYS]) },
    });
    const configMap = new Map(configItems.map((item) => [item.key, item.value]));

    return {
      storage_driver:
        configMap.get('storage_driver') ||
        this.configService.get<string>('STORAGE_DRIVER', '') ||
        (this.configService.get<string>('COS_BUCKET') ? 'cos' : 'local'),
      storage_cos_secret_id:
        configMap.get('storage_cos_secret_id') ||
        this.configService.get<string>('COS_SECRET_ID', '') ||
        '',
      storage_cos_secret_key:
        configMap.get('storage_cos_secret_key') ||
        this.configService.get<string>('COS_SECRET_KEY', '') ||
        '',
      storage_cos_bucket:
        configMap.get('storage_cos_bucket') ||
        this.configService.get<string>('COS_BUCKET', '') ||
        '',
      storage_cos_region:
        configMap.get('storage_cos_region') ||
        this.configService.get<string>('COS_REGION', '') ||
        '',
      storage_cos_path_prefix:
        configMap.get('storage_cos_path_prefix') ||
        this.configService.get<string>('COS_PATH_PREFIX', '') ||
        '',
      storage_cos_custom_domain:
        configMap.get('storage_cos_custom_domain') ||
        this.configService.get<string>('COS_CUSTOM_DOMAIN', '') ||
        '',
      storage_cos_use_https:
        configMap.get('storage_cos_use_https') ||
        this.configService.get<string>('COS_USE_HTTPS', 'true') ||
        'true',
    };
  }

  private createCosClient(settings: StorageSettings): COS {
    return new COS({
      SecretId: settings.cosSecretId,
      SecretKey: settings.cosSecretKey,
    });
  }

  private assertCosConfigured(settings: StorageSettings) {
    if (
      !settings.cosSecretId ||
      !settings.cosSecretKey ||
      !settings.cosBucket ||
      !settings.cosRegion
    ) {
      throw new InternalServerErrorException(
        '腾讯云对象存储未配置完整，请先在后台填写密钥、桶名称和地域',
      );
    }
  }

  private buildCosUrl(settings: StorageSettings, key: string): string {
    const safeKey = key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');

    if (settings.cosCustomDomain) {
      const protocol = settings.cosUseHttps ? 'https://' : 'http://';
      const base = /^https?:\/\//i.test(settings.cosCustomDomain)
        ? settings.cosCustomDomain.replace(/\/+$/, '')
        : `${protocol}${settings.cosCustomDomain.replace(/\/+$/, '')}`;
      return `${base}/${safeKey}`;
    }

    const protocol = settings.cosUseHttps ? 'https' : 'http';
    return `${protocol}://${settings.cosBucket}.cos.${settings.cosRegion}.myqcloud.com/${safeKey}`;
  }

  private normalizeObjectKey(value: string): string {
    const segments = value
      .replace(/\\/g, '/')
      .split('/')
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (
      !segments.length ||
      segments.some((segment) => segment === '.' || segment === '..')
    ) {
      throw new BadRequestException('对象路径无效');
    }
    return segments.join('/');
  }

  private resolveLocalUploadTarget(localRelativePath: string): string {
    const uploadsRoot = resolve(process.cwd(), 'uploads');
    const target = resolve(uploadsRoot, ...localRelativePath.split('/'));
    if (target !== uploadsRoot && !target.startsWith(`${uploadsRoot}${sep}`)) {
      throw new BadRequestException('对象路径无效');
    }
    return target;
  }

  private applyCosPrefix(prefix: string, key: string): string {
    const normalizedPrefix = this.trimSlashes(prefix);
    return normalizedPrefix ? `${normalizedPrefix}/${key}` : key;
  }

  private trimSlashes(value: string): string {
    return value.replace(/^\/+|\/+$/g, '');
  }

  private isLocalUploadUrl(urlOrKey: string) {
    if (urlOrKey.startsWith('/uploads/')) return true;
    if (!/^https?:\/\//i.test(urlOrKey)) return false;

    try {
      const parsed = new URL(urlOrKey);
      return parsed.pathname.startsWith('/uploads/');
    } catch {
      return false;
    }
  }

  private extractLocalUploadPath(urlOrKey: string) {
    if (urlOrKey.startsWith('/uploads/')) {
      return this.normalizeObjectKey(urlOrKey.replace(/^\/uploads\//, ''));
    }
    if (/^https?:\/\//i.test(urlOrKey)) {
      const parsed = new URL(urlOrKey);
      return this.normalizeObjectKey(parsed.pathname.replace(/^\/uploads\//, ''));
    }
    return this.normalizeObjectKey(urlOrKey);
  }

  private extractCosKey(urlOrKey: string, settings: StorageSettings) {
    if (!/^https?:\/\//i.test(urlOrKey)) {
      return this.normalizeObjectKey(urlOrKey);
    }

    const parsed = new URL(urlOrKey);
    const pathKey = this.normalizeObjectKey(decodeURIComponent(parsed.pathname));
    const normalizedCustomHost = settings.cosCustomDomain
      ? new URL(
          /^https?:\/\//i.test(settings.cosCustomDomain)
            ? settings.cosCustomDomain
            : `${settings.cosUseHttps ? 'https' : 'http'}://${settings.cosCustomDomain}`,
        ).host
      : '';
    const defaultHost = `${settings.cosBucket}.cos.${settings.cosRegion}.myqcloud.com`;

    if (parsed.host === normalizedCustomHost || parsed.host === defaultHost) {
      return pathKey;
    }

    return pathKey;
  }

  private detectContentType(key: string) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.endsWith('.html')) {
      return 'text/html; charset=utf-8';
    }
    if (lowerKey.endsWith('.json')) {
      return 'application/json; charset=utf-8';
    }
    if (lowerKey.endsWith('.txt')) {
      return 'text/plain; charset=utf-8';
    }
    if (lowerKey.endsWith('.pdf')) {
      return 'application/pdf';
    }
    if (lowerKey.endsWith('.doc')) {
      return 'application/msword';
    }
    if (lowerKey.endsWith('.docx')) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    if (lowerKey.endsWith('.xls')) {
      return 'application/vnd.ms-excel';
    }
    if (lowerKey.endsWith('.xlsx')) {
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }
    if (lowerKey.endsWith('.ppt')) {
      return 'application/vnd.ms-powerpoint';
    }
    if (lowerKey.endsWith('.pptx')) {
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    }
    if (lowerKey.endsWith('.png')) {
      return 'image/png';
    }
    if (lowerKey.endsWith('.jpg') || lowerKey.endsWith('.jpeg')) {
      return 'image/jpeg';
    }
    if (lowerKey.endsWith('.webp')) {
      return 'image/webp';
    }
    if (lowerKey.endsWith('.mp3')) {
      return 'audio/mpeg';
    }
    if (lowerKey.endsWith('.m4a')) {
      return 'audio/mp4';
    }
    if (lowerKey.endsWith('.wav')) {
      return 'audio/wav';
    }
    if (lowerKey.endsWith('.aac')) {
      return 'audio/aac';
    }
    if (lowerKey.endsWith('.amr')) {
      return 'audio/amr';
    }
    return 'application/octet-stream';
  }
}
