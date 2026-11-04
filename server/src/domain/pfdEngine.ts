// PFD Generation skill: order operations, classify, produce the draft PFD record set.
import { db } from '../db.ts'
import type { OpClass, PfdOperation } from '../types.ts'

const CLASS_RULES: [RegExp, OpClass][] = [
  [/inspect|check|iqc|test|verif|audit|measure/i, 'inspection'],
  [/receipt|store|storage|warehouse|receive/i, 'storage'],
  [/transit|move|transport|transfer|kitting deliver/i, 'transit'],
  [/wait|delay|hold|queue/i, 'delay'],
]

export function classifyOperation(description: string): OpClass {
  for (const [re, cls] of CLASS_RULES) if (re.test(description)) return cls
  return 'process'
}

export function nextOpNo(existing: PfdOperation[]): string {
  const max = existing.reduce((m, o) => {
    const n = Number((o.opNo.match(/\d+/) ?? ['0'])[0])
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)
  return `OPN ${max + 10}`
}

export function addOperation(projectId: string, description: string, opts: Partial<PfdOperation> = {}): PfdOperation {
  const ops = db.where<PfdOperation>('operations', o => o.projectId === projectId)
  const op: PfdOperation = {
    id: db.newId(),
    projectId,
    opNo: opts.opNo ?? nextOpNo(ops),
    description,
    classification: opts.classification ?? classifyOperation(description),
    machine: opts.machine,
    remarks: opts.remarks,
    order: ops.length + 1,
  }
  return db.insert('operations', op)
}

export function orderedOperations(projectId: string): PfdOperation[] {
  return db.where<PfdOperation>('operations', o => o.projectId === projectId)
    .sort((a, b) => a.order - b.order || a.opNo.localeCompare(b.opNo))
}
