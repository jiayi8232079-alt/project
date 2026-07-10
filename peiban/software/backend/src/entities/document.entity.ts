import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { DocumentType } from '../common/enums/index.js';
import { Order } from './order.entity.js';
import { DEFAULT_TENANT_ID } from './tenant.entity.js';

@Entity('documents')
export class Document {
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

  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @ManyToOne(() => Order, (order) => order.documents, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'service_target_id', type: 'int', nullable: true })
  serviceTargetId: number | null;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'archive_no', type: 'varchar', length: 20, nullable: true })
  archiveNo: string | null;

  @Column({ type: 'enum', enum: DocumentType })
  type: DocumentType;

  @Column()
  url: string;

  @Column({ name: 'file_name', nullable: true })
  fileName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
