import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { TimelineType } from '../common/enums/index.js';
import { Order } from './order.entity.js';
import { User } from './user.entity.js';
import { DEFAULT_TENANT_ID } from './tenant.entity.js';

@Entity('service_timelines')
export class ServiceTimeline {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({
    name: 'tenant_id',
    type: 'int',
    default: DEFAULT_TENANT_ID,
    comment: '所属租户 ID（多租户隔离）',
  })
  tenantId: number;

  @Column({ name: 'order_id' })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.timelines)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  // nullable + no FK constraint：管理员操作时 operatorId 来自 admin_users，不在 users 表中
  @Column({ name: 'operator_id', nullable: true })
  operatorId: number | null;

  @ManyToOne(() => User, { nullable: true, createForeignKeyConstraints: false })
  @JoinColumn({ name: 'operator_id' })
  operator: User | null;

  @Column({ type: 'enum', enum: TimelineType })
  type: TimelineType;

  @Column({ type: 'text', nullable: true })
  content: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown>;

  @Column({ name: 'visible_to_user', default: false })
  visibleToUser: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * 业务时间：节点实际发生时间，由总管理员在后台「服务时间线」补录/修正。
   * 为空时展示仍回退到 created_at；仅允许修改内容型节点（text/image/file/audio_*），
   * 状态节点（NODE/SERVICE_START/SERVICE_END）不参与业务时间编辑。
   */
  @Column({ name: 'event_time', type: 'datetime', nullable: true })
  eventTime: Date | null;
}
