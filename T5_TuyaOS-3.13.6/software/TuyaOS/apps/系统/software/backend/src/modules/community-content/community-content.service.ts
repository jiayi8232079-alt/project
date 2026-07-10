import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CommunityContent,
  CommunityContentPriority,
  CommunityContentStatus,
} from '../../entities/community-content.entity.js';
import {
  ContentDelivery,
  ContentDeliveryStatus,
} from '../../entities/content-delivery.entity.js';
import {
  CreateCommunityContentDto,
  MockContentDeliveryAckDto,
  QueryCommunityContentDto,
} from './dto/community-content.dto.js';

@Injectable()
export class CommunityContentService {
  constructor(
    @InjectRepository(CommunityContent)
    private readonly contentRepo: Repository<CommunityContent>,
    @InjectRepository(ContentDelivery)
    private readonly deliveryRepo: Repository<ContentDelivery>,
  ) {}

  createDraft(dto: CreateCommunityContentDto) {
    return this.contentRepo.save(
      this.contentRepo.create({
        title: dto.title,
        body: dto.body,
        voiceScript: dto.voiceScript ?? null,
        category: dto.category,
        priority: dto.priority ?? CommunityContentPriority.NORMAL,
        status: CommunityContentStatus.DRAFT,
        target: dto.target ?? null,
        schedule: dto.schedule ?? null,
        publishedAt: null,
        revokedAt: null,
      }),
    );
  }

  async list(query: QueryCommunityContentDto) {
    const where = query.status ? { status: query.status } : {};
    return this.contentRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async publish(id: number) {
    const content = await this.contentRepo.findOne({ where: { id } });
    if (!content) {
      throw new NotFoundException('社区内容不存在');
    }
    if (content.status === CommunityContentStatus.REVOKED) {
      throw new BadRequestException('已撤回内容不能发布');
    }

    content.status = CommunityContentStatus.PUBLISHED;
    content.publishedAt = new Date();
    const saved = await this.contentRepo.save(content);

    const deviceIds = content.target?.deviceIds ?? [];
    if (deviceIds.length > 0) {
      await this.deliveryRepo.save(
        deviceIds.map((deviceId) =>
          this.deliveryRepo.create({
            contentId: saved.id,
            deviceId,
            familyId: null,
            elderId: null,
            status: ContentDeliveryStatus.QUEUED,
            statusAt: new Date(),
            failureReason: null,
          }),
        ),
      );
    }

    return saved;
  }

  async revoke(id: number) {
    const content = await this.contentRepo.findOne({ where: { id } });
    if (!content) {
      throw new NotFoundException('社区内容不存在');
    }

    content.status = CommunityContentStatus.REVOKED;
    content.revokedAt = new Date();
    const saved = await this.contentRepo.save(content);

    const deliveries = await this.deliveryRepo.find({ where: { contentId: id } });
    for (const delivery of deliveries) {
      delivery.status = ContentDeliveryStatus.REVOKED;
      delivery.statusAt = new Date();
    }
    if (deliveries.length > 0) {
      await this.deliveryRepo.save(deliveries);
    }

    return saved;
  }

  async listDeliveries(contentId?: number) {
    const where = contentId ? { contentId } : {};
    return this.deliveryRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async mockAck(deliveryId: number, dto: MockContentDeliveryAckDto) {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) {
      throw new NotFoundException('触达回执不存在');
    }

    delivery.status = dto.status;
    delivery.statusAt = new Date();
    delivery.failureReason =
      dto.status === ContentDeliveryStatus.FAILED
        ? dto.failureReason ?? '设备回执失败'
        : null;
    return this.deliveryRepo.save(delivery);
  }
}
