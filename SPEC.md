# Build Prompt: Notion-Style Workspace App

Oct 18, 2026 · @Kimpor

## How to use this prompt

Paste sections 1 to 16 into your coding agent (Claude Code, Cursor or similar) as one message, and tell it to stop for your review after each phase in section 15. Replace `[Kimpor Workspace]` with your app's name, and keep your logo SVG ready for Phase 0.

Everything below is written to the agent in second person. The current visual source of truth is the Stitch export in `C:\Users\jpkim\OneDrive\SB Documents\stitch_kimpor_workspace_design_system`, especially `quiet_glass_workspace/DESIGN.md` and the updated desktop `code.html` files. Sections 9 to 11 remain the baseline tokens; Stitch takes precedence where its updated screens differ. See `docs/DECISIONS.md` and `docs/BUILD-STATUS.md` for reconciliation and current acceptance status.

## 1. Mission and success criteria

You are a senior product designer and full-stack engineer. Build **\[Kimpor Workspace\]**: a Notion-style workspace web app with a built-in calendar that connects to multiple Google accounts, a project task tracker, and a polished liquid glass interface.

It is one installable web app (PWA) where I write pages, plan my time on a calendar that merges all my Google calendars, and track tasks per project. It must look and feel native on Windows 11 (Chrome and Edge), iPad (A16, Safari) and iPhone 15 (Safari).

**Success criteria**

- It matches Notion's structure (sidebar page tree, block editor, slash menu) and iOS 26's finish (liquid glass controls, springy feedback).
- Every click, tap, drag and toggle shows feedback within 100 ms, at 60 fps on all three devices (all have 60 Hz displays).
- Light and dark themes follow the Notion-style palette in section 9 and pass WCAG 2.2 AA.
- The calendar shows events from any number of connected Google accounts, and edits sync both ways.
- Tasks are tracked per project in board, list and table views, and appear on the calendar.
- Reading and light editing work offline, then sync when the connection returns.
- Everything runs on free tiers: Vercel Hobby, Supabase Free, GitHub and the Google Calendar API.

**In scope for v1:** pages and block editor, daily notes, projects and tasks, calendar with Google multi-account sync, search, light and dark themes, PWA, offline cache.

**Out of scope for v1:** real-time multi-user collaboration, AI features, public page sharing, billing, generic databases, and native or desktop wrappers. Keep the code ready for later additions: put calendars behind a provider interface (so Apple/iCloud CalDAV and Outlook can be added) and avoid assumptions that would block a Windows desktop wrapper such as Tauri.

**Branding.** Use a placeholder wordmark and icon until I give you my logo as an SVG. Keep the logo in `public/brand/` and generate favicons and PWA icons from it with a script, so swapping it is one command.

## 2. Operating rules for you, the agent

Make decisions yourself, document them, and ship working increments. Ask me a question only when a missing answer blocks the build.

1. Work in the phases in section 15. Finish one completely (code, tests, screenshots), then stop and summarize before starting the next.
2. Before each phase, post a short plan. After it, post what changed, how to run it, and the decisions you made.
3. Record every non-obvious decision in `docs/DECISIONS.md` with the reason and the alternative you rejected.
4. Treat sections 9 to 11 as the design source of truth. Use tokens only: no hard-coded colors, radii, spacing or durations in components.
5. Leave no lorem ipsum, dead buttons or `TODO` in shipped code. If a feature is deferred, hide it.
6. Verify, do not assume. After every phase run type checks, unit tests and Playwright in both Chromium and WebKit, and attach screenshots at the viewports in section 16.
7. Follow official documentation for Google APIs, Supabase and browser features. If a doc contradicts this prompt, follow the doc and note it in `DECISIONS.md`.
8. Keep secrets out of the repository and the client bundle. Provide `.env.example` and `SETUP.md`.
9. Keep the first load small (section 13 budgets) and lazy-load the editor and calendar.
10. Create a private GitHub repository with a clean history, conventional commits, and a CI workflow that runs lint, type check, tests and build.

**Quality bar.** Polish is a requirement, not a phase. Every screen needs aligned baselines, a consistent 4 px grid, empty, loading and error states, and both themes before you call it done.

## 3. Devices and browsers

Design and test for three primary devices. All three have 60 Hz displays, so the frame budget is 16.6 ms.

| Device | Browser | Viewport (CSS px) | Input | Notes |
| --- | --- | --- | --- | --- |
| Windows 11 laptop | Chrome and Edge (Chromium), also installed as an app | 1280×720 to 1920×1080 after display scaling (125% to 150% is common) | Mouse and keyboard, optional touch | Ctrl shortcuts, right-click menus, thin scrollbars, window controls overlay when installed |
| iPad (A16, 11th generation, 11-inch) | Safari and installed web app | 820×1180 portrait, 1180×820 landscape, down to about 320 wide in Split View | Touch, optional keyboard and trackpad | Cmd shortcuts, hover only when a pointer is present, safe areas |
| iPhone 15 | Safari and installed web app | 393×852 portrait | Touch only | Dynamic Island and home indicator safe areas, keyboard shrinks the visual viewport, 16 px minimum input font |

