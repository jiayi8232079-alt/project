import { Injectable, BadRequestException, ForbiddenException, Logger, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, In, IsNull, Not } from 'typeorm';
import { FamilyGroup } from '../../entities/family-group.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { User } from '../../entities/user.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { MedicationReminder } from '../../entities/medication-reminder.entity.js';
import { Order } from '../../entities/order.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { DocumentService } from '../document/document.service.js';
import { deterministicHash } from '../../common/utils/column-encryption.js';

const DEFAULT_GUARDIAN_PERMISSIONS = {
  viewHealth: true,
  viewMedication: true,
  manageOrders: true,
  receiveAlerts: true,
};

const DEFAULT_MEMBER_PERMISSIONS = {
  viewHealth: false,
  viewMedication: false,
  manageOrders: false,
  receiveAlerts: false,
};

@Injectable()
export class FamilyService {
  private readonly logger = new Logger(FamilyService.name);
  private mpAccessTokenCache: { token: string; expiresAtMs: number } | null = null;
  // 同一 userId 在极短时间内（默认 30s）只真正跑一次 sync，避免 /family + /family/:id/members 叠加 N+1 次同步
  private syncCooldownAt = new Map<number, number>();
  private readonly SYNC_COOLDOWN_MS = 30_000;

  constructor(
    @InjectRepository(FamilyGroup)
    private readonly groupRepo: Repository<FamilyGroup>,
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(ServiceTarget)
    private readonly targetRepo: Repository<ServiceTarget>,
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepo: Repository<AdminUser>,
    @InjectRepository(SystemConfig)
    private readonly systemConfigRepo: Repository<SystemConfig>,
    @Inject(forwardRef(() => DocumentService))
    private readonly documentService: DocumentService,
    private readonly configService: ConfigService,
  ) {}

  private generateInviteCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async createFamily(userId: number, name: string) {
    let inviteCode = '';
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = this.generateInviteCode();
      const exists = await this.groupRepo.findOne({ where: { inviteCode: candidate } });
      if (!exists) {
        inviteCode = candidate;
        break;
      }
    }
    if (!inviteCode) {
      throw new BadRequestException('生成邀请码失败，请重试');
    }

    const group = await this.groupRepo.save(
      this.groupRepo.create({ name, inviteCode, createdBy: userId }),
    );

    await this.memberRepo.save(
      this.memberRepo.create({
        familyGroupId: group.id,
        userId,
        role: 'guardian',
        relation: 'self',
        nickname: null,
        permissions: DEFAULT_GUARDIAN_PERMISSIONS,
        joinedAt: new Date(),
      }),
    );

