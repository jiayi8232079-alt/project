<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { get } from '@/api/request'
import {
  assessPrescription,
  assessServiceTarget,
  createRule,
  deleteRule,
  getPrescriptionReport,
  getTargetReport,
  listRules,
  updateRule,
  type DrugInteractionRule,
  type PrescriptionRiskReport,
  type Severity,
} from '@/api/drug-interaction'

// ────────── 评估工作台 ──────────
const customerSearch = ref('')
const customerOptions = ref<Array<{ value: number; label: string }>>([])
const selectedCustomerId = ref<number | undefined>(undefined)

const serviceTargetOptions = ref<Array<{ value: number; label: string }>>([])
const selectedTargetId = ref<number | undefined>(undefined)

const prescriptionOptions = ref<
  Array<{ value: number; label: string; issuedDate: string }>
>([])
const selectedPrescriptionId = ref<number | undefined>(undefined)

const activeReport = ref<PrescriptionRiskReport | null>(null)
const assessing = ref(false)
const loadingReport = ref(false)

async function searchCustomer(q: string) {
  if (!q || q.length < 1) return
  try {
    const res: any = await get('/users', { keyword: q, page: 1, pageSize: 20 })
    customerOptions.value = (res.items || []).map((u: any) => ({
      value: u.id,
      label: `${u.nickname || u.phone || '用户'} (${u.phone || u.id})`,
    }))
  } catch {
    customerOptions.value = []
  }
}

async function onCustomerChange(userId?: number) {
  selectedTargetId.value = undefined
  selectedPrescriptionId.value = undefined
  activeReport.value = null
  serviceTargetOptions.value = []
  prescriptionOptions.value = []
  if (!userId) return
  try {
    const res: any = await get(`/users/${userId}/service-targets`)
    serviceTargetOptions.value = (res || []).map((t: any) => ({
      value: t.id,
      label: `${t.name}（${t.relation || '本人'}）`,
    }))
  } catch {
    serviceTargetOptions.value = []
  }

  try {
    const res: any = await get('/medication-prescriptions', {
      userId,
      page: 1,
      pageSize: 50,
    })
    prescriptionOptions.value = (res.items || []).map((p: any) => ({
      value: p.id,
      label: `#${p.id} · ${p.hospital || '—'} · ${p.issuedDate || p.createdAt?.slice(0, 10) || ''}`,
      issuedDate: p.issuedDate || p.createdAt,
    }))
  } catch {
    prescriptionOptions.value = []
  }
}

async function onTargetChange() {
  activeReport.value = null
  if (!selectedTargetId.value) return
  loadingReport.value = true
  try {
    const report = await getTargetReport(selectedTargetId.value)
    activeReport.value = report || null
  } catch {
    activeReport.value = null
  } finally {
    loadingReport.value = false
  }
}

async function onPrescriptionChange() {
  activeReport.value = null
  if (!selectedPrescriptionId.value) return
  loadingReport.value = true
  try {
    const report = await getPrescriptionReport(selectedPrescriptionId.value)
    activeReport.value = report || null
  } catch {
    activeReport.value = null
  } finally {
    loadingReport.value = false
  }
}

async function runAssessTarget() {
  if (!selectedTargetId.value) {
    ElMessage.warning('请先选择服务对象')
    return
  }
  assessing.value = true
  try {
    const report = await assessServiceTarget(selectedTargetId.value)
    activeReport.value = report
    ElMessage.success('评估完成')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '评估失败')
  } finally {
    assessing.value = false
  }
}

async function runAssessPrescription() {
  if (!selectedPrescriptionId.value) {
    ElMessage.warning('请先选择处方')
    return
  }
  assessing.value = true
  try {
    const report = await assessPrescription(selectedPrescriptionId.value)
    activeReport.value = report
    ElMessage.success('评估完成')
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '评估失败')
  } finally {
    assessing.value = false
  }
}

const riskLevelLabel: Record<string, string> = {
  none: '未发现风险',
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}
const riskLevelColor: Record<string, string> = {
  none: '',
  low: 'info',
  medium: 'warning',
  high: 'danger',
}
const severityLabel: Record<Severity, string> = {
  high: '高',
  medium: '中',
  low: '低',
}
const severityColor: Record<Severity, string> = {
  high: 'danger',
  medium: 'warning',
  low: 'info',
}

