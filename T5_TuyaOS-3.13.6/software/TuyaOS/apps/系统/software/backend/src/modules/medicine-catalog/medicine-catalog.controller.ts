import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { MedicineCatalogService } from './medicine-catalog.service.js';
import { SaveMedicineDto } from './dto/save-medicine.dto.js';

@ApiTags('药品字典')
@Controller('medicine-catalog')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MedicineCatalogController {
  constructor(private readonly service: MedicineCatalogService) {}

  @Get('search')
  @ApiOperation({ summary: '药品联想搜索（供小程序/录入页使用）' })
  search(@Query('q') q: string, @Query('limit') limit?: string) {
    return this.service.search(q || '', Number(limit) || 20);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '药品库列表' })
  list(
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('enabled') enabled?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      keyword,
      category,
      enabled: enabled === undefined ? undefined : enabled === 'true',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 50,
    });
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '药品详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '新建药品' })
  create(@Body() dto: SaveMedicineDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR, UserRole.MEDICAL_CONSULTANT)
  @ApiOperation({ summary: '更新药品' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveMedicineDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OPERATOR)
  @ApiOperation({ summary: '删除药品（慎用）' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
