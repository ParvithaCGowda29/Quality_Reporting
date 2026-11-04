// Customer-facing 8D report (D8 output) as Word.
import fs from 'node:fs'
import path from 'node:path'
import { Document, Packer, Paragraph, HeadingLevel, TextRun, ImageRun, Table, TableRow, TableCell, WidthType } from 'docx'
import { config } from '../config.ts'
import type { EightD, Project } from '../types.ts'

const h = (text: string) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(text)] })
const p = (text: string) => new Paragraph({ children: [new TextRun(text)] })

export async function export8dDocx(project: Project, ed: EightD, revNo: number, outPath: string) {
  const children: any[] = []
  const logoPath = path.join(config.assetsDir, 'innotech-logo.png')
  if (fs.existsSync(logoPath)) {
    children.push(new Paragraph({ children: [new ImageRun({ data: fs.readFileSync(logoPath), transformation: { width: 140, height: 56 }, type: 'png' })] }))
  }
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(`8D Report - ${ed.complaintRef}`)] }))
  children.push(p(`Part: ${project.partNumber} Rev ${project.partRevision} - ${project.partDescription}`))
  children.push(p(`Customer: ${project.customer}    Rev: ${String(revNo).padStart(2, '0')} / ${new Date().toLocaleDateString('en-GB')}`))

  children.push(h('D1 - Team')); children.push(p(ed.d1Team.join(', ')))
  children.push(h('D2 - Problem description'))
  children.push(p(`What: ${ed.d2Problem.what}`)); children.push(p(`Where: ${ed.d2Problem.where}`))
  children.push(p(`When: ${ed.d2Problem.when}`)); children.push(p(`How many: ${ed.d2Problem.howMany}`))
  children.push(h('D3 - Containment actions'))
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
    new TableRow({ children: ['Action', 'Owner', 'Date', 'Verification'].map(t => new TableCell({ children: [p(t)] })) }),
    ...ed.d3Containment.map(a => new TableRow({ children: [a.action, a.owner, a.date, a.verification].map(t => new TableCell({ children: [p(t ?? '')] })) })),
  ] }))
  children.push(h('D4 - Root cause (5-Why)'))
  ed.d4RootCause.whys.forEach((w, i) => children.push(p(`Why ${i + 1}: ${w}`)))
  children.push(p(`Root cause: ${ed.d4RootCause.rootCause}`))
  children.push(h('D5 / D6 - Corrective actions and verification'))
  ed.d5Corrective.forEach(a => children.push(p(`- ${a.action} (${a.owner}, ${a.date})`)))
  children.push(p(ed.d6Verification))
  children.push(h('D7 - Prevent recurrence'))
  children.push(p(ed.d7Prevention.systemChange))
  if (ed.d7Prevention.pfmeaUpdate) children.push(p('PFMEA update proposed - routed through change approval.'))
  if (ed.d7Prevention.controlPlanUpdate) children.push(p('Control Plan update proposed - routed through change approval.'))
  children.push(h('D8 - Team recognition')); children.push(p(ed.d8Recognition))

  const doc = new Document({ sections: [{ children }] })
  fs.writeFileSync(outPath, await Packer.toBuffer(doc))
}
