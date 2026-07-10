import { get, put, getPublic, putPublic } from '../../utils/request';
import { isLoggedIn } from '../../utils/auth';
import {
  ensureAdminPageAccess,
  ensureUserPageAccess,
  navigateBackOrHome,
  navigateToUserLogin,
} from '../../utils/identity';
import { renderHealthSignShareCover } from '../../utils/share-cover';

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
  hasSignInvalidatedTipShown: false,

  data: {
    statusBarHeight: 20,
    pageNeedsLogin: false,
    isQrMode: false,
    isAdminMode: false,
    sceneCode: '',
    isNew: true,
    canViewSignedDoc: false,
    subjectId: '',
    targetName: '',
    targetGender: '',
    targetAge: '' as string | number,
    bloodTypeOptions: ['A型', 'B型', 'AB型', 'O型', '不详'],
    emergencyRelationOptions: ['配偶', '父母', '子女', '兄弟姐妹', '朋友', '护理人员', '其他'],
    signerRelationOptions: [
      { value: 'spouse', label: '配偶' },
      { value: 'child', label: '子女' },
      { value: 'father', label: '父亲' },
      { value: 'mother', label: '母亲' },
      { value: 'parent', label: '父母（旧数据）' },
      { value: 'sibling', label: '兄弟姐妹' },
      { value: 'caregiver', label: '护理人员' },
      { value: 'friend', label: '朋友' },
      { value: 'other', label: '其他' },
    ],
    medicalHistoryOptions: [
      { value: 'none', label: '无' },
      { value: 'hypertension', label: '高血压' },
      { value: 'heart', label: '心脏病' },
      { value: 'cerebrovascular', label: '脑血管疾病' },
      { value: 'diabetes', label: '糖尿病' },
      { value: 'epilepsy', label: '癫痫' },
      { value: 'asthma', label: '哮喘/慢阻肺' },
      { value: 'mental', label: '精神类疾病' },
      { value: 'cancer', label: '癌症' },
      { value: 'other', label: '其他' },
    ],
    recentSymptomsOptions: [
      { value: 'none', label: '无明显症状' },
      { value: 'syncope', label: '晕厥/眩晕/跌倒' },
      { value: 'chest_pain', label: '胸痛/胸闷/心慌' },
      { value: 'dyspnea', label: '呼吸困难' },
      { value: 'fatigue', label: '乏力/疲劳' },
      { value: 'pain', label: '持续性疼痛' },
      { value: 'insomnia', label: '失眠/睡眠障碍' },
      { value: 'appetite_loss', label: '食欲下降' },
      { value: 'other', label: '其他' },
    ],
    importantNoticeRead: false,
    showImportantNotice: false,
    form: {
      name: '',
      gender: '',
      age: '',
      phone: '',
      homeRegion: [] as string[],
      homeRegionText: '',
      homeAddressDetail: '',
      idCard: '',
      emergencyContact: '',
      emergencyRelation: '',
      emergencyPhone: '',
      /** 与后台文档模板一致：self | dictation | proxy | other */
      fillMethod: 'self',
      /** independent | mild_assist | wheelchair | bedridden */
      mobilityStatus: 'independent',
      bloodType: '',
      allergyStatus: 'none' as 'none' | 'has',
      allergies: '',
      medicalHistoryArr: [] as string[],
      medicalHistoryOther: '',
      visionStatus: '',
      hearingStatus: '',
      recentSymptoms: [] as string[],
      recentSymptomsOther: '',
      currentMedication: '',
      chiefComplaint: '',
      signatureName: '',
      hasSigned: false,
      signatureUrl: '',
      signerName: '',
      signerRelation: '',
    },
  },

  _adminMode: false,
  _proxyMode: false,
  _qrScene: '' as string,
  // 是否已从后台加载过档案。首次进入后置为 true，之后的 onShow
  // （如签署页返回）不再拉取覆盖，避免用户在本地填写的数据被旧数据冲掉。
  _profileLoaded: false,

  onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    const subjectId = options.subjectId || '';
    this._adminMode = options.adminMode === '1' || options.adminMode === 1;
    this._proxyMode = options.proxyMode === '1' || options.proxyMode === 1;
    this._qrScene = options.qrScene || '';
    this._profileLoaded = false;
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      subjectId,
      isQrMode: !!this._qrScene,
      isAdminMode: this._adminMode,
    });
    if (this._proxyMode) {
      this.setData({ 'form.fillMethod': 'proxy' });
    }
  },

  async onShow() {
    if (this._qrScene) {
      this.setData({ pageNeedsLogin: false });
      if (!this._profileLoaded) {
        await this.loadProfileByQr(this._qrScene);
        this._profileLoaded = true;
      }
      return;
    }
    if (!isLoggedIn()) {
      this.setData({ pageNeedsLogin: true });
      return;
    }
    this.setData({ pageNeedsLogin: false });
    if (this._adminMode) {
      if (!ensureAdminPageAccess()) return;
    } else if (this._proxyMode) {
      // proxy mode: attendants can fill on behalf of patient, skip user-only check
    } else {
      if (!(await ensureUserPageAccess())) return;
    }
    if (this.data.subjectId && !this._profileLoaded) {
      await this.loadProfile(this.data.subjectId);
      this._profileLoaded = true;
    }
    if (this._adminMode && this.data.subjectId) {
      void this._prefetchSceneCode();
    }
  },

  /** 管理员模式：预取签署页的 scene code，用于转发签署分享 */
  async _prefetchSceneCode() {
    if (this.data.sceneCode) return;
    try {
      const res: any = await get(`/orders/health-sign-scene/${this.data.subjectId}`);
      if (res?.sceneCode) {
        this.setData({ sceneCode: res.sceneCode });
      }
    } catch (e) {
      console.warn('获取签署 scene code 失败', e);
    }
  },

  goLoginFromGate() {
    navigateToUserLogin();
  },

  backFromGate() {
    navigateBackOrHome();
  },

  _applyProfileData(res: any) {
    const hp = typeof res.healthProfile === 'string'
      ? JSON.parse(res.healthProfile || '{}')
      : (res.healthProfile || {});
    const genderLabel =
      res.gender === 'male' ? '男' : res.gender === 'female' ? '女' : (res.gender || '');

    const hasHealthData = !!(
      (hp.fillMethod && hp.fillMethod !== 'self') ||
      (hp.mobilityStatus && hp.mobilityStatus !== 'independent') ||
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
      res.mainAppeal ||
      res.emergencyContact ||
      res.emergencyPhone
    );

    const hasSubmittedSignature = !!(res.signatureUrl || (res as any).signature_url || hp.signatureUrl || hp.signUrl);

    this.setData({
      isNew: !hasHealthData,
      canViewSignedDoc: hasSubmittedSignature,
      targetName: res.name || '',
      targetGender: genderLabel,
      targetAge: res.age ?? '',
      form: {
        name: res.name || '',
        gender: genderLabel,
        age: res.age ?? '',
        phone: res.phone || '',
        homeRegion: hp.homeRegion || [],
        homeRegionText: (hp.homeRegion || []).join(' '),
        // 旧数据兼容：healthProfile 无 homeAddressDetail 但 res.homeAddress 有值时，
        // 把原完整地址预填到"详细地址"字段，便于用户在此基础上修改。
        homeAddressDetail: hp.homeAddressDetail
          || (!(hp.homeRegion && hp.homeRegion.length) ? (res.homeAddress || '') : ''),
        idCard: res.idCard || '',
        emergencyContact: res.emergencyContact || '',
        emergencyRelation: hp.emergencyRelation || '',
        emergencyPhone: res.emergencyPhone || '',
        fillMethod: this._proxyMode ? 'proxy' : (hp.fillMethod || 'self'),
        mobilityStatus: hp.mobilityStatus || 'independent',
        bloodType: hp.bloodType || '',
        allergyStatus: (hp.allergies && hp.allergies !== '无') ? 'has' : 'none',
        allergies: (hp.allergies && hp.allergies !== '无') ? hp.allergies : '',
        medicalHistoryArr: hp.medicalHistory || [],
        medicalHistoryOther: hp.medicalHistoryOther || '',
        visionStatus: hp.visionStatus || '',
        hearingStatus: hp.hearingStatus || '',
        recentSymptoms: hp.recentSymptoms || [],
        recentSymptomsOther: hp.recentSymptomsOther || '',
        currentMedication: hp.currentMedications || hp.currentMedication || '',
        chiefComplaint: res.mainAppeal || '',
        signatureName: decodeName(hp.signatureName || res.name || ''),
        hasSigned: !!(res.signatureUrl || (res as any).signature_url || hp.signatureUrl || hp.signUrl),
        signatureUrl: res.signatureUrl || (res as any).signature_url || hp.signatureUrl || hp.signUrl || '',
        signerName: hp.signerName || '',
        signerRelation: hp.signerRelation || '',
      },
    });
    this.hasSignInvalidatedTipShown = false;
  },

  async loadProfile(id: string) {
    try {
      const res: any = await get(`/users/service-targets/${id}`);
      this._applyProfileData(res);
    } catch (e) {
      console.error('加载档案失败', e);
    }
  },

  async loadProfileByQr(sceneCode: string) {
    try {
      const res: any = await getPublic(`/public/health-profile/${sceneCode}`);
      this.setData({ subjectId: String(res.id || '') });
      this._applyProfileData(res);
    } catch (e: any) {
      console.error('加载档案失败', e);
      wx.showModal({
        title: '无法访问',
        content: e?.message || '二维码无效或已过期，请联系管理员重新生成',
        showCancel: false,
      });
    }
  },

  // 任何字段变动时作废旧签名，要求重新签署
  invalidateSignatureIfNeeded() {
    if (!this.data.form.hasSigned) return;
    this.setData({
      'form.hasSigned': false,
      'form.signatureUrl': '',
      'form.signatureName': '',
      canViewSignedDoc: false,
    });
    if (!this.hasSignInvalidatedTipShown) {
      wx.showToast({ title: '信息已修改，请重新签署', icon: 'none' });
      this.hasSignInvalidatedTipShown = true;
    }
  },

  onInput(e: any) {
    this.invalidateSignatureIfNeeded();
    const field = e.currentTarget.dataset.field;
    const val = field === 'idCard'
      ? String(e.detail.value || '').replace(/\s/g, '').toUpperCase()
      : e.detail.value;
    this.setData({ [`form.${field}`]: val });
  },

  onEmergencyPhoneInput(e: any) {
    this.invalidateSignatureIfNeeded();
    const phone = (e.detail.value || '').replace(/\D/g, '').slice(0, 11);
    this.setData({ 'form.emergencyPhone': phone });
  },

  setBloodType(e: any) {
    this.invalidateSignatureIfNeeded();
    this.setData({ 'form.bloodType': e.currentTarget.dataset.val });
  },

  onRegionChange(e: any) {
    this.invalidateSignatureIfNeeded();
    const region: string[] = e.detail.value || [];
    this.setData({
      'form.homeRegion': region,
      'form.homeRegionText': region.join(' '),
    });
  },

  setFillMethod(e: any) {
    this.invalidateSignatureIfNeeded();
    const val = e.currentTarget.dataset.val;
    this.setData({ 'form.fillMethod': val });
    if (val === 'self' || val === 'dictation') {
      this.setData({ 'form.signerName': '', 'form.signerRelation': '' });
    }
  },

  onEmergencyRelationChange(e: any) {
    const idx = Number(e.detail.value);
    const val = this.data.emergencyRelationOptions[idx] || '';
    this.setData({ 'form.emergencyRelation': val });
  },

  setSignerRelation(e: any) {
    this.invalidateSignatureIfNeeded();
    this.setData({ 'form.signerRelation': e.currentTarget.dataset.val });
  },

  setMobilityStatus(e: any) {
    this.invalidateSignatureIfNeeded();
    this.setData({ 'form.mobilityStatus': e.currentTarget.dataset.val });
  },

  setAllergyStatus(e: any) {
    this.invalidateSignatureIfNeeded();
    const val = e.currentTarget.dataset.val;
    this.setData({
      'form.allergyStatus': val,
      'form.allergies': val === 'none' ? '' : this.data.form.allergies,
    });
  },

  toggleMedHistory(e: any) {
    this.invalidateSignatureIfNeeded();
    const val = e.currentTarget.dataset.val;
    const arr = [...this.data.form.medicalHistoryArr];
    const idx = arr.indexOf(val);
    if (val === 'none') {
      this.setData({ 'form.medicalHistoryArr': idx >= 0 ? [] : ['none'] });
      return;
    }
    const noneIdx = arr.indexOf('none');
    if (noneIdx >= 0) arr.splice(noneIdx, 1);
    if (idx >= 0) arr.splice(idx, 1);
    else arr.push(val);
    this.setData({ 'form.medicalHistoryArr': arr });
  },

  setVision(e: any) {
    this.invalidateSignatureIfNeeded();
    this.setData({ 'form.visionStatus': e.currentTarget.dataset.val });
  },

  setHearing(e: any) {
    this.invalidateSignatureIfNeeded();
    this.setData({ 'form.hearingStatus': e.currentTarget.dataset.val });
  },

  toggleRecentSymptom(e: any) {
    this.invalidateSignatureIfNeeded();
    const val = e.currentTarget.dataset.val;
    const arr = [...this.data.form.recentSymptoms];
    const idx = arr.indexOf(val);
    if (val === 'none') {
      this.setData({ 'form.recentSymptoms': idx >= 0 ? [] : ['none'], 'form.recentSymptomsOther': '' });
      return;
    }
    const noneIdx = arr.indexOf('none');
    if (noneIdx >= 0) arr.splice(noneIdx, 1);
    if (idx >= 0) {
      arr.splice(idx, 1);
      if (val === 'other') this.setData({ 'form.recentSymptomsOther': '' });
    } else {
      arr.push(val);
    }
    this.setData({ 'form.recentSymptoms': arr });
  },

  // 统一校验方法：签名前 & 保存前都调用
  validateBeforeSign(): boolean {
    const form = this.data.form;
    const idCard = (form.idCard || '').trim().toUpperCase();
    const emergencyContact = (form.emergencyContact || '').trim();
    const emergencyRelation = (form.emergencyRelation || '').trim();
    const emergencyPhone = (form.emergencyPhone || '').trim();
    const chiefComplaint = (form.chiefComplaint || '').trim();

    if (!idCard) {
      wx.showToast({ title: '请填写身份证号', icon: 'none' }); return false;
    }
    if (!/^\d{17}[\dX]$/.test(idCard)) {
      wx.showToast({ title: '请输入正确的18位身份证号', icon: 'none' }); return false;
    }
    if (!emergencyContact || !emergencyRelation || !emergencyPhone) {
      wx.showToast({ title: '请完整填写紧急联系人信息', icon: 'none' }); return false;
    }
    if (!/^1[3-9]\d{9}$/.test(emergencyPhone)) {
      wx.showToast({ title: '紧急联系人手机号格式不正确', icon: 'none' }); return false;
    }
    if (!form.fillMethod) {
      wx.showToast({ title: '请选择信息记录方式', icon: 'none' }); return false;
    }
    if ((form.fillMethod === 'proxy' || form.fillMethod === 'other') && !(form.signerName || '').trim()) {
      wx.showToast({ title: '请填写填写人姓名', icon: 'none' }); return false;
    }
    if ((form.fillMethod === 'proxy' || form.fillMethod === 'other') && !form.signerRelation) {
      wx.showToast({ title: '请选择填写人与档案人的关系', icon: 'none' }); return false;
    }
    if (!form.mobilityStatus) {
      wx.showToast({ title: '请选择行动能力', icon: 'none' }); return false;
    }
    if (!form.bloodType) {
      wx.showToast({ title: '请选择血型', icon: 'none' }); return false;
    }
    if (form.allergyStatus === 'has' && !form.allergies.trim()) {
      wx.showToast({ title: '请填写过敏源', icon: 'none' }); return false;
    }
    if (!form.medicalHistoryArr.length) {
      wx.showToast({ title: '请至少选择一项既往病史', icon: 'none' }); return false;
    }
    if (form.medicalHistoryArr.includes('other') && !form.medicalHistoryOther.trim()) {
      wx.showToast({ title: '请补充其他病史', icon: 'none' }); return false;
    }
    if (!form.visionStatus) {
      wx.showToast({ title: '请选择视力情况', icon: 'none' }); return false;
    }
    if (!form.hearingStatus) {
      wx.showToast({ title: '请选择听力情况', icon: 'none' }); return false;
    }
    if (!form.recentSymptoms.length) {
      wx.showToast({ title: '请至少选择一项近期状况', icon: 'none' }); return false;
    }
    if (!chiefComplaint) {
      wx.showToast({ title: '请填写就医具体诉求', icon: 'none' }); return false;
    }
    return true;
  },

  toggleImportantNotice() {
    this.setData({ importantNoticeRead: !this.data.importantNoticeRead });
  },

  showImportantNoticePopup() {
    this.setData({ showImportantNotice: true });
  },

  closeImportantNotice() {
    this.setData({ showImportantNotice: false });
  },

  confirmImportantNotice() {
    this.setData({ showImportantNotice: false, importantNoticeRead: true });
  },

  goSign() {
    const { form, subjectId } = this.data;
    if (this._adminMode) {
      wx.showToast({ title: '管理员不可代签，请转发给档案人或代签人', icon: 'none' });
      return;
    }
    if (!form.name) {
      wx.showToast({ title: '档案人信息不完整', icon: 'none' });
      return;
    }
    if (!this.validateBeforeSign()) return;
    if (!this.data.importantNoticeRead) {
      wx.showToast({ title: '请先阅读并勾选《客户重要提示》', icon: 'none' });
      return;
    }

    const needsSignerInfo = form.fillMethod === 'proxy' || form.fillMethod === 'other';
    const signerLabel = needsSignerInfo && form.signerName
      ? form.signerName
      : form.name;

    const qrSceneParam = this._qrScene
      ? `&qrScene=${encodeURIComponent(this._qrScene)}`
      : '';
    wx.navigateTo({
      url: `/pages/health-profile-sign/health-profile-sign?subjectId=${subjectId}&name=${encodeURIComponent(signerLabel)}&signerName=${encodeURIComponent(form.signerName || '')}&signerRelation=${encodeURIComponent(form.signerRelation || '')}&fillMethod=${form.fillMethod}${qrSceneParam}`,
      events: {
        signComplete: (data: { signUrl: string; signatureName?: string }) => {
          const name = decodeName(data.signatureName || signerLabel);
          this.setData({
            'form.hasSigned': true,
            'form.signatureUrl': data.signUrl,
            'form.signatureName': name,
            canViewSignedDoc: false,
          });
        },
      },
      success: (res) => {
        res.eventChannel.emit('profileData', {
          name: form.name,
          gender: form.gender,
          age: form.age,
          phone: form.phone,
          homeAddress: (form.homeRegion || []).join('') + ((form.homeAddressDetail || '').trim() ? ' ' + (form.homeAddressDetail || '').trim() : ''),
          idCard: form.idCard,
          emergencyContact: form.emergencyContact,
          emergencyRelation: form.emergencyRelation,
          emergencyPhone: form.emergencyPhone,
          fillMethod: form.fillMethod,
          mobilityStatus: form.mobilityStatus,
          bloodType: form.bloodType,
          allergyStatus: form.allergyStatus,
          allergies: form.allergies,
          medicalHistoryArr: form.medicalHistoryArr,
          medicalHistoryOther: form.medicalHistoryOther,
          visionStatus: form.visionStatus,
          hearingStatus: form.hearingStatus,
          recentSymptoms: form.recentSymptoms,
          recentSymptomsOther: form.recentSymptomsOther,
          currentMedication: form.currentMedication,
          chiefComplaint: form.chiefComplaint,
          signerName: form.signerName,
          signerRelation: form.signerRelation,
        });
      },
    });
  },

  async handleSave() {
    const { form, subjectId } = this.data;

    if (!this.validateBeforeSign()) return;

    if (!this.data.importantNoticeRead) {
      wx.showToast({ title: '请先阅读并勾选《客户重要提示》', icon: 'none' }); return;
    }

    // 管理员模式：允许保存未签署版本，待档案人/代签人后续完成签署
    if (!this._adminMode && (!form.hasSigned || !form.signatureUrl)) {
      wx.showToast({ title: '请先完成签署', icon: 'none' }); return;
    }

    const idCard = (form.idCard || '').trim().toUpperCase();
    const emergencyContact = (form.emergencyContact || '').trim();
    const emergencyRelation = (form.emergencyRelation || '').trim();
    const emergencyPhone = (form.emergencyPhone || '').trim();
    const chiefComplaint = (form.chiefComplaint || '').trim();

    const needsSignerInfo = form.fillMethod === 'proxy' || form.fillMethod === 'other';

    const regionParts = form.homeRegion || [];
    const detail = (form.homeAddressDetail || '').trim();
    const fullAddress = regionParts.length
      ? regionParts.join('') + (detail ? ' ' + detail : '')
      : detail;

    const pendingSignature = this._adminMode && (!form.hasSigned || !form.signatureUrl);

    // 管理员模式：永远不回传签名字段，交由后端根据 hasHealthDocumentMutation 自行判断：
    //   - 核心字段有变动 → 清空签名（触发重新签署）
    //   - 核心字段无变动 → 保留原签名
    // 避免客户端带回旧 signatureUrl 覆盖后端清理后的空值，导致"改了信息但签名没失效"的漏洞。
    const omitSignatureFields = this._adminMode;

    try {
      const payload: any = {
        idCard,
        homeAddress: fullAddress || undefined,
        emergencyContact: emergencyContact || undefined,
        emergencyPhone: emergencyPhone || undefined,
        mainAppeal: chiefComplaint,
        signatureUrl: omitSignatureFields ? undefined : form.signatureUrl,
        healthProfile: {
          homeRegion: regionParts.length ? regionParts : undefined,
          homeAddressDetail: detail || undefined,
          emergencyRelation: emergencyRelation || undefined,
          fillMethod: form.fillMethod,
          mobilityStatus: form.mobilityStatus,
          bloodType: form.bloodType,
          allergies: form.allergyStatus === 'none' ? '无' : (form.allergies || ''),
          medicalHistory: form.medicalHistoryArr,
          medicalHistoryOther: form.medicalHistoryOther,
          visionStatus: form.visionStatus,
          hearingStatus: form.hearingStatus,
          recentSymptoms: form.recentSymptoms,
          recentSymptomsOther: form.recentSymptomsOther,
          currentMedication: form.currentMedication,
          currentMedications: form.currentMedication,
          signatureName: omitSignatureFields ? undefined : (form.signatureName || form.name),
          signedAt: omitSignatureFields ? undefined : new Date().toISOString(),
          signerName: needsSignerInfo ? (form.signerName || '').trim() : '',
          signerRelation: needsSignerInfo ? form.signerRelation : '',
        },
      };

      if (this._qrScene) {
        await putPublic(`/public/health-profile/${this._qrScene}`, payload);
      } else {
        await put(`/users/service-targets/${subjectId}`, payload);
      }
      this.setData({ isNew: false, canViewSignedDoc: !pendingSignature });
      this.hasSignInvalidatedTipShown = false;

      if (pendingSignature) {
        // 管理员保存草稿后，保留在当前页以便转发签署（wx 限制:分享只能由用户点击按钮触发）
        void this._prefetchSceneCode();
        wx.showToast({
          title: '档案已保存,请点击"转发签署"邀请档案人',
          icon: 'none',
          duration: 2600,
        });
        return;
      }

      wx.showToast({ title: '确认成功', icon: 'success' });

      setTimeout(() => {
        if (this._qrScene) {
          wx.showModal({
            title: '提交成功',
            content: '健康档案已成功提交，感谢您的填写。',
            showCancel: false,
            confirmText: '好的',
          });
        } else {
          wx.navigateBack();
        }
      }, 800);
    } catch (e) {
      console.error('保存失败', e);
    }
  },

  /** 页面级分享（仅管理员模式下有意义） */
  onShareAppMessage() {
    const { subjectId, sceneCode, form } = this.data;
    if (!this._adminMode) {
      return {
        title: '陪了个伴 - 家庭健康守护',
        path: '/pages/index/index',
      };
    }
    if (!sceneCode) {
      return {
        title: '陪了个伴 - 健康档案签署',
        path: '/pages/index/index',
      };
    }
    const subjectName = form.name || '就诊人';
    const needsSignerInfo = form.fillMethod === 'proxy' || form.fillMethod === 'other';
    const targetLabel = needsSignerInfo && form.signerName
      ? `${form.signerName}（${subjectName} 的代签人）`
      : subjectName;
    const title = `请为「${targetLabel}」填写并签署健康档案`;
    const path = `/pages/health-profile/health-profile?subjectId=${subjectId}&qrScene=${encodeURIComponent(sceneCode)}`;
    const coverInput = {
      subjectName,
      statusText: form.hasSigned ? '已签署' : '待签署',
    };
    // 符合微信官方规范：同步返回基础分享信息，promise 字段异步补图
    const shareInfo: any = { title, path };
    shareInfo.promise = renderHealthSignShareCover(this, coverInput).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
  },

  async viewSignedDoc() {
    const { subjectId } = this.data;
    if (this.data.isNew) {
      wx.showToast({ title: '请先确认提交健康档案', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/health-card/health-card?subjectId=${subjectId}`,
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
