import {
  HEALTH_ARCHIVE_PRINT_CSS,
  healthArchiveToolbar,
  healthArchiveCheckbox,
} from './health-profile.js';
import { editScript, dateStr, maskIdCard } from './shared-styles.js';
import { buildEscortServiceTermsSecondPage } from './service-confirm-terms.js';
import { buildFamilyAuthorizationPage } from './family-authorization.js';
import { buildRiskDisclosurePage } from './risk-disclosure.js';

const hb = healthArchiveCheckbox;

function htmlAttr(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

export function generateServiceConfirmHtml(data: {
  orderNumber: string;
  customerName: string;
  customerGender?: string;
  customerIdCard?: string;
  customerPhone?: string;
  customerAddress?: string;
  emergencyContact?: string;
  emergencyRelation?: string;
  emergencyPhone?: string;
  attendantName?: string;
  attendantId?: string;
  attendantPhone?: string;
  hospital?: string;
  department?: string;
  serviceDate?: string;
  serviceTimeStart?: string;
  serviceTimeEnd?: string;
  serviceType?: string;
  feeType?: string;
  baseFee?: number;
  transportFee?: number;
  accommodationFee?: number;
  totalFee?: number;
  payMethod?: string;
  logoUrl?: string;
  baseUrl?: string;
  /** 已签署时为客户手写签名图（绝对或相对 URL） */
  customerSignUrl?: string;
  customerSignedBy?: string;
  customerSignerRelation?: string;
  customerSignDate?: string | Date;
  /** 签署人联系电话，用于家属授权书页 */
  signerPhone?: string;
  /** 签署人身份证号（将自动脱敏），用于家属授权书页 */
  signerIdCard?: string;
  /** 是否在末尾追加"家属远程授权书"页（进阶签署开关） */
  enableFamilyAuthorization?: boolean;
  /** 是否在末尾追加"风险强制告知书"页（进阶签署开关） */
  enableRiskDisclosure?: boolean;
}): string {
  const d = data;
  const sType = d.serviceType || '';
  const agreementDateStr =
    d.customerSignUrl && d.customerSignDate
      ? dateStr(d.customerSignDate)
      : '待签署';
  const rawRelation = (d.customerSignerRelation || '').trim();
  const isProxySign = !!rawRelation && rawRelation !== '本人';
  const signerTitle = isProxySign ? '授权代理人签字' : '客户（或授权代理人）签字';
  const proxyName = isProxySign ? (d.customerSignedBy || '—') : '';
  const proxyRelation = isProxySign ? rawRelation : '';
  const svcDate = dateStr(d.serviceDate);
  const custSignSrc = d.customerSignUrl
    ? d.customerSignUrl.startsWith('http')
      ? d.customerSignUrl
      : `${d.baseUrl || ''}${d.customerSignUrl}`
    : '';

  const logoSrc = d.logoUrl
    ? d.logoUrl.startsWith('http')
      ? d.logoUrl
      : `${d.baseUrl || ''}${d.logoUrl}`
    : '';
  const logoBlock = logoSrc
    ? `<div class="logo-wrap"><img src="${logoSrc}" alt="logo"/></div>`
    : `<div class="logo-wrap"><span class="logo-txt">侨</span></div>`;

  const pay = d.payMethod || '';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>陪了个伴陪诊服务确认单 — ${d.orderNumber}</title>
<style>${HEALTH_ARCHIVE_PRINT_CSS}</style>
<style>
/* ── 陪诊确认单：控制为恰好 2 张 A4（第1页确认单 + 第2页条款）── */
body.escort-confirm-print .doc.doc--escort-confirm{
  padding:8mm 10mm 7mm;
  /* 屏幕预览：高度跟内容走，避免页脚下方一大块死白 */
  min-height:auto!important;
  max-height:none!important;
}
body.escort-confirm-print .doc.doc--escort-confirm .hd{
  margin-bottom:5pt;padding-bottom:6pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .hd .doc-title{font-size:14pt}
body.escort-confirm-print .doc.doc--escort-confirm .meta{
  margin-bottom:5pt;padding:5pt 9pt;font-size:8.5pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .tip{
  font-size:7.5pt;line-height:1.48;margin-bottom:6pt;padding:4pt 8pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .sec-hd{
  margin-top:9pt;margin-bottom:5pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .sec-hd .sn{
  width:14pt;height:14pt;font-size:8pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .sec-hd .st{font-size:9.5pt}
body.escort-confirm-print .doc.doc--escort-confirm table{margin-bottom:5pt}
body.escort-confirm-print .doc.doc--escort-confirm td,
body.escort-confirm-print .doc.doc--escort-confirm th{
  padding:5pt 7pt;font-size:8.5pt;line-height:1.35;
}
body.escort-confirm-print .doc.doc--escort-confirm .lbl{
  width:52pt;font-size:7.5pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .escort-subhd{
  margin:5pt 0 4pt!important;font-size:9pt!important;
}
body.escort-confirm-print .doc.doc--escort-confirm .opts{gap:2px}
body.escort-confirm-print .doc.doc--escort-confirm .ci{
  margin-right:8pt;font-size:7.5pt;margin-bottom:0;
}
body.escort-confirm-print .doc.doc--escort-confirm .fee-note{
  font-size:7.5pt!important;margin-top:6pt!important;line-height:1.52!important;
}
body.escort-confirm-print .doc.doc--escort-confirm .terms{
  font-size:8pt;line-height:1.5;margin-bottom:6pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .terms li{padding:2.5pt 0}
body.escort-confirm-print .doc.doc--escort-confirm .escort-terms-confirm li{
  padding:2pt 0;
  line-height:1.45;
}
body.escort-confirm-print .doc.doc--escort-confirm .doc-escort-tail{
  display:block;
}
body.escort-confirm-print .doc.doc--escort-confirm .sign-row{
  margin-top:8pt;gap:8pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .sign-box{
  padding:7pt 8pt;
  min-height:44pt;
}
body.escort-confirm-print .doc.doc--escort-confirm .sign-box .sline{height:28pt}
body.escort-confirm-print .doc.doc--escort-confirm .sign-box .simg{
  max-height:32pt;height:32pt;
}
/*
 * 陪诊确认单不要用 margin-top:auto：会把所有「垫高」压在签字区与页脚线之间，打印/PDF 观感像中间抽掉一截。
 * 改用固定间距 + 放宽上文行高/表格，让留白落在页脚下方更自然。
 */
body.escort-confirm-print .doc.doc--escort-confirm .foot{
  margin-top:10pt!important;
  padding-top:6pt;
  font-size:7pt;
  flex-shrink:0;
  page-break-before:avoid;
  break-before:avoid-page;
}
body.escort-confirm-print .doc.doc--escort-confirm .escort-fee-total{
  font-size:10.5pt!important;
}
/* 条款页 */
body.escort-confirm-print .notice-doc.notice-doc--escort-terms{
  margin:6mm auto;
  padding:8mm 10mm 7mm!important;
  min-height:auto!important;
  display:flex!important;
  flex-direction:column!important;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-escort-terms-main{
  flex:0 1 auto;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-escort-terms-foot{
  flex-shrink:0;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-header{
  padding-bottom:4pt;margin-bottom:4pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-main-title{
  font-size:12pt;letter-spacing:2pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-intro{
  font-size:8pt;line-height:1.48;margin-bottom:6pt;padding:4pt 8pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-sec{margin-bottom:5pt}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-sec-hd{
  margin-bottom:2pt;padding-bottom:2pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-sec-num,
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-sec-title{
  font-size:8.5pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-body{
  font-size:7.8pt;line-height:1.45;padding-left:1pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-item{
  margin-bottom:2pt;line-height:1.45;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-cancel-box{
  padding:2pt 5pt;margin-top:2pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-cancel-row{
  font-size:7.3pt;padding:1pt 0;line-height:1.32;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-hint{font-size:7pt}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-divider{
  margin:6pt 0 4pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-contact{
  padding-top:4pt;
  margin-top:0!important;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-escort-terms-foot{
  margin-top:auto;
  padding-top:6pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-contact-line{font-size:7.5pt}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-contact-phone{font-size:9pt}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-blessing{
  margin-top:8pt;font-size:9pt;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-cancel-intro{
  font-size:7.4pt!important;
  margin-bottom:2pt!important;
  line-height:1.32!important;
}
body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-cancel-box--compact{
  padding:2pt 5pt!important;
}
@media print{
  html,body.escort-confirm-print{background:#fff!important}
  /* 打印时 flex 子项易被拆成「签字在上一页、页脚单独下一页」，改为块级排版并禁止尾块内部分页 */
  body.escort-confirm-print .doc.doc--escort-confirm{
    display:block!important;
    page-break-after:always;
    break-after:page;
    min-height:0!important;
    max-height:none!important;
    box-sizing:border-box;
  }
  body.escort-confirm-print .doc.doc--escort-confirm .doc-escort-tail{
    page-break-inside:avoid;
    break-inside:avoid;
  }
  body.escort-confirm-print .notice-doc.notice-doc--escort-terms{
    page-break-before:always;
    break-before:page;
    /* 高度随条款内容，避免再人为撑满一页导致总页数膨胀；页底联系区仍用 foot 的 margin-top:auto（屏幕/部分阅读器） */
    min-height:0!important;
    max-height:none!important;
    box-sizing:border-box;
    page-break-inside:auto;
    display:flex!important;
    flex-direction:column!important;
  }
  body.escort-confirm-print .notice-doc.notice-doc--escort-terms .notice-escort-terms-foot{
    margin-top:auto!important;
  }
  @page{
    size:A4 portrait;
    margin:6mm;
  }
}
</style>
</head>
<body class="escort-confirm-print">
${healthArchiveToolbar()}
<div class="doc doc--escort-confirm">
  <div class="hd">
    <div class="hd-top">
      ${logoBlock}
      <div class="org">
        <div class="org-name">陪了个伴管理中心</div>
        <div class="org-sub">青田陪了个伴管理有限公司 · 专业陪诊服务</div>
      </div>
    </div>
    <div class="doc-label">
      <div class="doc-title">陪诊服务确认单</div>
      <div class="doc-en">Escort Service Confirmation</div>
    </div>
  </div>

  <div class="meta">
    <div class="mi"><span class="ml">订单编号</span><span class="mv">${d.orderNumber}</span></div>
    <div class="mi"><span class="ml">客户姓名</span><span class="mv">${d.customerName}</span></div>
    <div class="mi"><span class="ml">签订日期</span><span class="mv">${agreementDateStr}</span></div>
    <div class="mi"><span class="ml">服务日期</span><span class="mv">${svcDate}</span></div>
  </div>

  <div class="tip">致客户：感谢您选择青田陪了个伴管理有限公司。为确保服务安全顺利，请您务必提前独立、完整、真实地填写并签署《陪了个伴客户健康信息小档案》。本页为确认单正文；<strong>背页为《陪了个伴陪诊服务条款》全文</strong>，请一并阅读。签署即表示知悉并同意确认单与条款的全部内容。</div>

  <div class="sec-hd"><span class="sn">一</span><span class="st">服务双方信息</span></div>
  <p class="escort-subhd" style="font-weight:600;margin:6pt 0 4pt;font-size:10pt;color:#1a6b52">（一）服务接受方信息</p>
  <table>
    <tr>
      <td class="lbl">客户姓名</td>
      <td class="val editable">${d.customerName}</td>
      <td class="lbl">性别</td>
      <td class="val">${hb(d.customerGender === 'male', '男')} ${hb(d.customerGender === 'female', '女')}</td>
    </tr>
    <tr>
      <td class="lbl">身份证号码</td><td class="val">${maskIdCard(d.customerIdCard)}</td>
      <td class="lbl">联系电话</td><td class="val">${d.customerPhone || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">住宿地址</td><td class="val editable vs" colspan="3">${d.customerAddress || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">紧急联系人</td><td class="val editable">${d.emergencyContact || '—'}</td>
      <td class="lbl">关系 / 电话</td><td class="val">${d.emergencyRelation || '—'} / ${d.emergencyPhone || '—'}</td>
    </tr>
  </table>
  <p class="escort-subhd" style="font-weight:600;margin:6pt 0 4pt;font-size:10pt;color:#1a6b52">（二）服务提供方信息</p>
  <table>
    <tr>
      <td class="lbl">陪诊员</td><td class="val">${d.attendantName || '—'}</td>
      <td class="lbl">工号</td><td class="val">${d.attendantId || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">联系电话</td><td class="val" colspan="3">${d.attendantPhone || '—'}</td>
    </tr>
  </table>

  <div class="sec-hd"><span class="sn">二</span><span class="st">本次服务详情</span></div>
  <table>
    <tr>
      <td class="lbl">服务医院/科室</td>
      <td class="val editable vs" colspan="3">${d.hospital || '—'} / ${d.department || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">服务日期</td><td class="val">${svcDate}</td>
      <td class="lbl">起止时间</td><td class="val">${d.serviceTimeStart || '—'} 至 ${d.serviceTimeEnd || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">服务类型</td>
      <td class="vs" colspan="3">
        <div class="opts">
          ${hb(sType.includes('门诊'), '门诊陪诊')}
          ${hb(sType.includes('检查'), '检查陪同')}
          ${hb(sType.includes('出入院'), '出入院办理')}
          ${hb(!sType.includes('门诊') && !sType.includes('检查') && !sType.includes('出入院') && sType !== '', `其他：${sType || '—'}`)}
        </div>
      </td>
    </tr>
  </table>

  <div class="sec-hd"><span class="sn">三</span><span class="st">服务项目与费用</span></div>
  <table>
    <tr>
      <td class="lbl">基础陪诊费</td>
      <td class="val editable">¥${Number(d.baseFee || 0).toFixed(2)}</td>
      <td class="lbl">费用类型</td>
      <td class="val">${d.feeType || '—'}</td>
    </tr>
    <tr>
      <td class="lbl">交通预收</td>
      <td class="val editable">¥${Number(d.transportFee || 0).toFixed(2)}</td>
      <td class="lbl">住宿预收</td>
      <td class="val editable">¥${Number(d.accommodationFee || 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td class="lbl" style="font-weight:700">费用合计</td>
      <td class="val escort-fee-total" colspan="3" style="font-weight:700;color:#1a6b52;font-size:12pt">¥${Number(d.totalFee || 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td class="lbl">支付方式</td>
      <td class="vs" colspan="3"><div class="opts">
        ${hb(pay === 'cash', '现金')}
        ${hb(pay === 'wechat', '微信')}
        ${hb(pay === 'alipay', '支付宝')}
        ${hb(pay === 'card' || pay === 'bank_transfer', '银行卡/转账')}
        ${hb(pay === 'other' || (!!pay && !['cash','wechat','alipay','card','bank_transfer'].includes(pay)), '其他')}
      </div></td>
    </tr>
  </table>
  <p class="fee-note" style="font-size:8.5pt;color:#888;margin-top:6pt;line-height:1.55">
    ※ 挂号费、医药费、检查费等均由客户在医院现场自行支付，公司及陪诊员不提供垫付（另有书面约定的除外）。<br/>
    ※ 预收准备金于服务结束后按实际产生费用结算，多退少补。
  </p>

  <div class="sec-hd"><span class="sn">四</span><span class="st">重要确认与签署</span></div>
  <ul class="terms escort-terms-confirm">
    <li><span class="tn">1.</span><span>已独立、完整、真实地填写并签署《陪了个伴客户健康信息小档案》；</span></li>
    <li><span class="tn">2.</span><span>已阅读并理解《陪了个伴陪诊服务条款》，同意服务内容、时间、地点与费用约定；</span></li>
    <li><span class="tn">3.</span><span>授权紧急情况下陪诊员可联系上述紧急联系人。</span></li>
    <li><span class="tn">4.</span><span>知悉公司对病历、报告、联系方式等隐私依法保密，除法规要求或经许可外不向第三方泄露。</span></li>
  </ul>
  <table class="escort-sign-mode">
    <tr>
      <td class="lbl">签署方式</td>
      <td class="vs" colspan="3">
        <div class="opts">
          ${hb(!isProxySign, '本人签署')}
          ${hb(isProxySign, '代签署（非本人）')}
        </div>
      </td>
    </tr>
    ${
      isProxySign
        ? `<tr>
      <td class="lbl">代签人姓名</td>
      <td class="val">${htmlAttr(proxyName)}</td>
      <td class="lbl">与客户关系</td>
      <td class="val">${htmlAttr(proxyRelation)}</td>
    </tr>`
        : ''
    }
  </table>
  <div class="doc-escort-tail">
  <div class="sign-row">
    <div class="sign-box" style="flex:1.4">
      <div class="sl">${signerTitle}</div>
      ${
        custSignSrc
          ? `<div class="sv" style="min-height:13pt">${d.customerSignedBy || d.customerName || '—'}${
              isProxySign && proxyRelation ? `（${proxyRelation}，代签）` : ''
            }</div><img src="${htmlAttr(custSignSrc)}" alt="签名" class="simg"/>`
          : `<div class="sline"></div><div class="sv">&nbsp;</div>`
      }
    </div>
    <div class="sign-box">
      <div class="sl">签署日期</div>
      <div class="sline"></div>
      <div class="sv">${agreementDateStr}</div>
    </div>
    <div class="sign-box">
      <div class="sl">公司经办人签字/盖章</div>
      <div class="sline"></div>
      <div class="sv">&nbsp;</div>
    </div>
  </div>

  <div class="foot">
    <span>青田陪了个伴管理有限公司 · 客服：17357867655</span>
    <span>打印日期 ${dateStr(new Date())}</span>
  </div>
  </div>
</div>
${buildEscortServiceTermsSecondPage()}
${
  d.enableRiskDisclosure
    ? buildRiskDisclosurePage({
        customerName: d.customerName,
        serviceType: d.serviceType,
      })
    : ''
}
${
  d.enableFamilyAuthorization && isProxySign
    ? buildFamilyAuthorizationPage({
        customerName: d.customerName,
        customerIdCard: d.customerIdCard,
        customerPhone: d.customerPhone,
        signerName: d.customerSignedBy || proxyName || '—',
        signerRelation: proxyRelation || rawRelation,
        signerPhone: d.signerPhone,
        signerIdCard: d.signerIdCard,
        orderNumber: d.orderNumber,
        serviceDate: svcDate,
        signatureUrl: custSignSrc || undefined,
        signedAt: d.customerSignDate,
      })
    : ''
}
${editScript(`陪诊服务确认单_${d.orderNumber}.html`)}
</body></html>`;
}
