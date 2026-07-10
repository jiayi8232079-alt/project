import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { EncryptedColumnTransformer } from '../common/utils/column-encryption.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  SettlementStatus,
} from '../common/enums/index.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';
import { Attendant } from './attendant.entity.js';
import { ServiceTimeline } from './service-timeline.entity.js';
import { Document } from './document.entity.js';
import { FinanceRecord } from './finance-record.entity.js';
import { Review } from './review.entity.js';
import { Hospital } from './hospital.entity.js';
import { ProfessionalService } from './professional-service.entity.js';

/**
 * 订单是高频查询表（用户/陪诊员列表、按状态过滤、定时巡检 cron 都打这里）。
 * 没有索引时随数据量上来，`/orders` 列表会从「秒级」降到「数十秒」级，
 * 进而拖慢小程序首页 `loadActiveOrder` / `loadPendingCount`。
 *
 * - userId, attendantId：列表过滤主键
 * - (status, createdAt)：列表默认 ORDER BY createdAt + 经常按状态过滤，复合索引最优
 * - serviceTime：cron 巡检 / 服务前提醒按时间窗扫描
 *
 * 注意：synchronize=false 的生产环境不会自动建索引，需手工跑：
 *   CREATE INDEX idx_orders_user_id ON orders(user_id);
 *   CREATE INDEX idx_orders_attendant_id ON orders(attendant_id);
 *   CREATE INDEX idx_orders_status_created ON orders(status, created_at);
 *   CREATE INDEX idx_orders_service_time ON orders(service_time);
 */
