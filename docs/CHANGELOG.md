# Changelog

## Unreleased

- **Foto profil Pelajar:** upload/ganti sendiri dengan compression JPEG 3:4, metadata `STUDENTS.photo_file_id` dan `photo_updated_at`, serta folder Drive private berasingan.
- **Operasi:** thumbnail kompak dengan placeholder pada kad Warden/HEP dan Guard; Tetapan Pelajar Admin menyokong thumbnail dan confirmed removal ber-audit.
- **Privasi:** foto dihantar melalui POST batch berautentikasi tanpa Drive ID/URL pada response awam; Public Monitoring kekal tanpa foto dan workflow selfie/Telegram tidak berubah.
- **Production manual:** selepas merge perlu `clasp push`, `setupStudentProfilePhotos()` dan deployment GAS Version 30; langkah tersebut tidak dijalankan oleh perubahan ini.

## v2.1.0 — 2026-08-09

- **Admin operations:** menambah Pemantauan Semasa baca sahaja, Rekod Master dengan carian/filter/pagination dan Pengurusan Warden & Guard.
- **Staff:** menggunakan tab `WARDENS`/`GUARDS` sedia ada tanpa migration, menyokong create/edit/aktif/nyahaktif/reset PIN dan audit tanpa plaintext PIN.
- **Security:** semua dataset dan write baharu ialah POST-only serta memanggil `validateAdminCredentials_()`; senarai staff hanya mendedahkan `pin_configured`.
- **Guard:** membezakan aliran keluar/masuk, memperkemas hierarchy operasi dan menjadikan kad Sahkan Masuk lebih kompak.
- **Pelajar:** menambah jumlah outing tahunan berdasarkan rekod raw-status `SELESAI` milik pelajar sendiri.
- **Admin:** menambah statistik individu berautentikasi mengikut bulan, tahun dan kelas serta membaiki rendering workspace Statistik Admin.
- **Tempoh outing:** menjumlahkan tempoh sebenar yang sah daripada `masa_keluar` hingga `masa_masuk`; timestamp tidak lengkap kekal menyumbang sifar tempoh tanpa mengurangkan kiraan outing.
- **GAS hygiene:** menetapkan `gas/Code.gs` sebagai source executable kanonik dan mengehadkan skop clasp melalui `.claspignore`.
- **Production:** frontend v2.1.0 menggunakan GAS Version 27, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint GAS production yang tidak berubah.
- **Release commit:** `chore: bump eOuting version to 2.1.0` (commit yang membawa entri ini).

## v2.0.0 — 2026-08-04

### Production frontend release

- **Release:** menyelaraskan runtime, footer, `version.json`, asset query strings dan cache PWA kepada `2.0.0`.
- **PWA:** menggunakan namespace cache baharu `eouting-cache-v2.0.0`; activation terus membuang cache eOuting lama sahaja.
- **Routing:** mengekalkan `/eouting/` pada endpoint GAS production dan `/eoutingV2/` pada endpoint beta tetap tanpa query override di luar localhost.
- **Safety:** GAS/API kekal network-only, imej selfie dan response sensitif tidak dicache, serta `OUTING_CONFIG_V2_ENABLED` kekal `false`.
- **Backend:** GAS production Version 24 dan login Admin telah melalui smoke test sebelum release frontend ini.
- **Production rollout:** frontend berjaya diterbitkan di `https://itumelaka.github.io/eouting/` melalui merge commit `4eedcbe` (`release: deploy eOuting v2.0.0`). Footer memaparkan `v2.0.0`, tiada badge `BETA API` dan data production digunakan.
- **Production verification:** login Admin serta flow Pelajar, Warden dan Guard berjaya dimuatkan; Public Monitoring berfungsi pada klik pertama, Statistik berjaya dimuatkan dan intentional auto-scroll mobile berjalan lancar.
- **Runtime controls:** backend kekal GAS Version 24, `OUTING_CONFIG_V2_ENABLED=false` dan validator submission legacy kekal aktif. `TELEGRAM_ENABLED=true` kekal aktif.
- **Quality gate:** suite automatik penuh lulus **177/177** sebelum deployment.

### Admin Student Management beta

