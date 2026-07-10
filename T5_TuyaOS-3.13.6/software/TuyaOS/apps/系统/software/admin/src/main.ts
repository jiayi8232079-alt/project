import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import DataVVue3 from '@kjgl77/datav-vue3'
import App from './App.vue'
import router from './router'
import { createPinia } from 'pinia'
import './assets/styles/index.scss'

const app = createApp(App)
const pinia = createPinia()

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn })
// 可视化大屏组件库（DataV）：注册后大屏页可用 <dv-*> 装饰组件
app.use(DataVVue3)
app.mount('#app')
