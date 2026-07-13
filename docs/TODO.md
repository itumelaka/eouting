# TODO eOuting ITU

Senarai kerja selepas milestone live **v1.6.25**.

## Done / Completed

### Core System

- [x] GitHub Pages frontend dan PWA live.
- [x] Google Apps Script backend dideploy dan disambungkan ke Google Sheets.
- [x] Pelajar, Warden dan Guard login.
- [x] Flow `OUTING_BIASA`, `KECEMASAN`, `PULANG_BERMALAM` dan `CUTI_SEMESTER`.
- [x] Backend duplicate active request prevention.
- [x] Warden approve/reject dan Guard confirm keluar/masuk.
- [x] Telegram notification basic flow dan `AUDIT_LOG`.
- [x] Warden Dashboard refresh, Checklist Permohonan dan Copy Senarai Nama.
- [x] Guard refresh dan auto-refresh.
- [x] Statistik aggregated counts dan CSV report controls.
- [x] PWA version/cache update strategy dan update popup.

### Privacy dan Authenticated Records

- [x] Student list privacy hardening.
- [x] Public `getStudents` minimum kepada `student_id`, `nama`, `kelas`.
- [x] Authenticated operational records untuk Pelajar, Warden dan Guard.
- [x] Tiada fallback authenticated POST kepada public GET.
- [x] Public Monitoring data minimisation kepada enam field.
- [x] Statistik individu/leaderboard sensitif dibuang.
- [x] API/GAS dikecualikan daripada Cache Storage dan cache lama dibersihkan.
- [x] Staff runtime credential restoration selepas fresh login.

### Status dan Guard UX

- [x] Warden emoji status menggantikan indikator kotak lama.
- [x] Contextual status labels melalui helper pusat.
- [x] `Sedang Bercuti`, `Sedang Bermalam` dan `Sedang Keluar` tanpa mengubah status backend.
- [x] Guard filter cleanup kepada filter yang relevan sahaja.
- [x] Guard `Kecemasan` filter yang berasingan daripada Outing Harian.
- [x] Contextual empty-state bagi kedua-dua seksyen Guard.

### Public Monitoring v1.6.25

- [x] Public name display dengan restricted response fields.
- [x] Public Monitoring one-click loading.
- [x] Scroll reset ke permulaan `monitorWorkspace`.
- [x] Dedicated public GET loader.
- [x] Single-flight guard untuk klik, refresh dan auto-refresh.
- [x] Duplicate render removal; satu response dirender sekali.
- [x] Timestamp hanya berubah selepas fetch berjaya.
- [x] Cached data dikekalkan selepas refresh gagal.
- [x] Compact Public Monitoring layout.
- [x] `Rekod Hari Ini`, quick filter monitor dan seksyen `Belum Pulang Ke Asrama` pendua dibuang.
- [x] `Senarai Status Semasa` memaparkan nama, kelas, jenis, ikon dan label kontekstual.

## Operations Checklist

- [ ] Continue live monitoring after v1.6.25.
- [ ] Verify Cuti Semester approval and Guard flow in real operation.
- [ ] Verify Public Monitoring during active Cuti Semester/Pulang Bermalam records.
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
- [ ] Dedicated `Kemas Kini Aplikasi` button separate from `Muat Semula Aplikasi`, if still required.
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
- [ ] Daily/weekly/monthly report automation.
- [ ] Automated version injection/build step.
- [ ] Supabase migration can remain future TODO only; not a current requirement.
