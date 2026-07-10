import { ServiceStaffRole } from '../../entities/attendant.entity.js';
import { ProfessionalServiceCategory } from '../../entities/professional-service.entity.js';

/**
 * 每个角色的 UI 变装配置（主题色、默认头衔、快捷入口、欢迎语）。
 * 小程序端通过 `/attendants/me/workbench` 读取 `displayConfig` 后直接用来渲染。
 */
export interface ServiceStaffRoleConfig {
  role: ServiceStaffRole;
  label: string;
  defaultTitle: string;
  /** Material Symbols 图标名 */
  icon: string;
  /** 工作台主题色 hex（小程序用于顶部渐变） */
  themeColor: string;
  /** 顶部深色渐变起点（hex） */
  themeColorDark: string;
  /** 欢迎语动词，如"今天也要温暖陪伴" */
  tagline: string;
  /** 快捷入口配置 */
  quickLinks: ServiceStaffQuickLink[];
  /** 统计项显示定制 */
  statsLabels: {
    todayTasks: string;
    weekCompleted: string;
    monthIncome: string;
    rating: string;
  };
  /** 默认可接的服务目录分类（用于订单自动派单匹配） */
  matchCategories: ProfessionalServiceCategory[];
  /** 对外展示的专业范围描述（家属看板用） */
  serviceScope: string;
}

export interface ServiceStaffQuickLink {
  /** 小程序路由或自定义 key（前端映射具体跳转） */
  key: string;
  label: string;
  icon: string;
  /** 变色主调：primary | success | warning | info */
  tone: 'primary' | 'success' | 'warning' | 'info';
}

