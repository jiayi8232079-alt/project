<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as echarts from 'echarts'
import 'echarts-gl'

interface RegionItem {
  regionCode: string
  value: number
}

const props = withDefaults(
  defineProps<{
    adcode?: string
    regions?: RegionItem[]
    label?: string
  }>(),
  {
    adcode: '100000',
    regions: () => [],
    label: '数值',
  },
)

const emit = defineEmits<{ (e: 'drill', payload: { adcode: string; name: string }): void }>()

const el = ref<HTMLDivElement | null>(null)
const chart = shallowRef<echarts.ECharts | null>(null)
const failed = ref(false)
const nameToAdcode = new Map<string, string>()
const geoCache = new Map<string, unknown>()

function significantPrefix(adcode: string): string {
  return adcode.replace(/(0+)$/, '') || adcode
}

/** 把 site 级 regionCode 聚合到当前地图各区域（按行政编码前缀匹配）。 */
function valueForArea(areaAdcode: string): number {
  const prefix = significantPrefix(areaAdcode)
  let sum = 0
  for (const r of props.regions || []) {
    const code = String(r.regionCode || '')
    if (!code) continue
    if (code.startsWith(prefix) || prefix.startsWith(code)) {
      sum += Number(r.value || 0)
    }
  }
  return sum
}

async function loadGeo(adcode: string): Promise<unknown | null> {
  if (geoCache.has(adcode)) return geoCache.get(adcode)
  try {
    const resp = await fetch(
      `https://geo.datav.aliyun.com/areas_v3/bound/${adcode}_full.json`,
    )
    if (!resp.ok) throw new Error(`geojson ${resp.status}`)
    const geo = await resp.json()
    geoCache.set(adcode, geo)
    return geo
  } catch {
    return null
  }
}

async function render() {
  const geo = await loadGeo(props.adcode)
  if (!geo) {
    failed.value = true
    return
  }
  failed.value = false
  const mapName = `screen-${props.adcode}`
  nameToAdcode.clear()
  for (const f of (geo as any).features || []) {
    const p = f?.properties || {}
    if (p.name && p.adcode != null) nameToAdcode.set(String(p.name), String(p.adcode))
  }
  echarts.registerMap(mapName, geo as any)

  const data = Array.from(nameToAdcode.entries()).map(([name, adcode]) => ({
    name,
    value: valueForArea(adcode),
  }))
  const max = data.reduce((m, d) => Math.max(m, d.value), 0)

  if (!el.value) return
  if (!chart.value) {
    chart.value = echarts.init(el.value)
    chart.value.on('click', (params: any) => {
      const code = nameToAdcode.get(params?.name)
      if (code) emit('drill', { adcode: code, name: params.name })
    })
  }
  chart.value.setOption(
    {
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(9,24,51,0.9)',
        borderColor: '#1f78ff',
        textStyle: { color: '#d7e8ff' },
        formatter: (p: any) =>
          `${p.name}<br/>${props.label}：${p.value != null && !Number.isNaN(p.value) ? p.value : 0}`,
      },
      visualMap: {
        min: 0,
        max: Math.max(max, 1),
        left: 12,
        bottom: 12,
        text: ['高', '低'],
        calculable: true,
        inRange: { color: ['#0b2a52', '#1f78ff', '#5bd6ff'] },
        textStyle: { color: '#8fb4e8' },
      },
      series: [
        {
          type: 'map3D',
          map: mapName,
          regionHeight: 3,
          shading: 'lambert',
          boxWidth: 100,
          label: {
            show: true,
            textStyle: { color: '#9fc3f0', fontSize: 11, backgroundColor: 'transparent' },
          },
          itemStyle: { color: '#103257', borderColor: '#2f7fe0', borderWidth: 1, opacity: 0.96 },
          emphasis: {
            label: { show: true, textStyle: { color: '#fff' } },
            itemStyle: { color: '#1f78ff' },
          },
          light: {
            main: { intensity: 1.2, shadow: true, alpha: 45, beta: 30 },
            ambient: { intensity: 0.35 },
          },
          viewControl: {
            distance: 120,
            alpha: 42,
            beta: 0,
            autoRotate: false,
            rotateSensitivity: 1.4,
            zoomSensitivity: 1,
          },
          data,
        },
      ],
    },
    true,
  )
}

function resize() {
  chart.value?.resize()
}

onMounted(() => {
  render()
  window.addEventListener('resize', resize)
})

watch(() => props.adcode, render)
watch(() => props.regions, () => { if (!failed.value) render() }, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
  chart.value = null
})
</script>

<template>
  <div class="screen-map">
    <div v-show="!failed" ref="el" class="screen-map__canvas"></div>
    <div v-if="failed" class="screen-map__fallback">地图资源加载失败，请检查网络</div>
  </div>
</template>

<style scoped lang="scss">
.screen-map {
  width: 100%;
  height: 100%;
}
.screen-map__canvas {
  width: 100%;
  height: 100%;
}
.screen-map__fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b8bbd;
  font-size: 14px;
}
</style>
