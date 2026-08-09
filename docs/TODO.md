# TODO eOuting ITU

Senarai kerja semasa selepas release production **v2.2.0 / GAS Version 32** pada 9 Ogos 2026. Rekod fasa terdahulu dikekalkan sebagai sejarah selesai.

## Done / Completed

### eOuting v2.2.0 Production Close-out

- [x] Enam modul Admin inline: Pemantauan, Statistik, Rekod Master, Warden/HEP/Guard, Tetapan Pelajar dan Tetapan Outing.
- [x] Pengurusan staff, pelajar dan outing type serta Rekod Master search/filter/pagination.
- [x] Foto profil private: self-upload, crop/compression, metadata STUDENTS, Admin removal dan initials fallback.
- [x] Two-tier photo delivery: unique-ID thumbnail batch, server-side Drive thumbnail, one-student full preview, cache sesi, duplicate suppression dan safe failure.
- [x] Thumbnail production disahkan untuk Warden/HEP, Guard, Admin Pemantauan dan Admin Tetapan Pelajar; Public Pemantauan kekal photo-free.
- [x] Statistik individu Admin, annual count Pelajar, rolling KPI/reduced-motion dan scoped Enter submission.
- [x] GAS Version 32, endpoint lama, GitHub Pages/cache delivery dan smoke test production disahkan.

### eOuting v2.0 — Fasa 2 Schema dan Migration

- [x] Tambah schema staging `OUTING_TYPES` dan `ADMIN_USERS`.
- [x] Luaskan `AUDIT_LOG` dengan `entity_type` dan `entity_id` secara additive.
- [x] Tambah migration idempotent `setupAdminOutingConfigV200()`.
- [x] Seed lima jenis outing v1.7.1 sekali sahaja tanpa menimpa row sedia ada.
- [x] Tambah Script Property `OUTING_CONFIG_V2_ENABLED` dengan default `false`.
- [x] Kekalkan `submitRequest` dan flow production hard-coded.
- [x] Tambah regression tests untuk schema, idempotency, compatibility audit dan feature flag.

### eOuting v2.0 — Fasa 3 Backend Config API

- [x] Tambah `loginAdmin` dan validation Admin aktif tanpa mendedahkan PIN.
- [x] Tambah public safe `getOutingTypes` dengan fallback legacy semasa flag `false`.
- [x] Tambah authenticated `getAdminOutingTypes` untuk active/inactive dan metadata config.
- [x] Tambah create/update/toggle di bawah `LockService` tanpa delete API.
- [x] Tambah uppercase/unique/immutable `type_code` dan backend validation semua medan config.
- [x] Tambah optimistic `expected_config_version` dan increment version.
- [x] Tambah audit create/update/activate/deactivate dengan entity `OUTING_TYPE` tanpa PIN.
- [x] Kekalkan `submitRequest` serta UI production hard-coded.

### eOuting v2.0 — Fasa 4 Admin Dashboard

- [x] Tambah role, panel login dan runtime-only session Admin.
- [x] Tambah responsive Dashboard active/inactive dengan loading, empty, error dan retry.
- [x] Tambah controlled create form untuk semua medan konfigurasi.
- [x] Tambah edit dengan immutable `type_code` dan optimistic config version.
- [x] Tambah confirmation toggle aktif/nyahaktif tanpa delete.
- [x] Tambah conflict refresh dan mesej mesra pengguna.
- [x] Pastikan logout membersihkan PIN/credential runtime dan Admin tidak disimpan ke localStorage.
- [x] Tambah accessibility labels, focus, disabled dan aria-live states.

### Core System

- [x] GitHub Pages frontend dan PWA live.
- [x] Google Apps Script backend dideploy dan disambungkan ke Google Sheets.
- [x] Pelajar, Warden dan Guard login.
- [x] Flow `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM` dan `CUTI_SEMESTER`.
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
- [x] Statistik individu/leaderboard dibuang daripada public dan disediakan semula hanya dalam modul Admin authenticated.
- [x] API/GAS dikecualikan daripada Cache Storage dan cache lama dibersihkan.
- [x] Staff runtime credential restoration selepas fresh login.
- [x] Foto profil private dengan batch authenticated, initials fallback dan Admin removal ber-audit.
- [x] Preview besar foto profil authorised menggunakan full-image on-demand satu pelajar, cache sesi dan retry selamat tanpa Drive URL/ID atau N+1 list request.

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

