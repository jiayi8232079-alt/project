import { get, post, del } from '../../utils/request';
import { isLoggedIn, getUserInfo } from '../../utils/auth';
import { BASE_URL } from '../../config';
import { loadMiniProgramFeatures } from '../../utils/miniProgramFeatures';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** 后端 ai_consultations.id，用于评价与落库一致 */
  serverMessageId?: number;
  /** null/undefined 未评；true/false 已有评价 */
  feedbackHelpful?: boolean | null;
  departments?: Array<{ name: string; confidence: number; reason: string }>;
  severity?: string;
  /** AI 向用户提出的问句，用户在输入框作答后可继续多轮 */
  followUpQuestions?: string[];
  /** 与追问等长的可选答案行，来自后端 followUpChoiceGroups */
  followUpChoiceGroups?: string[][];
  /** 扁平：一问多选项，供 WXML 渲染点选 */
  followUpBlocks?: Array<{ question: string; choices: string[]; selectedChoices: string[] }>;
  preparationChecklist?: string[];
}

function buildFollowUpBlocks(
  questions?: string[],
  groups?: string[][],
): Array<{ question: string; choices: string[]; selectedChoices: string[] }> {
  const qs = (questions || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!qs.length) return [];
  const g = groups || [];
  const fallback = ['暂不清楚', '需要想一想', '其他 / 我打字说明'];
  return qs.map((q, i) => {
    const row = Array.isArray(g[i]) ? g[i].map((x) => String(x || '').trim()).filter(Boolean) : [];
    return {
      question: q,
      choices: row.length ? row : [...fallback],
      selectedChoices: [],
    };
  });
}

function userContextLinesFromMessages(messages: Message[]): string[] {
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => (m.content || '').trim())
    .filter(Boolean);
}

const STORAGE_LAST_SESSION_BY_TARGET = 'ai_consult_last_session_by_target';

function readLastSessionsMap(): Record<string, string> {
  try {
    const r = wx.getStorageSync(STORAGE_LAST_SESSION_BY_TARGET);
    if (r && typeof r === 'object' && !Array.isArray(r)) return r as Record<string, string>;
  } catch {
    /* ignore */
  }
  return {};
}

function writeLastSessionForTarget(targetId: number | string | undefined | null, sessionId: string) {
  if (targetId == null || targetId === '' || !sessionId) return;
  const map = readLastSessionsMap();
  map[String(targetId)] = sessionId;
  try {
    wx.setStorageSync(STORAGE_LAST_SESSION_BY_TARGET, map);
  } catch {
    /* ignore */
  }
}

function removeLastSessionForTarget(targetId: number | string | undefined | null) {
  if (targetId == null || targetId === '') return;
  const map = readLastSessionsMap();
  delete map[String(targetId)];
  try {
    wx.setStorageSync(STORAGE_LAST_SESSION_BY_TARGET, map);
  } catch {
    /* ignore */
  }
}

function computeInputPlaceholder(messages: Message[], contextLen: number): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'assistant' && m.followUpBlocks?.length) {
      const q = String(m.followUpBlocks[0].question || '').trim();
      if (q) {
        const short = q.length > 40 ? `${q.slice(0, 40)}…` : q;
        return `可点上方的选项（可多选），再点「提交所选答案」，或打字补充：${short}`;
      }
    }
    if (m.role === 'assistant' && m.followUpQuestions?.length) {
      const q = String(m.followUpQuestions[0] || '').trim();
      if (q) {
        const short = q.length > 40 ? `${q.slice(0, 40)}…` : q;
        return `围绕顾问的问题补充，例如：${short}`;
      }
    }
  }
  if (contextLen > 0) return '可继续补充，AI 会结合上方全部信息作答…';
  return '描述您的症状或问题…';
}

/** 门诊摘要结构化字段 → 卡片展示块 */
function handoffStructuredToBlocks(s: Record<string, unknown> | null | undefined): Array<{ title: string; body: string }> {
  if (!s || typeof s !== 'object') return [];
  const out: Array<{ title: string; body: string }> = [];
  const add = (title: string, body: unknown) => {
    const t = body == null ? '' : String(body).trim();
    if (t) out.push({ title, body: t });
  };
  add('摘要依据与范围', s.evidenceBasis);
  if (Array.isArray(s.informationGaps) && s.informationGaps.length) {
    const body = (s.informationGaps as unknown[])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .map((g, i) => `${i + 1}. ${g}`)
      .join('\n');
    if (body) out.push({ title: '信息缺口（线上未掌握）', body });
  }
  add('需核实 / 不确定 / 冲突', s.conflictsOrUncertainties);
  add('主诉（据线上材料）', s.chiefComplaint);
  add('现病史（据线上材料）', s.historyOfPresentIllness);
  add('既往史与用药', s.pastHistoryMedications);
  add('过敏史', s.allergies);
  add('系统回顾', s.reviewOfSystems);
  add('化验与检查', s.labsAndImaging);
  add('分诊印象（非诊断）', s.triageImpression);
  if (Array.isArray(s.suggestedDepartments) && s.suggestedDepartments.length) {
    const body = (s.suggestedDepartments as unknown[])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .join('、');
    if (body) out.push({ title: '建议就诊科室（供参考）', body });
  }
  add('紧急程度（线上有限）', s.urgencyLevel);
  if (Array.isArray(s.familyPreparedQuestions) && s.familyPreparedQuestions.length) {
    const body = (s.familyPreparedQuestions as unknown[])
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .map((q, i) => `${i + 1}. ${q}`)
      .join('\n');
    if (body) out.push({ title: '家属希望在门诊澄清', body });
  }
  if (s.clinicReminder && String(s.clinicReminder).trim()) {
    add('门诊提示', s.clinicReminder);
  }
  return out;
}

