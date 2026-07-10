import { resolvePublicUrl } from './media-url';

export function getToken(): string {
  return wx.getStorageSync('token') || '';
}

export function setToken(token: string): void {
  wx.setStorageSync('token', token);
}

export function removeToken(): void {
  wx.removeStorageSync('token');
}

export function getUserInfo(): any {
  const info = wx.getStorageSync('userInfo');
  if (!info) return null;
  try {
    const p = JSON.parse(info);
    if (p?.avatarUrl) {
      p.avatarUrl = resolvePublicUrl(p.avatarUrl);
    }
    return p;
  } catch {
    wx.removeStorageSync('userInfo');
    return null;
  }
}

export function setUserInfo(info: any): void {
  if (info && typeof info === 'object') {
    const next = { ...info };
    if (next.avatarUrl) {
      next.avatarUrl = resolvePublicUrl(next.avatarUrl);
    }
    wx.setStorageSync('userInfo', JSON.stringify(next));
    return;
  }
  wx.setStorageSync('userInfo', JSON.stringify(info));
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

/** 是否为被照护老人身份（大字体单屏端） */
export function isElderIdentity(): boolean {
  const info = getUserInfo();
  return !!(info?.isElder);
}

/**
 * 登录 / 身份变化后的统一跳转：
 * - 老人身份 → reLaunch 到 /pages/elder/home/home
 * - 否则 → 返回 false，由调用方自行处理默认跳转
 */
export function redirectByIdentity(): boolean {
  const info = getUserInfo();
  if (info?.isElder) {
    wx.reLaunch({ url: '/pages/elder/home/home' });
    return true;
  }
  return false;
}

