import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';

/**
 * 合作/展示用医院名录（地址、电话、等级等需运营定期核对，以卫健部门及医院官方为准）
 */
@Entity('hospitals')
export class Hospital extends BaseEntity {
  @Column({ length: 160 })
  name: string;

  @Column({ name: 'short_name', type: 'varchar', length: 64, nullable: true })
  shortName: string | null;

  @Column({ length: 32, default: '浙江省' })
  province: string;

  /** 如：丽水市、温州市 */
  @Column({ length: 32 })
  city: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  district: string | null;

  @Column({ type: 'text' })
  address: string;

  /** 总机或主要对外电话 */
  @Column({ name: 'phone_main', type: 'varchar', length: 64, nullable: true })
  phoneMain: string | null;

  /** 其它公开电话，如急诊、预约 */
  @Column({ name: 'phones_extra', type: 'json', nullable: true })
  phonesExtra: string[] | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  /** 医院等级：三甲、三乙、三级、二甲 等（以评审结果为准） */
  @Column({ name: 'hospital_level', type: 'varchar', length: 32, nullable: true })
  hospitalLevel: string | null;

  /** 举办主体：政府办、社会办、其他 */
  @Column({ name: 'ownership_type', type: 'varchar', length: 32, nullable: true })
  ownershipType: string | null;

  /** 重点/特色专科（人工维护或引用公开资料，仅供参考） */
  @Column({ name: 'key_departments', type: 'json', nullable: true })
  keyDepartments: string[] | null;

  @Column({ name: 'website_url', type: 'varchar', length: 512, nullable: true })
  websiteUrl: string | null;

  /** 展示用封面图（建议上传自有或已获授权素材；种子数据此项多为空） */
  @Column({ name: 'image_url', type: 'varchar', length: 512, nullable: true })
  imageUrl: string | null;

  @Column({ name: 'sort_weight', type: 'int', default: 0 })
  sortWeight: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'text', nullable: true })
  remark: string | null;
}
