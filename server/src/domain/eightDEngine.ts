// 8D Generation skill: D0-D8 state, root-cause validation (reject bare "human error"),
// prevention step proposes PFMEA / Control Plan updates routed through change approval.
import { db } from '../db.ts'
import type { EightD } from '../types.ts'

export function createEightD(projectId: string, complaintRef: string, d2: EightD['d2Problem'], team: string[]): EightD {
  return db.insert('eightDs', {
    id: db.newId(),
    projectId,
    complaintRef,
    status: 'open',
    d0Emergency: '',
    d1Team: team,
    d2Problem: d2,
    d3Containment: [],
    d4RootCause: { whys: [], rootCause: '', method: '5why' },
    d5Corrective: [],
    d6Verification: '',
    d7Prevention: { systemChange: '', pfmeaUpdate: false, controlPlanUpdate: false },
    d8Recognition: '',
    createdAt: new Date().toISOString(),
  } as EightD)
}

export function setRootCause(eightDId: string, whys: string[], rootCause: string): EightD {
  const ed = db.get<EightD>('eightDs', eightDId)
  if (!ed) throw Object.assign(new Error('8D not found'), { status: 404 })
  if (/^\s*human error\s*$/i.test(rootCause)) {
    throw Object.assign(new Error('"human error" alone is not an acceptable root cause - identify the systemic cause (why the system allowed the error).'), { status: 422 })
  }
  if (whys.length < 3) {
    throw Object.assign(new Error('5-Why needs at least 3 levels before naming a root cause.'), { status: 422 })
  }
  return db.update<EightD>('eightDs', eightDId, { d4RootCause: { whys, rootCause, method: '5why' } })
}

export function updateEightD(eightDId: string, patch: Partial<EightD>): EightD {
  return db.update<EightD>('eightDs', eightDId, patch)
}
