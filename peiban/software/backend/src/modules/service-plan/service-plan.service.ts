import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ServicePlanTemplate,
  ServicePlanKind,
} from '../../entities/service-plan-template.entity.js';
import { OrderServicePlan } from '../../entities/order-service-plan.entity.js';
import { Order } from '../../entities/order.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { UserRole } from '../../common/enums/index.js';
import {
  SaveTemplateDto,
  AttachPlanToOrderDto,
} from './dto/save-template.dto.js';

@Injectable()
export class ServicePlanService {
  constructor(
    @InjectRepository(ServicePlanTemplate)
    private readonly templateRepo: Repository<ServicePlanTemplate>,
    @InjectRepository(OrderServicePlan)
    private readonly orderPlanRepo: Repository<OrderServicePlan>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Attendant)
    private readonly attendantRepo: Repository<Attendant>,
  ) {}

  // ─── 模板 CRUD ───

  async listTemplates(query: {
    kind?: ServicePlanKind;
    authorUserId?: number;
    includePublic?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const qb = this.templateRepo.createQueryBuilder('t');
    if (query.kind) qb.andWhere('t.kind = :kind', { kind: query.kind });
    if (query.authorUserId) {
      // 同时包含当前作者自己的 + 公共模板
      if (query.includePublic) {
        qb.andWhere('(t.authorUserId = :uid OR t.isPublic = true)', {
          uid: query.authorUserId,
        });
      } else {
        qb.andWhere('t.authorUserId = :uid', { uid: query.authorUserId });
      }
    } else if (query.includePublic) {
      qb.andWhere('t.isPublic = true');
    }
    qb.orderBy('t.updatedAt', 'DESC');
    const [items, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getTemplate(
    id: number,
    actor?: { id: number; role: string },
  ): Promise<ServicePlanTemplate> {
    const t = await this.templateRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('模板不存在');
    // 公开模板任何登录用户可读；非公开模板只有作者和管理员可读
    if (!t.isPublic && actor) {
      if (!this.isAdminLike(actor.role) && t.authorUserId !== actor.id) {
        throw new ForbiddenException('无权访问该模板');
      }
    }
    return t;
  }

  async createTemplate(
    dto: SaveTemplateDto,
    actor: { id: number; role: string },
  ): Promise<ServicePlanTemplate> {
    const canMarkPublic = this.isAdminLike(actor.role);
    const entity = this.templateRepo.create({
      kind: dto.kind,
      authorUserId: actor.id,
      title: dto.title.trim(),
      coverImage: dto.coverImage || null,
      targetConditions: dto.targetConditions || null,
      summary: dto.summary || null,
      content: dto.content as any,
      tags: dto.tags || null,
      isPublic: !!dto.isPublic && canMarkPublic,
    });
    return this.templateRepo.save(entity);
  }

  async updateTemplate(
    id: number,
    dto: SaveTemplateDto,
    actor: { id: number; role: string },
  ): Promise<ServicePlanTemplate> {
    const t = await this.getTemplate(id);
    if (!this.canManage(t, actor)) {
      throw new ForbiddenException('无权修改他人的模板');
    }
    const canMarkPublic = this.isAdminLike(actor.role);
    Object.assign(t, {
      kind: dto.kind ?? t.kind,
      title: dto.title?.trim() ?? t.title,
      coverImage: dto.coverImage ?? t.coverImage,
      targetConditions: dto.targetConditions ?? t.targetConditions,
      summary: dto.summary ?? t.summary,
      content: dto.content ?? t.content,
      tags: dto.tags ?? t.tags,
      isPublic:
        dto.isPublic !== undefined && canMarkPublic ? dto.isPublic : t.isPublic,
    });
    return this.templateRepo.save(t);
  }

  async removeTemplate(
    id: number,
    actor: { id: number; role: string },
  ): Promise<{ success: boolean }> {
    const t = await this.getTemplate(id);
    if (!this.canManage(t, actor)) {
      throw new ForbiddenException('无权删除他人的模板');
    }
    await this.templateRepo.remove(t);
    return { success: true };
  }

  // ─── 订单挂载 ───

  async listForOrder(orderId: number, actor: { id: number; role: string }) {
    await this.assertOrderAccess(orderId, actor);
    return this.orderPlanRepo.find({
      where: { orderId },
      relations: ['template', 'attachedByUser'],
      order: { createdAt: 'DESC' },
    });
  }

  async attachToOrder(
    orderId: number,
    dto: AttachPlanToOrderDto,
    actor: { id: number; role: string },
  ): Promise<OrderServicePlan> {
    await this.assertOrderAccess(orderId, actor);
    const entity = this.orderPlanRepo.create({
      orderId,
      kind: dto.kind,
      templateId: dto.templateId || null,
      title: dto.title.trim(),
      summary: dto.summary || null,
      content: dto.content,
      attachedByUserId: actor.id,
    });
    const saved = await this.orderPlanRepo.save(entity);
    // 模板使用次数 +1
    if (dto.templateId) {
      await this.templateRepo.increment({ id: dto.templateId }, 'useCount', 1);
    }
    return saved;
  }

  async removeFromOrder(id: number, actor: { id: number; role: string }) {
    const item = await this.orderPlanRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('方案不存在');
    if (!this.isAdminLike(actor.role) && item.attachedByUserId !== actor.id) {
      throw new ForbiddenException('无权删除他人挂载的方案');
    }
    await this.orderPlanRepo.remove(item);
    return { success: true };
  }

  private canManage(
    template: ServicePlanTemplate,
    actor: { id: number; role: string },
  ): boolean {
    if (this.isAdminLike(actor.role)) return true;
    return template.authorUserId === actor.id;
  }

  private isAdminLike(role: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.MEDICAL_CONSULTANT
    );
  }

  /**
   * 校验调用者是否有权访问指定订单的服务方案。
   * - 管理员/运营/医疗顾问/客服：始终允许
   * - 订单所属用户（order.userId）：允许
   * - 已分配的陪诊员（order.attendantId 对应的 user）：允许
   * - 其他：拒绝
   */
  private async assertOrderAccess(
    orderId: number,
    actor: { id: number; role: string },
  ): Promise<void> {
    const adminLikeRoles = ['admin', 'operator', 'medical_consultant', 'customer_service'];
    if (adminLikeRoles.includes(actor.role)) return;

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');

    // 订单所属客户
    if (order.userId === actor.id) return;

    // 已分配陪诊员（attendants.userId → users.id = actor.id）
    if (actor.role === 'attendant' && order.attendantId) {
      const attendant = await this.attendantRepo.findOne({
        where: { id: order.attendantId },
      });
      if (attendant && attendant.userId === actor.id) return;
    }

    throw new ForbiddenException('无权访问该订单的服务方案');
  }
}
