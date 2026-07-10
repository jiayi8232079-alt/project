import { ORDER_STATUS_META } from '@/constants/order-status'

export function formatDate(date: string | Date, fmt = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date)
  const map: Record<string, number> = {
    YYYY: d.getFullYear(),
    MM: d.getMonth() + 1,
    DD: d.getDate(),
    HH: d.getHours(),
    mm: d.getMinutes(),
    ss: d.getSeconds(),
  }
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, (matched) => {
    const val = map[matched] ?? 0
    return val < 10 ? `0${val}` : String(val)
  })
}

export function formatMoney(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return `¥${num.toFixed(2)}`
}

export const orderStatusMap: Record<string, { label: string; type: string }> = {
  pending_dispatch: { label: ORDER_STATUS_META.pending_dispatch.label, type: ORDER_STATUS_META.pending_dispatch.type },
  pending_accept: { label: ORDER_STATUS_META.pending_accept.label, type: ORDER_STATUS_META.pending_accept.type },
  pending_grab: { label: ORDER_STATUS_META.pending_grab.label, type: ORDER_STATUS_META.pending_grab.type },
  pending_sign: { label: ORDER_STATUS_META.pending_sign.label, type: ORDER_STATUS_META.pending_sign.type },
  pending_service: { label: ORDER_STATUS_META.pending_service.label, type: ORDER_STATUS_META.pending_service.type },
  in_progress: { label: ORDER_STATUS_META.in_progress.label, type: ORDER_STATUS_META.in_progress.type },
  pending_review: { label: ORDER_STATUS_META.pending_review.label, type: ORDER_STATUS_META.pending_review.type },
  completed: { label: ORDER_STATUS_META.completed.label, type: ORDER_STATUS_META.completed.type },
  canceled: { label: ORDER_STATUS_META.canceled.label, type: ORDER_STATUS_META.canceled.type },
  emergency: { label: ORDER_STATUS_META.emergency.label, type: ORDER_STATUS_META.emergency.type },
}