const COMMON_LINKS: ServiceStaffQuickLink[] = [
  { key: 'grab', label: '抢单大厅', icon: 'shopping_cart_checkout', tone: 'primary' },
  { key: 'assigned', label: '指派任务', icon: 'assignment_ind', tone: 'info' },
  { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
  { key: 'wallet', label: '我的钱包', icon: 'account_balance_wallet', tone: 'warning' },
  { key: 'expense', label: '费用报销', icon: 'receipt_long', tone: 'info' },
];

export const SERVICE_STAFF_ROLE_CONFIGS: Record<ServiceStaffRole, ServiceStaffRoleConfig> = {
  [ServiceStaffRole.ATTENDANT]: {
    role: ServiceStaffRole.ATTENDANT,
    label: '陪诊员',
    defaultTitle: '专业陪诊员',
    icon: 'medical_services',
    themeColor: '#4CAF50',
    themeColorDark: '#2E7D32',
    tagline: '今天也要温暖陪伴',
    quickLinks: COMMON_LINKS,
    statsLabels: {
      todayTasks: '今日任务',
      weekCompleted: '本周完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [],
    serviceScope: '门诊陪诊、陪检陪查、住院协助',
  },
  [ServiceStaffRole.NUTRITIONIST]: {
    role: ServiceStaffRole.NUTRITIONIST,
    label: '营养师',
    defaultTitle: '注册营养师',
    icon: 'restaurant',
    themeColor: '#66BB6A',
    themeColorDark: '#388E3C',
    tagline: '今天也要好好吃饭',
    quickLinks: [
      { key: 'assigned', label: '咨询任务', icon: 'assignment', tone: 'primary' },
      { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
      { key: 'meal_plan', label: '食谱模板', icon: 'menu_book', tone: 'info' },
      { key: 'wallet', label: '我的钱包', icon: 'account_balance_wallet', tone: 'warning' },
    ],
    statsLabels: {
      todayTasks: '今日咨询',
      weekCompleted: '本周已完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [ProfessionalServiceCategory.NUTRITION],
    serviceScope: '糖尿病/高血压饮食管理、术后营养、老年营养不良干预',
  },
  [ServiceStaffRole.REHABILITATOR]: {
    role: ServiceStaffRole.REHABILITATOR,
    label: '康复师',
    defaultTitle: '康复治疗师',
    icon: 'accessibility_new',
    themeColor: '#FB8C00',
    themeColorDark: '#E65100',
    tagline: '每一次训练都有意义',
    quickLinks: [
      { key: 'assigned', label: '康复任务', icon: 'assignment', tone: 'primary' },
      { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
      { key: 'training_plan', label: '训练方案', icon: 'fitness_center', tone: 'info' },
      { key: 'wallet', label: '我的钱包', icon: 'account_balance_wallet', tone: 'warning' },
    ],
    statsLabels: {
      todayTasks: '今日康复',
      weekCompleted: '本周已完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [ProfessionalServiceCategory.REHABILITATION],
    serviceScope: '骨科术后、脑卒中、肿瘤术后与长期卧床康复',
  },
  [ServiceStaffRole.NURSE]: {
    role: ServiceStaffRole.NURSE,
    label: '护士',
    defaultTitle: '注册护士',
    icon: 'healing',
    themeColor: '#42A5F5',
    themeColorDark: '#1565C0',
    tagline: '专业护理，守护健康',
    quickLinks: [
      { key: 'assigned', label: '护理任务', icon: 'assignment_ind', tone: 'primary' },
      { key: 'grab', label: '抢单大厅', icon: 'shopping_cart_checkout', tone: 'info' },
      { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
      { key: 'wallet', label: '我的钱包', icon: 'account_balance_wallet', tone: 'warning' },
    ],
    statsLabels: {
      todayTasks: '今日护理',
      weekCompleted: '本周已完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [ProfessionalServiceCategory.NURSING],
    serviceScope: '居家换药、鼻饲/导尿管维护、住院夜间陪护等',
  },
  [ServiceStaffRole.CAREGIVER]: {
    role: ServiceStaffRole.CAREGIVER,
    label: '居家护理员',
    defaultTitle: '居家护理员',
    icon: 'elderly',
    themeColor: '#AB47BC',
    themeColorDark: '#6A1B9A',
    tagline: '细心照护，温暖相伴',
    quickLinks: COMMON_LINKS,
    statsLabels: {
      todayTasks: '今日照护',
      weekCompleted: '本周完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [ProfessionalServiceCategory.NURSING],
    serviceScope: '失能老人日常照护、翻身擦浴、用药监督',
  },
  [ServiceStaffRole.MATERNAL_CARE]: {
    role: ServiceStaffRole.MATERNAL_CARE,
    label: '月嫂/母婴护理',
    defaultTitle: '母婴护理师',
    icon: 'child_friendly',
    themeColor: '#EC407A',
    themeColorDark: '#AD1457',
    tagline: '新生的每一天都值得被温柔以待',
    quickLinks: [
      { key: 'assigned', label: '服务任务', icon: 'assignment', tone: 'primary' },
      { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
      { key: 'care_log', label: '育护日志', icon: 'description', tone: 'info' },
      { key: 'wallet', label: '我的钱包', icon: 'account_balance_wallet', tone: 'warning' },
    ],
    statsLabels: {
      todayTasks: '今日服务',
      weekCompleted: '本周完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [ProfessionalServiceCategory.MATERNAL_CHILD],
    serviceScope: '月嫂上门、产后康复、婴幼儿照护',
  },
  [ServiceStaffRole.PSYCHOLOGIST]: {
    role: ServiceStaffRole.PSYCHOLOGIST,
    label: '心理咨询师',
    defaultTitle: '心理咨询师',
    icon: 'psychology',
    themeColor: '#5C6BC0',
    themeColorDark: '#283593',
    tagline: '每一次倾诉都被认真对待',
    quickLinks: [
      { key: 'assigned', label: '咨询任务', icon: 'assignment', tone: 'primary' },
      { key: 'schedule', label: '排班管理', icon: 'calendar_month', tone: 'success' },
      { key: 'wallet', label: '我的钱包', icon: 'account_balance_wallet', tone: 'warning' },
    ],
    statsLabels: {
      todayTasks: '今日咨询',
      weekCompleted: '本周已完成',
      monthIncome: '本月收入',
      rating: '评分',
    },
    matchCategories: [ProfessionalServiceCategory.PSYCHOLOGY],
    serviceScope: '家属照护者心理减压、老年情绪支持',
  },
};

export function resolveRoleConfig(role?: ServiceStaffRole | null): ServiceStaffRoleConfig {
  if (!role) return SERVICE_STAFF_ROLE_CONFIGS[ServiceStaffRole.ATTENDANT];
  return SERVICE_STAFF_ROLE_CONFIGS[role] || SERVICE_STAFF_ROLE_CONFIGS[ServiceStaffRole.ATTENDANT];
}

export function listAllRoleConfigs(): ServiceStaffRoleConfig[] {
  return Object.values(SERVICE_STAFF_ROLE_CONFIGS);
}

/**
 * 根据服务目录 category 反查合适的主角色。
 * 场景：订单创建时按 professional_services.category 找候选人。
 */
export function pickPrimaryRoleForCategory(
  category: ProfessionalServiceCategory,
): ServiceStaffRole | null {
  for (const config of Object.values(SERVICE_STAFF_ROLE_CONFIGS)) {
    if (config.matchCategories.includes(category)) return config.role;
  }
  return null;
}
