import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import {
  FinanceRecordType,
  FinanceRecordStatus,
} from '../common/enums/index.js';
import { Order } from './order.entity.js';
import { Attendant } from './attendant.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

@Entity('finance_records')
export class FinanceRecord extends TenantAwareEntity {
  @Column({ name: 'order_id', nullable: true })
  orderId: number;

  @ManyToOne(() => Order, (order) => order.financeRecords)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'attendant_id', nullable: true })
  attendantId: number | null;

  @ManyToOne(() => Attendant, (attendant) => attendant.financeRecords, {
    nullable: true,
  })
  @JoinColumn({ name: 'attendant_id' })
  attendant: Attendant;

  @Column({ type: 'enum', enum: FinanceRecordType })
  type: FinanceRecordType;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  amount: number;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'proof_url', nullable: true })
  proofUrl: string;

  @Column({ name: 'proof_images', type: 'json', nullable: true })
  proofImages: string[] | null;

  @Column({
    type: 'enum',
    enum: FinanceRecordStatus,
    default: FinanceRecordStatus.PENDING,
  })
  status: FinanceRecordStatus;

  @Column({ name: 'reviewer_id', nullable: true })
  reviewerId: number;

  @Column({ name: 'review_note', nullable: true })
  reviewNote: string;
}
