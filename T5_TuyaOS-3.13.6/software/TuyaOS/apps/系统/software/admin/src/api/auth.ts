import { post, get } from './request'

export interface LoginParams {
  username: string
  password: string
  captchaToken?: string
  captchaCode?: string
}

export interface LoginResult {
  token: string
  user: {
    id: number
    username: string
    real_name: string
    role: string
  }
}

export interface CaptchaResult {
  token: string
  svg: string
}

export function loginApi(data: LoginParams) {
  return post<LoginResult>('/auth/admin-login', data, {
    // 登录接口的错误提示由登录页自己处理，避免全局 toast 抢占验证码/锁定文案
    // @ts-expect-error - 扩展字段，由 request.ts 拦截器识别
    skipGlobalError: true,
  })
}

export function getCaptchaApi() {
  return get<CaptchaResult>('/auth/captcha')
}

export function getProfileApi() {
  return get('/auth/profile')
}
