# Changelog

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
