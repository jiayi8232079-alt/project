import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { TenantSetting } from '../../entities/tenant-setting.entity.js';
import { Device } from '../../entities/device.entity.js';
import { Tenant, TenantScopeType } from '../../entities/tenant.entity.js';
import { TenantHierarchyService } from '../tenant/tenant-hierarchy.service.js';

export interface EffectiveConfig {
  key: string;
  value: string | null;
  /** 命中来源：哪个租户层级 */
  source: TenantScopeType | 'device' | 'default';
  sourceTenantId: number | null;
}

@Injectable()
export class TenantSettingsService {
  private readonly logger = new Logger(TenantSettingsService.name);

  constructor(
    @InjectRepository(TenantSetting)
    private readonly settingRepo: Repository<TenantSetting>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly hierarchy: TenantHierarchyService,
  ) {}

  /** 当前租户的全部直接配置（不含继承） */
  list(tenantId: number): Promise<TenantSetting[]> {
    return this.settingRepo.find({
      where: { tenantId },
      order: { configKey: 'ASC' },
    });
  }

  /**
   * 新增/覆盖一条配置（按 tenant_id + config_key + target_device_id 唯一）。
   */
  async set(params: {
    tenantId: number;
    configKey: string;
    configValue: string;
    scopeType?: TenantScopeType;
    targetDeviceId?: number | null;
    createdBy?: number | null;
    remark?: string | null;
  }): Promise<TenantSetting> {
    const targetDeviceId = params.targetDeviceId ?? null;
    let row = await this.settingRepo.findOne({
      where: {
        tenantId: params.tenantId,
        configKey: params.configKey,
        targetDeviceId: targetDeviceId === null ? IsNull() : targetDeviceId,
      },
    });
    const scopeType =
      params.scopeType ?? (await this.resolveScopeType(params.tenantId));
    if (row) {
      row.configValue = params.configValue;
      row.scopeType = scopeType;
      row.effectiveAt = new Date();
      if (params.remark !== undefined) row.remark = params.remark;
      if (params.createdBy !== undefined) row.createdBy = params.createdBy;
    } else {
      row = this.settingRepo.create({
        tenantId: params.tenantId,
        configKey: params.configKey,
        configValue: params.configValue,
        scopeType,
        targetDeviceId,
        createdBy: params.createdBy ?? null,
        remark: params.remark ?? null,
        effectiveAt: new Date(),
      });
    }
    return this.settingRepo.save(row);
  }

  /** 删除某配置（删除后该层级回退到上级生效值） */
  async remove(
    tenantId: number,
    configKey: string,
    targetDeviceId: number | null = null,
  ): Promise<void> {
    const res = await this.settingRepo.delete({
      tenantId,
      configKey,
      targetDeviceId: targetDeviceId === null ? IsNull() : targetDeviceId,
    });
    if (!res.affected) {
      throw new NotFoundException('配置不存在');
    }
  }

  /**
   * 计算某租户某 key 的生效值：沿 path 链就近优先（self > 祖先 ... > platform）。
   */
  async getEffective(
    tenantId: number,
    configKey: string,
  ): Promise<EffectiveConfig> {
    const chain = await this.closestFirstChain(tenantId);
    const rows = await this.settingRepo.find({
      where: {
        tenantId: In(chain),
        configKey,
        targetDeviceId: IsNull(),
      },
    });
    return this.pickClosest(configKey, rows, chain);
  }

  /**
   * 计算某租户全部 key 的生效值（合并整条链，每个 key 就近优先）。
   */
  async getEffectiveAll(
    tenantId: number,
  ): Promise<Record<string, EffectiveConfig>> {
    const chain = await this.closestFirstChain(tenantId);
    const rows = await this.settingRepo.find({
      where: { tenantId: In(chain), targetDeviceId: IsNull() },
    });
    const byKey = new Map<string, TenantSetting[]>();
    for (const r of rows) {
      const list = byKey.get(r.configKey) ?? [];
      list.push(r);
      byKey.set(r.configKey, list);
    }
    const out: Record<string, EffectiveConfig> = {};
    for (const [key, list] of byKey) {
      out[key] = this.pickClosest(key, list, chain);
    }
    return out;
  }

  /**
   * 单设备的生效配置：设备级覆盖 > 设备所属租户链。
   */
  async getDeviceEffective(deviceId: number): Promise<{
    deviceId: number;
    tenantId: number;
    configs: Record<string, EffectiveConfig>;
  }> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    const inherited = await this.getEffectiveAll(device.tenantId);

    // 设备级覆盖（target_device_id = deviceId）优先级最高
    const overrides = await this.settingRepo.find({
      where: { targetDeviceId: deviceId },
    });
    for (const o of overrides) {
      inherited[o.configKey] = {
        key: o.configKey,
        value: o.configValue,
        source: 'device',
        sourceTenantId: o.tenantId,
      };
    }
    return { deviceId, tenantId: device.tenantId, configs: inherited };
  }

  // ─────────────── 内部 ───────────────

  /** 返回 [self, parent, ..., platform]（就近在前） */
  private async closestFirstChain(tenantId: number): Promise<number[]> {
    const ancestors = await this.hierarchy.getAncestorIds(tenantId); // [root,...,parent]
    return [tenantId, ...ancestors.reverse()];
  }

  private pickClosest(
    key: string,
    rows: TenantSetting[],
    closestFirstChain: number[],
  ): EffectiveConfig {
    let best: TenantSetting | null = null;
    let bestRank = Number.POSITIVE_INFINITY;
    for (const r of rows) {
      const rank = closestFirstChain.indexOf(r.tenantId);
      if (rank >= 0 && rank < bestRank) {
        bestRank = rank;
        best = r;
      }
    }
    if (!best) {
      return { key, value: null, source: 'default', sourceTenantId: null };
    }
    return {
      key,
      value: best.configValue,
      source: best.scopeType,
      sourceTenantId: best.tenantId,
    };
  }

  private async resolveScopeType(tenantId: number): Promise<TenantScopeType> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    return tenant?.scopeType ?? TenantScopeType.ORGANIZATION;
  }
}
