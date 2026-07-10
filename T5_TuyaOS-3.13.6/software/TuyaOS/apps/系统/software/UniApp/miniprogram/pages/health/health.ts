import { get, del } from '../../utils/request';
import { isLoggedIn, redirectByIdentity } from '../../utils/auth';
import {
  ensureWechatIdentity,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../utils/identity';

const RELATION_MAP: Record<string, string> = {
  self: '本人', father: '父亲', mother: '母亲', parent: '父母', spouse: '配偶', child: '子女', other: '其他',
};

function resolveRelationshipKey(relation: string, gender?: string): string {
  const normalized = String(relation || '').trim();
  if (normalized !== 'parent') return normalized;
  if (gender === 'male') return 'father';
  if (gender === 'female') return 'mother';
  return 'parent';
}

const HISTORY_LABEL: Record<string, string> = {
  hypertension: '高血压', heart: '心脏病', cerebrovascular: '脑血管', diabetes: '糖尿病',
  epilepsy: '癫痫', asthma: '哮喘', mental: '精神疾病', cancer: '癌症', other: '其他',
};

const GENDER_MAP: Record<string, string> = { male: '男', female: '女', other: '其他' };
const VISION_LABEL: Record<string, string> = { good: '视力正常', poor: '视力减退', blind: '视力障碍' };
const HEARING_LABEL: Record<string, string> = { good: '听力正常', poor: '听力减退', deaf: '听力障碍' };

Page({
  data: {
    statusBarHeight: 20,
    subjects: [] as any[],
    loading: false,
    loadError: false,
    pageNeedsLogin: false,
  },

  onLoad() {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
  },

  async onShow() {
    if (redirectByIdentity()) return;
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true, subjects: [], loading: false });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    try {
      await ensureWechatIdentity('user');
    } catch (e) {
      console.log('健康页切回用户身份失败，继续使用当前缓存', e);
    }
    this.loadSubjects();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadSubjects() {
    this.setData({ loading: true, loadError: false });
    try {
      const res: any = await get('/users/me/service-targets');
      const list = (res.items || res || []).map((item: any) => {
        const hp: any = item.healthProfile || {};
        const relKey = resolveRelationshipKey(hp.relationship || '', item.gender);
        const relation = RELATION_MAP[relKey] || relKey || '';

        // 血型
        const bloodType = hp.bloodType || '';

        // 既往病史标签（最多3个）
        const histArr: string[] = (hp.medicalHistory || []).filter((v: string) => v !== 'none');
        const histTags = histArr.slice(0, 3).map((v: string) => HISTORY_LABEL[v] || v);
        const histMore = histArr.length > 3 ? `+${histArr.length - 3}` : '';

        // 视力/听力
        const visionLabel = VISION_LABEL[hp.visionStatus || ''] || '';
        const hearingLabel = HEARING_LABEL[hp.hearingStatus || ''] || '';

        const hasProfile = !!(
          hp.bloodType ||
          hp.allergies ||
          hp.medicalHistory?.length ||
          hp.medicalHistoryOther ||
          hp.visionStatus ||
          hp.hearingStatus ||
          hp.recentSymptoms?.length ||
          hp.currentMedications ||
          hp.currentMedication ||
          hp.otherHealthInfo ||
          item.mainAppeal ||
          item.emergencyContact ||
          item.emergencyPhone
        );
        const hasSigned = !!(item.signatureUrl || hp.signatureUrl || hp.signUrl);

        return {
          ...item,
          gender: GENDER_MAP[item.gender] || item.gender || '',
          relation,
          hasProfile,
          hasSigned,
          bloodType,
          histTags,
          histMore,
          visionLabel,
          hearingLabel,
          allergyHas: hp.allergies && hp.allergies !== '无',
        };
      });
      this.setData({ subjects: list });
    } catch (e) {
      console.error('加载服务对象失败', e);
      this.setData({ loadError: true });
    } finally {
      this.setData({ loading: false });
    }
  },

  goProfile(e: any) {
    const { id, hasprofile } = e.currentTarget.dataset;
    if (hasprofile) {
      // 已建立档案 → 跳健康小档案查看页
      wx.navigateTo({ url: `/pages/health-card/health-card?subjectId=${id}` });
    } else {
      // 未建立 → 跳建立档案表单
      wx.navigateTo({ url: `/pages/health-profile/health-profile?subjectId=${id}` });
    }
  },

  goHistory(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/health-history/health-history?subjectId=${id}` });
  },

  goAftercare() {
    wx.navigateTo({ url: '/pages/aftercare/aftercare' });
  },

  goAddMember() {
    wx.navigateTo({ url: '/pages/health/add-member/add-member' });
  },

  goEditMember(e: any) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/health/add-member/add-member?subjectId=${id}` });
  },

  async onDelete(e: any) {
    const { id, name } = e.currentTarget.dataset;
    const res = await wx.showModal({
      title: '确认删除',
      content: `确定要删除「${name}」的健康档案吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#F44336',
    });
    if (!res.confirm) return;
    try {
      await del(`/users/service-targets/${id}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.loadSubjects();
    } catch {
      wx.showToast({ title: '删除失败，请重试', icon: 'none' });
    }
  },
});
