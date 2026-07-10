import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ServiceTimeline } from '../../entities/service-timeline.entity.js';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto.js';
import { TimelineType, UserRole } from '../../common/enums/index.js';
import { Order } from '../../entities/order.entity.js';
import { Attendant } from '../../entities/attendant.entity.js';
import { ServiceTarget } from '../../entities/service-target.entity.js';
import { AdminUser } from '../../entities/admin-user.entity.js';
import { TimelineTranscriptionService } from './timeline-transcription.service.js';
import { StorageService } from '../../common/storage/storage.service.js';
import { AlertService } from '../alert/alert.service.js';

const USER_VISIBLE_TYPES: TimelineType[] = [
  TimelineType.NODE,
  TimelineType.IMAGE,
  TimelineType.TEXT,
  TimelineType.FILE,
  TimelineType.AUDIO_QUESTION,
  TimelineType.AUDIO_ADVICE,
  TimelineType.SERVICE_START,
  TimelineType.SERVICE_END,
];

@Injectable()
export class TimelineService {
  private readonly logger = new Logger(TimelineService.name);

  constructor(
    @InjectRepository(ServiceTimeline)
    private readonly timelineRepository: Repository<ServiceTimeline>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Attendant)
    private readonly attendantRepository: Repository<Attendant>,
    @InjectRepository(ServiceTarget)
    private readonly serviceTargetRepository: Repository<ServiceTarget>,
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    private readonly timelineTranscriptionService: TimelineTranscriptionService,
    private readonly storageService: StorageService,
    @Inject(forwardRef(() => AlertService))
    private readonly alertService: AlertService,
  ) {}

  /**
   * 时间线的 operator 外键只连 users 表；当操作者来自 admin_users（管理后台账号）
   * 时 operator 会是 null，前端无法显示"谁做的"。
   * 这里批量把 operator=null && operatorId!=null 的条目补上 admin_users 身份。
   */
  private async attachAdminOperators<T extends { operator?: any; operatorId?: number | null }>(
    items: T[],
  ): Promise<T[]> {
    if (!Array.isArray(items) || items.length === 0) return items;
    const missingIds = Array.from(
      new Set(
        items
          .filter((it) => !it.operator && typeof it.operatorId === 'number' && it.operatorId)
          .map((it) => it.operatorId as number),
      ),
    );
    if (!missingIds.length) return items;
    try {
      const admins = await this.adminUserRepository.find({
        where: missingIds.map((id) => ({ id })),
      });
      const map = new Map<number, AdminUser>();
      for (const a of admins) map.set(a.id, a);
      for (const it of items) {
        if (!it.operator && typeof it.operatorId === 'number') {
          const admin = map.get(it.operatorId);
          if (admin) {
            it.operator = {
              id: admin.id,
              nickname: admin.realName || admin.username,
              name: admin.realName || admin.username,
              role: admin.role,
              kind: 'admin',
            } as any;
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `attachAdminOperators failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return items;
  }

  private isAdminLikeRole(role?: string): boolean {
    return (
      role === UserRole.ADMIN ||
      role === UserRole.OPERATOR ||
      role === UserRole.CUSTOMER_SERVICE ||
      role === UserRole.MEDICAL_CONSULTANT
    );
  }

  private async resolveAttendantIdByUserId(userId: number): Promise<number> {
    const attendant = await this.attendantRepository.findOne({ where: { userId } });
    if (!attendant) {
      throw new BadRequestException('当前账号未绑定陪诊员身份');
    }
    return attendant.id;
  }

  private async assertOrderAccess(
    orderId: number,
    currentUserId: number,
    role: string,
  ): Promise<void> {
    if (this.isAdminLikeRole(role)) return;

    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');

    if (role === UserRole.ATTENDANT) {
      const attendantId = await this.resolveAttendantIdByUserId(currentUserId);
      if (order.attendantId !== attendantId) {
        throw new ForbiddenException('无权访问该订单时间线');
      }
      return;
    }

    if (order.userId !== currentUserId) {
      throw new ForbiddenException('无权访问该订单时间线');
    }
  }

  async create(operatorId: number, role: string, dto: CreateTimelineEntryDto) {
    await this.assertOrderAccess(dto.orderId, operatorId, role);
    const visibleToUser =
      dto.visibleToUser ?? USER_VISIBLE_TYPES.includes(dto.type);

    const { eventTime: rawEventTime, ...restDto } = dto;
    const entry = this.timelineRepository.create({
      ...restDto,
      operatorId,
      visibleToUser,
    });
    if (rawEventTime) {
      const parsed = new Date(rawEventTime);
      if (!isNaN(parsed.getTime()) && this.isContentNodeType(dto.type)) {
        entry.eventTime = parsed;
      }
    }
    const saved = await this.timelineRepository.save(entry);

    this.timelineTranscriptionService.handleTimelineCreated(saved.id).catch((err) => {
      this.logger.warn(`时间线录音转写触发失败: ${err?.message}`);
    });

    this.alertService.handleTimelineEntry(saved).catch((err) => {
      this.logger.warn(`时间线关键词预警触发失败: ${err?.message}`);
    });

    return saved;
  }

  async findByOrder(
    orderId: number,
    currentUserId: number,
    role: string,
    includeInternal = false,
  ) {
    await this.assertOrderAccess(orderId, currentUserId, role);

    const where: Record<string, unknown> = { orderId };
    if (role === UserRole.USER) {
      where.visibleToUser = true;
    } else if (role === UserRole.ATTENDANT) {
      // 陪诊员可以看到自己订单的所有时间线记录（不受 visibleToUser 限制）
    } else if (!includeInternal) {
      where.visibleToUser = true;
    }
    const items = await this.timelineRepository.find({
      where,
      order: { createdAt: 'DESC' },
      relations: ['operator'],
    });
    return this.attachAdminOperators(items);
  }

  async findByOrderForUser(orderId: number, currentUserId: number, role: string) {
    await this.assertOrderAccess(orderId, currentUserId, role);
    const items = await this.timelineRepository.find({
      where: { orderId, visibleToUser: true },
      order: { createdAt: 'DESC' },
      relations: ['operator'],
    });
    return this.attachAdminOperators(items);
  }

  async findOne(id: number, currentUserId: number, role: string) {
    const entry = await this.timelineRepository.findOne({
      where: { id },
      relations: ['operator'],
    });
    if (!entry) throw new NotFoundException('时间线记录不存在');
    await this.assertOrderAccess(entry.orderId, currentUserId, role);
    if (role === UserRole.USER && !entry.visibleToUser) {
      throw new ForbiddenException('无权访问该时间线记录');
    }
    const [patched] = await this.attachAdminOperators([entry]);
    return patched;
  }

  async setVisibility(id: number, visible: boolean) {
    const entry = await this.timelineRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('时间线记录不存在');
    entry.visibleToUser = visible;
    return this.timelineRepository.save(entry);
  }

  async updateTranscription(
    id: number,
    currentUserId: number,
    role: string,
    text: string,
  ) {
    const entry = await this.timelineRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('时间线记录不存在');
    await this.assertOrderAccess(entry.orderId, currentUserId, role);
    if (!this.isAdminLikeRole(role) && role !== UserRole.ATTENDANT) {
      throw new ForbiddenException('无权修改录音转写文字');
    }
    if (
      entry.type !== TimelineType.AUDIO_QUESTION &&
      entry.type !== TimelineType.AUDIO_ADVICE
    ) {
      throw new BadRequestException('只有录音类型支持修改转写文字');
    }
    return this.timelineTranscriptionService.updateManualText(entry, text);
  }

  async batchSetVisibility(ids: number[], visible: boolean) {
    await this.timelineRepository.update(
      { id: In(ids) },
      { visibleToUser: visible },
    );
    return { affected: ids.length, visible };
  }

  async deleteEntry(id: number) {
    const entry = await this.timelineRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('时间线记录不存在');
    await this.timelineRepository.remove(entry);
    return { success: true };
  }

  /**
   * 总管理员修正节点业务时间。仅允许「内容型节点」（text/image/file/audio_*）；
   * 状态节点（node/service_start/service_end）由系统自动生成，不支持修改。
   * 传入的 eventTime 为 ISO8601 字符串，存入数据库时自动转为 Date。
   */
  async updateEventTime(
    id: number,
    eventTimeIso: string,
    userId: number,
    role: string,
  ) {
    const entry = await this.timelineRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('时间线记录不存在');
    await this.assertOrderAccess(entry.orderId, userId, role);

    if (!this.isContentNodeType(entry.type)) {
      throw new BadRequestException(
        '仅内容型节点可修改业务时间（状态节点由系统自动生成，不支持修正）',
      );
    }

    const parsed = new Date(eventTimeIso);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException('业务时间格式非法');
    }

    entry.eventTime = parsed;
    return this.timelineRepository.save(entry);
  }

  /**
   * 总管理员编辑时间线条目内容（文本 + 附件 + 可见性）。
   *
   * 规则：
   *   - 仅"内容型"节点可编辑（text/image/file/audio_*），
   *     状态节点（node/service_start/service_end）会被拒绝；
   *   - content 传入 undefined 不改；传空字符串 / 任意字符串都按新值落库；
   *   - keepImageUrls / keepAudioFiles / keepFiles 三个"保留列表"和 newFiles 联动重建 metadata；
   *     任一侧有输入即触发 metadata 重建。传入但为空 = 清空该类型所有附件；
   *   - 不做"物理清理对象存储文件"的动作（orphaned 文件保留在 COS，未来需要单独清理任务）；
   *   - visibleToUser 若为 boolean 则更新；其它值保持不变。
   */
  async updateEntry(
    id: number,
    userId: number,
    role: string,
    patch: {
      content?: string;
      keepImageUrls?: string[];
      keepAudioFiles?: { url: string; name: string }[];
      keepFiles?: { url: string; name: string }[];
      visibleToUser?: boolean;
      newFiles?: Array<{ url: string; name: string; mimetype: string }>;
    },
  ) {
    const entry = await this.timelineRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('时间线记录不存在');
    await this.assertOrderAccess(entry.orderId, userId, role);

    if (!this.isContentNodeType(entry.type)) {
      throw new BadRequestException(
        '仅内容型节点可编辑（状态节点由系统自动生成，不支持修改）',
      );
    }

    if (typeof patch.content !== 'undefined') {
      entry.content = patch.content;
    }

    const attachmentsTouched =
      typeof patch.keepImageUrls !== 'undefined' ||
      typeof patch.keepAudioFiles !== 'undefined' ||
      typeof patch.keepFiles !== 'undefined' ||
      (Array.isArray(patch.newFiles) && patch.newFiles.length > 0);

    if (attachmentsTouched) {
      const oldMeta = (entry.metadata || {}) as Record<string, unknown>;
      const newMeta: Record<string, unknown> = { ...oldMeta };

      // 图片
      if (
        typeof patch.keepImageUrls !== 'undefined' ||
        (patch.newFiles?.some((f) => f.mimetype.startsWith('image/')) ?? false)
      ) {
        const nextImages = [
          ...(patch.keepImageUrls || []),
          ...(patch.newFiles || [])
            .filter((f) => f.mimetype.startsWith('image/'))
            .map((f) => f.url),
        ];
        if (nextImages.length > 0) newMeta.images = nextImages;
        else delete newMeta.images;
      }

      // 录音（audioFiles）；同步更新 audioUrl 兼容字段
      if (
        typeof patch.keepAudioFiles !== 'undefined' ||
        (patch.newFiles?.some((f) => f.mimetype.startsWith('audio/')) ?? false)
      ) {
        const nextAudio = [
          ...(patch.keepAudioFiles || []),
          ...(patch.newFiles || [])
            .filter((f) => f.mimetype.startsWith('audio/'))
            .map((f) => ({ url: f.url, name: f.name })),
        ];
        if (nextAudio.length > 0) {
          newMeta.audioFiles = nextAudio;
          newMeta.audioUrl = nextAudio[0].url;
        } else {
          delete newMeta.audioFiles;
          delete newMeta.audioUrl;
        }
      }

      // 文档
      if (
        typeof patch.keepFiles !== 'undefined' ||
        (patch.newFiles?.some(
          (f) =>
            !f.mimetype.startsWith('image/') && !f.mimetype.startsWith('audio/'),
        ) ??
          false)
      ) {
        const nextFiles = [
          ...(patch.keepFiles || []),
          ...(patch.newFiles || [])
            .filter(
              (f) =>
                !f.mimetype.startsWith('image/') &&
                !f.mimetype.startsWith('audio/'),
            )
            .map((f) => ({ url: f.url, name: f.name })),
        ];
        if (nextFiles.length > 0) newMeta.files = nextFiles;
        else delete newMeta.files;
      }

      entry.metadata = newMeta;
    }

    if (typeof patch.visibleToUser === 'boolean') {
      entry.visibleToUser = patch.visibleToUser;
    }

    return this.timelineRepository.save(entry);
  }

  private isContentNodeType(type: TimelineType): boolean {
    return (
      type === TimelineType.TEXT ||
      type === TimelineType.IMAGE ||
      type === TimelineType.FILE ||
      type === TimelineType.AUDIO_QUESTION ||
      type === TimelineType.AUDIO_ADVICE
    );
  }
}
