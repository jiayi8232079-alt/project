import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import {
  UsageMetric,
  UsageRecord,
} from '../../entities/usage-record.entity.js';
import { RecordUsageDto } from './dto/record-usage.dto.js';
import { applyTenantFilter } from '../../common/utils/tenant-query.helper.js';

/**
 * 用量计量服务 —— 各业务模块（ai-gateway / device / video-call）触发用量时调用。
 *
 * 调用模式：
 *   await usageMeter.record(userId, { metric: UsageMetric.AI_DIALOG_CALL, quantity: 1, subscriptionId });
 *
 * v1.0 实现要点：
 * - 不做实时账单结算，只落库；按月统计另由 cron 跑；
 * - 单价 v1.0 默认 0（"包月"模式），按量计费等运营后台配出来再补；
 * - 提供「按 user + metric + 时间段」的聚合查询，供 App 显示「本月已用 XX」。
 */
@Injectable()
export class UsageMeterService {
  private readonly logger = new Logger(UsageMeterService.name);

  constructor(
    @InjectRepository(UsageRecord)
    private readonly usageRepo: Repository<UsageRecord>,
  ) {}

  async record(userId: number, dto: RecordUsageDto): Promise<UsageRecord> {
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date();
    const row = this.usageRepo.create({
      userId,
      subscriptionId: dto.subscriptionId ?? null,
      deviceId: dto.deviceId ?? null,
      sessionId: dto.sessionId ?? null,
      metric: dto.metric,
      quantity: dto.quantity,
      unitPrice: 0, // v1.0 默认 0；按量计费规则配齐后改成查 plan
      occurredAt,
      metadata: null,
    });
    return this.usageRepo.save(row);
  }

  /** 单个用户在 [from, to] 内某个 metric 的累计用量 */
  async sumUserMetric(
    userId: number,
    metric: UsageMetric,
    from: Date,
    to: Date,
  ): Promise<number> {
    const qb = this.usageRepo
      .createQueryBuilder('u')
      .select('COALESCE(SUM(u.quantity), 0)', 'total')
      .where('u.user_id = :uid', { uid: userId })
      .andWhere('u.metric = :m', { m: metric })
      .andWhere('u.occurred_at BETWEEN :from AND :to', { from, to });
    applyTenantFilter(qb, 'u');
    const raw = (await qb.getRawOne()) as { total: string | number } | undefined;
    return Number(raw?.total ?? 0);
  }

  /** 按 metric 聚合本月用量，供 App 「我的-用量」页面 */
  async getMonthlyUsage(userId: number, year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const metrics = Object.values(UsageMetric);
    const result: Record<string, number> = {};
    for (const m of metrics) {
      result[m] = await this.sumUserMetric(userId, m, from, to);
    }
    return { year, month, usage: result };
  }

  /** 运营后台：某月各 metric 用量汇总（按当前租户作用域，admin 全量） */
  async adminMonthlySummary(year: number, month: number) {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 1);
    const qb = this.usageRepo
      .createQueryBuilder('u')
      .select('u.metric', 'metric')
      .addSelect('COALESCE(SUM(u.quantity), 0)', 'quantity')
      .addSelect('COALESCE(SUM(u.quantity * u.unit_price), 0)', 'amount')
      .addSelect('COUNT(u.id)', 'records')
      .where('u.occurred_at >= :from AND u.occurred_at < :to', { from, to })
      .groupBy('u.metric');
    applyTenantFilter(qb, 'u');
    const rows = await qb.getRawMany<{
      metric: string;
      quantity: string;
      amount: string;
      records: string;
    }>();

    const byMetric: Record<string, number> = {};
    const amountByMetric: Record<string, number> = {};
    let totalQuantity = 0;
    let totalAmount = 0;
    let totalRecords = 0;
    for (const m of Object.values(UsageMetric)) {
      byMetric[m] = 0;
      amountByMetric[m] = 0;
    }
    for (const r of rows) {
      byMetric[r.metric] = Number(r.quantity ?? 0);
      amountByMetric[r.metric] = Number(r.amount ?? 0);
      totalQuantity += Number(r.quantity ?? 0);
      totalAmount += Number(r.amount ?? 0);
      totalRecords += Number(r.records ?? 0);
    }
    return { year, month, byMetric, amountByMetric, totalQuantity, totalAmount, totalRecords };
  }

  /** 运营后台：用量明细分页列表 */
  async adminListRecords(params: {
    metric?: UsageMetric;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
    const qb = this.usageRepo.createQueryBuilder('u');
    if (params.metric) qb.andWhere('u.metric = :m', { m: params.metric });
    if (params.from) qb.andWhere('u.occurred_at >= :from', { from: new Date(params.from) });
    if (params.to) qb.andWhere('u.occurred_at <= :to', { to: new Date(params.to) });
    applyTenantFilter(qb, 'u');
    qb.orderBy('u.occurred_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** 查询某个订阅的用量历史 */
  async listBySubscription(
    subscriptionId: number,
    from?: Date,
    to?: Date,
    limit = 100,
  ): Promise<UsageRecord[]> {
    const where: Record<string, unknown> = { subscriptionId };
    if (from && to) where.occurredAt = Between(from, to);
    return this.usageRepo.find({
      where,
      order: { occurredAt: 'DESC' },
      take: limit,
    });
  }
}
