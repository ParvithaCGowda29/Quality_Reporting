// AIAG-VDA 2019 Action Priority, banded-rule restatement adapted from
// RBraga01/Quality-Engineering-Skills (MIT): skills/risk-analysis/pfmea-process/assets/ap-table.md
// That file is an independent restatement, not the licensed handbook table; the runtime
// flags every rating so a QE confirms disputed/PPAP cases against the licensed handbook.

export type AP = 'H' | 'M' | 'L'

const inBand = (v: number, lo: number, hi: number) => v >= lo && v <= hi

export function actionPriority(s: number, o: number, d: number): AP {
  if (![s, o, d].every(v => Number.isInteger(v) && v >= 1 && v <= 10)) {
    throw Object.assign(new Error('S, O and D must be integers 1-10'), { status: 400 })
  }
  // Absolute rules
  if (s >= 9) return 'H'
  if (s === 8) {
    if (inBand(o, 6, 10)) return 'H'
    if (inBand(o, 4, 5)) return d >= 6 ? 'H' : 'M'
    return 'M' // O 1-3
  }
  if (s === 7) {
    if (inBand(o, 6, 10)) return d >= 7 ? 'H' : 'M'
    if (inBand(o, 4, 5)) return d >= 4 ? 'M' : 'L'
    return 'L'
  }
  if (s === 6) {
    if (inBand(o, 8, 10)) return d >= 7 ? 'H' : 'M'
    if (inBand(o, 5, 7)) return d >= 7 ? 'M' : 'L'
    return 'L'
  }
  return 'L' // S 1-5
}

export const AP_ACTION_REQUIREMENT: Record<AP, string> = {
  H: 'Mandatory: assign a responsible person and target date; if no action is possible, document why and escalate to management for risk acceptance.',
  M: 'Team must evaluate and document the decision (action taken or rationale for no action).',
  L: 'No action required; document rationale.',
}

export function apComplianceWarnings(row: { severity: number; occurrence: number; detection: number; ap: AP; classification?: string; actionOwner?: string; actionTargetDate?: string }): string[] {
  const w: string[] = []
  if (row.ap !== actionPriority(row.severity, row.occurrence, row.detection)) {
    w.push('Stored AP does not match the banded AP rules for its S/O/D - recompute.')
  }
  if (row.classification && row.severity < 9) {
    w.push('Special characteristic rated below S=9 - AIAG-VDA expects SC at S=9 or 10.')
  }
  if (row.ap === 'H' && (!row.actionOwner || !row.actionTargetDate)) {
    w.push('H-AP item needs an action owner and target date (or documented escalation rationale).')
  }
  return w
}
