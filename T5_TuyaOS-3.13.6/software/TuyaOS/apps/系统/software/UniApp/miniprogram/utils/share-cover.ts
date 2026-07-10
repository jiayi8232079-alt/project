/**
 * 生成「转发给朋友 / 朋友圈」封面图（Canvas 2d → 临时文件），比例接近微信卡片 5:4。
 * 页面内需放置 <canvas type="2d" id="share-cover-canvas" />。
 */
export type ShareCoverInput = {
  subjectName: string;
  serviceType: string;
  /** 如：陪诊服务中 / 服务动态 */
  statusLine: string;
};

export type HealthSignCoverInput = {
  subjectName: string;
  /** 如：待签署 / 待填写 */
  statusText?: string;
  /** 卡片顶部品牌行文案，默认"陪了个伴 · 健康档案" */
  brandLine?: string;
  /** 主标题下方副标题，默认"健康档案签署" */
  subtitle?: string;
  /** 底部引导文案，默认"请填写健康信息并签署确认" */
  footerGuide?: string;
};

function truncate(str: string, max: number) {
  const s = String(str || '').trim();
  if (!s.length) return '—';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(1, max - 1))}…`;
}

function strokeRoundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function renderShareCoverToTempPath(
  page: any,
  input: ShareCoverInput,
): Promise<string> {
  const W = 500;
  const H = 400;
  const subject = truncate(input.subjectName, 11);
  const svc = truncate(input.serviceType, 14);
  const badge = String(input.statusLine || '服务动态').trim() || '服务动态';

  return new Promise((resolve) => {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery().in(page);
      query
        .select('#share-cover-canvas')
        .fields({ node: true, size: true })
        .exec((res: any) => {
          const el = res?.[0];
          if (!el?.node) {
            resolve('');
            return;
          }
          try {
            const canvas = el.node;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve('');
              return;
            }
            let dpr = 2;
            try {
              const sys = wx.getSystemInfoSync();
              dpr = Math.max(1, Math.min(3, Number(sys.pixelRatio) || 2));
            } catch {
              dpr = 2;
            }

            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);

            const grd = ctx.createLinearGradient(0, 0, W, H * 0.85);
            grd.addColorStop(0, '#071910');
            grd.addColorStop(0.45, '#134828');
            grd.addColorStop(1, '#1f6f4d');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, W, H);

            ctx.fillStyle = 'rgba(255,255,255,0.07)';
            ctx.beginPath();
            ctx.arc(W * 0.92, H * 0.08, 120, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.arc(W * 0.08, H * 1.05, 90, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(212, 175, 55, 0.95)';
            ctx.font = '500 17px sans-serif';
            ctx.fillText('陪了个伴 · 专业陪诊', 36, 46);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 38px sans-serif';
            ctx.fillText(subject, 36, 118);

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '24px sans-serif';
            ctx.fillText(svc, 36, 168);

            const pillY = 196;
            const pillH = 46;
            const pillX = 36;
            ctx.font = 'bold 19px sans-serif';
            const showPulse = badge === '陪诊服务中';
            const textX0 = pillX + 22 + (showPulse ? 16 : 0);
            const tw = ctx.measureText(badge).width;
            const pillW = Math.ceil(Math.max(168, tw + textX0 - pillX + 22));

            ctx.fillStyle = 'rgba(76, 175, 80, 0.28)';
            strokeRoundRect(ctx, pillX, pillY, pillW, pillH, 23);
            ctx.fill();
            ctx.strokeStyle = 'rgba(185, 246, 202, 0.45)';
            ctx.lineWidth = 1;
            strokeRoundRect(ctx, pillX, pillY, pillW, pillH, 23);
            ctx.stroke();

            if (showPulse) {
              ctx.fillStyle = '#76ff03';
              ctx.beginPath();
              ctx.arc(pillX + 22, pillY + pillH / 2, 5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#e8f5e9';
            ctx.fillText(badge, textX0, pillY + 31);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '16px sans-serif';
            ctx.fillText('家属查看服务进展 · 请勿随意外传', 36, H - 30);

            wx.canvasToTempFilePath(
              {
                canvas,
                x: 0,
                y: 0,
                width: W,
                height: H,
                destWidth: W * dpr,
                destHeight: H * dpr,
                fileType: 'png',
                quality: 1,
                success: (r) => resolve((r as any).tempFilePath || ''),
                fail: () => resolve(''),
              },
              page,
            );
          } catch {
            resolve('');
          }
        });
    });
  });
}

export function renderHealthSignShareCover(
  page: any,
  input: HealthSignCoverInput,
): Promise<string> {
  const W = 500;
  const H = 400;
  const name = truncate(input.subjectName, 8);
  const badge = input.statusText || '待签署';
  const brandLine = input.brandLine || '陪了个伴 · 健康档案';
  const subtitle = input.subtitle || '健康档案签署';
  const footerGuide = input.footerGuide || '请填写健康信息并签署确认';

  return new Promise((resolve) => {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery().in(page);
      query
        .select('#share-cover-canvas')
        .fields({ node: true, size: true })
        .exec((res: any) => {
          const el = res?.[0];
          if (!el?.node) { resolve(''); return; }
          try {
            const canvas = el.node;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(''); return; }
            let dpr = 2;
            try {
              const sys = wx.getSystemInfoSync();
              dpr = Math.max(1, Math.min(3, Number(sys.pixelRatio) || 2));
            } catch { dpr = 2; }

            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);

            const bg = ctx.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, '#0d3320');
            bg.addColorStop(0.5, '#1b6b42');
            bg.addColorStop(1, '#27a95b');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.arc(W * 0.88, H * 0.12, 130, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.beginPath();
            ctx.arc(W * 0.1, H * 0.9, 100, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'rgba(212, 175, 55, 0.9)';
            ctx.font = '500 17px sans-serif';
            ctx.fillText(brandLine, 36, 46);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText(name, 36, 120);

            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '22px sans-serif';
            ctx.fillText(subtitle, 36, 162);

            const pillY = 186;
            const pillH = 42;
            const pillX = 36;
            ctx.font = 'bold 18px sans-serif';
            const tw = ctx.measureText(badge).width;
            const pillW = Math.ceil(tw + 40);
            ctx.fillStyle = 'rgba(255, 152, 0, 0.3)';
            strokeRoundRect(ctx, pillX, pillY, pillW, pillH, 21);
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 213, 79, 0.5)';
            ctx.lineWidth = 1;
            strokeRoundRect(ctx, pillX, pillY, pillW, pillH, 21);
            ctx.stroke();
            ctx.fillStyle = '#ffd54f';
            ctx.fillText(badge, pillX + 20, pillY + 28);

            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '500 21px sans-serif';
            ctx.fillText(footerGuide, 36, H - 80);

            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = '15px sans-serif';
            ctx.fillText('点击卡片进入 · 信息仅用于陪诊服务', 36, H - 30);

            wx.canvasToTempFilePath(
              {
                canvas, x: 0, y: 0, width: W, height: H,
                destWidth: W * dpr, destHeight: H * dpr,
                fileType: 'png', quality: 1,
                success: (r) => resolve((r as any).tempFilePath || ''),
                fail: () => resolve(''),
              },
              page,
            );
          } catch { resolve(''); }
        });
    });
  });
}

export type ServiceReportCoverInput = {
  subjectName: string;
  serviceType: string;
  /** 可选：小程序码 PNG 的 base64（不带 data:image 前缀）——若提供则贴在右下角 */
  qrCodeBase64?: string;
  /** 可选：报告日期，默认今天 */
  reportDate?: string;
};

/**
 * 陪诊服务报告专属分享封面（含小程序码角标）。
 *
 * 设计：温和的墨绿底色 + 金色品牌条 + 大标题「陪诊报告」 + 就诊人与服务类型 + 右下角可选扫码入口。
 * 用法：`onShareAppMessage` 中异步调用，得到 tempFilePath 后作为分享 imageUrl。
 */
export function renderServiceReportShareCover(
  page: any,
  input: ServiceReportCoverInput,
): Promise<string> {
  const W = 500;
  const H = 400;
  const name = truncate(input.subjectName, 9);
  const svc = truncate(input.serviceType, 14);
  const date = (input.reportDate || '').trim() || (() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  })();

  return new Promise((resolve) => {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery().in(page);
      query
        .select('#share-cover-canvas')
        .fields({ node: true, size: true })
        .exec((res: any) => {
          const el = res?.[0];
          if (!el?.node) { resolve(''); return; }
          try {
            const canvas = el.node;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(''); return; }
            let dpr = 2;
            try {
              const sys = wx.getSystemInfoSync();
              dpr = Math.max(1, Math.min(3, Number(sys.pixelRatio) || 2));
            } catch { dpr = 2; }

            canvas.width = W * dpr;
            canvas.height = H * dpr;
            ctx.scale(dpr, dpr);

            // 背景：墨绿 → 翡翠
            const bg = ctx.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, '#07291b');
            bg.addColorStop(0.45, '#114a2f');
            bg.addColorStop(1, '#2fa070');
            ctx.fillStyle = bg;
            ctx.fillRect(0, 0, W, H);

            // 微光斑
            ctx.fillStyle = 'rgba(255,255,255,0.06)';
            ctx.beginPath();
            ctx.arc(W * 0.85, H * 0.08, 120, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.04)';
            ctx.beginPath();
            ctx.arc(W * 0.12, H * 1.02, 100, 0, Math.PI * 2);
            ctx.fill();

            // 顶部品牌行
            ctx.fillStyle = 'rgba(212,175,55,0.95)';
            ctx.font = '500 17px sans-serif';
            ctx.fillText('陪了个伴 · 陪诊服务报告', 36, 46);

            // 主标题 + 就诊人
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 38px sans-serif';
            ctx.fillText(`${name} 的陪诊报告`, 36, 118);

            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '22px sans-serif';
            ctx.fillText(svc, 36, 160);

            // 绿色"AI 智能解读"徽章
            const pillY = 184;
            const pillH = 42;
            const pillX = 36;
            const badge = 'AI 智能解读 · 图文版';
            ctx.font = 'bold 17px sans-serif';
            const tw = ctx.measureText(badge).width;
            const pillW = Math.ceil(tw + 40);
            ctx.fillStyle = 'rgba(76,175,80,0.28)';
            strokeRoundRect(ctx, pillX, pillY, pillW, pillH, 21);
            ctx.fill();
            ctx.strokeStyle = 'rgba(185,246,202,0.45)';
            ctx.lineWidth = 1;
            strokeRoundRect(ctx, pillX, pillY, pillW, pillH, 21);
            ctx.stroke();
            ctx.fillStyle = '#e8f5e9';
            ctx.fillText(badge, pillX + 20, pillY + 28);

            // 底部引导文 + 报告日期
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '500 20px sans-serif';
            ctx.fillText('家属查看完整报告 · 点击卡片进入', 36, H - 72);

            ctx.fillStyle = 'rgba(255,255,255,0.42)';
            ctx.font = '14px sans-serif';
            ctx.fillText(`报告日期 ${date}`, 36, H - 32);

            // 右下角 QR 贴图（若提供 base64 则绘制，失败直接跳过）
            const qrB64 = (input.qrCodeBase64 || '').trim();

            const drawQr = (onDone: () => void) => {
              if (!qrB64 || typeof canvas.createImage !== 'function') {
                onDone();
                return;
              }
              try {
                const img = canvas.createImage();
                img.onload = () => {
                  const qrSize = 108;
                  const qx = W - qrSize - 28;
                  const qy = H - qrSize - 28;
                  ctx.fillStyle = '#ffffff';
                  strokeRoundRect(ctx, qx - 8, qy - 8, qrSize + 16, qrSize + 16, 14);
                  ctx.fill();
                  ctx.drawImage(img, qx, qy, qrSize, qrSize);
                  ctx.fillStyle = 'rgba(7,41,27,0.7)';
                  ctx.font = '600 13px sans-serif';
                  const label = '扫码查看';
                  const labelW = ctx.measureText(label).width;
                  ctx.fillText(label, qx + (qrSize - labelW) / 2, qy + qrSize + 26);
                  onDone();
                };
                img.onerror = () => { onDone(); };
                img.src = `data:image/png;base64,${qrB64}`;
              } catch { onDone(); }
            };

            drawQr(() => {
              wx.canvasToTempFilePath(
                {
                  canvas, x: 0, y: 0, width: W, height: H,
                  destWidth: W * dpr, destHeight: H * dpr,
                  fileType: 'png', quality: 1,
                  success: (r) => resolve((r as any).tempFilePath || ''),
                  fail: () => resolve(''),
                },
                page,
              );
            });
          } catch { resolve(''); }
        });
    });
  });
}
