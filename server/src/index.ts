import express from 'express'
import { initDb } from './db.ts'
import { config } from './config.ts'
import { projects } from './routes/projects.ts'
import { intake } from './routes/intake.ts'
import { pfd, pfmea, cp, eightD } from './routes/skills.ts'
import { approvals, output } from './routes/approvalOutput.ts'

initDb()

const app = express()
app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'bullm-quality-reporting', time: new Date().toISOString() }))

app.use('/api/projects', projects)
app.use('/api/intake', intake)
app.use('/api/pfd', pfd)
app.use('/api/pfmea', pfmea)
app.use('/api/control-plan', cp)
app.use('/api/8d', eightD)
app.use('/api/approvals', approvals)
app.use('/api/output', output)

app.use((err: any, _req: any, res: any, _next: any) => {
  res.status(err.status ?? 500).json({ error: err.message ?? 'internal error' })
})

app.listen(config.port, () => {
  console.log(`BuLLM Quality Reporting backend on http://localhost:${config.port}`)
})
