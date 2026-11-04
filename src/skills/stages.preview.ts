// DEV-ONLY wireframe fixture (open the app with ?qwPreview). Illustrative values from the design brief, not live task
// status. Never imported in production builds: the rail only reads it behind import.meta.env.DEV.
import type { Model } from './stages.ts'

export const PREVIEW: Model = {
  selected: 'pfmea',
  ctx: { type: 'New part', part: '1801EA300070N', rev: '02', desc: 'CABLE OUTPUT 2.7KW AMP', status: 'waiting-input', statusLabel: 'Waiting for team S/O/D', next: 'Collect S/O/D ratings from the team' },
  stages: {
    intake: { status: 'complete', label: 'Complete', subs: { 0: 'complete', 1: 'complete', 2: 'complete', 3: 'complete' } },
    pfd: { status: 'approved', label: 'Approved', subs: { 0: 'approved', 1: 'approved', 2: 'approved' } },
    pfmea: { status: 'waiting-input', label: 'Waiting for team S/O/D', subs: { 0: 'complete', 1: 'complete', 2: 'complete', 3: 'waiting-input' } },
    cp: { status: 'blocked', label: 'Waiting for approved PFMEA' },
    approval: { status: 'not-started', label: 'Release approval pending' },
    output: { status: 'not-started', label: 'After approval' },
  },
}
