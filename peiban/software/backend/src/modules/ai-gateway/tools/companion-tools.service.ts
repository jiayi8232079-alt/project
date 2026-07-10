import { Injectable, Logger } from '@nestjs/common';
import { BIZ_ERROR_CODE } from '../dto/jsonrpc.dto.js';
import {
  DeviceContext,
  McpTool,
  ToolResult,
} from './tool.interface.js';
import { McpCompanionDataService } from './mcp-companion-data.service.js';

/**
 * 「陪诊助手」MCP 工具集中注册。
 *
 * 基础工具保留既有短名称；正式接入工具使用 `peiban.*` namespace。
 * 工具都已带：
 * 1. 标准 input schema（涂鸦智能体平台和 MCP Inspector 都能直接看见）
 * 2. `mutating` 标记（写操作前 Agent 需复述确认）
 * 3. `userMessage` 友好话术（失败时给老人念）
 *
 * 安全：execute() 只信任 `ctx` 注入的 userId/tenantId/serviceTargetId，
 * **不信任 args 里 LLM 传入的 targetId 是否等于 ctx.serviceTargetId**——
 * 必须显式校验 `args.targetId === ctx.serviceTargetId` 或在白名单内。
 */
@Injectable()
export class CompanionToolsService {
  private readonly logger = new Logger(CompanionToolsService.name);
  private readonly tools = new Map<string, McpTool>();

  constructor(private readonly companionData: McpCompanionDataService) {
    this.register({
      name: 'get_profile',
      description: '查询当前服务对象的基础档案与健康概况（年龄、慢病标签、家属称呼）',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: { targetId: { type: 'string', description: '服务对象 ID' } },
        required: ['targetId'],
      },
      execute: async (args, ctx) => {
        this.assertOwnTarget(args as { targetId: string }, ctx);
        const data = await this.companionData.getProfile(ctx);
        return this.success(data);
      },
    });

