import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  ParseBoolPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { TimelineService } from './timeline.service.js';
import { CreateTimelineEntryDto } from './dto/create-timeline-entry.dto.js';
import { BatchVisibilityDto } from './dto/batch-visibility.dto.js';
import { UpdateTimelineEventTimeDto } from './dto/update-timeline-event-time.dto.js';
import { UpdateTimelineEntryDto } from './dto/update-timeline-entry.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole, TimelineType } from '../../common/enums/index.js';
import { StorageService } from '../../common/storage/storage.service.js';
import type { Response } from 'express';

const SAFE_TIMELINE_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.mp3',
  '.m4a',
  '.wav',
  '.aac',
  '.amr',
]);
const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30MB

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function looksLikeMojibake(value: string) {
  return (
    !containsCjk(value) &&
    /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ�]/.test(value)
  );
}

function normalizeIncomingFileName(originalName: string) {
  const rawName = originalName || '';
  if (!looksLikeMojibake(rawName)) {
    return rawName;
  }
  try {
    const repaired = Buffer.from(rawName, 'latin1').toString('utf8');
    return containsCjk(repaired) ? repaired : rawName;
  } catch {
    return rawName;
  }
}

function buildSafeTimelineFileName(originalName: string, fallbackExt = '.bin') {
  const normalizedName = normalizeIncomingFileName(originalName);
  const ext = (extname(normalizedName) || fallbackExt).toLowerCase();
  return `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
}

function decodeAttachmentName(value?: string) {
  if (!value) return 'timeline-attachment';
  try {
    return normalizeIncomingFileName(decodeURIComponent(value));
  } catch {
    return normalizeIncomingFileName(value);
  }
}

@ApiTags('服务时间线')
@Controller('timelines')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TimelineController {
  constructor(
    private readonly timelineService: TimelineService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '添加时间线记录（纯JSON，不含附件）' })
  @ApiResponse({ status: 201, description: '记录创建成功' })
  create(
    @CurrentUser('id') operatorId: number,
    @CurrentUser('role') role: string,
    @Body() dto: CreateTimelineEntryDto,
  ) {
    return this.timelineService.create(operatorId, role, dto);
  }

  /**
   * 带附件上传的时间线发布接口（multipart/form-data）。
   * 支持：文字、图片（.jpg/.png/.webp）、录音（.mp3/.m4a/.wav）、文件（.pdf 等）
   * 字段：orderId, type, content, visibleToUser, files（最多 9 个）
   */
  @Post('upload')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '发布时间线（支持附件，multipart/form-data）' })
  @ApiResponse({ status: 201, description: '记录创建成功' })
  @UseInterceptors(
    FilesInterceptor('files', 9, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(normalizeIncomingFileName(file.originalname || '')).toLowerCase();
        const allowed = SAFE_TIMELINE_EXTS.has(ext);
        cb(
          allowed
            ? null
            : new BadRequestException(`不支持的文件类型: ${ext || file.mimetype}`),
          allowed,
        );
      },
    }),
  )
  async createWithFiles(
    @CurrentUser('id') operatorId: number,
    @CurrentUser('role') role: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: {
      orderId: string;
      type?: string;
      content?: string;
      visibleToUser?: string;
      /** ISO8601，可选：补录时指定业务发生时间 */
      eventTime?: string;
    },
  ) {
    const orderId = parseInt(body.orderId, 10);
    if (!orderId) throw new BadRequestException('orderId 必填');

    const images: string[] = [];
    const audioFiles: { url: string; name: string }[] = [];
    const docFiles: { url: string; name: string }[] = [];
    let audioUrl = '';

    for (const f of files || []) {
      const normalizedName = normalizeIncomingFileName(f.originalname || '');
      const uploaded = await this.storageService.uploadBuffer(
        f.buffer,
        `timeline/${buildSafeTimelineFileName(normalizedName)}`,
        f.mimetype,
      );
      const relPath = uploaded.url;
      if (f.mimetype.startsWith('image/')) {
        images.push(relPath);
      } else if (f.mimetype.startsWith('audio/')) {
        audioFiles.push({ url: relPath, name: normalizedName });
        audioUrl = audioUrl || relPath; // 第一个录音作为主录音
      } else {
        docFiles.push({ url: relPath, name: normalizedName });
      }
    }

    // 自动推断 type
    let type = (body.type as TimelineType) || TimelineType.TEXT;
    if (!body.type) {
      if (images.length) type = TimelineType.IMAGE;
      else if (audioFiles.length) type = TimelineType.AUDIO_QUESTION;
      else if (docFiles.length) type = TimelineType.FILE;
    }

    const dto: CreateTimelineEntryDto = {
      orderId,
      type,
      content: body.content,
      visibleToUser: body.visibleToUser === 'true' || body.visibleToUser === '1',
      metadata: {
        ...(images.length ? { images } : {}),
        ...(audioUrl ? { audioUrl } : {}),
        ...(audioFiles.length ? { audioFiles } : {}),
        ...(docFiles.length ? { files: docFiles } : {}),
      },
      ...(body.eventTime?.trim() ? { eventTime: body.eventTime.trim() } : {}),
    };

    return this.timelineService.create(operatorId, role, dto);
  }

  @Get('order/:orderId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
  )
  @ApiOperation({ summary: '获取订单时间线（管理员视图，可包含内部记录）' })
  @ApiQuery({
    name: 'includeInternal',
    required: false,
    type: Boolean,
    description: '是否包含内部记录',
  })
  @ApiResponse({ status: 200, description: '时间线列表' })
  findByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Query('includeInternal', new ParseBoolPipe({ optional: true }))
    includeInternal?: boolean,
  ) {
    return this.timelineService.findByOrder(
      orderId,
      userId,
      role,
      includeInternal,
    );
  }

  @Get('order/:orderId/user')
  @ApiOperation({ summary: '获取订单时间线（用户视图，仅可见条目）' })
  @ApiResponse({ status: 200, description: '用户可见的时间线列表' })
  findByOrderForUser(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.timelineService.findByOrderForUser(orderId, userId, role);
  }

  @Get('attachment')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
    UserRole.USER,
  )
  @ApiOperation({ summary: '预览时间线附件文件' })
  @ApiQuery({
    name: 'url',
    required: true,
    type: String,
    description: '时间线附件 URL 或对象 Key',
  })
  @ApiQuery({
    name: 'name',
    required: false,
    type: String,
    description: '附件文件名，用于预览标题和响应头',
  })
  async previewAttachment(
    @Query('url') url: string,
    @Query('name') name: string | undefined,
    @Res() res: Response,
  ) {
    if (!url) {
      throw new BadRequestException('url 必填');
    }
    const file = await this.storageService.readObject(url);
    const fileName = decodeAttachmentName(
      name || url.split('?')[0].split('/').pop() || 'timeline-attachment',
    );
    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.send(file.body);
  }

  @Put('batch/visibility')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '批量设置时间线记录可见性' })
  @ApiResponse({ status: 200, description: '批量更新成功' })
  batchSetVisibility(@Body() dto: BatchVisibilityDto) {
    return this.timelineService.batchSetVisibility(dto.ids, dto.visible);
  }

  @Put(':id/visibility')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '设置单条时间线记录可见性' })
  @ApiResponse({ status: 200, description: '可见性更新成功' })
  setVisibility(
    @Param('id', ParseIntPipe) id: number,
    @Body('visible', ParseBoolPipe) visible: boolean,
  ) {
    return this.timelineService.setVisibility(id, visible);
  }

  @Put(':id/transcription')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '修改录音转写文字' })
  @ApiResponse({ status: 200, description: '录音转写文字更新成功' })
  updateTranscription(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body('text') text: string,
  ) {
    return this.timelineService.updateTranscription(id, userId, role, text);
  }

  @Put(':id/event-time')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({
    summary: '修正节点业务时间（仅内容型节点，状态节点禁止修改）',
  })
  @ApiResponse({ status: 200, description: '业务时间更新成功' })
  updateEventTime(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateTimelineEventTimeDto,
  ) {
    return this.timelineService.updateEventTime(id, dto.eventTime, userId, role);
  }

  /**
   * 总管理员编辑内容型时间线条目：文本 + 图片/录音/文档 + 可见性，一个请求全搞定。
   * 请求体格式：multipart/form-data；`keep*` 三个保留列表传 JSON 字符串，
   * 状态节点（node / service_start / service_end 等）会被后端拒绝。
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.ATTENDANT,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '编辑时间线条目内容（文本 + 附件，仅内容型节点）',
  })
  @ApiResponse({ status: 200, description: '更新成功' })
  @UseInterceptors(
    FilesInterceptor('files', 9, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(
          normalizeIncomingFileName(file.originalname || ''),
        ).toLowerCase();
        const allowed = SAFE_TIMELINE_EXTS.has(ext);
        cb(
          allowed
            ? null
            : new BadRequestException(`不支持的文件类型: ${ext || file.mimetype}`),
          allowed,
        );
      },
    }),
  )
  async updateEntry(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: UpdateTimelineEntryDto,
  ) {
    const parseJsonArray = <T>(raw: string | undefined, fieldName: string): T[] | undefined => {
      if (typeof raw === 'undefined') return undefined;
      if (raw === '') return [];
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
          throw new BadRequestException(`${fieldName} 必须是 JSON 数组`);
        }
        return parsed as T[];
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        throw new BadRequestException(`${fieldName} 不是合法 JSON: ${String(err)}`);
      }
    };

    const keepImageUrls = parseJsonArray<string>(body.keepImageUrls, 'keepImageUrls');
    const keepAudioFiles = parseJsonArray<{ url: string; name: string }>(
      body.keepAudioFiles,
      'keepAudioFiles',
    );
    const keepFiles = parseJsonArray<{ url: string; name: string }>(
      body.keepFiles,
      'keepFiles',
    );

    // 新上传的附件逐个落对象存储
    const newFiles: Array<{ url: string; name: string; mimetype: string }> = [];
    for (const f of files || []) {
      const normalizedName = normalizeIncomingFileName(f.originalname || '');
      const uploaded = await this.storageService.uploadBuffer(
        f.buffer,
        `timeline/${buildSafeTimelineFileName(normalizedName)}`,
        f.mimetype,
      );
      newFiles.push({
        url: uploaded.url,
        name: normalizedName,
        mimetype: f.mimetype,
      });
    }

    const visibleToUser =
      typeof body.visibleToUser === 'undefined'
        ? undefined
        : body.visibleToUser === 'true' || body.visibleToUser === '1';

    return this.timelineService.updateEntry(id, userId, role, {
      content: body.content,
      keepImageUrls,
      keepAudioFiles,
      keepFiles,
      visibleToUser,
      newFiles,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: '获取单条时间线记录' })
  @ApiResponse({ status: 200, description: '时间线记录详情' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.timelineService.findOne(id, userId, role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '删除时间线记录' })
  @ApiResponse({ status: 200, description: '删除成功' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.timelineService.deleteEntry(id);
  }
}