- Menambah sub-tab Admin `Tetapan Outing` dan `Pengurusan Pelajar` sambil mengekalkan CRUD outing config sedia ada.
- Menambah POST Admin `getAdminStudents`, `createStudent`, `updateStudent` dan `toggleStudentStatus` dengan authentication, lock, duplicate protection dan audit.
- Mengurus schema STUDENTS sedia ada tanpa migration atau version column; `student_id` immutable dan nilai no. matrik/telefon kekal teks.
- Menambah kelas `LI` untuk Pelajar Latihan Industri (LI). LI muncul dalam pilihan login Pelajar hanya apabila rekod LI aktif wujud dan tidak menjadi role landing baharu.
- Nyahaktif pelajar mengeluarkan rekod daripada public `getStudents` tanpa memadam sejarah `OUTING_REQUESTS`.

- **Schema staging:** menambah `OUTING_TYPES` dan `ADMIN_USERS` tanpa menyambungkannya kepada router API atau frontend.
- **Migration:** menambah `setupAdminOutingConfigV200()` yang idempotent, mencipta header dan seed lima jenis outing v1.7.1 sekali sahaja.
- **Audit:** menambah `entity_type` dan `entity_id` selepas enam kolum legacy `AUDIT_LOG` tanpa menyusun semula data lama.
- **Feature flag:** menambah Script Property `OUTING_CONFIG_V2_ENABLED` dengan default `false`; migration tidak mengaktifkannya.
- **Compatibility:** `OUTING_REQUESTS`, `submitRequest`, login sedia ada dan keseluruhan production flow kekal hard-coded.
- **Security:** tiada akaun Admin/PIN diseed dan belum ada `loginAdmin`, config API, CRUD atau Admin Dashboard.

### Fasa 3 — Backend Config API dan Admin Authentication

- **Authentication:** menambah `loginAdmin`, `validateAdminCredentials_` dan lookup `ADMIN_USERS` aktif tanpa memulangkan atau mengaudit PIN.
- **Public API:** menambah GET `getOutingTypes` dengan safe projection, active-only sorting apabila flag aktif dan fallback lima jenis legacy apabila flag `false`.
- **Admin API:** menambah POST `getAdminOutingTypes`, `createOutingType`, `updateOutingType` dan `toggleOutingType`.
- **Concurrency:** create/update/toggle menggunakan `LockService`; update/toggle memerlukan optimistic `expected_config_version` dan menaikkan version selepas berjaya.
- **Validation:** backend menguatkuasakan uppercase/unique/immutable `type_code`, nama, boolean, masa `HH:mm`, hari BM, `sort_order` dan metadata read-only.
- **Audit:** menambah `CREATE_OUTING_TYPE`, `UPDATE_OUTING_TYPE`, `ACTIVATE_OUTING_TYPE` dan `DEACTIVATE_OUTING_TYPE` dengan entity `OUTING_TYPE` tanpa PIN.
- **Boundary:** tiada delete API, Admin frontend, config-driven submission, dynamic statistics atau feature-flag activation.

### Fasa 4 — Admin Dashboard Frontend

- **Akses:** menambah role Admin, panel login ID/nama + PIN, loading dan safe error state.
- **Session:** credential Admin disimpan dalam memory runtime sahaja; PIN tidak disimpan dalam localStorage/sessionStorage atau console dan dibersihkan semasa logout.
- **Dashboard:** memaparkan active/inactive config mengikut `sort_order` bersama kod, nama, hari, masa dan `config_version`.
- **Editor:** controlled create/edit form menyokong semua medan konfigurasi; `type_code` read-only dan active dikecualikan semasa edit.
- **Toggle:** confirmation aktif/nyahaktif dengan `expected_config_version`; tiada delete control.
- **Conflict:** `CONFIG_VERSION_CONFLICT` mencetuskan refresh data dan mesej supaya Admin membuka semula editor.
- **UX:** menambah loading, empty, error, retry, disabled, aria-live, focus-visible dan responsive mobile layout.
- **Boundary:** student form, statistik dan feature flag production kekal tidak berubah.

### Fasa 4.5 — Local/Mock QA Admin Dashboard

