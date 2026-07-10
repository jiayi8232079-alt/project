import { get, patch, post } from './request'

export function listContent(category?: string) {
  return get('/content-library', category ? { category } : undefined)
}

export function createContent(data: Record<string, unknown>) {
  return post('/content-library', data)
}

export function updateContent(id: number, data: Record<string, unknown>) {
  return patch(`/content-library/${id}`, data)
}

export function playContent(id: number, deviceId?: number) {
  return post(`/content-library/${id}/play`, deviceId ? { deviceId } : {})
}
