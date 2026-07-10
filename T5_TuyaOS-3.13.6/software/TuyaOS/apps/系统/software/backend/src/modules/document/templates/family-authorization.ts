/**
 * 《家属远程授权书》——当签署人与服务接受方（客户本人）不一致时强制插入的电子文书。
 *
 * 使用场景：
 *   - 子女 / 配偶 / 其他家属代为签署老人或未成年人的陪诊服务确认单
 *   - 任意"代为签署"（signerName ≠ customerName）情形
 *
 * 法律定位：家属/授权人以书面形式确认其与服务接受方的关系、授权范围与责任承担，
 *   同时明确陪了个伴可据此书面授权对外提供服务、出具电子确认单、存档与留痕。
 */

import { dateStr, maskIdCard } from './shared-styles.js';

export function buildFamilyAuthorizationPage(data: {
  /** 被授权方（服务接受方/档案实名主体）姓名 */
  customerName: string;
  /** 被授权方身份证号（脱敏展示） */
  customerIdCard?: string;
  /** 被授权方电话（可选） */
  customerPhone?: string;
  /** 授权人（签署人）姓名 */
  signerName: string;
  /** 授权人与被授权方关系（如：儿子 / 女儿 / 配偶 / 其他） */
  signerRelation?: string;
  /** 授权人联系电话 */
  signerPhone?: string;
  /** 授权人身份证号（可选，脱敏） */
  signerIdCard?: string;
  /** 订单编号 */
  orderNumber?: string;
  /** 服务日期 */
  serviceDate?: string;
  /** 已签署时为签署人手写签名图 URL */
  signatureUrl?: string;
  /** 已签署时为签署日期 */
  signedAt?: string | Date;
}): string {
  const rel = (data.signerRelation || '').trim() || '——';
  const maskedCustomerId = data.customerIdCard ? maskIdCard(data.customerIdCard) : '';
  const maskedSignerId = data.signerIdCard ? maskIdCard(data.signerIdCard) : '';
  const serviceDateText = data.serviceDate || '';
  const orderNumberText = data.orderNumber || '';
  const signedAtText = data.signedAt ? dateStr(data.signedAt) : '';
  const signatureImgHtml = data.signatureUrl
    ? `<img src="${data.signatureUrl}" alt="签署人签名" class="notice-sig-img" />`
    : '<span class="notice-sig-placeholder">（电子签名处）</span>';

  return `
<!-- ══════════ 附页：家属远程授权书 ══════════ -->
<div class="notice-doc notice-doc--family-auth">
  <div class="notice-header">
    <div class="notice-main-title">家属（亲属）远程授权书</div>
    <div class="notice-sub-brand">青田陪了个伴管理有限公司 · 陪了个伴管理中心</div>
  </div>

  <div class="notice-escort-terms-main">
  <div class="notice-intro">
    本授权书由签署人（下称"授权人"）就其与<strong>${data.customerName}</strong>（下称"被授权方/服务接受方"）之间的亲属/监护/家属关系，自愿签署并提交至青田陪了个伴管理有限公司（下称"公司"），用于公司依据本书面授权为被授权方提供陪诊服务、出具电子《陪了个伴陪诊服务确认单》及相关留痕归档。
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">第一条</span>
      <span class="notice-sec-title">当事人信息</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">1.1</span><span class="notice-item-val">授权人（签署人）：<strong>${data.signerName}</strong>；与被授权方关系：<strong>${rel}</strong>${data.signerPhone ? `；联系电话：<strong>${data.signerPhone}</strong>` : ''}${maskedSignerId ? `；身份证号：<strong>${maskedSignerId}</strong>` : ''}。</span></div>
      <div class="notice-item"><span class="notice-item-label">1.2</span><span class="notice-item-val">被授权方（服务接受方）：<strong>${data.customerName}</strong>${data.customerPhone ? `；联系电话：<strong>${data.customerPhone}</strong>` : ''}${maskedCustomerId ? `；身份证号：<strong>${maskedCustomerId}</strong>` : ''}。</span></div>
      <div class="notice-item"><span class="notice-item-label">1.3</span><span class="notice-item-val">对应订单编号：<strong>${orderNumberText || '——'}</strong>${serviceDateText ? `；服务日期：<strong>${serviceDateText}</strong>` : ''}。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">第二条</span>
      <span class="notice-sec-title">授权内容</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">2.1</span><span class="notice-item-val">授权人确认其为被授权方的<strong>合法家属/近亲属/监护人</strong>，在被授权方因年龄、健康、地域或语言等原因无法自行签署本次服务相关文书时，经被授权方口头/书面同意或依据法定亲属关系，<strong>代为签署</strong>本次《陪了个伴陪诊服务确认单》及与本订单相关的附属电子文书。</span></div>
      <div class="notice-item"><span class="notice-item-label">2.2</span><span class="notice-item-val">本授权仅限于本次订单及其后续派生的必要变更（如换单、延时、现场加项）；超出本授权范围的，须另行签署补充授权。</span></div>
      <div class="notice-item"><span class="notice-item-label">2.3</span><span class="notice-item-val">授权人同意公司基于本授权书进行<strong>服务留痕、费用结算、审计归档</strong>，并同意将本授权书附入电子服务档案，与《陪了个伴陪诊服务确认单》共同构成完整服务合同。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">第三条</span>
      <span class="notice-sec-title">陈述与保证</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">3.1</span><span class="notice-item-val">授权人保证所填写的身份、亲属关系、健康档案信息<strong>真实、准确、完整</strong>；如有隐瞒、遗漏、虚假陈述，由授权人与被授权方共同承担由此产生的一切法律后果与经济损失。</span></div>
      <div class="notice-item"><span class="notice-item-label">3.2</span><span class="notice-item-val">授权人已告知被授权方本次服务内容、主要风险、费用与签署事实，并获得被授权方本人的明确同意；被授权方丧失民事行为能力的，由授权人依法代为意思表示。</span></div>
      <div class="notice-item"><span class="notice-item-label">3.3</span><span class="notice-item-val">授权人同意公司在合理期限内依法<strong>收集、存储、使用</strong>授权人及被授权方的姓名、联系方式、健康与就医信息，用于履行服务、合规留痕与风险管控。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">第四条</span>
      <span class="notice-sec-title">责任承担</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">4.1</span><span class="notice-item-val">因授权人未如实告知被授权方健康状况、既往病史、过敏史或服务风险，致使现场发生不良事件、延误或加重病情的，由授权人与被授权方自行承担；公司在合理注意义务范围内不承担赔偿责任。</span></div>
      <div class="notice-item"><span class="notice-item-label">4.2</span><span class="notice-item-val">因授权人伪造亲属关系、超越授权范围签署的，由授权人承担全部民事、行政乃至刑事责任；公司基于本书面授权善意提供服务产生的合理费用，有权照常收取。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">第五条</span>
      <span class="notice-sec-title">生效与留痕</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">5.1</span><span class="notice-item-val">本授权书经授权人电子签名（或手写签名）后即时生效，有效期自签署日起至本次服务完成并履约结束之日止。</span></div>
      <div class="notice-item"><span class="notice-item-label">5.2</span><span class="notice-item-val">本授权书电子签名、签署时间戳、操作日志等由公司服务器留痕存档，可作为履约与争议解决证据；如客户需要纸质件，可向公司申请线下出具。</span></div>
    </div>
  </div>

  <div class="notice-divider"></div>
  </div>

  <div class="notice-escort-terms-foot">
  <div class="notice-sig-block">
    <div class="notice-sig-row">
      <div class="notice-sig-col">
        <div class="notice-sig-label">授权人（签署人）</div>
        <div class="notice-sig-area">${signatureImgHtml}</div>
        <div class="notice-sig-name">${data.signerName}</div>
      </div>
      <div class="notice-sig-col">
        <div class="notice-sig-label">签署日期</div>
        <div class="notice-sig-area notice-sig-area--date">${signedAtText || '____ 年 ____ 月 ____ 日'}</div>
        <div class="notice-sig-name">&nbsp;</div>
      </div>
    </div>
  </div>

  <div class="notice-contact">
    <div class="notice-contact-line">对本授权书或服务安排有任何疑问，请联系</div>
    <div class="notice-contact-phone">17357867655</div>
    <div class="notice-contact-line" style="margin-top:4pt;font-size:9pt;color:#aaa">青田陪了个伴管理有限公司 · 企业微信客服</div>
  </div>
  </div>
</div>
`;
}