- **Mock isolation:** lima action Admin dipintas hanya apabila query tepat `mock=1` digunakan; live mode terus menggunakan GAS.
- **Credential QA:** menambah satu akaun development `ADMIN-MOCK` tanpa response/log PIN dan tanpa seeding `ADMIN_USERS`.
- **Data:** menyediakan lima jenis outing dalam memory dengan satu inactive row untuk QA list dan toggle.
- **Writes:** create, edit dan toggle mock tidak menyentuh GAS, Sheets, localStorage atau sessionStorage.
- **Resilience QA:** `mockAdminError=1` menyediakan read error sekali sahaja dan retry; `mockAdminConflict=1` menyediakan optimistic conflict sekali sahaja.
- **Boundary:** tiada perubahan GAS production, student form, feature flag, migration atau deployment.

### Fasa 4.6 — Canonical Frontend POST Router

- **Dead-code cleanup:** membuang declaration `apiPost` pertama yang ditimpa oleh declaration kedua semasa JavaScript load.
- **Canonical behaviour:** mengekalkan mock guard, POST payload, `cache: no-store` dan `parseApiResponse` daripada implementation efektif sedia ada.
- **Regression coverage:** mengunci satu declaration, mock/live routing, larangan direct GAS POST serta safe handling untuk HTML, invalid JSON, HTTP dan backend errors.
- **Boundary:** semua 17 call site, GAS backend, student form dan feature flag kekal tidak berubah.

### Fasa 5A — Config-driven Student Form Rendering

- **Loader:** memanggil public GET `getOutingTypes` hanya apabila sesi Pelajar membuka form, dengan loading, safe error dan retry.
- **Dropdown:** merender active config mengikut `sort_order`; lima option legacy kekal dalam HTML dan digunakan apabila response gagal/kosong.
- **Fields:** visibility, required dan disabled state mengikuti sebelas peraturan config; hidden values dibersihkan semasa type change.
- **Return rules:** `same_day_only` menyelaras tarikh dan `fixed_return_time` mengisi serta mengunci input masa.
- **Mock QA:** active/inactive, optional fields, empty fallback dan one-shot error/retry tersedia tanpa GAS.
- **Compatibility:** mock student A2/A3 diselaraskan; Weekend legacy kekal Sabtu/Ahad dengan masa `22:00`.
- **Boundary:** GAS `submitRequest`, feature flag, Warden, Guard, Telegram, selfie, statistik dan Admin Dashboard tidak berubah.

### Fasa 5B — Backend Config-driven Submission Validation

- **Resolver:** `submitRequest` menggunakan validator legacy apabila flag bukan `"true"`, atau membaca `OUTING_TYPES` secara case-insensitive apabila flag aktif.
- **Fail closed:** type hilang/inactive, tab hilang, boolean/config version tidak sah dan schema malformed ditolak dengan mesej selamat.
- **Rules:** backend menguatkuasakan `allowed_days`, application window, tarikh/masa, `fixed_return_time`, `same_day_only`, required fields dan pilihan kelulusan Warden daripada config Sheet.
- **Compatibility:** whitelist serta validator legacy Outing Biasa, Weekend, Kecemasan, Pulang Bermalam dan Cuti Semester kekal dalam cabang flag-false; duplicate protection dan schema `OUTING_REQUESTS` tidak berubah.
- **Audit:** submission config-driven menambah hanya `config_version` kepada audit sedia ada, tanpa menyimpan config penuh.
- **Boundary:** feature flag kekal `false`; tiada live migration, activation, deployment, dynamic statistics atau perubahan frontend/Admin/Warden/Guard.

### Fasa 6 — Beta Readiness dan Rollout Safety

- **Verdict:** code bersedia secara bersyarat untuk beta terkawal lima seed, tetapi belum production-ready untuk jenis custom umum.
- **Versioning:** mencadangkan `v2.0.0-beta.1`; runtime/PWA metadata sengaja kekal `v1.7.1` sehingga publish beta diluluskan.
- **Runbook:** menambah `RELEASE_CHECKLIST.md` dengan gate backup, migration idempotent, Admin manual, GAS beta, regression semua role, activation manual dan Go/No-Go.
- **Rollback:** menetapkan feature flag `false` sebagai kill switch pertama, diikuti rollback frontend/GAS jika perlu; tab config dan audit additive tidak dipadam.
- **Security audit:** mengesahkan Admin writes POST-only, live POST `no-store`, PIN tidak disimpan browser, audit tanpa PIN/config penuh dan submission config malformed gagal tertutup.
- **Known limits:** `require_selfie`, statistik dan label Telegram belum dinamik sepenuhnya untuk jenis custom; `require_warden_approval=false` ialah setting high-impact.
- **Boundary:** tiada version bump runtime, migration live, feature-flag activation, deployment, commit atau push.

