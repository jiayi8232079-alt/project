import { get, post, put } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';

const BASE_RELATIONS = [
  { value: 'self', label: '本人' },
  { value: 'father', label: '父亲' },
  { value: 'mother', label: '母亲' },
  { value: 'spouse', label: '配偶' },
  { value: 'child', label: '子女' },
  { value: 'other', label: '其他' },
];

const UNIQUE_RELATION_LIMIT_MESSAGES: Record<string, string> = {
  self: '本人档案已存在',
  father: '父亲档案已存在',
  mother: '母亲档案已存在',
  spouse: '配偶档案已存在',
};

function isValidPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

function resolveRelationshipKey(relation: string, gender?: string): string {
  const normalized = String(relation || '').trim();
  if (normalized !== 'parent') return normalized;
  if (gender === 'male') return 'father';
  if (gender === 'female') return 'mother';
  return 'parent';
}

function getRelationGenderError(relation: string, gender: string): string {
  if (relation === 'father' && gender && gender !== 'male') return '父亲关系需选择男性';
  if (relation === 'mother' && gender && gender !== 'female') return '母亲关系需选择女性';
  return '';
}

/** 解析18位身份证，返回 { birthDate, age, gender } 或 null */
function parseIdCard(id: string): { birthDate: string; age: number; gender: string } | null {
  if (!/^\d{17}[\dX]$/i.test(id)) return null;
  const year = id.slice(6, 10);
  const month = id.slice(10, 12);
  const day = id.slice(12, 14);
  const birth = new Date(`${year}-${month}-${day}`);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  const gender = parseInt(id[16]) % 2 === 1 ? 'male' : 'female';
  return { birthDate: `${year}-${month}-${day}`, age: Math.max(0, age), gender };
}

