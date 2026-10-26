# NBC BP03 local implementation · October 26, 2026

Implemented locally on `codex/nbc-bp03-progress`: five project views following the supplied [UX plan](NBC-BP03-UX-PLAN.md), editable/locked virtualized BOQ treegrid, weighted overview, handler/area summaries, audited progress/assignment history, weekly finalization and read-only snapshots, correction sheets/log, Excel-compatible CSV summary and existing-task WBS links. Desktop/iPad/phone layouts reuse Quiet Glass tokens and existing controls/sheets. Other projects retain their table and board.


Company-wide access: NBC BP03 is one shared dataset for every authenticated account, including future signups (migration `20261026130000_nbc_company_access.sql`, sync/initialization changes and tests). Personal workspace data stays private; finalized reports stay immutable; history, audit logs, autosave and conflict recovery are preserved. Latest release verification: typecheck, lint, 95 unit tests, production build, the disposable PostgreSQL RLS check (two existing accounts, a newly registered account, cross-account updates, private isolation, anonymous denial), and 252 Chromium/WebKit browser checks passed; six live-cloud checks were skipped without isolated QA accounts. Production migration and seed remain unapplied.

Follow-up: dedicated **Projects Progress** navigation; **Project Progress** and **Update Progress** labels; working collapse in all six handler filters; full-screen Update editing with normal compact text and no sidebar/app header; autosave and interrupted-input recovery; Back choices to keep editing, keep the draft or delete/undo its percentages; real four-step reporting workflow. Handler contribution and completion use separate labels/scales. Workspace task deletion and confirmed Empty Trash reuse current persistence/RLS. Design system is hidden from navigation.
All seven workbook sheets reconciled: 789 numbered nodes plus GR&P, 561 assigned leaves, 228 parents, exact handler counts, and 42.023278891003885% overall progress. Private source/seed/BOQ files stay ignored. The baseline has no invented reporting date. The prepared initialization is transactional, idempotent and reuses one matching project without resetting updates.

Validation: lint, frontend/API typecheck, 95 unit tests, production build, disposable PostgreSQL migration/seed/RLS/snapshot/deletion checks and the preceding **150-pass Chromium/WebKit regression run** pass. The full-screen/delete follow-up passes **54 browser checks**, including 44 NBC checks. Six live-cloud checks were explicitly skipped because isolated QA accounts were not supplied. The run includes all 36 NBC checks, desktop/iPad/iPhone in both themes, interrupted-edit recovery, cancellation, all handler collapse controls, 200% text zoom and keyboard-height resizing. A Safari menu focus race was fixed and also passed three repeated checks. See [implementation report](NBC-BP03-PROGRESS-TRACKER.md) for setup and limits.

**Release remains pending:** no production database changes, initialization, deployment or push were performed. Pushing `main` would trigger an automatic Vercel production deployment, so it is withheld until production release is explicitly authorized. Staging Auth/PostgREST/Realtime and physical iPhone keyboard checks remain release checks. Earlier sections describe previous work and releases.

---

# Local SingBuild update · October 25, 2026

Implemented locally: supplied SingBuild branding/icons, persistent private Team/Personal project groups, Personal defaults for legacy projects, workspace selection during project creation/editing, a remembered opening project/group, and a dense task table based on the supplied reference. Home is removed. Calendar, My tasks, Pages, Favorites and New page are absent from navigation; existing page/task/calendar data and Google Calendar integration remain available. Removed the task inspector and its opening state/actions. Primary task properties edit inline; in-flow fields retain hierarchy, subtasks, labels, repeat schedules, reminders, activity and rich notes. Shared status/priority pills and glass selectors retain keyboard operation, touch targets, both themes and opaque/reduced-motion fallbacks. The content column stays opaque to the bottom of short pages.

Signed-in writes now use a memory queue and prompt server requests; local storage and IndexedDB are cache/recovery paths, not write prerequisites. Realtime subscriptions trigger authoritative reconciliation, with private owner-scoped notifications for hard deletes. Independent field edits rebase, overlapping drafts recover into searchable pages, in-flight keystrokes survive acknowledgements, and account changes isolate subscriptions/async results. Google Calendar retains separate polling, backoff, ETags and its series-change journal. Guest mode is labeled as a local demo.

