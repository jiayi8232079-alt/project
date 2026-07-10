import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { MembershipLevel } from './membership-level.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

@Entity('membership_card_types')
export class MembershipCardType extends TenantAwareEntity {
  @Column({ name: 'card_name' })
  cardName: string;

  @Column({ name: 'duration_days', type: 'int' })
  durationDays: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
  })
  price: number;

  @Column({ name: 'level_id', type: 'int', nullable: true })
  levelId: number;

  @ManyToOne(() => MembershipLevel, { nullable: true })
  @JoinColumn({ name: 'level_id' })
  level: MembershipLevel;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  status: boolean;
}
