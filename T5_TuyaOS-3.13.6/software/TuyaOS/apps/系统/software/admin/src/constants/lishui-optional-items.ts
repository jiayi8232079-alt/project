/** 丽水市中心医院国际健康管理中心 - 备选项目（来自2026嘉宾体检套餐PDF） */
export interface OptionalItem {
  id: string
  name: string
  price: number
  unit: string
  specimen?: string
  clinicalMeaning?: string
  status: boolean
}

export const LISHUI_OPTIONAL_ITEMS: OptionalItem[] = [
  { id: 'opt_1', name: '动脉硬化筛查', price: 80, unit: '次', specimen: '特检', status: true },
  { id: 'opt_2', name: '冠心病风险筛查', price: 200, unit: '次', specimen: '特检', status: true },
  { id: 'opt_3', name: '心梗筛查', price: 134, unit: '次', specimen: '血', status: true },
  { id: 'opt_4', name: '肺癌七项抗体检测', price: 450, unit: '次', specimen: '血', status: true },
  { id: 'opt_5', name: '辅酶Q10精准检测', price: 140, unit: '次', specimen: '血', status: true },
  { id: 'opt_6', name: '褪黑色水平分析', price: 200, unit: '次', specimen: '血', status: true },
  { id: 'opt_7', name: '肠道健康基因检测', price: 800, unit: '次', specimen: '粪便', status: true },
  { id: 'opt_8', name: '酒精代谢基因（ADH1B/ALDH2）', price: 365, unit: '次', specimen: '血', status: true },
  { id: 'opt_9', name: '无创肠癌早筛基因检测', price: 731, unit: '次', specimen: '粪便', status: true },
  { id: 'opt_10', name: 'HPV E6/E7', price: 280, unit: '次', specimen: '病理', status: true },
  { id: 'opt_11', name: '尿液膀胱癌筛查', price: 155, unit: '次', specimen: '尿液', status: true },
  { id: 'opt_12', name: '尿液膀胱癌精准检测', price: 301, unit: '次', specimen: '尿液', status: true },
  { id: 'opt_13', name: '中医红外线体质辨别', price: 98, unit: '次', specimen: '中医', status: true },
  { id: 'opt_14', name: 'AI睡眠检测筛查', price: 100, unit: '次', specimen: '睡眠', status: true },
  { id: 'opt_15', name: '大自血治疗', price: 380, unit: '次', specimen: '血', status: true },
  { id: 'opt_16', name: '华常康®粪便DNA甲基化检测', price: 780, unit: '次', status: true },
  { id: 'opt_17', name: '同型半胱氨酸代谢通路检测', price: 780, unit: '次', status: true },
  { id: 'opt_18', name: '多种神经酰胺检测', price: 450, unit: '次', status: true },
  { id: 'opt_19', name: '氧化三甲胺代谢通路检测', price: 400, unit: '次', status: true },
  { id: 'opt_20', name: '遗传性肿瘤基因检测-女性套餐（24种）', price: 8580, unit: '次', status: true },
  { id: 'opt_21', name: '遗传性肿瘤基因检测-男性套餐（23种）', price: 8580, unit: '次', status: true },
  { id: 'opt_22', name: '单基因遗传病扩展性携带者筛查', price: 2900, unit: '次', status: true },
  { id: 'opt_23', name: '早发冠心病风险基因检测', price: 660, unit: '次', status: true },
  { id: 'opt_24', name: '认知障碍基因检测', price: 2200, unit: '次', status: true },
  { id: 'opt_25', name: '阿尔兹海默症筛查', price: 560, unit: '次', status: true },
  { id: 'opt_26', name: '遗传性肿瘤基因检测-男性套餐（10种）', price: 5800, unit: '次', status: true },
  { id: 'opt_27', name: '遗传性肿瘤基因检测-女性套餐（11种）', price: 5800, unit: '次', status: true },
  { id: 'opt_28', name: '遗传性乳腺癌/卵巢癌基因检测', price: 3680, unit: '次', status: true },
  { id: 'opt_29', name: '遗传性乳腺癌/卵巢癌BRCA1/2基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_30', name: '遗传性胃癌基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_31', name: '遗传性肾癌基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_32', name: '遗传性前列腺癌基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_33', name: '遗传性甲状腺癌基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_34', name: '遗传性甲状旁腺癌基因检测', price: 5460, unit: '次', status: true },
  { id: 'opt_35', name: '遗传性结直肠癌基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_36', name: '遗传性胰腺癌基因检测', price: 4680, unit: '次', status: true },
  { id: 'opt_37', name: '遗传性子宫内膜癌基因检测', price: 3900, unit: '次', status: true },
  { id: 'opt_38', name: '遗传性肾病基因检测', price: 3900, unit: '次', status: true },
]
