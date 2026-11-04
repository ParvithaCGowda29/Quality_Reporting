import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SKILLS } from './skills.config.ts'
import { APPROVED, CANCELLED, NO_MATCH, UNROUTED, intake, route } from './router.ts'

test('seven skills, every subskill has steps', () => {
  assert.equal(SKILLS.length, 7)
  for (const s of SKILLS) { assert.ok(s.subskills.length >= 3, s.name); for (const sub of s.subskills) assert.ok(sub.steps.length > 0, sub.name) }
})

test('the starter chips route to the right skill', () => {
  const skill = (t: string) => SKILLS[route(t)!.skill].id
  assert.equal(skill('Draft the PFD for part 1801EA300070N'), 'pfd')
  assert.equal(skill('Draft the PFMEA failure modes and ratings'), 'pfmea')
  assert.equal(skill('Start an 8D for the INDIC complaint'), '8d')
  assert.equal(skill('What data is still missing for the PFMEA?'), 'intake')
  assert.equal(route('hello there'), undefined)
})

test('short request: one clarifying question, then the plan, then a hard stop for approval', () => {
  const a = intake('Draft the PFD', null, 1)
  assert.equal(a.task?.phase, 'clarify')
  const b = intake('part 1801EA300070N revision 02', a.task, 1)
  assert.equal(b.task?.phase, 'approval')
  assert.match(b.reply, /PFD Generation/)
  assert.match(b.reply, /until you approve/)
  assert.equal(intake('use the sample template', b.task).task?.phase, 'approval')
  assert.deepEqual(intake('yes', b.task), { task: { ...b.task!, phase: 'approved' }, reply: APPROVED })
  assert.deepEqual(intake('cancel', b.task), { task: null, reply: CANCELLED })
})

test('detailed request goes straight to approval; unknown asks once, then gives up honestly', () => {
  assert.equal(intake('Draft the PFMEA for part 1801EA300070N from the approved PFD with failure modes and controls', null).task?.phase, 'approval')
  const u = intake('hello', null, 2)
  assert.deepEqual([u.task?.phase, u.reply], ['clarify', UNROUTED])
  assert.equal(intake('not sure', u.task).reply, NO_MATCH)
})

test('stepper model: 8D off the main path, PFD has 3 subskills, no invented status, approval never inferred', async () => {
  const { MAIN_PATH, BRANCH, modelFromTask, subSummary } = await import('./stages.ts')
  const ids = SKILLS.map(s => s.id)
  assert.equal(MAIN_PATH.length, 6)
  assert.deepEqual(BRANCH.map(b => b.id), ['8d'])
  assert.deepEqual([...MAIN_PATH, ...BRANCH].map(m => SKILLS[ids.indexOf(m.id)].subskills.length).sort(), [3, 4, 4, 4, 4, 4, 4])
  assert.deepEqual(modelFromTask(null, ids), { ctx: null, stages: {} })
  const a = intake('Draft the PFD for part 1801EA300070N rev 02 with operations', null, 1).task
  const m = modelFromTask(a, ids)
  assert.deepEqual([m.ctx?.part, m.ctx?.rev, m.ctx?.desc, m.stages.pfd?.status], ['1801EA300070N', '02', undefined, 'waiting-approval'])
  assert.equal(Object.keys(m.stages).length, 1)
  assert.equal(subSummary(4), '4 sub-skills')
  assert.equal(subSummary(4, { 0: 'complete', 1: 'complete', 2: 'complete', 3: 'waiting-input' }), '3 of 4 sub-skills complete')
})
