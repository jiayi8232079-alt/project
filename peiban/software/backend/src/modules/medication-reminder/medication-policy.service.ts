import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';
import {
  MedicationEscalationOverride,
  ReminderSeverity,
} from '../../entities/medication-reminder.entity.js';

export interface ResolvedEscalationPolicy {
  /** 到点后 N 分钟仍 pending，追推第 1 次提醒（mini_program + sms） */
  firstFollowUpMinutes: number;
  /** 到点后 M 分钟仍 pending，把 log 标 missed，同时追推家属 */
  markMissedMinutes: number;
  /** 到点后 K 分钟仍 pending，升级管理员 / 客服；null 表示不升级 */
  escalateAdminMinutes: number | null;
  /** 是否完全禁用升级链（只做首推） */
  disabled: boolean;
}

/**
 * 严重度默认策略（硬编码兜底，系统配置会覆盖）。
 * 表达含义见 ResolvedEscalationPolicy 字段注释。
 */
const DEFAULT_POLICY: Record<ReminderSeverity, ResolvedEscalationPolicy> = {
  [ReminderSeverity.HIGH]: {
    firstFollowUpMinutes: 15,
    markMissedMinutes: 30,
    escalateAdminMinutes: 60,
    disabled: false,
  },
  [ReminderSeverity.MEDIUM]: {
    firstFollowUpMinutes: 30,
    markMissedMinutes: 60,
    escalateAdminMinutes: 120,
    disabled: false,
  },
  [ReminderSeverity.LOW]: {
    firstFollowUpMinutes: 60,
    markMissedMinutes: 120,
    escalateAdminMinutes: null,
    disabled: false,
  },
};

/**
 * 用药提醒策略中心：
 *  - 严重度 → 升级阈值（系统配置可覆盖、reminder 级 override 再覆盖）
 *  - 每日频次 → 默认 reminderTimes
 *  - 总药量 → endDate 自动计算
 *
 * 为什么独立出来：
 *   - Prescription 批量录入、Reminder 创建、Execution 打卡、Worker 升级链
 *     四个地方都要用，不想各抄一份；
 *   - 策略参数写在 system_configs 里，运营能随时调阈值；独立 service 便于挂缓存。
 */
@Injectable()
export class MedicationPolicyService {
  private readonly logger = new Logger(MedicationPolicyService.name);

  private policyCache?: {
    value: Record<ReminderSeverity, ResolvedEscalationPolicy>;
    fetchedAt: number;
  };
  private static readonly POLICY_CACHE_TTL_MS = 30 * 1000;

  /** 每日 N 次对应的默认"餐后"推送时段（HH:mm）。 */
  private static readonly DEFAULT_DAILY_TIMES: Record<number, string[]> = {
    1: ['08:00'],
    2: ['08:00', '20:00'],
    3: ['08:00', '14:00', '20:00'],
    4: ['08:00', '12:00', '17:00', '21:00'],
    6: ['06:00', '10:00', '14:00', '18:00', '21:00', '23:00'],
  };

  constructor(
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
  ) {}

  async getPolicy(severity: ReminderSeverity): Promise<ResolvedEscalationPolicy> {
    const all = await this.getAllPolicies();
    return all[severity] || DEFAULT_POLICY[severity];
  }

  /**
   * 合并严重度默认值 + reminder 级 override。reminder.override 非 null/undefined 字段优先。
   */
  async resolvePolicy(
    severity: ReminderSeverity,
    override: MedicationEscalationOverride | null | undefined,
  ): Promise<ResolvedEscalationPolicy> {
    const base = await this.getPolicy(severity);
    if (!override) return base;

    if (override.disableEscalation) {
      return { ...base, disabled: true };
    }

    return {
      firstFollowUpMinutes:
        override.firstFollowUpMinutes ?? base.firstFollowUpMinutes,
      markMissedMinutes: override.markMissedMinutes ?? base.markMissedMinutes,
      escalateAdminMinutes:
        override.escalateAdminAfterMinutes ?? base.escalateAdminMinutes,
      disabled: false,
    };
  }

  /**
   * 根据每日频次生成默认提醒时段。不在映射表里的频次回退：
   *   - timesPerDay <= 0 → 空数组
   *   - 5 次/日走 4 次表再补一个 23:00
   *   - 其他 → 取映射里最接近的
   */
  buildDefaultReminderTimes(timesPerDay: number | null | undefined): string[] {
    const n = Number(timesPerDay || 0);
    if (!Number.isFinite(n) || n <= 0) return [];
    if (MedicationPolicyService.DEFAULT_DAILY_TIMES[n]) {
      return [...MedicationPolicyService.DEFAULT_DAILY_TIMES[n]];
    }
    if (n === 5) return ['08:00', '11:00', '14:00', '17:00', '21:00'];
    if (n > 6) return MedicationPolicyService.DEFAULT_DAILY_TIMES[6];
    return MedicationPolicyService.DEFAULT_DAILY_TIMES[3];
  }

