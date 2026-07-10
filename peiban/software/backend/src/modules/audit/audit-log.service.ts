import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuditLog } from '../../entities/audit-log.entity.js';

/** 脱敏关键字：这些键会被替换为 "***"，不落库 */
const SENSITIVE_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'currentPassword',
  'token',
  'captchacode',
  'captchatoken',
  'pin',
  'idcard',
  'idCard',
]);

/** 可选的日志查询参数 */
export interface ListAuditLogsQuery {
  page?: number;
  pageSize?: number;
  actorType?: string;
  actorId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  from?: string;
  to?: string;
}

/** 写入审计日志的数据结构 */
export interface CreateAuditLogInput {
  actorType: string;
  actorId?: number | null;
  actorName?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  method?: string | null;
  path?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  statusCode?: number | null;
  requestSummary?: string | null;
  durationMs?: number | null;
  remark?: string | null;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * 对请求体/响应等结构做浅层脱敏：
   * - 命中 SENSITIVE_KEYS 的字段替换为 "***"
   * - 超长字符串截断到 512 字符
   */
  sanitize(body: unknown): any {
    if (body == null) return null;
    if (typeof body === 'string') {
      return body.length > 512 ? `${body.slice(0, 512)}…` : body;
    }
    if (Array.isArray(body)) {
      return body.slice(0, 20).map((item) => this.sanitize(item));
    }
    if (typeof body === 'object') {
      const result: Record<string, unknown> = {};
      const src = body as Record<string, unknown>;
      let count = 0;
      for (const [key, value] of Object.entries(src)) {
        if (count >= 30) break;
        if (SENSITIVE_KEYS.has(key) || SENSITIVE_KEYS.has(key.toLowerCase())) {
          result[key] = '***';
        } else {
          result[key] = this.sanitize(value);
        }
        count += 1;
      }
      return result;
    }
    return body as any;
  }

  /**
   * 将对象序列化为审计用的 summary 字符串（已脱敏），长度不超过 4KB。
   */
  serializeSummary(body: unknown): string | null {
    const sanitized = this.sanitize(body);
    if (sanitized == null) return null;
    try {
      const text = JSON.stringify(sanitized);
      if (!text) return null;
      return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
    } catch {
      return null;
    }
  }

  async create(input: CreateAuditLogInput): Promise<AuditLog | null> {
    try {
      const entity = this.repo.create({
        actorType: input.actorType || 'system',
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        resourceType: input.resourceType ?? null,
        resourceId: input.resourceId ?? null,
        method: input.method ?? null,
        path: input.path ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent
          ? input.userAgent.slice(0, 255)
          : null,
        statusCode: input.statusCode ?? null,
        requestSummary: input.requestSummary ?? null,
        durationMs: input.durationMs ?? null,
        remark: input.remark ? input.remark.slice(0, 512) : null,
      });
      return await this.repo.save(entity);
    } catch (err) {
      this.logger.warn(
        `audit log insert failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  async list(query: ListAuditLogsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.repo
      .createQueryBuilder('log')
      .orderBy('log.id', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.actorType) {
      qb.andWhere('log.actorType = :actorType', { actorType: query.actorType });
    }
    if (query.actorId != null && !Number.isNaN(Number(query.actorId))) {
      qb.andWhere('log.actorId = :actorId', { actorId: Number(query.actorId) });
    }
    if (query.action) {
      qb.andWhere('log.action LIKE :action', { action: `%${query.action}%` });
    }
    if (query.resourceType) {
      qb.andWhere('log.resourceType = :resourceType', {
        resourceType: query.resourceType,
      });
    }
    if (query.resourceId) {
      qb.andWhere('log.resourceId = :resourceId', {
        resourceId: query.resourceId,
      });
    }
    if (query.from && query.to) {
      qb.andWhere(
        'log.createdAt BETWEEN :from AND :to',
        { from: `${query.from} 00:00:00`, to: `${query.to} 23:59:59` },
      );
    } else if (query.from) {
      qb.andWhere('log.createdAt >= :from', { from: `${query.from} 00:00:00` });
    } else if (query.to) {
      qb.andWhere('log.createdAt <= :to', { to: `${query.to} 23:59:59` });
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** 辅助：根据区间统计总条数 */
  async countBetween(from: Date, to: Date) {
    return this.repo.count({ where: { createdAt: Between(from, to) } });
  }
}
