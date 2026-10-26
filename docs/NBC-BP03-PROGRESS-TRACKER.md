# NBC BP03 progress tracker

Implemented on `codex/nbc-bp03-progress`, based on the fetched `origin/main` revision `4ad7456`. No deployment, production migration, production seed, push, or live record modification was performed.

## Project workflow

After private initialization, the NBC project opens under the dedicated **Projects Progress** section with five lazy-loaded views: Overview, Project Progress, By Area / Handler, Update Progress, and Issues & Actions. Its existing Team ownership metadata remains intact; it is excluded from Team/Personal project lists. Standard projects retain their table and board. Only the one-time private setup marks an existing matching NBC BP03 project or creates it; ordinary startup never seeds data.

The revised UI follows `docs/NBC-BP03-UX-PLAN.md`: compact project header and reporting chip, sticky five-view navigation, six KPI columns (3×2 on iPad / 2×3 on phone), and an 8/4 trend/handler layout above work-area, floor and trade breakdowns. KPI week comparisons remain blank until a finalized snapshot exists. Breakdown links become removable URL filter chips. New row/tab dimensions are documented in the existing design-token file; no new palette or typography is introduced.

Handler filters open useful ancestor context once; individual groups and Collapse all remain usable in every handler tab. The BOQ treegrid uses two sticky columns, sibling sorting, decimal/custom percent entry, quick-set shortcuts, handler pickers, optional columns, min/max progress filters, a changed-only toggle, and a search shortcut. Arrow keys navigate and expand/collapse, Enter edits, Tab moves between editable leaves, Escape cancels and R opens remarks. Parents are calculated; standalone GR&P is editable and included once. Values outside 0–100 clamp with a message; non-numeric text does not commit. Progress editing requires an open reporting week, enforced both in client actions and PostgreSQL. Handler reassignment and remarks are independently audited.

Phone rows have two lines and use the existing bottom sheet for numeric editing, filters and details. NBC forms opt into full-height opening, with direct Escape/Close dismissal; standard sheets keep their original default. A resized keyboard-height viewport is tested. Handler/area view offers six responsibility cards, expandable area rows and confirmed bulk leaf assignment. Details include metadata, remarks, the last five audit changes and a linked issue action. Issues retain the existing task table/board and add searchable WBS linking, link pills, WBS/handler filters and suggested issue tags. Progress never completes coordination tasks.

The reporting chip opens **Date → Update activities → Review changes → Finish**. Update Progress fills the viewport, hiding the sidebar, app header, mobile navigation and duplicate project header. It retains normal compact text, 48px desktop rows and a table that uses the remaining screen height. Compact summaries leave more room for editing. Valid changes autosave after a short pause through the existing local/cloud queue; raw text is journaled immediately for recovery if the browser closes. Reporting date, review stage and finalization note also recover on this device. Cancel restores the current activity edit (including autosaved values); Back opens a choice: Keep editing, Keep draft & go back, or Delete update. Deleting an open update undoes percentage changes to the preceding finalized snapshot (or initial baseline), while preserving remarks, assignments, audit history and finalized reports. The owner-scoped discard RPC locks the project and restores percentages/deletes the draft atomically; stale or finalized reports are preserved. Its intent uses the existing recovery queue, rather than issuing separate activity rollback writes. Past updates stay collapsed until opened. Review shows a diff sorted by weighted impact, followed by an explicit finalization confirmation. History opens a read-only BOQ snapshot with editing controls absent. A correction sheet selects activities, corrected percentages, a later reporting date and a required reason; its audited changes are listed in the project Corrections log. The previous finalized snapshot (or undated imported baseline) supplies previous progress. Snapshots retain activity IDs, WBS, descriptive/grouping fields, handlers, effective weights, previous/current/difference values, remarks and update times. Database guards serialize activity writes and finalization, validate the proposed snapshot against current rows, calculate canonical totals, and stamp the authenticated editor. Duplicate dates and multiple open periods are rejected. Finalized reports cannot be updated or deleted by the application role. Corrections are **new, later-dated reports** referencing a prior report with a required reason; the original remains intact. Trends use finalized reports only. Export is UTF-8 CSV compatible with Excel, with spreadsheet formula injection protection.


