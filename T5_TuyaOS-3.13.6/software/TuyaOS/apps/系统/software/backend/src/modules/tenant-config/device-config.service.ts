import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import {
  DeviceConfigLog,
  DeviceConfigStatus,
} from '../../entities/device-config-log.entity.js';
import { TenantSetting } from '../../entities/tenant-setting.entity.js';
import { Device } from '../../entities/device.entity.js';
import { TenantHierarchyService } from '../tenant/tenant-hierarchy.service.js';

export interface PushResult {
  configKey: string;
  sourceTenantId: number;
  totalDevices: number;
  succeed: number;
  failed: number;
  logIds: number[];
}

@Injectable()
export class DeviceConfigService {
  private readonly logger = new Logger(DeviceConfigService.name);

  constructor(
    @InjectRepository(DeviceConfigLog)
    private readonly logRepo: Repository<DeviceConfigLog>,
    @InjectRepository(TenantSetting)
    private readonly settingRepo: Repository<TenantSetting>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly hierarchy: TenantHierarchyService,
  ) {}

  /**
   * 把某租户层级设置的配置下发到其子树下所有设备（PRD §5.2.2）。
   *
   * mock 阶段（设备模块未接涂鸦 OpenAPI）：直接落 device_config_logs 并置 sent，
   * 接入涂鸦后只需把「写日志」替换为「调 OpenAPI + 回执置 acked」，业务编排不变。
   */
  async pushToDevices(
    sourceTenantId: number,
    configKey: string,
  ): Promise<PushResult> {
    const setting = await this.settingRepo.findOne({
      where: {
        tenantId: sourceTenantId,
        configKey,
        targetDeviceId: IsNull(),
      },
    });
    if (!setting) {
      throw new BadRequestException(
        `租户 ${sourceTenantId} 未设置配置 ${configKey}，无法下发`,
      );
    }

    const subtreeIds = await this.hierarchy.getDescendantIds(sourceTenantId, {
      includeSelf: true,
    });
    const devices = subtreeIds.length
      ? await this.deviceRepo.find({ where: { tenantId: In(subtreeIds) } })
      : [];

    if (!devices.length) {
      return {
        configKey,
        sourceTenantId,
        totalDevices: 0,
        succeed: 0,
        failed: 0,
        logIds: [],
      };
    }

    const logs = devices.map((d) =>
      this.logRepo.create({
        tenantId: d.tenantId,
        deviceId: d.id,
        configKey,
        configValue: setting.configValue,
        sourceTenantId,
        // mock：直接视为已下发；真实接入涂鸦后初始为 pending，回执后置 acked
        status: DeviceConfigStatus.SENT,
      }),
    );
    const saved = await this.logRepo.save(logs);

    this.logger.log(
      `pushToDevices: key=${configKey} source=${sourceTenantId} devices=${devices.length}`,
    );

    return {
      configKey,
      sourceTenantId,
      totalDevices: devices.length,
      succeed: saved.length,
      failed: 0,
      logIds: saved.map((s) => s.id),
    };
  }

  /** 设备上报配置已执行（涂鸦回执 / mock 手动） */
  async ack(logId: number): Promise<DeviceConfigLog> {
    const log = await this.logRepo.findOne({ where: { id: logId } });
    if (!log) throw new NotFoundException('下发记录不存在');
    log.status = DeviceConfigStatus.ACKED;
    log.ackAt = new Date();
    return this.logRepo.save(log);
  }

  /** 某设备的配置下发历史 */
  listByDevice(deviceId: number): Promise<DeviceConfigLog[]> {
    return this.logRepo.find({
      where: { deviceId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}
