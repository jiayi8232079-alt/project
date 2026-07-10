import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';

/**
 * 短信发送状态：
 * - success      : 腾讯云 SendStatusSet[0].Code === 'Ok'
 * - failed       : 腾讯云返回非 Ok（如余额不足、模板不存在等）
 * - rate_limited : 触发「每手机号每日上限」被主动跳过
 * - disabled     : 系统配置里短信总开关关闭
 * - no_phone     : 必要参数不齐（手机号/模板ID/密钥/签名缺失）
 * - error        : SDK 调用异常（网络/参数）
 */
export type SmsSendStatus =
  | 'success'
  | 'failed'
  | 'rate_limited'
  | 'disabled'
  | 'no_phone'
  | 'error';

/**
 * 短信发送日志：
 * - 同时用于「每日频控 count」查询，所以 (phone, created_at, status) 需要索引
 * - 失败/跳过也写一条，便于客服排查「为什么没收到」
 */
@Entity('sms_send_logs')
@Index(['phone', 'createdAt'])
@Index(['status', 'createdAt'])
export class SmsSendLog extends BaseEntity {
  @Column({ length: 20, comment: '接收手机号（大陆 11 位，不含 +86）' })
  phone: string;

  @Column({
    name: 'template_key',
    length: 64,
    comment: '业务模板键：medication_reminder / follow_up_reminder',
  })
  templateKey: string;

  @Column({
    name: 'template_id',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '腾讯云模板 ID（发送时快照，便于日后对账）',
  })
  templateId: string | null;

  @Column({
    type: 'simple-json',
    nullable: true,
    comment: '模板变量（TemplateParamSet）快照',
  })
  params: string[] | null;

  @Column({ length: 32, comment: '发送状态' })
  status: SmsSendStatus;

  @Column({
    name: 'error_message',
    type: 'varchar',
    length: 512,
    nullable: true,
    comment: '错误信息或跳过原因',
  })
  errorMessage: string | null;

  @Column({
    name: 'tencent_serial_no',
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '腾讯云返回的 SerialNo，用于官方后台追查',
  })
  tencentSerialNo: string | null;
}
