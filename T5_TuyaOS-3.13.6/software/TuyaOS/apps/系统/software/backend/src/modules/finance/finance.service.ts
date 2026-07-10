import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinanceRecord } from '../../entities/finance-record.entity.js';
import { Order } from '../../entities/order.entity.js';
import { CreateFinanceRecordDto } from './dto/create-finance-record.dto.js';
import { FinanceQueryDto } from './dto/finance-query.dto.js';
import {
  FinanceRecordStatus,
  FinanceRecordType,
} from '../../common/enums/index.js';
import { StorageService } from '../../common/storage/storage.service.js';
import {
  ORDER_RISK_LEVEL_LABELS,
  ensureOrderRiskLevelColumn,
  normalizeOrderRiskLevel,
} from '../order/order-risk-level.js';

const FINANCE_TYPE_LABEL: Record<string, string> = {
  [FinanceRecordType.TRANSPORT]: '交通费',
  [FinanceRecordType.ACCOMMODATION]: '住宿费',
  [FinanceRecordType.MEDICAL]: '医疗相关',
  [FinanceRecordType.OTHER]: '其他费用',
};

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private riskLevelColumnReady = false;

  constructor(
    @InjectRepository(FinanceRecord)
    private readonly financeRepository: Repository<FinanceRecord>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly storageService: StorageService,
  ) {}

  private async ensureRiskLevelColumnReady() {
    if (this.riskLevelColumnReady) return true;
    const ready = await ensureOrderRiskLevelColumn(this.orderRepository, this.logger);
    if (ready) {
      this.riskLevelColumnReady = true;
    }
    return ready;
  }

  async create(attendantId: number, dto: CreateFinanceRecordDto) {
    const { images, orderId, ...rest } = dto as any;
    const proofImages = Array.isArray(images)
      ? images.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
      : [];
    const proofUrl = rest.proofUrl || proofImages[0] || undefined;
    const record: FinanceRecord = this.financeRepository.create({
      ...rest,
      orderId: orderId ?? undefined,
      proofUrl,
      proofImages: proofImages.length ? proofImages : undefined,
      attendantId,
      status: FinanceRecordStatus.PENDING,
    } as Partial<FinanceRecord>);
    const saved = await this.financeRepository.save(record);
    return this.serializeRecord(saved);
  }

  async findAll(query: FinanceQueryDto, attendantId?: number) {
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));

    const buildQuery = (withRelations: boolean) => {
      const qb = this.financeRepository
        .createQueryBuilder('record')
        .leftJoinAndSelect('record.order', 'order');
      if (withRelations) {
        qb.leftJoinAndSelect('order.serviceTarget', 'serviceTarget')
          .leftJoinAndSelect('order.user', 'orderUser')
          .leftJoinAndSelect('record.attendant', 'attendant');
      }
      return qb;
    };

    const applyFilters = (qb: ReturnType<typeof buildQuery>) => {
      if (attendantId) {
        qb.andWhere('record.attendantId = :attendantId', { attendantId });
      }
      if (query.keyword) {
        qb.leftJoin('record.attendant', 'att_kw')
          .leftJoin('order.serviceTarget', 'st_kw')
          .andWhere(
            '(record.description LIKE :keyword OR order.orderNumber LIKE :keyword OR att_kw.realName LIKE :keyword OR st_kw.name LIKE :keyword)',
            { keyword: `%${query.keyword}%` },
          );
      }
      if (query.status) {
        qb.andWhere('record.status = :status', { status: query.status });
      }
      if (query.orderId) {
        qb.andWhere('record.orderId = :orderId', { orderId: query.orderId });
      }
    };

    const countQb = buildQuery(false);
    applyFilters(countQb);
    const total = await countQb.getCount();

    const listQb = buildQuery(true);
    const canReadRiskLevel = await this.ensureRiskLevelColumnReady();
    if (canReadRiskLevel) {
      listQb.addSelect('order.riskLevel');
    }
    applyFilters(listQb);
    listQb.orderBy('record.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const items = await listQb.getMany();

    return {
      items: await Promise.all(items.map((item) => this.serializeRecord(item))),
      total,
      page,
      pageSize,
    };
  }

  async getStats(startDate?: string, endDate?: string) {
    const qb = this.financeRepository
      .createQueryBuilder('record')
      .where('record.status = :status', {
        status: FinanceRecordStatus.APPROVED,
      });

    if (startDate) {
      qb.andWhere('record.createdAt >= :startDate', { startDate });
    }
    if (endDate) {
      qb.andWhere('record.createdAt <= :endDate', { endDate });
    }

    const result = await qb
      .select('SUM(record.amount)', 'totalAmount')
      .addSelect('COUNT(record.id)', 'totalCount')
      .addSelect('COUNT(DISTINCT record.orderId)', 'orderCount')
      .getRawOne();

    const pendingResult = await this.financeRepository
      .createQueryBuilder('record')
      .where('record.status = :status', {
        status: FinanceRecordStatus.PENDING,
      })
      .select('SUM(record.amount)', 'pendingAmount')
      .addSelect('COUNT(record.id)', 'pendingCount')
      .getRawOne();

    return {
      totalAmount: Number(result?.totalAmount ?? 0),
      totalCount: Number(result?.totalCount ?? 0),
      orderCount: Number(result?.orderCount ?? 0),
      pendingAmount: Number(pendingResult?.pendingAmount ?? 0),
      pendingCount: Number(pendingResult?.pendingCount ?? 0),
    };
  }

  async approve(id: number, reviewerId: number, reviewNote?: string) {
    const record = await this.financeRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('费用记录不存在');
    this.assertPendingForReview(record, 'approved');
    record.status = FinanceRecordStatus.APPROVED;
    record.reviewerId = reviewerId;
    if (reviewNote) record.reviewNote = reviewNote;
    const saved = await this.financeRepository.save(record);
    return this.serializeRecord(saved);
  }

  async reject(id: number, reviewerId: number, reviewNote: string) {
    const record = await this.financeRepository.findOne({ where: { id } });
    if (!record) throw new NotFoundException('费用记录不存在');
    if (!reviewNote || !reviewNote.trim()) {
      throw new BadRequestException('驳回需填写原因');
    }
    this.assertPendingForReview(record, 'rejected');
    record.status = FinanceRecordStatus.REJECTED;
    record.reviewerId = reviewerId;
    record.reviewNote = reviewNote;
    const saved = await this.financeRepository.save(record);
    return this.serializeRecord(saved);
  }

  private assertPendingForReview(
    record: FinanceRecord,
    target: 'approved' | 'rejected',
  ) {
    if (record.status === FinanceRecordStatus.PENDING) return;
    if (record.status === target) {
      throw new ConflictException(
        target === 'approved'
          ? '该费用记录已审批通过，无需重复操作'
          : '该费用记录已被驳回，无需重复操作',
      );
    }
    throw new ConflictException(
      `该费用记录当前状态为「${record.status}」，不能再次审批/驳回`,
    );
  }

  private async serializeRecord(record: FinanceRecord) {
    const urls = await this.resolveProofImages(record);
    const orderRiskLevel = normalizeOrderRiskLevel(record.order?.riskLevel);
    return {
      ...record,
      typeLabel: FINANCE_TYPE_LABEL[record.type] || record.type,
      proofUrl: urls[0] || '',
      proofImages: urls,
      orderRiskLevel: orderRiskLevel || '',
      orderRiskLabel: orderRiskLevel ? ORDER_RISK_LEVEL_LABELS[orderRiskLevel] : '',
    };
  }

  private async resolveProofImages(record: FinanceRecord): Promise<string[]> {
    const source = Array.isArray(record.proofImages) && record.proofImages.length
      ? record.proofImages
      : record.proofUrl
        ? [record.proofUrl]
        : [];
    return Promise.all(source.map((url) => this.storageService.resolveUrl(url)));
  }
}
