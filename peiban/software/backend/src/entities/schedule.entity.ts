import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';
import { Attendant } from './attendant.entity.js';
import { DEFAULT_TENANT_ID } from './tenant.entity.js';

@Entity('schedules')
export class Schedule {
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

  @Column({ name: 'attendant_id' })
  attendantId: number;

  @ManyToOne(() => Attendant, (attendant) => attendant.schedules)
  @JoinColumn({ name: 'attendant_id' })
  attendant: Attendant;

  @Column({ type: 'date' })
  date: Date;

  @Column({
    type: 'enum',
    enum: ['morning', 'afternoon', 'full_day'],
  })
  period: string;

  @Column({
    type: 'enum',
    enum: ['available', 'booked'],
    default: 'available',
  })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
