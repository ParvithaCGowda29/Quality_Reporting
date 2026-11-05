# BuLLM Quality Reporting backend

End-to-end backend for the Quality Reporting Agent (client: Innotech Integration Service).
Implements the 7 skills from the UI (`src/skills/skills.config.ts`): Data Intake, PFD
Generation, PFMEA Generation, Control Plan Generation, 8D Generation, Human Approval,
Output & Audit.

## Run

```bash
cd server
npm install
npm run dev        # http://localhost:8787  (Node >= 22.6, type-stripping, no build step)
npm test           # smoke tests: AP rules, classification, PFD->PFMEA->CP chain, 8D rules
```

Frontend: `npm run dev` at the repo root (port 5176) proxies `/api` to 8787
(vite.config.ts), so the UI and backend run side by side.

## API map (all under /api)

| Skill | Endpoints |
|---|---|
| Projects | `POST/GET /projects`, `GET/PATCH /projects/:id` (GET embeds the 19-item checklist) |
| Data Intake | `POST /intake/:pid/documents` (multipart upload, scan policy, auto-parse Innotech PFD/PFMEA Excel into process data), `GET /intake/:pid/documents`, `GET /intake/:pid/checklist` (missing-data halt), `POST /intake/:pid/checklist/confirm` `{key, confirmed}` for the 5 non-document items (qe-review, scope-approval, sharepoint-route, approval-decision, change-approval) |
| PFD | `POST /pfd/:pid/operations` (auto op number + classification), `GET /pfd/:pid/operations` |
| PFMEA | `POST /pfmea/:pid/draft` (one row group per PFD operation; runs IATF 16949 check BEFORE rating review, per the agreed skills doc), `GET /pfmea/:pid/rows`, `PATCH /pfmea/rows/:rowId` (recomputes RPN + AIAG-VDA AP), `GET /pfmea/:pid/actions` (H-AP items), `GET /pfmea/:pid/iatf-check` |
| Control Plan | `POST /control-plan/:pid/draft` (PFMEA+PFD mapping, reaction plans), `GET/PATCH .../rows`, `GET /control-plan/:pid/consistency` (two-way PFMEA<->control check) |
| 8D | `POST /8d/:pid` (D0-D2 intake), `POST /8d/:id/root-cause` (5-Why; rejects bare "human error"), `PATCH /8d/:id` (D3-D8), `GET /8d/:pid/list` |
| Human Approval | `POST /approvals/:pid/submit`, `GET /approvals/:pid/tasks`, `POST /approvals/tasks/:taskId/decide` (approved / returned / rejected) |
| Output & Audit | `POST /output/:pid/export/:kind` (release-gated: only approved drafts export; stamps revision), `GET /output/:pid/download/:revId`, `GET /output/:pid/audit` (full trail), `GET /output/:pid/alerts` |

Acting QE identity goes in the `x-qe-name` header (recorded in approvals and the audit trail).

## Engineering decisions (visible per project convention)

1. **Same repo, Node 22 + TypeScript, no build step** - `node --experimental-strip-types`,
   same pattern as the repo's existing test script. Express + exceljs + docx + multer are
   the only deps.
2. **LLM token stays in the UI repo** (`src/config/app.config.ts`). The backend never
   stores or configures it; the frontend sends `x-llm-api-key` per request for optional
   enrichment. Without a key, generation is fully deterministic (BuLLM's deterministic-first rule).
3. **JSON document store** (`server/data/`, gitignored, atomic writes) - zero-config for
   the POC. The collection API is the seam to move to Postgres later.
4. **Both risk scores computed**: legacy RPN (Innotech's current sheets use it) and
   AIAG-VDA Action Priority (banded-rule restatement from RBraga01/Quality-Engineering-Skills,
   MIT). Disputed/PPAP ratings still need the licensed AIAG-VDA handbook - the code says so.
5. **Release gate enforced**: export refuses unapproved drafts; revisions are stamped
   (rev no + date) and every draft/edit/rating/approval writes an audit record.
6. **Branding**: Innotech + DigiBull logos (from the quality-workflow Drive) are bundled
   in `server/assets/` and embedded in every exported document.
8. **Checklist semantics**: document items tick by upload `kind` (specific template kinds tick one item; generic `template` ticks all four); `process-data` ticks automatically once PFD operations exist; the 5 agreement/access items confirm via the endpoint above.
9. **Intake parser is header-driven** against Innotech's real file layout - verified on
   their 20-operation 2.7KW AMP cable PFD (all 20 operations captured).

## Known gaps / next steps

- UI should offer the upload kind select (incl. pfd-template / pfmea-template / cp-template / 8d-template / drawing) and a confirm control for the 5 non-document checklist items.

- Wire the UI's assistant router and Results pane to `src/api/client.ts` (client is ready).
- Virus scan is a policy stub (blocks executables); hook ClamAV or a cloud scanner.
- SharePoint intake watch is not built - upload endpoint is the intake route for now.
- Alerts endpoint returns pending approvals; email/WhatsApp notification wiring is open.
