/**
 * 轻量「检索」层：按关键词命中陪了个伴服务相关说明，注入 system，提升回答贴合度（非向量库）
 */
export const ADVISOR_KNOWLEDGE_CHUNKS: Array<{ keywords: string[]; text: string }> = [
  {
    keywords: ['陪诊', '陪同', '去医院', '挂号', '取号', '门诊'],
    text: '陪了个伴可提供门诊陪诊、检查陪同等服务：下单时需选择服务对象、医院与科室、时段；就诊当天陪诊员会协助排队、沟通与取药。具体操作可在「服务」或「我的-我的服务」中预约。',
  },
  {
    keywords: ['体检', '化验', '抽血', '空腹', '报告'],
    text: '体检前常需空腹 8–12 小时、避免剧烈运动；部分项目需憋尿或停药，请以体检中心说明为准。体检报告上传后可用本页「报告解读」辅助理解，最终以医生解读为准。',
  },
  {
    keywords: ['高血压', '糖尿病', '慢病', '长期吃药'],
    text: '慢病用户需遵医嘱规律用药、监测血压/血糖并定期复诊；用药调整不可自行停药或加量。平台用药提醒可帮助记录服药时间，但不能替代医生处方。',
  },
  {
    keywords: ['急诊', '120', '急救'],
    text: '出现持续胸痛、呼吸困难、意识不清、大量出血等，请立即拨打 120 或就近急诊，勿只依赖线上咨询。',
  },
  {
    keywords: ['海外', '异地', '子女', '华侨'],
    text: '陪了个伴侧重服务海外华侨家庭的国内亲属：可通过家庭档案、家属同步与 AI 顾问远程了解老人就医与健康情况，再结合线下陪诊完成实际到院。',
  },
];

export function retrieveAdvisorKnowledge(query: string): string {
  const q = (query || '').toLowerCase();
  if (!q.trim()) return '';
  const hits: string[] = [];
  for (const chunk of ADVISOR_KNOWLEDGE_CHUNKS) {
    if (chunk.keywords.some((k) => q.includes(k.toLowerCase()))) {
      hits.push(chunk.text);
    }
  }
  if (!hits.length) return '';
  return (
    '\n\n【陪了个伴服务与环境提示（仅作业务说明，不构成医疗建议）】\n' + [...new Set(hits)].join('\n')
  );
}
