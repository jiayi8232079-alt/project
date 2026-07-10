import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { UserRole } from '../common/enums/index.js';

@Entity('admin_users')
export class AdminUser extends BaseEntity {
  @Column({ unique: true })
  username: string;

  @Column({ select: false })
  password: string;

  @Column({ name: 'real_name', nullable: true })
  realName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.ADMIN })
  role: UserRole;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: true })
  status: boolean;

  /** 连续登录失败次数，登录成功后清零 */
  @Column({ name: 'failed_login_count', type: 'int', default: 0 })
  failedLoginCount: number;

  /** 锁定到期时间，未到期前禁止再次尝试 */
  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  /** 最后一次登录失败时间，用于计算"最近 N 分钟" */
  @Column({ name: 'last_failed_login_at', type: 'datetime', nullable: true })
  lastFailedLoginAt: Date | null;
}
