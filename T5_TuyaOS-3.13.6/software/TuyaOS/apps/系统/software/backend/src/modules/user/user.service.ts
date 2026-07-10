import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { User } from '../../entities/user.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { Order } from '../../entities/order.entity.js';
import { Consultation } from '../../entities/consultation.entity.js';
import { Review } from '../../entities/review.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { MedicationReminder } from '../../entities/medication-reminder.entity.js';
import { UserMembership } from '../../entities/user-membership.entity.js';
import { Schedule } from '../../entities/schedule.entity.js';
import { FinanceRecord } from '../../entities/finance-record.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { CreateServiceTargetDto } from './dto/create-service-target.dto.js';
import { UpdateServiceTargetDto } from './dto/update-service-target.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { UserRole, DocumentType, OrderStatus } from '../../common/enums/index.js';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { Document } from '../../entities/document.entity.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { FamilyService } from '../family/family.service.js';

const UNIQUE_SERVICE_TARGET_RELATIONSHIPS = new Set(['self', 'father', 'mother', 'parent', 'spouse']);
const SERVICE_TARGET_RELATION_LABELS: Record<string, string> = {
  self: '本人',
  father: '父亲',
  mother: '母亲',
  parent: '父母',
  spouse: '配偶',
  child: '子女',
  other: '其他',
};

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ServiceTarget)
    private readonly serviceTargetRepository: Repository<ServiceTarget>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Consultation)
    private readonly consultationRepository: Repository<Consultation>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    @InjectRepository(MedicationReminder)
    private readonly medicationReminderRepository: Repository<MedicationReminder>,
    @InjectRepository(UserMembership)
    private readonly userMembershipRepository: Repository<UserMembership>,
    @InjectRepository(Schedule)
    private readonly scheduleRepository: Repository<Schedule>,
    @InjectRepository(FinanceRecord)
    private readonly financeRecordRepository: Repository<FinanceRecord>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepository: Repository<SystemConfig>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(FamilyMember)
    private readonly familyMemberRepository: Repository<FamilyMember>,
    private readonly storageService: StorageService,
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => FamilyService))
    private readonly familyService: FamilyService,
  ) {}

  private readonly logger = new Logger(UserService.name);

  private hasServiceTargetAccess(
    targetUserId: number,
    currentUserId?: number,
    role?: string,
  ): boolean {
    if (!currentUserId) return false;
    if (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT
    ) {
      return true;
    }
    return targetUserId === currentUserId;
  }

  /** 异步版本：包含家庭 guardian 权限检查 */
  private async hasServiceTargetAccessAsync(
    targetUserId: number,
    currentUserId?: number,
    role?: string,
  ): Promise<boolean> {
    if (this.hasServiceTargetAccess(targetUserId, currentUserId, role)) return true;
    if (!currentUserId) return false;
    const guardianMemberships = await this.familyMemberRepository.find({
      where: { userId: currentUserId, role: 'guardian' },
    });
    for (const gm of guardianMemberships) {
      const targetMember = await this.familyMemberRepository.findOne({
        where: { familyGroupId: gm.familyGroupId, userId: targetUserId },
      });
      if (targetMember) return true;
    }
    return false;
  }

  private parseHealthProfile(
    value?: Record<string, unknown> | string | null,
  ): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'string') {
      try {
        return JSON.parse(value || '{}');
      } catch {
        return {};
      }
    }
    return value as Record<string, any>;
  }

  private hasHealthDocumentMutation(
    rest: Record<string, any>,
    incomingHP?: Record<string, any>,
  ): boolean {
    const topLevelFields = [
      'name',
      'idCard',
      'gender',
      'age',
      'phone',
      'emergencyContact',
      'emergencyPhone',
      'homeAddress',
      'mainAppeal',
    ];
    const healthProfileFields = Object.keys(incomingHP || {}).filter(
      (key) => !['signatureName', 'signedAt', 'signatureUrl', 'signUrl'].includes(key),
    );
    return (
      topLevelFields.some((key) => Object.prototype.hasOwnProperty.call(rest, key)) ||
      healthProfileFields.length > 0
    );
  }

  private clearSignatureState(target: ServiceTarget, hp: Record<string, any>) {
    target.signatureUrl = null as any;
    target.healthProfile = {
      ...hp,
      signatureName: '',
      signedAt: '',
      signatureUrl: '',
      signUrl: '',
    };
  }

  private normalizeRelationship(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeGender(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private getHealthProfileRelationship(hp?: Record<string, any>): string {
    return this.normalizeRelationship(hp?.relationship);
  }

  private resolveServiceTargetRelationship(relationship: string, gender?: unknown): string {
    const normalized = this.normalizeRelationship(relationship);
    if (normalized !== 'parent') return normalized;
    const normalizedGender = this.normalizeGender(gender);
    if (normalizedGender === 'male') return 'father';
    if (normalizedGender === 'female') return 'mother';
    return 'parent';
  }

  private assertRelationshipGenderConsistency(relationship: string, gender?: unknown) {
    const normalizedGender = this.normalizeGender(gender);
    if (!normalizedGender) return;
    if (relationship === 'father' && normalizedGender !== 'male') {
      throw new BadRequestException('父亲关系需选择男性');
    }
    if (relationship === 'mother' && normalizedGender !== 'female') {
      throw new BadRequestException('母亲关系需选择女性');
    }
  }

  private buildRelationshipConflictMessage(relationship: string): string {
    if (relationship === 'self') {
      return '当前账号已存在本人档案，请勿重复填写';
    }
    const label = SERVICE_TARGET_RELATION_LABELS[relationship] || relationship;
    return `当前账号已存在${label}档案，如需修改请编辑现有档案`;
  }

  private async assertUniqueServiceTargetRelationship(
    userId: number,
    relationship: string,
    excludeId?: number,
  ) {
    if (!UNIQUE_SERVICE_TARGET_RELATIONSHIPS.has(relationship)) return;
    const targets = await this.serviceTargetRepository.find({ where: { userId } });
    const duplicate = targets.find((item) => {
      if (excludeId && item.id === excludeId) return false;
      const hp = this.parseHealthProfile(item.healthProfile);
      return this.resolveServiceTargetRelationship(
        this.getHealthProfileRelationship(hp),
        item.gender,
      ) === relationship;
    });
    if (duplicate) {
      throw new BadRequestException(
        this.buildRelationshipConflictMessage(relationship),
      );
    }
  }

  async findAll(
    query: PaginationDto & {
      keyword?: string;
      customerOnly?: string | boolean;
      /** filled=仅已建档；empty=仅未建档；其它或空=全部 */
      archiveStatus?: string;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.userRepository.createQueryBuilder('user');
    // customerOnly=true 表示"只看小程序普通客户"，排除后台管理员、客服、陪诊员等内部角色
    // 策略：排除已知的后台内部角色（即使 role 字段为 NULL 或 空字符串也视为普通客户）
    const coRaw = query.customerOnly;
    const customerOnly =
      coRaw === true ||
      coRaw === 'true' ||
      (typeof coRaw === 'string' && coRaw.toLowerCase() === '1');
    if (customerOnly) {
      const internalRoles = [
        'admin',
        'operator',
        'customer_service',
        'finance',
        'medical_consultant',
        'attendant',
      ];
      qb.andWhere('(user.role IS NULL OR user.role NOT IN (:...internalRoles))', {
        internalRoles,
      });
    }

    const kwRaw = query.keyword?.trim();
    if (kwRaw) {
      const kw = `%${kwRaw}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('user.nickname LIKE :kw', { kw })
            .orWhere('user.phone LIKE :kw', { kw })
            .orWhere('user.openid LIKE :kw', { kw })
            .orWhere(
              `EXISTS (
                SELECT 1 FROM service_targets st_kw
                WHERE st_kw.user_id = user.id AND st_kw.name LIKE :kw
              )`,
            );
        }),
      );
    }

    const archive = String(query.archiveStatus || '').toLowerCase();
    if (archive === 'filled' || archive === 'has_archive') {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM service_targets st_f WHERE st_f.user_id = user.id)`,
      );
    } else if (archive === 'empty' || archive === 'no_archive') {
      qb.andWhere(
        `NOT EXISTS (SELECT 1 FROM service_targets st_e WHERE st_e.user_id = user.id)`,
      );
    }

    qb.loadRelationCountAndMap(
      'user.serviceTargetsCount',
      'user.serviceTargets',
    );
    qb.loadRelationCountAndMap('user.ordersCount', 'user.orders');

    qb.orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [items, total] = await qb.getManyAndCount();
    await this.attachCustomerListFamilySummary(items);
    await this.attachCustomerListServiceTargetsSummary(items);
    return { items, total, page, pageSize };
  }

  /** 列表页附加：所在家庭名称、邀请码（供管理端一眼查看） */
  private async attachCustomerListFamilySummary(users: User[]): Promise<void> {
    if (!users.length) return;
    const ids = users.map((u) => u.id);
    const memberships = await this.familyMemberRepository.find({
      where: { userId: In(ids) },
      relations: ['familyGroup'],
    });
    const groupByUser = new Map<
      number,
      Map<number, { name: string; inviteCode: string }>
    >();
    for (const m of memberships) {
      const g = m.familyGroup;
      if (!g) continue;
      if (m.userId === null) continue;
      if (!groupByUser.has(m.userId)) groupByUser.set(m.userId, new Map());
      groupByUser
        .get(m.userId)!
        .set(g.id, { name: g.name, inviteCode: g.inviteCode });
    }
    for (const u of users) {
      const gm = groupByUser.get(u.id);
      const groups = gm ? [...gm.values()] : [];
      (u as User & { familyGroupsLabel?: string; familyGroupsTooltip?: string })
        .familyGroupsLabel = groups.length
        ? groups.map((x) => x.name).join('、')
        : '';
      (u as User & { familyGroupsTooltip?: string }).familyGroupsTooltip =
        groups.length
          ? groups
              .map((x) => `${x.name}（邀请码 ${x.inviteCode}）`)
              .join('\n')
          : '';
    }
  }

  /** 列表页附加：服务对象 id + 名称（管理端小程序客户等列表一眼可看全） */
  private async attachCustomerListServiceTargetsSummary(users: User[]): Promise<void> {
    if (!users.length) return;
    const ids = users.map((u) => u.id);
    const targets = await this.serviceTargetRepository.find({
      where: { userId: In(ids) },
      select: ['id', 'userId', 'name'],
      order: { id: 'ASC' },
    });
    const byUser = new Map<number, { id: number; name: string }[]>();
    for (const t of targets) {
      if (!byUser.has(t.userId)) byUser.set(t.userId, []);
      const label = (t.name && String(t.name).trim()) || '未命名';
      byUser.get(t.userId)!.push({ id: t.id, name: label });
    }
    for (const u of users) {
      const list = byUser.get(u.id) ?? [];
      (u as User & { serviceTargetsList?: { id: number; name: string }[] }).serviceTargetsList =
        list;
      (u as User & { serviceTargetsLabel?: string }).serviceTargetsLabel = list.length
        ? list.map((x) => x.name).join('、')
        : '';
    }
  }

  /**
   * 管理端服务对象目录：每行一条 service_target，即全库健康档案成员。
   * 默认包含所有角色所属账号下的档案；传 customerOnly=true 时仅保留小程序客户（role=user）。
   * 排除所属账号已进回收站（软删）的档案。
   */
  async findAllServiceTargetsDirectory(
    query: PaginationDto & { keyword?: string; customerOnly?: string | boolean },
  ) {
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    const customerOnly =
      query.customerOnly === true ||
      query.customerOnly === 'true' ||
      query.customerOnly === '1';
    const qb = this.serviceTargetRepository
      .createQueryBuilder('st')
      .innerJoinAndSelect('st.user', 'u')
      .where('u.deleted_at IS NULL');
    if (customerOnly) {
      qb.andWhere('u.role = :clientRole', { clientRole: UserRole.USER });
    }

    if (query.keyword?.trim()) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere(
        '(st.name LIKE :kw OR u.nickname LIKE :kw OR u.phone LIKE :kw OR u.openid LIKE :kw)',
        { kw },
      );
    }

    qb.orderBy('st.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [targets, total] = await qb.getManyAndCount();

    type DirectoryRow = {
      id: number;
      name: string;
      gender: string | null;
      age: number | null;
      phone: string | null;
      userId: number;
      createdAt: Date;
      owner: {
        id: number;
        nickname: string | null;
        phone: string | null;
        openid: string | null;
        unionId: string | null;
        role: UserRole;
      };
      ordersCount: number;
      familyGroupsLabel: string;
      familyGroupsTooltip: string;
      familyGroupId: number | null;
      familyMemberCount: number;
    };

    const items: DirectoryRow[] = targets.map((st) => {
      const u = st.user;
      return {
        id: st.id,
        name: (st.name && String(st.name).trim()) || '未命名',
        gender: st.gender ?? null,
        age: st.age ?? null,
        phone: st.phone ?? null,
        userId: st.userId,
        createdAt: st.createdAt,
        owner: {
          id: u.id,
          nickname: u.nickname ?? null,
          phone: u.phone ?? null,
          openid: u.openid ?? null,
          unionId: u.unionId ?? null,
          role: u.role,
        },
        ordersCount: 0,
        familyGroupsLabel: '',
        familyGroupsTooltip: '',
        familyGroupId: null,
        familyMemberCount: 0,
      };
    });

    await this.attachServiceTargetDirectoryFamily(items);
    await this.attachServiceTargetDirectoryOrderCounts(items);

    return { items, total, page, pageSize };
  }

  private async attachServiceTargetDirectoryFamily(
    items: Array<{
      id: number;
      userId: number;
      familyGroupsLabel: string;
      familyGroupsTooltip: string;
      familyGroupId: number | null;
      familyMemberCount: number;
    }>,
  ): Promise<void> {
    if (!items.length) return;
    const targetIds = items.map((i) => i.id);
    const userIds = [...new Set(items.map((i) => i.userId))];

    // 优先按 linked_service_target_id 反查家庭（覆盖占位老人档案）
    const linkedMemberships = await this.familyMemberRepository.find({
      where: { linkedServiceTargetId: In(targetIds) },
      relations: ['familyGroup'],
    });
    const groupByTargetId = new Map<number, { id: number; name: string; inviteCode: string }>();
    for (const m of linkedMemberships) {
      if (!m.familyGroup || !m.linkedServiceTargetId) continue;
      groupByTargetId.set(m.linkedServiceTargetId, {
        id: m.familyGroup.id,
        name: m.familyGroup.name,
        inviteCode: m.familyGroup.inviteCode,
      });
    }

    // 兜底：按 ServiceTarget 的 owner userId 查其 guardian 所在的家庭
    const ownerMemberships = await this.familyMemberRepository.find({
      where: { userId: In(userIds) },
      relations: ['familyGroup'],
    });
    const groupByUser = new Map<number, Map<number, { name: string; inviteCode: string }>>();
    for (const m of ownerMemberships) {
      const g = m.familyGroup;
      if (!g || m.userId === null) continue;
      if (!groupByUser.has(m.userId)) groupByUser.set(m.userId, new Map());
      groupByUser.get(m.userId)!.set(g.id, { name: g.name, inviteCode: g.inviteCode });
    }

    // 统计每个家庭的成员总数
    const allGroupIds = new Set<number>();
    for (const g of groupByTargetId.values()) allGroupIds.add(g.id);
    for (const map of groupByUser.values()) {
      for (const id of map.keys()) allGroupIds.add(id);
    }
    const groupMemberCount = new Map<number, number>();
    if (allGroupIds.size) {
      const counts = await this.familyMemberRepository
        .createQueryBuilder('fm')
        .select('fm.family_group_id', 'gid')
        .addSelect('COUNT(*)', 'cnt')
        .where('fm.family_group_id IN (:...ids)', { ids: [...allGroupIds] })
        .groupBy('fm.family_group_id')
        .getRawMany();
      for (const c of counts) {
        groupMemberCount.set(Number(c.gid), Number(c.cnt));
      }
    }

    for (const item of items) {
      const fromTarget = groupByTargetId.get(item.id);
      if (fromTarget) {
        item.familyGroupId = fromTarget.id;
        item.familyGroupsLabel = fromTarget.name;
        item.familyGroupsTooltip = `${fromTarget.name}（邀请码 ${fromTarget.inviteCode}）`;
        item.familyMemberCount = groupMemberCount.get(fromTarget.id) ?? 0;
        continue;
      }
      const gm = groupByUser.get(item.userId);
      const groups = gm ? [...gm.entries()].map(([id, v]) => ({ id, ...v })) : [];
      if (groups.length) {
        item.familyGroupId = groups[0].id;
        item.familyGroupsLabel = groups.map((x) => x.name).join('、');
        item.familyGroupsTooltip = groups
          .map((x) => `${x.name}（邀请码 ${x.inviteCode}）`)
          .join('\n');
        item.familyMemberCount =
          groups.reduce((acc, g) => acc + (groupMemberCount.get(g.id) ?? 0), 0);
      }
    }
  }

  private async attachServiceTargetDirectoryOrderCounts(
    items: Array<{ id: number; ordersCount: number }>,
  ): Promise<void> {
    if (!items.length) return;
    const ids = items.map((i) => i.id);
    const rows = await this.orderRepository
      .createQueryBuilder('o')
      .select('o.service_target_id', 'stId')
      .addSelect('COUNT(o.id)', 'cnt')
      .where('o.service_target_id IN (:...ids)', { ids })
      .groupBy('o.service_target_id')
      .getRawMany();
    const map = new Map<number, number>();
    for (const r of rows) {
      map.set(Number(r.stId), Number(r.cnt));
    }
    for (const item of items) {
      item.ordersCount = map.get(item.id) ?? 0;
    }
  }

  async findOne(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['serviceTargets', 'orders'],
    });
    if (!user) throw new NotFoundException('用户不存在');
    return user;
  }

  async updateUser(id: number, data: Partial<User>) {
    const user = await this.findOne(id);
    const oldRole = user.role;
    Object.assign(user, data);
    const saved = await this.userRepository.save(user);

    if (data.role && data.role !== oldRole) {
      await this.syncAttendantOnRoleChange(id, oldRole, data.role);
    }

    return saved;
  }

  /**
   * 角色变更时同步陪诊员状态：
   * - 从 attendant 改为其他角色 → 停用陪诊员档案
   * - 从其他角色改为 attendant → 恢复/启用已有档案；若无则创建一条（与微信 loginAs=attendant 的绑定条件一致）
   */
  private async syncAttendantOnRoleChange(
    userId: number,
    oldRole: UserRole | string,
    newRole: UserRole | string,
  ) {
    if (oldRole === UserRole.ATTENDANT && newRole !== UserRole.ATTENDANT) {
      const attendant = await this.attendantRepository.findOne({
        where: { userId, status: 'active' },
      });
      if (attendant) {
        attendant.status = 'disabled';
        await this.attendantRepository.save(attendant);
      }
    } else if (newRole === UserRole.ATTENDANT && oldRole !== UserRole.ATTENDANT) {
      let attendant = await this.attendantRepository.findOne({
        where: { userId },
        withDeleted: true,
      });
      if (attendant?.deletedAt) {
        await this.attendantRepository.restore(attendant.id);
        attendant = await this.attendantRepository.findOne({ where: { userId } });
      }
      if (attendant) {
        attendant.status = 'active';
        await this.attendantRepository.save(attendant);
        return;
      }

      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) return;

      const realName =
        (user.nickname && user.nickname.trim()) ||
        (user.phone && user.phone.trim()) ||
        `陪诊员#${userId}`;
      const row = this.attendantRepository.create({
        userId,
        realName,
        phone: user.phone || '',
        status: 'active',
        rating: 5.0,
        totalOrders: 0,
      });
      await this.attendantRepository.save(row);
    }
  }

  /** 软删除：移入回收站，同时停用关联的陪诊员档案 */
  async deleteUser(id: number) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    const attendant = await this.attendantRepository.findOne({
      where: { userId: id, status: 'active' },
    });
    if (attendant) {
      attendant.status = 'disabled';
      await this.attendantRepository.save(attendant);
    }

    await this.userRepository.softDelete(id);
    return { message: '已移入回收站' };
  }

  /** 查询回收站列表 */
  async getDeletedUsers(query: PaginationDto & { keyword?: string }) {
    const { keyword } = query;
    const page = Math.max(1, Number.isFinite(Number(query.page)) ? Number(query.page) : 1);
    const pageSize = Math.min(100, Math.max(1, Number.isFinite(Number(query.pageSize)) ? Number(query.pageSize) : 20));
    const qb = this.userRepository
      .createQueryBuilder('user')
      .withDeleted()
      .where('user.deleted_at IS NOT NULL')
      .orderBy('user.deleted_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    if (keyword) {
      qb.andWhere(
        '(user.nickname LIKE :kw OR user.phone LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** 从回收站恢复，同时恢复因用户删除而停用的陪诊员档案 */
  async restoreUser(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) throw new NotFoundException('用户不存在');
    if (!user.deletedAt) throw new BadRequestException('该用户不在回收站中');
    await this.userRepository.restore(id);

    if (user.role === UserRole.ATTENDANT) {
      const attendant = await this.attendantRepository.findOne({
        where: { userId: id, status: 'disabled' },
      });
      if (attendant) {
        attendant.status = 'active';
        await this.attendantRepository.save(attendant);
      }
    }

    return { message: '已恢复' };
  }

  /** 从回收站彻底删除 */
  async permanentDeleteUser(id: number) {
    const user = await this.userRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!user) throw new NotFoundException('用户不存在');

    // 业务态防御：存在进行中订单 / 未结算财务记录时禁止硬删
    const blockingStatuses: OrderStatus[] = [
      OrderStatus.PENDING_DISPATCH,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_GRAB,
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.EMERGENCY,
    ];
    const activeOrderCount = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.user_id = :id', { id })
      .andWhere('o.status IN (:...st)', { st: blockingStatuses })
      .getCount();
    if (activeOrderCount > 0) {
      throw new BadRequestException(
        `该客户仍有 ${activeOrderCount} 条进行中订单，禁止彻底删除，请先处理订单`,
      );
    }

    const unsettledFinanceCount = await this.financeRecordRepository
      .createQueryBuilder('f')
      .innerJoin('orders', 'o', 'o.id = f.order_id')
      .where('o.user_id = :id', { id })
      .andWhere('f.status = :pending', { pending: 'pending' })
      .getCount();
    if (unsettledFinanceCount > 0) {
      throw new BadRequestException(
        `该客户名下仍有 ${unsettledFinanceCount} 条待审核财务记录，禁止彻底删除`,
      );
    }

    const attendant = await this.attendantRepository.findOne({
      where: { userId: id },
      withDeleted: true,
    });
    if (attendant) {
      await this.orderRepository.update(
        { attendantId: attendant.id },
        { attendantId: null as unknown as number },
      );
      await this.scheduleRepository.delete({ attendantId: attendant.id });
      await this.financeRecordRepository.update(
        { attendantId: attendant.id },
        { attendantId: null },
      );
      await this.reviewRepository.update(
        { attendantId: attendant.id },
        { attendantId: null },
      );
      await this.attendantRepository.delete(attendant.id);
    }

    await this.medicationReminderRepository.delete({ userId: id });
    await this.consultationRepository.delete({ userId: id });
    await this.reviewRepository.delete({ userId: id });
    await this.serviceTargetRepository.delete({ userId: id });
    await this.userMembershipRepository.delete({ userId: id });
    await this.userRepository.delete(id);
    return { message: '已彻底删除' };
  }

  async createServiceTarget(userId: number, dto: CreateServiceTargetDto) {
    const { relationship, remark, wechatGroupWebhook: _wgw, ...rest } = dto as any;
    const healthProfile = (rest.healthProfile || {}) as Record<string, unknown>;
    if (relationship) healthProfile.relationship = relationship;
    if (remark) healthProfile.remark = remark;
    const normalizedRelationship = this.resolveServiceTargetRelationship(
      this.getHealthProfileRelationship(healthProfile),
      rest.gender,
    );
    if (normalizedRelationship) {
      healthProfile.relationship = normalizedRelationship;
    }
    this.assertRelationshipGenderConsistency(normalizedRelationship, rest.gender);
    await this.assertUniqueServiceTargetRelationship(userId, normalizedRelationship);
    const target = this.serviceTargetRepository.create({
      ...rest,
      userId,
      healthProfile: Object.keys(healthProfile).length
        ? healthProfile
        : undefined,
    });
    const saved = (await this.serviceTargetRepository.save(target)) as unknown as ServiceTarget;

    // 自动同步到"我的家庭"：非本人档案进入家庭，本人档案则保持仅账号自管
    try {
      await this.familyService.ensureMemberForServiceTarget(saved.id);
    } catch (err) {
      this.logger.warn(
        `ensureMemberForServiceTarget(${saved.id}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return saved;
  }

  async updateServiceTarget(
    id: number,
    dto: UpdateServiceTargetDto,
    currentUserId?: number,
    role?: string,
  ) {
    const target = await this.serviceTargetRepository.findOne({
      where: { id },
    });
    if (!target) throw new NotFoundException('服务对象不存在');
    if (!this.hasServiceTargetAccess(target.userId, currentUserId, role)) {
      throw new ForbiddenException('无权操作该服务对象');
    }
    const {
      healthProfile: rawIncomingHP,
      relationship,
      remark,
      wechatGroupWebhook: _wgw2,
      ...rest
    } = dto as any;
    const incomingHP = (rawIncomingHP && typeof rawIncomingHP === 'object')
      ? { ...rawIncomingHP }
      : {};
    if (relationship) incomingHP.relationship = relationship;
    if (remark) incomingHP.remark = remark;
    const existingHP = this.parseHealthProfile(target.healthProfile);
    const currentRelationship = this.resolveServiceTargetRelationship(
      this.getHealthProfileRelationship(existingHP),
      target.gender,
    );
    const incomingSignatureUrl =
      typeof rest.signatureUrl === 'string' ? rest.signatureUrl.trim() : '';
    const shouldResetSignature =
      this.hasHealthDocumentMutation(rest, incomingHP) &&
      !incomingSignatureUrl &&
      !!(
        target.signatureUrl ||
        existingHP.signatureUrl ||
        existingHP.signUrl ||
        existingHP.signatureName ||
        existingHP.signedAt
      );
    Object.assign(target, rest);
    if (Object.keys(incomingHP).length > 0) {
      target.healthProfile = { ...existingHP, ...incomingHP };
    } else {
      target.healthProfile = existingHP;
    }
    if (rest.homeAddress) {
      target.healthProfile = { ...(target.healthProfile as any || {}), address: rest.homeAddress };
    }
    if (shouldResetSignature) {
      this.clearSignatureState(target, this.parseHealthProfile(target.healthProfile));
    }
    const nextHealthProfile = this.parseHealthProfile(target.healthProfile);
    const nextRelationship = this.resolveServiceTargetRelationship(
      this.getHealthProfileRelationship(nextHealthProfile),
      target.gender,
    );
    if (nextRelationship && nextHealthProfile.relationship !== nextRelationship) {
      target.healthProfile = { ...nextHealthProfile, relationship: nextRelationship };
    }
    this.assertRelationshipGenderConsistency(nextRelationship, target.gender);
    if (
      nextRelationship &&
      nextRelationship !== currentRelationship
    ) {
      await this.assertUniqueServiceTargetRelationship(
        target.userId,
        nextRelationship,
        target.id,
      );
    }
    const saved = await this.serviceTargetRepository.save(target);
    try {
      await this.familyService.ensureMemberForServiceTarget(saved.id);
    } catch (err) {
      this.logger.warn(
        `ensureMemberForServiceTarget(${saved.id}) failed after update: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return saved;
  }

  async getServiceTargets(userId: number) {
    return this.serviceTargetRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findServiceTargetById(
    id: number,
    currentUserId?: number,
    role?: string,
  ) {
    const target = await this.serviceTargetRepository.findOne({
      where: { id },
    });
    if (!target) throw new NotFoundException('服务对象不存在');
    if (!this.hasServiceTargetAccess(target.userId, currentUserId, role)) {
      throw new ForbiddenException('无权访问该服务对象');
    }
    return target;
  }

  async getServiceTargetHistory(
    serviceTargetId: number,
    currentUserId?: number,
    role?: string,
  ) {
    await this.findServiceTargetById(serviceTargetId, currentUserId, role);
    const orders = await this.orderRepository.find({
      where: {
        serviceTargetId,
        status: OrderStatus.COMPLETED,
      },
      order: { serviceTime: 'DESC' },
      relations: ['attendant'],
    });
    return orders.map((o: any) => {
      const st = o.serviceTime ? new Date(o.serviceTime) : new Date();
      const completion = o.completionData || {};
      return {
        id: o.id,
        year: st.getFullYear().toString(),
        date: o.serviceTime,
        dateShort: `${String(st.getMonth() + 1).padStart(2, '0')}月${String(st.getDate()).padStart(2, '0')}日`,
        timeSlot: st.getHours() < 12 ? '上午' : '下午',
        hospital: o.hospital,
        department: o.department,
        diagnosis: completion.diagnosisResult || '--',
        summary: completion.summary || completion.doctorAdvice,
        tag: '复诊',
        tagType: 'info',
        doctor: completion.doctor || '--',
        doctorInitial: (completion.doctor || '医')[0],
      };
    });
  }

  async deleteServiceTarget(id: number, currentUserId?: number, role?: string) {
    const target = await this.serviceTargetRepository.findOne({
      where: { id },
    });
    if (!target) throw new NotFoundException('服务对象不存在');
    if (!this.hasServiceTargetAccess(target.userId, currentUserId, role)) {
      throw new ForbiddenException('无权删除该服务对象');
    }

    const blockingStatuses: OrderStatus[] = [
      OrderStatus.PENDING_DISPATCH,
      OrderStatus.PENDING_ACCEPT,
      OrderStatus.PENDING_GRAB,
      OrderStatus.PENDING_SIGN,
      OrderStatus.PENDING_SERVICE,
      OrderStatus.IN_PROGRESS,
      OrderStatus.PENDING_REVIEW,
      OrderStatus.EMERGENCY,
    ];
    const activeCount = await this.orderRepository
      .createQueryBuilder('o')
      .where('o.service_target_id = :id', { id })
      .andWhere('o.status IN (:...st)', { st: blockingStatuses })
      .getCount();
    if (activeCount > 0) {
      throw new BadRequestException(
        `该服务对象仍有 ${activeCount} 条进行中订单，请先完成或取消后再删除档案`,
      );
    }

    const removed = await this.serviceTargetRepository.remove(target);
    try {
      await this.familyService.removeMemberForServiceTarget(id);
    } catch (err) {
      this.logger.warn(
        `removeMemberForServiceTarget(${id}) failed after delete: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return removed;
  }

  /** 按当日日期生成递增档案编号，格式：YYYYMMDD-NN */
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

  private buildHealthProfileObjectKey(userId: number, serviceTargetId: number) {
    return `generated/u${userId}_hp_${serviceTargetId}.html`;
  }

  private extractObjectPath(url?: string | null) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) {
      return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ''));
    }
    return url.replace(/^\/uploads\//, '').replace(/^\/+/, '');
  }

  private isStableHealthProfileObject(url: string, userId: number, serviceTargetId: number) {
    return (
      this.extractObjectPath(url) ===
      this.buildHealthProfileObjectKey(userId, serviceTargetId)
    );
  }

  private async ensureStableHealthProfileStorage(
    doc: Document,
    userId: number,
    serviceTargetId: number,
  ) {
    if (this.isStableHealthProfileObject(doc.url, userId, serviceTargetId)) {
      return doc;
    }

    const stableKey = this.buildHealthProfileObjectKey(userId, serviceTargetId);
    const file = await this.storageService.readObject(doc.url);
    const uploaded = await this.storageService.uploadBuffer(
      file.body,
      stableKey,
      file.contentType,
    );

    const legacyUrl = doc.url;
    doc.url = uploaded.url;
    const saved = await this.documentRepository.save(doc);
    if (legacyUrl && legacyUrl !== uploaded.url) {
      await this.storageService.deleteObject(legacyUrl);
    }
    return saved;
  }

  private withVersionQuery(url: string, version?: string | null) {
    if (!version) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }

  private buildHealthProfilePreviewToken(
    serviceTargetId: number,
    currentUserId: number,
    role?: string,
  ) {
    return this.jwtService.sign(
      {
        type: 'health_profile_preview',
        serviceTargetId,
        userId: currentUserId,
        role: role || '',
      },
      { expiresIn: '30m' },
    );
  }

  private buildHealthProfilePreviewUrl(
    serviceTargetId: number,
    currentUserId: number,
    role?: string,
    version?: string | null,
  ) {
    const token = this.buildHealthProfilePreviewToken(
      serviceTargetId,
      currentUserId,
      role,
    );
    return this.withVersionQuery(
      `/users/service-targets/${serviceTargetId}/health-profile-preview?token=${encodeURIComponent(token)}`,
      version,
    );
  }

  private verifyHealthProfilePreviewToken(serviceTargetId: number, token?: string) {
    if (!token) {
      throw new UnauthorizedException('预览令牌缺失');
    }

    const payload = this.jwtService.verify<{
      type?: string;
      serviceTargetId?: number;
      userId?: number;
      role?: string;
    }>(token);

    if (
      payload.type !== 'health_profile_preview' ||
      payload.serviceTargetId !== serviceTargetId ||
      !payload.userId
    ) {
      throw new UnauthorizedException('预览令牌无效');
    }

    return payload;
  }

  private async ensureHealthProfileDocument(
    id: number,
    currentUserId?: number,
    role?: string,
  ) {
    const { generateHealthProfileHtml: genHtml } =
      await import('../document/templates/health-profile.js');
    const t = await this.findServiceTargetById(id, currentUserId, role);
    const hp = this.parseHealthProfile(
      t.healthProfile as Record<string, unknown> | string | null,
    );

    const existingDoc = await this.documentRepository.findOne({
      where: { serviceTargetId: id, type: DocumentType.HEALTH_PROFILE },
    });

    const logoConfig = await this.systemConfigRepository.findOne({
      where: { key: 'store_logo' },
    });
    const logoUrl = await this.storageService.resolveUrl(logoConfig?.value || '');

    const customerIdCode = existingDoc?.archiveNo || await this.nextHealthProfileSeq();
    const signUrl = await this.storageService.resolveUrl(
      t.signatureUrl ||
      hp.signatureUrl ||
      hp.signUrl ||
      undefined,
    );
    const isSigned = !!signUrl;

    const html = genHtml({
      customerIdCode,
      name: t.name,
      gender: t.gender,
      age: t.age,
      idCard: t.idCard,
      phone: t.phone,
      emergencyContact: t.emergencyContact,
      emergencyPhone: t.emergencyPhone,
      emergencyRelation: hp.emergencyRelation,
      mainAppeal: t.mainAppeal,
      medicalHistory: hp.medicalHistory || [],
      medicalHistoryOther: hp.medicalHistoryOther,
      currentMedication: hp.currentMedications || hp.currentMedication,
      allergies: hp.allergies,
      mobilityStatus: hp.mobilityStatus,
      visionStatus: hp.visionStatus,
      hearingStatus: hp.hearingStatus,
      recentSymptoms: hp.recentSymptoms || [],
      otherHealthInfo: hp.otherHealthInfo,
      relation: hp.relation,
      fillMethod: hp.fillMethod || 'self',
      bloodType: hp.bloodType,
      signedBy: isSigned ? hp.signatureName || t.name : undefined,
      signDate: isSigned ? hp.signedAt || undefined : undefined,
      signUrl,
      logoUrl,
      maskSensitive: false,
    });

    const userId = t.userId as number;
    const objectKey = this.buildHealthProfileObjectKey(userId, id);
    const uploaded = await this.storageService.uploadBuffer(
      html,
      objectKey,
      'text/html; charset=utf-8',
    );

    const doc = existingDoc
      ? await this.documentRepository.save({
          ...existingDoc,
          archiveNo: customerIdCode,
          url: uploaded.url,
          fileName: `健康信息小档案_${t.name}.html`,
        })
      : await this.documentRepository.save(
          this.documentRepository.create({
            orderId: null,
            serviceTargetId: id,
            userId,
            archiveNo: customerIdCode,
            type: DocumentType.HEALTH_PROFILE,
            url: uploaded.url,
            fileName: `健康信息小档案_${t.name}.html`,
          }),
        );

    return {
      target: t,
      doc,
    };
  }

  async getHealthProfilePreview(id: number, token?: string) {
    let payload: {
      type?: string;
      serviceTargetId?: number;
      userId?: number;
      role?: string;
    };
    try {
      payload = this.verifyHealthProfilePreviewToken(id, token);
    } catch {
      throw new UnauthorizedException('预览链接已失效，请重新打开');
    }

    const { doc } = await this.ensureHealthProfileDocument(
      id,
      payload.userId,
      payload.role,
    );
    const file = await this.storageService.readObject(doc.url);

    return {
      body: file.body,
      contentType: file.contentType || 'text/html; charset=utf-8',
      fileName: doc.fileName || `健康信息小档案_${id}.html`,
    };
  }

  async generateHealthProfileHtml(
    id: number,
    currentUserId?: number,
    role?: string,
  ) {
    if (!currentUserId) {
      throw new UnauthorizedException('当前用户不存在');
    }

    const { target, doc } = await this.ensureHealthProfileDocument(
      id,
      currentUserId,
      role,
    );

    return {
      url: this.buildHealthProfilePreviewUrl(
        id,
        currentUserId,
        role,
        doc.archiveNo || String(doc.id),
      ),
      fileName: doc.fileName || `健康信息小档案_${target.name}.html`,
      archiveNo: doc.archiveNo,
    };
  }
}
