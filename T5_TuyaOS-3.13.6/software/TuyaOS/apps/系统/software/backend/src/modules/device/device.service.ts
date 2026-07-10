import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, LessThan, Repository } from 'typeorm';
import { RedisService } from '../../common/redis/redis.service.js';
import {
  CriticalEventJob,
  QUEUE_FALL,
  QUEUE_SOS,
} from '../queue/queue.constants.js';
import {
  Device,
  DeviceLifecycleStatus,
  DeviceType,
} from '../../entities/device.entity.js';
import {
  DeviceBinding,
  DeviceBindingRole,
} from '../../entities/device-binding.entity.js';
import {
  DeviceEventLevel,
  DeviceEventLog,
  DeviceEventType,
} from '../../entities/device-event-log.entity.js';
import { DeviceDpSnapshot } from '../../entities/device-dp-snapshot.entity.js';
import { DeviceOnlineHistory } from '../../entities/device-online-history.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { BindDeviceDto } from './dto/bind-device.dto.js';
import { ListDeviceDto } from './dto/list-device.dto.js';
import { SendDpDto } from './dto/send-dp.dto.js';
import { MockEventDto } from './dto/mock-event.dto.js';
import { applyTenantFilter } from '../../common/utils/tenant-query.helper.js';

/**
 * 设备服务（mock 版）—— 业务编排在这里，涂鸦 OpenAPI/Pulsar 适配器留空，
 * 后续接 SDK 时只需新增 `tuya-openapi.service.ts` 并改本服务的对应调用点即可。
 */
