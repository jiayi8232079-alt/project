import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { DocumentService } from '../document/document.service.js';

/**
 * 无 JwtAuthGuard：通过短时 JWT query 令牌校验身份（与健康档案 preview 一致，供小程序 web-view）
 */
@ApiTags('订单文档预览')
@Controller('orders')
export class OrderDocPreviewController {
  constructor(private readonly documentService: DocumentService) {}

  @Get(':id/service-confirm-preview')
  @ApiOperation({ summary: '内嵌预览陪诊服务确认单 HTML（令牌限时）' })
  @ApiQuery({ name: 'token', required: true })
  async previewServiceConfirm(
    @Param('id', ParseIntPipe) orderId: number,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const preview =
      await this.documentService.getServiceConfirmPreview(orderId, token);
    res.setHeader('Content-Type', preview.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(preview.body);
  }
}
