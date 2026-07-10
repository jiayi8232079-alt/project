import { get, post } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import { callStore } from '../../utils/storeInfo';
import { getMiniProgramFeaturesCached, loadMiniProgramFeatures } from '../../utils/miniProgramFeatures';
import { mapWithConcurrency } from '../../utils/concurrency';

interface ServiceTarget {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone?: string;
}

interface HospitalPickItem {
  id: number;
  name: string;
  city: string;
  district?: string | null;
}

interface TriageResult {
  id: number;
  riskLevel: string;
  urgencyLevel: string;
  sceneType: string;
  departmentPrimary: string;
  departmentSecondary: string[];
  serviceRoute: string[];
  recommendedProduct: string;
  prepChecklist: string[];
  familySyncNeeded: boolean;
  escalateToHuman: boolean;
  structuredSummary: string;
  safeReplyText: string;
  ruleHits: string[];
  status: string;
  createdAt?: string;
  /** 本人历史/详情时接口带回，用于预填再次导诊 */
  mainSymptom?: string;
  patientAge?: number;
  patientGender?: string;
  consultantRole?: string;
  visitGoal?: string;
  symptomDuration?: string | null;
  severitySelf?: string | null;
  medicalHistory?: string[];
  currentMedication?: string | null;
  patientCity?: string | null;
  familyRemote?: boolean;
  mobility?: string | null;
  livesAlone?: boolean;
  hasExamResult?: boolean;
  allergyInfo?: string | null;
  recentlyDischarged?: boolean;
}

/** 与后端 CreateTriageDto.consultantRole 一致：self | child | relative | caregiver */
const CONSULTANT_ROLES = [
  { value: 'self', label: '本人', desc: '患者本人填写' },
  { value: 'child', label: '子女', desc: '为父母等长辈代办' },
  { value: 'relative', label: '其他亲属', desc: '配偶、兄弟姐妹等' },
  { value: 'caregiver', label: '照护者', desc: '家政/护工等非亲属协助' },
];

/** 家庭成员 relation（患者加入家庭时选择）→ 导诊 consultantRole */
function mapFamilyRelationToConsultant(relation: string): {
  consultantRole: string;
  label: string;
} {
  const rel = (relation || 'other').toLowerCase();
  if (rel === 'parent' || rel === 'father' || rel === 'mother') {
    return { consultantRole: 'child', label: '根据家庭档案：您为「父母/长辈」代办，已选「子女」' };
  }
  if (rel === 'child') {
    return { consultantRole: 'relative', label: '根据家庭档案：服务对象为家庭中的「子女」，已选「其他亲属」' };
  }
  if (rel === 'spouse') {
    return { consultantRole: 'relative', label: '根据家庭档案：配偶关系，已选「其他亲属」' };
  }
  if (rel === 'self') {
    return { consultantRole: 'self', label: '根据家庭档案：本人账号，已选「本人」' };
  }
  return { consultantRole: 'caregiver', label: '根据家庭档案：其他关系，已选「照护者」' };
}

let triageFamilyIdentityByTargetId: Record<
  number,
  { consultantRole: string; label: string }
> = {};

const SEVERITY_OPTIONS = [
  { value: 'mild', label: '轻微' },
  { value: 'moderate', label: '中等' },
  { value: 'severe', label: '严重' },
];

const MOBILITY_OPTIONS = [
  { value: 'normal', label: '正常' },
  { value: 'limited', label: '行动不便' },
  { value: 'bedridden', label: '卧床' },
];

const VISIT_GOALS = [
  { value: 'outpatient', label: '门诊就医' },
  { value: 'checkup', label: '体检' },
  { value: 'expert', label: '专家会诊' },
  { value: 'inpatient', label: '住院/手术' },
  { value: 'care', label: '照护服务' },
  { value: 'unsure', label: '不确定' },
];

const HISTORY_TAGS = [
  '高血压', '糖尿病', '冠心病', '脑卒中', '慢阻肺',
  '肿瘤', '骨质疏松', '关节炎', '肾病', '肝病',
];

