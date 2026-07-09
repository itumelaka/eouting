# Architecture

Current stable version: **v1.6.7**

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

Frontend responsibilities:

- role selection and login screens
- Pelajar request form
- Warden approval screen
- Guard keluar/masuk screen
- Pemantauan Semasa
- Statistik
- CSV export controls
- PWA/service worker cache

## Backend

Main backend file:

- `gas/Code.gs`

Backend responsibilities:

- login validation
- submit request
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

## Frontend Visibility Rules

Request type form fields are controlled by a central request type UI handler.

Footer utility buttons are visible only on the Warden screen:

- `Muat Turun Laporan Hari Ini`
- `Muat Turun Laporan Bulanan`
- `Muat Semula Sistem`
- `Apa yang baharu v1.x.x`

They are hidden on landing, Pelajar, Guard, Pemantauan Semasa, and Statistik.
