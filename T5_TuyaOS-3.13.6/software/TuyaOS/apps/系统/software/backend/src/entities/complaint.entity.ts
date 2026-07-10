import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { EncryptedColumnTransformer } from '../common/utils/column-encryption.js';
import { User } from './user.entity.js';
import { Order } from './order.entity.js';
import { Attendant } from './attendant.entity.js';
import { AdminUser } from './admin-user.entity.js';

export enum ComplaintCategory {
  SERVICE = 'service',
  ATTENDANT = 'attendant',
  DISPATCH = 'dispatch',
  PAYMENT = 'payment',
  REPORT = 'report',
  OTHER = 'other',
}

export enum ComplaintPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ComplaintStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

@Entity('complaints')
export class Complaint extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  @Index()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'order_id', nullable: true })
  @Index()
  orderId: number | null;

  @ManyToOne(() => Order, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ name: 'attendant_id', nullable: true })
  attendantId: number | null;

  @ManyToOne(() => Attendant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'attendant_id' })
  attendant: Attendant | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: ComplaintCategory.OTHER,
  })
  category: ComplaintCategory;

  @Column({ type: 'varchar', length: 128 })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'json', nullable: true })
  images: string[] | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  contactPhone: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: ComplaintPriority.NORMAL,
  })
  priority: ComplaintPriority;

  @Column({
    type: 'varchar',
    length: 16,
    default: ComplaintStatus.PENDING,
  })
  @Index()
  status: ComplaintStatus;

  /** 指派的客服人员 id */
  @Column({ name: 'handler_id', nullable: true })
  handlerId: number | null;

  @ManyToOne(() => AdminUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'handler_id' })
  handler: AdminUser | null;

  /** 处理结论（管理员回复） */
  @Column({ type: 'text', nullable: true })
  resolution: string | null;

  /** 内部备注（不对客户可见） */
  @Column({ name: 'internal_note', type: 'text', nullable: true })
  internalNote: string | null;

  @Column({ name: 'resolved_at', type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'datetime', nullable: true })
  closedAt: Date | null;

  /** 用户对处理结果的评分（1-5），可选 */
  @Column({ name: 'user_rating', type: 'tinyint', nullable: true })
  userRating: number | null;

  /** 对话/动态流水（管理员答复 + 客户补充），按时间顺序追加 */
  @Column({ type: 'json', nullable: true })
  timeline:
    | {
        at: string;
        byType: 'user' | 'admin' | 'system';
        byId?: number | null;
        byName?: string | null;
        content: string;
        type?: 'reply' | 'status' | 'note' | 'attach';
      }[]
    | null;
}
