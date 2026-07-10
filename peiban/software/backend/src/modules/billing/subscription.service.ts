import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Subscription,
  SubscriptionStatus,
} from '../../entities/subscription.entity.js';
import {
  SubscriptionBillingCycle,
  SubscriptionPlan,
} from '../../entities/subscription-plan.entity.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { ListSubscriptionDto } from './dto/list-subscription.dto.js';
import { applyTenantFilter } from '../../common/utils/tenant-query.helper.js';

/**
 * 订阅生命周期服务。
 *
 * 关键路径：
 * - `create()` 创建订阅 → 试用期 / 立即扣费由调用方决定（v1.0 默认进入 TRIALING / ACTIVE）
 * - `renew()` 续费 → 更新 currentPeriodEnd + nextChargeAt
 * - `cancel()` 用户取消 → CANCELED（但保留数据）
 * - `pause()` 管理员暂停 → PAUSED（欠费/封号）
 *
 * v1.0 不接真实支付：所有扣费都是"假账"，写 usage_records 留痕，由 finance/账单模块后续对账。
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepo: Repository<Subscription>,
    @InjectRepository(SubscriptionPlan)
    private readonly planRepo: Repository<SubscriptionPlan>,
  ) {}

  // ─────────────── 套餐字典 ───────────────

  async listPlans(category?: string) {
    const qb = this.planRepo
      .createQueryBuilder('p')
      .where('p.active = true')
      .orderBy('p.category', 'ASC')
      .addOrderBy('p.price', 'ASC');
    if (category) qb.andWhere('p.category = :c', { c: category });
    return qb.getMany();
  }

  async findPlan(id: number) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('套餐不存在');
    return plan;
  }

  // ─────────────── 订阅 CRUD ───────────────

  async create(userId: number, dto: CreateSubscriptionDto): Promise<Subscription> {
    const plan = await this.findPlan(dto.planId);
    if (!plan.active) throw new BadRequestException('套餐已下架');

    const now = new Date();
    const startedAt = now;
    const trialEnd =
      plan.trialDays > 0
        ? new Date(now.getTime() + plan.trialDays * 86400_000)
        : null;
    const periodEnd = this.computePeriodEnd(
      trialEnd ?? now,
      plan.billingCycle,
    );

    const sub = this.subscriptionRepo.create({
      planId: plan.id,
      userId,
      deviceId: dto.deviceId ?? null,
      status: trialEnd ? SubscriptionStatus.TRIALING : SubscriptionStatus.ACTIVE,
      startedAt,
      currentPeriodEnd: periodEnd,
      nextChargeAt: trialEnd ?? periodEnd,
      autoRenew: dto.autoRenew !== false,
      unitPriceSnapshot: plan.price,
      canceledAt: null,
      cancelReason: null,
    });
    return this.subscriptionRepo.save(sub);
  }

  async list(userId: number, query: ListSubscriptionDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.subscriptionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.plan', 'plan')
      .leftJoinAndSelect('s.device', 'device')
      .where('s.user_id = :uid', { uid: userId })
      .orderBy('s.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (query.status) qb.andWhere('s.status = :st', { st: query.status });
    applyTenantFilter(qb, 's');
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findById(id: number, userId?: number) {
    const sub = await this.subscriptionRepo.findOne({
      where: { id },
      relations: ['plan', 'device'],
    });
    if (!sub) throw new NotFoundException('订阅不存在');
    if (userId && sub.userId !== userId) {
      throw new ForbiddenException('无权访问该订阅');
    }
    return sub;
  }

  async renew(id: number, userId?: number) {
    const sub = await this.findById(id, userId);
    if (sub.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('已取消的订阅不能续费，请重新订阅');
    }
    const plan = sub.plan ?? (await this.findPlan(sub.planId));
    const from = sub.currentPeriodEnd ?? new Date();
    sub.currentPeriodEnd = this.computePeriodEnd(from, plan.billingCycle);
    sub.nextChargeAt = sub.currentPeriodEnd;
    sub.status = SubscriptionStatus.ACTIVE;
    return this.subscriptionRepo.save(sub);
  }

  async cancel(id: number, userId: number | undefined, reason?: string) {
    const sub = await this.findById(id, userId);
    if (sub.status === SubscriptionStatus.CANCELED) return sub;
    sub.status = SubscriptionStatus.CANCELED;
    sub.canceledAt = new Date();
    sub.cancelReason = reason ?? null;
    sub.autoRenew = false;
    return this.subscriptionRepo.save(sub);
  }

  async pause(id: number, reason?: string) {
    const sub = await this.findById(id);
    sub.status = SubscriptionStatus.PAUSED;
    sub.cancelReason = reason ?? null;
    return this.subscriptionRepo.save(sub);
  }

  // ─────────────── 内部工具 ───────────────

  private computePeriodEnd(from: Date, cycle: SubscriptionBillingCycle): Date {
    const end = new Date(from);
    switch (cycle) {
      case SubscriptionBillingCycle.MONTHLY:
        end.setMonth(end.getMonth() + 1);
        break;
      case SubscriptionBillingCycle.YEARLY:
        end.setFullYear(end.getFullYear() + 1);
        break;
      case SubscriptionBillingCycle.ONE_TIME:
        // 一次性付款没有"周期"，设一个很远的将来表示永不到期
        end.setFullYear(end.getFullYear() + 100);
        break;
    }
    return end;
  }
}
