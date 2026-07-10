import {
  BadRequestException,
  Controller,
  ForbiddenException,
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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { OrderService } from './order.service.js';
import { SetOrderEmergencyDto } from './dto/set-order-emergency.dto.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { DispatchOrderDto } from './dto/dispatch-order.dto.js';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto.js';
import { UpdateOrderDto } from './dto/update-order.dto.js';
import { OrderQueryDto } from './dto/order-query.dto.js';
import { RejectOrderDto } from './dto/reject-order.dto.js';
import { CreateReviewDto } from './dto/create-review.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { DocumentService } from '../document/document.service.js';

@ApiTags('订单')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly documentService: DocumentService,
  ) {}

  @Get('stats/dashboard')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '获取仪表板统计数据' })
  getDashboardStats() {
    return this.orderService.getDashboardStats();
  }

  @Get('stats/trend')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '获取订单趋势数据' })
  getOrderTrend(@Query('days') days?: string) {
    return this.orderService.getOrderTrend(days ? parseInt(days) : 7);
  }

  @Get('stats/live-board')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '获取驾驶舱实时服务看板列表' })
  getLiveBoard(@Query('limit') limit?: string) {
    return this.orderService.getDashboardLiveBoard(limit ? parseInt(limit) : 30);
  }

  @Get('stats/income-trend')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
    UserRole.FINANCE,
    UserRole.MEDICAL_CONSULTANT,
  )
  @ApiOperation({ summary: '获取收入趋势数据' })
  getIncomeTrend(@Query('days') days?: string) {
    return this.orderService.getIncomeTrend(days ? parseInt(days) : 30);
  }

  @Post()
  @ApiOperation({ summary: '创建订单（用户自建或管理员代建）' })
  @ApiResponse({ status: 201, description: '订单创建成功' })
  create(
    @CurrentUser('id') currentUserId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('type') type: 'user' | 'admin',
    @Body() dto: CreateOrderDto,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无效的登录主体');
    }
    const isAdmin = [
      UserRole.ADMIN,
      UserRole.OPERATOR,
      UserRole.CUSTOMER_SERVICE,
    ].includes(role as UserRole) && type === 'admin';
    const targetUserId = isAdmin && dto.userId ? dto.userId : currentUserId;
    return this.orderService.create(targetUserId, dto, isAdmin);
  }

  @Get()
  @ApiOperation({ summary: '获取订单列表（支持搜索筛选）' })
  @ApiResponse({ status: 200, description: '订单列表' })
  findAll(
    @Query() query: OrderQueryDto,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    const filterUserId = role === UserRole.USER ? userId : undefined;
    const attendantUserId = role === UserRole.ATTENDANT ? userId : undefined;
    return this.orderService.findAll(query, filterUserId, attendantUserId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '编辑订单信息（管理员设置费用等）' })
  @ApiResponse({ status: 200, description: '订单更新成功' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orderService.updateOrder(id, dto, operatorId);
  }

  // Alias：兼容历史调用 PUT /orders/admin/:id（部分小程序页面直接这么写），内部复用 updateOrder 实现
  @Put('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '编辑订单信息（admin 别名路由，兼容旧前端调用）' })
  @ApiResponse({ status: 200, description: '订单更新成功' })
  updateByAdminAlias(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orderService.updateOrder(id, dto, operatorId);
  }

  @Get(':id/bill')
  @ApiOperation({ summary: '获取订单费用账单' })
  getBill(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.getBill(id, userId, role);
  }

  @Post(':id/completion/ai-draft')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ATTENDANT,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
  )
  @ApiOperation({ summary: '根据服务时间线 AI 生成服务总结草稿（完成资料页）' })
  draftCompletionAi(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.draftCompletionAiSummary(id, userId, role);
  }

  @Post(':id/completion/timeline-digest')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ATTENDANT,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
  )
  @ApiOperation({ summary: '轻量：AI 概括服务时间线（完成资料·服务概况）' })
  draftTimelineDigest(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.draftCompletionTimelineDigest(id, userId, role);
  }

  @Post(':id/sop-progress')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ATTENDANT,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
  )
  @ApiOperation({
    summary: '保存服务者对 SOP 步骤的打勾进度（按角色专业服务目录显示）',
  })
  saveSopProgress(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @Body()
    body: { progress: Array<{ stepIndex: number; checked: boolean; note?: string }> },
  ) {
    return this.orderService.saveSopProgress(id, operatorId, body?.progress || []);
  }

  @Post(':id/completion')
  @UseGuards(RolesGuard)
  @Roles(
    UserRole.ATTENDANT,
    UserRole.ADMIN,
    UserRole.OPERATOR,
    UserRole.CUSTOMER_SERVICE,
  )
  @ApiOperation({ summary: '提交或更新服务完成记录单' })
  submitCompletion(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @CurrentUser('role') role: string,
    @Body()
    body: {
      diagnosisResult?: string;
      doctorAdvice?: string;
      medications?: {
        name: string;
        usage: string;
        reminderTime?: string;
        startDate?: string;
        endDate?: string;
      }[];
      followUpDate?: string;
      followUpNote?: string;
      followUpHospital?: string;
      followUpDepartment?: string;
      summary?: string;
      medicationMode?: string;
      images?: string[];
      files?: { url?: string; path?: string; name?: string }[] | string[];
    },
  ) {
    return this.orderService.submitCompletion(id, operatorId, role, body);
  }

  @Get(':id/timeline-share-token')
  @ApiOperation({
    summary:
      '生成「服务动态」小程序分享令牌（下单用户或管理端；用于公开页无需登录访问时间与进行中实时位置）',
  })
  issueTimelineShareToken(
    @Param('id', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: string,
  ) {
    return this.orderService.issueTimelineShareToken(orderId, userId, type);
  }

  @Get(':id/wxa-monitor-qrcode')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({
    summary:
      '生成微信官方小程序码（PNG JSON base64）。需 WECHAT_APPID/SECRET；页面 scene-launch 需已发布或设 WECHAT_MP_QR_ENV_VERSION=trial',
  })
  getWxaMonitorQrcode(
    @Param('id', ParseIntPipe) orderId: number,
    @CurrentUser('type') type: string,
  ) {
    return this.orderService.getWxaMonitorQrcodeBase64(orderId, type);
  }

  @Get(':id/wxa-service-report-qrcode')
  @ApiOperation({
    summary:
      '生成「陪诊服务报告」小程序码（PNG base64）。下单用户 / 家庭组成员 / 管理端可用，用于分享封面嵌入，扫码直达 service-report 页',
  })
  getWxaServiceReportQrcode(
    @Param('id', ParseIntPipe) orderId: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.getWxaServiceReportQrcodeBase64(
      orderId,
      userId,
      role,
    );
  }

  @Get(':id/attendant-live-location')
  @ApiOperation({ summary: '获取陪诊员实时位置（下单用户或该单陪诊员；仅进行中返回坐标）' })
  getAttendantLiveLocation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.getAttendantLiveLocation(id, userId, role);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取订单详情' })
  @ApiResponse({ status: 200, description: '订单详情' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.findOne(id, userId, role);
  }

  @Get(':id/health-profile')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT, UserRole.ADMIN)
  @ApiOperation({
    summary: '查看订单对应服务对象的健康档案（陪诊员脱敏视图；总管理员可全量查看）',
  })
  getMaskedHealthProfile(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.getMaskedHealthProfileForAttendant(id, userId, role);
  }

  @Get(':id/service-confirm/status')
  @ApiOperation({
    summary: '陪诊服务确认单状态（是否需签署、预览路径令牌）',
  })
  getServiceConfirmStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.documentService.getServiceConfirmStatusForOrder(id, userId, role);
  }

  @Post(':id/service-confirm/sign')
  @ApiOperation({ summary: '用户（下单人）签署陪诊服务确认单' })
  signServiceConfirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @CurrentUser('type') type: string,
    @Body()
    body: {
      signatureUrl: string;
      signerName?: string;
      signerRelation?: string;
    },
  ) {
    if (type !== 'user') {
      throw new ForbiddenException('请使用微信小程序用户账号签署');
    }
    return this.documentService.signServiceConfirmByCustomer(
      id,
      userId,
      role,
      body,
    );
  }

  @Get(':id/wxa-sign-qrcode')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '管理端生成服务确认单签署专用小程序码' })
  getWxaSignQrcode(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('type') type: string,
  ) {
    return this.orderService.getWxaSignQrcodeBase64(id, type);
  }

  @Get('health-sign-qrcode/:serviceTargetId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '管理端生成健康档案签署专用小程序码' })
  getWxaHealthSignQrcode(
    @Param('serviceTargetId', ParseIntPipe) serviceTargetId: number,
    @CurrentUser('type') type: string,
  ) {
    return this.orderService.getWxaHealthSignQrcodeBase64(serviceTargetId, type);
  }

  @Get('health-sign-scene/:serviceTargetId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取或创建健康档案签署场景码（用于微信转发）' })
  getHealthSignSceneCode(
    @Param('serviceTargetId', ParseIntPipe) serviceTargetId: number,
  ) {
    return this.orderService.getOrCreateHealthSignSceneCode(serviceTargetId);
  }

  @Get(':id/service-confirm-scene')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '获取或创建服务确认单签署场景码（用于微信转发）' })
  getServiceConfirmSceneCode(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderService.getOrCreateServiceConfirmSceneCode(id);
  }

  @Put(':id/dispatch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '派单（指派陪诊员或放入抢单池）' })
  @ApiResponse({ status: 200, description: '派单成功' })
  dispatch(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @Body() dto: DispatchOrderDto,
  ) {
    return this.orderService.dispatch(id, dto, operatorId);
  }

  @Put(':id/accept')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT)
  @ApiOperation({ summary: '陪诊员接单' })
  @ApiResponse({ status: 200, description: '接单成功' })
  accept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') attendantId: number,
  ) {
    return this.orderService.acceptOrder(id, attendantId);
  }

  @Put(':id/admin-confirm-accept')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({
    summary: '后台代陪诊员确认接单（管理员在订单详情中许可该陪诊员接单）',
  })
  @ApiResponse({ status: 200, description: '代确认成功，订单进入待服务' })
  adminConfirmAccept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
  ) {
    return this.orderService.adminConfirmAccept(id, operatorId);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT)
  @ApiOperation({ summary: '陪诊员拒单' })
  @ApiResponse({ status: 200, description: '拒单成功，订单回到待派单状态' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') attendantId: number,
    @Body() dto: RejectOrderDto,
  ) {
    return this.orderService.rejectOrder(id, attendantId, dto.reason);
  }

  @Put(':id/grab')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT)
  @ApiOperation({ summary: '抢单' })
  @ApiResponse({ status: 200, description: '抢单成功' })
  grab(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') attendantId: number,
  ) {
    return this.orderService.grabOrder(id, attendantId);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: '取消订单' })
  @ApiResponse({ status: 200, description: '取消成功' })
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body() body: { cancelReason?: string; reason?: string },
  ) {
    const raw = (body?.cancelReason || body?.reason || '').toString().trim();
    if (raw.length > 500) {
      throw new BadRequestException('取消原因最多 500 字');
    }
    return this.orderService.cancelOrder(
      id,
      userId,
      raw || undefined,
      String(userId),
      role,
    );
  }

  @Put(':id/start')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT, UserRole.ADMIN)
  @ApiOperation({ summary: '开始服务打卡（陪诊员本人或总管理员代操作）' })
  @ApiResponse({ status: 200, description: '服务已开始' })
  start(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.startOrder(id, userId, role);
  }

  @Put(':id/attendant-live-location')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT, UserRole.ADMIN)
  @ApiOperation({
    summary: '上报服务实时位置（GCJ-02，仅服务进行中；陪诊员本人或总管理员代操作）',
  })
  reportAttendantLiveLocation(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body() body: { latitude: number; longitude: number },
  ) {
    return this.orderService.updateAttendantLiveLocation(
      id,
      userId,
      body.latitude,
      body.longitude,
      role,
    );
  }

  @Put(':id/finish')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT, UserRole.ADMIN)
  @ApiOperation({ summary: '结束服务打卡（陪诊员本人或总管理员代操作）' })
  @ApiResponse({ status: 200, description: '服务已结束，进入待审核' })
  finish(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.finishOrder(id, userId, role);
  }

  @Put(':id/sign')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT)
  @ApiOperation({ summary: '签署派发确认单' })
  @ApiResponse({ status: 200, description: '签署成功' })
  sign(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body('signUrl') signUrl: string,
  ) {
    return this.orderService.signOrder(id, userId, signUrl);
  }

  @Post(':id/review')
  @ApiOperation({ summary: '提交订单评价' })
  @ApiResponse({ status: 201, description: '评价成功' })
  createReview(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('type') type: 'user' | 'admin',
    @Body() body: CreateReviewDto,
  ) {
    if (type !== 'user') {
      throw new ForbiddenException('仅用户端可提交评价');
    }
    return this.orderService.createReview(id, userId, body);
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: '获取订单评价列表' })
  @ApiResponse({ status: 200, description: '评价列表' })
  getReviews(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
  ) {
    return this.orderService.getReviews(id, userId, role);
  }

  @Put(':id/emergency')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ATTENDANT, UserRole.ADMIN)
  @ApiOperation({
    summary: '进入/解除紧急模式（陪诊员本人或总管理员代操作）',
    description:
      'action=activate 且 channel=store|family：进入紧急并发通知；action=clear：恢复服务进行中',
  })
  @ApiResponse({ status: 200, description: '操作成功' })
  async emergency(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @CurrentUser('role') role: string,
    @Body() body: SetOrderEmergencyDto,
  ) {
    return this.orderService.setEmergencyMode(id, userId, body, role);
  }

  @Put(':id/status')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '更新订单状态' })
  @ApiResponse({ status: 200, description: '状态更新成功' })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
    @CurrentUser('role') role: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateStatus(id, dto, operatorId, role);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      '删除订单（仅 pending_dispatch/pending_accept/pending_grab/canceled/completed 且未支付未结算可删）',
  })
  @ApiResponse({ status: 200, description: '删除成功' })
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') operatorId: number,
  ) {
    return this.orderService.deleteOrder(id, operatorId);
  }
}
