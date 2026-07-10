import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';
import { Order } from './order.entity.js';
import { MedicationPrescription } from './medication-prescription.entity.js';

export enum ReminderStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum ReminderFrequency {
  ONCE = 'once',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  CUSTOM = 'custom',
}

export enum ReminderChannel {
  WECHAT_WORK = 'wechat_work',
  MINI_PROGRAM = 'mini_program',
  ALL = 'all',
}

export enum ReminderType {
  MEDICATION = 'medication',
  FOLLOW_UP = 'follow_up',
}

/**
 * 药品严重度分级。决定升级链阈值（miss 宽限期、是否推家属/管理员等）。
 * 默认阈值见 MedicationEscalationPolicy。
 */
export enum ReminderSeverity {
  /** 抗凝、抗精神、抗癫痫、抗肿瘤、强心、胰岛素等 → 漏服影响大 */
  HIGH = 'high',
  /** 慢病控制类：降压、降糖、降脂、慢性病维持 */
  MEDIUM = 'medium',
  /** 维生素、保健品、辅助类 */
  LOW = 'low',
}

/**
 * 漏服升级策略覆盖。任一字段为 null/undefined 走 severity 默认值。
 *
 * 字段单位统一为"自到点时刻起的分钟数"。典型含义：
 *   - firstFollowUpMinutes: 到点后 N 分钟，若仍 pending → 入队 miss_1st
 *   - markMissedMinutes: 到点后 M 分钟，若仍 pending → log.status = missed
 *   - escalateFamilyAfterMinutes: 标 missed 后 K 分钟，若仍 pending → 升级家属
 *   - escalateAdminAfterMinutes: 升级家属后 L 分钟，若仍 pending → 升级管理员
 */
export interface MedicationEscalationOverride {
  firstFollowUpMinutes?: number;
  markMissedMinutes?: number;
  escalateFamilyAfterMinutes?: number;
  escalateAdminAfterMinutes?: number;
  disableEscalation?: boolean;
}

/**
 * 索引：
 * - (userId, status, reminderType)：findByUser 主路径（首页/老人端 onShow 必拉）
 * - (orderId)：按订单查关联提醒（结束服务时同步）
 * - (prescriptionId)：处方批次聚合
 *
 * 生产环境手工补：
 *   CREATE INDEX idx_med_user_status_type ON medication_reminders(user_id, status, reminder_type);
 *   CREATE INDEX idx_med_order_id ON medication_reminders(order_id);
 *   CREATE INDEX idx_med_prescription_id ON medication_reminders(prescription_id);
 */
@Entity('medication_reminders')
@Index(['userId', 'status', 'reminderType'])
@Index(['orderId'])
@Index(['prescriptionId'])
export class MedicationReminder extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'service_target_id', nullable: true })
  serviceTargetId: number;

  @Column({ name: 'order_id', nullable: true })
  orderId: number;

  @Column({
    name: 'prescription_id',
    type: 'int',
    nullable: true,
    comment: '来源处方批次（同一张处方的多种药通过此字段聚合）',
  })
  prescriptionId: number | null;

  @ManyToOne(() => MedicationPrescription, (p) => p.reminders, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'prescription_id' })
  prescription: MedicationPrescription | null;

  @Column({ name: 'medicine_name', comment: '药品名称' })
  medicineName: string;

  @Column({
    name: 'reminder_type',
    type: 'enum',
    enum: ReminderType,
    default: ReminderType.MEDICATION,
    comment: '提醒类型',
  })
  reminderType: ReminderType;

  @Column({
    type: 'enum',
    enum: ReminderSeverity,
    default: ReminderSeverity.MEDIUM,
    comment: '药品严重度分级，决定漏服升级阈值',
  })
  severity: ReminderSeverity;

  @Column({ nullable: true, comment: '用量/剂量（文案，展示用）' })
  dosage: string;

  @Column({
    name: 'dose_per_time',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
    comment: '每次用量数值，如 1 / 0.5 / 2，用于总疗程自动换算',
  })
  dosePerTime: number | null;

  @Column({
    name: 'times_per_day',
    type: 'tinyint',
    nullable: true,
    comment: '每日频次，用于生成默认 reminderTimes',
  })
  timesPerDay: number | null;

  @Column({
    name: 'total_quantity',
    type: 'int',
    nullable: true,
    comment: '总药量（与 unit 搭配），用于自动算 endDate',
  })
  totalQuantity: number | null;

  @Column({
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: '单位：片/粒/瓶/支/ml 等',
  })
  unit: string | null;

  @Column({ name: 'follow_up_hospital', nullable: true, comment: '复诊医院' })
  followUpHospital: string;

  @Column({ name: 'follow_up_department', nullable: true, comment: '复诊科室' })
  followUpDepartment: string;

  @Column({
    type: 'enum',
    enum: ReminderFrequency,
    default: ReminderFrequency.DAILY,
    comment: '提醒频率',
  })
  frequency: ReminderFrequency;

  @Column({
    name: 'reminder_times',
    type: 'simple-json',
    comment: '每日提醒时间点列表，如 ["08:00","12:00","18:00"]',
  })
  reminderTimes: string[];

  @Column({ name: 'start_date', type: 'date', comment: '开始日期' })
  startDate: string;

  @Column({ name: 'end_date', type: 'date', comment: '结束日期' })
  endDate: string;

  @Column({ nullable: true, comment: '用药说明/备注' })
  instructions: string;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    default: ReminderStatus.ACTIVE,
  })
  status: ReminderStatus;

  @Column({
    type: 'enum',
    enum: ReminderChannel,
    default: ReminderChannel.ALL,
    comment: '通知渠道',
  })
  channel: ReminderChannel;

  @Column({
    name: 'miss_escalation_override',
    type: 'json',
    nullable: true,
    comment: '漏服升级策略覆盖（不填走 severity 默认）',
  })
  missEscalationOverride: MedicationEscalationOverride | null;

  @Column({ name: 'last_notified_at', type: 'datetime', nullable: true })
  lastNotifiedAt: Date;

  @Column({ name: 'created_by', nullable: true, comment: '创建者（管理员ID）' })
  createdBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => ServiceTarget, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order;
}
