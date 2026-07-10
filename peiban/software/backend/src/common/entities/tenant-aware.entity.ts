import { Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity.js';
import { DEFAULT_TENANT_ID } from '../../entities/tenant.entity.js';

/**
 * 租户感知实体基类 —— 所有「按租户隔离」的业务表统一继承此类。
 *
 * 关键点：
 * 1. `tenantId` 默认值 = `DEFAULT_TENANT_ID`（1），让现有数据无缝兼容；
 * 2. 自动建 `tenant_id` 单列索引，所有 list 查询的 `WHERE tenant_id = ?` 走索引；
 * 3. 真正的「自动注入 tenantId」由 `TenantSubscriber`（Step 4）负责，
 *    这里只保证字段存在与默认值；
 * 4. 不加外键约束（`@ManyToOne Tenant`），原因：
 *    - 现网迁移先 ALTER COLUMN 加 NULL，再 UPDATE 回填，最后再 ALTER NOT NULL；
 *      期间外键约束会阻塞回填，运维复杂；
 *    - 应用层 `TenantSubscriber` 已保证写入正确，外键收益边际。
 *
 * 不应继承此类的「跨租户」表：
 * - `admin_users` 平台运营账号
 * - `hospitals`、`hospital_doctors` 全局医院字典
 * - `medicine_catalog`、`drug_interaction_rules` 全局药品字典
 * - `medication_notification_job` 系统调度任务
 * - `system_configs`（v1.0 仍单租户配置；多租户配置在 Wave1.x 单独建 tenant_settings 表）
 * - `sms_send_log` 系统出站日志（运维侧分析）
 * - `mp_monitor_scene` 小程序订阅消息模板（全局）
 */
export abstract class TenantAwareEntity extends BaseEntity {
  @Index()
  @Column({
    name: 'tenant_id',
    type: 'int',
    default: DEFAULT_TENANT_ID,
    comment: '所属租户 ID（多租户隔离主键）',
  })
  tenantId: number;
}
