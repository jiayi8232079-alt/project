import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../../entities/user.entity.js';
import { AdminUser } from '../../../entities/admin-user.entity.js';
import { Attendant } from '../../../entities/attendant.entity.js';
import { DEFAULT_TENANT_ID } from '../../../entities/tenant.entity.js';
import { RedisService } from '../../../common/redis/redis.service.js';

interface JwtPayload {
  sub: number;
  role: string;
  type: 'user' | 'admin';
  /**
   * 多租户 ID。Step 3 起所有新发 JWT 都带；
   * 老 JWT（部署前签发）缺失时由 resolveIdentity 回退到 user.tenantId 或 DEFAULT_TENANT_ID。
   * admin 类型恒为 null（跨租户）。
   */
  tenantId?: number | null;
}

/** request.user 形态：业务代码通过 @CurrentUser() 拿到这个对象 */
export interface AuthenticatedUser {
  id: number;
  role: string;
  type: 'user' | 'admin';
  /** admin 为 null（跨租户访问）；普通用户必然非空 */
  tenantId: number | null;
}

/**
 * 鉴权身份缓存（Redis 共享版）：
 * 旧实现是进程内 LRU + 30s TTL，多 PM2 实例间互不可见，
 * 导致「改密码/禁号后另一实例仍放行最多 30s」。
 *
 * 现在改为 **Redis 共享缓存**：
 * - key = jwt:id:{type}:{sub}:{role}:{tenant}，命中即跳过 DB；
 * - TTL 30 秒；
 * - 主动失效（改密码/改角色/禁用）删 Redis 键 → **所有实例立即生效**；
 * - Redis 故障时优雅降级为「无缓存」（每次查 DB），不影响可用性。
 */
const IDENTITY_CACHE_TTL_SEC = 30;
const IDENTITY_CACHE_PREFIX = 'jwt:id:';

/** 持有 RedisService 引用，供下面的自由函数做跨实例失效（fire-and-forget）。 */
let redisRef: RedisService | null = null;

function cacheKey(payload: JwtPayload): string {
  // tenant 加入 key：切换租户/老 JWT 无 tenantId 的请求不会复用陈旧条目
  const tenantPart = payload.tenantId === undefined ? '-' : String(payload.tenantId ?? 'null');
  return `${IDENTITY_CACHE_PREFIX}${payload.type}:${payload.sub}:${payload.role}:${tenantPart}`;
}

/** 外部模块（如 user.service 改密码 / 改角色 / 禁用）可以调用此函数主动失效（跨实例）。 */
export function invalidateJwtIdentityCacheFor(payload: { sub: number; type: 'user' | 'admin' } | { id: number; type: 'user' | 'admin' }): void {
  const sub = (payload as { sub?: number }).sub ?? (payload as { id?: number }).id;
  if (!sub) return;
  void redisRef?.delByPattern(`${IDENTITY_CACHE_PREFIX}${payload.type}:${sub}:*`);
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
    // 暴露给自由函数 invalidateJwtIdentityCacheFor 做跨实例失效
    redisRef = this.redis;
  }

  async validate(payload: JwtPayload) {
    const key = cacheKey(payload);
    const cached = await this.redis.get(key);
    if (cached) {
      try {
        return JSON.parse(cached) as AuthenticatedUser;
      } catch {
        /* 缓存损坏 → 重新解析 */
      }
    }

    const result = await this.resolveIdentity(payload);
    await this.redis.setex(key, IDENTITY_CACHE_TTL_SEC, JSON.stringify(result));
    return result;
  }

  private async resolveIdentity(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (payload.type === 'admin') {
      const admin = await this.adminUserRepository.findOne({
        where: { id: payload.sub },
      });
      if (!admin || !admin.status) {
        throw new UnauthorizedException('管理员账号不可用');
      }
      // admin 类型恒不绑租户：跨租户访问由 TenantGuard 单独鉴权
      return { id: admin.id, role: admin.role, type: 'admin' as const, tenantId: null };
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      withDeleted: true,
    });
    if (!user || !user.status || user.deletedAt) {
      throw new UnauthorizedException('用户账号不可用');
    }

    /**
     * tenantId 解析优先级：
     * 1. payload 显式 tenantId（Step 3 后所有新 JWT 都带）；
     * 2. 数据库 user.tenantId（老 JWT 没 tenantId 时回退）；
     * 3. 兜底 DEFAULT_TENANT_ID（极端情况，避免穿透 null）。
     * 注意：业务代码若发现 payload.tenantId 与 user.tenantId 不一致（切换租户），
     * 应主动调用 invalidateJwtIdentityCacheFor 清缓存后重新签发 JWT。
     */
    const resolvedTenantId =
      payload.tenantId ?? (user.tenantId as number | undefined) ?? DEFAULT_TENANT_ID;

    if (payload.role === 'attendant') {
      const attendant = await this.attendantRepository.findOne({
        where: { userId: user.id },
        withDeleted: true,
      });
      if (attendant && attendant.status === 'active' && !attendant.deletedAt) {
        return {
          id: user.id,
          role: 'attendant',
          type: 'user' as const,
          tenantId: resolvedTenantId,
        };
      }
      // attendant 不可用时 fallback 到数据库真实角色，避免角色变更后 401 连锁登出
    }

    const adminRoles = ['admin', 'operator', 'finance', 'customer_service', 'medical_consultant'];
    const dbRole = user.role as string | undefined;
    const effectiveRole = adminRoles.includes(dbRole ?? '') ? dbRole! : 'user';
    return {
      id: user.id,
      role: effectiveRole,
      type: 'user' as const,
      tenantId: resolvedTenantId,
    };
  }
}
