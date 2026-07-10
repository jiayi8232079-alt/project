import { ForbiddenException, NotFoundException } from '@nestjs/common';

const PushPlatform = {
  IOS: 'ios',
  ANDROID: 'android',
} as const;

const PushVendor = {
  APNS: 'apns',
  FCM: 'fcm',
} as const;

jest.mock('../../entities/app-device-token.entity', () => ({
  AppDeviceToken: class AppDeviceToken {},
  PushPlatform,
  PushVendor,
}));

const { AppDeviceTokenService } = require('./app-device-token.service') as typeof import('./app-device-token.service');

type AppDeviceToken = {
  id: number;
  userId: number;
  deviceId: string;
  token: string;
  appVersion: string | null;
  active: boolean;
  lastSeenAt: Date;
};

type RepoMock = {
  findOne: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
};

function createRepoMock(): RepoMock {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((payload: Partial<AppDeviceToken>) => payload),
    save: jest.fn(async (payload: Partial<AppDeviceToken>) => ({
      id: payload.id ?? 1,
      ...payload,
    })),
  };
}

describe('AppDeviceTokenService', () => {
  it('updates an existing token for the same user device', async () => {
    const repo = createRepoMock();
    const existing = {
      id: 7,
      userId: 1,
      deviceId: 'iphone-15',
      token: 'old-token',
      appVersion: '1.0.0',
      active: true,
      lastSeenAt: new Date('2026-06-01T00:00:00Z'),
    } as AppDeviceToken;
    repo.findOne.mockResolvedValue(existing);

    const service = new AppDeviceTokenService(repo as any);
    await service.register(1, {
      platform: PushPlatform.IOS,
      vendor: PushVendor.APNS,
      token: 'new-token',
      deviceId: 'iphone-15',
      appVersion: '1.1.0',
    } as any);

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        userId: 1,
        token: 'new-token',
        appVersion: '1.1.0',
        active: true,
      }),
    );
  });

  it('creates a token when the current user device has not registered before', async () => {
    const repo = createRepoMock();
    repo.findOne.mockResolvedValue(null);

    const service = new AppDeviceTokenService(repo as any);
    await service.register(2, {
      platform: PushPlatform.ANDROID,
      vendor: PushVendor.FCM,
      token: 'android-token',
      deviceId: 'pixel-9',
    } as any);

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 2,
        platform: PushPlatform.ANDROID,
        vendor: PushVendor.FCM,
        token: 'android-token',
        deviceId: 'pixel-9',
        active: true,
      }),
    );
  });

  it('does not unregister another user token', async () => {
    const repo = createRepoMock();
    repo.findOne.mockResolvedValue({
      id: 9,
      userId: 2,
      active: true,
    } as AppDeviceToken);

    const service = new AppDeviceTokenService(repo as any);

    await expect(service.unregister(1, 9)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('throws when unregistering a missing token', async () => {
    const repo = createRepoMock();
    repo.findOne.mockResolvedValue(null);

    const service = new AppDeviceTokenService(repo as any);

    await expect(service.unregister(1, 404)).rejects.toBeInstanceOf(NotFoundException);
  });
});
