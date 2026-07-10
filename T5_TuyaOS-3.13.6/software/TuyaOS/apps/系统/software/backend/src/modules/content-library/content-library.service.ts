import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContentItem } from '../../entities/content-item.entity.js';
import {
  CreateContentItemDto,
  PlayContentDto,
  QueryContentItemDto,
  UpdateContentItemDto,
} from './dto/content-library.dto.js';

@Injectable()
export class ContentLibraryService {
  constructor(
    @InjectRepository(ContentItem)
    private readonly contentRepo: Repository<ContentItem>,
  ) {}

  list(query: QueryContentItemDto) {
    const where: Record<string, unknown> = { active: true };
    if (query.category) where.category = query.category;
    return this.contentRepo.find({
      where,
      order: { sortWeight: 'DESC', createdAt: 'DESC' },
      take: 100,
    });
  }

  create(dto: CreateContentItemDto) {
    return this.contentRepo.save(
      this.contentRepo.create({
        category: dto.category,
        title: dto.title,
        description: dto.description ?? null,
        duration: dto.duration ?? null,
        audioUrl: dto.audioUrl ?? null,
        coverUrl: dto.coverUrl ?? null,
        active: true,
        sortWeight: dto.sortWeight ?? 0,
      }),
    );
  }

  async update(id: number, dto: UpdateContentItemDto) {
    const item = await this.contentRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('内容不存在');
    }
    item.active = dto.active ?? item.active;
    item.title = dto.title ?? item.title;
    item.description = dto.description ?? item.description;
    return this.contentRepo.save(item);
  }

  /** 点播：mock 下发到设备播放（真实下发待设备接入）。 */
  async play(id: number, dto: PlayContentDto) {
    const item = await this.contentRepo.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('内容不存在');
    }
    return {
      dispatched: true,
      contentId: item.id,
      title: item.title,
      deviceId: dto.deviceId ?? null,
      dispatchedAt: new Date(),
    };
  }
}
