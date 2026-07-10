import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CompanionService } from './companion.service.js';
import {
  CorrectMemoryDto,
  RecallMemoryQueryDto,
  SaveMemoryDto,
  UpsertPersonaDto,
} from './dto/companion.dto.js';

@ApiTags('家庭长期记忆与人格')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class CompanionController {
  constructor(private readonly companionService: CompanionService) {}

  @Post('companion/memories')
  @ApiOperation({ summary: '保存一条家庭/成员记忆（save）' })
  saveMemory(@Body() dto: SaveMemoryDto) {
    return this.companionService.saveMemory(dto);
  }

  @Get('companion/memories')
  @ApiOperation({ summary: '召回记忆（recall，遵守成员隐私隔离）' })
  recall(@Query() query: RecallMemoryQueryDto) {
    return this.companionService.recall(query);
  }

  @Post('companion/memories/:id/correct')
  @ApiOperation({ summary: '纠正一条记忆内容（correct）' })
  correctMemory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorrectMemoryDto,
  ) {
    return this.companionService.correctMemory(id, dto);
  }

  @Post('companion/memories/:id/confirm')
  @ApiOperation({ summary: '确认一条记忆为可信（confirm）' })
  confirmMemory(@Param('id', ParseIntPipe) id: number) {
    return this.companionService.confirmMemory(id);
  }

  @Post('companion/memories/:id/forget')
  @ApiOperation({ summary: '遗忘（软删除）一条记忆（forget）' })
  forgetMemory(@Param('id', ParseIntPipe) id: number) {
    return this.companionService.forgetMemory(id);
  }

  @Get('companion/persona/:familyId')
  @ApiOperation({ summary: '获取家庭机器人人格（get_persona）' })
  getPersona(@Param('familyId', ParseIntPipe) familyId: number) {
    return this.companionService.getPersona(familyId);
  }

  @Put('companion/persona')
  @ApiOperation({ summary: '创建或更新家庭机器人人格（upsert_persona）' })
  upsertPersona(@Body() dto: UpsertPersonaDto) {
    return this.companionService.upsertPersona(dto);
  }
}
