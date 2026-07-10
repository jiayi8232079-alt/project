import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../../entities/user.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { FamilyMember } from '../../entities/family-member.entity.js';
import { WechatLoginDto } from './dto/wechat-login.dto.js';
import { AdminLoginDto } from './dto/admin-login.dto.js';
import { AttendantLoginDto } from './dto/attendant-login.dto.js';
import { PhoneLoginDto } from './dto/phone-login.dto.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import { CaptchaService } from './captcha.service.js';
import { SmsCodeService } from './sms-code.service.js';
import { deterministicHash } from '../../common/utils/column-encryption.js';
import { normalizeCnPhone } from '../../common/utils/phone-utils.js';
import { DEFAULT_TENANT_ID } from '../../entities/tenant.entity.js';

/** 登录防暴破阈值（同一账号累计失败次数） */
const CAPTCHA_REQUIRED_AFTER = 3;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private loginColumnsReady = false;
  private mpAccessTokenCache: { token: string; expiresAtMs: number } | null = null;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    @InjectRepository(FamilyMember)
    private readonly familyMemberRepository: Repository<FamilyMember>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly captchaService: CaptchaService,
    private readonly smsCodeService: SmsCodeService,
  ) {}

  /** 平台后台角色集合（这些角色登录后保留原角色，其余统一降为 user）。 */
  private static readonly ADMIN_ROLES = [
    'admin',
    'operator',
    'finance',
    'customer_service',
    'medical_consultant',
  ];

  /**
   * 老人认领 + 身份识别：
   * - 若当前用户已是 is_elder 家庭成员 → 直接返回 isElder=true
   * - 否则按手机号 HMAC 匹配占位 FamilyMember 记录，命中则回填 userId，标记为老人
   */
  private async claimAndCheckElder(
    userId: number,
    phone: string | null | undefined,
  ): Promise<{ isElder: boolean; familyGroupId?: number; serviceTargetId?: number }> {
    const existing = await this.familyMemberRepository.findOne({
      where: { userId, isElder: true },
    });
    if (existing) {
      return {
        isElder: true,
        familyGroupId: existing.familyGroupId,
        serviceTargetId: existing.linkedServiceTargetId || undefined,
      };
    }

    if (!phone) return { isElder: false };
    const phoneHash = deterministicHash(phone);
    if (!phoneHash) return { isElder: false };

    const placeholder = await this.familyMemberRepository.findOne({
      where: {
        placeholderPhoneHash: phoneHash,
        userId: IsNull(),
        isElder: true,
      },
    });
    if (!placeholder) return { isElder: false };

    placeholder.userId = userId;
    placeholder.joinedAt = new Date();
    placeholder.placeholderPhone = null;
    placeholder.placeholderPhoneHash = null;
    await this.familyMemberRepository.save(placeholder);

    // 自动切换到大字体模式
    await this.userRepository.update(userId, { uiMode: 'simplified' });

    return {
      isElder: true,
      familyGroupId: placeholder.familyGroupId,
      serviceTargetId: placeholder.linkedServiceTargetId || undefined,
    };
  }

  /** 获取微信小程序全局 access_token（带 2 小时缓存） */
  private async getWxaAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.mpAccessTokenCache && this.mpAccessTokenCache.expiresAtMs > now + 120_000) {
      return this.mpAccessTokenCache.token;
    }
    const appid = this.configService.get<string>('WECHAT_APPID')?.trim();
    const secret = this.configService.get<string>('WECHAT_SECRET')?.trim();
    if (!appid || !secret) {
      throw new BadRequestException('未配置 WECHAT_APPID / WECHAT_SECRET');
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

  /**
   * 用 phoneCode 换取用户手机号。
   * 开发模式下 (NODE_ENV=development) 支持绕过：若 phoneCode 是 `dev:+86...` 格式则直接使用。
   */
  private async exchangePhoneCode(phoneCode: string): Promise<string> {
    const isDev = this.configService.get<string>('NODE_ENV') === 'development';
    if (isDev && phoneCode?.startsWith('dev:')) {
      return phoneCode.slice(4);
    }
    const accessToken = await this.getWxaAccessToken();
    const api = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;
    let json: {
      errcode?: number;
      errmsg?: string;
      phone_info?: { phoneNumber?: string; purePhoneNumber?: string };
    };
    try {
      const res = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: phoneCode }),
      });
      json = (await res.json()) as any;
    } catch (err) {
      this.logger.error(`getuserphonenumber failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('手机号授权失败');
    }
    if (json.errcode && json.errcode !== 0) {
      throw new BadRequestException(json.errmsg || '手机号授权失败');
    }
    const phone = json.phone_info?.purePhoneNumber || json.phone_info?.phoneNumber;
    if (!phone) throw new BadRequestException('未获取到手机号');
    return phone;
  }

  /**
   * 提供给前端：小程序用 getPhoneNumber 拿到 code 后，上行到这里换号 + 自动认领老人占位。
   * 返回当前身份（isElder 等），前端据此决定是否进入大字体老人端。
   */
  async bindWxPhone(userId: number, phoneCode: string) {
    if (!phoneCode) throw new BadRequestException('phoneCode 缺失');
    const phone = await this.exchangePhoneCode(phoneCode);
    const normalized = normalizeCnPhone(phone, '手机号') || phone;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    user.phone = normalized;
    await this.userRepository.save(user);

    const elderStatus = await this.claimAndCheckElder(userId, normalized);
    return { phone: normalized, ...elderStatus };
  }

  /** 由 AuthModule.onModuleInit 在启动时调用，把这套 ALTER 提前到冷启。 */
  async ensureLoginSecurityColumnsForBootstrap(): Promise<void> {
    const ok = await this.ensureLoginSecurityColumns();
    if (!ok) {
      // 启动期失败不阻塞应用，只在登录请求时再次尝试。
      this.logger.warn(
        'ensureLoginSecurityColumnsForBootstrap: failed at boot, will retry on first login.',
      );
    }
  }

  /**
   * 启动时确保 admin_users / attendants 表上存在失败锁定相关字段，兼容生产关闭 synchronize 的场景。
   * 幂等：字段已存在则跳过。
   */
  private async ensureLoginSecurityColumns(): Promise<boolean> {
    if (this.loginColumnsReady) return true;
    try {
      const manager = this.adminUserRepository.manager;
      await manager.query(
        `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0`,
      );
      await manager.query(
        `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL`,
      );
      await manager.query(
        `ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS last_failed_login_at DATETIME NULL`,
      );
      await manager.query(
        `ALTER TABLE attendants ADD COLUMN IF NOT EXISTS failed_login_count INT NOT NULL DEFAULT 0`,
      );
      await manager.query(
        `ALTER TABLE attendants ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL`,
      );
      await manager.query(
        `ALTER TABLE attendants ADD COLUMN IF NOT EXISTS last_failed_login_at DATETIME NULL`,
      );
      // App「通过 Apple 登录」需要的稳定标识列（生产 synchronize=false 时兜底补列）
      await manager.query(
        `ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub VARCHAR(255) NULL`,
      );
      this.loginColumnsReady = true;
      return true;
    } catch (err) {
      this.logger.warn(
        `ensureLoginSecurityColumns failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  /** 换算锁定剩余秒数 */
  private remainingLockSeconds(lockedUntil?: Date | null): number {
    if (!lockedUntil) return 0;
    const diff = new Date(lockedUntil).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 1000) : 0;
  }

  /**
   * 校验图形验证码；若失败次数到达阈值则必须通过，否则可选。
   */
  private verifyCaptchaIfNeeded(
    failedCount: number,
    captchaToken: string | undefined,
    captchaCode: string | undefined,
  ) {
    if (failedCount < CAPTCHA_REQUIRED_AFTER) return;
    const ok = this.captchaService.consume(captchaToken, captchaCode);
    if (!ok) {
      throw new ForbiddenException({
        message: '图形验证码错误或已失效',
        captchaRequired: true,
      });
    }
  }

  private buildDevOpenid(dto: WechatLoginDto): string {
    // 本地开发要优先使用稳定 code，避免昵称变化后生成新的测试账号。
    const stableDevCode = dto.code?.startsWith('dev_local_') ? dto.code : '';
    const seed = (stableDevCode || dto.devUserKey?.trim() || dto.code || dto.nickname?.trim() || 'test_user')
      .replace(/[^\w\u4e00-\u9fa5-]/g, '_')
      .slice(0, 32);
    return `dev_${seed || 'test_user'}`;
  }

  private isSchemaUnavailable(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = (
      error as QueryFailedError & {
        driverError?: { code?: string; message?: string; sqlMessage?: string };
      }
    ).driverError;
    const code = String(driverError?.code || '');
    const rawMessage = String(
      driverError?.sqlMessage || driverError?.message || error.message || '',
    );
    if (
      code === 'ER_NO_SUCH_TABLE' ||
      code === 'ER_BAD_FIELD_ERROR' ||
      code === '42S02' ||
      code === '42S22'
    ) {
      return true;
    }
    return /doesn't exist|unknown column|no such table/i.test(rawMessage);
  }

  async wechatLogin(dto: WechatLoginDto) {
    const appid = this.configService.get<string>('WECHAT_APPID');
    const secret = this.configService.get<string>('WECHAT_SECRET');
    const isDev = this.configService.get<string>('NODE_ENV') === 'development';

    let openid = '';

    if (dto.code?.startsWith('dev_local_') || (isDev && !secret)) {
      // 开发模式：为不同测试账号生成不同 openid，避免本地多角色串号。
      openid = this.buildDevOpenid(dto);
    } else {
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${dto.code}&grant_type=authorization_code`;

      let wxResult: any;
      try {
        const response = await fetch(url);
        wxResult = await response.json();
      } catch {
        if (isDev) {
          openid = this.buildDevOpenid(dto);
          wxResult = null;
        } else {
          throw new UnauthorizedException('微信服务器请求失败');
        }
      }

      if (!openid && wxResult?.errcode) {
        if (isDev) {
          openid = this.buildDevOpenid(dto);
        } else {
          throw new UnauthorizedException(`微信登录失败: ${wxResult.errmsg}`);
        }
      }

      if (!openid && wxResult?.openid) {
        openid = wxResult.openid;
      }

      if (!openid) {
        throw new UnauthorizedException('微信服务器请求失败');
      }
    }

    try {
      let user = await this.userRepository.findOne({
        where: { openid },
        withDeleted: true,
      });
      if (user?.deletedAt) {
        await this.userRepository.restore(user.id);
        user.deletedAt = null;
        this.logger.log(`软删除用户自动恢复: id=${user.id}, openid=${openid}`);

        if (user.role === 'attendant') {
          const disabledAttendant = await this.attendantRepository.findOne({
            where: { userId: user.id, status: 'disabled' },
          });
          if (disabledAttendant) {
            disabledAttendant.status = 'active';
            await this.attendantRepository.save(disabledAttendant);
            this.logger.log(`关联陪诊员自动恢复: attendant.id=${disabledAttendant.id}`);
          }
        }
      }
      if (!user) {
        user = this.userRepository.create({
          openid,
        });
        user = await this.userRepository.save(user);
      }

      if (!user.status) {
        throw new UnauthorizedException('该用户账号已停用');
      }

      // 优先使用前端授权上传的头像昵称，其次补一个默认昵称，避免前台展示“用户”
      const nextNickname = dto.nickname?.trim() || user.nickname;
      const nextAvatarUrl = dto.avatarUrl?.trim() || user.avatarUrl;
      const fallbackNickname = `微信用户${String(user.id).padStart(4, '0')}`;
      const shouldUpdateProfile =
        nextNickname !== user.nickname ||
        nextAvatarUrl !== user.avatarUrl ||
        !user.nickname;

      if (shouldUpdateProfile) {
        user.nickname = nextNickname || fallbackNickname;
        user.avatarUrl = nextAvatarUrl;
        user = await this.userRepository.save(user);
      }

      // 用户端默认保持普通用户身份；只有显式要求进入陪诊员工作台时才切换。
      const boundAttendant = await this.attendantRepository.findOne({
        where: { userId: user.id, status: 'active' },
      });
      const requestedRole = dto.loginAs === 'attendant' ? 'attendant' : 'user';
      if (requestedRole === 'attendant' && !boundAttendant) {
        throw new UnauthorizedException('当前账号未绑定陪诊员身份');
      }
      const effectiveRole = requestedRole;
      const isAttendantMode = effectiveRole === 'attendant';

      // 陪诊员模式 → 'attendant'；否则只保留后台管理角色，attendant 强制降为 'user'
      // （attendant 角色只在显式 loginAs=attendant 时才写入 JWT，防止 loginAs=user 时
      //   因 users.role='attendant' 导致前端陷入陪诊员身份循环）
      const WECHAT_ADMIN_ROLES = ['admin', 'operator', 'finance', 'customer_service', 'medical_consultant'];
      const finalRole = isAttendantMode ? 'attendant' : (WECHAT_ADMIN_ROLES.includes(user.role) ? user.role : 'user');

      const token = this.jwtService.sign({
        sub: user.id,
        openid: user.openid,
        role: finalRole,
        type: 'user',
        // 老用户尚未补 tenant_id 列时回退到默认平台租户，保证灰度迁移期 JWT 永远带值
        tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
      });

      // 登录同步支持 phoneCode：前端"一键微信登录+手机号授权"时上行
      if (dto.phoneCode && !isAttendantMode) {
        try {
          const phone = await this.exchangePhoneCode(dto.phoneCode);
          const normalized = normalizeCnPhone(phone, '手机号') || phone;
          user.phone = normalized;
          user = await this.userRepository.save(user);
        } catch (err) {
          // 手机号授权失败不阻塞登录，仅记日志
          this.logger.warn(
            `wechat-login phoneCode exchange failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // 若为普通用户模式，尝试按手机号自动认领占位老人、识别是否为老人身份
      let elderStatus: {
        isElder: boolean;
        familyGroupId?: number;
        serviceTargetId?: number;
      } = { isElder: false };
      if (!isAttendantMode) {
        try {
          elderStatus = await this.claimAndCheckElder(user.id, user.phone);
        } catch (err) {
          this.logger.warn(
            `claimAndCheckElder failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      return {
        token,
        user: {
          id: user.id,
          nickname: isAttendantMode
            ? (boundAttendant?.realName || user.nickname)
            : user.nickname,
          avatarUrl: isAttendantMode
            ? (boundAttendant?.avatarUrl || user.avatarUrl)
            : user.avatarUrl,
          phone: isAttendantMode
            ? (boundAttendant?.phone || user.phone)
            : user.phone,
          role: finalRole,
          hasAttendantProfile: !!boundAttendant,
          name: isAttendantMode ? boundAttendant?.realName : user.nickname,
          uiMode: user.uiMode || 'normal',
          isElder: elderStatus.isElder,
          elderFamilyGroupId: elderStatus.familyGroupId,
          elderServiceTargetId: elderStatus.serviceTargetId,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (this.isSchemaUnavailable(error)) {
        this.logger.error(
          `wechat login schema error: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new ServiceUnavailableException('系统升级中，请稍后重试');
      }
      this.logger.error(
        `wechat login failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('登录服务暂时不可用，请稍后重试');
    }
  }

  // ─────────────── App：手机号验证码登录 ───────────────

  /** 下发短信验证码（App 登录 / 注册）。 */
  async sendSmsCode(phone: string) {
    const normalized = normalizeCnPhone(phone, '手机号');
    if (!normalized) throw new BadRequestException('手机号格式不正确');
    return this.smsCodeService.send(normalized);
  }

  /** 手机号 + 验证码登录；账号不存在则自动注册。 */
  async phoneLogin(dto: PhoneLoginDto) {
    const phone = normalizeCnPhone(dto.phone, '手机号');
    if (!phone) throw new BadRequestException('手机号格式不正确');
    if (!this.smsCodeService.verify(phone, dto.code)) {
      throw new UnauthorizedException('验证码错误或已失效');
    }
    try {
      let user = await this.userRepository.findOne({
        where: { phone },
        withDeleted: true,
      });
      if (user?.deletedAt) {
        await this.userRepository.restore(user.id);
        user.deletedAt = null;
      }
      if (!user) {
        user = this.userRepository.create({
          phone,
          nickname: dto.nickname?.trim() || `用户${phone.slice(-4)}`,
        });
        user = await this.userRepository.save(user);
        this.logger.log(`手机号注册新用户 id=${user.id}`);
      }
      if (!user.status) throw new UnauthorizedException('该用户账号已停用');
      return await this.buildUserLoginResult(user);
    } catch (error) {
      return this.handleLoginError(error, 'phone');
    }
  }

  // ─────────────── App：Apple 登录 ───────────────

  /** Apple 登录；校验 identityToken 后按 sub 找回/注册账号。 */
  async appleLogin(dto: AppleLoginDto) {
    const claims = await this.verifyAppleIdentityToken(dto.identityToken);
    try {
      let user = await this.userRepository.findOne({
        where: { appleSub: claims.sub },
        withDeleted: true,
      });
      if (user?.deletedAt) {
        await this.userRepository.restore(user.id);
        user.deletedAt = null;
      }
      if (!user) {
        user = this.userRepository.create({
          appleSub: claims.sub,
          nickname: dto.fullName?.trim() || 'Apple 用户',
        });
        user = await this.userRepository.save(user);
        this.logger.log(`Apple 注册新用户 id=${user.id}`);
      }
      if (!user.status) throw new UnauthorizedException('该用户账号已停用');
      return await this.buildUserLoginResult(user);
    } catch (error) {
      return this.handleLoginError(error, 'apple');
    }
  }

  /**
   * 验证 Apple identityToken：拉取 Apple 公钥（JWKS）→ RS256 验签 → 校验 iss/aud/exp。
   * 仅依赖 Node 内置 crypto + fetch，无需额外依赖。
   */
  private async verifyAppleIdentityToken(
    idToken: string,
  ): Promise<{ sub: string; email?: string }> {
    const parts = (idToken || '').split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Apple 身份令牌格式错误');
    }
    const [headerB64, payloadB64, sigB64] = parts;
    let header: { kid?: string; alg?: string };
    let payload: {
      iss?: string;
      aud?: string | string[];
      exp?: number;
      sub?: string;
      email?: string;
    };
    try {
      header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Apple 身份令牌解析失败');
    }

    let keys: Array<Record<string, string>>;
    try {
      const res = await fetch('https://appleid.apple.com/auth/keys');
      const json = (await res.json()) as { keys?: Array<Record<string, string>> };
      keys = json.keys ?? [];
    } catch (err) {
      this.logger.error(
        `fetch apple keys failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new ServiceUnavailableException('Apple 验证服务暂不可用');
    }

    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) throw new UnauthorizedException('Apple 公钥未匹配');

    const verified = crypto.verify(
      'RSA-SHA256',
      Buffer.from(`${headerB64}.${payloadB64}`),
      crypto.createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' }),
      Buffer.from(sigB64, 'base64url'),
    );
    if (!verified) throw new UnauthorizedException('Apple 身份令牌验签失败');

    if (payload.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Apple 令牌签发方非法');
    }
    const clientId = this.configService.get<string>('APPLE_CLIENT_ID')?.trim();
    if (clientId) {
      const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      if (!aud.includes(clientId)) {
        throw new UnauthorizedException('Apple 令牌受众不匹配');
      }
    }
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Apple 身份令牌已过期');
    }
    if (!payload.sub) throw new UnauthorizedException('Apple 令牌缺少用户标识');
    return {
      sub: String(payload.sub),
      email: payload.email ? String(payload.email) : undefined,
    };
  }

  /** 统一构造 C 端用户登录返回（签发 JWT + 认领老人占位 + 标准 user 字段）。 */
  private async buildUserLoginResult(user: User) {
    const finalRole = AuthService.ADMIN_ROLES.includes(user.role)
      ? user.role
      : 'user';
    const token = this.jwtService.sign({
      sub: user.id,
      openid: user.openid,
      role: finalRole,
      type: 'user',
      tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
    });

    let elderStatus: {
      isElder: boolean;
      familyGroupId?: number;
      serviceTargetId?: number;
    } = { isElder: false };
    try {
      elderStatus = await this.claimAndCheckElder(user.id, user.phone);
    } catch (err) {
      this.logger.warn(
        `claimAndCheckElder failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const boundAttendant = await this.attendantRepository.findOne({
      where: { userId: user.id, status: 'active' },
    });

    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        role: finalRole,
        hasAttendantProfile: !!boundAttendant,
        name: user.nickname,
        uiMode: user.uiMode || 'normal',
        isElder: elderStatus.isElder,
        elderFamilyGroupId: elderStatus.familyGroupId,
        elderServiceTargetId: elderStatus.serviceTargetId,
      },
    };
  }

  /** 登录异常统一归一化（schema 缺失 → 503；其余业务异常原样抛出）。 */
  private handleLoginError(error: unknown, scope: string): never {
    if (
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof BadRequestException
    ) {
      throw error;
    }
    if (this.isSchemaUnavailable(error)) {
      this.logger.error(
        `${scope} login schema error: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('系统升级中，请稍后重试');
    }
    this.logger.error(
      `${scope} login failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw new ServiceUnavailableException('登录服务暂时不可用，请稍后重试');
  }

  async attendantLogin(dto: AttendantLoginDto) {
    const columnsReady = await this.ensureLoginSecurityColumns();
    try {
      const qb = this.attendantRepository
        .createQueryBuilder('attendant')
        .addSelect('attendant.password')
        .leftJoinAndSelect('attendant.user', 'user')
        .where('attendant.username = :username', { username: dto.username });
      if (columnsReady) {
        qb.addSelect([
          'attendant.failedLoginCount',
          'attendant.lockedUntil',
          'attendant.lastFailedLoginAt',
        ]);
      }
      const attendant = await qb.getOne();

      if (!attendant) {
        this.verifyCaptchaIfNeeded(
          CAPTCHA_REQUIRED_AFTER,
          dto.captchaToken,
          dto.captchaCode,
        );
        throw new UnauthorizedException('账号或密码错误');
      }

      if (columnsReady) {
        const remaining = this.remainingLockSeconds(attendant.lockedUntil);
        if (remaining > 0) {
          throw new ForbiddenException({
            message: `账号已被临时锁定，请 ${Math.ceil(remaining / 60)} 分钟后重试`,
            lockedSeconds: remaining,
            captchaRequired: true,
          });
        }
      }

      this.verifyCaptchaIfNeeded(
        columnsReady ? (attendant.failedLoginCount ?? 0) : 0,
        dto.captchaToken,
        dto.captchaCode,
      );

      if (!attendant.password) {
        throw new UnauthorizedException('该账号尚未设置密码，请联系管理员');
      }

      if (attendant.status !== 'active') {
        throw new UnauthorizedException('该陪诊员账号已停用');
      }

      const isPasswordValid = await bcrypt.compare(
        dto.password,
        attendant.password,
      );
      if (!isPasswordValid) {
        if (columnsReady) {
          await this.markAttendantLoginFailure(attendant);
        }
        const failedNow = (attendant.failedLoginCount ?? 0) + 1;
        throw new UnauthorizedException({
          message: '账号或密码错误',
          captchaRequired: failedNow >= CAPTCHA_REQUIRED_AFTER,
        });
      }

      const user = attendant.user;
      if (!user) {
        throw new UnauthorizedException('陪诊员关联用户不存在');
      }
      if (!user.status || user.deletedAt) {
        throw new UnauthorizedException('陪诊员关联用户已停用');
      }

      if (columnsReady) {
        await this.attendantRepository.update(attendant.id, {
          failedLoginCount: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        });
      }

      const token = this.jwtService.sign({
        sub: user.id,
        openid: user.openid,
        role: 'attendant',
        type: 'user',
        tenantId: user.tenantId ?? DEFAULT_TENANT_ID,
      });

      return {
        token,
        user: {
          id: user.id,
          nickname: attendant.realName || user.nickname,
          avatarUrl: attendant.avatarUrl || user.avatarUrl,
          phone: attendant.phone || user.phone,
          role: 'attendant',
          name: attendant.realName,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      )
        throw error;
      if (this.isSchemaUnavailable(error)) {
        this.logger.error(
          `attendant login schema error: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new ServiceUnavailableException('系统升级中，请稍后重试');
      }
      this.logger.error(
        `attendant login failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('登录服务暂时不可用，请稍后重试');
    }
  }

  private async markAttendantLoginFailure(attendant: Attendant) {
    const nextCount = (attendant.failedLoginCount ?? 0) + 1;
    const locked = nextCount >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = locked
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      : null;
    try {
      await this.attendantRepository.update(attendant.id, {
        failedLoginCount: locked ? 0 : nextCount,
        lockedUntil,
        lastFailedLoginAt: new Date(),
      });
    } catch (err) {
      this.logger.warn(
        `markAttendantLoginFailure failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async adminLogin(dto: AdminLoginDto) {
    const columnsReady = await this.ensureLoginSecurityColumns();
    try {
      const selectColumns: (keyof AdminUser)[] = [
        'id',
        'username',
        'password',
        'realName',
        'role',
        'status',
      ];
      if (columnsReady) {
        selectColumns.push(
          'failedLoginCount',
          'lockedUntil',
          'lastFailedLoginAt',
        );
      }
      const admin = await this.adminUserRepository.findOne({
        where: { username: dto.username },
        select: selectColumns,
      });

      if (!admin) {
        this.verifyCaptchaIfNeeded(
          CAPTCHA_REQUIRED_AFTER,
          dto.captchaToken,
          dto.captchaCode,
        );
        throw new UnauthorizedException('账号或密码错误');
      }

      if (columnsReady) {
        const remaining = this.remainingLockSeconds(admin.lockedUntil);
        if (remaining > 0) {
          throw new ForbiddenException({
            message: `账号已被临时锁定，请 ${Math.ceil(remaining / 60)} 分钟后重试`,
            lockedSeconds: remaining,
            captchaRequired: true,
          });
        }
      }

      this.verifyCaptchaIfNeeded(
        columnsReady ? (admin.failedLoginCount ?? 0) : 0,
        dto.captchaToken,
        dto.captchaCode,
      );

      if (!admin.status) {
        throw new UnauthorizedException('账号已被禁用');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, admin.password);
      if (!isPasswordValid) {
        if (columnsReady) {
          await this.markAdminLoginFailure(admin);
        }
        const failedNow = (admin.failedLoginCount ?? 0) + 1;
        throw new UnauthorizedException({
          message: '账号或密码错误',
          captchaRequired: failedNow >= CAPTCHA_REQUIRED_AFTER,
        });
      }

      if (columnsReady) {
        await this.adminUserRepository.update(admin.id, {
          failedLoginCount: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        });
      }

      const token = this.jwtService.sign({
        sub: admin.id,
        username: admin.username,
        role: admin.role,
        type: 'admin',
        // admin（平台运营账号）天然跨租户，JWT 不绑 tenant；TenantGuard 见 type=admin 自动放行
        tenantId: null,
      });

      return {
        token,
        user: {
          id: admin.id,
          username: admin.username,
          real_name: admin.realName,
          role: admin.role,
        },
      };
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      )
        throw error;
      if (this.isSchemaUnavailable(error)) {
        this.logger.error(
          `admin login schema error: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new ServiceUnavailableException('系统升级中，请稍后重试');
      }
      this.logger.error(
        `admin login failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('登录服务暂时不可用，请稍后重试');
    }
  }

  private async markAdminLoginFailure(admin: AdminUser) {
    const nextCount = (admin.failedLoginCount ?? 0) + 1;
    const locked = nextCount >= MAX_FAILED_ATTEMPTS;
    const lockedUntil = locked
      ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
      : null;
    try {
      await this.adminUserRepository.update(admin.id, {
        failedLoginCount: locked ? 0 : nextCount,
        lockedUntil,
        lastFailedLoginAt: new Date(),
      });
    } catch (err) {
      this.logger.warn(
        `markAdminLoginFailure failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async getProfile(userId: number, type: string, role?: string) {
    try {
      if (type === 'admin') {
        const admin = await this.adminUserRepository.findOne({
          where: { id: userId },
        });
        if (!admin) throw new UnauthorizedException('用户不存在');
        return {
          id: admin.id,
          username: admin.username,
          real_name: admin.realName,
          role: admin.role,
          phone: admin.phone,
        };
      }
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['serviceTargets'],
      });
      if (!user) throw new UnauthorizedException('用户不存在');

      const attendant = await this.attendantRepository.findOne({
        where: { userId, status: 'active' },
      });
      const isAttendantMode = role === 'attendant' && !!attendant;

      let elderStatus: {
        isElder: boolean;
        familyGroupId?: number;
        serviceTargetId?: number;
      } = { isElder: false };
      if (!isAttendantMode) {
        try {
          const existing = await this.familyMemberRepository.findOne({
            where: { userId: user.id, isElder: true },
          });
          if (existing) {
            elderStatus = {
              isElder: true,
              familyGroupId: existing.familyGroupId,
              serviceTargetId: existing.linkedServiceTargetId || undefined,
            };
          }
        } catch { /* ignore */ }
      }

      const nickname = isAttendantMode
        ? (attendant?.realName || user.nickname)
        : user.nickname;
      const avatarUrl = isAttendantMode
        ? (attendant?.avatarUrl || user.avatarUrl)
        : user.avatarUrl;
      const phone = isAttendantMode
        ? (attendant?.phone || user.phone)
        : user.phone;

      // 白名单返回，不再 ...user，避免 openid/unionId/status/deletedAt 等内部字段泄漏
      // 角色规则：attendant 只在陪诊员模式下返回；非陪诊员模式时 attendant 角色降为 'user'
      // （与 wechat-login 的 finalRole 逻辑保持一致，防止前端缓存停在 attendant 循环）
      const PROFILE_ADMIN_ROLES = ['admin', 'operator', 'finance', 'customer_service', 'medical_consultant'];
      return {
        id: user.id,
        role: isAttendantMode ? 'attendant' : (PROFILE_ADMIN_ROLES.includes(user.role) ? user.role : 'user'),
        nickname,
        avatarUrl,
        phone,
        name: nickname,
        uiMode: user.uiMode || 'normal',
        hasAttendantProfile: !!attendant,
        isElder: elderStatus.isElder,
        elderFamilyGroupId: elderStatus.familyGroupId,
        elderServiceTargetId: elderStatus.serviceTargetId,
        serviceTargets: user.serviceTargets,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      if (this.isSchemaUnavailable(error)) {
        this.logger.error(
          `getProfile schema error: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new ServiceUnavailableException('系统升级中，请稍后重试');
      }
      throw error;
    }
  }

  async seedAdmin() {
    const shouldSeed =
      this.configService.get<string>('SEED_DEFAULT_ADMIN') === 'true';
    if (!shouldSeed) return;

    const username = this.configService.get<string>('DEFAULT_ADMIN_USERNAME');
    const password = this.configService.get<string>('DEFAULT_ADMIN_PASSWORD');
    if (!username || !password) return;

    const existing = await this.adminUserRepository.findOne({
      where: { username },
    });
    if (!existing) {
      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = this.adminUserRepository.create({
        username,
        password: hashedPassword,
        realName: '超级管理员',
        role: 'admin' as any,
        phone: '13800138000',
      });
      await this.adminUserRepository.save(admin);
      this.logger.log(`Seed admin created: ${username}`);
    }
  }
}