    this.register({
      name: 'get_orders',
      description: '查询当前用户的订单列表，可按状态过滤',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          status: {
            type: 'string',
            enum: ['pending', 'confirmed', 'in_service', 'completed', 'cancelled'],
          },
          limit: { type: 'integer', minimum: 1, maximum: 20 },
        },
        required: ['targetId'],
      },
      execute: async (args, ctx) => {
        this.assertOwnTarget(args as { targetId: string }, ctx);
        const data = await this.companionData.getOrders(ctx, {
          status: (args as { status?: string }).status,
          limit: (args as { limit?: number }).limit,
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'get_medication_plan',
      description: '查询服务对象今日 / 近期用药计划（不诊断不修改方案，只播报提醒）',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['targetId'],
      },
      execute: async (args, ctx) => {
        this.assertOwnTarget(args as { targetId: string }, ctx);
        const data = await this.companionData.getMedicationPlan(ctx, {
          date: (args as { date?: string }).date,
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'peiban.elder.getProfile',
      description: '查询当前设备绑定老人的基础档案与健康概况',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: {
            type: 'string',
            description: '可选；服务对象 ID，传入时必须等于设备绑定老人',
          },
        },
      },
      execute: async (args, ctx) => {
        this.assertTargetIfProvided(args as { targetId?: string }, ctx);
        const data = await this.companionData.getProfile(ctx);
        return this.success(data);
      },
    });

    this.register({
      name: 'peiban.health.getTodaySummary',
      description: '查询当前设备绑定老人的今日健康摘要（档案标签、用药执行、未处理告警、最近周报）',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: {
            type: 'string',
            description: '可选；服务对象 ID，传入时必须等于设备绑定老人',
          },
          date: { type: 'string', description: 'YYYY-MM-DD，默认今天' },
        },
      },
      execute: async (args, ctx) => {
        this.assertTargetIfProvided(args as { targetId?: string }, ctx);
        const data = await this.companionData.getTodayHealthSummary(ctx, {
          date: (args as { date?: string }).date,
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'peiban.medication.getTodayReminders',
      description: '查询当前设备绑定老人的今日用药提醒和执行状态',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: {
            type: 'string',
            description: '可选；服务对象 ID，传入时必须等于设备绑定老人',
          },
          date: { type: 'string', description: 'YYYY-MM-DD，默认今天' },
        },
      },
      execute: async (args, ctx) => {
        this.assertTargetIfProvided(args as { targetId?: string }, ctx);
        const data = await this.companionData.getTodayMedicationReminders(ctx, {
          date: (args as { date?: string }).date,
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'peiban.alert.create',
      description:
        '创建绑定老人相关告警。SOS/跌倒等救命链路生产环境应优先由涂鸦 DP/Pulsar 直达 device/alert，本工具仅供受信任智能体或设备通道补录。',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: {
            type: 'string',
            description: '可选；服务对象 ID，传入时必须等于设备绑定老人',
          },
          type: {
            type: 'string',
            enum: ['fall', 'sos', 'vital_anomaly', 'manual'],
          },
          severity: {
            type: 'string',
            enum: ['info', 'warn', 'emergency', 'warning', 'critical'],
            default: 'warn',
          },
          title: { type: 'string' },
          summary: { type: 'string' },
          reason: { type: 'string' },
          payload: { type: 'object' },
        },
        required: ['type'],
      },
      execute: async (args, ctx) => {
        this.assertTargetIfProvided(args as { targetId?: string }, ctx);
        const data = await this.companionData.createAlert(ctx, args as {
          type?: string;
          severity?: string;
          title?: string;
          summary?: string;
          reason?: string;
          payload?: unknown;
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'peiban.device.reportEvent',
      description: '上报当前设备事件流水（在线、离线、DP、AI 对话、故障、SOS、跌倒等）',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: [
              'online',
              'offline',
              'dp_change',
              'fall',
              'fall_detected',
              'sos',
              'sos_pressed',
              'vital_anomaly',
              'ai_dialog',
              'fault',
              'ota',
              'play_reminder',
              'other',
            ],
          },
          level: {
            type: 'string',
            enum: ['info', 'warning', 'critical'],
          },
          payload: { type: 'object' },
          dedupKey: { type: 'string' },
        },
        required: ['type'],
      },
      execute: async (args, ctx) => {
        const data = await this.companionData.reportDeviceEvent(ctx, args as {
          type?: string;
          level?: string;
          payload?: unknown;
          dedupKey?: string;
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'peiban.device.getBindingStatus',
      description: '查询当前设备在 peiban 后端的绑定、在线、电量与固件状态',
      mutating: false,
      inputSchema: { type: 'object', properties: {} },
      execute: async (_args, ctx) => {
        const data = await this.companionData.getDeviceBindingStatus(ctx);
        return this.success(data);
      },
    });

    this.register({
      name: 'get_health_records',
      description: '查询血压 / 血糖 / 体重 / 周报',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          type: {
            type: 'string',
            enum: ['blood_pressure', 'blood_glucose', 'weight', 'weekly_report'],
          },
          range: {
            type: 'string',
            enum: ['today', 'week', 'month'],
            default: 'today',
          },
        },
        required: ['targetId', 'type'],
      },
      execute: async () => this.success({ records: [] }),
    });

    this.register({
      name: 'get_escort_report',
      description: '查询某次陪诊订单的报告与时间线',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
      },
      execute: async () => this.success({ report: null }),
    });

    this.register({
      name: 'get_weather',
      description: '查询当前位置或指定城市天气（结合健康提示）',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: { city: { type: 'string' } },
      },
      execute: async () =>
        this.success({
          city: '上海',
          today: { condition: '晴', tempMin: 22, tempMax: 28 },
          healthTip: '今天紫外线较强，出门记得戴帽子',
        }),
    });

    this.register({
      name: 'get_time',
      description: '查询当前日期 / 时间 / 星期 / 中国传统节气',
      mutating: false,
      inputSchema: { type: 'object', properties: {} },
      execute: async () => {
        const now = new Date();
        return this.success({
          iso: now.toISOString(),
          local: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
          dayOfWeek: ['日', '一', '二', '三', '四', '五', '六'][now.getDay()],
        });
      },
    });

