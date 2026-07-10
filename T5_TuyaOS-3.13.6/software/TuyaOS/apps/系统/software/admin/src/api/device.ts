import { get, post, del } from './request'

export interface Device {
  id: number
  tenantId: number
  tuyaDeviceId: string
  productId: string
  name: string
  type: 'robot' | 'radar' | 'wearable'
  status: 'active' | 'pending' | 'suspended' | 'decommissioned'
  firmwareVersion: string | null
  mac: string | null
  online: boolean
  lastOnlineAt: string | null
  lastHeartbeatAt: string | null
  batteryPercent: number | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface DeviceDetailResp {
  device: Device
  bindings: unknown[]
  dpSnapshots: unknown[]
}

export interface DeviceEventLog {
  id: number
  tenantId: number
  deviceId: number
  type: string
  level: 'info' | 'warning' | 'critical'
  payload: Record<string, unknown> | null
  receivedAt: string
  dedupKey: string | null
  forwardedToAlert: boolean
  forwardedToRealtime: boolean
  createdAt: string
  deviceName?: string | null
}

export interface DeviceDashboardStats {
  total: number
  onlineCount: number
  offlineCount: number
  onlineRate: number
  batteryBuckets: { high: number; medium: number; low: number; unknown: number }
  criticalEvents7d: number
  fallEvents7d: number
  alertRate7d: number
}

export interface DeviceListResp {
  items: Device[]
  total: number
  page: number
  pageSize: number
}

export interface DeviceListQuery {
  keyword?: string
  status?: Device['status']
  online?: 'true' | 'false'
  type?: Device['type']
  page?: number
  pageSize?: number
}

export function listDevices(params?: DeviceListQuery) {
  return get<DeviceListResp>('/devices', params)
}

export function getDevice(id: number | string) {
  return get<DeviceDetailResp>(`/devices/${id}`)
}

export function getDeviceEvents(
  id: number | string,
  params?: { page?: number; pageSize?: number; type?: string; level?: string },
) {
  return get<{ items: DeviceEventLog[]; total: number; page: number; pageSize: number }>(
    `/devices/${id}/events`,
    params,
  )
}

export function getDeviceDashboardStats() {
  return get<DeviceDashboardStats>('/devices/stats/dashboard')
}

export function listSafetyEvents(params?: {
  page?: number
  pageSize?: number
  type?: string
  deviceId?: number
}) {
  return get<{ items: DeviceEventLog[]; total: number; page: number; pageSize: number }>(
    '/devices/events/safety',
    params,
  )
}

export function bindDevice(data: {
  tuyaDeviceId: string
  productId: string
  name: string
  serviceTargetId?: number
}) {
  return post<Device>('/devices/bind', data)
}

export function unbindDevice(id: number | string) {
  return del(`/devices/${id}/binding`)
}

export function sendDp(
  id: number | string,
  data: { code: string; value: string },
) {
  return post(`/devices/${id}/dp`, data)
}

export function sendSelfControl(
  id: number | string,
  data: { code: string; value: string },
) {
  return post(`/devices/${id}/self-control`, data)
}

export function mockDeviceEvent(
  id: number | string,
  data: {
    type: string
    level?: string
    payload?: Record<string, unknown>
    dedupKey?: string
  },
) {
  return post<DeviceEventLog>(`/devices/${id}/mock-event`, data)
}

export function mockDeviceOnline(id: number | string, online: boolean) {
  return post<{ online: boolean }>(`/devices/${id}/mock-online`, { online })
}
