import { getPublic } from '../../../utils/request';
import { resolvePublicUrl } from '../../../utils/media-url';
import { getUserTranscriptionDisplay } from '../../../utils/timeline-transcription';
import { renderShareCoverToTempPath } from '../../../utils/share-cover';

const TYPE_LABEL: Record<string, string> = {
  node: '状态更新',
  text: '文字记录',
  image: '照片',
  service_start: '服务开始',
  service_end: '服务结束',
  audio_question: '问诊录音',
  audio_advice: '医嘱录音',
  file: '文件',
};

function formatServiceTime(v: string | Date | null | undefined): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resolveTimelineAssetUrl(url?: string) {
  return resolvePublicUrl(url);
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value);
}

function looksLikeMojibake(value: string) {
  return (
    !containsCjk(value) &&
    /[ÃÂÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿ�]/.test(value)
  );
}

function repairLatin1Utf8Mojibake(value: string) {
  try {
    let encoded = '';
    for (let i = 0; i < value.length; i += 1) {
      const code = value.charCodeAt(i);
      if (code > 0xff) return value;
      encoded += `%${code.toString(16).padStart(2, '0')}`;
    }
    return decodeURIComponent(encoded);
  } catch {
    return value;
  }
}

function decodeTimelineFileName(name: string) {
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    decoded = name;
  }
  if (!looksLikeMojibake(decoded)) {
    return decoded;
  }
  const repaired = repairLatin1Utf8Mojibake(decoded);
  return containsCjk(repaired) ? repaired : decoded;
}

function getTimelineFileName(url?: string, name?: string) {
  const raw = name || (url ? String(url).split('/').pop() || '附件' : '附件');
  return decodeTimelineFileName(raw);
}

function getTimelineImages(item: any): string[] {
  const images = Array.isArray(item?.metadata?.images) ? item.metadata.images : [];
  return images
    .map((url: string) => resolveTimelineAssetUrl(String(url)))
    .filter(Boolean);
}

function getTimelineAudioUrls(item: any): string[] {
  const urls = new Set<string>();
  const metadata = item?.metadata || {};
  if (metadata.audioUrl) {
    urls.add(String(metadata.audioUrl));
  }
  if (Array.isArray(metadata.audioFiles)) {
    metadata.audioFiles.forEach((file: any) => {
      if (file?.url) urls.add(String(file.url));
    });
  }
  if ((item?.type === 'audio_question' || item?.type === 'audio_advice') && Array.isArray(metadata.files)) {
    metadata.files.forEach((file: any) => {
      if (typeof file === 'string') urls.add(file);
      else if (file?.url) urls.add(String(file.url));
    });
  }
  return Array.from(urls)
    .map((url) => resolveTimelineAssetUrl(url))
    .filter(Boolean);
}

function getTimelineDocumentFiles(item: any): { url: string; name: string }[] {
  const metadata = item?.metadata || {};
  if (item?.type === 'audio_question' || item?.type === 'audio_advice') {
    return [];
  }
  if (!Array.isArray(metadata.files)) {
    return [];
  }
  return metadata.files
    .map((file: any) => {
      const rawUrl = typeof file === 'string' ? file : String(file?.url || '');
      return {
        url: resolveTimelineAssetUrl(rawUrl),
        name: getTimelineFileName(rawUrl, typeof file === 'string' ? '' : file?.name),
      };
    })
    .filter((file: { url: string; name: string }) => Boolean(file.url));
}

function packIsLive(pack: any) {
  return pack?.orderStatus === 'in_progress' || pack?.orderStatus === 'emergency';
}

function buildPackShareTitle(pack: any) {
  const subject = String(pack?.subjectName || '就诊人').trim() || '就诊人';
  const svc = String(pack?.serviceType || '陪诊服务').trim() || '陪诊服务';
  const tag = packIsLive(pack) ? '陪诊服务中' : '服务动态';
  let title = `${subject} · ${svc} · ${tag}`;
  if (title.length > 36) {
    const sub = subject.length > 8 ? `${subject.slice(0, 7)}…` : subject;
    title = `${sub} · ${svc} · ${tag}`;
  }
  return title;
}

function mapTimelineItems(raw: any[]) {
  return (raw || []).map((item: any) => ({
    ...item,
    time: item.createdAt ? new Date(item.createdAt).toLocaleString() : '',
    title: TYPE_LABEL[item.type] || item.type || '动态',
    description: item.content || '',
    images: getTimelineImages(item),
    audioUrls: getTimelineAudioUrls(item),
    files: getTimelineDocumentFiles(item),
    transcriptionUser: getUserTranscriptionDisplay(item),
  }));
}

