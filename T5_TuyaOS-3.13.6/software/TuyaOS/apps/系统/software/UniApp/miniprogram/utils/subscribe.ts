import { getPublic } from './request';

export type TemplateAlias =
  | 'medicationReminder'
  | 'orderServiceReminder'
  | 'orderAssignNotify'
  | 'grabPoolNotify'
  | 'orderStatusNotify'
  | 'followUpReminder'
  | 'attendantServiceReminder'
  | 'orderSignReminder'
  | 'orderPaymentReminder'
  | 'orderReviewInvite';

interface TemplateMap {
  medicationReminder: string;
  orderServiceReminder: string;
  orderAssignNotify: string;
  grabPoolNotify: string;
  orderStatusNotify: string;
  followUpReminder: string;
  attendantServiceReminder: string;
  orderSignReminder: string;
  orderPaymentReminder: string;
  orderReviewInvite: string;
}

let cachedTemplates: TemplateMap | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000;

const EMPTY_TEMPLATE_MAP: TemplateMap = {
  medicationReminder: '',
  orderServiceReminder: '',
  orderAssignNotify: '',
  grabPoolNotify: '',
  orderStatusNotify: '',
  followUpReminder: '',
  attendantServiceReminder: '',
  orderSignReminder: '',
  orderPaymentReminder: '',
  orderReviewInvite: '',
};

async function getTemplates(): Promise<TemplateMap> {
  const now = Date.now();
  if (cachedTemplates && now - cacheTimestamp < CACHE_TTL) {
    return cachedTemplates;
  }
  try {
    const res = await getPublic<Partial<TemplateMap>>('/system/config/public/mini-program-templates');
    cachedTemplates = { ...EMPTY_TEMPLATE_MAP, ...(res || {}) };
    cacheTimestamp = now;
    return cachedTemplates;
  } catch (e) {
    console.warn('获取订阅消息模板失败', e);
    return cachedTemplates || EMPTY_TEMPLATE_MAP;
  }
}

/**
 * 请求用户订阅指定类别的消息。
 * 在用户交互回调（如 tap / submit）中调用，静默失败不影响主流程。
 */
export async function requestSubscribe(aliases: TemplateAlias[]): Promise<void> {
  try {
    const templates = await getTemplates();
    const tmplIds = aliases
      .map((a) => templates[a])
      .filter((id) => !!id);
    if (!tmplIds.length) return;

    wx.requestSubscribeMessage({
      tmplIds,
      success() {},
      fail() {},
    });
  } catch {
    // 静默
  }
}

/**
 * 用药场景"积累式"订阅：在用户每次与用药功能交互时调用，
 * 为一次性订阅消息模板持续累积授权次数。
 *
 * 背景：微信 `wx.requestSubscribeMessage` 每次成功只为每个 tmplId 授权 1 条，
 *   而严格用药一天可能要推 3-4 条。
 * 策略：在如下交互点都触发一次（用户点过一次算一次授权 +1）：
 *   - 进入用药中心 / 家属看板的"今日用药"入口
 *   - 打卡按钮 tap（含已服/跳过/漏服）
 *   - 创建或编辑提醒保存后
 *   - 处方上传提交后
 *   - 收到服务器通知后回到小程序时（onShow 里的一次 tap）
 *
 * 长期订阅模板（运营申请成功后）：一次授权即可推任意条，
 *   本方法对其同样无害（只是把多个模板塞进去申请，微信会智能识别）。
 *
 * 若后台尚未在 system_configs 配好模板 ID，tmplIds 为空不触发任何弹窗。
 */
let lastMedicationSubscribeAt = 0;
const MEDICATION_SUBSCRIBE_COOLDOWN_MS = 1500;

export async function requestMedicationSubscribe(): Promise<void> {
  const now = Date.now();
  if (now - lastMedicationSubscribeAt < MEDICATION_SUBSCRIBE_COOLDOWN_MS) {
    // 同一用户行为连续触发（比如 tap 多个按钮）时短时间去重，避免重复弹窗
    return;
  }
  lastMedicationSubscribeAt = now;
  return requestSubscribe(['medicationReminder', 'followUpReminder']);
}
