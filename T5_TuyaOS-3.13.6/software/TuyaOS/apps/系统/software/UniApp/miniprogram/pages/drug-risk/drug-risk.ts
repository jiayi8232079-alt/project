import { get, post, request } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../utils/identity';

interface ServiceTargetOption {
  id: number;
  name: string;
  relation: string;
  activeMedCount: number;
}

interface RiskMedicine {
  medicineName: string;
  dosage: string | null;
}

interface RiskFinding {
  drugA: string;
  drugB: string;
  severity: 'high' | 'medium' | 'low';
  severityLabel: string;
  mechanism: string;
  recommendation: string;
  source: 'rule' | 'llm';
  sourceLabel: string;
}

interface RiskReportView {
  exists: boolean;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  riskLabel: string;
  riskTone: string;
  findingsCount: number;
  medicines: RiskMedicine[];
  findings: RiskFinding[];
  summary: string;
  assessedAt: string;
  llmFallback: boolean;
  modelNote: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  high: '高风险',
  medium: '中风险',
  low: '低风险',
};
const RISK_LABEL: Record<string, string> = {
  none: '未发现风险',
  low: '低风险',
  medium: '中风险',
  high: '高风险',
};
const RISK_TONE: Record<string, string> = {
  none: 'safe',
  low: 'info',
  medium: 'warning',
  high: 'danger',
};
const SOURCE_LABEL: Record<string, string> = {
  rule: '规则',
  llm: 'AI',
};

function formatDateTime(iso?: string) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

function mapReport(raw: any): RiskReportView {
  if (!raw) {
    return {
      exists: false,
      riskLevel: 'none',
      riskLabel: RISK_LABEL.none,
      riskTone: RISK_TONE.none,
      findingsCount: 0,
      medicines: [],
      findings: [],
      summary: '',
      assessedAt: '',
      llmFallback: false,
      modelNote: '',
    };
  }
  const level = raw.riskLevel || 'none';
  const payload = raw.payload || {};
  const findings: RiskFinding[] = (payload.findings || []).map((f: any) => ({
    drugA: f.drugA,
    drugB: f.drugB,
    severity: (f.severity || 'low') as 'high' | 'medium' | 'low',
    severityLabel: SEVERITY_LABEL[f.severity] || f.severity,
    mechanism: f.mechanism || '',
    recommendation: f.recommendation || '',
    source: (f.source || 'rule') as 'rule' | 'llm',
    sourceLabel: SOURCE_LABEL[f.source] || f.source,
  }));
  const medicines: RiskMedicine[] = (payload.medicines || []).map((m: any) => ({
    medicineName: m.medicineName,
    dosage: m.dosage || null,
  }));

  return {
    exists: true,
    riskLevel: level,
    riskLabel: RISK_LABEL[level] || level,
    riskTone: RISK_TONE[level] || 'info',
    findingsCount: raw.findingsCount || findings.length,
    medicines,
    findings,
    summary: payload.summary || '',
    assessedAt: formatDateTime(raw.assessedAt),
    llmFallback: !!payload.llmFallback,
    modelNote: payload.model ? `AI 模型：${payload.model}` : '',
  };
}

Page({
  data: {
    statusBarHeight: 20,
    pageNeedsLogin: false,
    loading: true,
    assessing: false,
    targets: [] as ServiceTargetOption[],
    selectedTargetId: 0,
    selectedTargetName: '',
    report: {
      exists: false,
      riskLevel: 'none',
      riskLabel: RISK_LABEL.none,
      riskTone: RISK_TONE.none,
      findingsCount: 0,
      medicines: [],
      findings: [],
      summary: '',
      assessedAt: '',
      llmFallback: false,
      modelNote: '',
    } as RiskReportView,
    noActiveMedication: false,
  },

  onLoad(options: any) {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    const targetId = options?.targetId ? Number(options.targetId) : 0;
    if (Number.isFinite(targetId) && targetId > 0) {
      this.setData({ selectedTargetId: targetId });
    }
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;

    await this.loadTargetsWithMedCount();

    if (this.data.selectedTargetId) {
      const match = this.data.targets.find(
        (t) => t.id === this.data.selectedTargetId,
      );
      if (match) {
        this.setData({ selectedTargetName: match.name });
        await this.loadExistingReport(this.data.selectedTargetId);
      }
    } else if (this.data.targets.length > 0) {
      const first = this.data.targets[0];
      this.setData({
        selectedTargetId: first.id,
        selectedTargetName: first.name,
      });
      await this.loadExistingReport(first.id);
    }

    this.setData({ loading: false });
  },

  async loadTargetsWithMedCount() {
    try {
      const targets: any[] = (await get('/users/me/service-targets')) || [];
      if (!Array.isArray(targets) || targets.length === 0) {
        this.setData({ targets: [] });
        return;
      }

      let reminderList: any[] = [];
      try {
        const reminders: any = await get('/medication-reminders/my', {
          activeOnly: 'true',
          type: 'medication',
        });
        reminderList = Array.isArray(reminders) ? reminders : [];
      } catch {
        reminderList = [];
      }

      const enriched: ServiceTargetOption[] = targets.map((t) => ({
        id: t.id,
        name: t.name,
        relation: t.relation || '',
        activeMedCount: reminderList.filter(
          (r) => Number(r.serviceTargetId) === Number(t.id),
        ).length,
      }));

      this.setData({ targets: enriched });
    } catch (e) {
      console.log('加载服务对象失败', e);
      this.setData({ targets: [] });
    }
  },

  onSelectTarget(e: any) {
    const id = Number(e.currentTarget.dataset.id);
    if (!id || id === this.data.selectedTargetId) return;
    const t = this.data.targets.find((x) => x.id === id);
    this.setData({
      selectedTargetId: id,
      selectedTargetName: t?.name || '',
      report: mapReport(null),
    });
    this.loadExistingReport(id);
  },

  async loadExistingReport(targetId: number) {
    if (!targetId) return;
    this.setData({ loading: true });
    try {
      const raw: any = await request({
        url: `/drug-interactions/target/${targetId}`,
        method: 'GET',
        silent: true,
      });
      this.setData({
        report: mapReport(raw),
        noActiveMedication: false,
      });
    } catch (e) {
      this.setData({ report: mapReport(null) });
    } finally {
      this.setData({ loading: false });
    }
  },

  async runAssessment() {
    if (!this.data.selectedTargetId) {
      wx.showToast({ title: '请先选择对象', icon: 'none' });
      return;
    }
    if (this.data.assessing) return;
    this.setData({ assessing: true });
    wx.showLoading({ title: 'AI 药师评估中…' });
    try {
      const raw: any = await post(
        `/drug-interactions/assess/target/${this.data.selectedTargetId}`,
        {},
      );
      this.setData({
        report: mapReport(raw),
        noActiveMedication: false,
      });
      wx.showToast({ title: '评估完成', icon: 'success' });
    } catch (e: any) {
      const msg = String(e?.message || '评估失败');
      if (msg.includes('当前没有正在服用的药物')) {
        this.setData({ noActiveMedication: true });
      } else {
        wx.showToast({ title: msg.slice(0, 30), icon: 'none' });
      }
    } finally {
      wx.hideLoading();
      this.setData({ assessing: false });
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  goBack() {
    wx.navigateBack();
  },

  goMedicationReminder() {
    wx.navigateTo({
      url: '/pages/medication-reminder/medication-reminder',
    });
  },
});
