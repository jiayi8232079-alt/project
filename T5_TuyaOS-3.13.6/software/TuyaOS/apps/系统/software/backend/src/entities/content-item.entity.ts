import { Column, Entity, Index } from 'typeorm';
import { TenantAwareEntity } from '../common/entities/tenant-aware.entity.js';

/**
 * 内容生态点播条目（对齐 V4.3 §5.10 / §12.2 内容包）。
 * 分类：xiqu 戏曲 / pingshu 评书 / song 老歌 / news 新闻 / health 健康科普 / drama 广播剧 / story 故事。
 */
@Entity('content_items')
@Index(['category', 'active'])
export class ContentItem extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 32 })
  category: string;

  @Column({ type: 'varchar', length: 128 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  duration: string | null;

  @Column({ name: 'audio_url', type: 'varchar', length: 512, nullable: true })
  audioUrl: string | null;

  @Column({ name: 'cover_url', type: 'varchar', length: 512, nullable: true })
  coverUrl: string | null;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'sort_weight', type: 'int', default: 0 })
  sortWeight: number;
}
