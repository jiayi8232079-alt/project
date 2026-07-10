import { Entity, Column, ManyToOne, JoinColumn, OneToMany, DeleteDateColumn, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { EncryptedColumnTransformer } from '../common/utils/column-encryption.js';
import { DecimalTransformer } from '../common/utils/decimal-transformer.js';
import { User } from './user.entity.js';
import { Order } from './order.entity.js';
import { Schedule } from './schedule.entity.js';
import { FinanceRecord } from './finance-record.entity.js';
import { Review } from './review.entity.js';

/**
 * 平台服务人员的专业角色（一个人可同时具备多个角色，但主角色唯一）。
 *
 * 这是 B 端 SaaS 多角色工作台的底层基础。订单 `serviceType` 通过
 * `professional_services.category` 映射到对应角色，从而按能力匹配候选人。
 */
export enum ServiceStaffRole {
  /** 陪诊员（默认） */
  ATTENDANT = 'attendant',
  /** 营养师 */
  NUTRITIONIST = 'nutritionist',
  /** 康复师 */
  REHABILITATOR = 'rehabilitator',
  /** 护士 */
  NURSE = 'nurse',
  /** 生活照护/居家护理员 */
  CAREGIVER = 'caregiver',
  /** 月嫂/母婴护理 */
  MATERNAL_CARE = 'maternal_care',
  /** 心理咨询师 */
  PSYCHOLOGIST = 'psychologist',
}

/**
 * 单条持证/资格记录。
 */
export interface StaffCertification {
  name: string;
  /** 证书编号（可选） */
  number?: string;
  /** 签发日期 ISO */
  issuedAt?: string;
  /** 到期日期 ISO（null=长期有效） */
  expiry?: string | null;
  /** 证书图片 URL（可选） */
  imageUrl?: string;
}

@Entity('attendants')
@Index(['primaryRole'])
export class Attendant extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'real_name' })
  realName: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ select: false, nullable: true })
  password: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  profile: string;

  @Column({
    name: 'insurance_info',
    type: 'varchar',
    length: 512,
    nullable: true,
    transformer: EncryptedColumnTransformer,
  })
  insuranceInfo: string;

  @Column({ name: 'insurance_expiry', type: 'date', nullable: true })
  insuranceExpiry: Date;

  @Column({
    type: 'decimal',
    precision: 2,
    scale: 1,
    default: 5.0,
    transformer: DecimalTransformer,
  })
  rating: number;

  @Column({ name: 'total_orders', default: 0 })
  totalOrders: number;

  @Column({ type: 'enum', enum: ['active', 'disabled'], default: 'active' })
  status: string;

  /**
   * 主要专业角色，决定小程序工作台界面变装与默认派单倾向。
   * 未指定时视为陪诊员（历史数据向前兼容）。
   */
  @Column({
    name: 'primary_role',
    type: 'enum',
    enum: ServiceStaffRole,
    default: ServiceStaffRole.ATTENDANT,
    comment: '主要专业角色（工作台变装依据）',
  })
  primaryRole: ServiceStaffRole;

  /**
   * 具备的所有角色清单。订单派单时按 `serviceType` → category → 命中任一角色即可抢/被指派。
   */
  @Column({
    name: 'professional_roles',
    type: 'simple-json',
    nullable: true,
    comment: '具备的所有角色（ServiceStaffRole[]）。null = 仅 primaryRole',
  })
  professionalRoles: ServiceStaffRole[] | null;

  /**
   * 专业特长标签，用于精细化派单与展示（非强约束）。
   * 例：["糖尿病营养","术后恢复","脑卒中康复"]
   */
  @Column({
    type: 'simple-json',
    nullable: true,
    comment: '专长标签，用于 B2B2C 场景下精细化匹配',
  })
  specialties: string[] | null;

  /**
   * 持证/资格记录列表（身份证照片另行存储，这里只放与执业相关的证书）。
   */
  @Column({
    type: 'json',
    nullable: true,
    comment: '执业相关证书清单（StaffCertification[]）',
  })
  certifications: StaffCertification[] | null;

  /**
   * 对外展示的服务年限（手动填写，便于 B 端白标页面展示）。
   */
  @Column({
    name: 'experience_years',
    type: 'tinyint',
    default: 0,
    comment: '服务年限（展示用）',
  })
  experienceYears: number;

  /**
   * 对外展示头衔（如"注册营养师"/"高级康复治疗师"），不填走 primaryRole 对应默认值。
   */
  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '对外展示头衔，不填走 primaryRole 默认',
  })
  title: string | null;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;

  /** 连续登录失败次数，登录成功后清零 */
  @Column({ name: 'failed_login_count', type: 'int', default: 0 })
  failedLoginCount: number;

  /** 锁定到期时间，未到期前禁止再次尝试 */
  @Column({ name: 'locked_until', type: 'datetime', nullable: true })
  lockedUntil: Date | null;

  /** 最后一次登录失败时间，用于计算"最近 N 分钟" */
  @Column({ name: 'last_failed_login_at', type: 'datetime', nullable: true })
  lastFailedLoginAt: Date | null;

  @OneToMany(() => Order, (order) => order.attendant)
  orders: Order[];

  @OneToMany(() => Schedule, (schedule) => schedule.attendant)
  schedules: Schedule[];

  @OneToMany(() => FinanceRecord, (record) => record.attendant)
  financeRecords: FinanceRecord[];

  @OneToMany(() => Review, (review) => review.attendant)
  reviews: Review[];
}
