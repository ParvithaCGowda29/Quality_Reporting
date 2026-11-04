// Left-pane "Quality workflow" model. Pure (runs in Node tests). Stage ids come from skills.config.ts; this file only adds
// display order, dependency/gate text and the mapping from the real task to a status. Selection, expansion, execution
// status and approval are separate things: nothing here starts work or approves anything.
import type { Task } from './router.ts'

export type StageStatus = 'not-started' | 'running' | 'waiting-input' | 'waiting-approval' | 'blocked' | 'complete' | 'approved' | 'returned' | 'failed'
export const STATUS_LABEL: Record<StageStatus, string> = {
  'not-started': 'Not started', running: 'Running', 'waiting-input': 'Waiting for input', 'waiting-approval': 'Waiting for approval',
  blocked: 'Blocked', complete: 'Complete', approved: 'Approved', returned: 'Returned', failed: 'Failed',
}

export interface StageMeta {
  id: string
  /** Static requirement, shown while the stage has no live status. */
  needs: string
  /** The human gate that applies to this stage. */
  gate?: string
  /** Per-subskill gate notes, by subskill index. */
  subNotes?: Record<number, string>
  /** Locked until approval: shown with a lock and no live status. */
  locked?: boolean
  /** Workbook phase / readiness tag. */
  tag?: string
}

/** Main new-part path, in order. 8D is reactive and is NOT part of it. */
export const MAIN_PATH: StageMeta[] = [
  { id: 'intake', needs: 'Start here', gate: 'Gaps halt only the affected drafts', subNotes: { 0: 'Add files above', 3: 'Never guess missing data' } },
  { id: 'pfd', needs: 'Needs process data', gate: 'QE approval before PFMEA uses it' },
  { id: 'pfmea', needs: 'Needs approved PFD', gate: 'Team S/O/D ratings, then QE review',
    subNotes: { 2: 'Runs before risk rating', 3: 'S/O/D from the team, never the AI' } },
  { id: 'cp', needs: 'Needs approved PFMEA', gate: 'QE review before release', tag: 'Planned (P2)', subNotes: { 3: 'Flags orphaned risks / controls' } },
  { id: 'approval', needs: 'Release gate', locked: true, tag: 'Gate planned', subNotes: { 3: 'For updates after an 8D' } },
  { id: 'output', needs: 'Locked until approval', locked: true, subNotes: { 1: 'Ongoing, not only after export' } },
]
/** Conditional branch: starts only when a complaint or internal failure needs it. */
export const BRANCH: StageMeta[] = [
  { id: '8d', needs: 'Starts on a complaint or internal failure', gate: 'Change approval for PFMEA / CP updates', tag: 'Planned (P2)' },
]

export interface StageView { status: StageStatus; label: string; subs?: Record<number, StageStatus> }
export interface ContextView { type?: string; part?: string; rev?: string; desc?: string; status?: StageStatus; statusLabel?: string; next?: string }
export interface Model { ctx: ContextView | null; stages: Record<string, StageView>; selected?: string }

const PART = /\b\d{3,}[A-Z]{1,3}\d{3,}[A-Z]?\b/i
const REV = /\brev(?:ision)?\.?\s*#?\s*([A-Z0-9]{1,3})\b/i

/** Real data only: part/revision are read from what the user typed; anything not present is left out. */
export function modelFromTask(task: Task | null, skillIds: string[]): Model {
  if (!task) return { ctx: null, stages: {} }
  const text = `${task.request} ${task.answer ?? ''}`
  const id = task.route && skillIds[task.route.skill]
  const [status, statusLabel, next]: [StageStatus, string, string] =
    task.phase === 'clarify' ? ['waiting-input', 'Waiting for input', "Answer the assistant's question"]
    : task.phase === 'approval' ? ['waiting-approval', 'Waiting for approval', 'Approve or change the plan in Results & edits']
    : ['approved', 'Plan approved', 'Nothing has run yet: no document store is connected']
  const stages: Model['stages'] = {}
  if (id && task.route) stages[id] = { status, label: statusLabel, subs: { [task.route.sub]: status } }
  return { ctx: { type: id ? (id === '8d' ? 'Complaint / 8D' : 'New part') : undefined, part: text.match(PART)?.[0].toUpperCase(), rev: text.match(REV)?.[1], status, statusLabel, next }, stages }
}

/** "3 of 4 sub-skills complete" only when completion data exists; otherwise just the count. */
export function subSummary(total: number, subs?: Record<number, StageStatus>): string {
  const done = subs ? Object.values(subs).filter(s => s === 'complete' || s === 'approved').length : 0
  return subs && done ? `${done} of ${total} sub-skills complete` : `${total} sub-skills`
}

/** Collapsed line for a stage with no live status: "Waiting · 3 sub-skills" (gate / locked stages keep their own wording). */
export const idleLine = (m: StageMeta, total: number) =>
  ['pfd', 'pfmea', 'cp'].includes(m.id) ? `Waiting - ${total} sub-skills` : m.id === 'intake' ? `Ready - ${total} sub-skills` : m.id === '8d' ? `${m.needs} - ${total} sub-skills` : m.needs

export const FLOW = ['Intake', 'PFD', 'PFMEA', 'Control Plan', 'Approval', 'Output']
