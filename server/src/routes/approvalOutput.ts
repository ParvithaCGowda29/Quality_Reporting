// Human Approval + Output & Audit skills.
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { db } from '../db.ts'
import { audit } from '../audit.ts'
import { config } from '../config.ts'
import { orderedOperations } from '../domain/pfdEngine.ts'
import { exportPfdXlsx, exportPfmeaXlsx, exportCpXlsx } from '../export/xlsx.ts'
import { export8dDocx } from '../export/docx.ts'
import { actor } from './projects.ts'
import type { ApprovalTask, ControlPlanRow, EightD, FmeaRow, Project, Revision } from '../types.ts'

export const approvals = Router()

approvals.post('/:projectId/submit', (req, res) => {
  const { artifactKind, assignedTo } = req.body ?? {}
  if (!artifactKind || !assignedTo) return res.status(400).json({ error: 'artifactKind and assignedTo required' })
  const revs = db.where<Revision>('revisions', r => r.projectId === req.params.projectId && r.kind === artifactKind)
  const task: ApprovalTask = {
    id: db.newId(),
    projectId: req.params.projectId,
    artifactKind,
    artifactRevision: revs.length + 1,
    assignedTo,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  db.insert('approvals', task)
  audit(task.projectId, actor(req), 'approval.submitted', `${artifactKind} rev ${task.artifactRevision} -> ${assignedTo}`)
  res.status(201).json(task)
})

approvals.get('/:projectId/tasks', (req, res) => {
  res.json(db.where<ApprovalTask>('approvals', a => a.projectId === req.params.projectId))
})

approvals.post('/tasks/:taskId/decide', (req, res) => {
  const t = db.get<ApprovalTask>('approvals', req.params.taskId)
  if (!t) return res.status(404).json({ error: 'approval task not found' })
  const { decision, comments } = req.body ?? {}
  if (!['approved', 'returned', 'rejected'].includes(decision)) return res.status(400).json({ error: 'decision must be approved | returned | rejected' })
  const updated = db.update<ApprovalTask>('approvals', t.id, { status: decision, comments, decidedBy: actor(req), decidedAt: new Date().toISOString() })
  audit(t.projectId, actor(req), `approval.${decision}`, `${t.artifactKind} rev ${t.artifactRevision}${comments ? `: ${comments}` : ''}`)
  res.json(updated)
})

export const output = Router()

// Release-gated export: only approved drafts export; stamps revision, writes audit.
output.post('/:projectId/export/:kind', async (req, res, next) => {
  try {
    const projectId = req.params.projectId
    const kind = req.params.kind as Revision['kind']
    if (!['pfd', 'pfmea', 'control-plan', '8d'].includes(kind)) return res.status(400).json({ error: 'kind must be pfd | pfmea | control-plan | 8d' })
    const project = db.get<Project>('projects', projectId)
    if (!project) return res.status(404).json({ error: 'project not found' })
    const approved = db.where<ApprovalTask>('approvals', a => a.projectId === projectId && a.artifactKind === kind && a.status === 'approved')
      .sort((a, b) => b.artifactRevision - a.artifactRevision)[0]
    if (!approved) return res.status(409).json({ error: `No approved ${kind} draft - route through Human Approval first. Only approved drafts are released.` })

    const revNo = approved.artifactRevision
    const outDir = path.join(config.dataDir, 'exports', projectId)
    fs.mkdirSync(outDir, { recursive: true })
    const base = `${kind}-${project.partNumber}-rev${String(revNo).padStart(2, '0')}`
    let filePath = ''
    if (kind === 'pfd') { filePath = path.join(outDir, `${base}.xlsx`); await exportPfdXlsx(project, orderedOperations(projectId), revNo, filePath) }
    if (kind === 'pfmea') { filePath = path.join(outDir, `${base}.xlsx`); await exportPfmeaXlsx(project, db.where<FmeaRow>('fmeaRows', r => r.projectId === projectId), revNo, filePath) }
    if (kind === 'control-plan') { filePath = path.join(outDir, `${base}.xlsx`); await exportCpXlsx(project, db.where<ControlPlanRow>('cpRows', r => r.projectId === projectId), revNo, filePath) }
    if (kind === '8d') {
      const ed = db.where<EightD>('eightDs', e => e.projectId === projectId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
      if (!ed) return res.status(409).json({ error: 'No 8D exists for this project' })
      filePath = path.join(outDir, `${base}.docx`); await export8dDocx(project, ed, revNo, filePath)
    }
    const rev: Revision = { id: db.newId(), projectId, kind, revNo, revDate: new Date().toISOString(), releasedBy: actor(req), filePath }
    db.insert('revisions', rev)
    audit(projectId, actor(req), 'output.released', `${kind} rev ${revNo} exported`)
    res.status(201).json({ revision: rev, download: `/api/output/${projectId}/download/${rev.id}` })
  } catch (e) { next(e) }
})

output.get('/:projectId/download/:revId', (req, res) => {
  const rev = db.get<Revision>('revisions', req.params.revId)
  if (!rev || rev.projectId !== req.params.projectId || !rev.filePath) return res.status(404).json({ error: 'revision not found' })
  res.download(rev.filePath)
})

output.get('/:projectId/audit', (req, res) => {
  res.json(db.where('audits', (a: any) => a.projectId === req.params.projectId).sort((a: any, b: any) => a.at.localeCompare(b.at)))
})

output.get('/:projectId/alerts', (req, res) => {
  const pid = req.params.projectId
  res.json({
    pendingApprovals: db.where<ApprovalTask>('approvals', a => a.projectId === pid && a.status === 'pending'),
    missingChecklistItems: (db.get<Project>('projects', pid) ? undefined : []) ?? undefined,
  })
})
