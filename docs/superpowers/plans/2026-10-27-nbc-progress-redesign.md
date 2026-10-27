# NBC BP03 Project Progress Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the NBC BP03 project UI with three Notion-style tabs (Overview · Activities · Update Progress) whose tables follow the workbook's WBS levels, keeping the data and server layers unchanged.

**Architecture:** A pure `buildWbsRows` function turns the activity tree into indented, collapsible rows (levels `1.6.1` to `1.6.1.3.4.2.4`). One shared `WbsTable` renders those rows for Activities and Update Progress. Overview, Activities and Update become separate small components under `src/nbc/`, replacing the dense `NbcProject.tsx`, `WeeklyProgress.tsx`, `PastUpdates.tsx` and `WeeklyHandlers.tsx`. Three override stylesheets are replaced by one stylesheet per screen on existing tokens.

**Tech Stack:** React 19, TypeScript, react-router-dom 7, Zustand store (`useWorkspace`), `@tanstack/react-virtual`, Radix popover/dialog, vitest, Playwright, pnpm via `corepack pnpm`.

**Spec:** `docs/superpowers/specs/2026-10-27-nbc-progress-redesign-design.md`

## Global Constraints

- Frontend only. No change to `supabase/`, `api/`, `submissions.ts`, `submission-actions.ts`, `drafts.ts`, `actions.ts`, `progress.ts` semantics, or the editable-week window (this week and last week only).
- Tabs, in this order: `Overview`, `Activities`, `Update Progress`. Routes `/projects-progress/:id/overview|activities|update`. `past` redirects to `overview`; `progress`, `boq` still redirect to `activities`; `weekly` to `update`; `handlers` to `overview`. `issues` and `board` remain reachable from Activities. Existing query params (`handler`, `area`, `location`, `trade`, `wbs`) keep working.
- WBS table columns, exactly: `WBS · Description · Previous week % · This week % · Remark`. Only two percentage columns. No Accumulation and no Change column. Activities adds a `Handler` column.
- `This week %` is the editable cumulative progress; `Previous week %` is read-only. Parent rows are never editable and show the calculated weighted average in `This week %`.
- Real WBS numbers are displayed and never renumbered. Indentation is one step per level.
- Status pill labels: `Updated`, `Updated late`, `Not yet`, `Overdue`, `Needs review`. Labels always accompany colour.
- Deadline is end of Sunday, Asia/Phnom_Penh; this logic is already in `submissions.ts`, do not copy it.
- Flat Notion-like look: no cards, shadows or glass; hairline dividers; 14px text; tabular numerals; existing theme tokens; light and dark; reduced motion honoured.
- Do not deploy. Do not touch production, migrations or workbook data.
- Release checks: `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build`, `git diff --check`.

## Review Focus

1. A handler with no assigned activities (or all hidden by "Hide completed"): shows an empty state, never a blank table or crash.
2. Invalid text in a This week % cell inside a collapsed group: the group must stay expanded/reachable and the error visible; the draft is never discarded.
3. "Hide completed" must not make a row vanish while it is being edited (a row set to 100% stays visible until the draft is confirmed or reloaded).
4. Last week toggle: disabled with an explanation when the handler has no last-week update; never creates one.
5. Shared GR&P (no parent, no handler) appears once, after the handler groups, with a Shared pill, in every handler's Update view and once in Activities.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/nbc/wbs-table.ts` (new) | Pure: `wbsLevel`, `buildWbsRows`. |
| `src/nbc/wbs-table.test.ts` (new) | Unit tests for the above. |
| `src/nbc/ui/StatusPill.tsx` (new) | Status pill (replaces `StatusChip`). |
| `src/nbc/ui/MoreMenu.tsx` (new) | `···` menu on `GlassPopover`. |
| `src/nbc/ui/SidePeek.tsx` (new) | Right-hand read-only panel (Radix Dialog). |
| `src/nbc/ui/WbsTable.tsx` (new) | Shared table renderer, optional virtualization. |
| `src/nbc/update/UpdateProgress.tsx` (new) | Update screen. |
| `src/nbc/update/useUpdateDraft.ts` (new) | Draft/autosave/confirm logic extracted from `WeeklyProgress.tsx`. |
| `src/nbc/overview/Overview.tsx`, `HandlerTable.tsx`, `SubmissionPeek.tsx` (new) | Overview and handler history. |
| `src/nbc/activities/Activities.tsx` (new) | Filters, view switcher, table, reassignment menu. |
| `src/nbc/NbcProject.tsx` (rewrite) | Header, tabs, routing aliases, data wiring only. |
| `src/nbc/nbc.css` (rewrite), `update.css`, `overview.css`, `activities.css` (new) | Styles; delete `precision.css`, `weekly.css`. |
| Delete after migration | `WeeklyProgress.tsx`, `PastUpdates.tsx`, `WeeklyHandlers.tsx`, `BoqTable.tsx` (keep `ActivityDetail` by moving it to `activities/ActivityDetail.tsx`). |

