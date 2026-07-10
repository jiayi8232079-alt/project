/**
 * 陪诊员侧订单风险展示（与后台 displayOrderRiskLabel / L1·L2·R0–R3 对齐）
 */
const L12_LABELS: Record<string, string> = {
  L1: 'L1低风险',
  L2: 'L2中风险',
};

const R_LABELS: Record<string, string> = {
  R0: 'R0 普通关注',
  R1: 'R1 需关注',
  R2: 'R2 较高关注',
  R3: 'R3 高风险（建议人工）',
};

export function attendantOrderRiskLabel(item: {
  riskLevel?: string | null;
  riskLabel?: string | null;
}): string {
  const fromApi = String(item.riskLabel || '').trim();
  if (fromApi) return fromApi;
  const code = String(item.riskLevel || '').trim().toUpperCase();
  if (L12_LABELS[code]) return L12_LABELS[code];
  if (R_LABELS[code]) return R_LABELS[code];
  if (code) return code;
  return '未标注';
}

/** 列表角标配色：high 需留意，calm 一般，mute 未标注 */
export function attendantOrderRiskBadgeClass(item: {
  riskLevel?: string | null;
  riskLabel?: string | null;
}): string {
  const code = String(item.riskLevel || '').trim().toUpperCase();
  if (!code) return 'mute';
  if (code === 'L2' || code === 'R2' || code === 'R3') return 'high';
  if (code === 'L1' || code === 'R0' || code === 'R1') return 'calm';
  return 'mute';
}
