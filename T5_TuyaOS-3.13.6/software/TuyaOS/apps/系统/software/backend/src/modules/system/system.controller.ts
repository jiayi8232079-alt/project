import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SystemService } from './system.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { assertAdminPasswordPolicy } from '../../common/utils/password-policy.js';
import { normalizeCnPhone } from '../../common/utils/phone-utils.js';

const CUSTOMER_SERVICE_KEY = 'customer_service_url';
const CUSTOMER_SERVICE_CORP_ID_KEY = 'wechat_work_corpid';

const STORE_CONFIG_KEYS = [
  'store_name',
  'store_phone',
  'store_address',
  'store_hours',
  'store_wechat',
  'store_latitude',
  'store_longitude',
  'store_description',
  'store_logo',
];

const MINI_PROGRAM_TEMPLATE_KEYS = {
  medicationReminder: 'mini_program_template_medication_reminder',
  orderServiceReminder: 'mini_program_template_order_service_reminder',
  orderAssignNotify: 'mini_program_template_order_assign_notify',
  grabPoolNotify: 'mini_program_template_grab_pool_notify',
  orderStatusNotify: 'mini_program_template_order_status_notify',
  attendantServiceReminder: 'mini_program_template_attendant_service_reminder',
  orderSignReminder: 'mini_program_template_order_sign_reminder',
  orderPaymentReminder: 'mini_program_template_order_payment_reminder',
  orderReviewInvite: 'mini_program_template_order_review_invite',
};

// 用药提醒剂量字典 / 兜底文案的 system_config key
const MEDICATION_DOSAGE_DICT_KEY = 'medication_dosage_dictionary';
const MEDICATION_DOSAGE_FALLBACK_KEY = 'medication_dosage_fallback';
// 微信订阅消息模板「每日用药提醒」的 character_string4 类型允许 32 字以内字母/数字/符号，
// 我们在字典层面收紧到 20 字，既避免超长，又给未来"数字+中文单位"留出空间。
const MEDICATION_DOSAGE_MAX_LEN = 20;
// 迁移未跑 / 配置被清空时的硬兜底：方案 C（数字+中文单位组合，character_string 实测通过即采用）
const MEDICATION_DOSAGE_DEFAULT_OPTIONS = [
  '1片/次',
  '2片/次',
  '1粒/次',
  '3滴/次',
  '5ml',
  '10ml',
  '1日3次',
  '1日2次',
  '按医嘱',
];
const MEDICATION_DOSAGE_DEFAULT_FALLBACK = '按医嘱';

@ApiTags('系统配置')
@Controller('system')
export class SystemController {
  constructor(
    private readonly systemService: SystemService,
    private readonly storageService: StorageService,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
  ) {}

  /** 公开接口：小程序获取企业微信客服配置（无需登录） */
  @Get('config/public/customer-service-url')
  @ApiOperation({ summary: '获取企业微信客服配置（公开）' })
  async getCustomerServiceUrl() {
    const url = await this.systemService.getConfig(CUSTOMER_SERVICE_KEY);
    const corpId = await this.systemService.getConfig(
      CUSTOMER_SERVICE_CORP_ID_KEY,
    );
    return { url: url || '', corpId: corpId || '' };
  }

  /** 公开接口：小程序获取门店信息（无需登录） */
  /** 公开接口：小程序功能开关（无需登录；用于是否展示导诊/健康顾问入口） */
  @Get('config/public/mini-program-features')
  @ApiOperation({ summary: '获取小程序 AI 功能展示开关（公开）' })
  async getMiniProgramFeatures() {
    const [triage, advisor] = await Promise.all([
      this.systemService.getConfig('miniprogram_show_ai_triage'),
      this.systemService.getConfig('miniprogram_show_ai_advisor'),
    ]);
    return {
      showAiTriage: triage !== 'false' && triage !== '0',
      showAiAdvisor: advisor !== 'false' && advisor !== '0',
    };
  }

  @Get('config/public/store-info')
  @ApiOperation({ summary: '获取门店信息（公开）' })
  async getStoreInfo() {
    const result: Record<string, string> = {};
    for (const key of STORE_CONFIG_KEYS) {
      const val = await this.systemService.getConfig(key);
      result[key.replace('store_', '')] =
        key === 'store_logo'
          ? await this.storageService.resolveUrl(val)
          : val || '';
    }
    return result;
  }

