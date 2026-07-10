import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { MedicineCatalog } from '../../entities/medicine-catalog.entity.js';
import { SaveMedicineDto } from './dto/save-medicine.dto.js';

@Injectable()
export class MedicineCatalogService {
  constructor(
    @InjectRepository(MedicineCatalog)
    private readonly repo: Repository<MedicineCatalog>,
  ) {}

  async list(query: { keyword?: string; category?: string; enabled?: boolean; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize) || 50));
    const qb = this.repo.createQueryBuilder('m');
    if (query.keyword) {
      qb.andWhere('(m.name LIKE :kw OR m.generic_name LIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }
    if (query.category) qb.andWhere('m.category = :c', { c: query.category });
    if (query.enabled !== undefined) {
      qb.andWhere('m.enabled = :en', { en: query.enabled ? 1 : 0 });
    }
    qb.orderBy('m.severity', 'ASC').addOrderBy('m.name', 'ASC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async search(keyword: string, limit = 20) {
    if (!keyword || keyword.length < 1) return [];
    return this.repo.find({
      where: [
        { name: Like(`%${keyword}%`), enabled: 1 },
        { genericName: Like(`%${keyword}%`), enabled: 1 },
      ],
      order: { severity: 'ASC', name: 'ASC' },
      take: Math.min(50, Math.max(1, limit)),
    });
  }

  async findOne(id: number) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('药品不存在');
    return item;
  }

  async create(dto: SaveMedicineDto) {
    const entity = this.repo.create({
      name: dto.name.trim(),
      genericName: dto.genericName?.trim() || null,
      specification: dto.specification?.trim() || null,
      severity: dto.severity || ('medium' as any),
      category: dto.category?.trim() || null,
      defaultTimesPerDay: dto.defaultTimesPerDay ?? null,
      defaultDosePerTime: dto.defaultDosePerTime ?? null,
      defaultUnit: dto.defaultUnit?.trim() || null,
      defaultInstructions: dto.defaultInstructions?.trim() || null,
      warningKeywords: dto.warningKeywords || null,
      enabled: dto.enabled ?? 1,
    });
    return this.repo.save(entity);
  }

  async update(id: number, dto: SaveMedicineDto) {
    const item = await this.findOne(id);
    Object.assign(item, {
      name: dto.name?.trim() ?? item.name,
      genericName: dto.genericName?.trim() ?? item.genericName,
      specification: dto.specification?.trim() ?? item.specification,
      severity: dto.severity ?? item.severity,
      category: dto.category?.trim() ?? item.category,
      defaultTimesPerDay:
        dto.defaultTimesPerDay === undefined ? item.defaultTimesPerDay : dto.defaultTimesPerDay,
      defaultDosePerTime:
        dto.defaultDosePerTime === undefined ? item.defaultDosePerTime : dto.defaultDosePerTime,
      defaultUnit: dto.defaultUnit?.trim() ?? item.defaultUnit,
      defaultInstructions: dto.defaultInstructions?.trim() ?? item.defaultInstructions,
      warningKeywords: dto.warningKeywords ?? item.warningKeywords,
      enabled: dto.enabled ?? item.enabled,
    });
    return this.repo.save(item);
  }

  async remove(id: number) {
    const item = await this.findOne(id);
    await this.repo.remove(item);
    return { success: true };
  }
}
