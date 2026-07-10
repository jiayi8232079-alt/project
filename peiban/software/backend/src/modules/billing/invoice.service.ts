import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Invoice,
  InvoiceStatus,
  InvoiceType,
} from '../../entities/invoice.entity.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { applyTenantFilter } from '../../common/utils/tenant-query.helper.js';

/**
 * 发票申请 / 开具服务。
 *
 * v1.0 不接电子发票服务商（航信/百望等），全流程人工：
 * 1. 用户 POST /billing/invoices 申请 → status=REQUESTED
 * 2. 财务在管理后台审核 → 接入开票服务后回填 invoiceNo / invoiceUrl → status=ISSUED
 *    若驳回 → status=REJECTED + rejectReason
 * 3. 用户 App 看到 status=ISSUED 即可下载/查看
 *
 * 后续 Wave2 接电子发票 SDK 时，把 issue() 内部 mock 实现换成真实 API 即可。
 */
@Injectable()
export class InvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
  ) {}

  async create(userId: number, dto: CreateInvoiceDto): Promise<Invoice> {
    if (dto.type === InvoiceType.ENTERPRISE && !dto.taxNumber?.trim()) {
      throw new BadRequestException('企业发票必须填写纳税人识别号');
    }
    const inv = this.invoiceRepo.create({
      userId,
      type: dto.type,
      status: InvoiceStatus.REQUESTED,
      amount: dto.amount,
      title: dto.title,
      taxNumber: dto.taxNumber ?? null,
      emailTo: dto.emailTo ?? null,
      items: dto.items ?? null,
      requestedAt: new Date(),
    });
    return this.invoiceRepo.save(inv);
  }

  async listForUser(userId: number, page = 1, pageSize = 20) {
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .where('i.user_id = :uid', { uid: userId })
      .orderBy('i.requestedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    applyTenantFilter(qb, 'i');
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async listAll(query: { status?: InvoiceStatus; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.invoiceRepo
      .createQueryBuilder('i')
      .orderBy('i.requestedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    applyTenantFilter(qb, 'i');
    if (query.status) qb.andWhere('i.status = :s', { s: query.status });
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findById(id: number, userId?: number): Promise<Invoice> {
    const inv = await this.invoiceRepo.findOne({ where: { id } });
    if (!inv) throw new NotFoundException('发票不存在');
    if (userId && inv.userId !== userId) throw new ForbiddenException('无权访问该发票');
    return inv;
  }

  /** 财务后台开票：回填发票号 / URL */
  async issue(
    id: number,
    payload: { invoiceNo: string; invoiceUrl: string },
  ): Promise<Invoice> {
    const inv = await this.findById(id);
    if (inv.status !== InvoiceStatus.REQUESTED) {
      throw new BadRequestException('当前状态不可开票');
    }
    inv.invoiceNo = payload.invoiceNo;
    inv.invoiceUrl = payload.invoiceUrl;
    inv.issuedAt = new Date();
    inv.status = InvoiceStatus.ISSUED;
    return this.invoiceRepo.save(inv);
  }

  async reject(id: number, reason: string): Promise<Invoice> {
    const inv = await this.findById(id);
    if (inv.status !== InvoiceStatus.REQUESTED) {
      throw new BadRequestException('当前状态不可驳回');
    }
    inv.status = InvoiceStatus.REJECTED;
    inv.rejectReason = reason;
    return this.invoiceRepo.save(inv);
  }

  async voidInvoice(id: number, reason?: string): Promise<Invoice> {
    const inv = await this.findById(id);
    if (inv.status === InvoiceStatus.VOIDED) return inv;
    inv.status = InvoiceStatus.VOIDED;
    inv.rejectReason = reason ?? '已作废';
    return this.invoiceRepo.save(inv);
  }
}
