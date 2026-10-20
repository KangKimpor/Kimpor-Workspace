# Build status · October 20, 2026

## Release verification · October 20, afternoon

Production: https://kimpor-workspace.vercel.app, deployment dpl_GZ7ZvWjHh5sJAeNEVHf2PfLnQowV (READY), source 0f78928. kw-google version 3 is ACTIVE and all four database migrations are applied. Both Google accounts are connected (12 calendars total); signed-in writes reach Saved to cloud. The repository is private.

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
