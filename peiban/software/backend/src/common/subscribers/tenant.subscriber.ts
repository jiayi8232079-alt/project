import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from 'typeorm';
import { TenantAwareEntity } from '../entities/tenant-aware.entity.js';
import { DEFAULT_TENANT_ID } from '../../entities/tenant.entity.js';
import { RequestContext } from '../contexts/request-context.js';

/**
 * TypeORM 订阅器 —— 在 INSERT 前自动注入 tenantId，杜绝业务代码漏传。
 *
 * 触发逻辑：
 * 1. 仅对 `TenantAwareEntity` 子类（及 5 个手动加 tenantId 的特殊实体）生效；
 *    其它（admin_users / hospital / system_configs 等）放过。
 * 2. 若实体已显式设置 tenantId（业务代码主动指定，常见于跨租户系统任务）→ 不覆盖；
 * 3. 否则按以下优先级填充：
 *    a) 当前请求上下文的 tenantId（普通用户/陪诊员的请求）
 *    b) DEFAULT_TENANT_ID（系统任务/cron/启动期种子）
 * 4. type='admin' 的请求 tenantId=null → 退到 DEFAULT_TENANT_ID，
 *    若 admin 接口要为「特定租户」建数据，必须显式传 tenantId（在 service 层做）。
 *
 * 5 个手动加 tenantId 字段的非 BaseEntity 实体（document/schedule/review/service_timeline/audit_log）
 * 通过 `entity.constructor.name` 黑名单进入同一注入流程；保持代码统一不重复造轮子。
 */
const SUPPLEMENTAL_TENANT_AWARE_TABLES = new Set<string>([
  'documents',
  'schedules',
  'reviews',
  'service_timelines',
  'audit_logs',
]);

@EventSubscriber()
@Injectable()
export class TenantSubscriber implements EntitySubscriberInterface {
  private readonly logger = new Logger(TenantSubscriber.name);

  constructor(dataSource: DataSource) {
    dataSource.subscribers.push(this);
  }

  beforeInsert(event: InsertEvent<any>): void {
    const entity = event.entity;
    if (!entity || typeof entity !== 'object') return;

    const isTenantAware =
      entity instanceof TenantAwareEntity ||
      SUPPLEMENTAL_TENANT_AWARE_TABLES.has(event.metadata.tableName);
    if (!isTenantAware) return;

    // 业务代码已经显式赋值 → 不覆盖（允许系统任务跨租户写入）
    if (entity.tenantId != null) return;

    const contextTenantId = RequestContext.currentTenantId();
    const fallback =
      contextTenantId != null && contextTenantId > 0
        ? contextTenantId
        : DEFAULT_TENANT_ID;
    entity.tenantId = fallback;

    // 仅在「无请求上下文」时打 debug，便于排查 cron/启动种子的归属
    if (contextTenantId == null) {
      this.logger.debug(
        `[TenantSubscriber] 无请求上下文，${event.metadata.tableName} 落到默认租户 #${DEFAULT_TENANT_ID}`,
      );
    }
  }
}
