/**
 * MCP 工具上下文 —— 由 `DeviceContextGuard` 注入到 request，
 * 所有 tool 实现必须只信任此上下文，**不信任 LLM 传入的 userId/tenantId**。
 */
export interface DeviceContext {
  /** 涂鸦设备 ID（来自 X-Device-Id 请求头） */
  tuyaDeviceId: string;
  /** 系统内部 device 主键（反查得到） */
  deviceId: number;
  /** 该设备绑定的主用户 ID */
  userId: number;
  /** 该用户/设备所属租户 */
  tenantId: number;
  /** 服务对象（被陪护的老人）ID；可能等于 userId */
  serviceTargetId: number | null;
  /** 当前会话 ID（来自 X-Session-Id） */
  sessionId: string;
  /** 请求 ID（来自 X-Request-Id），用于审计追溯 */
  requestId: string;
}

/**
 * 单个 MCP 工具的标准接口。
 * 所有 tool 类实现这个接口后在 `companion-tools.service.ts` 里集中注册。
 */
export interface McpTool<TArgs = Record<string, unknown>, TResult = unknown> {
  /** 工具名（必须与涂鸦智能体平台「工具集」配置一致） */
  readonly name: string;
  /** 工具描述（LLM 用来决定何时调用） */
  readonly description: string;
  /** JSON Schema 入参校验 */
  readonly inputSchema: Record<string, unknown>;
  /** 是否写操作（写操作需 Agent 二次确认 + 后端审计） */
  readonly mutating: boolean;

  execute(args: TArgs, ctx: DeviceContext): Promise<TResult>;
}

/**
 * 工具执行成功的包络 —— 对应 PRD ai-gateway-mcp-spec §3。
 */
export interface ToolSuccess<T = unknown> {
  success: true;
  data: T;
  meta?: { cached?: boolean };
}

/**
 * 工具执行失败的包络 —— `userMessage` 是给老人朗读的话术。
 */
export interface ToolFailure {
  success: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    userMessage: string;
  };
}

export type ToolResult<T = unknown> = ToolSuccess<T> | ToolFailure;
