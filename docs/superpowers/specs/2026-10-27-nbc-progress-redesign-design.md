# NBC BP03 Project Progress redesign

Status: draft for review. Nothing is built, committed or deployed.

## Intent

Office staff on desktops and laptops use the NBC BP03 project area to see overall progress and to enter weekly handler updates. They already know the source workbook (`NBC_BP03_ Progress tracking by BOQ.xlsx`), so the app should feel as simple as that sheet and as calm as a Notion database.

Success means:

- Three tabs, **Overview · Activities · Update Progress**, with fewer concepts on screen.
- The activity table shows the workbook's WBS levels (`1.6.1`, `1.6.1.1`, `1.6.1.1.1` and deeper) exactly as the handler sheets do.
- Updating progress is quick, keyboard-friendly and honest about saved and confirmed state.
- A clean, flat, professional look in the Notion style, in light and dark themes.

Out of scope: any change to the database, migrations, autosave, confirmation, undo, re-chaining, shared GR&P rules or the editable-week window. Nothing is deployed by this work.

## Decisions already made

- Approach A: rebuild the UI in small, clean components and keep the data layer.
- Audience: desktop and laptop. Phones must not break, but they are not the design target.
- Tab order: Overview, Activities, Update Progress. Past Updates is no longer a tab.
- Visual language: Notion-like.

## Structure and routing

| Tab | Route | Replaces |
|---|---|---|
| Overview | `/projects-progress/:id/overview` | Overview, Past Updates |
| Activities | `/projects-progress/:id/activities` | Activities, with Issues and Board as a view switcher |
| Update Progress | `/projects-progress/:id/update` | Update Progress |

The previous `past` route redirects to Overview. Existing query parameters (`handler`, `area`, `location`, `trade`, `wbs`) keep working on Activities. Standard project pages are unchanged.

## Visual language

- Flat page. No cards, shadows or glass effects. Hairline dividers and soft hover backgrounds only.
- 14px body text, tabular numerals for every number, one accent colour, existing theme tokens.
- Header: breadcrumb, large title, one quiet summary line (for example `42.0% overall · 4 of 6 updated · 26 Oct – 1 Nov`).
- Tabs are plain text with an underline on the active tab.
- Status is a soft tinted pill with a text label: Updated (green), Late (amber), Not yet (grey), Overdue (red). Needs review and conflict appear only as an inline notice when they apply.
- Actions live behind `···` menus. Contrast, focus rings, semantic headers and reduced motion are retained.

## WBS table (shared by Activities and Update Progress)

This is the workbook's layout, rendered once and reused.

- **Levels.** The tree runs from level 1 (`1.6.1`) to level 5 (`1.6.1.3.4.2.4`, seven number segments). There are 790 nodes: 10, 114, 352, 243 and 70 rows at three to seven segments, plus GR&P. The table supports every level and never assumes a depth.
- **Columns.** `WBS` (the real number, never renumbered, since numbers skip, as in `1.6.1.1` then `1.6.1.3`) · `Description` (indented one step per level) · `Previous week %` · `This week %` · `Remark`. There are only two percentage columns: no Accumulation column and no separate Change column.
- **Group rows.** Parent rows are bold on a soft tint, stronger for level 1 (the sheet's orange band) and lighter for deeper groups (the grey band). They are collapsible, show a leaf count and show the calculated weighted average in `This week %`. Parent progress is never editable.
- **Leaf rows.** Plain weight, white background, one editable cell.
- **Handler scoping.** On Update Progress, the selected handler's leaves appear with all their ancestor group rows, as on that handler's sheet (for example Sitha: 193 leaves under `1.6.1` and the other levels), followed by the shared GR&P row. On Activities, all nodes appear with the same columns plus Handler.
- **Terms.** `Previous week %` is the value confirmed last week (read-only). `This week %` is the editable cumulative progress to date, as in the earlier design. The difference between the two is not a column; it appears only as the changed-row tint, the footer total (`3 changed · +0.4%`) and the Overview changed counts.
- **Performance.** Keep virtualization for Activities. Update Progress needs at most about 250 rows per handler, so it can use plain rows with sticky headers.

## Overview

- Summary line replaces the KPI tiles. A slim trend panel (stored weekly summaries, with a text/table alternative) sits below it.
- **Handler table**: Handler · This week · Last week · Changed · Contribution. Clicking a row expands it inline to show that handler's weekly history. A row's `···` menu offers Open (read-only side peek with entries and note), Edit and Export CSV.
- Older weeks are collapsed per handler. Open and Export only, never editable.
- Missing last-week updates appear as "Missing", with no create action.
- The area, floor and trade breakdowns sit in a collapsed "Breakdown" toggle.

## Activities

- Existing capabilities stay: hierarchy, search, handler/area/range filters, optional columns, audit history, issue links, virtualization.
- Filters become Notion-style chips. Progress and remarks are read-only.
- Table, Board and Issues become a small view switcher. Bulk reassignment moves into a `···` menu, still audited, still able to mark Needs review.

## Update Progress

- Header: title, week range with the Sunday deadline, an inline handler chip (remembered per device, honor system) and a This week / Last week switch.
- Last week is enabled only when that handler already has a last-week update. Missing ones are never created.
- The This week % cell looks like plain text until clicked. Enter moves down, Tab moves to Remark, and the focused row shows quick-set chips (25, 50, 75, 100). Native decimal entry, `%` and invalid-input recovery are preserved.
- Changed rows get a faint tint. "Hide completed" is on by default. Groups collapse.
- One sticky footer: `3 changed · +0.4% · Saved`, **Add note**, and **Confirm update** (**Confirm, no changes** when nothing changed). One click confirms, with no review stage.
- After confirmation the table locks and shows one quiet line: `Confirmed Tue 14:20 · 12 changed · Edit · ···`. The six-second Undo toast stays. Delete lives in the `···` menu with a small Delete/Cancel popover.
- Shared GR&P conflict: a one-line inline notice with **Reload GR&P** that keeps the handler's other edits.

## Code structure

- Split the dense one-line components into small files under `src/nbc/` (overview, activities, update, shared UI such as status pill, side peek, `···` menu and the WBS table).
- Replace `nbc.css`, `precision.css` and `weekly.css` with one stylesheet per screen on the existing tokens.
- Keep `progress.ts`, `submissions.ts`, `submission-actions.ts`, `drafts.ts`, `actions.ts` and their tests unchanged unless a rename is needed.

## Testing

- Keep all 97 unit tests passing.
- Add unit tests for the WBS tree flattening: indentation depth, ancestor inclusion for a handler's leaves, and group averages.
- Update Playwright selectors for the three tabs, the renamed columns and the Overview history. Keep the light/dark accessibility scans and desktop/iPad/iPhone bounds checks.
- Release checks: `lint`, `typecheck`, `test`, `build`, `git diff --check`.

## Release boundary

The database already contains the handler-submission migrations. The matching frontend stays local until you decide to deploy. No reset, reseed or migration is part of this work.