@Entity('orders')
@Index(['userId'])
@Index(['attendantId'])
@Index(['status', 'createdAt'])
@Index(['serviceTime'])
export class Order extends TenantAwareEntity {
  @Column({ name: 'order_number', unique: true })
  orderNumber: string;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.orders)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'service_target_id' })
  serviceTargetId: number;

  @ManyToOne(() => ServiceTarget, (target) => target.orders)
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget;

  @Column({ name: 'attendant_id', nullable: true })
  attendantId: number;

  @Column({ name: 'need_attendant', type: 'boolean', default: true })
  needAttendant: boolean;

  @ManyToOne(() => Attendant, (attendant) => attendant.orders, {
    nullable: true,
  })
  @JoinColumn({ name: 'attendant_id' })
  attendant: Attendant;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING_DISPATCH,
  })
  status: OrderStatus;

  @Column({ name: 'service_type', nullable: true })
  serviceType: string;

  /**
   * 关联到"专业服务目录"，把订单纳入多角色体系。
   *
   * 老订单 serviceType 是自由字符串（"陪诊"、"体检"等），向前兼容保留；
   * 新订单建议写 professional_service_id，派单引擎会按
   *   ProfessionalService.category → role.matchCategories → attendant.professionalRoles
   * 自动匹配候选服务者。
   */
  @Column({
    name: 'professional_service_id',
    type: 'int',
    nullable: true,
    comment: '关联的专业服务（nutrition/rehabilitation/nursing/psychology/maternal_child 等）',
  })
  professionalServiceId: number | null;

  @ManyToOne(() => ProfessionalService, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'professional_service_id' })
  professionalService: ProfessionalService | null;

  @Column({ name: 'service_time', type: 'datetime', nullable: true })
  serviceTime: Date;

  /** 预约/约定的服务结束时间；可与 service_time 跨日 */
  @Column({ name: 'service_end_time', type: 'datetime', nullable: true })
  serviceEndTime: Date | null;

  @Column({ name: 'service_address', nullable: true })
  serviceAddress: string;

  @Column({ nullable: true })
  hospital: string;

  @Column({ nullable: true })
  department: string;

  /**
   * 导诊一键下单：booked=用户已自行约号；pending_cs=待客服协助约号（仍将流入订单中心并由客服致电确认）
   */
  @Column({
    name: 'hospital_booking_status',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  hospitalBookingStatus: 'booked' | 'pending_cs' | null;

  @Column({ name: 'hospital_directory_id', nullable: true })
  hospitalDirectoryId: number | null;

  @ManyToOne(() => Hospital, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'hospital_directory_id' })
  hospitalDirectory: Hospital | null;

  /** 用户填写的回电号码，便于客服与本人联系（加密存储） */
  @Column({
    name: 'callback_contact_phone',
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  callbackContactPhone: string | null;

  @Column({
    name: 'risk_level',
    type: 'varchar',
    length: 16,
    nullable: true,
    select: false,
  })
  riskLevel: string | null;

  @Column({
    name: 'base_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  baseFee: number;

  @Column({
    name: 'total_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  totalFee: number;

  @Column({
    name: 'settlement_status',
    type: 'enum',
    enum: SettlementStatus,
    default: SettlementStatus.PENDING,
  })
  settlementStatus: SettlementStatus;

  @Column({
    name: 'payment_status',
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.UNPAID,
  })
  paymentStatus: PaymentStatus;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
    nullable: true,
  })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'payment_paid_at', type: 'datetime', nullable: true })
  paymentPaidAt: Date | null;

  @Column({ name: 'payment_reference', type: 'varchar', length: 128, nullable: true })
  paymentReference: string | null;

  @Column({ name: 'settled_at', type: 'datetime', nullable: true })
  settledAt: Date | null;

  @Column({ name: 'settlement_remark', type: 'text', nullable: true })
  settlementRemark: string | null;

  /** 陪诊员此单收入（服务费，派单时设定） */
  @Column({
    name: 'attendant_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: DecimalTransformer,
  })
  attendantFee: number | null;

  /** 陪诊员费用类型标签（如：本地陪诊、跨城·杭州等，便于展示） */
  @Column({
    name: 'attendant_fee_type',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  attendantFeeType: string | null;

  @Column({ name: 'attendant_extra_income_items', type: 'json', nullable: true })
  attendantExtraIncomeItems:
    | { id: string; name: string; amount: number; note?: string }[]
    | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'checkup_package_name', nullable: true })
  checkupPackageName: string;

  @Column({ name: 'checkup_gender', nullable: true })
  checkupGender: string;

  @Column({ name: 'checkup_optional_items', type: 'json', nullable: true })
  checkupOptionalItems: { id: string; name: string; price: number }[] | null;

  @Column({ name: 'additional_service_items', type: 'json', nullable: true })
  additionalServiceItems:
    | { id: string; name: string; amount: number; note?: string }[]
    | null;

  @Column({ name: 'cancel_reason', nullable: true })
  cancelReason: string;

  @Column({ name: 'canceled_by', nullable: true })
  canceledBy: string;

  @Column({ name: 'sign_url', nullable: true })
  signUrl: string;

  /** 用户（客户端）签署的陪诊服务确认单手写签名图片地址 */
  @Column({
    name: 'service_confirm_signature_url',
    type: 'varchar',
    length: 512,
    nullable: true,
  })
  serviceConfirmSignatureUrl: string | null;

  @Column({ name: 'service_confirm_signed_at', type: 'datetime', nullable: true })
  serviceConfirmSignedAt: Date | null;

  @Column({
    name: 'service_confirm_signer_name',
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  serviceConfirmSignerName: string | null;

  @Column({
    name: 'service_confirm_signer_relation',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  serviceConfirmSignerRelation: string | null;

  /** 陪诊员实时位置（GCJ-02），仅服务进行中更新 */
  @Column({ name: 'attendant_live_lat', type: 'double', nullable: true })
  attendantLiveLat: number | null;

  @Column({ name: 'attendant_live_lng', type: 'double', nullable: true })
  attendantLiveLng: number | null;

  @Column({ name: 'attendant_live_at', type: 'datetime', nullable: true })
  attendantLiveAt: Date | null;

  @Column({ name: 'completion_data', type: 'json', nullable: true })
  completionData: Record<string, unknown> | null;

  @OneToMany(() => ServiceTimeline, (timeline) => timeline.order)
  timelines: ServiceTimeline[];

  @OneToMany(() => Document, (doc) => doc.order)
  documents: Document[];

  @OneToMany(() => FinanceRecord, (record) => record.order)
  financeRecords: FinanceRecord[];

  @OneToMany(() => Review, (review) => review.order)
  reviews: Review[];
}
