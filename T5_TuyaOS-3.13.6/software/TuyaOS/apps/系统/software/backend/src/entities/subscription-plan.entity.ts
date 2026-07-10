import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

/**
 * 订阅套餐 —— 配置型字典，运营在管理后台维护。
 *
 * 分类：
 * - `device`     设备订阅（基础版/Pro/家庭版，对应每台设备的 SaaS 月费）
 * - `ai`         AI 用量包（DIA 对话次数 / token 限额）
 * - `institution` 机构年费（按床位/人数）
 * - `addon`      增值服务包（健康报告/专家匹配）
 */
export enum SubscriptionPlanCategory {
  DEVICE = 'device',
  AI = 'ai',
  INSTITUTION = 'institution',
  ADDON = 'addon',
}

export enum SubscriptionBillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
  /** 一次性付款（如硬件捆绑）*/
  ONE_TIME = 'one_time',
}

@Entity('subscription_plans')
@Index(['category'])
@Index(['active'])
export class SubscriptionPlan extends TenantAwareEntity {
  @Column({ unique: true, length: 64, comment: '套餐唯一 code（如 device-basic-monthly）' })
  code: string;

  @Column({ length: 128, comment: '展示名称' })
  name: string;

  @Column({ type: 'enum', enum: SubscriptionPlanCategory })
  category: SubscriptionPlanCategory;

  @Column({
    name: 'billing_cycle',
    type: 'enum',
    enum: SubscriptionBillingCycle,
    default: SubscriptionBillingCycle.MONTHLY,
  })
  billingCycle: SubscriptionBillingCycle;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
    comment: '单价（元）',
  })
  price: number;

  @Column({
    name: 'trial_days',
    type: 'int',
    default: 0,
    comment: '试用期天数（0=无试用）',
  })
  trialDays: number;

  @Column({
    type: 'json',
    nullable: true,
    comment: '套餐权益清单（如视频通话分钟、AI 对话次数、健康报告频次等）',
  })
  benefits: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true, comment: '是否上架可购买' })
  active: boolean;
}
