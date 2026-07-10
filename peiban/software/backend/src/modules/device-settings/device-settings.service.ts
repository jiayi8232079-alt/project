import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeviceSetting } from '../../entities/device-setting.entity.js';
import {
  DeviceSettingDispatchLog,
  DeviceSettingDispatchStatus,
} from '../../entities/device-setting-dispatch-log.entity.js';
import { DeviceService } from '../device/device.service.js';
import {
  MockDeviceSettingsAckDto,
  UpdateDeviceSettingsDto,
} from './dto/update-device-settings.dto.js';

@Injectable()
export class DeviceSettingsService {
  constructor(
    @InjectRepository(DeviceSetting)
    private readonly settingsRepo: Repository<DeviceSetting>,
    @InjectRepository(DeviceSettingDispatchLog)
    private readonly dispatchLogRepo: Repository<DeviceSettingDispatchLog>,
    private readonly deviceService: DeviceService,
  ) {}

  async getSettings(deviceId: number, userId: number, userType?: string) {
    await this.assertDeviceAccess(deviceId, userId, userType);
    const settings = await this.settingsRepo.findOne({ where: { deviceId } });
    const latestLogs = await this.listLogs(deviceId, 1, 5);
    return { settings, latestLogs: latestLogs.items };
  }

  async saveSettings(
    deviceId: number,
    userId: number,
    userType: string | undefined,
    dto: UpdateDeviceSettingsDto,
  ) {
    await this.assertDeviceAccess(deviceId, userId, userType);

    const existing = await this.settingsRepo.findOne({ where: { deviceId } });
    const payload = {
      deviceId,
      quietHours: dto.quietHours ?? null,
      volume: dto.volume,
      speechRate: dto.speechRate,
      screenBrightness: dto.screenBrightness,
      sosHoldSeconds: dto.sosHoldSeconds,
      autoEscalation: dto.autoEscalation,
      communityContentEnabled: dto.communityContentEnabled,
      privacyVisibility: dto.privacyVisibility,
    };

    const setting = existing
      ? await this.settingsRepo.save({ ...existing, ...payload })
      : await this.settingsRepo.save(this.settingsRepo.create(payload));

    const dispatchLog = await this.dispatchLogRepo.save(
      this.dispatchLogRepo.create({
        deviceId,
        settingId: setting.id,
        status: DeviceSettingDispatchStatus.PENDING,
        payload,
        ackedAt: null,
        failureReason: null,
      }),
    );

    return { settings: setting, dispatchLog };
  }

  async listLogs(deviceId: number, page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(100, Math.max(1, pageSize));
    const [items, total] = await this.dispatchLogRepo.findAndCount({
      where: { deviceId },
      order: { createdAt: 'DESC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });
    return { items, total, page: safePage, pageSize: safePageSize };
  }

  async mockAck(deviceId: number, logId: number, dto: MockDeviceSettingsAckDto) {
    const log = await this.dispatchLogRepo.findOne({
      where: { id: logId, deviceId },
    });
    if (!log) {
      throw new NotFoundException('设备设置下发记录不存在');
    }

    log.status = dto.success
      ? DeviceSettingDispatchStatus.SUCCESS
      : DeviceSettingDispatchStatus.FAILED;
    log.ackedAt = new Date();
    log.failureReason = dto.success ? null : dto.failureReason ?? '设备回执失败';
    return this.dispatchLogRepo.save(log);
  }

  private async assertDeviceAccess(deviceId: number, userId: number, userType?: string) {
    await this.deviceService.findById(deviceId, userType === 'admin' ? undefined : userId);
  }
}