---

### Task 1: WBS row builder

**Files:**
- Create: `src/nbc/wbs-table.ts`
- Test: `src/nbc/wbs-table.test.ts` (use `src/nbc/test-fixture.ts` for a base activity; build a small tree inline)

**Interfaces:**
- Produces:
```ts
export interface WbsRow { activity: NbcActivity; depth: number; level: number; group: boolean; leafCount: number; progress: number }
export interface WbsOptions { leaf?: (a: NbcActivity) => boolean; collapsed?: ReadonlySet<string>; values?: ReadonlyMap<string, number> }
export const wbsLevel: (wbs: string) => number
export function buildWbsRows(activities: NbcActivity[], options?: WbsOptions): WbsRow[]
```

- [ ] **Step 1: Write failing tests** in `wbs-table.test.ts`: (a) `wbsLevel('1.6.1') === 1`, `wbsLevel('1.6.1.1.1') === 3`, `wbsLevel('1.6.1.3.4.2.4') === 5`, `wbsLevel('GR&P') === 1`; (b) a tree `1.6.1 > 1.6.1.1 > 1.6.1.1.1(leaf, handler A)`, `1.6.1.3 > 1.6.1.3.1(leaf, handler B)` with `leaf: a => a.handler === 'A'` returns exactly 3 rows (`1.6.1`, `1.6.1.1`, `1.6.1.1.1`) with depths `0,1,2` and `group` `true,true,false`; (c) skipped numbers keep their real `wbs`; (d) `collapsed: new Set([parentId])` hides descendants but keeps the parent with `leafCount` unchanged; (e) a group's `progress` equals the relative-weight average of its children and reflects `values` overrides; (f) a root with `wbs === 'GR&P'` and no parent is included only when `leaf` accepts it and sorts last.
- [ ] **Step 2:** Run `corepack pnpm test src/nbc/wbs-table.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** in `wbs-table.ts`. Compute `calculate(activities, values)` from `./progress` once on the full list for `progress`; include a node when `leaf(node)` holds for it or any descendant (walk ancestors via `byId`, same technique as `visibleHierarchy`); order siblings by `order`; GR&P last; `depth = level - 1`; `leafCount` counts included leaves beneath a group; do not emit children of collapsed ids.
- [ ] **Step 4:** Re-run the test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/nbc/wbs-table.ts src/nbc/wbs-table.test.ts && git commit -m "feat(nbc): WBS row builder"`

---

### Task 2: Shared UI primitives and WbsTable

**Files:**
- Create: `src/nbc/ui/StatusPill.tsx`, `src/nbc/ui/MoreMenu.tsx`, `src/nbc/ui/SidePeek.tsx`, `src/nbc/ui/WbsTable.tsx`, `src/nbc/nbc.css` (rewrite, tokens and primitives only)
- Test: `src/nbc/ui/WbsTable.test.tsx` (vitest + testing library already used in `drafts.test.tsx`)

