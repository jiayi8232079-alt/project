import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemConfig } from '../../entities/system-config.entity.js';
import {
  MedicationNotificationJob,
  MedicationJobChannel,
  MedicationJobKind,
  MedicationJobStatus,
  MedicationJobTargetKind,
} from '../../entities/medication-notification-job.entity.js';
import { NotificationService } from '../notification/notification.service.js';
import {
  SmsService,
  SmsTemplateKey,
} from '../notification/sms.service.js';
import { MedicationNotificationService } from './medication-notification.service.js';
import { VoiceCallService } from './voice-call.service.js';

/**
 * 用药推送 worker：每 30 秒扫描 medication_notification_jobs。
 *
 * 主要职责：
 *  1. 原子拣任务 → status=SENDING；
 *  2. 按 channel 调对应渠道服务发送；
 *  3. 成功：状态 SUCCESS；
 *  4. 失败：attempts + 指数退避，满 maxAttempts 进入 DEAD；
 *  5. 渠道降级：mini_program DEAD 且 kind ∈ 高优级别 → 追加同 target 的 sms；
 *     sms DEAD 且 kind 是升级管理员 → 追加 voice_call（留接口位，
 *     当前只写日志，真实电话语音接入需要电话 SDK 由运营另行采购）。
 *
 * 降级仅在"任务彻底 DEAD"时触发，避免每次临时失败就刷队列。
 */
@Injectable()
export class MedicationNotificationWorker {
  private readonly logger = new Logger(MedicationNotificationWorker.name);

  constructor(
    @InjectRepository(MedicationNotificationJob)
    private readonly jobRepo: Repository<MedicationNotificationJob>,
    @InjectRepository(SystemConfig)
    private readonly configRepo: Repository<SystemConfig>,
    private readonly notificationService: MedicationNotificationService,
    private readonly notify: NotificationService,
    private readonly sms: SmsService,
    private readonly voice: VoiceCallService,
  ) {}

  @Cron('*/30 * * * * *')
  async tick() {
    const enabled = await this.isEnabled();
    if (!enabled) return;
    const batch = await this.getBatchLimit();
    const jobs = await this.notificationService.claimBatch(batch);
    if (jobs.length === 0) return;
    for (const job of jobs) {
      await this.handle(job);
    }
  }