## Workbook reconciliation

The development-only extractor inspected all seven sheets, all master calculation branches, numeric formula caches, handler links and assignments. It rejects Excel errors, missing formula caches, unmatched leaves, duplicate assignments/WBS, unexpected parent formula references and inconsistent weights. It independently checks the duration-derived relative weights, propagated global weights, every parent percentage, area percentages and total BOQ value against the workbook. It also checks propagation of a changed leaf through the hierarchy.

| Check | Verified result |
|---|---|
| Numbered WBS nodes | 789 |
| Standalone GR&P | 1 additional node |
| Total nodes | 790 |
| Calculated parents | 228 |
| Assigned leaf activities | 561 |
| Editable entries including GR&P | 562 |
| Sitha / Lychhinh / Chhorvaon / Srun / Kheng / Tola | 193 / 50 / 6 / 31 / 31 / 250 |
| Sum of root weights / effective leaf weights | 1 within floating-point tolerance |
| Overall weighted progress | 42.023278891003885%, matches cached workbook result |
| BOQ total and every area/parent | Match source; detailed monetary reconciliation stays private |
| Reporting date | Unknown; no historical dates invented |

Calculations retain fractions in `[0,1]` and round only for presentation. Parents normalize child relative weights; overall progress sums editable leaf global weights. Duration and weights are immutable baseline metadata. Zero-weight branches return zero rather than dividing by zero. GR&P participates directly in the overall leaf sum.

## Private initialization, after explicit authorization

Private files are excluded by `.gitignore`: `.private/` and Excel workbooks. Neither the workbook nor extracted descriptions, per-item BOQ values, formula metadata or credentials are bundled into the app. Keep a secure copy of the private seed and reconciliation before moving machines. The workbook is unnecessary after extraction.

1. Extract with Python and `openpyxl` (the bundled Codex Python already has it):

   ```powershell
   & "$env:USERPROFILE/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe" scripts/nbc-bp03-extract.py 'C:/Users/Por/Downloads/Telegram Desktop/NBC_BP03_ Progress tracking by BOQ.xlsx'
   ```

   This writes `.private/nbc-bp03/initial.json`, `reconciliation.json`, and `initialize.sql`. Extraction was completed on the development machine. Outputs are deterministic and contain private project information.

2. Review the pending migrations `supabase/migrations/20261026085710_nbc_bp03_progress.sql` and `supabase/migrations/20261026110000_nbc_discard_update.sql`, followed by `supabase/migrations/20261026130000_nbc_company_access.sql` (apply in that order; the company-access migration aborts without changing data if more than one NBC project exists or a private project reuses the NBC identifier) together with any older unapplied workspace migrations. Obtain explicit authorization for the target database and owner. Test on staging first. With a securely supplied database URL, apply the reviewed migration through the normal Supabase migration process. `supabase db push --dry-run` previews pending migrations without applying them.

3. Review the private initialization SQL and execute it once with the **existing workspace owner's auth UUID**, using an administrative database connection. The following is an instruction for the authorized operator, not an action performed during implementation:

   ```powershell
   psql "$env:DATABASE_URL" -X -v ON_ERROR_STOP=1 -v owner_id=OWNER_AUTH_UUID -f .private/nbc-bp03/initialize.sql
   ```

   The transaction verifies the owner exists, locks NBC initialization, reuses one matching NBC BP03 project, or creates the Team project. Multiple matching projects abort for explicit resolution. Inserts use stable WBS IDs and `ON CONFLICT DO NOTHING`. Rerunning setup preserves progress, handlers, remarks, history, reports and unrelated workspace data. The procedure checks node counts and editable rules before committing. It does not reset the project.

4. Release the frontend after the approved migration/seed. Sign in as that owner and open Projects Progress → NBC BP03. Confirm all counts and the private reconciliation totals. Assign a reporting date through Update Progress; the original imported baseline remains undated.

## Persistence and access

