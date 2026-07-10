import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  CompanionMemory,
  CompanionMemoryScope,
  CompanionMemoryStatus,
} from '../../entities/companion-memory.entity.js';
import { CompanionPersona } from '../../entities/companion-persona.entity.js';
import {
  CorrectMemoryDto,
  RecallMemoryQueryDto,
  SaveMemoryDto,
  UpsertPersonaDto,
} from './dto/companion.dto.js';

/** 家庭级可见的记忆层（不含个人私密记忆） */
const FAMILY_VISIBLE_SCOPES: CompanionMemoryScope[] = [
  CompanionMemoryScope.MEMBER_IDENTITY,
  CompanionMemoryScope.FAMILY_SHARED,
  CompanionMemoryScope.HEALTH_FACT,
  CompanionMemoryScope.ROBOT_RELATION,
];

@Injectable()
export class CompanionService {
  constructor(
    @InjectRepository(CompanionMemory)
    private readonly memoryRepo: Repository<CompanionMemory>,
    @InjectRepository(CompanionPersona)
    private readonly personaRepo: Repository<CompanionPersona>,
  ) {}

  /** save：写入或按 memoryKey 更新一条记忆 */
  async saveMemory(dto: SaveMemoryDto) {
    if (dto.memoryKey) {
      const existing = await this.memoryRepo.findOne({
        where: {
          familyId: dto.familyId,
          memberId: dto.memberId ?? IsNull(),
          scope: dto.scope,
          memoryKey: dto.memoryKey,
          status: CompanionMemoryStatus.ACTIVE,
        },
      });
      if (existing) {
        existing.content = dto.content;
        existing.source = dto.source ?? existing.source;
        existing.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : existing.expiresAt;
        existing.correctedAt = new Date();
        return this.memoryRepo.save(existing);
      }
    }
    return this.memoryRepo.save(
      this.memoryRepo.create({
        familyId: dto.familyId,
        memberId: dto.memberId ?? null,
        scope: dto.scope,
        memoryKey: dto.memoryKey ?? null,
        content: dto.content,
        source: dto.source ?? 'conversation',
        status: CompanionMemoryStatus.ACTIVE,
        confirmedAt: null,
        correctedAt: null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      }),
    );
  }

  /**
   * recall：按家庭召回记忆，遵守 §8.5 隐私隔离。
   * - 传 memberId：返回家庭级记忆 + 该成员的个人私密记忆；
   * - 不传 memberId：仅返回家庭级记忆（个人私密记忆默认不公开）。
   */
  recall(query: RecallMemoryQueryDto) {
    const qb = this.memoryRepo
      .createQueryBuilder('m')
      .where('m.familyId = :familyId', { familyId: query.familyId })
      .andWhere('m.status = :status', { status: CompanionMemoryStatus.ACTIVE })
      .andWhere('(m.expiresAt IS NULL OR m.expiresAt > :now)', { now: new Date() });

    if (query.scope) {
      qb.andWhere('m.scope = :scope', { scope: query.scope });
      if (query.scope === CompanionMemoryScope.MEMBER_PRIVATE) {
        if (!query.memberId) {
          // 未指定成员时不暴露任何个人私密记忆
          return Promise.resolve([] as CompanionMemory[]);
        }
        qb.andWhere('m.memberId = :memberId', { memberId: query.memberId });
      }
    } else if (query.memberId) {
      qb.andWhere(
        '(m.scope IN (:...shared) OR (m.scope = :priv AND m.memberId = :memberId))',
        {
          shared: FAMILY_VISIBLE_SCOPES,
          priv: CompanionMemoryScope.MEMBER_PRIVATE,
          memberId: query.memberId,
        },
      );
    } else {
      qb.andWhere('m.scope IN (:...shared)', { shared: FAMILY_VISIBLE_SCOPES });
    }

    if (query.keyword) {
      qb.andWhere('m.content LIKE :kw', { kw: `%${query.keyword}%` });
    }

    return qb.orderBy('m.updatedAt', 'DESC').take(50).getMany();
  }

  /** forget：软删除一条记忆 */
  async forgetMemory(id: number) {
    const memory = await this.memoryRepo.findOne({ where: { id } });
    if (!memory) {
      throw new NotFoundException('记忆不存在');
    }
    memory.status = CompanionMemoryStatus.DELETED;
    return this.memoryRepo.save(memory);
  }

  /** correct：纠正一条记忆内容 */
  async correctMemory(id: number, dto: CorrectMemoryDto) {
    const memory = await this.memoryRepo.findOne({ where: { id } });
    if (!memory) {
      throw new NotFoundException('记忆不存在');
    }
    memory.content = dto.content;
    memory.correctedAt = new Date();
    return this.memoryRepo.save(memory);
  }

  /** confirm：确认一条记忆为可信 */
  async confirmMemory(id: number) {
    const memory = await this.memoryRepo.findOne({ where: { id } });
    if (!memory) {
      throw new NotFoundException('记忆不存在');
    }
    memory.confirmedAt = new Date();
    return this.memoryRepo.save(memory);
  }

  /** get_persona：取家庭人格，不存在则返回默认值（不落库） */
  async getPersona(familyId: number) {
    const persona = await this.personaRepo.findOne({ where: { familyId } });
    if (persona) return persona;
    return this.personaRepo.create({
      familyId,
      deviceId: null,
      nickname: '小伴',
      personality: 'warm',
      speechRate: 1.0,
      catchphrase: null,
      traits: null,
    });
  }

  /** upsert_persona：创建或更新家庭人格 */
  async upsertPersona(dto: UpsertPersonaDto) {
    const persona =
      (await this.personaRepo.findOne({ where: { familyId: dto.familyId } })) ??
      this.personaRepo.create({ familyId: dto.familyId });
    persona.deviceId = dto.deviceId ?? persona.deviceId ?? null;
    persona.nickname = dto.nickname ?? persona.nickname ?? '小伴';
    persona.personality = dto.personality ?? persona.personality ?? 'warm';
    persona.speechRate = dto.speechRate ?? persona.speechRate ?? 1.0;
    persona.catchphrase = dto.catchphrase ?? persona.catchphrase ?? null;
    persona.traits = dto.traits ?? persona.traits ?? null;
    return this.personaRepo.save(persona);
  }
}
