/**
 * 与 `api/request.ts` 的 axios baseURL 保持一致。
 * 开发环境默认 `/api`，由 Vite 代理到后端，减少跨域与错误配置问题。
 */
export const API_BASE_URL: string =
          import.meta.env.VITE_API_BASE_URL ||
          (import.meta.env.DEV ? '/api' : 'http://localhost:3000')
