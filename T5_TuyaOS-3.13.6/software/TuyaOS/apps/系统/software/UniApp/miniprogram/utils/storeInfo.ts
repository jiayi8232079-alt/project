import { get } from './request';

export interface StoreInfo {
  name: string;
  phone: string;
  address: string;
  hours: string;
  wechat: string;
  latitude: string;
  longitude: string;
  description: string;
  logo?: string;
}

const CACHE_TTL = 5 * 60 * 1000;
let cached: StoreInfo | null = null;
let cacheTime = 0;

function createEmptyStoreInfo(): StoreInfo {
  return {
    name: '',
    phone: '',
    address: '',
    hours: '',
    wechat: '',
    latitude: '',
    longitude: '',
    description: '',
    logo: '',
  };
}

export async function getStoreInfo(forceRefresh = false): Promise<StoreInfo> {
  if (!forceRefresh && cached && Date.now() - cacheTime < CACHE_TTL) {
    return cached;
  }
  try {
    const res = await get<StoreInfo>('/system/config/public/store-info');
    cached = res || createEmptyStoreInfo();
    cacheTime = Date.now();
    return cached;
  } catch {
    return createEmptyStoreInfo();
  }
}

export async function callStore(forceRefresh = false): Promise<void> {
  const info = await getStoreInfo(forceRefresh);
  if (!info.phone) {
    wx.showToast({ title: '门店电话未配置，请联系管理员', icon: 'none' });
    return;
  }
  wx.makePhoneCall({
    phoneNumber: info.phone.replace(/[^0-9+\-]/g, ''),
    fail: () => {},
  });
}

export async function showStoreActions(): Promise<void> {
  const info = await getStoreInfo();
  const items: string[] = [];
  const actions: (() => void)[] = [];

  if (info.phone) {
    items.push(`拨打电话 ${info.phone}`);
    actions.push(() => {
      wx.makePhoneCall({ phoneNumber: info.phone.replace(/[^0-9+\-]/g, ''), fail: () => {} });
    });
  }

  if (info.address && info.latitude && info.longitude) {
    items.push('导航到门店');
    actions.push(() => {
      wx.openLocation({
        latitude: parseFloat(info.latitude),
        longitude: parseFloat(info.longitude),
        name: info.name || '陪了个伴',
        address: info.address,
        scale: 18,
      });
    });
  } else if (info.address) {
    items.push(`查看地址：${info.address}`);
    actions.push(() => {
      wx.setClipboardData({
        data: info.address,
        success: () => wx.showToast({ title: '地址已复制', icon: 'success' }),
      });
    });
  }

  if (info.wechat) {
    items.push(`复制微信号 ${info.wechat}`);
    actions.push(() => {
      wx.setClipboardData({
        data: info.wechat,
        success: () => wx.showToast({ title: '微信号已复制', icon: 'success' }),
      });
    });
  }

  if (items.length === 0) {
    wx.showToast({ title: '门店信息未配置', icon: 'none' });
    return;
  }

  wx.showActionSheet({
    itemList: items,
    success: (res) => {
      actions[res.tapIndex]?.();
    },
  });
}
