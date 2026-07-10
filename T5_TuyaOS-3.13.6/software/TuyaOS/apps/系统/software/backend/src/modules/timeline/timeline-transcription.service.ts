import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash, createHmac } from 'node:crypto';
import { ServiceTimeline } from '../../entities/service-timeline.entity.js';
import { TimelineType } from '../../common/enums/index.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { SystemService } from '../system/system.service.js';
import { AiConsultationService } from '../ai-consultation/ai-consultation.service.js';
import { AlertService } from '../alert/alert.service.js';

type TranscriptionStatus = 'processing' | 'success' | 'failed';

interface TimelineTranscriptionMeta {
  provider?: 'tencent_asr';
  status?: TranscriptionStatus;
  taskId?: number;
  text?: string;
  rawText?: string;
  edited?: boolean;
  error?: string;
  requestedAt?: string;
  completedAt?: string;
  updatedAt?: string;
  retryCount?: number;
  sourceUrl?: string;
  sourceName?: string;
  audioDuration?: number;
  segments?: Array<{
    startMs: number;
    endMs: number;
    text: string;
    speakerId?: number;
  }>;
}

interface TencentAsrSettings {
  enabled: boolean;
  secretId: string;
  secretKey: string;
  region: string;
  engineModelType: string;
}

interface TimelineAudioSource {
  url: string;
  name: string;
}

const AUDIO_TIMELINE_TYPES = [
  TimelineType.AUDIO_QUESTION,
  TimelineType.AUDIO_ADVICE,
] as const;

@Injectable()
export class TimelineTranscriptionService {
  private readonly logger = new Logger(TimelineTranscriptionService.name);
  private syncingRecentEntries = false;

