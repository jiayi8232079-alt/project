/**
 * 慧诊通 — 科室映射 + 服务路径推荐
 *
 * 基于风险等级、场景类型、用户画像推荐服务路径
 */

// ─── 服务路径常量 ─────────────────────────────────────────

export const SERVICE_ROUTES = {
  PHONE_EVAL: '电话评估',
  HOME_EVAL: '上门评估',
  OUTPATIENT_ESCORT: '门诊陪诊',
  EXAM_ESCORT: '陪检陪查',
  EXPERT_MATCH: '专家匹配',
  OUTPATIENT_COORD: '门诊协调',
  INPATIENT_COORD: '住院协调',
  CUSTOM_CHECKUP: '定制体检',
  SEVEN_DAY_PACK: '7天过渡照护包',
  THIRTY_DAY_PACK: '30天居家照护包',
  LONG_TERM_CARE: '长护险协同',
} as const;

// ─── 场景类型 ─────────────────────────────────────────────

export const SCENE_TYPES = {
  GENERAL_OUTPATIENT: '普通门诊型',
  CHECKUP_SCREENING: '体检筛查型',
  EXPERT_CONSULT: '专家会诊型',
  INPATIENT_SURGERY: '住院手术型',
  POST_OP_RECOVERY: '术后恢复型',
  CHRONIC_MANAGEMENT: '慢病长期管理型',
} as const;

// ─── 场景推断 ─────────────────────────────────────────────

export interface RouteInput {
  riskLevel: string;
  visitGoal?: string;
  patientAge: number;
  mobility?: string;
  familyRemote?: boolean;
  recentlyDischarged?: boolean;
  medicalHistory?: string[];
  mainSymptom: string;
  ruleHits?: string[];
}

export interface RouteResult {
  sceneType: string;
  serviceRoute: string[];
  recommendedProduct: string;
}

export function inferSceneAndRoute(input: RouteInput): RouteResult {
  const { riskLevel, visitGoal, patientAge, mobility, familyRemote, recentlyDischarged, medicalHistory, mainSymptom, ruleHits } = input;
  const symptom = mainSymptom || '';

  // ─── R3 高风险 ─────────────────────────────────────────
  if (riskLevel === 'R3') {
    return {
      sceneType: SCENE_TYPES.GENERAL_OUTPATIENT,
      serviceRoute: [SERVICE_ROUTES.PHONE_EVAL, SERVICE_ROUTES.OUTPATIENT_ESCORT] as string[],
      recommendedProduct: '紧急门诊陪诊',
    };
  }

  // ─── R2 复杂协调 ───────────────────────────────────────
  if (riskLevel === 'R2') {
    const routes: string[] = [SERVICE_ROUTES.PHONE_EVAL];

    if ((ruleHits || []).includes('拟住院/手术')) {
      return {
        sceneType: SCENE_TYPES.INPATIENT_SURGERY,
        serviceRoute: [SERVICE_ROUTES.PHONE_EVAL, SERVICE_ROUTES.INPATIENT_COORD, SERVICE_ROUTES.EXPERT_MATCH] as string[],
        recommendedProduct: '住院协同闭环包',
      };
    }

    if ((ruleHits || []).includes('疑难病/肿瘤相关')) {
      return {
        sceneType: SCENE_TYPES.EXPERT_CONSULT,
        serviceRoute: [SERVICE_ROUTES.PHONE_EVAL, SERVICE_ROUTES.EXPERT_MATCH, SERVICE_ROUTES.OUTPATIENT_COORD] as string[],
        recommendedProduct: '专家就医闭环包',
      };
    }

    if ((ruleHits || []).includes('近期出院伴症状')) {
      routes.push(SERVICE_ROUTES.SEVEN_DAY_PACK);
      return {
        sceneType: SCENE_TYPES.POST_OP_RECOVERY,
        serviceRoute: routes,
        recommendedProduct: '7天过渡照护包',
      };
    }

    // 高龄行动不便 / 多慢病
    if (familyRemote) routes.push(SERVICE_ROUTES.HOME_EVAL);
    routes.push(SERVICE_ROUTES.OUTPATIENT_ESCORT);
    return {
      sceneType: SCENE_TYPES.CHRONIC_MANAGEMENT,
      serviceRoute: routes,
      recommendedProduct: '门诊陪诊 + 诊后管理',
    };
  }

  // ─── R0/R1 按 visitGoal 分流 ──────────────────────────

  // 体检
  if (visitGoal === 'checkup' || ['体检', '筛查', '检查'].some((k) => symptom.includes(k))) {
    return {
      sceneType: SCENE_TYPES.CHECKUP_SCREENING,
      serviceRoute: [SERVICE_ROUTES.CUSTOM_CHECKUP, SERVICE_ROUTES.EXAM_ESCORT] as string[],
      recommendedProduct: '体检闭环包',
    };
  }

  // 专家
  if (visitGoal === 'expert') {
    return {
      sceneType: SCENE_TYPES.EXPERT_CONSULT,
      serviceRoute: [SERVICE_ROUTES.EXPERT_MATCH, SERVICE_ROUTES.OUTPATIENT_COORD, SERVICE_ROUTES.OUTPATIENT_ESCORT] as string[],
      recommendedProduct: '专家就医闭环包',
    };
  }

  // 住院
  if (visitGoal === 'inpatient') {
    return {
      sceneType: SCENE_TYPES.INPATIENT_SURGERY,
      serviceRoute: [SERVICE_ROUTES.PHONE_EVAL, SERVICE_ROUTES.INPATIENT_COORD] as string[],
      recommendedProduct: '住院协同闭环包',
    };
  }

  // 照护
  if (visitGoal === 'care') {
    const routes: string[] = [SERVICE_ROUTES.PHONE_EVAL];
    if (recentlyDischarged) {
      routes.push(SERVICE_ROUTES.SEVEN_DAY_PACK);
      return { sceneType: SCENE_TYPES.POST_OP_RECOVERY, serviceRoute: routes, recommendedProduct: '7天过渡照护包' };
    }
    routes.push(SERVICE_ROUTES.THIRTY_DAY_PACK);
    return { sceneType: SCENE_TYPES.CHRONIC_MANAGEMENT, serviceRoute: routes, recommendedProduct: '30天居家照护包' };
  }

  // 慢病长期管理
  if (medicalHistory && medicalHistory.length >= 2 && patientAge >= 60) {
    const routes: string[] = [SERVICE_ROUTES.OUTPATIENT_ESCORT];
    if (familyRemote) routes.push(SERVICE_ROUTES.PHONE_EVAL);
    return {
      sceneType: SCENE_TYPES.CHRONIC_MANAGEMENT,
      serviceRoute: routes,
      recommendedProduct: '门诊陪诊 + 诊后管理',
    };
  }

  // 高龄 + 行动不便
  if (patientAge >= 70 && mobility === 'limited') {
    return {
      sceneType: SCENE_TYPES.GENERAL_OUTPATIENT,
      serviceRoute: [SERVICE_ROUTES.PHONE_EVAL, SERVICE_ROUTES.OUTPATIENT_ESCORT] as string[],
      recommendedProduct: '门诊陪诊',
    };
  }

  // 默认：普通门诊
  const defaultRoutes: string[] = [SERVICE_ROUTES.OUTPATIENT_ESCORT];
  if (familyRemote) defaultRoutes.unshift(SERVICE_ROUTES.PHONE_EVAL);

  return {
    sceneType: SCENE_TYPES.GENERAL_OUTPATIENT,
    serviceRoute: defaultRoutes,
    recommendedProduct: '门诊陪诊',
  };
}
