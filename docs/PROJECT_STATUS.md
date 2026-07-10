# Project Status

Project: **eOuting ITU / eOuting SKM OLP**

Current version: **Live/pilot stable v1.6.16**

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
- Empty staff PIN is rejected by backend validation.
- Backend duplicate active request prevention is implemented.
- Student, Warden, and Guard login flows are available.
- Request flows are available for `OUTING_BIASA`, `KECEMASAN`, `PULANG_BERMALAM`, and `CUTI_SEMESTER`.
- Warden approve/reject flow is active.
- Guard confirm keluar/masuk flow is active.
- Guard dashboard has `Refresh Status` and auto-refresh behavior.
- Warden Dashboard has `Refresh Permohonan` and auto-refresh every 60 seconds.
- Warden utility actions are available near the dashboard:
  - Muat Turun Laporan Hari Ini
  - Muat Turun Laporan Bulanan
  - Apa yang baharu
  - Muat Semula Aplikasi as a smaller/subtle action
- Warden Checklist Permohonan covers all request types and includes filters.
- Warden can copy active/current name lists for WhatsApp with status icons and legend.
- Pemantauan Semasa is read-only and has loading state, refresh, summary cards, Senarai Nama Semasa, and live animation.
- Cuti Semester return time display is fixed and no longer shows raw ISO/1899 time values.
- Stale PIN error toast after successful staff login was fixed in v1.6.16.
- Empty yellow notice/banner is hidden when no message exists.
- No spreadsheet header changes were needed for Cuti Semester.
- PWA version/cache update strategy is active through `APP_VERSION`, asset query strings, `version.json`, and service worker cache name.

## Roles

- **Pelajar:** request submission and personal record/status view.
- **Warden:** approval/rejection, Checklist Permohonan, copy name list, report downloads, refresh permohonan, and utility controls.
- **Guard:** confirm keluar/masuk and refresh status.
- **Pemantauan Semasa:** read-only operational monitoring.
- **Statistik:** monthly reporting view.

## Request Types

- `OUTING_BIASA` - Outing Biasa
- `KECEMASAN` - Kecemasan
- `PULANG_BERMALAM` - Pulang Bermalam
- `CUTI_SEMESTER` - Cuti Semester

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
- Warden Checklist Permohonan covers all request types and includes compact status/type badges.
- Copy Senarai Nama outputs a WhatsApp-ready list with status icons and a legend.
- Guard page can manually refresh status and auto-refreshes while active.
- Warden page can manually refresh request data and auto-refreshes every 60 seconds while active.
- Pemantauan Semasa has a clear loading state and highlights active `Sedang Keluar` / late records.
- Pemantauan Semasa has a read-only Senarai Nama Semasa with animated status icons.
- Footer bottom keeps the version text; Warden utility actions are moved near the Warden dashboard.

## Known Future Work

- Google login / stronger auth.
- Domain-restricted staff access.
- Hashed PIN storage.
- Backend-issued session token.
- Audit log retention policy.
- QR code.
- Upload selfie to Google Drive.
- Admin page for master data.
- Telegram deep links / inline links.
- Late-return escalation.
- Daily WhatsApp summary/report.
- Daily/weekly/monthly report automation.
- Automated version injection/build step.
- Supabase migration as future-only.
