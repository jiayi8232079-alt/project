import { get } from './request';

const CACHE_TTL = 5 * 60 * 1000; // 5 分钟缓存

type CustomerServiceConfig = {
  url: string;
  corpId: string;
};

let cachedConfig: CustomerServiceConfig | null = null;
let cacheTime = 0;
let pendingRequest: Promise<CustomerServiceConfig> | null = null;

function isConfigReady(config: Partial<CustomerServiceConfig> | null | undefined): config is CustomerServiceConfig {
  return Boolean(config?.url?.trim() && config?.corpId?.trim());
}

function getCachedConfig(): CustomerServiceConfig | null {
  if (
    cachedConfig
    && isConfigReady(cachedConfig)
    && Date.now() - cacheTime < CACHE_TTL
  ) {
    return cachedConfig;
  }
  return null;
}

function setCachedConfig(config: Partial<CustomerServiceConfig>) {
  cachedConfig = {
    url: typeof config?.url === 'string' ? config.url.trim() : '',
    corpId: typeof config?.corpId === 'string' ? config.corpId.trim() : '',
  };
  cacheTime = Date.now();
  return cachedConfig;
}

/**
 * 预加载企业微信客服配置（带缓存）
 */
export async function preloadCustomerServiceConfig(): Promise<CustomerServiceConfig> {
  const cached = getCachedConfig();
  if (cached) {
    return cached;
  }
  if (pendingRequest) {
    return pendingRequest;
  }
  pendingRequest = get<Partial<CustomerServiceConfig>>('/system/config/public/customer-service-url')
    .then((res) => {
      if (isConfigReady(res)) {
        return setCachedConfig(res);
      }
      return {
        url: typeof res?.url === 'string' ? res.url.trim() : '',
        corpId: typeof res?.corpId === 'string' ? res.corpId.trim() : '',
      };
    })
    .finally(() => {
      pendingRequest = null;
    }) as Promise<CustomerServiceConfig>;
  return pendingRequest;
}

function showUnsupportedTip() {
  wx.showModal({
    title: '暂不支持打开',
    content: '当前微信版本或运行环境暂不支持打开微信客服，请升级微信后重试。',
    showCancel: false,
  });
}

function openCustomerServiceChat(config: CustomerServiceConfig) {
  const canUse =
    typeof (wx as any).openCustomerServiceChat === 'function'
    && (!wx.canIUse || wx.canIUse('openCustomerServiceChat'));

  if (!canUse) {
    showUnsupportedTip();
    return;
  }

  (wx as any).openCustomerServiceChat({
    extInfo: { url: config.url },
    corpId: config.corpId,
    success() {},
    fail(err: any) {
      const errMsg = String(err?.errMsg || '');
      if (errMsg.includes('cancel')) return;
      console.error('打开微信客服失败', err);
      showUnsupportedTip();
    },
  });
}

/**
 * 打开企业微信客服会话
 */
export async function goToCustomerService(): Promise<void> {
  let config = getCachedConfig();
  try {
    if (!config) {
      config = await preloadCustomerServiceConfig();
    }
  } catch (err) {
    console.error('加载客服配置失败', err);
    return;
  }
  if (!config.url || !config.corpId) {
    wx.showToast({
      title: '客服未配置完整，请联系管理员',
      icon: 'none',
    });
    return;
  }
  openCustomerServiceChat(config);
}
