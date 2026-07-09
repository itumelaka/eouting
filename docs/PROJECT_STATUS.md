# Project Status

Project: **eOuting ITU / eOuting SKM OLP**

Current stable version: **v1.6.7**

Live site:

```text
https://itumelaka.github.io/eouting/
```

Repo:

```text
https://github.com/itumelaka/eouting
```

## Confirmed Live Status

- GitHub Pages frontend is working at `v1.6.7`.
- Google Apps Script backend is deployed and connected to Google Sheets.
- Live Mode: Google Sheets is active.
- Telegram notifications are working.
- Student Cuti Semester submission works.
- Warden can see Cuti Semester pending requests even when `tarikh keluar` is future-dated.
- Cuti Semester return time display is fixed and no longer shows raw ISO/1899 time values.
- Footer utility/report buttons are visible only on Warden screen.
- No spreadsheet header changes were needed for Cuti Semester.

## Roles

- **Pelajar:** request submission and personal record/status view.
- **Warden:** approval/rejection, report downloads, and utility refresh controls.
- **Guard:** confirm keluar/masuk.
- **Pemantauan Semasa:** read-only operational monitoring.
- **Statistik:** monthly reporting view.

## Request Types

- `OUTING_BIASA` - Outing Biasa
- `KECEMASAN` - Kecemasan
- `PULANG_BERMALAM` - Pulang Bermalam
- `CUTI_SEMESTER` - Cuti Semester

## Cuti Semester Notes

Cuti Semester reuses existing `OUTING_REQUESTS` columns:

- `jenis_permohonan = CUTI_SEMESTER`
- `tarikh = Tarikh Keluar / Tarikh Mula Cuti`
- `tarikh_balik = Tarikh Pulang Ke Asrama`
- `masa_balik_dijangka = Masa Dijangka Pulang Ke Asrama`
- `telefon_waris` and `hubungan_waris` are required.

Active Cuti Semester records remain visible to Warden, Guard, and Pemantauan until completed.

## Backend Notes

`getTodayRecords()` returns:

- records with today activity
- active records regardless of `tarikh`:
  - `MENUNGGU_KELULUSAN`
  - `DILULUSKAN_WARDEN`
  - `KELUAR`
- `PULANG_BERMALAM` / `CUTI_SEMESTER` records that are not completed

Completed/rejected records are kept out of old history floods unless they relate to today activity.

## Frontend Notes

- Request type fields are controlled by one central UI handler.
- Cuti Semester fields display correctly.
- Cuti Semester return time formatting is clean (`HH:mm`).
- Footer utility buttons are hidden outside Warden screen.
