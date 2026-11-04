// Dependency-free JSON document store. Chosen for zero-config local runs (POC stage);
// the collection API is a thin seam that can move to Postgres later without route changes.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from './config.ts'

type Collections = Record<string, Record<string, any>>

const COLLECTIONS = ['projects', 'documents', 'operations', 'fmeaRows', 'cpRows', 'eightDs', 'approvals', 'audits', 'revisions']

let state: Collections = {}
let dbFile = path.join(config.dataDir, 'db.json')

export function initDb(dataDir?: string) {
  if (dataDir) {
    config.dataDir = dataDir
    dbFile = path.join(dataDir, 'db.json')
  }
  fs.mkdirSync(config.dataDir, { recursive: true })
  fs.mkdirSync(path.join(config.dataDir, 'uploads'), { recursive: true })
  fs.mkdirSync(path.join(config.dataDir, 'exports'), { recursive: true })
  if (fs.existsSync(dbFile)) {
    state = JSON.parse(fs.readFileSync(dbFile, 'utf8'))
  }
  for (const c of COLLECTIONS) state[c] ??= {}
}

function persist() {
  const tmp = dbFile + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(state))
  fs.renameSync(tmp, dbFile) // atomic on POSIX
}

export const db = {
  insert<T extends { id: string }>(collection: string, doc: T): T {
    state[collection][doc.id] = doc
    persist()
    return doc
  },
  update<T extends { id: string }>(collection: string, id: string, patch: Partial<T>): T {
    if (!state[collection][id]) throw Object.assign(new Error(`${collection}/${id} not found`), { status: 404 })
    state[collection][id] = { ...state[collection][id], ...patch }
    persist()
    return state[collection][id]
  },
  get<T>(collection: string, id: string): T | undefined {
    return state[collection][id]
  },
  all<T>(collection: string): T[] {
    return Object.values(state[collection]) as T[]
  },
  where<T>(collection: string, pred: (doc: T) => boolean): T[] {
    return (Object.values(state[collection]) as T[]).filter(pred)
  },
  remove(collection: string, id: string) {
    delete state[collection][id]
    persist()
  },
  newId(): string {
    return crypto.randomUUID()
  },
}
