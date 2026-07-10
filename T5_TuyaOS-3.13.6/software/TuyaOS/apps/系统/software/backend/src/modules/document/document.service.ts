import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from '../../entities/document.entity.js';
import {
  DocumentType,
  UserRole,
  OrderStatus,
  PaymentMethod,
  FinanceRecordType,
} from '../../common/enums/index.js';
import { Order } from '../../entities/order.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { generateHealthProfileHtml } from './templates/health-profile.js';
import { generateServiceConfirmHtml } from './templates/service-confirm.js';
import { generateServiceCompleteHtml } from './templates/service-complete.js';
import { generateElderTrustHtml } from './templates/elder-trust.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { AuditLogService } from '../audit/audit-log.service.js';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(ServiceTarget)
    private readonly serviceTargetRepository: Repository<ServiceTarget>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private async nextHealthProfileSeq(): Promise<string> {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const key = `hp_seq_${dateStr}`;
    let seqConfig = await this.systemConfigRepository.findOne({ where: { key } });
    let seq = 1;
    if (seqConfig) {
      seq = (parseInt(seqConfig.value, 10) || 0) + 1;
      seqConfig.value = String(seq);
      await this.systemConfigRepository.save(seqConfig);
    } else {
      await this.systemConfigRepository.save(
        this.systemConfigRepository.create({ key, value: '1', description: `健康档案当日序号-${dateStr}` }),
      );
    }
    return `${dateStr}-${String(seq).padStart(2, '0')}`;
  }

  private async saveHtml(fileName: string, html: string): Promise<string> {
    const uploaded = await this.storageService.uploadBuffer(
      html,
      `generated/${fileName}`,
      'text/html; charset=utf-8',
    );
    return uploaded.url;
  }

  private buildHealthProfileObjectKey(userId: number, serviceTargetId: number) {
    return `generated/u${userId}_hp_${serviceTargetId}.html`;
  }

  private withVersionQuery(url: string, version?: string | null) {
    if (!version) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }

  private async serializeDocument(doc: Document): Promise<Document> {
    doc.url = await this.storageService.resolveUrl(doc.url);
    return doc;
  }

  /**
   * 校验客户端上送的签名 URL 是否为本系统可信地址：
   * - 以 `/uploads/` 开头的本地存储相对路径；或
   * - 明确的 http / https 外链（用于开启 COS 后的对象存储地址）。
   * 拒绝 `javascript:` / `data:` 等高危协议和过长字符串，避免非法来源的 URL
   * 被签入订单/服务对象并在后续页面被渲染为链接。
   */
  private ensureValidSignatureUrl(url: string): string {
    const trimmed = (url || '').trim();
    if (!trimmed) {
      throw new BadRequestException('缺少签名');
    }
    if (trimmed.length > 1024) {
      throw new BadRequestException('签名地址长度超限');
    }
    if (trimmed.startsWith('/uploads/')) {
      return trimmed;
    }
    if (/^https?:\/\/[^\s"'<>]+$/i.test(trimmed)) {
      return trimmed;
    }
    throw new BadRequestException('签名地址格式无效');
  }

  private async storeIncomingFile(
    file: {
      filename: string;
      path?: string;
      buffer?: Buffer;
      mimeType?: string;
    },
    objectKey: string,
  ) {
    if (file.buffer?.length) {
      return this.storageService.uploadBuffer(file.buffer, objectKey, file.mimeType);
    }
    if (file.path) {
      return this.storageService.uploadTempFile(file.path, objectKey, file.mimeType);
    }
    throw new BadRequestException('上传文件内容为空');
  }

  private async saveOrUpdateDoc(
    orderId: number,
    type: DocumentType,
    url: string,
    displayName: string,
  ) {
    const existing = await this.documentRepository.findOne({
      where: { orderId, type },
    });
    if (existing) {
      existing.url = url;
      existing.fileName = displayName;
      return this.documentRepository.save(existing);
    }
    return this.documentRepository.save(
      this.documentRepository.create({
        orderId,
        type,
        url,
        fileName: displayName,
      }),
    );
  }

  private isPrivileged(role?: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT ||
      role === UserRole.FINANCE
    );
  }

  private async assertOrderAccess(
    orderId: number,
    currentUserId: number,
    role: string,
  ) {
    if (this.isPrivileged(role)) return;
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['attendant'],
    });
    if (!order) throw new NotFoundException('订单不存在');
    if (role === UserRole.ATTENDANT) {
      if (order.attendant?.userId !== currentUserId) {
        throw new ForbiddenException('无权访问该订单文档');
      }
      return;
    }
    if (order.userId !== currentUserId) {
      throw new ForbiddenException('无权访问该订单文档');
    }
  }

  private async getOrderOrThrow(orderId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'user',
        'serviceTarget',
        'hospitalDirectory',
        'attendant',
        'attendant.user',
        'timelines',
        'reviews',
        'financeRecords',
      ],
    });
    if (!order) throw new NotFoundException('订单不存在');
    return order;
  }

  private assertPrivilegedDocRole(role: string) {
    if (!this.isPrivileged(role)) {
      throw new ForbiddenException('当前角色无权生成正式文档');
    }
  }

  private assertCompletionRole(
    order: Order,
    currentUserId: number,
    role: string,
  ) {
    if (this.isPrivileged(role)) return;
    if (
      role === UserRole.ATTENDANT &&
      order.attendant?.userId === currentUserId
    ) {
      return;
    }
    throw new ForbiddenException('当前角色无权生成服务完成记录单');
  }

  private async assertServiceTargetAccess(
    serviceTargetId: number,
    currentUserId: number,
    role: string,
  ) {
    if (this.isPrivileged(role)) return;
    const target = await this.serviceTargetRepository.findOne({
      where: { id: serviceTargetId },
    });
    if (!target) throw new NotFoundException('服务对象不存在');
    if (target.userId !== currentUserId) {
      throw new ForbiddenException('无权访问该服务对象文档');
    }
  }

  async uploadFile(
    orderId: number,
    type: DocumentType,
    file: {
      filename: string;
      path?: string;
      buffer?: Buffer;
      originalName?: string;
      mimeType?: string;
    },
    currentUserId: number,
    role: string,
  ) {
    await this.assertOrderAccess(orderId, currentUserId, role);
    const uploaded = await this.storeIncomingFile(
      file,
      `documents/${file.filename}`,
    );
    const saved = await this.documentRepository.save(
      this.documentRepository.create({
        orderId,
        type,
        url: uploaded.url,
        fileName: file.originalName || file.filename,
      }),
    );
    return this.serializeDocument(saved);
  }

  async uploadRawFile(file: {
    filename: string;
    originalName?: string;
    path?: string;
    buffer?: Buffer;
    mimeType?: string;
  }) {
    const uploaded = await this.storeIncomingFile(
      file,
      `raw/${file.filename}`,
    );
    return {
      url: uploaded.url,
      fileName: file.originalName || file.filename,
    };
  }

  async upload(
    orderId: number,
    type: DocumentType,
    url: string,
    fileName: string,
  ) {
    return this.documentRepository.save(
      this.documentRepository.create({ orderId, type, url, fileName }),
    );
  }

  async findAll(query: { type?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));

    const applyTypeFilter = (qb: ReturnType<typeof this.documentRepository.createQueryBuilder>) => {
      if (query.type) {
        qb.where('doc.type = :type', { type: query.type });
      } else {
        qb.where('doc.type != :healthProfile', {
          healthProfile: DocumentType.HEALTH_PROFILE,
        });
      }
    };

    const countQb = this.documentRepository
      .createQueryBuilder('doc')
      .leftJoin('doc.order', 'order');
    applyTypeFilter(countQb);
    const total = await countQb.getCount();

    const listQb = this.documentRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.order', 'order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.attendant', 'attendant');
    applyTypeFilter(listQb);
    listQb.orderBy('doc.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const items = await listQb.getMany();

    return {
      items: await Promise.all(items.map((item) => this.serializeDocument(item))),
      total,
      page,
      pageSize,
    };
  }

  async findByOrder(orderId: number, currentUserId: number, role: string) {
    await this.assertOrderAccess(orderId, currentUserId, role);
    const docs = await this.documentRepository.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    return Promise.all(docs.map((doc) => this.serializeDocument(doc)));
  }

  async findByCustomer(userId: number) {
    const docs = await this.documentRepository
      .createQueryBuilder('doc')
      .leftJoinAndSelect('doc.order', 'order')
      .leftJoinAndSelect('order.serviceTarget', 'serviceTarget')
      .leftJoinAndSelect('order.attendant', 'attendant')
      .where('order.userId = :userId', { userId })
      .andWhere('doc.type != :healthProfile', {
        healthProfile: DocumentType.HEALTH_PROFILE,
      })
      .orderBy('doc.createdAt', 'DESC')
      .getMany();
    return Promise.all(docs.map((doc) => this.serializeDocument(doc)));
  }

  async findOne(id: number, currentUserId: number, role: string) {
    const doc = await this.documentRepository.findOne({
      where: { id },
      relations: ['order'],
    });
    if (!doc) throw new NotFoundException('文档不存在');
    if (doc.orderId) {
      await this.assertOrderAccess(doc.orderId, currentUserId, role);
    } else if (doc.serviceTargetId) {
      await this.assertServiceTargetAccess(
        doc.serviceTargetId,
        currentUserId,
        role,
      );
    }
    return this.serializeDocument(doc);
  }

  async deleteDocument(id: number, currentUserId: number, role: string) {
    const doc = await this.documentRepository.findOne({
      where: { id },
      relations: ['order'],
    });
    if (!doc) throw new NotFoundException('文档不存在');
    if (doc.orderId) {
      await this.assertOrderAccess(doc.orderId, currentUserId, role);
    } else if (doc.serviceTargetId) {
      await this.assertServiceTargetAccess(doc.serviceTargetId, currentUserId, role);
    }
    await this.documentRepository.remove(doc);
    return { success: true };
  }

  // ========== 健康信息小档案 ==========
  async generateHealthProfile(
    serviceTargetId: number,
    currentUserId: number,
    role: string,
    formData?: any,
  ) {
    await this.assertServiceTargetAccess(serviceTargetId, currentUserId, role);
    const target = (await this.orderRepository.manager.findOne(
      'ServiceTarget',
      {
        where: { id: serviceTargetId },
      },
    )) as any;
    if (!target) throw new NotFoundException('服务对象不存在');

    let hp: Record<string, any> = {};
    if (typeof target.healthProfile === 'string') {
      try {
        hp = JSON.parse(target.healthProfile || '{}');
      } catch {
        hp = {};
      }
    } else if (target.healthProfile && typeof target.healthProfile === 'object') {
      hp = target.healthProfile as Record<string, any>;
    }
    const merged = { ...hp, ...formData };

    const archiveNo = await this.nextHealthProfileSeq();
    const userId = target.userId as number;
    const objectKey = this.buildHealthProfileObjectKey(userId, serviceTargetId);
    const systemLogoConfig = await this.systemConfigRepository.findOne({
      where: { key: 'store_logo' },
    });
    const baseUrl = formData?.baseUrl || '';
    const logoUrl = await this.storageService.resolveUrl(
      merged.logoUrl || formData?.logoUrl || systemLogoConfig?.value,
    );
    const signUrl = await this.storageService.resolveUrl(
      merged.signatureUrl || merged.signUrl || target.signatureUrl,
    );
    const isSigned = !!signUrl;

    const htmlWithAssets = generateHealthProfileHtml({
      ...formData,
      name: target.name,
      gender: target.gender,
      age: target.age,
      idCard: target.idCard,
      phone: target.phone,
      emergencyContact: target.emergencyContact,
      emergencyPhone: target.emergencyPhone,
      mainAppeal: target.mainAppeal,
      medicalHistory: merged.medicalHistory || [],
      medicalHistoryOther: merged.medicalHistoryOther,
      mobilityStatus: merged.mobilityStatus,
      currentMedication: merged.currentMedication,
      allergies: merged.allergies,
      visionStatus: merged.visionStatus,
      hearingStatus: merged.hearingStatus,
      recentSymptoms: merged.recentSymptoms || [],
      otherHealthInfo: merged.otherHealthInfo,
      fillMethod: merged.fillMethod || 'self',
      relation: merged.emergencyRelation || merged.relation,
      signedBy: isSigned ? merged.signatureName || target.name : undefined,
      signDate: isSigned ? merged.signedAt : undefined,
      signUrl,
      bloodType: merged.bloodType,
      baseUrl,
      logoUrl,
      maskSensitive: false,
    });

    const url = await this.saveHtml(objectKey, htmlWithAssets);

    // 入库记录，便于按用户/服务对象查询历史档案
    const existing = await this.documentRepository.findOne({
      where: { serviceTargetId, type: DocumentType.HEALTH_PROFILE },
    });
    if (existing) {
      existing.url = url;
      existing.fileName = `健康信息小档案_${target.name}.html`;
      existing.archiveNo = archiveNo;
      await this.documentRepository.save(existing);
    } else {
      await this.documentRepository.save(
        this.documentRepository.create({
          orderId: null,
          serviceTargetId,
          userId,
          archiveNo,
          type: DocumentType.HEALTH_PROFILE,
          url,
          fileName: `健康信息小档案_${target.name}.html`,
        }),
      );
    }

    return {
      url: this.withVersionQuery(
        await this.storageService.resolveUrl(url),
        archiveNo,
      ),
      fileName: `健康信息小档案_${target.name}.html`,
      archiveNo,
    };
  }

  // ========== 老人托管服务委托书 ==========
  /**
   * 生成「老人托管服务委托书」HTML 文档并上传到对象存储，返回访问 URL。
   *
   * 典型调用方：FamilyService#signElderTrust（子女签署委托协议后落地）。
   * 调用方负责维护 service_targets.trust_doc_url / is_trust / trust_signed_at 等状态。
   */
  async generateElderTrustDocument(params: {
    serviceTargetId: number;
    customerName: string;
    customerIdCard?: string;
    customerPhone?: string;
    signerName: string;
    signerRelation?: string;
    signerPhone?: string;
    signerIdCard?: string;
    signatureUrl?: string;
    signedAt?: Date;
  }): Promise<string> {
    const resolvedSignatureUrl = params.signatureUrl
      ? await this.storageService.resolveUrl(params.signatureUrl)
      : undefined;

    const html = generateElderTrustHtml({
      customerName: params.customerName,
      customerIdCard: params.customerIdCard,
      customerPhone: params.customerPhone,
      signerName: params.signerName,
      signerRelation: params.signerRelation,
      signerPhone: params.signerPhone,
      signerIdCard: params.signerIdCard,
      signatureUrl: resolvedSignatureUrl,
      signedAt: params.signedAt,
    });

    const objectKey = `generated/elder_trust_${params.serviceTargetId}.html`;
    const url = await this.saveHtml(objectKey, html);
    return await this.storageService.resolveUrl(url);
  }

  private buildServiceConfirmPreviewToken(orderId: number, ownerUserId: number) {
    return this.jwtService.sign(
      {
        type: 'service_confirm_preview',
        orderId,
        userId: ownerUserId,
      },
      { expiresIn: '30m' },
    );
  }

  private verifyServiceConfirmPreviewToken(orderId: number, token?: string) {
    if (!token) {
      throw new UnauthorizedException('预览令牌缺失');
    }
    const payload = this.jwtService.verify<{
      type?: string;
      orderId?: number;
      userId?: number;
    }>(token);
    if (
      payload.type !== 'service_confirm_preview' ||
      payload.orderId !== orderId ||
      !payload.userId
    ) {
      throw new UnauthorizedException('预览令牌无效或已过期');
    }
    return payload;
  }

  private async composeServiceConfirmHtml(order: Order): Promise<string> {
    const t = order.serviceTarget;
    const a = order.attendant;
    const hpRaw = t?.healthProfile;
    const hp =
      hpRaw && typeof hpRaw === 'object' && !Array.isArray(hpRaw)
        ? (hpRaw as Record<string, unknown>)
        : {};
    const emergencyRelation = String(hp.emergencyRelation || hp.relation || '—').trim() || '—';
    const customerAddress = String(
      order.serviceAddress || hp.address || hp.residence || '',
    ).trim();

    const { transport, accommodation } = this.deriveTransportAccommodation(order);
    const baseNum = Number(order.baseFee || 0);

    const systemLogoConfig = await this.systemConfigRepository.findOne({
      where: { key: 'store_logo' },
    });
    const logoUrl = await this.storageService.resolveUrl(systemLogoConfig?.value);

    const custSignRaw = order.serviceConfirmSignatureUrl;
    const customerSignUrl = custSignRaw
      ? await this.storageService.resolveUrl(custSignRaw)
      : undefined;

    // 进阶签署开关（系统配置 system_config）
    // - advanced_sign_family_authorization: 代签场景插入"家属远程授权书"
    // - advanced_sign_risk_disclosure: 所有确认单插入"风险强制告知书"
    const [familyAuthCfg, riskCfg] = await Promise.all([
      this.systemConfigRepository.findOne({
        where: { key: 'advanced_sign_family_authorization' },
      }),
      this.systemConfigRepository.findOne({
        where: { key: 'advanced_sign_risk_disclosure' },
      }),
    ]);
    const enableFamilyAuthorization =
      String(familyAuthCfg?.value || '').toLowerCase() === 'true';
    const enableRiskDisclosure =
      String(riskCfg?.value || '').toLowerCase() === 'true';

    return generateServiceConfirmHtml({
      orderNumber: order.orderNumber,
      customerName: t?.name || order.user?.nickname || '—',
      customerGender: t?.gender,
      customerIdCard: t?.idCard,
      customerPhone: t?.phone || order.user?.phone,
      customerAddress: customerAddress || '—',
      emergencyContact: t?.emergencyContact,
      emergencyRelation,
      emergencyPhone: t?.emergencyPhone,
      attendantName:
        a?.realName || (order.needAttendant === false ? '不需要陪诊员' : '待分配'),
      attendantId: a?.employeeId,
      attendantPhone: a?.phone,
      hospital: order.hospital || order.hospitalDirectory?.name,
      department: order.department,
      serviceDate: order.serviceTime as any,
      ...this.formatConfirmScheduleWindow(order.serviceTime, order.serviceEndTime),
      serviceType: order.serviceType,
      feeType: order.attendantFeeType || '本地陪诊',
      baseFee: order.baseFee,
      transportFee: transport,
      accommodationFee: accommodation,
      totalFee: order.totalFee != null ? order.totalFee : baseNum + transport + accommodation,
      payMethod: this.mapOrderPaymentForConfirm(order.paymentMethod),
      logoUrl: logoUrl || undefined,
      baseUrl: '',
      customerSignUrl: customerSignUrl || undefined,
      customerSignedBy: order.serviceConfirmSignerName || t?.name || undefined,
      customerSignerRelation: order.serviceConfirmSignerRelation || undefined,
      customerSignDate: order.serviceConfirmSignedAt || undefined,
      enableFamilyAuthorization,
      enableRiskDisclosure,
    });
  }

  /** 管理端内嵌预览：鉴权后输出 HTML（避免直链 /uploads 或 COS 触发下载 / 无法嵌套 iframe） */
  async getAdminServiceConfirmHtml(orderId: number, userId: number, role: string) {
    if (!this.isPrivileged(role)) {
      throw new ForbiddenException('无权预览确认单');
    }
    await this.assertOrderAccess(orderId, userId, role);
    const order = await this.getOrderOrThrow(orderId);
    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException('已取消订单不能预览确认单');
    }
    if (order.serviceType !== '陪诊服务') {
      throw new BadRequestException('非陪诊服务订单');
    }
    const html = await this.composeServiceConfirmHtml(order);
    return {
      body: html,
      contentType: 'text/html; charset=utf-8',
      fileName: `陪诊服务确认单_${order.orderNumber}.html`,
    };
  }

  async persistServiceConfirm(orderId: number) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException('已取消订单不能生成确认单');
    }
    const html = await this.composeServiceConfirmHtml(order);
    const fileName = `service_confirm_${order.orderNumber}.html`;
    const url = await this.saveHtml(fileName, html);
    const saved = await this.saveOrUpdateDoc(
      orderId,
      DocumentType.DISPATCH_CONFIRMATION,
      url,
      `陪诊服务确认单_${order.orderNumber}.html`,
    );
    return this.serializeDocument(saved);
  }

  async getServiceConfirmPreview(orderId: number, token?: string) {
    const { userId } = this.verifyServiceConfirmPreviewToken(orderId, token);
    const order = await this.getOrderOrThrow(orderId);
    if (order.userId !== userId) {
      throw new ForbiddenException('无权预览该确认单');
    }
    if (order.serviceType !== '陪诊服务') {
      throw new BadRequestException('非陪诊服务订单');
    }
    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException('订单已取消');
    }
    const html = await this.composeServiceConfirmHtml(order);
    return {
      body: html,
      contentType: 'text/html; charset=utf-8',
      fileName: `陪诊服务确认单_${order.orderNumber}.html`,
    };
  }

  async getServiceConfirmStatusForOrder(
    orderId: number,
    currentUserId: number,
    role: string,
  ) {
    await this.assertOrderAccess(orderId, currentUserId, role);
    const order = await this.getOrderOrThrow(orderId);
    const isEscort = order.serviceType === '陪诊服务';
    const canceled = order.status === OrderStatus.CANCELED;
    const applicable = isEscort && !canceled;
    const signed = !!(
      order.serviceConfirmSignedAt && order.serviceConfirmSignatureUrl
    );
    const isOrderOwner = order.userId === currentUserId;
    let previewPath: string | null = null;
    if (applicable && isOrderOwner) {
      const token = this.buildServiceConfirmPreviewToken(orderId, order.userId);
      const v = String(new Date(order.updatedAt).getTime());
      previewPath = this.withVersionQuery(
        `/orders/${orderId}/service-confirm-preview?token=${encodeURIComponent(token)}`,
        v,
      );
    }
    const signerRelationRaw = (order.serviceConfirmSignerRelation || '').trim();
    return {
      applicable,
      isEscort,
      needsSign: applicable && !signed,
      signed,
      signedAt: order.serviceConfirmSignedAt,
      signerName: order.serviceConfirmSignerName,
      signerRelation: signerRelationRaw,
      isProxySign: !!signerRelationRaw && signerRelationRaw !== '本人',
      previewPath,
      subjectName: order.serviceTarget?.name || '',
      orderNumber: order.orderNumber,
    };
  }

  async signServiceConfirmByCustomer(
    orderId: number,
    currentUserId: number,
    role: string,
    body: {
      signatureUrl: string;
      signerName?: string;
      signerRelation?: string;
    },
  ) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.userId !== currentUserId) {
      throw new ForbiddenException('仅下单用户可签署陪诊服务确认单');
    }
    if (this.isPrivileged(role)) {
      throw new ForbiddenException('请使用微信客户端账号完成签署');
    }
    if (order.serviceType !== '陪诊服务') {
      throw new BadRequestException('当前订单无需签署陪诊确认单');
    }
    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException('订单已取消');
    }
    const url = this.ensureValidSignatureUrl(body.signatureUrl);
    const name = (body.signerName || order.serviceTarget?.name || '').trim();
    const relation = (body.signerRelation || '').trim();
    order.serviceConfirmSignatureUrl = url;
    order.serviceConfirmSignedAt = new Date();
    order.serviceConfirmSignerName = name || null;
    order.serviceConfirmSignerRelation = relation || null;
    await this.orderRepository.save(order);

    await this.writeServiceConfirmAudit({
      actorType: 'user',
      actorId: currentUserId,
      actorRole: role || 'user',
      orderId: order.id,
      orderNumber: order.orderNumber,
      signerName: name,
      signerRelation: relation,
    });

    return this.persistServiceConfirm(orderId);
  }

  /**
   * 公开版：凭 orderId 读取确认单状态（不做用户权限校验，调用方需先验证 sceneCode）。
   * 同时返回订单详情和账单，让无登录态扫码页能完整展示服务内容
   */
  async getServiceConfirmStatusPublic(orderId: number) {
    const order = await this.getOrderOrThrow(orderId);
    const isEscort = order.serviceType === '陪诊服务';
    const canceled = order.status === OrderStatus.CANCELED;
    const applicable = isEscort && !canceled;
    const signed = !!(
      order.serviceConfirmSignedAt && order.serviceConfirmSignatureUrl
    );

    const target = order.serviceTarget;
    let healthProfile: Record<string, any> = {};
    if (target?.healthProfile) {
      try {
        healthProfile =
          typeof target.healthProfile === 'string'
            ? JSON.parse(target.healthProfile)
            : (target.healthProfile as any);
      } catch {
        healthProfile = {};
      }
    }

    const attendant = order.attendant as any;
    const orderDetail = {
      id: order.id,
      orderNumber: order.orderNumber,
      serviceType: order.serviceType,
      serviceTime: order.serviceTime,
      hospital: order.hospital,
      department: order.department,
      hospitalDirectory: order.hospitalDirectory
        ? { id: order.hospitalDirectory.id, name: order.hospitalDirectory.name }
        : null,
      status: order.status,
      attendantFeeType: order.attendantFeeType,
      needAttendant: order.needAttendant,
      callbackContactPhone: order.callbackContactPhone || '',
      notes: order.notes || '',
      remark: order.notes || '',
      baseFee: order.baseFee,
      additionalServiceItems: order.additionalServiceItems || [],
      totalFee: order.totalFee,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      settlementStatus: order.settlementStatus,
      attendant: attendant
        ? {
            id: attendant.id,
            name: attendant.realName || attendant.name || '',
            realName: attendant.realName || '',
            phone: attendant.phone || '',
          }
        : null,
      serviceTarget: target
        ? {
            id: target.id,
            name: target.name || '',
            gender: target.gender || '',
            age: target.age,
            phone: target.phone || '',
            idCard: target.idCard || '',
            homeAddress: (target as any).homeAddress || '',
            emergencyContact: target.emergencyContact || '',
            emergencyPhone: target.emergencyPhone || '',
            mainAppeal: target.mainAppeal || '',
            healthProfile: {
              emergencyRelation: healthProfile.emergencyRelation || '',
            },
          }
        : null,
    };

    const signerRelationRaw = (order.serviceConfirmSignerRelation || '').trim();
    return {
      applicable,
      needsSign: applicable && !signed,
      signed,
      signedAt: order.serviceConfirmSignedAt,
      signerName: order.serviceConfirmSignerName,
      signerRelation: signerRelationRaw,
      isProxySign: !!signerRelationRaw && signerRelationRaw !== '本人',
      subjectName: order.serviceTarget?.name || '',
      orderNumber: order.orderNumber,
      orderDetail,
    };
  }

  /**
   * 公开版：签署确认单（不做用户权限校验，调用方需先验证 sceneCode）。
   */
  async signServiceConfirmPublic(
    orderId: number,
    body: {
      signatureUrl: string;
      signerName?: string;
      signerRelation?: string;
    },
  ) {
    const order = await this.getOrderOrThrow(orderId);
    if (order.serviceType !== '陪诊服务') {
      throw new BadRequestException('当前订单无需签署陪诊确认单');
    }
    if (order.status === OrderStatus.CANCELED) {
      throw new BadRequestException('订单已取消');
    }
    if (order.serviceConfirmSignedAt) {
      throw new BadRequestException('该确认单已签署');
    }
    const url = this.ensureValidSignatureUrl(body.signatureUrl);
    const name = (body.signerName || order.serviceTarget?.name || '').trim();
    const relation = (body.signerRelation || '').trim();
    order.serviceConfirmSignatureUrl = url;
    order.serviceConfirmSignedAt = new Date();
    order.serviceConfirmSignerName = name || null;
    order.serviceConfirmSignerRelation = relation || null;
    await this.orderRepository.save(order);

    await this.writeServiceConfirmAudit({
      actorType: 'public',
      actorId: null,
      actorRole: 'scene_code',
      orderId: order.id,
      orderNumber: order.orderNumber,
      signerName: name,
      signerRelation: relation,
    });

    return this.persistServiceConfirm(orderId);
  }

  /**
   * 记录服务确认单签署审计日志，包括本次强制签署的文书清单与进阶开关状态。
   * 主流程不应因审计写入失败而中断，因此全部 try/catch。
   */
  private async writeServiceConfirmAudit(input: {
    actorType: string;
    actorId: number | null;
    actorRole: string;
    orderId: number;
    orderNumber?: string | null;
    signerName?: string | null;
    signerRelation?: string | null;
  }): Promise<void> {
    try {
      const [familyAuthCfg, riskCfg] = await Promise.all([
        this.systemConfigRepository.findOne({
          where: { key: 'advanced_sign_family_authorization' },
        }),
        this.systemConfigRepository.findOne({
          where: { key: 'advanced_sign_risk_disclosure' },
        }),
      ]);
      const enabledFamilyAuth =
        String(familyAuthCfg?.value || '').toLowerCase() === 'true';
      const enabledRiskDisc =
        String(riskCfg?.value || '').toLowerCase() === 'true';
      const rel = (input.signerRelation || '').trim();
      const isProxySign = !!rel && rel !== '本人';
      const docs: string[] = ['service_confirm', 'service_confirm_terms'];
      if (enabledRiskDisc) docs.push('risk_disclosure');
      if (enabledFamilyAuth && isProxySign) docs.push('family_authorization');

      await this.auditLogService.create({
        actorType: input.actorType,
        actorId: input.actorId,
        actorName: input.signerName || null,
        actorRole: input.actorRole,
        action: 'order.service_confirm.sign',
        resourceType: 'order',
        resourceId: String(input.orderId),
        requestSummary: this.auditLogService.serializeSummary({
          orderNumber: input.orderNumber || null,
          signerName: input.signerName || null,
          signerRelation: rel || null,
          isProxySign,
          signedDocs: docs,
          advancedFlags: {
            family_authorization: enabledFamilyAuth,
            risk_disclosure: enabledRiskDisc,
          },
        }),
        remark: `签署陪诊服务确认单（含 ${docs.length} 份文书）`,
      });
    } catch {
      // 审计日志写入失败不影响主业务流程
    }
  }

  // ========== 陪诊服务确认单 ==========
  async generateServiceConfirm(
    orderId: number,
    _currentUserId: number,
    role: string,
  ) {
    this.assertPrivilegedDocRole(role);
    return this.persistServiceConfirm(orderId);
  }

  private formatTimeHm(d: Date): string {
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return '—';
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  }

  /** 确认单「起止时间」：同日用 HH:mm；跨日带月/日避免误解 */
  private formatConfirmScheduleWindow(
    startAt?: Date | string | null,
    endAt?: Date | string | null,
  ): { serviceTimeStart?: string; serviceTimeEnd?: string } {
    const s = startAt ? new Date(startAt as any) : null;
    const e = endAt ? new Date(endAt as any) : null;
    if (!s || Number.isNaN(s.getTime())) {
      return {
        serviceTimeEnd:
          e && !Number.isNaN(e.getTime()) ? this.formatConfirmMdHm(e) : undefined,
      };
    }
    if (!e || Number.isNaN(e.getTime())) {
      return { serviceTimeStart: this.formatTimeHm(s) };
    }
    if (s.toDateString() === e.toDateString()) {
      return { serviceTimeStart: this.formatTimeHm(s), serviceTimeEnd: this.formatTimeHm(e) };
    }
    return { serviceTimeStart: this.formatConfirmMdHm(s), serviceTimeEnd: this.formatConfirmMdHm(e) };
  }

  private formatConfirmMdHm(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${m}/${day} ${this.formatTimeHm(d)}`;
  }

  private mapOrderPaymentForConfirm(pm: PaymentMethod | null | undefined): string {
    if (!pm) return '';
    switch (pm) {
      case PaymentMethod.WECHAT:
      case PaymentMethod.QR_TRANSFER:
        return 'wechat';
      case PaymentMethod.ALIPAY:
        return 'alipay';
      case PaymentMethod.CASH:
        return 'cash';
      case PaymentMethod.BANK_TRANSFER:
        return 'bank_transfer';
      default:
        return 'other';
    }
  }

  private deriveTransportAccommodation(order: Order): { transport: number; accommodation: number } {
    let transport = 0;
    let accommodation = 0;
    for (const r of order.financeRecords || []) {
      const amt = Number(r.amount || 0);
      if (r.type === FinanceRecordType.TRANSPORT) transport += amt;
      if (r.type === FinanceRecordType.ACCOMMODATION) accommodation += amt;
    }
    for (const item of order.additionalServiceItems || []) {
      const row = item as { name?: string; selection?: string; customName?: string; amount?: number };
      const name = String(row.name || row.selection || row.customName || '');
      const amt = Number(row.amount || 0);
      if (/交通|车费|高铁|动车|机票|出行/i.test(name)) transport += amt;
      else if (/住宿|酒店|过夜|房费/i.test(name)) accommodation += amt;
    }
    return { transport, accommodation };
  }

  // ========== 服务完成记录单 ==========
  async generateServiceComplete(
    orderId: number,
    currentUserId: number,
    role: string,
    formData?: any,
  ) {
    const order = await this.getOrderOrThrow(orderId);
    this.assertCompletionRole(order, currentUserId, role);
    if (
      ![
        OrderStatus.PENDING_REVIEW,
        OrderStatus.COMPLETED,
        OrderStatus.EMERGENCY,
      ].includes(order.status)
    ) {
      throw new BadRequestException('当前订单状态不支持生成服务完成记录单');
    }

    const t = order.serviceTarget;
    const a = order.attendant;
    const reviews = order.reviews || [];
    const latestReview = reviews[0];

    const timelines = (order.timelines || [])
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map((tl: any) => ({
        time: new Date(tl.createdAt).toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        content: tl.content || '',
      }));

    let clientRating: string | undefined;
    if (latestReview) {
      const r = latestReview.rating;
      if (r >= 5) clientRating = 'very_satisfied';
      else if (r >= 4) clientRating = 'satisfied';
      else if (r >= 3) clientRating = 'fair';
      else clientRating = 'unsatisfied';
    }

    const html = generateServiceCompleteHtml({
      orderNumber: order.orderNumber,
      attendantName: a?.realName,
      attendantId: a?.employeeId,
      serviceDate: order.serviceTime as any,
      customerName: t?.name || order.user?.nickname,
      hospital: order.hospital,
      department: order.department,
      serviceType: order.serviceType,
      ...this.formatConfirmScheduleWindow(order.serviceTime, order.serviceEndTime),
      timelines,
      clientRating,
      clientFeedback: latestReview?.comment,
      ...formData,
    });

    const fileName = `service_complete_${order.orderNumber}.html`;
    const url = await this.saveHtml(fileName, html);
    const saved = await this.saveOrUpdateDoc(
      orderId,
      DocumentType.SERVICE_COMPLETION,
      url,
      `服务完成记录单_${order.orderNumber}.html`,
    );
    return this.serializeDocument(saved);
  }

  // ========== 服务报告单（保留原有功能升级版） ==========
  async generateServiceReport(
    orderId: number,
    currentUserId: number,
    role: string,
  ) {
    this.assertPrivilegedDocRole(role);
    const order = await this.getOrderOrThrow(orderId);
    if (
      ![
        OrderStatus.PENDING_REVIEW,
        OrderStatus.COMPLETED,
        OrderStatus.EMERGENCY,
      ].includes(order.status)
    ) {
      throw new BadRequestException('服务未完成，不能生成服务报告单');
    }

    const t = order.serviceTarget;
    const a = order.attendant;
    const timelineHtml = (order.timelines || [])
      .filter((tl: any) => tl.visibleToUser)
      .sort(
        (a: any, b: any) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map(
        (tl: any) =>
          `<tr><td style="width:100px">${new Date(tl.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</td><td>${tl.content || ''}</td></tr>`,
      )
      .join('');

    const now = new Date();
    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>陪诊服务报告单 - ${order.orderNumber}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;padding:40px;color:#333;max-width:800px;margin:0 auto;font-size:14px}.header{text-align:center;border-bottom:3px solid #2B9F7C;padding-bottom:16px;margin-bottom:24px}.header .logo{font-size:28px;font-weight:bold;color:#2B9F7C}.header h1{font-size:22px;margin:8px 0}.badge{display:inline-block;background:#2B9F7C;color:#fff;padding:4px 16px;border-radius:20px;font-size:13px}.section{margin-bottom:20px}.section h2{font-size:15px;color:#2B9F7C;border-left:4px solid #2B9F7C;padding-left:10px;margin-bottom:12px}table{width:100%;border-collapse:collapse}td{padding:8px 12px;border:1px solid #d0d0d0;font-size:13px}td.label{background:#f5f9f7;font-weight:600;width:130px;color:#555}.footer{text-align:center;margin-top:40px;font-size:12px;color:#bbb;border-top:1px solid #e0e0e0;padding-top:16px}.print-btn{display:block;margin:30px auto;padding:10px 36px;background:#2B9F7C;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer}@media print{.print-btn{display:none!important}body{padding:20px}@page{margin:1.2cm}}</style></head><body>
<div class="header"><div class="logo">陪了个伴</div><h1>陪诊服务报告单</h1><div class="badge">${order.status === 'completed' ? '已完成' : order.status}</div><p style="color:#999;font-size:13px;margin-top:8px">报告编号：SR-${order.orderNumber} | ${now.toLocaleDateString('zh-CN')}</p></div>
<div class="section"><h2>服务概况</h2><table><tr><td class="label">服务对象</td><td>${t?.name || '—'}（${t?.gender === 'male' ? '男' : '女'}，${t?.age || '—'}岁）</td><td class="label">服务日期</td><td>${order.serviceTime ? new Date(order.serviceTime).toLocaleDateString('zh-CN') : '—'}</td></tr><tr><td class="label">就诊医院</td><td>${order.hospital || '—'}</td><td class="label">科室</td><td>${order.department || '—'}</td></tr><tr><td class="label">陪诊员</td><td>${a?.realName || '—'}</td><td class="label">服务类型</td><td>${order.serviceType || '—'}</td></tr></table></div>
<div class="section"><h2>服务过程记录</h2>${timelineHtml ? `<table><tr><th style="width:100px;background:#f5f9f7">时间</th><th style="background:#f5f9f7">内容</th></tr>${timelineHtml}</table>` : '<p style="color:#999">暂无服务记录</p>'}</div>
<div class="section"><h2>费用明细</h2><table><tr><td class="label">基础服务费</td><td>¥${order.baseFee || 0}</td></tr><tr><td class="label" style="font-weight:bold">合计</td><td style="font-weight:bold;color:#2B9F7C;font-size:16px">¥${order.totalFee || 0}</td></tr></table></div>
<button class="print-btn" onclick="window.print()">🖨️ 打印报告</button>
<div class="footer"><p>青田陪了个伴管理有限公司 | 生成时间：${now.toLocaleString('zh-CN')}</p></div></body></html>`;

    const fileName = `service_report_${order.orderNumber}.html`;
    const url = await this.saveHtml(fileName, html);
    const saved = await this.saveOrUpdateDoc(
      orderId,
      DocumentType.SERVICE_REPORT,
      url,
      `陪诊服务报告单_${order.orderNumber}.html`,
    );
    return this.serializeDocument(saved);
  }
}
