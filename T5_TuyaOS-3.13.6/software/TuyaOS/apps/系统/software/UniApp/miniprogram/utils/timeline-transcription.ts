/**
 * 与后台 / 管理端 `getTimelineTranscription` 一致的 metadata.transcription 解析，
 * 供陪诊端编辑、用户端展示。
 */
export type TimelineTranscriptionView = {
  text: string;
  error: string;
  edited: boolean;
  status: string;
  statusText: string;
  tagType: 'primary' | 'danger' | 'warning' | 'success' | 'info';
  placeholder: string;
};

export function parseTimelineTranscription(item: any): TimelineTranscriptionView | null {
  if (item?.type !== 'audio_question' && item?.type !== 'audio_advice') return null;
  const source =
    item?.metadata?.transcription && typeof item.metadata.transcription === 'object'
      ? item.metadata.transcription
      : {};
  const status = String(source.status || '').trim();
  const text = String(source.text || '').trim();
  const edited = source.edited === true;
  const error = String(source.error || '').trim();

  if (status === 'processing') {
    return {
      text,
      error,
      edited,
      status,
      statusText: '转写中',
      tagType: 'primary',
      placeholder: '系统已提交语音识别，通常 1–3 分钟内返回，可稍后下拉刷新页面。',
    };
  }

  if (status === 'failed') {
    return {
      text,
      error,
      edited,
      status,
      statusText: '转写失败',
      tagType: 'danger',
      placeholder: '自动识别失败，可点击下方修改文字手动补充。',
    };
  }

  if (edited && text) {
    return {
      text,
      error,
      edited,
      status,
      statusText: '已修订',
      tagType: 'warning',
      placeholder: '暂无转写文字',
    };
  }

  if (status === 'success' && text) {
    return {
      text,
      error,
      edited,
      status,
      statusText: '已转写',
      tagType: 'success',
      placeholder: '暂无转写文字',
    };
  }

  return {
    text,
    error,
    edited,
    status,
    statusText: '待补充',
    tagType: 'info',
    placeholder: '暂无转写文字，可等待自动识别或手动输入。',
  };
}

/** C 端 / 分享页：仅展示可读文字或状态提示 */
export function getUserTranscriptionDisplay(item: any): { text?: string; hint?: string } | null {
  const tx = parseTimelineTranscription(item);
  if (!tx) return null;
  if (tx.text) return { text: tx.text };
  if (tx.status === 'processing') {
    return { hint: '语音正在转成文字，请稍候下拉刷新查看。' };
  }
  if (tx.status === 'failed') {
    return { hint: '本条录音暂未生成文字稿，可联系陪诊员或稍后再试。' };
  }
  return null;
}
