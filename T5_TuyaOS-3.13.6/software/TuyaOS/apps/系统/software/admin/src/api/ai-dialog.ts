import { get, patch, post } from './request'

export interface AiDialogSession {
  id: number
  tenantId: number
  deviceId: number | null
  userId: number | null
  serviceTargetId: number | null
  agentId: string | null
  startedAt: string
  endedAt: string | null
  totalTurns: number
  totalTokens: number
  summary: string | null
  crisisScore: number
  crisisWords: string[] | null
  mcpToolCallsCount: number
  qaStatus: 'pending' | 'sampled' | 'reviewed' | 'flagged'
  createdAt: string
}

export interface AiDialogLog {
  id: number
  tenantId: number
  sessionId: number
  deviceId: number | null
  userId: number | null
  serviceTargetId: number | null
  direction: 'user' | 'assistant' | 'system' | 'tool'
  text: string
  audioUrl: string | null
  emotion: string | null
  crisisWords: string[] | null
  toolCalls: unknown[] | null
  tokenCount: number | null
  latencyMs: number | null
  intent: string | null
  modelName: string | null
  createdAt: string
}

export function listSessions(params?: {
  page?: number
  pageSize?: number
  serviceTargetId?: number
  deviceId?: number
  from?: string
  to?: string
  qaStatus?: string
  hasCrisis?: string
}) {
  return get<{ items: AiDialogSession[]; total: number; page: number; pageSize: number }>(
    '/ai-dialogs',
    params,
  )
}

export function getSession(id: number) {
  return get<{ session: AiDialogSession; logs: AiDialogLog[] }>(
    `/ai-dialogs/sessions/${id}`,
  )
}

export function finishSession(id: number, summary?: string) {
  return post<AiDialogSession>(`/ai-dialogs/sessions/${id}/finish`, { summary })
}

export function markQaStatus(
  id: number,
  status: 'sampled' | 'reviewed' | 'flagged',
) {
  return patch<AiDialogSession>(`/ai-dialogs/sessions/${id}/qa-status`, { status })
}
