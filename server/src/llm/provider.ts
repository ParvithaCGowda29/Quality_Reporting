// Optional LLM enrichment. The API token is NEVER stored or configured server-side:
// the UI repo owns it (src/config/app.config.ts) and the frontend sends it per request
// as x-llm-api-key. Without a key the backend runs fully deterministic.
import { config } from '../config.ts'

export interface LlmRequest {
  system: string
  prompt: string
}

export async function enrichWithLlm(req: LlmRequest, apiKey?: string, model?: string): Promise<string | null> {
  if (!apiKey) return null // deterministic path; not an error
  try {
    const res = await fetch(config.llmEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: model ?? config.defaultModel,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.prompt },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return null
    const data: any = await res.json()
    return data?.choices?.[0]?.message?.content ?? null
  } catch {
    return null
  }
}
