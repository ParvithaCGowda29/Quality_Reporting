import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.QR_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-cl-'))
const { initDb, db } = await import('../src/db.ts')
initDb()
const { evaluateChecklist, setConfirmation, CONFIRMABLE_KEYS } = await import('../src/domain/checklist.ts')
const { addOperation } = await import('../src/domain/pfdEngine.ts')

const PID = 'cl-project'
before(() => {
  db.insert('projects', {
    id: PID, partNumber: 'X1', partRevision: 'A', partDescription: 'test part', customer: 'C',
    customerRequirements: [], applicableStandards: [], processOwner: 'SPOC NAME', coreTeam: ['A', 'B'],
    status: 'intake', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  })
})

const byKey = (items: any[], k: string) => items.find(i => i.key === k)

test('document kinds tick their items; generic template ticks all four', () => {
  db.insert('documents', { id: 'd1', projectId: PID, kind: 'template', filename: 't.xlsx', storedPath: '/x', byteSize: 1, uploadedBy: 'u', uploadedAt: '', scanStatus: 'clean', parseStatus: 'pending' })
  db.insert('documents', { id: 'd2', projectId: PID, kind: 'pfd', filename: 'pfd.xlsx', storedPath: '/x', byteSize: 1, uploadedBy: 'u', uploadedAt: '', scanStatus: 'clean', parseStatus: 'pending' })
  const items = evaluateChecklist(PID)
  for (const k of ['pfd-template', 'pfmea-template', 'cp-template', '8d-template', 'sample-pfd']) {
    assert.equal(byKey(items, k).satisfied, true, k)
  }
  assert.equal(byKey(items, 'sample-pfmea').satisfied, false)
  assert.equal(byKey(items, 'spoc').satisfied, true)
  assert.equal(byKey(items, 'core-team').satisfied, true)
})

test('process-data ticks once operations exist', () => {
  assert.equal(byKey(evaluateChecklist(PID), 'process-data').satisfied, false)
  addOperation(PID, 'Crimping terminal')
  assert.equal(byKey(evaluateChecklist(PID), 'process-data').satisfied, true)
})

test('non-document items confirm explicitly and reject unknown keys', () => {
  assert.equal(byKey(evaluateChecklist(PID), 'scope-approval').satisfied, false)
  const items = setConfirmation(PID, 'scope-approval', true)
  assert.equal(byKey(items, 'scope-approval').satisfied, true)
  assert.throws(() => setConfirmation(PID, 'sample-pfd', true))
  assert.equal(CONFIRMABLE_KEYS.length, 5)
  const after = setConfirmation(PID, 'scope-approval', false)
  assert.equal(byKey(after, 'scope-approval').satisfied, false)
})
