# Decisions

## D-07 Stitch supersedes the first Claude UI
The user's supplied Stitch export is the visual reference. Use the updated desktop HTML's cool shell, white content, Lucide icon tiles, compact metadata, and glass navigation. Older tablet exports include beige surfaces, sample collaboration, and inconsistent terminology; reconcile those to Quiet Glass and the brief's single-user/no-AI scope. Reject copying Tailwind CDN HTML into the React app. Five desktop PNGs are failed-fetch text files, so those screens cannot receive a valid pixel comparison.

## D-08 Local UI milestone before backend acceptance
Continue the brief by replacing feature placeholders with usable local screens. Reuse React, Router, Zustand, Radix, existing glass primitives, and CSS tokens without adding application dependencies. Browser localStorage preserves edits, reports write failures, and explicitly labels saved state as local. Reject pretending that Supabase, offline outbox, or Google sync is implemented. This remains short of full phase acceptance; see BUILD-STATUS.md. A future provider migration must preserve local edits.

## D-09 Initial blocks and task interaction
The local editor supports six explicit block types with slash selection and accessible move buttons. It is not a replacement for the full rich editor in Phase 1. Board columns accept desktop drag/drop; the table and inspector offer status selects as keyboard and touch alternatives. Full editor extensions, touch drag sensors, rich task schema, table controls, and calendar overlap/drag behavior remain on the phase checklist.

## D-10 Reference details and accessibility
Keep sample project names and content density but calculate progress from actual sample tasks. Replace member stacks with a single owner, fake sync claims with local state, and stale sample dates with relative local dates. The completion badge uses primary text on its green tint because the success text token failed dark-theme contrast on that surface. Desktop/tablet inspector overlays content rather than squeezing board columns, matching the latest task detail HTML.

## D-11 Invalid branding asset
The checked-in logo SVG contained six bytes of invalid data. Replace it with a valid placeholder K SVG and run the existing icon generator. No new branding or image-generation dependency is needed.

## D-03 Danger and success text colors
`--danger` and `--success` fail 4.5:1 as text on white, so `--danger-text` and `--success-text` exist for text use. Rejected: darkening the base colors (they are fills and icons too).

## D-04 Light yellow palette color (SPEC §9 contrast fix)
`--c-yellow` light changed `#cb912f` to `#bb8420`. Contrast on canvas 2.75:1 to about 3.2:1, meeting the 3:1 icon minimum. Smallest change that passes. Enforced by `src/test/contrast.test.ts`.

## D-05 Specimen token labels use primary text
Dark theme `.swatch code` in `secondary` text failed axe color-contrast over the ambient backdrop. Switched to `--text-primary`. Rejected: raising `--text-secondary`, which is a global token.

## D-06 Tooling
- `pnpm` runs via `corepack pnpm` on this machine (not on PATH). Use cmd, not PowerShell (script policy).
- `workbox-window` added as a dev dependency; `virtual:pwa-register` needs it.
- Helper scripts (screenshots) live outside the repo in `Downloads\kimpor-scripts`.

## D-12 Takeover verification and event names

On October 19 the prior BUILD-STATUS, README, and SETUP files still described the early local-only milestone, although later uncommitted code included BlockNote, scoped IndexedDB/outbox, account flows, and Google integration. Update those documents from current source and test evidence; retain live authenticated acceptance as open. Reject declaring the full brief complete from mocked account tests or a configured calendar endpoint.

Home event buttons now derive their accessible name from all visible card text. Their shorter aria-label omitted visible metadata and failed WebKit's label-content-name-mismatch rule. Reuse the existing Chromium/WebKit axe suite rather than weakening its checks.

## D-13 Release completion

Keep transient Google failures separate from revoked credentials. Use ETags for destructive updates and retain a durable local journal for recurring splits; retries reuse a deterministic replacement ID. A stale deletion loads Google's current event. An offline edit never recreates a remotely deleted event unless the user explicitly invokes Undo.

