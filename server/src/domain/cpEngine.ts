// Control Plan skill: map PFMEA rows + PFD steps to CP rows, draft reaction plans,
// and run the two-way PFMEA<->control consistency check.
import { db } from '../db.ts'
import { orderedOperations } from './pfdEngine.ts'
import type { ControlPlanRow, FmeaRow } from '../types.ts'

export function draftFromPfmea(projectId: string): ControlPlanRow[] {
  const ops = orderedOperations(projectId)
  if (!ops.length) throw Object.assign(new Error('No PFD operations - run the PFD skill first'), { status: 409 })
  const fmea = db.where<FmeaRow>('fmeaRows', r => r.projectId === projectId)
  const created: ControlPlanRow[] = []
  for (const op of ops) {
    const rows = fmea.filter(r => r.operationId === op.id)
    const worst = rows.sort((a, b) => b.rpn - a.rpn)[0]
    created.push(db.insert('cpRows', {
      id: db.newId(),
      projectId,
      operationId: op.id,
      fmeaRowId: worst?.id,
      opNo: op.opNo,
      processName: op.description,
      machine: op.machine ?? '',
      productCharacteristic: worst?.requirement ?? 'Per drawing',
      processCharacteristic: worst ? `${worst.failureMode} prevention` : '',
      specialClass: worst?.classification,
      specification: worst?.requirement ?? 'Per drawing / WI',
      measurementTechnique: worst?.detectionControl ?? 'Visual',
      sampleSize: worst && worst.severity >= 8 ? '5 pcs' : '1 pc',
      frequency: worst && worst.ap === 'H' ? 'Every hour' : 'Every shift',
      controlMethod: worst?.detectionControl ?? 'Visual inspection',
      reactionPlan: worst?.ap === 'H'
        ? 'Stop line, contain suspect stock since last good check, escalate to QE'
        : 'Contain, identify and segregate; inform shift supervisor',
    } as ControlPlanRow))
  }
  return created
}

export interface ConsistencyIssue { kind: 'pfmea-without-control' | 'control-without-pfmea' | 'weak-control'; detail: string }

export function consistencyCheck(projectId: string): ConsistencyIssue[] {
  const fmea = db.where<FmeaRow>('fmeaRows', r => r.projectId === projectId)
  const cps = db.where<ControlPlanRow>('cpRows', r => r.projectId === projectId)
  const issues: ConsistencyIssue[] = []
  for (const f of fmea) {
    const cp = cps.find(c => c.operationId === f.operationId)
    if (!cp) {
      issues.push({ kind: 'pfmea-without-control', detail: `${f.processStep}: PFMEA row "${f.failureMode}" has no Control Plan row.` })
    } else if (f.ap === 'H' && !/stop|contain|100%|spc/i.test(cp.controlMethod + ' ' + cp.reactionPlan)) {
      issues.push({ kind: 'weak-control', detail: `${f.processStep}: H-AP risk "${f.failureMode}" controlled only by "${cp.controlMethod}" - strengthen the control.` })
    }
  }
  for (const c of cps) {
    if (!fmea.some(f => f.operationId === c.operationId)) {
      issues.push({ kind: 'control-without-pfmea', detail: `${c.opNo} ${c.processName}: Control Plan row has no PFMEA coverage.` })
    }
  }
  return issues
}
