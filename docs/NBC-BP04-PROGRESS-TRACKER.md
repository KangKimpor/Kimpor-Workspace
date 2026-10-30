# NBC BP04 local implementation

NBC BP04 – Pan Pacific Hotel reuses BP03's three views and handler workflow. The legacy `nbcBp03` boolean is the shared BOQ-workflow switch; both projects use it. Existing BP03 IDs and data remain unchanged. BP04 uses project ID `nbc-bp04` and activity IDs `nbc-bp04:<WBS>`, including parent links. Submission IDs, raw draft recovery, summaries, CSV filenames, Excel filenames and stored templates are scoped by project. Every editor/history action now passes its project ID to the shared actions. BP03 defaults remain for compatibility with existing callers.

## Authorized sources

- Activities, WBS, durations, BOQ weights, assignments and initial progress: `C:/Users/Por/Downloads/NBC-BP04-Progress Tracking by BOQ.xlsx`, SHA-256 `bc1777cffbd7d49e25eb976a2275f3ae445d11b574b50262ea82e9d606f85370`.
- Construction dates and planned curve only: `G:/Shared drives/PROJECT DEPARTMENT/NBC - External Weekly Report/20. 18 October to 24 October/BP-04/3. & 6. BP-04 - Weekly 23 - 18 Oct - 24 Oct 2026.xlsx`. `PI(p)!B27/D27` gives 18 March–20 June 2026. `S-Curve BP04!B44:AH44` and `B47:AH47` give 33 planned points. The user explicitly approved aligning the curve's 2025 dates to 2026. No activities, actual percentages or history from this report were imported. BP03's plan remains unchanged.

## Reconciliation

The local extractor verifies all 382 WBS rows: 98 parents and 284 editable entries (283 assigned plus shared GR&P). Assignments: Sitha 84, Lychhinh 19, Chhorvaon 6, Srun 34, Kheng 22, Tola 118. Root and effective leaf weights both total 1.0. BOQ total is USD 1,518,404.74. Initial overall progress is 0%, matching the workbook. Every parent, duration-derived relative weight, propagated global weight, handler-linked percentage and root BOQ share is checked against the source. The baseline is undated; no historical confirmation/report is fabricated from it.

## Local review

Private source files and preparation outputs remain under ignored `.private/nbc-bp04/`, outside source control and public build assets. Regenerate with the bundled Python runtime (with openpyxl):

```powershell
python scripts/nbc-bp04-extract.py 'C:/Users/Por/Downloads/NBC-BP04-Progress Tracking by BOQ.xlsx'
corepack pnpm build
corepack pnpm preview
```

In another terminal, run `node scripts/nbc-local-preview.mjs`. This opens a dedicated persistent local browser profile containing the existing private BP03 baseline plus BP04. It only adds missing projects and never resets existing local edits. All non-localhost requests are blocked. Reopening preserves edits. This profile is separate from the signed-in/live workspace. For local Excel export, choose `.private/nbc-bp04/template.xlsx` once in BP04's export dialog.

## Remaining release setup — not performed

The forward migration `20261030090000_nbc_multiple_projects.sql` replaces singleton project indexes with uniqueness per project ID and lets existing company-owner lookup serve both projects. A guard preserves one canonical storage owner. Existing project/BOQ/handler/permission guards remain active. The existing company-wide advisory lock is retained; project data filtering remains separate. No existing rows are rewritten by this migration.

After separate release authorization, reconcile deployed migration history as described in the BP03 notes, back up the database, apply only the reviewed forward migration and run the private BP04 `initialize.sql` with the existing BP03 storage owner. The initializer matches the exact target project, inserts missing activities/template only and preserves existing progress/history on rerun. Do not rerun historical migrations or reseed BP03. Deploy the matching frontend and perform signed-in staging acceptance checks. No live migration, import, deployment or live-database test has been performed in this task.

## Verification

`corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm lint`, the production build and `git diff --check` pass. New unit checks cover both-project actions, cross-project rejection, distinct plans, private BP04 reconciliation and source-template export totals after an edit. All 33 planned points and both construction dates were independently compared with the authorized report ranges.

The disposable PostgreSQL check (`node scripts/nbc-bp03-db-check.mjs`) passes existing BP03 checks plus two-project ownership/access, cross-project entry rejection, confirmation and exact private BP04 initialization twice with unchanged BP03 rows. Browser tests in Chromium and WebKit pass synthetic and real-private-workbook two-project navigation, draft recovery after refresh, confirmation, weighted summary totals, history, BP04 Excel download and isolation in both directions. Existing BP03 Chromium workflow/export/responsive checks also pass; its optional private-template test skips when that older template fixture is absent.
