/**
 * web-view 跳转安全守卫。
 *
 * 设计目的：阻止从「分享卡片 / 小程序码 scene / 老的页面拼接」等渠道
 * 把 `?url=https://evil.com/?token=...` 注入到 webview 页面的能力，
 * 防止：
 *   1. 钓鱼跳转（看起来像内部页其实是第三方域名）
 *   2. 通过 URL 携带 token / Authorization / signedToken 等敏感参数被外发
 *
 * 校验规则：
 *   1. 协议必须是 https
 *   2. host 必须命中白名单（公司自有域名 + 已在公众平台 downloadFile 域名清单里的 CDN）
 *   3. 查询串里不允许出现敏感字段名（token / authorization / jwt / sign / openid …）
 *
 * 出现违规时：toast 提示并 navigateBack，绝不向 web-view 输出任何 src。
 */

const ALLOWED_HOSTS = new Set<string>([
  'api.qiaoguo.vip',
  'qiaoguo.vip',
  'www.qiaoguo.vip',
  'qiaoguo-1406464864.cos.ap-shanghai.myqcloud.com',
]);

const FORBIDDEN_QUERY_KEYS = [
  'token',
  'authorization',
  'jwt',
  'sign',
  'signature',
  'openid',
  'session',
  'sessionkey',
];

/** 校验通过返回干净的 URL 字符串，失败返回空串 */
export function sanitizeWebviewUrl(rawUrl: string | undefined | null): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();
  if (!url) return '';

  let parsed: { protocol: string; host: string; search: string };
  try {
    // 简易解析（小程序 runtime 不一定支持 URL 构造，安全起见用正则兜底）
    const match = url.match(/^(https?):\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
    if (!match) return '';
    parsed = { protocol: match[1].toLowerCase(), host: match[2].toLowerCase(), search: match[4] || '' };
  } catch {
    return '';
  }

  if (parsed.protocol !== 'https') return '';
  if (!ALLOWED_HOSTS.has(parsed.host)) return '';

  if (parsed.search) {
    const lowerSearch = parsed.search.toLowerCase();
    for (const key of FORBIDDEN_QUERY_KEYS) {
      // 只匹配 ?key= 或 &key= 的边界，避免误杀 sub_token 之类无关字段
      if (
        lowerSearch.includes(`?${key}=`) ||
        lowerSearch.includes(`&${key}=`) ||
        lowerSearch.includes(`?${key}&`) ||
        lowerSearch.includes(`&${key}&`) ||
        lowerSearch.endsWith(`?${key}`) ||
        lowerSearch.endsWith(`&${key}`)
      ) {
        return '';
      }
    }
  }

  return url;
}

/** 把校验失败的反馈集中处理：toast 一次 + 自动返回上一页 */
export function showWebviewBlockedToast() {
  if (typeof wx === 'undefined') return;
  wx.showToast({
    title: '链接来源不安全，已拦截',
    icon: 'none',
    duration: 2000,
  });
  setTimeout(() => {
    try {
      wx.navigateBack();
    } catch {
      // 忽略退栈失败（已是首页等场景）
    }
  }, 600);
}
