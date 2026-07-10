import { Column, Entity, Index, Unique } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { TenantScopeType } from './tenant.entity.js';

/**
 * 层级配置项（Wave2 Phase3）。
 *
 * 同一 `config_key` 可在不同层级（平台/政府/机构/站点）各存一条；
 * 设备/租户取「生效值」时沿 path 链就近优先（self > 祖先 … > 平台）。
 *
 * `target_device_id` 为 null 表示租户级（作用于该租户全部设备）；
 * 非 null 表示仅对单台设备覆盖（优先级最高）。
 */
@Entity('tenant_settings')
@Index(['tenantId', 'scopeType'])
@Unique(['tenantId', 'configKey', 'targetDeviceId'])
export class TenantSetting extends TenantAwareEntity {
  @Column({ name: 'config_key', type: 'varchar', length: 64, comment: '配置键' })
  configKey: string;

  @Column({ name: 'config_value', type: 'text', comment: '配置值（字符串/JSON 文本）' })
  configValue: string;

  @Column({
    name: 'scope_type',
    type: 'enum',
    enum: TenantScopeType,
    default: TenantScopeType.ORGANIZATION,
    comment: '配置所属层级类型',
  })
  scopeType: TenantScopeType;

  @Column({
    name: 'target_device_id',
    type: 'int',
    nullable: true,
    comment: 'null=租户级（全部设备）；非 null=单设备覆盖',
  })
  targetDeviceId: number | null;

  @Column({
    name: 'effective_at',
    type: 'datetime',
    nullable: true,
    comment: '生效时间',
  })
  effectiveAt: Date | null;

  @Column({ type: 'text', nullable: true, comment: '备注' })
  remark: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;
}
