// The router (intake, one clarifying question, plan read-back, approval gate). Pure, so it runs in Node tests.
// It is not a rail item: the assistant pane owns it. Skills come from skills.config.ts only.
// ponytail: keyword scoring, no model. Swap `route` for an LLM classifier when one is connected; keep `intake`.
import { SKILLS, type Skill, type Step, type Subskill } from './skills.config.ts'

export interface Route { skill: number; sub: number; step: number }
export type Phase = 'clarify' | 'approval' | 'approved'
export interface Task { id: number; request: string; answer?: string; route?: Route; phase: Phase }

const STOP = new Set('a an the and or for to of my me i we our us you your it its this that these is are was be do did does how what when where which who can could would will should please make get some any with on in at by from just need want help like into about up out new not sure'.split(' '))
const stem = (t: string) => { const s = t.replace(/(ing|ly|ed|s)$/, ''); return s.length >= 3 ? s : t }
export const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(t => t.length > 1 && !STOP.has(t)).map(stem)
const has = (words: string[], t: string) => words.includes(t)

/** The best skill › subskill › step for a request, or undefined when nothing fits (score under 3 = no name hit). */
export function route(text: string): Route | undefined {
  const toks = tokens(text)
  let best: (Route & { score: number }) | undefined
  SKILLS.forEach((sk, i) => {
    const kw = sk.keywords.map(stem)
    sk.subskills.forEach((sub, j) => {
      const subWords = tokens(sub.name)
      sub.steps.forEach((st, k) => {
        const name = tokens(st.name), desc = tokens(st.description)
        const score = toks.reduce((n, t) => n + (has(name, t) ? 3 : 0) + (has(desc, t) ? 1 : 0) + (has(subWords, t) ? 1 : 0) + (has(kw, t) ? 2 : 0), 0)
        if (score >= 3 && (!best || score > best.score)) best = { skill: i, sub: j, step: k, score }
      })
    })
  })
  return best && { skill: best.skill, sub: best.sub, step: best.step }
}

export const at = (r: Route): { skill: Skill; sub: Subskill; step: Step } =>
  ({ skill: SKILLS[r.skill], sub: SKILLS[r.skill].subskills[r.sub], step: SKILLS[r.skill].subskills[r.sub].steps[r.step] })

/** One question per skill, asked once when a request is too short to act on. */
export const QUESTION: Record<string, string> = {
  intake: 'Which part number and files should I load?',
  pfd: 'Which part number (and revision) is the PFD for?',
  pfmea: 'Which part number, and is the PFD approved?',
  cp: 'Which part number, and is the PFMEA approved?',
  '8d': 'Which customer complaint or internal failure is this for?',
  approval: 'Which draft should go for approval?',
  output: 'Which approved document should I export?',
}
export const UNROUTED = 'What would you like done: load data, a PFD, PFMEA, Control Plan, 8D, an approval, or an export?'
export const NO_MATCH = "I couldn't match that to a skill yet. Pick one on the left, or say it another way."
export const APPROVED = 'Approved. Nothing has been released: no document store or approval gate is connected yet, so the approved plan waits in Results & edits.'
export const CANCELLED = 'Cancelled. Nothing was released.'

export function readBack(t: Task): string {
  const { skill, sub, step } = at(t.route!)
  return [
    "Here's the plan:",
    `• Skill: ${skill.name} › ${sub.name}`,
    `• Starts with: ${step.name}${step.description ? ` - ${step.description}` : ''}`,
    `• Your request: "${t.request}"${t.answer ? ` (${t.answer})` : ''}`,
    'Nothing is released until you approve. Approve it in Results & edits, or tell me what to change.',
  ].join('\n')
}

const YES = /^(yes|yep|approve[d]?|go ahead|ok(ay)?|do it|looks good)\b/i
const NO = /^(no|nope|cancel|stop|don'?t)\b/i
// A request with four meaningful words or fewer is missing something: ask once.
const thin = (text: string) => tokens(text).length <= 4

/** One turn of the router: the next task (null = none) and the reply. Never approves on its own. */
export function intake(text: string, task: Task | null, id = Date.now()): { task: Task | null; reply: string } {
  const msg = text.trim()
  if (task?.phase === 'approval') {
    if (YES.test(msg)) return { task: { ...task, phase: 'approved' }, reply: APPROVED }
    if (NO.test(msg)) return { task: null, reply: CANCELLED }
    // Anything else changes the plan: re-route the request with the change, then read it back again.
    const next = { ...task, answer: [task.answer, msg].filter(Boolean).join('; '), route: route(`${task.request} ${task.answer ?? ''} ${msg}`) ?? task.route }
    return { task: next, reply: readBack(next) }
  }
  if (task?.phase === 'clarify') {
    const r = task.route ?? route(`${task.request} ${msg}`)
    if (!r) return { task: null, reply: NO_MATCH }
    const next: Task = { ...task, answer: msg, route: r, phase: 'approval' }
    return { task: next, reply: readBack(next) }
  }
  const r = route(msg)
  if (!r) return { task: { id, request: msg, phase: 'clarify' }, reply: UNROUTED }
  if (thin(msg)) return { task: { id, request: msg, route: r, phase: 'clarify' }, reply: QUESTION[SKILLS[r.skill].id] }
  const next: Task = { id, request: msg, route: r, phase: 'approval' }
  return { task: next, reply: readBack(next) }
}
