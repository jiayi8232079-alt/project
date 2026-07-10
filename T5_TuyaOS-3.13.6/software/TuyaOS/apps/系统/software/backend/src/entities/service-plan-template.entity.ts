import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';

/**
 * 专业服务方案模板类型。营养师/康复师/月嫂等服务者在自己的工作台里
 * 沉淀可复用的方案，服务时选一份模板附到订单即可成为当次服务的"方案"。
 */
export enum ServicePlanKind {
  /** 营养师：食谱 / 饮食结构 */
  MEAL_PLAN = 'meal_plan',
  /** 康复师：康复训练方案 */
  TRAINING_PLAN = 'training_plan',
  /** 月嫂/居家护理员：育护日志/日常照护清单 */
  CARE_LOG = 'care_log',
  /** 其他（未来扩展） */
  OTHER = 'other',
}

/**
 * 单条方案内容项。灵活 JSON，前端根据 kind 渲染对应 UI：
 *   meal_plan：{ meal: '早餐' | '午餐' | ... , items: [{ name, amount, note }] }
 *   training_plan：{ phase, exercises: [{ name, sets, reps, durationMin }] }
 *   care_log：{ time, note, photoUrls?: string[] }
 */
export interface ServicePlanContentItem {
  title?: string;
  description?: string;
  data?: Record<string, unknown>;
}

@Entity('service_plan_templates')
@Index(['kind', 'authorUserId'])
@Index(['kind', 'isPublic'])
export class ServicePlanTemplate extends TenantAwareEntity {
  @Column({
    type: 'enum',
    enum: ServicePlanKind,
    comment: '模板类型',
  })
  kind: ServicePlanKind;

  @Column({
    name: 'author_user_id',
    type: 'int',
    nullable: true,
    comment: '创建者（通常是服务者，可空——表示运营预置）',
  })
  authorUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'author_user_id' })
  author: User | null;

  @Column({ type: 'varchar', length: 128, comment: '方案标题' })
  title: string;

  @Column({
    name: 'cover_image',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '封面图（可选，展示用）',
  })
  coverImage: string | null;

  @Column({
    name: 'target_conditions',
    type: 'simple-json',
    nullable: true,
    comment: '适用人群/病情标签，如 ["糖尿病","术后恢复"]',
  })
  targetConditions: string[] | null;

  @Column({ type: 'text', nullable: true, comment: '方案摘要/正文说明' })
  summary: string | null;

  @Column({
    type: 'json',
    comment: '结构化内容（ServicePlanContentItem[] 或 kind 特定结构）',
  })
  content: ServicePlanContentItem[] | Record<string, unknown>;

  @Column({
    type: 'simple-json',
    nullable: true,
    comment: '搜索标签',
  })
  tags: string[] | null;

  @Column({
    name: 'is_public',
    type: 'boolean',
    default: false,
    comment: '是否公共模板（运营置顶可让所有同职业看到）',
  })
  isPublic: boolean;

  @Column({ type: 'int', default: 0, comment: '使用次数（附到订单时累加）' })
  useCount: number;
}
