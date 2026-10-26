# NBC BP03 Progress Tracker: UX/UI Plan for Codex

Companion to the main implementation prompt. Save as `docs/NBC-BP03-UX-PLAN.md`. It covers layout, interaction, and responsive behavior only. The data model and calculation rules stay in the main prompt.

---

## 0. Ground rules

1. **Read the existing design system before drawing anything.** Take colors, radii, spacing, type scale, pill styles, glass surfaces, and table density from the current tokens and components. Do not invent new values. If a token is missing, add it to the existing token file and document it.
2. **Reuse before building.** Start from `TaskTable`, the existing tabs, pills, popovers, modals, and bottom sheets. Create new components only for the hierarchical BOQ row, the progress cell, and the weekly review diff.
3. **One project, five views.** The project keeps its normal header and navigation. The five views are sub-tabs inside it, not separate pages in the sidebar.
4. **Density over decoration.** No oversized cards, no new gradients, no hover backgrounds that shift layout, no decorative animation. Motion is limited to expand/collapse and value-change feedback, each 150 ms or shorter. Respect `prefers-reduced-motion`.
5. **Target viewports, checked at every phase:** 1920×1080 (and 1980 wide), iPad (A16, portrait and landscape), and iPhone 15 (393×852). Nothing may overflow, misalign, or sit off-grid at any of them.

---

## 1. Information architecture

```
Team Workspace
└─ NBC BP03 – Pan Pacific Hotel
   ├─ Overview
   ├─ BOQ Progress          ← primary working view
   ├─ By Area / Handler
   ├─ Weekly Progress
   └─ Issues & Actions
```

- The sub-tab bar sits directly under the project title and stays sticky on scroll.
- The active view is stored in the URL (`/projects/:id/boq`, and so on), so refresh and deep links work.
- Dashboard click-throughs navigate to BOQ Progress with filters in the query string (`?area=…&handler=…`). Filters appear as removable chips, so the user can see why the list is filtered.

### Persistent project header (all views)

| Left | Right |
|---|---|
| Project name, small "Team" badge | **Reporting-week chip**: `Week of 26 Oct 2026 · Draft`, or `No open week` |
| Overall progress, e.g. `42.02%` with a thin bar | Sync state (existing component), overflow menu (Export, Corrections log) |

The reporting-week chip is the single control for the weekly workflow. Clicking it opens a popover with the current period, its status, and the primary action (**Start week** or **Review & finalize**).

---

## 2. Overview

### Desktop layout (12-column grid)

1. **KPI strip** (one row, six compact stat tiles): Overall progress, This week (± change), Previous week, BOQ value, Activities (total), Last updated.
   - A second line under Activities shows `Completed · In progress · Not started` as three small pills with counts.
   - Show `—` for This week and Previous week until a finalized snapshot exists.
   - Label the baseline as **Initial baseline (undated)**. Do not show a date for it.
2. **Weekly trend chart** (8 columns): a line chart of finalized snapshots only.
   - With zero or one snapshot, show a single point and the message "Trend appears after the second finalized week."
   - Tooltip: week-ending date, overall %, change.
3. **Handler summary** (4 columns): six compact rows, each with name, weighted contribution, and a mini bar. Click to go to the filtered BOQ view.
4. **Progress by work area** (full width): horizontal bars, one per major BOQ area, each showing the % and weight. Click navigates to the filtered BOQ view.
5. **Progress by floor/location** and **by trade**: two half-width bar lists, each with a "Show all" toggle after 8 rows.

### Tablet and phone

- The KPI strip becomes 3×2 on iPad and 2×3 on iPhone.
- Chart and breakdowns stack in a single column.
- On iPhone, breakdown lists show the top 5 rows plus "Show all".

---

## 3. BOQ Progress (primary view)

### 3.1 Toolbar (sticky under the sub-tabs)

One row on desktop, two on tablet, collapsed on phone:

- **Search** (WBS, activity, description). Shortcut `/` focuses it.
- **Handler** segmented control or dropdown: All, Sitha, Lychhinh, Chhorvaon, Srun, Kheng, Tola. Use tabs on desktop, a dropdown below 768 px.
- **Area** dropdown, **Progress range** popover (min/max, or presets: 0%, 1–99%, 100%).
- **Expand all / Collapse all** icon buttons.
- **Columns** menu (toggle optional columns).
- **Changed this week** toggle, which shows only rows that differ from the previous snapshot.
- Active filters appear as chips below the toolbar with a single "Clear all".

