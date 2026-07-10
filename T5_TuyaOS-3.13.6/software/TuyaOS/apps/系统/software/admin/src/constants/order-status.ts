export type OrderStatusKey =
  | 'pending_dispatch'
  | 'pending_accept'
  | 'pending_grab'
  | 'pending_sign'
  | 'pending_service'
  | 'in_progress'
  | 'pending_review'
  | 'completed'
  | 'canceled'
  | 'emergency'

type StatusMeta = {
  label: string
  type: 'primary' | 'success' | 'warning' | 'danger' | 'info' | ''
  color: string
  stageIndex: number
}

export const ORDER_STATUS_META: Record<OrderStatusKey, StatusMeta> = {
  pending_dispatch: { label: '待派单', type: 'info', color: '#8fa7b6', stageIndex: 0 },
  pending_accept: { label: '待接单', type: 'warning', color: '#ffc06a', stageIndex: 0 },
  pending_grab: { label: '抢单中', type: 'warning', color: '#ff9e75', stageIndex: 1 },
  pending_sign: { label: '待签到', type: 'warning', color: '#5ec6ff', stageIndex: 2 },
  pending_service: { label: '待服务', type: 'primary', color: '#81c5ff', stageIndex: 3 },
  in_progress: { label: '服务中', type: 'success', color: '#3fb6a8', stageIndex: 3 },
  pending_review: { label: '服务已结束', type: 'info', color: '#94a3b8', stageIndex: 4 },
  completed: { label: '已完成', type: 'success', color: '#6bd4c7', stageIndex: 4 },
  canceled: { label: '已取消', type: 'danger', color: '#9aa6ad', stageIndex: 4 },
  emergency: { label: '紧急', type: 'danger', color: '#ff7f73', stageIndex: 3 },
}

export const SERVICE_STAGES = ['订单受理', '派单确认', '到院签到', '陪诊服务', '服务收尾']
