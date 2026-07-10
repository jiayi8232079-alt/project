import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ServicePlanService } from './service-plan.service.js';
import {
  SaveTemplateDto,
  AttachPlanToOrderDto,
} from './dto/save-template.dto.js';
import { ServicePlanKind } from '../../entities/service-plan-template.entity.js';

@ApiTags('服务方案模板')
@Controller('service-plans')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ServicePlanController {
  constructor(private readonly service: ServicePlanService) {}

  @Get('templates')
  @ApiOperation({ summary: '我的模板列表（含公共模板）' })
  listMyTemplates(
    @CurrentUser('id') userId: number,
    @Query('kind') kind?: ServicePlanKind,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listTemplates({
      kind,
      authorUserId: userId,
      includePublic: true,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('templates/:id')
  @ApiOperation({ summary: '模板详情' })
  getTemplate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.getTemplate(id, { id: userId, role });
  }

  @Post('templates')
  @ApiOperation({ summary: '新建模板' })
  createTemplate(
    @Body() dto: SaveTemplateDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.createTemplate(dto, { id: userId, role });
  }

  @Put('templates/:id')
  @ApiOperation({ summary: '更新模板' })
  updateTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveTemplateDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.updateTemplate(id, dto, { id: userId, role });
  }

  @Delete('templates/:id')
  @ApiOperation({ summary: '删除模板' })
  removeTemplate(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.removeTemplate(id, { id: userId, role });
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: '订单上挂载的方案列表' })
  listForOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.listForOrder(orderId, { id: userId, role });
  }

  @Post('order/:orderId')
  @ApiOperation({ summary: '把方案挂到订单（可选从模板克隆）' })
  attachToOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() dto: AttachPlanToOrderDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.attachToOrder(orderId, dto, { id: userId, role });
  }

  @Delete('order/:orderId/items/:id')
  @ApiOperation({ summary: '从订单移除某方案' })
  removeFromOrder(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.removeFromOrder(id, { id: userId, role });
  }
}
