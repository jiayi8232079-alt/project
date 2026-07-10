import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import {
  MedicationReminder,
  ReminderStatus,
  ReminderType,
} from '../../entities/medication-reminder.entity.js';
import {
  MedicationExecutionLog,
  MedicationExecutionStatus,
} from '../../entities/medication-execution-log.entity.js';
import { SystemConfig } from '../../entities/system-config.entity.js';
import {
  MedicationJobChannel,
  MedicationJobKind,
} from '../../entities/medication-notification-job.entity.js';
import { MedicationNotificationService } from './medication-notification.service.js';

/**
 * 家属每日汇总：每天 20:00 给家属推一条"今日用药全貌"。
 *
 * 为什么不复用普通提醒：
 *  - 普通提醒是到点/追推/漏服升级，家属一天可能收到 4~10 条；
 *  - 汇总是"一日一条安心消息"，即便老人全勤，家属也能看到"一切正常"；
 *  - 漏服日家属关注的是"今天共漏了 2 次"，而不是一条条翻记录。
 *
 * 推送内容（借用 medication_reminder 模板，妥协映射）：
 *   thing1           = 服药人
 *   time2            = 今日 20:00 推送点
 *   thing3           = "今日用药汇总"
 *   character_string4= "已服 X/Y 次"
 *   thing5           = 漏服/未打卡的简报
 *
 * 短信 params：[患者, "今日汇总", "已服 X/Y 次"]（SMS 模板已支持 3 变量）
 */
@Injectable()
export class MedicationDigestService {
  private readonly logger = new Logger(MedicationDigestService.name);
  private static readonly CONFIG_HOUR_KEY = 'medication_family_digest_hour';
  private static readonly CONFIG_ENABLED_KEY = 'medication_family_digest_enabled';

  constructor(
    @InjectRepository(MedicationReminder)
    private readonly reminderRepo: Repository<MedicationReminder>,
    @InjectRepository(MedicationExecutionLog)
    private readonly logRepo: Repository<MedicationExecutionLog>,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly notificationService: MedicationNotificationService,
  ) {}

