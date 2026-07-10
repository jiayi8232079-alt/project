import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ThirdPartyApiKeyGuard } from '../../common/guards/third-party-api-key.guard.js';
import { HospitalService } from './hospital.service.js';

@ApiTags('第三方-医院与医生目录')
@Controller('third-party/hospitals')
@UseGuards(ThirdPartyApiKeyGuard)
export class HospitalThirdPartyController {
  constructor(private readonly hospitalService: HospitalService) {}

  @Get()
  @ApiOperation({ summary: '第三方：医院列表（支持分页，默认含停用）' })
  listHospitals(
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.hospitalService.adminList({
      province,
      city,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 100,
      includeInactive:
        includeInactive == null || includeInactive === ''
          ? true
          : includeInactive === 'true' || includeInactive === '1',
    });
  }

  @Get('doctors')
  @ApiOperation({ summary: '第三方：医生列表（带 hospitalId/hospitalName，对接映射用）' })
  listDoctors(
    @Query('keyword') keyword?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    const hidNum = hospitalId != null && hospitalId !== '' ? Number(hospitalId) : NaN;
    return this.hospitalService.adminListAllDoctors({
      keyword,
      hospitalId: Number.isFinite(hidNum) ? hidNum : undefined,
      province,
      city,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 100,
      includeInactive:
        includeInactive == null || includeInactive === ''
          ? true
          : includeInactive === 'true' || includeInactive === '1',
    });
  }
}
