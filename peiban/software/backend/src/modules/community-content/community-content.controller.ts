import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CommunityContentService } from './community-content.service.js';
import {
  CreateCommunityContentDto,
  MockContentDeliveryAckDto,
  QueryCommunityContentDto,
} from './dto/community-content.dto.js';

@ApiTags('社区内容')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class CommunityContentController {
  constructor(private readonly contentService: CommunityContentService) {}

  @Post('community-content')
  @ApiOperation({ summary: '新建社区内容草稿' })
  createDraft(@Body() dto: CreateCommunityContentDto) {
    return this.contentService.createDraft(dto);
  }

  @Get('community-content')
  @ApiOperation({ summary: '社区内容列表（后台/App 按租户过滤）' })
  list(@Query() query: QueryCommunityContentDto) {
    return this.contentService.list(query);
  }

  @Post('community-content/:id/publish')
  @ApiOperation({ summary: '发布社区内容并生成触达任务' })
  publish(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.publish(id);
  }

  @Post('community-content/:id/revoke')
  @ApiOperation({ summary: '撤回社区内容并撤回触达任务' })
  revoke(@Param('id', ParseIntPipe) id: number) {
    return this.contentService.revoke(id);
  }

  @Get('content-deliveries')
  @ApiOperation({ summary: '触达回执列表' })
  listDeliveries(@Query('contentId') contentId?: string) {
    return this.contentService.listDeliveries(
      contentId ? Number(contentId) : undefined,
    );
  }

  @Post('content-deliveries/:id/mock-ack')
  @ApiOperation({ summary: 'mock 内容到达/播报/App 已查看回执' })
  mockAck(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MockContentDeliveryAckDto,
  ) {
    return this.contentService.mockAck(id, dto);
  }
}
