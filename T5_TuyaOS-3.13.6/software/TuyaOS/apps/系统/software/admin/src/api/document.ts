import { post } from './request'
import service from './request'

/** 归档：生成并落库陪诊确认单，返回文档记录（含可外链 url）。日常预览请用 fetchServiceConfirmHtml。 */
export function generateServiceConfirm(orderId: number | string) {
  return post(`/documents/generate/service-confirm/${orderId}`)
}

/** 实时预览：鉴权后返回纯 HTML（不落库），供管理端 iframe / Blob URL。 */
export async function fetchServiceConfirmHtml(orderId: number | string): Promise<string> {
  const body = await service.get<string>(`/documents/order/${orderId}/service-confirm-html`, {
    responseType: 'text',
  })
  // request 拦截器已把 Axios 的 response.data 解包后返回；此处 body 即是 HTML 字符串，不是 { data: ... }
  if (typeof body === 'string') return body
  return ''
}