## v1.7.1 — 2026-08-02

- **Jenis permohonan:** menambah `OUTING_HUJUNG_MINGGU` sebagai jenis outing kelima dengan label “Outing Sabtu / Ahad”.
- **Peraturan:** tarikh keluar wajib Sabtu atau Ahad, tarikh balik mesti hari yang sama dan masa balik dijangka ditetapkan pada `22:00`.
- **Flow operasi:** mengekalkan kelulusan Warden & HEP, pengesahan keluar/masuk Guard, semakan lewat, bukti selfie pulang dan notifikasi Telegram.
- **PWA:** menyelaraskan `APP_VERSION`, footer, asset query strings, cache service worker dan `version.json` kepada v1.7.1.
- **Git:** Pull Request #2 digabungkan ke `main` melalui merge commit `fa7227e` daripada feature commit `1e6303c`.
- **Testing:** baseline repo v1.7.1 ialah **60/60 lulus** selepas regression expectations diselaraskan dengan metadata release semasa.

## v1.7.0 — 2026-07-26

- **Frontend:** menambah flow `Ambil Selfie & Lapor Pulang` untuk `OUTING_BIASA`, `KECEMASAN`, `PULANG_BERMALAM` dan `CUTI_SEMESTER`, termasuk kamera depan, preview, ambil semula, loading state, resize kira-kira 1280px dan pemampatan JPEG.
- **Backend:** menambah POST `submitReturnSelfie` dengan validation pemilikan `student_id` + `no_matrik`, syarat `SELESAI` + `masa_masuk`, semakan MIME/base64/saiz dan duplicate protection menggunakan `LockService`.
- **Google Drive dan Telegram:** menyimpan imej secara private dalam `eOuting - Bukti Selfie Pulang` dan menghantar imej sebenar melalui Telegram `sendPhoto`.
- **Database:** menambah `selfie_status`, `selfie_file_id`, `selfie_url`, `masa_selfie` dan `selfie_telegram_message_id`; `selfie_whatsapp` dikekalkan sebagai legacy.
- **Reliability:** menambah cleanup fail Drive dan mesej Telegram bagi transaksi separa gagal. Kegagalan audit selepas transaksi utama lengkap tidak menggagalkan atau rollback submission.
- **Security dan privasi:** Public Monitoring tidak menerima metadata selfie, input client tidak boleh menghantar URL Drive sebagai bukti, dan service worker tidak cache API/external request atau imej selfie sensitif.
- **Mock mode:** mensimulasikan submission berjaya tanpa menyentuh Drive atau Telegram.
- **PWA:** menyelaraskan footer, asset version, cache name, `version.json` dan release popup kepada v1.7.0.
- **Testing:** keseluruhan suite lulus **59/59**.
- **Deployment:** Pull Request #1 digabungkan ke `main` (`beec1e0`, daripada `21996a2`), frontend live di GitHub Pages dan GAS production dideploy sebagai **Version 21** pada 26 Jul 2026.
- **Production validation:** request `OUT-20260726-121316-1479` selesai dengan `selfie_status = SUDAH_HANTAR`, metadata Drive terisi, `masa_selfie = 2026-07-26 12:18:00`, Telegram message ID `98`, serta imej berjaya disimpan dan dihantar.

## v1.6.25

- Fixed the Public Monitoring lifecycle with one-click workspace activation and scroll-to-workspace.
- Added a dedicated public GET `getTodayRecords` loader with a single-flight guard and one render per response.
- Updated timestamps only after successful refresh and retained old data after refresh failure.
- Displayed real student names using the six-field minimum public response.
- Compact Public Monitoring now keeps only summary cards and `Senarai Status Semasa`.
- Removed the duplicate `Rekod Hari Ini`, monitoring quick filter and `Belum Pulang Ke Asrama` section.
- Bumped frontend, cache, asset and release metadata to v1.6.25.

## v1.6.24

