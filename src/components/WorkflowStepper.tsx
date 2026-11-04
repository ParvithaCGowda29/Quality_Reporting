// Left pane body: part context, "+ Add files", then numbered accordion skill cards (one open at a time) and the separate
// conditional 8D card. Reads the real task; statuses are never invented or timed.
// Selection (store.skill/sub), expansion (local) and status (from the task) are separate things.
import { useEffect, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { SKILLS } from '../skills/skills.config.ts'
import { BRANCH, FLOW, MAIN_PATH, STATUS_LABEL, idleLine, modelFromTask, subSummary, type Model, type StageMeta, type StageStatus } from '../skills/stages.ts'
import { PREVIEW } from '../skills/stages.preview.ts'
import { selectSkill, selectSub, useTask } from '../skills/task'
import { Icon } from './ui'
import { UploadDialog, useFileCount } from './UploadDialog'
import './stepper.css'

const ICON: Record<StageStatus, string> = {
  'not-started': 'circle', running: 'tb-loader', 'waiting-input': 'clock', 'waiting-approval': 'shield', blocked: 'lock',
  complete: 'check', approved: 'shield', returned: 'refresh', failed: 'x',
}
const IDS = SKILLS.map(s => s.id)
const preview = import.meta.env.DEV && new URLSearchParams(location.search).has('qwPreview')
const openable = (id?: string) => MAIN_PATH.some(m => m.id === id && !m.locked)

const Node = ({ s, size = 24 }: { s: StageStatus; size?: number }) =>
  <span className={`qw-node s-${s}`} style={{ width: size, height: size }} aria-hidden><Icon name={ICON[s]} size={size * 0.58} spin={s === 'running'} stroke={2} /></span>

// Skill circles on the rail carry the skill's own icon; status shows through colour (qw-node classes) and the line below.
const SUB_ICON: Record<string, string> = { 'Document Ingestion': 'tb-upload', 'Process Data Capture': 'tb-file-code', 'Part and customer context': 'tb-transform', 'Missing-Data Check': 'tb-search' }

export function WorkflowStepper() {
  const { skill, sub, task } = useTask(s => s)
  const model: Model = preview ? PREVIEW : modelFromTask(task, IDS)
  const selectedId = preview && model.selected ? model.selected : SKILLS[skill]?.id
  const [adding, setAdding] = useState(false)
  const files = useFileCount()
  // The single open card (1-6). The 8D card has its own independent state.
  const [expanded, setExpanded] = useState<string | null>(openable(selectedId) ? selectedId : 'intake')
  const [branchOpen, setBranchOpen] = useState(false)
  // 8D description: a solid card, fixed-position (so nothing in the rail resizes), inside the rail's width, below the card
  // (above it when the bottom of the window is too close).
  const [tip, setTip] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null)
  const tipShow = (e: { currentTarget: HTMLElement }) => {
    const r = e.currentTarget.getBoundingClientRect(), pane = e.currentTarget.closest('.qw')!.getBoundingClientRect()
    const below = window.innerHeight - r.bottom > 130
    setTip({ left: pane.left + 10, width: pane.width - 20, ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) })
  }
  useEffect(() => { if (openable(selectedId)) setExpanded(selectedId) }, [selectedId])

  // Up/Down move between card headers and sub-skills; Tab still works as usual.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    const all = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[data-qw]:not([inert] *)')]
    const i = all.indexOf(document.activeElement as HTMLButtonElement)
    if (i < 0) return
    e.preventDefault()
    all[Math.max(0, Math.min(all.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))].focus()
  }

  const card = (m: StageMeta, n: number, branch = false) => {
    const i = IDS.indexOf(m.id), sk = SKILLS[i], v = model.stages[m.id]
    const status = v?.status ?? 'not-started'
    const isSel = selectedId === m.id
    const isOpen = !m.locked && (branch ? branchOpen : expanded === m.id)
    const line = v?.label ?? idleLine(m)
    const toggle = () => {
      selectSkill(i) // shows its context in the other panes; never starts work
      if (m.locked) return
      if (branch) setBranchOpen(o => !o)
      else setExpanded(isOpen ? null : m.id)
    }
    return (
      <li key={m.id} className={`qw-acc${isOpen ? ' open' : ''}${isSel ? ' sel' : ''}${branch ? ' branch' : ''}${m.locked ? ' locked' : ''}`}>
        <button type="button" className="qw-head" data-qw aria-expanded={m.locked ? undefined : isOpen} aria-controls={m.locked ? undefined : `qw-${m.id}`}
          aria-current={isSel ? 'true' : undefined} aria-disabled={m.locked || undefined} onClick={toggle}
          {...(branch && { 'aria-describedby': 'qw-tip', onMouseEnter: tipShow, onMouseLeave: () => setTip(null), onFocus: tipShow, onBlur: () => setTip(null) })}>
          <span className={`qw-ico s-${status}${isSel ? ' sel' : ''}`} aria-hidden>
            <Icon name={branch ? 'tb-hexagon' : sk.icon} size={branch ? 22 : 16} stroke={1.8} />{branch && <b>8</b>}
          </span>
          <span className="qw-head-t">
            <span className="qw-name">{branch ? '' : `${n} `}{sk.name}{branch && <span className="qw-badge">Conditional</span>}</span>
            {!(branch && !v) && <span className={`qw-line s-${status}`}>{line}</span>}
          </span>
          {m.locked ? <span className="qw-lock"><Icon name="lock" size={14} /></span> : <span className="qw-chev"><Icon name="chevron" size={12} /></span>}
        </button>
        {branch && tip && createPortal(
          <div id="qw-tip" role="tooltip" className="qw-tip" style={tip}>
            {m.needs}<span className="tip-note">Can propose PFMEA / Control Plan updates.</span>
          </div>, document.body)}
        {!m.locked && (
          <div className="qw-collapse">
            <div id={`qw-${m.id}`} className="qw-body" inert={!isOpen}>
              <p className="qw-count">{subSummary(sk.subskills.length, v?.subs)}</p>
              <ol className="qw-subs">
                {sk.subskills.map((ss, j) => {
                  const ssS = v?.subs?.[j] ?? 'not-started'
                  const on = isSel && sub === j
                  const note = m.subNotes?.[j]
                  const right = m.id === 'intake' && j === 0 // "Add files above" sits to the right of Upload
                  return (
                    <li key={ss.name}>
                      <button type="button" className={`qw-sub${on ? ' on' : ''}`} data-qw aria-current={on ? 'true' : undefined} onClick={() => selectSub(i, j)}>
                        {ssS === 'not-started' ? <span className="qw-subico" aria-hidden><Icon name={SUB_ICON[ss.name] ?? 'circle'} size={14} /></span> : <Node s={ssS} size={16} />}
                        <span className="qw-sub-t"><span>{ss.name}<span className="sr-only">, {STATUS_LABEL[ssS]}</span></span>
                          {note && !right && <span className="qw-note">{note}</span>}</span>
                        {note && right && <span className="qw-note qw-right">{note}</span>}
                      </button>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="qw" onKeyDown={onKey}>
      <div className="qw-add">
        <button type="button" className="qw-add-btn" onClick={() => setAdding(true)}>+ Add files{files ? ` (${files})` : ''}</button>
        <p>PDF, DOCX, XLSX, PPTX, TXT, PNG and ZIP archives</p>
      </div>
      {adding && <UploadDialog onClose={() => setAdding(false)} />}
      <div className="qw-scroll">
        <ol className="qw-list qw-rail" aria-label="Skills">{MAIN_PATH.map((m, n) => card(m, n + 1))}</ol>
        <div className="qw-branch-head"><span>When a quality issue occurs</span></div>
        <ol className="qw-list" aria-label="Conditional path">{BRANCH.map(m => card(m, 0, true))}</ol>
      </div>
      <footer className="qw-flow" aria-label="Main flow">{FLOW.join(' > ')}</footer>
    </div>
  )
}