    this.register({
      name: 'notify_family',
      description:
        '通知预先绑定的紧急联系人；只能通知白名单内的家属，不接受口述电话',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          reason: { type: 'string', description: '通知原因（简短描述）' },
          severity: { type: 'string', enum: ['info', 'warn', 'emergency'] },
          preferredContactIds: { type: 'array', items: { type: 'string' } },
        },
        required: ['targetId', 'reason', 'severity'],
      },
      execute: async (args, ctx) => {
        this.assertOwnTarget(args as { targetId: string }, ctx);
        const data = await this.companionData.notifyFamily(ctx, {
          reason: (args as { reason: string }).reason,
          severity: (args as { severity: 'info' | 'warn' | 'emergency' }).severity,
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'create_order',
      description: '代下平台陪诊 / 体检 / 上门服务订单。必须在 Agent 复述并得到老人确认后才调用',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          servicePlanCode: { type: 'string' },
          scheduledAt: { type: 'string', description: 'ISO 8601' },
          hospitalId: { type: 'string' },
          remarks: { type: 'string' },
        },
        required: ['targetId', 'servicePlanCode', 'scheduledAt'],
      },
      execute: async (args, ctx) => {
        this.assertOwnTarget(args as { targetId: string }, ctx);
        return this.success({ orderId: 'ORD-MOCK-NEW', status: 'pending' });
      },
    });

    this.register({
      name: 'cancel_order',
      description: '取消订单',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          orderId: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['orderId', 'reason'],
      },
      execute: async () => this.success({ cancelled: true }),
    });

    this.register({
      name: 'record_medication_taken',
      description: '记录服药打卡（按老人主观反馈，不判断是否补吃，不修改用药方案）',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          planId: { type: 'integer' },
          takenAt: { type: 'string', description: 'ISO 8601' },
          note: { type: 'string' },
        },
        required: ['planId', 'takenAt'],
      },
      execute: async (args, ctx) => {
        const data = await this.companionData.recordMedicationTaken(ctx, {
          planId: (args as { planId: number }).planId,
          takenAt: (args as { takenAt: string }).takenAt,
          note: (args as { note?: string }).note,
        });
        return this.success(data);
      },
    });

    this.register({
      name: 'record_health_metric',
      description: '记录单次体征测量（血压 / 血糖 / 体温等）',
      mutating: true,
      inputSchema: {
        type: 'object',
        properties: {
          targetId: { type: 'string' },
          type: { type: 'string' },
          values: { type: 'object' },
          measuredAt: { type: 'string' },
        },
        required: ['targetId', 'type', 'values'],
      },
      execute: async (args, ctx) => {
        this.assertOwnTarget(args as { targetId: string }, ctx);
        return this.success({ recorded: true });
      },
    });

    this.register({
      name: 'guide_app_action',
      description: '告诉老人在 App 里某项操作怎么做（分步骤短句）',
      mutating: false,
      inputSchema: {
        type: 'object',
        properties: {
          actionCode: {
            type: 'string',
            enum: ['view_orders', 'book_service', 'view_report', 'invite_family'],
          },
        },
        required: ['actionCode'],
      },
      execute: async (args) => {
        const map: Record<string, string[]> = {
          view_orders: [
            '您打开手机上的陪了个伴 App',
            '下面有个"我的"，您点一下',
            '再找到"我的订单"，您点开',
            '里面就能看到您今天的安排了',
          ],
          book_service: [
            '您打开 App，下面有个"服务"',
            '挑您要的服务点进去',
            '选好时间和医院',
            '最后点"确认下单"就好了',
          ],
          view_report: [
            '您打开 App，点"我的"',
            '里面有个"我的报告"',
            '最近一次的报告就在最上面',
          ],
          invite_family: [
            '您打开 App，点"我的"',
            '找到"家人圈"',
            '点"邀请家人"，把二维码发给家人',
            '家人扫一下就加进来了',
          ],
        };
        const code = (args as { actionCode: string }).actionCode;
        return this.success({ steps: map[code] ?? [] });
      },
    });

    this.logger.log(`已注册 ${this.tools.size} 个陪诊助手工具`);
  }

  list(): McpTool[] {
    return Array.from(this.tools.values());
  }

  get(name: string): McpTool | undefined {
    return this.tools.get(name);
  }

  private register(tool: McpTool): void {
    this.tools.set(tool.name, tool);
  }

  private success<T>(data: T): ToolResult<T> {
    return { success: true, data };
  }

  /**
   * 校验 LLM 传入的 targetId 必须等于 ctx 中的 serviceTargetId。
   * 防止「我叫张三，帮我查我儿子的订单」式越权。
   */
  private assertOwnTarget(
    args: { targetId: string },
    ctx: DeviceContext,
  ): void {
    if (ctx.serviceTargetId == null) return;
    if (String(args.targetId) !== String(ctx.serviceTargetId)) {
      const error = new Error('越权访问：targetId 不属于当前设备绑定的服务对象');
      (error as Error & { code?: string }).code = BIZ_ERROR_CODE.E_PERMISSION;
      (error as Error & { userMessage?: string }).userMessage =
        '这个我能查的是您自己的，您家人的信息让他们自己看一下方便些。';
      throw error;
    }
  }

  private assertTargetIfProvided(
    args: { targetId?: string },
    ctx: DeviceContext,
  ): void {
    if (!args.targetId) return;
    this.assertOwnTarget({ targetId: args.targetId }, ctx);
  }
}
