import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { MedicationReminder } from './medication-reminder.entity.js';
import { MedicationExecutionLog } from './medication-execution-log.entity.js';

export enum MedicationJobKind {
  /** 到点首推（订阅消息 / 短信并行入队） */
  FIRST_PUSH = 'first_push',
  /** 到点后第 1 次追推（severity 决定的 15/30/60 分钟） */
  MISS_1ST = 'miss_1st',
  /** 到点后第 2 次追推（宽限期内仍未打卡） */
  MISS_2ND = 'miss_2nd',
  /** 标为 missed 后升级家属 */
  ESCALATE_FAMILY = 'escalate_family',
  /** 家属升级后再未响应，升级管理员 / 客服 */
  ESCALATE_ADMIN = 'escalate_admin',
  /** 每日家属汇总（20:00 触发） */
  FAMILY_DIGEST = 'family_digest',
  /** 复诊提醒 */
  FOLLOW_UP = 'follow_up',
}

export enum MedicationJobChannel {
  MINI_PROGRAM = 'mini_program',
  SMS = 'sms',
  VOICE_CALL = 'voice_call',
  IN_APP = 'in_app',
}

export enum MedicationJobTargetKind {
  /** 服务对象（老人）本人 */
  SERVICE_TARGET = 'service_target',
  /** 客户账号（通常就是家属） */
  USER = 'user',
  /** 家属监护人（非主账号） */
  GUARDIAN = 'guardian',
  /** 运营 / 客服 */
  ADMIN = 'admin',
}

export enum MedicationJobStatus {
  /** 已入队，等调度 */
  PENDING = 'pending',
  /** worker 正在发送中（幂等锁） */
  SENDING = 'sending',
  /** 单次发送失败，等下一次重试 */
  RETRYING = 'retrying',
  /** 发送成功（任一渠道回执 ok） */
  SUCCESS = 'success',
  /** 彻底失败（超过 maxAttempts，已写 lastError） */
  DEAD = 'dead',
  /** 人工或业务侧取消（比如 reminder 被暂停） */
  CANCELLED = 'cancelled',
}

/**
 * 用药 / 复诊推送任务队列。
 *
 * 为什么需要：
 *   - 原来的每分钟 cron 直接调 fetch 推送，失败只打 logger.warn，零重试零降级，
 *     严重药一旦第一次没推到，就等于漏服；
 *   - 本表把推送变成"任务流"：入队 → worker 扫描 → 失败指数退避 → 渠道降级，
 *     同时为"到点未打卡升级链"提供物化队列（便于后台可视化 & 人工干预）。
 */
@Entity('medication_notification_jobs')
@Index(['status', 'nextAttemptAt'])
@Index(['reminderId', 'kind'])
@Index(['scheduledAt'])
export class MedicationNotificationJob extends BaseEntity {
  @Column({ name: 'reminder_id' })
  reminderId: number;

  @ManyToOne(() => MedicationReminder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reminder_id' })
  reminder: MedicationReminder;

  @Column({
    name: 'execution_log_id',
    type: 'int',
    nullable: true,
    comment: '关联的某个打卡记录（当 kind 是升级链时一定有值）',
  })
  executionLogId: number | null;

  @ManyToOne(() => MedicationExecutionLog, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'execution_log_id' })
  executionLog: MedicationExecutionLog | null;

  @Column({
    type: 'enum',
    enum: MedicationJobKind,
    comment: '任务类型，决定文案与升级策略',
  })
  kind: MedicationJobKind;

  @Column({
    type: 'enum',
    enum: MedicationJobChannel,
    comment: '发送渠道',
  })
  channel: MedicationJobChannel;

  @Column({
    name: 'target_kind',
    type: 'enum',
    enum: MedicationJobTargetKind,
    comment: '目标身份，决定降级策略',
  })
  targetKind: MedicationJobTargetKind;

  @Column({
    name: 'target_user_id',
    type: 'int',
    nullable: true,
    comment: '目标用户 ID（小程序时与 openid 配对）',
  })
  targetUserId: number | null;

  @Column({
    name: 'target_phone',
    type: 'varchar',
    length: 20,
    nullable: true,
    comment: 'SMS / 电话渠道时使用',
  })
  targetPhone: string | null;

  @Column({
    name: 'target_openid',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: 'mini_program 渠道时使用',
  })
  targetOpenid: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '渠道特定的 payload（模板 ID / 变量 / 跳转路径等）快照',
  })
  payload: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: MedicationJobStatus,
    default: MedicationJobStatus.PENDING,
  })
  status: MedicationJobStatus;

  @Column({ type: 'int', default: 0, comment: '已尝试次数' })
  attempts: number;

  @Column({
    name: 'max_attempts',
    type: 'int',
    default: 3,
    comment: '最大重试次数，超过即 DEAD',
  })
  maxAttempts: number;

  @Column({
    name: 'scheduled_at',
    type: 'datetime',
    comment: '应执行时间（到点推送 / 到点 + 15min 等）',
  })
  scheduledAt: Date;

  @Column({
    name: 'next_attempt_at',
    type: 'datetime',
    comment: '下一次 worker 应处理的时间，小于 now 才会被拾起',
  })
  nextAttemptAt: Date;

  @Column({
    name: 'sent_at',
    type: 'datetime',
    nullable: true,
    comment: '最后一次实际发送时间',
  })
  sentAt: Date | null;

  @Column({
    name: 'responded_at',
    type: 'datetime',
    nullable: true,
    comment: '渠道回执时间（如短信 SerialNo 返回）',
  })
  respondedAt: Date | null;

  @Column({
    name: 'provider_ref',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '渠道流水号：腾讯云 SerialNo / 微信 msgid 等，便于对账',
  })
  providerRef: string | null;

  @Column({
    name: 'last_error',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '最后一次失败原因',
  })
  lastError: string | null;
}
