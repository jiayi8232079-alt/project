import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';

@Entity('family_groups')
export class FamilyGroup extends TenantAwareEntity {
  @Column({ length: 50 })
  name: string;

  @Column({ name: 'invite_code', type: 'varchar', length: 8, unique: true })
  inviteCode: string;

  @Column({ name: 'created_by' })
  createdBy: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  creator: User;

  /** 专属客服 / 健康管家（admin_user.id） */
  @Column({ name: 'assigned_cs_admin_id', type: 'int', nullable: true })
  assignedCsAdminId: number | null;

  /**
   * 家庭头像：可为：
   *  - emoji 预设标识，如 `preset:home` / `preset:heart` 等（小程序端映射为 emoji）
   *  - 自定义图片 URL（相对路径或完整 URL，小程序端拼前缀展示）
   *  - null / 空串：展示默认房子图标
   */
  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null;
}
