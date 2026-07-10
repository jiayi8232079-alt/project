import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'node:path';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { DocumentService } from './document.service.js';
import { UploadDocumentDto } from './dto/upload-document.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';

const SAFE_UPLOAD_EXTS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.zip',
  '.mp3',
  '.m4a',
  '.wav',
  '.aac',
  '.amr',
]);
const MAX_UPLOAD_SIZE = 30 * 1024 * 1024;

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

function buildSafeFileName(originalName: string, fallbackExt = '.bin') {
  const normalizedName = normalizeIncomingFileName(originalName);
  const ext = (extname(normalizedName) || fallbackExt).toLowerCase();
  return `upload_${Date.now()}_${Math.random().toString(36).slice(2, 10)}${ext}`;
}

function safeFileFilter(
  _req: unknown,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) {
  const ext = extname(normalizeIncomingFileName(file.originalname || '')).toLowerCase();
  if (!SAFE_UPLOAD_EXTS.has(ext)) {
    cb(new BadRequestException(`不支持的文件类型: ${ext || file.mimetype}`), false);
    return;
  }
  cb(null, true);
}

@ApiTags('文档')
@Controller('documents')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_SIZE },
      fileFilter: safeFileFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文档' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        orderId: { type: 'number' },
        type: { type: 'string' },
      },
    },
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件');
    const originalName = normalizeIncomingFileName(file.originalname || '');
    return this.documentService.uploadFile(
      dto.orderId,
      dto.type,
      {
        filename: buildSafeFileName(originalName),
        buffer: file.buffer,
        originalName,
        mimeType: file.mimetype,
      },
      userId,
      role,
    );
  }

  @Post('raw-upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_SIZE },
      fileFilter: safeFileFilter,
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传原始文件（不绑定订单）' })
  rawUpload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('请选择要上传的文件');
    const originalName = normalizeIncomingFileName(file.originalname || '');
    return this.documentService.uploadRawFile({
      filename: buildSafeFileName(originalName, '.png'),
      originalName,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取文档列表' })
  findAll(@Query() query: { type?: string; page?: string; pageSize?: string }) {
    return this.documentService.findAll({
      type: query.type,
      page: query.page ? parseInt(query.page) : 1,
      pageSize: query.pageSize ? parseInt(query.pageSize) : 20,
    });
  }

  @Get('order/:orderId/service-confirm-html')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
    UserRole.FINANCE,
  )
  @ApiOperation({
    summary: '陪诊服务确认单 HTML（inline，供管理端 iframe；需 Bearer）',
  })
  async streamServiceConfirmHtml(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Res() res: Response,
  ) {
    const preview = await this.documentService.getAdminServiceConfirmHtml(
      orderId,
      userId,
      role,
    );
    res.setHeader('Content-Type', preview.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(preview.body);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: '获取订单文档列表' })
  findByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.findByOrder(orderId, userId, role);
  }

  @Get('customer/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取客户履约文档列表' })
  findByCustomer(@Param('userId', ParseIntPipe) userId: number) {
    return this.documentService.findByCustomer(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取文档详情' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.findOne(id, userId, role);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除文档' })
  delete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.deleteDocument(id, userId, role);
  }

  // ========== 文档生成接口 ==========

  @Post('generate/health-profile/:serviceTargetId')
  @ApiOperation({ summary: '生成健康信息小档案' })
  generateHealthProfile(
    @Param('serviceTargetId', ParseIntPipe) serviceTargetId: number,
    @Body() formData: any,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.generateHealthProfile(
      serviceTargetId,
      userId,
      role,
      formData,
    );
  }

  @Post('generate/service-confirm/:orderId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.MEDICAL_CONSULTANT,
    UserRole.FINANCE,
  )
  @ApiOperation({ summary: '生成陪诊服务确认单（A4 样式同健康小档案，可打印）' })
  generateServiceConfirm(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.generateServiceConfirm(orderId, userId, role);
  }

  @Post('generate/service-complete/:orderId')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.ATTENDANT,
  )
  @ApiOperation({ summary: '生成服务完成记录单' })
  generateServiceComplete(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() formData: any,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.generateServiceComplete(
      orderId,
      userId,
      role,
      formData,
    );
  }

  @Post('order/:orderId/service-report')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '生成服务报告单' })
  generateServiceReport(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.generateServiceReport(orderId, userId, role);
  }
}
