import {
  Controller,
  Get,
  Put,
  Post,
  Query,
  Body,
  Param,
  BadRequestException,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { DocumentService } from '../document/document.service.js';
import { PublicSaveHealthProfileDto } from './dto/public-save-health-profile.dto.js';

@ApiTags('公开分享')
@Controller('public')
export class PublicOrderShareController {
  constructor(
    private readonly orderService: OrderService,
    private readonly documentService: DocumentService,
  ) {}

  @Get('order-timeline')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: '无需登录：凭下单用户签发的 token 查看就诊人信息与可见服务时间线',
  })
  getOrderTimeline(
    @Query('orderId', ParseIntPipe) orderId: number,
    @Query('token') token: string,
  ) {
    if (!token?.trim()) {
      throw new BadRequestException('token 必填');
    }
    return this.orderService.getPublicOrderTimelinePack(orderId, token.trim());
  }

  @Get('mp-monitor-scene')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({
    summary: '无需登录：小程序码 scene 短参数解析为订单公开访问 orderId+token',
  })
  getMpMonitorScene(@Query('code') code: string) {
    if (!code?.trim()) {
      throw new BadRequestException('code 必填');
    }
    return this.orderService.resolveMpMonitorScene(code.trim());
  }

  @Get('health-profile/:sceneCode')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: '无需登录：凭二维码场景码读取健康档案' })
  getPublicHealthProfile(@Param('sceneCode') sceneCode: string) {
    if (!sceneCode?.trim()) {
      throw new BadRequestException('sceneCode 必填');
    }
    return this.orderService.getPublicHealthProfile(sceneCode.trim());
  }

  @Put('health-profile/:sceneCode')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: '无需登录：凭二维码场景码保存健康档案' })
  updatePublicHealthProfile(
    @Param('sceneCode') sceneCode: string,
    @Body() body: PublicSaveHealthProfileDto,
  ) {
    if (!sceneCode?.trim()) {
      throw new BadRequestException('sceneCode 必填');
    }
    return this.orderService.updatePublicHealthProfile(sceneCode.trim(), body);
  }

  @Get('service-confirm/:sceneCode/status')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: '无需登录：凭场景码读取服务确认单状态' })
  getPublicServiceConfirmStatus(@Param('sceneCode') sceneCode: string) {
    if (!sceneCode?.trim()) {
      throw new BadRequestException('sceneCode 必填');
    }
    return this.orderService.getPublicServiceConfirmStatus(sceneCode.trim());
  }

  @Post('service-confirm/:sceneCode/sign')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: '无需登录：凭场景码签署服务确认单' })
  signPublicServiceConfirm(
    @Param('sceneCode') sceneCode: string,
    @Body() body: { signatureUrl: string; signerName?: string; signerRelation?: string },
  ) {
    if (!sceneCode?.trim()) {
      throw new BadRequestException('sceneCode 必填');
    }
    return this.orderService.signPublicServiceConfirm(sceneCode.trim(), body);
  }

  /**
   * 签名图片上传（无登录场景）
   * 安全说明：
   * 1. 必须提供有效的 sceneCode（sign / health_sign 类型，未过期）
   * 2. 文件大小限制 2MB，仅接受 PNG/JPEG/WebP
   * 3. 接口级强限流：每分钟 5 次
   * 4. 文件名使用服务端时间戳 + 随机字符串，防止客户端伪造
   */
  @Post('signature-upload')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (/^image\/(png|jpeg|jpg|webp)$/.test(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('仅支持 PNG/JPEG/WebP 图片') as any, false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '无需登录：上传签名图片（需携带有效 sceneCode）' })
  async publicSignatureUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body('sceneCode') sceneCode: string,
  ) {
    if (!file) throw new BadRequestException('请选择要上传的文件');
    if (!sceneCode || typeof sceneCode !== 'string' || !sceneCode.trim()) {
      throw new BadRequestException('缺少场景凭证');
    }

    // 校验签名凭证（场景码必须存在、类型合法、未过期）
    const scene = await this.orderService.validateSignSceneCode(
      sceneCode.trim(),
    );

    // 额外防御：确认文件实际内容与 mimetype 一致（魔数校验）
    const buf = file.buffer;
    if (!buf || buf.length === 0) {
      throw new BadRequestException('文件内容为空');
    }
    const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
    const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isWebp =
      buf.length > 12 &&
      buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    if (!isPng && !isJpg && !isWebp) {
      throw new BadRequestException('文件不是有效的 PNG/JPEG/WebP 图片');
    }

    const ext = isJpg ? '.jpg' : isWebp ? '.webp' : '.png';
    const random = Math.random().toString(36).slice(2, 10);
    const filename = `sign_${scene.sceneType}_${scene.orderId}_${Date.now()}_${random}${ext}`;
    return this.documentService.uploadRawFile({
      filename,
      originalName: filename,
      buffer: buf,
      mimeType: file.mimetype,
    });
  }
}