Page({
  data: {
    statusBarHeight: 20,
    pageTitle: '添加新成员',
    subjectId: '',
    isEdit: false,
    initialRelationship: '',
    name: '',
    phone: '',
    gender: '',
    idCard: '',
    idCardBirth: '',
    idCardAge: 0,
    idCardParsed: false,
    relationship: '',
    submitting: false,
    relations: BASE_RELATIONS.map((item) => ({ ...item, disabled: false })),
    genders: [
      { value: 'male', label: '男' },
      { value: 'female', label: '女' },
    ],
    pageNeedsLogin: false,
    usedRelationLimits: {} as Record<string, string>,
  },

  _subjectLoaded: false,

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    const subjectId = options?.subjectId || '';
    const presetRelationship = String(options?.relationship || '').trim();
    this._subjectLoaded = false;
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      subjectId,
      isEdit: !!subjectId,
      pageTitle: subjectId
        ? '编辑成员'
        : (presetRelationship === 'self' ? '建立本人档案' : '添加新成员'),
      relationship: presetRelationship,
      initialRelationship: presetRelationship,
    });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    // 仅在首次进入时拉取成员资料，避免用户编辑中跳转其它页再返回时本地未保存修改被覆盖
    if (this.data.subjectId && !this._subjectLoaded) {
      await this.loadSubject(this.data.subjectId);
      this._subjectLoaded = true;
    }
    await this.loadRelationLimits();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadSubject(subjectId: string) {
    try {
      const res: any = await get(`/users/service-targets/${subjectId}`);
      const healthProfile = res?.healthProfile || {};
      const relationship =
        resolveRelationshipKey(
          healthProfile.relationship || (res as any).relationship || '',
          res?.gender,
        );
      this.setData({
        name: res?.name || '',
        phone: res?.phone || '',
        gender: res?.gender || '',
        idCard: res?.idCard || '',
        relationship,
        initialRelationship: relationship,
      });
      if (res?.idCard) {
        const parsed = parseIdCard(res.idCard);
        if (parsed) {
          this.setData({
            idCardBirth: parsed.birthDate,
            idCardAge: parsed.age,
            idCardParsed: true,
            gender: res?.gender || parsed.gender,
          });
        }
      }
    } catch (e) {
      console.error('加载成员信息失败', e);
      wx.showToast({ title: '加载成员信息失败', icon: 'none' });
    }
  },

  async loadRelationLimits() {
    try {
      const res: any = await get('/users/me/service-targets');
      const list = Array.isArray(res) ? res : (res?.items || []);
      const currentId = this.data.subjectId ? String(this.data.subjectId) : '';
      const usedRelationLimits: Record<string, string> = {};
      list.forEach((item: any) => {
        if (currentId && String(item?.id || '') === currentId) return;
        const relation = resolveRelationshipKey(
          item?.healthProfile?.relationship || item?.relationship || '',
          item?.gender,
        );
        const message = UNIQUE_RELATION_LIMIT_MESSAGES[relation];
        if (message && !usedRelationLimits[relation]) {
          usedRelationLimits[relation] = message;
        }
      });
      const relations = BASE_RELATIONS.map((item) => {
        const locked =
          !!usedRelationLimits[item.value] &&
          (!this.data.isEdit || item.value !== this.data.initialRelationship);
        return {
          ...item,
          disabled: locked,
        };
      });
      this.setData({ usedRelationLimits, relations });
    } catch (e) {
      console.log('加载关系限制失败', e);
    }
  },

  isRelationLocked(relation: string): boolean {
    const limit = this.data.usedRelationLimits[relation];
    if (!limit) return false;
    return !this.data.isEdit || relation !== this.data.initialRelationship;
  },

  onNameInput(e: any) {
    this.setData({ name: e.detail.value });
  },

  onPhoneInput(e: any) {
    this.setData({ phone: e.detail.value.replace(/\D/g, '').slice(0, 11) });
  },

  onGenderTap(e: any) {
    this.setData({ gender: e.currentTarget.dataset.value });
  },

  onRelationTap(e: any) {
    const value = e.currentTarget.dataset.value;
    if (this.isRelationLocked(value)) {
      wx.showToast({ title: this.data.usedRelationLimits[value], icon: 'none' });
      return;
    }
    this.setData({ relationship: value });
  },

  onIdCardInput(e: any) {
    const val: string = e.detail.value.replace(/\s/g, '').slice(0, 18);
    const parsed = parseIdCard(val);
    if (parsed) {
      this.setData({
        idCard: val,
        idCardBirth: parsed.birthDate,
        idCardAge: parsed.age,
        idCardParsed: true,
        gender: parsed.gender,
      });
    } else {
      this.setData({ idCard: val, idCardParsed: false, idCardBirth: '', idCardAge: 0 });
    }
  },

  goBack() {
    wx.navigateBack();
  },

  async onSubmit() {
    const { name, phone, gender, idCard, idCardBirth, idCardAge, idCardParsed, relationship } = this.data;

    if (!name.trim()) {
      wx.showToast({ title: '请输入姓名', icon: 'none' }); return;
    }
    if (!relationship) {
      wx.showToast({ title: '请选择与本人关系', icon: 'none' }); return;
    }
    if (this.isRelationLocked(relationship)) {
      wx.showToast({ title: this.data.usedRelationLimits[relationship], icon: 'none' }); return;
    }
    if (!gender) {
      wx.showToast({ title: '请选择性别', icon: 'none' }); return;
    }
    {
      const relationGenderError = getRelationGenderError(relationship, gender);
      if (relationGenderError) {
        wx.showToast({ title: relationGenderError, icon: 'none' }); return;
      }
    }
    if (!phone.trim()) {
      wx.showToast({ title: '请输入手机号码', icon: 'none' }); return;
    }
    if (!isValidPhone(phone)) {
      wx.showToast({ title: '请输入正确的11位手机号码', icon: 'none' }); return;
    }
    if (!idCard.trim()) {
      wx.showToast({ title: '请输入身份证号', icon: 'none' }); return;
    }
    if (!idCardParsed) {
      wx.showToast({ title: '请输入正确的18位身份证号', icon: 'none' }); return;
    }

    this.setData({ submitting: true });
    try {
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        idCard: idCard.trim(),
        gender,
        age: idCardAge,
        relationship,
        healthProfile: { birthDate: idCardBirth, relationship },
      };
      if (this.data.isEdit && this.data.subjectId) {
        await put(`/users/service-targets/${this.data.subjectId}`, payload);
      } else {
        await post('/users/me/service-targets', payload);
      }
      wx.showToast({
        title: this.data.isEdit
          ? '成员信息已更新'
          : (relationship === 'self' ? '本人档案已建立' : '档案建立成功，已同步到我的家庭'),
        icon: 'none',
        duration: 2000,
      });
      setTimeout(() => {
        if (getCurrentPages().length > 1) wx.navigateBack();
      }, 1800);
    } catch (e: any) {
      console.error('创建档案失败', e);
      wx.showToast({ title: e?.message || '创建失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
