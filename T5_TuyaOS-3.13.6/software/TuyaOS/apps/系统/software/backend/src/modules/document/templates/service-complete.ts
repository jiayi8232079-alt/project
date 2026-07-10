import {
  SHARED_CSS,
  checkbox,
  toolbar,
  editScript,
  dateStr,
} from './shared-styles.js';

export function generateServiceCompleteHtml(data: {
  orderNumber: string;
  attendantName?: string;
  attendantId?: string;
  serviceDate?: string;
  customerName?: string;
  hospital?: string;
  department?: string;
  serviceType?: string;
  serviceTimeStart?: string;
  serviceTimeEnd?: string;
  serviceDuration?: string;
  checkpoints?: {
    meetup?: boolean;
    profileCheck?: boolean;
    registration?: boolean;
    consultation?: boolean;
    consultationNote?: string;
    payment?: boolean;
    examination?: boolean;
    examinationItems?: string;
    medication?: boolean;
    medicationItems?: string;
    handover?: boolean;
  };
  clientStatus?: {
    mentalState?: string;
    communication?: string;
    mobility?: string;
    other?: string;
  };
  incident?: {
    hasIncident?: boolean;
    time?: string;
    description?: string;
    actions?: string[];
    emergencyContactName?: string;
    result?: string;
  };
  clientFeedback?: string;
  clientRating?: string;
  reviewNote?: string;
  reviewResult?: string;
  reviewer?: string;
  reviewDate?: string;
  timelines?: { time: string; content: string }[];
}): string {
  const d = data;
  const cp = d.checkpoints || {};
  const cs = d.clientStatus || {};
  const inc = d.incident || {};

  const timelineHtml = (d.timelines || [])
    .map(
      (t) =>
        `<tr><td style="width:100px">${t.time}</td><td>${t.content}</td></tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<title>陪了个伴陪诊服务完成记录单 - ${d.orderNumber}</title>
<style>${SHARED_CSS}</style></head><body>
${toolbar()}
<div class="header">
  <div class="logo">陪了个伴</div>
  <h1>陪诊服务完成记录单</h1>
</div>

<table style="margin-bottom:16px">
<tr><td class="label">陪诊员</td><td>${d.attendantName || '—'}</td><td class="label">工号</td><td>${d.attendantId || '—'}</td><td class="label">服务日期</td><td>${dateStr(d.serviceDate)}</td></tr>
<tr><td class="label">订单编号</td><td>${d.orderNumber}</td><td class="label">客户姓名</td><td colspan="3">${d.customerName || '—'}</td></tr>
</table>

<div class="section"><h2>一、基础服务信息</h2>
<table>
<tr><td class="label">服务医院/科室</td><td class="editable">${d.hospital || '—'} / ${d.department || '—'}</td></tr>
<tr><td class="label">服务类型</td><td>
  ${checkbox(d.serviceType?.includes('门诊') || false)} 门诊陪诊 
  ${checkbox(d.serviceType?.includes('检查') || false)} 检查陪同 
  ${checkbox(d.serviceType?.includes('出入院') || false)} 出入院办理 
  ${checkbox(!d.serviceType?.includes('门诊') && !d.serviceType?.includes('检查') && !d.serviceType?.includes('出入院') && !!d.serviceType)} 其他：${d.serviceType || ''}
</td></tr>
<tr><td class="label">服务起止时间</td><td>${d.serviceTimeStart || '—'} 至 ${d.serviceTimeEnd || '—'}（共计约 ${d.serviceDuration || '—'}）</td></tr>
</table></div>

<div class="section"><h2>二、关键服务节点记录</h2>
<table>
<tr><th style="width:30%">服务环节</th><th>完成情况</th></tr>
<tr><td>1. 汇合</td><td>${checkbox(cp.meetup !== false)} 已完成</td></tr>
<tr><td>2. 与客户健康档案核对</td><td>${checkbox(cp.profileCheck !== false)} 已完成</td></tr>
<tr><td>3. 挂号/签到</td><td>${checkbox(cp.registration !== false)} 已完成</td></tr>
<tr><td>4. 诊室陪同</td><td>${checkbox(cp.consultation !== false)} 已陪同进入 ${checkbox(cp.consultation === false)} 未进入（${cp.consultationNote || '客户要求'}）</td></tr>
<tr><td>5. 缴费</td><td>${checkbox(cp.payment !== false)} 已协助完成</td></tr>
<tr><td>6. 检查/检验</td><td>${checkbox(cp.examination !== false)} 已陪同完成 <br>检查项目：<span class="editable">${cp.examinationItems || '—'}</span></td></tr>
<tr><td>7. 取药</td><td>${checkbox(cp.medication !== false)} 已协助完成 <br>药名：<span class="editable">${cp.medicationItems || '—'}</span></td></tr>
<tr><td>8. 服务结束交接</td><td>${checkbox(cp.handover !== false)} 已完成 — 病历、报告、药品等已交接清楚</td></tr>
</table></div>

${timelineHtml ? `<div class="section"><h2>服务过程时间线</h2><table><tr><th style="width:100px">时间</th><th>内容</th></tr>${timelineHtml}</table></div>` : ''}

<div class="section"><h2>三、客户状况客观记录</h2>
<table>
<tr><td class="label">精神状态</td><td>
  ${checkbox(cs.mentalState === 'good')} 良好 ${checkbox(cs.mentalState === 'fair')} 一般 ${checkbox(cs.mentalState === 'tired')} 疲惫
</td></tr>
<tr><td class="label">沟通情况</td><td>
  ${checkbox(cs.communication === 'smooth')} 顺畅 ${checkbox(cs.communication === 'loud')} 需提高音量/重复 ${checkbox(cs.communication === 'text')} 需借助文字
</td></tr>
<tr><td class="label">行动能力</td><td>
  ${checkbox(cs.mobility === 'independent')} 自如 ${checkbox(cs.mobility === 'mild')} 需轻度搀扶 ${checkbox(cs.mobility === 'wheelchair')} 需轮椅辅助
</td></tr>
<tr><td class="label">其他</td><td class="editable">${cs.other || '—'}</td></tr>
</table></div>

<div class="section"><h2>四、突发情况与重要事项记录</h2>
<table>
<tr><td class="label">是否有突发情况</td><td>
  ${checkbox(!inc.hasIncident)} 无 ${checkbox(!!inc.hasIncident)} 有
</td></tr>
${
  inc.hasIncident
    ? `
<tr><td class="label">发生时间</td><td class="editable">${inc.time || '—'}</td></tr>
<tr><td class="label">具体情况</td><td class="editable">${inc.description || '—'}</td></tr>
<tr><td class="label">已采取措施</td><td>
  ${checkbox(inc.actions?.includes('medical') || false)} 呼叫现场医护
  ${checkbox(inc.actions?.includes('report') || false)} 报告公司负责人
  ${checkbox(inc.actions?.includes('120') || false)} 拨打120
  ${checkbox(inc.actions?.includes('emergency_contact') || false)} 通知紧急联系人（${inc.emergencyContactName || '—'}）
</td></tr>
<tr><td class="label">目前状况/结果</td><td class="editable">${inc.result || '—'}</td></tr>
`
    : ''
}
</table></div>

<div class="section"><h2>五、陪诊员提交</h2>
<p style="font-size:13px;margin-bottom:12px">陪诊员承诺：本人确认以上记录真实、客观、完整地反映了本次服务过程。</p>
<div class="signature-area">
  <div class="signature-box"><div class="line"></div><div class="hint">陪诊员签字</div></div>
  <div class="signature-box"><div class="line"></div><div class="hint">提交日期</div></div>
</div></div>

<div class="section"><h2>六、公司审核意见</h2>
<table>
<tr><td class="label">客户评价</td><td>
  ${checkbox(d.clientRating === 'very_satisfied')} 非常满意
  ${checkbox(d.clientRating === 'satisfied')} 满意
  ${checkbox(d.clientRating === 'fair')} 一般
  ${checkbox(d.clientRating === 'unsatisfied')} 不满意
</td></tr>
<tr><td class="label">客户意见</td><td class="editable">${d.clientFeedback || '—'}</td></tr>
<tr><td class="label">审核意见</td><td>
  ${checkbox(d.reviewResult === 'approved')} 记录完整，流程合规，予以归档
  ${checkbox(d.reviewResult === 'supplement')} 需补充说明：<span class="editable">${d.reviewNote || ''}</span>
</td></tr>
<tr><td class="label">审核人/日期</td><td>${d.reviewer || '—'} / ${dateStr(d.reviewDate)}</td></tr>
</table></div>

<div class="footer"><p>青田陪了个伴管理有限公司 | 本记录与《客户健康信息小档案》共同构成完整服务档案</p></div>
${editScript(`服务完成记录单_${d.orderNumber}.html`)}
</body></html>`;
}
