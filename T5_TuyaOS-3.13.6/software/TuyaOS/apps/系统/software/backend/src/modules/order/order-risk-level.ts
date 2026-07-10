import { Logger } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { Order } from '../../entities/order.entity.js';

export const ORDER_RISK_LEVELS = ['L1', 'L2'] as const;
export type OrderRiskLevel = (typeof ORDER_RISK_LEVELS)[number];

export const ORDER_RISK_LEVEL_LABELS: Record<OrderRiskLevel, string> = {
  L1: 'L1低风险',
  L2: 'L2中风险',
};

/** 导诊写入的 R0–R3（非 L1/L2 口径）在订单详情中的展示 */
const TRIAGE_RISK_LABELS: Record<string, string> = {
  R0: 'R0 普通关注',
  R1: 'R1 需关注',
  R2: 'R2 较高关注',
  R3: 'R3 高风险（建议人工）',
};

/** 供陪诊员/后台展示：兼容 L1/L2 与导诊 R 等级 */
export function displayOrderRiskLabel(raw?: string | null): string | null {
  const s = String(raw || '').trim();
  if (!s) return null;
  const l12 = normalizeOrderRiskLevel(s);
  if (l12) return ORDER_RISK_LEVEL_LABELS[l12];
  const up = s.toUpperCase();
  if (TRIAGE_RISK_LABELS[up]) return TRIAGE_RISK_LABELS[up];
  return s;
}

export function normalizeOrderRiskLevel(value?: string | null): OrderRiskLevel | null {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;
  return (ORDER_RISK_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as OrderRiskLevel)
    : null;
}

export async function ensureOrderRiskLevelColumn(
  orderRepository: Repository<Order>,
  logger?: Logger,
): Promise<boolean> {
  const existing = await orderRepository.query(
    "SHOW COLUMNS FROM `orders` LIKE 'risk_level'",
  );
  if (Array.isArray(existing) && existing.length > 0) {
    return true;
  }

  try {
    await orderRepository.query(
      "ALTER TABLE `orders` ADD COLUMN `risk_level` varchar(16) NULL COMMENT '陪诊风险等级（内部）'",
    );
    logger?.log('已自动补齐 orders.risk_level 字段');
    return true;
  } catch (error: any) {
    const message = String(error?.message || error || '');
    if (message.includes('Duplicate column name')) {
      return true;
    }
    logger?.warn(`自动创建 orders.risk_level 字段失败: ${message}`);
    return false;
  }
}
