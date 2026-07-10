import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { DEFAULT_TENANT_ID } from './tenant.entity.js';

/**
 * 管理员操作审计日志
 *
 * 记录后台管理员/陪诊员 Web 端/系统任务产生的敏感或写操作，
 * 便于追溯"谁、在什么时候、通过哪个接口、对什么资源做了什么改动、结果如何"。
 */
@Entity('audit_logs')
@Index(['actorType', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['resourceType', 'resourceId'])
@Index(['tenantId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'tenant_id',
    type: 'int',
    default: DEFAULT_TENANT_ID,
    comment: '所属租户 ID（多租户隔离；跨租户审计另立 platform_audit_logs）',
  })
  tenantId: number;

  /** 操作人类型：admin / attendant / user / system */
  @Column({ name: 'actor_type', type: 'varchar', length: 16, default: 'system' })
  actorType: string;

  /** 操作人 ID（admin_users.id 或 users.id，按 actorType 语义解释） */
  @Column({ name: 'actor_id', type: 'int', nullable: true })
  actorId: number | null;

  /** 操作人名称冗余（便于列表展示，不依赖 join） */
  @Column({ name: 'actor_name', type: 'varchar', length: 128, nullable: true })
  actorName: string | null;

  /** 操作人角色（admin/operator/attendant/user 等） */
  @Column({ name: 'actor_role', type: 'varchar', length: 32, nullable: true })
  actorRole: string | null;

  /** 操作动作标识（如 order.update / admin_user.create / wallet.payout） */
  @Column({ name: 'action', type: 'varchar', length: 128 })
  action: string;

  /** 资源类型（如 order / admin_user / attendant / review） */
  @Column({ name: 'resource_type', type: 'varchar', length: 64, nullable: true })
  resourceType: string | null;

  /** 资源 ID（字符串形式，兼容数字/UUID） */
  @Column({ name: 'resource_id', type: 'varchar', length: 64, nullable: true })
  resourceId: string | null;

  /** HTTP 方法 */
  @Column({ name: 'method', type: 'varchar', length: 16, nullable: true })
  method: string | null;

  /** 请求路径（已脱去查询串） */
  @Column({ name: 'path', type: 'varchar', length: 512, nullable: true })
  path: string | null;

  /** 来源 IP */
  @Column({ name: 'ip', type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  /** User-Agent（截断存储） */
  @Column({ name: 'user_agent', type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  /** HTTP 响应状态码 */
  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  /** 请求摘要（脱敏后的 body/query，json 字符串；超长自动截断） */
  @Column({ name: 'request_summary', type: 'text', nullable: true })
  requestSummary: string | null;

  /** 执行耗时毫秒 */
  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  /** 备注：失败时记录异常信息；其他情况可用于业务补充描述 */
  @Column({ name: 'remark', type: 'varchar', length: 512, nullable: true })
  remark: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
