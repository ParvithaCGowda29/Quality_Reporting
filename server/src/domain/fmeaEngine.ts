// PFMEA Generation skill: structure from PFD, draft failure analysis from the pattern
// library, compute legacy RPN (Innotech's current sheet format) AND AIAG-VDA AP.
import { db } from '../db.ts'
import { actionPriority, apComplianceWarnings } from './apTable.ts'
import { FAILURE_PATTERNS, GENERIC_PATTERN } from './failureLibrary.ts'
import { orderedOperations } from './pfdEngine.ts'
import type { FmeaRow } from '../types.ts'

export function computeRisk(row: Pick<FmeaRow, 'severity' | 'occurrence' | 'detection'>) {
  return { rpn: row.severity * row.occurrence * row.detection, ap: actionPriority(row.severity, row.occurrence, row.detection) }
}

// One row group per PFD operation (Structure analysis), then failure analysis rows.
export function draftFromPfd(projectId: string, actor: string): FmeaRow[] {
  const ops = orderedOperations(projectId)
  if (!ops.length) throw Object.assign(new Error('No PFD operations - run the PFD skill first'), { status: 409 })
  const created: FmeaRow[] = []
  for (const op of ops) {
    const patterns = FAILURE_PATTERNS.filter(p => p.match.test(op.description))
    const use = patterns.length ? patterns : [GENERIC_PATTERN]
    for (const p of use) {
      const base = {
        severity: p.severity, occurrence: p.occurrence, detection: p.detection,
      }
      created.push(db.insert('fmeaRows', {
        id: db.newId(),
        projectId,
        operationId: op.id,
        processStep: `${op.opNo} ${op.description}`,
        requirement: p.requirement,
        failureMode: p.failureMode,
        effect: p.effect,
        classification: p.severity >= 9 ? 'SC' : undefined,
        cause: p.cause,
        preventionControl: p.preventionControl,
        detectionControl: p.detectionControl,
        ...base,
        ...computeRisk(base),
      } as FmeaRow))
    }
  }
  return created
}

export function updateRatings(rowId: string, patch: Partial<FmeaRow>): FmeaRow {
  const row = db.get<FmeaRow>('fmeaRows', rowId)
  if (!row) throw Object.assign(new Error('PFMEA row not found'), { status: 404 })
  const merged = { ...row, ...patch }
  const { rpn, ap } = computeRisk(merged)
  let revisedAp = merged.revisedAp
  if (merged.revisedSeverity && merged.revisedOccurrence && merged.revisedDetection) {
    // Revised AP only after action is implemented (actionTaken present) - governance rule.
    revisedAp = merged.actionTaken ? actionPriority(merged.revisedSeverity, merged.revisedOccurrence, merged.revisedDetection) : undefined
  }
  return db.update<FmeaRow>('fmeaRows', rowId, { ...patch, rpn, ap, revisedAp })
}

export function highPriorityActions(projectId: string): FmeaRow[] {
  return db.where<FmeaRow>('fmeaRows', r => r.projectId === projectId && r.ap === 'H')
}

export function pfmeaWarnings(projectId: string): string[] {
  return db.where<FmeaRow>('fmeaRows', r => r.projectId === projectId).flatMap(apComplianceWarnings)
}
