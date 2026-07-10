import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class PostTriageMessageDto {
  @ApiProperty({ description: '消息正文', example: '建议携带近期检查报告前往附近三甲医院急诊。' })
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content: string;
}
