import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppDeviceToken } from '../../entities/app-device-token.entity.js';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto.js';

@Injectable()
export class AppDeviceTokenService {
  constructor(
    @InjectRepository(AppDeviceToken)
    private readonly tokenRepo: Repository<AppDeviceToken>,
  ) {}

  async register(userId: number, dto: RegisterDeviceTokenDto): Promise<AppDeviceToken> {
    const existing = await this.tokenRepo.findOne({
      where: { userId, deviceId: dto.deviceId },
    });

    if (existing) {
      existing.platform = dto.platform;
      existing.vendor = dto.vendor;
      existing.token = dto.token;
      existing.appVersion = dto.appVersion ?? null;
      existing.active = true;
      existing.lastSeenAt = new Date();
      existing.unregisteredAt = null;
      return this.tokenRepo.save(existing);
    }

    return this.tokenRepo.save(
      this.tokenRepo.create({
        userId,
        platform: dto.platform,
        vendor: dto.vendor,
        token: dto.token,
        deviceId: dto.deviceId,
        appVersion: dto.appVersion ?? null,
        active: true,
        lastSeenAt: new Date(),
        unregisteredAt: null,
      }),
    );
  }

  listMine(userId: number): Promise<AppDeviceToken[]> {
    return this.tokenRepo.find({
      where: { userId, active: true },
      order: { lastSeenAt: 'DESC' },
    });
  }

  async unregister(userId: number, id: number): Promise<void> {
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token) {
      throw new NotFoundException('推送 token 不存在');
    }
    if (token.userId !== userId) {
      throw new ForbiddenException('无权解绑该推送 token');
    }

    token.active = false;
    token.unregisteredAt = new Date();
    await this.tokenRepo.save(token);
  }
}
