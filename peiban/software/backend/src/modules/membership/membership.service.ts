import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MembershipLevel } from '../../entities/membership-level.entity.js';
import { MembershipCardType } from '../../entities/membership-card-type.entity.js';
import { UserMembership } from '../../entities/user-membership.entity.js';
import { User } from '../../entities/user.entity.js';
import { UpdateUserMembershipDto } from './dto/update-user-membership.dto.js';

export const LEVEL_NAME_ANNUAL = '孝心年卡';
export const LEVEL_NAME_REGULAR = '普通会员';

@Injectable()
export class MembershipService implements OnModuleInit {
  private readonly logger = new Logger(MembershipService.name);

  constructor(
    @InjectRepository(MembershipLevel)
    private readonly levelRepository: Repository<MembershipLevel>,
    @InjectRepository(MembershipCardType)
    private readonly cardTypeRepository: Repository<MembershipCardType>,
    @InjectRepository(UserMembership)
    private readonly userMembershipRepository: Repository<UserMembership>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  // ========== 内部：获取固定等级 ==========
  private async getAnnualLevel(): Promise<MembershipLevel> {
    const level = await this.levelRepository.findOne({
      where: { levelName: LEVEL_NAME_ANNUAL },
    });
    if (!level)
      throw new NotFoundException('孝心年卡等级不存在，请重启服务初始化数据');
    return level;
  }

  // ========== 用户会员 ==========
  async getOrCreateUserMembership(userId: number) {
    let um = await this.userMembershipRepository.findOne({
      where: { userId },
      relations: ['level'],
    });
    if (!um) {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('用户不存在');
      um = this.userMembershipRepository.create({
        userId,
        balance: 0,
        totalRecharged: 0,
        status: true,
      });
      um = await this.userMembershipRepository.save(um);
      um = (await this.userMembershipRepository.findOne({
        where: { id: um.id },
        relations: ['level'],
      })) as UserMembership;
    }
    return um;
  }

  private calcIsAnnualMember(um: UserMembership): boolean {
    if (um.level?.levelName !== LEVEL_NAME_ANNUAL) return false;
    // 无到期日视为无效；有到期日且已过期也为无效
    if (!um.expireDate || new Date(um.expireDate) < new Date()) return false;
    return true;
  }

  async getUserMembership(userId: number) {
    const um = await this.getOrCreateUserMembership(userId);
    const isExpired = um.expireDate
      ? new Date(um.expireDate) < new Date()
      : false;
    const isAnnualMember = this.calcIsAnnualMember(um);
    return {
      id: um.id,
      levelId: um.levelId,
      levelName: um.level?.levelName ?? LEVEL_NAME_REGULAR,
      startDate: um.startDate,
      expireDate: um.expireDate,
      balance: Number(um.balance),
      totalRecharged: Number(um.totalRecharged),
      isExpired,
      isAnnualMember,
      membershipType: isAnnualMember ? 'annual' : 'regular',
    };
  }

  // ========== 内部：日期安全解析 ==========
  private parseDateOrThrow(raw: unknown, field: string): Date {
    if (raw == null || raw === '') {
      throw new BadRequestException(`${field} 不能为空`);
    }
    const d = raw instanceof Date ? raw : new Date(String(raw));
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      throw new BadRequestException(`${field} 不是有效日期`);
    }
    return d;
  }

  // ========== 孝心年卡管理（仅管理员可调用） ==========

  async grantAnnualCard(
    userId: number,
    startDate?: string,
    expireDate?: string,
    operatorId?: number,
  ) {
    const annualLevel = await this.getAnnualLevel();
    const um = await this.getOrCreateUserMembership(userId);
    um.levelId = annualLevel.id;
    if (startDate !== undefined) {
      um.startDate = this.parseDateOrThrow(startDate, 'startDate');
    }
    if (expireDate !== undefined) {
      um.expireDate = this.parseDateOrThrow(expireDate, 'expireDate');
    }
    if (um.startDate && um.expireDate && um.startDate > um.expireDate) {
      throw new BadRequestException('开始日期不能晚于到期日期');
    }
    await this.userMembershipRepository.save(um);
    this.logger.log(
      `[MEMBERSHIP] 授予孝心年卡 userId=${userId} operator=${operatorId ?? 'system'} start=${um.startDate?.toISOString?.() || ''} expire=${um.expireDate?.toISOString?.() || ''}`,
    );
    return this.getUserMembership(userId);
  }

  async revokeAnnualCard(userId: number, operatorId?: number) {
    const um = await this.getOrCreateUserMembership(userId);
    // 用 update() 直接发 SQL UPDATE，避免 save() 在已加载 level 关联时
    // 不把 levelId 写入 null 的 TypeORM 已知问题。
    await this.userMembershipRepository.update(um.id, {
      levelId: null as any,
      cardTypeId: null as any,
      startDate: null as any,
      expireDate: null as any,
    });
    this.logger.log(
      `[MEMBERSHIP] 撤销孝心年卡 userId=${userId} operator=${operatorId ?? 'system'}`,
    );
    return this.getUserMembership(userId);
  }

