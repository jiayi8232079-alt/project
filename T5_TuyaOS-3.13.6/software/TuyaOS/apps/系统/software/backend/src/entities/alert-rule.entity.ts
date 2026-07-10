import { Entity, Column, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { AlertCategory, AlertSeverity } from './health-alert.entity.js';

/**
 * 可由后台运营人员动态配置的预警规则。
 * 内置三类规则（medication_miss_rate / follow_up_overdue / timeline_keyword），
 * 在服务启动时自动 upsert，运营可调整 severity、enabled、条件参数。
 */
@Entity('alert_rules')
@Index(['category'])
export class AlertRule extends TenantAwareEntity {
  @Column({ name: 'rule_code', type: 'varchar', length: 64, unique: true })
  ruleCode: string;

  @Column({ type: 'varchar', length: 128 })
  name: string;

  @Column({ type: 'enum', enum: AlertCategory })
  category: AlertCategory;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({
    name: 'condition_json',
    type: 'json',
    nullable: true,
    comment: '规则参数（如 minAdherenceRate:0.7、overdueDays:1、keywords:[...]）',
  })
  condition: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    name: 'cooldown_minutes',
    type: 'int',
    default: 1440,
    comment: '同一 dedup_key 的最小告警间隔（分钟），默认 24 小时',
  })
  cooldownMinutes: number;

  @Column({ name: 'notify_family', type: 'boolean', default: true })
  notifyFamily: boolean;

  @Column({ name: 'notify_admin', type: 'boolean', default: true })
  notifyAdmin: boolean;
}
