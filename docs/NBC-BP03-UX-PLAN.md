# NBC BP03 weekly progress UX

The full design rationale is in `docs/superpowers/specs/2026-10-27-nbc-progress-redesign-design.md`; this page is the short reference for what the app does.

## Structure

Three tabs, in this order: **Overview · Activities · Update Progress**. Routes are `/projects-progress/:id/overview|activities|update`. `issues` and `board` open from the Activities view switcher (**Table · Board · Issues**). Earlier URLs redirect: `past` and `handlers` to Overview, `progress` and `boq` to Activities, `weekly` to Update Progress. Standard project pages are unchanged.

Weeks are Monday–Sunday in Asia/Phnom_Penh and are shown as a range such as `26 Oct – 1 Nov`. The deadline is Saturday 12:00 PM; lateness starts at noon. This week and last week are the only editable weeks.

The look is flat and Notion-like: hairline dividers instead of cards, 14px text, tabular numerals, soft tinted status pills (Updated, Updated late, Not yet, Overdue, Needs review) that always carry a text label, and `···` menus for secondary actions.

## WBS table

Activities and Update Progress share one table that mirrors the source workbook: `WBS · Description · Previous week % · This week % · Remark` (Activities adds `Handler`). There are only two percentage columns.

- The real WBS number is shown and never renumbered; levels run from `1.6.1` down to seven number segments (for example `1.6.1.3.4.2.4`) and the description is indented one step per level.
- Parent rows are bold and tinted (level 1 strongest), collapsible, show a leaf count and show the calculated weighted average in `This week %`. Parent progress is never editable.
- `This week %` is the editable cumulative progress; `Previous week %` is read-only. The change from last week appears only as a faint tint on changed rows, in the footer total and in Overview counts.

## Overview

A summary line (`42.02% overall · 4 of 6 handlers updated this week · 26 Oct – 1 Nov`), the all-week trend (with a table alternative), and a handler table with `This week · Last week · Changed · Contribution`. A handler row expands inline to This week, Last week and a collapsed **Older weeks**. Each week has a `···` menu: **Open** (read-only side panel with entries and note), **Edit** (this week and last week only; opens Update Progress) and **Export CSV**. Older weeks offer only Open and Export CSV. A missing last-week update is shown as Missing, with no create action. Area, floor and trade breakdowns sit behind a collapsed **Breakdown** toggle.

## Activities

The full tree with search (`/` focuses it), handler / area / progress-range / changed-this-week filters, optional columns, expand/collapse all, virtualized scrolling, an activity detail side panel (audit history, issue links) and audited handler reassignment (`···` menu → Reassign group…). Progress and remarks are read-only here.

## Update Progress

The header holds the title, the week range, the Saturday 12:00 PM deadline note, an inline handler chip (chosen on a first screen each visit, honor system) and a **This week | Last week** switch. Last week is enabled only when that handler already has a last-week update; missing updates are never created.

The table lists the selected handler's activities under their ancestor groups, then shared GR&P (marked **Shared**). **Hide completed** is on by default and never hides a row that was edited or changed. Enter moves to the next row, Tab moves to Remark, and the focused row shows quick-set chips (25, 50, 75, 100). Invalid text stays visible, keeps its group expanded and blocks confirmation.

The footer shows `N changed · +x.x%`, the autosave status, **Hide/Show completed**, **Add note** and one **Confirm update** button (**Confirm, no changes** when nothing changed). After confirming, the table is read-only and one line shows `Confirmed … · N changed` with **Edit** and a `···` menu containing **Delete update**. The confirmation toast offers Undo. A shared GR&P conflict shows an inline notice with **Reload shared GR&P**.

## Release boundary

Frontend only. The database already contains the handler-submission migrations. The redesigned frontend is committed locally on the `nbc-progress-redesign` branch and has not been deployed.
