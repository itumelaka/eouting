# Admin Student Movement Trace V1

Status: **LIVE in production - 4 November 2026**

This is a production enhancement to **eOuting v2.4.0**. Production authority remains **Google Apps Script + Google Sheets**. The V3 Worker/D1 work remains staging-only and has **not** cut over.

## Production state

- Frontend: GitHub Pages from `itumelaka/eouting` main.
- Production frontend checkpoint: `73529993c03e5abe3b26a40f5128680938cabbd5` (`fix: simplify movement trace controls and print header`).
- Production GAS Web App deployment ID remains unchanged:
  `AKfycbzPkL1HvQG0XnEyjwfXdtZ05luKIsrkKKjmvO9miH5TLS3NwWywxRIYNZqnPBNkH7LGDg`.
- GAS source was pushed from canonical `gas/Code.gs` and the existing production Web App deployment was updated to **Version 8** on 4 November 2026 at 10:55 MYT.
- No product version bump: frontend remains **v2.4.0**.
- No D1, lifecycle, permission, schema or migration changes were introduced.

## Admin report flow

Admin opens **Jejak Pergerakan Pelajar**, then selects Pelajar, Tarikh mula, Tarikh akhir and `Jana Jejak`.

The student selector uses the existing authenticated `getAdminStudents()` collection. The temporary search field was removed after owner review; the full dropdown remains.

The report contains student identity, date range, generated timestamp, movement count, completed outing count, total valid duration, and movement rows with date, outing type, purpose/location, exit time, return time, duration and status.

The report is **read-only** and does not mutate outing lifecycle state.

## API contract

POST action: `getAdminStudentMovementTrace`

Inputs:
- existing Admin credentials
- `student_id`
- `start_date`
- `end_date`

Dates use strict `YYYY-MM-DD`, inclusive range, with a maximum of 366 calendar days. Student must exist in the master student data.

All statuses are included. Invalid or missing exit/return timestamp pairs return no duration and are excluded from total duration. Valid duration is the complete recorded outing duration and is **not clipped** to the selected report period.

## Interpretation rule

Required wording when no movement record exists:

> Tiada rekod pergerakan keluar direkodkan dalam eOuting bagi tempoh ini.

Required disclaimer:

> Laporan ini berdasarkan rekod pergerakan yang direkodkan dalam sistem eOuting sahaja.

Absence of an eOuting record is **not evidence that a student was physically present on campus**.

## Print / PDF

Printing is browser-side only; no server PDF generation and no Drive API permission were added.

Current implementation:
- creates a **standalone print document/window**
- prints only the movement report
- waits for document, image and font readiness before calling print
- does not fall back to printing the full application
- uses A4 landscape with 8mm margins
- uses one compact centred official `assets/eouting-header-logo.png`
- uses compact Malaysia date/time formatting
- repeats table headers for multi-page reports
- supports short one-page reports and long multi-page reports

Verified browser PDF behaviour:
- 3 records -> **1 page**
- 80 records -> **4 pages**

Owner visual review on 4 November 2026 confirmed the report layout is satisfactory. The duplicated large application header was removed; only one compact official eOuting header remains in the printable report.

## Validation checkpoints

- Initial implementation - `4a17c159c0856108c56b089784fcd415ab5ab8ac`: targeted 6/6, full Node 970/970.
- Print/search polish - `288d9e55b7f9146291d0126703326ecb0fa9c633`: targeted 9/9, full Node 973/973.
- iOS print isolation - `0e0f84d03809c924634d043991ef18188a951770`: targeted 13/13, full Node 977/977.
- Final selector/header simplification - `73529993c03e5abe3b26a40f5128680938cabbd5`: targeted 13/13, full Node 977/977, syntax and `git diff --check` PASS.

## Architecture boundary

Master Records pagination/text search and completed-only monthly statistics do not supply this report directly. The dedicated Admin report endpoint reuses existing Admin authentication, date and duration helpers without adding public access.

D1 parity for this report is a future requirement only if/when a production cutover is reconsidered. No D1 production cutover was performed as part of this feature.