On phone, only Search and a **Filters** button show. The button opens a bottom sheet containing every other control and shows an active-count badge.

### 3.2 Columns and widths (desktop)

| Column | Behavior |
|---|---|
| Expand + WBS | Sticky left. Chevron, then the WBS code in a monospace or tabular-figure style. |
| Activity | Sticky left after WBS. Indented 16 px per depth level, truncated with tooltip, wraps in the detail row. |
| Handler | Small initials avatar and name. Click opens a handler picker (leaf rows only). |
| Weight | Right-aligned, 3-decimal %. Shows the effective global weight. |
| Previous % | Right-aligned, muted. |
| **Actual %** | The edit cell: input and progress bar. Widest numeric column. |
| This week | Right-aligned. Positive in the success tone, negative in the warning tone (never red alone: add a ▲/▼ glyph), zero shown as a muted `0.0`. |
| Duration | Right-aligned, muted. |
| Remarks | One-line truncated preview with an icon-only state when empty. |

Optional columns (off by default): Area, Trade, BOQ value, Schedule %, Status.

Use `font-variant-numeric: tabular-nums` on every numeric column so digits align.

### 3.3 Row types

- **Parent row:** slightly stronger weight, chevron, a read-only calculated % with a lock-style "calculated" affordance on hover/focus (tooltip: "Calculated from child activities"). Its bar uses a neutral tone.
- **Leaf row:** editable, with a full-contrast bar.
- **Standalone weighted entry (GR&P):** looks like a leaf row but carries a small "Standalone" pill. Use the editing rule defined in the main prompt. The tooltip states that rule in one sentence.
- **Zero-weight row:** muted text, an info icon explaining that it does not contribute to progress, and an editable state only if the main prompt allows it.

### 3.4 The progress cell (Actual %)

Structure: `[ input 56px ] [ bar flex ] [ status pill ]`

- **Display mode:** number plus bar. The pill reads Not started, In progress, or Done, using the existing small pill style.
- **Edit mode:** click the number, or press Enter on a focused row, to edit. The field accepts decimals (`37.5`) and an optional `%` sign.
- **Quick-set menu:** a small popover with 0, 25, 50, 75, 100 buttons next to the field. These are shortcuts only. The field accepts any value.
- **Commit:** Enter or blur commits. Escape reverts.
- **Validation:** values outside 0–100 clamp with an inline message ("Progress must be between 0% and 100%"). Non-numeric input shows an inline error and does not commit.
- **Downward corrections:** allowed. When the new value is lower than the previous finalized value, show a subtle ▼ in the This week column and a one-line inline note "Lower than last finalized week". No blocking dialog.
- **Feedback on commit:** the bar animates, affected ancestor rows and the header overall % update immediately, and each changed value flashes a brief highlight (respecting reduced motion). Persistence runs in the background with a debounced save and the existing sync indicator.
- **Locked state:** with no open reporting week, the cell is read-only and a toolbar banner explains it (see section 6).

### 3.5 Keyboard model

| Key | Action |
|---|---|
| ↑ / ↓ | Move row focus |
| → / ← | Expand / collapse the focused parent (or move to the parent on ←) |
| Enter | Edit Actual % on a leaf |
| Tab / Shift+Tab (in edit) | Commit and move to the next / previous editable leaf |
| Esc | Cancel edit |
| `r` | Open / close the remark detail row |
| `/` | Focus search |

Use the ARIA treegrid pattern (`role="treegrid"`, `aria-level`, `aria-expanded`, `aria-rowindex`). Virtualization must keep `aria-rowcount` and `aria-rowindex` correct.

### 3.6 Detail row (inline expandable)

Opens beneath the row, spanning all columns:

- Remark textarea with "Updated {date} by {editor}".
- Metadata: area, trade, BOQ value, schedule %, duration, global weight.
- Progress history: the last 5 changes (date, from → to, editor), with "View all".
- "Create issue" button, which prefills a linked task (see section 7).

On phone, this same content appears as a bottom sheet, opened by tapping the row's overflow area (not the edit target).

### 3.7 Sorting and hierarchy

Sorting applies within each sibling group, so the WBS hierarchy never breaks. A small caption appears while sorted: "Sorted within groups". When search or filters are active, matching rows appear with their ancestor chain preserved, with ancestors in a muted style.