@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DeviceBinding)
    private readonly bindingRepo: Repository<DeviceBinding>,
    @InjectRepository(DeviceEventLog)
    private readonly eventLogRepo: Repository<DeviceEventLog>,
    @InjectRepository(DeviceDpSnapshot)
    private readonly snapshotRepo: Repository<DeviceDpSnapshot>,
    @InjectRepository(DeviceOnlineHistory)
    private readonly onlineHistoryRepo: Repository<DeviceOnlineHistory>,
    @InjectRepository(ServiceTarget)
    private readonly serviceTargetRepo: Repository<ServiceTarget>,
    @InjectQueue(QUEUE_FALL)
    private readonly fallQueue: Queue<CriticalEventJob>,
    @InjectQueue(QUEUE_SOS)
    private readonly sosQueue: Queue<CriticalEventJob>,
    private readonly redis: RedisService,
  ) {}

  // ─────────────── 绑定 / 解绑 ───────────────

  /**
   * App 配网完成后调用：把已配网的涂鸦设备绑到当前用户名下。
   * mock 阶段：若 tuya_device_id 不存在，自动建一条 Device（pending → active）。
   */
  async bind(userId: number, dto: BindDeviceDto): Promise<DeviceBinding> {
    // 校验服务对象归属（防止越权绑别人的老人）
    const target = await this.serviceTargetRepo.findOne({
      where: { id: dto.serviceTargetId },
    });
    if (!target) throw new NotFoundException('服务对象不存在');
    // 简化版：v1.0 仅校验用户拥有 service target，
    // 后续 Wave1.x 改家庭/租户协管权限校验
    if (target.userId !== userId) {
      throw new ForbiddenException('无权将设备绑定到此服务对象');
    }

    // 查或建 Device（mock 阶段允许自动建）
    let device = await this.deviceRepo.findOne({
      where: { tuyaDeviceId: dto.tuyaDeviceId },
    });
    if (!device) {
      device = this.deviceRepo.create({
        tuyaDeviceId: dto.tuyaDeviceId,
        productId: dto.productId,
        name: dto.name,
        type: dto.type ?? DeviceType.ROBOT,
        status: DeviceLifecycleStatus.ACTIVE,
        mac: dto.mac ?? null,
        metadata: dto.metadata ?? null,
        online: false,
        lastOnlineAt: null,
        lastHeartbeatAt: null,
        firmwareVersion: null,
        batteryPercent: null,
        iconUrl: null,
      });
      device = await this.deviceRepo.save(device);
      this.logger.log(`新设备入库 device#${device.id} tuya=${device.tuyaDeviceId}`);
    } else if (device.status !== DeviceLifecycleStatus.ACTIVE) {
      device.status = DeviceLifecycleStatus.ACTIVE;
      device.name = dto.name;
      device = await this.deviceRepo.save(device);
    }

    // 校验同 user 不重复绑定
    const exists = await this.bindingRepo.findOne({
      where: { deviceId: device.id, userId, unboundAt: IsNull() },
    });
    if (exists) throw new ConflictException('该设备已绑定到当前账号');

    const binding = this.bindingRepo.create({
      deviceId: device.id,
      userId,
      serviceTargetId: dto.serviceTargetId,
      familyGroupId: dto.familyGroupId ?? null,
      role: dto.role ?? DeviceBindingRole.OWNER,
      boundAt: new Date(),
    });
    return this.bindingRepo.save(binding);
  }

  async unbind(userId: number, bindingId: number): Promise<void> {
    const binding = await this.bindingRepo.findOne({
      where: { id: bindingId },
    });
    if (!binding || binding.unboundAt)
      throw new NotFoundException('绑定不存在或已解绑');
    if (binding.userId !== userId && binding.role !== DeviceBindingRole.OWNER) {
      throw new ForbiddenException('仅 owner 可解绑');
    }
    binding.unboundAt = new Date();
    await this.bindingRepo.save(binding);
    this.logger.log(`device unbound binding#${bindingId} user#${userId}`);
  }

  // ─────────────── 查询 ───────────────

  async listMyDevices(userId: number): Promise<Device[]> {
    const bindings = await this.bindingRepo.find({
      where: { userId, unboundAt: IsNull() },
      relations: ['device'],
    });
    // 同一用户可能绑多个设备；按 boundAt 倒序
    return bindings
      .map((b) => b.device)
      .filter(Boolean)
      .sort((a, b) => b.id - a.id);
  }

  async list(query: ListDeviceDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.deviceRepo
      .createQueryBuilder('d')
      .orderBy('d.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    applyTenantFilter(qb, 'd');

    if (query.type) qb.andWhere('d.type = :type', { type: query.type });
    if (query.status) qb.andWhere('d.status = :status', { status: query.status });
    if (query.online === 'true') qb.andWhere('d.online = TRUE');
    if (query.online === 'false') qb.andWhere('d.online = FALSE');

    const kw = query.keyword?.trim();
    if (kw) {
      const like = `%${kw}%`;
      qb.andWhere(
        new Brackets((sub) => {
          sub
            .where('d.name LIKE :kw', { kw: like })
            .orWhere('d.tuya_device_id LIKE :kw', { kw: like })
            .orWhere('d.mac LIKE :kw', { kw: like });
        }),
      );
    }

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async findById(id: number, currentUserId?: number): Promise<{
    device: Device;
    bindings: DeviceBinding[];
    dpSnapshots: DeviceDpSnapshot[];
  }> {
    const device = await this.deviceRepo.findOne({ where: { id } });
    if (!device) throw new NotFoundException('设备不存在');

    // 普通用户视角：必须是绑定者才能看
    if (currentUserId) {
      const owned = await this.bindingRepo.count({
        where: { deviceId: id, userId: currentUserId, unboundAt: IsNull() },
      });
      if (owned === 0) throw new ForbiddenException('无权访问该设备');
    }

    const [bindings, dpSnapshots] = await Promise.all([
      this.bindingRepo.find({
        where: { deviceId: id, unboundAt: IsNull() },
        relations: ['user', 'serviceTarget'],
      }),
      this.snapshotRepo.find({
        where: { deviceId: id },
        order: { dpCode: 'ASC' },
      }),
    ]);
    return { device, bindings, dpSnapshots };
  }

  /** AI 工具 get_devices_for_user：给 ai-gateway 复用 */
  async findDevicesForUser(userId: number): Promise<Device[]> {
    return this.listMyDevices(userId);
  }

  /** AI 工具：通过 tuyaDeviceId 反查 userId/serviceTargetId/tenantId（ai-gateway 鉴权用） */
  async resolveDeviceContext(tuyaDeviceId: string): Promise<{
    device: Device;
    binding: DeviceBinding | null;
  } | null> {
    const device = await this.deviceRepo.findOne({ where: { tuyaDeviceId } });
    if (!device) return null;
    const binding = await this.bindingRepo.findOne({
      where: { deviceId: device.id, unboundAt: IsNull() },
      order: { boundAt: 'ASC' }, // 取最早的绑定（owner）
    });
    return { device, binding };
  }

  // ─────────────── DP 下发（mock）───────────────

  /**
   * mock 阶段：不真发，只做"幻觉"——记录一条 event_log 表示"已下发"，并 upsert DP snapshot。
   * 真实接入：改成调 TuyaOpenApiService.sendDp(tuyaDeviceId, code, value)。
   */
  async sendDp(deviceId: number, userId: number, dto: SendDpDto): Promise<{ ok: boolean }> {
    const ctx = await this.findById(deviceId, userId);
    this.logger.log(
      `[mock] sendDp device#${ctx.device.id} ${dto.code}=${String(dto.value)}`,
    );
    await this.recordDp(deviceId, dto.code, dto.value, this.inferValueType(dto.value));
    return { ok: true };
  }

  /**
   * 下发自控指令（非 DP，如 expr_happy/act_nod）—— mock 同上。
   */
  async sendSelfControl(deviceId: number, userId: number, dto: SendDpDto): Promise<{ ok: boolean }> {
    const ctx = await this.findById(deviceId, userId);
    this.logger.log(
      `[mock] sendSelfControl device#${ctx.device.id} ${dto.code}=${String(dto.value)}`,
    );
    // 自控指令不入 DP snapshot，但记录到 event_log 作为执行回执
    await this.recordEvent(deviceId, {
      type: DeviceEventType.PLAY_REMINDER,
      level: DeviceEventLevel.INFO,
      payload: { code: dto.code, value: dto.value, source: 'app_control' },
    });
    return { ok: true };
  }

  // ─────────────── 设备上行事件（mock 模拟）───────────────

  /**
   * 入库一条设备事件（来源：mock 接口 / 真实接入后的 TuyaPulsarService）。
   * critical 事件会同步标记 forwarded_to_alert，但实际转发逻辑由调用方负责
   *（v1.0 由 admin 手动触发 alert，Wave1.x 接 alert 模块自动消费）。
   */
  async recordEvent(
    deviceId: number,
    payload: MockEventDto,
  ): Promise<DeviceEventLog> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    if (payload.dedupKey) {
      const exists = await this.eventLogRepo.findOne({
        where: { dedupKey: payload.dedupKey },
      });
      if (exists) return exists;
    }

    const log = this.eventLogRepo.create({
      tenantId: device.tenantId,
      deviceId,
      type: payload.type,
      level: payload.level ?? DeviceEventLevel.INFO,
      payload: payload.payload ?? null,
      receivedAt: new Date(),
      dedupKey: payload.dedupKey ?? null,
      forwardedToAlert: false,
      forwardedToRealtime: false,
    });
    const saved = await this.eventLogRepo.save(log);

    // 上下线事件 → 同步更新缓存 + 历史
    if (payload.type === DeviceEventType.ONLINE) {
      await this.recordOnlineChange(deviceId, true, 'event');
    } else if (payload.type === DeviceEventType.OFFLINE) {
      await this.recordOnlineChange(deviceId, false, 'event');
    }

    // 关键安全事件 → 削峰入队（异步消费：实时推送家属/站点，后续可加短信/电话升级）
    if (payload.type === DeviceEventType.FALL) {
      // 30s 去抖：雷达 1 秒可能触发多次，同一设备窗口内只处理一次，避免刷屏家属
      const first = await this.redis.acquireOnce(`device:fall:${deviceId}`, 30);
      if (!first) {
        this.logger.debug(`跌倒事件去抖（30s 窗口）：device#${deviceId}`);
        return saved;
      }
      await this.enqueueCriticalEvent(this.fallQueue, 'fall', device, saved, payload);
    } else if (payload.type === DeviceEventType.SOS) {
      await this.enqueueCriticalEvent(this.sosQueue, 'sos', device, saved, payload);
    }

    return saved;
  }

  /** 把关键事件连同推送路由信息入队（避免消费者再查库，也防循环依赖）。 */
  private async enqueueCriticalEvent(
    queue: Queue<CriticalEventJob>,
    kind: 'fall' | 'sos',
    device: Device,
    log: DeviceEventLog,
    payload: MockEventDto,
  ): Promise<void> {
    const bindings = await this.bindingRepo.find({
      where: { deviceId: device.id, unboundAt: IsNull() },
    });
    const userIds = [
      ...new Set(bindings.map((b) => b.userId).filter((v): v is number => !!v)),
    ];
    const serviceTargetIds = [
      ...new Set(
        bindings
          .map((b) => b.serviceTargetId)
          .filter((v): v is number => !!v),
      ),
    ];
    try {
      await queue.add(kind, {
        deviceId: device.id,
        tenantId: device.tenantId,
        userIds,
        serviceTargetIds,
        eventLogId: log.id ?? null,
        level: kind === 'sos' ? 'critical' : payload.level ?? 'critical',
        summary: kind === 'fall' ? '检测到跌倒事件' : '收到 SOS 求助',
        occurredAt: new Date().toISOString(),
      });
    } catch (err) {
      // 队列不可用不应吞掉事件：已落库，记录告警日志供运维排查
      this.logger.error(
        `关键事件入队失败 device#${device.id} kind=${kind}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /**
   * 心跳掉线扫描：5 分钟无心跳的设备标记 offline，
   * 避免设备拔电后系统仍显示在线。
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkOfflineDevices(): Promise<void> {
    const threshold = new Date(Date.now() - 5 * 60_000);
    const stale = await this.deviceRepo.find({
      where: { online: true, lastHeartbeatAt: LessThan(threshold) },
    });
    for (const device of stale) {
      await this.recordOnlineChange(device.id, false, 'cron_heartbeat_timeout');
    }
    if (stale.length) {
      this.logger.log(`心跳掉线扫描：标记 ${stale.length} 台设备 offline`);
    }
  }

  /**
   * DP 上报 → upsert snapshot + 落 event_log。
   */
  async recordDp(
    deviceId: number,
    dpCode: string,
    value: unknown,
    valueType: DeviceDpSnapshot['valueType'] = 'string',
  ): Promise<void> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    const stringValue = this.serializeDpValue(value, valueType);
    // upsert（MySQL ON DUPLICATE KEY UPDATE 通过 unique index 触发）
    await this.snapshotRepo
      .createQueryBuilder()
      .insert()
      .values({
        tenantId: device.tenantId,
        deviceId,
        dpCode,
        valueType,
        value: stringValue,
        reportedAt: new Date(),
      })
      .orUpdate(['value_type', 'value', 'reported_at'], ['device_id', 'dp_code'])
      .execute();

    // 同步落事件流水
    await this.eventLogRepo.save(
      this.eventLogRepo.create({
        tenantId: device.tenantId,
        deviceId,
        type: DeviceEventType.DP_CHANGE,
        level: DeviceEventLevel.INFO,
        payload: { code: dpCode, value: stringValue, valueType },
        receivedAt: new Date(),
        forwardedToAlert: false,
        forwardedToRealtime: false,
      }),
    );

    // 已知 DP 同步缓存到 device 主表
    if (dpCode === 'battery_percentage' && valueType === 'number') {
      device.batteryPercent = Math.max(0, Math.min(100, Number(value) || 0));
      await this.deviceRepo.save(device);
    }
  }

  async recordOnlineChange(
    deviceId: number,
    online: boolean,
    source = 'mock',
  ): Promise<void> {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    if (device.online === online) return; // 重复状态忽略，避免噪声

    await this.onlineHistoryRepo.save(
      this.onlineHistoryRepo.create({
        tenantId: device.tenantId,
        deviceId,
        online,
        changedAt: new Date(),
        source,
      }),
    );

    device.online = online;
    if (online) device.lastOnlineAt = new Date();
    device.lastHeartbeatAt = new Date();
    await this.deviceRepo.save(device);

    // 在线状态写 Redis 缓存（任意实例可秒级查询，TTL 10 分钟兜底）
    await this.redis.setex(
      `device:online:${deviceId}`,
      600,
      online ? '1' : '0',
    );
  }

  // ─────────────── OTA mock ───────────────

  async checkOta(deviceId: number, userId: number) {
    await this.findById(deviceId, userId);
    // mock：永远返回"无新版本"，真实接入后调 TuyaOpenAPI 查询
    return { hasUpdate: false, latestVersion: null, currentVersion: null };
  }

  async triggerOtaUpgrade(deviceId: number, userId: number) {
    await this.findById(deviceId, userId);
    this.logger.log(`[mock] OTA 升级请求 device#${deviceId}`);
    return { ok: true, status: 'queued', message: 'mock 阶段不实际升级，仅返回成功' };
  }

  // ─────────────── 事件流水 / 运维统计 ───────────────

  async listEvents(
    deviceId: number,
    query: { page?: number; pageSize?: number; type?: DeviceEventType; level?: DeviceEventLevel },
  ) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.eventLogRepo
      .createQueryBuilder('e')
      .where('e.device_id = :deviceId', { deviceId })
      .orderBy('e.received_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    applyTenantFilter(qb, 'e');

    if (query.type) qb.andWhere('e.type = :type', { type: query.type });
    if (query.level) qb.andWhere('e.level = :level', { level: query.level });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  /** 运维大盘：在线率 / 告警事件 / 电量分布（租户维度） */
  async getDashboardStats() {
    const qb = this.deviceRepo.createQueryBuilder('d');
    applyTenantFilter(qb, 'd');
    const devices = await qb.getMany();

    const total = devices.length;
    const onlineCount = devices.filter((d) => d.online).length;
    const onlineRate = total === 0 ? 0 : Math.round((onlineCount / total) * 100);

    const batteryBuckets = { high: 0, medium: 0, low: 0, unknown: 0 };
    for (const d of devices) {
      const pct = d.batteryPercent;
      if (pct == null) batteryBuckets.unknown += 1;
      else if (pct >= 50) batteryBuckets.high += 1;
      else if (pct >= 20) batteryBuckets.medium += 1;
      else batteryBuckets.low += 1;
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const eventQb = this.eventLogRepo
      .createQueryBuilder('e')
      .where('e.received_at >= :since', { since });
    applyTenantFilter(eventQb, 'e');

    const criticalEvents = await eventQb
      .clone()
      .andWhere('e.level = :level', { level: DeviceEventLevel.CRITICAL })
      .getCount();

    const fallEvents = await eventQb
      .clone()
      .andWhere('e.type IN (:...types)', {
        types: [DeviceEventType.FALL, DeviceEventType.SOS],
      })
      .getCount();

    const alertRate =
      total === 0 ? 0 : Math.round((criticalEvents / Math.max(total, 1)) * 100) / 100;

    return {
      total,
      onlineCount,
      offlineCount: total - onlineCount,
      onlineRate,
      batteryBuckets,
      criticalEvents7d: criticalEvents,
      fallEvents7d: fallEvents,
      alertRate7d: alertRate,
    };
  }

  /** 安全事件流（跌倒 / SOS）—— admin 跳倒事件页 */
  async listSafetyEvents(query: {
    page?: number;
    pageSize?: number;
    type?: DeviceEventType;
    deviceId?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

    const qb = this.eventLogRepo
      .createQueryBuilder('e')
      .where('e.type IN (:...types)', {
        types: query.type
          ? [query.type]
          : [DeviceEventType.FALL, DeviceEventType.SOS, DeviceEventType.VITAL_ANOMALY],
      })
      .orderBy('e.received_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    applyTenantFilter(qb, 'e');
    if (query.deviceId) qb.andWhere('e.device_id = :deviceId', { deviceId: query.deviceId });

    const [items, total] = await qb.getManyAndCount();

    const deviceIds = [...new Set(items.map((i) => i.deviceId))];
    const deviceMap = new Map<number, Device>();
    if (deviceIds.length) {
      const ds = await this.deviceRepo.find({ where: { id: In(deviceIds) } });
      ds.forEach((d) => deviceMap.set(d.id, d));
    }

    return {
      items: items.map((e) => ({
        ...e,
        deviceName: deviceMap.get(e.deviceId)?.name ?? null,
      })),
      total,
      page,
      pageSize,
    };
  }

  // ─────────────── 内部工具 ───────────────

  private inferValueType(value: unknown): DeviceDpSnapshot['valueType'] {
    if (typeof value === 'boolean') return 'bool';
    if (typeof value === 'number') return 'number';
    if (value !== null && typeof value === 'object') return 'json';
    return 'string';
  }

  private serializeDpValue(
    value: unknown,
    valueType: DeviceDpSnapshot['valueType'],
  ): string {
    if (valueType === 'json') return JSON.stringify(value ?? null);
    if (valueType === 'bool') return String(Boolean(value));
    return String(value);
  }
}
