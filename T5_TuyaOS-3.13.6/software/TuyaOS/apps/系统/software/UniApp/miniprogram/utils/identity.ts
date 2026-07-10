import { BASE_URL } from '../config';
import { post } from './request';
import { getUserInfo, isLoggedIn, setToken, setUserInfo } from './auth';

const DEV_USER_KEY_STORAGE = 'qiaoguo_dev_user_key';
const LOGIN_MODE_STORAGE = 'qiaoguo_login_mode';

export type LoginMode = 'user' | 'attendant';

function getDevUserKey() {
  let key = wx.getStorageSync(DEV_USER_KEY_STORAGE);
  if (key) return key;
  key = `dev_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  wx.setStorageSync(DEV_USER_KEY_STORAGE, key);
  return key;
}

function isLocalApiMode() {
  return /localhost:3000|127\.0\.0\.1:3000|192\.168\.[0-9.]+:3000/.test(BASE_URL);
}

export function getLoginMode(): LoginMode {
  const mode = wx.getStorageSync(LOGIN_MODE_STORAGE);
  return mode === 'attendant' ? 'attendant' : 'user';
}

export function setLoginMode(mode: LoginMode) {
  wx.setStorageSync(LOGIN_MODE_STORAGE, mode);
}

/** 是否已绑定可登录工作台的陪诊员档案（须与后端 attendants 表一致，不能仅凭 users.role 判断） */
export function hasAttendantProfile(userInfo?: any): boolean {
  return !!userInfo?.hasAttendantProfile;
}

async function getWechatCode() {
  if (isLocalApiMode()) {
    return `dev_local_${getDevUserKey()}`;
  }
  try {
    const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
      (resolve, reject) => {
        wx.login({ success: resolve, fail: reject });
      },
    );
    return loginRes.code;
  } catch {
    return `dev_local_${getDevUserKey()}`;
  }
}

export async function switchWechatIdentity(mode: LoginMode) {
  const cached = getUserInfo() || {};
  const code = await getWechatCode();
  const body: Record<string, string> = { code, loginAs: mode };

  if (!isLocalApiMode()) {
    body.devUserKey = getDevUserKey();
  }
  if (cached.nickname) body.nickname = cached.nickname;
  if (cached.avatarUrl) body.avatarUrl = cached.avatarUrl;

  const res: any = await post('/auth/wechat-login', body);
  const mergedUser = {
    ...(res.user || {}),
    nickname: cached.nickname || res.user?.nickname || '',
    avatarUrl: cached.avatarUrl || res.user?.avatarUrl || '',
  };

  setToken(res.token);
  setUserInfo(mergedUser);
  setLoginMode(mode);
  return mergedUser;
}

export async function ensureWechatIdentity(mode: LoginMode) {
  const cached = getUserInfo() || {};
  const currentMode = getLoginMode();
  const currentRole = cached?.role === 'attendant' ? 'attendant' : 'user';

  if (currentMode === mode && currentRole === mode) {
    return cached;
  }

  return switchWechatIdentity(mode);
}

/**
 * 已登录态下校验当前为 C 端用户身份（非陪诊员误闯）。
 * 注意：未登录时仅返回 false，不自动跳转登录页（符合平台「不得强制登录才能浏览」要求）。
 */
export async function ensureUserPageAccess() {
  if (!isLoggedIn()) {
    return false;
  }

  try {
    await ensureWechatIdentity('user');
  } catch (e) {
    console.log('切回用户身份失败', e);
  }

  const userInfo = getUserInfo();
  if (userInfo?.role !== 'attendant') {
    return true;
  }

  wx.showToast({ title: '当前仍是陪诊员身份，请先返回“我的”后重试', icon: 'none' });
  setTimeout(() => {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/mine/mine' });
    }
  }, 500);
  return false;
}

/** 未登录时跳转登录（仅在用户点击「去登录」等明确操作时调用） */
export function navigateToUserLogin() {
  wx.navigateTo({ url: '/pages/login/login' });
}

/** 返回上一页；无栈时回首页，避免困在登录相关页 */
export function navigateBackOrHome() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    wx.navigateBack();
  } else {
    wx.switchTab({ url: '/pages/index/index' });
  }
}

export function ensureAttendantPageAccess() {
  const userInfo = getUserInfo();
  if (userInfo?.role === 'attendant' || isAdminRole(userInfo)) {
    return true;
  }

  wx.showToast({ title: '请使用陪诊员账号进入', icon: 'none' });
  setTimeout(() => {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/mine/mine' });
    }
  }, 500);
  return false;
}

const ADMIN_ROLES = ['admin', 'operator', 'finance', 'customer_service', 'medical_consultant'];

export function isAdminRole(userInfo?: any): boolean {
  const u = userInfo || getUserInfo();
  return ADMIN_ROLES.includes(u?.role);
}

export function ensureAdminPageAccess(): boolean {
  if (!isLoggedIn()) {
    wx.navigateTo({ url: '/pages/login/login' });
    return false;
  }
  const userInfo = getUserInfo();
  if (isAdminRole(userInfo)) {
    return true;
  }
  wx.showToast({ title: '暂无管理员权限', icon: 'none' });
  setTimeout(() => {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/mine/mine' });
    }
  }, 500);
  return false;
}

/**
 * 管理台页面进入时强制刷新 JWT（确保 token 中的角色与数据库一致）。
 * 返回 true=有管理权限可继续，false=无权限已跳转。
 */
export async function ensureAdminPageAccessFresh(): Promise<boolean> {
  if (!isLoggedIn()) {
    wx.navigateTo({ url: '/pages/login/login' });
    return false;
  }
  try {
    // 强制重新登录以获取携带最新角色的 JWT
    const fresh = await switchWechatIdentity('user');
    if (isAdminRole(fresh)) {
      return true;
    }
  } catch (e) {
    console.warn('刷新管理员 token 失败，使用本地缓存', e);
    if (isAdminRole(getUserInfo())) {
      return true;
    }
  }
  wx.showToast({ title: '暂无管理员权限', icon: 'none' });
  setTimeout(() => {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      wx.navigateBack();
    } else {
      wx.switchTab({ url: '/pages/mine/mine' });
    }
  }, 500);
  return false;
}
