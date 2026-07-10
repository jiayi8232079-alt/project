<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts'
import { provinceNameFromCode } from '@/utils/region'

interface RegionItem {
  regionCode: string
  value: number
}

const props = withDefaults(
  defineProps<{
    regions: RegionItem[]
    label?: string
    height?: string
    geojsonUrl?: string
  }>(),
  {
    label: '数值',
    height: '420px',
    geojsonUrl: 'https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json',
  },
)

const MAP_NAME = 'china'
// 模块级缓存：多个地图实例共享同一份 GeoJSON / 注册结果
let mapRegistered = false
let geojsonPromise: Promise<boolean> | null = null

const el = ref<HTMLDivElement | null>(null)
const chart = shallowRef<echarts.ECharts | null>(null)
const mapReady = ref(false)
const mapFailed = ref(false)

/** 把任意位数 region_code 聚合成省份全名 → 求和 */
const provinceValues = computed(() => {
  const map = new Map<string, number>()
  for (const r of props.regions || []) {
    const name = provinceNameFromCode(r.regionCode)
    if (!name) continue
    map.set(name, (map.get(name) ?? 0) + Number(r.value || 0))
  }
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
})

const fallbackTop = computed(() =>
  [...provinceValues.value].sort((a, b) => b.value - a.value).slice(0, 10),
)

const maxValue = computed(() =>
  provinceValues.value.reduce((m, p) => Math.max(m, p.value), 0),
)

async function ensureMap(): Promise<boolean> {
  if (mapRegistered) return true
  if (!geojsonPromise) {
    geojsonPromise = (async () => {
      try {
        const resp = await fetch(props.geojsonUrl)
        if (!resp.ok) throw new Error(`geojson ${resp.status}`)
        const geo = await resp.json()
        echarts.registerMap(MAP_NAME, geo as any)
        mapRegistered = true
        return true
      } catch {
        return false
      }
    })()
  }
  return geojsonPromise
}

function renderChart() {
  if (!el.value || !mapReady.value) return
  if (!chart.value) chart.value = echarts.init(el.value)
  chart.value.setOption({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) =>
        `${p.name}<br/>${props.label}：${p.value != null && !Number.isNaN(p.value) ? p.value : 0}`,
    },
    visualMap: {
      min: 0,
      max: Math.max(maxValue.value, 1),
      left: 16,
      bottom: 16,
      text: ['高', '低'],
      calculable: true,
      inRange: { color: ['#e6f4ff', '#69b1ff', '#1677ff', '#0958d9'] },
      textStyle: { color: '#64748b' },
    },
    series: [
      {
        name: props.label,
        type: 'map',
        map: MAP_NAME,
        roam: true,
        emphasis: { label: { show: false }, itemStyle: { areaColor: '#ffd666' } },
        itemStyle: { borderColor: '#cbd5e1', areaColor: '#f8fafc' },
        data: provinceValues.value,
      },
    ],
  })
}

function resize() {
  chart.value?.resize()
}

onMounted(async () => {
  const ok = await ensureMap()
  if (ok) {
    mapReady.value = true
    renderChart()
    window.addEventListener('resize', resize)
  } else {
    mapFailed.value = true
  }
})

watch(
  () => props.regions,
  () => {
    if (mapReady.value) renderChart()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div class="china-map">
    <div v-show="mapReady" ref="el" class="china-map__canvas" :style="{ height }"></div>

    <div v-if="mapFailed" class="china-map__fallback" :style="{ minHeight: height }">
      <div class="china-map__fallback-tip">地图资源加载失败，按省份展示 Top 10：</div>
      <div v-if="!fallbackTop.length" class="china-map__empty">暂无区域数据</div>
      <ul v-else class="china-map__bars">
        <li v-for="item in fallbackTop" :key="item.name">
          <span class="bar-name">{{ item.name }}</span>
          <span class="bar-track">
            <span
              class="bar-fill"
              :style="{ width: `${Math.round((item.value / Math.max(maxValue, 1)) * 100)}%` }"
            ></span>
          </span>
          <span class="bar-value">{{ item.value }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped lang="scss">
.china-map {
  width: 100%;
}
.china-map__canvas {
  width: 100%;
}
.china-map__fallback {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.china-map__fallback-tip {
  font-size: 13px;
  color: #94a3b8;
}
.china-map__empty {
  color: #94a3b8;
  text-align: center;
  padding: 40px 0;
}
.china-map__bars {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.china-map__bars li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.bar-name {
  width: 90px;
  color: #475569;
  flex-shrink: 0;
}
.bar-track {
  flex: 1;
  height: 10px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #69b1ff, #1677ff);
  border-radius: 999px;
}
.bar-value {
  width: 56px;
  text-align: right;
  color: #1e293b;
  font-weight: 600;
}
</style>
