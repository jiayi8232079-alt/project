import { editScript, dateStr, maskIdCard } from './shared-styles.js';

/* ─────────────────────────────────────────────────────────────
   设计策略：
   • 文档固定 210mm（A4宽），使用 pt 单位，确保打印 1:1 输出
   • 屏幕通过 zoom:1.3 放大预览，打印时 zoom:1 还原
───────────────────────────────────────────────────────────── */
/** 与健康小档案一致的 A4 打印样式，供陪诊服务确认单等复用 */
export const HEALTH_ARCHIVE_PRINT_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#d4d8db;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{
  font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;
  font-size:10.5pt;
  color:#1a1a1a;
}

/* 桌面屏幕放大1.3倍方便预览 */
@media screen and (min-width: 800px) {
  body { zoom: 1.3; }
}

/* ── 手机端自适应 ── */
@media screen and (max-width: 799px) {
  body { zoom: 1; background: #f5f7f5; }

  /* 工具栏：只保留打印按钮，其余隐藏 */
  .toolbar { padding: 6px 10px; gap: 6px; }
  .toolbar button { font-size: 8pt; padding: 4px 12px; }
  .toolbar button:not(:first-child) { display: none; }
  .spacer { height: 40px; }

  /* 文档容器 */
  .doc {
    width: 100% !important;
    min-height: unset;
    margin: 0;
    padding: 12px 12px 20px;
    box-shadow: none;
    border-radius: 0;
    background: #fff;
  }

  /* ── 头部：第一行 logo+机构名，第二行标题 ── */
  .hd {
    flex-direction: column;
    align-items: flex-start;
    gap: 6pt;
    padding-bottom: 8pt;
    margin-bottom: 6pt;
  }
  .hd-top { gap: 8pt; }
  /* 第一行：logo + 机构名 */
  .hd .logo-wrap { width: 36pt; height: 36pt; }
  .hd .logo-txt  { font-size: 18pt; }
  .hd .org { padding-left: 0; }
  .hd .org-name  { font-size: 13pt; }
  .hd .org-sub   { font-size: 7.5pt; }
  /* 第二行：文档标题独占一行 */
  .hd .doc-label {
    text-align: left;
    width: 100%;
    border-top: 0.75pt solid #d0ede2;
    padding-top: 5pt;
    margin-top: 2pt;
  }
  .hd .doc-title { font-size: 13pt; letter-spacing: 1pt; }
  .hd .doc-en    { font-size: 7pt; }

  /* 档案信息条：两列网格 */
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    padding: 0;
    border-radius: 4pt;
    overflow: hidden;
  }
  .meta .mi {
    border-right: none;
    border-bottom: 0.75pt solid #c8e4d8;
    border-right: 0.75pt solid #c8e4d8;
    padding: 5pt 7pt;
    margin: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 2pt;
  }
  .meta .mi:nth-child(even) { border-right: none; }
  .meta .mi:nth-last-child(-n+2) { border-bottom: none; }
  .meta .ml { font-size: 7.5pt; }
  .meta .mv { font-size: 9pt; }

  /* 表格 */
  table { font-size: 8.5pt; }
  td, th { padding: 4pt 5pt; font-size: 8pt; }
  .lbl { width: 42pt; font-size: 7.5pt; white-space: normal; word-break: keep-all; }
  .val, .vs { font-size: 8pt; }

  /* 勾选项 */
  .opts { gap: 2px; row-gap: 4px; }
  .ci { margin-right: 7pt; font-size: 7.5pt; }

  /* 节标题 */
  .sec-hd { margin-top: 10pt; }
  .sec-hd .st { font-size: 10pt; }

  /* 签署区：纵向堆叠 */
  .sign-row { flex-direction: column; gap: 8px; }

  /* 页脚 */
  .foot { flex-direction: column; gap: 2px; font-size: 7pt; }
}