Two new owner-scoped tables, `kw_nbc_activities` and `kw_nbc_reports`, follow the existing JSON row/CAS contract. Generated project/parent/WBS columns supply relational foreign keys, indexes and uniqueness. Activities and reports reference an owned project. RLS and restricted grants isolate accounts; anonymous access is denied. Invoker-rights private triggers enforce immutable metadata/history and reports. The company-access migration (`20261026130000_nbc_company_access.sql`) then shares the single NBC BP03 dataset with **every authenticated account, including future signups**, with no membership table: `kw_nbc_owner()` returns only the canonical storage owner of the one NBC project, and read/update policies on NBC projects, activities and reports resolve to that owner. Rows keep their original storage owner, so existing progress, history and audit logs stay in place and nothing is duplicated or merged. Any signed-in user can update progress and create, finalize or discard reports under the existing rules; PostgreSQL stamps the real editor. Finalized reports stay immutable. Activity rows cannot be inserted or deleted by accounts, the NBC project cannot be created, edited or deleted by accounts, and its identifier is reserved. Personal projects, tasks, pages, events and profiles keep owner-only RLS; a task a user links to a shared WBS activity stays in that user's own workspace. The write RPC targets the canonical owner for NBC collections only, and per-dataset advisory locks serialize concurrent writers, so conflicts surface through the existing revision check and recovery pages.

The existing cloud write queue, conflict recovery pages, localStorage recovery journal, IndexedDB snapshots and account-switch isolation include both new collections. Stable audit-event IDs preserve every queued offline edit even if row writes coalesce; PostgreSQL stamps the authenticated editor and receipt time. Rejected finalization returns to a reviewable server draft and preserves the rejected proposal in a recovery page. Writes retain immediate UI feedback; finalization waits for existing pending cloud saves. A stale finalization is rejected for review. NBC Realtime subscription is mounted with its project view. Normal projects do not query or subscribe to NBC tables, allowing the unchanged app to run before the NBC migration is applied. Returning to the NBC project refreshes current cloud data.

For rollback, restore the previous frontend while retaining NBC tables and records. Do not drop snapshots or reseed to recover a release. Any database rollback that deletes data needs a separate reviewed backup and authorization.

## Verification

- `corepack pnpm lint`, `corepack pnpm typecheck`, **95 unit tests**, production build and `git diff --check` passed.
- The private-data unit test checks all 790 nodes, exact handler counts, every calculated parent, effective weights, BOQ total, GR&P and edited-leaf propagation. It skips explicitly on machines without the private dataset.
- Draft tests cover immediate raw-text recovery, delayed saves, cancellation, invalid text, clamping and account isolation. Trash tests cover task/note restoration, preserving active data, offline deletion and concurrent remote changes. Synthetic tests cover hierarchy filtering/collapse/sibling sorting, validation, zero weights, precision, downward corrections, persistent edits, task independence, snapshot immutability, baseline carry-forward and audited corrections. The existing cloud test now includes NBC activity/report writes and verifies clearing NBC data when switching accounts.
- `node scripts/nbc-bp03-db-check.mjs` passed using disposable PostgreSQL via PGlite. It executes the actual migration and private seed, tests rerun/reuse without resetting updates, CAS conflicts, bounds and structural validation, immutable snapshots, stale finalization rejection, dated correction, owner isolation and anonymous denial. It never connects to Supabase or reads credentials. Install the pinned test-only runtime outside the app with `npm install --prefix .private/validation --no-save @electric-sql/pglite@0.5.11` if needed.
- Playwright covers the real source dataset and all six handler collapse/expand workflows, virtualized scrolling, full reporting/correction flow, large editing screens, decimal entry, autosave/reload/recovery/cancel, task deletion/restore/Empty Trash and navigation separation. It checks desktop/iPad/iPhone, both themes, 200% text zoom, resized keyboard-height screens and accessibility in Chromium/WebKit. The preceding broad regression run passed **150 Chromium/WebKit checks**, with **6 live-cloud checks explicitly skipped**. A Safari focus-return race found during regression testing was fixed in the shared popover and passed three repeated checks before the final clean run. All 36 NBC checks passed within that run. After the full-screen/delete follow-up, **54 Chromium/WebKit checks passed**, including 44 NBC checks plus workspace/navigation regressions. They verify exact viewport bounds, normal font sizes, all three exit choices, deletion rollback, persistence and finalized-history preservation.
- Six live-cloud checks require isolated accounts supplied through `KW_QA_FIXTURE`; they were not run against production. Disposable PostgreSQL additionally verifies owner-only permanent task deletion and revision checks.
- Initial bundle budget check passed: 96.7 KiB compressed JavaScript and 13.5 KiB compressed CSS, below existing 200/15 KiB limits. NBC has its own lazy chunk.

