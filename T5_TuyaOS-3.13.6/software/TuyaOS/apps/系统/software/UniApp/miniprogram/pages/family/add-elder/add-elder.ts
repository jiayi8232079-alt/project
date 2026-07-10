import { post } from '../../../utils/request';

const MEDICAL_HISTORY_OPTIONS = [
  { value: 'hypertension', label: '高血压' },
  { value: 'diabetes', label: '糖尿病' },
  { value: 'heart', label: '心脏病' },
  { value: 'cerebrovascular', label: '脑血管病' },
  { value: 'cancer', label: '癌症' },
  { value: 'asthma', label: '哮喘/慢阻肺' },
  { value: 'mental', label: '精神类疾病' },
  { value: 'other', label: '其他' },
];

Page({
  data: {
    familyGroupId: 0,
    submitting: false,

    form: {
      delegatorRelation: 'child' as 'self' | 'child' | 'spouse' | 'other',
      name: '',
      phone: '',
      idCard: '',
      gender: '',
      birthDate: '',
      age: 0,
      relation: '',
      homeAddress: '',
      medicalHistory: [] as string[],
      medicalHistoryOther: '',
      currentMedication: '',
      allergies: '',
      emergencyContact: '',
      emergencyPhone: '',
    },

    medicalHistoryOptions: MEDICAL_HISTORY_OPTIONS,

    relations: [
      { value: 'father', label: '父亲' },
      { value: 'mother', label: '母亲' },
      { value: 'spouse', label: '配偶' },
      { value: 'other', label: '其他' },
    ],

    delegatorRelations: [
      { value: 'self', label: '老人本人', desc: '老人自行创建，可线上自签健康档案' },
      { value: 'child', label: '我是子女', desc: '代为创建，需签署《老人托管服务委托书》' },
    ],

    genders: ['男', '女'],

    showAgreement: false,
  },

  onLoad(options: any) {
    const groupId = Number(options?.familyGroupId || 0);
    if (!groupId) {
      wx.showToast({ title: '家庭参数缺失', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ familyGroupId: groupId });
  },

  selectDelegator(e: any) {
    const v = e.currentTarget.dataset.value;
    this.setData({ 'form.delegatorRelation': v });
  },

  selectRelation(e: any) {
    const v = e.currentTarget.dataset.value;
    this.setData({ 'form.relation': v });
  },

  selectGender(e: any) {
    const v = e.currentTarget.dataset.value;
    this.setData({ 'form.gender': v });
  },

  onBirthChange(e: any) {
    const birth = e.detail.value;
    let age = 0;
    if (birth) {
      const [y] = birth.split('-').map(Number);
      age = new Date().getFullYear() - (y || 0);
    }
    this.setData({ 'form.birthDate': birth, 'form.age': age });
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  toggleMedical(e: any) {
    const v = e.currentTarget.dataset.value;
    const list: string[] = [...this.data.form.medicalHistory];
    const idx = list.indexOf(v);
    if (idx >= 0) list.splice(idx, 1); else list.push(v);
    this.setData({ 'form.medicalHistory': list });
  },

  toggleAgreement() {
    this.setData({ showAgreement: !this.data.showAgreement });
  },

  validate(): string | null {
    const f = this.data.form;
    if (!f.name?.trim()) return '请填写老人姓名';
    if (!f.relation) return '请选择关系';
    if (f.relation === 'father' && f.gender && f.gender !== '男') return '父亲关系需选择男性';
    if (f.relation === 'mother' && f.gender && f.gender !== '女') return '母亲关系需选择女性';
    if (f.phone && !/^1\d{10}$/.test(f.phone)) return '手机号格式不正确';
    if (f.idCard && !/^\d{17}[\dXx]$/.test(f.idCard)) return '身份证号格式不正确';
    return null;
  },

  async submit() {
    const err = this.validate();
    if (err) {
      wx.showToast({ title: err, icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const f = this.data.form;
      const res: any = await post(`/family/${this.data.familyGroupId}/elders`, {
        name: f.name.trim(),
        phone: f.phone || undefined,
        idCard: f.idCard || undefined,
        gender: f.gender || undefined,
        age: f.age || undefined,
        relation: f.relation,
        homeAddress: f.homeAddress || undefined,
        emergencyContact: f.emergencyContact || undefined,
        emergencyPhone: f.emergencyPhone || undefined,
        healthProfile: {
          medicalHistory: f.medicalHistory,
          medicalHistoryOther: f.medicalHistoryOther || undefined,
          currentMedication: f.currentMedication || undefined,
          allergies: f.allergies || undefined,
          birthDate: f.birthDate || undefined,
        },
        delegatorRelation: f.delegatorRelation,
      });

      if (f.delegatorRelation === 'child') {
        wx.showToast({ title: '已保存，请签署委托协议', icon: 'none' });
        setTimeout(() => {
          const memberId = res?.familyMember?.id;
          const subjectName = res?.serviceTarget?.name || f.name;
          if (!memberId) {
            wx.navigateBack();
            return;
          }
          wx.navigateTo({
            url: `/pages/family/elder-trust-sign/elder-trust-sign?memberId=${memberId}&subjectName=${encodeURIComponent(subjectName)}`,
          });
        }, 600);
      } else {
        wx.showToast({ title: '已添加', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 800);
      }
    } catch (e: any) {
      wx.showToast({ title: e?.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
