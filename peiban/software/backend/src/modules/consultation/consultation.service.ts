import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Consultation } from '../../entities/consultation.entity.js';
import { SystemConfig } from '../../entities/system-config.entity.js';


type SlotRule = {
  startTime: string;
  endTime: string;
  intervalMinutes: number;
  capacityPerSlot: number;
};

type CreateConsultationPayload = {
  type: string;
  serviceInterest?: string;
  category?: string;
  subType?: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  detail?: string;
};

const SLOT_RULE_CONFIG_KEY = 'consultation_slot_rule';
const SLOT_LOCK_WAIT_SECONDS = 10;
const DEFAULT_SLOT_RULE: SlotRule = {
  startTime: '09:00',
  endTime: '17:00',
  intervalMinutes: 40,
  capacityPerSlot: 3,
};

const ALLOWED_CONSULTATION_STATUSES = new Set([
  'pending',
  'unconsulted',
  'consulted',
  'order_accepted',
  'cancelled',
  'confirmed',
  'completed',
]);

@Injectable()
export class ConsultationService {
  constructor(
    @InjectRepository(Consultation)
    private readonly consultationRepository: Repository<Consultation>,
    @InjectRepository(SystemConfig)
    private readonly configRepository: Repository<SystemConfig>,
    private readonly dataSource: DataSource,
  ) {}

  private parseTimeToMinutes(time: string): number {
    const [hh, mm] = String(time).split(':').map((n) => Number(n));
    if (
      Number.isNaN(hh) ||
      Number.isNaN(mm) ||
      hh < 0 ||
      hh > 23 ||
      mm < 0 ||
      mm > 59
    ) {
      return -1;
    }
    return hh * 60 + mm;
  }

