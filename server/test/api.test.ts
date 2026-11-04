// Smoke test: full lifecycle project -> intake -> pfd -> pfmea -> cp -> 8d -> approval -> export.
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.QR_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-test-'))

const { initDb, db } = await import('../src/db.ts')
initDb()
const { actionPriority } = await import('../src/domain/apTable.ts')
const { addOperation, orderedOperations, classifyOperation } = await import('../src/domain/pfdEngine.ts')
const { draftFromPfd, updateRatings } = await import('../src/domain/fmeaEngine.ts')
const { draftFromPfmea, consistencyCheck } = await import('../src/domain/cpEngine.ts')
const { createEightD, setRootCause } = await import('../src/domain/eightDEngine.ts')

const PID = 'test-project'

before(() => {
  db.insert('projects', {
    id: PID, partNumber: '1801EA300070N', partRevision: 'B', partDescription: 'CABLE OUTPUT 2.7KW AMP',
    customer: 'INDIC EMS', customerRequirements: [], applicableStandards: ['IATF 16949'],
    processOwner: 'MANJUNATH HN', coreTeam: ['GIRISH P', 'RADHIKA BV'], status: 'intake',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
})

test('AP banded rules match AIAG-VDA restatement', () => {
  assert.equal(actionPriority(9, 1, 1), 'H')
  assert.equal(actionPriority(10, 10, 10), 'H')
  assert.equal(actionPriority(8, 6, 3), 'H')
  assert.equal(actionPriority(8, 4, 6), 'H')
  assert.equal(actionPriority(8, 4, 5), 'M')
  assert.equal(actionPriority(8, 2, 9), 'M')
  assert.equal(actionPriority(7, 6, 7), 'H')
  assert.equal(actionPriority(7, 6, 5), 'M')
  assert.equal(actionPriority(7, 4, 2), 'L')
  assert.equal(actionPriority(6, 8, 7), 'H')
  assert.equal(actionPriority(6, 5, 5), 'L')
  assert.equal(actionPriority(4, 9, 9), 'L')
  assert.throws(() => actionPriority(0, 5, 5))
})

test('operation classification', () => {
  assert.equal(classifyOperation('Incoming quality inspection'), 'inspection')
  assert.equal(classifyOperation('Receipt of raw material'), 'storage')
  assert.equal(classifyOperation('Crimping terminal'), 'process')
})

test('pfd -> pfmea draft -> rating -> cp -> consistency', () => {
  addOperation(PID, 'Receipt of raw material from stores')
  addOperation(PID, 'Crimping terminal')
  assert.equal(orderedOperations(PID).length, 2)
  const rows = draftFromPfd(PID, 'test')
  assert.ok(rows.length >= 3)
  assert.ok(rows.every(r => r.rpn === r.severity * r.occurrence * r.detection))
  assert.ok(rows.every(r => ['H', 'M', 'L'].includes(r.ap)))
  const crimp = rows.find(r => /crimp/i.test(r.failureMode))!
  const updated = updateRatings(crimp.id, { severity: 8, occurrence: 6, detection: 6 })
  assert.equal(updated.ap, 'H')
  const cps = draftFromPfmea(PID)
  assert.equal(cps.length, 2)
  assert.equal(consistencyCheck(PID).filter(i => i.kind === 'pfmea-without-control').length, 0)
})

test('8D rejects bare human-error root cause', () => {
  const ed = createEightD(PID, 'CUST-001', { what: 'open circuit', where: 'customer line', when: '2026-11-01', howMany: '12 of 500' }, ['QE', 'PE'])
  assert.throws(() => setRootCause(ed.id, ['a', 'b', 'c'], 'human error'))
  assert.throws(() => setRootCause(ed.id, ['a'], 'fixture worn'))
  const ok = setRootCause(ed.id, ['open circuit', 'terminal loose', 'crimp low', 'applicator worn', 'PM missed'], 'applicator preventive maintenance interval exceeded')
  assert.equal(ok.d4RootCause.method, '5why')
})
