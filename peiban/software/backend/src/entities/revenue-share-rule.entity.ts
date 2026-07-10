import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

/**
 * 分账规则类型。
 *
 * - `percentage` 按订单金额百分比抽佣
 * - `flat`       每笔固定金额（如每激活一台设备 ¥50）
 * - `tier`       阶梯（按月销售额跳档；详情见 settings JSON）
 */
export enum RevenueShareRuleType {
  PERCENTAGE = 'percentage',
  FLAT = 'flat',
  TIER = 'tier',
}

export enum RevenueShareScope {
  /** 设备订阅分账 */
  SUBSCRIPTION = 'subscription',
  /** 上门服务订单分账 */
  ORDER = 'order',
  /** 增值服务 */
  ADDON = 'addon',
}

/**
 * 渠道分账规则 —— 每个渠道（partner tenant）可挂多条规则按 scope 命中。
 *
 * 命中策略（service 层实现）：
 * - 同 partner + 同 scope 多条 → 取 `priority` 最大的；
 * - rate 浮点数 [0,1]：percentage 时即抽佣比例；flat/tier 时忽略；
 * - `flatAmount` 仅 flat 用；
 * - `settings` JSON 兜底阶梯/规则参数。
 *
 * 数据归属：
 * - `tenantId` 是「订单/订阅产生的租户」；
 * - `partnerTenantId` 是「拿分成的渠道租户」（如代理商）；
 * - 一对多：一个 partner 可在多个客户租户里拿分成。
 */
@Entity('revenue_share_rules')
@Index(['partnerTenantId'])
@Index(['scope'])
@Index(['tenantId', 'partnerTenantId', 'scope'])
@Index(['active'])
export class RevenueShareRule extends TenantAwareEntity {
  @Column({
    name: 'partner_tenant_id',
    type: 'int',
    comment: '拿分成的渠道租户 ID',
  })
  partnerTenantId: number;

  @Column({ type: 'enum', enum: RevenueShareRuleType, default: RevenueShareRuleType.PERCENTAGE })
  type: RevenueShareRuleType;

  @Column({ type: 'enum', enum: RevenueShareScope, default: RevenueShareScope.SUBSCRIPTION })
  scope: RevenueShareScope;

  @Column({
    type: 'decimal',
    precision: 6,
    scale: 4,
    default: 0,
    transformer: DecimalTransformer,
    comment: 'percentage 时分账比例 [0,1]（如 0.2 = 20%）',
  })
  rate: number;

  @Column({
    name: 'flat_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
    comment: 'flat 时每笔固定金额（元）',
  })
  flatAmount: number;

  @Column({ name: 'priority', type: 'int', default: 0, comment: '优先级，大值先匹配' })
  priority: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '阶梯规则或其它扩展（tier 必填）',
  })
  settings: Record<string, unknown> | null;

  @Column({
    name: 'valid_from',
    type: 'datetime',
    nullable: true,
    comment: '生效起始（null = 永久生效）',
  })
  validFrom: Date | null;

  @Column({
    name: 'valid_until',
    type: 'datetime',
    nullable: true,
    comment: '生效截止',
  })
  validUntil: Date | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;
}
