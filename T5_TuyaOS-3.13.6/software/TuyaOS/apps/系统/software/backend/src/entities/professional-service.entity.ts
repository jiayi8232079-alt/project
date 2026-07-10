import { Entity, Column, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum ProfessionalServiceCategory {
  /** 营养服务：糖尿病/高血压/术后/老年营养 */
  NUTRITION = 'nutrition',
  /** 康复指导：骨科/脑卒中/肿瘤术后/长期卧床 */
  REHABILITATION = 'rehabilitation',
  /** 护理对接：换药/管路/失能/夜班陪护 */
  NURSING = 'nursing',
  /** 心理支持：家属照护者减压/老人情绪陪伴 */
  PSYCHOLOGY = 'psychology',
  /** 母婴育护：月嫂/产后康复/婴幼儿照护（未来扩展） */
  MATERNAL_CHILD = 'maternal_child',
}

/**
 * SOP 单步骤。
 */
export interface ProfessionalServiceSopStep {
  /** 步骤标题，如「初次评估」「制定方案」 */
  title: string;
  /** 该步骤服务人员要做什么（给内部 SOP） */
  description: string;
  /** 预计用时（分钟，可选） */
  durationMin?: number;
  /** 该步骤的执行清单（可选，陪诊员/护理师可打勾） */
  checklistItems?: string[];
}

/**
 * 专业服务目录（营养/康复/护理/心理支持/母婴育护）。
 *
 * 该目录为平台"非陪诊"服务的商品化容器，与订单通过 `order.serviceType` 字段（code）
 * 或未来的 `order.professional_service_id` 外键关联。
 *
 * 业务定位：
 *   - 目录项可在后台配置，支持启用/禁用与排序；
 *   - 每个服务项都带 SOP 步骤，用于指导服务人员执行；
 *   - 适用人群 & 亮点 用于小程序列表页展示；
 *   - 定价为展示用文案（平台当前不走线上支付）。
 */
@Entity('professional_services')
@Index(['category'])
@Index(['enabled', 'sortOrder'])
export class ProfessionalService extends TenantAwareEntity {
  @Column({
    type: 'enum',
    enum: ProfessionalServiceCategory,
    comment: '服务分类',
  })
  category: ProfessionalServiceCategory;

  @Column({
    type: 'varchar',
    length: 64,
    unique: true,
    comment: '服务编码（订单 serviceType 关联用，如 nutrition_diabetes）',
  })
  code: string;

  @Column({ type: 'varchar', length: 80, comment: '服务名称' })
  name: string;

  @Column({
    name: 'short_desc',
    type: 'varchar',
    length: 180,
    comment: '一句话介绍',
  })
  shortDesc: string;

  @Column({
    type: 'text',
    nullable: true,
    comment: '详细介绍（富文本或纯文本）',
  })
  detail: string | null;

  @Column({
    type: 'varchar',
    length: 40,
    default: 'medical_services',
    comment: 'Material Symbols 图标名称',
  })
  icon: string;

  @Column({
    name: 'cover_image',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '封面图 URL（可选）',
  })
  coverImage: string | null;

  @Column({
    name: 'target_groups',
    type: 'simple-json',
    comment: '适用人群标签，如 ["老年人","糖尿病患者"]',
  })
  targetGroups: string[];

  @Column({
    type: 'simple-json',
    comment: '卖点亮点，3~5 条',
  })
  highlights: string[];

  @Column({
    name: 'duration_hint',
    type: 'varchar',
    length: 80,
    nullable: true,
    comment: '周期/单次说明（如"单次上门 / 7天周期"）',
  })
  durationHint: string | null;

  @Column({
    name: 'price_display_text',
    type: 'varchar',
    length: 80,
    nullable: true,
    comment: '展示用定价文案，不走真实支付（如"¥299 起 / 次"）',
  })
  priceDisplayText: string | null;

  @Column({
    name: 'sop_steps',
    type: 'json',
    comment: 'SOP 步骤列表（ProfessionalServiceSopStep[]）',
  })
  sopSteps: ProfessionalServiceSopStep[];

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否启用（小程序可见、可预约）',
  })
  enabled: boolean;

  @Column({
    name: 'sort_order',
    type: 'int',
    default: 0,
    comment: '排序值（同分类内越小越靠前）',
  })
  sortOrder: number;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'builtin',
    comment: '来源：builtin（内置种子）/ custom（运营创建）',
  })
  source: 'builtin' | 'custom';
}
