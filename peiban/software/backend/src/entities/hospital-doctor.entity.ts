import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { Hospital } from './hospital.entity.js';

/**
 * 医院展示用专家/医生名录（由运营维护，以医院官方信息为准）
 */
@Entity('hospital_doctors')
@Index(['hospitalId', 'sortWeight'])
export class HospitalDoctor extends BaseEntity {
  @Column({ name: 'hospital_id' })
  hospitalId: number;

  @ManyToOne(() => Hospital, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @Column({ length: 64 })
  name: string;

  /** 科室或专业方向，如「心血管内科」 */
  @Column({ type: 'varchar', length: 120, nullable: true })
  department: string | null;

  /** 职称级别，如「主任医师」「副主任医师」 */
  @Column({ name: 'title_level', type: 'varchar', length: 64, nullable: true })
  titleLevel: string | null;

  /** 擅长领域 */
  @Column({ type: 'text', nullable: true })
  expertise: string | null;

  /** 医生简介 */
  @Column({ type: 'text', nullable: true })
  introduction: string | null;

  /** 头像/照片 URL */
  @Column({ name: 'avatar_url', type: 'varchar', length: 512, nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'sort_weight', type: 'int', default: 0 })
  sortWeight: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 128, nullable: true })
  source: string | null;
}
