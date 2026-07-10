import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';

@Entity('consultations')
export class Consultation extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'consult_type', default: 'online' })
  consultType: string;

  @Column({
    name: 'service_interest',
    type: 'varchar',
    length: 32,
    nullable: true,
    comment: '感兴趣的服务：checkup/expert/escort/consult/store/fetch',
  })
  serviceInterest: string | null;

  @Column({
    name: 'consult_category',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '咨询类型主分类（如：医疗资源协调/体检规划/陪诊服务）',
  })
  consultCategory: string | null;

  @Column({
    name: 'consult_sub_type',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '咨询类型子分类（如：专家匹配/门诊协调/住院协调）',
  })
  consultSubType: string | null;

  @Column({ name: 'name' })
  name: string;

  @Column({ name: 'phone' })
  phone: string;

  @Column({ name: 'appointment_date', type: 'date', nullable: true })
  appointmentDate: string;

  @Column({ name: 'appointment_time', nullable: true })
  appointmentTime: string;

  @Column({ name: 'detail', type: 'text', nullable: true })
  detail: string;

  @Column({ name: 'status', default: 'pending' })
  status: string;
}
