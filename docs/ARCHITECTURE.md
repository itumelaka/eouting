# Architecture

Current version: **v1.6.16**

## Overview

eOuting ITU is a static GitHub Pages frontend with a Google Apps Script backend and Google Sheets storage.

```text
GitHub Pages static frontend
  -> Google Apps Script Web App
    -> Google Sheets
    -> Telegram Bot notifications
    -> AUDIT_LOG
```

## Frontend

Main frontend files:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `service-worker.js`
- `version.json`

Frontend responsibilities:

- role selection and login screens
- Pelajar request form
- Warden approval screen
- Warden Dashboard refresh and utility actions
- Warden Checklist Permohonan
- Warden Copy Senarai Nama
- Guard keluar/masuk screen
- Guard Refresh Status
- Pemantauan Semasa live board
- Statistik
- CSV export controls
- PWA/service worker cache

## Backend

Main backend file:

- `gas/Code.gs`

Backend responsibilities:

- login validation
- staff PIN validation
- submit request
- duplicate active request prevention
- approve/reject request
- confirm keluar/masuk
- get active/today records
- get statistics
- audit log append
- Telegram notification send

Telegram failure is non-blocking for the main action.

## Data Sheets

Sheets used:

- `STUDENTS`
- `WARDENS`
- `GUARDS`
- `OUTING_REQUESTS`
- `AUDIT_LOG`

Cuti Semester did not require new spreadsheet columns.

## Roles

- **Pelajar:** submit request and view personal records.
- **Warden:** approve/reject, refresh requests, use checklist, copy name list, download reports, and view update notes.
- **Guard:** confirm keluar/masuk and refresh status.
- **Pemantauan Semasa:** read-only live monitoring.
- **Statistik:** read-only monthly statistics.

## Request Types

- `OUTING_BIASA`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

## Status Lifecycle

Backend status values:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `KELUAR`
- `SELESAI`

Frontend display labels map those backend statuses into user-facing Malay labels.

## Active Record Visibility

`getTodayRecords()` returns records that are relevant for current operations:

- today activity
- active statuses:
  - `MENUNGGU_KELULUSAN`
  - `DILULUSKAN_WARDEN`
  - `KELUAR`
- open `PULANG_BERMALAM` / `CUTI_SEMESTER` records

This keeps future-dated active Cuti Semester requests visible to Warden, Guard, and Pemantauan.

## Warden Dashboard

Warden Dashboard includes:

- `Refresh Permohonan`
- loading state for Warden request data
- updated timestamp
- auto-refresh every 60 seconds while Warden session is active
- Warden utility actions near the dashboard:
  - Muat Turun Laporan Hari Ini
  - Muat Turun Laporan Bulanan
  - Apa yang baharu
  - Muat Semula Aplikasi as a smaller/subtle action

The Warden refresh path reloads `getTodayRecords()` data only. It does not reload the PWA/app shell.

## Warden Checklist Permohonan

The Warden screen includes a compact Checklist Permohonan built from frontend records returned by the live backend.

Checklist behavior:

- shows all request types:
  - `OUTING_BIASA`
  - `KECEMASAN`
  - `PULANG_BERMALAM`
  - `CUTI_SEMESTER`
- supports type filters:
  - Semua
  - Outing
  - Bermalam
  - Cuti Semester
  - Kecemasan
- displays student name, class, relevant date/time, request type badge, and status badge
- pending rows can focus the existing approve/reject detail card
- non-pending rows are read-only

The checklist does not create new spreadsheet data and does not change approve/reject flow.

## Copy Senarai Nama

The Warden checklist includes `Copy Senarai Nama` for WhatsApp-ready name lists.

Clipboard behavior:

- copies text only
- does not send WhatsApp automatically
- does not update Google Sheets
- uses `navigator.clipboard.writeText`
- falls back to temporary textarea + `document.execCommand("copy")`

Included statuses:

- `MENUNGGU_KELULUSAN` = 🟡
- `DILULUSKAN_WARDEN` = 🟢
- `KELUAR` = 🚶
- `SELESAI` = ✅

Excluded status:

- `DITOLAK_WARDEN`

The copied text contains a short heading, numbered names with status icons, and a legend.

## Guard Page

Guard page includes:

- `Refresh Status`
- auto-refresh while Guard session is active
- `Sedia Untuk Keluar` list for approved requests
- `Sedang Keluar` list for records already confirmed out
- confirm keluar and confirm masuk actions

Guard actions still require backend PIN validation.

## Pemantauan Semasa

Pemantauan Semasa is a read-only operational page.

It includes:

- loading state: `Memuatkan rekod pemantauan...`
- manual refresh
- timestamp
- summary cards
- detail record list
- `Senarai Nama Semasa` with animated status icons
- active `Sedang Keluar` emphasis
- subtle live animation for active/late states
- `prefers-reduced-motion` support

If refresh fails after old data is already visible, the old view is kept and a friendly error is shown.

## PWA / Versioning Strategy

Frontend releases are versioned in several places:

- `APP_VERSION` in `assets/app.js`
- asset query strings in `index.html`
- visible footer version in `index.html`
- cache name in `service-worker.js`
- cached asset URLs in `service-worker.js`
- `version.json`

The service worker uses a versioned cache name and removes older caches during activation.

## Security Boundaries

Frontend role hiding is not real security. Backend validation remains the enforcement point for:

- staff PIN validation
- action permission
- duplicate active request prevention
- request status lifecycle checks

Future security improvements remain tracked in `docs/TODO.md` and `docs/SECURITY.md`.
