/**
 * 慧诊通 — 红旗规则引擎
 *
 * 规则优先级高于 LLM：一旦命中红旗，直接 R3 + 转人工，
 * 禁止输出"可继续观察"类建议。
 */

export interface RedFlagResult {
  hit: boolean;
  riskLevel: 'R0' | 'R1' | 'R2' | 'R3';
  matchedRules: string[];
  urgencyLevel: string;
  escalateToHuman: boolean;
  /** 命中红旗时的固定安全回复 */
  safeReplyOverride?: string;
}

interface RuleInput {
  mainSymptom: string;
  patientAge: number;
  severitySelf?: string;
  medicalHistory?: string[];
  mobility?: string;
  recentlyDischarged?: boolean;
  visitGoal?: string;
}

// ─── 红旗关键词 ──────────────────────────────────────────

const RED_FLAG_PATTERNS: Array<{ keywords: string[]; rule: string }> = [
  {
    keywords: ['胸痛', '胸闷', '心绞痛', '心梗', '心肌梗', '胸口疼', '胸口痛', '心脏疼', '心脏痛', '压榨感'],
    rule: '持续或加重的胸痛',
  },
  {
    keywords: ['呼吸困难', '喘不上气', '喘不过气', '呼吸急促', '憋气', '窒息', '透不过气'],
    rule: '明显呼吸困难',
  },
  {
    keywords: ['昏迷', '意识不清', '意识模糊', '叫不醒', '失去意识', '神志不清', '晕厥', '晕倒'],
    rule: '昏迷/意识异常',
  },
  {
    keywords: ['半身不遂', '偏瘫', '一侧无力', '单侧无力', '口歪', '嘴歪', '说话不清', '言语不清', '中风', '卒中'],
    rule: '单侧肢体无力/疑似卒中',
  },
  {
    keywords: ['大量出血', '止不住血', '吐血', '咯血', '便血', '血崩', '大出血'],
    rule: '大量出血',
  },
  {
    keywords: ['高热', '高烧', '39度', '40度', '41度', '持续发烧', '精神差', '精神萎靡'],
    rule: '高热伴精神差',
  },
  {
    keywords: ['伤口感染', '伤口化脓', '伤口裂开', '术后异常', '刀口红肿', '伤口发黑'],
    rule: '术后伤口明显异常',
  },
  {
    keywords: ['跌倒', '摔倒', '摔伤', '骨折', '不能动'],
    rule: '老年人跌倒伴持续不适',
  },
  {
    keywords: ['低血糖', '高血糖', '血糖很低', '血糖很高', '糖尿病昏迷', '酮症'],
    rule: '严重低血糖/高血糖表现',
  },
];

// ─── 复杂场景规则（→ R2） ─────────────────────────────────

function checkComplexRules(input: RuleInput): string[] {
  const hits: string[] = [];
  const symptomLower = input.mainSymptom.toLowerCase();

  // 疑难病 / 肿瘤关键词
  const complexKeywords = ['肿瘤', '癌', '恶性', '转移', '化疗', '放疗', '疑难', '罕见病'];
  if (complexKeywords.some((k) => symptomLower.includes(k))) {
    hits.push('疑难病/肿瘤相关');
  }

  // 拟住院 / 手术
  if (input.visitGoal === 'inpatient' || ['手术', '住院', '开刀'].some((k) => symptomLower.includes(k))) {
    hits.push('拟住院/手术');
  }

  // 高龄 + 行动不便 + 家属异地 → 复杂协调
  if (input.patientAge >= 75 && input.mobility === 'limited') {
    hits.push('高龄行动不便');
  }

  // 近期出院 + 症状
  if (input.recentlyDischarged) {
    hits.push('近期出院伴症状');
  }

  // 多种慢病合并
  if (input.medicalHistory && input.medicalHistory.length >= 3) {
    hits.push('多种慢病合并');
  }

  return hits;
}

// ─── 主入口 ──────────────────────────────────────────────

export function evaluateRedFlags(input: RuleInput): RedFlagResult {
  const symptomText = input.mainSymptom || '';
  const matchedR3: string[] = [];

  // 1. 红旗关键词匹配 → R3
  for (const pattern of RED_FLAG_PATTERNS) {
    if (pattern.keywords.some((kw) => symptomText.includes(kw))) {
      matchedR3.push(pattern.rule);
    }
  }

  // 高龄 + 跌倒特殊处理
  if (input.patientAge >= 65 && matchedR3.includes('老年人跌倒伴持续不适')) {
    // 已命中，保持
  }

  // 自评严重 + 高龄 → 升级
  if (input.severitySelf === 'severe' && input.patientAge >= 70 && matchedR3.length === 0) {
    matchedR3.push('高龄自评严重');
  }

  if (matchedR3.length > 0) {
    return {
      hit: true,
      riskLevel: 'R3',
      matchedRules: matchedR3,
      urgencyLevel: '建议立即线下就医',
      escalateToHuman: true,
      safeReplyOverride:
        '根据您提供的信息，检测到可能存在紧急健康风险。请尽快前往最近的医疗机构就诊，或拨打 120 急救电话。我们的健康管家将优先与您联系，协助安排后续服务。',
    };
  }

  // 2. 复杂场景 → R2
  const complexHits = checkComplexRules(input);
  if (complexHits.length > 0) {
    return {
      hit: true,
      riskLevel: 'R2',
      matchedRules: complexHits,
      urgencyLevel: '尽快',
      escalateToHuman: true,
    };
  }

  // 3. 无命中 → 交给 LLM
  return {
    hit: false,
    riskLevel: 'R0',
    matchedRules: [],
    urgencyLevel: '普通',
    escalateToHuman: false,
  };
}
