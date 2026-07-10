import {
  Body,
  Controller,
  Delete,
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
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { AiConfigService } from './ai-config.service.js';
import { SaveAgentConfigDto } from './dto/save-agent-config.dto.js';
import {
  CreateCrisisWordDto,
  ListCrisisWordDto,
  UpdateCrisisWordDto,
} from './dto/crisis-word.dto.js';

@ApiTags('AI 智能体配置 / 危机词库')
@ApiBearerAuth()
@Controller('ai-config')
@UseGuards(JwtAuthGuard, RolesGuard, TenantGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
export class AiConfigController {
  constructor(private readonly service: AiConfigService) {}

  // ─────────────── 智能体配置 ───────────────

  @Get('agent')
  @ApiOperation({ summary: '当前智能体配置（草稿优先）+ 已发布快照' })
  getAgent(@CurrentUser('tenantId') tenantId: number | null) {
    return this.service.getAgentConfig(tenantId ?? null);
  }

  @Get('agent/versions')
  @ApiOperation({ summary: '历史版本列表' })
  versions(@CurrentUser('tenantId') tenantId: number | null) {
    return this.service.listAgentVersions(tenantId ?? null);
  }

  @Post('agent')
  @ApiOperation({ summary: '保存草稿（反复覆盖）' })
  saveDraft(
    @CurrentUser('tenantId') tenantId: number | null,
    @CurrentUser('id') userId: number,
    @Body() dto: SaveAgentConfigDto,
  ) {
    return this.service.saveAgentDraft(tenantId ?? null, dto, userId);
  }

  @Post('agent/:id/publish')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '发布某版本（旧版本归档）' })
  publish(
    @CurrentUser('tenantId') tenantId: number | null,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.publishAgent(tenantId ?? null, id);
  }

  // ─────────────── 危机词库 ───────────────

  @Get('crisis-words')
  @ApiOperation({ summary: '危机词库列表' })
  listCrisis(
    @CurrentUser('tenantId') tenantId: number | null,
    @Query() query: ListCrisisWordDto,
  ) {
    return this.service.listCrisisWords(tenantId ?? null, query);
  }

  @Post('crisis-words')
  @ApiOperation({ summary: '新增危机词' })
  createCrisis(
    @CurrentUser('tenantId') tenantId: number | null,
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCrisisWordDto,
  ) {
    return this.service.createCrisisWord(tenantId ?? null, dto, userId);
  }

  @Patch('crisis-words/:id')
  @ApiOperation({ summary: '更新危机词' })
  updateCrisis(
    @CurrentUser('tenantId') tenantId: number | null,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCrisisWordDto,
  ) {
    return this.service.updateCrisisWord(tenantId ?? null, id, dto);
  }

  @Patch('crisis-words/:id/toggle')
  @ApiOperation({ summary: '启用 / 停用切换' })
  toggleCrisis(
    @CurrentUser('tenantId') tenantId: number | null,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.toggleCrisisWord(tenantId ?? null, id);
  }

  @Delete('crisis-words/:id')
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '删除危机词' })
  removeCrisis(
    @CurrentUser('tenantId') tenantId: number | null,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.removeCrisisWord(tenantId ?? null, id);
  }
}