**Interfaces:**
- Consumes: `WbsRow` from Task 1; `GlassPopover` (`@/components/glass/GlassPopover`); `confirmationTime` logic moved into `src/nbc/format.ts` as `confirmationTime(date: string): string` (same implementation as in `WeeklyProgress.tsx`).
- Produces:
```tsx
export function StatusPill(props: { status: 'Updated' | 'Updated late' | 'Not yet' | 'Overdue' | 'Needs review'; time?: string | null }): JSX.Element
export function MoreMenu(props: { label: string; children: ReactNode }): JSX.Element   // renders an ibtn with aria-label={label}
export function SidePeek(props: { open: boolean; onOpenChange: (o: boolean) => void; title: string; children: ReactNode }): JSX.Element
export interface WbsTableProps {
  rows: WbsRow[]; caption: string; collapsed: ReadonlySet<string>; onToggle: (id: string) => void
  previous: (a: NbcActivity) => number
  current: (row: WbsRow) => ReactNode      // This week % cell
  remark?: (row: WbsRow) => ReactNode      // omit to hide the Remark column
  extra?: { header: string; cell: (row: WbsRow) => ReactNode }[]   // e.g. Handler
  rowAttrs?: (row: WbsRow) => Record<string, string | boolean | undefined>
  virtual?: boolean                         // true for Activities
  onRowClick?: (row: WbsRow) => void
}
export function WbsTable(props: WbsTableProps): JSX.Element
```

- [ ] **Step 1: Write failing test** `WbsTable.test.tsx`: rendering three rows (`1.6.1` group, `1.6.1.1` group, `1.6.1.1.1` leaf) shows column headers exactly `WBS`, `Description`, `Previous week %`, `This week %`, `Remark`; the WBS text is `1.6.1.1.1`; group rows have `aria-expanded`; clicking a group's toggle calls `onToggle` with its id; the leaf Description cell has `style.paddingInlineStart` greater than the group's; no header named `Change` or `Accumulation %`.
- [ ] **Step 2:** Run `corepack pnpm test src/nbc/ui/WbsTable.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the four components. `WbsTable` is a semantic `<table>` with sticky `<thead>` and `data-level` on rows (CSS tints level 1 stronger, deeper groups lighter, leaves plain). When `virtual` is true use `useVirtualizer` with top/bottom spacer rows so the table stays semantic. Group rows show a chevron toggle, leaf count and `percent(row.progress)`; leaf rows call `props.current(row)`. `previous` renders `percent(previous(a))` for leaves and groups alike. Write `nbc.css` as shared primitives (page, header, tabs, pills, table, menus) on existing tokens, flat style, `font-variant-numeric: tabular-nums`, no shadows.
- [ ] **Step 4:** Re-run the test. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/nbc/ui src/nbc/nbc.css src/nbc/format.ts && git commit -m "feat(nbc): shared WBS table and Notion-style primitives"`

---

### Task 3: Update Progress screen

**Files:**
- Create: `src/nbc/update/useUpdateDraft.ts`, `src/nbc/update/UpdateProgress.tsx`, `src/nbc/update/update.css`
- Test: `src/nbc/update/useUpdateDraft.test.tsx`

**Interfaces:**
- Consumes: `buildWbsRows`, `WbsTable`, `MoreMenu`, existing `draftEntries`, `saveDraft`, `confirmUpdate`, `reopenUpdate`, `deleteUpdate` (from `../actions`), `readHandlerDraft`/`writeHandlerDraft`/`clearHandlerDraft`/`rememberedHandler`/`rememberHandler`, `parseProgress`, `changedEntries`, `weekStart`, `addDays`, `weekLabel`, `submissionId`.
- Produces:
```ts
export function useUpdateDraft(args: { projectId: string; week: string; handler: Handler; activities: NbcActivity[]; submission?: NbcSubmission }): {
  rows: SubmissionEntry[]; shown: SubmissionEntry[]; changed: SubmissionEntry[]; contribution: number
  text: (id: string) => string; invalid: ReadonlySet<string>
  setText: (id: string, text: string) => void; setRemark: (id: string, remark: string) => void
  note: string; setNote: (n: string) => void
  status: 'saved' | 'saving' | 'local' | 'error'; error: string; busy: boolean
  confirm: () => Promise<void>; edit: () => Promise<void>; remove: () => Promise<void>; reloadShared: () => void
  confirmed: boolean
}
export default function UpdateProgress(props: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[] }): JSX.Element
```

