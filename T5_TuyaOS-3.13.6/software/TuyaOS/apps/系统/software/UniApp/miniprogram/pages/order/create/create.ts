import { get, post } from '../../../utils/request';
import { isLoggedIn } from '../../../utils/auth';
import {
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../../utils/identity';
import { buildCityRowFromMap, parseHospitalsRegionsResponse } from '../../../utils/hospital-regions';

/** 与首页服务对应，后台创建订单时映射为具体服务类型 */
const SERVICE_TYPES: Record<string, string> = {
  escort: '陪诊服务',
  checkup: '体检规划',
  expert: '专家匹配',
  consult: '门诊咨询',
  store: '到店预约',
  fetch: '代取报告',
};

function toIsoWithLocalOffset(dateTime: string): string {
  const date = new Date(dateTime);
  if (isNaN(date.getTime())) return dateTime;
  const pad = (n: number) => String(n).padStart(2, '0');
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMinutes);
  const offsetHour = pad(Math.floor(abs / 60));
  const offsetMinute = pad(abs % 60);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${sign}${offsetHour}:${offsetMinute}`;
}

function formatHospitalLine(h: {
  name?: string;
  city?: string;
  district?: string | null;
}): string {
  const name = String(h.name || '').trim();
  const city = String(h.city || '').trim();
  const district = h.district != null && String(h.district).trim() ? String(h.district).trim() : '';
  if (!name) return '';
  if (district) {
    return `${name}（${city}${district}）`;
  }
  return city ? `${name}（${city}）` : name;
}

let hospitalSearchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

Page({
  data: {
    pageNeedsLogin: false,
    currentStep: 0,
    serviceType: 'escort',
    serviceTypeText: '陪诊服务',
    subjects: [] as any[],
    selectedSubjectId: '',
    selectedSubjectName: '',
    selectedSubjectAge: 0,
    selectedSubjectRelation: '',
    canNext: false,
    submitting: false,
    form: {
      serviceDate: '',
      serviceTime: '',
      serviceEndDate: '',
      serviceEndTime: '',
      remark: '',
      hospital: '',
      department: '',
    },
    isRemoteOrder: false,
    showAuthModal: false,
    authAgreed: false,
    authSignerName: '',
    authSignerRelation: '',
    showRiskModal: false,
    riskAcknowledged: false,
    riskFactors: [] as string[],
    hospitalManualMode: false,
    selectedHospitalId: 0,
    hospitalDirectoryLine: '',
    hospitalSheetVisible: false,
    hospitalKeyword: '',
    hospitalListItems: [] as any[],
    hospitalListLoading: false,
    hospitalRegionsInited: false,
    hospitalProvinceOptions: [] as { label: string; province: string }[],
    hospitalRegionCitiesByProvince: {} as Record<string, string[]>,
    hospitalProvinceIndex: 0,
    hospitalCityOptionsRow: [{ label: '全部地区', city: '' }] as { label: string; city: string }[],
    hospitalCityIndex: 0,
    hospitalShowCityRow: false,
  },

  onLoad(options: any) {
    const type = options.type || 'escort';
    this.setData({
      serviceType: type,
      serviceTypeText: SERVICE_TYPES[type] || type,
    });
  },

  async onShow() {
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (!(await ensureUserPageAccess())) return;
    this.loadSubjects();
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  async loadSubjects() {
    try {
      const res: any = await get('/users/me/service-targets');
      this.setData({ subjects: res.items || res || [] });
    } catch (e) {
      console.error('加载服务对象失败', e);
    }
  },

  selectSubject(e: any) {
    const id = e.currentTarget.dataset.id;
    const subject = this.data.subjects.find((s: any) => s.id === id);
    const age = subject?.age || 0;
    const relation = subject?.relation || '';
    const isRemote = relation && relation !== '本人';

    const hp = (() => {
      const raw = subject?.healthProfile;
      if (!raw) return {};
      if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
      return raw;
    })();

    const riskFactors: string[] = [];
    if (age >= 70) riskFactors.push(`高龄（${age}岁）`);
    if (age >= 80) riskFactors.push('超高龄，需特别关注');

    const medHistory: string[] = hp.medicalHistory || [];
    const hasChronicDisease = medHistory.some(
      (v: string) => v && v !== 'none',
    );
    if (hasChronicDisease) {
      const LABEL: Record<string, string> = {
        hypertension: '高血压', heart: '心脏病', cerebrovascular: '脑血管疾病',
        diabetes: '糖尿病', epilepsy: '癫痫', asthma: '哮喘/慢阻肺',
        mental: '精神类疾病', cancer: '癌症',
      };
      const names = medHistory
        .filter((v: string) => v && v !== 'none' && v !== 'other')
        .map((v: string) => LABEL[v] || v)
        .slice(0, 3);
      if (names.length) riskFactors.push(`慢性病史：${names.join('、')}`);
      if (hp.medicalHistoryOther) riskFactors.push(`其他病史：${hp.medicalHistoryOther}`);
    }

    const allergies = String(hp.allergies || '').trim();
    if (allergies && allergies !== '无') {
      riskFactors.push(`过敏史：${allergies}`);
    }

    this.setData({
      selectedSubjectId: id,
      selectedSubjectName: subject?.name || '',
      selectedSubjectAge: age,
      selectedSubjectRelation: relation,
      isRemoteOrder: !!isRemote,
      riskFactors,
      authAgreed: false,
      authSignerName: '',
      authSignerRelation: relation || '',
      riskAcknowledged: false,
      canNext: true,
    });
  },

  addNewSubject() {
    wx.navigateTo({ url: '/pages/health/add-member/add-member' });
  },

  onInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [`form.${field}`]: e.detail.value,
    });
    this.checkCanNext();
  },

  async openHospitalPicker() {
    if (!this.data.hospitalRegionsInited) {
      try {
        const res: any = await get('/hospitals/regions');
        const { provinceOptions, regionCitiesByProvince } = parseHospitalsRegionsResponse(res);
        const pIdx = 0;
        const selP = provinceOptions[pIdx]?.province ?? '';
        const cityOptionsRow = selP
          ? buildCityRowFromMap(selP, regionCitiesByProvince)
          : [{ label: '全部地区', city: '' }];
        this.setData({
          hospitalRegionsInited: true,
          hospitalProvinceOptions: provinceOptions,
          hospitalRegionCitiesByProvince: regionCitiesByProvince,
          hospitalProvinceIndex: pIdx,
          hospitalCityOptionsRow: cityOptionsRow,
          hospitalCityIndex: 0,
          hospitalShowCityRow: Boolean(selP) && cityOptionsRow.length > 1,
        });
      } catch (e) {
        console.warn('加载医院地区失败', e);
        const { provinceOptions, regionCitiesByProvince } = parseHospitalsRegionsResponse(null);
        const selP = provinceOptions[0]?.province ?? '';
        const cityOptionsRow = selP
          ? buildCityRowFromMap(selP, regionCitiesByProvince)
          : [{ label: '全部地区', city: '' }];
        this.setData({
          hospitalRegionsInited: true,
          hospitalProvinceOptions: provinceOptions,
          hospitalRegionCitiesByProvince: regionCitiesByProvince,
          hospitalProvinceIndex: 0,
          hospitalCityOptionsRow: cityOptionsRow,
          hospitalCityIndex: 0,
          hospitalShowCityRow: Boolean(selP) && cityOptionsRow.length > 1,
        });
      }
    }
    this.setData({
      hospitalSheetVisible: true,
      hospitalKeyword: '',
    });
    this.fetchHospitalList('');
  },

  onHospitalProvinceChipTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    const kw = this.data.hospitalKeyword || '';
    const opts = this.data.hospitalProvinceOptions || [];
    const p = opts[idx]?.province ?? '';
    const cmap = this.data.hospitalRegionCitiesByProvince || {};
    const row = !p
      ? [{ label: '全部地区', city: '' }]
      : buildCityRowFromMap(p, cmap);
    this.setData(
      {
        hospitalProvinceIndex: idx,
        hospitalCityIndex: 0,
        hospitalCityOptionsRow: row,
        hospitalShowCityRow: Boolean(p) && row.length > 1,
      },
      () => {
        this.fetchHospitalList(kw);
      },
    );
  },

  onHospitalCityChipTap(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (Number.isNaN(idx)) return;
    const kw = this.data.hospitalKeyword || '';
    this.setData({ hospitalCityIndex: idx }, () => {
      this.fetchHospitalList(kw);
    });
  },

  closeHospitalPicker() {
    this.setData({ hospitalSheetVisible: false });
  },

  onHospitalKeywordInput(e: any) {
    const kw = e.detail.value || '';
    this.setData({ hospitalKeyword: kw });
    if (hospitalSearchDebounceTimer) {
      clearTimeout(hospitalSearchDebounceTimer);
    }
    hospitalSearchDebounceTimer = setTimeout(() => {
      hospitalSearchDebounceTimer = null;
      this.fetchHospitalList(kw);
    }, 320);
  },

  async fetchHospitalList(keyword: string) {
    this.setData({ hospitalListLoading: true });
    try {
      const popts = this.data.hospitalProvinceOptions || [];
      const pOpt = popts[this.data.hospitalProvinceIndex] || popts[0] || { province: '' };
      const row = this.data.hospitalCityOptionsRow || [{ label: '全部地区', city: '' }];
      const cOpt = row[this.data.hospitalCityIndex] || row[0];
      const params: Record<string, string | number> = { page: 1, pageSize: 50 };
      const kw = String(keyword ?? '').trim();
      if (kw) params.keyword = kw;
      if (pOpt?.province) params.province = pOpt.province;
      if (cOpt?.city) params.city = cOpt.city;

      const res: any = await get('/hospitals', params);
      this.setData({
        hospitalListItems: res.items || [],
        hospitalListLoading: false,
      });
    } catch (e) {
      console.error('加载医院名录失败', e);
      this.setData({ hospitalListLoading: false });
    }
  },

  selectHospitalFromList(e: any) {
    const id = Number(e.currentTarget.dataset.id);
    const item = this.data.hospitalListItems.find((x: any) => Number(x.id) === id);
    if (!item || !id) return;
    const line = formatHospitalLine(item);
    this.setData({
      selectedHospitalId: id,
      hospitalDirectoryLine: line,
      hospitalManualMode: false,
      hospitalSheetVisible: false,
      'form.hospital': '',
    });
    this.checkCanNext();
  },

  switchToManualHospital() {
    this.setData({
      hospitalManualMode: true,
      selectedHospitalId: 0,
      hospitalDirectoryLine: '',
      'form.hospital': '',
      hospitalSheetVisible: false,
    });
    this.checkCanNext();
  },

  switchToDirectoryHospital() {
    this.setData({
      hospitalManualMode: false,
      'form.hospital': '',
    });
    this.checkCanNext();
  },

  onDateChange(e: any) {
    this.setData({ 'form.serviceDate': e.detail.value });
    this.checkCanNext();
  },

  onTimeChange(e: any) {
    this.setData({ 'form.serviceTime': e.detail.value });
    this.checkCanNext();
  },

  onEndDateChange(e: any) {
    this.setData({ 'form.serviceEndDate': e.detail.value });
    this.checkCanNext();
  },

  onEndTimeChange(e: any) {
    this.setData({ 'form.serviceEndTime': e.detail.value });
    this.checkCanNext();
  },

  checkCanNext() {
    const {
      currentStep,
      selectedSubjectId,
      form,
      hospitalManualMode,
      selectedHospitalId,
      hospitalDirectoryLine,
    } = this.data;
    let canNext = false;

    if (currentStep === 0) {
      canNext = !!selectedSubjectId;
    } else if (currentStep === 1) {
      const hospiceOk =
        (!hospitalManualMode && selectedHospitalId > 0 && !!hospitalDirectoryLine) ||
        (hospitalManualMode && !!(form.hospital || '').trim());
      canNext = !!(form.serviceDate && form.serviceTime && hospiceOk);
    } else if (currentStep === 2) {
      const authOk = !this.data.isRemoteOrder || this.data.authAgreed;
      const riskOk = this.data.riskFactors.length === 0 || this.data.riskAcknowledged;
      canNext = authOk && riskOk;
    }

    this.setData({ canNext });
  },

  prevStep() {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 });
      this.checkCanNext();
    }
  },

  async nextStep() {
    if (!this.data.canNext) return;

    if (this.data.currentStep < 2) {
      this.setData({ currentStep: this.data.currentStep + 1 });
      this.checkCanNext();
      return;
    }

    if (this.data.submitting) return;

    const {
      hospitalManualMode,
      selectedHospitalId,
      hospitalDirectoryLine,
      form: f,
    } = this.data;
    const hospiceOk =
      (!hospitalManualMode && selectedHospitalId > 0) ||
      (hospitalManualMode && (f.hospital || '').trim());
    if (!hospiceOk) {
      wx.showToast({ title: '请选择或填写就诊医院', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    try {
      const { form, serviceType, selectedSubjectId } = this.data;
      const startIso = toIsoWithLocalOffset(`${form.serviceDate}T${form.serviceTime}:00`);
      const body: Record<string, unknown> = {
        serviceType: SERVICE_TYPES[serviceType] || serviceType,
        serviceTargetId: Number(selectedSubjectId),
        serviceTime: startIso,
        notes: form.remark,
      };
      let endDate = form.serviceEndDate;
      const endTime = form.serviceEndTime;
      if (!endDate && endTime && form.serviceDate) {
        endDate = form.serviceDate;
      }
      if ((endDate && !endTime) || (!endDate && endTime)) {
        wx.showToast({ title: '结束请同时选择日期与时间', icon: 'none' });
        this.setData({ submitting: false });
        return;
      }
      if (endDate && endTime) {
        const endIso = toIsoWithLocalOffset(`${endDate}T${endTime}:00`);
        if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
          wx.showToast({ title: '结束时间不能早于开始', icon: 'none' });
          this.setData({ submitting: false });
          return;
        }
        body.serviceEndTime = endIso;
      }
      const dept = (form.department || '').trim();
      if (dept) body.department = dept;
      if (!hospitalManualMode && selectedHospitalId > 0) {
        body.hospitalDirectoryId = selectedHospitalId;
        if (hospitalDirectoryLine) body.hospital = hospitalDirectoryLine;
      } else {
        body.hospital = (form.hospital || '').trim();
      }
      if (this.data.isRemoteOrder && this.data.authAgreed) {
        body.remoteAuth = {
          authorized: true,
          signerName: this.data.authSignerName,
          signerRelation: this.data.authSignerRelation,
          authorizedAt: new Date().toISOString(),
        };
      }
      if (this.data.riskFactors.length > 0 && this.data.riskAcknowledged) {
        body.riskDisclosure = {
          acknowledged: true,
          factors: this.data.riskFactors,
          acknowledgedAt: new Date().toISOString(),
        };
      }
      const order: any = await post('/orders', body);

      wx.showToast({ title: '提交成功', icon: 'success' });
      setTimeout(() => {
        wx.redirectTo({
          url: `/pages/order/success/success?orderId=${order.id || order.orderId || ''}`,
        });
      }, 500);
    } catch (e: any) {
      console.error('提交订单失败', e);
      wx.showToast({ title: e?.message || '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openAuthModal() {
    this.setData({ showAuthModal: true });
  },

  closeAuthModal() {
    this.setData({ showAuthModal: false });
  },

  onAuthSignerNameInput(e: any) {
    this.setData({ authSignerName: e.detail.value });
  },

  onAuthSignerRelationChange(e: any) {
    this.setData({ authSignerRelation: e.currentTarget.dataset.value });
  },

  confirmAuth() {
    if (!this.data.authSignerName.trim()) {
      wx.showToast({ title: '请填写授权人姓名', icon: 'none' });
      return;
    }
    this.setData({ authAgreed: true, showAuthModal: false });
    this.checkCanNext();
  },

  toggleAuthAgree() {
    this.setData({ authAgreed: !this.data.authAgreed });
    this.checkCanNext();
  },

  openRiskModal() {
    this.setData({ showRiskModal: true });
  },

  closeRiskModal() {
    this.setData({ showRiskModal: false });
  },

  confirmRisk() {
    this.setData({ riskAcknowledged: true, showRiskModal: false });
    this.checkCanNext();
  },

  toggleRiskAcknowledge() {
    this.setData({ riskAcknowledged: !this.data.riskAcknowledged });
    this.checkCanNext();
  },

  goBack() {
    wx.navigateBack();
  },
});
