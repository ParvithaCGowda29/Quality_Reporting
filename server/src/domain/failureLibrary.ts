// Rule-based drafting knowledge for cable-harness / EMS assembly processes, seeded from
// RBraga01/Quality-Engineering-Skills checklists (MIT) and the generic patterns seen in
// Innotech's own sample PFMEA (e.g. wrong material, wrong qty, packaging damage at incoming).
// The engine drafts; the cross-functional team owns the final S/O/D and content.

import type { OpClass } from '../types.ts'

export interface FailurePattern {
  match: RegExp // tested against operation description (case-insensitive)
  requirement: string
  failureMode: string
  effect: string
  severity: number
  cause: string
  preventionControl: string
  occurrence: number
  detectionControl: string
  detection: number
}

const P = (p: Partial<FailurePattern> & Pick<FailurePattern, 'match' | 'failureMode' | 'effect' | 'cause'>): FailurePattern => ({
  requirement: 'As per drawing / work instruction',
  severity: 6,
  preventionControl: 'Operator training and work instruction at station',
  occurrence: 3,
  detectionControl: 'Visual inspection at next station',
  detection: 6,
  ...p,
})

export const FAILURE_PATTERNS: FailurePattern[] = [
  P({ match: /receipt|incoming|raw material/i, requirement: 'Right material, right quantity, undamaged, properly identified',
    failureMode: 'Wrong material received', effect: 'Wrong part produced; fitment problem at customer', severity: 6,
    cause: 'Wrong description on label; supplier mix-up', preventionControl: 'WH material handler verifies label against PO', occurrence: 2,
    detectionControl: 'Incoming quality inspection per IQC plan, each lot', detection: 6 }),
  P({ match: /receipt|incoming|raw material/i,
    failureMode: 'Wrong quantity received', effect: 'In-house production shortage; line stoppage', severity: 6,
    cause: 'Supplier counted wrongly', preventionControl: 'Quantity check during GRN against PO', occurrence: 2,
    detectionControl: 'Visual count verification at kitting', detection: 6 }),
  P({ match: /receipt|incoming|raw material|transit|store|storage/i,
    failureMode: 'Packaging / handling damage', effect: 'Fitment problem; part rejected at assembly', severity: 5,
    cause: 'Poor handling by transporter', preventionControl: 'Packaging spec agreed with supplier; inspection at warehouse', occurrence: 2,
    detectionControl: 'Visual inspection at receipt', detection: 7 }),
  P({ match: /kit/i, failureMode: 'Wrong part kitted', effect: 'Wrong part assembled; rework or customer complaint', severity: 7,
    cause: 'Similar-looking parts in adjacent bins', preventionControl: 'Bin labelling and kit pick-list verification', occurrence: 3,
    detectionControl: 'First-piece verification at assembly start', detection: 5 }),
  P({ match: /label|qr|print/i, failureMode: 'Wrong / unreadable label printed', effect: 'Traceability loss; wrong part shipped', severity: 7,
    cause: 'Wrong data selected in label software', preventionControl: 'Label data pulled from part master, not typed', occurrence: 2,
    detectionControl: 'Scan verification of printed label', detection: 4 }),
  P({ match: /identif/i, failureMode: 'Connector / part mis-identified', effect: 'Wrong connector fitted; functional failure at test', severity: 7,
    cause: 'Colour / keying misread by operator', preventionControl: 'Photo work instruction at station', occurrence: 3,
    detectionControl: 'Poka-yoke fixture or vision check', detection: 5 }),
  P({ match: /cut|strip|cutting/i, requirement: 'Cut length and strip length per spec',
    failureMode: 'Cut / strip length out of spec', effect: 'Poor terminal seating; electrical failure', severity: 7,
    cause: 'Machine blade wear or wrong setup', preventionControl: 'Preventive maintenance and setup approval', occurrence: 3,
    detectionControl: 'SPC check of cut length, sample per hour', detection: 5 }),
  P({ match: /crimp/i, requirement: 'Crimp height and pull force per spec',
    failureMode: 'Crimp out of spec (loose / over-crimped)', effect: 'High resistance / open circuit; field failure', severity: 8,
    cause: 'Applicator wear; wrong crimp parameters', preventionControl: 'Crimp force monitor; applicator PM schedule', occurrence: 3,
    detectionControl: 'Crimp cross-section / pull test per shift', detection: 5 }),
  P({ match: /solder/i, failureMode: 'Solder defect (cold joint / insufficient)', effect: 'Intermittent electrical failure', severity: 8,
    cause: 'Wrong temperature profile or contamination', preventionControl: 'Profile monitoring; solderability control of parts', occurrence: 3,
    detectionControl: 'Visual / AOI inspection per IPC-A-610', detection: 5 }),
  P({ match: /insert|housing|assembly|fit/i, failureMode: 'Terminal not fully seated / wrong cavity', effect: 'Open circuit; functional failure at customer', severity: 8,
    cause: 'Incomplete insertion force; operator error', preventionControl: 'Insertion aid / work instruction', occurrence: 4,
    detectionControl: 'Pull-back check / cavity verification plug', detection: 5 }),
  P({ match: /test|electrical|continuity|hi-?pot|hipot/i, failureMode: 'Electrical fault passes undetected', effect: 'Defective unit reaches customer', severity: 9,
    cause: 'Test program wrong revision or fixture fault', preventionControl: 'Test program version control; golden-sample check at shift start', occurrence: 2,
    detectionControl: 'Rabbit / boundary sample run per shift', detection: 4 }),
  P({ match: /inspect|iqc|visual|check/i, failureMode: 'Defect missed at inspection', effect: 'Defect flows to next process / customer', severity: 6,
    cause: 'Inspector fatigue; ambiguous criteria', preventionControl: 'Boundary samples and clear inspection standard', occurrence: 3,
    detectionControl: 'Periodic re-inspection audit', detection: 6 }),
  P({ match: /pack|dispatch|ship/i, failureMode: 'Wrong part / qty packed or label mismatch', effect: 'Customer line stoppage; complaint and sorting cost', severity: 7,
    cause: 'Mixed pallets; manual packing error', preventionControl: 'FIFO and dedicated packing area', occurrence: 3,
    detectionControl: 'Scan-to-ship verification against customer PO', detection: 4 }),
]

// Generic fallback so every operation gets at least one draft row.
export const GENERIC_PATTERN: FailurePattern = P({
  match: /.*/,
  failureMode: 'Process output does not meet requirement',
  effect: 'Rework / rejection; potential customer impact',
  cause: 'Process parameter drift or operator variation',
})
