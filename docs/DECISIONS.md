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
