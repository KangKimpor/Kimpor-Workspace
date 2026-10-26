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

## NBC Update Progress layout QA — October 26, 2026

- Scope: `src/nbc/WeeklyProgress.tsx`, `src/nbc/nbc.css`, `src/shell/AppShell.tsx`, `src/shell/Overlays.tsx`, `e2e/nbc.spec.ts`, `e2e/ui-polish.spec.ts`, and this entry. Earlier uncommitted changes were preserved. Calculation, draft, autosave, discard and finalization logic were not changed.
- Restored the normal sidebar, top bar, project header/tabs and phone bottom navigation. Removed all focus-mode attributes/references (repository search returned no matches). Compacted the project strip, workflow and summary to bring the table up by about 200px in the 1366px laptop capture. Normal text sizes are retained.
- Past updates moved from the bottom disclosure to a matching header button with history icon and count. It opens the existing right sheet on desktop and bottom sheet on phones. Added an optional trigger to those sheet components for native focus restoration; the side-sheet container now uses a valid dialog element. Verified Escape, focus return, expanded state, empty state, CSV download, report selection, read-only snapshots and correction pills.
- Grid: fixed numeric/handler/WBS columns, truncating activity names, aligned percentages and equal-width bars, compact 48px desktop rows, opaque sticky column header, and independent grid scrolling. The page scrolls normally; there is no viewport-height page lock. Grid minimum height is 424px (roughly eight rows under its header). Desktop table and page have no horizontal overflow at 1920×1080, 1536×864, 1440×900 and 1366×768. Existing iPad and phone grid variants remain in use.
- Screenshots: `docs/screenshots/update-progress/` contains light/dark viewport captures for all four desktop/laptop sizes, iPad 820×1180 and iPhone 393×852, plus desktop captures scrolled to the editing area (`*-editing.png`). Screenshots use a dense synthetic fixture; private BOQ data is not published. The directory remains ignored under the repository's existing screenshot policy.
- Verification: `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test` (95 passed), `corepack pnpm build`, and `corepack pnpm test:e2e e2e/nbc.spec.ts e2e/project-layout.spec.ts e2e/ui-polish.spec.ts e2e/mobile-spacing.spec.ts e2e/a11y.spec.ts --workers=4` (136 Chromium/WebKit checks passed). Axe checks passed in both themes, including the report sheets. The existing large-editor bundle advisory remains.
- Test maintenance: replaced NBC focus-mode/disclosure expectations with normal-shell/history-sheet checks. Updated one stale UI-polish assertion to verify saved project status through the existing editor instead of a removed properties panel. Project-layout, mobile-spacing and global accessibility tests already assert normal layout and required no changes.
- Intentionally unchanged: project calculations and all saving/reporting behavior, other project screens, dependencies, database schema and production data. No deployment or push was performed.


## Project Progress precision redesign — 2026-10-26

final result: passed

### Source and evidence

- Visual truth: `C:/Users/Por/Downloads/stitch_singbuild_workspace_design_system/stitch_singbuild_workspace_design_system/singbuild_precision_workspace/DESIGN.md` and the five supplied `screen.png` references. DESIGN.md overrides the screenshots’ palette, density, radii and elevation.
- Implementation gallery: `docs/progress-redesign/index.html`; primary capture: `docs/progress-redesign/A-desktop.jpg`. Every requested A–I state is labeled, with separate validation, commit, filter-empty and mobile-sheet captures.
- Full comparison: `docs/progress-redesign/comparison.jpg`. Left: supplied Project Progress screenshot; right: implementation. Source is 1745 × 1823 pixels; it was normalized to 1430 pixels wide and cropped to the implementation’s 1073-pixel content capture before combining. The combined comparison is reduced to 1800 pixels wide for inspection. This is a comparison of the corrected desktop state, not a pixel-identical clone of the screenshot’s documented defects.
- Focused table comparison: `docs/progress-redesign/table-comparison.jpg`, two native 1145 × 330 crops. It verifies WBS visibility, numeric alignment, complete Actual/Variance/Actions headers, borders and bar height.
- CSS viewport widths checked: 1440 desktop, 820 tablet, 393 phone. Browser screenshots omit scrollbar/chrome pixels, so content captures are 1430 pixels wide on desktop, 810 on tablet and 383 on phone; sheets are 393 × 852. E top-bar crops are 1440 × 44. Screenshot heights vary with the in-app panel; these were not interpreted as layout defects. The source has no tablet/mobile/dark targets, so those are checked against DESIGN.md and the requested responsive composition.

