import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios'
import { ElMessage } from 'element-plus'
import { API_BASE_URL } from '@/config/api-base'
import { getToken, removeToken } from '@/utils/auth'
import router from '@/router'

const service = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})

let isRedirectingToLogin = false

service.interceptors.request.use(
  (config) => {
    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data
    if (res.code !== undefined && res.code !== 0 && res.code !== 200) {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
    return res.data !== undefined ? res.data : res
  },
  (error) => {
    const skipGlobal =
      (error.config as AxiosRequestConfig & { skipGlobalError?: boolean })
        ?.skipGlobalError === true
    if (error.response?.status === 401) {
      const onLoginPage = window.location.pathname.includes('/login')
      if (onLoginPage || skipGlobal) {
        // 登录接口的 401（账号/密码错误、验证码错误）由调用方自行展示，避免重复 toast
      } else if (!isRedirectingToLogin) {
        isRedirectingToLogin = true
        removeToken()
        ElMessage.error('登录已过期，请重新登录')
        router.push('/login').finally(() => {
          setTimeout(() => { isRedirectingToLogin = false }, 2000)
        })
      }
    } else if (!skipGlobal) {
      const raw = error.response?.data?.message
      const msg =
        typeof raw === 'string'
          ? raw
          : raw?.message || error.message || '网络异常'
      ElMessage.error(msg)
    }
    return Promise.reject(error)
  },
)

export function get<T = any>(url: string, params?: any, config?: AxiosRequestConfig): Promise<T> {
  return service.get(url, { params, ...config })
}

export function post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return service.post(url, data, config)
}

export function put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return service.put(url, data, config)
}

export function patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  return service.patch(url, data, config)
}

export function del<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return service.delete(url, config)
}

export default service
