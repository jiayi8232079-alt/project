import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/**
 * 会被透传给前端的"辅助字段"白名单。
 * 用于登录防暴破/锁定/字段级验证等场景：HttpException 抛出的 payload 里若包含这些字段，
 * 会跟随 message/status/data 一起返回，前端据此渲染（例如验证码输入框、倒计时、字段级错误）。
 */
const ERROR_PAYLOAD_PASSTHROUGH = new Set<string>([
  'captchaRequired',
  'captchaToken',
  'lockedSeconds',
  'fields',
  'retryAfter',
]);

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '服务器内部错误';
    const extraPayload: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else {
        const obj = res as Record<string, unknown>;
        const rawMessage = obj.message;
        if (Array.isArray(rawMessage)) {
          message = String(rawMessage[0] ?? exception.message);
        } else {
          message = rawMessage?.toString() ?? exception.message;
        }
        for (const key of Object.keys(obj)) {
          if (ERROR_PAYLOAD_PASSTHROUGH.has(key)) {
            extraPayload[key] = obj[key];
          }
        }
      }
    } else if (exception instanceof QueryFailedError) {
      const driverError = (
        exception as QueryFailedError & {
          driverError?: { code?: string; message?: string; sqlMessage?: string };
        }
      ).driverError;
      const code = String(driverError?.code || '');
      const rawMessage = String(
        driverError?.sqlMessage || driverError?.message || exception.message || '',
      );
      const isSchemaUnavailable =
        code === 'ER_NO_SUCH_TABLE' ||
        code === 'ER_BAD_FIELD_ERROR' ||
        code === '42S02' ||
        code === '42S22' ||
        /doesn't exist|unknown column|no such table/i.test(rawMessage);

      this.logger.error(
        `QueryFailedError[${code || 'UNKNOWN'}]: ${rawMessage}`,
        (exception as Error).stack,
      );
      if (isSchemaUnavailable) {
        status = HttpStatus.SERVICE_UNAVAILABLE;
        message = '系统升级中，请稍后重试';
      }
    } else if (exception instanceof Error) {
      // express body-parser 抛 PayloadTooLargeError 时带 status=413、type='entity.too.large'
      const errAny = exception as Error & { status?: number; type?: string };
      if (errAny.status === 413 || errAny.type === 'entity.too.large') {
        status = HttpStatus.PAYLOAD_TOO_LARGE;
        message = '请求体过大，请减少上传数据后重试';
      } else if (errAny.type === 'entity.parse.failed') {
        status = HttpStatus.BAD_REQUEST;
        message = '请求 JSON 格式错误';
      } else {
        this.logger.error(exception.message, exception.stack);
      }
    }

    response.status(status).json({
      code: status,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      ...extraPayload,
    });
  }
}
