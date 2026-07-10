import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 机器人自适应人格（对齐 V4.3 §8.4 / §10.5）。
 * 与家庭（可选绑定设备）一一对应；记录昵称、性格风格、语速、口头禅，
 * 以及按成员的自适应人格变量（亲密度/偏好），支持换机迁移。
 */
@Entity('companion_personas')
@Index(['familyId'], { unique: true })
export class CompanionPersona extends TenantAwareEntity {
  @Column({ name: 'family_id', type: 'int' })
  familyId: number;

  @Column({ name: 'device_id', type: 'int', nullable: true })
  deviceId: number | null;

  @Column({ type: 'varchar', length: 64, default: '小伴' })
  nickname: string;

  /** 性格风格：warm（温暖）/ lively（活泼）/ calm（沉稳）等 */
  @Column({ type: 'varchar', length: 32, default: 'warm' })
  personality: string;

  @Column({
    name: 'speech_rate',
    type: 'decimal',
    precision: 3,
    scale: 1,
    default: 1.0,
  })
  speechRate: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  catchphrase: string | null;

  /** 自适应人格变量（如各成员亲密度、偏好），按成员归属隔离展示 */
  @Column({ type: 'json', nullable: true })
  traits: Record<string, unknown> | null;
}
