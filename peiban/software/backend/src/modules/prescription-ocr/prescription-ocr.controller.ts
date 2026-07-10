import { Body, Controller, Post, UseGuards, Query, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PrescriptionOcrService } from './prescription-ocr.service.js';
import { ParseImageDto } from './dto/parse-image.dto.js';

@ApiTags('处方 OCR')
@Controller('prescription-ocr')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PrescriptionOcrController {
  constructor(private readonly service: PrescriptionOcrService) {}

  @Post('parse')
  @ApiOperation({ summary: '识别处方图片，返回结构化药品清单（未配置 provider 时返回 stub 结果）' })
  async parse(@Body() dto: ParseImageDto) {
    const raw = await this.service.parse(dto.imageUrl);
    const items = await this.service.enrichByDictionary(raw.items);
    return { ...raw, items };
  }

  @Post('enrich-by-dictionary')
  @ApiOperation({ summary: '纯字典补全：提交药名列表，服务端用字典带出默认值' })
  enrich(@Body() body: { items: Array<{ medicineName: string }> }) {
    return this.service.enrichByDictionary(body?.items || []);
  }

  @Get('search-medicine')
  @ApiOperation({ summary: '药名联想（与 /medicine-catalog/search 等价，便于小程序只集成一个入口）' })
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.service.searchMedicine(q || '', Number(limit) || 10);
  }
}
