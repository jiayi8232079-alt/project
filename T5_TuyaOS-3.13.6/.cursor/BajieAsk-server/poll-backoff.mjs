/**
 * 自适应轮询退避（adaptive poll backoff）· BajieAsk
 *
 * 背景：wait_message 的 inbox 轮询原本固定 POLL_INTERVAL_MS（默认 2000ms）。
 * 用户在 AI 刚回复后立刻输入时，最坏要等满一个轮询周期（~2s）才被 dequeueFirst 取走，
 * 多 agent 协作时逐跳叠加放大。
 *
 * 方案：每次进入 wait 时先用较短的 floorMs 间隔快速捕获消息，随后按 factor 指数退避，
 * 封顶到 ceilMs（= 原 POLL_INTERVAL_MS）。语义关键点：
 *   - 每次 wait_message 调用都新建一个 wait loop，pollInterval 自然从 floor 重新起步，
 *     因此"AI 回复后用户马上输入"这一高频场景能在 ~floorMs 内被取走。
 *   - 长时间空闲时间隔退避到 ceilMs，稳态与原实现完全一致，不增加 999 路并发稳态下的
 *     statSync 压力；快轮询窗口仅存在于每次 wait 起始的前 ~1-2s。
 *
 * 纯函数 + 无副作用，便于单测（见 poll-backoff.test.mjs），不依赖 index.mjs 的启动副作用。
 */

const DEFAULT_FLOOR_MS = 150;
const DEFAULT_CEIL_MS = 2000;
const DEFAULT_FACTOR = 1.5;
const MAX_FACTOR = 4;

/**
 * 构造一个退避器。
 * @param {{ floorMs?: number, ceilMs?: number, factor?: number }} [opts]
 * @returns {{ floorMs: number, ceilMs: number, factor: number, next: (prev: number) => number }}
 */
export function makePollBackoff(opts = {}) {
  const ceil = Number.isFinite(opts.ceilMs) && opts.ceilMs > 0
    ? Math.floor(opts.ceilMs)
    : DEFAULT_CEIL_MS;
  const floorRaw = Number.isFinite(opts.floorMs) && opts.floorMs > 0
    ? Math.floor(opts.floorMs)
    : DEFAULT_FLOOR_MS;
  const floor = Math.max(1, Math.min(floorRaw, ceil));
  const factor = Number.isFinite(opts.factor) && opts.factor > 1
    ? Math.min(opts.factor, MAX_FACTOR)
    : DEFAULT_FACTOR;

  /**
   * 给定上一次轮询间隔，返回下一次间隔（指数退避，封顶 ceilMs）。
   * prev 非法 / <=0 → 返回 floor，作为每次 wait 的起始间隔。
   */
  function next(prev) {
    if (!Number.isFinite(prev) || prev <= 0) return floor;
    return Math.min(ceil, Math.ceil(prev * factor));
  }

  return { floorMs: floor, ceilMs: ceil, factor, next };
}

/**
 * 从环境变量解析退避器。ceilMs 优先取显式入参（复用 index.mjs 已算好的
 * POLL_INTERVAL_MS），否则回退到 BAJIE_POLL_INTERVAL_MS env。
 * @param {Record<string, string|undefined>} [env]
 * @param {number} [ceilMs]
 */
export function resolvePollBackoffFromEnv(env = process.env, ceilMs) {
  const ceil = Number.isFinite(ceilMs) && ceilMs > 0
    ? ceilMs
    : Math.max(200, Math.min(10000, parseInt(env.BAJIE_POLL_INTERVAL_MS, 10) || DEFAULT_CEIL_MS));
  const floor = parseInt(env.BAJIE_POLL_MIN_INTERVAL_MS, 10) || DEFAULT_FLOOR_MS;
  const factor = parseFloat(env.BAJIE_POLL_BACKOFF_FACTOR) || DEFAULT_FACTOR;
  return makePollBackoff({ floorMs: floor, ceilMs: ceil, factor });
}
