"use strict";
/**
 * force-offline-reconnect:「手动强制离线」会话被新连接重新接入时的「重连自愈」裁决（纯逻辑）。
 *
 * 背景（2026-06 修复「重连即被踢」死循环）：
 *   meta.json 的 forceOffline:true（手动）一旦写入，原本仅在两处清除——
 *     (1) MCP wait_message 短路里原 AI 走完 §3 到 agentStatus==="session_ended"；
 *     (2) extension 侧点「启动会话」按钮 launchNewChat，或轮询检测到新鲜心跳自愈。
 *   但「用户手动停 composer（AI 没走完 §3）+ 用原生 composer 直连 MCP」这条路径绕过了二者，
 *   且手动强制离线会停写心跳，导致 extension 的「新鲜心跳自愈」永远触发不了，标志永久残留，
 *   每次新连接进 wait_message 都被反复踢下线。
 *
 * 本裁决补上 MCP 侧「全新连接重新接入」的自愈口径：命中 manual forceOffline 时，
 *   - 跨进程残留：forceOfflineAt 早于本 MCP 进程启动时间 → 必是上次进程的残留标志 → 本次是重连；
 *   - 同进程新接入：本进程已对该 sid 派发过结束指令、又收到「非 session_ended」的新 wait →
 *       说明原 AI 已走/被停，这是新 composer 接入（区别于原 AI 自己走结束握手的 session_ended wait）。
 *   两者任一成立即「自愈」：清除强制离线、放行到正常状态机，回到纯净等待。
 *
 * 不自愈（维持原结束流程）的场景：
 *   - 非手动（auto 误标）→ 交还消费侧「在线心跳」逻辑，不归本裁决；
 *   - 正常首次强制离线活跃 AI（本进程未派发过、非 session_ended）→ 照常踢下线、派发结束指令；
 *   - 原 AI 走结束握手回来的 session_ended wait → 交还 ACK 收尾分支清除标志。
 *
 * ⚠️ 同步约定：mcp-server/index.mjs wait_message 强制离线短路直接 import 本函数，
 *   修改裁决口径时本文件与 force-offline-reconnect.test.mjs 同步更新即可。
 *
 * @param {object}  p
 * @param {boolean} p.manual            是否手动强制离线（forceOffline===true / per-poller pid 命中）
 * @param {string}  p.agentStatus       本次 wait_message 传入的 agentStatus
 * @param {number}  p.forceOfflineAtMs  forceOfflineAt 解析为毫秒（NaN 表示缺失/不可解析）
 * @param {number}  p.serverStartMs     本 MCP server 进程启动时间（毫秒）
 * @param {boolean} p.dispatchedBefore  本进程是否已对该 sid 派发过 force_offline 结束指令
 * @returns {boolean}                   true=自愈放行；false=维持原结束逻辑
 */
export function shouldSelfHealForceOffline({
  manual,
  agentStatus,
  forceOfflineAtMs,
  serverStartMs,
  dispatchedBefore,
} = {}) {
  if (!manual) return false;
  // 跨进程残留：强制离线发生在本进程启动之前 → 上次进程残留 → 本次是重连接入。
  if (
    Number.isFinite(forceOfflineAtMs) &&
    Number.isFinite(serverStartMs) &&
    forceOfflineAtMs < serverStartMs
  ) {
    return true;
  }
  // 同进程新接入：本进程已踢过原 AI，又收到非结束态新 wait → 新 composer 接入。
  if (agentStatus !== "session_ended" && dispatchedBefore === true) {
    return true;
  }
  return false;
}

/**
 * 强制离线结束裁决：wait_message 命中「手动强制离线」时，决定返回 ACK 收尾还是派发结束指令。
 *   - agentStatus === "session_ended"：AI 已按 §3 走到收尾的 wait → "ack"（清标志 + 返回确认）；
 *   - 其它（活跃态 / 缺省）：→ "dispatch"（返回模仿用户「结束」的 force_offline USER_MSG，引导 AI 走 §3）。
 * 供 wait_message 入口短路与 waitForSessionMessage 轮询中途命中两处共用，保证两路口径一致。
 *
 * @param {object} p
 * @param {string} p.agentStatus  本次 wait_message 传入的 agentStatus
 * @returns {"ack"|"dispatch"}
 */
export function forceOfflineEndDecision({ agentStatus } = {}) {
  return agentStatus === "session_ended" ? "ack" : "dispatch";
}
