# Project Status

Project: **eOuting ITU / eOuting SKM OLP**

Current version: **Live/pilot v1.6.12**

Live site:

```text
https://itumelaka.github.io/eouting/
```

Repo:

```text
https://github.com/itumelaka/eouting
```

## Confirmed Status

- GitHub Pages frontend is live.
- Google Apps Script backend is deployed and connected to Google Sheets.
- Live Mode: Google Sheets is active.
- Telegram notifications are implemented for core request/status events.
- Backend staff PIN validation is hardened for Warden and Guard actions.
- Backend duplicate active request prevention is implemented.
- Student Cuti Semester submission works.
- Warden can see Cuti Semester pending requests even when `tarikh keluar` is future-dated.
- Guard can process approved Cuti Semester records.
- Guard dashboard has `Refresh Status` and auto-refresh behavior.
- Warden has Checklist Permohonan for all request types.
- Warden can copy active name lists for WhatsApp with status icons and legend.
- Pemantauan Semasa has loading state, refresh, active summaries, and live status animation.
- Cuti Semester return time display is fixed and no longer shows raw ISO/1899 time values.
- Footer utility/report buttons are visible only on Warden screen.
- No spreadsheet header changes were needed for Cuti Semester.
- PWA version/cache update strategy is active through `APP_VERSION`, asset query strings, `version.json`, and service worker cache name.

## Roles

- **Pelajar:** request submission and personal record/status view.
- **Warden:** approval/rejection, Checklist Permohonan, copy name list, report downloads, and utility refresh controls.
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
- Warden Checklist Permohonan covers all request types and includes compact status/type badges.
- Copy Senarai Nama outputs a short WhatsApp-ready list with status icons.
- Guard page can manually refresh status and auto-refreshes while active.
- Pemantauan Semasa has a clear loading state and highlights active `Sedang Keluar` / late records.
- Footer utility buttons are hidden outside Warden screen.

## Known Future Work

- Google login / stronger auth.
- Domain-restricted staff access.
- Hashed PIN storage.
- Backend-issued session token.
- QR code.
- Upload selfie to Google Drive.
- Admin page for master data.
- Telegram deep links / inline links.
- Late-return escalation.
- Daily WhatsApp summary/report.
- Report automation.
