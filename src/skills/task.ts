// One store for the current task and the rail's selection, read by all three panes.
import { useSyncExternalStore } from 'react'
import { intake, APPROVED, CANCELLED, type Route, type Task } from './router.ts'

export interface TaskState {
  task: Task | null
  /** Rail: the active skill (expanded), its open subskill, and the highlighted step. */
  skill: number
  open: boolean
  sub: number | null
  step: number | null
  /** A message a pane posts to the assistant thread (Approve / Cancel in Results & edits). Appended once per id. */
  note?: { id: number; text: string }
  /** + Task: bumps to clear the thread and focus the composer. */
  fresh: number
}

let state: TaskState = { task: null, skill: 0, open: true, sub: 0, step: null, fresh: 0 }
const subs = new Set<() => void>()
const set = (p: Partial<TaskState>) => { state = { ...state, ...p }; subs.forEach(f => f()) }
export const useTask = <T,>(pick: (s: TaskState) => T) =>
  useSyncExternalStore(cb => { subs.add(cb); return () => { subs.delete(cb) } }, () => pick(state))
export const getTask = () => state

const focus = (r?: Route) => r ? { skill: r.skill, open: true, sub: r.sub, step: r.step } : {}

/** The assistant's turn: run the router and move the rail to the skill that picked the task up. */
export function sendToRouter(text: string): string {
  const { task, reply } = intake(text, state.task)
  set({ task, ...focus(task?.route) })
  return reply
}

export function approve() { if (state.task?.phase === 'approval') set({ task: { ...state.task, phase: 'approved' }, note: { id: Date.now(), text: APPROVED } }) }
export function cancel() { if (state.task) set({ task: null, note: { id: Date.now(), text: CANCELLED } }) }
export function newTask() { set({ task: null, step: null, fresh: state.fresh + 1 }) }

export function pickSkill(i: number) { set(state.skill === i ? { open: !state.open } : { skill: i, open: true, sub: null, step: null }) }
/** Stepper selection: opens the skill's context in the other panes. Never toggles, never starts work. */
export function selectSkill(i: number) { if (state.skill !== i) set({ skill: i, open: true, sub: null, step: null }) }
export function selectSub(i: number, j: number) { set({ skill: i, open: true, sub: j, step: null }) }
export function pickSub(i: number) { set({ sub: state.sub === i ? null : i, step: null }) }