### Fidelity surfaces

- Fonts: installed Inter and JetBrains Mono retained; WBS uses 11px/14px mono, 600 weight and .02em tracking. Numeric cells use tabular figures. Controls stay on one line, and long activity names retain an accessible full label and title.
- Layout: 260px sidebar, 44px top bar, 160px desktop sticky WBS, 48px rows, 32px deep rows and 64px tablet rows accommodating 44px targets. The desktop uses eight default columns; tablet uses five and mobile uses stacked rows with scrolling tabs. Default grids and pages reported no horizontal overflow at all three widths.
- Tokens: exact supplied canvas/sidebar/border/text/accent/status tokens, dark canvas/sidebar/raised/text/borders. Opaque surfaces, small radii and no button/card/input/table shadow. Only sheets and dialogs use the allowed floating shadow. Flat bars use scaleX, blue below completion and green at 100%.
- Assets: existing supplied workspace brand assets and installed icon components retained. No generated visual assets or additional visual references were introduced. The current repository’s red brand mark differs from the older screenshot’s SB/building marks; it was preserved as existing product identity.
- Copy/data: Team replaces the redundant Projects Progress badge; the cloud status appears once; Masonry replaces Mansonry in the rendered project data; Initial baseline (undated) and em dashes are preserved. The live project has 790 source records and 125 entries in its initial collapsed tree. Its real hierarchy, handler assignments and values are preserved. The screenshot’s illustrative AV System / architectural-finish labels for 1.6.2–1.6.4 were not imported over existing project records. This is an explicit data difference, not a claim of exact screenshot-content reproduction.

### Comparison history and fixes

1. P1: Original default tracks required a 1536px table inside a smaller main region. Replaced the default nine-track composition with eight fitted tracks; verified WBS, Actual, Variance and Actions at 1440px with zero grid overflow.
2. P2: Fixed small-control wrapping, redundant header sync, Team badge contrast in dark mode, clipped sidebar progress chip, and the activity-name flex behavior that pushed Standalone outside the activity cell. Final desktop capture and focused comparison show the corrected controls and aligned columns.
3. P2: Invalid inline validation was obscured by later virtual rows. Raised only the editing row’s stacking level and moved the message below the field; `B-validation.jpg` shows the message visibly beside the rejected 125% input.
4. P2: Deep rows’ cell padding exceeded their 32px rhythm and tablet codes competed with a 44px expander. Reduced deep-row padding; tablet keeps a 160px WBS track, 64px rows, 44px controls and a 120px bar. `G-tablet-820.jpg` confirms the final touch layout without horizontal clipping.
5. P2: Spring-based sheet movement conflicted with the timing specification. Sheets now enter at 220ms and exit at 70%, with an opacity scrim; Reduced uses 140ms opacity without movement. Filter-sheet dismissal and editor Done were exercised in the browser after the change.

### Behavior and checks

- Parent collapse, handler selection, removable filters and empty results verified in the in-app browser.
- Rejected 125% remains editable, retains the prior saved percentage and shows aria-invalid plus an associated validation message. A committed 80% edit shows negative variance; a 1.2% GR&P update shows positive variance and recalculates overall progress to 42.12% in the same local session.
- Mobile Filters opens the bottom sheet; choosing a handler and Show activities applies it. Tapping Actual opens the editor; Done and dismiss controls close it. Both sheets remain usable at 393px.
- Reporting date defaults to 10/26/2026 in the client timezone. Start update opens the existing Date / Update activities / Review changes / Finish workflow; Past updates shows Initial baseline (undated) when empty.
- Saving / Saved to cloud / Offline / Error with Retry use the real top-bar component in an isolated sync fixture. Full project-preview edits remain local and are labeled Demo · local.
- Reduced variant reports `precision-fade`, `0.14s`, with motion/stagger removed. OS and in-app reduced preferences are supported.
- Fresh final-preview browser console: no errors. Earlier development-only fixture and hot-reload errors were corrected before this check.
- Typecheck, lint and production build pass. Full unit run: 95 tests passed. Focused NBC verification after the draft-validation change: 15 tests passed. Cross-browser Playwright suite and a fresh automated accessibility scan were not run; responsive and keyboard checks above were performed through the in-app browser.

