import { createHmac, timingSafeEqual } from 'node:crypto';

/** 分享访问有效期（秒），默认 90 天 */
export const ORDER_TIMELINE_SHARE_TTL_SEC = 90 * 24 * 3600;

export function signOrderTimelineShareToken(orderId: number, secret: string): string {
  const exp = Math.floor(Date.now() / 1000) + ORDER_TIMELINE_SHARE_TTL_SEC;
  const payload = `${orderId}|${exp}`;
  const sig = createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}|${sig}`, 'utf8').toString('base64url');
}

export function verifyOrderTimelineShareToken(
  token: string,
  secret: string,
  expectedOrderId: number,
): boolean {
  if (!secret || !token) return false;
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8');
    const parts = raw.split('|');
    if (parts.length !== 3) return false;
    const [oid, exp, sig] = parts;
    if (parseInt(oid, 10) !== expectedOrderId) return false;
    if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) return false;
    const payload = `${oid}|${exp}`;
    const expected = createHmac('sha256', secret).update(payload).digest('hex');
    if (sig.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}
