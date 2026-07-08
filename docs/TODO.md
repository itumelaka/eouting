# TODO eOuting ITU

Senarai kerja selepas milestone **Pilot-ready Live V1.2**.

## Done / Completed

- [x] Initial documentation.
- [x] Mock role-based frontend.
- [x] Pelajar login name + `no_matrik`.
- [x] Warden select name mock access.
- [x] Guard select name mock access.
- [x] Outing Biasa / Kecemasan frontend flow.
- [x] Emergency request fields.
- [x] Vehicle fields.
- [x] Warden approve/reject mock flow.
- [x] Guard confirm keluar/masuk mock flow.
- [x] Dashboard summary including Belum Masuk and Kecemasan.
- [x] Branded header.
- [x] Basic PWA setup.
- [x] GitHub Pages live at `https://itumelaka.github.io/eouting`.
- [x] Main database schema prepared.
- [x] Google Spreadsheet database prepared.
- [x] Apps Script project prepared.
- [x] GAS backend V1.
- [x] Google Sheets live backend connection.
- [x] Student live status / `Rekod Saya`.
- [x] Duplicate active request blocking.
- [x] Warden/Guard PIN login.
- [x] Backend PIN validation for Warden/Guard actions.
- [x] Pemantauan Semasa read-only page.
- [x] Date/time BM friendly formatting.
- [x] Phone display formatting.
- [x] 3D clay role navigation.
- [x] 3D clay popup/toast feedback.
- [x] Basic audit log in `AUDIT_LOG`.
- [x] `clasp` workflow configured.
- [x] Telegram Bot notification V1.2.
- [x] Telegram Script Properties config.
- [x] Telegram alerts for new outing request.
- [x] Telegram alerts for new emergency request.
- [x] Telegram alerts for warden approval/rejection.
- [x] Telegram alerts for guard confirm keluar/masuk.
- [x] Telegram late-return alert if applicable.
- [x] `Rekod Aktif` / `Sejarah Hari Ini`.
- [x] Compact history records.
- [x] Completed/rejected records do not block new request.
- [x] False `Paparan Rekod` popup fix.
- [x] Normal outing availability check fix.
- [x] PWA cache/update behaviour improved.
- [x] Manual `Muat Semula Sistem` helper.
- [x] Visible app version footer.
- [x] Live V1.2 pilot-ready milestone.

## Pilot Checklist

- [ ] Test with real students during actual outing.
- [ ] Verify Telegram alerts in real operation.
- [ ] Check warden response flow during live outing.
- [ ] Check guard keluar/masuk flow at pos guard.
- [ ] Confirm `Rekod Aktif` updates clearly for students.
- [ ] Confirm `Sejarah Hari Ini` keeps completed/rejected records compact.
- [ ] Test inactive student login/request block.
- [ ] Test duplicate active request cases.
- [ ] Test Kecemasan outside normal outing window.
- [ ] Test late / belum masuk cases.
- [ ] Clean test data before official use.
- [ ] Assign unique PINs to Warden/Guard.
- [ ] Prepare Canva/manual guide for Pelajar.
- [ ] Prepare Canva/manual guide for Warden/Guard.
- [ ] Prepare SOP for HEP/warden/guard.
- [ ] Confirm Telegram group membership for operations.
- [ ] Backup spreadsheet/template.
- [ ] Confirm who can access Spreadsheet and Apps Script.

## Security / Access Improvements

- [ ] Consider Google login / stronger auth.
- [ ] Consider domain-restricted access for staff.
- [ ] Hash PIN instead of storing plain text.
- [ ] Review audit log format and retention.
- [ ] Review GAS Web App deployment permission.
- [ ] Decide SOP for changing Warden/Guard PIN.
- [ ] Review role-based access hardening.

## Optional Future Enhancements

- [ ] Automated version injection/build step.
- [ ] Daily report/export.
- [ ] Late-return escalation notification.
- [ ] Optional WhatsApp notification later if required.
- [ ] QR code outing pass.
- [ ] Upload selfie to Google Drive.
- [ ] Weekly/monthly report.
- [ ] Export CSV/PDF.
- [ ] Admin page for managing master data.