function initialHistoryTags() {
  return HISTORY_TAGS.map((name) => ({ name, selected: false }));
}

/** 列表展示用时间，避免直接显示 ISO 字符串 */
function formatHistoryItemTime(row: TriageResult): TriageResult {
  const raw = row.createdAt;
  if (!raw) return row;
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return row;
  const y = t.getFullYear();
  const m = `${t.getMonth() + 1}`.padStart(2, '0');
  const d = `${t.getDate()}`.padStart(2, '0');
  const hh = `${t.getHours()}`.padStart(2, '0');
  const mm = `${t.getMinutes()}`.padStart(2, '0');
  return { ...row, createdAt: `${y}-${m}-${d} ${hh}:${mm}` };
}

Page({
  data: {
    // UI state
    step: 1 as number,          // 1=表单 2=加载中 3=结果 4=历史列表
    statusBarHeight: 20,
    loading: false,

    // 选项数据
    consultantRoles: CONSULTANT_ROLES,
    severityOptions: SEVERITY_OPTIONS,
    mobilityOptions: MOBILITY_OPTIONS,
    visitGoals: VISIT_GOALS,
    historyTags: initialHistoryTags(),

    // 服务对象
    subjects: [] as ServiceTarget[],
    subjectNames: [] as string[],
    targetIndex: 0,

    // 表单数据（填写人身份，与家庭档案同步时自动带出；未绑家庭时默认本人）
    consultantRole: 'self',
    identitySource: 'unlinked' as 'family' | 'unlinked',
    identityHint: '',
    identityOverridden: false,
    patientAge: '',
    patientGender: 'male',
    mainSymptom: '',
    symptomDuration: '',
    severitySelf: 'moderate',
    selectedHistory: [] as string[],
    currentMedication: '',
    hasExamResult: false,
    patientCity: '',
    familyRemote: false,
    mobility: 'normal',
    livesAlone: false,
    visitGoal: 'unsure',
    allergyInfo: '',
    recentlyDischarged: false,

    // 结果
    result: null as TriageResult | null,
    riskColorClass: '',

    /** 转人工留言 */
    chatMessages: [] as any[],
    chatInput: '',
    chatSending: false,
    lastChatMaxId: 0,

    historyItems: [] as TriageResult[],
    historyLoading: false,
    historyTotal: 0,
    navCapsuleInsetPx: 96,

    /** 一键下单弹层 */
    showConvertSheet: false,
    convertBookingMode: 'pending_cs' as 'booked' | 'pending_cs',
    convertHospitalKeyword: '',
    convertHospitalResults: [] as HospitalPickItem[],
    convertHospitalLoading: false,
    convertSelectedHospital: null as HospitalPickItem | null,
    convertCallbackPhone: '',
    convertSubmitting: false,
  },

  onLoad() {
    // 先用本地缓存判断；在缓存与线上配置一致时不会出现「先进入再被拉走」的回弹。
    // 线上首次冷启缓存为空时缓存返回 default（默认开启），UI 立即可用。
    const cachedFeatures = getMiniProgramFeaturesCached();
    if (!cachedFeatures.showAiTriage) {
      wx.showToast({ title: '智能导诊功能已关闭', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1600);
      return;
    }

    const sysInfo = wx.getWindowInfo();
    const menuRect = wx.getMenuButtonBoundingClientRect();
    // 胶囊左侧到屏边的距离：自定义「历史」必须留足右边距，否则会画在胶囊下方不可点、不可见
    const capsuleInsetPx = Math.max(0, sysInfo.windowWidth - menuRect.left) + 4;
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 20,
      navCapsuleInsetPx: capsuleInsetPx,
    });
    if (isLoggedIn()) void this.initTriageContext();

    // 异步刷新一次开关；若线上确认关闭则再退出，UI 已经渲染过、不至于阻塞首屏。
    void loadMiniProgramFeatures().then((features) => {
      if (!features.showAiTriage) {
        wx.showToast({ title: '智能导诊功能已关闭', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1600);
      }
    });
  },

  onShow() {
    if (this.data.step === 3 && this.data.result?.escalateToHuman && this.data.result?.id) {
      void this.fetchChatMessages(true);
      this.startChatPoll();
    }
    if (this.data.step === 4 && isLoggedIn()) {
      void this.loadHistory();
    }
  },

  async openHistory() {
    if (!isLoggedIn()) {
      wx.showToast({ title: '请先登录后查看记录', icon: 'none' });
      return;
    }
    this.setData({ step: 4, historyLoading: true });
    await this.loadHistory();
  },

  async loadHistory() {
    if (!isLoggedIn()) return;
    this.setData({ historyLoading: true });
    try {
      const res: any = await get('/triage/sessions', { page: 1, pageSize: 30 });
      const items = (res.items || []).map((it: TriageResult) =>
        formatHistoryItemTime(it),
      ) as TriageResult[];
      this.setData({
        historyItems: items,
        historyTotal: res.total ?? items.length,
        historyLoading: false,
      });
    } catch (e: any) {
      this.setData({ historyLoading: false, historyItems: [] });
      wx.showToast({ title: e?.message || '加载失败', icon: 'none' });
    }
  },

  onHistoryBack() {
    this.setData({ step: 1 });
  },

  applySessionInputsToForm(s: TriageResult) {
    const med = Array.isArray(s.medicalHistory) ? s.medicalHistory : [];
    const historyTags = HISTORY_TAGS.map((name) => ({ name, selected: med.includes(name) }));
    this.setData({
      mainSymptom: s.mainSymptom || '',
      patientAge: s.patientAge != null ? String(s.patientAge) : '',
      patientGender: (s.patientGender as string) || 'male',
      consultantRole: s.consultantRole || 'self',
      visitGoal: s.visitGoal || 'unsure',
      symptomDuration: (s.symptomDuration as string) || '',
      severitySelf: (s.severitySelf as string) || 'moderate',
      currentMedication: (s.currentMedication as string) || '',
      hasExamResult: !!s.hasExamResult,
      patientCity: (s.patientCity as string) || '',
      familyRemote: !!s.familyRemote,
      mobility: (s.mobility as string) || 'normal',
      livesAlone: !!s.livesAlone,
      allergyInfo: (s.allergyInfo as string) || '',
      recentlyDischarged: !!s.recentlyDischarged,
      historyTags,
      selectedHistory: med,
    });
  },

  async onHistoryItemTap(e: any) {
    const id = Number(e.currentTarget?.dataset?.id);
    if (!id || !isLoggedIn()) return;
    wx.showLoading({ title: '加载中…', mask: true });
    try {
      const s = (await get(`/triage/sessions/${id}`)) as TriageResult;
      this.applySessionInputsToForm(s);
      const colorMap: Record<string, string> = {
        R0: 'risk-green',
        R1: 'risk-blue',
        R2: 'risk-orange',
        R3: 'risk-red',
      };
      this.stopChatPoll();
      this.setData({
        step: 3,
        result: s,
        riskColorClass: colorMap[s.riskLevel] || 'risk-blue',
        chatMessages: [],
        chatInput: '',
        chatSending: false,
        lastChatMaxId: 0,
      });
      if (s.escalateToHuman && s.id) {
        await this.fetchChatMessages(true);
        this.startChatPoll();
      }
    } catch (err: any) {
      wx.showToast({ title: err?.message || '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onHide() {
    this.stopChatPoll();
  },

  onUnload() {
    this.stopChatPoll();
  },

  stopChatPoll() {
    const t = (this as any)._chatPollTimer as number;
    if (t) clearInterval(t);
    (this as any)._chatPollTimer = 0;
  },

  startChatPoll() {
    this.stopChatPoll();
    const r = this.data.result;
    if (!r?.escalateToHuman || !r?.id) return;
    (this as any)._chatPollTimer = setInterval(() => {
      void this.fetchChatMessages(false);
    }, 8000);
  },

  onChatInput(e: any) {
    this.setData({ chatInput: e.detail.value || '' });
  },

  async fetchChatMessages(isPriming: boolean) {
    const r = this.data.result;
    if (!r?.id || !r.escalateToHuman) return;
    // 8s 间隔的 setInterval 在弱网下会出现旧请求未返回新请求又触发的堆叠，
    // 不仅消耗带宽，还可能用旧 maxId 错误压住后到的真新数据。
    if ((this as any)._chatFetchInFlight) return;
    (this as any)._chatFetchInFlight = true;
    try {
      const res: any = await get(`/triage/sessions/${r.id}/messages`);
      const items: any[] = res.items || [];
      const maxId = items.length ? Math.max(...items.map((m: any) => m.id)) : 0;
      const prev = this.data.lastChatMaxId || 0;
      if (!isPriming && prev > 0 && maxId > prev) {
        const newStaff = items.some((m: any) => m.id > prev && m.sender === 'staff');
        if (newStaff) {
          try {
            wx.vibrateShort({ type: 'medium' });
          } catch {
            /* */
          }
        }
      }
      this.setData({
        chatMessages: items,
        lastChatMaxId: maxId,
      });
    } catch (e) {
      console.warn('拉取导诊留言失败', e);
    } finally {
      (this as any)._chatFetchInFlight = false;
    }
  },

  async onSendChat() {
    const text = (this.data.chatInput || '').trim();
    const r = this.data.result;
    if (!text || !r?.id) {
      wx.showToast({ title: '请输入内容', icon: 'none' });
      return;
    }
    this.setData({ chatSending: true });
    try {
      await post(`/triage/sessions/${r.id}/messages`, { content: text });
      this.setData({ chatInput: '' });
      await this.fetchChatMessages(true);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '发送失败', icon: 'none' });
    } finally {
      this.setData({ chatSending: false });
    }
  },

  async initTriageContext() {
    await Promise.all([this.loadSubjects(), this.loadFamilyIdentityMap()]);
    this.applyIdentityForCurrentTarget();
  },

  async loadFamilyIdentityMap() {
    triageFamilyIdentityByTargetId = {};
    try {
      const res: any = await get('/family');
      const families = Array.isArray(res) ? res : res?.items || [];
      // 单 user 一般 1-2 个家庭，但安全起见限并发 4，避免与本页其它请求叠加超 10。
      await mapWithConcurrency(families, 4, async (f: any) => {
        const gid = f.familyGroupId;
        if (!gid) return;
        try {
          const membersRes: any = await get(`/family/${gid}/members`);
          const members = Array.isArray(membersRes)
            ? membersRes
            : membersRes?.items || [];
          for (const m of members) {
            const tid = m.linkedServiceTargetId;
            if (!tid) continue;
            const mapped = mapFamilyRelationToConsultant(m.relation);
            triageFamilyIdentityByTargetId[tid] = mapped;
          }
        } catch {
          /* 单家庭失败不阻断 */
        }
      });
    } catch (e) {
      console.warn('加载家庭身份映射失败', e);
    }
  },

  applyIdentityForCurrentTarget() {
    const idx = this.data.targetIndex;
    const target = this.data.subjects[idx];
    const tid = target?.id;
    const mapped = tid ? triageFamilyIdentityByTargetId[tid] : undefined;
    if (mapped) {
      this.setData({
        consultantRole: mapped.consultantRole,
        identitySource: 'family',
        identityHint: mapped.label,
        identityOverridden: false,
      });
    } else {
      this.setData({
        consultantRole: 'self',
        identitySource: 'unlinked',
        identityHint:
          '未匹配到家庭关系时，默认按「本人」填写。若您实际是子女/亲属代为咨询，请在下方选择对应身份；也可在「我的 — 家庭」中绑定档案以便自动同步。',
        identityOverridden: false,
      });
    }
  },

  goHealthProfile() {
    wx.navigateTo({ url: '/pages/health-profile/health-profile' });
  },

  async loadSubjects() {
    try {
      const res: any = await get('/users/me/service-targets');
      const list = Array.isArray(res) ? res : res?.items || [];
      this.setData({
        subjects: list,
        subjectNames: list.map((s: ServiceTarget) => `${s.name}（${s.age || '?'}岁）`),
      });
      if (list.length > 0) {
        this.setData({
          targetIndex: 0,
          patientAge: String(list[0].age || ''),
          patientGender: list[0].gender || 'male',
        });
      }
    } catch (e) {
      console.warn('加载服务对象失败', e);
    }
  },

  onTargetChange(e: any) {
    const idx = Number(e.detail.value);
    const target = this.data.subjects[idx];
    if (target) {
      this.setData({
        targetIndex: idx,
        patientAge: String(target.age || ''),
        patientGender: target.gender || 'male',
      });
      this.applyIdentityForCurrentTarget();
    }
  },

  // ─── 表单事件 ──────────────────────────────────────────

  onRoleChange(e: any) {
    const v = e.currentTarget?.dataset?.value ?? e.detail?.value;
    if (!v) return;
    const tid = this.data.subjects[this.data.targetIndex]?.id;
    const mapped = tid ? triageFamilyIdentityByTargetId[tid] : undefined;
    const identityOverridden =
      this.data.identitySource === 'family' && !!mapped && mapped.consultantRole !== v;
    this.setData({ consultantRole: v, identityOverridden });
  },

  onGenderChange(e: any) {
    this.setData({ patientGender: e.currentTarget.dataset.value });
  },

  onAgeInput(e: any) {
    this.setData({ patientAge: e.detail.value });
  },

  onSymptomInput(e: any) {
    this.setData({ mainSymptom: e.detail.value });
  },

  onDurationInput(e: any) {
    this.setData({ symptomDuration: e.detail.value });
  },

  onSeverityChange(e: any) {
    this.setData({ severitySelf: e.currentTarget.dataset.value });
  },

  onHistoryToggle(e: any) {
    const i = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(i) || i < 0 || i >= this.data.historyTags.length) return;
    const historyTags = this.data.historyTags.map((t: { name: string; selected: boolean }, idx: number) =>
      idx === i ? { name: t.name, selected: !t.selected } : t,
    );
    const selectedHistory = historyTags
      .filter((t: { selected: boolean }) => t.selected)
      .map((t: { name: string }) => t.name);
    this.setData({ historyTags, selectedHistory });
  },

  onMedicationInput(e: any) {
    this.setData({ currentMedication: e.detail.value });
  },

  onExamToggle() {
    this.setData({ hasExamResult: !this.data.hasExamResult });
  },

  onCityInput(e: any) {
    this.setData({ patientCity: e.detail.value });
  },

  onFamilyRemoteToggle() {
    this.setData({ familyRemote: !this.data.familyRemote });
  },

  onMobilityChange(e: any) {
    this.setData({ mobility: e.currentTarget.dataset.value });
  },

  onLivesAloneToggle() {
    this.setData({ livesAlone: !this.data.livesAlone });
  },

  onVisitGoalChange(e: any) {
    this.setData({ visitGoal: e.currentTarget.dataset.value });
  },

  onAllergyInput(e: any) {
    this.setData({ allergyInfo: e.detail.value });
  },

  onDischargedToggle() {
    this.setData({ recentlyDischarged: !this.data.recentlyDischarged });
  },

  // ─── 提交 ─────────────────────────────────────────────

  async onSubmit() {
    const d = this.data;
    if (!d.mainSymptom.trim()) {
      wx.showToast({ title: '请描述主要症状', icon: 'none' });
      return;
    }
    if (!d.patientAge || Number(d.patientAge) <= 0) {
      wx.showToast({ title: '请填写患者年龄', icon: 'none' });
      return;
    }

    this.setData({ step: 2, loading: true });

    try {
      const payload: any = {
        consultantRole: d.consultantRole,
        patientAge: Number(d.patientAge),
        patientGender: d.patientGender,
        mainSymptom: d.mainSymptom.trim(),
        severitySelf: d.severitySelf,
        visitGoal: d.visitGoal,
        familyRemote: d.familyRemote,
        mobility: d.mobility,
        livesAlone: d.livesAlone,
        hasExamResult: d.hasExamResult,
        recentlyDischarged: d.recentlyDischarged,
      };
      if (d.symptomDuration) payload.symptomDuration = d.symptomDuration;
      if (d.selectedHistory.length) payload.medicalHistory = d.selectedHistory;
      if (d.currentMedication) payload.currentMedication = d.currentMedication;
      if (d.patientCity) payload.patientCity = d.patientCity;
      if (d.allergyInfo) payload.allergyInfo = d.allergyInfo;
      if (d.subjects.length > 0) {
        payload.serviceTargetId = d.subjects[d.targetIndex]?.id;
      }

      const result = await post('/triage/start', payload) as TriageResult;

      const colorMap: Record<string, string> = {
        R0: 'risk-green', R1: 'risk-blue', R2: 'risk-orange', R3: 'risk-red',
      };

      const merged = {
        ...result,
        mainSymptom: d.mainSymptom.trim(),
        patientAge: Number(d.patientAge),
        patientGender: d.patientGender,
        consultantRole: d.consultantRole,
        visitGoal: d.visitGoal,
        symptomDuration: d.symptomDuration || undefined,
        severitySelf: d.severitySelf,
        medicalHistory: d.selectedHistory,
        currentMedication: d.currentMedication || undefined,
        patientCity: d.patientCity || undefined,
        familyRemote: d.familyRemote,
        mobility: d.mobility,
        livesAlone: d.livesAlone,
        hasExamResult: d.hasExamResult,
        allergyInfo: d.allergyInfo || undefined,
        recentlyDischarged: d.recentlyDischarged,
      } as TriageResult;

      this.setData({
        step: 3,
        loading: false,
        result: merged,
        riskColorClass: colorMap[result.riskLevel] || 'risk-blue',
        chatMessages: [],
        chatInput: '',
        chatSending: false,
        lastChatMaxId: 0,
      });
      if (merged.escalateToHuman && merged.id) {
        await this.fetchChatMessages(true);
        this.startChatPoll();
      }
    } catch (e: any) {
      this.setData({ step: 1, loading: false });
      wx.showToast({ title: e?.message || '导诊失败，请重试', icon: 'none' });
    }
  },

  // ─── 结果页操作 ────────────────────────────────────────

  preventMove() {},

  closeConvertSheet() {
    if (this.data.convertSubmitting) return;
    const t = (this as any)._convertHospSearchTimer as ReturnType<typeof setTimeout> | undefined;
    if (t) clearTimeout(t);
    (this as any)._convertHospSearchTimer = undefined;
    this.setData({
      showConvertSheet: false,
      convertHospitalKeyword: '',
      convertHospitalResults: [],
      convertHospitalLoading: false,
      convertSelectedHospital: null,
    });
  },

  async openConvertOrderSheet() {
    if (!this.data.result) return;
    if (!isLoggedIn()) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    if (!this.data.subjects.length || !this.data.subjects[this.data.targetIndex]?.id) {
      wx.showToast({ title: '请先选择陪诊服务对象', icon: 'none' });
      return;
    }
    const sub = this.data.subjects[this.data.targetIndex];
    let phone = sub?.phone ? String(sub.phone) : '';
    this.setData({
      showConvertSheet: true,
      convertBookingMode: 'pending_cs',
      convertHospitalKeyword: '',
      convertHospitalResults: [],
      convertHospitalLoading: false,
      convertSelectedHospital: null,
      convertCallbackPhone: phone,
      convertSubmitting: false,
    });
    if (!phone) {
      try {
        const p: any = await get('/auth/profile');
        if (p?.phone) this.setData({ convertCallbackPhone: String(p.phone) });
      } catch {
        /* */
      }
    }
  },

  onConvertBookingChange(e: any) {
    const v = e.detail?.value as 'booked' | 'pending_cs';
    if (v !== 'booked' && v !== 'pending_cs') return;
    this.setData({
      convertBookingMode: v,
      convertSelectedHospital: v === 'booked' ? this.data.convertSelectedHospital : null,
    });
    if (v === 'booked' && this.data.convertHospitalKeyword.trim()) {
      void this.runConvertHospitalSearch(this.data.convertHospitalKeyword.trim());
    }
  },

  onConvertHospitalKeywordInput(e: any) {
    const raw = e.detail?.value || '';
    const kw = raw.trim();
    this.setData({ convertHospitalKeyword: raw });
    const prev = (this as any)._convertHospSearchTimer as ReturnType<typeof setTimeout> | undefined;
    if (prev) clearTimeout(prev);
    if (!kw) {
      this.setData({ convertHospitalResults: [], convertHospitalLoading: false });
      (this as any)._convertHospSearchTimer = undefined;
      return;
    }
    (this as any)._convertHospSearchTimer = setTimeout(() => {
      void this.runConvertHospitalSearch(kw);
    }, 380);
  },

  async runConvertHospitalSearch(keyword: string) {
    if (this.data.convertBookingMode !== 'booked') return;
    this.setData({ convertHospitalLoading: true });
    try {
      const params: Record<string, string | number> = { keyword, page: 1, pageSize: 20 };
      const res: any = await get('/hospitals', params);
      const items = (res.items || []) as any[];
      const convertHospitalResults: HospitalPickItem[] = items.map((h) => ({
        id: h.id,
        name: h.name,
        city: h.city || '',
        district: h.district,
      }));
      this.setData({ convertHospitalResults, convertHospitalLoading: false });
    } catch {
      this.setData({ convertHospitalResults: [], convertHospitalLoading: false });
      wx.showToast({ title: '医院搜索失败', icon: 'none' });
    }
  },

  onSelectConvertHospital(e: any) {
    const { id, name, city, district } = e.currentTarget?.dataset || {};
    if (!id) return;
    this.setData({
      convertSelectedHospital: {
        id: Number(id),
        name: String(name || ''),
        city: String(city || ''),
        district: district ? String(district) : null,
      },
    });
  },

  onConvertCallbackPhoneInput(e: any) {
    this.setData({ convertCallbackPhone: e.detail?.value || '' });
  },

  async submitConvertOrder() {
    if (!this.data.result || this.data.convertSubmitting) return;
    const mode = this.data.convertBookingMode;
    const sel = this.data.convertSelectedHospital;
    if (mode === 'booked' && (!sel || !sel.id)) {
      wx.showToast({ title: '请搜索并选择就诊医院', icon: 'none' });
      return;
    }
    const phone = (this.data.convertCallbackPhone || '').trim();
    if (!phone) {
      wx.showToast({ title: '请填写联系电话', icon: 'none' });
      return;
    }
    this.setData({ convertSubmitting: true });
    try {
      const body: Record<string, unknown> = {
        hospitalBookingStatus: mode,
        callbackContactPhone: phone,
      };
      if (mode === 'booked' && sel) body.hospitalDirectoryId = sel.id;
      const res: any = await post(`/triage/${this.data.result.id}/convert`, body);
      this.closeConvertSheet();
      wx.showToast({ title: '已生成订单', icon: 'success' });
      setTimeout(() => {
        wx.navigateTo({ url: `/pages/order/detail/detail?id=${res.orderId}` });
      }, 600);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '转单失败', icon: 'none' });
    } finally {
      this.setData({ convertSubmitting: false });
    }
  },

  async onCallService() {
    await callStore(true);
  },

  onRetry() {
    this.stopChatPoll();
    this.setData({
      step: 1,
      result: null,
      chatMessages: [],
      chatInput: '',
      lastChatMaxId: 0,
    });
    this.applyIdentityForCurrentTarget();
  },

  onBookEscort() {
    const dept = this.data.result?.departmentPrimary || '';
    wx.navigateTo({ url: `/pages/order/create/create?department=${encodeURIComponent(dept)}` });
  },

  onNavBack() {
    if (this.data.step === 4) {
      this.onHistoryBack();
      return;
    }
    this.goBack();
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
});
