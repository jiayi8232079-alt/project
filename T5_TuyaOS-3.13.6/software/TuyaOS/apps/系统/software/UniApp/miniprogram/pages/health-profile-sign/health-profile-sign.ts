import { BASE_URL } from '../../config';

// ── 签名笔画存储（Float32Array） ──────────────────────────────
// 以 [x0, y0, x1, y1, ...] 紧凑存储，每点只占 8 字节，远小于 JS 对象
// 的 ~40 字节；容量不够时按 2 倍扩容，避免每点都触发对象分配与 GC。
interface StrokeBuffer {
  data: Float32Array;
  len: number;
}

function createStroke(initial = 64): StrokeBuffer {
  return { data: new Float32Array(initial * 2), len: 0 };
}

function pushStrokePoint(s: StrokeBuffer, x: number, y: number): void {
  const needed = (s.len + 1) * 2;
  if (needed > s.data.length) {
    const next = new Float32Array(s.data.length * 2);
    next.set(s.data);
    s.data = next;
  }
  const i = s.len * 2;
  s.data[i] = x;
  s.data[i + 1] = y;
  s.len++;
}

// 抽稀：偶数下标保留 + 始终保留最后一个点，长度折半。
// 用于单笔超长（>1000 点）时释放内存，视觉上几乎无差异。
function decimateStroke(s: StrokeBuffer): void {
  if (s.len < 3) return;
  const maxOut = Math.ceil(s.len / 2) + 1;
  const next = new Float32Array(maxOut * 2);
  let k = 0;
  for (let i = 0; i < s.len; i += 2) {
    next[k * 2] = s.data[i * 2];
    next[k * 2 + 1] = s.data[i * 2 + 1];
    k++;
  }
  const lastI = s.len - 1;
  if (lastI % 2 !== 0) {
    next[k * 2] = s.data[lastI * 2];
    next[k * 2 + 1] = s.data[lastI * 2 + 1];
    k++;
  }
  s.data = next;
  s.len = k;
}

// 单笔最大点数阈值（签名常见 200-400 点；>1000 视为长期抖动，触发抽稀）
const STROKE_DECIMATE_THRESHOLD = 1000;
// 去抖：两次 touchmove 距离平方小于此值视为同位置，忽略入队，
// 既过滤指尖微抖，也避免重复点造成 canvas 绘制压力。
const MIN_MOVE_DIST_SQ = 1.0;

const FILL_METHOD_LABEL: Record<string, string> = {
  self: '本人自填', dictation: '本人口述代填', proxy: '家属代填', other: '其他',
};
const MOBILITY_LABEL: Record<string, string> = {
  independent: '行动自如', mild_assist: '需轻度辅助', wheelchair: '需轮椅', bedridden: '卧床',
};
const VISION_LABEL: Record<string, string> = {
  good: '正常', poor: '视力减退', blind: '严重视力障碍',
};
const HEARING_LABEL: Record<string, string> = {
  good: '正常', poor: '听力减退', deaf: '严重听力障碍',
};
const MEDICAL_LABEL: Record<string, string> = {
  none: '无', hypertension: '高血压', heart: '心脏病', cerebrovascular: '脑血管疾病',
  diabetes: '糖尿病', epilepsy: '癫痫', asthma: '哮喘/慢阻肺',
  mental: '精神类疾病', cancer: '癌症', other: '其他',
};
const SYMPTOM_LABEL: Record<string, string> = {
  none: '无明显症状', syncope: '晕厥/眩晕/跌倒', chest_pain: '胸痛/胸闷/心慌',
  dyspnea: '呼吸困难', fatigue: '乏力/疲劳', pain: '持续性疼痛',
  insomnia: '失眠/睡眠障碍', appetite_loss: '食欲下降', other: '其他',
};
const SIGNER_RELATION_LABEL: Record<string, string> = {
  spouse: '配偶', child: '子女', father: '父亲', mother: '母亲', parent: '父母', sibling: '兄弟姐妹',
  caregiver: '护理人员', friend: '朋友', other: '其他',
};

