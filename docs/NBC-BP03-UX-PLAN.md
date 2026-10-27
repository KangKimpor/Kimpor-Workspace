# NBC BP03 weekly progress UX

## References and scope

Use the downloaded Stitch Overview, Update Progress and Past Updates screens in `stitch/13035619905198052579/` for layout, alongside the existing SingBuild tokens and components. The real handlers are Sitha, Lychhinh, Chhorvaon, Srun, Kheng and Tola. Reference screenshots contain sample names and data; those do not replace real project data.

Navigation has four tabs: **Overview · Update Progress · Past Updates · Activities**. Earlier progress/weekly/handler URLs redirect to the corresponding new view. Issues and the task board remain accessible from Activities. Standard project pages are unchanged.

Weeks are Monday–Sunday in Asia/Phnom_Penh. Display a range such as `26 Oct – 1 Nov`; there is no date picker. The deadline is **Sunday end of day**, with lateness beginning at Monday 00:00. The Update page contains **only the current week and no week tabs**, following the revised decision.

## Update Progress

The left header contains the title, week range and This week label. A single, always-visible handler selector sits on the right and remembers the device's last choice. It is an honor system; there is no inferred account identity or second selector.

The remaining height belongs to an internally scrolling activities table with a sticky header. Columns are Activity, Previous %, This week %, Change and Remark. Show only the selected handler's assigned activities, plus GR&P marked **Shared**. Collapsible groups show average progress. Highlight changed rows subtly. Decimal input accepts `%`; quick-set works on desktop and phone, with increment/decrement buttons on desktop.

The bottom bar stays below the scroll area. It shows changed count, weighted percentage change and an honest autosave status, plus **Add note** and one primary **Confirm update** button. Add note expands a labeled inline textarea; its label becomes Edit note once populated. With no changed activities, use **Confirm, no changes**. Remarks and notes are optional.

Every keystroke is locally journaled immediately. Valid edits autosave into the handler draft, without updating live progress or remarks. Leaving requires no dialog. Confirmation is one click, with no review screen or confirmation dialog. Invalid input remains visible/recoverable and blocks submission. Cloud confirmation waits for the saved draft; offline drafts remain available for later confirmation.

After confirming, make the table read-only, show a green confirmation banner with local time and changed count, and show Late when appropriate. Replace the draft bar with **Edit** and an overflow menu containing **Delete update**. Delete opens a small popover with Delete and Cancel, explaining rollback and preservation of newer confirmed updates. The confirmation toast offers Undo.

Edit keeps the preceding confirmed values live while a new draft is prepared. A shared GR&P conflict has an inline explanation and **Reload shared GR&P**, preserving all other draft edits.

## Overview

Keep compact KPIs, the all-week trend and existing work-area/floor/trade breakdowns. Include **N of 6 handlers updated this week**.

Show a six-row handler strip with Last week and This week columns. Each chip is itself the link; there are no row action buttons. Status text is Updated (green), Updated late (amber), Not yet (neutral), Overdue (red outline) or Needs review (amber outline). Show confirmation time and `N changed`. Current-week links open Update Progress; last-week links open Past Updates.

Trend uses stored summaries for every historical week, with a text/table alternative. Percentages use `%`, including tooltips and accessible labels.

## Past Updates

Show six collapsible handler sections. Each has This week and Last week rows containing the range, status, changed count, weighted change, confirmation time and one overflow menu. Handler filter chips include All and remember the last choice.

An existing this-week or last-week submission offers Open, Edit, Delete and Export. Editing last week stays inside Past Updates; it is not a tab or a week chooser on Update Progress. Missing last-week updates are shown as missing, with no creation action. Editing or deleting last week automatically re-chains this week's previous values and changes.

Each handler has a collapsed **Older weeks** section covering all older records. Its actions are Open and Export only. Opening displays read-only entries and the note. Preserve historical details and summaries; do not truncate history to the edit window.

## Activities and responsibility

Keep the existing hierarchy, search, handler/area/range filters, optional columns, virtualized scrolling, grouping, audit details, issue links and reassignment tools. Progress and remarks are read-only here; Update Progress is the place for draft edits. Reassignment stays audited and can mark a prior confirmation Needs review. GR&P remains shared and counted once in overall progress.

## Responsive and accessibility checks

- Desktop: wide table, compact header, internal scrolling and bottom bar within the viewport. Sticky table headers require no scroll listeners.
- Tablet: retain the same table flow and scroll containment.
- Phone: rows stack remarks beneath the activity/value/change fields, with decimal entry and native quick-set. Avoid horizontal page overflow. Preserve room for the bottom bar and safe-area navigation, including a shorter keyboard viewport.
- Reuse theme tokens; changed rows, banners and status chips must retain contrast in light and dark themes. Use text labels with color, accessible input names, visible focus, semantic table headers, expanded-state announcements and reduced-motion support.

## Removed flow

There is no project-wide start/finalize cycle, stepper, Review stage, date picker, duplicated identity dropdown, three-choice leave dialog, correction request/log or historical snapshot banner. Earlier reports remain archived for data preservation, without exposing the removed workflow.

## Release boundary

The database schema and frontend must be released together. Production already has NBC data, so use the prepared forward migration, never a reset or baseline reapplication. The user approved the database migration, and both the handler-submission and table-privilege migrations are applied. The matching frontend remains committed locally, with deployment still pending. Local verification alone is not a frontend release.
