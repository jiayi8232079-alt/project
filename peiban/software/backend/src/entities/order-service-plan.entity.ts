import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { Order } from './order.entity.js';
import { User } from './user.entity.js';
import { ServicePlanKind, ServicePlanTemplate } from './service-plan-template.entity.js';

/**
 * 订单上挂载的具体服务方案。
 *
 * 生命周期：服务者在订单服务中"附加方案"，可以从 ServicePlanTemplate 克隆，
 * 也可以手写一份。方案归档在订单级别，未来可生成到服务报告 PDF。
 */
@Entity('order_service_plans')
@Index(['orderId', 'kind'])
export class OrderServicePlan extends TenantAwareEntity {
  @Column({ name: 'order_id', comment: '所属订单' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({
    type: 'enum',
    enum: ServicePlanKind,
    comment: '方案类型',
  })
  kind: ServicePlanKind;

  @Column({
    name: 'template_id',
    type: 'int',
    nullable: true,
    comment: '来源模板 ID（可空，表示手写方案）',
  })
  templateId: number | null;

  @ManyToOne(() => ServicePlanTemplate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'template_id' })
  template: ServicePlanTemplate | null;

  @Column({ type: 'varchar', length: 128, comment: '方案标题' })
  title: string;

  @Column({ type: 'text', nullable: true, comment: '方案摘要/正文说明' })
  summary: string | null;

  @Column({
    type: 'json',
    comment: '结构化内容（继承模板后可修改）',
  })
  content: unknown;

  @Column({
    name: 'attached_by_user_id',
    type: 'int',
    nullable: true,
    comment: '附加人（服务者），用于追踪',
  })
  attachedByUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'attached_by_user_id' })
  attachedByUser: User | null;
}
