import { BASE_URL } from '../config';

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * 401 风暴防抖窗口：N 个并发请求同时收到 401 时，只在第一个里清 token + 弹 toast，
 * 窗口内的其它 401 静默 reject，避免重复 toast 叠加和重复清缓存。
 */
const SESSION_401_LOCK_MS = 3_000;
let session401LockUntil = 0;

interface RequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  data?: any;
  header?: Record<string, string>;
  /** 为 true 时不自动 Toast（由页面自行处理），用于可选能力如 AI 概括 */
  silent?: boolean;
  /** 请求超时毫秒数，默认 30s */
  timeout?: number;
}

function getResponseMessage(res: any, fallback: string) {
  const message = res?.data?.message || res?.data?.error;
  if (Array.isArray(message)) {
    return message[0] || fallback;
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  return fallback;
}

function isLoginRequest(url: string) {
  return /^\/auth\/(wechat-login|admin-login|attendant-login)(\?|$)/.test(url);
}

/**
 * 把 wx.request fail 的 errMsg 映射成对用户更友好的提示。
 * 早期所有 fail 都展示「网络连接失败」，无法区分是超时、域名未配置还是真断网，
 * 这里按 errMsg 关键字粗分，便于线上排查与提示用户。
 */
function describeRequestFail(err: any): string {
  const msg = String(err?.errMsg || '').toLowerCase();
  if (msg.includes('timeout')) return '请求超时，请稍后重试';
  if (msg.includes('domain list') || msg.includes('not in domain')) {
    return '接口域名未配置，请联系开发';
  }
  if (msg.includes('ssl') || msg.includes('cert')) return '安全证书异常';
  if (msg.includes('abort')) return '请求已取消';
  if (msg.includes('interrupt')) return '请求被中断，请重试';
  if (msg.includes('fail')) return '网络异常，请检查网络';
  return '网络连接失败';
}

export function request<T = any>(options: RequestOptions): Promise<T> {
  const silent = !!options.silent;
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token');
    wx.request({
      url: `${BASE_URL}${options.url}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || DEFAULT_TIMEOUT_MS,
      /** 服务端支持 HTTP/2 时可减轻握手与队头阻塞，弱网下略有帮助 */
      enableHttp2: true,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header,
      },
      success(res: any) {
        if (res.statusCode === 401) {
          const message = getResponseMessage(res, '登录已过期');
          const shouldClearSession = !!token && !isLoginRequest(options.url);
          if (shouldClearSession) {
            // 多请求并发同时 401 时，只在锁窗外的第一个里清 token + 弹 toast，
            // 后续 401 静默 reject，避免「登录已失效」连环 toast。
            const now = Date.now();
            if (now > session401LockUntil) {
              session401LockUntil = now + SESSION_401_LOCK_MS;
              wx.removeStorageSync('token');
              wx.removeStorageSync('userInfo');
              if (!silent) {
                wx.showToast({
                  title: '登录已失效，可在「我的」中重新登录',
                  icon: 'none',
                  duration: 2500,
                });
              }
            }
          }
          reject(new Error(message));
          return;
        }
        if (res.statusCode === 403) {
          const msg = res?.data?.message;
          const isForbiddenResource =
            !msg || msg === 'Forbidden resource' || msg === 'Forbidden';
          const displayMsg = isForbiddenResource
            ? '权限不足，请退出后重新登录'
            : msg;
          if (!silent) wx.showToast({ title: displayMsg, icon: 'none' });
          reject(new Error(displayMsg));
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const data = res.data;
          if (data.code !== undefined && data.code !== 0 && data.code !== 200) {
            if (!silent) wx.showToast({ title: data.message || '请求失败', icon: 'none' });
            reject(new Error(data.message));
            return;
          }
          resolve(data.data || data);
        } else {
          const message =
            res?.data?.message ||
            res?.data?.error ||
            `请求失败(${res.statusCode})`;
          if (!silent) wx.showToast({ title: message, icon: 'none' });
          reject(new Error(message));
        }
      },
      fail(err) {
        if (!silent) {
          wx.showToast({ title: describeRequestFail(err), icon: 'none' });
        }
        reject(err);
      },
    });
  });
}

export function get<T = any>(url: string, data?: any, opts?: { silent?: boolean }): Promise<T> {
  return request<T>({ url, method: 'GET', data, silent: opts?.silent });
}

export function post<T = any>(url: string, data?: any, opts?: { silent?: boolean }): Promise<T> {
  return request<T>({ url, method: 'POST', data, silent: opts?.silent });
}

export function put<T = any>(url: string, data?: any, opts?: { silent?: boolean }): Promise<T> {
  return request<T>({ url, method: 'PUT', data, silent: opts?.silent });
}

export function del<T = any>(url: string): Promise<T> {
  return request<T>({ url, method: 'DELETE' });
}

/** 公开接口 PUT：不携带登录态，失败不自动弹 Toast */
export function putPublic<T = any>(url: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method: 'PUT',
      data,
      timeout: DEFAULT_TIMEOUT_MS,
      enableHttp2: true,
      header: { 'Content-Type': 'application/json' },
      success(res: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          if (body.code !== undefined && body.code !== 0 && body.code !== 200) {
            reject(new Error(body.message || '请求失败'));
            return;
          }
          resolve(body.data ?? body);
          return;
        }
        const message =
          res?.data?.message ||
          res?.data?.error ||
          (typeof res?.data === 'string' ? res.data : '') ||
          `请求失败(${res.statusCode})`;
        reject(new Error(String(message).trim() || `请求失败(${res.statusCode})`));
      },
      fail: reject,
    });
  });
}

/** 公开接口 POST：不携带登录态，失败不自动弹 Toast */
export function postPublic<T = any>(url: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method: 'POST',
      data,
      timeout: DEFAULT_TIMEOUT_MS,
      enableHttp2: true,
      header: { 'Content-Type': 'application/json' },
      success(res: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          if (body.code !== undefined && body.code !== 0 && body.code !== 200) {
            reject(new Error(body.message || '请求失败'));
            return;
          }
          resolve(body.data ?? body);
          return;
        }
        const message =
          res?.data?.message ||
          res?.data?.error ||
          (typeof res?.data === 'string' ? res.data : '') ||
          `请求失败(${res.statusCode})`;
        reject(new Error(String(message).trim() || `请求失败(${res.statusCode})`));
      },
      fail: reject,
    });
  });
}

/** 公开接口：不携带登录态，失败不自动弹 Toast（由页面自行处理） */
export function getPublic<T = any>(url: string, data?: any): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${BASE_URL}${url}`,
      method: 'GET',
      data,
      timeout: DEFAULT_TIMEOUT_MS,
      enableHttp2: true,
      header: { 'Content-Type': 'application/json' },
      success(res: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const body = res.data;
          if (body.code !== undefined && body.code !== 0 && body.code !== 200) {
            reject(new Error(body.message || '请求失败'));
            return;
          }
          resolve(body.data ?? body);
          return;
        }
        const message =
          res?.data?.message ||
          res?.data?.error ||
          (typeof res?.data === 'string' ? res.data : '') ||
          `请求失败(${res.statusCode})`;
        reject(new Error(String(message).trim() || `请求失败(${res.statusCode})`));
      },
      fail: reject,
    });
  });
}
