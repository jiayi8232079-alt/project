import { NotFoundException } from '@nestjs/common';

jest.mock('../../entities/device-setting.entity', () => ({
  DeviceSetting: class DeviceSetting {},
}));

jest.mock('../../entities/device-setting-dispatch-log.entity', () => ({
  DeviceSettingDispatchLog: class DeviceSettingDispatchLog {},
  DeviceSettingDispatchStatus: {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
  },
}));

jest.mock('../device/device.service', () => ({
  DeviceService: class DeviceService {},
}));

const { DeviceSettingsService } = require('./device-settings.service') as typeof import('./device-settings.service');
const { DeviceSettingDispatchStatus } = require('../../entities/device-setting-dispatch-log.entity') as typeof import('../../entities/device-setting-dispatch-log.entity');

function createRepoMock() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((payload) => payload),
    save: jest.fn(async (payload) => ({ id: payload.id ?? 1, ...payload })),
  };
}

describe('DeviceSettingsService', () => {
  it('upserts settings after checking device access and creates a pending dispatch log', async () => {
    const settingsRepo = createRepoMock();
    const logRepo = createRepoMock();
    const deviceService = { findById: jest.fn().mockResolvedValue({ device: { id: 3 } }) };
    settingsRepo.findOne.mockResolvedValue(null);

    const service = new DeviceSettingsService(settingsRepo as any, logRepo as any, deviceService as any);
    await service.saveSettings(3, 8, 'user', {
      volume: 60,
      speechRate: 1,
      screenBrightness: 80,
      sosHoldSeconds: 3,
      autoEscalation: 'family_then_community',
      communityContentEnabled: true,
      privacyVisibility: 'guardian_only',
      quietHours: [{ start: '21:00', end: '07:00' }],
    } as any);

    expect(deviceService.findById).toHaveBeenCalledWith(3, 8);
    expect(settingsRepo.create).toHaveBeenCalledWith(expect.objectContaining({ deviceId: 3, volume: 60 }));
    expect(logRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: 3,
        status: DeviceSettingDispatchStatus.PENDING,
      }),
    );
    expect(logRepo.save).toHaveBeenCalled();
  });

  it('marks a dispatch log as success when mock ack is received', async () => {
    const settingsRepo = createRepoMock();
    const logRepo = createRepoMock();
    const deviceService = { findById: jest.fn().mockResolvedValue({ device: { id: 3 } }) };
    logRepo.findOne.mockResolvedValue({ id: 5, deviceId: 3, status: 'pending' });

    const service = new DeviceSettingsService(settingsRepo as any, logRepo as any, deviceService as any);
    await service.mockAck(3, 5, { success: true });

    expect(logRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 5,
        status: DeviceSettingDispatchStatus.SUCCESS,
      }),
    );
  });

  it('throws when ack log does not belong to the device', async () => {
    const settingsRepo = createRepoMock();
    const logRepo = createRepoMock();
    const deviceService = { findById: jest.fn() };
    logRepo.findOne.mockResolvedValue(null);

    const service = new DeviceSettingsService(settingsRepo as any, logRepo as any, deviceService as any);

    await expect(service.mockAck(3, 404, { success: true })).rejects.toBeInstanceOf(NotFoundException);
  });
});
