import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';
import { User } from './user.entity.js';
import { ServiceTarget } from './service-target.entity.js';

@Entity('health_weekly_reports')
export class HealthWeeklyReport extends TenantAwareEntity {
  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'service_target_id', type: 'int', nullable: true })
  serviceTargetId: number | null;

  @ManyToOne(() => ServiceTarget, { nullable: true })
  @JoinColumn({ name: 'service_target_id' })
  serviceTarget: ServiceTarget | null;

  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'week_end', type: 'date' })
  weekEnd: string;

  @Column({ name: 'medication_stats', type: 'json', nullable: true })
  medicationStats: {
    total?: number;
    taken?: number;
    missed?: number;
    adherenceRate?: number;
  } | null;

  @Column({ name: 'health_summary', type: 'text', nullable: true })
  healthSummary: string | null;

  @Column({ name: 'ai_analysis', type: 'json', nullable: true })
  aiAnalysis: Record<string, unknown> | null;

  @Column({ name: 'raw_data', type: 'json', nullable: true })
  rawData: Record<string, unknown> | null;
}
