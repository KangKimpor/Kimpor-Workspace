# Design QA

## Board, project creation, and logo update — 2026-10-26

final result: passed

- Visual truth: the supplied Notion board screenshot and the user's open Chrome reference, captured locally as `docs/screenshots/board-update/notion-board-reference.png`.
- Implementation: `docs/screenshots/board-update/board-desktop-dark.png`, `board-mobile-dark.png`, and `projects-clean.png` in the same folder.
- Full comparison: `docs/screenshots/board-update/board-comparison.png`; focused card comparison: `board-detail-comparison.png`.
- Desktop comparison: 1397 × 654 CSS pixels. Captures normalized to that pixel size for the full comparison; focused crops remain at native density. Phone capture: 393 × 852. Both source and implementation show the default board in dark mode with details collapsed.
- Content differs intentionally: the reference contains the user's real tasks, while the app uses its existing demo tasks. The existing sidebar, editing controls, and additional In review/Blocked groups remain functional. This is a scoped board styling update, not a copy of Notion's surrounding product.

### Visual checks and comparison history

1. P2: Expanded task forms made cards substantially taller than the reference. Moved status, due date, description, and advanced fields behind the existing details control. Post-fix focused comparison shows titles and priority tags with consistent padding, wrapping, and gaps.
2. P2: Initial cards were too large and neutral colors too light. Matched the reference's compact typography, 280px columns, 10px card corners, dark neutral/blue/green surfaces, and hover controls. The final focused comparison confirms the corrected density and semantic colors.
3. P2: Project-list inputs, duplicated workspace selectors, and descriptions cluttered creation. Replaced the inline form with a single New project button opening the existing editor. Cancel creates nothing; Save preserves workspace and icon. `projects-clean.png` verifies the simplified entry screen.
4. P2: Text focus created bright blue rectangles. Replaced text-field and search-container outlines with a subtle underline; retained keyboard focus on controls and forced-colors outlines. Computed styles and browser tests verify `outline-style: none` while typing.
5. Fonts/typography: kept the app's installed Inter family; card titles use 15px/1.5 desktop text, 16px for touch devices, and wrap without clipping. The reference uses its platform font. This family difference is an accepted product constraint.
6. Spacing/layout: aligned title, completion icon, priority tag, and hover actions; column headers and cards share consistent insets. Mobile keeps horizontal board scrolling inside the content region with no page overflow.
7. Colors/tokens: neutral, blue, and green board surfaces follow the reference; existing priority tokens remain in use. Minor priority shade differences are acceptable shared-design-system variation.
8. Image/asset fidelity: supplied SVG is used directly in app chrome, settings, and favicon. Installed-app PNGs are generated from that vector. No replacement logo was drawn.
9. Copy/content: removed both requested project-list descriptions and the inline workspace/name fields. Existing task content remains editable; no reference task data was imported.

### Verification

- In-app browser: inspected desktop and phone boards, tested New project and Cancel, checked typing focus, and checked console errors (none).
- 78 unit tests passed, including draft creation and icon/workspace persistence.
- 44 Chromium production browser tests passed, including creation, table editing, board editing, drag-and-drop, offline reload, light/dark accessibility, and responsive layouts.
- Six WebKit board tests passed, including wrapping, quiet typing, task fields, completion undo, and drag-and-drop.
- Typecheck, lint, and production build passed.
- No actionable P0/P1/P2 findings remain. Full and focused visual comparisons are saved locally; source captures containing private reference data are ignored by Git.

---

final result: passed

## Evidence and scope
- Source: `C:/Users/Por/AppData/Local/Temp/screen.png` (1280 x 890 pixels), `DESIGN.md`, and `code.html`.
- Later selector feedback: `C:/Users/Por/AppData/Local/Temp/codex-clipboard-b3aa5f8a-c23f-4d93-b993-47d7f995dbdc.png`. The user explicitly requested replacing its rectangular dropdowns with liquid-glass controls.
- Implementation: `docs/screenshots/tasks-polished.png`, `glass-selectors.png`, `project-editor-polished.png`, `project-table-polished.png`, `calendar-picker-polished.png`, and `tasks-mobile-polished.png`.
- Desktop CSS viewport and capture: 1280 x 890 at device scale factor 1. Mobile: 390 x 844 at device scale factor 1. No density scaling required.
- Full comparison: `docs/screenshots/tasks-comparison.png`, with source and implementation alongside each other at native density.
- Focused comparison: `docs/screenshots/tasks-detail-comparison.png`, showing overdue and today headers, rows, metadata and alignment at native density.
- State: light theme, default task filters, real seeded workspace data. Additional captures show an open glass menu, project editing, and calendar selection.

## Findings and iteration history
1. P2: Project labels were hidden by an existing breakpoint. Restored them in My tasks, including stacked metadata on narrow screens. Verified in desktop and mobile captures.
2. P2: The task summary and inherited group margins pushed the first task group below the reference position. Moved summary below groups, removed inherited top margins, and tightened desktop heading and row spacing. The revised full and focused comparisons show consistent group gaps, aligned checkbox/title tracks, and aligned project/date metadata.
3. P1 accessibility: Overdue badge text failed contrast on tinted backgrounds. Mixed the background with the raised-surface token. Light and dark accessibility checks now pass.
4. P2: Original native selectors did not meet the user's revised visual request. Replaced visible dropdowns in the affected screens, task table, and editors with one shared glass control: rounded trigger, specular highlight, blurred floating menu, selected checkmark, and keyboard navigation. Verified in `glass-selectors.png` and interaction tests.

No actionable P0/P1/P2 findings remain in the requested scope.

## Required fidelity surfaces
- Typography: Existing Inter/system stack retained. Page headings, compact labels and table text have distinct sizes and weights; long task names wrap on mobile and truncate on desktop. Dates and counts use tabular figures.
- Spacing/layout: Consistent 8/12/16/24/32 px rhythm; shared control alignment, 24 px group gaps, compact task rows, paired project form columns, and a full-width calendar after moving calendar selection into a popover. No viewport overflow at tested widths from 320 to 1920 px; tables and calendar grids retain internal scrolling.
- Colors/tokens: Existing theme tokens and glass materials reused. Semantic project dots and overdue date chips retained. Both themes pass the existing automated accessibility checks.
- Assets: No raster illustrations are needed. Existing Lucide icons and project icons are reused; no new image dependencies or placeholder artwork introduced.
- Copy/content: The application's actual task titles, dates and project counts replace reference sample data. Project tasks replaces Assigned to me because this application has no assignee field. No sync status is invented. Upcoming includes all future tasks, with a separate No date group so undated work remains available. These are intentional product-data differences.

## Validation
- 69 unit tests passed, including real selector change events, keyboard option navigation, project draft isolation, validation, and saving.
- 33 Chromium browser checks passed on the production build: project table/board navigation, saved views, editor save/cancel, task editing and completion undo, calendar selection and recurring events, resizing, responsive layouts, offline reload, and accessibility in light/dark themes.
- Final focused browser check reran successfully after the final spacing adjustment; it checks mobile accessibility and captures all revised screens.
- Browser page errors: none during the focused flow.
- Typecheck, lint, production build, and diff whitespace checks passed. The build retains the existing large editor-chunk advisory.

## Follow-up polish
- The reference uses different sidebar content and sample records; the existing workspace navigation and actual data are intentionally retained.
- Safari-specific rendering was not exercised in this run.
