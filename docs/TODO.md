# TODO eOuting ITU

Senarai kerja semasa bagi repo **v2.4.0 / GAS Version 44 / cache `2.4.0-r1`** pada 20 Ogos 2026. Operational Urgency Foundation Fasa 1 lengkap dalam commit `dde1fc4` dengan baseline semasa **399/399**. Rekod fasa terdahulu dikekalkan sebagai sejarah selesai.

## Done / Completed

### Operational Urgency Foundation — Fasa 1

- [x] Satu resolver expected-return backend mengutamakan snapshot `tarikh_balik + masa_balik_dijangka` bagi semua standard dan custom/config-driven type.
- [x] Legacy daily fallback kepada tarikh outing dan 22:00 dikekalkan hanya apabila wajar; malformed active timing menghasilkan `needs_review=true`.
- [x] Urgency kekal berasingan daripada lifecycle dengan state `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL` dan `ACTION_REQUIRED`.
- [x] Threshold exact: lebih 30 minit sebelum, 0–30 minit sebelum, selepas due hingga kurang 30 minit lewat, 30–kurang 60 minit lewat, dan sekurang-kurangnya 60 minit lewat.
- [x] `confirmIn()` menggunakan resolver authoritative yang sama, di bawah lock, sambil mengekalkan historical `lewat=Ya/Tidak` dan idempotency.
- [x] Projection authenticated Pelajar, Warden/HEP, Guard dan Admin boleh menerima nested `operational_urgency`; Public Monitoring kekal tanpa precise urgency metadata.
- [x] Urgency diterbitkan selepas cache source 20 saat dibaca dan tidak dicache sebagai state; tiada schema change.
- [x] Commit `dde1fc4`; full Node suite **399/399**.

### eOuting v2.4.0 Guard Responsive Grid

- [x] Commit `d30d8d9` menjadikan senarai approved/sedia keluar, sedang keluar/menunggu masuk dan overnight belum pulang sebagai grid responsif khusus Guard.
- [x] Satu kolum digunakan di bawah `820px`; dua kolum sama lebar digunakan mulai `820px`, dengan gap konsisten dan perlindungan overflow.
- [x] Browser production pada 20 Ogos 2026 mengesahkan computed columns `570px 570px` pada viewport `1707px`, posisi kad berselang sekitar `270px`/`852px` dan kad tidak merentasi kedua-dua kolum.
- [x] Rendering JavaScript Guard, hook `Sah Keluar`/`Sah Masuk`, backend, GAS, schema dan business rules kekal tidak berubah.
- [x] Full Node suite bagi milestone Guard grid **385/385** pada 20 Ogos 2026.

### eOuting v2.3.2 Production Close-out (sejarah)

- [x] `Status Semasa` dipindahkan ke atas borang sebagai kawasan authoritative bagi current record, pembatalan dan return-selfie yang layak.
- [x] Bahagian bawah Pelajar dipadatkan kepada Refresh Status, jumlah tahunan dan `Rekod Outing Saya`.
- [x] Commit `967cfd6` menutup compact history; commit `f2f55cc` menyelaraskan jumlah/sejarah kepada scope authenticated `SELESAI` tahun semasa.
- [x] Response sejarah minimum hanya `tarikh`, `jenis_permohonan` dan `status`, dengan ownership diperkukuh dan newest-first.
- [x] Frontend v2.3.2 / cache `2.3.2-r1` / GAS Version 44 serta smoke test jumlah-sejarah disahkan production.
- [x] Full Node suite bagi milestone v2.3.2 **363/363** pada 16 Ogos 2026.

### eOuting v2.2.1 Production Close-out (sejarah)

