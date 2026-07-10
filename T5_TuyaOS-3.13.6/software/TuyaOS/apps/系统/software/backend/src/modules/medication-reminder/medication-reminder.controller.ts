import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { MedicationReminderService } from './medication-reminder.service.js';
import { CreateReminderDto } from './dto/create-reminder.dto.js';
import { CreateMyReminderDto } from './dto/create-my-reminder.dto.js';
import { UpdateReminderDto } from './dto/update-reminder.dto.js';
import { ReminderStatus, ReminderType } from '../../entities/medication-reminder.entity.js';

@ApiTags('用药提醒')
@Controller('medication-reminders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicationReminderController {
  constructor(private readonly service: MedicationReminderService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE, UserRole.ATTENDANT)
  @ApiOperation({ summary: '创建用药提醒' })
  create(
    @Body() dto: CreateReminderDto,
    @CurrentUser('id') adminId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.create(dto, adminId, {
      id: adminId,
      role,
      name: nickname,
    });
  }

  @Post('my')
  @ApiOperation({ summary: '当前用户创建用药提醒' })
  createMyReminder(
    @Body() dto: CreateMyReminderDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.create(
      { ...dto, userId } as CreateReminderDto,
      undefined,
      { id: userId, role, name: nickname },
    );
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '查询用药提醒列表' })
  findAll(
    @Query('userId') userId?: string,
    @Query('serviceTargetId') serviceTargetId?: string,
    @Query('status') status?: ReminderStatus,
    @Query('type') type?: ReminderType,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll({
      userId: userId ? Number(userId) : undefined,
      serviceTargetId: serviceTargetId ? Number(serviceTargetId) : undefined,
      status,
      type,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  @Get('my')
  @ApiOperation({ summary: '获取当前用户的用药提醒' })
  getMyReminders(
    @CurrentUser('id') userId: number,
    @Query('activeOnly') activeOnly?: string,
    @Query('type') type?: ReminderType,
  ) {
    return this.service.findByUser(userId, activeOnly !== 'false', type);
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: '获取订单关联的用药提醒' })
  getByOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Query('type') type?: ReminderType,
  ) {
    return this.service.findByOrder(orderId, userId, role, type);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取用药提醒详情' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.service.findOne(id, userId, role);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '更新用药提醒' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReminderDto,
    @CurrentUser('id') adminId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.update(id, dto, { id: adminId, role, name: nickname });
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '删除用药提醒' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('nickname') nickname: string,
  ) {
    return this.service.remove(id, { id: adminId, role, name: nickname });
  }

  @Get(':id/audits')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '查询用药提醒审计日志' })
  listAudits(@Param('id', ParseIntPipe) id: number) {
    return this.service.listAudits(id);
  }
}