- [ ] **Step 1: Write failing tests** for `useUpdateDraft` (render with a tiny fixture, mirroring `drafts.test.tsx` setup): typing `65` into an activity marks it changed and updates `contribution`; typing `abc` adds the id to `invalid`, keeps the text, and does not throw or clear other values; after 400 ms a valid value calls `saveDraft` once; `confirm()` is blocked (sets `error`) while any id is invalid; typing `100` in a row keeps it in `rows` (Review Focus 3).
- [ ] **Step 2:** Run `corepack pnpm test src/nbc/update`. Expected: FAIL.
- [ ] **Step 3: Implement `useUpdateDraft`** by moving the draft, autosave (400 ms), journaling, parse, confirm/edit/remove and GR&P reload logic out of `WeeklyProgress.tsx` unchanged in behaviour. `status` maps: journaled-only → `local`, `saveDraft` pending → `saving`, success → `saved`, failure → `error`.
- [ ] **Step 4: Implement `UpdateProgress`** per the spec: header with title, `weekLabel`, "Due Sunday end of day"; inline handler chip (a `GlassSelect`-based select styled as a chip, remembered via `rememberHandler`, `?handler=` honoured); `This week | Last week` switch where Last week is `disabled` with `title="No update to edit"` unless a last-week submission exists for the handler (Review Focus 4). Rows from `buildWbsRows(activities, { leaf: a => canUpdate(a, handler), collapsed, values })`; `values` is the draft map. Force-expand any group that contains an id in `invalid` (Review Focus 2). "Hide completed" (default on) hides leaves whose `previous === 1` and which are unchanged and not focused (Review Focus 3); an empty result renders an empty state with a "Show completed" action (Review Focus 1). `current` cell: plain-looking `<input inputMode="decimal" aria-label="{wbs} This week %">`, Enter moves to the same cell in the next visible row, Tab moves to Remark, focused row shows quick-set buttons 25/50/75/100. Changed rows get `data-changed="true"`. Sticky footer: `{n} changed · {delta}% · {status}`, `Add note` link toggling a labelled textarea (label becomes `Edit note` once populated), primary button `Confirm update` or `Confirm, no changes`. Confirmed state: table read-only, one line `Confirmed {confirmationTime} · {n} changed`, `Late` pill when late, `Edit` button and `MoreMenu` containing a Delete action with the existing Delete/Cancel popover copy ("Your activities go back to last week's values. Newer confirmed updates stay applied."). Keep the Undo toast via `useWorkspaceUI.getState().notify`. The GR&P conflict shows an inline notice with `Reload shared GR&P` calling `reloadShared`.
- [ ] **Step 5:** Re-run the tests. Expected: PASS. Then `corepack pnpm typecheck`. Expected: no errors.
- [ ] **Step 6: Commit** `git add src/nbc/update && git commit -m "feat(nbc): Update Progress screen on WBS table"`

---

### Task 4: Overview with handler history

**Files:**
- Create: `src/nbc/overview/Overview.tsx`, `src/nbc/overview/HandlerTable.tsx`, `src/nbc/overview/SubmissionPeek.tsx`, `src/nbc/overview/overview.css`
- Keep: `Trend.tsx` (restyle only), reuse `Breakdown` logic moved from `NbcProject.tsx` into `overview/Breakdown.tsx`.
- Test: `src/nbc/overview/HandlerTable.test.tsx`

**Interfaces:**
- Consumes: `StatusPill`, `MoreMenu`, `SidePeek`, `submissionStatus`, `changedEntries`, `weekLabel`, `exportSubmission`, `reopenUpdate`, `deleteUpdate` is NOT used here.
- Produces:
```tsx
export default function Overview(props: { project: ProjectSummary; activities: NbcActivity[]; submissions: NbcSubmission[]; summaries: NbcWeekSummary[]; baseline: Map<string, number> }): JSX.Element
export function HandlerTable(props: { projectId: string; activities: NbcActivity[]; submissions: NbcSubmission[]; now: number }): JSX.Element
```

- [ ] **Step 1: Write failing tests** for `HandlerTable`: six rows named Sitha, Lychhinh, Chhorvaon, Srun, Kheng, Tola with headers `Handler`, `This week`, `Last week`, `Changed`, `Contribution`; a handler with a confirmed current-week submission shows pill `Updated` and its changed count; expanding a row shows This week, Last week and a collapsed `Older weeks` entry; a missing last-week update shows the text `Missing` and no create control; the `···` menu of an older week offers only `Open` and `Export CSV` (no Edit/Delete).
- [ ] **Step 2:** Run `corepack pnpm test src/nbc/overview`. Expected: FAIL.
- [ ] **Step 3: Implement.** `Overview`: summary line `{overall}% overall · {n} of 6 handlers updated · {weekLabel}` (replaces the KPI tiles), slim `Trend`, `HandlerTable`, and a collapsed `Breakdown` toggle containing by-area/floor/trade breakdowns. `HandlerTable` rows expand inline (button with `aria-expanded`); per-week `···` menu: `Open` (opens `SubmissionPeek`, read-only entries table via `WbsTable`-free simple list with WBS, activity, previous, this week, remark, plus the note), `Edit` for this/last week (calls `reopenUpdate` when confirmed, then navigates to `/projects-progress/:id/update?handler=…&week=…`), `Export CSV` via `exportSubmission`. Clicking a status pill navigates the same way as before (current week → update, last week → peek).
- [ ] **Step 4:** Re-run tests. Expected: PASS.
- [ ] **Step 5: Commit** `git add src/nbc/overview src/nbc/Trend.tsx && git commit -m "feat(nbc): Overview with handler history"`