Page({
  data: {
    statusBarHeight: 0,
    signName: '',
    subjectId: '',
    qrScene: '',
    hasSigned: false,
    submitting: false,
    isProxy: false,
    signerName: '',
    signerRelation: '',
    showInfo: false,
    profile: null as any,
    // 档案弹层 scroll-view 的像素高度；横屏下 flex:1 拿不到高度，必须显式指定
    sheetBodyHeight: 0,
  },

  canvas: null as any,
  ctx: null as any,
  lastX: 0,
  lastY: 0,
  drawing: false,
  eventChannel: null as any,
  _dpr: 1 as number,
  // 当前 canvas 内部像素尺寸（用于判断旋转后是否需要重建）
  _canvasWidth: 0,
  _canvasHeight: 0,
  _canvasInitRetry: 0,
  _canvasInitTimer: 0 as any,
  // 记录所有笔画，便于旋转重建画布后重放，避免已绘签名丢失
  _strokes: [] as StrokeBuffer[],
  _currentStroke: null as StrokeBuffer | null,
  // touchmove 高频事件节流：收集本帧增量点，交给 RAF 批量刷到画布
  _pendingPoints: [] as Array<{ x: number; y: number }>,
  _rafScheduled: false as boolean,
  // 去抖：最近一次真正入队的点，用于拒绝距离过近的新点
  _lastQueuedX: 0,
  _lastQueuedY: 0,

  onLoad(options: any) {
    try {
      const sys = wx.getWindowInfo();
      // 横屏下 statusBarHeight 仍需保留，避免刘海/灵动岛遮挡
      this.setData({ statusBarHeight: sys.statusBarHeight || 0 });
    } catch {}
    const rawName = options.name || options.signName || '';
    let signName = '档案人';
    if (rawName) {
      try {
        let decoded = rawName;
        while (decoded.includes('%') && decoded !== decodeURIComponent(decoded)) {
          decoded = decodeURIComponent(decoded);
        }
        signName = decoded;
      } catch {
        signName = rawName;
      }
    }
    const subjectId = options.subjectId || '';
    const fillMethod = options.fillMethod || 'self';
    const isProxy = fillMethod === 'proxy' || fillMethod === 'other';
    let qrScene = '';
    if (options.qrScene) {
      try { qrScene = decodeURIComponent(options.qrScene); }
      catch { qrScene = options.qrScene; }
    }

    let signerName = '';
    if (options.signerName) {
      try { signerName = decodeURIComponent(options.signerName); }
      catch { signerName = options.signerName; }
    }
    let signerRelation = '';
    if (options.signerRelation) {
      try { signerRelation = decodeURIComponent(options.signerRelation); }
      catch { signerRelation = options.signerRelation; }
    }

    this.setData({
      signName: isProxy && signerName ? signerName : signName,
      subjectId,
      qrScene,
      isProxy,
      signerName,
      signerRelation,
    });

    const eventChannel = this.getOpenerEventChannel?.();
    if (eventChannel) {
      this.eventChannel = eventChannel;
      eventChannel.on('profileData', (data: any) => {
        this.setData({ profile: this._buildSummary(data) });
      });
    }
  },

  _buildSummary(d: any) {
    const medArr: string[] = (d.medicalHistoryArr || [])
      .filter((v: string) => v && v !== 'none')
      .map((v: string) => MEDICAL_LABEL[v] || v);
    if (d.medicalHistoryOther) medArr.push(d.medicalHistoryOther);
    const sympArr: string[] = (d.recentSymptoms || [])
      .filter((v: string) => v && v !== 'none')
      .map((v: string) => SYMPTOM_LABEL[v] || v);
    if (d.recentSymptomsOther) sympArr.push(d.recentSymptomsOther);

    return {
      name: d.name || '',
      gender: d.gender || '',
      age: d.age || '',
      phone: d.phone || '',
      homeAddress: d.homeAddress || '',
      idCard: d.idCard ? d.idCard.replace(/^(.{4}).*(.{4})$/, '$1**********$2') : '',
      emergencyContact: d.emergencyContact || '',
      emergencyRelation: d.emergencyRelation || '',
      emergencyPhone: d.emergencyPhone || '',
      fillMethod: FILL_METHOD_LABEL[d.fillMethod] || d.fillMethod || '',
      mobilityStatus: MOBILITY_LABEL[d.mobilityStatus] || d.mobilityStatus || '',
      bloodType: d.bloodType || '',
      allergyStatus: d.allergyStatus === 'has' ? '有' : '无',
      allergies: d.allergies || '',
      medicalHistory: medArr.length ? medArr.join('、') : '无',
      visionStatus: VISION_LABEL[d.visionStatus] || d.visionStatus || '',
      hearingStatus: HEARING_LABEL[d.hearingStatus] || d.hearingStatus || '',
      recentSymptoms: sympArr.length ? sympArr.join('、') : '无明显症状',
      currentMedication: d.currentMedication || '无',
      chiefComplaint: d.chiefComplaint || '',
      signerName: d.signerName || '',
      signerRelation: SIGNER_RELATION_LABEL[d.signerRelation] || d.signerRelation || '',
    };
  },

  onReady() {
    // 首次初始化：等待 page-container 绘制 + 横屏旋转完成
    this._scheduleInitCanvas(160);
  },

  // 横屏旋转完成后 WeChat 会触发 onResize，此时再重建画布，
  // 保证 canvas 内部像素尺寸与当前 CSS 尺寸一致，避免旋转前取到的竖屏尺寸
  // 被拉伸绘制到横屏视窗上（表现为签名只落在屏幕左侧一条窄带里）。
  // 延迟略放宽到 80ms，等待 page-container 的尺寸稳定，降低基础库渲染层
  // 在转换期内部状态异常的概率（曾见 2.32.3 上 _getData is not a function）。
  onResize() {
    this._scheduleInitCanvas(80);
  },

  _scheduleInitCanvas(delay = 100) {
    if (this._canvasInitTimer) {
      clearTimeout(this._canvasInitTimer);
    }
    this._canvasInitRetry = 0;
    this._canvasInitTimer = setTimeout(() => this.initCanvas(), delay);
  },

  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#signCanvas')
      .fields({ node: true, size: true })
      .exec((res: any) => {
        // node / size 任一未就绪都视为需要重试，避免后续访问 node.node 时空引用
        if (!res?.[0] || !res[0].node) {
          if (this._canvasInitRetry++ < 8) {
            this._canvasInitTimer = setTimeout(() => this.initCanvas(), 120);
          }
          return;
        }
        const node = res[0];
        const width = node.width || 0;
        const height = node.height || 0;
        // 仅要求 canvas 已经有合理像素尺寸；不再强制"宽>高"。
        // 老逻辑要求横屏才通过，但 && retry<8 的短路会在重试耗尽后
        // 把当前异常尺寸（可能仍是竖屏或过小）写进 canvas.width，
        // 导致绘制被压缩到屏幕左侧一条窄带。横竖屏方向的变化改由
        // onResize 再次触发本函数并结合下方的 orientationChanged 处理。
        if ((width < 60 || height < 60) && this._canvasInitRetry < 8) {
          this._canvasInitRetry++;
          this._canvasInitTimer = setTimeout(() => this.initCanvas(), 120);
          return;
        }
        if (width < 60 || height < 60) {
          // 重试 8 次仍未拿到合理尺寸：放弃本轮写入，等待下一次 onResize
          return;
        }

        const canvas = node.node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getWindowInfo().pixelRatio || 1;
        const pxW = Math.round(width * dpr);
        const pxH = Math.round(height * dpr);
        // 像素尺寸相同且 canvas 方向未翻转时跳过重建，保留已绘签名；
        // 但只要横/竖屏发生翻转，即使计算出的 pxW/pxH 恰好相等也必须重建，
        // 否则 canvas 内部像素方向停留在旋转前，签名会被挤压到一侧。
        const orientationChanged =
          this._canvasWidth > 0 &&
          this._canvasHeight > 0 &&
          (this._canvasWidth > this._canvasHeight) !== (width > height);
        if (
          this.canvas === canvas &&
          canvas.width === pxW &&
          canvas.height === pxH &&
          !orientationChanged
        ) {
          return;
        }
        canvas.width = pxW;
        canvas.height = pxH;
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#1A1A1A';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        this.canvas = canvas;
        this.ctx = ctx;
        this._dpr = dpr;
        this._canvasWidth = width;
        this._canvasHeight = height;
        this._canvasInitRetry = 0;

        // 若在旋转完成前用户已画了笔画，此处按记录重绘一次
        if (this._strokes.length) {
          this._redrawStrokes();
        }
      });
  },

  _redrawStrokes() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    for (const stroke of this._strokes) {
      if (!stroke || stroke.len === 0) continue;
      const d = stroke.data;
      ctx.beginPath();
      ctx.moveTo(d[0], d[1]);
      for (let i = 1; i < stroke.len; i++) {
        const prevX = d[(i - 1) * 2];
        const prevY = d[(i - 1) * 2 + 1];
        const curX = d[i * 2];
        const curY = d[i * 2 + 1];
        const midX = (prevX + curX) / 2;
        const midY = (prevY + curY) / 2;
        ctx.quadraticCurveTo(prevX, prevY, midX, midY);
      }
      ctx.stroke();
    }
  },

  onTouchStart(e: any) {
    if (!this.ctx) return;
    const touch = e.touches[0];
    this.lastX = touch.x;
    this.lastY = touch.y;
    this._lastQueuedX = touch.x;
    this._lastQueuedY = touch.y;
    this.drawing = true;
    const stroke = createStroke(64);
    pushStrokePoint(stroke, touch.x, touch.y);
    this._currentStroke = stroke;
    this._strokes.push(stroke);
    this.ctx.beginPath();
    this.ctx.moveTo(touch.x, touch.y);
    if (!this.data.hasSigned) this.setData({ hasSigned: true });
  },

  onTouchMove(e: any) {
    if (!this.drawing || !this.ctx) return;
    const touch = e.touches[0];
    // 去抖：距离上一次真正入队的点小于阈值时直接忽略，
    // 过滤指尖微抖与低速时 touchmove 高频重复上报的同位置坐标。
    const dx = touch.x - this._lastQueuedX;
    const dy = touch.y - this._lastQueuedY;
    if (dx * dx + dy * dy < MIN_MOVE_DIST_SQ) return;
    this._lastQueuedX = touch.x;
    this._lastQueuedY = touch.y;
    // 收集增量点，交由下一帧统一刷到画布；避免每个 touchmove 都
    // 触发 ctx.stroke 跨 JS-native 桥，在高频事件下造成掉帧。
    this._pendingPoints.push({ x: touch.x, y: touch.y });
    if (this._rafScheduled) return;
    this._rafScheduled = true;
    // 统一使用 setTimeout(~16ms) 做帧合批：canvas 2d 的 requestAnimationFrame
    // 在部分基础库版本上存在兼容性问题（曾见 2.32.3 上 webview 渲染层抛
    // `_getData is not a function`），改用 setTimeout 更稳且时序足够。
    setTimeout(() => this._flushPendingPoints(), 16);
  },

  _flushPendingPoints() {
    this._rafScheduled = false;
    if (!this.ctx || !this._pendingPoints.length) return;
    const pts = this._pendingPoints;
    this._pendingPoints = [];
    const ctx = this.ctx;
    // 把本帧积压的多点拼进同一段 path，只 stroke 一次；
    // 每段曲线仍以相邻中点为起止点，与旧版视觉一致。
    let lastMidX = this.lastX;
    let lastMidY = this.lastY;
    const cur = this._currentStroke;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const midX = (this.lastX + p.x) / 2;
      const midY = (this.lastY + p.y) / 2;
      ctx.quadraticCurveTo(this.lastX, this.lastY, midX, midY);
      lastMidX = midX;
      lastMidY = midY;
      this.lastX = p.x;
      this.lastY = p.y;
      if (cur) pushStrokePoint(cur, p.x, p.y);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(lastMidX, lastMidY);
    // 单笔超长（罕见）时做一次抽稀，避免存储与重绘无限增长
    if (cur && cur.len >= STROKE_DECIMATE_THRESHOLD) {
      decimateStroke(cur);
    }
  },

  onTouchEnd() {
    // 手指抬起前先把积压的增量点刷完，避免末尾一小段漏绘
    if (this._pendingPoints.length) {
      this._flushPendingPoints();
    }
    if (!this.drawing || !this.ctx) {
      this.drawing = false;
      return;
    }
    this.ctx.lineTo(this.lastX, this.lastY);
    this.ctx.stroke();
    this.drawing = false;
    this._currentStroke = null;
  },

  openInfo() {
    // 横屏 + flex 布局下 scroll-view 拿不到自适应高度，按真实视口算
    // sheet 本身 height:94vh，减去头部（padding + 标题行高 ≈ 50px）即为 body 可用高度
    let sheetBodyHeight = 400;
    try {
      const win = wx.getWindowInfo();
      const wh = win.windowHeight || 0;
      if (wh > 0) {
        sheetBodyHeight = Math.max(200, Math.floor(wh * 0.94 - 50));
      }
    } catch {}
    this.setData({ showInfo: true, sheetBodyHeight });
  },

  closeInfo() {
    this.setData({ showInfo: false });
  },

  goBack() {
    wx.navigateBack();
  },

  clearSign() {
    if (!this.ctx || !this.canvas) return;
    const dpr = this._dpr || wx.getWindowInfo().pixelRatio || 1;
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this._strokes = [];
    this._currentStroke = null;
    this._pendingPoints = [];
    this._rafScheduled = false;
    this.setData({ hasSigned: false });
  },

  async confirmSign() {
    if (!this.data.hasSigned) {
      wx.showToast({ title: '请先签名', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const signUrl = await this.exportSignature();
      if (this.eventChannel) {
        this.eventChannel.emit('signComplete', { signUrl, signatureName: this.data.signName });
      }
      wx.showToast({ title: '签署成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (e) {
      wx.showToast({ title: '签署失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  exportSignature(): Promise<string> {
    const qrScene = this.data.qrScene || '';
    return new Promise((resolve, reject) => {
      if (!this.canvas) return reject(new Error('canvas not ready'));
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        success: (res) => {
          const token = wx.getStorageSync('token');
          const useLoggedIn = !!token;
          // 未登录场景必须携带 sceneCode 作为上传凭证
          if (!useLoggedIn && !qrScene) {
            wx.showModal({
              title: '无法上传',
              content: '缺少签名凭证，请从有效二维码重新进入',
              showCancel: false,
            });
            reject(new Error('missing qrScene'));
            return;
          }
          const uploadUrl = useLoggedIn
            ? `${BASE_URL}/documents/raw-upload`
            : `${BASE_URL}/public/signature-upload`;
          wx.uploadFile({
            url: uploadUrl,
            filePath: res.tempFilePath,
            name: 'file',
            header: useLoggedIn ? { Authorization: `Bearer ${token}` } : {},
            formData: useLoggedIn ? {} : { sceneCode: qrScene },
            success(uploadRes) {
              if (uploadRes.statusCode >= 400) {
                let msg = '上传失败';
                try {
                  const err = JSON.parse(uploadRes.data);
                  msg = err?.message || err?.data?.message || msg;
                } catch {}
                reject(new Error(msg));
                return;
              }
              try {
                const data = JSON.parse(uploadRes.data);
                const url = data.data?.url ?? data.url ?? `/uploads/${uploadRes.fileName || 'sign.png'}`;
                if (/^https?:\/\//i.test(url)) {
                  resolve(url);
                  return;
                }
                resolve(url.startsWith('/') ? url : `/${url}`);
              } catch {
                resolve(res.tempFilePath);
              }
            },
            fail: reject,
          });
        },
        fail: reject,
      });
    });
  },
});
