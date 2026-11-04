import { db } from './db.ts'
import type { AuditEvent } from './types.ts'

// Output & Audit skill: every draft, edit, rating and approval writes an audit record.
export function audit(projectId: string, actor: string, action: string, detail: string) {
  const evt: AuditEvent = {
    id: db.newId(),
    projectId,
    at: new Date().toISOString(),
    actor,
    action,
    detail,
  }
  db.insert('audits', evt)
  return evt
}
