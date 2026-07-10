/**
 * AI 健康顾问侧红旗词：命中则优先安全提示，避免漏提示急诊风险（规则兜底，不替代医生判断）
 */
export type AdvisorRedFlagResult = {
  hit: boolean;
  level: 'emergency' | 'high' | null;
  matched: string[];
};

const EMERGENCY_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /胸痛|心口疼|胸口闷|心绞痛/i, label: '胸痛/胸闷' },
  { pattern: /喘不上气|呼吸困难|气促|窒息感/i, label: '呼吸困难' },
  { pattern: /意识不清|昏迷|叫不醒|晕过去/i, label: '意识障碍' },
  { pattern: /大量出血|吐血|咯血|便血不止|血流不止/i, label: '大量出血' },
  { pattern: /突发瘫痪|半身不遂|口眼歪斜|说不出话.*(突然)|突发.*言语不清/i, label: '疑似卒中' },
  { pattern: /持续高热|高烧.*(不退|整天)|抽搐|惊厥/i, label: '严重感染或抽搐' },
  { pattern: /严重外伤|车祸|高空坠落/i, label: '严重外伤' },
];

const HIGH_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /剧烈头痛|突然.*头痛欲裂/i, label: '剧烈头痛' },
  { pattern: /腹痛剧烈|肚子痛得受不了/i, label: '剧烈腹痛' },
];

export function evaluateAdvisorRedFlags(userText: string): AdvisorRedFlagResult {
  const t = userText || '';
  const matched: string[] = [];
  let level: 'emergency' | 'high' | null = null;

  for (const { pattern, label } of EMERGENCY_PATTERNS) {
    if (pattern.test(t)) {
      matched.push(label);
      level = 'emergency';
    }
  }
  if (level !== 'emergency') {
    for (const { pattern, label } of HIGH_PATTERNS) {
      if (pattern.test(t)) {
        matched.push(label);
        level = 'high';
      }
    }
  }

  return { hit: matched.length > 0, level, matched: [...new Set(matched)] };
}
