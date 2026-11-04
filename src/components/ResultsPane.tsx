// RESULTS & EDITS body. Before a skill picks a task up: one whole-pane waiting state (large idle Status Mark with a
// document icon, Shiny Text heading). Once the router has a plan, it plays out (ring shrinks, text fades) while the
// task's plan and approval fade in. Approve / Cancel here are the hard stop: nothing publishes or spends before it.
import { useEffect, useRef, useState } from 'react'
import ShinyText from './reactbits/ShinyText'
import StatusMark from './reactbits/StatusMark'
import './reactbits/reactbits.css'
import './results.css'
import { Icon } from './ui'
import { useUi } from '../lib/store'
import { at, type Task } from '../skills/router.ts'
import { approve, cancel, useTask } from '../skills/task'

// Shiny Text parses colour strings (CSS vars do not parse): text token with a soft accent sheen, per theme.
const SHINE = { light: { color: '#0F1B2D', shine: '#008CA8' }, dark: { color: '#E6EDF7', shine: '#008CA8' } }

function Waiting({ leaving }: { leaving?: boolean }) {
  const s = SHINE[useUi(u => u.theme)]
  return (
    <div className={`rw${leaving ? ' rw-leaving' : ''}`} aria-hidden={leaving || undefined}>
      <div className="rw-mark">
        <StatusMark className="rb-sm" status="pending" color="var(--accent)" size={88} strokeWidth={1.4} dashes={12} />
        <Icon name="tb-file-text" size={30} stroke={1.6} />
      </div>
      <h3 className="rw-title" role="status"><ShinyText className="rb-shiny" text="Waiting for a task" color={s.color} shineColor={s.shine} speed={3.2} delay={1.2} shineWidth={30} /></h3>
      <p className="rw-sub">Ask in the middle - a skill picks it up from there.<br />Approvals and results open here.</p>
    </div>
  )
}

export function ResultsPane() {
  const task = useTask(s => s.task)
  // A task is "started" once a skill has a plan for it; a clarifying question alone keeps the waiting state.
  const shown = task && task.phase !== 'clarify' ? task : null
  const [leaving, setLeaving] = useState(false)
  const had = useRef(!!shown)
  useEffect(() => { if (!had.current && shown) setLeaving(true); had.current = !!shown }, [shown])
  useEffect(() => { if (!leaving) return; const t = setTimeout(() => setLeaving(false), 450); return () => clearTimeout(t) }, [leaving])
  if (!shown) return <div className="rw-main"><Waiting /></div>
  return (
    <div className="rw-main">
      {leaving && <Waiting leaving />}
      <TaskView task={shown} enter={leaving} />
    </div>
  )
}

function TaskView({ task, enter }: { task: Task; enter: boolean }) {
  const { skill, sub, step } = at(task.route!)
  const approved = task.phase === 'approved'
  return (
    <div className={`rs${enter ? ' rw-enter' : ''}`}>
      <section className="rs-card">
        <h3 className="rs-kicker">Request</h3>
        <p className="rs-request">“{task.request}”</p>
        {task.answer && <p className="rs-answer"><Icon name="tb-pencil" size={13} />{task.answer}</p>}
        <p className="rs-route"><span>{skill.name}</span><Icon name="chevron" size={11} /><span>{sub.name}</span></p>
      </section>

      <section className="rs-card">
        <h3 className="rs-kicker">Plan · {sub.name}</h3>
        <ol className="rs-steps">
          {sub.steps.map(s => (
            <li key={s.name} className={s === step ? 'on' : undefined}>
              <StatusMark className="rb-sm" status="pending" size={16} strokeWidth={1.6} color="var(--accent)" />
              <span className="rs-step"><strong>{s.name}</strong>{s.description && <span>{s.description}</span>}</span>
              {s === step && <span className="rs-tag">Starts here</span>}
            </li>
          ))}
        </ol>
      </section>

      <section className={`rs-card rs-approval${approved ? ' done' : ''}`} aria-live="polite">
        {approved ? <>
          <h3 className="rs-approval-title"><StatusMark className="rb-sm" status="done" size={18} strokeWidth={1.8} color="var(--accent)" doneColor="var(--ok)" />Approved</h3>
          <p className="rs-note">Not run yet: no publishing, ad or analytics account is connected, so nothing was published or spent.</p>
        </> : <>
          <h3 className="rs-approval-title"><Icon name="shield" size={16} />Approval needed</h3>
          <p className="rs-note">Nothing publishes or spends until you approve this plan.</p>
          <div className="rs-actions">
            <button className="btn btn-secondary" onClick={cancel}>Cancel</button>
            <button className="btn btn-primary" onClick={approve}><Icon name="check" size={14} />Approve</button>
          </div>
        </>}
      </section>
    </div>
  )
}
