import {
  Controller,
  Get, 
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { HospitalService } from './hospital.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { Hospital } from '../../entities/hospital.entity.js';
import {
  AdminCreateHospitalDto,
  AdminUpdateHospitalDto,
} from './dto/admin-hospital.dto.js';
import { EnrichHospitalsAmapDto } from './dto/enrich-amap.dto.js';
import { ImportZhejiangAmapDto } from './dto/import-zhejiang-amap.dto.js';
import { ImportRegionAmapDto } from './dto/import-region-amap.dto.js';
import { PurgeAncillaryHospitalsDto } from './dto/purge-ancillary-hospitals.dto.js';
import { PurgeMissingImageHospitalsDto } from './dto/purge-missing-image.dto.js';
import { RestorePublicStomatologyDto } from './dto/restore-public-stomatology.dto.js';
import {
  CreateHospitalDoctorDto,
  UpdateHospitalDoctorDto,
  BatchHospitalDoctorsDto,
} from './dto/hospital-doctor.dto.js';

@ApiTags('医院名录')
@Controller('hospitals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HospitalController {
  constructor(private readonly hospitalService: HospitalService) {}

  /** 小程序/内部通用：仅返回启用中的医院 */
  @Get()
  @ApiOperation({ summary: '检索医院名录（按省/市筛选，如浙江省杭州、丽水、温州及上海市等）' })
  list(
    @CurrentUser('type') type: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    return this.hospitalService.listForUser({
      province,
      city,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** 须排在 :id/doctors 之前（静态路径优先） */
  @Get('regions')
  @ApiOperation({ summary: '启用医院涉及的省、市（小程序筛选用）' })
  regionFacets(@CurrentUser('type') type: string) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    return this.hospitalService.getActiveRegionFacets();
  }

  /** 须排在 :id/doctors 之前 */
  @Get('doctor-directory')
  @ApiOperation({ summary: '小程序：跨医院本院医生检索（姓名/科室/职称/擅长/医院名）' })
  doctorDirectory(
    @CurrentUser('type') type: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('hospitalId') hospitalId?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    const hidNum = hospitalId != null && hospitalId !== '' ? Number(hospitalId) : NaN;
    return this.hospitalService.listDoctorDirectoryForUser({
      province,
      city,
      hospitalId: Number.isFinite(hidNum) ? hidNum : undefined,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** 须排在 :id/doctors 之前 */
  @Get('nearby')
  @ApiOperation({ summary: '小程序：按经纬度检索附近医院（km，库内有坐标）' })
  nearby(
    @CurrentUser('type') type: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    const r = radiusKm != null && radiusKm !== '' ? Number(radiusKm) : undefined;
    return this.hospitalService.listNearbyForUser({
      latitude: Number(latitude),
      longitude: Number(longitude),
      radiusKm: r !== undefined && Number.isFinite(r) ? r : undefined,
      keyword,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  /** 须排在 :id/doctors 之前 */
  @Get('map-markers')
  @ApiOperation({
    summary: '小程序：医院地图标点（轻量，最多400条；可传 latitude+longitude+radiusKm 仅返回周边）',
  })
  mapMarkers(
    @CurrentUser('type') type: string,
    @Query('province') province?: string,
    @Query('city') city?: string,
    @Query('keyword') keyword?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusKm') radiusKm?: string,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    const la = latitude != null && latitude !== '' ? Number(latitude) : undefined;
    const ln = longitude != null && longitude !== '' ? Number(longitude) : undefined;
    const rk = radiusKm != null && radiusKm !== '' ? Number(radiusKm) : undefined;
    return this.hospitalService.listMapMarkersForUser({
      province,
      city,
      keyword,
      latitude: la !== undefined && Number.isFinite(la) ? la : undefined,
      longitude: ln !== undefined && Number.isFinite(ln) ? ln : undefined,
      radiusKm: rk !== undefined && Number.isFinite(rk) ? rk : undefined,
    });
  }

  /** 须排在 :id/doctors 之前；用于deeplink打开指定医院详情 */
  @Get('lookup/:id')
  @ApiOperation({ summary: '小程序：按 id 取单条启用医院' })
  lookupHospital(@CurrentUser('type') type: string, @Param('id', ParseIntPipe) id: number) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    return this.hospitalService.getHospitalByIdForUser(id);
  }

  @Get('admin/all-doctors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：跨医院全局医生列表（分页+搜索）' })
  adminListAllDoctors(
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
      pageSize: pageSize ? Number(pageSize) : 20,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
  }

  /** 须排在 :id/doctors 之前，避免 admin 被当成 id */
  @Get('admin/doctors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：本院医生列表' })
  adminListDoctors(
    @Query('hospitalId', ParseIntPipe) hospitalId: number,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.hospitalService.adminListDoctors(
      hospitalId,
      includeInactive === 'true' || includeInactive === '1',
    );
  }

  @Post('admin/doctors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：新增本院医生' })
  adminCreateDoctor(@Body() dto: CreateHospitalDoctorDto) {
    return this.hospitalService.adminCreateDoctor(dto);
  }

  @Post('admin/doctors/batch')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：批量导入本院医生（可选 replace 清空该院旧数据）' })
  adminBatchDoctors(@Body() dto: BatchHospitalDoctorsDto) {
    return this.hospitalService.adminBatchDoctors(dto);
  }

  @Patch('admin/doctors/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：更新本院医生' })
  adminUpdateDoctor(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHospitalDoctorDto) {
    return this.hospitalService.adminUpdateDoctor(id, dto);
  }

  @Delete('admin/doctors/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：删除本院医生' })
  adminDeleteDoctor(@Param('id', ParseIntPipe) id: number) {
    return this.hospitalService.adminDeleteDoctor(id);
  }

  @Get(':id/doctors')
  @ApiOperation({ summary: '小程序：某医院本院医生名录' })
  listDoctorsForUser(
    @CurrentUser('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    return this.hospitalService.listDoctorsForUser(id);
  }

  @Get(':id/map-point')
  @ApiOperation({ summary: '小程序导航：经纬度（无坐标时高德地理编码）' })
  getMapPoint(
    @CurrentUser('type') type: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    if (type !== 'user' && type !== 'admin') {
      throw new ForbiddenException('无权访问');
    }
    return this.hospitalService.getNavigationPointForUser(id);
  }

  @Get('admin/list')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：医院列表（支持含停用）' })
  adminList(
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
      pageSize: pageSize ? Number(pageSize) : 20,
      includeInactive: includeInactive === 'true' || includeInactive === '1',
    });
  }

  @Post('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：新增医院' })
  adminCreate(@Body() dto: AdminCreateHospitalDto) {
    return this.hospitalService.adminCreate(dto as Partial<Hospital>);
  }

  @Patch('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：更新医院' })
  adminUpdate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateHospitalDto,
  ) {
    return this.hospitalService.adminUpdate(id, dto as Partial<Hospital>);
  }

  @Delete('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({ summary: '后台：删除医院' })
  adminDelete(@Param('id', ParseIntPipe) id: number) {
    return this.hospitalService.adminDelete(id);
  }

  @Post('admin/seed-lishui-wenzhou')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '后台：一键导入丽水+温州示例数据（仅空表时生效）' })
  seedLishuiWenzhou() {
    return this.hospitalService.seedLishuiWenzhouIfEmpty();
  }

  @Post('admin/seed-lishui-wenzhou-append')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '后台：补全丽水全市县+温州各县市骨架数据（按名称+市+区县去重，已存在则跳过）',
  })
  seedLishuiWenzhouAppend() {
    return this.hospitalService.seedLishuiWenzhouAppend();
  }

  @Post('admin/seed-hangzhou-shanghai-append')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      '后台：补全浙江省杭州市+上海市医院骨架名册（去重）；之后请用高德补全电话/图片',
  })
  seedHangzhouShanghaiAppend() {
    return this.hospitalService.seedHangzhouShanghaiAppend();
  }

  @Post('admin/seed-zy91-doctors')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '后台：导入浙大一院医生种子数据（按姓名+科室去重）',
  })
  seedZy91Doctors() {
    return this.hospitalService.seedZy91Doctors();
  }

  @Post('admin/enrich-amap')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.CUSTOMER_SERVICE)
  @ApiOperation({
    summary:
      '后台：从高德补全电话、封面图、坐标等。支持 cities / ids 分批；或 scanAllMissingImages=true 自动扫库补齐全站缺图（建议 imagesOnly=true、limit=80、scanMaxBatches=300–800，留意接口超时与高德配额）',
  })
  enrichAmap(@Body() dto: EnrichHospitalsAmapDto) {
    return this.hospitalService.adminEnrichFromAmap(dto);
  }

  @Post('admin/import-zhejiang-amap')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      '后台：高德按市检索「综合医院+专科医院」POI，批量写入浙江省名录（去重）。耗时长，建议仅管理员执行；可先 dryRun',
  })
  importZhejiangAmap(@Body() dto: ImportZhejiangAmapDto) {
    return this.hospitalService.adminImportZhejiangFromAmap(dto);
  }

  @Post('admin/import-region-amap')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      '后台：高德按市写入北京市或广东省「综合+专科」医院 POI；排除社区卫生站/小诊所；口腔类仅保留公立/附属等（民营口腔专科不入库）。可先 dryRun',
  })
  importRegionAmap(@Body() dto: ImportRegionAmapDto) {
    return this.hospitalService.adminImportRegionFromAmap(dto);
  }

  @Post('admin/purge-ancillary')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      '后台：删除医美/体检/SPA/眼镜零售与配镜门店/无名「医院」字样的诊所与社康等（与小程序「找医院」规则对齐，可关 includeDirectoryNoise）；传 matchOrthopedicClinicsOnly=true 时仅删名称含正骨/整脊/推拿复位且不含「医院」的机构。默认同城同名/同规整地址/同经纬度网格去重保留信息更全项（可关 dedupePreferPhone、dedupeSameAddress、dedupeSameCoordinates）；可选 removeAllWithoutMainPhone 清空无主电话。硬删除含医生。先 dryRun',
  })
  purgeAncillary(@Body() dto: PurgeAncillaryHospitalsDto) {
    return this.hospitalService.adminPurgeAncillaryHospitals(dto);
  }

  @Post('admin/purge-missing-image')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary:
      '后台：硬删除 image_url 为空的医院（无封面图），并删除关联本院医生。请先 dryRun',
  })
  purgeMissingImage(@Body() dto: PurgeMissingImageHospitalsDto) {
    return this.hospitalService.adminPurgeHospitalsMissingImage(dto);
  }

  @Post('admin/restore-public-stomatology')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: '后台：恢复公立/附属口腔专科及市口腔医院骨架（可高德补全）；请先 dryRun',
  })
  restorePublicStomatology(@Body() dto: RestorePublicStomatologyDto) {
    return this.hospitalService.adminRestorePublicStomatology(dto);
  }
}
