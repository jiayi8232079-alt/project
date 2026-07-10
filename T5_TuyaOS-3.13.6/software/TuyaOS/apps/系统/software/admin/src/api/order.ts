import { get, post, put, del } from './request'
import { API_BASE_URL } from '@/config/api-base'
import { getToken } from '@/utils/auth'

export function getOrderList(params: any) {
  return get('/orders', params)
}

export function getDashboardLiveBoard(params?: { limit?: number }) {
  return get('/orders/stats/live-board', params)
}

export function getOrderDetail(id: number | string) {
  return get(`/orders/${id}`)
}

/** 与客户端同款公开页 token：管理端也可签发，用于扫码查看服务动态与进行中实时位置 */
export function getOrderTimelineShareToken(id: number | string) {
  return get(`/orders/${id}/timeline-share-token`)
}

/** 陪诊员实时位置（进行中时有坐标；管理端与下单用户均有权） */
export function getOrderAttendantLiveLocation(id: number | string) {
  return get(`/orders/${id}/attendant-live-location`)
}

/** 微信官方 getwxacodeunlimit 小程序码（返回 { imageBase64 }） */
export function getOrderWxaMonitorQrcode(id: number | string) {
  return get(`/orders/${id}/wxa-monitor-qrcode`)
}

/** 生成签署专用小程序码（返回 { imageBase64 }） */
export function getOrderWxaSignQrcode(id: number | string) {
  return get(`/orders/${id}/wxa-sign-qrcode`)
}

/** 生成健康档案签署专用小程序码（返回 { imageBase64 }） */
export function getHealthSignQrcode(serviceTargetId: number | string) {
  return get(`/orders/health-sign-qrcode/${serviceTargetId}`)
}

export function createOrder(data: any) {
  return post('/orders', data)
}

export function dispatchOrder(id: number | string, data: {
  attendantId?: number
  toGrabPool?: boolean
  attendantFee: number
  attendantFeeType?: string
}) {
  return put(`/orders/${id}/dispatch`, data)
}

/** 后台代陪诊员确认接单（订单 pending_accept → pending_service） */
export function adminConfirmAcceptOrder(id: number | string) {
  return put(`/orders/${id}/admin-confirm-accept`, {})
}

export function updateOrderStatus(id: number | string, data: { status: string; cancelReason?: string; remark?: string }) {
  return put(`/orders/${id}/status`, data)
}

export function cancelOrder(id: number | string, data?: { cancelReason?: string; reason?: string }) {
  return put(`/orders/${id}/cancel`, data || {})
}

export function getOrderTimeline(orderId: number | string, params?: { includeInternal?: boolean }) {
  return get(`/timelines/order/${orderId}`, params)
}

export function getOrderTimelineForUser(orderId: number | string) {
  return get(`/timelines/order/${orderId}/user`)
}

export function getTimelineAttachmentBlob(url: string, name?: string) {
  return get(
    '/timelines/attachment',
    { url, name },
    { responseType: 'blob' },
  )
}

export function updateTimelineVisibility(id: number, visible: boolean) {
  return put(`/timelines/${id}/visibility`, { visible })
}

export function updateTimelineTranscription(id: number | string, text: string) {
  return put(`/timelines/${id}/transcription`, { text })
}

// 总管理员修正节点业务时间（仅内容型节点 text/image/file/audio_*）
export function updateTimelineEventTime(id: number | string, eventTimeIso: string) {
  return put(`/timelines/${id}/event-time`, { eventTime: eventTimeIso })
}

/**
 * 发布时间线条目（支持附件）
 * @param orderId 订单 ID
 * @param type 类型 (text/image/audio_question/audio_advice/file)
 * @param content 文字内容
 * @param files 附件文件列表（图片/录音/PDF）
 * @param visibleToUser 是否对用户可见
 */
export function createTimelineEntry(params: {
  orderId: number
  type: string
  content?: string
  files?: File[]
  visibleToUser?: boolean
  /** 可选：补录时指定业务发生时间（ISO8601） */
  eventTime?: string
}) {
  const formData = new FormData()
  formData.append('orderId', String(params.orderId))
  formData.append('type', params.type)
  if (params.content) formData.append('content', params.content)
  formData.append('visibleToUser', params.visibleToUser ? '1' : '0')
  if (params.eventTime) formData.append('eventTime', params.eventTime)
  for (const f of params.files || []) {
    formData.append('files', f)
  }

  const token = getToken() || ''
  return fetch(`${API_BASE_URL}/timelines/upload`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || '发布失败')
    return data?.data !== undefined ? data.data : data
  })
}

export function batchUpdateTimelineVisibility(ids: number[], visible: boolean) {
  return put('/timelines/batch/visibility', { ids, visible })
}

/**
 * 总管理员编辑内容型时间线条目（文本 + 附件 + 可见性）
 *
 * keepImageUrls / keepAudioFiles / keepFiles 直接传数组，内部转成 JSON string 随表单发送。
 * 没传 = 该字段不动；传空数组 = 清空该类型所有附件。
 * content 不传 = 不动文本；传空字符串 = 清空文本。
 * newFiles 是本次新上传的附件，会按 mimetype 自动分入图片/录音/文档。
 */
export function updateTimelineEntry(
  id: number | string,
  params: {
    content?: string
    keepImageUrls?: string[]
    keepAudioFiles?: { url: string; name: string }[]
    keepFiles?: { url: string; name: string }[]
    visibleToUser?: boolean
    newFiles?: File[]
  },
) {
  const formData = new FormData()
  if (typeof params.content !== 'undefined') formData.append('content', params.content)
  if (typeof params.keepImageUrls !== 'undefined') {
    formData.append('keepImageUrls', JSON.stringify(params.keepImageUrls))
  }
  if (typeof params.keepAudioFiles !== 'undefined') {
    formData.append('keepAudioFiles', JSON.stringify(params.keepAudioFiles))
  }
  if (typeof params.keepFiles !== 'undefined') {
    formData.append('keepFiles', JSON.stringify(params.keepFiles))
  }
  if (typeof params.visibleToUser === 'boolean') {
    formData.append('visibleToUser', params.visibleToUser ? 'true' : 'false')
  }
  for (const f of params.newFiles || []) {
    formData.append('files', f)
  }

  const token = getToken() || ''
  return fetch(`${API_BASE_URL}/timelines/${id}`, {
    method: 'PUT',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  }).then(async (res) => {
    const data = await res.json()
    if (!res.ok) throw new Error(data?.message || '更新失败')
    return data?.data !== undefined ? data.data : data
  })
}

export function getOrderDocuments(orderId: number | string) {
  return get(`/documents/order/${orderId}`)
}

export function getOrderReviews(orderId: number | string) {
  return get(`/orders/${orderId}/reviews`)
}

export function submitOrderCompletion(id: number | string, data: {
  diagnosisResult?: string
  doctorAdvice?: string
  summary?: string
  followUpDate?: string
  followUpNote?: string
  followUpHospital?: string
  followUpDepartment?: string
  medicationMode?: string
  medications?: {
    name: string
    usage: string
    reminderTime?: string
    startDate?: string
    endDate?: string
  }[]
  images?: string[]
  files?: { url?: string; path?: string; name?: string }[] | string[]
}) {
  return post(`/orders/${id}/completion`, data)
}

export function updateOrder(id: number | string, data: any) {
  return put(`/orders/${id}`, data)
}

export function deleteOrder(id: number | string) {
  return del(`/orders/${id}`)
}
