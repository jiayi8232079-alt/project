import { get } from '../../../utils/request';

function formatDateTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(start?: string, end?: string) {
  if (!start || !end) return '';
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return '';
  const min = Math.round((e - s) / 60_000);
  return min < 1 ? '不到 1 分钟' : `约 ${min} 分钟`;
}

const EMOTION_LABELS: Record<string, string> = {
  happy: '开心',
  sad: '低落',
  angry: '生气',
  anxious: '焦虑',
  neutral: '平静',
  worried: '担忧',
};

function extractToolNames(toolCalls: any): string[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls
    .map((t) => (typeof t === 'string' ? t : t?.name || t?.tool || ''))
    .filter(Boolean);
}

Page({
  data: {
    statusBarHeight: 0,
    id: 0,
    loading: true,
    session: null as any,
    logs: [] as any[],
  },

  onLoad(options: any) {
    const sys = wx.getWindowInfo?.() || wx.getSystemInfoSync();
    this.setData({
      statusBarHeight: sys.statusBarHeight || 44,
      id: Number(options?.id || 0),
    });
  },

  onShow() {
    if (this.data.id) this.loadDetail();
  },

  async loadDetail() {
    this.setData({ loading: true });
    try {
      const res: any = await get(`/ai-dialogs/sessions/${this.data.id}`);
      const rawSession = res?.session || res;
      const rawLogs = Array.isArray(res?.logs) ? res.logs : [];
      const session = rawSession
        ? {
            startedAtText: formatDateTime(rawSession.startedAt),
            durationText: formatDuration(rawSession.startedAt, rawSession.endedAt),
            turns: rawSession.totalTurns || 0,
            summary: rawSession.summary || '',
            hasCrisis: (rawSession.crisisScore || 0) > 0,
            crisisWords: Array.isArray(rawSession.crisisWords)
              ? rawSession.crisisWords.join('、')
              : '',
          }
        : null;
      const logs = rawLogs.map((l: any) => {
        const tools = extractToolNames(l.toolCalls);
        return {
          id: l.id,
          isUser: l.direction === 'user',
          text: l.text || '',
          timeText: formatTime(l.createdAt),
          emotionLabel: l.emotion ? EMOTION_LABELS[l.emotion] || l.emotion : '',
          crisisWords: Array.isArray(l.crisisWords) ? l.crisisWords.join('、') : '',
          toolText: tools.length ? tools.join('、') : '',
        };
      });
      this.setData({ session, logs });
    } catch (e) {
      console.log('加载对话详情失败', e);
    } finally {
      this.setData({ loading: false });
    }
  },

  goBack() {
    wx.navigateBack({ delta: 1 });
  },
});
