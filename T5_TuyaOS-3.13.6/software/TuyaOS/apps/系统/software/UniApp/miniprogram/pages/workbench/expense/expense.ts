import { get, post } from '../../../utils/request';
import { BASE_URL } from '../../../config';
import { resolvePublicUrl } from '../../../utils/media-url';
import { ensureAttendantPageAccess } from '../../../utils/identity';

const TYPE_LABEL: Record<string, string> = {
  transport: '交通费',
  accommodation: '住宿费',
  other: '其他',
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:  { label: '待审核', color: 'pending' },
  approved: { label: '已通过', color: 'approved' },
  rejected: { label: '已驳回', color: 'rejected' },
};

Page({
  data: {
    activeTab: 'form' as 'form' | 'records',
    orderId: '',
    selectedOrder: '',
    orderOptions: [] as { id: number; label: string }[],
    expenseType: 'transport',
    amount: '',
    description: '',
    images: [] as string[],
    submitting: false,
    expenseTypes: [
      { value: 'transport', label: '交通费' },
      { value: 'accommodation', label: '住宿费' },
      { value: 'other', label: '其他' },
    ],
    records: [] as any[],
    filteredRecords: [] as any[],
    recordsLoading: false,
    recordsTotal: 0,
    searchOrderNo: '',
    totalAmount: '0.00',
    totalApproved: '0.00',
    totalPending: '0.00',
  },

  onLoad(options: any) {
    if (!ensureAttendantPageAccess()) return;
    if (options.orderId) {
      this.setData({
        orderId: options.orderId,
        selectedOrder: options.orderNo || options.orderId,
      });
    }
    this.loadOrderOptions();
    this.loadRecords();
  },

  onShow() {
    if (!ensureAttendantPageAccess()) return;
    if (!this.data.orderId || !this.data.selectedOrder) {
      this.loadOrderOptions();
    }
    this.loadRecords();
  },

  switchTab(e: any) {
    const tab = e.currentTarget.dataset.tab;
    if (tab === this.data.activeTab) return;
    this.setData({ activeTab: tab });
    if (tab === 'records') this.loadRecords();
  },

  async loadRecords() {
    this.setData({ recordsLoading: true });
    try {
      const res: any = await get('/finance', { page: 1, pageSize: 100 });
      const items = (res?.items || []).map((item: any) => {
        const rawImages: string[] = item.images || [];
        const proofUrl = resolvePublicUrl(
          rawImages.length > 0 ? rawImages[0] : (item.proofUrl || ''),
        );
        return {
          ...item,
          typeLabel: TYPE_LABEL[item.type] || item.type,
          statusLabel: STATUS_CONFIG[item.status]?.label || item.status,
          statusColor: STATUS_CONFIG[item.status]?.color || 'pending',
          amountNum: Number(item.amount) || 0,
          amountText: `¥${Number(item.amount).toFixed(2)}`,
          orderNo: item.order?.orderNumber || `#${item.orderId}`,
          patientName: item.order?.serviceTarget?.name || item.order?.user?.nickname || '—',
          createdAtText: this.formatDateTime(item.createdAt),
          proofUrl,
          proofCount: rawImages.length,
        };
      });
      this.setData({ records: items, recordsTotal: res?.total || 0 });
      this.applyFilter();
    } catch (e) {
      console.error('加载报销记录失败', e);
    } finally {
      this.setData({ recordsLoading: false });
    }
  },

  applyFilter() {
    const { records, searchOrderNo } = this.data;
    const kw = searchOrderNo.trim().toLowerCase();
    const filtered = kw
      ? records.filter((r: any) =>
          r.orderNo.toLowerCase().includes(kw) ||
          r.patientName.toLowerCase().includes(kw),
        )
      : records;

    const totalAmount = filtered.reduce((s: number, r: any) => s + r.amountNum, 0);
    const totalApproved = filtered.filter((r: any) => r.status === 'approved').reduce((s: number, r: any) => s + r.amountNum, 0);
    const totalPending = filtered.filter((r: any) => r.status === 'pending').reduce((s: number, r: any) => s + r.amountNum, 0);

    this.setData({
      filteredRecords: filtered,
      totalAmount: totalAmount.toFixed(2),
      totalApproved: totalApproved.toFixed(2),
      totalPending: totalPending.toFixed(2),
    });
  },

  onSearchInput(e: any) {
    this.setData({ searchOrderNo: e.detail.value });
    this.applyFilter();
  },

  onClearSearch() {
    this.setData({ searchOrderNo: '' });
    this.applyFilter();
  },

  async loadOrderOptions() {
    try {
      const res: any = await get('/orders', {
        status: 'pending_service,in_progress,pending_review,completed',
        page: 1,
        pageSize: 100,
      });
      const items = res?.items || [];
      const orderOptions = items
        .filter((item: any) => item?.id)
        .map((item: any) => ({
          id: item.id,
          label: `${item.orderNumber || `#${item.id}`} · ${item.serviceTarget?.name || '服务对象'} · ${this.formatDateTime(item.serviceTime)}`,
        }));
      this.setData({ orderOptions });

      if (this.data.orderId && !this.data.selectedOrder) {
        const current = orderOptions.find(
          (opt: { id: any; label: string }) => String(opt.id) === String(this.data.orderId),
        );
        if (current) {
          this.setData({ selectedOrder: current.label });
        }
      }
    } catch (e) {
      console.error('加载可选订单失败', e);
    }
  },

  onSelectOrder() {
    const { orderOptions } = this.data;
    if (!orderOptions.length) {
      wx.showToast({ title: '暂无可选订单', icon: 'none' });
      return;
    }

    const candidates = orderOptions.slice(0, 6);
    if (orderOptions.length > candidates.length) {
      wx.showToast({ title: '仅展示最近6个订单', icon: 'none' });
    }

    wx.showActionSheet({
      itemList: candidates.map((item) => item.label),
      success: (res) => {
        const selected = candidates[res.tapIndex];
        if (!selected) return;
        this.setData({
          orderId: String(selected.id),
          selectedOrder: selected.label,
        });
      },
    });
  },

  onTypeSelect(e: any) {
    this.setData({ expenseType: e.currentTarget.dataset.value });
  },

  onAmountInput(e: any) {
    this.setData({ amount: e.detail.value });
  },

  onDescInput(e: any) {
    this.setData({ description: e.detail.value });
  },

  onAddImage() {
    wx.chooseMedia({
      count: 6 - this.data.images.length,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const newImages = res.tempFiles.map((f: any) => f.tempFilePath);
        this.setData({ images: [...this.data.images, ...newImages] });
      },
    });
  },

  onRemoveImage(e: any) {
    const index = e.currentTarget.dataset.index;
    const images = [...this.data.images];
    images.splice(index, 1);
    this.setData({ images });
  },

  async onSubmit() {
    if (!this.data.orderId) {
      wx.showToast({ title: '请选择关联订单', icon: 'none' });
      return;
    }
    if (!this.data.amount || parseFloat(this.data.amount) <= 0) {
      wx.showToast({ title: '请输入费用金额', icon: 'none' });
      return;
    }
    if (this.data.images.length === 0) {
      wx.showToast({ title: '请上传费用凭证', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    try {
      const uploadedUrls = await this.uploadImages(this.data.images);
      const validUrls = uploadedUrls.filter(Boolean);
      if (!validUrls.length) {
        wx.showToast({ title: '凭证上传失败，请重试', icon: 'none' });
        return;
      }
      await post('/finance', {
        orderId: Number(this.data.orderId),
        type: this.data.expenseType,
        amount: parseFloat(this.data.amount),
        description: this.data.description,
        images: validUrls,
      });
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.setData({
        orderId: '', selectedOrder: '', amount: '', description: '', images: [],
        expenseType: 'transport',
      });
      this.loadRecords();
      setTimeout(() => this.setData({ activeTab: 'records' }), 1500);
    } catch (e) {
      console.error('提交报销失败', e);
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },

  uploadImages(paths: string[]): Promise<string[]> {
    const token = wx.getStorageSync('token');
    return Promise.all(
      paths.map(
        (filePath) =>
          new Promise<string>((resolve, reject) => {
            wx.uploadFile({
              url: `${BASE_URL}/documents/raw-upload`,
              filePath,
              name: 'file',
              header: { Authorization: token ? `Bearer ${token}` : '' },
              success(res) {
                try {
                  const data = JSON.parse(res.data);
                  resolve(data?.data?.url || data?.url || '');
                } catch {
                  reject(new Error('解析上传结果失败'));
                }
              },
              fail: reject,
            });
          }),
      ),
    );
  },

  formatDateTime(v: string | null | undefined) {
    if (!v) return '时间待定';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '时间待定';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
});
