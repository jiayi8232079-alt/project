import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { ContentLibraryService } from './content-library.service.js';
import {
  CreateContentItemDto,
  PlayContentDto,
  QueryContentItemDto,
  UpdateContentItemDto,
} from './dto/content-library.dto.js';

@ApiTags('内容生态')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class ContentLibraryController {
  constructor(private readonly contentService: ContentLibraryService) {}

  @Get('content-library')
  @ApiOperation({ summary: '内容点播列表（按分类过滤）' })
  list(@Query() query: QueryContentItemDto) {
    return this.contentService.list(query);
  }

  @Post('content-library')
  @ApiOperation({ summary: '新增内容条目' })
  create(@Body() dto: CreateContentItemDto) {
    return this.contentService.create(dto);
  }

  @Patch('content-library/:id')
  @ApiOperation({ summary: '更新内容（上下架/标题/简介）' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContentItemDto,
  ) {
    return this.contentService.update(id, dto);
  }

  @Post('content-library/:id/play')
  @ApiOperation({ summary: '点播：下发到机器人播放（mock）' })
  play(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PlayContentDto,
  ) {
    return this.contentService.play(id, dto);
  }
}
