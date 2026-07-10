import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import {
  AgentConfigStatus,
  AiAgentConfig,
} from '../../entities/ai-agent-config.entity.js';
import { CrisisWord } from '../../entities/crisis-word.entity.js';
import { DEFAULT_TENANT_ID } from '../../entities/tenant.entity.js';
import { SaveAgentConfigDto } from './dto/save-agent-config.dto.js';
import {
  CreateCrisisWordDto,
  ListCrisisWordDto,
  UpdateCrisisWordDto,
} from './dto/crisis-word.dto.js';

@Injectable()
export class AiConfigService {
  constructor(
    @InjectRepository(AiAgentConfig)
    private readonly agentRepo: Repository<AiAgentConfig>,
    @InjectRepository(CrisisWord)
    private readonly crisisRepo: Repository<CrisisWord>,
  ) {}

  private tid(tenantId: number | null | undefined): number {
    return tenantId ?? DEFAULT_TENANT_ID;
  }

  // ─────────────── 智能体配置 ───────────────

  /** 当前可编辑配置（草稿优先，其次已发布，再次默认） + 已发布快照 */
  async getAgentConfig(tenantId: number | null) {
    const t = this.tid(tenantId);
    const draft = await this.agentRepo.findOne({
      where: { tenantId: t, status: AgentConfigStatus.DRAFT },
      order: { version: 'DESC' },
    });
    const published = await this.agentRepo.findOne({
      where: { tenantId: t, status: AgentConfigStatus.PUBLISHED },
      order: { version: 'DESC' },
    });
    return {
      working: draft ?? published ?? this.defaultConfig(t),
      published: published ?? null,
      hasDraft: !!draft,
    };
  }

  async listAgentVersions(tenantId: number | null) {
    const t = this.tid(tenantId);
    return this.agentRepo.find({
      where: { tenantId: t },
      order: { version: 'DESC' },
    });
  }

  /** 保存草稿（每租户一条草稿，反复覆盖） */
  async saveAgentDraft(
    tenantId: number | null,
    dto: SaveAgentConfigDto,
    userId?: number,
  ) {
    const t = this.tid(tenantId);
    let draft = await this.agentRepo.findOne({
      where: { tenantId: t, status: AgentConfigStatus.DRAFT },
      order: { version: 'DESC' },
    });
    if (draft) {
      Object.assign(draft, dto);
    } else {
      const nextVersion = (await this.maxVersion(t)) + 1;
      draft = this.agentRepo.create({
        ...dto,
        tenantId: t,
        status: AgentConfigStatus.DRAFT,
        version: nextVersion,
        createdBy: userId ?? null,
      });
    }
    return this.agentRepo.save(draft);
  }

  /** 发布某版本：置 published，旧 published 归档 */
  async publishAgent(tenantId: number | null, id: number) {
    const t = this.tid(tenantId);
    const cfg = await this.agentRepo.findOne({ where: { id, tenantId: t } });
    if (!cfg) throw new NotFoundException('配置版本不存在');
    await this.agentRepo.update(
      { tenantId: t, status: AgentConfigStatus.PUBLISHED },
      { status: AgentConfigStatus.ARCHIVED },
    );
    cfg.status = AgentConfigStatus.PUBLISHED;
    cfg.publishedAt = new Date();
    return this.agentRepo.save(cfg);
  }

  private async maxVersion(tenantId: number): Promise<number> {
    const row = await this.agentRepo
      .createQueryBuilder('c')
      .select('MAX(c.version)', 'max')
      .where('c.tenant_id = :t', { t: tenantId })
      .getRawOne<{ max: number | null }>();
    return Number(row?.max ?? 0);
  }

  private defaultConfig(tenantId: number): Partial<AiAgentConfig> {
    return {
      tenantId,
      name: '陪诊助手',
      model: 'DeepSeek',
      systemPrompt: '',
      memoryRounds: 20,
      temperature: 0.7,
      knowledgeBase: '',
      tools: {},
      version: 0,
      status: AgentConfigStatus.DRAFT,
    };
  }

  // ─────────────── 危机词库 ───────────────

  async listCrisisWords(tenantId: number | null, query: ListCrisisWordDto) {
    const t = this.tid(tenantId);
    const where: Record<string, unknown> = { tenantId: t };
    if (query.severity) where.severity = query.severity;
    if (query.keyword) where.word = Like(`%${query.keyword}%`);
    return this.crisisRepo.find({ where, order: { id: 'DESC' } });
  }

  async createCrisisWord(
    tenantId: number | null,
    dto: CreateCrisisWordDto,
    userId?: number,
  ) {
    const t = this.tid(tenantId);
    const row = this.crisisRepo.create({
      ...dto,
      tenantId: t,
      createdBy: userId ?? null,
    });
    return this.crisisRepo.save(row);
  }

  async updateCrisisWord(
    tenantId: number | null,
    id: number,
    dto: UpdateCrisisWordDto,
  ) {
    const t = this.tid(tenantId);
    const row = await this.crisisRepo.findOne({ where: { id, tenantId: t } });
    if (!row) throw new NotFoundException('危机词不存在');
    Object.assign(row, dto);
    return this.crisisRepo.save(row);
  }

  async toggleCrisisWord(tenantId: number | null, id: number) {
    const t = this.tid(tenantId);
    const row = await this.crisisRepo.findOne({ where: { id, tenantId: t } });
    if (!row) throw new NotFoundException('危机词不存在');
    row.enabled = !row.enabled;
    return this.crisisRepo.save(row);
  }

  async removeCrisisWord(tenantId: number | null, id: number) {
    const t = this.tid(tenantId);
    const row = await this.crisisRepo.findOne({ where: { id, tenantId: t } });
    if (!row) throw new NotFoundException('危机词不存在');
    await this.crisisRepo.remove(row);
    return { success: true };
  }
}
