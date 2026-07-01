/**
 * 会话候选排序与僵尸去重 · BajieAsk
 *
 * 背景：list_sessions(index.mjs) 原先按 listAllSessionMetas() 的 readdirSync
 * 目录顺序返回（字符串序下 "10" < "2"），导致 agent-10~14 槽位恒排在 agent-2~9
 * 之前。主控按 §5.5 Step 2 从列表靠前挑 online 会话 → 分发长期偏向固定的
 * 11/12/13；同一 sessionKey 历史重建遗留的多个 offline 僵尸 sessionId 又进一步
 * 污染候选池。本模块把"排序 + 去重"收敛为纯函数，消除字符串序偏向。
 *
 * 提供：
 *   - sessionDispatchRank：单条会话的派发优先级档位（0 最优 … 3 离线）。
 *   - dedupeSessionsByKey：同 (instanceId, sessionKey) 槽位只留一条（online 优先 / lastSeen 最新）。
 *   - rankSessions：去重后按档位排序、同档按 lastSeen 升序打散
 *     （与 index.mjs _findReplanCandidate 的 lastSeen 升序"最久未活跃优先"对齐）。
 *
 * 纯函数 + 无副作用，便于单测（见 session-rank.test.mjs），不依赖 index.mjs 启动副作用。
 * 仅用于重排 list_sessions 给 AI 的视图：不改 listAllSessionMetas（多处复用、带缓存）、
 * 不改侧栏 UI（直读文件、不经此工具）、不改 _findReplanCandidate（自带排序）。
 */

// online 且"就绪/刚完成可立即接活"的 agentStatus（次优档），与 §5.5 Step 2 次选一致。
const READY_STATUSES = new Set([
  "task_complete",
  "dev_complete",
  "waiting_for_instruction",
  "ready",
]);

function _lastSeenMs(m) {
  if (!m || !m.lastSeen) return 0;
  const t = new Date(m.lastSeen).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * 派发优先级档位（数值越小越靠前）：
 *   0 = online && waiting          —— 正阻塞在 wait_message、可立即派发（最优）
 *   1 = online && READY_STATUSES   —— 刚完成 / 就绪态
 *   2 = online（其它，如 analyzing/developing/testing）
 *   3 = offline                    —— 即便 waiting，离线也垫底（与 ghost 修正一致）
 * @param {object|null|undefined} m 会话 meta
 * @returns {0|1|2|3}
 */
export function sessionDispatchRank(m) {
  if (!m || typeof m !== "object") return 3;
  if (m.online !== true) return 3;
  if (m.waiting === true) return 0;
  if (READY_STATUSES.has(m.agentStatus)) return 1;
  return 2;
}

// 去重时：候选 a 是否比已记录的 b 更值得保留（online 优先，其次 lastSeen 新）。
function _preferSession(a, b) {
  const ao = a.online === true ? 1 : 0;
  const bo = b.online === true ? 1 : 0;
  if (ao !== bo) return ao > bo;
  return _lastSeenMs(a) > _lastSeenMs(b);
}

/**
 * 同一 (instanceId, sessionKey) 槽位只保留一条：online 优先，其次 lastSeen 最新。
 * sessionKey 缺失/空时回退用 `sid::<sessionId>` 作 key（即不与任何其它条目合并，避免误删）。
 * 不修改输入；返回去重后的新数组（顺序为各 key 首次出现序，最终顺序由 rankSessions 决定）。
 * @param {Array<object>} metas
 * @returns {Array<object>}
 */
export function dedupeSessionsByKey(metas) {
  const list = Array.isArray(metas) ? metas : [];
  const best = new Map();
  for (const m of list) {
    if (!m || typeof m !== "object") continue;
    const slot = m.sessionKey ?? m.slot;
    const key = (slot === undefined || slot === null || slot === "")
      ? `sid::${m.sessionId}`
      : `${m.instanceId || ""}::${slot}`;
    const prev = best.get(key);
    if (!prev || _preferSession(m, prev)) best.set(key, m);
  }
  return [...best.values()];
}

/**
 * 去重 + 排序：先 dedupeSessionsByKey，再按 sessionDispatchRank 升序、同档 lastSeen
 * 升序（最久未活跃优先，打散）。不修改输入数组。
 * @param {Array<object>} metas
 * @returns {Array<object>}
 */
export function rankSessions(metas) {
  const deduped = dedupeSessionsByKey(metas);
  deduped.sort((a, b) => {
    const ra = sessionDispatchRank(a);
    const rb = sessionDispatchRank(b);
    if (ra !== rb) return ra - rb;
    return _lastSeenMs(a) - _lastSeenMs(b);
  });
  return deduped;
}
