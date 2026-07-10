import { getPublic } from '../../../utils/request';
import { goToCustomerService, preloadCustomerServiceConfig } from '../../../utils/customerService';

type Category =
  | 'nutrition'
  | 'rehabilitation'
  | 'nursing'
  | 'psychology'
  | 'maternal_child';

interface SopStep {
  title: string;
  description: string;
  durationMin?: number;
  checklistItems?: string[];
}

interface ProServiceDetail {
  id: number;
  category: Category;
  categoryLabel: string;
  categoryColor: string;
  code: string;
  name: string;
  shortDesc: string;
  detail: string | null;
  icon: string;
  coverImage: string | null;
  targetGroups: string[];
  highlights: string[];
  durationHint: string | null;
  priceDisplayText: string | null;
  sopSteps: SopStep[];
}

const CATEGORY_LABEL: Record<Category, string> = {
  nutrition: '营养服务',
  rehabilitation: '康复指导',
  nursing: '护理对接',
  psychology: '心理支持',
  maternal_child: '母婴育护',
};

const CATEGORY_COLOR: Record<Category, string> = {
  nutrition: 'green',
  rehabilitation: 'orange',
  nursing: 'blue',
  psychology: 'purple',
  maternal_child: 'pink',
};

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    loadError: false,
    service: null as ProServiceDetail | null,
  },

  onLoad(options: any) {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    preloadCustomerServiceConfig().catch(() => { /* noop */ });
    const code = String(options?.code || '');
    if (!code) {
      this.setData({ loadError: true, loading: false });
      return;
    }
    this.loadDetail(code);
  },

  async loadDetail(code: string) {
    this.setData({ loading: true, loadError: false });
    try {
      const raw: any = await getPublic(`/professional-services/public/code/${code}`);
      if (!raw) {
        this.setData({ loadError: true, loading: false });
        return;
      }
      const cat = (raw.category || 'nutrition') as Category;
      const service: ProServiceDetail = {
        id: raw.id,
        category: cat,
        categoryLabel: CATEGORY_LABEL[cat] || cat,
        categoryColor: CATEGORY_COLOR[cat] || 'green',
        code: raw.code,
        name: raw.name,
        shortDesc: raw.shortDesc,
        detail: raw.detail || null,
        icon: raw.icon || 'medical_services',
        coverImage: raw.coverImage || null,
        targetGroups: raw.targetGroups || [],
        highlights: raw.highlights || [],
        durationHint: raw.durationHint || null,
        priceDisplayText: raw.priceDisplayText || null,
        sopSteps: raw.sopSteps || [],
      };
      wx.setNavigationBarTitle({ title: service.name });
      this.setData({ service, loading: false });
    } catch (e) {
      console.error('加载服务详情失败', e);
      this.setData({ loadError: true, loading: false });
    }
  },

  onContactService() {
    goToCustomerService();
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
});
