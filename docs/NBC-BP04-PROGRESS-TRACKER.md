# NBC BP04 progress tracker

## Live release · 30 October 2026

The user authorized completing the live setup after pushing the implementation to main. BP04 is now initialized in Supabase project `nlcpjdokfvawlpzyfytx` and available through [the production workspace](https://kimpor-workspace.vercel.app/projects-progress). Vercel production deployment `dpl_9wsNJtDhJJK9wxj9mNdyxn6S1gxT` serves implementation commit `f1cdc165f0ce0e10b1edf749b1876c47bd023c06`; its workspace and performance CI runs both passed.

Applied only the reviewed forward changes: live migration `20261030021230` (`nbc_multiple_projects`, corresponding to local `20261030090000`) and `20261030021231` (`nbc_deadline_saturday_noon`, corresponding to local `20261028090000`). The latter was pending in production: server deadlines now match the frontend's Saturday noon Phnom Penh rule. Existing confirmations were not restamped. Do not push the historical migration directory blindly; older local/live version differences remain documented in the BP03 notes.

The guarded BP04 initializer used the existing company storage owner, inserted 382 activities and the private source Excel template, and created no historical submissions or summaries. All imported source fields match the BOQ workbook. The saved template's SHA-256 matches the source. The database now contains 790 BP03 activities and 382 BP04 activities. Before/after snapshots are saved privately as `.private/nbc-bp04/release-20261030-before.json` and `release-20261030-after.json`. BP03's project, activities, reports, submissions, summaries and template compare exactly with the pre-release backup.

Live authenticated-role checks passed shared-project/template reads, draft autosave without changing live progress, confirmation, weighted summary calculation, reopen, delete/restore and cross-project entry rejection. All verification writes ran inside a rolled-back transaction; a final comparison confirmed no test residue. RLS remains enabled for all NBC tables, and anonymous roles cannot execute the NBC owner or submission functions. Supabase's security advisor reports no new BP04 exposure; its existing legacy-function/password notices are outside this change. The owner lookup is intentionally executable only by authenticated users under the existing company-sharing design. [Advisor reference](https://supabase.com/docs/guides/database/database-linter).

No release setup remains. Signed-in production browser acceptance is the remaining verification limit: the Windows computer-use tool stopped the Firefox check because URL-policy enforcement is unsupported for that browser. No browser actions were attempted after that stop. Local Chromium/WebKit persistence/export/isolation checks and live database-role verification passed; they do not substitute for that production browser check.

NBC BP04 – Pan Pacific Hotel reuses BP03's three views and handler workflow. The legacy `nbcBp03` boolean is the shared BOQ-workflow switch; both projects use it. Existing BP03 IDs and data remain unchanged. BP04 uses project ID `nbc-bp04` and activity IDs `nbc-bp04:<WBS>`, including parent links. Submission IDs, raw draft recovery, summaries, CSV filenames, Excel filenames and stored templates are scoped by project. Every editor/history action now passes its project ID to the shared actions. BP03 defaults remain for compatibility with existing callers.

## XLSX progress import

In **Project Progress**, choose **Import XLSX**, select the project's BOQ workbook, review the changes and choose **Import drafts**. Import accepts the supplied BP04 seven-sheet workbook and matching BP03 workbooks. Each ordinary leaf reads its handler-sheet Accumulation % input (column M); shared GR&P reads Progress column N. Cached parent/master formulas are not authoritative and no spreadsheet formulas execute. Preview recalculates overall progress from the existing project weights.

WBS rows, task names and relative/global weights must match the selected project. Blank, formula, nonnumeric, out-of-range, missing and duplicate handler inputs are rejected. Import changes percentages only: hierarchy, weights, assignments, historical weeks and templates remain intact. Lowered progress requires a reason, copied into its activity remarks. A changed shared GR&P value requires an explicit responsible handler and appears in only that handler's draft.

Changed handlers receive current-week drafts through the existing autosave/offline queue in one validated local commit. Live progress stays unchanged until each handler confirms through **Update Progress**. Existing drafts/raw recovery are protected unless **Replace affected drafts** is explicitly checked. Confirmed handlers must choose **Edit** first; reimport retains their last applied values until reconfirmation. No database migration or new dependency is needed.

The failed main-branch build shown on 30 October was the initial stylesheet size budget. Sidebar-only `stitch.css` now loads with the signed-in shell, bringing initial CSS below the existing 15 KiB gzip budget without changing the threshold.

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

## Release procedure

The forward migration `20261030090000_nbc_multiple_projects.sql` replaces singleton project indexes with uniqueness per project ID and lets existing company-owner lookup serve both projects. A guard preserves one canonical storage owner. Existing project/BOQ/handler/permission guards remain active. The existing company-wide advisory lock is retained; project data filtering remains separate. No existing rows are rewritten by this migration.

The authorized release followed the backup, reviewed-forward-migration and private BP04 initialization procedure above. The initializer matches the exact target project, inserts missing activities/template only and preserves existing progress/history on rerun. Do not rerun historical migrations or reseed BP03. The matching frontend was already deployed by the main-branch push, so no additional application deployment was necessary.

## Verification

`corepack pnpm test`, `corepack pnpm typecheck`, `corepack pnpm lint`, the production build and `git diff --check` pass. New unit checks cover both-project actions, cross-project rejection, distinct plans, private BP04 reconciliation and source-template export totals after an edit. All 33 planned points and both construction dates were independently compared with the authorized report ranges.

The disposable PostgreSQL check (`node scripts/nbc-bp03-db-check.mjs`) passes existing BP03 checks plus two-project ownership/access, cross-project entry rejection, confirmation and exact private BP04 initialization twice with unchanged BP03 rows. Browser tests in Chromium and WebKit pass synthetic and real-private-workbook two-project navigation, draft recovery after refresh, confirmation, weighted summary totals, history, BP04 Excel download and isolation in both directions. Existing BP03 Chromium workflow/export/responsive checks also pass; its optional private-template test skips when that older template fixture is absent.
