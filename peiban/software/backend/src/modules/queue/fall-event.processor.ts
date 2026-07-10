import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { RealtimeService } from '../realtime/realtime.service.js';
import { AlertService } from '../alert/alert.service.js';
import { CriticalEventJob, QUEUE_FALL } from './queue.constants.js';

/**
 * 跌倒事件消费者 —— 削峰：设备瞬时上报洪峰先入队，这里平稳消费。
 * 动作：① 实时推送家属/站点；② 持久化为家属可见健康预警（带去抖 + 推送）。
 */
@Processor(QUEUE_FALL)
export class FallEventProcessor extends WorkerHost {
  private readonly logger = new Logger(FallEventProcessor.name);

  constructor(
    private readonly realtime: RealtimeService,
    private readonly alertService: AlertService,
  ) {
    super();
  }

  async process(job: Job<CriticalEventJob>): Promise<void> {
    const d = job.data;
    this.logger.log(`处理跌倒事件 device#${d.deviceId} tenant#${d.tenantId}`);
    await this.realtime.push({
      event: {
        type: 'alert.fall',
        alertId: d.eventLogId,
        deviceId: d.deviceId,
        serviceTargetId: d.serviceTargetIds[0],
        level: d.level as 'info' | 'warning' | 'critical',
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
          type: 'fall',
          deviceId: d.deviceId,
          payload: { eventLogId: d.eventLogId, summary: d.summary, occurredAt: d.occurredAt },
        });
      } catch (err) {
        this.logger.warn(
          `跌倒事件持久化预警失败 device#${d.deviceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
