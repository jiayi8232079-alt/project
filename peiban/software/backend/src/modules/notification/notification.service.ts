import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';
import { MedicationReminder } from '../../entities/medication-reminder.entity.js';
import { SmsService } from './sms.service.js';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  private miniProgramAccessToken?: string;
  private miniProgramAccessTokenExpiresAt = 0;

  // 用药提醒剂量字典 / 兜底文案 内存缓存（TTL 30s）
  //
  // 为什么加缓存：
  //   - `dispatchMedicationReminder` 被每分钟定时任务循环调用；
  //     一次 cron 可能触发几十~上百条提醒，若每条都 SELECT 一次 system_configs
  //     对 MySQL 压力较大且毫无收益（字典基本不变）。
  //   - 30 秒 TTL 确保运营在 admin 后台改字典后，最长 30 秒内全部推送实例生效。
  private dosageConfigCache?: {
    options: string[];
    fallback: string;
    fetchedAt: number;
  };
  private static readonly DOSAGE_CONFIG_CACHE_TTL_MS = 30 * 1000;
  // 微信订阅消息模板「每日用药提醒」剂量字段是 character_string4（允许字母/数字/符号，32 字以内），
  // 字典层面收紧到 20 字，给"数字+中文单位"留出余量（例如 "0.5g 每日3次"）。
  private static readonly MEDICATION_DOSAGE_MAX_LEN = 20;
  private static readonly MEDICATION_DOSAGE_DEFAULT_FALLBACK = '按医嘱';
  // 备注字段 thing5.DATA 上限 20 字（thing 类型通用规格）
  private static readonly MEDICATION_INSTRUCTIONS_MAX_LEN = 20;
  private static readonly MEDICATION_INSTRUCTIONS_DEFAULT = '请遵医嘱';

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly smsService: SmsService,
  ) {}

  private normalizeConfigValue(value?: string | null): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  private parseBooleanConfig(value?: string | null): boolean | undefined {
    const normalized = this.normalizeConfigValue(value)?.toLowerCase();
    if (!normalized) return undefined;
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    return undefined;
  }

  private getEnvConfig(key: string): string | undefined {
    return this.normalizeConfigValue(this.configService.get<string>(key));
  }

  private async getDbConfig(key: string): Promise<string | undefined> {
    const cfg = await this.configRepo.findOne({ where: { key } });
    return this.normalizeConfigValue(cfg?.value);
  }

  /**
   * 加载用药提醒剂量字典 + 兜底文案（带 30s TTL 内存缓存）。
   *
   * 返回字段：
   *   options  - 字典白名单（空数组表示没配置，此时任何 dosage 都会走 fallback）
   *   fallback - 兜底文案（≤ 5 字符，出问题时用的硬保底）
   *
   * 降级策略与 SystemController 中的公开接口保持同语义，
   * 以保证"admin 看到的字典"与"实际推送拿到的字典"一致。
   */
  private async loadDosageConfig(): Promise<{
    options: string[];
    fallback: string;
  }> {
    const now = Date.now();
    if (
      this.dosageConfigCache &&
      now - this.dosageConfigCache.fetchedAt <
        NotificationService.DOSAGE_CONFIG_CACHE_TTL_MS
    ) {
      return {
        options: this.dosageConfigCache.options,
        fallback: this.dosageConfigCache.fallback,
      };
    }

    const rawDict = await this.getDbConfig('medication_dosage_dictionary');
    const rawFallback = await this.getDbConfig('medication_dosage_fallback');

    let options: string[] = [];
    if (rawDict) {
      try {
        const parsed = JSON.parse(rawDict);
        if (Array.isArray(parsed)) {
          options = parsed
            .map((item) => (typeof item === 'string' ? item.trim() : ''))
            .filter(
              (item) =>
                item.length > 0 &&
                item.length <= NotificationService.MEDICATION_DOSAGE_MAX_LEN,
            );
        }
      } catch {
        this.logger.warn(
          '[medication_dosage_dictionary] JSON 解析失败，已降级为空字典，推送将全部走 fallback',
        );
      }
    }

    const trimmedFallback = (rawFallback || '').trim();
    const fallback =
      trimmedFallback &&
      trimmedFallback.length <= NotificationService.MEDICATION_DOSAGE_MAX_LEN
        ? trimmedFallback
        : NotificationService.MEDICATION_DOSAGE_DEFAULT_FALLBACK;

    this.dosageConfigCache = { options, fallback, fetchedAt: now };
    return { options, fallback };
  }

  /**
   * 把 reminder.dosage 转换成可以塞进订阅消息 character_string4.DATA 的值。
   *
   * 规则（保证不被微信拦截）：
   *   1) 空值 → fallback；
   *   2) 超过 MEDICATION_DOSAGE_MAX_LEN（20 字）→ fallback（老数据保护）；
   *   3) 不在字典白名单 → fallback（防止脏数据）；
   *   4) 命中白名单 → 原样返回。
   *
   * 注意：本方法只用于微信订阅消息；SMS 那边保留原 `reminder.dosage`，
   * 语义更丰富（手机短信没有长度限制）。
   */
  private async resolveDosageForTemplate(
    raw: string | null | undefined,
  ): Promise<string> {
    const { options, fallback } = await this.loadDosageConfig();
    const trimmed = String(raw || '').trim();
    if (!trimmed) return fallback;
    if (trimmed.length > NotificationService.MEDICATION_DOSAGE_MAX_LEN) {
      return fallback;
    }
    if (options.length > 0 && !options.includes(trimmed)) {
      return fallback;
    }
    return trimmed;
  }

  private async isMiniProgramSubscribeEnabled(): Promise<boolean> {
    const explicitEnabled = this.parseBooleanConfig(
      (await this.getDbConfig('mini_program_subscribe_enabled')) ??
        this.getEnvConfig('MINI_PROGRAM_SUBSCRIBE_ENABLED'),
    );
    if (explicitEnabled !== undefined) return explicitEnabled;
    return true;
  }

  // ─── 小程序订阅消息 ────────────────────────────────────

  async notifyAttendantOrderAssign(
    openid: string,
    orderNumber: string,
    serviceType: string,
    serviceTime: string,
    orderId: number,
  ) {
    return this.sendMiniProgramSubscribeMessage(openid, 'order_assign_notify', {
      thing1: serviceType || '陪诊服务',
      character_string2: orderNumber,
      time3: serviceTime || '待定',
      thing4: '请及时进入工作台确认接单',
      __page: `pages/workbench/workbench`,
    });
  }

  async notifyAttendantGrabPool(
    openid: string,
    orderNumber: string,
    serviceType: string,
    serviceTime: string,
  ) {
    return this.sendMiniProgramSubscribeMessage(openid, 'grab_pool_notify', {
      thing1: serviceType || '陪诊服务',
      character_string2: orderNumber,
      time3: serviceTime || '待定',
      thing4: '有新订单可抢，请前往工作台查看',
      __page: `pages/workbench/grab/grab`,
    });
  }

  async notifyCustomerOrderStatus(
    openid: string,
    orderNumber: string,
    statusText: string,
    remark: string,
    orderId: number,
  ) {
    return this.sendMiniProgramSubscribeMessage(openid, 'order_status_notify', {
      thing1: statusText,
      character_string2: orderNumber,
      thing3: remark,
      __page: `pages/order/detail/detail?id=${orderId}`,
    });
  }

  /** 服务前提醒（陪诊员端） */
  async notifyAttendantServiceReminder(
    openid: string,
    serviceType: string,
    targetName: string,
    serviceTime: string,
    remark: string,
    orderId: number,
  ) {
    return this.sendMiniProgramSubscribeMessage(
      openid,
      'attendant_service_reminder',
      {
        thing1: serviceType || '陪诊服务',
        thing2: targetName || '客户',
        time3: serviceTime || '待定',
        thing4: remark || '请提前准备并按时到达',
        __page: `pages/workbench/service-timeline/service-timeline?orderId=${orderId}`,
      },
    );
  }

  /** 待签署催办（用户端） */
  async notifyOrderSignReminder(
    openid: string,
    orderNumber: string,
    serviceTime: string,
    remark: string,
    orderId: number,
  ) {
    return this.sendMiniProgramSubscribeMessage(
      openid,
      'order_sign_reminder',
      {
        character_string1: orderNumber,
        time2: serviceTime || '待定',
        thing3: remark || '请尽快在小程序内签署服务确认单',
        __page: `pages/order/service-confirm/service-confirm?orderId=${orderId}`,
      },
    );
  }

  /** 待支付催办（用户端） */
  async notifyOrderPaymentReminder(
    openid: string,
    orderNumber: string,
    amount: string,
    remark: string,
    orderId: number,
  ) {
    return this.sendMiniProgramSubscribeMessage(
      openid,
      'order_payment_reminder',
      {
        character_string1: orderNumber,
        amount2: amount || '—',
        thing3: remark || '服务已完成，请尽快完成结算',
        __page: `pages/order/detail/detail?id=${orderId}`,
      },
    );
  }

  /**
   * 处方已审核通过（家属端）：
   * 让家属第一时间知道"处方已生成 N 条用药提醒"，避免等到服药时间点才被动收到首推。
   * 订阅消息采用 prescription_ready alias，未配置时按 alias fallback 回退到 order_status_notify。
   */
  async notifyFamilyPrescriptionReady(
    openid: string,
    targetName: string,
    medicineSummary: string,
    reminderCount: number,
    prescriptionId: number,
  ): Promise<boolean> {
    const summary = (medicineSummary || '').trim() || '用药计划';
    const page = `pages/family/medication/medication?type=today&prescriptionId=${prescriptionId}`;
    const payload: Record<string, unknown> = {
      thing1: this.truncate(`处方已就绪：${targetName || '家人'}`, 20),
      character_string2: `P${prescriptionId}`,
      thing3: this.truncate(
        `${summary}（共${reminderCount}条提醒）`,
        20,
      ),
      __page: page,
    };
    return this.sendMiniProgramSubscribeMessage(
      openid,
      'prescription_ready',
      payload,
    );
  }

  /**
   * 处方待审核提醒（管理员端，短信）：
   * 陪诊员提交的处方进入待审队列时主动打招呼，避免运营"只能主动打开后台才发现"的被动场景。
   *
   * 使用 medication_reminder 短信模板兜底（字段：患者/药品/剂量，对应语义塞成"患者/处方号/待审")，
   * 这样不用新增腾讯云模板；待运营申请专属 prescription_pending_review 模板后再切换。
   */
  async notifyAdminsPrescriptionPendingReview(
    targetName: string,
    prescriptionId: number,
    doctorName: string,
    getAdminPhones: () => Promise<string[]>,
  ): Promise<number> {
    const phones = await getAdminPhones().catch(() => [] as string[]);
    if (!phones || phones.length === 0) return 0;

    const patient = this.truncate(targetName || '家人', 16);
    const tag = `处方待审#${prescriptionId}`;
    const reason = this.truncate(
      doctorName ? `陪诊员上传，医生：${doctorName}` : '陪诊员上传待审',
      30,
    );
    let sent = 0;
    for (const phone of phones) {
      const ok = await this.smsService.sendSms(phone, 'medication_reminder', [
        patient,
        tag,
        reason,
      ]);
      if (ok) sent += 1;
    }
    return sent;
  }

  /** 服务完成后的评价邀请（用户端） */
  async notifyOrderReviewInvite(
    openid: string,
    orderNumber: string,
    serviceType: string,
    remark: string,
    orderId: number,
  ) {
    return this.sendMiniProgramSubscribeMessage(
      openid,
      'order_review_invite',
      {
        thing1: serviceType || '陪诊服务',
        character_string2: orderNumber,
        thing3: remark || '感谢您的使用，邀请您评价本次服务',
        __page: `pages/order/detail/detail?id=${orderId}&fromReview=1`,
      },
    );
  }

  /**
   * AI 图文陪诊报告就绪（家属端）：
   * 订单完成且后台生成 AI 报告后推送，直达服务报告页。
   * 模板 alias：service_report_ready（优先用 SystemConfig，再回退 ENV）。
   * 若模板不存在，会退回到通用的 order_status_notify，保证一定能送达。
   */
  async notifyFamilyServiceReport(
    openid: string,
    orderNumber: string,
    targetName: string,
    summary: string,
    orderId: number,
  ) {
    const page = `pages/order/service-report/service-report?orderId=${orderId}`;
    const tryAlias = async (alias: string, data: Record<string, unknown>) =>
      this.sendMiniProgramSubscribeMessage(openid, alias, data);

    const fallbackSummary =
      (summary || '陪诊服务已完成，AI 智能解读已生成，请查看').slice(0, 18);

    const primary = await tryAlias('service_report_ready', {
      thing1: (targetName || '家人').slice(0, 18),
      character_string2: orderNumber,
      thing3: fallbackSummary || '陪诊报告已就绪',
      __page: page,
    });
    if (primary) return true;

    return tryAlias('order_status_notify', {
      thing1: '陪诊报告已生成',
      character_string2: orderNumber,
      thing3: fallbackSummary || '点击查看 AI 智能解读',
      __page: page,
    });
  }

  /**
   * 复诊提醒（家属端）：
   * 支持前一天和当天两档提醒，phrase4 / time3 区分，跳转到家属看板。
   * 模板 alias：follow_up_reminder（优先），回退到 medication_reminder。
   */
  async notifyFamilyFollowUpReminder(
    openid: string,
    targetName: string,
    hospital: string,
    department: string,
    dateText: string,
    whenLabel: '明日' | '今日',
    orderId?: number | null,
  ) {
    const page = orderId
      ? `pages/order/detail/detail?id=${orderId}`
      : `pages/family/dashboard/dashboard`;
    const hospitalDept =
      [hospital, department].filter(Boolean).join(' ').trim() || '医院复诊';

    const payload = {
      thing1: (targetName || '家人').slice(0, 18),
      thing2: hospitalDept.slice(0, 18),
      time3: dateText || '待确认',
      thing4: `${whenLabel}需复诊，请提前准备`,
      __page: page,
    } as Record<string, unknown>;

    const primary = await this.sendMiniProgramSubscribeMessage(
      openid,
      'follow_up_reminder',
      payload,
    );
    if (primary) return true;

    // 兜底：若 follow_up_reminder 模板未配置，退回到 medication_reminder 模板发送。
    // 注意：当前「每日用药提醒」模板（TfD0CMvPSadTePFKpbyQCTRRqmd6Jqe13QHHznb）字段是
    //   thing1 / time2 / thing3 / character_string4 / thing5。
    // 模板本意是"用药"，复诊数据是语义妥协；完整医院/科室信息通过 SMS 和家属端首页其他途径呈现。
    // 建议上线前在「系统配置 → 小程序订阅消息」里把 follow_up_reminder 模板配齐，
    // 从而走 primary 路径，不进这个兜底。
    this.logger.warn(
      `[follow_up] follow_up_reminder 模板未配置，已退回 medication_reminder 兜底推送`,
    );
    return this.sendMiniProgramSubscribeMessage(openid, 'medication_reminder', {
      thing1: this.truncate(targetName || '家人', 20),
      time2: this.formatFollowUpDateForTemplate(dateText),
      thing3: this.truncate(`${whenLabel}复诊`, 20),
      character_string4: this.truncate(hospitalDept || '请按时复诊', 20),
      thing5: this.truncate(
        `${whenLabel}请按时前往医院复诊，${hospitalDept}`,
        20,
      ),
      __page: page,
    });
  }

  /**
   * 把 `YYYY-MM-DD` 的复诊日期转成微信 time.DATA 支持的格式。
   * 微信 time 字段要求形如 "YYYY年M月D日 HH:mm" 或 "HH:mm:ss" 等，
   * 原先这里直接用 "2026-04-21" 会被微信拒收（格式不合法）。
   */
  private formatFollowUpDateForTemplate(dateText: string): string {
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(
      String(dateText || '').trim(),
    );
    if (!match) return '09:00:00';
    return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 09:00`;
  }

  async sendMiniProgramSubscribeMessage(
    openid: string,
    templateId: string,
    data: Record<string, unknown>,
  ) {
    if (!(await this.isMiniProgramSubscribeEnabled())) {
      this.logger.log(`当前配置已停用小程序订阅消息 [template=${templateId}]`);
      return false;
    }

    const accessToken = await this.getMiniProgramAccessToken();
    if (!accessToken) return false;

    const resolvedTemplateId = await this.resolveTemplateId(templateId);
    if (!resolvedTemplateId) {
      this.logger.warn(`订阅消息模板未配置: ${templateId}`);
      return false;
    }

    try {
      const payload = {
        touser: openid,
        template_id: resolvedTemplateId,
        page: this.extractPage(data),
        data: this.normalizeSubscribeData(data),
      };
      const response = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        errcode: number;
        errmsg: string;
      };
      if (result.errcode !== 0) {
        this.logger.error(
          `小程序订阅消息发送失败: ${result.errmsg} [template=${templateId}]`,
        );
        return false;
      }
      return true;
    } catch (error) {
      this.logger.error(
        `小程序订阅消息发送异常: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  private async getMiniProgramAccessToken(): Promise<string | undefined> {
    const now = Date.now();
    if (
      this.miniProgramAccessToken &&
      now < this.miniProgramAccessTokenExpiresAt - 60 * 1000
    ) {
      return this.miniProgramAccessToken;
    }

    const appid = this.configService.get<string>('WECHAT_APPID');
    const secret = this.configService.get<string>('WECHAT_SECRET');
    if (!appid || !secret) {
      this.logger.warn('未配置 WECHAT_APPID/WECHAT_SECRET，跳过小程序订阅消息发送');
      return undefined;
    }

    try {
      const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appid}&secret=${secret}`;
      const response = await fetch(url);
      const result = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        errcode?: number;
        errmsg?: string;
      };
      if (!result.access_token) {
        this.logger.error(
          `获取小程序 access_token 失败: ${result.errmsg || '未知错误'}`,
        );
        return undefined;
      }
      this.miniProgramAccessToken = result.access_token;
      this.miniProgramAccessTokenExpiresAt =
        now + (result.expires_in || 7200) * 1000;
      return this.miniProgramAccessToken;
    } catch (error) {
      this.logger.error(
        `获取小程序 access_token 异常: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }
  }

  /**
   * 未配置正式模板时的 alias 回退表。
   *
   * 为什么需要 fallback：
   *   - family_digest / prescription_ready / prescription_pending_review 等
   *     属于新增 alias，运营侧在"系统配置 → 小程序订阅消息"里 **可能还没来得及配**；
   *   - 完全返回 undefined 会让该类消息整条丢失（worker 记一条 warn 日志就结束）；
   *   - 用一个"语义最接近"的已配置模板暂时顶替，至少保证用户侧能收到简化版提醒，
   *     等运营配齐后自动切回主模板。
   *
   * 字段兼容性要求（所有 fallback 都要满足）：
   *   fallback 模板字段数 >= 主 alias 的发送字段数，且相同 key 不报错。
   *   如主模板"medication_reminder"字段：thing1/time2/thing3/character_string4/thing5；
   *   fallback 目标模板里只要同名字段存在即可，其它多余字段微信会忽略。
   */
  private static readonly TEMPLATE_ALIAS_FALLBACKS: Record<string, string[]> = {
    family_digest: ['medication_reminder'],
    follow_up_reminder: ['medication_reminder'],
    prescription_ready: ['order_status_notify'],
    prescription_pending_review: ['order_status_notify'],
  };

  private async resolveTemplateId(
    templateIdOrAlias: string,
  ): Promise<string | undefined> {
    if (!templateIdOrAlias) return undefined;
    if (templateIdOrAlias.includes('TEMPLATE') || templateIdOrAlias.includes('-')) {
      return templateIdOrAlias;
    }

    const direct = await this.loadTemplateIdByAlias(templateIdOrAlias);
    if (direct) return direct;

    const fallbacks =
      NotificationService.TEMPLATE_ALIAS_FALLBACKS[templateIdOrAlias] || [];
    for (const fb of fallbacks) {
      const id = await this.loadTemplateIdByAlias(fb);
      if (id) {
        this.logger.warn(
          `[template fallback] ${templateIdOrAlias} 未配置，已回退到 ${fb}`,
        );
        return id;
      }
    }
    return undefined;
  }

  private async loadTemplateIdByAlias(
    alias: string,
  ): Promise<string | undefined> {
    const dbConfig = await this.configRepo.findOne({
      where: { key: `mini_program_template_${alias}` },
    });
    if (dbConfig?.value) return dbConfig.value;

    const envKey = `MINI_PROGRAM_TEMPLATE_${alias.toUpperCase()}`;
    const envTemplateId = this.configService.get<string>(envKey);
    if (envTemplateId) return envTemplateId;
    return undefined;
  }

  private extractPage(data: Record<string, unknown>): string | undefined {
    const page = data?.__page;
    return typeof page === 'string' ? page : undefined;
  }

  private normalizeSubscribeData(
    data: Record<string, unknown>,
  ): Record<string, { value: string }> {
    const result: Record<string, { value: string }> = {};
    Object.keys(data || {}).forEach((key) => {
      if (key === '__page') return;
      const value = (data as Record<string, any>)[key];
      if (value && typeof value === 'object' && 'value' in value) {
        result[key] = { value: String((value as { value: unknown }).value ?? '') };
      } else {
        result[key] = { value: String(value ?? '') };
      }
    });
    return result;
  }

  // ─── 统一派发入口：用药 / 复诊提醒（小程序 + 短信 双发） ───────────
  //
  // 派发规则（与产品定稿一致）：
  //  1. 小程序订阅消息只能推给「已绑定注册用户」的 openid（通常是家属）；
  //  2. 短信发给两个号码：家属 user.phone + 老人 serviceTarget.phone，
  //     但按手机号去重，避免老人自己就是注册用户时收到两条同样的短信；
  //  3. 任意一端成功即视为送达（调用方会写 lastNotifiedAt，不再重复推）；
  //  4. 短信的开关 / 密钥 / 模板 / 频控全部由 SmsService 内部处理，
  //     本方法不关心，只做"聚合 + 字段映射"。

  async dispatchMedicationReminder(
    reminder: MedicationReminder,
    now: Date = new Date(),
  ): Promise<boolean> {
    const patientName = this.truncate(
      reminder.serviceTarget?.name || reminder.user?.nickname || '用户',
      16,
    );
    const medicineName =
      this.truncate(String(reminder.medicineName || '').trim(), 18) || '待确认';
    // 微信订阅消息用（≤20 字，经字典白名单校验，超标/脏数据一律走 fallback）
    const dosageForSubscribe = await this.resolveDosageForTemplate(
      reminder.dosage,
    );
    // SMS 用（无长度限制，保留原值，空则用 fallback 与订阅消息对齐）
    const dosageForSms =
      this.truncate(String(reminder.dosage || '').trim(), 30) ||
      NotificationService.MEDICATION_DOSAGE_DEFAULT_FALLBACK;
    const firstTime = Array.isArray(reminder.reminderTimes)
      ? reminder.reminderTimes[0] || ''
      : '';
    // 小程序订阅消息「用药时间」使用「YYYY年M月D日 H:mm」格式与新模板示例一致，
    // 让家属在订阅消息里能一眼看到"哪天几点"，不再只显示时间部分。
    const serveTime = this.formatServeTimeWithDate(firstTime, now);
    // 备注（用药说明）：优先取用户维护的 instructions，空时用默认文案
    const instructions =
      this.truncate(
        String(reminder.instructions || '').trim(),
        NotificationService.MEDICATION_INSTRUCTIONS_MAX_LEN,
      ) || NotificationService.MEDICATION_INSTRUCTIONS_DEFAULT;

    let delivered = false;

    if (reminder.user?.openid) {
      // 对应微信模板 TfD0CMvPSadTePFKpbyQCTRRqmd6Jqe13QHHznb（「每日用药提醒」）字段：
      //   thing1.DATA             = 服药人
      //   time2.DATA              = 用药时间（YYYY年M月D日 H:mm）
      //   thing3.DATA             = 药品名称
      //   character_string4.DATA  = 剂量（数字+字母+符号/短中文，32 字以内，字典白名单+fallback 保护）
      //   thing5.DATA             = 备注（≤ 20 字，后台"用药说明"字段）
      const miniOk = await this.sendMiniProgramSubscribeMessage(
        reminder.user.openid,
        'medication_reminder',
        {
          thing1: patientName,
          time2: serveTime,
          thing3: medicineName,
          character_string4: dosageForSubscribe,
          thing5: instructions,
        },
      );
      if (miniOk) delivered = true;
    }

    const phones = this.collectDistinctPhones([
      reminder.user?.phone,
      reminder.serviceTarget?.phone,
    ]);
    for (const phone of phones) {
      const smsOk = await this.smsService.sendSms(
        phone,
        'medication_reminder',
        [patientName, medicineName, dosageForSms],
      );
      if (smsOk) delivered = true;
    }

    return delivered;
  }

  async dispatchFollowUpReminder(
    reminder: MedicationReminder,
    whenLabel: '明日' | '今日',
    now: Date = new Date(),
  ): Promise<boolean> {
    const patientName = this.truncate(
      reminder.serviceTarget?.name || reminder.user?.nickname || '家人',
      16,
    );
    const hospital = String(reminder.followUpHospital || '').trim();
    const department = String(reminder.followUpDepartment || '').trim();
    const hospitalDept =
      [hospital, department].filter(Boolean).join(' ').trim() || '医院复诊';
    const dateText = reminder.startDate || this.formatLocalDate(now);
    const displayDate = `${whenLabel}(${dateText})`;

    let delivered = false;

    if (reminder.user?.openid) {
      const miniOk = await this.notifyFamilyFollowUpReminder(
        reminder.user.openid,
        patientName,
        hospital,
        department,
        dateText,
        whenLabel,
        reminder.orderId,
      );
      if (miniOk) delivered = true;
    }

    const phones = this.collectDistinctPhones([
      reminder.user?.phone,
      reminder.serviceTarget?.phone,
    ]);
    for (const phone of phones) {
      const smsOk = await this.smsService.sendSms(
        phone,
        'follow_up_reminder',
        [patientName, displayDate, hospitalDept],
      );
      if (smsOk) delivered = true;
    }

    return delivered;
  }

  /** 收集合法的大陆手机号并去重（老人/家属同号时只保留一个） */
  private collectDistinctPhones(
    raws: Array<string | null | undefined>,
  ): string[] {
    const set = new Set<string>();
    for (const raw of raws) {
      if (!raw) continue;
      const cleaned = String(raw)
        .trim()
        .replace(/^\+?86/, '')
        .replace(/\D/g, '');
      if (/^1\d{10}$/.test(cleaned)) {
        set.add(cleaned);
      }
    }
    return Array.from(set);
  }

  private formatLocalDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /**
   * 服药时间：优先使用用户设定的 reminderTimes（HH:mm），补 ":00" 变成 HH:mm:ss；
   * 为空时回退到 now 的时刻，避免微信 time.DATA 校验失败。
   */
  private formatServeTime(firstTime: string, now: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const trimmed = (firstTime || '').trim();
    if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
      const [h, m] = trimmed.split(':');
      return `${pad(Number(h))}:${pad(Number(m))}:00`;
    }
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) return trimmed;
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;
  }

  /**
   * 服药时间（日期 + 时间）：对应新模板 time2.DATA，示例格式 "2025年12月13日 8:00"。
   *
   * 规则：
   *   - reminderTimes[0] 是 HH:mm（用户设定的每日服药点），用它作为时分；
   *   - 日期取 now（推送当天）——cron 本身是"当天匹配到这个时间点才推"，
   *     因此"当前这一刻"就是用户真实服药的那一刻；
   *   - 为空时兜底使用 now 的时分。
   */
  private formatServeTimeWithDate(firstTime: string, now: Date): string {
    const trimmed = (firstTime || '').trim();
    let hour = now.getHours();
    let minute = now.getMinutes();
    const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed);
    if (match) {
      hour = Number(match[1]);
      minute = Number(match[2]);
    }
    return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${hour}:${String(minute).padStart(2, '0')}`;
  }

  private truncate(raw: string, maxLen: number): string {
    if (!raw) return '';
    return raw.length > maxLen ? raw.slice(0, maxLen) : raw;
  }
}
