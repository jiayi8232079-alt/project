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
import { UserService } from './user.service.js';

@ApiTags('用户文档预览')
@Controller('users')
export class UserPreviewController {
  constructor(private readonly userService: UserService) {}

  @Get('service-targets/:id/health-profile-preview')
  @ApiOperation({ summary: '通过后端预览健康档案 HTML' })
  @ApiQuery({ name: 'token', required: true })
  async previewHealthProfile(
    @Param('id', ParseIntPipe) id: number,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const preview = await this.userService.getHealthProfilePreview(id, token);
    res.setHeader('Content-Type', preview.contentType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(preview.fileName)}`,
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.send(preview.body);
  }
}