  constructor(
    @InjectRepository(ServiceTimeline)
    private readonly timelineRepository: Repository<ServiceTimeline>,
    private readonly systemService: SystemService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => AiConsultationService))
    private readonly aiConsultationService: AiConsultationService,
    @Inject(forwardRef(() => AlertService))
    private readonly alertService: AlertService,
  ) {}

  async handleTimelineCreated(entryId: number) {
    await this.processTimelineById(entryId).catch((error: unknown) => {
      this.logger.warn(`录音转写提交流程失败: ${String(error)}`);
    });
  }

  async updateManualText(entry: ServiceTimeline, text: string) {
    const metadata = this.normalizeMetadata(entry.metadata);
    const transcription = this.normalizeTranscriptionMeta(
      metadata.transcription,
      this.getPrimaryAudioSource(entry),
    );
    const nextText = String(text || '').trim();
    transcription.text = nextText;
    transcription.edited = true;
    transcription.updatedAt = new Date().toISOString();
    if (nextText) {
      transcription.status = 'success';
      transcription.error = '';
      if (!transcription.completedAt) {
        transcription.completedAt = transcription.updatedAt;
      }
    }
    entry.metadata = {
      ...metadata,
      transcription,
    };
    return this.timelineRepository.save(entry);
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async syncRecentAudioTimelineTranscriptions() {
    if (this.syncingRecentEntries) return;
    this.syncingRecentEntries = true;
    try {
      const settings = await this.getTencentAsrSettings();
      if (!this.isTencentAsrReady(settings)) return;

      const entries = await this.timelineRepository.find({
        where: { type: In([...AUDIO_TIMELINE_TYPES]) },
        order: { createdAt: 'DESC' },
        take: 120,
      });

      for (const entry of entries) {
        if (!this.shouldProcessEntry(entry)) continue;
        await this.processTimelineEntry(entry, settings);
      }
    } catch (error: unknown) {
      this.logger.warn(`轮询录音转写任务失败: ${String(error)}`);
    } finally {
      this.syncingRecentEntries = false;
    }
  }

  private async processTimelineById(entryId: number) {
    const settings = await this.getTencentAsrSettings();
    if (!this.isTencentAsrReady(settings)) return;
    const entry = await this.timelineRepository.findOne({ where: { id: entryId } });
    if (!entry || !this.isAudioEntry(entry)) return;
    await this.processTimelineEntry(entry, settings);
  }

  private async processTimelineEntry(
    entry: ServiceTimeline,
    settings: TencentAsrSettings,
  ) {
    if (!this.isAudioEntry(entry)) return;

    const metadata = this.normalizeMetadata(entry.metadata);
    const transcription = this.normalizeTranscriptionMeta(
      metadata.transcription,
      this.getPrimaryAudioSource(entry),
    );

    if (transcription.taskId && transcription.status === 'processing') {
      await this.pollTencentAsrTask(entry, settings, transcription);
      return;
    }

    if (transcription.status === 'success') return;
    if (transcription.edited && String(transcription.text || '').trim()) return;
    if (
      transcription.status === 'failed' &&
      Number(transcription.retryCount || 0) >= 3
    ) {
      return;
    }

    await this.submitTencentAsrTask(entry, settings, transcription);
  }

  private shouldProcessEntry(entry: ServiceTimeline) {
    if (!this.isAudioEntry(entry)) return false;
    const transcription = this.normalizeTranscriptionMeta(
      this.normalizeMetadata(entry.metadata).transcription,
      this.getPrimaryAudioSource(entry),
    );
    if (transcription.taskId && transcription.status === 'processing') return true;
    if (transcription.status === 'success') return false;
    if (transcription.edited && String(transcription.text || '').trim()) return false;
    if (
      transcription.status === 'failed' &&
      Number(transcription.retryCount || 0) >= 3
    ) {
      return false;
    }
    return true;
  }

  private isAudioEntry(entry?: Pick<ServiceTimeline, 'type'> | null) {
    return (
      entry?.type === TimelineType.AUDIO_QUESTION ||
      entry?.type === TimelineType.AUDIO_ADVICE
    );
  }

  private getPrimaryAudioSource(
    entry: Pick<ServiceTimeline, 'type' | 'metadata'>,
  ): TimelineAudioSource | null {
    const metadata = this.normalizeMetadata(entry.metadata);

    if (Array.isArray(metadata.audioFiles) && metadata.audioFiles.length > 0) {
      const first = metadata.audioFiles.find(
        (item) => item && typeof item.url === 'string' && item.url.trim(),
      );
      if (first) {
        return {
          url: String(first.url).trim(),
          name: String(first.name || '').trim(),
        };
      }
    }

    if (typeof metadata.audioUrl === 'string' && metadata.audioUrl.trim()) {
      return {
        url: metadata.audioUrl.trim(),
        name: '',
      };
    }

    if (this.isAudioEntry(entry) && Array.isArray(metadata.files)) {
      const first = metadata.files.find((item) => {
        if (typeof item === 'string') return !!item.trim();
        return item && typeof item.url === 'string' && item.url.trim();
      });
      if (typeof first === 'string') {
        return { url: first.trim(), name: '' };
      }
      if (first && typeof first.url === 'string') {
        return {
          url: String(first.url).trim(),
          name: String(first.name || '').trim(),
        };
      }
    }

    return null;
  }

  private normalizeMetadata(
    value?: Record<string, unknown> | null,
  ): Record<string, any> {
    if (!value || typeof value !== 'object') return {};
    return value as Record<string, any>;
  }

  private normalizeTranscriptionMeta(
    value: unknown,
    source: TimelineAudioSource | null,
  ): TimelineTranscriptionMeta {
    const current =
      value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
    return {
      provider: 'tencent_asr',
      status: this.normalizeStatus(current.status),
      taskId: this.toPositiveInt(current.taskId),
      text: String(current.text || '').trim(),
      rawText: String(current.rawText || '').trim(),
      edited: current.edited === true,
      error: String(current.error || '').trim(),
      requestedAt: String(current.requestedAt || '').trim(),
      completedAt: String(current.completedAt || '').trim(),
      updatedAt: String(current.updatedAt || '').trim(),
      retryCount: Number(current.retryCount || 0),
      sourceUrl: String(current.sourceUrl || source?.url || '').trim(),
      sourceName: String(current.sourceName || source?.name || '').trim(),
      audioDuration: Number(current.audioDuration || 0),
      segments: Array.isArray(current.segments)
        ? (current.segments as TimelineTranscriptionMeta['segments'])
        : [],
    };
  }

  private normalizeStatus(value: unknown): TranscriptionStatus | undefined {
    const status = String(value || '').trim();
    if (status === 'processing' || status === 'success' || status === 'failed') {
      return status;
    }
    return undefined;
  }

  private toPositiveInt(value: unknown): number | undefined {
    const num = Number(value);
    return Number.isInteger(num) && num > 0 ? num : undefined;
  }

  private async submitTencentAsrTask(
    entry: ServiceTimeline,
    settings: TencentAsrSettings,
    transcription: TimelineTranscriptionMeta,
  ) {
    const source = this.getPrimaryAudioSource(entry);
    if (!source?.url) return;

    let audioUrl = '';
    try {
      audioUrl = await this.storageService.getExternalReadUrl(source.url, {
        sign: true,
        expiresSeconds: 7200,
      });
    } catch (error: unknown) {
      await this.markAsFailed(
        entry,
        transcription,
        `无法生成录音外链：${String(error)}`,
      );
      return;
    }

    if (!/^https?:\/\//i.test(audioUrl)) {
      await this.markAsFailed(
        entry,
        transcription,
        '无法生成可供语音识别访问的音频地址，请先配置 API_BASE_URL 或启用 COS',
      );
      return;
    }

    try {
      const data = await this.callTencentAsrApi<{ TaskId?: number }>(
        'CreateRecTask',
        {
          Url: audioUrl,
          ChannelNum: 1,
          EngineModelType: settings.engineModelType,
          ResTextFormat: 2,
          SourceType: 0,
          ConvertNumMode: 1,
          FilterDirty: 0,
          FilterModal: 0,
          FilterPunc: 0,
        },
        settings,
      );

      const taskId = Number(data?.TaskId || 0);
      if (!taskId) {
        throw new Error('未获取到有效的转写任务 ID');
      }

      const metadata = this.normalizeMetadata(entry.metadata);
      metadata.transcription = {
        ...transcription,
        provider: 'tencent_asr',
        status: 'processing',
        taskId,
        error: '',
        requestedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sourceUrl: source.url,
        sourceName: source.name || transcription.sourceName || '',
      } satisfies TimelineTranscriptionMeta;
      entry.metadata = metadata;
      await this.timelineRepository.save(entry);
    } catch (error: unknown) {
      await this.markAsFailed(
        entry,
        transcription,
        this.formatTencentAsrError(error, '提交录音转写任务失败'),
      );
    }
  }

  private async pollTencentAsrTask(
    entry: ServiceTimeline,
    settings: TencentAsrSettings,
    transcription: TimelineTranscriptionMeta,
  ) {
    if (!transcription.taskId) {
      await this.submitTencentAsrTask(entry, settings, transcription);
      return;
    }

    try {
      const data = await this.callTencentAsrApi<{
        Status?: number;
        StatusStr?: string;
        Result?: string;
        ErrorMsg?: string;
        AudioDuration?: number;
        ResultDetail?: Array<{
          StartMs?: number;
          EndMs?: number;
          FinalSentence?: string;
          SliceSentence?: string;
          SpeakerId?: number;
        }>;
      }>(
        'DescribeTaskStatus',
        { TaskId: transcription.taskId },
        settings,
      );

      const status = Number(data?.Status ?? -1);
      if (status === 0 || status === 1) {
        const metadata = this.normalizeMetadata(entry.metadata);
        metadata.transcription = {
          ...transcription,
          status: 'processing',
          updatedAt: new Date().toISOString(),
        } satisfies TimelineTranscriptionMeta;
        entry.metadata = metadata;
        await this.timelineRepository.save(entry);
        return;
      }

      if (status === 2) {
        const rawText = this.buildTencentAsrResultText(
          data?.ResultDetail,
          data?.Result,
        );
        const metadata = this.normalizeMetadata(entry.metadata);
        metadata.transcription = {
          ...transcription,
          status: 'success',
          rawText,
          text:
            transcription.edited && String(transcription.text || '').trim()
              ? String(transcription.text || '').trim()
              : rawText,
          error: '',
          audioDuration: Number(data?.AudioDuration || 0),
          segments: this.simplifyTencentAsrSegments(data?.ResultDetail),
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } satisfies TimelineTranscriptionMeta;
        entry.metadata = metadata;
        await this.timelineRepository.save(entry);

        if (
          rawText &&
          (entry.type === TimelineType.AUDIO_ADVICE || entry.type === TimelineType.AUDIO_QUESTION)
        ) {
          this.extractMedicalOrdersFromTranscription(entry, rawText).catch((e) =>
            this.logger.warn(`AI 医嘱提取失败 (timeline ${entry.id}): ${String(e)}`),
          );
        }

        if (rawText) {
          this.alertService
            .handleTimelineEntry(entry)
            .catch((e) =>
              this.logger.warn(
                `录音转写关键词预警触发失败 (timeline ${entry.id}): ${String(e)}`,
              ),
            );
        }

        return;
      }

      await this.markAsFailed(
        entry,
        transcription,
        String(data?.ErrorMsg || '录音转写失败').trim(),
      );
    } catch (error: unknown) {
      await this.markAsFailed(
        entry,
        transcription,
        this.formatTencentAsrError(error, '查询转写结果失败'),
      );
    }
  }

  private async markAsFailed(
    entry: ServiceTimeline,
    transcription: TimelineTranscriptionMeta,
    message: string,
  ) {
    const metadata = this.normalizeMetadata(entry.metadata);
    const retryCount = Number(transcription.retryCount || 0) + 1;
    metadata.transcription = {
      ...transcription,
      status: 'failed',
      taskId: retryCount >= 3 ? transcription.taskId : undefined,
      retryCount,
      error: message,
      updatedAt: new Date().toISOString(),
    } satisfies TimelineTranscriptionMeta;
    entry.metadata = metadata;
    await this.timelineRepository.save(entry);
  }

  private buildTencentAsrResultText(
    detail?: Array<{ FinalSentence?: string; SliceSentence?: string }>,
    rawResult?: string,
  ) {
    const fromDetail = Array.isArray(detail)
      ? detail
          .map((item) => String(item?.FinalSentence || item?.SliceSentence || '').trim())
          .filter(Boolean)
          .join('\n')
          .trim()
      : '';
    if (fromDetail) return fromDetail;
    return String(rawResult || '')
      .replace(/\[[^\]]+\]/g, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  private simplifyTencentAsrSegments(
    detail?: Array<{
      StartMs?: number;
      EndMs?: number;
      FinalSentence?: string;
      SliceSentence?: string;
      SpeakerId?: number;
    }>,
  ) {
    if (!Array.isArray(detail)) return [];
    return detail
      .map((item) => ({
        startMs: Number(item?.StartMs || 0),
        endMs: Number(item?.EndMs || 0),
        text: String(item?.FinalSentence || item?.SliceSentence || '').trim(),
        speakerId:
          item?.SpeakerId == null ? undefined : Number(item.SpeakerId || 0),
      }))
      .filter((item) => item.text);
  }

  private async getTencentAsrSettings(): Promise<TencentAsrSettings> {
    const [
      enabledValue,
      secretIdValue,
      secretKeyValue,
      regionValue,
      engineModelTypeValue,
    ] = await Promise.all([
      this.systemService.getConfig('tencent_asr_enabled'),
      this.systemService.getConfig('tencent_asr_secret_id'),
      this.systemService.getConfig('tencent_asr_secret_key'),
      this.systemService.getConfig('tencent_asr_region'),
      this.systemService.getConfig('tencent_asr_engine_model_type'),
    ]);

    const storageSettings = await this.storageService.getResolvedSettings();

    return {
      enabled: String(enabledValue || '').trim() === 'true',
      secretId:
        String(secretIdValue || '').trim() || storageSettings.cosSecretId || '',
      secretKey:
        String(secretKeyValue || '').trim() || storageSettings.cosSecretKey || '',
      region: String(regionValue || '').trim() || 'ap-guangzhou',
      engineModelType:
        String(engineModelTypeValue || '').trim() || '16k_zh',
    };
  }

  private isTencentAsrReady(settings: TencentAsrSettings) {
    return !!(
      settings.enabled &&
      settings.secretId &&
      settings.secretKey &&
      settings.engineModelType
    );
  }

  private async callTencentAsrApi<T>(
    action: 'CreateRecTask' | 'DescribeTaskStatus',
    payload: Record<string, unknown>,
    settings: TencentAsrSettings,
  ): Promise<T> {
    const host = 'asr.tencentcloudapi.com';
    const service = 'asr';
    const version = '2019-06-14';
    const contentType = 'application/json; charset=utf-8';
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const body = JSON.stringify(payload);

    const hashedPayload = this.sha256Hex(body);
    const canonicalRequest = [
      'POST',
      '/',
      '',
      `content-type:${contentType}`,
      `host:${host}`,
      '',
      'content-type;host',
      hashedPayload,
    ].join('\n');

    const credentialScope = `${date}/${service}/tc3_request`;
    const stringToSign = [
      'TC3-HMAC-SHA256',
      String(timestamp),
      credentialScope,
      this.sha256Hex(canonicalRequest),
    ].join('\n');

    const secretDate = this.hmacSha256Buffer(`TC3${settings.secretKey}`, date);
    const secretService = this.hmacSha256Buffer(secretDate, service);
    const secretSigning = this.hmacSha256Buffer(secretService, 'tc3_request');
    const signature = this.hmacSha256Hex(secretSigning, stringToSign);

    const response = await fetch(`https://${host}`, {
      method: 'POST',
      headers: {
        Authorization: `TC3-HMAC-SHA256 Credential=${settings.secretId}/${credentialScope}, SignedHeaders=content-type;host, Signature=${signature}`,
        'Content-Type': contentType,
        Host: host,
        'X-TC-Action': action,
        'X-TC-Version': version,
        'X-TC-Timestamp': String(timestamp),
        'X-TC-Region': settings.region,
      },
      body,
    });

    const json = (await response.json().catch(() => ({}))) as {
      Response?: {
        Data?: T;
        RequestId?: string;
        Error?: { Code?: string; Message?: string };
      };
    };

    if (!response.ok || json?.Response?.Error) {
      const code = json?.Response?.Error?.Code || `HTTP_${response.status}`;
      const message =
        json?.Response?.Error?.Message || response.statusText || '腾讯云 ASR 请求失败';
      throw new Error(`${code}: ${message}`);
    }

    return (json?.Response?.Data || {}) as T;
  }

  private formatTencentAsrError(error: unknown, fallback: string) {
    const message = String(error || '').trim();
    if (!message) return fallback;
    return message.includes(':') ? message : `${fallback}：${message}`;
  }

  private sha256Hex(content: string) {
    return createHash('sha256').update(content, 'utf8').digest('hex');
  }

  private hmacSha256Buffer(key: string | Buffer, content: string) {
    return createHmac('sha256', key).update(content, 'utf8').digest();
  }

  private hmacSha256Hex(key: Buffer, content: string) {
    return createHmac('sha256', key).update(content, 'utf8').digest('hex');
  }

  private async extractMedicalOrdersFromTranscription(
    entry: ServiceTimeline,
    text: string,
  ) {
    const extracted = await this.aiConsultationService.extractMedicalOrders(text);
    if (!extracted) return;

    const metadata = this.normalizeMetadata(entry.metadata);
    metadata.aiExtracted = extracted;
    entry.metadata = metadata;
    await this.timelineRepository.save(entry);
    this.logger.log(`AI 医嘱提取完成 (timeline ${entry.id})`);
  }
}
