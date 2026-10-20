# Build status · October 20, 2026

## Release verification · October 20, afternoon

The release is deployed at https://kimpor-workspace.vercel.app. Frontend deployment dpl_ADgy1ynoJieTMcvQy2kUWjdKeNkZ is READY; kw-google version 3 is ACTIVE. Both actual Google Calendar accounts remain connected, and the app reaches Saved to cloud. A disposable, attendee-free four-occurrence Google series is being used for live mutation acceptance. Existing personal events are preserved.

Completed implementation includes recurring This/Following/All scopes and custom day-based RRULEs, durable Google split recovery, ETag conflict handling, remote-deletion protection, per-account retry backoff, editor conflict recovery, in-app reminders, timed task chips, quarter-hour grid navigation/touch gestures, 500-task virtualization, inline task rename, project archive/restore, install guidance, Meet/RSVP display, and saved week-start/clock preferences.

Validation: 86 Chromium/WebKit checks passed, including four isolated live Supabase checks for ownership, private attachment access, and offline two-client conflict recovery. Frontend/API types, lint and production build pass. Unit coverage has since increased to 63 passing tests for additional Google conflicts/colors. Initial JavaScript is 102.7 KiB gzip against a 200 KiB budget. Additional event-editor color/visibility and desktop drag-handle accessibility changes are undergoing focused checks before the final deploy.

Production Lighthouse: desktop performance 99, LCP 0.77 seconds, accessibility 96, best practices 100; mobile performance 77, LCP 4.00 seconds, accessibility 100, best practices 100. Both report zero blocking time. The desktop accessibility issue is undersized page drag handles and is fixed locally. This environment rewrites compressed responses into decoded payloads: CDP records x-content-encoding-over-network: br, while direct response checks confirm Brotli. This can inflate simulated mobile transfer costs; it does not establish that the mobile target passes. Mobile performance acceptance remains open.

Remaining release acceptance: final live Google scope/delete readback and cleanup, remote GitHub CI, and physical Windows scaling/Edge, iPad/iPhone Safari/PWA, touch timing and screen-reader checks. OAuth remains in Testing for the two approved accounts; its seven-day refresh-token limit remains a deployment constraint. No full hardware acceptance is claimed.

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
