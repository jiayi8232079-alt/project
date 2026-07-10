import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * 小程序码 scene 最长 32 字符，无法直接携带分享 token；
 * 存短码映射到订单公开访问 token，供管理端生成 getwxacodeunlimit。
 */
@Entity('mp_monitor_scenes')
export class MpMonitorScene {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  code!: string;

  @Index()
  @Column({ name: 'order_id' })
  orderId!: number;

  @Column({ type: 'text' })
  token!: string;

  /** timeline = 服务动态公开页, sign = 签署确认单 */
  @Column({ name: 'scene_type', type: 'varchar', length: 16, default: 'timeline' })
  sceneType!: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
