import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';

export enum InvoiceType {
  /** 个人电子普通发票 */
  PERSONAL = 'personal',
  /** 企业增值税专用发票 */
  ENTERPRISE = 'enterprise',
}

export enum InvoiceStatus {
  /** 申请中 */
  REQUESTED = 'requested',
  /** 已开 */
  ISSUED = 'issued',
  /** 已驳回 */
  REJECTED = 'rejected',
  /** 已作废 */
  VOIDED = 'voided',
}

/**
 * 发票申请 / 开具记录。
 *
 * 与订阅/订单的关系：
 * - 一张发票可包含多笔订阅扣费/订单（按月汇总）；
 * - `items` JSON 列存明细 [{ type:'subscription', id, amount, periodStart, periodEnd }]；
 * - 开票成功后回写 `taxNumber` / `invoiceUrl` 给用户下载。
 */
@Entity('invoices')
@Index(['userId'])
@Index(['status'])
@Index(['tenantId', 'status'])
@Index(['issuedAt'])
export class Invoice extends TenantAwareEntity {
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ type: 'enum', enum: InvoiceType, default: InvoiceType.PERSONAL })
  type: InvoiceType;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.REQUESTED })
  status: InvoiceStatus;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: DecimalTransformer,
    comment: '票面金额（元）',
  })
  amount: number;

  @Column({ name: 'title', type: 'varchar', length: 255, comment: '抬头名称' })
  title: string;

  @Column({
    name: 'tax_number',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '纳税人识别号（企业必填）',
  })
  taxNumber: string | null;

  @Column({
    name: 'email_to',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '发送至邮箱',
  })
  emailTo: string | null;

  @Column({
    name: 'invoice_no',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '发票号（开票后回填）',
  })
  invoiceNo: string | null;

  @Column({
    name: 'invoice_url',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: 'PDF/电子发票 URL',
  })
  invoiceUrl: string | null;

  @Column({
    name: 'requested_at',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  requestedAt: Date;

  @Column({ name: 'issued_at', type: 'datetime', nullable: true })
  issuedAt: Date | null;

  @Column({
    name: 'reject_reason',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  rejectReason: string | null;

  @Column({
    type: 'json',
    nullable: true,
    comment: '明细：[{ type, refId, amount, periodStart, periodEnd, description }]',
  })
  items: unknown[] | null;
}
