# NBC BP02 progress tracker

NBC BP02 – Pan Pacific Hotel (guestrooms and corridor/lift lobby, L13–L23) is added to Projects Progress with project ID `nbc-bp02` and activity IDs `nbc-bp02:<WBS>`. It reuses the shared BOQ workflow (Overview, Project Progress, Update Progress, autosave, history, Excel export). BP03 and BP04 data and defaults are unchanged.

## Source and reconciliation

Source: `C:/Users/Por/Downloads/NBC-BP02-Progress Tracking by BOQ.xlsx` (SHA-256 `cf01e961c4f091b753271f151c7cd604007b21492fe1982553c4162092d89144`), used as data only. Regenerate private files (ignored `.private/nbc-bp02/`) with:

```powershell
python scripts/nbc-bp02-extract.py 'C:/Users/Por/Downloads/NBC-BP02-Progress Tracking by BOQ.xlsx'
```

The extractor verifies: 9,083 WBS rows (3,237 parents, 5,846 editable leaves, 11 floor roots, no GR&P); handler assignments Sitha 1,126, Lychhinh 780, Chhorvaon 357, Srun 357, Kheng 390, Tola 2,836 (every leaf assigned once); child relative weights sum to 1 under every parent; global = relative × parent global; leaf global weights total 1.0; BOQ total USD 4,985,118.99; every parent progress matches the weighted children; starting overall progress 81.4587% matches the workbook's TOTAL row. BP02 weights are BOQ/unit-rate based (Weights sheet), not duration based, so the duration-share check used for BP03/BP04 is skipped. Floor / Work area / Trade breakdowns use floor / room-type group / activity.

## Plan source

Contract dates and the planned S-curve come only from `G:/Shared drives/PROJECT DEPARTMENT/NBC - External Weekly Report/20. 18 October to 24 October/BP-02/2. & 5. BP-02 Weekly 58 - 18 Oct - 24 Oct 2026.xlsx`: `PI(p)!B28/D28` give 1 Sep 2025 – 20 Jun 2026, and `SC(p)!B52:BF52` / `B55:BF55` give 57 projected cumulative points (real 2025–2026 dates, no year alignment). A 0% anchor is added on the commencement date. No activities, actual progress or history were taken from that report. The BOQ workbook has no confirmations for its reporting week (Weekly 59), so no history or summaries are created.

## Changes for BP02

- Export accepts `1.8.x` WBS keys, ignores the extra Notes/Weights/Schedule Import sheets, and reads cross-sheet weight cells (Weights sheet) from their saved values while still comparing every weight with the project.
- BP02 has its own plan (`BP02_PLAN`); plan display tolerates a project without one.
- Very large local workspaces exceed browser localStorage; saves now fall back to the IndexedDB snapshot (and a cache without activities when signed in) instead of failing.

## Remaining setup

1. Database (not yet applied — needs a `supabase login`/access token or database URL, which this environment lacks): back up, then run the guarded `.private/nbc-bp02/initialize.sql` with `owner_id` set to the existing company storage owner (`select distinct user_id from kw_projects where data->>'nbcBp03'='true'`). It inserts the project, 9,083 activities and the source template, and never overwrites existing rows. No migration is needed (`20261030090000_nbc_multiple_projects` is already live).
2. Push to main so the frontend (plan, export, storage fallback) deploys.
3. Verify BP03/BP04 rows compare unchanged before/after, as in the BP04 release.

## Verification

Unit tests (`src/nbc/projects.test.ts`, private BP02 test) reconcile all 9,083 nodes, weights, BOQ total and export total after an edit. `e2e/nbc-bp02.spec.ts` (Chromium) covers draft autosave, refresh persistence, confirmation, weighted summary, BP03 isolation and the BP02 Excel download. Typecheck, lint, all unit tests and existing NBC e2e pass. Not run: the disposable PostgreSQL check, WebKit, and any live database/browser acceptance.