- Support the latest stable Chrome and Edge, and Safari on iOS and iPadOS 18 and later (target the latest). Firefox should work but is not a release blocker.
- Lay out with container queries and these breakpoints (CSS px): compact below 640, medium 640 to 1023, expanded 1024 to 1439, large 1440 and up. Never sniff the user agent for layout.
- Detect input by capability: hover styles only under `(hover: hover) and (pointer: fine)`, larger targets under `(pointer: coarse)`.
- Touch targets are at least 44×44 px. On desktop, rows are at least 28 px high and controls 32 px.
- Use `100dvh`, `env(safe-area-inset-*)`, `viewport-fit=cover` and the `visualViewport` API for keyboard handling.
- Shortcuts use Ctrl on Windows and Cmd on iPad. Show the right glyph per platform, and avoid browser-reserved combinations such as Ctrl+N, Ctrl+T and Ctrl+W.

## 4. Stack (free tiers)

Use this stack unless you find a strong reason not to, and log any change in `docs/DECISIONS.md`.

| Layer | Choice | Why |
| --- | --- | --- |
| App | React 19, TypeScript (strict), Vite | Fast builds, simple PWA setup |
| Styling | Tailwind CSS v4 with CSS variable tokens; hand-written CSS for glass | Tokens drive both themes |
| Primitives | Radix UI (menus, popovers, dialogs, tooltips) | Accessible and unstyled |
| Motion | Motion (formerly Framer Motion) for springs and layout animation; CSS for micro-interactions; View Transitions API with a fallback | Interruptible, physics-based feedback |
| Editor | BlockNote (ProseMirror and Tiptap based) with a custom theme; fallback Tiptap with custom block extensions | Notion-like blocks, slash menu, drag handles |
| Data and state | TanStack Query, Zustand, Dexie (IndexedDB) | Offline-first cache |
| Calendar UI | Custom CSS Grid views (day, week, month, agenda) | Full control of spacing and animation; do not skin a heavy library |
| Dates | date-fns v4 with time zone support, `rrule` for recurrence editing, `chrono-node` for quick-add parsing | Reliable zones and recurrence |
| Drag and drop | dnd-kit with pointer, touch and keyboard sensors | Works on all three devices |
| Overlays | Sonner (toasts), Vaul (iOS-style bottom sheets) | Spring motion built in |
| Icons | Lucide, 1.75 px stroke | One consistent set |
| Backend | Supabase Free: Postgres, Auth, Row Level Security, Storage, Realtime | Free tier, relational data |
| Server functions | Vercel Hobby serverless functions | Google OAuth, token minting, webhooks |
| Hosting and CI | Vercel and GitHub Actions | Preview deployment per pull request |
| PWA | `vite-plugin-pwa` (Workbox) | Offline shell and install |
| Tests | Vitest, Testing Library, Playwright (Chromium and WebKit projects), axe-core | WebKit covers Safari engine behavior |

Vercel's Hobby plan is meant for personal, non-commercial projects, so check its current terms if the app ever becomes commercial.

## 5. App structure and navigation

**Routes:** `/` Home, `/p/:id` page, `/calendar/:view/:date`, `/projects`, `/projects/:id/:view`, `/tasks` (My tasks), `/search`, `/settings/:section`.

**Sidebar**, top to bottom: account and workspace menu; Search (Ctrl or Cmd+K); Home; Calendar; My tasks; Projects (colored dot and progress per project); Favorites; Pages (nested tree, drag to reorder and nest); Trash; Settings; New page button.

**Layout by breakpoint**

| Breakpoint | Layout |
| --- | --- |
| Large and expanded (1024 and up) | Floating glass sidebar 260 px (resizable 220 to 380, collapsible with Ctrl or Cmd plus backslash), main canvas, and an optional right inspector 340 px wide for task and event details |
| Medium (640 to 1023) | Sidebar becomes an overlay drawer and the inspector opens as a 380 px right sheet. iPad landscape (1180) uses the expanded layout |
| Compact (below 640) | Bottom glass tab bar (Home, Calendar, Projects, Search) with a center add button. The page tree opens from Home as a full-height sheet, and inspectors open as bottom sheets with detents |

**Top bar:** breadcrumbs, favorite star, last edited, sync status pill and overflow menu. On compact screens a large title collapses into the bar as you scroll.

**Command palette** (Ctrl or Cmd+K): fuzzy search across pages, tasks, projects and events, plus commands such as New task, Go to today and Toggle theme.

**Quick add:** one input for tasks and events that parses natural language, for example `Review plan tomorrow 3pm #Website !high`.

## 6. Pages and block editor

Pages are nested documents with an icon, cover, title and blocks. Match Notion's behavior for everything listed here and skip what is not listed.

**Blocks:** paragraph, headings 1 to 3, bulleted list, numbered list, to-do, toggle, quote, callout, divider, code (language picker and copy button), image, file, simple table, bookmark, 2 to 3 columns, and a Tasks view block that embeds a filtered task list from a project.

**Editing**

- Slash menu: type `/`, filter as you type, arrow keys and Enter to insert.
- Markdown shortcuts: `#`, `-`, `1.`, `[]`, `>`, `---` and triple backticks.
- Floating toolbar on selection: bold, italic, underline, strikethrough, code, link, text color and highlight from the palette in section 9.
- Drag handle with a block menu: turn into, color, duplicate, delete. Multi-block selection, undo and redo.
- `@` mentions for pages and dates, page links with backlinks, and clean paste from Markdown and rich text.

**Page chrome:** emoji or image icon, cover (gradient presets or an upload), full-width and small-text toggles, and a font choice of Default, Serif or Mono.

**Daily notes:** a note per day created from a template and linked from the calendar day header, so journal entries sit next to events.

