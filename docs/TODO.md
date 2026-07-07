# TODO eOuting ITU

Senarai kerja pembangunan sistem eOuting ITU.

## Phase 1: Dokumentasi dan struktur awal

- [x] Tetapkan nama sistem.
- [x] Tetapkan flow manual semasa.
- [x] Tetapkan flow digital cadangan.
- [x] Tetapkan role pelajar, warden dan guard.
- [x] Tetapkan struktur database Google Sheets.
- [ ] Sediakan Google Spreadsheet database.
- [ ] Sediakan Google Apps Script project.
- [ ] Clone repo ke laptop untuk local development.

## Phase 2: Frontend GitHub Pages

- [ ] Bina `index.html` asas.
- [ ] Bina paparan pelajar untuk mohon outing.
- [ ] Bina paparan status permohonan.
- [ ] Bina dashboard warden.
- [ ] Bina dashboard guard.
- [ ] Tambah responsive mobile layout.
- [ ] Tambah loading state dan error message.

## Phase 3: Backend Google Apps Script

- [ ] Setup `doGet` dan `doPost`.
- [ ] Bina helper baca/tulis Google Sheets.
- [ ] Bina API `getStudents`.
- [ ] Bina API `createOutingRequest`.
- [ ] Bina API `getTodayRequests`.
- [ ] Bina API `approveRequest`.
- [ ] Bina API `rejectRequest`.
- [ ] Bina API `checkOutStudent`.
- [ ] Bina API `checkInStudent`.
- [ ] Bina API `markSelfieReceived`.
- [ ] Bina audit log.

## Phase 4: Rules dan validation

- [ ] Block permohonan selain Selasa/Rabu.
- [ ] Block permohonan sebelum 5:00 petang.
- [ ] Auto flag lewat selepas 10:00 malam.
- [ ] Prevent duplicate outing aktif.
- [ ] Guard tidak boleh sahkan keluar tanpa kelulusan warden.
- [ ] Pelajar tidak boleh edit timestamp.

## Phase 5: Testing

- [ ] Test dengan data dummy pelajar.
- [ ] Test flow pelajar mohon.
- [ ] Test flow warden approve/reject.
- [ ] Test flow guard check-out/check-in.
- [ ] Test kes pelajar lewat.
- [ ] Test kes pelajar belum masuk selepas 10:00 malam.
- [ ] Test paparan mobile.

## Phase 6: Deployment

- [ ] Enable GitHub Pages.
- [ ] Deploy Apps Script sebagai Web App.
- [ ] Sambungkan frontend dengan GAS Web App URL.
- [ ] Uji live URL.
- [ ] Latih warden/guard guna sistem.

## Phase 7: V2 cadangan

- [ ] QR code outing pass.
- [ ] Upload selfie ke Google Drive.
- [ ] Telegram alert kepada warden.
- [ ] Laporan mingguan/bulanan.
- [ ] Export CSV/PDF.
- [ ] Login Google Account untuk warden.
