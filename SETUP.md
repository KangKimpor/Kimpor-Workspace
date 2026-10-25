# Local setup and service inventory

Use Node 24 and the pinned pnpm version through Corepack. On this Windows machine, invoke `corepack pnpm`.

1. Run `corepack pnpm install --frozen-lockfile`.
2. For the local guest demo, run `corepack pnpm dev` without service credentials.
3. For account features, copy `.env.example` to `.env.local` and set the project's public Supabase URL and publishable key. Restart Vite after changes.
4. For a production preview, run `corepack pnpm build`, then `corepack pnpm preview`.
5. Install browsers with `corepack pnpm exec playwright install chromium webkit`. Run lint, typecheck, test, and test:e2e scripts. Build before testing if reusing a preview server; leave that build unchanged during the suite.
6. The supplied SingBuild artwork lives at `public/brand/logo.png`; `corepack pnpm icons` regenerates the wordmark wrapper and square icons from its symbol.

Account browser tests require the public configuration because they intercept Supabase auth requests. CI supplies placeholder public values. Passing these tests does not establish real authentication.

## Existing cloud implementation

These files are already present; their existence does not establish that the current remote environment matches them:

- `supabase/migrations/`: workspace tables/RLS/storage, write RPC, Google rate limits, and profile sync.
- `supabase/tests/isolation.sql`: database isolation checks; run against a dedicated test database before accepting schema changes.
- `supabase/functions/kw-google/`: Google OAuth callback, token encryption, account connection/disconnection, and token exchange.
- `api/google/[action].js`: Vercel proxy for the calendar service.
- `src/data/persistence.ts` and `sync.ts`: demo/cache persistence, legacy recovery and the signed-in cloud writer.

The current Edge Function reads `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KW_TOKEN_ENCRYPTION_KEY` (with a legacy `CREDENTIAL_ENCRYPTION_KEY` fallback), and `KW_APP_URL`. It also uses Supabase's server environment URL and service-role key. Keep all private values in server secret storage, never Vite variables. Preserve the existing encryption key; replacing it can make stored refresh tokens unreadable.

Workspace Google sign-in returns through Supabase Auth to `/settings/account`. Connecting calendar accounts is separate: its Google redirect URI is `<SUPABASE_URL>/functions/v1/kw-google/callback`, then the function returns to `/settings/accounts` at `KW_APP_URL`.

Before moving this build to another project/domain, review the hard-coded proxy targets in `vite.config.ts`, the Supabase origin in `vercel.json`'s Content Security Policy, Auth return URLs, Google callback URLs, and server app URL together. Changing only `.env.local` does not retarget every service.

The production app is https://kimpor-workspace.vercel.app and the Supabase project is nlcpjdokfvawlpzyfytx. The original migrations were reported applied in the historical acceptance notes, the private kw-files bucket is configured, and kw-google version 3 is deployed. Google OAuth remains in Testing with the two approved test accounts. Testing-mode refresh tokens may expire after seven days; broader Google verification/publishing requires a separate project-owner decision. See `docs/BUILD-STATUS.md`.

## Cloud-first workspace update · October 25, 2026

The `20261025025334_cloud_first_workspaces.sql` migration was applied to `nlcpjdokfvawlpzyfytx` on October 25, 2026. The local filename matches the recorded remote migration version. All five workspace tables are now in `supabase_realtime`, with existing owner RLS retained. Local public client configuration is in ignored `.env.local`.

The migration backfills project JSON with `workspace: personal`, validates Team/Personal values, adds pages/projects/tasks/events/profiles to the Realtime publication, installs an owner-scoped private delete signal and policies, and updates the existing invoker-rights compare-and-swap RPC to reject stale writes to deleted records. Existing authenticated owner policies and grants remain in force; no sharing permissions are added. A future shared Team workspace needs membership, invitation and permission rules before any cross-account access can be enabled.

The transactional `supabase/tests/isolation.sql` checks passed against the connected database and rolled back their temporary records. All six opt-in live checks passed in Chromium/WebKit using two disposable QA accounts, including two-session delivery without focus/refresh and offline conflict recovery. Test accounts and their data are removed after verification; no personal calendar changes were tested.

The Vercel `kimpor-workspace` production client URL and public key were verified against this backend. Existing values already match; no hosted configuration changes were necessary.

For the deterministic browser suite, use the same public test values as CI: `VITE_SUPABASE_URL=http://localhost:4173` and `VITE_SUPABASE_PUBLISHABLE_KEY=test-public-key`. These allow intercepted authentication requests; they are not live credentials. Do not use these values for live cloud tests or deployments.

## Live isolation tests

`e2e/cloud.spec.ts` runs only when `KW_QA_FIXTURE` points to an external local JSON file with the public project configuration and two disposable QA accounts. Keep that fixture outside Git. Run with one worker when sharing accounts. Tests disable screenshots and traces, and check ownership, private files, conflicts, and offline recovery. Normal CI skips these six live checks and runs the deterministic suite.

## Calendar behavior

Google access tokens exist only in memory. Encrypted refresh tokens remain server-side. Sync uses polling, per-account backoff, ETags, and a durable series-change journal. This/Following/All changes preserve finite recurrence counts. Custom repeat rules support daily, weekly, monthly and yearly frequencies. Reminders appear while the app is open; background Web Push is outside v1. Week start and clock format are saved with the workspace profile. Theme, glass and motion are device preferences.

App updates are user-controlled: a waiting service worker shows New version available with Reload and Later actions. When upgrading from the older automatic-update build, close all workspace tabs/installed windows once so the new worker can activate. Do not clear site data to update.
