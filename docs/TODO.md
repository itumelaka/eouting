# TODO eOuting ITU

Senarai kerja pembangunan sistem eOuting ITU selepas milestone **Live V1 proof-of-concept**.

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

## Next Before Pilot

- [ ] Test more student names and edge cases.
- [ ] Test inactive student login/request block.
- [ ] Test duplicate active request cases.
- [ ] Test Outing Biasa Selasa/Rabu selepas 5:00 PM rule.
- [ ] Test Kecemasan outside normal outing window.
- [ ] Test late / belum masuk cases.
- [ ] Clean test data before pilot.
- [ ] Assign unique PINs to Warden/Guard.
- [ ] Prepare simple user guide for Warden/Guard.
- [ ] Prepare simple user guide for Pelajar.
- [ ] Decide production SOP for emergency outings.
- [ ] Backup spreadsheet/template.
- [ ] Confirm who can access Spreadsheet and Apps Script.

## Security / Access Improvements

- [ ] Consider Google login / stronger auth.
- [ ] Consider domain-restricted access for staff.
- [ ] Hash PIN instead of storing plain text.
- [ ] Review audit log format and retention.
- [ ] Review GAS Web App deployment permission.
- [ ] Decide SOP for changing Warden/Guard PIN.

## Optional Future Enhancements

- [ ] Optional notification later if required.
- [ ] QR code outing pass.
- [ ] Upload selfie to Google Drive.
- [ ] Telegram/WhatsApp alert for late or not returned cases.
- [ ] Weekly/monthly report.
- [ ] Export CSV/PDF.
- [ ] Admin page for managing master data.