function wrapPlainTextByChars(text: string, maxChars: number): string[] {
  const out: string[] = [];
  const paras = text.split('\n');
  for (const para of paras) {
    if (!para) {
      out.push('');
      continue;
    }
    let cur = '';
    for (let i = 0; i < para.length; i++) {
      const ch = para[i];
      if (cur.length >= maxChars) {
        out.push(cur);
        cur = ch;
      } else {
        cur += ch;
      }
    }
    if (cur) out.push(cur);
  }
  return out;
}

Page({
  data: {
    messages: [] as Message[],
    inputValue: '',
    loading: false,
    sessionId: '',
    scrollTarget: '',
    statusBarHeight: 20,
    navSideWidth: 88,
    safeBottom: 0,
    subjects: [] as any[],
    targetIndex: 0,
    showReportModal: false,
    reportText: '',

    showHistory: false,
    historySessions: [] as any[],
    historyLoading: false,
    /** 用户点了「新对话」则不再自动拉取上一会话 */
    intentionallyNewChat: false,
    /** 进入页时正在拉取最近会话，避免重复请求 */
    _loadingLatestSession: false,

    inputPlaceholder: '描述您的症状或问题…',
    recording: false,
    showDoctorModal: false,
    doctorSummaryText: '',
    doctorSummaryLoading: false,
    doctorHandoffBlocks: [] as Array<{ title: string; body: string }>,
    doctorMetaLine: '',
    /** 就诊摘要弹窗：免责全文展开 */
    doctorLegalExpanded: false,
    /** 打开某会话后待与服务对象列表对齐的咨询人 id */
    pendingSyncTargetId: null as number | null,
    /** 导航下副标题：正在为谁咨询 */
    consultingSubtitle: '',
    userAvatarUrl: '',
    showSubjectPicker: false,
    /** 是否显示跳转到智能导诊的入口（与后台「小程序展示」一致） */
    showTriageLink: true,
  },

  async onLoad(options: any) {
    const features = await loadMiniProgramFeatures();
    if (!features.showAiAdvisor) {
      wx.showToast({ title: 'AI 健康顾问功能已关闭', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1600);
      return;
    }
    this.setData({ showTriageLink: features.showAiTriage });
    const sysInfo = wx.getSystemInfoSync();
    const menuButtonRect = wx.getMenuButtonBoundingClientRect?.();
    const safeBottom = sysInfo.safeArea
      ? sysInfo.screenHeight - sysInfo.safeArea.bottom
      : 0;
    const userInfo = getUserInfo();
    this.setData({
      safeBottom,
      statusBarHeight: sysInfo.statusBarHeight || 20,
      navSideWidth: menuButtonRect?.width || 88,
      userAvatarUrl: userInfo?.avatarUrl || '',
    });

    if (options?.sessionId) {
      this.setData({ sessionId: options.sessionId, intentionallyNewChat: false });
      void this.loadSessionMessages(options.sessionId).catch(() => {});
    }

    const rm = wx.getRecorderManager();
    (this as any)._recorder = rm;
    (this as any)._recordCancelled = false;
    rm.onError(() => {
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ recording: false });
    });
    rm.onStop((res: WechatMiniprogram.OnStopCallbackResult) => {
      if ((this as any)._recordCancelled) {
        (this as any)._recordCancelled = false;
        return;
      }
      const path = res.tempFilePath;
      if (!path || (res.duration != null && res.duration < 400)) {
        wx.showToast({ title: '录音过短', icon: 'none' });
        return;
      }
      void this.transcribeAndFill(path);
    });
  },

  onShow() {
    if (!isLoggedIn()) {
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }
    void this.loadSubjects().then(() => this.tryAutoLoadSessionForCurrentTarget());
  },

  refreshConsultingSubtitle() {
    const s = this.data.subjects[this.data.targetIndex];
    const consultingSubtitle = s?.name ? `正在为：${s.name}` : '';
    this.setData({ consultingSubtitle });
  },

  applyPendingTargetSync() {
    const tid = this.data.pendingSyncTargetId;
    const subjects = this.data.subjects || [];
    if (tid == null || !subjects.length) {
      this.refreshConsultingSubtitle();
      return;
    }
    const idx = subjects.findIndex((x: { id?: number }) => Number(x.id) === Number(tid));
    if (idx >= 0) {
      this.setData({ targetIndex: idx, pendingSyncTargetId: null });
    } else {
      this.setData({ pendingSyncTargetId: null });
    }
    this.refreshConsultingSubtitle();
  },

  /** 当前选中的咨询人：自动打开其上次会话（本地指针或接口按 serviceTargetId 匹配） */
  async tryAutoLoadSessionForCurrentTarget() {
    if (this.data.intentionallyNewChat) return;
    if (this.data.sessionId) return;
    if (this.data.messages.length > 0) return;
    if (this.data._loadingLatestSession) return;

    const subjects = this.data.subjects || [];
    const tid = subjects[this.data.targetIndex]?.id;
    if (!tid) return;

    this.setData({ _loadingLatestSession: true });
    try {
      const map = readLastSessionsMap();
      let sid = map[String(tid)];
      if (sid) {
        try {
          await this.loadSessionMessages(sid);
          return;
        } catch {
          delete map[String(tid)];
          try {
            wx.setStorageSync(STORAGE_LAST_SESSION_BY_TARGET, map);
          } catch {
            /* ignore */
          }
        }
      }

      const res: any = await get('/ai-consultation/sessions', { page: 1, pageSize: 50 });
      const items = res.items || [];
      const match = items.find((it: Record<string, unknown>) => {
        const st = it.serviceTargetId ?? it.service_target_id;
        if (st == null || st === '') return false;
        return Number(st) === Number(tid);
      });
      if (match?.sessionId) {
        await this.loadSessionMessages(match.sessionId as string);
      }
    } catch {
      /* 无记录或网络错误：保持欢迎页 */
    } finally {
      this.setData({ _loadingLatestSession: false });
    }
  },

  persistCurrentTargetSessionPointer() {
    const cur = this.data.subjects[this.data.targetIndex];
    if (cur?.id && this.data.sessionId) {
      writeLastSessionForTarget(cur.id, this.data.sessionId);
    }
  },

  toggleSubjectPicker() {
    this.setData({ showSubjectPicker: !this.data.showSubjectPicker });
  },

  onSubjectPickerTap(e: any) {
    this.setData({ showSubjectPicker: false });
    this.onConsultCapsuleTap(e);
  },

  onConsultCapsuleTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (!Number.isFinite(idx) || idx === this.data.targetIndex) return;

    const skipModal = this.data.messages.length === 0 && !this.data.sessionId;

    if (skipModal) {
      void this.applyTargetSwitch(idx);
      return;
    }

    const name = this.data.subjects[idx]?.name || '该位家人';
    wx.showModal({
      title: '切换咨询对象',
      content: `将切换到「${name}」的专属顾问会话。\n\n每位家人的对话互相独立，记录不会与当前聊天混写。`,
      confirmText: '切换',
      cancelText: '取消',
      success: (m) => {
        if (m.confirm) void this.applyTargetSwitch(idx);
      },
    });
  },

  async applyTargetSwitch(idx: number) {
    const subjects = this.data.subjects || [];
    if (idx < 0 || idx >= subjects.length) return;

    this.persistCurrentTargetSessionPointer();

    try {
      wx.removeStorageSync(this.draftStorageKey());
    } catch {
      /* ignore */
    }

    this.setData({
      targetIndex: idx,
      showHistory: false,
      pendingSyncTargetId: null,
      intentionallyNewChat: false,
    });
    this.refreshConsultingSubtitle();

    const next = subjects[idx];
    const tid = next?.id;
    if (!tid) {
      this.setData({ messages: [], sessionId: '' });
      this.refreshInputPlaceholder([]);
      return;
    }

    this.setData({ _loadingLatestSession: true });
    try {
      const map = readLastSessionsMap();
      let sid: string | undefined = map[String(tid)];
      if (sid) {
        try {
          await this.loadSessionMessages(sid);
          return;
        } catch {
          delete map[String(tid)];
          try {
            wx.setStorageSync(STORAGE_LAST_SESSION_BY_TARGET, map);
          } catch {
            /* ignore */
          }
        }
      }

      const res: any = await get('/ai-consultation/sessions', { page: 1, pageSize: 50 });
      const items = res.items || [];
      const match = items.find((it: Record<string, unknown>) => {
        const st = it.serviceTargetId ?? it.service_target_id;
        if (st == null || st === '') return false;
        return Number(st) === Number(tid);
      });
      if (match?.sessionId) {
        await this.loadSessionMessages(match.sessionId as string);
      } else {
        this.setData({ messages: [], sessionId: '' });
        this.refreshInputPlaceholder([]);
      }
    } catch {
      this.setData({ messages: [], sessionId: '' });
      this.refreshInputPlaceholder([]);
    } finally {
      this.setData({ _loadingLatestSession: false });
    }
  },

  /** 避免首条消息早于服务对象列表返回，导致未传 serviceTargetId */
  async ensureSubjectsLoaded() {
    if ((this.data.subjects || []).length > 0) return;
    await this.loadSubjects();
  },

  draftStorageKey() {
    return `ai_consult_draft_${this.data.sessionId || '__new__'}`;
  },

  persistDraft(text: string) {
    try {
      wx.setStorageSync(this.draftStorageKey(), text);
    } catch { /* ignore */ }
  },

  restoreDraft() {
    try {
      const v = wx.getStorageSync(this.draftStorageKey());
      if (typeof v === 'string' && v.trim() && !(this.data.inputValue || '').trim()) {
        this.setData({ inputValue: v });
      }
    } catch { /* ignore */ }
  },

  refreshInputPlaceholder(msgs?: Message[]) {
    const messages = msgs ?? this.data.messages;
    const ctx = userContextLinesFromMessages(messages).length;
    this.setData({ inputPlaceholder: computeInputPlaceholder(messages, ctx) });
  },

  async loadSubjects() {
    try {
      const res: any = await get('/users/me/service-targets');
      const list = res.items || res || [];
      this.setData({ subjects: list });
      this.applyPendingTargetSync();
      this.refreshConsultingSubtitle();
    } catch {
      /* ignore */
    }
  },

  async loadSessionMessages(sessionId: string) {
    let res: any;
    try {
      res = await get(`/ai-consultation/sessions/${sessionId}`);
    } catch {
      wx.showToast({ title: '加载历史对话失败', icon: 'none' });
      throw new Error('load session failed');
    }

    const list = Array.isArray(res) ? res : (res.items || []);

    let inferredTid: number | null = null;
    for (const m of list as any[]) {
      const st = m.serviceTargetId ?? m.service_target_id;
      if (st != null && st !== '') {
        inferredTid = Number(st);
        break;
      }
    }

    const messages: Message[] = list.map((m: any) => {
      const fqs = m.parsedResult?.followUpQuestions || [];
      const fcg = m.parsedResult?.followUpChoiceGroups || [];
      return {
        id: m.id != null ? String(m.id) : `h_${Date.now()}_${Math.random()}`,
        role: m.role,
        content: m.content || '',
        serverMessageId: m.role === 'assistant' && m.id != null ? Number(m.id) : undefined,
        feedbackHelpful:
          m.role !== 'assistant'
            ? undefined
            : m.feedbackHelpful === true
              ? true
              : m.feedbackHelpful === false
                ? false
                : null,
        departments: m.parsedResult?.recommendedDepartments?.map((d: any) => ({
          ...d,
          confidence: Math.round((d.confidence || 0) * 100),
        })) || [],
        severity: m.parsedResult?.severityLevel,
        followUpQuestions: fqs,
        followUpChoiceGroups: fcg,
        followUpBlocks: buildFollowUpBlocks(fqs, fcg),
        preparationChecklist: m.parsedResult?.preparationChecklist || [],
      };
    });

    this.setData({
      messages,
      sessionId,
      intentionallyNewChat: false,
      pendingSyncTargetId: inferredTid != null && Number.isFinite(inferredTid) ? inferredTid : null,
    });
    this.applyPendingTargetSync();

    const storeTid = inferredTid ?? this.data.subjects[this.data.targetIndex]?.id;
    if (storeTid && sessionId) {
      writeLastSessionForTarget(storeTid, sessionId);
    }

    this.refreshInputPlaceholder(messages);
    this.restoreDraft();
    setTimeout(() => this.setData({ scrollTarget: 'msg-bottom' }), 200);
  },

  goHealthProfile() {
    const id = this.data.subjects[this.data.targetIndex]?.id;
    if (id == null) {
      wx.navigateTo({ url: '/pages/health-profile/health-profile' });
      return;
    }
    wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${id}` });
  },

  onInput(e: any) {
    const v = e.detail.value;
    this.setData({ inputValue: v });
    this.persistDraft(v);
  },

  onQuickTap(e: any) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputValue: text });
    this.onSend();
  },

  /** 多选「进一步了解」选项；需点「提交所选答案」一次发送 */
  toggleFollowUpChip(e: any) {
    if (this.data.loading) return;
    const msgIndex = Number(e.currentTarget.dataset.msgIndex);
    const bi = Number(e.currentTarget.dataset.bi);
    const choice = String(e.currentTarget.dataset.choice || '').trim();
    if (!choice || !Number.isFinite(msgIndex) || !Number.isFinite(bi)) return;
    const messages = this.data.messages;
    if (msgIndex < 0 || msgIndex >= messages.length) return;
    const msg = messages[msgIndex];
    if (msg.role !== 'assistant' || msgIndex !== messages.length - 1) return;
    const blocks = msg.followUpBlocks;
    if (!blocks || !blocks[bi]) return;

    const NONE_EXCLUSIVE = '没有其他症状';
    const nextBlocks = blocks.map((b, idx) => {
      if (idx !== bi) return { ...b, selectedChoices: [...(b.selectedChoices || [])] };
      const sel = [...(b.selectedChoices || [])];
      if (choice === NONE_EXCLUSIVE) {
        const on = sel.includes(choice);
        return { ...b, selectedChoices: on ? [] : [choice] };
      }
      const withoutNone = sel.filter((c) => c !== NONE_EXCLUSIVE);
      const pos = withoutNone.indexOf(choice);
      if (pos >= 0) withoutNone.splice(pos, 1);
      else withoutNone.push(choice);
      return { ...b, selectedChoices: withoutNone };
    });

    const msgs = [...messages];
    msgs[msgIndex] = { ...msg, followUpBlocks: nextBlocks };
    this.setData({ messages: msgs });
  },

  submitFollowUpSelections(e: any) {
    if (this.data.loading) return;
    const msgIndex = Number(e.currentTarget.dataset.msgIndex);
    if (!Number.isFinite(msgIndex)) return;
    const messages = this.data.messages;
    if (msgIndex < 0 || msgIndex >= messages.length) return;
    const msg = messages[msgIndex];
    if (msg.role !== 'assistant' || msgIndex !== messages.length - 1) return;
    const blocks = msg.followUpBlocks || [];
    if (!blocks.length) return;

    for (let i = 0; i < blocks.length; i++) {
      const sel = blocks[i].selectedChoices || [];
      if (!sel.length) {
        wx.showToast({ title: `请为第${i + 1}题至少选择一项`, icon: 'none' });
        return;
      }
    }

    const parts: string[] = [];
    for (const block of blocks) {
      const q = String(block.question || '').trim();
      const qShort = q.length > 120 ? `${q.slice(0, 120)}…` : q;
      const joined = (block.selectedChoices || []).join('、');
      parts.push(qShort ? `（针对：${qShort}）我选：${joined}` : `我选：${joined}`);
    }
    const text = parts.join('；');
    this.setData({ inputValue: text }, () => {
      void this.onSend();
    });
  },

  async onSend() {
    const text = this.data.inputValue.trim();
    if (!text || this.data.loading) return;

    this.setData({ intentionallyNewChat: false });
    await this.ensureSubjectsLoaded();

    const before = this.data.messages;
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: text };
    const messages = [...before, userMsg];
    this.setData({ messages, inputValue: '', loading: true, scrollTarget: `msg-${messages.length - 1}` });
    try {
      wx.removeStorageSync(this.draftStorageKey());
    } catch { /* ignore */ }
    setTimeout(() => this.setData({ scrollTarget: 'msg-loading' }), 100);

    try {
      const target = this.data.subjects[this.data.targetIndex];
      const res: any = await post('/ai-consultation/chat', {
        message: text,
        sessionId: this.data.sessionId || undefined,
        serviceTargetId: target?.id,
      });

      const mid = res.messageId != null ? Number(res.messageId) : undefined;
      const fqs = res.followUpQuestions || [];
      const fcg = res.followUpChoiceGroups || [];
      const aiMsg: Message = {
        id: mid != null ? `a_${mid}` : `a_${Date.now()}`,
        role: 'assistant',
        serverMessageId: mid,
        feedbackHelpful: null,
        content: res.reply || res.summary || '抱歉，暂时无法回答',
        departments: (res.recommendedDepartments || []).map((d: any) => ({ ...d, confidence: Math.round((d.confidence || 0) * 100) })),
        severity: res.severityLevel,
        followUpQuestions: fqs,
        followUpChoiceGroups: fcg,
        followUpBlocks: buildFollowUpBlocks(fqs, fcg),
        preparationChecklist: res.preparationChecklist || [],
      };
      const updated = [...messages, aiMsg];
      const newSid = res.sessionId || this.data.sessionId;
      if (target?.id && newSid) {
        writeLastSessionForTarget(target.id, newSid);
      }
      this.setData({
        messages: updated,
        sessionId: newSid,
        scrollTarget: `msg-${updated.length - 1}`,
      });
      this.refreshInputPlaceholder(updated);
    } catch (err: any) {
      const msg = err?.message || 'AI 服务暂时不可用，请稍后重试';
      this.setData({
        messages: before,
        inputValue: text,
        loading: false,
      });
      this.persistDraft(text);
      wx.showToast({ title: msg, icon: 'none', duration: 2800 });
      setTimeout(() => this.setData({ scrollTarget: 'msg-bottom' }), 100);
      return;
    }
    this.setData({ loading: false });
    setTimeout(() => this.setData({ scrollTarget: 'msg-bottom' }), 100);
  },

  // ─── 历史会话 ─────────────────────────────────────

  async toggleHistory() {
    if (this.data.showHistory) {
      this.setData({ showHistory: false });
      return;
    }
    this.setData({ showHistory: true, historyLoading: true });
    try {
      const res: any = await get('/ai-consultation/sessions', { page: 1, pageSize: 30 });
      this.setData({ historySessions: res.items || [] });
    } catch { /* ignore */ }
    finally { this.setData({ historyLoading: false }); }
  },

  loadHistorySession(e: any) {
    const sid = e.currentTarget.dataset.sid;
    if (!sid) return;
    this.setData({ showHistory: false, intentionallyNewChat: false });
    this.loadSessionMessages(sid);
  },

  deleteHistorySession(e: any) {
    const sid = e.currentTarget.dataset.sid as string;
    if (!sid) return;
    wx.showModal({
      title: '删除对话',
      content: '确定删除该条历史对话？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#E53935',
      success: async (m) => {
        if (!m.confirm) return;
        try {
          await del(`/ai-consultation/sessions/${encodeURIComponent(sid)}`);
          const historySessions = (this.data.historySessions || []).filter(
            (x: { sessionId: string }) => x.sessionId !== sid,
          );
          this.setData({ historySessions });
          if (this.data.sessionId === sid) {
            const cur = this.data.subjects[this.data.targetIndex];
            if (cur?.id) {
              removeLastSessionForTarget(cur.id);
            }
            try {
              wx.removeStorageSync(this.draftStorageKey());
            } catch {
              /* ignore */
            }
            this.setData({
              messages: [],
              sessionId: '',
              inputValue: '',
              intentionallyNewChat: false,
              pendingSyncTargetId: null,
            });
            this.refreshInputPlaceholder([]);
            this.refreshConsultingSubtitle();
          }
          wx.showToast({ title: '已删除', icon: 'none' });
        } catch (err: any) {
          wx.showToast({ title: err?.message || '删除失败', icon: 'none' });
        }
      },
    });
  },

  onNewSession() {
    const cur = this.data.subjects[this.data.targetIndex];
    if (cur?.id) {
      removeLastSessionForTarget(cur.id);
    }
    try {
      wx.removeStorageSync(this.draftStorageKey());
    } catch {
      /* ignore */
    }
    this.setData({
      messages: [],
      sessionId: '',
      inputValue: '',
      showHistory: false,
      intentionallyNewChat: true,
      pendingSyncTargetId: null,
    });
    this.refreshConsultingSubtitle();
    this.refreshInputPlaceholder([]);
  },

  noop() {},

  async transcribeAndFill(filePath: string) {
    this.setData({ loading: true });
    try {
      const token = wx.getStorageSync('token');
      const text: string = await new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${BASE_URL}/ai-consultation/transcribe`,
          filePath,
          name: 'file',
          header: { Authorization: token ? `Bearer ${token}` : '' },
          success(r) {
            try {
              const j = JSON.parse((r.data as string) || '{}');
              if (r.statusCode < 200 || r.statusCode >= 300) {
                const msg = j.message || j.data?.message || `请求失败(${r.statusCode})`;
                reject(new Error(msg));
                return;
              }
              const inner = j.data !== undefined ? j.data : j;
              const t = String(inner.text || '').trim();
              if (!t) reject(new Error('未识别到语音内容'));
              else resolve(t);
            } catch {
              reject(new Error('语音识别结果解析失败'));
            }
          },
          fail: () => reject(new Error('网络错误')),
        });
      });
      const merged = [this.data.inputValue || '', text].filter(Boolean).join(' ').trim();
      this.setData({ inputValue: merged });
      this.persistDraft(merged);
    } catch (e: any) {
      wx.showToast({ title: e?.message || '语音识别失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },

  ensureRecordAuth(cb: () => void) {
    wx.getSetting({
      success: (s) => {
        if (s.authSetting['scope.record']) {
          cb();
          return;
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => cb(),
          fail: () => {
            wx.showModal({
              title: '需要录音权限',
              content: '请在设置中开启麦克风，以便使用语音输入',
              confirmText: '去设置',
              success: (m) => {
                if (m.confirm) wx.openSetting({});
              },
            });
          },
        });
      },
    });
  },

  onVoiceTouchStart() {
    if (this.data.loading) return;
    this.ensureRecordAuth(() => {
      (this as any)._recordCancelled = false;
      this.setData({ recording: true });
      const rm: WechatMiniprogram.RecorderManager = (this as any)._recorder;
      rm.start({
        duration: 60000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'aac',
      });
    });
  },

  onVoiceTouchEnd() {
    if (!this.data.recording) return;
    this.setData({ recording: false });
    try {
      ((this as any)._recorder as WechatMiniprogram.RecorderManager).stop();
    } catch { /* ignore */ }
  },

  onVoiceTouchCancel() {
    (this as any)._recordCancelled = true;
    this.setData({ recording: false });
    try {
      ((this as any)._recorder as WechatMiniprogram.RecorderManager).stop();
    } catch { /* ignore */ }
  },

  async onFeedbackHelpful(e: any) {
    const mid = Number(e.currentTarget.dataset.mid);
    const helpful = e.currentTarget.dataset.helpful === '1';
    if (!mid) return;
    try {
      await post(`/ai-consultation/messages/${mid}/feedback`, { helpful });
      const messages = this.data.messages.map((m) =>
        m.serverMessageId === mid ? { ...m, feedbackHelpful: helpful } : m,
      );
      this.setData({ messages });
      wx.showToast({ title: '感谢反馈', icon: 'none' });
    } catch (err: any) {
      wx.showToast({ title: err?.message || '提交失败', icon: 'none' });
    }
  },

  async openDoctorSummary() {
    if (!this.data.sessionId) {
      wx.showToast({ title: '请先对话或打开一条历史会话', icon: 'none' });
      return;
    }
    this.setData({
      showDoctorModal: true,
      doctorSummaryLoading: true,
      doctorHandoffBlocks: [],
      doctorSummaryText: '',
      doctorMetaLine: '',
      doctorLegalExpanded: false,
    });
    try {
      await this.ensureSubjectsLoaded();
      const target = this.data.subjects[this.data.targetIndex];
      const res: any = await post('/ai-consultation/clinic-handoff', {
        sessionId: this.data.sessionId,
        serviceTargetId: target?.id,
      });
      const structured = res.structured as Record<string, unknown> | undefined;
      const blocks = handoffStructuredToBlocks(structured);
      const meta = [res.patientLine, res.generatedAt].filter(Boolean).join(' · ');
      this.setData({
        doctorHandoffBlocks: blocks,
        doctorSummaryText: res.plainText || '',
        doctorMetaLine: meta,
        doctorSummaryLoading: false,
      });
    } catch (err: any) {
      this.setData({ showDoctorModal: false, doctorSummaryLoading: false });
      wx.showToast({ title: err?.message || '生成失败', icon: 'none' });
    }
  },

  closeDoctorModal() {
    this.setData({ showDoctorModal: false, doctorLegalExpanded: false });
  },

  toggleDoctorLegalExpanded() {
    this.setData({ doctorLegalExpanded: !this.data.doctorLegalExpanded });
  },

  copyDoctorSummary() {
    const t = this.data.doctorSummaryText;
    if (!t?.trim()) {
      wx.showToast({ title: '暂无可复制内容', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: t,
      success: () => wx.showToast({ title: '已复制全文', icon: 'none' }),
    });
  },

  saveHandoffAsImage() {
    const plain = this.data.doctorSummaryText;
    if (!plain?.trim()) {
      wx.showToast({ title: '请等待摘要生成完成', icon: 'none' });
      return;
    }
    const runSave = (tempPath: string) => {
      wx.saveImageToPhotosAlbum({
        filePath: tempPath,
        success: () => {
          wx.hideLoading();
          wx.showToast({ title: '已保存到相册', icon: 'none' });
        },
        fail: () => {
          wx.hideLoading();
          wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' });
        },
      });
    };
    const ensureAlbum = (cb: (path: string) => void, tempPath: string) => {
      wx.getSetting({
        success: (s) => {
          if (s.authSetting['scope.writePhotosAlbum']) {
            cb(tempPath);
            return;
          }
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => cb(tempPath),
            fail: () => {
              wx.hideLoading();
              wx.showModal({
                title: '需要相册权限',
                content: '保存图片需允许写入相册',
                confirmText: '去设置',
                success: (m) => {
                  if (m.confirm) wx.openSetting({});
                },
              });
            },
          });
        },
      });
    };

    wx.showLoading({ title: '生成图片…', mask: true });
    const query = wx.createSelectorQuery().in(this);
    query
      .select('#handoffCanvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (!res?.[0]?.node) {
          wx.hideLoading();
          wx.showToast({ title: '画布未就绪', icon: 'none' });
          return;
        }
        const canvas = res[0].node as any;
        const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null;
        if (!ctx) {
          wx.hideLoading();
          wx.showToast({ title: '无法绘制', icon: 'none' });
          return;
        }
        const dpr = Math.min(wx.getSystemInfoSync().pixelRatio || 2, 3);
        const W = 375;
        const maxChars = 24;
        const lines = wrapPlainTextByChars(plain, maxChars);
        const lineH = 20;
        const headH = 56;
        const footH = 44;
        const pad = 20;
        const H = Math.max(320, headH + lines.length * lineH + footH + pad);

        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        ctx.fillStyle = '#f3f6f4';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#1b5e20';
        ctx.fillRect(0, 0, W, headH);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 17px system-ui, -apple-system, sans-serif';
        ctx.fillText('陪了个伴 · 就诊信息摘要', pad, 36);

        ctx.fillStyle = '#212121';
        ctx.font = '13px system-ui, -apple-system, sans-serif';
        let y = headH + 18;
        for (const ln of lines) {
          ctx.fillText(ln || ' ', pad, y);
          y += lineH;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.38)';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText('陪了个伴小程序整理 · 仅供门诊参考 · 非正式病历', pad, H - 18);

        try {
          wx.canvasToTempFilePath(
            {
              canvas,
              width: canvas.width,
              height: canvas.height,
              destWidth: W * 2,
              destHeight: H * 2,
              fileType: 'png',
              quality: 1,
              success: (r) => ensureAlbum(runSave, r.tempFilePath),
              fail: () => {
                wx.hideLoading();
                wx.showToast({ title: '导出图片失败', icon: 'none' });
              },
            } as WechatMiniprogram.CanvasToTempFilePathOption,
            this,
          );
        } catch {
          wx.hideLoading();
          wx.showToast({ title: '导出失败', icon: 'none' });
        }
      });
  },

  goTriage() {
    if (!this.data.showTriageLink) {
      wx.showToast({ title: '智能导诊已关闭', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/triage/triage' });
  },

  goBack() {
    if (getCurrentPages().length > 1) {
      wx.navigateBack();
      return;
    }
    wx.switchTab({ url: '/pages/mine/mine' });
  },

  // ─── 报告解读（文本 / 图片 / 文件） ──────────────────

  onReportInterpret() {
    wx.showActionSheet({
      itemList: ['拍照/从相册选图（报告或药盒等）', '选择PDF/文件', '手动输入文字'],
      success: (res) => {
        if (res.tapIndex === 0) this.uploadReportImage();
        else if (res.tapIndex === 1) this.uploadReportFile();
        else this.setData({ showReportModal: true, reportText: '' });
      },
    });
  },

  uploadReportImage() {
    wx.chooseMedia({
      count: 3,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const paths = res.tempFiles.map((f: any) => f.tempFilePath);
        this.setData({ loading: true });
        const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: `【上传了 ${paths.length} 张图片，健康材料解读中…】` };
        const nextMsgs = [...this.data.messages, userMsg];
        this.setData({ messages: nextMsgs, scrollTarget: 'msg-loading' });

        try {
          await this.ensureSubjectsLoaded();
          const urls = await Promise.all(paths.map((p: string) => this.doUploadFile(p)));
          const target = this.data.subjects[this.data.targetIndex];
          const reportText = `[用户上传了与健康相关的图片（可为化验单、药盒、说明书等）]\n图片地址：${urls.join('\n')}\n请根据实际图像与文字内容判断材料类型并解读；若服务未配置视觉模型，仅能通过链接提示用户改用文字说明。`;

          const res: any = await post('/ai-consultation/interpret-report', {
            reportText,
            sessionId: this.data.sessionId || undefined,
            serviceTargetId: target?.id,
          });
          this.handleReportResponse(res);
        } catch (err: any) {
          this.setData({ messages: [...this.data.messages, { id: `e_${Date.now()}`, role: 'assistant' as const, content: err?.message || '材料解读失败' }] });
        } finally {
          this.setData({ loading: false });
          setTimeout(() => this.setData({ scrollTarget: 'msg-bottom' }), 100);
        }
      },
    });
  },

  uploadReportFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
      success: async (res) => {
        const file = res.tempFiles[0];
        this.setData({ loading: true });
        const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: `【上传了文件：${file.name}，健康材料解读中…】` };
        const nextFileMsgs = [...this.data.messages, userMsg];
        this.setData({ messages: nextFileMsgs, scrollTarget: 'msg-loading' });

        try {
          await this.ensureSubjectsLoaded();
          const url = await this.doUploadFile(file.path);
          const target = this.data.subjects[this.data.targetIndex];
          const reportText = `[用户上传了与健康相关的文件：${file.name}]\n文件地址：${url}\n若为 PDF/文档，若无法解析请建议用户粘贴关键文字或改用图片+视觉模型。`;

          const res: any = await post('/ai-consultation/interpret-report', {
            reportText,
            sessionId: this.data.sessionId || undefined,
            serviceTargetId: target?.id,
          });
          this.handleReportResponse(res);
        } catch (err: any) {
          this.setData({ messages: [...this.data.messages, { id: `e_${Date.now()}`, role: 'assistant' as const, content: err?.message || '材料解读失败' }] });
        } finally {
          this.setData({ loading: false });
          setTimeout(() => this.setData({ scrollTarget: 'msg-bottom' }), 100);
        }
      },
    });
  },

  doUploadFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token');
      wx.uploadFile({
        url: `${BASE_URL}/documents/raw-upload`,
        filePath,
        name: 'file',
        header: { Authorization: token ? `Bearer ${token}` : '' },
        success(res) {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error('上传失败'));
            return;
          }
          try {
            const data = JSON.parse(res.data || '{}');
            resolve(data.data?.url || data.url || '');
          } catch {
            reject(new Error('上传失败'));
          }
        },
        fail: () => reject(new Error('上传失败')),
      });
    });
  },

  handleReportResponse(res: any) {
    const typeLabels: Record<string, string> = {
      lab_report: '检验/检查报告',
      medication_packaging: '药品包装或说明书',
      prescription: '处方或用药相关',
      other_health_doc: '其他健康文书',
      general_image: '一般图片',
      unclear: '类型未明',
      non_health: '非医疗健康内容',
    };
    const materialLabel = res.materialType ? typeLabels[String(res.materialType)] || res.materialType : '';
    let replyParts = [res.summary || ''];
    if (materialLabel) replyParts.push(`\n材料类型：${materialLabel}`);
    if (res.limitations) replyParts.push(`\n${res.limitations}`);
    if (res.medicationHints?.length) {
      replyParts.push('\n药品信息（仅辅助理解）：');
      res.medicationHints.forEach((h: any) => {
        const bits = [h.name, h.usageNote, h.caution].filter(Boolean).join('；');
        if (bits) replyParts.push(`• ${bits}`);
      });
    }
    if (res.abnormalItems?.length) {
      replyParts.push('\n异常指标：');
      res.abnormalItems.forEach((item: any) => {
        replyParts.push(`• ${item.item}：${item.value} — ${item.meaning}`);
      });
    }
    if (res.normalConclusion) replyParts.push(`\n正常项摘要：${res.normalConclusion}`);
    if (res.dietaryAdvice) replyParts.push(`\n饮食建议：${res.dietaryAdvice}`);
    replyParts.push('\n以上为 AI 辅助解读，仅供参考，具体请遵医嘱。');

    const mid = res.messageId != null ? Number(res.messageId) : undefined;
    const aiMsg: Message = {
      id: mid != null ? `a_${mid}` : `a_${Date.now()}`,
      role: 'assistant',
      serverMessageId: mid,
      feedbackHelpful: mid != null ? null : undefined,
      content: replyParts.join('\n'),
      departments: (res.recommendedDepartments || []).map((d: any) => ({ ...d, confidence: Math.round((d.confidence || 0) * 100) })),
      severity: res.severityLevel,
      preparationChecklist: res.recommendedActions || [],
    };
    const updated = [...this.data.messages, aiMsg];
    const newSid = res.sessionId || this.data.sessionId;
    const target = this.data.subjects[this.data.targetIndex];
    if (target?.id && newSid) {
      writeLastSessionForTarget(target.id, newSid);
    }
    this.setData({ messages: updated, sessionId: newSid, scrollTarget: `msg-${updated.length - 1}` });
    this.refreshInputPlaceholder(updated);
  },

  closeReportModal() {
    this.setData({ showReportModal: false });
  },

  onReportInput(e: any) {
    this.setData({ reportText: e.detail.value });
  },

  async submitReportInterpret() {
    const text = this.data.reportText.trim();
    if (!text) {
      wx.showToast({ title: '请输入文字内容', icon: 'none' });
      return;
    }
    this.setData({ showReportModal: false, loading: true });
    const userMsg: Message = { id: `u_${Date.now()}`, role: 'user', content: `【健康材料解读】\n${text}` };
    const repNext = [...this.data.messages, userMsg];
    this.setData({ messages: repNext, scrollTarget: 'msg-loading' });

    try {
      await this.ensureSubjectsLoaded();
      const target = this.data.subjects[this.data.targetIndex];
      const res: any = await post('/ai-consultation/interpret-report', {
        reportText: text,
        sessionId: this.data.sessionId || undefined,
        serviceTargetId: target?.id,
      });
      this.handleReportResponse(res);
    } catch (err: any) {
      this.setData({ messages: [...this.data.messages, { id: `e_${Date.now()}`, role: 'assistant' as const, content: err?.message || '材料解读失败' }] });
    } finally {
      this.setData({ loading: false });
      setTimeout(() => this.setData({ scrollTarget: 'msg-bottom' }), 100);
    }
  },
});
