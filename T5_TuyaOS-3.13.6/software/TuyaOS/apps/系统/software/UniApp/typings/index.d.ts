/// <reference path="./types/index.d.ts" />

interface MiniProgramFeatures {
  showAiTriage: boolean
  showAiAdvisor: boolean
}

interface IAppOption {
  globalData: {
    userInfo?: WechatMiniprogram.UserInfo | null,
    miniProgramFeatures?: MiniProgramFeatures,
  }
  userInfoReadyCallback?: WechatMiniprogram.GetUserInfoSuccessCallback,
}

declare namespace WechatMiniprogram {
  interface Wx {
    getWindowInfo: () => {
      statusBarHeight: number
      windowWidth: number
      windowHeight: number
      pixelRatio: number
      safeArea?: { top: number; bottom: number; left: number; right: number }
    }
  }

  interface UploadFileSuccessCallbackResult {
    fileName?: string
  }
}