import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import {
  DialogDirection,
  DialogEmotion,
} from '../../../entities/ai-dialog-log.entity.js';

/**
 * 追加一条对话留存 —— 主要由 ai-gateway 在 MCP 工具调用结束后落库；
 * 也允许 admin 测试入口手工触发。
 */
export class AppendDialogLogDto {
  @ApiProperty({ description: '所属 session ID（无 session 时传 0，service 会自动新建）' })
  @IsInt()
  @Min(0)
  sessionId: number;

  @ApiPropertyOptional({ description: '设备 ID' })
  @IsOptional()
  @IsInt()
  @Min(1)
  deviceId?: number;

  @ApiPropertyOptional({ description: '关联账号' })
  @IsOptional()
  @IsInt()
  @Min(1)
  userId?: number;

  @ApiPropertyOptional({ description: '服务对象（老人）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  serviceTargetId?: number;

  @ApiProperty({ enum: DialogDirection })
  @IsEnum(DialogDirection)
  direction: DialogDirection;

  @ApiProperty({ description: '消息文本' })
  @IsString()
  @Length(1, 8000)
  text: string;

  @ApiPropertyOptional({ description: '原始音频 URL（极少存）' })
  @IsOptional()
  @IsString()
  audioUrl?: string;

  @ApiPropertyOptional({ enum: DialogEmotion })
  @IsOptional()
  @IsEnum(DialogEmotion)
  emotion?: DialogEmotion;

  @ApiPropertyOptional({ description: '命中危机词列表' })
  @IsOptional()
  @IsArray()
  crisisWords?: string[];

  @ApiPropertyOptional({
    description: '本轮工具调用 [{name, args, result, durationMs, error?}]',
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  toolCalls?: unknown[];

  @ApiPropertyOptional({ description: 'token 数（assistant 必填）' })
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenCount?: number;

  @ApiPropertyOptional({ description: '端到端延迟 ms' })
  @IsOptional()
  @IsInt()
  @Min(0)
  latencyMs?: number;

  @ApiPropertyOptional({ description: '识别意图标签' })
  @IsOptional()
  @IsString()
  intent?: string;

  @ApiPropertyOptional({ description: 'LLM 模型名（如 deepseek-chat）' })
  @IsOptional()
  @IsString()
  modelName?: string;

  @ApiPropertyOptional({ description: '新建 session 时携带的元数据（agentId 等）' })
  @IsOptional()
  @IsObject()
  sessionMetadata?: { agentId?: string };
}
