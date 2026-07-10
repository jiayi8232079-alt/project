import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { Device } from './device.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';
import { FamilyGroup } from './family-group.entity.js';

/**
 * 设备绑定角色 —— 决定能做什么操作。
 *
 * - `owner`      绑定者（通常是家属），可解绑/转让；
 * - `co_manager` 协管（其他家属），可看可控不能解绑；
 * - `viewer`     只看不能控（如远程亲属）。
 *
 * 与 family-member 的 role 区别：
 * - family-member 描述"家庭内角色"（guardian/elder/relative）；
 * - device-binding.role 描述"对这台设备的操作权限"，与家庭角色独立。
 */
export enum DeviceBindingRole {
  OWNER = 'owner',
  CO_MANAGER = 'co_manager',
  VIEWER = 'viewer',
}

/**
 * 设备 ↔ 用户 ↔ 服务对象 ↔ 家庭 多方绑定 —— 一台设备可以有多条绑定（多个家属共控）。
 *
 * 关键字段：
 * - `serviceTargetId` 必填：每台机器人都服务一个老人（服务对象）；
 * - `userId` 必填：操作账号（家属或老人本人）；
 * - `familyGroupId` 可选：用于"家庭组群发告警"，绑定到家庭后所有成员可见；
 * - `unboundAt` 软删：解绑后保留记录用于审计/复盘，不真删。
 *
 * 唯一约束：`(device_id, user_id)` —— 同一用户对同一设备不重复绑定；
 * 业务允许 device 在不同 user 下都有 owner（如父子各自有自己的"主控"，但同一设备同一人不能两次）。
 */
@Entity('device_bindings')
@Index(['deviceId', 'userId'], { unique: true })
@Index(['userId'])
@Index(['serviceTargetId'])
@Index(['familyGroupId'])
export class DeviceBinding extends TenantAwareEntity {
  @Column({ name: 'device_id', type: 'int' })
  deviceId: number;

  @ManyToOne(() => Device, (d) => d.bindings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @Column({ name: 'user_id', type: 'int', comment: '操作账号（家属或老人本人）' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'service_target_id', type: 'int', comment: '服务对象（老人）' })
  serviceTargetId: number;

  @ManyToOne(() => ServiceTarget, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget;

  @Column({
    name: 'family_group_id',
    type: 'int',
    nullable: true,
    comment: '所属家庭（可选；用于群推告警）',
  })
  familyGroupId: number | null;

  @ManyToOne(() => FamilyGroup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'family_group_id' })
  familyGroup: FamilyGroup | null;

  @Column({
    type: 'enum',
    enum: DeviceBindingRole,
    default: DeviceBindingRole.OWNER,
    comment: '绑定角色（owner/co_manager/viewer）',
  })
  role: DeviceBindingRole;

  @Column({
    name: 'bound_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
    comment: '绑定时间',
  })
  boundAt: Date;

  @Column({
    name: 'unbound_at',
    type: 'datetime',
    nullable: true,
    comment: '解绑时间（软删；非 null 视为已解绑，仍保留审计）',
  })
  unboundAt: Date | null;
}
