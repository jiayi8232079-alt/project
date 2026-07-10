import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { MembershipLevel } from './membership-level.entity.js';
import { MembershipCardType } from './membership-card-type.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

@Entity('user_memberships')
export class UserMembership extends TenantAwareEntity {
  @Column({ name: 'user_id', unique: true })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'level_id', type: 'int', nullable: true })
  levelId: number;

  @ManyToOne(() => MembershipLevel)
  @JoinColumn({ name: 'level_id' })
  level: MembershipLevel;

  @Column({ name: 'card_type_id', type: 'int', nullable: true })
  cardTypeId: number;

  @ManyToOne(() => MembershipCardType)
  @JoinColumn({ name: 'card_type_id' })
  cardType: MembershipCardType;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: Date;

  @Column({ name: 'expire_date', type: 'date', nullable: true })
  expireDate: Date;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  balance: number;

  @Column({
    name: 'total_recharged',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
    transformer: DecimalTransformer,
  })
  totalRecharged: number;

  @Column({ default: true })
  status: boolean;
}
