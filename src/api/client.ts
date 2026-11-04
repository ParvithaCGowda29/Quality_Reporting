// Typed client for the Quality Reporting backend (server/). Every function maps to one
// REST endpoint; headers carry the UI-owned LLM token and the acting QE's name.
import { appConfig } from '../config/app.config'

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as any) }
  if (!(init.body instanceof FormData)) headers['content-type'] = 'application/json'
  if (appConfig.llmApiKey) headers['x-llm-api-key'] = appConfig.llmApiKey
  if (appConfig.llmModel) headers['x-llm-model'] = appConfig.llmModel
  if (appConfig.qualityEngineer) headers['x-qe-name'] = appConfig.qualityEngineer
  const res = await fetch(`${appConfig.apiBaseUrl}${path}`, { ...init, headers })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`)
  return res.json()
}

export const api = {
  health: () => call<{ ok: boolean }>('/health'),
  // intake
  createProject: (body: unknown) => call<any>('/projects', { method: 'POST', body: JSON.stringify(body) }),
  getProject: (id: string) => call<any>(`/projects/${id}`),
  uploadDocument: (projectId: string, file: File, kind: string) => {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    return call<any>(`/intake/${projectId}/documents`, { method: 'POST', body: fd })
  },
  checklist: (projectId: string) => call<any>(`/intake/${projectId}/checklist`),
  // pfd
  addOperation: (projectId: string, body: unknown) => call<any>(`/pfd/${projectId}/operations`, { method: 'POST', body: JSON.stringify(body) }),
  operations: (projectId: string) => call<any[]>(`/pfd/${projectId}/operations`),
  // pfmea
  draftPfmea: (projectId: string) => call<any>(`/pfmea/${projectId}/draft`, { method: 'POST' }),
  pfmeaRows: (projectId: string) => call<any[]>(`/pfmea/${projectId}/rows`),
  ratePfmeaRow: (rowId: string, body: unknown) => call<any>(`/pfmea/rows/${rowId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  iatfCheck: (projectId: string) => call<any[]>(`/pfmea/${projectId}/iatf-check`),
  // control plan
  draftControlPlan: (projectId: string) => call<any>(`/control-plan/${projectId}/draft`, { method: 'POST' }),
  consistency: (projectId: string) => call<any[]>(`/control-plan/${projectId}/consistency`),
  // 8d
  open8d: (projectId: string, body: unknown) => call<any>(`/8d/${projectId}`, { method: 'POST', body: JSON.stringify(body) }),
  setRootCause: (eightDId: string, body: unknown) => call<any>(`/8d/${eightDId}/root-cause`, { method: 'POST', body: JSON.stringify(body) }),
  // approval + output
  submitForApproval: (projectId: string, artifactKind: string, assignedTo: string) =>
    call<any>(`/approvals/${projectId}/submit`, { method: 'POST', body: JSON.stringify({ artifactKind, assignedTo }) }),
  decide: (taskId: string, decision: 'approved' | 'returned' | 'rejected', comments?: string) =>
    call<any>(`/approvals/tasks/${taskId}/decide`, { method: 'POST', body: JSON.stringify({ decision, comments }) }),
  exportDoc: (projectId: string, kind: 'pfd' | 'pfmea' | 'control-plan' | '8d') =>
    call<any>(`/output/${projectId}/export/${kind}`, { method: 'POST' }),
  auditTrail: (projectId: string) => call<any[]>(`/output/${projectId}/audit`),
}
