// Missing-Data Check (intake skill): the 19-item required-documents checklist agreed for
// the Innotech pilot (reference workbook in the quality-workflow Drive).
//
// How an item becomes "present":
//  - document items: an uploaded IntakeDocument whose `kind` matches (see KIND_BY_KEY).
//    Upload each document with the matching kind. Specific template kinds
//    (pfd-template, pfmea-template, cp-template, 8d-template) tick one template item;
//    the generic kind `template` ticks all four (legacy behaviour).
//  - process-data: automatically satisfied once at least one PFD operation exists for
//    the project (e.g. captured by uploading the part's PFD Excel).
//  - spoc / core-team: read from the project fields processOwner / coreTeam.
//  - non-document confirmations (qe-review, scope-approval, sharepoint-route,
//    approval-decision, change-approval): recorded explicitly via
//    POST /api/intake/:pid/checklist/confirm { key, confirmed } - they are decisions
//    and access grants, not files.
import { db } from '../db.ts'
import type { ChecklistItem, IntakeDocument, PfdOperation, Project } from '../types.ts'

const KIND_BY_KEY: Record<string, string[]> = {
  'pfd-template': ['template', 'pfd-template'],
  'pfmea-template': ['template', 'pfmea-template'],
  'cp-template': ['template', 'cp-template'],
  '8d-template': ['template', '8d-template'],
  'sample-pfd': ['pfd'],
  'sample-pfmea': ['pfmea'],
  'sample-cp': ['control-plan'],
  'sample-8d': ['8d'],
  'standards': ['standard'],
  'complaints': ['complaint'],
}

// Items confirmed manually (not documents).
export const CONFIRMABLE_KEYS = ['qe-review', 'scope-approval', 'sharepoint-route', 'approval-decision', 'change-approval']

export const CHECKLIST_DEF: { key: string; label: string; group: ChecklistItem['group'] }[] = [
  { key: 'pfd-template', label: 'PFD template (Innotech format)', group: 'templates' },
  { key: 'pfmea-template', label: 'PFMEA template', group: 'templates' },
  { key: 'cp-template', label: 'Control Plan template', group: 'templates' },
  { key: '8d-template', label: '8D report template', group: 'templates' },
  { key: 'sample-pfd', label: 'Sample PFD (existing part)', group: 'samples' },
  { key: 'sample-pfmea', label: 'Sample PFMEA (existing part)', group: 'samples' },
  { key: 'sample-cp', label: 'Sample Control Plan (existing part)', group: 'samples' },
  { key: 'sample-8d', label: 'Sample 8D report', group: 'samples' },
  { key: 'standards', label: 'Licensed standards (AIAG-VDA handbook, IATF 16949)', group: 'standards' },
  { key: 'drawings', label: 'Part drawings with special characteristics', group: 'process-data' },
  { key: 'process-data', label: 'Process data / operation list for pilot part', group: 'process-data' },
  { key: 'complaints', label: 'Customer complaint history', group: 'process-data' },
  { key: 'spoc', label: 'Innotech quality-team SPOC nominated', group: 'people' },
  { key: 'core-team', label: 'Cross-functional team (S/O/D ratings)', group: 'people' },
  { key: 'qe-review', label: 'QE review of every draft agreed', group: 'people' },
  { key: 'scope-approval', label: 'Scope approval by Innotech', group: 'process' },
  { key: 'sharepoint-route', label: 'SharePoint intake route / access', group: 'process' },
  { key: 'approval-decision', label: 'Approval decision process agreed', group: 'process' },
  { key: 'change-approval', label: 'Change approval process (post-8D updates) agreed', group: 'process' },
]

export function evaluateChecklist(projectId: string): ChecklistItem[] {
  const docs = db.where<IntakeDocument>('documents', d => d.projectId === projectId)
  const project = db.get<Project>('projects', projectId)
  const confirmations = project?.confirmations ?? []
  const opCount = db.where<PfdOperation>('operations', o => o.projectId === projectId).length
  return CHECKLIST_DEF.map(def => {
    let satisfied = false
    let evidence: string | undefined
    const kinds = KIND_BY_KEY[def.key]
    if (kinds) {
      const hit = docs.find(d => kinds.includes(d.kind))
      if (hit) { satisfied = true; evidence = `${def.label}: ${hit.filename}` }
    }
    if (def.key === 'process-data' && opCount > 0) {
      satisfied = true; evidence = `${opCount} operations captured`
    } else if (def.key === 'spoc' && project?.processOwner) {
      satisfied = true; evidence = `SPOC: ${project.processOwner}`
    } else if (def.key === 'core-team' && project?.coreTeam?.length) {
      satisfied = true; evidence = `Core team: ${project.coreTeam.join(', ')}`
    } else if (def.key === 'drawings' && docs.some(d => d.kind === 'other' || d.kind === 'drawing')) {
      const hit = docs.find(d => d.kind === 'other' || d.kind === 'drawing')
      satisfied = true; evidence = `Uploaded: ${hit?.filename}`
    }
    if (!satisfied && CONFIRMABLE_KEYS.includes(def.key) && confirmations.includes(def.key)) {
      satisfied = true; evidence = 'Confirmed by the quality manager'
    }
    return { ...def, satisfied, evidence }
  })
}

export function setConfirmation(projectId: string, key: string, confirmed: boolean): ChecklistItem[] {
  if (!CONFIRMABLE_KEYS.includes(key)) {
    throw Object.assign(new Error(`key must be one of: ${CONFIRMABLE_KEYS.join(', ')}`), { status: 400 })
  }
  const project = db.get<Project>('projects', projectId)
  if (!project) throw Object.assign(new Error('project not found'), { status: 404 })
  const set = new Set(project.confirmations ?? [])
  confirmed ? set.add(key) : set.delete(key)
  db.update<Project>('projects', projectId, { confirmations: [...set], updatedAt: new Date().toISOString() })
  return evaluateChecklist(projectId)
}
