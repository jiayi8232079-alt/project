import { Injectable } from '@nestjs/common';
import {
  AlertCategory,
  AlertSeverity,
} from '../../entities/health-alert.entity.js';

export interface BuiltInRuleDefinition {
  ruleCode: string;
  name: string;
  category: AlertCategory;
  severity: AlertSeverity;
  description: string;
  condition: Record<string, unknown>;
  cooldownMinutes: number;
  notifyFamily: boolean;
  notifyAdmin: boolean;
}

/**
 * 风险预警内置规则定义（v1）。
 * 规则命中逻辑在 AlertService 中，这里只负责规则参数定义，便于后台统一管理。
 */
export const BUILT_IN_ALERT_RULES: BuiltInRuleDefinition[] = [
  {
    ruleCode: 'medication_miss_rate_low',
    name: '近 7 天漏服率过高',
    category: AlertCategory.MEDICATION_MISS,
    severity: AlertSeverity.MEDIUM,
    description:
      '当服务对象近 7 天用药执行率低于阈值时触发。依赖家属/陪诊员打卡。',
    condition: {
      windowDays: 7,
      minAdherenceRate: 0.7,
      minScheduledCount: 3,
    },
    cooldownMinutes: 1440,
    notifyFamily: true,
    notifyAdmin: true,
  },
  {
    ruleCode: 'follow_up_overdue',
    name: '复诊逾期',
    category: AlertCategory.FOLLOW_UP_OVERDUE,
    severity: AlertSeverity.MEDIUM,
    description: '复诊日期已过且未确认完成，超过 N 天未处理时触发。',
    condition: {
      graceDays: 1,
      maxOverdueDays: 14,
    },
    cooldownMinutes: 1440,
    notifyFamily: true,
    notifyAdmin: true,
  },
  {
    ruleCode: 'timeline_keyword_high_risk',
    name: '服务时间线高危关键词',
    category: AlertCategory.TIMELINE_KEYWORD,
    severity: AlertSeverity.HIGH,
    description:
      '陪诊员上传的文字/节点/录音转写中出现高危关键词（发热/跌倒/呼吸困难/疼痛加剧等）时触发。',
    condition: {
      keywords: [
        '发热',
        '高烧',
        '持续发烧',
        '昏迷',
        '晕倒',
        '跌倒',
        '摔倒',
        '骨折',
        '呼吸困难',
        '胸闷',
        '胸痛',
        '大出血',
        '意识模糊',
        '神志不清',
        '疼痛加剧',
        '剧烈疼痛',
        '抽搐',
        '癫痫',
        '过敏',
        '休克',
      ],
    },
    cooldownMinutes: 60,
    notifyFamily: true,
    notifyAdmin: true,
  },
];

@Injectable()
export class AlertRuleEngine {
  getBuiltInRules(): BuiltInRuleDefinition[] {
    return BUILT_IN_ALERT_RULES;
  }

  getRule(ruleCode: string): BuiltInRuleDefinition | undefined {
    return BUILT_IN_ALERT_RULES.find((r) => r.ruleCode === ruleCode);
  }

  matchKeywords(text: string, keywords: string[]): string[] {
    if (!text) return [];
    const normalized = String(text).toLowerCase();
    const hits: string[] = [];
    for (const kw of keywords) {
      if (normalized.includes(String(kw).toLowerCase())) hits.push(kw);
    }
    return hits;
  }
}
