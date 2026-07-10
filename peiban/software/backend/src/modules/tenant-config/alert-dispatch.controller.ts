import {
  BadRequestException,
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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy.js';
import type { AlertEscalation } from '../../entities/alert-dispatch-rule.entity.js';
import { AlertDispatchService } from './alert-dispatch.service.js';
import {
  CreateDispatchRuleDto,
  IncomingAlertQueryDto,
  UpdateDispatchRuleDto,
} from './dto/tenant-config.dto.js';

/**
 * 跨层告警分发 API（PRD §8.5）。
 * 独立 `alert-dispatch` 前缀，避免与 alert 模块的 `/alerts` 冲突。
 */
@ApiTags('跨层告警分发')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.OPERATOR)
@Controller('alert-dispatch')
export class AlertDispatchController {
  constructor(private readonly dispatchService: AlertDispatchService) {}

  @Get('rules')
  @ApiOperation({ summary: '分发规则列表' })
  listRules(
    @CurrentUser() user: AuthenticatedUser,
    @Query('tenantId') tenantIdRaw?: string,
  ) {
    return this.dispatchService.listRules(
      this.requireTenantId(user, parseOpt(tenantIdRaw)),
    );
  }

  @Post('rules')
  @ApiOperation({ summary: '新增分发规则' })
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDispatchRuleDto,
  ) {
    return this.dispatchService.createRule(
      this.requireTenantId(user, dto.tenantId),
      {
        eventType: dto.eventType,
        severity: dto.severity,
        forwardToLevels: dto.forwardToLevels,
        notifyChannels: dto.notifyChannels,
        escalation: (dto.escalation as unknown as AlertEscalation) ?? null,
        enabled: dto.enabled,
        remark: dto.remark ?? null,
      },
    );
  }

  @Patch('rules/:id')
  @ApiOperation({ summary: '更新分发规则' })
  updateRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispatchRuleDto,
  ) {
    return this.dispatchService.updateRule(
      this.requireTenantId(user, undefined),
      id,
      {
        eventType: dto.eventType,
        severity: dto.severity,
        forwardToLevels: dto.forwardToLevels,
        notifyChannels: dto.notifyChannels,
        escalation:
          dto.escalation !== undefined
            ? (dto.escalation as unknown as AlertEscalation)
            : undefined,
        enabled: dto.enabled,
        remark: dto.remark,
      },
    );
  }

  @Delete('rules/:id')
  @ApiOperation({ summary: '删除分发规则' })
  async deleteRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.dispatchService.deleteRule(
      this.requireTenantId(user, undefined),
      id,
    );
    return { message: '已删除' };
  }

  @Get('incoming')
  @ApiOperation({ summary: '我应收到的跨层告警流（子树内达阈值告警）' })
  incoming(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: IncomingAlertQueryDto,
  ) {
    const viewer = q.tenantId ?? user?.tenantId ?? null;
    return this.dispatchService.getIncoming(viewer, {
      minSeverity: q.minSeverity,
      limit: q.limit,
    });
  }

  @Get(':alertId/plan')
  @ApiOperation({ summary: '某告警的跨层分发计划（escalation_path）' })
  plan(@Param('alertId', ParseIntPipe) alertId: number) {
    return this.dispatchService.previewDispatch(alertId);
  }

  /** 规则按租户隔离：平台超管须指定 tenantId */
  private requireTenantId(user: AuthenticatedUser, explicit?: number): number {
    const tid = explicit ?? user?.tenantId ?? null;
    if (tid == null) {
      throw new BadRequestException('平台超管需通过 tenantId 指定目标租户');
    }
    return tid;
  }
}

function parseOpt(raw?: string): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}