### Residual limits

- Existing BOQ data and current brand assets intentionally differ from the old visual examples, as documented above. Network-loss recovery is covered by the existing sync implementation and isolated visual states; this pass did not interrupt a real cloud session.
- No remaining actionable P0/P1/P2 findings for the integrated redesign. Exact reproduction of the reference’s sample BOQ assignments would require a separately agreed data change.


## Weekly handler selection and Saturday review — 2026-10-26

final result: passed

The user added handler selection and weekly completeness tracking during the redesign. The new checklist reuses the supplied handler initials, compact flat cards and status tokens. It is expanded on desktop and compact on mobile, with all six handlers available on expansion. `docs/progress-redesign/Weekly-handler-selection.jpg`, `Weekly-two-confirmed.jpg`, `Weekly-needs-review.jpg`, `Weekly-overdue.jpg`, `Weekly-mobile-collapsed.jpg` and `Weekly-mobile-expanded.jpg` are the browser evidence; they are labeled in the existing gallery. These extend the A–I redesign captures with the new reporting workflow.

Handler selection is required in the start form, with the reporting date defaulting to the upcoming Saturday. Selecting a handler initially filters that person’s activities; the shared project grid and existing assignment permissions are retained. Confirm my weekly update records explicit completion, including no-change weeks. Confirmations display Updated, Updated late, Not yet updated, Overdue or Needs review. A later activity edit invalidates the confirmation until resubmitted. Old finalized reports without tracking data show Not recorded. The manager can choose past weeks or return to Current week; the default view follows week rollover without reloading.

The deadline is Saturday 12 PM in Asia/Phnom_Penh. The client clock updates the checklist at the deadline; server timestamps decide on-time versus late confirmations. Exactly noon counts as late. CSV exports include the six handler confirmations and deadline. Finalization warns which handlers have not confirmed and explains that it locks the report.

Browser validation: Start update was disabled before selection; Tola was selected and started, then confirmed a no-change week. Sitha confirmed separately, producing 2 of 6 updated. Editing Sitha’s activity changed the checklist to Needs review, and reconfirming restored completion. A selected past reporting week showed all six as Overdue. At 393px the checklist began collapsed, expanded into two columns, showed all six handlers and reported no horizontal overflow. A lingering old WBS offset in the update workspace was removed from the original stylesheet; the WBS cell is now within 1px of the grid’s left edge, matching its border.

Database support: migration 20261026160634_nbc_handler_weekly_confirmations is applied. The report guard canonicalizes actor, server time and counts while preserving immutable periods, snapshots and RLS. The rolled-back verification script passed server-time, actor, counts, independent handlers, immutable metadata and confirmation-retention checks, without persisting any test report edits. Security advisors were unchanged from the pre-migration baseline; the changed trigger uses security invoker with an empty search path and exposes no new tables or RPCs.

Final verification: all 100 unit tests pass. The five reporting tests include deadline boundary, local timezone, next-week/year rollover, no-change confirmations, post-confirmation edits, independent-field merging and an open checklist moving through noon and into the next week. Typecheck, lint and production build pass. Public frontend deployment was not requested; the review preview runs locally. No actionable P0/P1/P2 findings remain for this addition.


### Final desktop sign-off

At the user's request, further mobile checks are deferred. Final verification focuses on desktop at 1440px. Start update remains disabled until a handler is selected; choosing Tola opens the assigned-activity view. A no-change confirmation updates the six-handler checklist. Review and Finalize display the five remaining handler names and explicitly warn that finalization locks the report. Returning to Project Progress preserves the open period and confirmation. The final desktop view reports no page or grid horizontal overflow; `docs/progress-redesign/Desktop-final.jpg` is the handoff capture. No production report was finalized during these UI checks.

final result: passed