  /**
   * 根据 totalQuantity + dosePerTime + timesPerDay 自动推算 endDate（含 startDate 当天）。
   *
   * 公式：days = ceil(totalQuantity / (dosePerTime × timesPerDay))
   *       endDate = startDate + (days - 1) 天
   *
   * 任一参数缺失 / 非正数 → 返回 null，由调用方决定兜底策略（比如保留前端填值）。
   */
  computeEndDate(params: {
    startDate: string;
    totalQuantity?: number | null;
    dosePerTime?: number | null;
    timesPerDay?: number | null;
  }): string | null {
    const total = Number(params.totalQuantity || 0);
    const dose = Number(params.dosePerTime || 0);
    const freq = Number(params.timesPerDay || 0);
    if (!total || !dose || !freq) return null;
    const dailyConsumption = dose * freq;
    if (dailyConsumption <= 0) return null;
    const days = Math.max(1, Math.ceil(total / dailyConsumption));
    const start = this.parseDate(params.startDate);
    if (!start) return null;
    const end = new Date(start.getTime());
    end.setDate(end.getDate() + (days - 1));
    return this.formatDate(end);
  }

  /**
   * 根据 endDate 反推"剩余疗程天数"（含今天）。endDate 已过 → 0。
   */
  computeRemainingDays(endDate: string, today: Date = new Date()): number {
    const end = this.parseDate(endDate);
    if (!end) return 0;
    const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffMs = end.getTime() - t.getTime();
    if (diffMs < 0) return 0;
    return Math.floor(diffMs / (24 * 3600 * 1000)) + 1;
  }

  private async getAllPolicies(): Promise<
    Record<ReminderSeverity, ResolvedEscalationPolicy>
  > {
    const now = Date.now();
    if (
      this.policyCache &&
      now - this.policyCache.fetchedAt <
        MedicationPolicyService.POLICY_CACHE_TTL_MS
    ) {
      return this.policyCache.value;
    }

    const keys = [
      'medication_escalation_high_first_min',
      'medication_escalation_high_missed_min',
      'medication_escalation_high_admin_min',
      'medication_escalation_medium_first_min',
      'medication_escalation_medium_missed_min',
      'medication_escalation_medium_admin_min',
      'medication_escalation_low_first_min',
      'medication_escalation_low_missed_min',
      'medication_escalation_low_admin_enabled',
    ];
    const rows = await this.configRepo
      .createQueryBuilder('c')
      .where('c.key IN (:...keys)', { keys })
      .getMany();
    const map = new Map(rows.map((r) => [r.key, (r.value || '').trim()]));

    const pickInt = (key: string, fallback: number): number => {
      const raw = map.get(key);
      if (!raw) return fallback;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    };
    const pickBool = (key: string, fallback: boolean): boolean => {
      const raw = (map.get(key) || '').toLowerCase();
      if (!raw) return fallback;
      if (['true', '1', 'yes', 'on'].includes(raw)) return true;
      if (['false', '0', 'no', 'off'].includes(raw)) return false;
      return fallback;
    };

    const merged: Record<ReminderSeverity, ResolvedEscalationPolicy> = {
      [ReminderSeverity.HIGH]: {
        firstFollowUpMinutes: pickInt(
          'medication_escalation_high_first_min',
          DEFAULT_POLICY.high.firstFollowUpMinutes,
        ),
        markMissedMinutes: pickInt(
          'medication_escalation_high_missed_min',
          DEFAULT_POLICY.high.markMissedMinutes,
        ),
        escalateAdminMinutes: pickInt(
          'medication_escalation_high_admin_min',
          DEFAULT_POLICY.high.escalateAdminMinutes ?? 60,
        ),
        disabled: false,
      },
      [ReminderSeverity.MEDIUM]: {
        firstFollowUpMinutes: pickInt(
          'medication_escalation_medium_first_min',
          DEFAULT_POLICY.medium.firstFollowUpMinutes,
        ),
        markMissedMinutes: pickInt(
          'medication_escalation_medium_missed_min',
          DEFAULT_POLICY.medium.markMissedMinutes,
        ),
        escalateAdminMinutes: pickInt(
          'medication_escalation_medium_admin_min',
          DEFAULT_POLICY.medium.escalateAdminMinutes ?? 120,
        ),
        disabled: false,
      },
      [ReminderSeverity.LOW]: {
        firstFollowUpMinutes: pickInt(
          'medication_escalation_low_first_min',
          DEFAULT_POLICY.low.firstFollowUpMinutes,
        ),
        markMissedMinutes: pickInt(
          'medication_escalation_low_missed_min',
          DEFAULT_POLICY.low.markMissedMinutes,
        ),
        escalateAdminMinutes: pickBool('medication_escalation_low_admin_enabled', false)
          ? pickInt('medication_escalation_low_missed_min', 120) * 2
          : null,
        disabled: false,
      },
    };

    this.policyCache = { value: merged, fetchedAt: now };
    return merged;
  }

  private parseDate(raw: string): Date | null {
    if (!raw) return null;
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(raw).trim());
    if (!match) return null;
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
    );
  }

  private formatDate(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
}
