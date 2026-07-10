import {
  ProfessionalServiceCategory,
  ProfessionalServiceSopStep,
} from '../../entities/professional-service.entity.js';

export interface BuiltinProfessionalService {
  category: ProfessionalServiceCategory;
  code: string;
  name: string;
  shortDesc: string;
  detail: string;
  icon: string;
  targetGroups: string[];
  highlights: string[];
  durationHint: string;
  priceDisplayText: string;
  sopSteps: ProfessionalServiceSopStep[];
  sortOrder: number;
}

export const BUILTIN_PROFESSIONAL_SERVICES: BuiltinProfessionalService[] = [
  // ─── 营养服务 ──────────────
  {
    category: ProfessionalServiceCategory.NUTRITION,
    code: 'nutrition_diabetes',
    name: '糖尿病饮食管理',
    shortDesc: '注册营养师 1v1 定制糖友三餐，控血糖更稳',
    detail:
      '针对 2 型糖尿病或糖前期人群，按当前血糖水平、并发症、体重、饮食习惯与口味偏好，'
      + '制定 7 天食谱 + 3 餐替换清单 + 外出就餐指南，并提供两周内随访复盘。',
    icon: 'restaurant',
    targetGroups: ['糖尿病患者', '糖前期人群', '中老年人'],
    highlights: [
      '按最新 HbA1c / 空腹血糖定制',
      '7 天三餐食谱 + 替换清单',
      '含节假日 / 外出就餐方案',
      '2 周内 1 次阶段复盘',
    ],
    durationHint: '初评 + 2 周随访',
    priceDisplayText: '¥299 起 / 单次定制',
    sortOrder: 1,
    sopSteps: [
      {
        title: '电话/视频评估',
        description: '采集最新化验单、用药、饮食结构、运动量、并发症等信息，形成档案。',
        durationMin: 30,
        checklistItems: ['最近 HbA1c', '空腹/餐后血糖', '体重与身高', '现用降糖药'],
      },
      {
        title: '个性化食谱制定',
        description: '根据档案制定 7 天三餐，标注主食量、蛋白质、蔬菜比例与加工建议。',
        durationMin: 60,
      },
      {
        title: '家属讲解与工具交付',
        description: '向家属讲解执行要点，交付外出就餐/低 GI 替换清单。',
        durationMin: 20,
      },
      {
        title: '2 周复盘',
        description: '复盘血糖波动、饮食执行难点，调整方案。',
        durationMin: 30,
        checklistItems: ['两周血糖趋势', '体重变化', '执行障碍', '下阶段目标'],
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.NUTRITION,
    code: 'nutrition_hypertension',
    name: '高血压饮食管理',
    shortDesc: '低钠饮食、DASH 方案落地，辅助稳压',
    detail:
      '以中国居民膳食指南与 DASH 饮食原则为底，结合本人口味（包括少油/低钠/方便烹饪）'
      + '给出 7 天食谱与家庭调味替代方案，同步教会老人与陪护者识别隐性盐。',
    icon: 'water_drop',
    targetGroups: ['高血压患者', '盐敏感人群', '心血管高风险'],
    highlights: [
      '低钠 DASH 定制',
      '含隐性盐识别清单',
      '家庭常备调味替代方案',
      '2 周血压变化复盘',
    ],
    durationHint: '初评 + 2 周随访',
    priceDisplayText: '¥299 起 / 单次定制',
    sortOrder: 2,
    sopSteps: [
      {
        title: '电话/视频评估',
        description: '采集血压监测数据、并发症、当前饮食与用药情况。',
        durationMin: 30,
      },
      {
        title: '低钠食谱与替代方案',
        description: '制定 7 天食谱 + 家庭常备调味品低钠替代。',
        durationMin: 45,
      },
      {
        title: '血压监测陪伴',
        description: '教会家属家庭测压正确方法，建立 2 周监测表。',
        durationMin: 20,
      },
      {
        title: '2 周复盘',
        description: '复盘血压变化、饮食执行，必要时转诊医生。',
        durationMin: 30,
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.NUTRITION,
    code: 'nutrition_post_surgery',
    name: '术后营养恢复',
    shortDesc: '围手术期 7 天营养方案，加速康复',
    detail:
      '适用于腹部手术、骨科手术、肿瘤术后等围手术期患者。按术式、当前进食方式'
      + '（流质/半流/普食）定制高蛋白、易吸收、少渣或高纤维方案，帮助伤口愈合与功能恢复。',
    icon: 'medical_information',
    targetGroups: ['术后恢复期', '肿瘤术后', '老年骨科术后'],
    highlights: [
      '围手术期 7 天每日方案',
      '流质/半流/普食过渡指导',
      '高蛋白优质蛋白搭配',
      '伤口愈合营养增强方案',
    ],
    durationHint: '术后 0~7 天',
    priceDisplayText: '¥399 / 7 天方案',
    sortOrder: 3,
    sopSteps: [
      {
        title: '术后第 1 次评估',
        description: '确认术式、禁食期、当前进食状况、吞咽功能、食欲与并发症。',
        durationMin: 30,
      },
      {
        title: '分阶段食谱',
        description: '按流质→半流→软食→普食分阶段制定 7 天方案。',
        durationMin: 60,
      },
      {
        title: '第 3 天复查',
        description: '按实际进食量调整；评估便秘、腹胀、伤口恢复。',
        durationMin: 20,
      },
      {
        title: '第 7 天总结',
        description: '回顾体重变化、排便、伤口恢复，给出居家后续营养建议。',
        durationMin: 20,
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.NUTRITION,
    code: 'nutrition_elderly_malnutrition',
    name: '老年营养不良干预',
    shortDesc: '针对食欲差、消瘦、吞咽困难的老人强化营养',
    detail:
      '识别肌少症、消瘦、吞咽功能下降等老年营养不良信号，制定高蛋白+高能量+易咀嚼方案；'
      + '必要时联合口服营养补充（ONS）建议与家属喂养技巧培训。',
    icon: 'elderly',
    targetGroups: ['高龄老人', '消瘦/肌少症', '吞咽障碍'],
    highlights: [
      'MNA 微型营养评估',
      '易咀嚼高蛋白方案',
      '吞咽障碍用餐指导',
      'ONS 选择与使用建议',
    ],
    durationHint: '初评 + 4 周随访',
    priceDisplayText: '¥399 起',
    sortOrder: 4,
    sopSteps: [
      {
        title: 'MNA 评估与体格检查',
        description: '完成 MNA 评分、腿围/握力/体重测量，识别营养风险等级。',
        durationMin: 45,
      },
      {
        title: '定制易咀嚼方案',
        description: '提供质地适宜（剁碎/糊状）的 7 天食谱与喂养方法。',
        durationMin: 60,
      },
      {
        title: '家属喂养技巧培训',
        description: '教家属体位、速度、警示信号、误吸急救。',
        durationMin: 30,
        checklistItems: ['半卧位', '一口量', '观察吞咽', '误吸处理'],
      },
      {
        title: '月度复盘',
        description: '评估体重、肌力、进食量变化，调整方案。',
        durationMin: 30,
      },
    ],
  },

  // ─── 康复指导 ──────────────
  {
    category: ProfessionalServiceCategory.REHABILITATION,
    code: 'rehab_orthopedic_post_surgery',
    name: '骨科术后居家康复',
    shortDesc: '髋/膝关节置换、骨折术后居家康复方案',
    detail:
      '由康复治疗师上门或视频指导，按术式阶段（早期消肿/中期活动度/后期力量）'
      + '设计每日 15~30 分钟训练，并防跌倒改造居家环境。',
    icon: 'accessibility',
    targetGroups: ['骨科术后', '髋/膝关节置换', '骨折恢复期'],
    highlights: [
      '按术后阶段定制动作',
      '居家防跌倒改造建议',
      '每日训练视频示范',
      '2~4 次上门/视频复诊',
    ],
    durationHint: '4 周方案',
    priceDisplayText: '¥1299 / 4 周',
    sortOrder: 1,
    sopSteps: [
      {
        title: '术后评估',
        description: '评估活动度、疼痛、伤口、肌力、居家环境。',
        durationMin: 45,
        checklistItems: ['术式与术后天数', '当前疼痛评分', '活动度', '跌倒风险'],
      },
      {
        title: '阶段性训练方案',
        description: '按周设计关节活动度、肌力、平衡训练。',
        durationMin: 60,
      },
      {
        title: '居家改造与辅具建议',
        description: '建议扶手、防滑垫、助行器等，减少跌倒风险。',
        durationMin: 30,
      },
      {
        title: '每周复诊',
        description: '视频或上门复诊 4 次，每次调整方案。',
        durationMin: 30,
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.REHABILITATION,
    code: 'rehab_stroke',
    name: '脑卒中居家康复',
    shortDesc: '偏瘫/失语/吞咽障碍的恢复期居家康复',
    detail:
      '针对脑卒中出院后 3 个月内的黄金恢复期，设计肢体功能、语言、吞咽康复动作；'
      + '家属培训陪练方法，降低二次卒中与跌倒风险。',
    icon: 'psychology',
    targetGroups: ['脑梗/脑出血恢复期', '偏瘫', '失语', '吞咽障碍'],
    highlights: [
      '肢体+语言+吞咽三方面训练',
      '家属陪练指导',
      '二级预防用药与血压管理协同',
      '防跌倒环境改造',
    ],
    durationHint: '8 周方案',
    priceDisplayText: '¥1999 / 8 周',
    sortOrder: 2,
    sopSteps: [
      {
        title: '首次评估',
        description: '评估肌力、肌张力、语言、吞咽、认知、情绪。',
        durationMin: 60,
      },
      {
        title: '分模块训练方案',
        description: '按肢体 / 语言 / 吞咽 / 生活自理四模块每日训练。',
        durationMin: 60,
      },
      {
        title: '家属陪练培训',
        description: '演示正确陪练动作与注意事项。',
        durationMin: 45,
      },
      {
        title: '双周复诊',
        description: '每 2 周复诊一次，评估恢复，调整方案。',
        durationMin: 45,
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.REHABILITATION,
    code: 'rehab_long_bedrest',
    name: '长期卧床照护方案',
    shortDesc: '防压疮、防肺炎、防血栓的整套照护 SOP',
    detail:
      '为长期卧床老人（如失能、晚期肿瘤）家属提供"三防"（压疮/坠积性肺炎/深静脉血栓）'
      + '的系统化训练与清单；每周回访并协同医生。',
    icon: 'bed',
    targetGroups: ['长期卧床老人', '失能/半失能', '晚期肿瘤'],
    highlights: [
      '每 2h 翻身拍背 SOP',
      '压疮评估与换位清单',
      '下肢气压/被动运动',
      '排痰、雾化、吞咽训练',
    ],
    durationHint: '首月密集 + 按月维持',
    priceDisplayText: '¥1599 / 首月',
    sortOrder: 3,
    sopSteps: [
      {
        title: '居家环境评估',
        description: '床位、护理床、翻身枕、营养管路等现状评估。',
        durationMin: 45,
      },
      {
        title: '三防 SOP 培训',
        description: '培训压疮预防、排痰拍背、下肢活动。',
        durationMin: 60,
        checklistItems: ['翻身间隔', '压力点检查', '拍背手法', '气压泵使用'],
      },
      {
        title: '营养与排便管理',
        description: '鼻饲量、排便规律、皮肤护理配合。',
        durationMin: 30,
      },
      {
        title: '每周回访',
        description: '评估压疮风险、痰量、食欲、家属疲劳度。',
        durationMin: 30,
      },
    ],
  },

  // ─── 护理对接 ──────────────
  {
    category: ProfessionalServiceCategory.NURSING,
    code: 'nursing_wound_care',
    name: '居家伤口换药',
    shortDesc: '术后/糖尿病足/压疮等伤口专业换药',
    detail:
      '由合作持证护士上门进行伤口评估、清创、换药与观察，建立伤口追踪档案，'
      + '必要时协同家属与医生决策。',
    icon: 'healing',
    targetGroups: ['术后伤口', '糖尿病足', '压疮', '慢性伤口'],
    highlights: [
      '持证护士上门',
      '标准化无菌操作',
      '伤口图文追踪档案',
      '异常即时反馈家属',
    ],
    durationHint: '单次 / 按周期',
    priceDisplayText: '¥159 起 / 次',
    sortOrder: 1,
    sopSteps: [
      {
        title: '首次评估',
        description: '拍照建档、评估伤口大小/分期/分泌物。',
        durationMin: 30,
      },
      {
        title: '无菌换药操作',
        description: '严格无菌操作，必要时清创并更换敷料。',
        durationMin: 30,
      },
      {
        title: '家属观察指导',
        description: '告知警示信号（红肿热痛加剧、发热）。',
        durationMin: 10,
      },
      {
        title: '下次随访提醒',
        description: '告知下次换药时间并在平台提醒。',
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.NURSING,
    code: 'nursing_tubes',
    name: '鼻饲管/导尿管居家维护',
    shortDesc: '鼻饲、胃造瘘、导尿管的更换与日常护理',
    detail:
      '由合作持证护士提供鼻饲管/导尿管常规更换、日常消毒与家属操作培训；'
      + '建立并发症识别清单，降低感染与脱管风险。',
    icon: 'medication_liquid',
    targetGroups: ['鼻饲患者', '胃造瘘', '长期导尿'],
    highlights: [
      '持证护士操作',
      '管路日常消毒指导',
      '脱管/感染应急方案',
      '家属培训 + 清单',
    ],
    durationHint: '单次 / 按周期',
    priceDisplayText: '¥199 起 / 次',
    sortOrder: 2,
    sopSteps: [
      {
        title: '管路评估',
        description: '评估管路位置、固定、通畅、局部皮肤。',
        durationMin: 20,
      },
      {
        title: '按 SOP 更换或维护',
        description: '按标准操作更换或冲洗。',
        durationMin: 40,
      },
      {
        title: '家属培训',
        description: '教会日常冲洗、固定、异常识别。',
        durationMin: 30,
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.NURSING,
    code: 'nursing_daily_elderly',
    name: '失能老人日常照护',
    shortDesc: '翻身、擦浴、喂食、排便等生活照护',
    detail:
      '由合作护理人员上门提供全身擦浴、床上翻身、喂食、大小便护理、排痰叩背、'
      + '皮肤观察等日常照护，解放家属精力。',
    icon: 'elderly_woman',
    targetGroups: ['失能/半失能老人', '术后恢复期', '高龄独居'],
    highlights: [
      '全身清洁 + 皮肤观察',
      '翻身拍背 + 排痰',
      '协助进食与用药监督',
      '每次出具照护记录',
    ],
    durationHint: '半天 / 全天',
    priceDisplayText: '¥399 起 / 半天',
    sortOrder: 3,
    sopSteps: [
      {
        title: '入户评估',
        description: '评估失能等级、皮肤状况、认知、环境。',
        durationMin: 20,
      },
      {
        title: '清洁与翻身',
        description: '全身擦浴、更换卧位、皮肤检查。',
        durationMin: 60,
      },
      {
        title: '喂食与用药',
        description: '协助进食，按医嘱协助服药打卡。',
        durationMin: 45,
      },
      {
        title: '交接班记录',
        description: '填写当日照护记录与异常上报。',
        durationMin: 15,
      },
    ],
  },
  {
    category: ProfessionalServiceCategory.NURSING,
    code: 'nursing_night_shift',
    name: '住院夜间陪护',
    shortDesc: '医院夜班陪护，减轻家属疲劳',
    detail:
      '为住院患者提供夜间 12 小时专业陪护，含起夜、翻身、呼叫护士、紧急情况处置、'
      + '次日向家属微信交班。适合家属无法彻夜陪床的场景。',
    icon: 'nights_stay',
    targetGroups: ['住院患者', '术后第 1~3 夜', '异地子女家庭'],
    highlights: [
      '12 小时专属陪护',
      '起夜与翻身照护',
      '紧急情况及时呼叫医护',
      '次日微信交班家属',
    ],
    durationHint: '19:00 ~ 次日 07:00',
    priceDisplayText: '¥399 起 / 夜',
    sortOrder: 4,
    sopSteps: [
      {
        title: '到岗交接',
        description: '与白班/家属交接当日医嘱、异常。',
        durationMin: 15,
      },
      {
        title: '夜间巡视',
        description: '每 1-2 小时翻身/查看管路/观察呼吸。',
      },
      {
        title: '紧急呼叫与记录',
        description: '如出现异常立即呼叫医护，并写入交接记录。',
      },
      {
        title: '次日家属交班',
        description: '次日 7:30 前微信同步家属当晚情况。',
        durationMin: 15,
      },
    ],
  },

  // ─── 心理支持 ──────────────
  {
    category: ProfessionalServiceCategory.PSYCHOLOGY,
    code: 'psych_caregiver_support',
    name: '家属照护者心理减压',
    shortDesc: '长期照护家属的情绪疏导与技巧培训',
    detail:
      '长期照护家属常陷入情绪耗竭、自责、睡眠差。专业咨询师通过 50 分钟电话/视频，'
      + '帮助家属梳理压力来源、建立照护边界、寻找支持资源。',
    icon: 'self_improvement',
    targetGroups: ['长期照护家属', '异地子女', '失智家庭主要照护者'],
    highlights: [
      '50 分钟 1v1 咨询',
      '照护耗竭评估与疏导',
      '支持资源对接',
      '2~4 次套餐可选',
    ],
    durationHint: '单次 / 套餐',
    priceDisplayText: '¥399 起 / 次',
    sortOrder: 1,
    sopSteps: [
      {
        title: '线上初评',
        description: '填写照护负担量表（ZBI）等，识别风险等级。',
        durationMin: 20,
      },
      {
        title: '1v1 疏导',
        description: '50 分钟电话或视频咨询，梳理压力与情绪。',
        durationMin: 50,
      },
      {
        title: '方案与资源',
        description: '制定可执行的家庭分工 / 喘息服务建议。',
        durationMin: 15,
      },
    ],
  },
];
