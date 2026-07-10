import { DrugInteractionSeverity } from '../../entities/drug-interaction-rule.entity.js';

export interface BuiltinRule {
  drugA: string;
  drugB: string;
  drugAAliases: string[];
  drugBAliases: string[];
  severity: DrugInteractionSeverity;
  mechanism: string;
  recommendation: string;
  evidenceLevel: 'A' | 'B' | 'C';
}

/**
 * 内置高频/高风险药物相互作用知识库。
 *
 * 规则覆盖：抗凝 / 抗血小板 / 降压 / 降糖 / 心血管 / 抗抑郁 / 抗生素 /
 *          他汀 / 中老年常用中药等最常见搭配。
 *
 * 说明：
 *   - 别名尽量覆盖商品名 + 通用名 + 常见英文；匹配时使用"包含"策略，
 *     所以别名过短（如"钾"）会误报，务必保持 >=2 字符且语义清晰。
 *   - 所有条目仅作为风险提示，不替代医师处方判断。
 */
export const BUILTIN_DRUG_INTERACTION_RULES: BuiltinRule[] = [
  // ─── 抗凝/抗血小板联用（出血风险）──────────────
  {
    drugA: '华法林',
    drugB: '阿司匹林',
    drugAAliases: ['华法林', 'Warfarin', '可密定', '华法令'],
    drugBAliases: ['阿司匹林', 'Aspirin', '拜阿司匹灵', '拜阿', '乙酰水杨酸'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '两者均可抑制凝血，联用显著增加消化道/颅内出血风险。',
    recommendation: '除非医生明确评估（如机械瓣膜）否则不建议联用。若已联用请密切监测INR、注意黑便、牙龈出血等异常。',
    evidenceLevel: 'A',
  },
  {
    drugA: '华法林',
    drugB: '氯吡格雷',
    drugAAliases: ['华法林', 'Warfarin', '可密定'],
    drugBAliases: ['氯吡格雷', 'Clopidogrel', '波立维', '泰嘉'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '抗凝+抗血小板双重作用，严重出血风险显著升高。',
    recommendation: '除心脏支架术后等特定指征外不建议联用，并需要胃黏膜保护与定期监测。',
    evidenceLevel: 'A',
  },
  {
    drugA: '阿司匹林',
    drugB: '氯吡格雷',
    drugAAliases: ['阿司匹林', 'Aspirin', '拜阿司匹灵', '拜阿', '乙酰水杨酸'],
    drugBAliases: ['氯吡格雷', 'Clopidogrel', '波立维', '泰嘉'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '双抗血小板治疗增加出血风险，但心梗/支架术后可能必需。',
    recommendation: '确认是否由心内科医生明确处方；注意消化道出血征兆并做好胃保护。',
    evidenceLevel: 'A',
  },
  {
    drugA: '华法林',
    drugB: '布洛芬',
    drugAAliases: ['华法林', 'Warfarin', '可密定'],
    drugBAliases: ['布洛芬', 'Ibuprofen', '芬必得', '美林'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: 'NSAID 会增强华法林抗凝作用并损伤胃黏膜，出血风险成倍增加。',
    recommendation: '止痛建议换用对乙酰氨基酚；确需 NSAID 需医生评估。',
    evidenceLevel: 'A',
  },
  {
    drugA: '华法林',
    drugB: '双氯芬酸',
    drugAAliases: ['华法林', 'Warfarin'],
    drugBAliases: ['双氯芬酸', 'Diclofenac', '扶他林', '英太青'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '同布洛芬，NSAID 协同增强出血风险。',
    recommendation: '避免联用，选非甾体替代或告知医生调整。',
    evidenceLevel: 'A',
  },

  // ─── 抗心律失常/心血管 ──────────────
  {
    drugA: '地高辛',
    drugB: '胺碘酮',
    drugAAliases: ['地高辛', 'Digoxin', '强心灵'],
    drugBAliases: ['胺碘酮', 'Amiodarone', '可达龙', '胺碘达龙'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '胺碘酮抑制地高辛代谢与肾清除，浓度可升高 50~100%，易发生洋地黄中毒。',
    recommendation: '联用时地高辛剂量通常减半；监测心率、恶心、视物黄染等中毒表现。',
    evidenceLevel: 'A',
  },
  {
    drugA: '地高辛',
    drugB: '维拉帕米',
    drugAAliases: ['地高辛', 'Digoxin'],
    drugBAliases: ['维拉帕米', 'Verapamil', '异搏定'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '维拉帕米升高地高辛血药浓度约 70%，洋地黄中毒风险大。',
    recommendation: '需医生评估后减量并监测 ECG。',
    evidenceLevel: 'A',
  },
  {
    drugA: '硝酸甘油',
    drugB: '西地那非',
    drugAAliases: ['硝酸甘油', 'Nitroglycerin', '硝酸异山梨酯', '单硝酸异山梨酯', '消心痛', '欣康', 'ISMN', 'ISDN'],
    drugBAliases: ['西地那非', 'Sildenafil', '伟哥', '万艾可', '他达拉非', 'Tadalafil', '希爱力', '艾力达', 'Vardenafil'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: 'PDE5 抑制剂与硝酸酯类联用会导致严重低血压，可致昏厥、心梗。',
    recommendation: '绝对禁忌联用；服用硝酸甘油期间不得使用伟哥类药物。',
    evidenceLevel: 'A',
  },

  // ─── ACEI/ARB + 保钾/高钾风险 ──────────────
  {
    drugA: '依那普利',
    drugB: '螺内酯',
    drugAAliases: ['依那普利', 'Enalapril', '贝那普利', 'Benazepril', '洛丁新', '培哚普利', '雅施达', '赖诺普利', '卡托普利', '开博通'],
    drugBAliases: ['螺内酯', 'Spironolactone', '安体舒通', '安体舒定'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: 'ACEI 抑制醛固酮 + 保钾利尿剂，高钾血症风险显著增加，严重时心脏骤停。',
    recommendation: '需定期监测血钾与肾功能；避免同时摄入高钾食盐替代品。',
    evidenceLevel: 'A',
  },
  {
    drugA: '缬沙坦',
    drugB: '螺内酯',
    drugAAliases: ['缬沙坦', 'Valsartan', '代文', '厄贝沙坦', 'Irbesartan', '安博维', '氯沙坦', 'Losartan', '科素亚', '替米沙坦', 'Telmisartan', '美卡素'],
    drugBAliases: ['螺内酯', 'Spironolactone', '安体舒通'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: 'ARB + 保钾利尿剂高钾血症风险。',
    recommendation: '需监测血钾，老人/肾功能不全者尤需谨慎。',
    evidenceLevel: 'A',
  },

  // ─── 他汀 + CYP3A4 抑制剂 ──────────────
  {
    drugA: '辛伐他汀',
    drugB: '克拉霉素',
    drugAAliases: ['辛伐他汀', 'Simvastatin', '舒降之', '阿托伐他汀', 'Atorvastatin', '立普妥', '洛伐他汀', 'Lovastatin'],
    drugBAliases: ['克拉霉素', 'Clarithromycin', '克拉仙', '红霉素', 'Erythromycin', '罗红霉素', '泰利霉素'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '大环内酯类抑制 CYP3A4，使他汀浓度暴增，引发横纹肌溶解/急性肾损伤。',
    recommendation: '抗生素使用期间暂停他汀，或换用普伐他汀/瑞舒伐他汀。',
    evidenceLevel: 'A',
  },
  {
    drugA: '辛伐他汀',
    drugB: '葡萄柚汁',
    drugAAliases: ['辛伐他汀', 'Simvastatin', '阿托伐他汀', 'Atorvastatin', '立普妥'],
    drugBAliases: ['葡萄柚汁', '西柚汁', 'Grapefruit', 'Grapefruit juice', '葡萄柚'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '葡萄柚汁抑制 CYP3A4，使他汀浓度升高，增加肌病风险。',
    recommendation: '服药期间避免葡萄柚或果汁；可换瑞舒伐他汀（影响小）。',
    evidenceLevel: 'B',
  },

  // ─── 精神/中枢 ──────────────
  {
    drugA: '曲马多',
    drugB: '舍曲林',
    drugAAliases: ['曲马多', 'Tramadol', '奇曼丁', '安达芬'],
    drugBAliases: [
      '舍曲林', 'Sertraline', '左洛复',
      '氟西汀', 'Fluoxetine', '百忧解',
      '帕罗西汀', 'Paroxetine', '赛乐特',
      '艾司西酞普兰', 'Escitalopram', '来士普',
      '西酞普兰', 'Citalopram',
      '氟伏沙明', 'Fluvoxamine',
    ],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '5-羟色胺综合征风险（高热、肌阵挛、意识改变）。',
    recommendation: '尽量避免联用；需联用时务必告知医生，出现异常立即就医。',
    evidenceLevel: 'A',
  },
  {
    drugA: '艾司唑仑',
    drugB: '氢吗啡酮',
    drugAAliases: [
      '艾司唑仑', 'Estazolam', '舒乐安定',
      '地西泮', 'Diazepam', '安定',
      '阿普唑仑', 'Alprazolam', '佳乐定',
      '劳拉西泮', 'Lorazepam', '罗拉',
      '氯硝西泮', 'Clonazepam',
    ],
    drugBAliases: [
      '氢吗啡酮', '吗啡', 'Morphine',
      '羟考酮', 'Oxycodone', '奥施康定',
      '芬太尼', 'Fentanyl',
      '可待因', 'Codeine',
      '曲马多', 'Tramadol',
    ],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '苯二氮䓬 + 阿片类均抑制呼吸，联用致呼吸抑制/意识丧失。',
    recommendation: '避免联用；必要时应在医生监护下使用最低剂量。',
    evidenceLevel: 'A',
  },

  // ─── 糖尿病 ──────────────
  {
    drugA: '二甲双胍',
    drugB: '碘造影剂',
    drugAAliases: ['二甲双胍', 'Metformin', '格华止', '君力达'],
    drugBAliases: ['碘造影剂', '碘海醇', '碘帕醇', 'Iohexol', 'Iopamidol', '欧乃派克', '安射力'],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: '造影剂加重肾脏负担，二甲双胍可能蓄积引发乳酸酸中毒。',
    recommendation: '造影前 48 小时停药，造影后 48 小时复查肾功能正常再恢复。',
    evidenceLevel: 'A',
  },
  {
    drugA: '格列苯脲',
    drugB: '复方磺胺甲噁唑',
    drugAAliases: [
      '格列苯脲', 'Glibenclamide', '优降糖',
      '格列美脲', 'Glimepiride', '亚莫利',
      '格列齐特', 'Gliclazide', '达美康',
      '格列吡嗪', 'Glipizide', '秘敌可',
    ],
    drugBAliases: ['复方磺胺甲噁唑', '磺胺甲噁唑', 'SMZ', 'Sulfamethoxazole', '百炎净', '新诺明'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '磺胺类抗生素增强磺脲类降糖作用，易致低血糖。',
    recommendation: '抗感染期间增加血糖监测频率，注意夜间低血糖。',
    evidenceLevel: 'B',
  },

  // ─── 喹诺酮/氟喹诺酮 + 金属阳离子 ──────────────
  {
    drugA: '左氧氟沙星',
    drugB: '碳酸钙',
    drugAAliases: [
      '左氧氟沙星', 'Levofloxacin', '可乐必妥',
      '环丙沙星', 'Ciprofloxacin', '西普乐',
      '莫西沙星', 'Moxifloxacin',
      '诺氟沙星', 'Norfloxacin',
      '氧氟沙星', 'Ofloxacin',
    ],
    drugBAliases: [
      '碳酸钙', '钙片', 'Calcium', '钙尔奇', '迪巧',
      '硫酸亚铁', '铁剂', '铁',
      '氢氧化铝', '铝碳酸镁', '达喜', '胃舒平',
      '硫酸镁', '镁',
    ],
    severity: DrugInteractionSeverity.LOW,
    mechanism: '多价阳离子与喹诺酮螯合，显著降低抗生素吸收。',
    recommendation: '抗生素服用前 2 小时或服用后 6 小时再吃钙/铁/铝镁制酸剂。',
    evidenceLevel: 'A',
  },

  // ─── 胃药/利尿 ──────────────
  {
    drugA: '呋塞米',
    drugB: '地高辛',
    drugAAliases: ['呋塞米', 'Furosemide', '速尿', '速尿米', '氢氯噻嗪', 'Hydrochlorothiazide', '双克'],
    drugBAliases: ['地高辛', 'Digoxin'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '袢利尿/噻嗪利尿剂引起低钾，使地高辛毒性显著增加。',
    recommendation: '联用期间监测血钾、ECG，必要时补钾。',
    evidenceLevel: 'A',
  },
  {
    drugA: '奥美拉唑',
    drugB: '氯吡格雷',
    drugAAliases: [
      '奥美拉唑', 'Omeprazole', '洛赛克',
      '埃索美拉唑', 'Esomeprazole', '耐信',
    ],
    drugBAliases: ['氯吡格雷', 'Clopidogrel', '波立维'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '部分 PPI 抑制 CYP2C19，降低氯吡格雷活化，削弱抗血小板作用。',
    recommendation: '如需胃保护可换用泮托拉唑/雷贝拉唑，或错开 12 小时。',
    evidenceLevel: 'B',
  },

  // ─── 中西联合常见风险 ──────────────
  {
    drugA: '华法林',
    drugB: '丹参',
    drugAAliases: ['华法林', 'Warfarin'],
    drugBAliases: ['丹参', '丹参片', '复方丹参', '丹参滴丸', '银杏叶', '银杏叶片'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '活血化瘀类中药增强华法林抗凝，出血风险增加。',
    recommendation: '建议告知医生，监测 INR；自行停用前请先咨询。',
    evidenceLevel: 'B',
  },
  {
    drugA: '华法林',
    drugB: '维生素K',
    drugAAliases: ['华法林', 'Warfarin'],
    drugBAliases: ['维生素K', 'Vitamin K', 'VK', '维K'],
    severity: DrugInteractionSeverity.MEDIUM,
    mechanism: '维生素 K 对抗华法林抗凝作用，INR 可显著下降。',
    recommendation: '避免突然大量食用富含维 K 食物或补充剂；保持饮食稳定。',
    evidenceLevel: 'A',
  },

  // ─── 麻醉/镇静 ──────────────
  {
    drugA: '地西泮',
    drugB: '西咪替丁',
    drugAAliases: ['地西泮', 'Diazepam', '安定', '劳拉西泮', 'Lorazepam'],
    drugBAliases: ['西咪替丁', 'Cimetidine', '泰胃美'],
    severity: DrugInteractionSeverity.LOW,
    mechanism: '西咪替丁抑制肝酶，使镇静药代谢减慢，镇静过深。',
    recommendation: '老人慎用；如需抑酸可换雷尼替丁或 PPI。',
    evidenceLevel: 'B',
  },

  // ─── 免疫抑制/肿瘤 ──────────────
  {
    drugA: '甲氨蝶呤',
    drugB: '布洛芬',
    drugAAliases: ['甲氨蝶呤', 'Methotrexate', 'MTX'],
    drugBAliases: [
      '布洛芬', 'Ibuprofen', '芬必得',
      '萘普生', 'Naproxen',
      '双氯芬酸', 'Diclofenac', '扶他林',
      '吲哚美辛', 'Indomethacin',
      '塞来昔布', 'Celecoxib', '西乐葆',
    ],
    severity: DrugInteractionSeverity.HIGH,
    mechanism: 'NSAID 减少 MTX 肾清除，MTX 毒性（骨髓抑制、肝肾损伤）显著升高。',
    recommendation: '风湿科小剂量周疗 MTX 一般可短期联用，但肿瘤剂量 MTX 严禁联用。',
    evidenceLevel: 'A',
  },
];
