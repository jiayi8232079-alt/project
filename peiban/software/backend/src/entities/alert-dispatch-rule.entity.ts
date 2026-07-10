import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { AlertSeverity } from './health-alert.entity.js';

/** 告警升级配置 */
export interface AlertEscalation {
  /** 首批通知对象（角色 key） */
  initialTarget: string[];
  /** N 秒未处置后升级 */
  escalateAfterSec: number;
  /** 升级后追加通知对象 */
  escalateTo: string[];
}

/**
 * 跨层告警分发规则（PRD §5.3.2）。
 *
 * 站点产生的 critical 事件按规则向上「逐层透出」：
 * 例如确诊跌倒 → 站点 + 家属 + 机构 + 政府监管都能在大盘看到红点 / 收到推送。
 * `forwardToLevels` 决定透传到哪些层级，`notifyChannels` 决定走哪些通道。
 */
@Entity('alert_dispatch_rules')
@Index('idx_alert_dispatch_tenant', ['tenantId', 'enabled'])
@Index('idx_alert_dispatch_event', ['eventType'])
export class AlertDispatchRule extends TenantAwareEntity {
  @Column({
    name: 'event_type',
    type: 'varchar',
    length: 32,
    comment: '事件类型：fall / sos / vital_anomaly / medication_miss 等',
  })
  eventType: string;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.HIGH,
    comment: '触发该规则的最低严重度',
  })
  severity: AlertSeverity;

  @Column({
    name: 'forward_to_levels',
    type: 'json',
    comment:
      "透传到的层级列表，如 ['site','organization','government','platform']",
  })
  forwardToLevels: string[];

  @Column({
    name: 'notify_channels',
    type: 'json',
    comment: "通知通道，如 ['app_push','sms','phone','wechat']",
  })
  notifyChannels: string[];

  @Column({
    type: 'json',
    nullable: true,
    comment: '升级策略：{ initialTarget, escalateAfterSec, escalateTo }',
  })
  escalation: AlertEscalation | null;

  @Column({
    type: 'boolean',
    default: true,
    comment: '是否启用',
  })
  enabled: boolean;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '规则名称/备注',
  })
  remark: string | null;
}
