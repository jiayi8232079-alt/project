// 小程序接口环境切换：
//
// 【线上图片不显示常见原因】
//发布/真机与开发者工具不同：1）相对路径 /uploads/... 必须拼成 https 的完整 URL（本工程已用 resolvePublicUrl 处理多处）；
// 2）微信公众平台 → 开发 → 开发管理 → 服务器域名：request、uploadFile、downloadFile 合法域名均须包含你的 API 域名（如 https://api.xxx.com）；
// 3）高德/第三方图片域名也要加入 downloadFile 合法域名；4）业务域名仅支持 https，http 真机常被拦截。
//
// - 'online': 始终走线上，适合正式发布
// - 'local': 开发者工具走 localhost，真机走局域网地址
// - 'lan': 始终走局域网地址
// - 'auto': 开发者工具走 localhost，真机走线上
type ApiMode = 'online' | 'local' | 'lan' | 'auto';

const ONLINE_BASE_URL = 'https://api.qiaoguo.vip';
const LOCAL_BASE_URL = 'http://localhost:3000';
const LAN_BASE_URL = 'http://192.168.10.104:3000';
// 上线发布前保持 'online'；开发阶段临时改 'local' / 'auto' 调试本地后端
//
// 【切线上后卡顿 / 老报「网络连接失败」请逐项排查】
// 1) 微信公众平台 → 服务器域名：request / uploadFile / downloadFile 须含 https://api.qiaoguo.vip（无尾斜杠）
// 2) 真机仅 HTTPS；证书链须完整，勿用自签未信任证书
// 3) 本地 token 对线上无效：清缓存或重新登录，否则大量 401 + Toast 像「整卡」
// 4) RTT：本地几乎 0ms；线上每次请求含 DNS+TLS+往返，体感明显慢于 localhost（不是代码「变慢」）
// 5) 串行：首页/「我的」里 await ensureWechatIdentity('user')；若需换身份会先 wx.login 再 POST /auth/wechat-login，再发业务请求，耗时会叠加
// 6) 微信限制：同时发起的 wx.request 约 10 条上限，超出会排队，弱网下像「整页都在等」
// 7) app.ts 图标字体走 jsdelivr，国内可能慢；已延后加载，长期建议改小程序包内 woff2
const API_MODE: ApiMode = 'local';

function getBaseUrl() {
  const getPlatform = () => {
    try {
      return wx.getSystemInfoSync()?.platform;
    } catch {
      return '';
    }
  };

  if (API_MODE === 'online') return ONLINE_BASE_URL;
  if (API_MODE === 'lan') return LAN_BASE_URL;
  if (API_MODE === 'local') {
    return getPlatform() === 'devtools' ? LOCAL_BASE_URL : LAN_BASE_URL;
  }

  return getPlatform() === 'devtools' ? LOCAL_BASE_URL : ONLINE_BASE_URL;
}

export const BASE_URL = getBaseUrl();
