// Frontend-owned configuration. Per the project decision, the LLM API token lives
// HERE in the UI repo (matching the UI), not in the backend. The backend never stores
// it - it is sent per request as the x-llm-api-key header and used only for optional
// enrichment; generation is fully deterministic without it.

export const appConfig = {
  // Backend base URL. Dev: Vite proxies /api -> http://localhost:8787 (see vite.config.ts).
  apiBaseUrl: '/api',
  // Optional LLM key for enrichment drafts. Leave empty to run deterministic-only.
  // Fill at runtime (e.g. import.meta.env.VITE_LLM_API_KEY) - do NOT commit a real key.
  llmApiKey: import.meta.env?.VITE_LLM_API_KEY ?? '',
  llmModel: import.meta.env?.VITE_LLM_MODEL ?? '',
  // Shown in the assistant when a run needs QE identity (recorded in approvals/audit).
  qualityEngineer: '',
}
