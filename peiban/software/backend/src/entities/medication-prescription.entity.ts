import { Entity, Column, ManyToOne, JoinColumn, Index, OneToMany } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';
import { Order } from './order.entity.js';
import { MedicationReminder } from './medication-reminder.entity.js';

export enum PrescriptionReviewStatus {
  /** 运营直接录入（或 admin 自动通过）、已建 reminder */
  APPROVED = 'approved',
  /** 陪诊员提交待审 */
  PENDING_REVIEW = 'pending_review',
  /** 运营驳回 */
  REJECTED = 'rejected',
}

/**
 * 处方批次：一次就诊产生的完整处方记录。
 *
 * 设计目的：
 *   - 一张处方往往含多种药（如波立维 + 敏使朗 + 奇比特），
 *     运营一条一条录效率低且易漏；本表作为批次容器，
 *     一次录入即可产生多条 MedicationReminder。
 *   - 保留处方原件（照片）便于事后追溯「为什么这么开」。
 *   - 关联订单：陪诊服务完成时，把处方挂到订单下，
 *     服务报告 / 家属看板自然能看到"本次就诊开了什么药"。
 */
@Entity('medication_prescriptions')
@Index(['userId', 'serviceTargetId'])
@Index(['orderId'])
export class MedicationPrescription extends TenantAwareEntity {
  @Column({ name: 'user_id', comment: '处方归属用户（通常是家属）' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({
    name: 'service_target_id',
    type: 'int',
    nullable: true,
    comment: '实际服药的服务对象（老人），null 表示就是 user 本人',
  })
  serviceTargetId: number | null;

  @ManyToOne(() => ServiceTarget, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget | null;

  @Column({
    name: 'order_id',
    type: 'int',
    nullable: true,
    comment: '来源陪诊订单（可选）',
  })
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({
    name: 'source_image',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '处方原件照片 URL（COS/本地路径），便于后续复核',
  })
  sourceImage: string | null;

  @Column({
    name: 'hospital',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '开方医院',
  })
  hospital: string | null;

  @Column({
    name: 'doctor_name',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '开方医生',
  })
  doctorName: string | null;

  @Column({
    name: 'department',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '开方科室',
  })
  department: string | null;

  @Column({
    name: 'issued_date',
    type: 'date',
    nullable: true,
    comment: '开方日期',
  })
  issuedDate: string | null;

  @Column({
    type: 'text',
    nullable: true,
    comment: '处方备注：注意事项、饮食禁忌等',
  })
  note: string | null;

  @Column({
    name: 'created_by',
    type: 'int',
    nullable: true,
    comment: '录入者 admin_user_id（运营），null=用户自助录入',
  })
  createdBy: number | null;

  @Column({
    name: 'submitted_by_user_id',
    type: 'int',
    nullable: true,
    comment: '提交方用户 ID（陪诊员侧小程序提交时写）',
  })
  submittedByUserId: number | null;

  @Column({
    name: 'submitted_by_role',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '提交方角色：admin/operator/customer_service/attendant/user',
  })
  submittedByRole: string | null;

  @Column({
    name: 'review_status',
    type: 'enum',
    enum: PrescriptionReviewStatus,
    default: PrescriptionReviewStatus.APPROVED,
    comment: '审核状态：陪诊员提交走 pending_review，运营确认后 approved 才产生 reminder',
  })
  reviewStatus: PrescriptionReviewStatus;

  @Column({
    name: 'items_draft',
    type: 'json',
    nullable: true,
    comment:
      '待审状态下陪诊员录入的药品草稿（approved 后会被搬到 medication_reminders，此字段保留做回溯）',
  })
  itemsDraft: unknown | null;

  @Column({
    name: 'reviewer_id',
    type: 'int',
    nullable: true,
    comment: '审核人 admin_user_id',
  })
  reviewerId: number | null;

  @Column({
    name: 'reviewed_at',
    type: 'datetime',
    nullable: true,
    comment: '审核时间',
  })
  reviewedAt: Date | null;

  @Column({
    name: 'review_note',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '审核备注 / 驳回原因',
  })
  reviewNote: string | null;

  @OneToMany(() => MedicationReminder, (reminder) => reminder.prescription)
  reminders: MedicationReminder[];
}
