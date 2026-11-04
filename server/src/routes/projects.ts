import { Router } from 'express'
import { db } from '../db.ts'
import { audit } from '../audit.ts'
import { evaluateChecklist } from '../domain/checklist.ts'
import type { Project } from '../types.ts'

export const projects = Router()

projects.post('/', (req, res) => {
  const b = req.body ?? {}
  if (!b.partNumber || !b.partDescription) return res.status(400).json({ error: 'partNumber and partDescription are required' })
  const now = new Date().toISOString()
  const p: Project = {
    id: db.newId(),
    partNumber: b.partNumber,
    partRevision: b.partRevision ?? 'A',
    partDescription: b.partDescription,
    customer: b.customer ?? 'INDIC EMS ELECTRONICS PVT LTD',
    customerRequirements: b.customerRequirements ?? [],
    applicableStandards: b.applicableStandards ?? ['IATF 16949', 'AIAG-VDA FMEA 2019'],
    processOwner: b.processOwner ?? '',
    coreTeam: b.coreTeam ?? [],
    status: 'intake',
    createdAt: now,
    updatedAt: now,
  }
  db.insert('projects', p)
  audit(p.id, actor(req), 'project.created', `Project for ${p.partNumber} created`)
  res.status(201).json(p)
})

projects.get('/', (_req, res) => res.json(db.all<Project>('projects')))
projects.get('/:id', (req, res) => {
  const p = db.get<Project>('projects', req.params.id)
  if (!p) return res.status(404).json({ error: 'project not found' })
  res.json({ ...p, checklist: evaluateChecklist(p.id) })
})

projects.patch('/:id', (req, res) => {
  const p = db.get<Project>('projects', req.params.id)
  if (!p) return res.status(404).json({ error: 'project not found' })
  const updated = db.update<Project>('projects', p.id, { ...req.body, updatedAt: new Date().toISOString() })
  audit(p.id, actor(req), 'project.updated', Object.keys(req.body ?? {}).join(', '))
  res.json(updated)
})

export function actor(req: any): string {
  return String(req.headers['x-qe-name'] ?? 'bullm-agent')
}
