import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 更新时间线条目 DTO（总管理员编辑）
 *
 * 由于 multipart/form-data 中所有字段都是 string，这里定义只是用于 Swagger 文档和可见性校验，
 * 真正的 keepImageUrls / keepFileUrls / keepAudioUrls 在 controller 里手动 JSON.parse。
 * content 可以为空字符串（清空文本）。
 */
export class UpdateTimelineEntryDto {
  @ApiPropertyOptional({ description: '新的文本内容（传空字符串即清空）' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    description:
      '保留的图片 URL 列表（JSON 字符串，例如 ["timeline/xx.png","timeline/yy.jpg"]）；不传或传空数组 = 清空全部',
  })
  @IsOptional()
  @IsString()
  keepImageUrls?: string;

  @ApiPropertyOptional({
    description:
      '保留的录音列表（JSON 字符串，元素形如 {"url":"timeline/xx.mp3","name":"123.mp3"}）',
  })
  @IsOptional()
  @IsString()
  keepAudioFiles?: string;

  @ApiPropertyOptional({
    description:
      '保留的文档列表（JSON 字符串，元素形如 {"url":"timeline/xx.pdf","name":"报告.pdf"}）',
  })
  @IsOptional()
  @IsString()
  keepFiles?: string;

  @ApiPropertyOptional({
    description: '是否对用户可见（"true"/"false"），不传则不变',
  })
  @IsOptional()
  @IsString()
  visibleToUser?: string;
}
