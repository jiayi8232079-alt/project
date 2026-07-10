import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, In, Repository } from 'typeorm';
import {
  Complaint,
  ComplaintCategory,
  ComplaintPriority,
  ComplaintStatus,
} from '../../entities/complaint.entity.js';
import { User } from '../../entities/user.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import { Order } from '../../entities/order.entity.js';
import { CreateComplaintDto } from './dto/create-complaint.dto.js';
import {
  UpdateComplaintDto,
  UserAppendComplaintDto,
} from './dto/update-complaint.dto.js';

const CLOSABLE_FOR_USER = new Set<ComplaintStatus>([
  ComplaintStatus.PENDING,
  ComplaintStatus.PROCESSING,
  ComplaintStatus.RESOLVED,
]);

export interface ListComplaintsQuery {
  page?: number;
  pageSize?: number;
  status?: ComplaintStatus | string;
  category?: ComplaintCategory | string;
  priority?: ComplaintPriority | string;
  userId?: number | string;
  orderId?: number | string;
  handlerId?: number | string;
  keyword?: string;
}

@Injectable()
export class ComplaintService {
  constructor(
    @InjectRepository(Complaint)
    private readonly complaintRepo: Repository<Complaint>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminRepo: Repository<AdminUser>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  private pushTimeline(
    complaint: Complaint,
    entry: NonNullable<Complaint['timeline']>[number],
  ) {
    const list = Array.isArray(complaint.timeline) ? [...complaint.timeline] : [];
    list.push(entry);
    complaint.timeline = list;
  }

  async createForUser(userId: number, dto: CreateComplaintDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('用户不存在');

    // 校验 orderId 归属：用户只能关联自己名下的订单
    if (dto.orderId != null) {
      const order = await this.orderRepo.findOne({ where: { id: dto.orderId } });
      if (!order || order.userId !== userId) {
        throw new ForbiddenException('无权关联该订单');
      }
    }

    const images = Array.isArray(dto.images)
      ? dto.images.filter((x) => typeof x === 'string' && x.length).slice(0, 9)
      : null;
    const contactPhone = (dto.contactPhone || user.phone || '').trim() || null;

    const complaint = this.complaintRepo.create({
      userId,
      orderId: dto.orderId ?? null,
      attendantId: dto.attendantId ?? null,
      category: dto.category,
      subject: dto.subject.trim(),
      description: dto.description.trim(),
      images,
      contactPhone,
      status: ComplaintStatus.PENDING,
      priority: ComplaintPriority.NORMAL,
    });
    complaint.timeline = [
      {
        at: new Date().toISOString(),
        byType: 'user',
        byId: userId,
        byName: user.nickname || user.phone || `用户#${userId}`,
        content: complaint.description,
        type: 'reply',
      },
    ];
    return this.complaintRepo.save(complaint);
  }

  async list(query: ListComplaintsQuery) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.complaintRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'u')
      .leftJoinAndSelect('c.order', 'o')
      .leftJoinAndSelect('c.attendant', 'a')
      .leftJoinAndSelect('c.handler', 'h')
      .orderBy('c.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.category) {
      qb.andWhere('c.category = :category', { category: query.category });
    }
    if (query.priority) {
      qb.andWhere('c.priority = :priority', { priority: query.priority });
    }
    if (query.userId != null && !Number.isNaN(Number(query.userId))) {
      qb.andWhere('c.userId = :userId', { userId: Number(query.userId) });
    }
    if (query.orderId != null && !Number.isNaN(Number(query.orderId))) {
      qb.andWhere('c.orderId = :orderId', { orderId: Number(query.orderId) });
    }
    if (query.handlerId != null && !Number.isNaN(Number(query.handlerId))) {
      qb.andWhere('c.handlerId = :handlerId', {
        handlerId: Number(query.handlerId),
      });
    }
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      qb.andWhere(
        '(c.subject LIKE :kw OR c.description LIKE :kw OR u.nickname LIKE :kw OR u.phone LIKE :kw)',
        { kw },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async listMine(userId: number, query: Omit<ListComplaintsQuery, 'userId'>) {
    return this.list({ ...query, userId });
  }

  async findOne(id: number) {
    const item = await this.complaintRepo.findOne({
      where: { id },
      relations: ['user', 'order', 'attendant', 'handler'],
    });
    if (!item) throw new NotFoundException('工单不存在');
    return item;
  }

  async findOneForUser(id: number, userId: number) {
    const item = await this.findOne(id);
    if (item.userId !== userId) {
      throw new ForbiddenException('无权查看该工单');
    }
    return item;
  }

  async adminUpdate(
    id: number,
    adminId: number,
    adminName: string,
    dto: UpdateComplaintDto,
  ) {
    const complaint = await this.findOne(id);

    if (dto.priority) complaint.priority = dto.priority;

    if (dto.handlerId !== undefined) {
      if (dto.handlerId == null) {
        complaint.handlerId = null;
        this.pushTimeline(complaint, {
          at: new Date().toISOString(),
          byType: 'admin',
          byId: adminId,
          byName: adminName,
          content: '取消指派',
          type: 'status',
        });
      } else {
        const admin = await this.adminRepo.findOne({
          where: { id: dto.handlerId },
        });
        if (!admin) throw new BadRequestException('指派的客服不存在');
        complaint.handlerId = admin.id;
        this.pushTimeline(complaint, {
          at: new Date().toISOString(),
          byType: 'admin',
          byId: adminId,
          byName: adminName,
          content: `指派给 ${admin.realName || admin.username}`,
          type: 'status',
        });
      }
    }

    if (dto.internalNote !== undefined) {
      complaint.internalNote = dto.internalNote || null;
    }

    if (dto.reply && dto.reply.trim()) {
      this.pushTimeline(complaint, {
        at: new Date().toISOString(),
        byType: 'admin',
        byId: adminId,
        byName: adminName,
        content: dto.reply.trim(),
        type: 'reply',
      });
      if (complaint.status === ComplaintStatus.PENDING) {
        complaint.status = ComplaintStatus.PROCESSING;
      }
    }

    if (dto.resolution !== undefined) {
      complaint.resolution = dto.resolution || null;
    }

    if (dto.status) {
      if (dto.status !== complaint.status) {
        const now = new Date();
        if (
          dto.status === ComplaintStatus.RESOLVED ||
          dto.status === ComplaintStatus.REJECTED
        ) {
          complaint.resolvedAt = now;
        }
        if (dto.status === ComplaintStatus.CLOSED) {
          complaint.closedAt = now;
        }
        this.pushTimeline(complaint, {
          at: now.toISOString(),
          byType: 'admin',
          byId: adminId,
          byName: adminName,
          content: `状态：${complaint.status} → ${dto.status}`,
          type: 'status',
        });
        complaint.status = dto.status;
      }
    }

    return this.complaintRepo.save(complaint);
  }

  async userAppend(id: number, userId: number, dto: UserAppendComplaintDto) {
    const complaint = await this.findOneForUser(id, userId);

    if (dto.content && dto.content.trim()) {
      if (
        complaint.status === ComplaintStatus.CLOSED ||
        complaint.status === ComplaintStatus.REJECTED
      ) {
        throw new BadRequestException('工单已关闭，无法追加补充');
      }
      this.pushTimeline(complaint, {
        at: new Date().toISOString(),
        byType: 'user',
        byId: userId,
        byName: null,
        content: dto.content.trim(),
        type: 'reply',
      });
      if (complaint.status === ComplaintStatus.RESOLVED) {
        complaint.status = ComplaintStatus.PROCESSING;
      }
    }

    if (dto.rating != null) {
      if (complaint.status !== ComplaintStatus.RESOLVED &&
          complaint.status !== ComplaintStatus.CLOSED) {
        throw new BadRequestException('当前状态不可评分');
      }
      if (dto.rating < 1 || dto.rating > 5) {
        throw new BadRequestException('评分必须在 1-5 之间');
      }
      complaint.userRating = dto.rating;
    }

    if (dto.close) {
      if (!CLOSABLE_FOR_USER.has(complaint.status)) {
        throw new BadRequestException('当前状态不可关闭');
      }
      complaint.status = ComplaintStatus.CLOSED;
      complaint.closedAt = new Date();
      this.pushTimeline(complaint, {
        at: new Date().toISOString(),
        byType: 'user',
        byId: userId,
        byName: null,
        content: '客户主动关闭工单',
        type: 'status',
      });
    }

    return this.complaintRepo.save(complaint);
  }

  async statsOverview() {
    const rows = await this.complaintRepo
      .createQueryBuilder('c')
      .select('c.status', 'status')
      .addSelect('COUNT(1)', 'cnt')
      .groupBy('c.status')
      .getRawMany<{ status: string; cnt: number | string }>();
    const map: Record<string, number> = {};
    rows.forEach((r) => {
      map[String(r.status)] = Number(r.cnt);
    });
    return {
      pending: map[ComplaintStatus.PENDING] || 0,
      processing: map[ComplaintStatus.PROCESSING] || 0,
      resolved: map[ComplaintStatus.RESOLVED] || 0,
      rejected: map[ComplaintStatus.REJECTED] || 0,
      closed: map[ComplaintStatus.CLOSED] || 0,
    };
  }

  /** 批量按 ID 获取（给其他模块用） */
  async findByIds(ids: number[]) {
    if (!ids.length) return [];
    return this.complaintRepo.find({ where: { id: In(ids) } });
  }

  /** 供外部过滤用：默认 where */
  whereForUser(userId: number): FindOptionsWhere<Complaint> {
    return { userId };
  }
}
