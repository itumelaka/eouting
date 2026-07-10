# Changelog

## v1.6.12

- Added loading state to Pemantauan Semasa while monitoring records are being fetched.
- Added friendly monitoring error handling that keeps old data visible when refresh fails.
- Made `Sedang Keluar` summary card more prominent when active records exist.
- Added subtle live status animations with `prefers-reduced-motion` support.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.11

- Added status icons to copied Warden name lists:
  - `MENUNGGU_KELULUSAN` = 🟡
  - `DILULUSKAN_WARDEN` = 🟢
  - `KELUAR` = 🚶
  - `SELESAI` = ✅
- Added legend under copied name lists.
- Included `SELESAI` records in copied lists while excluding `DITOLAK_WARDEN`.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.10

- Added `Copy Senarai Nama` button to Warden Checklist Permohonan.
- Added checklist type filters:
  - Semua
  - Outing
  - Bermalam
  - Cuti Semester
  - Kecemasan
- Clipboard output copies names only, with numbering and request-type heading.
- Added clipboard fallback using temporary textarea and `document.execCommand("copy")`.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.9

- Expanded Warden Checklist from Cuti Semester only to all request types.
- Added request type badges and status badges to checklist rows.
- Added request type and status summaries to the checklist.
- Kept pending-row focus behavior for existing approve/reject cards.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.8

- Improved Guard `Refresh Status` visibility before `Sedia Untuk Keluar`.
- Improved Warden Cuti Semester checklist status coverage before it was expanded to all request types.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.7

- Added Guard dashboard `Refresh Status` control.
- Added Guard auto-refresh while Guard session is active.
- Bumped PWA cache and asset query strings to force clients toward the latest frontend.
- Added `version.json` for release visibility.
- Hardened backend validation for staff PIN and active request prevention.

## v1.6.6

- Footer utility/report buttons are now visible only on the Warden screen.
- Landing page, Pelajar, Guard, Pemantauan Semasa, and Statistik no longer show bottom utility/report buttons.
- Utility/report functions remain available when shown to Warden.

## v1.6.5

- Fixed Cuti Semester return time display on record cards.
- `masa_balik_dijangka` values returned as time-only Date/ISO values now display as clean `HH:mm`.
- `tarikh_balik` remains displayed as `dd/MM/yyyy`.

## v1.6.4

- Added central request type form handling for:
  - Outing Biasa
  - Kecemasan
  - Pulang Bermalam
  - Cuti Semester
- Legacy field update functions now route through the central handler.

## v1.6.3

- Fixed Cuti Semester field visibility on the Pelajar form.
- Required Cuti Semester fields are shown and fillable:
  - Tarikh Keluar / Tarikh Mula Cuti
  - Tarikh Pulang Ke Asrama
  - Masa Dijangka Pulang Ke Asrama
  - Telefon Waris
  - Hubungan Waris

## v1.6.0 - v1.6.2

- Added Cuti Semester request type.
- Cuti Semester uses existing `OUTING_REQUESTS` columns without spreadsheet header changes.
- Improved student refresh and active page refresh behavior.
- Warden can see future-dated active Cuti Semester records after backend filtering update.
