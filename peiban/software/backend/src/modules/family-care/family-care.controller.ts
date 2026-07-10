import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { TenantGuard } from '../../common/guards/tenant.guard.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { FamilyCareService } from './family-care.service.js';
import {
  CreateFamilyMessageDto,
  CreateFamilyTaskDto,
  CreateVoiceprintDto,
  MockFamilyTaskReceiptDto,
  UpdateVoiceprintStatusDto,
} from './dto/family-care.dto.js';

@ApiTags('家庭协同')
@Controller()
@UseGuards(JwtAuthGuard, TenantGuard)
@ApiBearerAuth()
export class FamilyCareController {
  constructor(private readonly familyCareService: FamilyCareService) {}

  @Post('family/family-messages')
  @ApiOperation({ summary: '家属给老人留言或投喂内容' })
  createMessage(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateFamilyMessageDto,
  ) {
    return this.familyCareService.createMessage(userId, dto);
  }

  @Get('family/family-messages')
  @ApiOperation({ summary: '家庭留言列表' })
  listMessages(@Query('familyId', ParseIntPipe) familyId: number) {
    return this.familyCareService.listMessages(familyId);
  }

  @Post('family/tasks')
  @ApiOperation({ summary: '创建家庭提醒任务' })
  createTask(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateFamilyTaskDto,
  ) {
    return this.familyCareService.createTask(userId, dto);
  }

  @Get('family/tasks')
  @ApiOperation({ summary: '家庭任务列表' })
  listTasks(@Query('familyId', ParseIntPipe) familyId: number) {
    return this.familyCareService.listTasks(familyId);
  }

  @Post('family/tasks/:id/cancel')
  @ApiOperation({ summary: '取消家庭任务' })
  cancelTask(@Param('id', ParseIntPipe) id: number) {
    return this.familyCareService.cancelTask(id);
  }

  @Post('family/tasks/:id/mock-receipt')
  @ApiOperation({ summary: 'mock 家庭任务播报或老人回应回执' })
  mockTaskReceipt(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MockFamilyTaskReceiptDto,
  ) {
    return this.familyCareService.mockTaskReceipt(id, dto);
  }

  @Post('voiceprints')
  @ApiOperation({ summary: '创建声纹录入记录' })
  createVoiceprint(@Body() dto: CreateVoiceprintDto) {
    return this.familyCareService.createVoiceprint(dto);
  }

  @Get('voiceprints/family/:familyId')
  @ApiOperation({ summary: '查询家庭成员声纹状态' })
  listVoiceprints(@Param('familyId', ParseIntPipe) familyId: number) {
    return this.familyCareService.listVoiceprints(familyId);
  }

  @Post('voiceprints/:id/status')
  @ApiOperation({ summary: '更新声纹录入或识别状态' })
  updateVoiceprintStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVoiceprintStatusDto,
  ) {
    return this.familyCareService.updateVoiceprintStatus(id, dto);
  }
}
