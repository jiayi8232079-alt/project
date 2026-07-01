"use strict";
/**
 * dispatch-online-check：任务派发前的「目标会话是否离线」纯判定。
 *
 * 背景（2026-06-13 用户需求 · 选项A）：
 *   send_to_session 原先只在 ACK 协议分支（senderIsCtrl + type=task + requireAck===true）
 *   做离线检查；不带 requireAck 的 fire-and-forget 派发会跳过检查，把任务直接写进离线会话
 *   inbox。本模块把离线判定抽成纯函数，供 index.mjs 对「所有 type=task 派发」统一前置拦截，
 *   并被单测覆盖（dispatch-online-check.test.mjs）。
 *
 * 判定口径与原内联逻辑一致：读心跳 heartbeat.json 的 timestamp，距 now 超过 ghostMs（默认
 * 200s 幽灵窗）或无心跳 / 不可解析 → 判离线。未来时间（age 为负）视为在线，避免时钟漂移误杀。
 *
 * ⚠️ 同步约定：阈值或口径调整时，本文件与 dispatch-online-check.test.mjs 同步更新。
 *
 * @param {{timestamp?: string}|null|undefined} heartbeat  已读出的心跳对象（readJSON 结果）
 * @param {number} [nowMs=Date.now()]                       当前时间（毫秒）
 * @param {number} [ghostMs=DISPATCH_GHOST_MS]              幽灵窗阈值（毫秒）
 * @returns {boolean}                                       true=判离线（应拒绝派发）
 */
export const DISPATCH_GHOST_MS = 200_000;

export function isDispatchTargetOffline(heartbeat, nowMs = Date.now(), ghostMs = DISPATCH_GHOST_MS) {
  if (!heartbeat || !heartbeat.timestamp) return true;
  const age = nowMs - new Date(heartbeat.timestamp).getTime();
  if (!Number.isFinite(age) || age > ghostMs) return true;
  return false;
}
