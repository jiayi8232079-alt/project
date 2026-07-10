import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Order } from './order.entity.js';
import { User } from './user.entity.js';
import { Attendant } from './attendant.entity.js';
import { DEFAULT_TENANT_ID } from './tenant.entity.js';

@Entity('reviews')
export class Review {
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

  @ManyToOne(() => Order, (order) => order.reviews)
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.reviews)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'attendant_id', nullable: true })
  attendantId: number | null;

  @ManyToOne(() => Attendant, (attendant) => attendant.reviews, {
    nullable: true,
  })
  @JoinColumn({ name: 'attendant_id' })
  attendant: Attendant;

  @Column({ type: 'tinyint', comment: '1-5' })
  rating: number;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