/* ── 工具栏（屏幕only，zoom在外层所以toolbar需要fixed+反缩放） ── */
.toolbar{
  position:fixed;top:0;left:0;right:0;z-index:9999;
  background:linear-gradient(90deg,#1a6b52,#2B9F7C);
  display:flex;justify-content:center;align-items:center;gap:10px;
  padding:6px 20px;
}
.toolbar button{
  background:rgba(255,255,255,.15);color:#fff;border:1px solid rgba(255,255,255,.35);
  padding:4px 18px;border-radius:20px;font-size:9pt;cursor:pointer;font-weight:500;
}
.toolbar button:hover{background:rgba(255,255,255,.28)}
.spacer{height:38px}

/* ── A4 页面容器 ── */
.doc{
  width:210mm;
  min-height:297mm;
  background:#fff;
  margin:10mm auto;
  padding:12mm 13mm 10mm;
  box-shadow:0 4px 20px rgba(0,0,0,.15);
  display:flex;
  flex-direction:column;
  overflow-wrap:break-word;
  word-wrap:break-word;
}

/* ── 文件头 ── */
.hd{
  display:flex;align-items:center;gap:10pt;
  border-bottom:2.5pt solid #2B9F7C;padding-bottom:8pt;margin-bottom:7pt;
}
.hd-top{
  display:flex;align-items:center;gap:10pt;flex:1;
}
.hd .logo-wrap{
  width:44pt;height:44pt;flex-shrink:0;border-radius:7pt;
  overflow:hidden;background:#f0faf6;border:1pt solid #c0ddd0;
  display:flex;align-items:center;justify-content:center;
}
.hd .logo-wrap img{width:100%;height:100%;object-fit:contain}
.hd .logo-txt{font-size:22pt;font-weight:800;color:#2B9F7C}
.hd .org{flex:1;padding-left:5pt}
.hd .org-name{font-size:14pt;font-weight:700;color:#1a6b52}
.hd .org-sub{font-size:8pt;color:#999;margin-top:1pt}
.hd .doc-label{text-align:right}
.hd .doc-title{font-size:16pt;font-weight:800;color:#1a6b52;letter-spacing:2pt}
.hd .doc-en{font-size:7.5pt;color:#bbb;margin-top:2pt}

/* ── 档案信息条 ── */
.meta{
  display:flex;background:#f3fbf7;border:1pt solid #bedad0;border-radius:4pt;
  padding:5pt 10pt;margin-bottom:7pt;font-size:9pt;
}
.meta .mi{flex:1;display:flex;align-items:center;gap:5pt;border-right:1pt solid #c8e4d8;padding-right:9pt;margin-right:9pt}
.meta .mi:last-child{border-right:none;margin-right:0;padding-right:0}
.meta .ml{color:#888}
.meta .mv{font-weight:700;color:#1a6b52}

/* ── 提示语 ── */
.tip{
  font-size:8.5pt;color:#5a7a6a;background:#f5fdf8;
  border-left:2.5pt solid #2B9F7C;padding:3.5pt 8pt;
  margin-bottom:7pt;border-radius:0 3pt 3pt 0;
}

/* ── 节标题 ── */
.sec-hd{
  display:flex;align-items:center;gap:6pt;
  margin-bottom:5pt;margin-top:9pt;
}
.sec-hd .sn{
  width:16pt;height:16pt;border-radius:50%;
  background:#2B9F7C;color:#fff;font-size:9pt;font-weight:700;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.sec-hd .st{font-size:11pt;font-weight:700;color:#1a6b52}
.sec-hd::after{content:'';flex:1;height:0.75pt;background:linear-gradient(90deg,#aad5c0,transparent)}

/* ── 表格 ── */
table{width:100%;border-collapse:collapse;margin-bottom:3pt;table-layout:fixed}
td,th{padding:5pt 8pt;border:0.75pt solid #c0ddd0;font-size:9.5pt;vertical-align:middle;word-wrap:break-word;overflow-wrap:break-word}
.lbl{background:#eaf5f0;font-weight:600;color:#2a5a48;width:65pt;white-space:nowrap}
.val{background:#fff;color:#111;word-wrap:break-word;overflow-wrap:break-word}
.vs{background:#fff;color:#111;vertical-align:top;padding-top:5pt;padding-bottom:4pt;word-wrap:break-word;overflow-wrap:break-word;line-height:1.55}

/* ── 勾选行 ── */
.opts{display:flex;flex-wrap:wrap;align-items:flex-start;padding:1pt 0}
.ci{display:inline-flex;align-items:flex-start;gap:4pt;margin-right:12pt;margin-bottom:1.5pt;font-size:9pt;white-space:normal;word-wrap:break-word;overflow-wrap:break-word;max-width:100%}
.cb{
  width:10pt;height:10pt;border:1pt solid #aaa;border-radius:1.5pt;
  display:inline-flex;align-items:center;justify-content:center;
  flex-shrink:0;font-size:7pt;color:#fff;
}
.cb.on{background:#2B9F7C;border-color:#2B9F7C}

/* ── 声明 ── */
.terms{font-size:9pt;color:#555;line-height:1.65;margin-bottom:6pt}
.terms li{
  list-style:none;display:flex;gap:6pt;
  border-bottom:0.75pt dotted #dde8e3;padding:2.5pt 0;
}
.terms li:last-child{border-bottom:none}
.terms .tn{color:#2B9F7C;font-weight:700;flex-shrink:0}

/* ── 签署区 ── */
.sign-row{display:flex;gap:12pt;margin-top:6pt}
.sign-box{
  flex:1;border:0.75pt solid #bedad5;border-radius:4pt;
  padding:7pt 10pt;background:#f8fdfa;
}
.sign-box .sl{font-size:8.5pt;color:#888;margin-bottom:4pt}
.sign-box .sline{height:34pt;border-bottom:1.5pt solid #2B9F7C;margin-bottom:3pt}
.sign-box .sv{font-size:10pt;font-weight:600;color:#222;min-height:13pt}
.sign-box .simg{max-width:140pt;height:42pt;object-fit:contain;object-position:left center;margin-top:3pt;display:block}

/* ── 页脚 ── */
.foot{
  margin-top:auto;padding-top:6pt;
  border-top:0.75pt solid #d0e8de;
  display:flex;justify-content:space-between;
  font-size:8pt;color:#bbb;
}

/* ══════════════════ PRINT ══════════════════ */
@media print{
  html,body{background:#fff!important;zoom:1!important}
  .toolbar,.spacer{display:none!important}
  .doc{
    margin:0!important;
    box-shadow:none!important;
    min-height:0!important;
  }
  .notice-doc{page-break-before:always}
  @page{size:A4 portrait;margin:0}
}

/* ══════════════════ 第二页：重要提示 ══════════════════ */
.notice-doc{
  width:210mm;min-height:297mm;background:#fff;
  margin:10mm auto;padding:12mm 15mm 10mm;
  box-shadow:0 4px 20px rgba(0,0,0,.15);
  display:flex;flex-direction:column;
  font-family:'PingFang SC','Noto Sans SC','Microsoft YaHei',sans-serif;
  font-size:10pt;color:#1a1a1a;
}
.notice-header{
  text-align:center;padding-bottom:6pt;margin-bottom:7pt;
  border-bottom:2.5pt solid #2B9F7C;
}
.notice-main-title{
  font-size:16pt;font-weight:800;color:#1a1a1a;letter-spacing:3pt;margin-bottom:2pt;
}
.notice-sub-brand{
  font-size:8.5pt;color:#888;letter-spacing:0.5pt;
}
.notice-intro{
  font-size:9.5pt;color:#333;line-height:1.6;margin-bottom:7pt;
  padding:5pt 9pt;background:#f5fdf8;border-left:3pt solid #2B9F7C;
  border-radius:0 3pt 3pt 0;
}
.notice-sec{margin-bottom:5pt}
.notice-sec-hd{
  display:flex;align-items:center;gap:6pt;
  margin-bottom:3pt;padding-bottom:2pt;
  border-bottom:1pt solid #d0e8de;
}
.notice-sec-num{
  font-size:10.5pt;font-weight:800;color:#2B9F7C;flex-shrink:0;
}
.notice-sec-title{
  font-size:10.5pt;font-weight:700;color:#1a6b52;
}
.notice-body{
  font-size:9.5pt;color:#333;line-height:1.6;padding-left:2pt;
}
.notice-item{
  margin-bottom:1.5pt;display:flex;gap:4pt;line-height:1.6;
}
.notice-item-label{font-weight:700;flex-shrink:0;color:#1a1a1a;}
.notice-item-val{color:#333;}
.notice-cancel-box{
  background:#fafff9;border:0.75pt solid #bedad0;border-radius:4pt;
  padding:4pt 9pt;margin-top:3pt;
}
.notice-cancel-row{
  display:flex;align-items:baseline;gap:5pt;
  padding:2pt 0;border-bottom:0.5pt dotted #d0e8de;font-size:9.5pt;line-height:1.55;
}
.notice-cancel-row:last-child{border-bottom:none}
.notice-cancel-row b{color:#1a6b52;flex-shrink:0;}
.notice-hint{
  font-size:8.5pt;color:#888;margin-top:2pt;padding-left:4pt;font-style:italic;
}
.notice-divider{height:1pt;background:#eaf5f0;margin:6pt 0;}
.notice-contact{
  margin-top:auto;padding-top:7pt;
  border-top:1.5pt solid #2B9F7C;
  text-align:center;
}
.notice-contact-line{
  font-size:9.5pt;color:#333;line-height:1.7;margin-bottom:1pt;
}
.notice-contact-phone{
  font-size:11pt;font-weight:700;color:#1a6b52;letter-spacing:1pt;
}
.notice-blessing{
  margin-top:6pt;font-size:10.5pt;font-weight:600;color:#2B9F7C;
  text-align:center;letter-spacing:1pt;
}

@media screen and (max-width:799px){
  .notice-doc{
    width:100%!important;min-height:unset;margin:0;
    padding:12px 12px 20px;box-shadow:none;border-radius:0;
  }
  .notice-main-title{font-size:14pt;}
  .notice-sec-title{font-size:10pt;}
  .notice-body,.notice-item{font-size:9pt;}
}
@media print{
  .notice-doc{margin:0!important;box-shadow:none!important;min-height:0!important;padding:12mm 15mm 10mm!important;}
}
`;

/* ── 勾选框（导出供服务确认单等复用）──────────────── */
export function healthArchiveCheckbox(on: boolean, label: string): string {
  return `<span class="ci"><span class="cb${on ? ' on' : ''}">${on ? '✓' : ''}</span>${label}</span>`;
}
const ck = healthArchiveCheckbox;

/* ── 工具栏 ─────────────────────────────── */
export function healthArchiveToolbar(): string {
  return `<div class="toolbar">
    <button onclick="window.print()">🖨️ 打印 / 保存PDF</button>
    <button onclick="toggleEdit()">✏️ 编辑内容</button>
    <button onclick="saveDoc()">💾 下载 HTML</button>
  </div><div class="spacer"></div>`;
}

/* ── 主函数 ─────────────────────────────── */
export function generateHealthProfileHtml(data: {
  customerIdCode?: string;
  name: string;
  gender?: string;
  age?: number;
  idCard?: string;
  phone?: string;
  relation?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  fillMethod?: string;
  proxyName?: string;
  proxyRelation?: string;
  proxyPhone?: string;
  medicalHistory?: string[];
  medicalHistoryOther?: string;
  mobilityStatus?: string;
  currentMedication?: string;
  allergies?: string;
  visionStatus?: string;
  hearingStatus?: string;
  recentSymptoms?: string[];
  recentSymptomsOther?: string;
  otherHealthInfo?: string;
  mainAppeal?: string;
  signedBy?: string;
  signedRelation?: string;
  signDate?: string | Date;
  signUrl?: string;
  bloodType?: string;
  baseUrl?: string;
  logoUrl?: string;
  maskSensitive?: boolean;
}): string {
  const d = data;
  const shouldMask = d.maskSensitive !== false;
  const now = new Date();
  const archiveNo = d.customerIdCode
    || `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-01`;
  const mh = d.medicalHistory || [];
  const sx = d.recentSymptoms || [];
  const rel = d.emergencyRelation || d.relation || '—';
  const gender = d.gender === 'male' ? '男' : d.gender === 'female' ? '女' : (d.gender || '');

  const signImg = d.signUrl
    ? d.signUrl.startsWith('http') ? d.signUrl : `${d.baseUrl || ''}${d.signUrl}`
    : '';
  const isSigned = !!signImg;
  const signedBy = isSigned ? (d.signedBy || '—') : '待用户签署';
  const signedDate = isSigned && d.signDate ? dateStr(d.signDate) : '—';
  const logoSrc = d.logoUrl
    ? d.logoUrl.startsWith('http') ? d.logoUrl : `${d.baseUrl || ''}${d.logoUrl}`
    : '';
  const logoBlock = logoSrc
    ? `<div class="logo-wrap"><img src="${logoSrc}" alt="logo"/></div>`
    : `<div class="logo-wrap"><span class="logo-txt">侨</span></div>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>健康信息小档案 — ${d.name} — ${archiveNo}</title>
<style>${HEALTH_ARCHIVE_PRINT_CSS}</style>
</head>
<body>
${healthArchiveToolbar()}
<div class="doc">

  <!-- 文件头 -->
  <div class="hd">
    <div class="hd-top">
      ${logoBlock}
      <div class="org">
        <div class="org-name">陪了个伴管理中心</div>
        <div class="org-sub">青田陪了个伴管理有限公司 · 专业陪诊服务</div>
      </div>
    </div>
    <div class="doc-label">
      <div class="doc-title">客户健康信息小档案</div>
      <div class="doc-en">Health Information Profile</div>
    </div>
  </div>

  <!-- 档案信息条 -->
  <div class="meta">
    <div class="mi"><span class="ml">档案编号</span><span class="mv">${archiveNo}</span></div>
    <div class="mi"><span class="ml">客户姓名</span><span class="mv">${d.name}</span></div>
    <div class="mi"><span class="ml">性别 / 年龄</span><span class="mv">${gender || '—'} / ${d.age ? d.age + '岁' : '—'}</span></div>
    <div class="mi"><span class="ml">建档日期</span><span class="mv">${dateStr(now)}</span></div>
  </div>

  <!-- 提示语 -->
  <div class="tip">感谢您选择陪了个伴陪诊服务。以下健康信息将严格保密，仅用于服务风险评估与保障，助我们更好地为您提供安全、专业的协助。</div>

  <!-- 一、基本信息 -->
  <div class="sec-hd"><span class="sn">一</span><span class="st">基本信息</span></div>
  <table>
    <tr>
      <td class="lbl">身份证号</td><td class="val" style="white-space:nowrap">${shouldMask ? maskIdCard(d.idCard) : (d.idCard || '—')}</td>
      <td class="lbl">血型</td><td class="val">${d.bloodType || '—'}</td>
      <td class="lbl">联系电话</td><td class="val">${d.phone || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">信息记录方式</td>
      <td class="vs" colspan="5"><div class="opts">
        ${ck(d.fillMethod === 'self' || !d.fillMethod, '本人自填')}
        ${ck(d.fillMethod === 'dictation', '本人口述代填')}
        ${ck(d.fillMethod === 'proxy', '家属代填')}
        ${ck(d.fillMethod === 'other', '其他')}
      </div></td>
    </tr>
    <tr>
      <td class="lbl">紧急联系人</td><td class="val">${d.emergencyContact || '—'}</td>
      <td class="lbl">与本人关系</td><td class="val">${rel}</td>
      <td class="lbl">紧急联系电话</td><td class="val">${d.emergencyPhone || '—'}</td>
    </tr>
  </table>

  <!-- 二、健康状况 -->
  <div class="sec-hd"><span class="sn">二</span><span class="st">健康状况</span></div>
  <table>
    <tr>
      <td class="lbl" style="width:65pt">过往病史</td>
      <td class="vs" colspan="5"><div class="opts">
        ${ck(mh.includes('none') || mh.length === 0, '无')}
        ${ck(mh.includes('hypertension'), '高血压')}
        ${ck(mh.includes('heart'), '心脏病')}
        ${ck(mh.includes('cerebrovascular'), '脑血管疾病')}
        ${ck(mh.includes('diabetes'), '糖尿病')}
        ${ck(mh.includes('epilepsy'), '癫痫')}
        ${ck(mh.includes('asthma'), '哮喘/慢阻肺')}
        ${ck(mh.includes('mental'), '精神类疾病')}
        ${ck(mh.includes('cancer'), '癌症')}
        ${mh.includes('other') ? `<span class="ci" style="flex-basis:100%"><span class="cb on">✓</span><span style="flex:1;word-wrap:break-word;overflow-wrap:break-word">其他${d.medicalHistoryOther ? '：' + d.medicalHistoryOther : ''}</span></span>` : ck(false, '其他')}
      </div></td>
    </tr>
    <tr>
      <td class="lbl">行动能力</td>
      <td class="vs" colspan="2"><div class="opts">
        ${ck(d.mobilityStatus === 'independent' || !d.mobilityStatus, '行动自如')}
        ${ck(d.mobilityStatus === 'mild_assist', '需轻度辅助')}
        ${ck(d.mobilityStatus === 'wheelchair', '需轮椅')}
        ${ck(d.mobilityStatus === 'bedridden', '卧床')}
      </div></td>
      <td class="lbl">当前用药</td>
      <td class="vs" colspan="2">${d.currentMedication || '<span style="color:#bbb">无</span>'}</td>
    </tr>
    <tr>
      <td class="lbl">过敏史</td>
      <td class="vs" colspan="2">${d.allergies || '<span style="color:#bbb">无</span>'}</td>
      <td class="lbl">视力状况</td>
      <td class="vs" colspan="2"><div class="opts">
        ${ck(d.visionStatus === 'good', '正常')}
        ${ck(d.visionStatus === 'poor', '视力减退')}
        ${ck(d.visionStatus === 'blind', '严重障碍')}
        ${!d.visionStatus ? '<span style="color:#ccc;font-size:8pt">未填写</span>' : ''}
      </div></td>
    </tr>
    <tr>
      <td class="lbl">听力状况</td>
      <td class="vs" colspan="2"><div class="opts">
        ${ck(d.hearingStatus === 'good', '正常')}
        ${ck(d.hearingStatus === 'poor', '听力减退')}
        ${ck(d.hearingStatus === 'deaf', '严重障碍')}
        ${!d.hearingStatus ? '<span style="color:#ccc;font-size:8pt">未填写</span>' : ''}
      </div></td>
      <td class="lbl">近期症状</td>
      <td class="vs" colspan="2"><div class="opts">
        ${ck(sx.includes('none') || !sx.length, '无明显症状')}
        ${ck(sx.includes('syncope'), '晕厥/眩晕')}
        ${ck(sx.includes('chest_pain'), '胸痛/心慌')}
        ${ck(sx.includes('dyspnea'), '呼吸困难')}
        ${ck(sx.includes('fatigue'), '乏力/疲劳')}
        ${ck(sx.includes('pain'), '持续疼痛')}
        ${ck(sx.includes('insomnia'), '失眠')}
        ${ck(sx.includes('appetite_loss'), '食欲下降')}
        ${sx.includes('other') ? `<span class="ci" style="flex-basis:100%"><span class="cb on">✓</span><span style="flex:1;word-wrap:break-word;overflow-wrap:break-word">其他${d.recentSymptomsOther ? '：' + d.recentSymptomsOther : ''}</span></span>` : ck(false, '其他')}
      </div></td>
    </tr>
    <tr>
      <td class="lbl">就医诉求</td>
      <td class="vs editable" colspan="5" style="min-height:20pt">${d.mainAppeal || '<span style="color:#ccc">—</span>'}</td>
    </tr>
    <tr>
      <td class="lbl">其他说明</td>
      <td class="vs editable" colspan="5" style="min-height:20pt">${d.otherHealthInfo || '<span style="color:#ccc">—</span>'}</td>
    </tr>
  </table>

  <!-- 三、声明与签署 -->
  <div class="sec-hd"><span class="sn">三</span><span class="st">声明与签署</span></div>
  <ul class="terms">
    <li><span class="tn">1.</span><span><b>如实告知：</b>本人保证以上健康信息真实、准确、完整，如有更新将及时告知服务方。</span></li>
    <li><span class="tn">2.</span><span><b>服务知悉：</b>本人理解陪诊服务为非医疗性质的生活辅助服务，不能替代医疗诊断或治疗。</span></li>
    <li><span class="tn">3.</span><span><b>责任自担：</b>若因隐瞒病史或不实陈述导致风险，责任由信息填写人承担。</span></li>
    <li><span class="tn">4.</span><span><b>隐私保护：</b>本档案信息仅限内部服务评估使用，严格依据隐私政策保管，未经授权不得对外提供。</span></li>
  </ul>
  <div class="sign-row">
    <div class="sign-box" style="flex:1.4">
      <div class="sl">签署人姓名 / 签名</div>
      <div class="sline"></div>
      <div class="sv">${signedBy}</div>
      ${isSigned ? `<img src="${signImg}" alt="签名" class="simg"/>` : ''}
    </div>
    <div class="sign-box">
      <div class="sl">签署日期</div>
      <div class="sline"></div>
      <div class="sv">${signedDate}</div>
    </div>
    <div class="sign-box">
      <div class="sl">青田陪了个伴管理有限公司</div>
      <div class="sline"></div>
      <div class="sv">&nbsp;</div>
    </div>
  </div>

  <!-- 页脚 -->
  <div class="foot">
    <span>青田陪了个伴管理有限公司 · 客服：17357867655</span>
    <span>档案编号：${archiveNo} · 本档案由系统自动生成${isSigned ? '，已完成签署' : '，待用户签署后生效'}</span>
  </div>

</div>

<!-- ══════════ 第二页：客户重要提示 ══════════ -->
<div class="notice-doc">

  <div class="notice-header">
    <div class="notice-main-title">客户重要提示</div>
    <div class="notice-sub-brand">青田陪了个伴管理有限公司 · 陪了个伴管理中心</div>
  </div>

  <div class="notice-intro">
    尊敬的客户，为确保本次陪诊服务顺利、安心，请您在签署前特别留意以下事项：
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">一、</span>
      <span class="notice-sec-title">服务性质</span>
    </div>
    <div class="notice-body">
      我们提供的陪诊服务核心是<b>生活辅助与事务协助</b>，主要包括就诊引导、排队、缴费、取药、陪同及医嘱记录等。请您知悉陪诊员<b>不是医疗专业人员</b>，不会提供任何诊断、治疗、用药指导或病情判断等医疗服务。
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">二、</span>
      <span class="notice-sec-title">健康信息是安全基石</span>
    </div>
    <div class="notice-body">
      您填写的《陪了个伴客户健康信息小档案》是我们为您提供安全、周到服务的重要依据。请确保所提供的信息<b>真实、完整</b>，这将帮助我们更好地为您规划服务。若因健康信息隐瞒、遗漏或不实而导致任何风险，相关责任需由您自行承担。
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">三、</span>
      <span class="notice-sec-title">费用透明说明</span>
    </div>
    <div class="notice-body">
      <div class="notice-item">
        <span class="notice-item-label">医疗费用：</span>
        <span class="notice-item-val">就诊过程中的挂号、医药、检查等费用，<b>均需由您在现场自行支付</b>，陪诊员不提供垫付服务。</span>
      </div>
      <div class="notice-item">
        <span class="notice-item-label">公司预收的准备金：</span>
        <span class="notice-item-val">用于协助客户交通出行和住宿费用，服务结束后按实际产生的费用结算，<b>多退少补</b>。</span>
      </div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">四、</span>
      <span class="notice-sec-title">取消与改期规则</span>
    </div>
    <div class="notice-body" style="margin-bottom:4pt">
      如您需要取消或改期，请务必提前联系我们，我们将按以下标准处理：
    </div>
    <div class="notice-cancel-box">
      <div class="notice-cancel-row"><b>服务开始前 36 小时以上取消：</b><span>全额退款。</span></div>
      <div class="notice-cancel-row"><b>服务开始前 24–36 小时（含）取消：</b><span>扣除基础服务费的 10% 作为违约金。</span></div>
      <div class="notice-cancel-row"><b>服务开始前 12–24 小时（含）取消：</b><span>扣除基础服务费的 30% 作为违约金。</span></div>
      <div class="notice-cancel-row"><b>服务开始前不足 12 小时取消：</b><span>已收取的基础服务费将不予退还。</span></div>
    </div>
    <div class="notice-hint">（请您提前规划，以免造成不必要的损失）</div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">五、</span>
      <span class="notice-sec-title">随身资料准备</span>
    </div>
    <div class="notice-body">
      为保障就诊流程顺畅，请您务必带齐以下资料：
      <div class="notice-item" style="margin-top:4pt">
        <span class="notice-item-label">必备证件：</span>
        <span class="notice-item-val">身份证、医保卡 / 社保卡。</span>
      </div>
      <div class="notice-item">
        <span class="notice-item-label">病史资料：</span>
        <span class="notice-item-val">过往病历本、近期检查报告、影像资料（如 CT、MRI 片）等。</span>
      </div>
      <div class="notice-item">
        <span class="notice-item-label">预约凭证：</span>
        <span class="notice-item-val">医院预约成功短信、挂号截图或相关预约单。</span>
      </div>
      <div class="notice-item">
        <span class="notice-item-label">支付工具：</span>
        <span class="notice-item-val">足够金额的银行卡、手机支付或现金，用于支付医疗费用。（陪诊员将在服务前与您确认，也请您提前备好）</span>
      </div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">六、</span>
      <span class="notice-sec-title">紧急情况处理</span>
    </div>
    <div class="notice-body">
      如在服务期间，服务接受方突发身体不适，陪诊员将立即协助呼叫现场医护人员或拨打 120，并联系您预留的紧急联系人。履行上述应急协助后，后续医疗事宜及结果需由您方自行负责。
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">七、</span>
      <span class="notice-sec-title">保险建议</span>
    </div>
    <div class="notice-body">
      我们诚挚建议您根据个人情况，自行购买合适的商业意外保险（<b>建议保额 ≥ 50 万元</b>），为您的出行增添一份安心保障。
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">八、</span>
      <span class="notice-sec-title">服务保障提示</span>
    </div>
    <div class="notice-body">
      如您需咨询或反馈，请拨打公司客服电话 <b>17357867655</b>，或联系公司企业微信客服。
    </div>
  </div>

  <div class="notice-divider"></div>

  <div class="notice-contact">
    <div class="notice-contact-line">如需帮助，请随时联系我们</div>
    <div class="notice-contact-phone">📞 17357867655</div>
    <div class="notice-contact-line" style="margin-top:4pt;font-size:9pt;color:#aaa">青田陪了个伴管理有限公司 · 企业微信客服</div>
  </div>

  <div class="notice-blessing">祝您就诊顺利，早日康复！</div>

</div>

${editScript(`健康信息小档案_${d.name}_${archiveNo}.html`)}
</body>
</html>`;
}