---

### Task 5: Activities screen

**Files:**
- Create: `src/nbc/activities/Activities.tsx`, `src/nbc/activities/ActivityDetail.tsx` (moved from `BoqTable.tsx`), `src/nbc/activities/activities.css`
- Test: `src/nbc/activities/Activities.test.tsx`

**Interfaces:**
- Consumes: `buildWbsRows`, `WbsTable` (`virtual`), `SidePeek`, `MoreMenu`, `assignActivities`, `updateActivity`, `Issues` and `HandlerArea` logic (move `Issues` to `activities/Issues.tsx` unchanged; replace `HandlerArea`'s UI with a `Reassign…` item in a `MoreMenu`).
- Produces: `export default function Activities(props: { projectId: string; activities: NbcActivity[]; baseline: Map<string, number>; view: 'activities' | 'issues' | 'board' }): JSX.Element`

- [ ] **Step 1: Write failing tests:** with a tree containing a handler filter `?handler=A`, only A's leaves and their ancestors render; the header row has `WBS`, `Description`, `Previous week %`, `This week %`, `Remark`, `Handler`; no progress input is rendered anywhere (read-only); search text filters by WBS or name; the `Table · Board · Issues` switcher links to `activities`, `board`, `issues` routes.
- [ ] **Step 2:** Run `corepack pnpm test src/nbc/activities`. Expected: FAIL.
- [ ] **Step 3: Implement.** Filter chips (Handler, Area, Range, Changed, Search) as small popover chips writing the existing query params; optional columns remain (Area, Trade, BOQ value, Schedule %, Status) behind a `Columns` chip; row click opens `ActivityDetail` in `SidePeek` (audit history, issue link, handler reassignment keeps its audited `updateActivity` call and Needs-review behaviour); `···` menu: `Reassign group…` opens the existing `BottomSheet` form from `HandlerArea`. Keep keyboard navigation and search shortcut from `BoqTable` where they exist.
- [ ] **Step 4:** Re-run tests. Expected: PASS. Run `corepack pnpm test e2e` is not needed here; large-list performance is checked in Task 7.
- [ ] **Step 5: Commit** `git add src/nbc/activities && git commit -m "feat(nbc): Activities screen on WBS table"`

---

### Task 6: Shell, routing and cleanup

**Files:**
- Modify (rewrite): `src/nbc/NbcProject.tsx`
- Delete: `src/nbc/WeeklyProgress.tsx`, `src/nbc/PastUpdates.tsx`, `src/nbc/WeeklyHandlers.tsx`, `src/nbc/BoqTable.tsx`, `src/nbc/precision.css`, `src/nbc/weekly.css`
- Modify: `src/shell/landing.ts:12` (NBC landing target `.../overview` instead of `.../progress`)
- Test: `e2e/nbc.spec.ts` (Task 7); unit coverage via the existing tests

**Interfaces:**
- Consumes: `Overview`, `Activities`, `UpdateProgress`.
- Produces: `export default function NbcProject(props: { project: ProjectSummary; view: string }): JSX.Element`

- [ ] **Step 1: Rewrite `NbcProject.tsx`** to: keep the realtime channel effect, `calculation`/`baseline` derivations and the `calculate` failure banner; define `views = [['overview','Overview'],['activities','Activities'],['update','Update Progress']]`; aliases `{ boq:'activities', progress:'activities', weekly:'update', handlers:'overview', past:'overview' }` preserving `location.search`; render the flat header (breadcrumb comes from the shell; title, one summary line), the underlined text tabs, and the selected screen; `issues`/`board` render `Activities` with that `view`.
- [ ] **Step 2:** Delete the replaced files and fix imports. Run `corepack pnpm typecheck && corepack pnpm lint`. Expected: no errors.
- [ ] **Step 3:** Run `corepack pnpm test`. Expected: all unit tests pass (97 existing plus the new ones).
- [ ] **Step 4: Commit** `git add -A src/nbc src/shell && git commit -m "feat(nbc): three-tab shell and removal of old screens"`

---

### Task 7: Browser tests, accessibility and verification

**Files:**
- Modify: `e2e/nbc.spec.ts`, `e2e/project-layout.spec.ts`, `e2e/a11y.spec.ts`, any other e2e spec that references `Past Updates`, `Update Progress` order or the old column names (find with `grep -rn "Past Updates\|Previous %\|This week %\|Change" e2e`).

**Interfaces:** Consumes the three screens; no new production code.

- [ ] **Step 1: Update `nbc.spec.ts`** so each existing scenario targets the new UI: tabs are `Overview`, `Activities`, `Update Progress` in that order and there is no `Past Updates` tab; edits use the `{wbs} This week %` inputs; the old "Past Updates edits last week" scenario becomes: Overview → expand a handler → `···` → Edit last week → saved on Update with the `Last week` switch active, this week's previous values re-chained; older weeks show only Open and Export CSV; the table has no `Change` or `Accumulation %` header.
- [ ] **Step 2: Add tests:** (a) WBS indentation: on Activities, the `1.6.1.1.1` row's description is indented further than `1.6.1.1`; (b) invalid text in a collapsed group re-expands it and blocks confirmation (Review Focus 2); (c) `Last week` switch is disabled for a handler with no last-week update (Review Focus 4); (d) `GR&P` appears once with `Shared` on Update and once in Activities (Review Focus 5); (e) an unassigned-everything fixture handler shows the empty state (Review Focus 1).
- [ ] **Step 3:** Run `corepack pnpm build && corepack pnpm test:e2e e2e/nbc.spec.ts e2e/project-layout.spec.ts`. Expected: all pass in Chromium and WebKit.
- [ ] **Step 4:** Run `corepack pnpm test:a11y`. Expected: no violations in light and dark for all three tabs, including the tinted group rows and status pills (adjust tint tokens if contrast fails).
- [ ] **Step 5:** Run the full release checks: `corepack pnpm lint && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build && corepack pnpm test:e2e && git diff --check`. Expected: zero failures (credential-dependent live-cloud checks may remain skipped, as today).
- [ ] **Step 6:** Visually verify in the browser pane at 1440×900 and 1280×720, light and dark: Overview, Activities (deep WBS expanded to `1.6.1.3.4.2.4`), Update Progress for Sitha (193 leaves with ancestor groups) and Chhorvaon (6 leaves). Compare with the Stitch references only for general rhythm, not for sample data.
- [ ] **Step 7: Update docs** `docs/NBC-BP03-UX-PLAN.md` and `docs/NBC-BP03-PROGRESS-TRACKER.md` to describe the three-tab layout, columns and removal of Past Updates as a tab (state that no deployment was performed). Commit: `git add -A e2e docs && git commit -m "test(nbc): update browser tests and docs for the redesign"`

---

## Self-review

- **Spec coverage:** structure and routing (Task 6); visual language (Task 2, all CSS); WBS table incl. levels, columns, group rows, handler scoping, GR&P (Tasks 1, 2, 3, 5); Overview (Task 4); Activities (Task 5); Update Progress incl. quick-set, hide completed, footer, confirmed state, last-week switch, GR&P conflict (Task 3); code structure and CSS replacement (Tasks 2, 6); testing and release boundary (Task 7). No gaps found.
- **Type consistency:** `WbsRow.progress` (not `average`) is used in Tasks 1, 2; `buildWbsRows`/`WbsTable` signatures match across Tasks 3 and 5; `StatusPill` replaces `StatusChip` everywhere; `confirmationTime` lives in `format.ts` after Task 2.
- **Risk note:** Task 5 moves the largest amount of existing behaviour (virtualization, keyboard navigation, filters). If its tests or the large-list e2e regress, keep `BoqTable.tsx` virtualization code and only swap its row renderer for `WbsTable`.
