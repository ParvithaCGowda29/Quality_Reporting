// Document export (output skill): Excel in Innotech's layout - company header, doc no,
// rev stamp, part block, core team, prepared/reviewed/approved - with the Drive logos.
import fs from 'node:fs'
import path from 'node:path'
import ExcelJS from 'exceljs'
import { config } from '../config.ts'
import type { ControlPlanRow, FmeaRow, PfdOperation, Project } from '../types.ts'

const CLASS_MARKS: Record<string, string> = { process: 'O', transit: '>', inspection: 'I', delay: 'D', storage: 'V' }

async function newBook(project: Project, title: string, docNo: string, revNo: number, formNo: string) {
  const wb = new ExcelJS.Workbook()
  wb.creator = 'BuLLM Quality Reporting Agent (DigiBull)'
  const ws = wb.addWorksheet(title)
  const logoPath = path.join(config.assetsDir, 'innotech-logo.png')
  if (fs.existsSync(logoPath)) {
    const img = wb.addImage({ filename: logoPath, extension: 'png' })
    ws.addImage(img, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 48 } })
  }
  ws.getRow(1).getCell(4).value = 'Innotech Integration Service'
  ws.getRow(1).getCell(4).font = { bold: true, size: 14 }
  ws.getRow(2).getCell(4).value = title
  ws.getRow(2).getCell(4).font = { bold: true }
  ws.getRow(3).getCell(2).value = `Item Code / Part No. / Rev: ${project.partNumber}; Rev ${project.partRevision}`
  ws.getRow(3).getCell(6).value = `Document No.: ${docNo}`
  ws.getRow(4).getCell(2).value = `Item Description: ${project.partDescription}`
  ws.getRow(4).getCell(6).value = `Rev.No. / Rev. date: ${String(revNo).padStart(2, '0')} / ${new Date().toLocaleDateString('en-GB')}`
  ws.getRow(5).getCell(2).value = `Customer: ${project.customer}`
  ws.getRow(5).getCell(6).value = `Form No. ${formNo}`
  ws.getRow(6).getCell(2).value = `Core team: ${project.coreTeam.join(', ')}`
  ws.getRow(6).getCell(6).value = 'Prepared by: BuLLM Agent   Reviewed by: ___   Approved by: ___'
  ws.getRow(7).getCell(2).value = 'DRAFT - pending QE approval' // removed on release export
  ws.getRow(7).getCell(2).font = { italic: true, color: { argb: 'FFB00000' } }
  return { wb, ws }
}

function styleHeader(ws: ExcelJS.Worksheet, row: number, nCols: number) {
  const r = ws.getRow(row)
  for (let c = 1; c <= nCols; c++) {
    const cell = r.getCell(c)
    cell.font = { bold: true }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }
    cell.border = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    cell.alignment = { wrapText: true, vertical: 'middle' }
  }
}

export async function exportPfdXlsx(project: Project, ops: PfdOperation[], revNo: number, outPath: string) {
  const { wb, ws } = await newBook(project, 'Process Flow Diagram (PFD)', `IIS_03_ENG_PFD_${project.partNumber}`, revNo, 'IIS_04_ENG_015')
  ws.getRow(9).values = ['Operation No.', 'Description of operation', 'Process', 'Transit', 'Inspection', 'Delay', 'Storage', 'Machine / Jig', 'Remarks']
  styleHeader(ws, 9, 9)
  ops.forEach((op, i) => {
    const r = ws.getRow(10 + i)
    r.getCell(1).value = op.opNo
    r.getCell(2).value = op.description
    r.getCell(8).value = op.machine ?? ''
    r.getCell(9).value = op.remarks ?? ''
    const col = { process: 3, transit: 4, inspection: 5, delay: 6, storage: 7 }[op.classification]
    r.getCell(col).value = CLASS_MARKS[op.classification]
  })
  ws.getColumn(2).width = 50
  await wb.xlsx.writeFile(outPath)
}

export async function exportPfmeaXlsx(project: Project, rows: FmeaRow[], revNo: number, outPath: string) {
  const { wb, ws } = await newBook(project, 'Process FMEA', `IIS_03_ENG_PFMEA_${project.partNumber}`, revNo, 'IIS_04_ENG_002')
  ws.getRow(9).values = ['Process step / Function', 'Requirement', 'Potential failure mode', 'Potential effects of failure', 'Severity', 'Classification',
    'Potential causes of failure', 'Controls (Prevention)', 'Occurrence', 'Controls (Detection)', 'Detection', 'RPN', 'AP (AIAG-VDA)',
    'Recommended action', 'Responsibility & Target date', 'Action taken / date', 'Rev S', 'Rev O', 'Rev D', 'Rev AP']
  styleHeader(ws, 9, 20)
  rows.forEach((f, i) => {
    const r = ws.getRow(10 + i)
    ;[f.processStep, f.requirement, f.failureMode, f.effect, f.severity, f.classification ?? '', f.cause, f.preventionControl,
      f.occurrence, f.detectionControl, f.detection, f.rpn, f.ap, f.recommendedAction ?? '',
      [f.actionOwner, f.actionTargetDate].filter(Boolean).join(' / '), [f.actionTaken, f.actionTakenDate].filter(Boolean).join(' / '),
      f.revisedSeverity ?? '', f.revisedOccurrence ?? '', f.revisedDetection ?? '', f.revisedAp ?? '']
      .forEach((v, c) => { r.getCell(c + 1).value = v as any })
    if (f.ap === 'H') r.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8CBAD' } }
  })
  ;[1, 2, 3, 4, 7, 8, 10, 14].forEach(c => { ws.getColumn(c).width = 32 })
  await wb.xlsx.writeFile(outPath)
}

export async function exportCpXlsx(project: Project, rows: ControlPlanRow[], revNo: number, outPath: string) {
  const { wb, ws } = await newBook(project, 'Control Plan', `IIS_03_ENG_CP_${project.partNumber}`, revNo, 'IIS_04_ENG_016')
  ws.getRow(9).values = ['Opn. No.', 'Process Name / Description', 'Machine, device, Jig, Tools', 'Char. No.', 'Product Characteristic',
    'Process Characteristic', 'Special char. class', 'Specification / Tolerance', 'Evaluation / Measurement Technique',
    'Sample Size', 'Frequency', 'Control Method', 'Reaction Plan']
  styleHeader(ws, 9, 13)
  rows.forEach((c, i) => {
    const r = ws.getRow(10 + i)
    ;[c.opNo, c.processName, c.machine, c.characteristicNo ?? '', c.productCharacteristic, c.processCharacteristic,
      c.specialClass ?? '', c.specification, c.measurementTechnique, c.sampleSize, c.frequency, c.controlMethod, c.reactionPlan]
      .forEach((v, col) => { r.getCell(col + 1).value = v as any })
  })
  ;[2, 5, 6, 8, 9, 13].forEach(c => { ws.getColumn(c).width = 30 })
  await wb.xlsx.writeFile(outPath)
}
