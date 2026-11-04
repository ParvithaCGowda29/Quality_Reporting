import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export const config = {
  port: Number(process.env.PORT ?? 8787),
  // Runtime state (JSON store + uploads + generated exports). Gitignored.
  dataDir: process.env.QR_DATA_DIR ?? path.resolve(here, '..', 'data'),
  // Branding assets bundled with the repo (from the quality-workflow Drive, read-only source).
  assetsDir: path.resolve(here, '..', 'assets'),
  // LLM enrichment is OPTIONAL. The API token is never configured or stored here:
  // it lives in the UI repo (src/config/app.config.ts) and the frontend passes it
  // per request as the x-llm-api-key header. Deterministic generation is the default.
  llmEndpoint: process.env.LLM_ENDPOINT ?? 'https://api.openai.com/v1/chat/completions',
  defaultModel: process.env.LLM_MODEL ?? 'gpt-4o-mini',
}