**Saving:** debounce 600 ms, optimistic updates, and a status pill that morphs from Saving to Saved. Deleted pages go to Trash for 30 days. Any page exports to Markdown.

**Touch behavior:** no hover handles. Tap a block's `⋮` target for its menu, show the slash menu above the keyboard, and dock the formatting bar above the keyboard on iPhone.

## 7. Projects and task tracker

Projects and tasks are first-class features, not generic databases. Each task is also a page, so it can hold notes.

**Project fields:** name, icon, color (from the Notion palette), description, status (Planned, Active, On hold, Completed, Archived), start and target dates, and progress derived from its tasks.

**Task fields:** title, notes (page body), status (Not started, In progress, In review, Blocked, Done), priority (Low, Medium, High, Urgent), due date with optional time, start date, estimate, labels, project, parent task (subtasks to two levels), recurrence, reminders, order index, and created, updated and completed timestamps.

**Status colors:** Not started gray, In progress blue, In review purple, Blocked red, Done green. **Priority colors:** Low gray, Medium blue, High orange, Urgent red.

**Project views** (tabs in the project header, remembering each project's last view):

1. Overview: progress ring, counts by status, overdue and due-this-week lists, recent activity.
2. Board: columns by status, drag cards between and within columns, WIP counts, quick add at each column foot, optional swimlanes by priority.
3. List: grouped by status, collapsible groups, inline edit of title, due date, priority and labels.
4. Table: sortable, filterable, resizable and hideable columns, inline edit.
5. Calendar: tasks by due date on a month grid.
6. Timeline (v1.1): bars from start to due date, drag to reschedule.

**My tasks** spans all projects with Today, Upcoming, Overdue, No date and Done sections, filters for project, priority and label, and saved views.

**Task detail** opens in the right inspector on desktop and iPad landscape, and as a bottom sheet on iPhone and iPad portrait. Every field is editable there, with subtasks, notes and an activity log.

**Calendar link:** tasks with dates show on the calendar as checkbox chips in a distinct style. Dragging one onto a time slot time-blocks it, and ticking it completes it. A toggle in the calendar sidebar shows or hides the Tasks layer.

**Shortcuts:** `C` new task, `X` complete, `1` to `4` set priority, `E` edit due date.

## 8. Calendar and Google account sync

The calendar merges local events, tasks and any number of Google accounts, and edits sync both ways.

**Views:** Day, Week (default on desktop and iPad), Month and Agenda (default on iPhone). The sidebar holds a mini month and the calendar list. Controls: Today, previous and next, and the keys `D`, `W`, `M`, `A`, `T` and `J`/`K`. On touch, swipe to change period.

**Rendering rules**

- Week and day grids use CSS Grid with 15-minute snapping, 56 px per hour on desktop and 64 px on touch. Hour labels are vertically centered on their gridlines and use tabular numerals.
- Overlapping events use a cluster and column-packing layout. All-day and multi-day events sit in a pinned row. Month cells show a +N more popover.
- Event chips have a tinted background, a 3 px solid left bar in the calendar color, then title and time. A current-time line with a dot updates every minute.
- Drag on an empty slot to create (long-press on touch), drag to move, and resize from the bottom edge. All updates are optimistic and roll back on failure.
- Display times in my time zone, offer an optional second time zone column, and mark events that belong to another zone.

**Event editor:** title, calendar picker grouped by account, start and end, all-day, time zone, repeat (presets and custom RRULE), location, description, guests with RSVP status, Google Meet link, reminders, color, busy or free, and visibility. Recurring edits ask This event, This and following, or All events. Deleting shows an Undo toast.

**Connecting Google accounts**

1. Settings, Calendars, Add Google account starts the OAuth 2.0 authorization code flow with PKCE through a serverless function, using `access_type=offline`, `prompt=consent select_account` and `include_granted_scopes=true`.
2. Request least-privilege scopes: `openid email profile`, `https://www.googleapis.com/auth/calendar.calendarlist.readonly` and `https://www.googleapis.com/auth/calendar.events`. Ask for more only when a feature needs it.
3. Store each refresh token encrypted on the server only. A function mints short-lived access tokens on request, and the browser calls the Google Calendar API directly with them.
4. Support unlimited accounts. Each account row shows avatar, email, status (syncing, OK, needs sign-in), a Reconnect button, and a Disconnect button that revokes the token and purges cached events.
5. List every calendar of each account (primary, secondary, subscribed). Per calendar: a visibility toggle, a color (Google's by default, overridable from the Notion palette) and a default-for-new-events choice.

**Sync engine**

- Follow Google's incremental sync guide exactly: one initial sync per calendar, store the `nextSyncToken`, then sync with `syncToken`. Bound the initial window to 3 months back and 12 months ahead only if the guide confirms the token keeps that restriction. Otherwise sync without bounds and trim in the cache.
- Never send `timeMin`, `timeMax`, `orderBy` or `q` together with a `syncToken`. On a 410 response, clear that calendar's cache and run a full sync again.
- Use `singleEvents=true` so recurring series arrive as instances, and keep `recurringEventId` and `originalStartTime` for edits.
- Send ETags with `If-Match` on updates. On a 412 response, refetch and show a non-blocking conflict message.
- v1 polls every 60 seconds while the app is visible and on focus, with exponential backoff and jitter on 403 and 429 responses. v1.1 adds push through `events.watch` webhooks.
- Cache normalized events in IndexedDB so the calendar renders instantly and works offline, and queue writes while offline.
- Hide Google behind a `CalendarProvider` interface (`listCalendars`, `sync`, `create`, `update`, `delete`) so Apple/iCloud (CalDAV) and Outlook can be added later without touching the UI.

**Google Cloud setup** (put the steps in `SETUP.md`): create a project, enable the Google Calendar API, configure the OAuth consent screen, and create a Web client with redirect URIs for localhost, Vercel previews and production.

**Token expiry warning.** While the consent screen is in Testing status, refresh tokens issued to an external app expire after 7 days, and new OAuth clients are capped at 100 users. Moving the status to In production removes the 7-day expiry (tokens then last until revoked or unused for about six months). For a personal app, publish it, accept Google's unverified-app warning screen, and reconnect each account once so Google issues a fresh long-lived token. Calendar scopes are sensitive, so a public launch would need Google's verification; personal use does not. See [Google's OAuth setup notes](https://developers.google.com/health/setup).

## 9. Design tokens: Notion-style palette, type, spacing

Define every token as a CSS custom property on `:root` and override it under `[data-theme='dark']`. Components reference semantic tokens only. The values are Notion-inspired and tuned for contrast (secondary text is a little darker than Notion's own so it passes AA). Treat them as this project's source of truth, and fix any pair that fails an automated contrast check.

**Core surfaces and text**

| Token | Light | Dark |
| --- | --- | --- |
| `--bg-canvas` | `#FFFFFF` | `#191919` |
| `--bg-sidebar` | `#F7F7F5` | `#202020` |
| `--bg-raised` (cards, popovers) | `#FFFFFF` | `#252525` |
| `--bg-hover` | `rgb(55 53 47 / .06)` | `rgb(255 255 255 / .055)` |
| `--bg-pressed` | `rgb(55 53 47 / .10)` | `rgb(255 255 255 / .09)` |
| `--border-subtle` | `rgb(55 53 47 / .09)` | `rgb(255 255 255 / .09)` |
| `--border-strong` | `rgb(55 53 47 / .16)` | `rgb(255 255 255 / .17)` |
| `--text-primary` | `#37352F` | `rgb(255 255 255 / .81)` |
| `--text-secondary` | `rgb(55 53 47 / .72)` | `rgb(255 255 255 / .52)` |
| `--text-tertiary` (disabled and decorative only) | `rgb(55 53 47 / .45)` | `rgb(255 255 255 / .34)` |
| `--accent` (focus ring, selection, indicators) | `#2383E2` | `#2383E2` |
| `--accent-fill` (filled buttons with white label) | `#1A73D9` | `#1A73D9` |
| `--accent-text` (links) | `#1B6EC2` | `#5BA5F0` |
| `--selection` | `rgb(35 131 226 / .14)` | `rgb(35 131 226 / .28)` |
| `--danger` | `#EB5757` | `#FF7369` |
| `--success` | `#448361` | `#529E72` |

**Palette for tags, project colors, status and highlights**

| Color | Text and icon (light) | Text and icon (dark) | Chip background (light) | Chip background (dark) |
| --- | --- | --- | --- | --- |
| Gray | `#787774` | `#9B9B9B` | `#E3E2E0` | `#454B4E` |
| Brown | `#9F6B53` | `#BA856F` | `#EEE0DA` | `#434040` |
| Orange | `#D9730D` | `#C77D48` | `#FADEC9` | `#594A3A` |
| Yellow | `#CB912F` | `#CA9849` | `#FDECC8` | `#59563B` |
| Green | `#448361` | `#529E72` | `#DBEDDB` | `#354C4B` |
| Blue | `#337EA9` | `#5E87C9` | `#D3E5EF` | `#364954` |
| Purple | `#9065B0` | `#9D68D3` | `#E8DEEE` | `#443F57` |
| Pink | `#C14C8A` | `#D15796` | `#F5E0E9` | `#533B4C` |
| Red | `#D44C47` | `#DF5452` | `#FFE2DD` | `#594141` |

Chips use the chip background with `--text-primary`. Palette text colors are for icons, dots and highlights. If you use one as small text, darken it in light mode (lighten it in dark mode) until it reaches 4.5:1. Block and callout backgrounds derive from the chip color: `color-mix(in srgb, var(--chip-bg) 45%, var(--bg-canvas))`.

**Typography**

Font stack: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI Variable Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`. It renders SF Pro on iPhone and iPad and Segoe UI Variable on Windows 11, so the app feels native on each. Serif option: `ui-serif, 'New York', Georgia, serif`. Mono option: `ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace`. Download no web fonts. Use `font-variant-numeric: tabular-nums` for times, dates and counts, and rem units so browser text scaling works.

| Role | Size / line height (px) | Weight | Tracking |
| --- | --- | --- | --- |
| Page title | 40/48 (32/40 compact) | 700 | -0.02em |
| Heading 1 | 30/38 | 700 | -0.015em |
| Heading 2 | 24/32 | 600 | -0.01em |
| Heading 3 | 20/28 | 600 | -0.005em |
| Body | 16/24 | 400 | 0 |
| UI label | 14/20 | 500 | 0 |
| Small | 12/16 | 500 | 0.01em |
| Caption | 11/14 | 600 | 0.04em |

Inputs on iPhone and iPad are at least 16 px so Safari does not zoom on focus.

**Spacing, shape and depth**

- Spacing scale on a 4 px base: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64.
- Page content is 720 px wide (1100 px in full-width mode) with 96 px side padding on large screens, and 16 px plus the safe area on compact.
- Heights, desktop and touch: sidebar item 28 and 44, list row 36 and 48, button 32 and 44, input 36 and 44.
- Radii: 4 chips and inline code, 6 buttons and inputs, 8 cards and list items, 12 popovers and menus, 16 modals, 20 glass panels, 28 iPhone tab bar, 999 pills. Keep radii concentric: inner radius equals outer radius minus padding.
- Popover shadow, light: `0 0 0 1px rgb(15 15 15 / .05), 0 3px 6px rgb(15 15 15 / .10), 0 9px 24px rgb(15 15 15 / .20)`. Dark: `0 0 0 1px rgb(0 0 0 / .20), 0 3px 6px rgb(0 0 0 / .30), 0 9px 24px rgb(0 0 0 / .40)`.

**Theming:** Light, Dark and System, defaulting to System. An inline script sets `data-theme` and `color-scheme` before first paint so there is no flash. Add `theme-color` meta tags for both schemes. Switch themes with a circular View Transition from the toggle, falling back to a 200 ms color fade. Support `forced-colors`.

**Icons:** Lucide at 16, 18, 20 and 24 px, 1.75 px stroke, `currentColor`.

## 10. Liquid glass system

Liquid glass is the control layer that floats above content. Content stays solid and legible: editor text, calendar cells, task cards and table rows are never glass.

**Use glass for:** the floating sidebar, top toolbar, command palette, popovers and menus, modals and sheets, date and time pickers, toasts, the iPhone tab bar, the floating add button, segmented controls and the event popover. **Never stack glass on glass.** A menu opened from a glass surface uses the Thick material.

**Materials**

| Material | Use | Light fill | Dark fill | Blur | Saturate |
| --- | --- | --- | --- | --- | --- |
| Thin | Toolbars over content | `rgb(255 255 255 / .45)` | `rgb(32 32 32 / .45)` | 12 px | 150% |
| Regular | Sidebar, tab bar, popovers | `rgb(255 255 255 / .62)` | `rgb(32 32 32 / .60)` | 24 px | 180% |
| Thick | Modals, sheets, menus over glass | `rgb(255 255 255 / .78)` | `rgb(32 32 32 / .78)` | 40 px | 180% |
| Tinted | Primary glass buttons | `--accent-fill` at 70% over Regular | same | 24 px | 180% |

**Ambient backdrop.** Glass needs something to blur. Give the canvas a static ambient layer: three large blurred blobs from the palette at 5% opacity in light mode and 10% in dark mode, plus the page cover when one exists. Do not animate it, to save battery.

**Starter CSS.** Adapt it to the tokens and keep both the standard and the `-webkit-` properties. Define `--shadow-popover` from the elevation values in section 9.

```css
:root {
  --glass-bg: rgb(255 255 255 / .62);
  --glass-blur: 24px;
  --glass-saturate: 180%;
  --glass-hairline: rgb(55 53 47 / .10);
  --glass-highlight: rgb(255 255 255 / .70);
  --glass-shade: rgb(55 53 47 / .06);
  --glass-shadow: 0 8px 32px rgb(15 15 15 / .12);
}
[data-theme='dark'] {
  --glass-bg: rgb(32 32 32 / .60);
  --glass-hairline: rgb(255 255 255 / .12);
  --glass-highlight: rgb(255 255 255 / .16);
  --glass-shade: rgb(0 0 0 / .30);
  --glass-shadow: 0 10px 40px rgb(0 0 0 / .50);
}
.glass {
  position: relative;
  isolation: isolate;
  border-radius: var(--glass-radius, 20px);
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  box-shadow:
    0 0 0 1px var(--glass-hairline),
    inset 0 1px 0 var(--glass-highlight),
    inset 0 -1px 0 var(--glass-shade),
    var(--glass-shadow);
}
/* specular rim: a 1px gradient border, brighter at top-left and bottom-right */
.glass::before {
  content: '';
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(135deg,
    rgb(255 255 255 / .65), rgb(255 255 255 / 0) 40%,
    rgb(255 255 255 / 0) 60%, rgb(255 255 255 / .30));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
}
html[data-glass='reduced'] .glass { --glass-blur: 12px; }
html[data-glass='off'] .glass {
  background: var(--bg-raised);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: 0 0 0 1px var(--border-subtle), var(--shadow-popover);
}
@media (prefers-reduced-transparency: reduce) {
  .glass {
    background: var(--bg-raised);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
```

**Refraction (Chromium only, progressive enhancement).** For small floating elements (tab bar, segmented control, add button, toolbar pills under about 400×100 px), bend the backdrop at the edges with an SVG displacement filter through `backdrop-filter: url(#lens)`. Only Chromium renders this. Safari accepts the syntax and draws nothing, so an `@supports` check reports success and lies. Detect the engine at runtime (for example `navigator.userAgentData?.brands` containing Chromium, plus a one-time render probe) and set `html[data-glass='refract']`. Everywhere else, use blur, saturate and the specular rim. Background reading: [SVG backdrop filters are Chromium-only](https://github.com/rizroze/liquid-glass) and [Safari renders nothing for url() filters](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07).

**Safari and performance rules**

- Keep the `-webkit-backdrop-filter` prefix next to the standard property.
- `backdrop-filter` creates a containing block, so a `position: fixed` child behaves oddly inside it. Render menus, tooltips and toasts in a portal at the end of `<body>`.
- Each glass surface is a separate compositing pass. Show at most 6 at once and keep them off areas that repaint constantly.
- Never animate the blur radius on large areas. Animate the opacity or transform of the glass element instead.
- Test on a real iPhone and iPad for flicker with rounded corners and `overflow: hidden`. Add `transform: translateZ(0)` only where a flicker appears.

**Adaptive modes.** Settings, Appearance, Glass effect: Auto, Full, Reduced, Off. Auto starts at Full and drops to Reduced if frame time stays above 20 ms for 2 seconds. Reduced is blur only, with no refraction. Off uses solid surfaces with borders. `prefers-reduced-transparency: reduce` and `prefers-contrast: more` force Off or raise opacity, and `forced-colors: active` uses system colors.

**Interaction states.** Hover (pointer only): the rim brightens, the element lifts 1 px, and a soft sheen follows the cursor through `--mx` and `--my` (throttled with requestAnimationFrame). Press: scale to 0.97 with a spring and a highlight at the touch point. Focus-visible: a 2 px accent ring with a 2 px offset. Segmented controls use a glass lens that slides and stretches to the active segment.

**Legibility.** Text on glass must reach 4.5:1 against the worst-case backdrop. If it does not, add a scrim or move up to the Thick material. Check over the brightest and darkest covers in both themes.

## 11. Motion and feedback animations

Every interaction answers within 100 ms. Motion explains cause and effect and never decorates. Animations are interruptible and animate `transform` and `opacity` only (plus glass opacity, never blur radius).

**Tokens**

| Token | Value |
| --- | --- |
| Duration | instant 80 ms, fast 140 ms, base 220 ms, slow 340 ms, page 420 ms. Exits run at 70% of the enter duration |
| Easing | standard `cubic-bezier(.2, 0, 0, 1)`, enter `cubic-bezier(0, 0, .2, 1)`, exit `cubic-bezier(.4, 0, 1, 1)` |
| Springs | snappy (stiffness 520, damping 34), smooth (stiffness 300, damping 30), bouncy (stiffness 420, damping 22) |

**Feedback catalog**

| Interaction | Feedback |
| --- | --- |
| Buttons and rows | Press scales to 0.97 and darkens, then springs back (snappy). Pointer hover lifts 1 px and brightens the rim |
| Loading button | The label cross-fades to a spinner at constant width. Success morphs to a check that draws in 240 ms. Failure shakes 8 px three times |
| Checkbox and switch | The box fills with a spring while the check draws along its path. The switch thumb stretches, then settles like iOS |
| Task complete | The check draws, the title strikes through left to right in 200 ms, the row dims, and after 600 ms it collapses with an Undo toast. The project progress ring animates to its new value with a count-up |
| Drag and drop | Pick-up scales to 1.02, grows the shadow and tilts the card 1.5 degrees. The gap opens with a layout animation, the drop settles with the snappy spring, and edges auto-scroll |
| Menus and popovers | Scale from 0.96 and fade in from the trigger's origin. Exit in 100 ms |
| Modals and sheets | Desktop: scale 0.98 to 1 over a dimmed backdrop. Touch: bottom sheet with a drag handle, medium and large detents, rubber-banding and velocity-based dismissal |
| Page and view changes | View Transitions cross-fade with a shared title and icon. Calendar previous and next slide 12% horizontally with a fade. Switching view type cross-fades and scales from 0.98 |
| Calendar events | Create: a ghost block grows while dragging. Move and resize: snap with a 120 ms settle. The popover morphs from the clicked chip. The now-line dot pulses each minute |
| Save and sync | The status pill morphs from Saving to Saved. The offline pill slides in. A subtle spinner shows on the syncing account row |
| Toasts | Slide and scale in from the bottom (mobile) or bottom-left (desktop), stack with an offset, swipe to dismiss, and show a timer bar for Undo |
| Loading lists | Skeleton shimmer over 1.2 s, then a 30 ms stagger per item (maximum 8 items) |
| Errors | The field shakes once, the message slides down, and focus returns to the field |
| Connect Google account | The avatar scales in, the calendar list staggers in, and the first sync shows progress |
| Theme switch | Circular reveal from the toggle, falling back to a 200 ms color fade on key surfaces |
| Empty states | The glyph floats gently (6 px over 4 s) and the primary button has a soft glow |

**Rules**

- Respect `prefers-reduced-motion`: replace movement with opacity fades, remove spring overshoot, and drop parallax.
- Set `will-change` only while an animation runs, never animate `width`, `height`, `top` or `left` (use FLIP transforms), and run at most 2 blurred animations at once.
- Keep long tasks under 50 ms on iPhone 15 so touch feedback never lags.
- Haptics are optional, off by default and behind a setting: `navigator.vibrate` where available, and the hidden `<input type='checkbox' switch>` toggle trick on iOS Safari 17.4 and later. Verify on a real device.

## 12. Layout per device

**Windows 11 (Chrome and Edge)**

- Three zones: sidebar 260 px, canvas, inspector 340 px, under a 44 px top bar. When installed, use `display_override: ['window-controls-overlay']` and place the glass toolbar in the title bar area with `env(titlebar-area-*)`.
- Pointer first: hover states, right-click context menus, drag handles on hover, Ctrl shortcuts, and Esc closes the top layer.
- Thin custom scrollbars (`scrollbar-width: thin`, colors from tokens) and `forced-colors` support for Windows high contrast.
- Crisp 1 px borders at 100%, 125% and 150% display scaling. Test all three.

**iPad A16 (Safari and installed)**

- Landscape (1180×820): expanded layout with a persistent, collapsible sidebar. Portrait (820×1180): the sidebar is an overlay drawer and the inspector is a 380 px right sheet.
- Touch first with pointer enhancement: drag starts after a 350 ms long press, and Magic Keyboard shortcuts (Cmd) and trackpad hover work.
- Use container queries so Split View, Slide Over and Stage Manager windows adapt without orientation assumptions. The week view shows 7 days in landscape and 5 in portrait, and falls back to the day view in narrow windows.
- Use `viewport-fit=cover` and the `black-translucent` status bar style so glass extends under the status bar.

**iPhone 15 (Safari and installed)**

- 393×852. Bottom glass tab bar 64 px high plus the bottom safe area, large collapsing titles, and Agenda as the default calendar view with a week strip on top.
- Bottom sheets with medium (50%) and large (92%) detents. Swipe actions on task rows: right to complete, left for more and delete. Custom pull to refresh on lists.
- Use `visualViewport` to lift composers, toolbars and sheets above the keyboard, and dock the formatting bar there. Inputs are at least 16 px.
- No hover dependencies. Set `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent` and `overscroll-behavior: contain` in sheets, and avoid `100vh`.
- Keep content clear of the Dynamic Island and the home indicator with safe-area insets.

**Alignment rules for every screen**

- Everything sits on the 4 px grid. Sidebar text has a 12 px inset, and page content aligns to the title's left edge.
- Icons are optically centered in 28 to 32 px boxes, and text baselines align across a row.
- Numeric columns are right-aligned with tabular numerals. Rows keep a constant height whatever their content.
- Hover controls reserve their space so nothing shifts when they appear. Adjacent 1 px borders collapse into one, and radii stay concentric.

## 13. Accessibility, performance, offline and PWA

**Accessibility (WCAG 2.2 AA)**

- Contrast is 4.5:1 for text and 3:1 for UI components and focus rings, checked on glass over the worst-case backdrop.
- Everything works from the keyboard. The calendar grid, board and table use roving tabindex: arrows move, Enter opens, Space picks up and drops. Every drag has a menu alternative such as Move to.
- Use ARIA roles: `tree` for the sidebar, `grid` for calendar and table, `dialog` for modals and sheets, and live regions for toasts and sync status.
- Show a visible focus ring everywhere, trap focus in modals, and return focus to the trigger on close.
- Honor `prefers-reduced-motion`, `prefers-contrast`, `prefers-reduced-transparency`, `forced-colors` and browser text scaling up to 200%.
- Give event chips full labels, for example Design review, 2 to 3 pm, Work calendar, with the account name.

**Performance budgets**

- LCP under 2.0 s on a mid-range phone over 4G, INP under 200 ms, CLS under 0.05.
- App shell JavaScript under 200 KB gzipped. Lazy-load the editor, calendar and settings by route.
- Lighthouse 95 or higher for Performance, Accessibility and Best Practices.
- Virtualize lists over 100 rows (TanStack Virtual), lazy-load responsive images, and use no web fonts.

**Offline and sync**

- A service worker precaches the shell. Reads come from IndexedDB first, then revalidate.
- Writes go to an outbox with optimistic UI and retry with backoff. Last write wins by server timestamp, with a banner when a remote change replaces a local edit. An offline pill shows the state.

**PWA**

- Manifest: name, short name, 192 and 512 icons plus a maskable icon, `display: standalone`, `display_override`, theme and background colors for both schemes, and shortcuts for New page, New task and Today.
- iOS tags: `apple-touch-icon` at 180×180, `apple-mobile-web-app-capable`, the status bar style, and optional startup images.
- Show a custom install prompt in Chromium (`beforeinstallprompt`) and Add to Home Screen coach marks on iOS, which has no install event.
- Web Push reminders come in v1.1. On iOS they work only for installed web apps.

## 14. Data model, security and setup

Every table has `id` (uuid), `user_id`, `created_at` and `updated_at`, with Row Level Security so a user reads and writes only their own rows.

| Table | Key columns |
| --- | --- |
| `profiles` | display name, avatar, settings JSON (theme, glass level, week start, 12 or 24 hour clock, default calendar) |
| `pages` | parent\_id, title, icon, cover, content JSON, is\_favorite, position, deleted\_at |
| `projects` | name, icon, color, description, status, start\_date, target\_date, position, archived\_at |
| `tasks` | project\_id, page\_id, parent\_id, title, status, priority, start\_at, due\_at, due\_has\_time, estimate\_min, recurrence, completed\_at, position |
| `labels`, `task_labels` | label name and color, and the join table |
| `calendar_accounts` | provider, provider\_account\_id, email, name, picture, status, scopes, last\_sync\_at |
| `calendar_tokens` | account\_id, encrypted refresh token, key id. No client access; service role only |
| `calendars` | account\_id, provider\_calendar\_id, name, color, color\_override, access\_role, visible, is\_default, sync\_token, time\_zone |
| `events` | calendar\_id, provider\_event\_id, etag, title, start and end, all\_day, time\_zone, recurrence fields, payload JSON, deleted flag. Local events live in a built-in local calendar |
| `reminders` | target type and id, remind\_at, sent\_at |

**Security**

- OAuth uses the authorization code flow with PKCE, a verified `state`, and allow-listed redirect URIs.
- Encrypt refresh tokens with AES-256-GCM using a key from environment variables. Never log them, store them in the browser, or send them to the client.
- Enable RLS on every table. `calendar_tokens` has no policies for the `anon` or `authenticated` roles.
- Send a strict Content Security Policy (only a hashed or nonce'd theme bootstrap script inline), `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy`. Lock CORS to the app's origins and rate-limit the functions.
- Sanitize pasted HTML and embeds, and validate inputs with Zod on the client and the server.
- Disconnecting an account deletes its tokens, calls Google's revoke endpoint and purges cached events.

**Serverless endpoints:** `POST /api/google/connect`, `GET /api/google/callback`, `POST /api/google/token` (mints a short-lived access token), `POST /api/google/disconnect`, and later `POST /api/google/webhook`.

**Setup files.** `SETUP.md` walks me through the GitHub repository, the Supabase project and migrations, the Google Cloud project (Calendar API, consent screen, Web client, redirect URIs, test users, publishing status and the 7-day token note from section 8), the Vercel project and environment variables, and a first run. `.env.example` lists `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` and `APP_URL`.

## 15. Build phases with acceptance criteria

Finish each phase completely and stop for my review. After each one, reply with a summary, screenshots, how to run it, your decisions and the open risks, and tag the commit `phase-N`.

| Phase | Build | Done when |
| --- | --- | --- |
| 0. Foundation | Repo, CI, tokens for both themes, glass primitives, motion tokens, app shell for all three breakpoints, PWA basics, and a `/design` specimen page showing every token and component in light and dark | The specimen matches sections 9 to 11 at 1440×900, 1180×820, 820×1180 and 393×852 in both themes, and Lighthouse is 95 or higher |
| 1. Pages | Auth, sidebar tree, block editor with slash menu, icons and covers, search and command palette, autosave, trash, daily notes | Pages can be created, nested, reordered, edited, searched and restored on all devices, and an offline edit syncs after reconnecting |
| 2. Projects and tasks | Projects, tasks, board, list and table views, My tasks, task inspector, quick add, completion animations | Cards drag between columns by mouse and touch, a keyboard alternative exists, and every state animates per section 11 |
| 3. Local calendar | Day, week, month and agenda views, event editor, drag to create, move and resize, tasks layer, mini month, now line | Overlap layout is correct with 20 events in a day, and dragging holds 60 fps on iPhone 15 |
| 4. Google | OAuth connect, multiple accounts, calendar list, sync engine, two-way edits, recurring edits, disconnect | Two Google accounts show merged events, an edit made on the phone appears in Google within 60 seconds, and revoking a token works |
| 5. Polish | Motion, glass, accessibility and performance passes, empty and error states, device QA | The section 16 checklist passes |
| Later | Webhook push sync, Web Push reminders, timeline view, linked task views in pages, import and export, Apple/iCloud and Outlook providers, Tauri Windows wrapper | Not part of v1 |

**Start with Phase 0.** Post your plan first, then build it and stop for review.

## 16. QA checklist and definition of done

**Test matrix:** Windows 11 with Chrome and Edge at 100%, 125% and 150% scaling; iPad A16 in Safari and installed, in portrait, landscape and Split View; iPhone 15 in Safari and installed; light and dark themes; glass set to Auto, Reduced and Off; online and offline.

**Screenshot viewports:** 1440×900, 1280×720, 1180×820, 820×1180, 393×852 and 320×640 (narrow Split View), in both themes.

**Checklist**

- Alignment: everything on the 4 px grid, baselines aligned in rows, icons optically centered, consistent left edges, and no layout shift on hover or load.
- Spacing: consistent padding per component size, no cramped or orphaned elements, long titles truncated with an ellipsis and tooltip, and 0, 1 and 500 items all render well.
- Themes: no hard-coded colors, contrast checks pass, and covers and images stay readable in dark mode.
- Feedback: every clickable element has hover (pointer), pressed, focus and disabled states, and every async action has loading, success and error states.
- Glass: legible over the brightest and darkest covers, the Safari fallback works, there is no flicker, and no more than 6 surfaces show at once.
- Calendar: events from 2 Google accounts, recurring edits, all-day and multi-day events, a daylight saving change week, an event in another time zone, and an offline edit that syncs later.
- Tasks: create, edit, move, complete and undo on every device, with subtasks and due dates shown on the calendar.
- Accessibility: axe reports no serious issues, a full keyboard pass works, and VoiceOver (iOS) and Narrator (Windows) handle the core flows.
- Performance: the section 13 budgets hold on iPhone 15 and a mid-range laptop, with 60 fps during drag and scroll.
- Security: no secrets in the bundle, RLS tests pass, and tokens never appear in client storage.

**Definition of done:** every item above passes, `README.md` and `SETUP.md` are accurate, CI is green, a deployed preview works on all three devices, and `docs/DECISIONS.md` is complete.

## Sources checked

- [Google Cloud and OAuth setup notes](https://developers.google.com/health/setup): refresh tokens expire after 7 days in Testing status, and new OAuth clients are capped at 100 users.
- [rizroze/liquid-glass](https://github.com/rizroze/liquid-glass): SVG backdrop filters render only in Chromium.
- [Liquid Glass on the Web: 6 Ways to Build It with CSS and SVG](https://dev.to/devyatov/liquid-glass-on-the-web-6-ways-to-build-it-with-css-and-svg-3m07): Safari ignores `url()` backdrop filters, `backdrop-filter` creates a containing block, and each glass layer costs a compositing pass.
