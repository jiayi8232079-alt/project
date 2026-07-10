import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ProfessionalService,
  ProfessionalServiceCategory,
  ProfessionalServiceSopStep,
} from '../../entities/professional-service.entity.js';
import { BUILTIN_PROFESSIONAL_SERVICES } from './professional-service.seed.js';

export class ProfessionalServiceUpsertDto {
  category: ProfessionalServiceCategory;
  code: string;
  name: string;
  shortDesc: string;
  detail?: string | null;
  icon?: string;
  coverImage?: string | null;
  targetGroups: string[];
  highlights: string[];
  durationHint?: string | null;
  priceDisplayText?: string | null;
  sopSteps: ProfessionalServiceSopStep[];
  enabled?: boolean;
  sortOrder?: number;
}

@Injectable()
export class ProfessionalServiceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ProfessionalServiceService.name);

  constructor(
    @InjectRepository(ProfessionalService)
    private readonly repo: Repository<ProfessionalService>,
  ) {}

  async onApplicationBootstrap() {
    try {
      const existing = await this.repo.find({ where: { source: 'builtin' } });
      const existingCodes = new Set(existing.map((r) => r.code));
      const toInsert: ProfessionalService[] = [];
      for (const seed of BUILTIN_PROFESSIONAL_SERVICES) {
        if (existingCodes.has(seed.code)) continue;
        toInsert.push(
          this.repo.create({
            category: seed.category,
            code: seed.code,
            name: seed.name,
            shortDesc: seed.shortDesc,
            detail: seed.detail,
            icon: seed.icon,
            targetGroups: seed.targetGroups,
            highlights: seed.highlights,
            durationHint: seed.durationHint,
            priceDisplayText: seed.priceDisplayText,
            sopSteps: seed.sopSteps,
            enabled: true,
            sortOrder: seed.sortOrder,
            source: 'builtin',
          }),
        );
      }
      if (toInsert.length > 0) {
        await this.repo.save(toInsert);
        this.logger.log(
          `Professional services seeded: +${toInsert.length}, total builtin=${existing.length + toInsert.length}`,
        );
      }
    } catch (e) {
      this.logger.warn(
        `professional services seed skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  // ─── 公共查询（小程序用，只看 enabled） ───

  async listPublic(query?: { category?: ProfessionalServiceCategory }) {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.enabled = :e', { e: true });
    if (query?.category) qb.andWhere('s.category = :c', { c: query.category });
    qb.orderBy('s.sortOrder', 'ASC').addOrderBy('s.id', 'ASC');
    return qb.getMany();
  }

  async getPublicByCode(code: string): Promise<ProfessionalService> {
    const s = await this.repo.findOne({ where: { code, enabled: true } });
    if (!s) throw new NotFoundException('服务不存在或已下架');
    return s;
  }

  // ─── 管理后台 ───

  async listAdmin(query?: {
    page?: number;
    pageSize?: number;
    category?: ProfessionalServiceCategory;
    enabled?: boolean;
    keyword?: string;
  }) {
    const page = Math.max(1, Number(query?.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query?.pageSize) || 20));
    const qb = this.repo.createQueryBuilder('s');

    if (query?.category) qb.andWhere('s.category = :c', { c: query.category });
    if (typeof query?.enabled === 'boolean')
      qb.andWhere('s.enabled = :e', { e: query.enabled });
    if (query?.keyword) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere('(s.name LIKE :kw OR s.code LIKE :kw)', { kw });
    }

    qb.orderBy('s.category', 'ASC')
      .addOrderBy('s.sortOrder', 'ASC')
      .addOrderBy('s.id', 'ASC');

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getById(id: number): Promise<ProfessionalService> {
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('服务不存在');
    return s;
  }

  async create(dto: ProfessionalServiceUpsertDto): Promise<ProfessionalService> {
    this.validateDto(dto);
    const existingCode = await this.repo.findOne({ where: { code: dto.code } });
    if (existingCode) throw new BadRequestException('服务编码已存在');
    const entity = this.repo.create({
      category: dto.category,
      code: dto.code.trim(),
      name: dto.name.trim(),
      shortDesc: dto.shortDesc.trim(),
      detail: dto.detail?.trim() || null,
      icon: dto.icon || 'medical_services',
      coverImage: dto.coverImage || null,
      targetGroups: (dto.targetGroups || []).map((s) => s.trim()).filter(Boolean),
      highlights: (dto.highlights || []).map((s) => s.trim()).filter(Boolean),
      durationHint: dto.durationHint?.trim() || null,
      priceDisplayText: dto.priceDisplayText?.trim() || null,
      sopSteps: this.normalizeSopSteps(dto.sopSteps),
      enabled: dto.enabled ?? true,
      sortOrder: dto.sortOrder ?? 999,
      source: 'custom',
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: Partial<ProfessionalServiceUpsertDto>,
  ): Promise<ProfessionalService> {
    const entity = await this.getById(id);
    if (dto.code !== undefined && dto.code !== entity.code) {
      const collision = await this.repo.findOne({ where: { code: dto.code } });
      if (collision && collision.id !== entity.id)
        throw new BadRequestException('服务编码已存在');
      entity.code = dto.code.trim();
    }

    if (dto.category !== undefined) entity.category = dto.category;
    if (dto.name !== undefined) entity.name = dto.name.trim();
    if (dto.shortDesc !== undefined) entity.shortDesc = dto.shortDesc.trim();
    if (dto.detail !== undefined) entity.detail = dto.detail?.trim() || null;
    if (dto.icon !== undefined) entity.icon = dto.icon;
    if (dto.coverImage !== undefined) entity.coverImage = dto.coverImage || null;
    if (dto.targetGroups !== undefined) {
      entity.targetGroups = (dto.targetGroups || [])
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (dto.highlights !== undefined) {
      entity.highlights = (dto.highlights || [])
        .map((s) => s.trim())
        .filter(Boolean);
    }
    if (dto.durationHint !== undefined)
      entity.durationHint = dto.durationHint?.trim() || null;
    if (dto.priceDisplayText !== undefined)
      entity.priceDisplayText = dto.priceDisplayText?.trim() || null;
    if (dto.sopSteps !== undefined)
      entity.sopSteps = this.normalizeSopSteps(dto.sopSteps);
    if (dto.enabled !== undefined) entity.enabled = dto.enabled;
    if (dto.sortOrder !== undefined) entity.sortOrder = dto.sortOrder;

    return this.repo.save(entity);
  }

  async remove(id: number): Promise<void> {
    const s = await this.getById(id);
    if (s.source === 'builtin') {
      throw new BadRequestException('内置服务不可删除，可改为禁用状态');
    }
    await this.repo.delete(id);
  }

  async toggleEnabled(id: number): Promise<ProfessionalService> {
    const s = await this.getById(id);
    s.enabled = !s.enabled;
    return this.repo.save(s);
  }

  // ─── helpers ───

  private validateDto(dto: ProfessionalServiceUpsertDto) {
    if (!dto.code || !/^[a-z][a-z0-9_]{2,63}$/i.test(dto.code)) {
      throw new BadRequestException(
        '服务编码 code 必须为字母开头、仅包含字母/数字/下划线、3-64 字符',
      );
    }
    if (!dto.name || !dto.name.trim()) {
      throw new BadRequestException('服务名称 name 不能为空');
    }
    if (!dto.shortDesc || !dto.shortDesc.trim()) {
      throw new BadRequestException('服务介绍 shortDesc 不能为空');
    }
    if (!Array.isArray(dto.sopSteps) || dto.sopSteps.length === 0) {
      throw new BadRequestException('至少需要一条 SOP 步骤');
    }
  }

  private normalizeSopSteps(
    steps: ProfessionalServiceSopStep[],
  ): ProfessionalServiceSopStep[] {
    return (steps || [])
      .map((s) => ({
        title: String(s?.title || '').trim(),
        description: String(s?.description || '').trim(),
        durationMin:
          s?.durationMin != null && Number.isFinite(Number(s.durationMin))
            ? Math.max(1, Math.min(720, Math.floor(Number(s.durationMin))))
            : undefined,
        checklistItems: Array.isArray(s?.checklistItems)
          ? s!.checklistItems!.map((x) => String(x).trim()).filter(Boolean)
          : undefined,
      }))
      .filter((s) => s.title && s.description);
  }
}
