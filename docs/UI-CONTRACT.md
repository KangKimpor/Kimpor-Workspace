# Workspace UI and data contract

Screens import data and mutations from `src/data`. `src/data/types.ts` is the source of truth.

- `ProjectSummary.workspace` is `team` or `personal`; missing legacy values normalize to Personal. These are private project groups, with the existing owner-only RLS model. Cross-account sharing requires a separate membership and permission model.
- `/` opens the current account's last selected project table or project group. Home is removed. Calendar, My tasks, Pages and Favorites are absent from navigation; existing data and direct routes remain available where applicable.
- Task title, status, priority, due date and description edit inline. Native expandable field controls retain other task properties and a link to the existing rich notes editor. There is no task detail modal or detail-opening state.
- Table columns default to Task name, Status, Priority, Due date, Description. Visibility, sorting, resizing and bounded rendering of large lists remain supported. Mobile tables scroll horizontally inside the canvas.
- Signed-in mutations update Zustand immediately, then enter an in-memory server writer. Local caching/recovery never gates an online write. `saving`, `offline` and `error` mean unconfirmed work; `saved` requires successful cloud reconciliation and an active subscription.
- Authenticated Supabase Postgres Changes subscriptions and private owner-scoped delete notifications trigger reconciliation; subscribe/reconnect and explicit retry fetch authoritative snapshots. No routine workspace polling runs. Google Calendar retains its separate polling/backoff and durable series-change journal.
- Independent concurrent fields rebase using the existing compare-and-swap RPC. Overlapping drafts are preserved in searchable Recovered edit pages. Stale writes cannot recreate hard-deleted records after the migration is applied. Pending records overlay fetched data until a server decision is received.
- Account changes clear displayed data synchronously, invalidate old async work, remove the previous subscription and clear Google session caches. Recovery journals and opening preferences are scoped to account IDs; existing storage IDs are preserved.
- Guest editing is a clearly labeled local demo. Sign-in is required for a persistent cloud workspace; import the demo explicitly through Account settings.

Apply the cloud-first migration before accepting live synchronization. Local regression tests do not establish remote publication configuration or two-session delivery.
