import { getPublic } from '../../utils/request';
import { goToCustomerService, preloadCustomerServiceConfig } from '../../utils/customerService';

type Category =
  | 'nutrition'
  | 'rehabilitation'
  | 'nursing'
  | 'psychology'
  | 'maternal_child';

interface ProService {
  id: number;
  category: Category;
  code: string;
  name: string;
  shortDesc: string;
  icon: string;
  targetGroups: string[];
  highlights: string[];
  durationHint: string | null;
  priceDisplayText: string | null;
  coverImage: string | null;
}

interface CategoryGroup {
  category: Category;
  categoryLabel: string;
  categoryColor: string;
  items: ProService[];
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

const CATEGORY_ORDER: Category[] = [
  'nutrition',
  'rehabilitation',
  'nursing',
  'psychology',
  'maternal_child',
];

Page({
  data: {
    statusBarHeight: 20,
    loading: true,
    loadError: false,
    groups: [] as CategoryGroup[],
    activeCategory: '' as Category | '',
  },

  onLoad() {
    const sys = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight });
    preloadCustomerServiceConfig().catch(() => { /* noop */ });
    this.loadServices();
  },

  async loadServices() {
    this.setData({ loading: true, loadError: false });
    try {
      const res: any = await getPublic('/professional-services/public');
      const items: ProService[] = (res?.items || []) as ProService[];
      const groupMap = new Map<Category, ProService[]>();
      for (const cat of CATEGORY_ORDER) groupMap.set(cat, []);
      for (const item of items) {
        const list = groupMap.get(item.category);
        if (list) list.push(item);
      }
      const groups: CategoryGroup[] = CATEGORY_ORDER.filter(
        (c) => (groupMap.get(c) || []).length > 0,
      ).map((c) => ({
        category: c,
        categoryLabel: CATEGORY_LABEL[c],
        categoryColor: CATEGORY_COLOR[c],
        items: groupMap.get(c) || [],
      }));
      this.setData({
        groups,
        activeCategory: groups[0]?.category || '',
        loading: false,
      });
    } catch (e) {
      console.error('加载专业服务失败', e);
      this.setData({ loadError: true, loading: false });
    }
  },

  onCategoryTap(e: any) {
    const cat: Category = e.currentTarget.dataset.category;
    this.setData({ activeCategory: cat });
    const selector = `#group-${cat}`;
    wx.createSelectorQuery()
      .in(this)
      .select(selector)
      .boundingClientRect((rect: any) => {
        if (rect) {
          wx.pageScrollTo({ scrollTop: rect.top - 200, duration: 260 });
        }
      })
      .exec();
  },

  onItemTap(e: any) {
    const code = e.currentTarget.dataset.code;
    if (!code) return;
    wx.navigateTo({ url: `/pages/pro-services/detail/detail?code=${code}` });
  },

  onContactService() {
    goToCustomerService();
  },

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/index/index' }) });
  },
});