### 3.8 Performance behavior (UI side)

- Virtualize the flattened visible-row list. Fix the row height (compact density, matching the existing table).
- Expand/collapse toggles a set of ids and re-flattens only the affected subtree.
- Sticky columns use CSS `position: sticky`, with no JS scroll listeners.
- Lazy-load the whole NBC module, and the chart library separately.

---

## 4. By Area / Handler

Two modes under one view, switched by a segmented control at the top: **By Handler** (default) and **By Area**.

**By Handler:** six cards in a grid (3×2 desktop, 2×3 tablet, 1×6 phone). Each card shows:

- Name and scope line (e.g., "Marble, Tile, Screeding, Waterproofing").
- Weighted contribution to overall progress (large number).
- `Assigned · Completed · In progress · Not started` counts.
- "Updated this period: N".
- Footer action: **Open in BOQ** (applies the handler filter).

A note under the grid states that contribution uses global BOQ weights, not the average of task percentages. Keep this to one line.

**By Area:** a table with Area, Weight, Progress, Δ This week, Activities. Rows are expandable to the next hierarchy level. This table shares row styling with BOQ Progress.

**Reassigning handlers:** done from the BOQ row's Handler cell. Add a bulk option here: select a parent node and choose "Assign all leaves to…", with a confirmation sheet that lists the count affected.

---

## 5. Weekly Progress

### 5.1 Stepper header

A four-step horizontal indicator: **Start week → Update → Review → Finalize**, with the current step highlighted. On phone it collapses to "Step 2 of 4: Update".

### 5.2 States

1. **No open week:** an empty state with a date picker (week-ending date) and a **Start reporting week** button. The picker blocks a date that already has a snapshot and says so inline.
2. **Draft week open:** shows a live summary: overall % now, change vs previous, count of activities changed, count with negative corrections.
3. **Review (diff) panel:** a table of changed activities only: WBS, Activity, Handler, Previous %, New %, Δ, Weighted Δ, Remark. It is sorted by weighted impact, with filters by area and handler. Negative corrections carry a ▼ and a warning tone. Rows with a progress change but no remark show a subtle "No remark" hint (not blocking).
4. **Finalize dialog:** a summary (week-ending date, overall % before and after, N activities changed), an optional note, and two buttons: **Finalize week** (primary) and **Keep editing**. State clearly: "Finalized weeks cannot be edited silently. Corrections are logged."
5. **After finalizing:** a success toast, and the header chip returns to "No open week" or offers "Start next week".

### 5.3 History

A list of finalized weeks, newest first: week-ending date, overall %, Δ, activities changed, finalized by/at. Clicking opens a **read-only snapshot view** that reuses the BOQ table with a visible "Snapshot · Week of …" banner. Edit controls are absent in this view, not just disabled.

### 5.4 Corrections

In a snapshot view, a **Request correction** action opens a sheet: choose activities, enter the corrected value, and give a required reason. Submitting creates an audited correction entry. The history list marks corrected weeks with a "Corrected" pill, and the Corrections log (project overflow menu) lists every entry with before/after, reason, editor, and time.

### 5.5 Export

An **Export to Excel** button sits in the Weekly Progress header and in each history row's overflow menu. It exports the weekly summary only.

---

## 6. Empty, locked, and error states

| Situation | UI |
|---|---|
| No open week, user tries to edit | Inline banner above the table: "Start a reporting week to update progress." with a **Start week** button. Cells are read-only. |
| Initialization not yet run | Project page shows an empty state: "BOQ data has not been initialized." with a link to the setup instructions in `docs/NBC-BP03-PROGRESS-TRACKER.md`. No import button. |
| Offline | Reuse the existing offline indicator. Edits stay visible with a "Pending sync" mark on affected rows. |
| Save failure | Row-level error icon with retry. The value stays visible so no input is lost. |
| Filter has no matches | "No activities match these filters" with **Clear filters**. |
| Calculation inconsistency (missing weight) | A dismissible warning banner on Overview with the count and a link to the affected rows. |

---

## 7. Issues & Actions

Reuse the existing task table and board as they are, with these additions:

- A **WBS activity** field on a task: a searchable picker (WBS code and activity name). Shown as a compact pill on the task row, which links to the BOQ row.
- A **Filter by WBS / handler** control in this view's toolbar.
- On BOQ rows, a small count badge appears when linked open tasks exist. Click to filter Issues & Actions to that activity.
- Suggested issue types appear as quick tags (Material approval, Shop drawing, Obstruction, Inspection, Rectification, MEP coordination). These are suggestions, not a new data type.
- A status such as Blocked appears in the task UI only. It never changes the BOQ percentage or the progress bar.

---

## 8. Responsive specification

### Desktop (≥1280 px, tested at 1920×1080 and 1980 wide)

- Content max-width follows the existing page container. Do not stretch the table beyond readable bounds on ultra-wide screens. The table itself may use full width.
- All optional columns are available. Two sticky columns (WBS, Activity).

### iPad (768–1279 px, portrait and landscape)

- Visible columns: WBS, Activity, Handler (initials only), Actual %, This week. Other columns move into the detail row.
- Touch targets are at least 44×44 px for the edit cell and chevron.
- Toolbar wraps to two rows. Handler tabs become a scrollable pill row.

### iPhone 15 (393 px wide)

- Row layout (two lines per row):
  - Line 1: chevron, WBS (muted), Activity name (truncated at one line).
  - Line 2: bar, Actual % (tap to edit), This week delta.
- Tapping the percentage opens a **numeric editing sheet**: large decimal keypad input (`inputmode="decimal"`), quick-set chips (0 / 25 / 50 / 75 / 100), a remark field, and Save. This avoids keyboard overlap problems from inline editing.
- Filters, handler, and columns live in a bottom sheet.
- Sub-tab bar scrolls horizontally, with the active tab kept in view.
- Respect safe-area insets at the bottom and top.
- No horizontal page scroll. Only the sub-tab bar and chip rows scroll sideways.

### Alignment checks (apply to all three)

- All spacing uses the existing spacing scale. Use a 4 px base, with no arbitrary pixel values.
- Row text baselines align across columns. Numeric columns right-align on the decimal point (tabular figures).
- Icon buttons share one size per density level.
- Bars share one height and one radius everywhere.

---

## 9. Themes and accessibility

- Light and dark both use existing tokens only. Check bar fills, delta tones, pills, and chart series for contrast in both (WCAG AA for text, 3:1 for graphical elements).
- Meaning never relies on color alone: deltas carry ▲/▼, statuses carry text labels, and chart series use distinct markers or direct labels.
- Visible focus rings on every interactive element, including sticky cells.
- Charts include a text alternative and a "View as table" toggle.
- Announce edit results to screen readers politely: "Install gypsum board set to 75%. Overall progress 42.31%."
- Support 200% text zoom without clipping inside rows (the detail row absorbs overflow).

---

## 10. Microcopy

Keep it short and literal.

- Baseline label: `Initial baseline (undated)`
- Locked: `Start a reporting week to update progress.`
- Calculated parent: `Calculated from child activities.`
- Lower value: `Lower than last finalized week.`
- Finalize: `Finalized weeks can't be edited silently. Corrections are logged.`
- Duplicate period: `A report for this week already exists.`

---

## 11. Assumptions to confirm

1. **Editing requires an open reporting week.** The main prompt describes a Start → Update → Finalize flow, so the BOQ table is read-only without an open week. If free editing before the first week is preferred, change §3.4 and §6.
2. **Mobile edits use a bottom sheet** rather than inline fields. This is a design choice, not something from the main prompt.
3. **Bulk handler reassignment** (§4) is an addition beyond the main prompt. Remove it for a smaller scope.

---

## 12. UI acceptance checklist

- [ ] All five views reachable from the sub-tabs, with deep links and filter chips working.
- [ ] BOQ table: expand/collapse, search with ancestor context, handler/area/range filters, in-group sorting, inline decimal editing, keyboard model, and virtualization verified at ~789 nodes.
- [ ] Parent, ancestor, and overall values update immediately after an edit.
- [ ] Weekly workflow runs end to end, with duplicate-period protection, a read-only snapshot view, and an audited correction flow.
- [ ] Mobile editing sheet works with the on-screen keyboard and safe-area insets.
- [ ] Playwright screenshot tests at 1920×1080, iPad portrait and landscape, and iPhone 15, each in light and dark.
- [ ] No horizontal page overflow, misaligned columns, or off-grid spacing in any screenshot.
- [ ] Existing standard projects, task table, and board show no visual or behavioral change.