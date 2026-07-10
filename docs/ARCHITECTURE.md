# Architecture

Current version: **v1.6.12**

## Overview

eOuting ITU is a static frontend with a Google Apps Script backend and Google Sheets storage.

```text
GitHub Pages frontend
  -> Google Apps Script Web App
    -> Google Sheets
    -> Telegram Bot notifications
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
- Warden Checklist Permohonan
- Warden Copy Senarai Nama
- Guard keluar/masuk screen
- Guard Refresh Status
- Pemantauan Semasa
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

## Cuti Semester Data Mapping

- `jenis_permohonan = CUTI_SEMESTER`
- `tarikh = Tarikh Keluar / Tarikh Mula Cuti`
- `hari = Hari Keluar`
- `tujuan = Tujuan Cuti Semester`
- `lokasi = Alamat / Destinasi Semasa Cuti`
- `telefon_waris`
- `hubungan_waris`
- `jenis_kenderaan`
- `butiran_kenderaan`
- `tarikh_balik = Tarikh Pulang Ke Asrama`
- `hari_balik = Hari Pulang Ke Asrama`
- `masa_balik_dijangka = Masa Dijangka Pulang Ke Asrama`
- `masa_keluar`
- `masa_masuk`
- `lewat`
- `catatan`

## Active Record Visibility

`getTodayRecords()` returns records that are relevant for current operations:

- today activity
- active statuses:
  - `MENUNGGU_KELULUSAN`
  - `DILULUSKAN_WARDEN`
  - `KELUAR`
- open `PULANG_BERMALAM` / `CUTI_SEMESTER` records

This keeps future-dated active Cuti Semester requests visible to Warden, Guard, and Pemantauan.

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

## Pemantauan Semasa

Pemantauan Semasa is a read-only operational page.

It includes:

- loading state: `Memuatkan rekod pemantauan...`
- manual refresh
- timestamp
- summary cards
- record list
- active `Sedang Keluar` emphasis
- subtle live animation for active/late states
- `prefers-reduced-motion` support

If refresh fails after old data is already visible, the old view is kept and a friendly error is shown.

## Frontend Visibility Rules

Request type form fields are controlled by a central request type UI handler.

Footer utility buttons are visible only on the Warden screen:

- `Muat Turun Laporan Hari Ini`
- `Muat Turun Laporan Bulanan`
- `Muat Semula Sistem`
- `Apa yang baharu v1.x.x`

They are hidden on landing, Pelajar, Guard, Pemantauan Semasa, and Statistik.

## PWA / Versioning Strategy

Frontend releases are versioned in several places:

- `APP_VERSION` in `assets/app.js`
- asset query strings in `index.html`
- visible footer version in `index.html`
- cache name in `service-worker.js`
- cached asset URLs in `service-worker.js`
- `version.json`

The service worker uses a versioned cache name and removes older caches during activation.
