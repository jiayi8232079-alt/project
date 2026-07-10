import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { EncryptedColumnTransformer } from '../common/utils/column-encryption.js';
import { FamilyGroup } from './family-group.entity.js';
import { User } from './user.entity.js';

/**
 * 家庭模块按 user_id / family_group_id / placeholder_phone_hash 三种方式频繁查找；
 * placeholder_phone_hash 还要支撑老人首次微信登录时的反向认领。
 *
 * 生产环境手工补：
 *   CREATE INDEX idx_fm_user_id ON family_members(user_id);
 *   CREATE INDEX idx_fm_group_id ON family_members(family_group_id);
 *   CREATE INDEX idx_fm_placeholder_phone_hash ON family_members(placeholder_phone_hash);
 */
@Entity('family_members')
@Index(['userId'])
@Index(['familyGroupId'])
@Index(['placeholderPhoneHash'])
export class FamilyMember extends TenantAwareEntity {
  @Column({ name: 'family_group_id' })
  familyGroupId: number;

  @ManyToOne(() => FamilyGroup)
  @JoinColumn({ name: 'family_group_id' })
  familyGroup: FamilyGroup;

  /**
   * 家庭成员关联的登录账号 ID。
   * - 子女代建老人时，老人尚未登录，此字段为 null（占位成员）
   * - 老人本人用匹配手机号微信登录后，自动回填
   */
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** guardian = 管理者(子女), member = 被照护者(父母) */
  @Column({ type: 'varchar', length: 16, default: 'member' })
  role: 'guardian' | 'member';

  /** 与创建者的关系: father / mother / parent / spouse / child / self / other */
  @Column({ type: 'varchar', length: 16, nullable: true })
  relation: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  nickname: string | null;

  @Column({ type: 'json', nullable: true })
  permissions: {
    viewHealth?: boolean;
    viewMedication?: boolean;
    manageOrders?: boolean;
    receiveAlerts?: boolean;
  } | null;

  @Column({ name: 'joined_at', type: 'datetime', nullable: true })
  joinedAt: Date | null;

  /** 关联子女账号下的 ServiceTarget（打通代管和账号关联两套数据） */
  @Column({ name: 'linked_service_target_id', type: 'int', nullable: true })
  linkedServiceTargetId: number | null;

  // ────────── 老人占位（子女代建，老人未登录前）──────────

  /** 占位老人姓名（后台管理列表展示用） */
  @Column({ name: 'placeholder_name', type: 'varchar', length: 64, nullable: true })
  placeholderName: string | null;

  /** 占位老人手机号（加密存储） */
  @Column({
    name: 'placeholder_phone_encrypted',
    type: 'varchar',
    length: 255,
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  placeholderPhone: string | null;

  /** 占位手机号的稳定 HMAC，用于老人登录时按手机号反向查找 */
  @Column({ name: 'placeholder_phone_hash', type: 'varchar', length: 64, nullable: true })
  placeholderPhoneHash: string | null;

  /** 占位老人身份证（加密存储，可选） */
  @Column({
    name: 'placeholder_id_card_encrypted',
    type: 'varchar',
    length: 512,
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  placeholderIdCard: string | null;

  /** 是否为被照护老人（决定登录后是否走大字体单屏端） */
  @Column({ name: 'is_elder', type: 'boolean', default: false })
  isElder: boolean;
}
