import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { EncryptedColumnTransformer } from '../common/utils/column-encryption.js';
import { User } from './user.entity.js';
import { Order } from './order.entity.js';

/**
 * service_targets 几乎每次「我的健康/家庭面板/创建订单」都按 user_id 列表查询。
 * phone_hash 用于老人手机号反查档案（家庭模块 backfill）。
 *
 * 生产环境手工补：
 *   CREATE INDEX idx_st_user_id ON service_targets(user_id);
 *   CREATE INDEX idx_st_phone_hash ON service_targets(phone_hash);
 */
@Entity('service_targets')
@Index(['userId'])
@Index(['phoneHash'])
export class ServiceTarget extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, (user) => user.serviceTargets)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  name: string;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 512,
    transformer: EncryptedColumnTransformer,
  })
  idCard: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  age: number;

  @Column({
    nullable: true,
    type: 'varchar',
    length: 255,
    transformer: EncryptedColumnTransformer,
  })
  phone: string;

  @Column({
    name: 'emergency_contact',
    nullable: true,
    type: 'varchar',
    length: 255,
    transformer: EncryptedColumnTransformer,
  })
  emergencyContact: string;

  @Column({
    name: 'emergency_phone',
    nullable: true,
    type: 'varchar',
    length: 255,
    transformer: EncryptedColumnTransformer,
  })
  emergencyPhone: string;

  @Column({
    name: 'home_address',
    nullable: true,
    type: 'varchar',
    length: 512,
    transformer: EncryptedColumnTransformer,
  })
  homeAddress: string;

  @Column({ name: 'health_profile', type: 'json', nullable: true })
  healthProfile: Record<string, unknown>;

  @Column({ name: 'main_appeal', type: 'text', nullable: true })
  mainAppeal: string;

  @Column({ name: 'signature_url', nullable: true })
  signatureUrl: string;

  /** 是否已完成"托管/委托协议"签署（子女代建场景必需） */
  @Column({ name: 'is_trust', type: 'boolean', default: false })
  isTrust: boolean;

  /** 委托协议生成的 HTML/PDF URL */
  @Column({ name: 'trust_doc_url', type: 'varchar', length: 512, nullable: true })
  trustDocUrl: string | null;

  /** 委托协议签署时间 */
  @Column({ name: 'trust_signed_at', type: 'datetime', nullable: true })
  trustSignedAt: Date | null;

  /** 创建者身份：self（本人）/ child（子女）/ spouse（配偶）/ other */
  @Column({ name: 'delegator_relation', type: 'varchar', length: 32, nullable: true })
  delegatorRelation: string | null;

  /** 委托协议签署人姓名（子女代签时用） */
  @Column({ name: 'trust_signer_name', type: 'varchar', length: 64, nullable: true })
  trustSignerName: string | null;

  /** 手机号稳定 HMAC，用于老人登录时按手机号反向查找本档案 */
  @Column({ name: 'phone_hash', type: 'varchar', length: 64, nullable: true })
  phoneHash: string | null;

  @OneToMany(() => Order, (order) => order.serviceTarget)
  orders: Order[];
}