  private async handle(job: MedicationNotificationJob) {
    try {
      const ok = await this.dispatch(job);
      if (ok) {
        await this.notificationService.markSuccess(job);
      } else {
        await this.onFailure(job, '渠道返回失败');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.onFailure(job, msg);
    }
  }

  private async onFailure(job: MedicationNotificationJob, error: string) {
    const result = await this.notificationService.markFailure(job, error);
    if (result === 'dead') {
      await this.tryDowngrade(job);
    }
  }

  private async dispatch(job: MedicationNotificationJob): Promise<boolean> {
    switch (job.channel) {
      case MedicationJobChannel.MINI_PROGRAM:
        return this.dispatchMiniProgram(job);
      case MedicationJobChannel.SMS:
        return this.dispatchSms(job);
      case MedicationJobChannel.VOICE_CALL:
        return this.dispatchVoice(job);
      case MedicationJobChannel.IN_APP:
        return true;
      default:
        this.logger.warn(`未知渠道 ${job.channel} [job=${job.id}]`);
        return false;
    }
  }

  private async dispatchMiniProgram(
    job: MedicationNotificationJob,
  ): Promise<boolean> {
    if (!job.targetOpenid) return false;
    const template = this.pickMiniProgramTemplate(job.kind);
    const payload = { ...(job.payload || {}) };
    return this.notify.sendMiniProgramSubscribeMessage(
      job.targetOpenid,
      template,
      payload,
    );
  }

  private pickMiniProgramTemplate(kind: MedicationJobKind): string {
    switch (kind) {
      case MedicationJobKind.FIRST_PUSH:
      case MedicationJobKind.MISS_1ST:
      case MedicationJobKind.MISS_2ND:
      case MedicationJobKind.ESCALATE_FAMILY:
        return 'medication_reminder';
      case MedicationJobKind.FAMILY_DIGEST:
        // 家属每日汇总改走专属 alias：避免微信侧因"内容与申请类目不一致"降级。
        // 未配置时 NotificationService.resolveTemplateId 会自动回退到 medication_reminder。
        return 'family_digest';
      case MedicationJobKind.FOLLOW_UP:
        return 'follow_up_reminder';
      case MedicationJobKind.ESCALATE_ADMIN:
      default:
        return 'medication_reminder';
    }
  }

  private async dispatchSms(
    job: MedicationNotificationJob,
  ): Promise<boolean> {
    if (!job.targetPhone) return false;
    const templateKey = this.pickSmsTemplate(job.kind);
    const rawParams = (job.payload as any)?.smsParams;
    const params: string[] = Array.isArray(rawParams)
      ? rawParams.map((p) => String(p ?? ''))
      : this.fallbackSmsParams(job);
    return this.sms.sendSms(job.targetPhone, templateKey, params);
  }

  private pickSmsTemplate(kind: MedicationJobKind): SmsTemplateKey {
    if (kind === MedicationJobKind.FOLLOW_UP) return 'follow_up_reminder';
    return 'medication_reminder';
  }

  private fallbackSmsParams(job: MedicationNotificationJob): string[] {
    const data = (job.payload as any) || {};
    if (job.kind === MedicationJobKind.FOLLOW_UP) {
      return [
        String(data.patientName ?? '家人'),
        String(data.dateText ?? '今日'),
        String(data.hospitalDept ?? ''),
      ];
    }
    return [
      String(data.patientName ?? '家人'),
      String(data.medicineName ?? '用药'),
      String(data.dosage ?? '按医嘱'),
    ];
  }

  /**
   * 语音电话：走 VoiceCallService 统一抽象。
   * 未配置 provider 时返回 stubbed，worker 会将该 job 走失败/重试链。
   */
  private async dispatchVoice(
    job: MedicationNotificationJob,
  ): Promise<boolean> {
    if (!job.targetPhone) return false;
    const payload = (job.payload as any) || {};
    const text = this.buildVoiceText(job, payload);
    const result = await this.voice.call({
      phone: job.targetPhone,
      text,
      bizRef: `med-job-${job.id}`,
    });
    if (result.success) {
      job.providerRef = result.providerRef || null;
      return true;
    }
    if (result.stubbed) {
      job.lastError = result.errorMessage || '语音电话渠道未接入';
    }
    return false;
  }

  private buildVoiceText(
    job: MedicationNotificationJob,
    payload: Record<string, any>,
  ): string {
    const patient = String(payload.thing1 || payload.patientName || '家人');
    const medicine = String(payload.thing3 || payload.medicineName || '药品');
    switch (job.kind) {
      case 'miss_1st':
      case 'miss_2nd':
      case 'escalate_family':
        return `您好，${patient} 今日 ${medicine} 暂未服用，请尽快提醒他吃药。`;
      case 'escalate_admin':
        return `陪了个伴平台告警：${patient} 的 ${medicine} 连续漏服，请人工跟进。`;
      default:
        return `${patient} 用药提醒：${medicine}，请按时服用。`;
    }
  }

  /**
   * DEAD 后的渠道降级：
   *   - mini_program 死 → 若目标是 GUARDIAN/USER 且有手机号，追加一条 sms；
   *   - sms 死 + kind=escalate_admin 或 miss_2nd → 追加一条 voice_call；
   *   - 其他情况：只记日志，不自动兜底。
   *
   * 降级仅追加"相同 target 的不同 channel"新 job，不重置原 job。
   */
  private async tryDowngrade(job: MedicationNotificationJob) {
    if (job.channel === MedicationJobChannel.MINI_PROGRAM) {
      if (job.targetPhone) {
        await this.appendDowngradeJob(job, MedicationJobChannel.SMS);
      }
      return;
    }
    if (
      job.channel === MedicationJobChannel.SMS &&
      (job.kind === MedicationJobKind.ESCALATE_ADMIN ||
        job.kind === MedicationJobKind.MISS_2ND)
    ) {
      if (job.targetPhone) {
        await this.appendDowngradeJob(job, MedicationJobChannel.VOICE_CALL);
      }
    }
  }

  private async appendDowngradeJob(
    source: MedicationNotificationJob,
    channel: MedicationJobChannel,
  ) {
    const exists = await this.jobRepo.findOne({
      where: {
        reminderId: source.reminderId,
        executionLogId: source.executionLogId ?? undefined,
        kind: source.kind,
        targetKind: source.targetKind,
        targetPhone: source.targetPhone ?? undefined,
        channel,
      },
    });
    if (exists) return;

    const downgrade = this.jobRepo.create({
      reminderId: source.reminderId,
      executionLogId: source.executionLogId,
      kind: source.kind,
      channel,
      targetKind: source.targetKind,
      targetUserId: source.targetUserId,
      targetPhone: source.targetPhone,
      targetOpenid:
        channel === MedicationJobChannel.MINI_PROGRAM
          ? source.targetOpenid
          : null,
      payload: source.payload,
      status: MedicationJobStatus.PENDING,
      attempts: 0,
      maxAttempts: channel === MedicationJobChannel.VOICE_CALL ? 1 : 2,
      scheduledAt: new Date(),
      nextAttemptAt: new Date(),
    });
    await this.jobRepo.save(downgrade);
    this.logger.warn(
      `[channel downgrade] job=${source.id} ${source.channel}→${channel} target=${
        source.targetPhone || source.targetOpenid || '-'
      }`,
    );
  }

  private async isEnabled(): Promise<boolean> {
    const cfg = await this.configRepo.findOne({
      where: { key: 'medication_notification_worker_enabled' },
    });
    const value = (cfg?.value || '').toString().trim().toLowerCase();
    if (!value) return true;
    if (['false', '0', 'no', 'off'].includes(value)) return false;
    return true;
  }

  private async getBatchLimit(): Promise<number> {
    const cfg = await this.configRepo.findOne({
      where: { key: 'medication_notification_worker_batch' },
    });
    const n = Number(cfg?.value);
    if (Number.isFinite(n) && n > 0 && n <= 500) return n;
    return 50;
  }

  /**
   * 统一用于入队前的 payload 构造（给 MedicationExecutionService / 定时入队器复用）。
   */
  static buildMedicationPayload(params: {
    patientName: string;
    medicineName: string;
    dosage: string;
    instructions: string;
    kind: MedicationJobKind;
    timeText: string;
    pageTarget?: string;
  }): Record<string, unknown> {
    const prefix = MedicationNotificationWorker.labelByKind(params.kind);
    return {
      thing1: MedicationNotificationWorker.truncate(params.patientName, 20),
      time2: params.timeText,
      thing3: MedicationNotificationWorker.truncate(params.medicineName, 18),
      character_string4: MedicationNotificationWorker.truncate(
        params.dosage || '按医嘱',
        20,
      ),
      thing5: MedicationNotificationWorker.truncate(
        `${prefix}${params.instructions || '请按时服药'}`,
        20,
      ),
      __page:
        params.pageTarget ||
        `pages/family/medication/medication?type=today`,
      smsParams: [
        params.patientName,
        params.medicineName,
        params.dosage || '按医嘱',
      ],
    };
  }

  private static labelByKind(kind: MedicationJobKind): string {
    switch (kind) {
      case MedicationJobKind.MISS_1ST:
        return '[追提醒] ';
      case MedicationJobKind.MISS_2ND:
        return '[再次漏服] ';
      case MedicationJobKind.ESCALATE_FAMILY:
        return '[家属漏服升级] ';
      case MedicationJobKind.ESCALATE_ADMIN:
        return '[管理员介入] ';
      case MedicationJobKind.FAMILY_DIGEST:
        return '[今日汇总] ';
      default:
        return '';
    }
  }

  private static truncate(raw: string, max: number): string {
    const s = String(raw || '').trim();
    return s.length > max ? s.slice(0, max) : s;
  }
}