Validation: lint, frontend/API typecheck, **77 unit tests**, and the production build pass. The deterministic browser suite passes **162 Chromium/WebKit checks**. All **six live checks** subsequently passed with disposable accounts. Eight focused desktop/mobile checks also pass in both themes, covering workspace reassignment, opening selection, inline editing, column order and keyboard selectors. Screenshots were inspected in both themes and at desktop/phone sizes. The shared-selector label regression found during verification is fixed and covered by a regression test. The existing lazy editor chunk remains above Vite's 500 kB advisory threshold; initial bundle budgets pass (96.6 KiB JavaScript / 13.8 KiB CSS gzip).

Backend status: applied `*_cloud_first_workspaces.sql` to `nlcpjdokfvawlpzyfytx` on October 25, 2026. Confirmed all five tables in Realtime and the owner-scoped policies. Transactional isolation SQL passed and rolled back. Live tests verified private files, cross-account isolation, stale-write rejection, two-session task delivery/deletion without focus or refresh, and offline conflict recovery. Disposable QA accounts/data are cleaned up after verification. Local public configuration is saved in ignored `.env.local`. Team remains a private project group; real sharing still requires a membership and permission model.

The user authorized pushing this update to main. No manual app deployment was requested. Confirmed access to the correct Vercel `kimpor-workspace` project and verified that its production Supabase URL/public key match the live-tested backend. Existing hosted values required no changes. The remaining sections below are historical production observations.

---

# Build status · October 20, 2026

## Production performance follow-up · October 20, evening

