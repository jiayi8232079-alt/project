import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, IsNull, Not, Repository } from 'typeorm';
import { AiDialogSession } from '../../entities/ai-dialog-session.entity.js';
import {
  AiDialogLog,
  DialogDirection,
} from '../../entities/ai-dialog-log.entity.js';
import { ListDialogSessionDto } from './dto/list-dialog.dto.js';
import { AppendDialogLogDto } from './dto/append-log.dto.js';
import { applyTenantFilter } from '../../common/utils/tenant-query.helper.js';
import { RequestContext } from '../../common/contexts/request-context.js';
import { DEFAULT_TENANT_ID } from '../../entities/tenant.entity.js';

/**
 * AI 对话留存服务。
 *
 * 写入路径（被 ai-gateway 调用，或 admin mock 入口）：
 * - `startSession()` 启动一次会话
 * - `appendLog()` 追加一条消息
 * - `finishSession()` 结束会话（可选自动算 crisisScore、生成 summary）
 *
 * 查询路径（被 App / 管理后台 / 质检页调用）：
 * - `listSessions()` 按 serviceTargetId / 时间筛选
 * - `getSessionDetail()` 单次会话的全部 logs
 */
@Injectable()
export class AiDialogService {
  private readonly logger = new Logger(AiDialogService.name);

  constructor(
    @InjectRepository(AiDialogSession)
    private readonly sessionRepo: Repository<AiDialogSession>,
    @InjectRepository(AiDialogLog)
    private readonly logRepo: Repository<AiDialogLog>,
  ) {}

  // ─────────────── 写入 ───────────────

  /** 启动一次会话；返回 session 实体（含 id 给后续 append 用）*/
  async startSession(input: {
    deviceId?: number | null;
    userId?: number | null;
    serviceTargetId?: number | null;
    agentId?: string | null;
    tenantId?: number;
  }): Promise<AiDialogSession> {
    const tenantId =
      input.tenantId ?? RequestContext.currentTenantId() ?? DEFAULT_TENANT_ID;
    const session = this.sessionRepo.create({
      tenantId,
      deviceId: input.deviceId ?? null,
      userId: input.userId ?? null,
      serviceTargetId: input.serviceTargetId ?? null,
      agentId: input.agentId ?? null,
      startedAt: new Date(),
      endedAt: null,
      totalTurns: 0,
      totalTokens: 0,
      mcpToolCallsCount: 0,
      crisisScore: 0,
      crisisWords: null,
      summary: null,
      qaStatus: 'pending',
    });
    return this.sessionRepo.save(session);
  }

  /**
   * 追加一条日志；sessionId=0 时自动新建一个 session。
   * 同步更新 session 的累计字段（totalTurns/totalTokens/crisis*）。
   */
  async appendLog(dto: AppendDialogLogDto): Promise<AiDialogLog> {
    let session: AiDialogSession;
    if (dto.sessionId && dto.sessionId > 0) {
      const found = await this.sessionRepo.findOne({ where: { id: dto.sessionId } });
      if (!found) throw new NotFoundException('对话会话不存在');
      session = found;
    } else {
      session = await this.startSession({
        deviceId: dto.deviceId ?? null,
        userId: dto.userId ?? null,
        serviceTargetId: dto.serviceTargetId ?? null,
        agentId: dto.sessionMetadata?.agentId ?? null,
      });
    }

    const log = this.logRepo.create({
      tenantId: session.tenantId,
      sessionId: session.id,
      deviceId: dto.deviceId ?? session.deviceId,
      userId: dto.userId ?? session.userId,
      serviceTargetId: dto.serviceTargetId ?? session.serviceTargetId,
      direction: dto.direction,
      text: dto.text,
      audioUrl: dto.audioUrl ?? null,
      emotion: dto.emotion ?? null,
      crisisWords: dto.crisisWords?.length ? dto.crisisWords : null,
      toolCalls: dto.toolCalls?.length ? dto.toolCalls : null,
      tokenCount: dto.tokenCount ?? null,
      latencyMs: dto.latencyMs ?? null,
      intent: dto.intent ?? null,
      modelName: dto.modelName ?? null,
    });
    const saved = await this.logRepo.save(log);

    // 同步 session 累计
    session.totalTurns += 1;
    if (typeof dto.tokenCount === 'number') {
      session.totalTokens += dto.tokenCount;
    }
    if (dto.toolCalls?.length) {
      session.mcpToolCallsCount += dto.toolCalls.length;
    }
    if (dto.crisisWords?.length) {
      // 危机评分简单加权：每个危机词 +20，封顶 100
      session.crisisScore = Math.min(100, session.crisisScore + dto.crisisWords.length * 20);
      const existing = new Set(session.crisisWords ?? []);
      dto.crisisWords.forEach((w) => existing.add(w));
      session.crisisWords = [...existing];
    }
    await this.sessionRepo.save(session);

    return saved;
  }

  /** 结束会话；可附带 summary（由调用方在外部 LLM 生成后传入）*/
  async finishSession(sessionId: number, summary?: string): Promise<AiDialogSession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('对话会话不存在');
    if (session.endedAt) {
      throw new BadRequestException('会话已结束');
    }
    session.endedAt = new Date();
    if (summary) session.summary = summary;
    return this.sessionRepo.save(session);
  }

  // ─────────────── 查询 ───────────────

  async listSessions(query: ListDialogSessionDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.sessionRepo
      .createQueryBuilder('s')
      .orderBy('s.startedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    applyTenantFilter(qb, 's');

    if (query.serviceTargetId) {
      qb.andWhere('s.service_target_id = :stid', { stid: query.serviceTargetId });
    }
    if (query.deviceId) {
      qb.andWhere('s.device_id = :did', { did: query.deviceId });
    }
    if (query.from) {
      qb.andWhere('s.started_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('s.started_at <= :to', { to: new Date(query.to) });
    }
    if (query.qaStatus) {
      qb.andWhere('s.qa_status = :qa', { qa: query.qaStatus });
    }
    if (query.hasCrisis === 'true') {
      qb.andWhere('s.crisis_score > 0');
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getSessionDetail(id: number): Promise<{
    session: AiDialogSession;
    logs: AiDialogLog[];
  }> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('对话会话不存在');
    const logs = await this.logRepo.find({
      where: { sessionId: id },
      order: { createdAt: 'ASC' },
    });
    return { session, logs };
  }

  /** 质检：标记 session 状态（admin 用）*/
  async markQaStatus(
    id: number,
    status: 'sampled' | 'reviewed' | 'flagged',
  ): Promise<AiDialogSession> {
    const session = await this.sessionRepo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('对话会话不存在');
    session.qaStatus = status;
    return this.sessionRepo.save(session);
  }

  /** 给 ai-gateway 复用：按 device_id 拿最近一次未结束的 session */
  async findOpenSessionForDevice(deviceId: number): Promise<AiDialogSession | null> {
    return this.sessionRepo.findOne({
      where: { deviceId, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
  }

  /** 给质检报告用：按时间段统计危机会话数 */
  async countCrisisSessionsInRange(from: Date, to: Date): Promise<number> {
    return this.sessionRepo.count({
      where: {
        startedAt: Between(from, to),
        crisisScore: Not(0),
      },
    });
  }
}
