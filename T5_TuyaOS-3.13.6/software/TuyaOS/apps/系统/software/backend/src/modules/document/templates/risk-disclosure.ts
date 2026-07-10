/**
 * 《风险强制告知书》——在进阶签署流程中作为独立页强制插入。
 *
 * 使用场景：只要管理后台开启了"风险强制告知"开关，所有服务确认单签署流程都会插入本页。
 * 法律定位：依据《民法典》《消费者权益保护法》《个人信息保护法》及陪诊行业规范，
 *   以显著方式告知服务接受方及其家属：非医疗性质、自负风险、应急流程、
 *   陪了个伴不对医疗决策负责等重大事项，由签署人勾选"已阅读并理解"后方可进入签署环节。
 */

export function buildRiskDisclosurePage(data?: {
  /** 服务接受方（客户）姓名，用于人称化文案 */
  customerName?: string;
  /** 服务类型，用于上下文提示 */
  serviceType?: string;
}): string {
  const who = (data?.customerName || '').trim();
  const serviceType = (data?.serviceType || '').trim();

  return `
<!-- ══════════ 附页：陪诊服务风险强制告知书 ══════════ -->
<div class="notice-doc notice-doc--risk">
  <div class="notice-header">
    <div class="notice-main-title">陪诊服务 · 风险强制告知书</div>
    <div class="notice-sub-brand">青田陪了个伴管理有限公司 · 陪了个伴管理中心</div>
  </div>

  <div class="notice-escort-terms-main">
  <div class="notice-intro">
    <strong>请您在签署服务确认单前务必仔细阅读本告知书。</strong>
    本告知书以<strong>显著方式</strong>披露陪诊服务的性质、边界与重大风险，${who ? `请<strong>${who}</strong>及其家属` : '请您及您的家属'}充分知悉后再决定是否接受${serviceType ? `「${serviceType}」` : ''}服务。您勾选"已阅读并理解"并完成签署，视为您对下列全部内容明确知晓并接受。
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">一</span>
      <span class="notice-sec-title">服务性质：非医疗</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">1.1</span><span class="notice-item-val">陪了个伴陪诊服务为<strong>非医疗性质</strong>的生活辅助与就医陪同服务，<strong>不构成</strong>诊断、处方、治疗、护理、急救等任何医疗行为。</span></div>
      <div class="notice-item"><span class="notice-item-label">1.2</span><span class="notice-item-val">陪诊人员<strong>不是执业医师、药师或护士</strong>，不得对您的病情提出诊疗意见，不对您是否就诊、检查、用药作出决定。</span></div>
      <div class="notice-item"><span class="notice-item-label">1.3</span><span class="notice-item-val">凡涉及诊断、治疗方案、药物与剂量、手术知情同意等医疗决策，均<strong>以医疗机构及其医务人员出具的书面意见为准</strong>。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">二</span>
      <span class="notice-sec-title">重大风险提示</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">2.1</span><span class="notice-item-val">前往医院途中、排队候诊、候检、候药或检查过程中，因客户<strong>自身基础疾病、突发急症、体力不支、跌倒、晕厥、呛咳、过敏</strong>等引发的健康风险，可能快速恶化甚至危及生命；上述情形与陪诊服务本身无必然因果关系。</span></div>
      <div class="notice-item"><span class="notice-item-label">2.2</span><span class="notice-item-val">就诊过程中可能涉及<strong>有创检查、穿刺、造影、注射、输液、麻醉</strong>等操作，其医疗风险由医疗机构依法告知并取得患者或家属的独立知情同意，不在陪诊服务的提示范围之内。</span></div>
      <div class="notice-item"><span class="notice-item-label">2.3</span><span class="notice-item-val">因客户或家属隐瞒病史、过敏史、既往手术史或当前用药情况造成的不良后果，由客户及家属自行承担；陪诊人员在合理注意义务范围内不承担赔偿责任。</span></div>
      <div class="notice-item"><span class="notice-item-label">2.4</span><span class="notice-item-val">就医过程可能出现<strong>挂号失败、号源不足、医生临时停诊、医院系统故障、检查报告迟出</strong>等客观情形，导致服务实际安排与预期不一致；此类不可抗力或第三方因素所致损失，公司不承担违约责任。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">三</span>
      <span class="notice-sec-title">应急与现场处置</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">3.1</span><span class="notice-item-val">服务过程中如您出现不适、跌倒或突发急症，陪诊人员将<strong>第一时间联系现场医务人员、拨打 120 并通知紧急联系人</strong>；客户及家属须保证紧急联系电话畅通。</span></div>
      <div class="notice-item"><span class="notice-item-label">3.2</span><span class="notice-item-val">在医疗机构未接管前，陪诊人员可在合理范围内<strong>协助呼救与保持体位</strong>，<strong>不得</strong>擅自施行心肺复苏、用药、注射等专业医疗行为；由此产生的等待时间不视为服务违约。</span></div>
      <div class="notice-item"><span class="notice-item-label">3.3</span><span class="notice-item-val">因客户或家属坚持拒绝送医、擅自离开医疗机构所致的一切后果，由客户及家属自行承担。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">四</span>
      <span class="notice-sec-title">个人信息与留痕</span>
    </div>
    <div class="notice-body">
      <div class="notice-item"><span class="notice-item-label">4.1</span><span class="notice-item-val">为履行服务、保障安全及合规留痕，公司将<strong>依法收集与存储</strong>您的姓名、电话、身份证号、健康档案、就诊记录、签署记录及关键通讯记录等信息，并对敏感字段进行加密存储。</span></div>
      <div class="notice-item"><span class="notice-item-label">4.2</span><span class="notice-item-val">上述信息仅用于<strong>本次及后续派生服务的履约、风险管控、审计及法定披露</strong>；除法律法规规定或经您书面授权外，不向无关第三方披露。</span></div>
      <div class="notice-item"><span class="notice-item-label">4.3</span><span class="notice-item-val">您享有<strong>查阅、更正、删除</strong>个人信息以及撤回同意的权利；如需行使相关权利，请联系公司客服。</span></div>
    </div>
  </div>

  <div class="notice-sec">
    <div class="notice-sec-hd">
      <span class="notice-sec-num">五</span>
      <span class="notice-sec-title">知情确认</span>
    </div>
    <div class="notice-body notice-body--confirm">
      <div class="notice-confirm-check">☑</div>
      <div class="notice-confirm-text">
        本人已仔细阅读并充分理解以上全部告知事项，已知悉陪诊服务的<strong>非医疗属性、主要风险、应急处置边界与个人信息处理方式</strong>；本人自愿在此基础上签署《陪了个伴陪诊服务确认单》。
      </div>
    </div>
  </div>

  <div class="notice-divider"></div>
  </div>

  <div class="notice-escort-terms-foot">
  <div class="notice-contact">
    <div class="notice-contact-line">如对本告知书有任何疑问，请在签署前联系公司客服</div>
    <div class="notice-contact-phone">17357867655</div>
    <div class="notice-contact-line" style="margin-top:4pt;font-size:9pt;color:#aaa">青田陪了个伴管理有限公司 · 企业微信客服</div>
  </div>
  </div>
</div>
`;
}
