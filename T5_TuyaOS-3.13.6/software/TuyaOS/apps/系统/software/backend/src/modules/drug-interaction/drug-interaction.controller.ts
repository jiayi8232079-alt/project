import {
  Body,
  Controller,
  Delete,
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
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { DrugInteractionService } from './drug-interaction.service.js';
import { DrugInteractionSeverity } from '../../entities/drug-interaction-rule.entity.js';

class CreateDrugInteractionRuleDto {
  drugA: string;
  drugB: string;
  drugAAliases: string[];
  drugBAliases: string[];
  severity: DrugInteractionSeverity;
  mechanism: string;
  recommendation: string;
  evidenceLevel?: 'A' | 'B' | 'C' | null;
}

class UpdateDrugInteractionRuleDto {
  drugA?: string;
  drugB?: string;
  drugAAliases?: string[];
  drugBAliases?: string[];
  severity?: DrugInteractionSeverity;
  mechanism?: string;
  recommendation?: string;
  evidenceLevel?: 'A' | 'B' | 'C' | null;
  enabled?: boolean;
}

@ApiTags('药物相互作用检测')
@Controller('drug-interactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DrugInteractionController {
  constructor(private readonly service: DrugInteractionService) {}

  // ───────── 评估（用户/家属/管理员 都可触发） ─────────

  @Post('assess/prescription/:id')
  @ApiOperation({ summary: '评估某张处方内的药物相互作用' })
  assessPrescription(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.assessPrescription(id, { id: userId, role });
  }

  @Post('assess/target/:id')
  @ApiOperation({ summary: '评估服务对象当前所有活跃用药的整体相互作用' })
  assessServiceTarget(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.assessServiceTarget(id, { id: userId, role });
  }

  // ───────── 读取最新评估 ─────────

  @Get('prescription/:id')
  @ApiOperation({ summary: '获取处方最新风险评估' })
  getPrescriptionReport(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getLatestByPrescription(id, { id: userId, role });
  }

  @Get('target/:id')
  @ApiOperation({ summary: '获取服务对象最新风险评估' })
  getTargetReport(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getLatestByTarget(id, { id: userId, role });
  }

  // ───────── 规则库管理（后台） ─────────

  @Get('rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '规则库列表' })
  listRules(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('severity') severity?: DrugInteractionSeverity,
    @Query('enabled') enabled?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.service.listRules({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      severity,
      enabled: enabled === undefined ? undefined : enabled === 'true',
      keyword,
    });
  }

  @Post('rules')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '新增自定义规则' })
  createRule(@Body() dto: CreateDrugInteractionRuleDto) {
    return this.service.createRule(dto);
  }

  @Put('rules/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '更新规则（包含启用/禁用）' })
  updateRule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDrugInteractionRuleDto,
  ) {
    return this.service.updateRule(id, dto);
  }

  @Delete('rules/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '删除自定义规则（内置不可删）' })
  deleteRule(@Param('id', ParseIntPipe) id: number) {
    return this.service.deleteRule(id);
  }
}
