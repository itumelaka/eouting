# TODO eOuting ITU

Senarai kerja selepas milestone **Live/pilot v1.6.12**.

## Done / Completed

- [x] GitHub Pages frontend live.
- [x] Google Apps Script backend deployed.
- [x] Google Sheets live backend connection.
- [x] Live Mode: Google Sheets active.
- [x] Pelajar login using name + `no_matrik`.
- [x] Warden/Guard PIN login.
- [x] Backend staff PIN hardening for Warden/Guard actions.
- [x] Backend duplicate active request prevention.
- [x] Outing Biasa request flow.
- [x] Kecemasan request flow.
- [x] Pulang Bermalam request flow.
- [x] Cuti Semester request flow.
- [x] Cuti Semester uses existing `OUTING_REQUESTS` columns.
- [x] Warden can see active/future-dated pending Cuti Semester records.
- [x] Guard can process approved Cuti Semester records.
- [x] Guard `Refresh Status` control and Guard auto-refresh.
- [x] Pemantauan keeps active records visible until selesai.
- [x] Pemantauan Semasa loading state and live status animation.
- [x] Warden Checklist Permohonan for all request types.
- [x] Copy Senarai Nama aktif for WhatsApp.
- [x] Status icon and legend in copied Warden name list.
- [x] Telegram notifications basic flow.
- [x] Audit log uses existing `AUDIT_LOG` headers.
- [x] CSV export for reports.
- [x] Statistik monthly view.
- [x] Footer utility/report buttons visible only on Warden screen.
- [x] Cuti Semester return time display fixed.
- [x] Student refresh remains on student page.
- [x] Warden/Guard/Pemantauan/Statistik refresh behavior restored.
- [x] PWA version/cache update strategy using `APP_VERSION`, asset query strings, `version.json`, and service worker cache name.

## Operations Checklist

- [ ] Continue live monitoring after v1.6.12.
- [ ] Verify Cuti Semester approval and guard flow in real operation.
- [ ] Verify Pemantauan Semasa active records during Cuti Semester.
- [ ] Verify CSV reports after more Cuti Semester records.
- [ ] Confirm Telegram group membership for operations.
- [ ] Clean test data before official reporting if needed.
- [ ] Assign/rotate unique PINs for Warden/Guard when needed.
- [ ] Prepare user guide for Pelajar.
- [ ] Prepare SOP for Warden/Guard/HEP.
- [ ] Backup spreadsheet/template regularly.
- [ ] Confirm who can access Spreadsheet and Apps Script.

## Near TODO

- [ ] Telegram inline button/link to open Warden/Guard/Pemantauan page.
- [ ] Dedicated `Kemas Kini Aplikasi` button separate from `Muat Semula Sistem`.
- [ ] Optional `request_id` deep link/highlight later.
- [ ] Daily WhatsApp summary/report.

## Security / Access Improvements

- [ ] Consider Google login / stronger auth.
- [ ] Consider domain-restricted access for staff.
- [ ] Hash PIN instead of storing plain text.
- [ ] Add backend-issued session token if stronger API session control is required.
- [ ] Review audit log format and retention.
- [ ] Review GAS Web App deployment permission.
- [ ] Decide SOP for changing Warden/Guard PIN.
- [ ] Review role-based access hardening.
- [ ] Restrict Statistik/Pemantauan to Warden/HEP if required.

## Future Enhancements

- [ ] QR code.
- [ ] Upload selfie to Google Drive.
- [ ] Admin page for managing master data.
- [ ] Late-return escalation notification.
- [ ] Optional WhatsApp notification later if required.
- [ ] Weekly/monthly report automation.
- [ ] Automated version injection/build step.
- [ ] Supabase migration can remain future TODO only; not a current requirement.