The deployed fix at `305ac0b` passes [Production performance run 39424125774](https://github.com/KangKimpor/Kimpor-Workspace/actions/runs/39424125774). Mobile performance is **98**, LCP **1.922 seconds**, total blocking time **93 ms**, and CLS **0**. Desktop performance is **100**, LCP **0.433 seconds**, blocking time **0 ms**, and CLS **0**. Accessibility and best practices are **100** on both. These are independent Ubuntu measurements of https://kimpor-workspace.vercel.app with the original thresholds: performance at least 95, accessibility 100, and LCP under two seconds. Earlier performance results below are historical observations.

Compact Home now paints its heading and today's events before rendering tasks, projects and recent pages. All sections are then available without scrolling or interaction; accessibility audits wait for the complete content. Guest background initialization waits for first paint. A fresh guest with no existing IndexedDB workspace initializes on the first click or keydown; an existing workspace still restores automatically. Account and stored-session startup remain gated before rendering. The first edit retains its local recovery copy and survives reload. The performance workflow waits for this commit's successful Vercel status, runs on relevant `main` changes, supports manual reruns and cancels superseded audits.

Validation: 67 unit tests, lint, frontend/API types, production build, the 103.3 KiB initial JavaScript budget, 10 focused Chromium/WebKit startup/navigation/offline-update checks, and four complete mobile Home accessibility audits pass. A local WebKit sign-up check timed out once, then passed two isolated repetitions. The previous full Ubuntu Workspace checks run 39420463900 passed all 120 deterministic checks with four opt-in live checks skipped. The expanded full suite for `305ac0b` is running separately; its result is not implied by the Lighthouse pass. Remaining physical-device, screen-reader, precise Google write timing and revoked-consent checks stay open. No live account or calendar data was changed for this performance work.

## Continuation verification · October 20, evening

Fetched GitHub and continued locally from `origin/codex/finish-workspace` at `95bb324`; at the start of this continuation, `main` was at the foundation commit `0a9d067` and [PR #1](https://github.com/KangKimpor/Kimpor-Workspace/pull/1) was a draft. The attachment is historical context, not fresh authorization to publish, change repository visibility, or modify live accounts.

The last remote [Workspace checks run](https://github.com/KangKimpor/Kimpor-Workspace/actions/runs/39388636258) failed: 118 passed, two WebKit account-layout checks timed out, and four opt-in live checks were skipped. The failure artifacts show delayed rendering, including the lazy-route loading screen. All 15 repeated account-layout checks pass locally with the original two-worker setting; the precise remote cause remains unconfirmed.

Local CI configuration now uses one browser worker and a fresh preview server, retains failure traces, and gives the browser suite 20 minutes inside a 25-minute job. Assertions, retries, and application code are unchanged. This is CI hardening and diagnostic coverage, not proof that the remote failures are resolved.

Current local validation: lint, frontend/API types, all 67 unit tests, production build, whitespace checks, and the 103.0 KiB initial JavaScript budget pass. The complete Chromium/WebKit run with the new CI configuration finished with **119 passed, one failed, four skipped**. All account-layout checks passed. WebKit's dark `/design` audit at 820×1180 timed out inside `axe.runPartial` after navigation and asset loading completed promptly; its trace is in `test-results/a11y-axe-design-820x1180-dark-webkit/trace.zip`. That unchanged audit then passed three isolated repetitions. A single worker does not eliminate this intermittent audit timeout, and the full suite is not declared green.

After local verification, the user explicitly requested all updates be pushed to `main`, including the workspace branch and these CI changes. Remote CI results for that push remain pending. No manual deployment, live cloud mutation, new production performance measurement, or physical-device acceptance was performed in this continuation. Next: investigate the retained WebKit audit trace and verify these changes on Ubuntu CI; mobile performance and the remaining device acceptance checks below stay open.

## Release verification · October 20, afternoon

Production: https://kimpor-workspace.vercel.app, deployment dpl_GZ7ZvWjHh5sJAeNEVHf2PfLnQowV (READY), source 0f78928. kw-google version 3 is ACTIVE and all four database migrations are applied. Both Google accounts are connected (12 calendars total); signed-in writes reach Saved to cloud. These service observations are from the previous session. GitHub reports the repository as public on October 20; the earlier private-repository statement was incorrect.

Live Google acceptance completed with an attendee-free disposable four-occurrence series: create, This event, All events, This and following with finite counts, Google color readback, reverse sync from Google, and deletion. All disposable Google events were removed and an empty provider search confirmed cleanup. Existing personal events were preserved. Four isolated live Supabase browser checks passed for ownership, private files and two-client offline conflict recovery; both temporary accounts and their external credential fixture were then deleted.

The iPhone sidebar now uses portal-safe positioning, one Motion transform animation, and a close button. Bottom tabs stay mounted while the overlay code loads. PWA updates wait for an explicit Reload action rather than automatically interrupting the app. Real two-version service-worker tests in Chromium and WebKit verified initial offline control, zero automatic reloads and exactly one requested reload in both first-install and returning sessions. Production Chromium and WebKit checks confirmed first-tap opening/closing, one document load, dark-theme bootstrap and CSP compatibility. The user confirmed the sidebar is now smooth on their physical iPhone; earlier phone keyboard, drag and offline checks also worked.

Validation: 67 unit tests, frontend/API type checks, lint, build and the initial-JavaScript budget pass. Focused account and phone navigation checks pass in Chromium and WebKit. The full deterministic suite contains 120 checks plus four opt-in live checks; current remote results are available in GitHub Actions. Initial JavaScript is 103.1 KiB gzip against a 200 KiB budget. The pre-paint theme script is inline with an exact CSP hash checked against the built HTML.

Independent Ubuntu Lighthouse on the deployed fix measured desktop performance 100 with LCP 0.47 seconds and mobile performance 92 with LCP 2.24 seconds; accessibility and best practices are 100. A preceding mobile run was 81 / 2.67 seconds on a slower shared runner, so the mobile score is not stable. The release targets remain performance at least 95 and LCP under two seconds; mobile acceptance is still open. Local compressed-response measurements are not used to claim a pass.

Remaining acceptance: mobile production performance target/remote CI result, a precisely timed phone-to-Google write, actual revoked-consent reconnect, physical Windows scaling/Edge, iPad and screen-reader checks. Google OAuth remains in Testing for the two approved accounts; refresh tokens may expire after seven days. Publishing/verification remains a separate owner decision. No full hardware acceptance is claimed.

## Historical checkpoints

The sections below preserve earlier observations and are superseded by the release verification above.

## Current checkpoint

The deployed app has completed real workspace Google sign-in and two separate Google Calendar connections. Both account statuses are OK. Read-only production verification found 2 calendars for the personal account and 10 for the school account, with cached events belonging to each. Both accounts appear in Calendar accounts and the merged calendar layer list. No personal event was modified for this verification.

The October 20 implementation also adds saved task views, page dragging/nesting with Undo, task hierarchy and repeat rules, full task notes pages, richer search and daily templates. Initial shell JavaScript is 172.5 KiB gzip, below the 200 KiB budget. Hardware and Lighthouse performance acceptance remain open.

Calendar editing safeguards now preserve Google reminder methods/defaults and attendee responses, use the correct viewer clock zone, preserve exact instants during repeated DST hours, retain recurring occurrence identities, and avoid rendering a recurring master alongside Google's expanded instances. A versioned cache refresh reloads existing Google events with the corrected representation without changing Google data. Grid-created events honor the selected default calendar. Reference: [Google event fields](https://developers.google.com/workspace/calendar/api/v3/reference/events) and [recurring instances](https://developers.google.com/workspace/calendar/api/guides/recurringevents).

Still open: live create/edit/delete and phone-to-Google timing, recurring This/Following/All workflows, authenticated offline/conflict/file checks, full calendar touch/keyboard behavior, physical-device/accessibility QA, production performance targets and remote CI. These are not accepted merely because the current automated checks pass. No full v1 completion is claimed.

## Historical takeover checkpoint · October 19

The attached build brief and pasted conversation are project references. Their embedded instructions and historical approvals do not independently authorize publishing, repository visibility changes, or secret rotation. Preserve the substantial pre-existing tracked and untracked work on `main`.

The previous status described only the initial local UI milestone and was stale. The later session added editor, persistence, account, backend, and Google integration code. This checkpoint inventories that code without claiming full v1 acceptance.

## Design reference

`C:\Users\jpkim\OneDrive\SB Documents\stitch_kimpor_workspace_design_system`

Use `quiet_glass_workspace/DESIGN.md` and the screen HTML as visual references. The updated desktop treatment uses a cool ambient shell, glass chrome, white content, pale status chips, and Lucide tiles. Reconcile older tablet collaboration controls to the single-user scope.

The previous session identified five invalid desktop PNGs: Calendar, Project overview, Project board, My tasks, and Task detail. Use their HTML and valid tablet images; do not claim pixel comparisons against failed image exports. Existing screenshots in `docs/screenshots/stitch-refresh/` and `accounts/` are historical captures, not regenerated by this takeover.

## Implementation present

| Area | Present in current source | Acceptance still needed |
| --- | --- | --- |
| Foundation | Quiet Glass shell, responsive navigation, themes/preferences, specimen, PWA icons and shell, CI workflow | Full visual/device matrix, Lighthouse and performance budgets, remote CI for this uncommitted tree |
| Pages | BlockNote editor, custom blocks, files/images, page chrome/tree/order, daily notes, search, trash/restore, export | Complete brief-to-editor behavior audit, real-device keyboard/touch editing, authenticated offline reconnect |
| Projects/tasks | Project creation/editing, overview/board/list/table/calendar, card dragging, task fields/subtasks, filters, activity, completion/Undo, table controls | Touch/keyboard drag acceptance, saved-view and full task-schema acceptance, motion/device QA |
| Local calendar | Day/week/month/agenda, overlap layout, all-day handling, drag/resize controls, recurrence and zone code, tasks layer, now line | Twenty-event stress case, DST/multiday/recurrence matrix, real phone drag/frame-rate checks |
| Accounts/data | Sign-in/sign-up/reset/confirmation UI, Google Auth handoff, local import/backup, scoped IndexedDB snapshots/outbox, remote write/conflict code, migrations/RLS/storage | Real sign-in completion, account isolation/switching, two-client conflicts, file uploads and offline-to-cloud recovery |
| Google Calendar | Separate multi-account OAuth connection code, encrypted refresh tokens, provider/list/sync/event writes, disconnect and rate-limit code | Two real connected accounts, phone-to-Google update within 60 seconds, recurring edits and revocation/reconnect |

No phase is declared fully accepted by the presence of its implementation.

## Verified in this takeover

- Lint and frontend/API type checks pass.
- All **29 unit tests** pass, including contrast, workspace operations, calendar layout/recurrence, proxy handling, and token encryption checks.
- Production build passes. Vite still reports chunks above 500 kB and an ineffective dynamic import of the Google module. Performance budgets are not accepted.
- All **60 browser tests** pass in Chromium and WebKit against the rebuilt production preview. Coverage includes both-theme axe checks, account forms and mocked Google handoff, page editing/restore, tasks/table/board, local event editing, narrow layouts, and offline reload/editing.
- Fixed a Home event-button accessible-name mismatch by letting the complete visible card text supply its name. Existing axe tests cover the regression; a single-line lint exception accounts for the static rule being unable to infer this dynamic child text.
- Read-only live probes: `/settings/account` returns HTTP 200 HTML; `/api/google/info` returns HTTP 200 JSON with `configured: true` and the expected Edge Function callback. This does not establish successful authentication, current deployment/source parity, or working calendar synchronization.

The initial browser pass found the Home naming failure. One navigation was also aborted during a concurrent rebuild. After the fix and a completed build, the full unchanged-build suite passed. Do not rebuild a preview during browser tests: service-worker updates can interrupt navigation.

## Next acceptance work

1. Complete real workspace Google sign-in, verify the callback/session, and confirm guest edits remain separate until explicitly imported.
2. Connect two Calendar accounts and verify merged events, create/edit/delete, recurrence, offline reconnect, and token revocation.
3. Run isolation SQL against a dedicated test database and verify signed-in sync, account switching, conflicts, and files across two clients.
4. Finish device/performance/accessibility checks, then assess remaining brief gaps and publish only within the user's authorized scope.

This takeover changed no remote settings, pushed no commits, and performed no deployment. The previous conversation's deployment and OAuth observations are historical evidence only. Current setup details and configuration coupling are in `SETUP.md`.



### 2026-10-20 — Google Calendar connection handoff

Reproduced: Add Google account creates an OAuth state on the server, then the automatic same-tab navigation leaves Chrome loading at Settings. The service health endpoint returns HTTP 200. Replaced the automatic navigation with a visible, validated Google authorization link opening a separate tab. Requests now time out after 20 seconds with a retryable error. Connection preparation has its own disabled/progress state and is no longer blocked by background Calendar sync. This does not change OAuth scopes, credentials, or existing connections. Added component and service regression coverage for the handoff, retry, timeout and destination validation.

Validation: typecheck and lint pass; 38 unit tests and 64 Chromium/WebKit checks pass. Deployed to production as dpl_J21hmqHCw74rBHWi5tb166f8yDhN. Verified the live new-tab link reaches Google's “Choose an account” screen; stopped before account selection/consent for the user. Existing one-account Calendar connection remains OK. Production showed Saved to cloud. Proof: docs/screenshots/verification/google-connect-fixed.png. Refresh once to replace a cached older PWA shell if necessary.


### Current calendar safeguard validation

45 unit tests, frontend/API typecheck and lint pass. The complete 64-check Chromium/WebKit suite passes; the event-editing checks were repeated in both browsers after the final time-zone preservation adjustment (2 passed). Production deployment dpl_EAcMWyKg7Lp21E1TaVoABs7moo6L is READY at https://kimpor-workspace.vercel.app. The calendar service health endpoint returns configured=true with HTTP 200. Live event mutation and phone timing were not tested against personal calendars.

Post-deploy: both account cards still show OK and Saved to cloud. All 12 calendar caches have eventFormatVersion=2, verifying the deployed cache refresh completed. Proof: docs/screenshots/verification/two-google-accounts-connected.png.
