import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual, In } from 'typeorm';
import { Attendant, ServiceStaffRole } from '../../entities/attendant.entity.js';
import { Schedule } from '../../entities/schedule.entity.js';
import { User } from '../../entities/user.entity.js';
import { Order } from '../../entities/order.entity.js';
import { FinanceRecord } from '../../entities/finance-record.entity.js';
import { Review } from '../../entities/review.entity.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { SetCredentialsDto } from './dto/set-credentials.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { UserRole, OrderStatus } from '../../common/enums/index.js';
import {
  listAllRoleConfigs,
  resolveRoleConfig,
  SERVICE_STAFF_ROLE_CONFIGS,
} from './service-staff-role.config.js';
import {
  ensureOrderRiskLevelColumn,
  normalizeOrderRiskLevel,
  displayOrderRiskLabel,
} from '../order/order-risk-level.js';

@Injectable()
export class AttendantService {
  private readonly logger = new Logger(AttendantService.name);
  private riskLevelColumnReady = false;

  constructor(
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(FinanceRecord)
    private readonly financeRecordRepository: Repository<FinanceRecord>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  private async ensureRiskLevelColumnReady() {
    if (this.riskLevelColumnReady) return true;
    const ready = await ensureOrderRiskLevelColumn(this.orderRepository, this.logger);
    if (ready) {
      this.riskLevelColumnReady = true;
    }
    return ready;
  }

  async findAll(
    query: PaginationDto & {
      keyword?: string;
      status?: string;
      primaryRole?: ServiceStaffRole;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.attendantRepository
      .createQueryBuilder('attendant')
      .leftJoinAndSelect('attendant.user', 'user');

    if (query.keyword) {
      qb.where(
        '(attendant.realName LIKE :kw OR attendant.employeeId LIKE :kw OR attendant.phone LIKE :kw)',
        { kw: `%${query.keyword}%` },
      );
    }

    if (query.status) {
      qb.andWhere('attendant.status = :status', { status: query.status });
    }

    if (query.primaryRole) {
      qb.andWhere('attendant.primaryRole = :primaryRole', {
        primaryRole: query.primaryRole,
      });
    }

    qb.orderBy('attendant.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findOne(id: number) {
    const attendant = await this.attendantRepository.findOne({
      where: { id },
      relations: ['user', 'orders'],
    });
    if (!attendant) throw new NotFoundException('陪诊员不存在');
    return attendant;
  }

  async create(data: {
    realName?: string;
    employeeId?: string;
    phone?: string;
    openid?: string;
    profile?: string;
    userId?: number;
  }) {
    let user: User;
    if (data.userId) {
      // 从现有用户创建陪诊员
      const foundUser = await this.userRepository.findOne({
        where: { id: data.userId },
      });
      if (!foundUser) throw new NotFoundException('用户不存在');
      user = foundUser;
    } else {
      user = await this.resolveUserForCreation(data);
    }

    await this.ensureAttendantUserAvailable(user.id);
    if (user.role !== UserRole.ATTENDANT) {
      user.role = UserRole.ATTENDANT;
      user = await this.userRepository.save(user);
    }

    const realName = data.realName || user.nickname || user.phone || '陪诊员';
    const phone = data.phone || user.phone || '';

    const attendant = this.attendantRepository.create({
      userId: user.id,
      realName,
      employeeId: data.employeeId || undefined,
      phone,
      profile: data.profile,
      status: 'active',
      rating: 5.0,
      totalOrders: 0,
    });
    return this.attendantRepository.save(attendant);
  }

  private async ensureAttendantUserAvailable(userId: number) {
    const existing = await this.attendantRepository.findOne({
      where: { userId },
      withDeleted: true,
    });
    if (!existing) return;
    if (existing.deletedAt) {
      throw new BadRequestException('该用户的陪诊员档案在回收站中，请先恢复后再使用');
    }
    throw new BadRequestException('该用户已是陪诊员');
  }

  private async findReusableUserByPhone(phone?: string) {
    const normalizedPhone = phone?.trim();
    if (!normalizedPhone) return null;
    const matches = await this.userRepository.find({ where: { phone: normalizedPhone } });
    if (matches.length > 1) {
      throw new BadRequestException('存在多个相同手机号用户，请改用“从现有用户”创建，避免重复绑定');
    }
    return matches[0] ?? null;
  }

  private async resolveUserForCreation(data: {
    realName?: string;
    phone?: string;
    openid?: string;
  }) {
    const normalizedOpenid = data.openid?.trim();
    const normalizedPhone = data.phone?.trim();

    const foundByOpenid = normalizedOpenid
      ? await this.userRepository.findOne({ where: { openid: normalizedOpenid } })
      : null;
    const foundByPhone = await this.findReusableUserByPhone(normalizedPhone);

    if (foundByOpenid && foundByPhone && foundByOpenid.id !== foundByPhone.id) {
      if (!foundByPhone.openid) {
        foundByPhone.openid = normalizedOpenid!;
        foundByPhone.nickname = foundByPhone.nickname || data.realName || '';
        return this.userRepository.save(foundByPhone);
      }
      throw new BadRequestException('该微信已绑定其他用户，请改用“从现有用户”创建，避免重复生成账号');
    }

    if (foundByOpenid) {
      if (normalizedPhone && !foundByOpenid.phone) {
        foundByOpenid.phone = normalizedPhone;
      }
      if (data.realName && !foundByOpenid.nickname) {
        foundByOpenid.nickname = data.realName;
      }
      return this.userRepository.save(foundByOpenid);
    }

    if (foundByPhone) {
      if (normalizedOpenid && !foundByPhone.openid) {
        foundByPhone.openid = normalizedOpenid;
      }
      if (data.realName && !foundByPhone.nickname) {
        foundByPhone.nickname = data.realName;
      }
      return this.userRepository.save(foundByPhone);
    }

    return this.userRepository.save(
      this.userRepository.create({
        openid: normalizedOpenid || undefined,
        nickname: data.realName || '',
        phone: normalizedPhone || '',
        role: UserRole.ATTENDANT,
      }),
    );
  }

  /** 获取可转为陪诊员的用户列表（尚未成为陪诊员的用户） */
  async getAvailableUsers(query: PaginationDto & { keyword?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const attendants = await this.attendantRepository.find({
      select: ['userId'],
      withDeleted: true,
    });
    const attendantUserIds = attendants.map((a) => a.userId);

    const qb = this.userRepository.createQueryBuilder('user');
    if (attendantUserIds.length > 0) {
      qb.andWhere('user.id NOT IN (:...ids)', { ids: attendantUserIds });
    }
    if (query.keyword) {
      qb.andWhere('(user.nickname LIKE :kw OR user.phone LIKE :kw)', {
        kw: `%${query.keyword}%`,
      });
    }
    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async update(id: number, data: Partial<Attendant>) {
    const attendant = await this.findOne(id);
    Object.assign(attendant, data);
    return this.attendantRepository.save(attendant);
  }

  async setCredentials(id: number, dto: SetCredentialsDto) {
    const attendant = await this.findOne(id);

    if (dto.username !== undefined) {
      const existing = await this.attendantRepository.findOne({
        where: { username: dto.username },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('该账号已被使用');
      }
      attendant.username = dto.username;
    }

    if (dto.password !== undefined && dto.password !== '') {
      attendant.password = await bcrypt.hash(dto.password, 10);
    }

    await this.attendantRepository.save(attendant);

    const safe = await this.attendantRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!safe) throw new NotFoundException('陪诊员不存在');
    return this.stripSensitive(safe);
  }

  private stripSensitive<T extends Partial<Attendant>>(entity: T): T {
    if (!entity) return entity;
    const { password, orders, ...rest } = entity as any;
    return rest as T;
  }

  async deleteAttendant(id: number) {
    const attendant = await this.attendantRepository.findOne({ where: { id } });
    if (!attendant) throw new NotFoundException('陪诊员不存在');

    await this.attendantRepository.softDelete(id);
    const user = await this.userRepository.findOne({
      where: { id: attendant.userId },
      withDeleted: true,
    });
    if (user && !user.deletedAt && user.role === UserRole.ATTENDANT) {
      user.role = UserRole.USER;
      await this.userRepository.save(user);
    }
    return { message: '已移入回收站' };
  }

  /** 获取回收站列表 */
  async findTrashed(query: PaginationDto & { keyword?: string }) {
    const qb = this.attendantRepository
      .createQueryBuilder('attendant')
      .withDeleted()
      .leftJoinAndSelect('attendant.user', 'user')
      .where('attendant.deleted_at IS NOT NULL');

    if (query.keyword) {
      qb.andWhere(
        '(attendant.realName LIKE :kw OR attendant.employeeId LIKE :kw OR attendant.phone LIKE :kw)',
        { kw: `%${query.keyword}%` },
      );
    }

    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    qb.orderBy('attendant.deletedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** 从回收站恢复（同时恢复软删除的关联用户） */
  async restoreAttendant(id: number) {
    const attendant = await this.attendantRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!attendant) throw new NotFoundException('陪诊员不存在');
    if (!attendant.deletedAt) throw new BadRequestException('该陪诊员不在回收站中');

    await this.attendantRepository.restore(id);

    const user = await this.userRepository.findOne({
      where: { id: attendant.userId },
      withDeleted: true,
    });
    if (user) {
      if (user.deletedAt) {
        await this.userRepository.restore(user.id);
      }
      if (user.role !== UserRole.ATTENDANT) {
        user.role = UserRole.ATTENDANT;
        await this.userRepository.save(user);
      }
    }

    return { message: '已从回收站恢复' };
  }

  /** 彻底删除（永久，含所有关联数据） */
  async hardDeleteAttendant(id: number) {
    const attendant = await this.attendantRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!attendant) throw new NotFoundException('陪诊员不存在');

    // 解除订单关联
    await this.orderRepository.update(
      { attendantId: id },
      { attendantId: null as unknown as number },
    );
    // 解除财务记录、评价关联
    await this.financeRecordRepository.update({ attendantId: id }, { attendantId: null });
    await this.reviewRepository.update({ attendantId: id }, { attendantId: null });
    // 删除排班
    await this.scheduleRepository.delete({ attendantId: id });

    const user = await this.userRepository.findOne({
      where: { id: attendant.userId },
      withDeleted: true,
    });
    if (user && user.role === 'attendant') {
      user.role = 'user' as any;
      await this.userRepository.save(user);
    }

    await this.attendantRepository.delete(id);
    return { message: '已彻底删除，所有关联数据已清除' };
  }

  async toggleStatus(id: number, status: 'active' | 'disabled') {
    const attendant = await this.attendantRepository.findOne({ where: { id } });
    if (!attendant) throw new NotFoundException('陪诊员不存在');
    attendant.status = status;
    await this.attendantRepository.save(attendant);

    // 同步 users.role，与 deleteAttendant / restoreAttendant 保持一致：
    // 禁用时将 users.role 恢复为普通用户；启用时确保 users.role = attendant
    const user = await this.userRepository.findOne({ where: { id: attendant.userId } });
    if (user) {
      if (status === 'disabled' && user.role === UserRole.ATTENDANT) {
        user.role = UserRole.USER;
        await this.userRepository.save(user);
      } else if (status === 'active' && user.role !== UserRole.ATTENDANT) {
        user.role = UserRole.ATTENDANT;
        await this.userRepository.save(user);
      }
    }

    return attendant;
  }

  async getAvailable(date: string, period: string) {
    const schedules = await this.scheduleRepository.find({
      where: { date: new Date(date), period, status: 'available' },
      relations: ['attendant'],
    });
    return schedules.map((s) => s.attendant);
  }

  async submitSchedules(
    attendantId: number,
    schedules: CreateScheduleDto[],
    opts?: { startDate?: string; endDate?: string },
  ) {
    const start = opts?.startDate;
    const end = opts?.endDate;
    if (start && end) {
      await this.scheduleRepository.delete({
        attendantId,
        date: Between(new Date(start), new Date(end)),
      });
    }
    const entities = schedules.map((s) =>
      this.scheduleRepository.create({
        attendantId,
        date: new Date(s.date),
        period: s.period,
        status: 'available',
      }),
    );
    return this.scheduleRepository.save(entities);
  }

  async getSchedules(
    attendantId: number,
    startDate?: string,
    endDate?: string,
  ) {
    const where: any = { attendantId };
    if (startDate && endDate) {
      where.date = Between(new Date(startDate), new Date(endDate));
    }
    return this.scheduleRepository.find({
      where,
      order: { date: 'ASC' },
    });
  }

  async getAllSchedules(startDate?: string, endDate?: string) {
    const qb = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.attendant', 'attendant');

    if (startDate && endDate) {
      qb.where('schedule.date BETWEEN :start AND :end', {
        start: startDate,
        end: endDate,
      });
    }

    qb.orderBy('schedule.date', 'ASC');
    return qb.getMany();
  }

  async findByUserId(userId: number) {
    const attendant = await this.attendantRepository.findOne({
      where: { userId },
    });
    if (!attendant) throw new NotFoundException('未找到陪诊员信息');
    return attendant;
  }

  async getMyStats(userId: number) {
    const attendant = await this.findByUserId(userId);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayOrders = await this.orderRepository.count({
      where: {
        attendantId: attendant.id,
        serviceTime: Between(todayStart, todayEnd),
      },
    });

    const weekOrders = await this.orderRepository.count({
      where: {
        attendantId: attendant.id,
        serviceTime: Between(weekStart, todayEnd),
      },
    });

    const totalOrders = await this.orderRepository.count({
      where: { attendantId: attendant.id },
    });

    const pendingTasks = await this.orderRepository.count({
      where: [
        { attendantId: attendant.id, status: OrderStatus.PENDING_SERVICE },
        { attendantId: attendant.id, status: OrderStatus.PENDING_SIGN },
        { attendantId: attendant.id, status: OrderStatus.PENDING_ACCEPT },
      ],
    });

    const inProgressCount = await this.orderRepository.count({
      where: {
        attendantId: attendant.id,
        status: In([OrderStatus.IN_PROGRESS, OrderStatus.EMERGENCY]),
      },
    });

    const grabOrders = await this.orderRepository.count({
      where: { status: OrderStatus.PENDING_GRAB },
    });

    // 本周完成 = COMPLETED + PENDING_REVIEW（陪诊员角度，服务已结束即为完成）
    const weekCompleted = await this.orderRepository.count({
      where: [
        { attendantId: attendant.id, status: OrderStatus.COMPLETED, serviceTime: Between(weekStart, todayEnd) },
        { attendantId: attendant.id, status: OrderStatus.PENDING_REVIEW, serviceTime: Between(weekStart, todayEnd) },
      ],
    });

    // 本月完成订单及收入
    const monthDoneOrders = await this.orderRepository.find({
      where: [
        { attendantId: attendant.id, status: OrderStatus.COMPLETED, serviceTime: Between(monthStart, todayEnd) },
        { attendantId: attendant.id, status: OrderStatus.PENDING_REVIEW, serviceTime: Between(monthStart, todayEnd) },
      ],
      select: ['id', 'attendantFee', 'totalFee', 'baseFee'],
    });

    const monthIncome = monthDoneOrders.reduce(
      (sum, o) => sum + Number(o.attendantFee ?? o.baseFee ?? 0),
      0,
    );

    // 累计服务时长（按已完成订单数估算，每单平均2.5小时）
    const totalDoneCount = await this.orderRepository.count({
      where: [
        { attendantId: attendant.id, status: OrderStatus.COMPLETED },
        { attendantId: attendant.id, status: OrderStatus.PENDING_REVIEW },
      ],
    });
    const totalHours = Math.round(totalDoneCount * 2.5);

    return {
      todayOrders,
      todayTasks: pendingTasks,
      weekOrders,
      weekCompleted,
      totalOrders,
      rating: attendant.rating,
      pendingTasks,
      inProgressCount,
      grabOrders,
      monthIncome: monthIncome.toFixed(2),
      totalHours,
    };
  }

  /**
   * 工作台聚合接口：一次返回多角色工作台变装需要的所有信息。
   *
   * 返回包含：
   *  - role / primaryRole / title / displayConfig（主题色、快捷入口、统计标签等）
   *  - stats（统计数据，与 getMyStats 对齐）
   *  - experienceYears / specialties / certifications
   *
   * 小程序端按 `displayConfig` 渲染，就无需在前端硬编码多套主题。
   */
  async getMyWorkbench(userId: number) {
    const attendant = await this.findByUserId(userId);
    const role = attendant.primaryRole || ServiceStaffRole.ATTENDANT;
    const config = resolveRoleConfig(role);
    const stats = await this.getMyStats(userId);

    return {
      role,
      professionalRoles:
        attendant.professionalRoles && attendant.professionalRoles.length > 0
          ? attendant.professionalRoles
          : [role],
      specialties: attendant.specialties || [],
      certifications: attendant.certifications || [],
      experienceYears: attendant.experienceYears || 0,
      title: attendant.title || config.defaultTitle,
      realName: attendant.realName,
      avatarUrl: attendant.avatarUrl,
      rating: attendant.rating,
      displayConfig: config,
      stats,
    };
  }

  /** 公开：所有角色配置（管理后台枚举下拉、前端自描述用） */
  listRoleConfigs() {
    return listAllRoleConfigs();
  }

  /** 公开：某个角色的配置（供新增服务人员时预填默认值） */
  getRoleConfig(role: ServiceStaffRole) {
    return (
      SERVICE_STAFF_ROLE_CONFIGS[role] ||
      SERVICE_STAFF_ROLE_CONFIGS[ServiceStaffRole.ATTENDANT]
    );
  }

  /**
   * 更新服务人员的专业配置（角色、专长、持证、头衔、年限）。
   * 用于管理后台的"服务人员"编辑抽屉。
   */
  async updateProfessionalProfile(
    id: number,
    payload: {
      primaryRole?: ServiceStaffRole;
      professionalRoles?: ServiceStaffRole[];
      specialties?: string[];
      certifications?: Attendant['certifications'];
      title?: string | null;
      experienceYears?: number;
    },
  ) {
    const attendant = await this.attendantRepository.findOne({ where: { id } });
    if (!attendant) throw new NotFoundException('服务人员不存在');

    if (payload.primaryRole !== undefined) attendant.primaryRole = payload.primaryRole;
    if (payload.professionalRoles !== undefined) {
      const uniq = Array.from(new Set(payload.professionalRoles || []));
      attendant.professionalRoles = uniq.length > 0 ? uniq : null;
    }
    if (payload.specialties !== undefined) {
      attendant.specialties =
        payload.specialties && payload.specialties.length > 0
          ? payload.specialties.map((s) => String(s).trim()).filter(Boolean)
          : null;
    }
    if (payload.certifications !== undefined) {
      attendant.certifications =
        payload.certifications && payload.certifications.length > 0
          ? payload.certifications
          : null;
    }
    if (payload.title !== undefined) attendant.title = payload.title || null;
    if (payload.experienceYears !== undefined) {
      const v = Number(payload.experienceYears);
      attendant.experienceYears = Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
    }

    return this.attendantRepository.save(attendant);
  }

  private maskName(name?: string | null): string {
    const v = (name || '').trim();
    if (!v) return '';
    const chars = Array.from(v);
    if (chars.length === 1) return `${chars[0]}*`;
    if (chars.length === 2) return `${chars[0]}*`;
    return `${chars[0]}${'*'.repeat(chars.length - 2)}${chars[chars.length - 1]}`;
  }

  private maskPhone(phone?: string | null): string {
    const v = (phone || '').trim();
    if (!v) return '';
    const digits = v.replace(/\D/g, '');
    if (digits.length >= 11) {
      return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
    }
    if (digits.length >= 7) {
      return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
    }
    if (digits.length >= 2) {
      return `${digits[0]}***${digits[digits.length - 1]}`;
    }
    return `${digits}***`;
  }

  private maskIdCard(idCard?: string | null): string {
    const v = (idCard || '').trim();
    if (!v) return '';
    if (v.length <= 8) return `${v.slice(0, 2)}****${v.slice(-2)}`;
    return `${v.slice(0, 4)}**********${v.slice(-4)}`;
  }

  private maskOrderPreview(order: any) {
    const next = { ...order };
    /** risk_level 在实体上为 select:false，部分查询路径可能只在 ORM 实例上挂列名 */
    const rawRisk =
      next.riskLevel ?? (next as { risk_level?: string | null }).risk_level;
    const label = displayOrderRiskLabel(rawRisk);
    const l12 = normalizeOrderRiskLevel(rawRisk);
    const rawStr = String(rawRisk ?? '').trim();
    next.riskLevel =
      l12 ?? (rawStr ? rawStr.toUpperCase() : null);
    next.riskLabel = label ?? '未标注';
    if (next.user) {
      next.user = {
        ...next.user,
        nickname: this.maskName(next.user.nickname),
        phone: this.maskPhone(next.user.phone),
      };
    }
    if (next.serviceTarget) {
      next.serviceTarget = {
        ...next.serviceTarget,
        name: this.maskName(next.serviceTarget.name),
        phone: this.maskPhone(next.serviceTarget.phone),
        idCard: this.maskIdCard(next.serviceTarget.idCard),
        emergencyContact: this.maskName(next.serviceTarget.emergencyContact),
        emergencyPhone: this.maskPhone(next.serviceTarget.emergencyPhone),
      };
    }
    return next;
  }

  /**
   * 抢单池查询。按当前人的 primaryRole + professionalRoles 过滤订单：
   *   - 未绑定 professional_service 的老订单 → 所有人可抢（默认等同"陪诊单"）；
   *   - 已绑定 professional_service → 只给能接该 category 的角色看到。
   *
   * adminMode=true 时（管理后台调用）不做角色过滤，返回全部待抢订单。
   */
  async getGrabOrders(currentUserId?: number, role?: string) {
    await this.ensureRiskLevelColumnReady();
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .addSelect('order.riskLevel')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.serviceTarget', 'serviceTarget')
      .leftJoinAndSelect('order.professionalService', 'professionalService')
      .where('order.status = :status', { status: OrderStatus.PENDING_GRAB })
      .orderBy('order.createdAt', 'DESC');

    const adminMode =
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE;

    if (!adminMode && currentUserId) {
      const attendant = await this.attendantRepository.findOne({
        where: { userId: currentUserId },
      });
      if (!attendant) return [];
      const eligibleCategories = this.resolveEligibleCategories(attendant);
      if (eligibleCategories.length === 0) {
        qb.andWhere('order.professional_service_id IS NULL');
      } else {
        qb.andWhere(
          '(order.professional_service_id IS NULL OR professionalService.category IN (:...cats))',
          { cats: eligibleCategories },
        );
      }
    }

    const orders = await qb.getMany();
    return orders.map((order: any) => this.maskOrderPreview(order));
  }

  /**
   * 将 attendant 的主 / 兼任角色映射到可接的服务目录 category。
   */
  private resolveEligibleCategories(attendant: Attendant): string[] {
    const roles = new Set<ServiceStaffRole>();
    if (attendant.primaryRole) roles.add(attendant.primaryRole);
    for (const r of attendant.professionalRoles || []) roles.add(r);
    const set = new Set<string>();
    for (const role of roles) {
      const config = SERVICE_STAFF_ROLE_CONFIGS[role];
      if (!config) continue;
      for (const c of config.matchCategories) set.add(c);
    }
    return Array.from(set);
  }

  async getAssignedOrders(userId: number) {
    const attendant = await this.findByUserId(userId);
    await this.ensureRiskLevelColumnReady();
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .addSelect('order.riskLevel')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.serviceTarget', 'serviceTarget')
      .where('order.attendantId = :attendantId', { attendantId: attendant.id })
      .andWhere('order.status = :status', { status: OrderStatus.PENDING_ACCEPT })
      .orderBy('order.createdAt', 'DESC')
      .getMany();
    return orders.map((order: any) => this.maskOrderPreview(order));
  }

  async submitMySchedules(userId: number, schedules: CreateScheduleDto[], opts?: { startDate?: string; endDate?: string }) {
    const attendant = await this.findByUserId(userId);
    return this.submitSchedules(attendant.id, schedules, opts);
  }

  async getMySchedules(userId: number, startDate?: string, endDate?: string) {
    const attendant = await this.findByUserId(userId);
    return this.getSchedules(attendant.id, startDate, endDate);
  }

  async getMyWallet(userId: number) {
    const attendant = await this.findByUserId(userId);
    const walletStatuses = [
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.COMPLETED,
      OrderStatus.CANCELED,
      OrderStatus.EMERGENCY,
    ];
    const canReadRiskLevel = await this.ensureRiskLevelColumnReady();
    const orders = canReadRiskLevel
      ? await this.orderRepository
          .createQueryBuilder('order')
          .addSelect('order.riskLevel')
          .where('order.attendantId = :attendantId', { attendantId: attendant.id })
          .andWhere('order.status IN (:...statuses)', { statuses: walletStatuses })
          .orderBy('order.serviceTime', 'DESC')
          .addOrderBy('order.createdAt', 'DESC')
          .getMany()
      : await this.orderRepository.find({
          where: {
            attendantId: attendant.id,
            status: In(walletStatuses),
          },
          order: { serviceTime: 'DESC', createdAt: 'DESC' },
        });

    const statusLabelMap: Record<string, string> = {
      [OrderStatus.PENDING_ACCEPT]: '待确认',
      [OrderStatus.PENDING_SIGN]: '待服务',
      [OrderStatus.PENDING_SERVICE]: '待服务',
      [OrderStatus.IN_PROGRESS]: '进行中',
      [OrderStatus.PENDING_REVIEW]: '待完结',
      [OrderStatus.COMPLETED]: '已完成',
      [OrderStatus.CANCELED]: '已取消',
      [OrderStatus.EMERGENCY]: '紧急',
    };

    const settlementStatusLabelMap: Record<string, string> = {
      pending: '待结算',
      settled: '已结算',
    };

    const paymentMethodLabelMap: Record<string, string> = {
      wechat: '微信转账',
      alipay: '支付宝转账',
      qr_transfer: '收款码转账',
      bank_transfer: '银行卡转账',
      cash: '现金',
      other: '其他',
    };

    const normalizedOrders = orders.map((o: any) => {
      const fee = Number(o.attendantFee ?? o.totalFee ?? o.baseFee ?? 0);
      const riskLevelNorm = normalizeOrderRiskLevel(o.riskLevel);
      const rawRiskStr = String(o.riskLevel ?? '').trim();
      const riskLevelCode =
        riskLevelNorm ?? (rawRiskStr ? rawRiskStr.toUpperCase() : '');
      const extraIncomeItems = Array.isArray(o.attendantExtraIncomeItems)
        ? o.attendantExtraIncomeItems.map((item: any) => ({
            id: item?.id,
            name: String(item?.name || '').trim(),
            amount: Number(item?.amount || 0),
            note: item?.note ? String(item.note).trim() : '',
          }))
        : [];
      const extraIncomeTotal = extraIncomeItems.reduce(
        (sum: number, item: any) => sum + Number(item.amount || 0),
        0,
      );
      const baseIncome = Number((fee - extraIncomeTotal).toFixed(2));
      const breakdown = [
        ...(baseIncome > 0 || o.attendantFeeType
          ? [
              {
                label: o.attendantFeeType || '基础收入',
                amount: Number(Math.max(baseIncome, 0)).toFixed(2),
              },
            ]
          : []),
        ...extraIncomeItems.map((item: any) => ({
          label: item.name || '附加收入',
          amount: Number(item.amount || 0).toFixed(2),
          note: item.note || '',
        })),
      ];
      return {
        id: `o-${o.id}`,
        title: o.serviceType || '陪诊服务',
        orderId: o.id,
        orderNumber: o.orderNumber,
        description: `订单号 ${o.orderNumber}`,
        date: o.serviceTime
          ? new Date(o.serviceTime).toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            })
          : '',
        amount: fee.toFixed(2),
        type: 'income',
        icon: 'payments',
        riskLevel: riskLevelCode || '',
        riskLabel: displayOrderRiskLabel(o.riskLevel) ?? '未标注',
        breakdown,
        breakdownText: breakdown
          .map(
            (item: any) =>
              `${item.label} ¥${item.amount}${item.note ? `（${item.note}）` : ''}`,
          )
          .join(' + '),
        status: o.status,
        statusLabel: statusLabelMap[o.status] || o.status || '进行中',
        settlementStatus: o.settlementStatus || 'pending',
        settlementStatusLabel:
          settlementStatusLabelMap[o.settlementStatus] || '待结算',
        paymentMethod: o.paymentMethod || '',
        paymentMethodLabel: o.paymentMethod
          ? paymentMethodLabelMap[o.paymentMethod] || o.paymentMethod
          : '',
        settledAt: o.settledAt
          ? new Date(o.settledAt).toLocaleString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '',
      };
    });

    const totalIncome = normalizedOrders
      .filter((item: any) => item.status !== OrderStatus.CANCELED)
      .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    const pendingIncome = normalizedOrders
      .filter(
        (item: any) =>
          ![OrderStatus.COMPLETED, OrderStatus.PENDING_REVIEW, OrderStatus.CANCELED].includes(
            item.status,
          ),
      )
      .reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

    return {
      balance: totalIncome.toFixed(2),
      totalIncome: totalIncome.toFixed(2),
      pendingIncome: pendingIncome.toFixed(2),
      orderCount: normalizedOrders.length,
      transactions: normalizedOrders,
    };
  }
}
