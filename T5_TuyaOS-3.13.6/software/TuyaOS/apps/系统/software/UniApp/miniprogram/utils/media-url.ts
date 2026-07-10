import { BASE_URL } from '../config';

/**
 * 微信开发者工具里本地临时图常为 `http://tmp/...`；若被写成 `//tmp/...` 再被当成「省略协议」补成 **https** 会得到 `https://tmp/...`，
 * 解析主机名为 tmp 导致 net::ERR_NAME_NOT_RESOLVED。此类应保持为 **http://tmp/...**（或降级 https→http）。
 */
function normalizeWechatTmpMediaUrl(url: string): string | null {
  if (/^https:\/\/tmp\//i.test(url)) {
    return `http://${url.slice(8)}`;
  }
  if (/^http:\/\/tmp\//i.test(url)) return url;
  if (/^\/\/tmp\//i.test(url)) return `http:${url}`;
  if (/^tmp\//i.test(url)) return `http://${url}`;
  if (/^https:\/\/usr\//i.test(url)) return `http://${url.slice(8)}`;
  if (/^http:\/\/usr\//i.test(url)) return url;
  if (/^\/\/usr\//i.test(url)) return `http:${url}`;
  return null;
}

/**
 * 小程序 <image> / wx.previewImage / downloadFile：
 * - 相对路径 `/uploads/...` 需拼上当前环境的 API 域名，真机与线上包才会请求到正式服务器（开发者工具里 localhost 能显示不代表发布包可以）。
 * - 微信要求业务域名使用 **https**，且域名需在公众平台「开发 → 开发管理 → 服务器域名」中配置：
 *   - request 合法域名、`uploadFile`、`downloadFile` 均需包含 `https://你的 API 域名`（图片若为第三方域名，还要把第三方域名加入 downloadFile）。
 * - `http://` 在真机常被拦截，这里统一尝试升级为 `https://`（若源站不支持 https 需改为可访问的地址）。
 */
export function resolvePublicUrl(url?: string | null): string {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (u.startsWith('wxfile://')) return u;
  const tmpFixed = normalizeWechatTmpMediaUrl(u);
  if (tmpFixed) return tmpFixed;
  if (u.startsWith('//')) {
    const host = (u.slice(2).split('/')[0] || '').toLowerCase();
    const looksLikeRealHost =
      host.includes('.') || host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
    if (!looksLikeRealHost) return '';
    return `https:${u}`;
  }
  if (/^https:\/\//i.test(u)) return u;
  if (/^http:\/\//i.test(u)) {
    return u.replace(/^http:\/\//i, 'https://');
  }
  if (u.startsWith('/')) return `${BASE_URL}${u}`;
  return u;
}
