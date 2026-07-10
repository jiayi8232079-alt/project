import { get, post, put, del } from './request'

export type Severity = 'high' | 'medium' | 'low'
export type RiskLevel = 'none' | 'low' | 'medium' | 'high'

export interface DrugInteractionRule {
  id: number
  drugA: string
  drugB: string
  drugAAliases: string[]
  drugBAliases: string[]
  severity: Severity
  mechanism: string
  recommendation: string
  evidenceLevel: 'A' | 'B' | 'C' | null
  enabled: boolean
  source: 'builtin' | 'custom'
  createdAt: string
  updatedAt: string
}

export interface DrugInteractionFinding {
  drugA: string
  drugB: string
  severity: Severity
  mechanism: string
  recommendation: string
  source: 'rule' | 'llm'
  ruleId?: number
  evidenceLevel?: 'A' | 'B' | 'C'
}

export interface RiskReportPayload {
  medicines: Array<{
    medicineName: string
    reminderId?: number | null
    prescriptionId?: number | null
    dosage?: string | null
    severity?: string | null
  }>
  findings: DrugInteractionFinding[]
  summary: string
  model?: string
  tokensUsed?: number | null
  llmFallback?: boolean
}

export interface PrescriptionRiskReport {
  id: number
  scope: 'prescription' | 'target'
  userId: number
  serviceTargetId: number | null
  prescriptionId: number | null
  riskLevel: RiskLevel
  findingsCount: number
  payload: RiskReportPayload
  assessedBy: number | null
  assessedAt: string
  createdAt: string
  updatedAt: string
}

export function assessPrescription(prescriptionId: number | string) {
  return post<PrescriptionRiskReport>(`/drug-interactions/assess/prescription/${prescriptionId}`)
}

export function assessServiceTarget(targetId: number | string) {
  return post<PrescriptionRiskReport>(`/drug-interactions/assess/target/${targetId}`)
}

export function getPrescriptionReport(prescriptionId: number | string) {
  return get<PrescriptionRiskReport | null>(`/drug-interactions/prescription/${prescriptionId}`)
}

export function getTargetReport(targetId: number | string) {
  return get<PrescriptionRiskReport | null>(`/drug-interactions/target/${targetId}`)
}

export function listRules(params?: Record<string, any>) {
  return get<{ items: DrugInteractionRule[]; total: number; page: number; pageSize: number }>(
    '/drug-interactions/rules',
    params,
  )
}

export function createRule(data: Partial<DrugInteractionRule>) {
  return post<DrugInteractionRule>('/drug-interactions/rules', data)
}

export function updateRule(id: number | string, data: Partial<DrugInteractionRule>) {
  return put<DrugInteractionRule>(`/drug-interactions/rules/${id}`, data)
}

export function deleteRule(id: number | string) {
  return del(`/drug-interactions/rules/${id}`)
}
