/**
 * MCP 走 JSON-RPC 2.0 over HTTP；以下是简化后的请求/响应类型。
 *
 * 标准 MCP 方法：
 * - `initialize`        客户端握手
 * - `tools/list`        枚举可用工具
 * - `tools/call`        调用工具
 * - `notifications/initialized`  握手完成通知
 *
 * 本实现只支持 HTTP POST（StreamableHTTP）；SSE 流式响应在 Phase 2 再补，
 * 当前所有工具都是 fire-and-forget 单次返回。
 */
export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcSuccessResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string | number;
  result: T;
}

export interface JsonRpcErrorResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse =
  | JsonRpcSuccessResponse
  | JsonRpcErrorResponse;

/** JSON-RPC 标准错误码（节选） */
export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/** 业务层错误码（映射到 PRD ai-gateway-mcp-spec §4） */
export const BIZ_ERROR_CODE = {
  E_AUTH: 'E_AUTH',
  E_PERMISSION: 'E_PERMISSION',
  E_NOT_FOUND: 'E_NOT_FOUND',
  E_VALIDATION: 'E_VALIDATION',
  E_RATE_LIMIT: 'E_RATE_LIMIT',
  E_TIMEOUT: 'E_TIMEOUT',
  E_UPSTREAM: 'E_UPSTREAM',
  E_BUSINESS: 'E_BUSINESS',
  E_INTERNAL: 'E_INTERNAL',
  E_CIRCUIT_OPEN: 'E_CIRCUIT_OPEN',
} as const;

export type BizErrorCode = (typeof BIZ_ERROR_CODE)[keyof typeof BIZ_ERROR_CODE];