- Limited Guard quick filters to data available in `Sedia Untuk Keluar` and `Sedang Keluar`.
- Added the dedicated `Kecemasan` filter and kept it separate from Outing Harian.
- Added contextual empty-state messages per Guard section and active filter.
- Bumped frontend, cache, asset and release metadata to v1.6.24.

## v1.6.23

- Restored runtime staff credentials after fresh Warden/Guard login responses that do not return PIN.
- Kept the existing remember-device session architecture working.
- Added the central contextual status display helper without changing backend status values.
- Replaced Warden checklist colour boxes with status emoji.
- Bumped frontend, cache, asset and release metadata to v1.6.23.

## v1.6.22

- Fixed authenticated operational record loading for Pelajar, Warden and Guard.
- Required valid role credentials for operational POST `getTodayRecords`.
- Removed silent authenticated fallback to public monitoring records.
- Bumped frontend, cache, asset and release metadata to v1.6.22.

## v1.6.21

- Anonymised the initial Public Monitoring response.
- Separated anonymous GET monitoring from authenticated operational POST records.
- Removed sensitive individual statistics and retained aggregated counts only.
- Bumped frontend, cache, asset and release metadata to v1.6.21.

## v1.6.20

- Hardened the public student directory to `student_id`, `nama` and `kelas` only.
- Removed matric numbers and other student PII from public `getStudents`.
- Made API/GAS requests network-only in the service worker.
- Added automatic cleanup of old eOuting caches.
- Bumped frontend, cache, asset and release metadata to v1.6.20.

## v1.6.16

- Fixed stale Warden/Guard login error toast after successful staff login.
- Hid empty yellow notice/banner when there is no message.
- Bumped PWA cache, asset query strings, footer version, and `version.json`.

## v1.6.15

- Refined Warden utility actions so `Refresh Permohonan` remains the primary action.
- Renamed `Muat Semula Sistem` to `Muat Semula Aplikasi`.
- Moved app reload into a smaller/subtle action area.
- Reduced Warden auto-refresh cadence from 30 seconds to 60 seconds.
- Bumped PWA cache, asset query strings, footer version, and `version.json`.

## v1.6.14

- Added Warden Dashboard auto-refresh.
- Added `Refresh Permohonan`, Warden loading state, and Warden updated timestamp.
- Moved Warden utility buttons closer to the Warden Dashboard.
- Kept footer focused on version text after utility buttons are moved.
- Bumped PWA cache, asset query strings, footer version, and `version.json`.

## v1.6.13

- Added `Senarai Nama Semasa` to Pemantauan Semasa.
- Displayed the WhatsApp-style status icon list inside the monitoring page.
- Added subtle animated status icons for the live name list.
- Bumped PWA cache, asset query strings, footer version, and `version.json`.

## v1.6.12

- Added loading state to Pemantauan Semasa while monitoring records are being fetched.
- Added friendly monitoring error handling that keeps old data visible when refresh fails.
- Made `Sedang Keluar` summary card more prominent when active records exist.
- Added subtle live status animations with `prefers-reduced-motion` support.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.11

- Added status icons to copied Warden name lists:
  - `MENUNGGU_KELULUSAN` = 🟡
  - `DILULUSKAN_WARDEN` = 🟢
  - `KELUAR` = 🚶
  - `SELESAI` = ✅
- Added legend under copied name lists.
- Included `SELESAI` records in copied lists while excluding `DITOLAK_WARDEN`.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.10

- Added `Copy Senarai Nama` button to Warden Checklist Permohonan.
- Added checklist type filters:
  - Semua
  - Outing
  - Bermalam
  - Cuti Semester
  - Kecemasan
- Clipboard output copies names only, with numbering and request-type heading.
- Added clipboard fallback using temporary textarea and `document.execCommand("copy")`.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.9

- Expanded Warden Checklist from Cuti Semester only to all request types.
- Added request type badges and status badges to checklist rows.
- Added request type and status summaries to the checklist.
- Kept pending-row focus behavior for existing approve/reject cards.
- Bumped PWA cache, asset query strings, and `version.json`.

## v1.6.8

- Improved Guard `Refresh Status` visibility before `Sedia Untuk Keluar`.
- Improved Warden Cuti Semester checklist status coverage before it was expanded to all request types.
- Bumped PWA cache, asset query strings, and `version.json`.

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