  /** 公开接口：小程序获取订阅消息模板配置（无需登录） */
  @Get('config/public/mini-program-templates')
  @ApiOperation({ summary: '获取小程序订阅消息模板配置（公开）' })
  async getMiniProgramTemplates() {
    return {
      medicationReminder:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.medicationReminder)) || '',
      orderServiceReminder:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.orderServiceReminder)) || '',
      orderAssignNotify:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.orderAssignNotify)) || '',
      grabPoolNotify:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.grabPoolNotify)) || '',
      orderStatusNotify:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.orderStatusNotify)) || '',
      attendantServiceReminder:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.attendantServiceReminder)) || '',
      orderSignReminder:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.orderSignReminder)) || '',
      orderPaymentReminder:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.orderPaymentReminder)) || '',
      orderReviewInvite:
        (await this.systemService.getConfig(MINI_PROGRAM_TEMPLATE_KEYS.orderReviewInvite)) || '',
    };
  }

  /**
   * 公开接口：小程序 / admin 获取用药提醒剂量字典 + 兜底文案
   *
   * 为什么公开：
   *   - admin 创建/编辑用药提醒要用下拉；
   *   - 小程序自助创建用药提醒也要用下拉；
   *   - 该字典不含敏感信息，且 fallback 本身就是公开推送文案。
   *
   * 降级策略：
   *   1) 配置缺失（迁移未跑）→ 返回 code 里的 hardcoded 默认值，不让前端挂掉；
   *   2) JSON 非法 / 非字符串数组 → 同样降级到默认值，并在日志里打 warn；
   *   3) 字典项超 20 字 / 空字符串 → 过滤掉（微信模板 character_string4 放宽到 32 字，
   *      这里再留 12 字缓冲，防止前端误录超长脏数据）；
   *   4) fallback 超 20 字 / 空 → 用 hardcoded "按医嘱"。
   */
  @Get('config/public/medication-dosage-dictionary')
  @ApiOperation({ summary: '获取用药提醒剂量字典（公开）' })
  async getMedicationDosageDictionary() {
    const rawDict = await this.systemService.getConfig(MEDICATION_DOSAGE_DICT_KEY);
    const rawFallback = await this.systemService.getConfig(
      MEDICATION_DOSAGE_FALLBACK_KEY,
    );

    let options: string[] = MEDICATION_DOSAGE_DEFAULT_OPTIONS;
    if (rawDict) {
      try {
        const parsed = JSON.parse(rawDict);
        if (Array.isArray(parsed)) {
          const sanitized = parsed
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(
              (item) =>
                item.length > 0 && item.length <= MEDICATION_DOSAGE_MAX_LEN,
            );
          if (sanitized.length > 0) options = sanitized;
        }
      } catch {
        // JSON 非法 → 保持默认字典（用于保护前端，不报 500）
      }
    }

    const trimmedFallback = (rawFallback || '').trim();
    const fallback =
      trimmedFallback && trimmedFallback.length <= MEDICATION_DOSAGE_MAX_LEN
        ? trimmedFallback
        : MEDICATION_DOSAGE_DEFAULT_FALLBACK;

    return {
      options,
      fallback,
      maxLength: MEDICATION_DOSAGE_MAX_LEN,
    };
  }

  @Get('configs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取所有系统配置' })
  async getAllConfigs() {
    return this.systemService.getAllConfigs();
  }

  @Get('configs/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取单个配置' })
  async getConfig(@Param('key') key: string) {
    const value = await this.systemService.getConfig(key);
    if (key === 'store_logo') {
      return this.storageService.resolveUrl(value);
    }
    return value;
  }

  @Post('storage/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '测试对象存储连接' })
  testStorageConnection() {
    return this.storageService.testConnection();
  }

  @Post('wechat/webhook/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '测试企业微信群机器人 Webhook 发送' })
  async testWechatWebhook(
    @Body() body: { webhook?: string; content?: string },
  ) {
    const webhook = String(body?.webhook || '').trim();
    if (
      !/^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9-]+$/i.test(
        webhook,
      )
    ) {
      throw new BadRequestException(
        'Webhook 地址格式不正确，请粘贴企业微信群机器人的完整地址',
      );
    }

    const content =
      String(body?.content || '【陪了个伴】企业微信机器人测试消息').trim() ||
      '【陪了个伴】企业微信机器人测试消息';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: content.slice(0, 1800) },
        }),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new BadRequestException('Webhook 请求超时（5 秒未响应），请检查地址');
      }
      throw new BadRequestException('Webhook 请求失败，请检查网络或地址可达性');
    } finally {
      clearTimeout(timeoutId);
    }
    const result = (await response.json().catch(() => null)) as
      | { errcode?: number; errmsg?: string }
      | null;

    if (!response.ok || result?.errcode !== 0) {
      throw new BadRequestException(
        result?.errmsg || `Webhook 发送失败（HTTP ${response.status}）`,
      );
    }

    return { success: true, message: '测试消息发送成功' };
  }

  @Put('configs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '批量保存配置' })
  batchSetConfigs(
    @Body() configs: { key: string; value: string; description?: string }[],
  ) {
    return this.systemService.batchSetConfigs(configs);
  }

  @Put('configs/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '设置单个配置' })
  setConfig(
    @Param('key') key: string,
    @Body() body: { value: string; description?: string },
  ) {
    return this.systemService.setConfig(key, body.value, body.description);
  }

  @Delete('configs/:key')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除配置' })
  deleteConfig(@Param('key') key: string) {
    return this.systemService.deleteConfig(key);
  }

  /* ───── 管理员账号管理 ───── */

  @Get('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取管理员列表' })
  async getAdminList() {
    return this.adminUserRepository.find({
      select: ['id', 'username', 'realName', 'role', 'phone', 'status', 'createdAt'],
      order: { createdAt: 'ASC' },
    });
  }

  @Post('admins')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新建管理员账号' })
  async createAdmin(
    @Body() body: { username: string; password: string; realName?: string; role?: string; phone?: string },
  ) {
    const username = body?.username?.trim();
    if (!username) throw new BadRequestException('用户名不能为空');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new BadRequestException('用户名只能包含字母、数字、下划线，且长度 3-20 位');
    }
    const password = assertAdminPasswordPolicy(body?.password);

    const exists = await this.adminUserRepository.findOne({ where: { username } });
    if (exists) throw new BadRequestException('用户名已存在');

    const validRoles = Object.values(UserRole);
    // 新建账号默认为普通操作员，禁止未明确指定就授予超管权限
    const role = validRoles.includes(body.role as UserRole)
      ? (body.role as UserRole)
      : UserRole.OPERATOR;

    const hashed = await bcrypt.hash(password, 10);
    const normalizedPhone = normalizeCnPhone(body?.phone, '管理员手机号') ?? '';
    const admin = this.adminUserRepository.create({
      username,
      password: hashed,
      realName: body.realName?.trim() || '',
      role,
      phone: normalizedPhone,
    });
    const saved = await this.adminUserRepository.save(admin);
    return { id: saved.id, username: saved.username, realName: saved.realName, role: saved.role, message: '创建成功' };
  }

  @Put('admins/change-password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.FINANCE, UserRole.CUSTOMER_SERVICE, UserRole.MEDICAL_CONSULTANT)
  @ApiBearerAuth()
  @ApiOperation({ summary: '修改自己的密码' })
  async changeMyPassword(
    @CurrentUser() user: any,
    @Body() body: { oldPassword: string; newPassword: string },
  ) {
    const oldPassword = body?.oldPassword?.trim();
    if (!oldPassword) throw new BadRequestException('请输入旧密码');
    const newPassword = assertAdminPasswordPolicy(body?.newPassword);
    if (oldPassword === newPassword) {
      throw new BadRequestException('新密码不能与旧密码相同');
    }

    const adminId = Number(user?.id);
    if (!adminId || user?.type !== 'admin') {
      throw new BadRequestException('账号信息异常，请重新登录');
    }

    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId },
      select: ['id', 'password'],
    });
    if (!admin) throw new BadRequestException('账号不存在');

    const match = await bcrypt.compare(oldPassword, admin.password);
    if (!match) throw new BadRequestException('旧密码不正确');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.adminUserRepository.update(admin.id, { password: hashed });
    return { message: '密码修改成功' };
  }

  @Put('admins/:id/info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '编辑管理员信息' })
  async updateAdminInfo(
    @CurrentUser() currentUser: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { realName?: string; role?: string; phone?: string; status?: boolean },
  ) {
    const admin = await this.adminUserRepository.findOne({ where: { id } });
    if (!admin) throw new BadRequestException('管理员不存在');

    const currentAdminId = Number(currentUser?.id);
    const isEditingSelf = currentAdminId === id;

    const updates: Partial<AdminUser> = {};
    if (body.realName !== undefined) updates.realName = body.realName.trim();
    if (body.phone !== undefined) {
      updates.phone = normalizeCnPhone(body.phone, '管理员手机号') ?? '';
    }

    // 防御：禁止禁用自己（避免自锁后台）
    if (body.status !== undefined) {
      if (isEditingSelf && body.status === false) {
        throw new BadRequestException('不能禁用自己的账号');
      }
      updates.status = body.status;
    }

    if (body.role !== undefined) {
      const validRoles = Object.values(UserRole);
      if (!validRoles.includes(body.role as UserRole)) {
        throw new BadRequestException('无效的角色类型');
      }
      // 防御：禁止自己修改自己的角色（避免降级后失去管理权限）
      if (isEditingSelf && body.role !== admin.role) {
        throw new BadRequestException('不能修改自己的角色，请由其他超级管理员操作');
      }
      updates.role = body.role as UserRole;
    }

    // 关键防御：禁用或降级最后一个启用中的超级管理员
    const willDisable = updates.status === false;
    const willDemote =
      admin.role === UserRole.ADMIN &&
      updates.role !== undefined &&
      updates.role !== UserRole.ADMIN;

    if (admin.role === UserRole.ADMIN && (willDisable || willDemote)) {
      const activeSuperAdminCount = await this.adminUserRepository.count({
        where: { role: UserRole.ADMIN, status: true },
      });
      // 如果当前目标账号本身就是启用中的超管，它是否是最后一个
      const isCurrentlyActive = admin.status === true;
      if (isCurrentlyActive && activeSuperAdminCount <= 1) {
        throw new BadRequestException(
          '系统必须至少保留一位启用中的超级管理员，无法禁用或降级当前账号',
        );
      }
    }

    if (Object.keys(updates).length > 0) {
      await this.adminUserRepository.update(id, updates);
      await this.systemService.auditUpdateAdminInfo(
        currentAdminId,
        admin,
        updates,
      );
    }
    return { message: '更新成功' };
  }

  @Put('admins/:id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '重置管理员密码' })
  async resetAdminPassword(
    @CurrentUser() currentUser: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { newPassword: string },
  ) {
    // 防御：禁止通过"重置密码"接口修改自己，应走"修改自己的密码"走旧密码校验
    if (Number(currentUser?.id) === id) {
      throw new BadRequestException('不能通过此接口重置自己的密码，请使用"修改密码"功能');
    }

    const newPassword = assertAdminPasswordPolicy(body?.newPassword);

    const admin = await this.adminUserRepository.findOne({ where: { id } });
    if (!admin) throw new BadRequestException('管理员不存在');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.adminUserRepository.update(id, { password: hashed });
    return this.systemService.auditResetAdminPassword(
      Number(currentUser?.id),
      admin,
    );
  }

  /* ───── 陪诊员账号管理 ───── */

  @Get('attendants')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取陪诊员账号列表（账号管理用）' })
  async getAttendantAccounts() {
    return this.attendantRepository.find({
      select: ['id', 'realName', 'username', 'phone', 'employeeId', 'status', 'createdAt'],
      order: { createdAt: 'ASC' },
    });
  }

  @Put('attendants/:id/password')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置/重置陪诊员密码' })
  async resetAttendantPassword(
    @CurrentUser() currentUser: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { newPassword: string },
  ) {
    const newPassword = assertAdminPasswordPolicy(body?.newPassword);

    const attendant = await this.attendantRepository.findOne({ where: { id } });
    if (!attendant) throw new BadRequestException('陪诊员不存在');

    const hashed = await bcrypt.hash(newPassword, 10);
    await this.attendantRepository.update(id, { password: hashed });
    return this.systemService.auditResetAttendantPassword(
      Number(currentUser?.id),
      attendant,
    );
  }

  @Put('attendants/:id/username')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: '设置陪诊员登录用户名' })
  async setAttendantUsername(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { username: string },
  ) {
    const username = body?.username?.trim();
    if (!username) throw new BadRequestException('用户名不能为空');
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      throw new BadRequestException('用户名只能包含字母、数字、下划线，且长度 3-20 位');
    }

    const attendant = await this.attendantRepository.findOne({ where: { id } });
    if (!attendant) throw new BadRequestException('陪诊员不存在');

    const dup = await this.attendantRepository.findOne({ where: { username } });
    if (dup && dup.id !== id) throw new BadRequestException('用户名已被使用');

    await this.attendantRepository.update(id, { username });
    return { message: '用户名设置成功' };
  }
}