  /**
   * 每小时的整点都跑一次，内部再按配置的 hour 决定是否真正执行；
   * 这样运营在后台把 hour 从 20 改成 19 后，当天就能生效。
   */
  @Cron('0 0 * * * *')
  async tick() {
    const enabled = await this.isEnabled();
    if (!enabled) return;
    const hour = await this.getConfiguredHour();
    const now = new Date();
    if (now.getHours() !== hour) return;

    try {
      await this.dispatchToday();
    } catch (err) {
      this.logger.error(
        `[family digest] 每日汇总派发失败: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * 手动触发入口：供后台"立即汇总一次"按钮 / 运维补推使用。
   */
  async dispatchToday(): Promise<{ users: number; enqueued: number }> {
    const now = new Date();
    const today = this.toLocalDateString(now);

    const reminders = await this.reminderRepo.find({
      where: {
        status: ReminderStatus.ACTIVE,
        reminderType: ReminderType.MEDICATION,
      },
      relations: ['user', 'serviceTarget'],
    });
    if (reminders.length === 0) return { users: 0, enqueued: 0 };

    const grouped = new Map<string, MedicationReminder[]>();
    for (const r of reminders) {
      const key = `${r.userId}:${r.serviceTargetId || 'self'}`;
      const list = grouped.get(key) || [];
      list.push(r);
      grouped.set(key, list);
    }

    let enqueuedTotal = 0;
    for (const list of grouped.values()) {
      const stat = await this.computeDailyStat(list, today);
      if (stat.total === 0) continue;
      const representative = list[0];
      enqueuedTotal += await this.enqueueDigest(representative, stat, now);
    }

    this.logger.log(
      `[family digest] users=${grouped.size} enqueued=${enqueuedTotal}`,
    );
    return { users: grouped.size, enqueued: enqueuedTotal };
  }

  private async computeDailyStat(
    reminders: MedicationReminder[],
    today: string,
  ): Promise<{
    total: number;
    taken: number;
    missed: number;
    pending: number;
    skipped: number;
    missedMedicines: string[];
  }> {
    const reminderIds = reminders.map((r) => r.id);
    const startTimes: Record<string, number> = {};
    for (const r of reminders) {
      for (const t of r.reminderTimes || []) startTimes[t] = (startTimes[t] || 0) + 1;
    }
    const logs = await this.logRepo.find({
      where: {
        reminderId: In(reminderIds),
        scheduledDate: Between(today, today),
      },
    });

    const byStatus: Record<string, number> = {
      taken: 0,
      missed: 0,
      pending: 0,
      skipped: 0,
    };
    const missedReminderIds = new Set<number>();
    for (const log of logs) {
      byStatus[log.status] = (byStatus[log.status] || 0) + 1;
      if (log.status === MedicationExecutionStatus.MISSED) {
        missedReminderIds.add(log.reminderId);
      }
    }

    const missedMedicines = reminders
      .filter((r) => missedReminderIds.has(r.id))
      .map((r) => r.medicineName);

    const total =
      byStatus.taken + byStatus.missed + byStatus.pending + byStatus.skipped;
    return {
      total,
      taken: byStatus.taken,
      missed: byStatus.missed,
      pending: byStatus.pending,
      skipped: byStatus.skipped,
      missedMedicines,
    };
  }

  private async enqueueDigest(
    reminder: MedicationReminder,
    stat: {
      total: number;
      taken: number;
      missed: number;
      pending: number;
      skipped: number;
      missedMedicines: string[];
    },
    now: Date,
  ): Promise<number> {
    const { miniProgramTargets, smsTargets } =
      await this.notificationService.resolveReminderTargets(reminder);
    if (miniProgramTargets.length === 0 && smsTargets.length === 0) return 0;

    const patient =
      reminder.serviceTarget?.name || reminder.user?.nickname || '家人';
    const served = `${stat.taken}/${stat.total}`;
    const missedText = stat.missed
      ? `漏服${stat.missed}次${
          stat.missedMedicines.length
            ? `（${stat.missedMedicines.slice(0, 2).join('、')}${stat.missedMedicines.length > 2 ? '…' : ''}）`
            : ''
        }`
      : stat.pending
        ? `尚有${stat.pending}次待打卡`
        : '全部按时服用';
    const timeText = this.formatTimeText(now);

    const payload: Record<string, unknown> = {
      thing1: this.truncate(patient, 20),
      time2: timeText,
      thing3: '今日用药汇总',
      character_string4: this.truncate(`已服 ${served}`, 20),
      thing5: this.truncate(missedText, 20),
      __page: 'pages/family/medication/medication?view=summary',
      smsParams: [this.truncate(patient, 16), '今日汇总', `已服 ${served}`],
    };

    let count = 0;
    if (miniProgramTargets.length > 0) {
      const jobs = await this.notificationService.enqueue({
        kind: MedicationJobKind.FAMILY_DIGEST,
        scheduledAt: now,
        reminder,
        channels: [MedicationJobChannel.MINI_PROGRAM],
        targets: miniProgramTargets,
        payload,
      });
      count += jobs.length;
    }
    if (smsTargets.length > 0 && stat.missed > 0) {
      // 全勤日不发短信，减少骚扰；仅当漏服时才走短信。
      const jobs = await this.notificationService.enqueue({
        kind: MedicationJobKind.FAMILY_DIGEST,
        scheduledAt: now,
        reminder,
        channels: [MedicationJobChannel.SMS],
        targets: smsTargets,
        payload,
      });
      count += jobs.length;
    }
    return count;
  }

  private async isEnabled(): Promise<boolean> {
    const cfg = await this.configRepo.findOne({
      where: { key: MedicationDigestService.CONFIG_ENABLED_KEY },
    });
    const value = (cfg?.value || '').toLowerCase().trim();
    if (!value) return true;
    if (['false', '0', 'no', 'off'].includes(value)) return false;
    return true;
  }

  private async getConfiguredHour(): Promise<number> {
    const cfg = await this.configRepo.findOne({
      where: { key: MedicationDigestService.CONFIG_HOUR_KEY },
    });
    const n = Number(cfg?.value);
    if (Number.isFinite(n) && n >= 0 && n <= 23) return n;
    return 20;
  }

  private toLocalDateString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  private formatTimeText(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private truncate(raw: string, max: number): string {
    const s = String(raw || '').trim();
    return s.length > max ? s.slice(0, max) : s;
  }
}