  async getAnnualCardMembers() {
    const annualLevel = await this.getAnnualLevel();
    const memberships = await this.userMembershipRepository.find({
      where: { levelId: annualLevel.id },
      relations: ['user', 'level'],
      order: { id: 'DESC' },
    });
    const now = new Date();
    return memberships.map((um) => {
      const isExpired = um.expireDate ? new Date(um.expireDate) < now : false;
      return {
        id: um.id,
        userId: um.userId,
        nickname: (um.user as any)?.nickname,
        phone: (um.user as any)?.phone,
        startDate: um.startDate,
        expireDate: um.expireDate,
        isExpired,
        balance: Number(um.balance),
      };
    });
  }

  // ========== 通用调整（管理员后台用） ==========
  async updateUserMembership(
    userId: number,
    dto: UpdateUserMembershipDto,
    operatorId?: number,
  ) {
    const um = await this.getOrCreateUserMembership(userId);

    const originalSnapshot = {
      levelId: um.levelId,
      startDate: um.startDate,
      expireDate: um.expireDate,
      balance: Number(um.balance),
      totalRecharged: Number(um.totalRecharged),
    };

    if (dto.levelId !== undefined) {
      um.levelId = dto.levelId as any;
      if (dto.levelId === null) {
        um.level = null as any;
      }
    }
    if (dto.startDate !== undefined) {
      um.startDate = dto.startDate === null
        ? (null as any)
        : this.parseDateOrThrow(dto.startDate, 'startDate');
    }
    if (dto.expireDate !== undefined) {
      um.expireDate = dto.expireDate === null
        ? (null as any)
        : this.parseDateOrThrow(dto.expireDate, 'expireDate');
    }
    if (um.startDate && um.expireDate && um.startDate > um.expireDate) {
      throw new BadRequestException('开始日期不能晚于到期日期');
    }

    let appliedDelta: number | null = null;
    if (dto.balanceDelta !== undefined) {
      const delta = Number(dto.balanceDelta);
      if (!Number.isFinite(delta)) {
        throw new BadRequestException('调整金额无效');
      }
      // 限制单笔调整上限为 100 万元，防止误操作
      if (Math.abs(delta) > 1_000_000) {
        throw new BadRequestException('单笔调整金额超限（上限 100 万）');
      }
      const currentBalance = Number(um.balance);
      if (!Number.isFinite(currentBalance)) {
        throw new BadRequestException('当前余额数据异常，请联系技术人员');
      }
      const newBalance = currentBalance + delta;
      if (newBalance < 0) throw new BadRequestException('余额不足');
      um.balance = newBalance;
      if (delta > 0) {
        const tr = Number(um.totalRecharged);
        um.totalRecharged = (Number.isFinite(tr) ? tr : 0) + delta;
      }
      appliedDelta = delta;
    }
    await this.userMembershipRepository.save(um);

    // 审计日志（记录原始快照 + 变更）
    if (appliedDelta != null || dto.levelId !== undefined ||
        dto.startDate !== undefined || dto.expireDate !== undefined) {
      this.logger.log(
        `[MEMBERSHIP] 调整会员 userId=${userId} operator=${operatorId ?? 'system'}` +
          (appliedDelta != null
            ? ` balanceDelta=${appliedDelta} balance=${originalSnapshot.balance}->${Number(um.balance)}`
            : '') +
          (dto.levelId !== undefined
            ? ` levelId=${originalSnapshot.levelId}->${um.levelId}`
            : '') +
          (dto.startDate !== undefined
            ? ` startDate=${originalSnapshot.startDate?.toISOString?.() || ''}->${um.startDate?.toISOString?.() || ''}`
            : '') +
          (dto.expireDate !== undefined
            ? ` expireDate=${originalSnapshot.expireDate?.toISOString?.() || ''}->${um.expireDate?.toISOString?.() || ''}`
            : ''),
      );
    }
    return this.getUserMembership(userId);
  }

  async recharge(userId: number, amount: number, operatorId?: number) {
    if (amount <= 0) throw new BadRequestException('充值金额必须大于0');
    return this.updateUserMembership(userId, { balanceDelta: amount }, operatorId);
  }

  async deductBalance(userId: number, amount: number, operatorId?: number) {
    if (amount <= 0) throw new BadRequestException('扣减金额必须大于0');
    return this.updateUserMembership(userId, { balanceDelta: -amount }, operatorId);
  }

  async onModuleInit() {
    const existingLevels = await this.levelRepository.find({
      order: { sortOrder: 'ASC' },
    });
    const hasRegular = existingLevels.some(
      (l) => l.levelName === LEVEL_NAME_REGULAR,
    );
    const hasAnnual = existingLevels.some(
      (l) => l.levelName === LEVEL_NAME_ANNUAL,
    );
    if (!hasRegular) {
      await this.levelRepository.save({
        levelName: LEVEL_NAME_REGULAR,
        discountRate: 100,
        minRecharge: 0,
        benefits: '基础服务',
        sortOrder: 0,
      });
      this.logger.log('普通会员等级已初始化');
    }
    if (!hasAnnual) {
      await this.levelRepository.save({
        levelName: LEVEL_NAME_ANNUAL,
        discountRate: 100,
        minRecharge: 0,
        benefits: '孝心年卡专属权益',
        sortOrder: 1,
      });
      this.logger.log('孝心年卡等级已初始化');
    }
  }
}
