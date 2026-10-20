# Kimpor Workspace

A personal workspace for pages, projects, tasks, and a calendar. The UI follows the supplied Stitch **Quiet Glass Workspace** export: floating glass navigation, flat document canvases, Lucide icons, and light and dark themes.

The app includes BlockNote editing, Google and email sign-in, offline persistence, private cloud sync, and multiple Google Calendar connections. Guest mode starts with editable sample content; signed-in workspaces are separate. Physical-device acceptance remains open. See [build status](docs/BUILD-STATUS.md) for evidence and remaining work, and [setup](SETUP.md) for configuration.

## Run locally

```sh
corepack pnpm install
corepack pnpm dev
```

Open the URL printed by Vite. Production preview:

```sh
corepack pnpm build
corepack pnpm preview
```

## What works

- Home with today's local events, tasks, scratchpad, projects, and page links.
- Page creation, nesting and ordering, daily notes, favorites, BlockNote editing, file/image support, trash/restore, and Markdown export.
- Project creation/editing, overview, board, list, table, and project calendar. Card dragging, editable task fields, subtasks, filters, completion, and Undo. Tables support sorting, hidden columns, and resizing.
- Day, week, month, and agenda calendars; local event editing, overlap layout, all-day events, drag/resize controls, recurrence and time-zone code, dated task layer, and daily note links.
- Search across pages, projects, tasks, and events. Ctrl/Cmd+K opens commands; arrows and Enter select results; Escape closes overlays.
- Settings for theme, glass level, reduced motion, week start, clock format, and installation. Sidebar drawer below 1024 px and bottom tabs below 640 px.
- Account settings with separate sign-in/sign-up forms, Google sign-in, password reset, local import, and JSON backup. Calendar account connections use a separate OAuth flow.

## Verify

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm exec playwright install chromium webkit
corepack pnpm test:e2e --workers=4
```

With the production preview running, `node scripts/screenshots.mjs` captures the review matrix in `docs/screenshots/stitch-refresh/`. Replace `public/brand/logo.svg` and run `corepack pnpm icons` to regenerate the placeholder branding.

## Data

IndexedDB stores workspace snapshots, files, pending writes, and remote versions. The existing `kw-workspace-v1` localStorage key is retained for guest data; signed-in edits use a temporary recovery copy. Import guest work explicitly from Account settings after signing in. Clearing site data removes local copies and unsynced edits. Download a workspace backup before clearing storage.

Chromium and WebKit tests cover offline editing, recurring event scopes, keyboard/touch gestures, 500-task virtualization, and accessibility. Isolated live Supabase tests verify ownership, private files, two-client conflicts, and offline recovery. Two actual Google Calendar accounts have connected successfully. Physical-device timing remains a separate acceptance step. No AI features or external model calls are included.
