import { del, get, patch, post } from './request'

export type AgentConfigStatus = 'draft' | 'published' | 'archived'

export interface AgentConfig {
  id?: number
  tenantId?: number
  name: string
  model: string
  systemPrompt: string | null
  memoryRounds: number
  temperature: number | null
  knowledgeBase: string | null
  tools: Record<string, unknown> | null
  version: number
  status: AgentConfigStatus
  publishedAt?: string | null
  remark?: string | null
  createdBy?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface AgentConfigResult {
  working: AgentConfig
  published: AgentConfig | null
  hasDraft: boolean
}

export type CrisisSeverity = 'low' | 'medium' | 'high'
export type CrisisAction = 'notify_family' | 'create_alert' | 'escalate'

export interface CrisisWord {
  id: number
  tenantId: number
  word: string
  category: string | null
  severity: CrisisSeverity
  action: CrisisAction
  enabled: boolean
  remark: string | null
  createdAt: string
}

export interface SaveAgentConfigPayload {
  name?: string
  model?: string
  systemPrompt?: string
  memoryRounds?: number
  temperature?: number
  knowledgeBase?: string
  tools?: Record<string, unknown>
  remark?: string
}

export function getAgentConfig() {
  return get<AgentConfigResult>('/ai-config/agent')
}

export function getAgentVersions() {
  return get<AgentConfig[]>('/ai-config/agent/versions')
}

export function saveAgentDraft(payload: SaveAgentConfigPayload) {
  return post<AgentConfig>('/ai-config/agent', payload)
}

export function publishAgent(id: number) {
  return post<AgentConfig>(`/ai-config/agent/${id}/publish`)
}

export function listCrisisWords(params?: { keyword?: string; severity?: CrisisSeverity }) {
  return get<CrisisWord[]>('/ai-config/crisis-words', params)
}

export function createCrisisWord(payload: {
  word: string
  category?: string
  severity?: CrisisSeverity
  action?: CrisisAction
  enabled?: boolean
  remark?: string
}) {
  return post<CrisisWord>('/ai-config/crisis-words', payload)
}

export function updateCrisisWord(
  id: number,
  payload: Partial<{
    word: string
    category: string
    severity: CrisisSeverity
    action: CrisisAction
    enabled: boolean
    remark: string
  }>,
) {
  return patch<CrisisWord>(`/ai-config/crisis-words/${id}`, payload)
}

export function toggleCrisisWord(id: number) {
  return patch<CrisisWord>(`/ai-config/crisis-words/${id}/toggle`)
}

export function removeCrisisWord(id: number) {
  return del<{ success: boolean }>(`/ai-config/crisis-words/${id}`)
}