// ────────── 规则库管理 ──────────
const ruleList = ref<DrugInteractionRule[]>([])
const rulesLoading = ref(false)
const rulesTotal = ref(0)
const rulePage = ref(1)
const rulePageSize = ref(20)
const filterSeverity = ref<Severity | ''>('')
const filterEnabled = ref<'' | 'true' | 'false'>('')
const filterKeyword = ref('')

async function loadRules() {
  rulesLoading.value = true
  try {
    const params: any = { page: rulePage.value, pageSize: rulePageSize.value }
    if (filterSeverity.value) params.severity = filterSeverity.value
    if (filterEnabled.value !== '') params.enabled = filterEnabled.value
    if (filterKeyword.value.trim()) params.keyword = filterKeyword.value.trim()
    const res = await listRules(params)
    ruleList.value = res.items
    rulesTotal.value = res.total
  } catch {
    ruleList.value = []
  } finally {
    rulesLoading.value = false
  }
}

function resetRulesFilter() {
  filterSeverity.value = ''
  filterEnabled.value = ''
  filterKeyword.value = ''
  rulePage.value = 1
  loadRules()
}

const ruleDialogVisible = ref(false)
const editingRuleId = ref<number | null>(null)
const ruleSaving = ref(false)
const ruleForm = ref<{
  drugA: string
  drugB: string
  drugAAliases: string
  drugBAliases: string
  severity: Severity
  mechanism: string
  recommendation: string
  evidenceLevel: 'A' | 'B' | 'C' | ''
}>({
  drugA: '',
  drugB: '',
  drugAAliases: '',
  drugBAliases: '',
  severity: 'medium',
  mechanism: '',
  recommendation: '',
  evidenceLevel: '',
})

function openCreateRule() {
  editingRuleId.value = null
  ruleForm.value = {
    drugA: '',
    drugB: '',
    drugAAliases: '',
    drugBAliases: '',
    severity: 'medium',
    mechanism: '',
    recommendation: '',
    evidenceLevel: '',
  }
  ruleDialogVisible.value = true
}

function openEditRule(row: DrugInteractionRule) {
  editingRuleId.value = row.id
  ruleForm.value = {
    drugA: row.drugA,
    drugB: row.drugB,
    drugAAliases: (row.drugAAliases || []).join(','),
    drugBAliases: (row.drugBAliases || []).join(','),
    severity: row.severity,
    mechanism: row.mechanism,
    recommendation: row.recommendation,
    evidenceLevel: (row.evidenceLevel as any) || '',
  }
  ruleDialogVisible.value = true
}