Page({
  data: {
    orderId: '',
    token: '',
    loading: true,
    error: '',
    pack: {} as any,
    timeline: [] as any[],
    showShareLiveMap: false,
    shareMapLat: 31.2304,
    shareMapLng: 121.4737,
    shareMapScale: 12,
    shareMapMarkers: [] as Array<{
      id: number;
      latitude: number;
      longitude: number;
      title?: string;
      width?: number;
      height?: number;
    }>,
    mapPolyline: [] as unknown[],
    mapCircles: [] as unknown[],
    shareLocHint: '',
  },

  onLoad(options: any) {
    const orderId = String(options.orderId || options.id || '').trim();
    const token = String(options.token || '').trim();
    this.setData({ orderId, token });
    if (!orderId || !token) {
      this.setData({ loading: false, error: '链接不完整，请向分享者重新获取。' });
      return;
    }
    this.loadPack();
  },

  onPullDownRefresh() {
    void this.loadPack().finally(() => wx.stopPullDownRefresh());
  },

  async loadPack() {
    this.setData({ loading: true, error: '' });
    try {
      const pack: any = await getPublic('/public/order-timeline', {
        orderId: Number(this.data.orderId),
        token: this.data.token,
      });
      const serviceTimeText = formatServiceTime(pack.serviceTime) || '';
      const timeline = mapTimelineItems(pack.items || []);
      const loc = pack.attendantLiveLocation;
      const staffRoleName = (() => {
        const role = pack?.attendant?.primaryRole || '';
        const map: Record<string, string> = {
          attendant: '陪诊员',
          nutritionist: '营养师',
          rehabilitator: '康复师',
          nurse: '护士',
          caregiver: '居家护理员',
          maternal_care: '月嫂',
          psychologist: '心理咨询师',
        };
        if (!role) return '服务人员';
        return map[role] || '服务人员';
      })();
      let shareMapLat = 31.2304;
      let shareMapLng = 121.4737;
      let shareMapScale = 12;
      let shareMapMarkers: Array<{
        id: number;
        latitude: number;
        longitude: number;
        title?: string;
        width?: number;
        height?: number;
      }> = [];
      let shareLocHint = '';
      if (
        loc &&
        loc.latitude != null &&
        loc.longitude != null &&
        Number.isFinite(Number(loc.latitude)) &&
        Number.isFinite(Number(loc.longitude))
      ) {
        const lat = Number(loc.latitude);
        const lng = Number(loc.longitude);
        shareMapLat = lat;
        shareMapLng = lng;
        shareMapScale = 15;
        shareMapMarkers = [
          {
            id: 1,
            latitude: lat,
            longitude: lng,
            title: staffRoleName,
            width: 28,
            height: 28,
          },
        ];
        const t = loc.updatedAt ? new Date(loc.updatedAt) : null;
        const timeStr =
          t && !isNaN(t.getTime())
            ? `${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`
            : '';
        shareLocHint = timeStr ? `位置更新于 ${timeStr}（仅供参考）` : `${staffRoleName}位置（仅供参考）`;
      }
      this.setData({
        loading: false,
        pack: { ...pack, serviceTimeText, staffRoleLabel: staffRoleName },
        timeline,
        showShareLiveMap: shareMapMarkers.length > 0,
        shareMapLat,
        shareMapLng,
        shareMapScale,
        shareMapMarkers,
        mapPolyline: [],
        mapCircles: [],
        shareLocHint,
      });
    } catch (e: any) {
      const msg =
        typeof e?.message === 'string' && e.message.trim()
          ? e.message.trim()
          : '链接无效或已过期';
      this.setData({ loading: false, error: msg });
    }
  },

  previewImage(e: any) {
    const { src, urls } = e.currentTarget.dataset;
    wx.previewImage({ current: src, urls });
  },

  openTimelineFile(e: any) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    const fullUrl = resolveTimelineAssetUrl(url);
    if (!fullUrl) {
      wx.showToast({ title: '文件地址无效', icon: 'none' });
      return;
    }
    wx.downloadFile({
      url: fullUrl,
      success: (res) => {
        wx.openDocument({
          filePath: res.tempFilePath,
          showMenu: true,
          fail: () => wx.showToast({ title: '打开文件失败', icon: 'none' }),
        });
      },
      fail: () => wx.showToast({ title: '下载文件失败', icon: 'none' }),
    });
  },

  onShareAppMessage() {
    const { orderId, token, pack } = this.data;
    if (!orderId || !token) {
      return { title: '陪了个伴 · 陪诊服务', path: '/pages/index/index' };
    }
    const title = buildPackShareTitle(pack);
    const path = `/pages/order/share-timeline/share-timeline?orderId=${orderId}&token=${encodeURIComponent(token)}`;
    const lines = {
      subjectName: String(pack?.subjectName || '就诊人').trim() || '就诊人',
      serviceType: String(pack?.serviceType || '陪诊服务').trim() || '陪诊服务',
      statusLine: packIsLive(pack) ? '陪诊服务中' : '服务动态',
    };
    // 符合微信官方规范：同步返回基础分享信息，promise 字段异步补图
    const shareInfo: any = { title, path };
    shareInfo.promise = renderShareCoverToTempPath(this, lines).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
  },

  onShareTimeline() {
    const { orderId, token, pack } = this.data;
    if (!orderId || !token) {
      return { title: '陪了个伴 · 陪诊服务' };
    }
    const title = buildPackShareTitle(pack);
    const query = `orderId=${orderId}&token=${encodeURIComponent(token)}`;
    const lines = {
      subjectName: String(pack?.subjectName || '就诊人').trim() || '就诊人',
      serviceType: String(pack?.serviceType || '陪诊服务').trim() || '陪诊服务',
      statusLine: packIsLive(pack) ? '陪诊服务中' : '服务动态',
    };
    const shareInfo: any = { title, query };
    shareInfo.promise = renderShareCoverToTempPath(this, lines).then((imageUrl) => {
      if (imageUrl) shareInfo.imageUrl = imageUrl;
      return shareInfo;
    });
    return shareInfo;
  },
});
