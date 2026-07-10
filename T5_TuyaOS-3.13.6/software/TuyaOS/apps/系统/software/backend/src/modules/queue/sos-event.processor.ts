import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { RealtimeService } from '../realtime/realtime.service.js';
import { AlertService } from '../alert/alert.service.js';
import { CriticalEventJob, QUEUE_SOS } from './queue.constants.js';

/**
 * SOS 求助消费者 —— 最高优先级安全链路（不经 AI）。
 * 动作：① 实时推送；② 持久化为家属可见健康预警。
 */
@Processor(QUEUE_SOS)
export class SosEventProcessor extends WorkerHost {
  private readonly logger = new Logger(SosEventProcessor.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly alertService: AlertService,
  ) {
    super();
  }

  async process(job: Job<CriticalEventJob>): Promise<void> {
    const d = job.data;
    this.logger.warn(`处理 SOS 事件 device#${d.deviceId} tenant#${d.tenantId}`);
    await this.realtime.push({
      event: {
        type: 'alert.sos',
        alertId: d.eventLogId,
        deviceId: d.deviceId,
        serviceTargetId: d.serviceTargetIds[0],
        level: 'critical',
        summary: d.summary,
        occurredAt: d.occurredAt,
      },
      routing: {
        tenantId: d.tenantId,
        userIds: d.userIds,
        serviceTargetIds: d.serviceTargetIds,
        deviceIds: [d.deviceId],
        broadcastToTenant: true,
      },
    });

    const ownerUserId = d.userIds?.[0];
    if (ownerUserId) {
      try {
        await this.alertService.createDeviceAlert({
          userId: ownerUserId,
          serviceTargetId: d.serviceTargetIds?.[0] ?? null,
          type: 'sos',
          deviceId: d.deviceId,
          payload: { eventLogId: d.eventLogId, summary: d.summary, occurredAt: d.occurredAt },
        });
      } catch (err) {
        this.logger.warn(
          `SOS 事件持久化预警失败 device#${d.deviceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
