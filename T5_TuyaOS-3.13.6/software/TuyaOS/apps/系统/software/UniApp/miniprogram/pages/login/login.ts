import { post, put } from '../../utils/request';
import { setToken, setUserInfo, redirectByIdentity } from '../../utils/auth';
import { navigateBackOrHome, setLoginMode } from '../../utils/identity';
import { BASE_URL } from '../../config';
import { getStoreInfo } from '../../utils/storeInfo';

const DEV_USER_KEY_STORAGE = 'qiaoguo_dev_user_key';

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

Page({
  data: {
    loading: false,
    agreed: false,
    statusBarHeight: 20,
    storeName: '陪了个伴',
    storeDescription: '您的私人健康管家',
    storeLogo: '',
    // 用户填写的昵称和头像（微信新规：需主动授权）
    nicknameTmp: '',
    avatarUrlTmp: '',
    /** 头像与昵称均已填写才可登录 */
    profileReady: false,
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    this.loadStoreBranding();
    this.updateProfileGate();
  },

  /** 审核要求：显著、可取消的返回，不困在登录页 */
  onBackFromLogin() {
    navigateBackOrHome();
  },

  /** 不登录回首页，可继续浏览公开内容 */
  onSkipWithoutLogin() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  async loadStoreBranding() {
    try {
      const info = await getStoreInfo();
      this.setData({
        storeName: info.name || '陪了个伴',
        storeDescription: info.description || '您的私人健康管家',
        storeLogo: info.logo || '',
      });
    } catch (e) {
      console.log('加载门店品牌信息失败', e);
    }
  },

  toggleAgree() {
    this.setData({ agreed: !this.data.agreed });
  },

  /** 仅用于首屏；输入过程请勿对昵称做二次 setData，避免与微信 nickname 键盘冲突闪烁 */
  updateProfileGate() {
    const nick = (this.data.nicknameTmp || '').trim();
    const profileReady = !!this.data.avatarUrlTmp && nick.length > 0;
    if (profileReady !== this.data.profileReady) {
      this.setData({ profileReady });
    }
  },

  // 用户选择头像回调（open-type="chooseAvatar"）
  onChooseAvatar(e: any) {
    const avatarUrl = e.detail?.avatarUrl;
    if (!avatarUrl) return;
    const nick = (this.data.nicknameTmp || '').trim();
    this.setData({
      avatarUrlTmp: avatarUrl,
      profileReady: nick.length > 0,
    });
  },

  /**
   * 昵称：不要绑定 input 的 value。
   * type="nickname" 时 value + 每次 bindinput setData 会强制重绘输入框，导致光标闪烁、文字「跳」。
   * 仅同步内存字段与 profileReady，显示交给原生 input。
   */
  onNicknameInput(e: any) {
    const val = e.detail?.value ?? '';
    const profileReady = !!this.data.avatarUrlTmp && val.trim().length > 0;
    if (profileReady === this.data.profileReady) {
      this.setData({ nicknameTmp: val });
    } else {
      this.setData({ nicknameTmp: val, profileReady });
    }
  },

  onNicknameBlur(e: any) {
    const val = (e.detail?.value ?? '').trim();
    const profileReady = !!this.data.avatarUrlTmp && val.length > 0;
    if (profileReady === this.data.profileReady && val === (this.data.nicknameTmp || '')) {
      return;
    }
    this.setData({
      nicknameTmp: val,
      profileReady,
    });
  },

  async doWechatLogin(
    code: string,
    nicknameTmp: string,
    avatarUrlTmp: string,
    withProfile: boolean,
    withDevUserKey = true,
    phoneCode?: string,
  ) {
    const loginBody: Record<string, string> = { code, loginAs: 'user' };
    if (withDevUserKey) {
      loginBody.devUserKey = getDevUserKey();
    }
    if (withProfile) {
      if (nicknameTmp) loginBody.nickname = nicknameTmp;
      if (avatarUrlTmp) loginBody.avatarUrl = avatarUrlTmp;
    }
    if (phoneCode) loginBody.phoneCode = phoneCode;
    return post('/auth/wechat-login', loginBody);
  },

  /**
   * 登录按钮同时承担两件事：
   * 1. open-type="getPhoneNumber" → 微信弹授权窗 → bindgetphonenumber 触发 onGetPhoneAndLogin（带 code 或 errMsg）
   * 2. bind:tap 兜底：当前小程序基础库不支持 getPhoneNumber / 开发者工具 / 用户拒绝时 → 走旧版 handleLogin（无 phoneCode）
   * 为了避免两个事件重复触发，我们在 onGetPhoneAndLogin 里标记 _phoneCodeHandled，然后 tap 里检测标记跳过。
   */
  _lastPhoneEventAt: 0 as number,

  onLoginBtnTap() {
    // 若 200ms 内刚处理过 getPhoneNumber 事件则跳过（避免重复触发）
    if (Date.now() - this._lastPhoneEventAt < 300) return;
    // 走无手机号的登录路径（老人之后可在"我的"页补绑）
    this.handleLogin(undefined);
  },

  onGetPhoneAndLogin(e: any) {
    this._lastPhoneEventAt = Date.now();
    const phoneCode = e?.detail?.code;
    const errMsg = String(e?.detail?.errMsg || '');
    if (!phoneCode) {
      if (errMsg.includes('deny') || errMsg.includes('cancel')) {
        wx.showModal({
          title: '未获取手机号',
          content: '老人绑定家庭需要手机号自动识别。是否仍继续普通登录（稍后可在"我的"补绑）？',
          confirmText: '继续登录',
          cancelText: '取消',
          success: (res) => {
            if (res.confirm) this.handleLogin(undefined);
          },
        });
      } else {
        wx.showToast({ title: '手机号获取失败', icon: 'none' });
      }
      return;
    }
    this.handleLogin(phoneCode);
  },

  async handleLogin(phoneCode?: string) {
    const nick = (this.data.nicknameTmp || '').trim();
    if (!this.data.avatarUrlTmp || !nick) {
      wx.showToast({
        title: !this.data.avatarUrlTmp ? '请先选择头像' : '请填写昵称',
        icon: 'none',
      });
      return;
    }
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意用户协议和隐私政策', icon: 'none' });
      return;
    }
    if (this.data.loading) return;
    this.setData({ loading: true });

    try {
      // 第一步：wx.login 换取 code
      let code: string;
      if (isLocalApiMode()) {
        code = `dev_local_${getDevUserKey()}`;
      } else {
        try {
          const loginRes = await new Promise<WechatMiniprogram.LoginSuccessCallbackResult>(
            (resolve, reject) => {
              wx.login({ success: resolve, fail: reject });
            },
          );
          code = loginRes.code;
        } catch {
          code = `dev_local_${Date.now()}`;
          console.warn('wx.login failed, using dev code:', code);
        }
      }

      // 第二步：登录（兼容旧后端：可能不支持 nickname/avatarUrl/devUserKey）
      const nicknameTmp = nick;
      const { avatarUrlTmp } = this.data;
      let res: any;
      let withProfile = true;
      let withDevUserKey = !isLocalApiMode();
      let withPhoneCode = !!phoneCode;
      for (;;) {
        try {
          res = await this.doWechatLogin(
            code,
            nicknameTmp,
            avatarUrlTmp,
            withProfile,
            withDevUserKey,
            withPhoneCode ? phoneCode : undefined,
          );
          break;
        } catch (e: any) {
          const msg = String(e?.message || '');
          const hasProfileValidationError =
            msg.includes('property nickname should not exist') ||
            msg.includes('property avatarUrl should not exist');
          const hasDevKeyValidationError = msg.includes('property devUserKey should not exist');
          const hasPhoneCodeValidationError = msg.includes('property phoneCode should not exist');

          let adjusted = false;
          if (hasProfileValidationError && withProfile) {
            withProfile = false;
            adjusted = true;
          }
          if (hasDevKeyValidationError && withDevUserKey) {
            withDevUserKey = false;
            adjusted = true;
          }
          if (hasPhoneCodeValidationError && withPhoneCode) {
            withPhoneCode = false;
            adjusted = true;
          }
          if (!adjusted) throw e;
        }
      }

      // 第三步：把后端返回的用户 + 本次授权的头像昵称合并后存入本地缓存
      // 不依赖 /users/me，保证旧版后端也能立刻显示头像和昵称
      const mergedUser = {
        ...(res.user || {}),
        nickname: nicknameTmp || res.user?.nickname || '',
        avatarUrl: avatarUrlTmp || res.user?.avatarUrl || '',
      };
      setToken(res.token);
      setUserInfo(mergedUser);
      setLoginMode('user');

      // 第四步：异步尝试把头像昵称同步到后端（失败不影响登录）
      if (nicknameTmp || avatarUrlTmp) {
        const updateData: Record<string, string> = {};
        if (nicknameTmp) updateData.nickname = nicknameTmp;
        if (avatarUrlTmp) updateData.avatarUrl = avatarUrlTmp;
        put('/users/me', updateData).catch(() => {
          // 后端暂不支持时静默忽略，本地已经存好了
        });
      }

      wx.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        if (!redirectByIdentity()) {
          wx.switchTab({ url: '/pages/index/index' });
        }
      }, 500);
    } catch (e) {
      console.error('登录失败', e);
      const msg = String((e as any)?.message || '');
      const isWechatConfigError =
        msg.includes('invalid code') ||
        msg.includes('invalid appsecret') ||
        msg.includes('微信登录失败') ||
        msg.includes('微信服务器请求失败');

      if (isWechatConfigError) {
        wx.showModal({
          title: '登录失败',
          content:
            `${msg || '请检查登录配置。'}\n\n请检查小程序 AppID 是否与后端 APPID 一致，并确认线上后端已配置正确的 SECRET。`,
          showCancel: false,
          confirmText: '知道了',
        });
      } else {
        wx.showToast({ title: msg || '登录失败，请重试', icon: 'none' });
      }
    } finally {
      this.setData({ loading: false });
    }
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=agreement' });
  },

  goPrivacy() {
    wx.navigateTo({ url: '/pages/agreement/agreement?type=privacy' });
  },
});
