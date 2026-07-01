/**
 * 异常风暴熔断（exception storm circuit breaker）· BajieAsk
 *
 * 背景（macOS 发热根因之一）：mcp-server 的 uncaughtException / unhandledRejection 兜底
 * 选择「记 stderr 后保持存活」以保证单个 handler 的偶发异常不破坏全局会话一致性。但当本进程
 * 沦为孤儿（Cursor 退出/重载/崩溃后被 launchd(PID 1) 收养）且 stdout 管道已断时，任何一次写
 * 协议帧都会抛 EPIPE → 兜底捕获 → 立即重试 → 再抛 …… 形成「写一次崩一次」的紧密死循环，
 * event-loop 空转吃满单核 100% CPU，导致 Mac 持续发热、风扇狂转（侧栏曾观测到 PID 空转 1h+）。
 *
 * 本模块只做一件纯粹的事：在滑动时间窗内统计异常次数，判断是否进入「风暴」。调用方据此决定
 * 是否主动退出进程（process.exit）。保留「偶发单异常不杀进程」的韧性，同时杜绝风暴空转。
 *
 * 纯函数 + 无副作用（不碰 process / 计时器），便于单测（见 exception-storm.test.mjs）。
 */

const DEFAULT_WINDOW_MS = 10_000;
const DEFAULT_MAX = 20;
const MIN_WINDOW_MS = 1_000; // 窗口下限：低于 1s 视为非法，回退默认
const MIN_MAX = 3;           // 阈值下限：< 3 易被偶发异常误熔断，回退默认（防 foot-gun）

/**
 * 构造一个异常风暴跟踪器。
 * @param {{ windowMs?: number, max?: number }} [opts]
 * @returns {{ windowMs: number, max: number, record: (now?: number) => boolean, size: (now?: number) => number, reset: () => void }}
 *   record(now) 记录一次异常并返回 true 表示「已达风暴阈值，应熔断退出」。
 */
export function makeExceptionStormTracker(opts = {}) {
  const windowMs = Number.isFinite(opts.windowMs) && opts.windowMs >= MIN_WINDOW_MS
    ? Math.floor(opts.windowMs)
    : DEFAULT_WINDOW_MS;
  const max = Number.isFinite(opts.max) && opts.max >= MIN_MAX
    ? Math.floor(opts.max)
    : DEFAULT_MAX;

  let times = [];

  function record(now = Date.now()) {
    times.push(now);
    times = times.filter((t) => now - t <= windowMs);
    return times.length >= max;
  }

  function size(now = Date.now()) {
    return times.filter((t) => now - t <= windowMs).length;
  }

  function reset() {
    times = [];
  }

  return { windowMs, max, record, size, reset };
}

/**
 * 从环境变量解析跟踪器。BAJIE_EXC_WINDOW_MS / BAJIE_EXC_MAX 可覆盖默认值；
 * 非法/缺失时回退到安全默认（10s 窗口 / 20 次）。
 * @param {Record<string, string|undefined>} [env]
 */
export function resolveExceptionStormFromEnv(env = process.env) {
  return makeExceptionStormTracker({
    windowMs: parseInt(env.BAJIE_EXC_WINDOW_MS, 10) || DEFAULT_WINDOW_MS,
    max: parseInt(env.BAJIE_EXC_MAX, 10) || DEFAULT_MAX,
  });
}
