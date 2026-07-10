import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { DeviceType } from '../../../entities/device.entity.js';
import { DeviceBindingRole } from '../../../entities/device-binding.entity.js';

/**
 * App 配网完成后调用：把已配网的涂鸦设备绑到当前用户名下。
 *
 * mock 阶段：`tuyaDeviceId` 可传 `mock_xxx` 任意字符串，service 会接受；
 * 真实接入后：必须是涂鸦云返回的真实 deviceId（配网回调里有）。
 */
export class BindDeviceDto {
  @ApiProperty({ description: '涂鸦设备 ID（mock 阶段可任意）' })
  @IsString()
  @Length(3, 64)
  tuyaDeviceId: string;

  @ApiProperty({ description: '涂鸦产品 PID' })
  @IsString()
  @Length(3, 64)
  productId: string;

  @ApiProperty({ description: '展示名称（如「奶奶的陪伴机」）' })
  @IsString()
  @Length(1, 128)
  name: string;

  @ApiPropertyOptional({ enum: DeviceType, default: DeviceType.ROBOT })
  @IsOptional()
  @IsEnum(DeviceType)
  type?: DeviceType;

  @ApiProperty({ description: '关联的服务对象（老人）ID' })
  @IsInt()
  @Min(1)
  serviceTargetId: number;

  @ApiPropertyOptional({ description: '绑定到的家庭组 ID（可选）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  familyGroupId?: number;

  @ApiPropertyOptional({
    enum: DeviceBindingRole,
    default: DeviceBindingRole.OWNER,
    description: '绑定角色，默认 owner',
  })
  @IsOptional()
  @IsEnum(DeviceBindingRole)
  role?: DeviceBindingRole;

  @ApiPropertyOptional({ description: 'MAC 地址' })
  @IsOptional()
  @IsString()
  @Length(0, 32)
  mac?: string;

  @ApiPropertyOptional({ description: '扩展元数据' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