  private toHHmm(minutes: number): string {
    const hh = Math.floor(minutes / 60);
    const mm = minutes % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  private buildSlots(rule: SlotRule): string[] {
    const start = this.parseTimeToMinutes(rule.startTime);
    const end = this.parseTimeToMinutes(rule.endTime);
    if (start < 0 || end < 0 || end <= start || rule.intervalMinutes <= 0) {
      return [];
    }
    const slots: string[] = [];
    for (let t = start; t < end; t += rule.intervalMinutes) {
      slots.push(this.toHHmm(t));
    }
    return slots;
  }

  private async getSlotRule(
    configRepository: Repository<SystemConfig> = this.configRepository,
  ): Promise<SlotRule> {
    const item = await configRepository.findOne({
      where: { key: SLOT_RULE_CONFIG_KEY },
    });
    if (!item?.value) return DEFAULT_SLOT_RULE;
    try {
      const parsed = JSON.parse(item.value);
      const startTime = String(parsed?.startTime || DEFAULT_SLOT_RULE.startTime);
      const endTime = String(parsed?.endTime || DEFAULT_SLOT_RULE.endTime);
      const intervalMinutes = Number(
        parsed?.intervalMinutes || DEFAULT_SLOT_RULE.intervalMinutes,
      );
      const capacityPerSlot = Number(
        parsed?.capacityPerSlot || DEFAULT_SLOT_RULE.capacityPerSlot,
      );
      if (
        this.parseTimeToMinutes(startTime) < 0 ||
        this.parseTimeToMinutes(endTime) < 0 ||
        intervalMinutes <= 0 ||
        capacityPerSlot <= 0
      ) {
        return DEFAULT_SLOT_RULE;
      }
      return {
        startTime,
        endTime,
        intervalMinutes,
        capacityPerSlot,
      };
    } catch {
      return DEFAULT_SLOT_RULE;
    }
  }

  async getSlotOptions(
    date: string,
    consultationRepository: Repository<Consultation> = this.consultationRepository,
    configRepository: Repository<SystemConfig> = this.configRepository,
  ) {
    const rule = await this.getSlotRule(configRepository);
    const slots = this.buildSlots(rule);
    if (!date) {
      return {
        rule,
        slots: slots.map((time) => ({
          time,
          capacity: rule.capacityPerSlot,
          booked: 0,
          remaining: rule.capacityPerSlot,
          disabled: false,
        })),
      };
    }

    const rows = await consultationRepository
      .createQueryBuilder('c')
      .select('c.appointmentTime', 'time')
      .addSelect('COUNT(*)', 'count')
      .where('c.appointmentDate = :date', { date })
      .andWhere('c.consultType IN (:...types)', { types: ['offline', 'store'] })
      .andWhere('c.status != :cancelled', { cancelled: 'cancelled' })
      .groupBy('c.appointmentTime')
      .getRawMany();
    const bookedMap = new Map<string, number>();
    rows.forEach((r: any) => bookedMap.set(r.time, Number(r.count || 0)));

    return {
      rule,
      slots: slots.map((time) => {
        const booked = bookedMap.get(time) || 0;
        const remaining = Math.max(rule.capacityPerSlot - booked, 0);
        return {
          time,
          capacity: rule.capacityPerSlot,
          booked,
          remaining,
          disabled: remaining <= 0,
        };
      }),
    };
  }

  private buildSlotLockName(date: string, time: string): string {
    return `consultation_slot:${date}:${time}`;
  }

  private buildConsultationPayload(
    userId: number,
    dto: CreateConsultationPayload,
  ) {
    return {
      userId,
      consultType: dto.type,
      serviceInterest: dto.serviceInterest ?? null,
      consultCategory: dto.category ?? null,
      consultSubType: dto.subType ?? null,
      name: dto.name,
      phone: dto.phone,
      appointmentDate: dto.date,
      appointmentTime: dto.time,
      detail: dto.detail,
      status: 'pending' as const,
    };
  }

  private async createStoreConsultation(
    userId: number,
    dto: CreateConsultationPayload,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    const lockName = this.buildSlotLockName(dto.date, dto.time);
    let hasLock = false;

    try {
      await queryRunner.connect();
      const lockRows = await queryRunner.query(
        'SELECT GET_LOCK(?, ?) AS acquired',
        [lockName, SLOT_LOCK_WAIT_SECONDS],
      );
      hasLock = Number(lockRows?.[0]?.acquired ?? 0) === 1;
      if (!hasLock) {
        throw new BadRequestException('当前预约人数较多，请稍后重试');
      }

      const consultationRepository =
        queryRunner.manager.getRepository(Consultation);
      const configRepository = queryRunner.manager.getRepository(SystemConfig);
      const slotInfo = await this.getSlotOptions(
        dto.date,
        consultationRepository,
        configRepository,
      );
      const target = slotInfo.slots.find((slot) => slot.time === dto.time);
      if (!target) {
        throw new BadRequestException('预约时间不在可预约时段内');
      }
      if (target.remaining <= 0) {
        throw new BadRequestException('该时段号源已满，请选择其他时段');
      }

      const consultation = consultationRepository.create(
        this.buildConsultationPayload(userId, dto),
      );
      // Keep the query runner alive until the insert is fully committed,
      // otherwise the finally block releases the connection too early.
      return await consultationRepository.save(consultation);
    } finally {
      if (hasLock) {
        try {
          await queryRunner.query('SELECT RELEASE_LOCK(?)', [lockName]);
        } catch {
          // Ignore release errors to avoid masking the original request failure.
        }
      }
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
    }
  }

  private resolveMyConsultationStatuses(status?: string): string[] | undefined {
    if (!status) return undefined;
    const normalized = new Set<string>();
    const parts = String(status)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    for (const item of parts) {
      if (item === 'pending' || item === 'unconsulted') {
        normalized.add('pending');
        normalized.add('unconsulted');
        continue;
      }
      if (item === 'completed') {
        normalized.add('consulted');
        normalized.add('order_accepted');
        normalized.add('completed');
        continue;
      }
      normalized.add(item);
    }

    return normalized.size > 0 ? [...normalized] : undefined;
  }

  async create(
    userId: number,
    dto: CreateConsultationPayload,
  ) {
    const isStoreConsult = ['offline', 'store'].includes(dto.type);
    const saved = isStoreConsult
      ? await this.createStoreConsultation(userId, dto)
      : await this.consultationRepository.save(
          this.consultationRepository.create(
            this.buildConsultationPayload(userId, dto),
          ),
        );

    return saved;
  }

  async findByUserId(
    userId: number,
    options: { page?: number; pageSize?: number; status?: string } = {},
  ) {
    const page = Math.max(1, Number.isFinite(Number(options.page)) ? Number(options.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(options.pageSize)) ? Number(options.pageSize) : 20));
    const { status } = options;
    const where: any = { userId };
    const statuses = this.resolveMyConsultationStatuses(status);
    if (statuses?.length) {
      where.status = statuses.length === 1 ? statuses[0] : In(statuses);
    }
    const [items, total] = await this.consultationRepository.findAndCount({
      where,
      order: {
        appointmentDate: 'DESC',
        appointmentTime: 'DESC',
        createdAt: 'DESC',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async findAll(query: {
    date?: string;
    status?: string;
    serviceInterest?: string;
    page?: number;
    pageSize?: number;
    excludeOrderAccepted?: boolean;
  }) {
    const {
      date,
      status,
      serviceInterest,
      excludeOrderAccepted,
    } = query;
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(200, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 50));
    const qb = this.consultationRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .orderBy('c.appointmentDate', 'ASC')
      .addOrderBy('c.appointmentTime', 'ASC');

    if (date) qb.andWhere('c.appointmentDate = :date', { date });
    if (status) {
      if (status === 'unconsulted') {
        qb.andWhere('c.status IN (:...statuses)', {
          statuses: ['pending', 'unconsulted'],
        });
      } else {
        qb.andWhere('c.status = :status', { status });
      }
    }
    if (serviceInterest)
      qb.andWhere('c.serviceInterest = :serviceInterest', { serviceInterest });
    if (excludeOrderAccepted)
      qb.andWhere('c.status != :oa', { oa: 'order_accepted' });

    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, total, page, pageSize };
  }

  async findByDate(date: string, excludeOrderAccepted = true) {
    const qb = this.consultationRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .where('c.appointmentDate = :date', { date })
      .orderBy('c.appointmentTime', 'ASC');
    if (excludeOrderAccepted) {
      qb.andWhere('c.status != :oa', { oa: 'order_accepted' });
    }
    return qb.getMany();
  }

  async getDateSummary(startDate: string, endDate: string) {
    const result = await this.consultationRepository
      .createQueryBuilder('c')
      .select('c.appointment_date', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('c.appointment_date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      })
      .andWhere('c.status != :cancelled', { cancelled: 'cancelled' })
      .andWhere('c.status != :orderAccepted', {
        orderAccepted: 'order_accepted',
      })
      .groupBy('c.appointment_date')
      .getRawMany();

    return result as { date: string; count: string }[];
  }

  async updateStatus(id: number, status: string) {
    const consultation = await this.consultationRepository.findOne({
      where: { id },
    });
    if (!consultation) throw new NotFoundException('预约咨询不存在');
    if (!ALLOWED_CONSULTATION_STATUSES.has(status)) {
      throw new BadRequestException('无效的预约咨询状态');
    }
    consultation.status = status;
    return this.consultationRepository.save(consultation);
  }
}
