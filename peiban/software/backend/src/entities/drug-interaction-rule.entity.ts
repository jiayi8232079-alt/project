import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity.js';

export enum DrugInteractionSeverity {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 药物相互作用规则（内置知识库 + 可由运营在后台补充）。
 *
 * 匹配策略：
 *   - drugAAliases / drugBAliases 中的任一别名（大小写/中英文/通用名/商品名）
 *     在处方药品名中命中即算命中（A、B 顺序无关）。
 *   - 规则只用作"高置信度的硬规则过滤"；其余细粒度相互作用交给 LLM。
 *
 * 证据等级：
 *   - A：权威指南/说明书明确列为禁忌或严重警告
 *   - B：文献一致推荐避免联用
 *   - C：存在风险但证据一般
 */
@Entity('drug_interaction_rules')
@Index(['severity'])
@Index(['enabled'])
export class DrugInteractionRule extends BaseEntity {
  @Column({ name: 'drug_a', type: 'varchar', length: 64, comment: '药物A（通用名）' })
  drugA: string;

  @Column({ name: 'drug_b', type: 'varchar', length: 64, comment: '药物B（通用名）' })
  drugB: string;

  @Column({
    name: 'drug_a_aliases',
    type: 'simple-json',
    comment: '药物A别名列表（商品名、英文名、中文俗称等）',
  })
  drugAAliases: string[];

  @Column({
    name: 'drug_b_aliases',
    type: 'simple-json',
    comment: '药物B别名列表',
  })
  drugBAliases: string[];

  @Column({
    type: 'enum',
    enum: DrugInteractionSeverity,
    default: DrugInteractionSeverity.MEDIUM,
  })
  severity: DrugInteractionSeverity;

  @Column({ type: 'text', comment: '相互作用机制（通俗描述给家属看）' })
  mechanism: string;

  @Column({ type: 'text', comment: '处理建议（告知家属如何应对）' })
  recommendation: string;

  @Column({
    name: 'evidence_level',
    type: 'varchar',
    length: 8,
    nullable: true,
    comment: '证据等级 A/B/C',
  })
  evidenceLevel: 'A' | 'B' | 'C' | null;

  @Column({ type: 'boolean', default: true, comment: '是否启用' })
  enabled: boolean;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'builtin',
    comment: '来源：builtin（内置）/custom（运营添加）',
  })
  source: 'builtin' | 'custom';
}
