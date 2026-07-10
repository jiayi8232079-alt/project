import { Entity, Column } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

@Entity('membership_levels')
export class MembershipLevel extends TenantAwareEntity {
  @Column({ name: 'level_name' })
  levelName: string;

  @Column({
    name: 'discount_rate',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 100,
    transformer: DecimalTransformer,
  })
  discountRate: number;

  @Column({
    name: 'min_recharge',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  minRecharge: number;

  @Column({ type: 'text', nullable: true })
  benefits: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  status: boolean;
}