- [x] Tujuh modul Admin inline: Pemantauan, Statistik, Rekod Master, Warden/HEP/Guard, Tetapan Pelajar, Tetapan Outing dan Notis Banner.
- [x] Pengurusan staff, pelajar dan outing type serta Rekod Master search/filter/pagination.
- [x] Foto profil private: self-upload, crop/compression, metadata STUDENTS, Admin removal dan initials fallback.
- [x] Two-tier photo delivery: unique-ID thumbnail batch, server-side Drive thumbnail, one-student full preview, cache sesi, duplicate suppression dan safe failure.
- [x] Thumbnail production disahkan untuk Warden/HEP, Guard, Admin Pemantauan dan Admin Tetapan Pelajar; Public Pemantauan kekal photo-free.
- [x] Statistik individu Admin, annual count Pelajar, rolling KPI/reduced-motion dan scoped Enter submission.
- [x] GAS Version 43 ialah baseline production pada close-out 14 Ogos 2026; config-driven active, readiness hijau, Notis Banner V1 dan Student cancellation live.
- [x] Cache/asset source revision `2.2.1-r4` dengan displayed app version v2.2.1 pada close-out tersebut.
- [x] Setiap banner aktif menggunakan ticker kiri berterusan; hover/focus/touch pause dan reduced-motion kekal statik.
- [x] Controlled activation: submission, Warden approval, early Guard rejection dan safe policy feedback disahkan.
- [x] Notis Banner V1 live: satu notis Script Properties, Admin edit/aktif/penting, viewer authenticated, safe text, audit dan reduced-motion.
- [x] Deploy Notis Banner sebagai GAS Version 37 dan sahkan Admin UI/save, Normal banner, authenticated display, timestamp serta public privacy.
- [x] Full Node suite **353/353** pada 14 Ogos 2026.
- [x] Buang ayat panduan outing pendua di bawah “Permohonan Pelajar”; kekalkan Announcement Banner, `ruleNotice` dan borang.
- [x] Atomic duplicate outing protection: frontend in-flight state serta backend `ScriptLock` untuk active-check + append.
- [x] In-flight loading Warden approve/reject dan Guard confirm-out/confirm-in.
- [x] Dynamic payload fields untuk semua jenis config/custom; KLINIK dan standard types regression-tested.
- [x] Admin boleh `Kosongkan` earliest departure time; blank tidak berubah menjadi current time.
- [x] Hotfix `39265f1`: Admin boleh `Kosongkan` application open/close time; `clearContent()` memastikan blank kekal blank, tiada fallback `00:00`/`12:00`/masa semasa, dan `allowed_days` kekal enforced.
- [x] Rekod deployment awal v2.2.1 / cache r1 / GAS Version 40: isu permohonan pagi `PULANG_BERMALAM` disahkan selesai.
- [x] Admin refresh persistence melalui `eouting_admin_session_v1`, 12-hour absolute expiry dan mandatory backend revalidation.
- [x] Global auth/restore loader Pelajar, Warden, Guard dan Admin dengan operation token serta reduced-motion.
- [x] Foto profil Pelajar menawarkan kamera depan atau galeri melalui satu shared processing pipeline; return-selfie kekal berasingan.
- [x] Rekod mobile/PWA awal v2.2.1 disahkan menggunakan cache `2.2.1-r1`.
- [x] Student cancellation untuk pending/approved pada semua jenis standard/config-driven, termasuk mandatory reason dan status terminal `DIBATALKAN_PELAJAR`.
- [x] Cancellation metadata additive, history/re-request, Warden/Guard/Public Monitoring/statistics exclusions dan race-safe `ScriptLock` transition.
- [x] Telegram cancellation tepat satu mesej bagi pending serta approved; previous status human-readable dan failure non-blocking.
- [x] Paparan approval HEP/Warden menggunakan prefix authoritative `WARDENS.warden_id` tanpa schema atau lifecycle baharu.
- [x] Status awal submission disahkan, dipersist mengikut header Sheet sebenar dan dibaca semula; blank dipaparkan sebagai `Status Tidak Diketahui`.
- [x] Masa sahaja Sheet dinormalkan kepada `HH:mm`; paparan/Telegram/late comparison `22:00` tidak lagi membawa tarikh 1899 atau offset manual.
- [x] Helper daypart BM diselaraskan kepada Pagi `01:00–11:59`, Tengah Hari `12:00–12:59`, Petang `13:00–18:59` dan Malam `19:00–00:59`.

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

- [x] Tambah foundation peraturan keluar pada `OUTING_TYPES`: hari keluar dan masa keluar paling awal, tanpa mengaktifkan config-driven production.
- [x] Admin/HEP menetapkan `earliest_departure_time=17:00` untuk `PULANG_BERMALAM`; nilai ini boleh diubah mengikut arahan operasi semasa.

- [x] Fasa 6: audit beta readiness, metadata, migration/security boundaries serta sediakan rollout dan rollback checklist.
- [x] Fasa 4.5: Local/Mock QA Admin dengan lima seed, credential development terasing, error/retry dan optimistic conflict.
- [x] Fasa 4.6: buang duplicate `apiPost` dan kekalkan satu canonical POST router dengan regression coverage.
- [x] Fasa 5A: config-driven student form rendering dengan safe GET, legacy fallback dan mock QA.
- [x] Fasa 5B: selaraskan submission/validation config-driven di belakang feature flag dengan fail-closed config resolution dan legacy fallback.
- [x] Bina `getOutingTypes` dengan kontrak public projection selamat.
- [x] Bina CRUD backend dan Dashboard Admin pada fasa berasingan.
- [x] Aktifkan config-driven submission selepas live migration, readiness, feature flag dan rollback diuji/diluluskan.
- [ ] Sediakan persekitaran beta berasingan atau kelulusan khusus jika menggunakan data production.
- [x] Sambungkan `require_selfie` kepada lifecycle config-driven dengan state `TIDAK_DIPERLUKAN` tanpa mengubah legacy.
- [x] Jadikan statistik, label Telegram, Rekod Master dan Checklist Warden config-aware untuk jenis custom.
- [x] Tambah readiness read-only Admin untuk schema, config aktif, pendua, versi, hari/masa dan konsistensi consumer.
- [x] Deploy hardening, sahkan readiness production, lakukan controlled activation dan deploy Guard feedback sebagai GAS Version 36.
- [ ] Telegram inline button/link to open Warden/Guard/Pemantauan page.
- [ ] Dedicated `Kemas Kini Aplikasi` button separate from `Muat Semula Aplikasi`, if still required.
- [ ] Optional `request_id` deep link/highlight later.
- [ ] Daily WhatsApp summary/report.
- [ ] Review keputusan konservatif `lewat=Ya` apabila timing benar-benar indeterminate semasa `confirmIn`; active malformed record kini memberi `needs_review=true`.
- [ ] Fasa seterusnya: Student urgency UI, Warden prioritisation, Admin operational intelligence, Telegram timed reminders/escalations dan guardian shortcut.

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
- [ ] Late-return escalation notification di atas operational urgency foundation.
- [ ] Optional WhatsApp notification later if required.
- [ ] Daily/weekly/monthly report automation.
- [ ] Automated version injection/build step.
- [ ] Supabase migration can remain future TODO only; not a current requirement.
