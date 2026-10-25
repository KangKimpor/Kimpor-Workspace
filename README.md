# SingBuild Workspace

A private project workspace with inline task editing, Team and Personal project groups, glass controls, and light and dark themes. The app opens the last selected workspace or project. Home has been removed and Calendar is hidden from navigation; stored pages, tasks and calendar integration are preserved.

Sign in for persistent cloud data. Signed-in changes are optimistic, written promptly to Supabase, and reconciled through authenticated Realtime subscriptions. Local storage supports recovery and caching. Guest mode is an editable local demo. Team is a project group, not cross-account sharing.

See [setup](SETUP.md) for backend requirements and [build status](docs/BUILD-STATUS.md) for verified results and limitations.

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

## Features

- Create and edit projects in Team or Personal Workspace; existing projects default to Personal.
- Dense task tables and draggable status boards. Inline title, status, priority, due date and description controls; expandable fields retain subtasks, labels, repeat schedules, reminders, hierarchy, activity and rich notes.
- Sorting, column visibility, keyboard resizing, mobile horizontal scrolling and virtualized large lists.
- Search preserves access to existing pages, tasks, projects and events. Existing page editing, trash/restore, backups and Google Calendar integration remain available.
- Cloud confirmation states, event-triggered reconciliation, scoped recovery, concurrent-edit recovery and account isolation.
- Shared glass selectors, both themes, reduced-motion and opaque fallbacks. Supplied SingBuild branding and generated icons.

## Verify

```sh
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm exec playwright install chromium webkit
corepack pnpm test:e2e --workers=1
```

With the production preview running, `node scripts/screenshots.mjs` captures the review matrix in `docs/screenshots/stitch-refresh/`. The supplied artwork is `public/brand/logo.png`. Run `corepack pnpm icons` to regenerate the wordmark wrapper, symbol favicon and proportion-preserving PWA icons.

## Data

The cloud is authoritative for signed-in data. An in-memory write queue sends requests without waiting for IndexedDB. Local recovery journals are per account and tab; native Web Locks allow abandoned journals to be recovered without consuming an active tab's writes. The previous build's IndexedDB outbox is imported for recovery only. Google series-change safeguards still use their durable journal.

The existing `kw-workspace-v1` localStorage key, `kimpor-workspace` IndexedDB name, Supabase table/bucket names and auth identifiers are retained. Export a backup before clearing browser data if writes remain pending. Signed-out demo data is imported only when explicitly requested in Account settings.

The cloud-first workspace migration was applied to the connected Supabase project on October 25, 2026. Local public client configuration is saved in ignored `.env.local`. Transactional isolation checks and all six live Chromium/WebKit checks passed using disposable accounts; see `SETUP.md` for repeatable verification instructions.
