import { get } from '../../utils/request';
import { getLoginMode } from '../../utils/identity';

const MEDICAL_HISTORY_LABEL: Record<string, string> = {
  none: '无', hypertension: '高血压', heart: '心脏病', cerebrovascular: '脑血管疾病',
  diabetes: '糖尿病', epilepsy: '癫痫', asthma: '哮喘/慢阻肺',
  mental: '精神类疾病', cancer: '癌症', other: '其他',
};

const RECENT_SYMPTOMS_LABEL: Record<string, string> = {
  none: '无明显症状', syncope: '晕厥/眩晕/跌倒', chest_pain: '胸痛/胸闷/心慌',
  dyspnea: '呼吸困难', fatigue: '乏力/疲劳', pain: '持续性疼痛',
  insomnia: '失眠/睡眠障碍', appetite_loss: '食欲下降', other: '其他',
};

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

function decodeName(str: string): string {
  if (!str || typeof str !== 'string') return str || '';
  try {
    let decoded = str;
    while (decoded.includes('%') && decoded !== decodeURIComponent(decoded)) {
      decoded = decodeURIComponent(decoded);
    }
    return decoded;
  } catch {
    return str;
  }
}

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    subjectId: '',
    orderId: '',
    /** 陪诊员经订单查看：只读，与「建立健康档案」同款字段布局 */
    isAttendantView: false,
    maskedView: false,
    name: '',
    gender: '',
    age: '' as string | number,
    relation: '',
    phone: '',
    idCard: '',
    emergencyContact: '',
    emergencyRelation: '',
    emergencyPhone: '',
    bloodType: '',
    allergies: '',
    allergyStatus: 'none',
    medicalHistoryTags: [] as string[],
    medicalHistoryHadNone: false,
    medicalHistoryOther: '',
    visionStatus: '',
    visionLabel: '',
    hearingStatus: '',
    hearingLabel: '',
    recentSymptomsTags: [] as string[],
    recentSymptomsHadNone: false,
    recentSymptomsOther: '',
    currentMedication: '',
    chiefComplaint: '',
    hasSigned: false,
    signatureName: '',
    signatureUrl: '',
    signedAt: '',
    profileCompleteness: 0,
  },

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    const orderId = options.orderId ? String(options.orderId) : '';
    const fromAttendant =
      options.from === 'attendant' || (!!orderId && getLoginMode() === 'attendant');
    this.setData({ isAttendantView: fromAttendant });
    if (orderId) {
      this.setData({ orderId, maskedView: true });
      this.loadMaskedCard(orderId);
      return;
    }
    if (options.subjectId) {
      this.setData({ subjectId: options.subjectId, maskedView: false });
      this.loadCard(options.subjectId);
    } else if (!orderId) {
      this.setData({ loading: false });
      wx.showToast({ title: '缺少参数', icon: 'none' });
    }
  },

  onShow() {
    if (this.data.orderId) {
      this.loadMaskedCard(this.data.orderId);
    } else if (this.data.subjectId) {
      this.loadCard(this.data.subjectId);
    }
  },

  applyCardData(res: any, maskedView: boolean) {
    let hp: any = {};
    try {
      hp = typeof res.healthProfile === 'string'
        ? JSON.parse(res.healthProfile || '{}')
        : (res.healthProfile || {});
    } catch {
      hp = {};
    }

    const signatureUrl = res.signatureUrl || (res as any).signature_url || hp.signatureUrl || hp.signUrl || '';
    const signatureName = decodeName(hp.signatureName || res.name || '');

    const relKey = resolveRelationshipKey(hp.relationship || '', res.gender);
    const relation = RELATION_MAP[relKey] || relKey || '';

    const medArr = Array.isArray(hp.medicalHistoryArr) && hp.medicalHistoryArr.length
      ? hp.medicalHistoryArr
      : Array.isArray(hp.medicalHistory)
        ? hp.medicalHistory
        : [];
    const medicalHistoryTags = medArr
      .filter((v: string) => v && v !== 'none')
      .map((v: string) => MEDICAL_HISTORY_LABEL[v] || v);

    const symptoms: string[] = hp.recentSymptoms || [];
    const recentSymptomsTags = symptoms
      .filter(v => v !== 'none')
      .map(v => RECENT_SYMPTOMS_LABEL[v] || v);

    const visionMap: Record<string, string> = { good: '正常', poor: '视力减退', blind: '严重视力障碍' };
    const hearingMap: Record<string, string> = { good: '正常', poor: '听力减退', deaf: '严重听力障碍' };
    const visionLabel = visionMap[hp.visionStatus || ''] || hp.visionStatus || '';
    const hearingLabel = hearingMap[hp.hearingStatus || ''] || hp.hearingStatus || '';

    const allergyText = typeof hp.allergies === 'string' ? hp.allergies.trim() : '';
    const hasAllergyText = allergyText !== '' && allergyText !== '无';
    let allergyStatus: 'has' | 'none' = 'none';
    if (hp.allergyStatus === 'has' || hasAllergyText) allergyStatus = 'has';
    else if (hp.allergyStatus === 'none') allergyStatus = 'none';

    let filled = 0;
    const hasAllergyInfo = allergyStatus === 'has';
    const checkList = [
      res.name, res.gender, res.age, res.idCard,
      hp.bloodType, hasAllergyInfo,
      medicalHistoryTags.length > 0, hp.visionStatus, hp.hearingStatus,
      res.emergencyContact, signatureUrl,
    ];
    checkList.forEach(v => { if (v) filled++; });
    const profileCompleteness = Math.round((filled / checkList.length) * 100);

    const chiefComplaint = String(res.mainAppeal || hp.chiefComplaint || '').trim();
    const medicalHistoryHadNone = medArr.includes('none');
    const recentSymptomsHadNone = symptoms.includes('none');

    this.setData({
      loading: false,
      maskedView,
      subjectId: String(res.id || this.data.subjectId || ''),
      name: res.name || '',
      gender: res.gender === 'male' ? '男' : res.gender === 'female' ? '女' : (res.gender || ''),
      age: res.age ?? '',
      relation,
      phone: res.phone || '',
      idCard: maskedView
        ? (res.idCard || '')
        : (res.idCard ? res.idCard.replace(/^(.{4}).*(.{4})$/, '$1**********$2') : ''),
      emergencyContact: res.emergencyContact || '',
      emergencyRelation: hp.emergencyRelation || '',
      emergencyPhone: res.emergencyPhone || '',
      bloodType: hp.bloodType || '',
      allergies: allergyStatus === 'has' ? (allergyText || '') : '',
      allergyStatus,
      medicalHistoryTags,
      medicalHistoryHadNone,
      medicalHistoryOther: hp.medicalHistoryOther || '',
      visionStatus: hp.visionStatus || '',
      visionLabel,
      hearingStatus: hp.hearingStatus || '',
      hearingLabel,
      recentSymptomsTags,
      recentSymptomsHadNone,
      recentSymptomsOther: hp.recentSymptomsOther || '',
      currentMedication: hp.currentMedications || hp.currentMedication || '',
      chiefComplaint,
      hasSigned: !!signatureUrl,
      signatureName,
      signatureUrl,
      signedAt: hp.signedAt ? this.formatDate(hp.signedAt) : '',
      profileCompleteness,
    });
  },

  async loadCard(id: string) {
    this.setData({ loading: true });
    try {
      const res: any = await get(`/users/service-targets/${id}`);
      this.applyCardData(res, false);
    } catch (e) {
      console.error('加载健康档案失败', e);
      this.setData({ loading: false });
    }
  },

  async loadMaskedCard(orderId: string) {
    this.setData({ loading: true });
    try {
      const res: any = await get(`/orders/${orderId}/health-profile`);
      this.applyCardData(res, res.maskedView !== false);
    } catch (e) {
      console.error('加载脱敏健康档案失败', e);
      this.setData({ loading: false });
      wx.showToast({ title: '加载档案失败', icon: 'none' });
    }
  },

  formatDate(str: string): string {
    if (!str) return '';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  callNumber(e: any) {
    const phone = String(e.currentTarget?.dataset?.phone || '').replace(/\D/g, '');
    if (phone && phone.length >= 7) {
      wx.makePhoneCall({ phoneNumber: phone });
    } else {
      wx.showToast({ title: '无效号码', icon: 'none' });
    }
  },

  // 未签署时才允许跳回编辑页
  goEdit() {
    if (this.data.isAttendantView) {
      wx.showToast({ title: '陪诊员仅可查看客户档案', icon: 'none' });
      return;
    }
    if (this.data.maskedView) {
      wx.showToast({ title: '抢单大厅仅支持查看脱敏档案', icon: 'none' });
      return;
    }
    if (this.data.hasSigned) {
      wx.showToast({ title: '档案已签署，不可编辑', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/health-profile/health-profile?subjectId=${this.data.subjectId}`,
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