Recover conflicting page edits into a separate page before accepting the newer cloud version. Use isolated disposable accounts for live ownership/files/offline tests. Keep credentials, user screenshots and raw performance traces outside Git and deployments.

Custom recurrence accepts daily, weekly, monthly and yearly RRULEs; subdaily frequencies are outside the day-based calendar's scope. In-app reminders work while open; background Web Push remains v1.1. Device appearance stays local, while calendar display preferences sync with the workspace profile. Increase desktop page drag handles to 24 px for WCAG target sizing.

## D-14 Browser CI stability and failure evidence

GitHub run 39388636258 passed 118 deterministic checks but timed out waiting for the account form in two WebKit viewport checks. One failure artifact still showed the lazy-route loading screen. All 15 repeated account-layout checks passed locally with the existing two-worker CI setting, so runner contention is a hypothesis rather than a confirmed application defect.

Use one CI worker, following [Playwright's CI guidance](https://playwright.dev/docs/ci#workers), and retain failure traces so another failure includes network and rendering evidence. Keep assertions and retries unchanged. CI starts its own preview server; local runs may reuse an existing preview. A 20-minute browser-suite deadline leaves time for failure artifacts within the 25-minute job limit. Live QA tests retain their explicit trace exclusion. Reject increasing assertion timeouts without evidence of an application timing requirement.

The local full-suite check still encountered one intermittent WebKit timeout inside `axe.runPartial`, despite prompt page and asset loading. The same audit passed three isolated repetitions. Keep this failure explicit in BUILD-STATUS rather than claiming that worker serialization fixes every timeout or adding retries to conceal it.

## D-15 First paint before guest background initialization

Production Lighthouse run 39420463911 failed the existing mobile targets at performance 89 and LCP 2.25 seconds. Guest startup launched the offline-data import before contentful paint. Start that work after the browser reports first contentful paint, with an animation-frame/timer fallback where Paint Timing is unavailable. Keep stored-session and account-route initialization before rendering to preserve account isolation, and retain initialization error handling. A browser regression test fails on the previous ordering; it and the unsupported-API fallback pass repeated Chromium/WebKit checks. Local Lighthouse improves from 94 to 97, but local results do not establish production acceptance.

Run production performance checks for changes to application inputs on `main`, allow manual reruns, and wait for the same commit's successful Vercel status before auditing the production URL. Cancel superseded audits. Keep performance 95, accessibility 100 and LCP under two seconds as the acceptance thresholds.

The first deployed change improved mobile LCP to 2.17 seconds but still scored 89. An Ubuntu CPU trace identified substantial IndexedDB library initialization after paint. When the browser confirms there is no existing `kimpor-workspace` database, defer that initialization until the first click or keydown. Existing databases still restore automatically; missing or failed database enumeration uses the original eager initialization. Direct guest writes retain their synchronous localStorage recovery copy and IndexedDB persistence. Browser checks cover restoring an IndexedDB-only guest note, unsupported APIs, and preserving a fresh guest's first edit through reload. Remove diagnostic CPU profiling from the normal acceptance run.

The subsequent audit still missed the targets and showed substantial initial layout work. Compact Home renders its heading and today's events first, then fills tasks, projects and recent pages after contentful paint. Desktop keeps its full first render. Share the paint scheduler with startup and cancel its observer/frame when the Home effect unmounts. Accessibility audits wait for the final Home section so they still scan all content. Interaction listeners are installed immediately and initialization runs once, including when a click arrives during database enumeration.

## D-16 SingBuild project workspaces and cloud-first writes · October 25, 2026

Team and Personal are persistent private project groups. Default legacy projects to Personal, preserve owner-only RLS, and make the missing membership/permission model explicit. The selected project/group becomes the per-account opening screen; remove Home and hide Calendar navigation while retaining its integration and data.

Remove the task inspector and its opening state rather than retaining hidden detail actions. Keep primary fields in the reference-order table and extra properties in native in-flow details. Search links to the task's project table and focuses its editable title. Reuse glass controls and existing palette tokens, including selector options.

Replace local-outbox-gated writes and periodic workspace reads with an in-memory queue and authenticated Postgres Changes. The cloud remains authoritative; local storage and IndexedDB are optional recovery/cache paths. Rebase independent field changes, recover overlapping drafts in searchable pages, preserve new keystrokes during requests, and reject stale resurrection after hard deletes. Account generation checks isolate async results and subscription cleanup. Filtered Postgres Changes cover inserts/updates; a private topic restricted by account ID signals hard deletes and triggers an RLS-protected refetch. Its invoker-rights trigger sends no record data and has no publicly callable function. Retain Google Calendar polling, ETags, backoff and its durable series journal.

No backend release was authorized. Include the migration and inspect remote configuration read-only; report that the connected project has no workspace publication and disposable session credentials are absent. Use the supplied SingBuild wordmark and its symbol for regenerated proportion-preserving icons, retaining old data identifiers.


## D-17 NBC BP03 project-specific progress · October 26, 2026

Implement one flagged NBC BP03 Team project, using its original WBS and duration/BOQ-derived weights. Include GR&P once as a standalone editable leaf. Keep baseline metadata immutable, with owner-scoped activity/report rows following the current workspace CAS, save queue and recovery conventions. No workbook is shipped to the browser, and no import UI or generic project type is added. The workbook date remains unknown. Generate private seed SQL separately; require production authorization before applying it.

Follow the supplied `NBC-BP03-UX-PLAN.md`: compact persistent header/reporting chip, sticky tabs and BOQ controls, treegrid keyboard support, two sticky columns, phone two-line rows and full-height editing/filter sheets, six KPI tiles and grouped breakdowns. Add only missing NBC row/tab dimension tokens. Existing bottom sheets gain an optional large starting detent with direct Close/Escape handling; their ordinary default is preserved. Gate percentage changes on an open reporting week in client and database. Reuse the normal task table/board for actions; WBS links do not tie task status to mathematical progress.

Finalize canonical snapshots against current database rows under a project lock. Reject duplicate dates and stale proposals; rejected finalization restores a reviewable draft. Keep audit-event IDs stable so coalesced offline writes retain intermediate edits. Corrections create a new later-dated reporting period with selected revised activities and a required reason, retaining the original snapshot and exposing a correction log. Export a weekly UTF-8 CSV for Excel instead of adding a workbook library. Native SVG charts need no chart dependency and include a table alternative.


## D-18 NBC update workflow feedback · October 26, 2026

Move NBC navigation to Projects Progress while retaining its existing owner and Team database metadata. Rename views Project Progress and Update Progress. Keep four steps with the actual large activity editor inside Update; compact summaries and collapsed history prioritize working space. Journal raw input immediately and use the existing save queue for debounced valid edits. Preserve an open draft when leaving, and offer explicit activity cancellation that records a normal correction if a value already autosaved. Keep contribution to the whole project distinct from completion within a handler’s assigned share. Respect collapse state during filtering after opening ancestor context once.

Reuse shared task deletion for notes/Undo. Empty Trash permanently removes trashed pages/tasks with owner and expected-revision checks; queued removal survives offline recovery. Concurrently changed items remain available for review. Hide Design system from navigation without removing its route or existing component checks. No production operations are part of this follow-up.


## D-19 Full-screen progress editing and discard · October 26, 2026

The user clarified that bigger means the page fills the screen, with normal text. Hide shell/project chrome for the Update Progress route and give remaining viewport height to the table. Back offers keep editing, keep the draft, or delete. The user selected undoing the update’s percentages on delete. Restore the preceding finalized values (initial baseline if none), retain remarks/assignments/history, and remove only the open report. Use one owner-checked, revision-checked RPC under the existing project lock for atomic server rollback and deletion. Do not grant direct report deletion or permit deleting finalized snapshots. Reuse the durable save queue for discard intent and refresh canonical activities after acknowledgement. The additional migration is prepared and tested locally only.
