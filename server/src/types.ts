// Domain types for the Quality Reporting backend. Mirrors the 7 skills in the UI
// (src/skills/skills.config.ts): intake, pfd, pfmea, cp, 8d, approval, output.

export type Id = string

export interface Project {
  id: Id
  partNumber: string
  partRevision: string
  partDescription: string
  customer: string
  customerRequirements: string[]
  applicableStandards: string[] // e.g. ['IATF 16949', 'AIAG-VDA FMEA 2019']
  processOwner: string
  coreTeam: string[]
  confirmations?: string[] // checklist keys confirmed manually (see domain/checklist.ts CONFIRMABLE_KEYS)
  status: 'intake' | 'pfd' | 'pfmea' | 'control-plan' | 'live'
  createdAt: string
  updatedAt: string
}

export type DocKind = 'pfd' | 'pfmea' | 'control-plan' | '8d' | 'template' | 'pfd-template' | 'pfmea-template' | 'cp-template' | '8d-template' | 'standard' | 'complaint' | 'drawing' | 'other'

export interface IntakeDocument {
  id: Id
  projectId: Id
  kind: DocKind
  filename: string
  storedPath: string
  byteSize: number
  uploadedBy: string
  uploadedAt: string
  scanStatus: 'clean' // pluggable: virus-scan hook runs before storage; local AV stub marks clean
  parseStatus: 'pending' | 'parsed' | 'failed'
  parseSummary?: string
}

export interface ChecklistItem {
  key: string
  label: string
  group: 'templates' | 'samples' | 'standards' | 'process-data' | 'people' | 'process'
  satisfied: boolean
  evidence?: string // document id or note
}

export type OpClass = 'process' | 'transit' | 'inspection' | 'delay' | 'storage'

export interface PfdOperation {
  id: Id
  projectId: Id
  opNo: string // 'OPN 10'
  description: string
  classification: OpClass
  machine?: string
  remarks?: string
  order: number
}

export interface FmeaRow {
  id: Id
  projectId: Id
  operationId: Id // links to PFD operation (Structure analysis)
  processStep: string
  requirement: string
  failureMode: string
  effect: string
  severity: number // 1-10
  classification?: string // special characteristic class
  cause: string
  preventionControl: string
  occurrence: number // 1-10
  detectionControl: string
  detection: number // 1-10
  // computed
  rpn: number
  ap: 'H' | 'M' | 'L'
  recommendedAction?: string
  actionOwner?: string
  actionTargetDate?: string
  actionTaken?: string
  actionTakenDate?: string
  revisedSeverity?: number
  revisedOccurrence?: number
  revisedDetection?: number
  revisedAp?: 'H' | 'M' | 'L'
}

export interface ControlPlanRow {
  id: Id
  projectId: Id
  operationId: Id
  fmeaRowId?: Id
  opNo: string
  processName: string
  machine: string
  characteristicNo?: string
  productCharacteristic: string
  processCharacteristic: string
  specialClass?: string
  specification: string
  measurementTechnique: string
  sampleSize: string
  frequency: string
  controlMethod: string
  reactionPlan: string
}

export interface EightD {
  id: Id
  projectId: Id
  complaintRef: string
  status: 'open' | 'closed'
  d0Emergency: string
  d1Team: string[]
  d2Problem: { what: string; where: string; when: string; howMany: string; isIsNot?: string }
  d3Containment: { action: string; owner: string; date: string; verification: string }[]
  d4RootCause: { whys: string[]; rootCause: string; method: '5why' | 'fishbone' }
  d5Corrective: { action: string; owner: string; date: string }[]
  d6Verification: string
  d7Prevention: { systemChange: string; pfmeaUpdate: boolean; controlPlanUpdate: boolean }
  d8Recognition: string
  createdAt: string
}

export type ApprovalDecision = 'approved' | 'returned' | 'rejected'

export interface ApprovalTask {
  id: Id
  projectId: Id
  artifactKind: 'pfd' | 'pfmea' | 'control-plan' | '8d' | 'pfmea-change' | 'cp-change'
  artifactRevision: number
  assignedTo: string // QE name
  status: 'pending' | ApprovalDecision
  comments?: string
  decidedBy?: string
  decidedAt?: string
  createdAt: string
}

export interface AuditEvent {
  id: Id
  projectId: Id
  at: string
  actor: string
  action: string
  detail: string
}

export interface Revision {
  id: Id
  projectId: Id
  kind: 'pfd' | 'pfmea' | 'control-plan' | '8d'
  revNo: number
  revDate: string
  releasedBy: string
  filePath?: string
}
