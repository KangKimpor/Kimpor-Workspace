# NBC BP03 progress tracker

## Current implementation

NBC uses one submission per handler per Monday–Sunday week. The four project tabs are **Overview · Update Progress · Past Updates · Activities**. The three exported Stitch screens under `stitch/13035619905198052579/` supplied the layout references; the existing workspace tokens, components, real handler names, themes and navigation are retained.

The deadline is **the end of Sunday in Asia/Phnom_Penh**. Monday 00:00 is the exclusive late boundary, rather than Sunday noon. `src/nbc/submissions.ts` owns the client deadline constant; `kw_private.nbc_deadline()` is its server equivalent. The database stamps the authenticated actor and receipt time and calculates the authoritative late flag.

**Update Progress shows only the current week, with no week tabs.** A visible handler selector remembers the device's last choice. It is an honor-system selector, not identity enforcement. There are no new accounts, user-to-handler mappings or per-handler access policies. All authenticated accounts continue to share the one company dataset.

The table contains the selected handler's editable activities **plus shared GR&P**, which every handler may edit. Each ordinary activity has one handler; GR&P is the explicit shared exception and remains counted once in the project total. Groups collapse and show an average. Previous percentage, draft percentage, change and remark appear together. The table scrolls internally between its sticky header and bottom action bar. Native decimal entry, quick-set percentages and desktop increment/decrement controls work without an editing wizard. Phones retain decimal entry and quick-set. All displayed changes use `%`.

## Autosave and confirmation

Raw progress text, remarks and notes are journaled immediately per account, project, handler and week. Valid values autosave after 400 ms into `nbc_submissions` through the established local/cloud recovery queue. Invalid text stays recoverable without changing a valid submission. The save status distinguishes local recovery from pending/failed cloud saves. Leaving has no dialog and does not discard the draft.

Drafts never update live activity progress or remarks. **Confirm update** (or **Confirm, no changes**) flushes the draft, waits for its server acknowledgement, then calls one checked database transaction. It applies activity values, appends activity audit history, confirms the submission, re-chains affected entries and updates the editable weekly summaries. It cannot silently confirm while offline or after a conflicting server change. The toast offers Undo for six seconds; the server allows ten seconds for the same actor to undo. Undo has delete-and-reopen semantics and retains the draft values.

Editing a confirmed submission reopens it as a draft while its last confirmed values stay live until reconfirmation. Deleting removes its applied values, restoring previous values while preserving any newer confirmed update. Progress and remark changes happen through submissions; Activities remains useful for inspection, filters, audit history, issues and audited handler reassignment. Reassignment keeps the Needs review state when recorded responsibility differs from current responsibility.

This week and last week are the only editable weeks, enforced by client rules and server transactions. Last-week edits/deletions are reached from **Past Updates**, not from Update Progress. The UI does not create missing last-week updates. Server operations can still confirm an existing last-week draft and calculate its late status. Earlier records and summaries cannot be modified by the application role.

If last week changes, this week's confirmed entries and drafts retain their proposed cumulative progress but receive the corrected `previous` values. Current live progress remains at the newest applied cumulative value. Shared GR&P entries are ordered by week and confirmation time across handlers; removing an earlier update preserves later applied values. A stale GR&P draft fails confirmation instead of overwriting another handler's update. **Reload shared GR&P** refreshes that row without discarding the handler's other edits.

## History and summaries

`kw_nbc_submissions` uses the existing JSON/CAS row contract and a unique `(storage owner, project, weekStart, handler)` index. Each record contains status, authoritative confirmation time/actor, late flag, optional note and entries with activity ID, previous progress, cumulative progress and remark. A reopened draft retains `appliedEntries` for its last confirmed version.

`kw_nbc_summaries` stores overall progress, previous progress and per-handler weighted contributions for every recorded week. GR&P has a separate contribution and is counted once. Only the two editable weekly summaries are recalculated by submission operations; older summaries are frozen. Trend reads summaries across all weeks. KPIs use current live values and weekly summaries. Past Updates retains all handler submissions, with read-only Older weeks sections and formula-safe UTF-8 CSV export.

Overview shows six handler rows with Last week and This week columns. Chips show Updated, Updated late, Not yet, Overdue or Needs review, together with confirmation time and changed counts. Clicking opens the relevant handler/week. A KPI reads `N of 6 handlers updated this week`. NBC Realtime watches activities, submissions and summaries; confirmation also refreshes the canonical cloud state.

## Production state and applied migrations

Read-only checks on **27 October 2026** found that production project `nlcpjdokfvawlpzyfytx` already contains the NBC schema and data: **790 activities and one finalized report dated 31 October 2026**. GR&P is the one unassigned editable activity. The older documentation claiming production was uninitialized was stale.

Production migration history contains:

