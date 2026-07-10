/**
 * 限并发执行：把 N 个 task 切成最多 limit 条同时进行的「池」。
 *
 * 起因：微信 wx.request 同时最多 10 条；
 * 早期家庭面板/家庭列表/智能分诊页用 `Promise.all(rawList.map(...))`，
 * 当家人数 / 家庭数 ≥ 6 时一次性触发 12+ 条请求，超出限制后排队，弱网下大量
 * 「网络连接失败」。这里把它统一限到 5 条同时跑。
 *
 * 使用：const results = await mapWithConcurrency(items, 5, (item, idx) => doRequest(item));
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Array.isArray(items) || items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let cursor = 0;

  async function pump(): Promise<void> {
    while (cursor < items.length) {
      const myIndex = cursor++;
      try {
        results[myIndex] = await worker(items[myIndex], myIndex);
      } catch (err) {
        // 把单条失败的位置留空（用 undefined as any 占位），由调用方决定如何兜底，
        // 与 Promise.allSettled 不一样的是这里不会重新抛 —— 调用方更关心整体可用。
        results[myIndex] = undefined as unknown as R;
        console.warn('[concurrency] worker failed', err);
      }
    }
  }

  const runners = new Array(safeLimit).fill(0).map(() => pump());
  await Promise.all(runners);
  return results;
}