### Bukti Pulang Asrama v1.7.0

- [x] Bukti selfie pulang untuk `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM` dan `CUTI_SEMESTER`.
- [x] Kamera depan, preview, ambil semula, resize kira-kira 1280px dan JPEG compression.
- [x] `submitReturnSelfie` dengan validation pemilikan, `SELESAI`, `masa_masuk`, MIME/base64/saiz.
- [x] `LockService` duplicate protection dan idempotent rejection.
- [x] Folder Google Drive private `eOuting - Bukti Selfie Pulang`.
- [x] Telegram `sendPhoto` dan metadata selfie dalam `OUTING_REQUESTS`.
- [x] `setupSelfieProofV170()` serta Script Property `SELFIE_FOLDER_ID`.
- [x] Cleanup transaksi separa dan audit-log failure non-fatal selepas transaksi berjaya.
- [x] Mock-mode submission tanpa Drive atau Telegram.
- [x] Service-worker dan Public Monitoring privacy hardening untuk bukti selfie.
- [x] Test suite **59/59 lulus**.
- [x] Pull Request #1 digabungkan dan frontend v1.7.0 live di GitHub Pages.
- [x] GAS Version 21 dideploy dan ujian production hujung-ke-hujung berjaya.

## Operations Checklist

- [ ] Teruskan pemantauan operasi selepas v1.7.0.
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

- [x] Fasa 6: audit beta readiness, metadata, migration/security boundaries serta sediakan rollout dan rollback checklist.
- [x] Fasa 4.5: Local/Mock QA Admin dengan lima seed, credential development terasing, error/retry dan optimistic conflict.
- [x] Fasa 4.6: buang duplicate `apiPost` dan kekalkan satu canonical POST router dengan regression coverage.
- [x] Fasa 5A: config-driven student form rendering dengan safe GET, legacy fallback dan mock QA.
- [x] Fasa 5B: selaraskan submission/validation config-driven di belakang feature flag dengan fail-closed config resolution dan legacy fallback.
- [x] Bina `getOutingTypes` dengan kontrak public projection selamat.
- [x] Bina CRUD backend dan Dashboard Admin pada fasa berasingan.
- [ ] Aktifkan config-driven submission hanya selepas live migration, feature flag dan rollback diuji/diluluskan.
- [ ] Sediakan persekitaran beta berasingan atau kelulusan khusus jika menggunakan data production.
- [ ] Sambungkan `require_selfie` kepada lifecycle sebelum membenarkannya sebagai tetapan operasi.
- [ ] Jadikan statistik dan label Telegram config-aware sebelum jenis custom dibuka secara umum.
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
- [ ] Tetapkan retention/deletion policy untuk selfie.
- [ ] Review GAS Web App deployment permission.
- [ ] Decide SOP for changing Warden/Guard PIN.
- [ ] Review role-based access hardening.
- [x] Buang Public Statistik dan kekalkan Statistik individu hanya dalam Admin authenticated.

## Future Enhancements

- [ ] QR code.
- [ ] Admin/Warden evidence review UI.
- [ ] Automated cleanup selfie selepas retention period.
- [ ] Telegram retry queue untuk kegagalan sementara.
- [ ] Refinement notis consent/privacy Pelajar.
- [x] Admin beta page for managing STUDENTS (A2, A3 dan LI) tanpa schema migration.
- [ ] Nilai sama ada optimistic version column diperlukan untuk STUDENTS selepas beta concurrency QA.
- [ ] Late-return escalation notification.
- [ ] Optional WhatsApp notification later if required.
- [ ] Daily/weekly/monthly report automation.
- [ ] Automated version injection/build step.
- [ ] Supabase migration can remain future TODO only; not a current requirement.
