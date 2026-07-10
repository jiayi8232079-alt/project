import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';
import { ReminderSeverity } from './medication-reminder.entity.js';

/**
 * 药品常用库。
 *
 * 作用：
 *  - 陪诊员 / 运营录入处方时药名联想（避免"波立维"与"氯吡格雷"录入不一致）；
 *  - 自动带出默认严重度、默认每日频次、默认每次用量和单位，降低错误率；
 *  - 高警戒药（抗凝 / 精神 / 降糖胰岛素 / 抗癫痫）可挂告警关键词，
 *    后续可挂钩 DrugInteractionModule 做联合用药告警。
 *
 * 该表是"字典表"，初始数据由运营在后台维护，不参与业务流转。
 */
@Entity('medicine_catalog')
@Index(['name'], { unique: false })
@Index(['severity'])
export class MedicineCatalog extends BaseEntity {
  @Column({ type: 'varchar', length: 128, comment: '药品主名（商品名）' })
  name: string;

  @Column({
    name: 'generic_name',
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '通用名/学名',
  })
  genericName: string | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    comment: '常见规格，如 75mg × 7 片/盒',
  })
  specification: string | null;

  @Column({
    type: 'enum',
    enum: ReminderSeverity,
    default: ReminderSeverity.MEDIUM,
    comment: '默认严重度建议',
  })
  severity: ReminderSeverity;

  @Column({
    type: 'varchar',
    length: 64,
    nullable: true,
    comment: '分类：抗凝/降压/抗抑郁/维生素/抗生素 等',
  })
  category: string | null;

  @Column({
    name: 'default_times_per_day',
    type: 'tinyint',
    nullable: true,
    comment: '默认每日频次',
  })
  defaultTimesPerDay: number | null;

  @Column({
    name: 'default_dose_per_time',
    type: 'decimal',
    precision: 6,
    scale: 2,
    nullable: true,
    comment: '默认每次用量',
  })
  defaultDosePerTime: number | null;

  @Column({
    name: 'default_unit',
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: '默认单位：片/粒/ml/支/瓶',
  })
  defaultUnit: string | null;

  @Column({
    name: 'default_instructions',
    type: 'varchar',
    length: 255,
    nullable: true,
    comment: '默认用药说明：如"餐后服用"',
  })
  defaultInstructions: string | null;

  @Column({
    name: 'warning_keywords',
    type: 'simple-json',
    nullable: true,
    comment:
      '预警关键词列表，录入/推送时若命中则弹出风险提示，如 ["与阿司匹林合用", "避免抓伤"]',
  })
  warningKeywords: string[] | null;

  @Column({
    type: 'tinyint',
    default: 1,
    comment: '是否启用（1 启用，0 停用）',
  })
  enabled: number;
}
