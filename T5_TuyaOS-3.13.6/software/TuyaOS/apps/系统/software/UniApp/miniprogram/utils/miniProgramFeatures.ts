import { get } from './request';

export type MiniProgramFeatures = {
  showAiTriage: boolean;
  showAiAdvisor: boolean;
};

const STORAGE_KEY = 'mini_program_features_v1';

const DEFAULT: MiniProgramFeatures = {
  showAiTriage: true,
  showAiAdvisor: true,
};

function merge(partial: Partial<MiniProgramFeatures> | null | undefined): MiniProgramFeatures {
  return {
    showAiTriage: partial?.showAiTriage !== false,
    showAiAdvisor: partial?.showAiAdvisor !== false,
  };
}

/** 同步读缓存（启动后曾成功拉取过则与线上一致） */
export function getMiniProgramFeaturesCached(): MiniProgramFeatures {
  try {
    const s = wx.getStorageSync(STORAGE_KEY);
    if (s && typeof s === 'object') return merge(s as MiniProgramFeatures);
  } catch {
    /* ignore */
  }
  return { ...DEFAULT };
}

/**
 * 拉取后台「小程序展示」开关并写入缓存。
 * 失败时返回本地缓存或默认（均为展示），避免无网时误藏入口。
 */
export async function loadMiniProgramFeatures(): Promise<MiniProgramFeatures> {
  try {
    const res: any = await get('/system/config/public/mini-program-features', undefined, {
      silent: true,
    });
    const f = merge(res);
    try {
      wx.setStorageSync(STORAGE_KEY, f);
    } catch {
      /* ignore */
    }
    const app = getApp<{ globalData?: { miniProgramFeatures?: MiniProgramFeatures } }>();
    if (app?.globalData) {
      app.globalData.miniProgramFeatures = f;
    }
    return f;
  } catch {
    return getMiniProgramFeaturesCached();
  }
}
