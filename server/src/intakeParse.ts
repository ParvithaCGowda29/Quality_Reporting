// Process Data Capture (intake skill): extract structured process steps / PFMEA / CP
// content from uploaded Innotech Excel files. Header-driven, tolerant of merged headers.
import ExcelJS from 'exceljs'

export interface ParsedOps { kind: 'pfd'; operations: { opNo: string; description: string; machine?: string }[] }
export interface ParsedFmea { kind: 'pfmea'; rows: { processStep: string; failureMode: string; effect: string; severity?: number; cause?: string; occurrence?: number; detection?: number }[] }
export type ParseResult = ParsedOps | ParsedFmea | { kind: 'unknown'; note: string }

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return ''
  if (typeof v === 'object' && 'richText' in (v as any)) return (v as any).richText.map((r: any) => r.text).join('')
  return String(v).replace(/\s+/g, ' ').trim()
}

export async function parseWorkbook(filePath: string): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const ws = wb.worksheets[0]
  if (!ws) return { kind: 'unknown', note: 'No worksheets in file' }

  // Find the header row: PFD has Operation No + Description; PFMEA has failure mode / effects.
  let headerRow = -1
  let cols: Record<string, number> = {}
  ws.eachRow((row, n) => {
    if (headerRow > 0 || n > 25) return
    const texts = row.values as ExcelJS.CellValue[]
    const map: Record<string, number> = {}
    texts.forEach((v, i) => {
      const t = cellText(v).toLowerCase()
      if (!t) return
      if (/operation\s*no|opn/.test(t)) map.opNo = i
      if (/description of operation|process name/.test(t)) map.desc = i
      if (/failure mode/.test(t)) map.fm = i
      if (/process step/.test(t)) map.step = i
      if (/effects of/.test(t)) map.effect = i
      if (/severity/.test(t)) map.s = i
      if (/occurrence/.test(t)) map.o = i
      if (/detection/.test(t)) map.d = i
      if (/causes of/.test(t)) map.cause = i
    })
    if ((map.opNo && map.desc) || (map.fm && map.step)) { headerRow = n; cols = map }
  })
  if (headerRow < 0) return { kind: 'unknown', note: 'No PFD/PFMEA header row found in first sheet' }

  if (cols.fm) {
    const rows: ParsedFmea['rows'] = []
    ws.eachRow((row, n) => {
      if (n <= headerRow) return
      const vals = row.values as ExcelJS.CellValue[]
      const step = cellText(vals[cols.step])
      const fm = cellText(vals[cols.fm])
      if (!fm) return
      rows.push({
        processStep: step || rows.at(-1)?.processStep || '',
        failureMode: fm,
        effect: cellText(vals[cols.effect]),
        severity: Number(cellText(vals[cols.s])) || undefined,
        cause: cellText(vals[cols.cause]),
        occurrence: Number(cellText(vals[cols.o])) || undefined,
        detection: Number(cellText(vals[cols.d])) || undefined,
      })
    })
    return { kind: 'pfmea', rows }
  }

  const operations: ParsedOps['operations'] = []
  ws.eachRow((row, n) => {
    if (n <= headerRow) return
    const vals = row.values as ExcelJS.CellValue[]
    const desc = cellText(vals[cols.desc])
    if (!desc) return
    const rawNo = cellText(vals[cols.opNo])
    operations.push({ opNo: rawNo || `OPN ${(operations.length + 1) * 10}`, description: desc })
  })
  return { kind: 'pfd', operations }
}
