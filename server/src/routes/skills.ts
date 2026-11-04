// Routes for the generation skills: PFD, PFMEA, Control Plan, 8D.
import { Router } from 'express'
import { db } from '../db.ts'
import { audit } from '../audit.ts'
import { addOperation, orderedOperations } from '../domain/pfdEngine.ts'
import { draftFromPfd, updateRatings, highPriorityActions, pfmeaWarnings } from '../domain/fmeaEngine.ts'
import { iatf16949Check } from '../domain/iatfCheck.ts'
import { draftFromPfmea, consistencyCheck } from '../domain/cpEngine.ts'
import { createEightD, setRootCause, updateEightD } from '../domain/eightDEngine.ts'
import { enrichWithLlm } from '../llm/provider.ts'
import { actor } from './projects.ts'
import type { ControlPlanRow, EightD, FmeaRow } from '../types.ts'

export const pfd = Router()
pfd.post('/:projectId/operations', (req, res) => {
  if (!req.body?.description) return res.status(400).json({ error: 'description required' })
  const op = addOperation(req.params.projectId, req.body.description, req.body)
  audit(req.params.projectId, actor(req), 'pfd.operation-added', `${op.opNo} ${op.description} [${op.classification}]`)
  res.status(201).json(op)
})
pfd.get('/:projectId/operations', (req, res) => res.json(orderedOperations(req.params.projectId)))

export const pfmea = Router()
pfmea.post('/:projectId/draft', async (req, res, next) => {
  try {
    const rows = draftFromPfd(req.params.projectId, actor(req))
    // IATF 16949 check runs BEFORE the AIAG-VDA rating review (agreed skills doc).
    const iatf = iatf16949Check(rows)
    const llmNote = await enrichWithLlm(
      { system: 'You are a manufacturing quality engineer assistant. One short paragraph only.',
        prompt: `Summarise the top drafting risks for a PFMEA with ${rows.length} rows, ${rows.filter(r => r.ap === 'H').length} H-AP items.` },
      req.headers['x-llm-api-key'] as string | undefined, req.headers['x-llm-model'] as string | undefined)
    audit(req.params.projectId, actor(req), 'pfmea.drafted', `${rows.length} rows drafted from PFD`)
    res.status(201).json({ rows, iatfFindings: iatf, warnings: pfmeaWarnings(req.params.projectId), llmNote })
  } catch (e) { next(e) }
})
pfmea.get('/:projectId/rows', (req, res) => res.json(db.where<FmeaRow>('fmeaRows', r => r.projectId === req.params.projectId)))
pfmea.patch('/rows/:rowId', (req, res, next) => {
  try {
    const row = updateRatings(req.params.rowId, req.body)
    audit(row.projectId, actor(req), 'pfmea.rated', `S=${row.severity} O=${row.occurrence} D=${row.detection} -> RPN ${row.rpn}, AP ${row.ap}`)
    res.json({ row, warnings: pfmeaWarnings(row.projectId) })
  } catch (e) { next(e) }
})
pfmea.get('/:projectId/actions', (req, res) => res.json(highPriorityActions(req.params.projectId)))
pfmea.get('/:projectId/iatf-check', (req, res) => {
  res.json(iatf16949Check(db.where<FmeaRow>('fmeaRows', r => r.projectId === req.params.projectId)))
})

export const cp = Router()
cp.post('/:projectId/draft', (req, res, next) => {
  try {
    const rows = draftFromPfmea(req.params.projectId)
    audit(req.params.projectId, actor(req), 'cp.drafted', `${rows.length} Control Plan rows from PFMEA/PFD`)
    res.status(201).json({ rows, consistency: consistencyCheck(req.params.projectId) })
  } catch (e) { next(e) }
})
cp.get('/:projectId/rows', (req, res) => res.json(db.where<ControlPlanRow>('cpRows', r => r.projectId === req.params.projectId)))
cp.patch('/rows/:rowId', (req, res, next) => {
  try {
    const row = db.get<ControlPlanRow>('cpRows', req.params.rowId)
    if (!row) return res.status(404).json({ error: 'row not found' })
    res.json(db.update<ControlPlanRow>('cpRows', row.id, req.body))
  } catch (e) { next(e) }
})
cp.get('/:projectId/consistency', (req, res) => res.json(consistencyCheck(req.params.projectId)))

export const eightD = Router()
eightD.post('/:projectId', (req, res, next) => {
  try {
    const { complaintRef, d2, team } = req.body ?? {}
    if (!complaintRef || !d2) return res.status(400).json({ error: 'complaintRef and d2 required' })
    const ed = createEightD(req.params.projectId, complaintRef, d2, team ?? [])
    audit(req.params.projectId, actor(req), '8d.opened', complaintRef)
    res.status(201).json(ed)
  } catch (e) { next(e) }
})
eightD.patch('/:eightDId', (req, res, next) => {
  try { res.json(updateEightD(req.params.eightDId, req.body)) } catch (e) { next(e) }
})
eightD.post('/:eightDId/root-cause', (req, res, next) => {
  try {
    const ed = setRootCause(req.params.eightDId, req.body?.whys ?? [], req.body?.rootCause ?? '')
    audit(ed.projectId, actor(req), '8d.root-cause', ed.d4RootCause.rootCause)
    res.json(ed)
  } catch (e) { next(e) }
})
eightD.get('/:projectId/list', (req, res) => res.json(db.where<EightD>('eightDs', e => e.projectId === req.params.projectId)))