    return group;
  }

  async joinByInviteCode(userId: number, inviteCode: string, relation: string, nickname?: string) {
    const group = await this.groupRepo.findOne({ where: { inviteCode: inviteCode.toUpperCase() } });
    if (!group) throw new BadRequestException('邀请码无效');

    const existing = await this.memberRepo.findOne({ where: { familyGroupId: group.id, userId } });
    if (existing) throw new BadRequestException('您已经是该家庭的成员');

    const linkedId = await this.autoLinkServiceTarget(group.createdBy, userId);

    const member = await this.memberRepo.save(
      this.memberRepo.create({
        familyGroupId: group.id,
        userId,
        role: 'member',
        relation: relation || 'other',
        nickname: nickname || null,
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        joinedAt: new Date(),
        linkedServiceTargetId: linkedId,
      }),
    );

    return { group, member };
  }

  async joinByQrScan(userId: number, familyGroupId: number, relation: string, nickname?: string) {
    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new BadRequestException('家庭群组不存在');

    const existing = await this.memberRepo.findOne({ where: { familyGroupId, userId } });
    if (existing) throw new BadRequestException('您已经是该家庭的成员');

    const linkedId = await this.autoLinkServiceTarget(group.createdBy, userId);

    const member = await this.memberRepo.save(
      this.memberRepo.create({
        familyGroupId,
        userId,
        role: 'member',
        relation: relation || 'other',
        nickname: nickname || null,
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        joinedAt: new Date(),
        linkedServiceTargetId: linkedId,
      }),
    );

    return { group, member };
  }

  async getMyFamilies(userId: number) {
    // 在返回家庭列表前，顺带把当前账号名下所有 ServiceTarget 再同步一次，
    // 避免服务未重启、历史数据、规则变更等情况下看板缺条目。幂等。
    // force=true：绕过冷却期，确保新规则（self 档案挂 guardian）即时生效。
    try {
      await this.syncOwnedServiceTargetsToFamily(userId, { force: true });
    } catch (err) {
      this.logger.warn(
        `syncOwnedServiceTargetsToFamily(user=${userId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['familyGroup', 'familyGroup.creator'],
      order: { createdAt: 'DESC' },
    });

    if (!memberships.length) return [];

    // 一次性聚合所有家庭的成员数，避免 N 次 count
    const familyIds = Array.from(new Set(memberships.map((m) => m.familyGroupId)));
    const counts = await this.memberRepo
      .createQueryBuilder('fm')
      .select('fm.familyGroupId', 'familyGroupId')
      .addSelect('COUNT(1)', 'cnt')
      .where('fm.familyGroupId IN (:...ids)', { ids: familyIds })
      .groupBy('fm.familyGroupId')
      .getRawMany<{ familyGroupId: number | string; cnt: number | string }>();
    const countMap = new Map<number, number>(
      counts.map((c) => [Number(c.familyGroupId), Number(c.cnt)]),
    );

    return memberships.map((m) => ({
      ...m,
      memberCount: countMap.get(m.familyGroupId) ?? 0,
    }));
  }

  async getFamilyMembers(familyGroupId: number, userId: number) {
    await this.assertFamilyAccess(familyGroupId, userId);

    // 查询前按新规则再同步一次该家庭所有成员的 service_target：
    //  - guardian 对应的登录用户名下如有 self 档案，挂到 guardian
    //  - 其他成员按关系挂到各自占位成员
    // 目的是让小程序端实时看到 linkedServiceTargetId（否则要等 cooldown 过去）
    try {
      const members0 = await this.memberRepo.find({
        where: { familyGroupId },
        select: ['userId'],
      });
      const ownerIds = Array.from(
        new Set(members0.map((m) => m.userId).filter((x): x is number => !!x)),
      );
      for (const oid of ownerIds) {
        await this.syncOwnedServiceTargetsToFamily(oid, { force: true });
      }
    } catch (err) {
      this.logger.warn(
        `getFamilyMembers: pre-sync(${familyGroupId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const members = await this.memberRepo.find({
      where: { familyGroupId },
      relations: ['user'],
      order: { role: 'ASC', createdAt: 'ASC' },
    });

    // 附加关联的 ServiceTarget（年龄/性别/健康档案），便于前端看板直接展示
    const linkedIds = members
      .map((m) => m.linkedServiceTargetId)
      .filter((x): x is number => !!x);
    const targets = linkedIds.length
      ? await this.targetRepo.find({ where: { id: In(linkedIds) } })
      : [];
    const targetMap = new Map(targets.map((t) => [t.id, t]));
    return members.map((m) => ({
      ...m,
      serviceTarget: m.linkedServiceTargetId
        ? targetMap.get(m.linkedServiceTargetId) || null
        : null,
    }));
  }

  async getInviteCode(familyGroupId: number, userId: number) {
    const member = await this.memberRepo.findOne({ where: { familyGroupId, userId } });
    if (!member || member.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可查看邀请码');
    }
    const group = await this.groupRepo.findOneOrFail({ where: { id: familyGroupId } });
    return { inviteCode: group.inviteCode, familyGroupId: group.id, name: group.name };
  }

  async refreshInviteCode(familyGroupId: number, userId: number) {
    const member = await this.memberRepo.findOne({ where: { familyGroupId, userId } });
    if (!member || member.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可刷新邀请码');
    }
    const group = await this.groupRepo.findOneOrFail({ where: { id: familyGroupId } });
    group.inviteCode = this.generateInviteCode();
    return this.groupRepo.save(group);
  }

  /**
   * 更新家庭信息（名称 / 头像）。仅 guardian 可调。
   *  - `avatarUrl` 支持：preset:xxx 预设标识、图片 URL、空字符串（=清空为默认）
   */
  async updateFamilyInfo(
    familyGroupId: number,
    userId: number,
    dto: { name?: string; avatarUrl?: string | null },
  ) {
    const member = await this.memberRepo.findOne({ where: { familyGroupId, userId } });
    if (!member || member.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可修改家庭信息');
    }
    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new NotFoundException('家庭不存在');

    if (typeof dto.name === 'string') {
      const trimmed = dto.name.trim();
      if (!trimmed) throw new BadRequestException('家庭名称不能为空');
      if (trimmed.length > 30) throw new BadRequestException('家庭名称最长 30 个字');
      group.name = trimmed;
    }
    if (dto.avatarUrl !== undefined) {
      if (dto.avatarUrl === null || dto.avatarUrl === '') {
        group.avatarUrl = null;
      } else {
        const v = String(dto.avatarUrl).trim();
        if (v.length > 500) throw new BadRequestException('头像地址过长');
        group.avatarUrl = v;
      }
    }
    return this.groupRepo.save(group);
  }

  async getFamilyMemberHealth(guardianUserId: number, memberUserId: number) {
    await this.assertGuardianAccess(guardianUserId, memberUserId, 'viewHealth');

    const targets = await this.targetRepo.find({
      where: { userId: memberUserId },
      order: { createdAt: 'DESC' },
    });

    const user = await this.userRepo.findOne({ where: { id: memberUserId } });

    return {
      user: user ? { id: user.id, nickname: user.nickname, avatarUrl: user.avatarUrl, phone: user.phone, uiMode: user.uiMode } : null,
      serviceTargets: targets,
    };
  }

  async getFamilyMemberMedications(guardianUserId: number, memberUserId: number) {
    await this.assertGuardianAccess(guardianUserId, memberUserId, 'viewMedication');

    return this.reminderRepo.find({
      where: { userId: memberUserId, status: In(['active', 'paused']) },
      relations: ['serviceTarget'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFamilyMemberOrders(guardianUserId: number, memberUserId: number, query: { page?: number; pageSize?: number } = {}) {
    await this.assertGuardianAccess(guardianUserId, memberUserId, 'manageOrders');

    const { page = 1, pageSize = 20 } = query;
    const [items, total] = await this.orderRepo.findAndCount({
      where: { userId: memberUserId },
      relations: ['serviceTarget', 'attendant'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  async updateMember(familyGroupId: number, memberId: number, operatorUserId: number, dto: { nickname?: string; permissions?: any; role?: string }) {
    const operator = await this.memberRepo.findOne({ where: { familyGroupId, userId: operatorUserId } });
    if (!operator || operator.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可修改成员信息');
    }

    const member = await this.memberRepo.findOne({ where: { id: memberId, familyGroupId } });
    if (!member) throw new NotFoundException('成员不存在');

    if (dto.nickname !== undefined) member.nickname = dto.nickname;
    if (dto.permissions) member.permissions = { ...member.permissions, ...dto.permissions };
    if (dto.role && (dto.role === 'guardian' || dto.role === 'member')) {
      member.role = dto.role;
    }
    return this.memberRepo.save(member);
  }

  async removeMember(familyGroupId: number, memberId: number, operatorUserId: number) {
    const operator = await this.memberRepo.findOne({ where: { familyGroupId, userId: operatorUserId } });
    if (!operator || operator.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可移除成员');
    }
    const member = await this.memberRepo.findOne({ where: { id: memberId, familyGroupId } });
    if (!member) throw new NotFoundException('成员不存在');
    if (member.userId === operatorUserId) throw new BadRequestException('不能移除自己');

    await this.memberRepo.remove(member);
    return { success: true };
  }

  /** 检查 guardianUserId 是否有权限查看 memberUserId 的数据 */
  async isGuardianOf(guardianUserId: number, memberUserId: number, permission?: string): Promise<boolean> {
    if (guardianUserId === memberUserId) return true;

    const guardianMemberships = await this.memberRepo.find({
      where: { userId: guardianUserId, role: 'guardian' },
    });

    for (const gm of guardianMemberships) {
      const targetMember = await this.memberRepo.findOne({
        where: { familyGroupId: gm.familyGroupId, userId: memberUserId },
      });
      if (targetMember) {
        if (!permission) return true;
        const perms = gm.permissions || DEFAULT_GUARDIAN_PERMISSIONS;
        return !!(perms as any)[permission];
      }
    }
    return false;
  }

  /** 获取某用户的所有 guardian 用户ID */
  async getGuardianUserIds(memberUserId: number): Promise<number[]> {
    const memberships = await this.memberRepo.find({
      where: { userId: memberUserId },
    });

    const guardianIds: number[] = [];
    for (const m of memberships) {
      const guardians = await this.memberRepo.find({
        where: { familyGroupId: m.familyGroupId, role: 'guardian' },
      });
      for (const g of guardians) {
        if (g.userId === null) continue;
        if (g.userId !== memberUserId && !guardianIds.includes(g.userId)) {
          guardianIds.push(g.userId);
        }
      }
    }
    return guardianIds;
  }

  // ─── admin ─────────────────────────────────────────────────

  async adminGetAllGroups(query: { page?: number; pageSize?: number }) {
    const { page = 1, pageSize = 20 } = query;
    const [items, total] = await this.groupRepo.findAndCount({
      relations: ['creator'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const result = [];
    for (const g of items) {
      const memberCount = await this.memberRepo.count({ where: { familyGroupId: g.id } });
      result.push({ ...g, memberCount });
    }
    return { items: result, total, page, pageSize };
  }

  /**
   * 后台：按目标用户拉取其用药提醒（不校验调用者是否为该用户的 guardian，
   * 仅依赖控制器层 RolesGuard）。返回结构与 C 端 getFamilyMemberMedications 对齐。
   */
  async adminGetMemberMedications(memberUserId: number) {
    return this.reminderRepo.find({
      where: { userId: memberUserId, status: In(['active', 'paused']) },
      relations: ['serviceTarget'],
      order: { createdAt: 'DESC' },
    });
  }

  /** 后台：按目标用户拉取订单（与 C 端 getFamilyMemberOrders 同形态） */
  async adminGetMemberOrders(
    memberUserId: number,
    query: { page?: number; pageSize?: number } = {},
  ) {
    const { page = 1, pageSize = 20 } = query;
    const [items, total] = await this.orderRepo.findAndCount({
      where: { userId: memberUserId },
      relations: ['serviceTarget', 'attendant'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { items, total, page, pageSize };
  }

  /** 后台查看任意家庭的成员列表（不校验当前用户是否为家庭成员） */
  async adminGetFamilyMembers(familyGroupId: number) {
    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new NotFoundException('家庭不存在');

    const members = await this.memberRepo.find({
      where: { familyGroupId },
      relations: ['user'],
      order: { role: 'ASC', createdAt: 'ASC' },
    });

    const linkedIds = members
      .map((m) => m.linkedServiceTargetId)
      .filter((x): x is number => !!x);
    const targets = linkedIds.length
      ? await this.targetRepo.find({ where: { id: In(linkedIds) } })
      : [];
    const targetMap = new Map(targets.map((t) => [t.id, t]));

    return members.map((m) => ({
      ...m,
      serviceTarget: m.linkedServiceTargetId
        ? targetMap.get(m.linkedServiceTargetId) || null
        : null,
    }));
  }

  /**
   * 后台修改家庭成员信息（不校验调用者是否为家庭成员，仅依赖控制器层 RolesGuard）。
   * 可改字段：nickname / relation / placeholderName / isElder / role / permissions
   */
  async adminUpdateFamilyMember(
    familyGroupId: number,
    memberId: number,
    dto: {
      nickname?: string;
      relation?: string;
      placeholderName?: string;
      isElder?: boolean;
      role?: 'guardian' | 'member';
      permissions?: Partial<typeof DEFAULT_GUARDIAN_PERMISSIONS>;
    },
  ) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, familyGroupId },
    });
    if (!member) throw new NotFoundException('成员不存在');

    if (dto.nickname !== undefined) {
      const v = String(dto.nickname || '').trim();
      if (v.length > 50) throw new BadRequestException('昵称最长 50 个字');
      member.nickname = v || null;
    }
    if (dto.relation !== undefined) {
      const v = String(dto.relation || '').trim();
      if (v.length > 16) throw new BadRequestException('关系字段过长');
      member.relation = v || null;
    }
    if (dto.placeholderName !== undefined) {
      const v = String(dto.placeholderName || '').trim();
      if (v.length > 64) throw new BadRequestException('占位姓名最长 64 个字');
      member.placeholderName = v || null;
    }
    if (typeof dto.isElder === 'boolean') {
      member.isElder = dto.isElder;
    }
    if (dto.role && (dto.role === 'guardian' || dto.role === 'member')) {
      member.role = dto.role;
    }
    if (dto.permissions) {
      member.permissions = { ...(member.permissions || {}), ...dto.permissions };
    }
    return this.memberRepo.save(member);
  }

  /**
   * 后台：为指定家庭成员"新建健康档案并绑定"。
   * 档案的 owner 选择规则：
   *  - 成员有 userId（已登录用户）→ 归属该 userId
   *  - 成员是占位老人（userId 为空）→ 归属家庭创建者（guardian）
   * 创建后会把新档案 id 写到 member.linkedServiceTargetId。
   * 返回新建档案与更新后的 member。
   */
  async adminCreateAndBindServiceTarget(
    familyGroupId: number,
    memberId: number,
    dto: { name: string; gender?: string; age?: number; relationship?: string },
  ) {
    const name = String(dto?.name || '').trim();
    if (!name) throw new BadRequestException('请填写老人姓名');
    if (name.length > 30) throw new BadRequestException('姓名最长 30 个字');

    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new NotFoundException('家庭不存在');

    const member = await this.memberRepo.findOne({
      where: { id: memberId, familyGroupId },
    });
    if (!member) throw new NotFoundException('成员不存在');

    const ownerUserId = member.userId ?? group.createdBy;
    if (!ownerUserId) {
      throw new BadRequestException('无法确定档案所属用户，请先确保家庭有创建者');
    }

    const healthProfile: Record<string, unknown> = {};
    if (dto.relationship) healthProfile.relationship = dto.relationship;

    const created = this.targetRepo.create({
      userId: ownerUserId,
      name,
      gender: dto.gender || undefined,
      age: dto.age || undefined,
      healthProfile: Object.keys(healthProfile).length ? healthProfile : undefined,
    });
    const saved = await this.targetRepo.save(created);

    member.linkedServiceTargetId = saved.id;
    if (!member.placeholderName) {
      member.placeholderName = name;
    }
    if (!member.nickname) {
      member.nickname = name;
    }
    await this.memberRepo.save(member);

    return { serviceTarget: saved, member };
  }

  async adminBindFamily(userId1: number, userId2: number, relation: string, familyName: string) {
    const group = await this.createFamily(userId1, familyName);
    await this.joinByQrScan(userId2, group.id, relation);
    return group;
  }

  /**
   * 后台：按 userId 查询其参与的全部家庭 + 每个家庭的完整成员（含占位老人）+ 每个成员关联的 ServiceTarget。
   * 在客户详情页的"家庭"Tab 使用，一次性提供："这个客户名下有几个家庭、家庭里有谁、每人关联的老人档案是哪条"。
   */
  async adminGetUserFamilies(userId: number) {
    // 管理端访问客户家庭时，先按"新规则"同步一次：保证该客户名下的健康档案
    // （尤其是本人档案）都挂到对应家庭成员的 linkedServiceTargetId 上。
    try {
      await this.syncOwnedServiceTargetsToFamily(userId, { force: true });
    } catch (err) {
      this.logger.warn(
        `adminGetUserFamilies: pre-sync(${userId}) failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const memberships = await this.memberRepo.find({
      where: { userId },
      relations: ['familyGroup', 'familyGroup.creator'],
      order: { createdAt: 'DESC' },
    });
    if (!memberships.length) return { families: [] };

    const result: any[] = [];
    for (const m of memberships) {
      const group = m.familyGroup;
      if (!group) continue;
      const allMembers = await this.memberRepo.find({
        where: { familyGroupId: group.id },
        relations: ['user'],
        order: { role: 'ASC', createdAt: 'ASC' },
      });

      const enriched = [];
      for (const mm of allMembers) {
        let serviceTarget: ServiceTarget | null = null;
        if (mm.linkedServiceTargetId) {
          serviceTarget = await this.targetRepo.findOne({
            where: { id: mm.linkedServiceTargetId },
          });
        }
        enriched.push({
          id: mm.id,
          userId: mm.userId,
          role: mm.role,
          relation: mm.relation,
          nickname: mm.nickname,
          isElder: mm.isElder,
          isPlaceholder: !mm.userId,
          placeholderName: mm.placeholderName,
          placeholderPhone: mm.placeholderPhone,
          linkedServiceTargetId: mm.linkedServiceTargetId,
          joinedAt: mm.joinedAt,
          user: mm.user
            ? {
                id: mm.user.id,
                nickname: mm.user.nickname,
                avatarUrl: mm.user.avatarUrl,
                phone: mm.user.phone,
              }
            : null,
          serviceTarget: serviceTarget
            ? {
                id: serviceTarget.id,
                name: serviceTarget.name,
                age: serviceTarget.age,
                gender: serviceTarget.gender,
                phone: serviceTarget.phone,
                isTrust: serviceTarget.isTrust,
                trustDocUrl: serviceTarget.trustDocUrl,
                delegatorRelation: serviceTarget.delegatorRelation,
              }
            : null,
        });
      }

      // 解析专属客服
      let assignedCs: { id: number; realName: string; phone: string } | null = null;
      if (group.assignedCsAdminId) {
        const admin = await this.adminUserRepo.findOne({ where: { id: group.assignedCsAdminId } });
        if (admin) {
          assignedCs = {
            id: admin.id,
            realName: admin.realName || admin.username,
            phone: admin.phone || '',
          };
        }
      }

      result.push({
        id: group.id,
        name: group.name,
        avatarUrl: group.avatarUrl,
        inviteCode: group.inviteCode,
        createdAt: group.createdAt,
        createdBy: group.createdBy,
        creator: group.creator
          ? {
              id: group.creator.id,
              nickname: group.creator.nickname,
              avatarUrl: group.creator.avatarUrl,
            }
          : null,
        currentUserRole: m.role,
        assignedCs,
        members: enriched,
      });
    }

    return { families: result };
  }

  /** 后台：为某个家庭分配/取消专属客服 */
  async adminAssignCs(familyGroupId: number, adminId: number | null) {
    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new NotFoundException('家庭不存在');

    if (adminId !== null) {
      const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
      if (!admin) throw new NotFoundException('客服账号不存在');
    }

    group.assignedCsAdminId = adminId;
    await this.groupRepo.save(group);
    return { success: true, assignedCsAdminId: adminId };
  }

  // ─── 老人托管（子女代建 + 占位 + 委托协议） ────────────────────

  /**
   * 子女（guardian）在自己的家庭组内添加一位老人。
   *
   * - 同时写入 `service_targets`（挂在子女 userId 下）和 `family_members`（占位记录，userId=null）
   * - 若提供手机号：校验全局唯一（F 决策：一位老人只能被一个家庭绑定）
   * - `delegatorRelation === 'child'` 时：老人处于「待委托」状态，子女后续需调 `signElderTrust` 完成电子签署
   * - `delegatorRelation === 'self'`（老人本人创建/签署）时：由调用方自行处理健康档案签署流程，委托字段保持未设
   */
  async createElder(
    guardianUserId: number,
    familyGroupId: number,
    dto: {
      name: string;
      phone?: string;
      idCard?: string;
      gender?: string;
      age?: number;
      relation: string;
      homeAddress?: string;
      emergencyContact?: string;
      emergencyPhone?: string;
      healthProfile?: Record<string, unknown>;
      delegatorRelation: 'self' | 'child' | 'spouse' | 'other';
    },
  ) {
    const guardianMember = await this.memberRepo.findOne({
      where: { familyGroupId, userId: guardianUserId, role: 'guardian' },
    });
    if (!guardianMember) {
      throw new ForbiddenException('仅管理者可添加家庭成员');
    }

    const phoneHash = dto.phone ? deterministicHash(dto.phone) : null;

    // 手机号全局唯一性校验：同一位老人不能被两个家庭绑定
    let reuseTarget: ServiceTarget | null = null;
    if (phoneHash) {
      const existPlaceholder = await this.memberRepo.findOne({
        where: { placeholderPhoneHash: phoneHash, isElder: true },
      });
      if (existPlaceholder) {
        throw new BadRequestException('该手机号老人已被其他家庭绑定');
      }
      const existTarget = await this.targetRepo.findOne({
        where: { phoneHash },
      });
      if (existTarget) {
        if (existTarget.userId !== guardianUserId) {
          throw new BadRequestException('该手机号已被其他账号建档，请联系客服');
        }
        // 复用：guardian 自己账号下已有 ServiceTarget，避免重复建档
        reuseTarget = existTarget;
      }
    }

    // 创建或复用 ServiceTarget（挂在子女账号下）
    let target: ServiceTarget;
    if (reuseTarget) {
      // 仅补齐缺失字段，不覆盖已有数据
      reuseTarget.name = reuseTarget.name || dto.name;
      if (!reuseTarget.gender && dto.gender) reuseTarget.gender = dto.gender;
      if (!reuseTarget.age && dto.age) reuseTarget.age = dto.age;
      if (!reuseTarget.idCard && dto.idCard) reuseTarget.idCard = dto.idCard;
      if (!reuseTarget.homeAddress && dto.homeAddress) reuseTarget.homeAddress = dto.homeAddress;
      if (!reuseTarget.emergencyContact && dto.emergencyContact) reuseTarget.emergencyContact = dto.emergencyContact;
      if (!reuseTarget.emergencyPhone && dto.emergencyPhone) reuseTarget.emergencyPhone = dto.emergencyPhone;
      reuseTarget.healthProfile = {
        ...((reuseTarget.healthProfile || {}) as Record<string, unknown>),
        ...(dto.healthProfile || {}),
        relationship: dto.relation,
      };
      if (!reuseTarget.delegatorRelation) reuseTarget.delegatorRelation = dto.delegatorRelation;
      if (dto.delegatorRelation === 'self' && !reuseTarget.isTrust) reuseTarget.isTrust = true;
      target = await this.targetRepo.save(reuseTarget);
    } else {
      target = await this.targetRepo.save(
        this.targetRepo.create({
          userId: guardianUserId,
          name: dto.name,
          phone: dto.phone,
          phoneHash,
          idCard: dto.idCard,
          gender: dto.gender,
          age: dto.age,
          homeAddress: dto.homeAddress,
          emergencyContact: dto.emergencyContact,
          emergencyPhone: dto.emergencyPhone,
          healthProfile: {
            ...(dto.healthProfile || {}),
            relationship: dto.relation,
          },
          delegatorRelation: dto.delegatorRelation,
          isTrust: dto.delegatorRelation === 'self' ? true : false,
        }),
      );
    }

    // 创建家庭成员占位记录（userId=null，未来老人登录时回填）
    const member = await this.memberRepo.save(
      this.memberRepo.create({
        familyGroupId,
        userId: null,
        role: 'member',
        relation: dto.relation,
        nickname: dto.name,
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        joinedAt: new Date(),
        linkedServiceTargetId: target.id,
        placeholderName: dto.name,
        placeholderPhone: dto.phone || null,
        placeholderPhoneHash: phoneHash,
        placeholderIdCard: dto.idCard || null,
        isElder: true,
      }),
    );

    return { serviceTarget: target, familyMember: member };
  }

  /** 编辑老人占位档案（同时更新 ServiceTarget 与 FamilyMember 的同步字段） */
  async updateElder(
    guardianUserId: number,
    familyGroupId: number,
    memberId: number,
    dto: Partial<{
      name: string;
      phone: string;
      idCard: string;
      gender: string;
      age: number;
      relation: string;
      homeAddress: string;
      emergencyContact: string;
      emergencyPhone: string;
      healthProfile: Record<string, unknown>;
    }>,
  ) {
    const guardianMember = await this.memberRepo.findOne({
      where: { familyGroupId, userId: guardianUserId, role: 'guardian' },
    });
    if (!guardianMember) throw new ForbiddenException('仅管理者可编辑老人档案');

    const member = await this.memberRepo.findOne({
      where: { id: memberId, familyGroupId, isElder: true },
    });
    if (!member) throw new NotFoundException('老人档案不存在');

    if (dto.phone !== undefined && dto.phone !== null) {
      const newHash = deterministicHash(dto.phone);
      if (newHash && newHash !== member.placeholderPhoneHash) {
        const duplicate = await this.memberRepo.findOne({
          where: {
            placeholderPhoneHash: newHash,
            isElder: true,
            id: Not(memberId),
          },
        });
        if (duplicate) throw new BadRequestException('该手机号老人已被其他家庭绑定');
      }
      member.placeholderPhone = dto.phone;
      member.placeholderPhoneHash = newHash;
    }
    if (dto.name !== undefined) {
      member.placeholderName = dto.name;
      member.nickname = dto.name;
    }
    if (dto.idCard !== undefined) member.placeholderIdCard = dto.idCard;
    if (dto.relation !== undefined) member.relation = dto.relation;
    await this.memberRepo.save(member);

    if (member.linkedServiceTargetId) {
      const target = await this.targetRepo.findOne({
        where: { id: member.linkedServiceTargetId, userId: guardianUserId },
      });
      if (target) {
        if (dto.name !== undefined) target.name = dto.name;
        if (dto.phone !== undefined) {
          target.phone = dto.phone;
          target.phoneHash = deterministicHash(dto.phone);
        }
        if (dto.idCard !== undefined) target.idCard = dto.idCard;
        if (dto.gender !== undefined) target.gender = dto.gender;
        if (dto.age !== undefined) target.age = dto.age;
        if (dto.homeAddress !== undefined) target.homeAddress = dto.homeAddress;
        if (dto.emergencyContact !== undefined) target.emergencyContact = dto.emergencyContact;
        if (dto.emergencyPhone !== undefined) target.emergencyPhone = dto.emergencyPhone;
        if (dto.healthProfile !== undefined || dto.relation !== undefined) {
          const targetHealthProfile = (target.healthProfile || {}) as Record<string, unknown>;
          target.healthProfile = {
            ...targetHealthProfile,
            ...(dto.healthProfile || {}),
            relationship: dto.relation !== undefined
              ? dto.relation
              : targetHealthProfile.relationship,
          };
        }
        await this.targetRepo.save(target);
      }
    }

    return { success: true };
  }

  /** 移除家庭中的老人（同时删除 FamilyMember 占位记录；ServiceTarget 保留备查） */
  async removeElder(
    guardianUserId: number,
    familyGroupId: number,
    memberId: number,
  ) {
    const guardianMember = await this.memberRepo.findOne({
      where: { familyGroupId, userId: guardianUserId, role: 'guardian' },
    });
    if (!guardianMember) throw new ForbiddenException('仅管理者可移除老人档案');

    const member = await this.memberRepo.findOne({
      where: { id: memberId, familyGroupId, isElder: true },
    });
    if (!member) throw new NotFoundException('老人档案不存在');

    await this.memberRepo.remove(member);
    return { success: true };
  }

  /**
   * 子女提交电子签名，完成「老人托管服务委托书」签署。
   *
   * 调用前：小程序应通过 `POST /documents/raw-upload` 或 `POST /public/signature-upload`
   * 上传子女的手写签名图片，拿到 signatureUrl 后再调本接口。
   */
  async signElderTrust(
    guardianUserId: number,
    memberId: number,
    dto: {
      signatureUrl: string;
      signerName: string;
      signerPhone?: string;
      signerIdCard?: string;
      signerRelation?: string;
    },
  ) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, isElder: true },
    });
    if (!member) throw new NotFoundException('老人档案不存在');

    // 校验当前用户是该家庭的 guardian
    const guardian = await this.memberRepo.findOne({
      where: {
        familyGroupId: member.familyGroupId,
        userId: guardianUserId,
        role: 'guardian',
      },
    });
    if (!guardian) throw new ForbiddenException('仅管理者可签署委托协议');

    if (!member.linkedServiceTargetId) {
      throw new BadRequestException('老人档案尚未关联服务对象');
    }
    const target = await this.targetRepo.findOne({
      where: { id: member.linkedServiceTargetId, userId: guardianUserId },
    });
    if (!target) throw new NotFoundException('关联的服务对象不存在');

    if (!dto.signatureUrl) throw new BadRequestException('签名图缺失');
    if (!dto.signerName) throw new BadRequestException('签署人姓名缺失');

    const signedAt = new Date();
    const docUrl = await this.documentService.generateElderTrustDocument({
      serviceTargetId: target.id,
      customerName: target.name,
      customerIdCard: target.idCard,
      customerPhone: target.phone,
      signerName: dto.signerName,
      signerRelation: dto.signerRelation || '子女',
      signerPhone: dto.signerPhone,
      signerIdCard: dto.signerIdCard,
      signatureUrl: dto.signatureUrl,
      signedAt,
    });

    target.isTrust = true;
    target.trustDocUrl = docUrl;
    target.trustSignedAt = signedAt;
    target.trustSignerName = dto.signerName;
    target.signatureUrl = dto.signatureUrl;
    if (!target.delegatorRelation) target.delegatorRelation = 'child';
    await this.targetRepo.save(target);

    return { success: true, trustDocUrl: docUrl, trustSignedAt: signedAt };
  }

  /**
   * 老人端登录成功后：若当前用户手机号命中某条占位 FamilyMember 记录，
   * 自动回填 userId + linked_service_target_id，让老人立即出现在对应家庭内。
   *
   * 返回值用于决定前端是否 reLaunch 到大字体老人端页面。
   */
  async claimPlaceholderByPhone(
    userId: number,
    phone: string | null | undefined,
  ): Promise<{ isElder: boolean; familyGroupId?: number; serviceTargetId?: number }> {
    if (!phone) return { isElder: false };
    const phoneHash = deterministicHash(phone);
    if (!phoneHash) return { isElder: false };

    const placeholder = await this.memberRepo.findOne({
      where: {
        placeholderPhoneHash: phoneHash,
        userId: IsNull(),
        isElder: true,
      },
    });
    if (!placeholder) return { isElder: false };

    placeholder.userId = userId;
    placeholder.joinedAt = new Date();
    // 成功认领后清除占位字段，后续以 userId 为准
    placeholder.placeholderPhone = null;
    placeholder.placeholderPhoneHash = null;
    await this.memberRepo.save(placeholder);

    return {
      isElder: true,
      familyGroupId: placeholder.familyGroupId,
      serviceTargetId: placeholder.linkedServiceTargetId || undefined,
    };
  }

  /**
   * 确保指定用户拥有一个 guardian 家庭组；若没有则自动创建一个默认家庭。
   * 幂等：已存在 guardian 家庭则直接返回第一个，不重复创建。
   */
  async ensureDefaultFamily(userId: number): Promise<FamilyGroup> {
    const existing = await this.memberRepo.findOne({
      where: { userId, role: 'guardian' },
      relations: ['familyGroup'],
      order: { createdAt: 'ASC' },
    });
    if (existing?.familyGroup) return existing.familyGroup;

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const name = user?.nickname ? `${user.nickname}的家庭` : '我的家庭';
    return this.createFamily(userId, name);
  }

  private parseTargetHealthProfile(target: ServiceTarget): Record<string, any> {
    const raw = target.healthProfile;
    if (!raw) return {};
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw || '{}');
      } catch {
        return {};
      }
    }
    return raw as Record<string, any>;
  }

  private getServiceTargetRelation(target: ServiceTarget): string {
    const hp = this.parseTargetHealthProfile(target);
    const relation = typeof hp.relationship === 'string' ? hp.relationship.trim() : '';
    if (relation !== 'parent') return relation;
    if (target.gender === 'male') return 'father';
    if (target.gender === 'female') return 'mother';
    return 'parent';
  }

  /**
   * 幂等同步：确保某个 ServiceTarget 按「家庭成员」视角同步到家庭。
   *
   * 新规则（所有健康档案都归属家庭成员）：
   *  - `relationship === 'self'`：挂在 owner 自己的家庭成员记录上
   *      · 如果 owner 是某家庭的 guardian，优先挂 guardian
   *      · 否则挂 owner 作为 member 加入的家庭（如：只是加入别人的家庭）
   *      · 如果 owner 还没任何家庭关系，自动创建默认家庭并挂 guardian
   *  - 其他关系：在 owner 的默认家庭里创建或复用占位成员（isElder）
   *
   * 调用时机：
   *  - 用户/后台创建或更新 ServiceTarget 成功后（自动同步）
   *  - 启动回溯脚本对历史数据补齐
   */
  async ensureMemberForServiceTarget(serviceTargetId: number): Promise<void> {
    const target = await this.targetRepo.findOne({ where: { id: serviceTargetId } });
    if (!target) return;
    const ownerUserId = target.userId;
    if (!ownerUserId) return;
    const relationship = this.getServiceTargetRelation(target);
    const isSelf = relationship === 'self';
    const phoneHash = target.phone ? deterministicHash(target.phone) : null;

    // 收集"当前已经链接到该 ST"的成员记录（可能 0 条或 1 条）
    let existingLink = await this.memberRepo.findOne({
      where: { linkedServiceTargetId: serviceTargetId },
    });

    // ══ self 档案：挂在 owner 在某个家庭里的"自己的"成员条目上 ══
    if (isSelf) {
      // 优先找 owner 作为 guardian 的成员条目（自己创建/管理的家庭）
      let selfMember = await this.memberRepo.findOne({
        where: { userId: ownerUserId, role: 'guardian' },
        order: { createdAt: 'ASC' },
      });
      // 否则，找 owner 作为 member 加入的家庭里的成员条目
      if (!selfMember) {
        selfMember = await this.memberRepo.findOne({
          where: { userId: ownerUserId, role: 'member' },
          order: { createdAt: 'ASC' },
        });
      }
      // 都没有（用户还没有任何家庭）→ 建默认家庭，再找 guardian
      if (!selfMember) {
        const group = await this.ensureDefaultFamily(ownerUserId);
        selfMember = await this.memberRepo.findOne({
          where: { familyGroupId: group.id, userId: ownerUserId, role: 'guardian' },
        });
      }
      if (!selfMember) return;

      // 如果之前错挂在其他成员上，先解除
      if (existingLink && existingLink.id !== selfMember.id) {
        if (existingLink.userId === null) {
          await this.memberRepo.remove(existingLink);
        } else {
          existingLink.linkedServiceTargetId = null;
          await this.memberRepo.save(existingLink);
        }
      }

      if (selfMember.linkedServiceTargetId !== serviceTargetId) {
        selfMember.linkedServiceTargetId = serviceTargetId;
        if (target.name && !selfMember.nickname) selfMember.nickname = target.name;
        selfMember.relation = 'self';
        await this.memberRepo.save(selfMember);
      }
      if (phoneHash && !target.phoneHash) {
        target.phoneHash = phoneHash;
        await this.targetRepo.save(target);
      }
      return;
    }

    // ══ 非 self 档案：在 owner 默认家庭里创建/复用占位成员 ══
    // 先确保默认家庭存在（monitor: 非 self 档案代表给家人建档，需要挂到某个家庭）
    const group = await this.ensureDefaultFamily(ownerUserId);

    if (existingLink?.role === 'guardian') {
      existingLink.linkedServiceTargetId = null;
      await this.memberRepo.save(existingLink);
      existingLink = null;
    }

    if (existingLink && existingLink.userId !== null) {
      if (relationship) {
        existingLink.relation = relationship;
      }
      existingLink.linkedServiceTargetId = serviceTargetId;
      await this.memberRepo.save(existingLink);
      return;
    }

    const memberRelation = relationship || 'other';

    if (existingLink) {
      existingLink.familyGroupId = group.id;
      existingLink.role = 'member';
      existingLink.relation = memberRelation;
      existingLink.nickname = target.name;
      existingLink.permissions = DEFAULT_MEMBER_PERMISSIONS;
      existingLink.joinedAt = existingLink.joinedAt || new Date();
      existingLink.linkedServiceTargetId = serviceTargetId;
      existingLink.placeholderName = target.name;
      existingLink.placeholderPhone = target.phone || null;
      existingLink.placeholderPhoneHash = phoneHash;
      existingLink.placeholderIdCard = target.idCard || null;
      existingLink.isElder = true;
      await this.memberRepo.save(existingLink);
      if (phoneHash && !target.phoneHash) {
        target.phoneHash = phoneHash;
        await this.targetRepo.save(target);
      }
      return;
    }

    // 手机号占位去重：如果已有相同 phone_hash 的 placeholder（极端情况下），合并而不是创建新的
    if (phoneHash) {
      const duplicate = await this.memberRepo.findOne({
        where: { placeholderPhoneHash: phoneHash, isElder: true, userId: IsNull() },
      });
      if (duplicate && duplicate.familyGroupId === group.id) {
        duplicate.linkedServiceTargetId = serviceTargetId;
        duplicate.relation = memberRelation;
        duplicate.nickname = target.name;
        duplicate.placeholderName = target.name;
        duplicate.placeholderPhone = target.phone || null;
        duplicate.placeholderPhoneHash = phoneHash;
        duplicate.placeholderIdCard = target.idCard || null;
        await this.memberRepo.save(duplicate);
        if (phoneHash && !target.phoneHash) {
          target.phoneHash = phoneHash;
          await this.targetRepo.save(target);
        }
        return;
      }
    }

    await this.memberRepo.save(
      this.memberRepo.create({
        familyGroupId: group.id,
        userId: null,
        role: 'member',
        relation: memberRelation,
        nickname: target.name,
        permissions: DEFAULT_MEMBER_PERMISSIONS,
        joinedAt: new Date(),
        linkedServiceTargetId: serviceTargetId,
        placeholderName: target.name,
        placeholderPhone: target.phone || null,
        placeholderPhoneHash: phoneHash,
        placeholderIdCard: target.idCard || null,
        isElder: true,
      }),
    );

    // 顺便把 phone_hash 写入 ServiceTarget，便于未来老人登录认领
    if (phoneHash && !target.phoneHash) {
      target.phoneHash = phoneHash;
      await this.targetRepo.save(target);
    }
  }

  /**
   * 同步当前账号下所有 ServiceTarget 到其家庭：
   *  - 清理错挂的 linkedServiceTargetId（guardian 误绑非本人档案、非 guardian 误绑本人档案）
   *  - 对每条档案调用 ensureMemberForServiceTarget 补齐占位/归属
   * 幂等，适合每次用户访问家庭页时调用。
   */
  async syncOwnedServiceTargetsToFamily(
    userId: number,
    options: { force?: boolean } = {},
  ): Promise<void> {
    if (!userId) return;
    const now = Date.now();
    const lastAt = this.syncCooldownAt.get(userId) || 0;
    if (!options.force && now - lastAt < this.SYNC_COOLDOWN_MS) {
      // 冷却期内复用上一次同步结果
      return;
    }
    // 先占位冷却时间戳，避免并发请求在本次尚未完成前重复进入
    this.syncCooldownAt.set(userId, now);
    const targets = await this.targetRepo.find({ where: { userId } });
    if (!targets.length) return;

    // 1. 仅扫描"当前用户的 ServiceTarget 可能挂错的 family_member"，避免全表扫描
    const targetIds = targets.map((t) => t.id);
    const suspectMembers = targetIds.length
      ? await this.memberRepo.find({
          where: { linkedServiceTargetId: In(targetIds) },
        })
      : [];
    const targetMap = new Map(targets.map((t) => [t.id, t]));
    const toFix: FamilyMember[] = [];
    for (const m of suspectMembers) {
      if (!m.linkedServiceTargetId) continue;
      const target = targetMap.get(m.linkedServiceTargetId);
      if (!target) continue;
      const relation = this.getServiceTargetRelation(target);
      const isSelf = relation === 'self';
      if (isSelf) {
        // self 档案必须挂在档案所有者本人的成员条目上（guardian 或 member 均可）
        if (m.userId !== target.userId) {
          m.linkedServiceTargetId = null;
          toFix.push(m);
        }
      } else if (m.role === 'guardian') {
        // 非 self 档案不应挂在 guardian 上（应挂在占位/认领成员上）
        m.linkedServiceTargetId = null;
        toFix.push(m);
      }
    }
    if (toFix.length) {
      await this.memberRepo.save(toFix);
    }

    // 2. 对每一个 ServiceTarget 确保有正确的 family_member 记录
    for (const t of targets) {
      try {
        await this.ensureMemberForServiceTarget(t.id);
      } catch (err) {
        this.logger.warn(
          `syncOwnedServiceTargetsToFamily: ensure(${t.id}) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async removeMemberForServiceTarget(serviceTargetId: number): Promise<void> {
    const linked = await this.memberRepo.findOne({
      where: { linkedServiceTargetId: serviceTargetId },
    });
    if (!linked) return;
    if (linked.userId === null) {
      await this.memberRepo.remove(linked);
      return;
    }
    linked.linkedServiceTargetId = null;
    await this.memberRepo.save(linked);
  }

  /**
   * 启动时幂等回溯：把历史 ServiceTarget 全部同步到对应账号的家庭中。
   * 逐条处理以避免长事务；已存在对应 family_member 的 ServiceTarget 会被跳过。
   */
  async backfillFamilyMembersFromServiceTargets(): Promise<{ processed: number; synced: number }> {
    const targets = await this.targetRepo.find({ select: ['id'] });
    let synced = 0;
    // 新规则下，逐条调用 ensureMemberForServiceTarget（幂等）以彻底修复：
    //   · self 档案 → 挂到 owner 自己的成员条目（guardian 或 member）
    //   · 其他档案 → 挂到对应占位成员，清理可能错挂在 guardian 上的旧数据
    for (const t of targets) {
      try {
        await this.ensureMemberForServiceTarget(t.id);
        synced += 1;
      } catch (err) {
        this.logger.warn(
          `backfill ServiceTarget(${t.id}) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // 额外修复：guardian 身上可能错挂了"非本人"的老人档案（来自历史代码）。
    // 正确规则：guardian.linkedServiceTargetId 只能指向 relationship='self' 的档案。
    //  - 非 self 档案从 guardian 上拆出，转为独立占位条目
    //  - self 档案保留在 guardian 上（这是正常情况）
    const guardiansWithLink = await this.memberRepo.find({
      where: { role: 'guardian' },
    });
    for (const g of guardiansWithLink) {
      if (!g.linkedServiceTargetId) continue;
      try {
        const target = await this.targetRepo.findOne({ where: { id: g.linkedServiceTargetId } });
        if (!target) {
          g.linkedServiceTargetId = null;
          await this.memberRepo.save(g);
          continue;
        }
        const relation = this.getServiceTargetRelation(target);
        if (relation === 'self') {
          // 正确归属，不动
          continue;
        }
        // 非本人档案误挂在 guardian → 拆出
        g.linkedServiceTargetId = null;
        await this.memberRepo.save(g);
        const already = await this.memberRepo.findOne({
          where: { linkedServiceTargetId: target.id },
        });
        if (already) continue;
        await this.ensureMemberForServiceTarget(target.id);
        synced += 1;
      } catch (err) {
        this.logger.warn(
          `unlink guardian ServiceTarget(${g.linkedServiceTargetId}) failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { processed: targets.length, synced };
  }

  /**
   * 查询用户当前是否为被照护老人身份（被某家庭绑定且有 is_elder 标记）。
   * 登录时若 `claimPlaceholderByPhone` 未命中（如老人之前就登录过），仍可由此判定身份。
   */
  async isElderUser(userId: number): Promise<boolean> {
    const count = await this.memberRepo.count({
      where: { userId, isElder: true },
    });
    return count > 0;
  }

  /**
   * 专属管家信息：从老人所在家庭的 `assigned_cs_admin_id` 取客服资料；
   * 未指派时回退到系统默认客服（system_config.customer_service_phone）。
   */
  async getElderButler(userId: number) {
    const membership = await this.memberRepo.findOne({
      where: { userId, isElder: true },
      relations: ['familyGroup'],
    });
    const fallback = async () => {
      const phoneCfg = await this.systemConfigRepo.findOne({
        where: { key: 'customer_service_phone' },
      });
      const nameCfg = await this.systemConfigRepo.findOne({
        where: { key: 'customer_service_name' },
      });
      return {
        name: nameCfg?.value || '陪了个伴专属客服',
        phone: phoneCfg?.value || '17357867655',
        role: 'customer_service',
        adminId: null as number | null,
      };
    };

    if (!membership || !membership.familyGroup) return fallback();
    const adminId = membership.familyGroup.assignedCsAdminId;
    if (!adminId) return fallback();

    const admin = await this.adminUserRepo.findOne({ where: { id: adminId } });
    if (!admin) return fallback();
    return {
      name: admin.realName || admin.username,
      phone: admin.phone || '',
      role: 'customer_service',
      adminId: admin.id,
    };
  }

  /**
   * 家庭邀请二维码：生成无限制小程序码，scene=邀请码(8位)，page=scene-launch。
   * 家人扫码后 scene-launch 识别 8 位纯字母数字即为家庭邀请码 → 跳 join 页并预填。
   */
  async getInviteQrcode(familyGroupId: number, userId: number): Promise<{ imageBase64: string }> {
    const member = await this.memberRepo.findOne({ where: { familyGroupId, userId } });
    if (!member || member.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可生成邀请二维码');
    }
    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new NotFoundException('家庭不存在');

    const png = await this.downloadWxaUnlimitedPng(group.inviteCode);
    return { imageBase64: png.toString('base64') };
  }

  /**
   * 后台（管理员）生成家庭邀请小程序码：同上，但不校验 guardian 身份，
   * 方便客服在后台把二维码导出给客户分享。
   */
  async getInviteQrcodeForAdmin(
    familyGroupId: number,
  ): Promise<{ imageBase64: string; inviteCode: string; familyName: string }> {
    const group = await this.groupRepo.findOne({ where: { id: familyGroupId } });
    if (!group) throw new NotFoundException('家庭不存在');
    const png = await this.downloadWxaUnlimitedPng(group.inviteCode);
    return {
      imageBase64: png.toString('base64'),
      inviteCode: group.inviteCode,
      familyName: group.name,
    };
  }

  private async getWxaAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.mpAccessTokenCache && this.mpAccessTokenCache.expiresAtMs > now + 120_000) {
      return this.mpAccessTokenCache.token;
    }
    const appid = this.configService.get<string>('WECHAT_APPID')?.trim();
    const secret = this.configService.get<string>('WECHAT_SECRET')?.trim();
    if (!appid || !secret) {
      throw new BadRequestException('未配置 WECHAT_APPID / WECHAT_SECRET，无法生成小程序码');
    }
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(appid)}&secret=${encodeURIComponent(secret)}`;
    let json: { access_token?: string; expires_in?: number; errmsg?: string };
    try {
      const res = await fetch(url);
      json = (await res.json()) as any;
    } catch (err) {
      this.logger.error(`get wx access_token failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('获取微信 access_token 失败');
    }
    if (!json.access_token) {
      throw new BadRequestException(json.errmsg || '获取微信 access_token 失败');
    }
    const ttlMs = (json.expires_in ?? 7200) * 1000;
    this.mpAccessTokenCache = { token: json.access_token, expiresAtMs: now + ttlMs };
    return json.access_token;
  }

  private async downloadWxaUnlimitedPng(scene: string): Promise<Buffer> {
    const accessToken = await this.getWxaAccessToken();
    const envRaw =
      this.configService.get<string>('WECHAT_MP_QR_ENV_VERSION')?.trim() || 'release';
    const env_version =
      envRaw === 'develop' || envRaw === 'trial' || envRaw === 'release' ? envRaw : 'release';
    const api = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(accessToken)}`;
    const body = {
      scene,
      page: 'pages/order/scene-launch/scene-launch',
      check_path: false,
      env_version,
      width: 430,
    };
    let buf: Buffer;
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      buf = Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.error(`download family wxa code failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('生成小程序码失败');
    }
    if (buf.length > 0 && buf[0] === 0x7b) {
      try {
        const errJson = JSON.parse(buf.toString('utf8')) as { errcode?: number; errmsg?: string };
        throw new BadRequestException(
          errJson.errmsg || `微信返回错误${errJson.errcode != null ? ` (${errJson.errcode})` : ''}`,
        );
      } catch (e) {
        if (e instanceof BadRequestException) throw e;
        throw new BadRequestException('生成小程序码失败（微信接口异常）');
      }
    }
    if (buf.length < 100) throw new BadRequestException('生成小程序码失败（响应过短）');
    return buf;
  }

  /**
   * 按邀请码查询所属家庭组（扫码/分享落地时用）。
   */
  async findGroupByInviteCode(inviteCode: string) {
    if (!inviteCode || inviteCode.length !== 8) return null;
    const group = await this.groupRepo.findOne({
      where: { inviteCode: inviteCode.toUpperCase() },
      relations: ['creator'],
    });
    if (!group) return null;
    const memberCount = await this.memberRepo.count({ where: { familyGroupId: group.id } });
    return {
      id: group.id,
      name: group.name,
      inviteCode: group.inviteCode,
      memberCount,
      creator: group.creator
        ? { id: group.creator.id, nickname: group.creator.nickname, avatarUrl: group.creator.avatarUrl }
        : null,
    };
  }

  /**
   * 老人端首页一次性总览：服务对象 + 家庭 + 今日用药 + 最近订单计数。
   * 周报由前端另行走 `/ai-consultation/weekly-reports?page=1&pageSize=1`，保持各模块独立。
   */
  async getElderOverview(userId: number) {
    const membership = await this.memberRepo.findOne({
      where: { userId, isElder: true },
      relations: ['familyGroup'],
    });
    if (!membership) {
      return {
        isElder: false,
        serviceTarget: null,
        family: null,
        guardian: null,
        todayMedications: [],
        butler: await this.getElderButler(userId),
      };
    }

    const target = membership.linkedServiceTargetId
      ? await this.targetRepo.findOne({ where: { id: membership.linkedServiceTargetId } })
      : null;

    const guardian = membership.familyGroup
      ? await this.userRepo.findOne({ where: { id: membership.familyGroup.createdBy } })
      : null;

    // 今日用药：当前用户 (老人本人) 或其关联 ServiceTarget 名下的用药提醒
    const todayMedications = await this.reminderRepo.find({
      where: [
        { userId, status: In(['active', 'paused']) },
        ...(target
          ? [{ serviceTargetId: target.id, status: In(['active', 'paused']) } as any]
          : []),
      ],
      relations: ['serviceTarget'],
      order: { createdAt: 'DESC' },
      take: 10,
    });

    return {
      isElder: true,
      serviceTarget: target,
      family: membership.familyGroup
        ? {
            id: membership.familyGroup.id,
            name: membership.familyGroup.name,
          }
        : null,
      guardian: guardian
        ? { id: guardian.id, nickname: guardian.nickname, avatarUrl: guardian.avatarUrl }
        : null,
      todayMedications,
      butler: await this.getElderButler(userId),
    };
  }

  // ─── private ───────────────────────────────────────────────

  private async assertFamilyAccess(familyGroupId: number, userId: number) {
    const member = await this.memberRepo.findOne({ where: { familyGroupId, userId } });
    if (!member) throw new ForbiddenException('您不是该家庭的成员');
    return member;
  }

  private async assertGuardianAccess(guardianUserId: number, memberUserId: number, permission: string) {
    const hasAccess = await this.isGuardianOf(guardianUserId, memberUserId, permission);
    if (!hasAccess) throw new ForbiddenException('无权查看该家庭成员的信息');
  }

  /**
   * 自动匹配：在 guardian 账号下寻找和新加入 member 手机号或姓名匹配的 ServiceTarget
   */
  private async autoLinkServiceTarget(guardianUserId: number, memberUserId: number): Promise<number | null> {
    const memberUser = await this.userRepo.findOne({ where: { id: memberUserId } });
    if (!memberUser) return null;

    const guardianTargets = await this.targetRepo.find({ where: { userId: guardianUserId } });
    if (!guardianTargets.length) return null;

    for (const t of guardianTargets) {
      if (memberUser.phone && t.phone && t.phone === memberUser.phone) return t.id;
      if (memberUser.nickname && t.name && t.name === memberUser.nickname) return t.id;
    }
    return null;
  }

  /**
   * 手动关联：guardian 指定某个 FamilyMember 关联到哪个 ServiceTarget
   */
  async linkServiceTarget(
    guardianUserId: number,
    familyGroupId: number,
    memberId: number,
    serviceTargetId: number,
  ) {
    const operator = await this.memberRepo.findOne({ where: { familyGroupId, userId: guardianUserId } });
    if (!operator || operator.role !== 'guardian') {
      throw new ForbiddenException('仅管理者可操作');
    }

    const member = await this.memberRepo.findOne({ where: { id: memberId, familyGroupId } });
    if (!member) throw new NotFoundException('成员不存在');

    const target = await this.targetRepo.findOne({ where: { id: serviceTargetId, userId: guardianUserId } });
    if (!target) throw new BadRequestException('服务对象不存在或不属于您');

    member.linkedServiceTargetId = serviceTargetId;
    await this.memberRepo.save(member);

    return { success: true, linkedServiceTargetId: serviceTargetId };
  }

  /**
   * 数据同步：将 member 账号下的健康档案数据同步到 guardian 的 ServiceTarget
   */
  async syncLinkedData(guardianUserId: number, memberId: number) {
    const member = await this.memberRepo.findOne({
      where: { id: memberId },
      relations: ['user'],
    });
    if (!member || !member.linkedServiceTargetId) {
      throw new BadRequestException('该成员未关联服务对象');
    }
    if (member.userId === null) {
      throw new BadRequestException('该成员尚未登录，无档案可同步');
    }

    await this.assertGuardianAccess(guardianUserId, member.userId, 'viewHealth');

    const memberTargets = await this.targetRepo.find({
      where: { userId: member.userId },
      order: { updatedAt: 'DESC' },
    });
    const memberTarget = memberTargets[0];
    if (!memberTarget) return { success: true, synced: false, message: '对方暂无健康档案数据' };

    const guardianTarget = await this.targetRepo.findOne({
      where: { id: member.linkedServiceTargetId },
    });
    if (!guardianTarget) return { success: false, message: '关联的服务对象不存在' };

    const memberHP: any = memberTarget.healthProfile || {};
    const guardianHP: any = guardianTarget.healthProfile || {};
    const mergedHP = { ...guardianHP };

    const syncFields = [
      'bloodType', 'allergies', 'medicalHistory', 'medicalHistoryOther',
      'visionStatus', 'hearingStatus', 'currentMedication', 'currentMedications',
      'recentSymptoms', 'otherHealthInfo',
    ];
    for (const field of syncFields) {
      if (memberHP[field] && !guardianHP[field]) {
        mergedHP[field] = memberHP[field];
      }
    }

    if (memberTarget.age && !guardianTarget.age) guardianTarget.age = memberTarget.age;
    if (memberTarget.gender && !guardianTarget.gender) guardianTarget.gender = memberTarget.gender;
    if (memberTarget.phone && !guardianTarget.phone) guardianTarget.phone = memberTarget.phone;

    guardianTarget.healthProfile = mergedHP;
    await this.targetRepo.save(guardianTarget);

    return { success: true, synced: true, message: '健康档案已同步' };
  }
}
