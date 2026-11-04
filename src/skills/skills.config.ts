// The one place the Quality Reporting Agent workflows live: 7 skills × subskills × steps (BuLLM Quality Reporting Agent
// build definition v0.1). The left rail, the assistant's router and the Results & edits plan all read this file, so
// changing a workflow means editing this file only.
// Format: each subskill is a heading, each step is "Name: what it does." (description optional).
// `icon` is the Tabler icon for the collapsed rail; `keywords` help the router pick the skill from a request.

export interface Step { name: string; description: string }
export interface Subskill { name: string; steps: Step[] }
export interface Skill { id: string; name: string; icon: string; keywords: string[]; subskills: Subskill[] }

const steps = (lines: string[]): Step[] => lines.map(l => {
  const i = l.indexOf(': ')
  return i < 0 ? { name: l, description: '' } : { name: l.slice(0, i), description: l.slice(i + 2) }
})

export const SKILLS: Skill[] = [
  { id: 'intake', name: 'Data Intake', icon: 'tb-inbox', keywords: ['upload', 'load', 'files', 'file', 'missing', 'data', 'intake', 'part', 'revision', 'sharepoint'], subskills: [
    { name: 'Document Ingestion', steps: steps([
      'Receive upload by browser / email / SharePoint watch',
      'Virus-scan every file before storage',
      'Store and index for retrieval (Cognee, admin masters, S3, database)',
    ]) },
    { name: 'Process Data Capture', steps: steps([
      'Extract process steps, existing PFMEA / Control Plan content and complaint records into structured fields',
    ]) },
    { name: 'Part and customer context', steps: steps([
      'Record part number, revision, customer-specific requirements and applicable standards',
    ]) },
    { name: 'Missing-Data Check', steps: steps([
      'Run missing-data checklist; halt and notify the quality manager on gaps',
    ]) },
  ] },
  { id: 'pfd', name: 'PFD Generation', icon: 'tb-schema', keywords: ['pfd', 'flow', 'diagram', 'operation', 'operations', 'opn'], subskills: [
    { name: 'Step structuring', steps: steps([
      'Order operations from process data and assign operation numbers',
    ]) },
    { name: 'Step classification', steps: steps([
      'Classify every operation (process / transit / inspection / delay / storage)',
    ]) },
    { name: 'PFD document', steps: steps([
      'Fill the Innotech PFD template and produce the draft PFD',
    ]) },
  ] },
  { id: 'pfmea', name: 'PFMEA Generation', icon: 'tb-alert-triangle', keywords: ['pfmea', 'fmea', 'failure', 'risk', 'severity', 'occurrence', 'detection', 'rating', 'iatf', 'aiag', 'vda', 'priority'], subskills: [
    { name: 'Structure and function', steps: steps([
      'Build one row group per PFD operation - process item, step, work element, function and requirement',
    ]) },
    { name: 'Failure analysis', steps: steps([
      'Draft failure modes, effects (local / next level / end user), causes and current prevention and detection controls',
    ]) },
    { name: 'IATF 16949 standards check', steps: steps([
      'Check the draft against IATF 16949 requirements that apply to process risk analysis and special characteristics; flag gaps or missing items',
    ]) },
    { name: 'AIAG-VDA risk rating', steps: steps([
      'Collect S/O/D from the cross-functional team; compute Action Priority (H/M/L) per AIAG-VDA handbook; recommend actions for high-priority items',
    ]) },
  ] },
  { id: 'cp', name: 'Control Plan Generation', icon: 'tb-clipboard-check', keywords: ['control', 'cp', 'reaction', 'inspection', 'sample', 'frequency', 'characteristic', 'consistency'], subskills: [
    { name: 'PFMEA to Control Plan mapping', steps: steps([
      'Map every PFMEA failure mode and PFD step to a Control Plan row',
    ]) },
    { name: 'Characteristics and methods', steps: steps([
      'Fill product/process characteristics (incl. special characteristics), specification and tolerance, measurement/inspection method, sample size and frequency',
    ]) },
    { name: 'Reaction plans', steps: steps([
      'Draft the reaction plan per check - contain, stop, escalate',
    ]) },
    { name: 'Consistency check', steps: steps([
      'Run the two-way consistency check (PFMEA risk <-> control) before review',
    ]) },
  ] },
  { id: '8d', name: '8D Generation', icon: 'tb-refresh', keywords: ['8d', 'complaint', 'root', 'cause', 'containment', 'corrective', 'preventive', 'indic', 'customer', 'defect'], subskills: [
    { name: 'Complaint intake (D0-D2)', steps: steps([
      'Intake complaint - emergency response check, team members by function, problem description (what, where, when, how many)',
    ]) },
    { name: 'Containment and root cause (D3-D4)', steps: steps([
      "Draft containment actions; run root cause with 5-Why or fishbone; reject 'human error' without a systemic cause",
    ]) },
    { name: 'Corrective and preventive action (D5-D7)', steps: steps([
      'Draft corrective action and verification; draft prevention including proposed PFMEA and Control Plan updates',
    ]) },
    { name: 'Closure and customer report (D8)', steps: steps([
      'Team recognition; produce the customer-facing 8D report',
    ]) },
  ] },
  { id: 'approval', name: 'Human Approval', icon: 'tb-user-check', keywords: ['approve', 'approval', 'review', 'reject', 'return', 'sign', 'engineer', 'qe'], subskills: [
    { name: 'Quality engineer review', steps: steps([
      'Route every draft to the Quality Engineer for review',
    ]) },
    { name: 'Cross-functional rating input', steps: steps([
      'Collect S/O/D ratings from the cross-functional team for PFMEA',
    ]) },
    { name: 'Approval decision', steps: steps([
      'Record approve / return-with-comments / reject; release only approved drafts',
    ]) },
    { name: 'Change approval', steps: steps([
      'Route post-8D PFMEA / CP updates through approval before release',
    ]) },
  ] },
  { id: 'output', name: 'Output and Audit', icon: 'tb-file-text', keywords: ['export', 'excel', 'word', 'audit', 'trail', 'revision', 'alert', 'notify', 'log', 'download'], subskills: [
    { name: 'Document export', steps: steps([
      "Export approved documents as Excel / Word in Innotech's formats",
    ]) },
    { name: 'Audit trail', steps: steps([
      'Write audit records for every draft, edit, rating and approval',
    ]) },
    { name: 'Revision control', steps: steps([
      'Stamp revision number and date on every released document',
    ]) },
    { name: 'Alerts', steps: steps([
      'Send alerts on missing data and pending approvals',
    ]) },
  ] },
]
