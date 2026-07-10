import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

export enum CrisisSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * 命中危机词后的处置动作。
 * - notify_family 通知家属
 * - create_alert  生成健康预警工单
 * - escalate      升级（家属 + 站点/机构值班）
 */
export enum CrisisAction {
  NOTIFY_FAMILY = 'notify_family',
  CREATE_ALERT = 'create_alert',
  ESCALATE = 'escalate',
}

/**
 * 危机词库（按租户，可热更新）。
 *
 * AI 对话实时匹配命中后，按 severity/action 触发对应处置；
 * 平台租户（tenant_id=1）维护全局基线词库，下级租户可追加本地词。
 */
@Entity('crisis_words')
@Index(['tenantId', 'enabled'])
@Index(['tenantId', 'word'])
export class CrisisWord extends TenantAwareEntity {
  @Column({ length: 64, comment: '危机词 / 短语' })
  word: string;

  @Column({ type: 'varchar', length: 32, nullable: true, comment: '分类（自杀 / 急病 / 暴力 / 走失 等）' })
  category: string | null;

  @Column({
    type: 'enum',
    enum: CrisisSeverity,
    default: CrisisSeverity.MEDIUM,
    comment: '严重度',
  })
  severity: CrisisSeverity;

  @Column({
    type: 'enum',
    enum: CrisisAction,
    default: CrisisAction.CREATE_ALERT,
    comment: '命中后处置动作',
  })
  action: CrisisAction;

  @Column({ type: 'boolean', default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true, comment: '备注' })
  remark: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true, comment: '操作者 admin_user_id' })
  createdBy: number | null;
}