| Version | Name |
|---|---|
| `20261026131652` | `nbc_bp03_progress` |
| `20261026131706` | `nbc_discard_update` |
| `20261026131720` | `nbc_company_access` |
| `20261026160634` | `nbc_handler_weekly_confirmations` |
| `20261027151037` | `nbc_handler_submissions` |
| `20261027151223` | `nbc_submission_privileges` |

The first three production versions differ from their local filenames. **Do not blindly push the entire local migration directory or rerun the baseline migrations.** Review/reconcile migration history with the approved operator before release.

The approved forward migration `supabase/migrations/20261027151037_nbc_handler_submissions.sql` was applied on 27 October 2026, followed by `supabase/migrations/20261027151223_nbc_submission_privileges.sql` to explicitly revoke platform default table grants. It creates the new submission/summary tables, converts finalized project reports into handler submissions and weekly summaries, and retains **every original project report and snapshot** in the now read-only `kw_nbc_reports` archive. If multiple old reports belong to one Monday week, that week's latest cumulative snapshot supplies progress, its earliest snapshot supplies the preceding weekly baseline, and original intermediate reports remain archived. Recorded handler confirmation times are preserved where present.

The forward migration aborts if a new unfinished legacy report appears before release, so its live edits cannot be silently converted or discarded. Current production has no reports after the authorized reset.

New tables allow company-scoped reads but no direct application writes. Draft CAS writes and confirmation operations pass through narrow authenticated functions with a fixed empty search path and the established dataset advisory lock. The server rejects noneditable activities, other handlers' activities (except GR&P), invalid percentages, duplicate entries, forged confirmation fields, stale revisions and weeks outside the editable window. The existing activity metadata/audit validation stays in place. Legacy report writes and discard operations are revoked; an old frontend cannot bypass the new workflow.

**The two approved production schema migrations are applied. No frontend push or deployment was performed for this redesign.** On 27 October, the user separately authorized resetting the tested updates to the supplied workbook baseline. That guarded reset restored two changed activities, removed the one tested report, preserved activity audit history and verified 790 records at 42.023278891003885% overall with zero baseline mismatches. Production now has zero weekly reports. The user explicitly approved the migration after the reset. Deploy the matching frontend before using the new flow; the previous frontend can no longer write project-wide reports. Do not reseed or reset progress. Retain a database backup and test two signed-in accounts plus a newly registered account on staging before production release.

## Private source data

The source workbook and extraction outputs remain private and excluded from Git. The existing extraction script is unchanged. Its reconciliation covers 790 nodes, 228 calculated parents, 561 assigned activities plus shared GR&P, and an initial weighted overall progress of **42.023278891003885%**. Handler counts are Sitha 193, Lychhinh 50, Chhorvaon 6, Srun 31, Kheng 31 and Tola 250. Weights/durations are immutable baseline metadata; calculations retain fractions and round for presentation only.

## Verification

Final verification passed **97 unit tests and all 192 runnable Chromium/WebKit browser checks**, with **zero failures**. Six credential-dependent live-cloud checks remain explicitly skipped. Lint, typecheck, production build, `git diff --check` and the disposable database check also passed. The stale feedback/task-heading assertions now match the current UI, startup tests observe real IndexedDB initialization instead of a bundler chunk filename, and WebKit keyboard/drag tests wait for the relevant UI state. Product behavior was not changed to accommodate those assertions.

- `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` and `git diff --check` are the release checks.
- `node scripts/nbc-bp03-db-check.mjs` uses disposable PGlite and synthetic activities. It never reads credentials or connects to production. It executes the original migrations followed by the forward migration, checks archive conversion, account sharing, autosave isolation, confirmation, edit/delete/undo, re-chaining, shared GR&P conflicts, frozen summaries, CAS, direct-write rejection and anonymous denial. If needed, install its pinned test runtime outside the app: `npm install --prefix .private/validation --no-save @electric-sql/pglite@0.5.11`.
- Unit tests cover Monday/year boundaries, Sunday deadline precision, late flags, handler-only drafts, shared GR&P, confirmation/edit/delete/undo, editable-window rejection, drafts/confirmed re-chaining, summaries and raw-text recovery/account isolation. Existing calculation/workbook reconciliation and unrelated workspace tests remain.
- Playwright covers current-week-only updates, one-click confirmation, no-change confirmation, reload recovery, note entry, Undo, edit/delete rollback, six-handler history, last-week editing from history, all-week Trend and read-only older actions. Desktop/iPad/iPhone checks include light/dark accessibility scans, table/footer bounds and keyboard-height phone viewports in Chromium and WebKit.

A rollback-only production transaction under the authenticated role verified draft autosave isolation, ordinary/shared activity confirmation, Undo, Delete, baseline restoration and the absence of residual submissions/summaries. Introspection verified RLS, authenticated read access, no anonymous table grants or direct application write grants, and both Realtime publication entries. Supabase reported no new findings for the submission tables or RPC. These checks do not replace a signed-in frontend/PostgREST/Realtime acceptance test after deploying the matching frontend. Physical phone keyboard behavior also needs a device smoke test.
