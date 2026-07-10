import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsInt,
  IsDateString,
  IsNumber,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ApiPropertyOptional({ description: '客户用户ID（管理员代建时指定）' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiProperty({ description: '服务对象ID' })
  @IsNotEmpty()
  @IsInt()
  serviceTargetId: number;

  @ApiProperty({ description: '服务类型（自由字符串，向前兼容）' })
  @IsNotEmpty()
  @IsString()
  serviceType: string;

  @ApiPropertyOptional({
    description:
      '专业服务目录 ID（与 professionalServiceCode 二选一）。'
      + '派单引擎按服务类别匹配对应角色的陪诊员/营养师/康复师。',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  professionalServiceId?: number;

  @ApiPropertyOptional({
    description:
      '专业服务目录 code（admin 端现行传入方式；后端自动 resolve 成 id）',
  })
  @IsOptional()
  @IsString()
  professionalServiceCode?: string;

  @ApiPropertyOptional({ description: '冗余字段，admin 端传入，用于前端联想展示' })
  @IsOptional()
  @IsString()
  professionalServiceCategory?: string;

  @ApiProperty({ description: '服务时间' })
  @IsNotEmpty()
  @IsDateString()
  serviceTime: string;

  @ApiPropertyOptional({ description: '服务结束时间（可选，不得早于服务时间）' })
  @IsOptional()
  @IsDateString()
  serviceEndTime?: string;

  @ApiPropertyOptional({ description: '服务地址' })
  @IsOptional()
  @IsString()
  serviceAddress?: string;

  @ApiPropertyOptional({ description: '医院' })
  @IsOptional()
  @IsString()
  hospital?: string;

  @ApiPropertyOptional({ description: '科室' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({
    description: '医院名录 ID（与 hospital 二选一：传此项时后台会同步规范就诊医院名称并绑定名录）',
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  hospitalDirectoryId?: number;

  @ApiPropertyOptional({
    description:
      '导诊约号状态：booked=客户已自行约号；pending_cs=待客服协助约号',
    enum: ['booked', 'pending_cs'],
  })
  @IsOptional()
  @IsIn(['booked', 'pending_cs'])
  hospitalBookingStatus?: 'booked' | 'pending_cs';

  @ApiPropertyOptional({ description: '基础费用' })
  @IsOptional()
  @IsNumber()
  baseFee?: number;

  @ApiPropertyOptional({ description: '总费用' })
  @IsOptional()
  @IsNumber()
  totalFee?: number;

  @ApiPropertyOptional({ description: '陪诊项目/费用类型标签' })
  @IsOptional()
  @IsString()
  attendantFeeType?: string;

  @ApiPropertyOptional({ description: '陪诊员ID（管理员可直接指定）' })
  @IsOptional()
  @IsInt()
  attendantId?: number;

  @ApiPropertyOptional({ description: '是否需要陪诊员，默认 true' })
  @IsOptional()
  @IsBoolean()
  needAttendant?: boolean;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: '体检套餐名称（服务类型为体检预约时）' })
  @IsOptional()
  @IsString()
  checkupPackageName?: string;

  @ApiPropertyOptional({
    description: '体检套餐性别：male/female（服务类型为体检预约时）',
  })
  @IsOptional()
  @IsString()
  checkupGender?: string;

  @ApiPropertyOptional({ description: '附加备选项目（体检预约时可选）' })
  @IsOptional()
  checkupOptionalItems?: { id: string; name: string; price: number }[];

  @ApiPropertyOptional({ description: '订单附加服务项' })
  @IsOptional()
  additionalServiceItems?: {
    id: string;
    name: string;
    amount: number;
    note?: string;
  }[];
}
