import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThanOrEqual, Or, Repository, IsNull } from 'typeorm';
import {
  RevenueShareRule,
  RevenueShareRuleType,
  RevenueShareScope,
} from '../../entities/revenue-share-rule.entity.js';
import {
  CreateRevenueShareRuleDto,
  UpdateRevenueShareRuleDto,
} from './dto/save-revenue-share-rule.dto.js';

/**
 * 渠道分账规则匹配 / 计算服务。
 *
 * 主要接口：
 * - `findRulesFor(tenantId, partnerTenantId, scope)` 给定客户租户 + 渠道 + 场景找规则
 * - `calculateShare(amount, rule)` 给定金额 + 规则算分账金额
 * - `applyForOrder(tenantId, orderAmount, partnerTenantId)` 一站式：找规则 + 算分账
 *
 * v1.0 不做分账落账（不写 commission_records 表），仅返回计算结果由调用方决定怎么用；
 * Wave1.x 接 finance 模块时会增加结算记录持久化。
 */
@Injectable()
export class RevenueShareService {
  private readonly logger = new Logger(RevenueShareService.name);

  constructor(
    @InjectRepository(RevenueShareRule)
    private readonly ruleRepo: Repository<RevenueShareRule>,
  ) {}

  // ─────────────── 规则管理（运营后台 CRUD） ───────────────

  async listRules(filter?: {
    scope?: RevenueShareScope;
    partnerTenantId?: number;
    tenantId?: number;
    active?: boolean;
  }): Promise<RevenueShareRule[]> {
    const where: Record<string, unknown> = {};
    if (filter?.scope) where.scope = filter.scope;
    if (filter?.partnerTenantId) where.partnerTenantId = filter.partnerTenantId;
    if (filter?.tenantId) where.tenantId = filter.tenantId;
    if (filter?.active !== undefined) where.active = filter.active;
    return this.ruleRepo.find({
      where,
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
  }

  async createRule(dto: CreateRevenueShareRuleDto): Promise<RevenueShareRule> {
    const row = this.ruleRepo.create({
      tenantId: dto.tenantId,
      partnerTenantId: dto.partnerTenantId,
      type: dto.type,
      scope: dto.scope,
      rate: dto.rate ?? 0,
      flatAmount: dto.flatAmount ?? 0,
      priority: dto.priority ?? 0,
      settings: dto.settings ?? null,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      active: dto.active ?? true,
      description: dto.description ?? null,
    });
    return this.ruleRepo.save(row);
  }

  async updateRule(
    id: number,
    dto: UpdateRevenueShareRuleDto,
  ): Promise<RevenueShareRule> {
    const row = await this.ruleRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('分账规则不存在');
    if (dto.partnerTenantId !== undefined) row.partnerTenantId = dto.partnerTenantId;
    if (dto.type !== undefined) row.type = dto.type;
    if (dto.scope !== undefined) row.scope = dto.scope;
    if (dto.rate !== undefined) row.rate = dto.rate;
    if (dto.flatAmount !== undefined) row.flatAmount = dto.flatAmount;
    if (dto.priority !== undefined) row.priority = dto.priority;
    if (dto.settings !== undefined) row.settings = dto.settings;
    if (dto.validFrom !== undefined) row.validFrom = dto.validFrom ? new Date(dto.validFrom) : null;
    if (dto.validUntil !== undefined) {
      row.validUntil = dto.validUntil ? new Date(dto.validUntil) : null;
    }
    if (dto.active !== undefined) row.active = dto.active;
    if (dto.description !== undefined) row.description = dto.description;
    return this.ruleRepo.save(row);
  }

  async toggleRule(id: number): Promise<RevenueShareRule> {
    const row = await this.ruleRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('分账规则不存在');
    row.active = !row.active;
    return this.ruleRepo.save(row);
  }

  async removeRule(id: number): Promise<{ success: boolean }> {
    const row = await this.ruleRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('分账规则不存在');
    await this.ruleRepo.remove(row);
    return { success: true };
  }

  // ─────────────── 规则匹配 / 计算 ───────────────

  async findRulesFor(
    tenantId: number,
    partnerTenantId: number,
    scope: RevenueShareScope,
  ): Promise<RevenueShareRule[]> {
    const now = new Date();
    const rules = await this.ruleRepo.find({
      where: {
        tenantId,
        partnerTenantId,
        scope,
        active: true,
        // valid_from <= now OR NULL
        validFrom: Or(LessThanOrEqual(now), IsNull()),
        // valid_until >= now OR NULL
        validUntil: Or(MoreThanOrEqual(now), IsNull()),
      },
      order: { priority: 'DESC', createdAt: 'DESC' },
    });
    return rules;
  }

  calculateShare(amount: number, rule: RevenueShareRule): number {
    switch (rule.type) {
      case RevenueShareRuleType.PERCENTAGE:
        return Math.round(amount * Number(rule.rate) * 100) / 100;
      case RevenueShareRuleType.FLAT:
        return Number(rule.flatAmount);
      case RevenueShareRuleType.TIER:
        return this.calculateTier(amount, rule);
      default:
        return 0;
    }
  }

  async applyForOrder(
    tenantId: number,
    partnerTenantId: number,
    scope: RevenueShareScope,
    amount: number,
  ): Promise<{ rule: RevenueShareRule | null; share: number }> {
    const rules = await this.findRulesFor(tenantId, partnerTenantId, scope);
    if (rules.length === 0) return { rule: null, share: 0 };
    const rule = rules[0]; // 取优先级最高
    return { rule, share: this.calculateShare(amount, rule) };
  }

  /**
   * 阶梯计算（settings.tiers = [{ upTo: 10000, rate: 0.1 }, { upTo: 50000, rate: 0.15 }, { upTo: null, rate: 0.2 }]）。
   * 取命中区间的 rate 乘以金额；命中后区间外金额仍按当前 rate 算（不分段累加）。
   */
  private calculateTier(amount: number, rule: RevenueShareRule): number {
    const tiers = ((rule.settings as { tiers?: { upTo?: number | null; rate: number }[] })?.tiers) ?? [];
    if (!tiers.length) return 0;
    let rate = 0;
    for (const t of tiers) {
      if (t.upTo == null || amount <= t.upTo) {
        rate = t.rate;
        break;
      }
    }
    return Math.round(amount * rate * 100) / 100;
  }
}
