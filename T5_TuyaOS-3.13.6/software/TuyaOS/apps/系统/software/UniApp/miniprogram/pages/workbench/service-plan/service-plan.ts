import { get, post, put, del } from '../../../utils/request';
import { ensureAttendantPageAccess } from '../../../utils/identity';

type PlanKind = 'meal_plan' | 'training_plan' | 'care_log' | 'other';

interface KindMeta {
  label: string;
  icon: string;
  placeholder: string;
  itemLabel: string;
  /** 单项默认占位字段 */
  fields: Array<{ key: string; label: string; placeholder?: string }>;
}

const KIND_META: Record<PlanKind, KindMeta> = {
  meal_plan: {
    label: '食谱模板',
    icon: 'restaurant',
    placeholder: '如：糖尿病低糖早餐方案',
    itemLabel: '餐次',
    fields: [
      { key: 'meal', label: '餐次', placeholder: '早/午/晚/加餐' },
      { key: 'food', label: '食物', placeholder: '如：燕麦粥 200g' },
      { key: 'note', label: '备注', placeholder: '如：无糖版' },
    ],
  },
  training_plan: {
    label: '训练方案',
    icon: 'fitness_center',
    placeholder: '如：膝关节置换术后第 1 周康复',
    itemLabel: '训练',
    fields: [
      { key: 'exercise', label: '动作', placeholder: '如：直腿抬高' },
      { key: 'sets', label: '组数', placeholder: '如：3 组 × 15 次' },
      { key: 'note', label: '要点', placeholder: '如：缓慢进行，疼痛即停' },
    ],
  },
  care_log: {
    label: '育护日志',
    icon: 'description',
    placeholder: '如：0~3 月新生儿日常照护模板',
    itemLabel: '日志',
    fields: [
      { key: 'time', label: '时间', placeholder: '如：06:00' },
      { key: 'content', label: '事项', placeholder: '如：喂奶 120ml' },
      { key: 'note', label: '备注', placeholder: '如：拍嗝，右侧睡' },
    ],
  },
  other: {
    label: '方案模板',
    icon: 'note_alt',
    placeholder: '如：居家康复计划',
    itemLabel: '项',
    fields: [
      { key: 'title', label: '标题' },
      { key: 'description', label: '内容' },
    ],
  },
};

interface TemplateItem {
  id: number;
  title: string;
  summary?: string;
  targetConditions?: string[];
  updatedAt?: string;
  isPublic?: boolean;
  useCount?: number;
  authorUserId?: number | null;
}

interface EditingItem {
  [key: string]: string;
}

