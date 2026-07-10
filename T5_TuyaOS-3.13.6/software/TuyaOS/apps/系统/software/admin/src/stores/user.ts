import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loginApi, getProfileApi, type LoginParams } from '@/api/auth'
import { getToken, setToken, removeToken } from '@/utils/auth'
import router from '@/router'

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(getToken())
  const userInfo = ref<any>(null)

  const isLoggedIn = computed(() => !!token.value)
  const userName = computed(() => userInfo.value?.real_name || userInfo.value?.username || '')
  const userRole = computed(() => userInfo.value?.role || '')

  async function login(params: LoginParams) {
    const res = await loginApi(params)
    token.value = res.token
    userInfo.value = res.user
    setToken(res.token)
  }

  async function fetchProfile() {
    try {
      const res = await getProfileApi()
      userInfo.value = res
    } catch (error) {
      logout()
      throw error
    }
  }

  function logout() {
    token.value = null
    userInfo.value = null
    removeToken()
    router.push('/login')
  }

  return { token, userInfo, isLoggedIn, userName, userRole, login, fetchProfile, logout }
})