## Files

| Files | Purpose |
|---|---|
| `src/nbc/{types,progress,actions,format,drafts,useActivityDraft,NbcProject,BoqTable,WeeklyProgress,Trend}.ts(x)`, `nbc.css` | Project data contract, calculations, edits/reporting, responsive views |
| `src/data/{types,index,persistence,sync}.ts` | NBC marker/task link, existing save/recovery/cloud integration |
| `src/pages/Projects.tsx`, `src/components/TaskTable.tsx` | Lazy project routing and optional WBS link in existing tasks |
| `scripts/nbc-bp03-extract.py` | Development-only extraction, validation and private initialization SQL generation |
| The three `20261026*_nbc*.sql` migrations | Tables, ownership, validation, snapshots, CAS extension, atomic draft discard and company-wide access |
| `scripts/nbc-bp03-db-check.mjs`, `src/nbc/{test-fixture,progress.test}.ts`, `src/test/cloud-sync.test.ts`, `e2e/nbc.spec.ts` | Disposable DB, unit, cloud and browser checks |
| `src/pages/PageEditor.tsx`, `src/components/TaskFields.tsx`, `src/shell/{AppShell,SidebarContent}.tsx`, `src/App.tsx`, `src/test/trash.test.ts` | Task deletion/Trash, navigation separation and checks |
| `src/components/glass/GlassPopover.tsx` | Prevent an exiting menu from stealing focus from the next menu in Safari |
| `src/styles/tokens.css`, `src/shell/Overlays.tsx` | Reuse design tokens and existing sheets with an optional full-height NBC opening |
| `.gitignore`, this report, `docs/NBC-BP03-UX-PLAN.md`, `docs/BUILD-STATUS.md`, `docs/DECISIONS.md` | Privacy exclusions, setup and implementation record |

## Workspace follow-up

Normal task rows now expose Delete; the shared task deletion action also trashes its notes page and supports Undo. Trash lists pages and tasks, restores both, and offers confirmed **Empty Trash → Delete everything**. Permanent removal uses the existing owner RLS plus expected cloud revision, retains offline delete intent, and preserves a row changed by another session for review. Legacy task notes are included. Active children are detached rather than deleted. The Design system navigation tab is hidden; the existing route remains available for internal checks.

Handler contribution uses `sum(globalWeight × cumulativeProgress)` over editable leaves only. It is distinct from handler completion (`contribution / assignedWeight`). At the private baseline: Sitha 8.1277085054%, Lychhinh 1.1041699111%, Tola 32.7914004745%; the other three handlers and GR&P contribute zero. Together they reconcile to 42.023278891003885%. The UI labels assigned share and handler progress separately and identifies unassigned / GR&P contribution.

## Limits and remaining release work

Production migration (including company access), private initialization and deployment remain intentionally unapplied pending authorization. The disposable-database check applies base migrations, then initialization, then company access; use that order on staging first, then confirm with two existing accounts and one newly registered account. If the live database already holds more than one NBC project, company access aborts and the canonical dataset must be chosen explicitly. Therefore NBC BP03 does not yet exist in the live account. Live Supabase Auth/PostgREST/Realtime behavior needs a staging smoke test; local PostgreSQL and mocked cloud tests do not establish live acceptance. Physical iPhone keyboard behavior still needs a real-device smoke test; browser viewport resizing cannot reproduce every OS keyboard behavior. No site photos, native `.xlsx` export or handler accounts were added. Export is CSV. History cannot be silently restated: corrections affect a subsequent report. No per-branch mutation cache was added: memoized linear calculations over 790 nodes and table virtualization cover this dataset; unrelated task edits reuse the existing activity array.
