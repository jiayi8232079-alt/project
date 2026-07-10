import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

const MAX_FEE = 999_999.99;
const MAX_TEXT = 2000;

class ExtraIncomeItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_FEE)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;
}

class CheckupOptionalItemDto {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_FEE)
  price: number;
}

class AdditionalServiceItemDto {
  @IsString()
  @MaxLength(64)
  id: string;

  @IsString()
  @MaxLength(128)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_FEE)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  note?: string;
}

export class UpdateOrderDto {
  @ApiPropertyOptional({ description: '基础费用' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_FEE)
  baseFee?: number;

  @ApiPropertyOptional({ description: '总费用' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_FEE)
  totalFee?: number;

  @ApiPropertyOptional({ description: '陪诊员收入' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_FEE)
  attendantFee?: number;

  @ApiPropertyOptional({ description: '陪诊员收入类型标签' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  attendantFeeType?: string | null;

  @ApiPropertyOptional({ description: '陪诊员额外收入明细' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExtraIncomeItemDto)
  attendantExtraIncomeItems?: ExtraIncomeItemDto[];

  @ApiPropertyOptional({ description: '医院' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  hospital?: string;

  @ApiPropertyOptional({ description: '科室' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  department?: string;

  @ApiPropertyOptional({ description: '服务类型' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  serviceType?: string;

  @ApiPropertyOptional({ description: '风险等级', enum: ['L1', 'L2'] })
  @IsOptional()
  @IsIn(['L1', 'L2', null])
  riskLevel?: string | null;

  @ApiPropertyOptional({ description: '服务开始时间' })
  @IsOptional()
  @IsDateString()
  serviceTime?: string;

  @ApiPropertyOptional({ description: '服务结束时间' })
  @IsOptional()
  @IsDateString()
  serviceEndTime?: string | null;

  @ApiPropertyOptional({ description: '服务地址' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  serviceAddress?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT)
  notes?: string;

  @ApiPropertyOptional({ description: '体检套餐名称' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  checkupPackageName?: string;

  @ApiPropertyOptional({ description: '体检套餐性别' })
  @IsOptional()
  @IsString()
  @IsIn(['male', 'female', 'any', ''])
  checkupGender?: string;

  @ApiPropertyOptional({ description: '体检可选项目' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckupOptionalItemDto)
  checkupOptionalItems?: CheckupOptionalItemDto[];

  @ApiPropertyOptional({ description: '附加服务项' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdditionalServiceItemDto)
  additionalServiceItems?: AdditionalServiceItemDto[];

  @ApiPropertyOptional({
    description: '结算状态',
    enum: ['pending', 'settled'],
  })
  @IsOptional()
  @IsIn(['pending', 'settled'])
  settlementStatus?: string;

  @ApiPropertyOptional({
    description: '支付状态',
    enum: ['unpaid', 'paid', 'refunded'],
  })
  @IsOptional()
  @IsIn(['unpaid', 'paid', 'refunded'])
  paymentStatus?: string;

  @ApiPropertyOptional({
    description: '支付方式',
    enum: ['wechat', 'alipay', 'qr_transfer', 'bank_transfer'],
  })
  @IsOptional()
  @IsIn(['wechat', 'alipay', 'qr_transfer', 'bank_transfer', null])
  paymentMethod?: string | null;

  @ApiPropertyOptional({ description: '实收时间' })
  @IsOptional()
  @IsDateString()
  paymentPaidAt?: string | null;

  @ApiPropertyOptional({ description: '支付流水号/凭证号' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  paymentReference?: string | null;

  @ApiPropertyOptional({ description: '结算时间' })
  @IsOptional()
  @IsDateString()
  settledAt?: string | null;

  @ApiPropertyOptional({ description: '结算备注' })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_TEXT)
  settlementRemark?: string | null;

  @ApiPropertyOptional({ description: '是否需要陪诊员' })
  @IsOptional()
  @IsBoolean()
  needAttendant?: boolean;

  @ApiPropertyOptional({
    description: '医院约号状态',
    enum: ['booked', 'pending_cs'],
  })
  @IsOptional()
  @IsIn(['booked', 'pending_cs', null])
  hospitalBookingStatus?: 'booked' | 'pending_cs' | null;

  @ApiPropertyOptional({ description: '医院名录 ID' })
  @IsOptional()
  @IsInt()
  hospitalDirectoryId?: number | null;

  @ApiPropertyOptional({ description: '客户回电号码（大陆手机号）' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^(1[3-9]\d{9})?$/, {
    message: '回电号码格式不正确，应为 1 开头的 11 位大陆手机号或留空',
  })
  callbackContactPhone?: string | null;
}