async function saveRule() {
  if (!ruleForm.value.drugA || !ruleForm.value.drugB) {
    ElMessage.warning('请填写药物A与药物B')
    return
  }
  if (!ruleForm.value.mechanism || !ruleForm.value.recommendation) {
    ElMessage.warning('请填写相互作用机制与处理建议')
    return
  }
  const payload = {
    drugA: ruleForm.value.drugA.trim(),
    drugB: ruleForm.value.drugB.trim(),
    drugAAliases: ruleForm.value.drugAAliases
      .split(/[,，;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
    drugBAliases: ruleForm.value.drugBAliases
      .split(/[,，;；\n]/)
      .map((s) => s.trim())
      .filter(Boolean),
    severity: ruleForm.value.severity,
    mechanism: ruleForm.value.mechanism.trim(),
    recommendation: ruleForm.value.recommendation.trim(),
    evidenceLevel: ruleForm.value.evidenceLevel || null,
  }
  if (payload.drugAAliases.length === 0) payload.drugAAliases = [payload.drugA]
  if (payload.drugBAliases.length === 0) payload.drugBAliases = [payload.drugB]

  ruleSaving.value = true
  try {
    if (editingRuleId.value) {
      await updateRule(editingRuleId.value, payload as any)
    } else {
      await createRule(payload as any)
    }
    ElMessage.success('保存成功')
    ruleDialogVisible.value = false
    await loadRules()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '保存失败')
  } finally {
    ruleSaving.value = false
  }
}

async function toggleRuleEnabled(row: DrugInteractionRule) {
  try {
    await updateRule(row.id, { enabled: !row.enabled })
    ElMessage.success(row.enabled ? '已禁用' : '已启用')
    await loadRules()
  } catch {
    /* noop */
  }
}

async function removeRule(row: DrugInteractionRule) {
  if (row.source === 'builtin') {
    ElMessage.warning('内置规则不可删除，可点「禁用」停止命中')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认删除规则 ${row.drugA} + ${row.drugB}？`,
      '提示',
      { type: 'warning' },
    )
    await deleteRule(row.id)
    ElMessage.success('已删除')
    await loadRules()
  } catch {
    /* noop */
  }
}

const showFallbackHint = computed(
  () => !!activeReport.value?.payload?.llmFallback,
)

onMounted(() => {
  loadRules()
})
</script>

<template>
  <div class="page-container">
    <div class="page-header">
      <div class="page-header__meta">
        <h2 class="page-title">药物相互作用检测</h2>
        <p class="page-subtitle">
          基于内置规则库 + AI 药师深度分析，对客户处方或服务对象当前用药组合进行风险评估。
        </p>
      </div>
    </div>

    <el-tabs type="border-card">
      <!-- Tab 1: 评估工作台 -->
      <el-tab-pane label="评估工作台">
        <el-card shadow="never" class="workbench-card">
          <div class="workbench-row">
            <div class="workbench-item">
              <div class="workbench-label">客户</div>
              <el-select
                v-model="selectedCustomerId"
                placeholder="搜索客户（昵称/手机号）"
                filterable
                remote
                :remote-method="searchCustomer"
                clearable
                style="width: 100%;"
                @change="onCustomerChange"
              >
                <el-option
                  v-for="opt in customerOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
            <div class="workbench-item">
              <div class="workbench-label">服务对象</div>
              <el-select
                v-model="selectedTargetId"
                placeholder="选择服务对象评估整体用药"
                clearable
                style="width: 100%;"
                :disabled="!selectedCustomerId"
                @change="onTargetChange"
              >
                <el-option
                  v-for="opt in serviceTargetOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
            <div class="workbench-item">
              <el-button
                type="primary"
                :loading="assessing"
                :disabled="!selectedTargetId"
                @click="runAssessTarget"
              >
                评估服务对象整体用药
              </el-button>
            </div>
          </div>

          <el-divider content-position="left">或按处方评估</el-divider>

          <div class="workbench-row">
            <div class="workbench-item">
              <div class="workbench-label">处方批次</div>
              <el-select
                v-model="selectedPrescriptionId"
                placeholder="选择该客户的某张处方"
                clearable
                style="width: 100%;"
                :disabled="!selectedCustomerId"
                @change="onPrescriptionChange"
              >
                <el-option
                  v-for="opt in prescriptionOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </div>
            <div class="workbench-item">
              <el-button
                type="primary"
                :loading="assessing"
                :disabled="!selectedPrescriptionId"
                @click="runAssessPrescription"
              >
                评估该处方内相互作用
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 风险报告展示 -->
        <el-card
          v-loading="loadingReport"
          shadow="never"
          class="report-card"
          style="margin-top: 16px;"
        >
          <template v-if="activeReport">
            <div class="report-header">
              <div class="report-title-row">
                <h3 class="report-title">风险评估报告</h3>
                <el-tag
                  :type="(riskLevelColor[activeReport.riskLevel] as any) || 'info'"
                  size="large"
                >
                  {{ riskLevelLabel[activeReport.riskLevel] }}
                </el-tag>
                <el-tag size="small" type="info" effect="plain">
                  命中 {{ activeReport.findingsCount }} 条
                </el-tag>
                <el-tag size="small" type="info" effect="plain">
                  评估时间 {{ (activeReport.assessedAt || '').replace('T', ' ').slice(0, 19) }}
                </el-tag>
              </div>
              <p class="report-summary">{{ activeReport.payload?.summary || '（无摘要）' }}</p>
              <el-alert
                v-if="showFallbackHint"
                type="warning"
                :closable="false"
                show-icon
                title="当前只使用了规则库评估"
                description="AI 未启用或调用失败；如需更深度的分析，请在『系统配置』中配置 AI 并确认开启。"
                style="margin-top: 8px;"
              />
            </div>

            <el-divider />

            <div class="report-section">
              <h4 class="section-subtitle">评估药物清单</h4>
              <el-tag
                v-for="(m, idx) in activeReport.payload?.medicines || []"
                :key="idx"
                style="margin: 4px;"
                type="info"
                effect="plain"
              >
                {{ m.medicineName }}
                <template v-if="m.dosage">（{{ m.dosage }}）</template>
              </el-tag>
            </div>

            <el-divider />

            <div class="report-section">
              <h4 class="section-subtitle">相互作用发现</h4>
              <el-empty
                v-if="(activeReport.payload?.findings || []).length === 0"
                description="未发现已知相互作用风险"
              />
              <el-table
                v-else
                :data="activeReport.payload?.findings || []"
                border
                stripe
              >
                <el-table-column label="严重度" width="90">
                  <template #default="{ row }">
                    <el-tag :type="severityColor[row.severity as Severity] as any" size="small">
                      {{ severityLabel[row.severity as Severity] }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="来源" width="80">
                  <template #default="{ row }">
                    <el-tag
                      size="small"
                      :type="row.source === 'rule' ? 'success' : 'warning'"
                      effect="plain"
                    >
                      {{ row.source === 'rule' ? '规则' : 'AI' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="药物组合" min-width="160">
                  <template #default="{ row }">
                    <span>{{ row.drugA }}</span>
                    <el-icon style="margin: 0 6px; color: #f56c6c;">
                      <i class="el-icon-close" />
                    </el-icon>
                    <span>+ {{ row.drugB }}</span>
                  </template>
                </el-table-column>
                <el-table-column
                  label="机制"
                  prop="mechanism"
                  min-width="260"
                  show-overflow-tooltip
                />
                <el-table-column
                  label="建议"
                  prop="recommendation"
                  min-width="260"
                  show-overflow-tooltip
                />
                <el-table-column label="证据" width="80">
                  <template #default="{ row }">
                    <el-tag
                      v-if="row.evidenceLevel"
                      size="small"
                      effect="plain"
                    >{{ row.evidenceLevel }}</el-tag>
                    <span v-else>—</span>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
          <template v-else>
            <el-empty description="选择客户后，可对其服务对象整体用药或某张处方发起评估。" />
          </template>
        </el-card>
      </el-tab-pane>

      <!-- Tab 2: 规则库管理 -->
      <el-tab-pane label="规则库">
        <el-card shadow="never" class="filter-bar">
          <div style="display: flex; gap: 12px; flex-wrap: wrap;">
            <el-input
              v-model="filterKeyword"
              placeholder="药名关键字"
              clearable
              style="width: 200px;"
              @keyup.enter="() => { rulePage = 1; loadRules() }"
            />
            <el-select
              v-model="filterSeverity"
              placeholder="严重度"
              clearable
              style="width: 140px;"
              @change="() => { rulePage = 1; loadRules() }"
            >
              <el-option label="高" value="high" />
              <el-option label="中" value="medium" />
              <el-option label="低" value="low" />
            </el-select>
            <el-select
              v-model="filterEnabled"
              placeholder="启用状态"
              clearable
              style="width: 140px;"
              @change="() => { rulePage = 1; loadRules() }"
            >
              <el-option label="启用" value="true" />
              <el-option label="禁用" value="false" />
            </el-select>
            <el-button type="primary" @click="() => { rulePage = 1; loadRules() }">搜索</el-button>
            <el-button @click="resetRulesFilter">重置</el-button>
            <div style="flex: 1;" />
            <el-button type="primary" plain @click="openCreateRule">新增规则</el-button>
          </div>
        </el-card>

        <el-card shadow="never" class="table-card" style="margin-top: 12px;">
          <el-table :data="ruleList" v-loading="rulesLoading" border stripe>
            <el-table-column type="index" width="50" />
            <el-table-column label="严重度" width="90">
              <template #default="{ row }">
                <el-tag :type="severityColor[row.severity as Severity] as any" size="small">
                  {{ severityLabel[row.severity as Severity] }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="药物组合" min-width="200">
              <template #default="{ row }">
                <strong>{{ row.drugA }}</strong>
                <span style="margin: 0 6px; color: #f56c6c;">+</span>
                <strong>{{ row.drugB }}</strong>
              </template>
            </el-table-column>
            <el-table-column label="机制" prop="mechanism" min-width="260" show-overflow-tooltip />
            <el-table-column
              label="建议"
              prop="recommendation"
              min-width="260"
              show-overflow-tooltip
            />
            <el-table-column label="证据" width="70">
              <template #default="{ row }">
                <el-tag v-if="row.evidenceLevel" size="small" effect="plain">
                  {{ row.evidenceLevel }}
                </el-tag>
                <span v-else>—</span>
              </template>
            </el-table-column>
            <el-table-column label="来源" width="80">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :type="row.source === 'builtin' ? 'success' : 'warning'"
                  effect="plain"
                >
                  {{ row.source === 'builtin' ? '内置' : '自定义' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80">
              <template #default="{ row }">
                <el-tag
                  size="small"
                  :type="row.enabled ? 'success' : 'info'"
                >
                  {{ row.enabled ? '启用' : '禁用' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="210" fixed="right">
              <template #default="{ row }">
                <el-button size="small" @click="openEditRule(row)">编辑</el-button>
                <el-button size="small" type="warning" plain @click="toggleRuleEnabled(row)">
                  {{ row.enabled ? '禁用' : '启用' }}
                </el-button>
                <el-button
                  v-if="row.source === 'custom'"
                  size="small"
                  type="danger"
                  plain
                  @click="removeRule(row)"
                >删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
            <el-pagination
              v-model:current-page="rulePage"
              v-model:page-size="rulePageSize"
              :total="rulesTotal"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              @size-change="loadRules"
              @current-change="loadRules"
            />
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="ruleDialogVisible"
      :title="editingRuleId ? '编辑规则' : '新增规则'"
      width="620px"
      :close-on-click-modal="false"
    >
      <el-form :model="ruleForm" label-width="110px">
        <el-form-item label="药物 A" required>
          <el-input v-model="ruleForm.drugA" placeholder="通用名，如 华法林" />
        </el-form-item>
        <el-form-item label="A 别名">
          <el-input
            v-model="ruleForm.drugAAliases"
            placeholder="多个别名用逗号分隔，如：Warfarin,华法令"
          />
        </el-form-item>
        <el-form-item label="药物 B" required>
          <el-input v-model="ruleForm.drugB" placeholder="通用名，如 阿司匹林" />
        </el-form-item>
        <el-form-item label="B 别名">
          <el-input
            v-model="ruleForm.drugBAliases"
            placeholder="多个别名用逗号分隔"
          />
        </el-form-item>
        <el-form-item label="严重度" required>
          <el-select v-model="ruleForm.severity" style="width: 100%;">
            <el-option label="高" value="high" />
            <el-option label="中" value="medium" />
            <el-option label="低" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="证据等级">
          <el-select v-model="ruleForm.evidenceLevel" clearable style="width: 100%;">
            <el-option label="A：权威指南明确" value="A" />
            <el-option label="B：文献一致推荐" value="B" />
            <el-option label="C：存在风险但证据一般" value="C" />
          </el-select>
        </el-form-item>
        <el-form-item label="相互作用机制" required>
          <el-input
            v-model="ruleForm.mechanism"
            type="textarea"
            :rows="3"
            placeholder="通俗解释为什么联用有风险"
          />
        </el-form-item>
        <el-form-item label="处理建议" required>
          <el-input
            v-model="ruleForm.recommendation"
            type="textarea"
            :rows="3"
            placeholder="给家属或护理人员的操作建议"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="ruleSaving" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.workbench-card {
  .workbench-row {
    display: flex;
    gap: 16px;
    align-items: flex-end;
    flex-wrap: wrap;
  }
  .workbench-item {
    flex: 1;
    min-width: 220px;
  }
  .workbench-label {
    font-size: 13px;
    color: #606266;
    margin-bottom: 4px;
  }
}

.report-card {
  .report-title-row {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
  }
  .report-title {
    margin: 0;
    font-size: 16px;
  }
  .report-summary {
    margin-top: 8px;
    line-height: 1.6;
    color: #303133;
  }
  .section-subtitle {
    margin: 0 0 8px;
    font-size: 14px;
    color: #606266;
  }
}
</style>