Page({
  data: {
    statusBarHeight: 20,
    kind: 'meal_plan' as PlanKind,
    meta: KIND_META.meal_plan,
    list: [] as TemplateItem[],
    loading: false,

    // 编辑抽屉
    editVisible: false,
    editingId: 0 as number,
    form: {
      title: '',
      summary: '',
      targetConditionsText: '',
      items: [] as EditingItem[],
    },
    saving: false,
    deleting: false,
    currentUserId: 0,
  },

  async onLoad(options: any) {
    const sysInfo = wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sysInfo.statusBarHeight });
    const kind = (options?.kind as PlanKind) || 'meal_plan';
    const meta = KIND_META[kind] || KIND_META.meal_plan;
    this.setData({ kind, meta });
    if (!(await ensureAttendantPageAccess())) return;
    wx.setNavigationBarTitle({ title: meta.label });
    await this.loadList();
  },

  navBack() {
    wx.navigateBack({ delta: 1 });
  },

  async loadList() {
    this.setData({ loading: true });
    try {
      const res: any = await get('/service-plans/templates', {
        kind: this.data.kind,
        pageSize: 50,
      });
      const items = (res?.items || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        summary: t.summary,
        targetConditions: t.targetConditions || [],
        updatedAt: (t.updatedAt || '').replace('T', ' ').slice(0, 16),
        isPublic: !!t.isPublic,
        useCount: Number(t.useCount || 0),
        authorUserId: t.authorUserId ?? null,
      }));
      this.setData({ list: items });
    } catch (e) {
      console.warn('加载模板列表失败', e);
      this.setData({ list: [] });
    } finally {
      this.setData({ loading: false });
    }
  },

  openNew() {
    const emptyItem = this.buildEmptyItem();
    this.setData({
      editVisible: true,
      editingId: 0,
      form: {
        title: '',
        summary: '',
        targetConditionsText: '',
        items: [emptyItem],
      },
    });
  },

  async openEdit(e: any) {
    const id = Number(e.currentTarget.dataset.id);
    try {
      const res: any = await get(`/service-plans/templates/${id}`);
      const rawItems = Array.isArray(res?.content) ? res.content : [];
      const items = rawItems.length > 0
        ? rawItems.map((item: any) => {
            const normalized: EditingItem = {};
            for (const f of this.data.meta.fields) {
              normalized[f.key] = String(item?.[f.key] ?? item?.data?.[f.key] ?? '');
            }
            return normalized;
          })
        : [this.buildEmptyItem()];
      this.setData({
        editVisible: true,
        editingId: id,
        form: {
          title: res.title || '',
          summary: res.summary || '',
          targetConditionsText: (res.targetConditions || []).join('、'),
          items,
        },
      });
    } catch (err) {
      wx.showToast({ title: '加载失败', icon: 'none' });
    }
  },

  cancelEdit() {
    this.setData({ editVisible: false });
  },

  onFormInput(e: any) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.${field}`]: e.detail.value });
  },

  onItemInput(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    const field = e.currentTarget.dataset.field;
    this.setData({ [`form.items[${idx}].${field}`]: e.detail.value });
  },

  addRow() {
    const items = this.data.form.items.concat(this.buildEmptyItem());
    this.setData({ 'form.items': items });
  },

  removeRow(e: any) {
    const idx = Number(e.currentTarget.dataset.index);
    if (this.data.form.items.length <= 1) {
      wx.showToast({ title: '至少保留一项', icon: 'none' });
      return;
    }
    const items = this.data.form.items.slice();
    items.splice(idx, 1);
    this.setData({ 'form.items': items });
  },

  buildEmptyItem(): EditingItem {
    const row: EditingItem = {};
    for (const f of this.data.meta.fields) row[f.key] = '';
    return row;
  },

  async save() {
    const title = (this.data.form.title || '').trim();
    if (!title) {
      wx.showToast({ title: '请输入标题', icon: 'none' });
      return;
    }
    const content = this.data.form.items.map((item) => {
      const obj: any = { ...item };
      return obj;
    });
    const targetConditions = (this.data.form.targetConditionsText || '')
      .split(/[,，、\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      kind: this.data.kind,
      title,
      summary: (this.data.form.summary || '').trim() || undefined,
      targetConditions: targetConditions.length > 0 ? targetConditions : undefined,
      content,
    };
    this.setData({ saving: true });
    try {
      if (this.data.editingId) {
        await put(`/service-plans/templates/${this.data.editingId}`, payload);
      } else {
        await post('/service-plans/templates', payload);
      }
      wx.showToast({ title: '已保存', icon: 'success' });
      this.setData({ editVisible: false });
      await this.loadList();
    } catch (err: any) {
      wx.showToast({ title: err?.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ saving: false });
    }
  },

  async removeCurrent() {
    if (!this.data.editingId) return;
    const res = await new Promise<boolean>((resolve) => {
      wx.showModal({
        title: '删除模板',
        content: '确认删除该模板吗？删除后无法恢复。',
        confirmColor: '#F56C6C',
        success: (r) => resolve(!!r.confirm),
        fail: () => resolve(false),
      });
    });
    if (!res) return;
    this.setData({ deleting: true });
    try {
      await del(`/service-plans/templates/${this.data.editingId}`);
      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ editVisible: false });
      await this.loadList();
    } catch (err: any) {
      wx.showToast({ title: err?.message || '删除失败', icon: 'none' });
    } finally {
      this.setData({ deleting: false });
    }
  },
});
