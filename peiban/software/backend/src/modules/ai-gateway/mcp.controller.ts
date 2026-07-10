import {
  Body,
  Controller,
  Logger,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JSON_RPC_ERROR } from './dto/jsonrpc.dto.js';
import type { JsonRpcRequest, JsonRpcResponse } from './dto/jsonrpc.dto.js';
import { DeviceContextGuard } from './guards/device-context.guard.js';
import { TuyaSignatureGuard } from './guards/tuya-signature.guard.js';
import { CompanionToolsService } from './tools/companion-tools.service.js';
import { AiQuotaService } from './quota/ai-quota.service.js';
import { CircuitBreakerInterceptor } from './interceptors/circuit-breaker.interceptor.js';
import { DesensitizeInterceptor } from './interceptors/desensitize.interceptor.js';
import type { DeviceContext } from './tools/tool.interface.js';

/**
 * MCP over StreamableHTTP 端点 —— 涂鸦智能体「自定义 MCP 服务」直连此处。
 *
 * 当前仅支持非流式 POST；流式 SSE 在 Phase 2 视模型回调诉求再加。
 *
 * 路径：POST /mcp
 * 协议：JSON-RPC 2.0
 *
 * 支持的方法（最小可用）：
 * - initialize                  握手，返回 server info / capabilities
 * - tools/list                  返回可用工具的 name + description + inputSchema
 * - tools/call                  调用具体工具
 * - notifications/initialized   握手完成通知，server 端 ack 即可
 */
@ApiTags('ai-gateway / MCP')
@Controller('mcp')
@UseGuards(TuyaSignatureGuard, DeviceContextGuard)
@UseInterceptors(CircuitBreakerInterceptor, DesensitizeInterceptor)
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly tools: CompanionToolsService,
    private readonly quota: AiQuotaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'MCP JSON-RPC 端点（initialize / tools/list / tools/call）' })
  async handle(
    @Body() body: JsonRpcRequest,
    @Req() req: Request & { deviceContext?: DeviceContext },
  ): Promise<JsonRpcResponse> {
    const id = body.id ?? null;
    const ctx = req.deviceContext;
    if (!ctx) {
      return this.fail(id, JSON_RPC_ERROR.INTERNAL_ERROR, 'DeviceContext 缺失');
    }

    switch (body.method) {
      case 'initialize':
        return this.ok(id, {
          protocolVersion: '2024-11-05',
          serverInfo: { name: 'qiaoguo-ai-gateway', version: '0.1.0' },
          capabilities: { tools: { listChanged: false } },
        });

      case 'notifications/initialized':
        return this.ok(id, {});

      case 'tools/list':
        return this.ok(id, {
          tools: this.tools.list().map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        });

      case 'tools/call': {
        const params = (body.params ?? {}) as {
          name?: string;
          arguments?: Record<string, unknown>;
        };
        const tool = params.name ? this.tools.get(params.name) : undefined;
        if (!tool) {
          return this.fail(
            id,
            JSON_RPC_ERROR.METHOD_NOT_FOUND,
            `未知工具：${params.name}`,
          );
        }
        try {
          // 用量限额 + 留痕：超日上限抛 E_RATE_LIMIT（被下方 catch 统一处理）
          await this.quota.checkAndCharge(ctx);
          const start = Date.now();
          const result = await tool.execute(params.arguments ?? {}, ctx);
          this.logger.debug(
            `tool=${tool.name} device=${ctx.deviceId} duration=${Date.now() - start}ms`,
          );
          return this.ok(id, {
            content: [
              { type: 'text', text: JSON.stringify(result) },
            ],
            isError: !result || (result as { success?: boolean }).success === false,
          });
        } catch (e) {
          const err = e as Error & { code?: string; userMessage?: string };
          this.logger.warn(
            `tool=${tool.name} device=${ctx.deviceId} error=${err.code ?? 'E_INTERNAL'} msg=${err.message}`,
          );
          return this.ok(id, {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: err.code ?? 'E_INTERNAL',
                    message: err.message,
                    retryable: err.code === 'E_TIMEOUT' || err.code === 'E_UPSTREAM',
                    userMessage:
                      err.userMessage ?? '系统有点忙，您稍等一下我再试。',
                  },
                }),
              },
            ],
            isError: true,
          });
        }
      }

      default:
        return this.fail(
          id,
          JSON_RPC_ERROR.METHOD_NOT_FOUND,
          `不支持的方法：${body.method}`,
        );
    }
  }

  private ok(id: string | number | null, result: unknown): JsonRpcResponse {
    return { jsonrpc: '2.0', id: (id ?? 0) as string | number, result };
  }

  private fail(
    id: string | number | null,
    code: number,
    message: string,
    data?: unknown,
  ): JsonRpcResponse {
    return { jsonrpc: '2.0', id, error: { code, message, data } };
  }
}
