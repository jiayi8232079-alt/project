import { Entity, Column, OneToMany, DeleteDateColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { UserRole } from '../common/enums/index.js';
import { ServiceTarget } from './service-target.entity.js';
import { Order } from './order.entity.js';
import { Review } from './review.entity.js';

/**
 * openid 已是 unique（隐含 BTREE 索引），不重复加。
 * phone 在很多按手机号反查的场景里用到（陪诊员匹配、客服检索），加普通索引。
 *
 * 生产环境手工补：
 *   CREATE INDEX idx_users_phone ON users(phone);
 */
@Entity('users')
@Index(['phone'])
export class User extends TenantAwareEntity {
  @Column({ unique: true, nullable: true })
  openid: string;

  @Column({ name: 'union_id', nullable: true })
  unionId: string;

  /** Apple Sign In 的 sub（稳定用户标识）；App「通过 Apple 登录」时写入 */
  @Index()
  @Column({ name: 'apple_sub', nullable: true })
  appleSub: string;

  @Column({ nullable: true })
  nickname: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ default: true })
  status: boolean;

  /** normal=标准界面, simplified=大字简化版(父母端) */
  @Column({ name: 'ui_mode', type: 'varchar', length: 16, default: 'normal' })
  uiMode: 'normal' | 'simplified';

  /** 软删除时间戳；非 null 表示已移入回收站 */
  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => ServiceTarget, (target) => target.user)
  serviceTargets: ServiceTarget[];

  @OneToMany(() => Order, (order) => order.user)
  orders: Order[];

  @OneToMany(() => Review, (review) => review.user)
  reviews: Review[];
}
