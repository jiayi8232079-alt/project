import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AlertDispatchRule,
  AlertEscalation,
} from '../../entities/alert-dispatch-rule.entity.js';
import {
  AlertSeverity,
  HealthAlert,
} from '../../entities/health-alert.entity.js';
import { Tenant } from '../../entities/tenant.entity.js';
import { TenantHierarchyService } from '../tenant/tenant-hierarchy.service.js';

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  [AlertSeverity.LOW]: 1,
  [AlertSeverity.MEDIUM]: 2,
  [AlertSeverity.HIGH]: 3,
};

export interface DispatchPlan {
  alertId: number;
  eventType: string;
  severity: AlertSeverity;
  matchedRule: number | null;
  forwardTenants: { tenantId: number; tenantName: string; scopeType: string }[];
  channels: string[];
  escalation: AlertEscalation | null;
}

@Injectable()
export class AlertDispatchService {
  private readonly logger = new Logger(AlertDispatchService.name);

  constructor(
    @InjectRepository(AlertDispatchRule)
    private readonly ruleRepo: Repository<AlertDispatchRule>,
    @InjectRepository(HealthAlert)
    private readonly alertRepo: Repository<HealthAlert>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly hierarchy: TenantHierarchyService,
  ) {}

  // ─────────────── 规则管理 ───────────────

  listRules(tenantId: number): Promise<AlertDispatchRule[]> {
    return this.ruleRepo.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  createRule(
    tenantId: number,
    dto: Partial<AlertDispatchRule>,
  ): Promise<AlertDispatchRule> {
    const rule = this.ruleRepo.create({
      tenantId,
      eventType: dto.eventType ?? 'fall',
      severity: dto.severity ?? AlertSeverity.HIGH,
      forwardToLevels: dto.forwardToLevels ?? [
        'site',
        'organization',
        'government',
        'platform',
      ],
      notifyChannels: dto.notifyChannels ?? ['app_push', 'sms'],
      escalation: dto.escalation ?? null,
      enabled: dto.enabled ?? true,
      remark: dto.remark ?? null,
    });
    return this.ruleRepo.save(rule);
  }

  async updateRule(
    tenantId: number,
    id: number,
    dto: Partial<AlertDispatchRule>,
  ): Promise<AlertDispatchRule> {
    const rule = await this.ruleRepo.findOne({ where: { id, tenantId } });
    if (!rule) throw new NotFoundException('分发规则不存在');
    Object.assign(rule, {
      eventType: dto.eventType ?? rule.eventType,
      severity: dto.severity ?? rule.severity,
      forwardToLevels: dto.forwardToLevels ?? rule.forwardToLevels,
      notifyChannels: dto.notifyChannels ?? rule.notifyChannels,
      escalation:
        dto.escalation !== undefined ? dto.escalation : rule.escalation,
      enabled: dto.enabled ?? rule.enabled,
      remark: dto.remark !== undefined ? dto.remark : rule.remark,
    });
    return this.ruleRepo.save(rule);
  }

  async deleteRule(tenantId: number, id: number): Promise<void> {
    const res = await this.ruleRepo.delete({ id, tenantId });
    if (!res.affected) throw new NotFoundException('分发规则不存在');
  }

  // ─────────────── 跨层告警流 ───────────────

  /**
   * 我应当看到的告警流：本租户子树内、达到严重度阈值的告警，按时间倒序。
   * 上级（政府/机构）据此看到下属站点的 critical 事件。
   */
  async getIncoming(
    viewerTenantId: number | null,
    options?: { minSeverity?: AlertSeverity; limit?: number },
  ): Promise<
    {
      id: number;
      tenantId: number;
      tenantName: string;
      category: string;
      severity: AlertSeverity;
      title: string;
      status: string;
      triggeredAt: Date;
    }[]
  > {
    const minRank = SEVERITY_RANK[options?.minSeverity ?? AlertSeverity.HIGH];
    const allowedSeverities = (
      Object.keys(SEVERITY_RANK) as AlertSeverity[]
    ).filter((s) => SEVERITY_RANK[s] >= minRank);

    const qb = this.alertRepo
      .createQueryBuilder('a')
      .where('a.severity IN (:...sev)', { sev: allowedSeverities })
      .orderBy('a.triggered_at', 'DESC')
      .limit(options?.limit ?? 50);

    if (viewerTenantId != null) {
      const subtree = await this.hierarchy.getDescendantIds(viewerTenantId, {
        includeSelf: true,
      });
      if (!subtree.length) return [];
      qb.andWhere('a.tenant_id IN (:...ids)', { ids: subtree });
    }

    const alerts = await qb.getMany();
    const nameMap = await this.tenantNames(alerts.map((a) => a.tenantId));

    return alerts.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      tenantName: nameMap.get(a.tenantId) ?? `租户#${a.tenantId}`,
      category: a.category,
      severity: a.severity,
      title: a.title,
      status: a.status,
      triggeredAt: a.triggeredAt,
    }));
  }

  /**
   * 计算某告警的跨层分发计划（escalation_path）：
   * 沿告警所属租户的祖先链，筛出规则 forwardToLevels 命中的层级。
   */
  async previewDispatch(alertId: number): Promise<DispatchPlan> {
    const alert = await this.alertRepo.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('告警不存在');

    const rule = await this.matchRule(alert);
    const ancestorIds = await this.hierarchy.getAncestorIds(alert.tenantId);
    const chainIds = [alert.tenantId, ...ancestorIds];
    const tenants = chainIds.length
      ? await this.tenantRepo.find({ where: { id: In(chainIds) } })
      : [];

    const levels = rule?.forwardToLevels ?? [
      'site',
      'organization',
      'government',
      'platform',
    ];
    const forwardTenants = tenants
      .filter((t) => levels.includes(t.scopeType))
      .map((t) => ({
        tenantId: t.id,
        tenantName: t.name,
        scopeType: t.scopeType,
      }));

    return {
      alertId: alert.id,
      eventType: alert.category,
      severity: alert.severity,
      matchedRule: rule?.id ?? null,
      forwardTenants,
      channels: rule?.notifyChannels ?? ['app_push'],
      escalation: rule?.escalation ?? null,
    };
  }

  // ─────────────── 内部 ───────────────

  private async matchRule(
    alert: HealthAlert,
  ): Promise<AlertDispatchRule | null> {
    const ancestorIds = await this.hierarchy.getAncestorIds(alert.tenantId);
    const chainIds = [alert.tenantId, ...ancestorIds];
    const rules = await this.ruleRepo.find({
      where: { tenantId: In(chainIds), enabled: true },
    });
    const minNeeded = SEVERITY_RANK[alert.severity];
    // 命中：事件类型匹配 + 告警严重度 ≥ 规则阈值；就近租户优先
    const alertCategory = String(alert.category);
    const candidates = rules
      .filter(
        (r) =>
          (r.eventType === alertCategory || r.eventType === alert.ruleCode) &&
          minNeeded >= SEVERITY_RANK[r.severity],
      )
      .sort(
        (a, b) => chainIds.indexOf(a.tenantId) - chainIds.indexOf(b.tenantId),
      );
    return candidates[0] ?? null;
  }

  private async tenantNames(ids: number[]): Promise<Map<number, string>> {
    const unique = [...new Set(ids)];
    if (!unique.length) return new Map();
    const tenants = await this.tenantRepo.find({ where: { id: In(unique) } });
    return new Map(tenants.map((t) => [t.id, t.name]));
  }
}
