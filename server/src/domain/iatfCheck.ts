// IATF 16949 check (PFMEA subskill, runs BEFORE AIAG-VDA rating, per the agreed skills doc).
// Rule-of-thumb flags only - no licensed standard text is bundled; a QE confirms findings.

export interface IatfFlag { clause: string; topic: string; finding: string }

export function iatf16949Check(rows: { processStep: string; severity: number; classification?: string; occurrence: number; detection: number; preventionControl: string; detectionControl: string }[]): IatfFlag[] {
  const flags: IatfFlag[] = []
  if (!rows.length) {
    flags.push({ clause: '8.3.3.3', topic: 'PFMEA content', finding: 'PFMEA has no rows yet - cannot be reviewed.' })
    return flags
  }
  const missingControls = rows.filter(r => !r.preventionControl || !r.detectionControl)
  if (missingControls.length) {
    flags.push({ clause: '8.5.1', topic: 'Control of production', finding: `${missingControls.length} row(s) missing prevention or detection controls.` })
  }
  const sc = rows.filter(r => r.classification)
  if (sc.length && sc.some(r => r.severity < 9)) {
    flags.push({ clause: '8.3.3.3', topic: 'Special characteristics', finding: 'Special characteristics must be rated S=9 or S=10.' })
  }
  if (!sc.length) {
    flags.push({ clause: '8.3.3.3', topic: 'Special characteristics', finding: 'No special characteristics marked - confirm drawing review was done.' })
  }
  const highSev = rows.filter(r => r.severity >= 9 && !r.detectionControl)
  if (highSev.length) {
    flags.push({ clause: '8.7', topic: 'Nonconformity control', finding: `${highSev.length} safety-severity row(s) without detection control.` })
  }
  return flags
}
