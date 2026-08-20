# Architecture eOuting ITU

Versi repo semasa: **v2.4.0** dengan cache frontend `2.4.0-r1`. Production menggunakan GAS Version 44, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint Web App production sedia ada. Config-driven mode kekal aktif dan ready sejak 10 Ogos 2026. Backend kanonik ialah `gas/Code.gs`; snapshot `gas/Code.production-v171.gs` bukan source deploy. Operational Urgency Foundation Fasa 1 dilengkapkan dalam commit `dde1fc4`; Student Live Status Clarity Fasa 2 melalui `89d6b46`; dan Warden Approval Prioritisation + Emergency Mode Fasa 3 melalui `5443375`. Full Node baseline semasa ialah **420/420**.

## Komponen

```text
GitHub Pages static frontend / PWA
  -> Google Apps Script Web App router
    -> Google Sheets
    -> Google Drive private profile-photo and selfie storage (separate folders)
    -> Telegram Bot notifications
    -> AUDIT_LOG
```

### Frontend PWA

Fail utama:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `service-worker.js`
- `version.json`

Frontend mengurus grid landing kompak 2×2, borang Pelajar, Dashboard Warden/HEP dan Guard, Public Monitoring read-only yang dibuka inline, tujuh modul Admin inline termasuk `Notis Banner`, update PWA serta input kamera/file untuk foto profil dan bukti pulang. Statistik tidak mempunyai laluan awam dan kekal di dalam shell Admin. Foto profil menawarkan input kamera `capture="user"` dan input galeri tanpa `capture`, kemudian kedua-duanya berkongsi crop 3:4 serta compression maksimum kira-kira 600×800; selfie kekal workflow berasingan pada resize sisi terpanjang kira-kira 1280px. Frontend role hiding bukan boundary keselamatan.

### GAS Router

`gas/Code.gs` menyediakan `doGet(e)` dan `doPost(e)`. Backend membaca dan menulis Google Sheets, mengesahkan credential, menguatkuasakan transition status, menyimpan selfie ke Google Drive, menulis audit log dan menghantar Telegram.

Telegram ialah side effect non-blocking bagi notifikasi lifecycle biasa. Untuk `submitReturnSelfie`, penghantaran imej melalui `sendPhoto` ialah sebahagian daripada hasil bukti yang diperlukan; kegagalan sebelum transaksi lengkap mencetuskan cleanup Drive/Telegram. Kegagalan audit selepas transaksi utama berjaya hanya diberi amaran dan tidak membatalkan submission.

### Operational Urgency Foundation — Fasa 1

Backend memisahkan dua dimensi rekod:

```text
lifecycle: MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
urgency:   NORMAL | DUE_SOON | LATE | CRITICAL | ACTION_REQUIRED
```

Urgency hanya applicable sebagai active-return escalation bagi lifecycle `KELUAR`. Resolver expected-return mengutamakan snapshot `tarikh_balik + masa_balik_dijangka` tanpa mengehadkannya kepada type code tertentu, maka jenis custom/config-driven dengan timing valid menggunakan target sendiri dan bukan fallback 22:00. Bagi rekod legacy harian sahaja, tarikh boleh fallback kepada `tarikh` dan masa kosong boleh fallback kepada 22:00. Timing malformed atau indeterminate menghasilkan metadata diagnostic dengan `needs_review=true`.

Evaluator menggunakan `Asia/Kuala_Lumpur` dan exact elapsed time. Lebih 30 minit sebelum target ialah `NORMAL`; 0–30 minit sebelum termasuk tepat target ialah `DUE_SOON`; selepas target hingga kurang 30 minit ialah `LATE`; 30 hingga kurang 60 minit ialah `CRITICAL`; dan 60 minit atau lebih ialah `ACTION_REQUIRED`.

`confirmIn()` menggunakan resolver authoritative yang sama dan menyimpan historical `lewat` dalam format schema sedia ada `Ya`/`Tidak`: tepat target ialah `Tidak`, selepas target ialah `Ya`. Timing yang benar-benar indeterminate disimpan secara konservatif sebagai `Ya`; active malformed row pula kekal reviewable melalui `needs_review=true`.

`getOperationalTodayRecords` membaca normalized source rows daripada cache 20 saat, mengambil masa semasa, kemudian menghasilkan nested `operational_urgency` bagi projection authenticated Pelajar, Warden/HEP, Guard dan Admin. State urgency itu sendiri tidak dicache dan tidak ditambah kepada raw Sheet row. Public GET kekal enam medan tanpa timestamp, minit, transition, action code atau diagnostic urgency. Tiada perubahan schema dibuat.

Pada close-out Fasa 1, foundation ini belum mempunyai frontend urgency UI, Warden priority sorting, Admin intelligence dashboard, timed Telegram reminder/escalation atau guardian shortcut.

### Student Live Status Clarity — Fasa 2

Pembahagian tanggungjawab kekal tegas:

```text
GAS/backend
  -> resolve expected-return target
  -> classify authoritative urgency state
  -> supply expected_return_at + next_transition_at

Student frontend
  -> render lifecycle dan urgency sebagai dimensi berasingan
  -> update teks tempoh daripada expected_return_at
  -> refresh GAS apabila next_transition_at dilepasi
  -> tidak reclassify urgency secara local
```

Satu timer refresh Pelajar 30 saat yang sedia ada digunakan untuk kemas kini teks tempoh dan pemeriksaan transition. Transition key menekan refresh transition pendua; tiada timer tambahan atau request Pelajar bertindih. Pengiraan local hanya untuk wording tempoh (`Kurang 1 minit`, minit, jam + minit dan bentuk lewat yang setara), bukan untuk sempadan `NORMAL` hingga `ACTION_REQUIRED`.

Rekod hari sama memaparkan masa `expected_return_at`; rekod kemudian atau bermalam memaparkan tarikh dan masa. Frontend tidak membaca `OUTING_TYPES` semasa untuk membina semula target kerana snapshot request/backend ialah sumber authoritative. Metadata hilang, malformed atau `needs_review=true` masuk ke paparan review selamat tanpa countdown/state lewat rekaan.

Fasa 2 hanya mengubah presentation Pelajar dalam `assets/app.js` dan `assets/style.css`, dengan regression coverage dalam `tests/student-current-status-layout.test.js` dan `tests/student-live-status-clarity-phase2.test.js`. Lifecycle `SELESAI`, cancellation, return-selfie, annual history, profile photo, Announcement Banner/`ruleNotice`, authentication dan privacy boundary tidak berubah. Warden prioritisation, emergency mode, Admin operational intelligence/`Perlu Tindakan`, Telegram timed reminder/escalation, GAS time-driven trigger dan guardian shortcut kekal Fasa 3+; tiada schema, backend threshold, version atau deployment change dalam Fasa 2.

### Warden Approval Prioritisation + Emergency Mode — Fasa 3

Fasa 3 menambah dimensi approval-priority yang berasingan daripada lifecycle dan return urgency:

```text
lifecycle:                MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
warden approval priority: EMERGENCY -> DEPARTURE_APPROACHING/REACHED -> ORDINARY
return urgency:           NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
```

Priority hanya menyusun rekod `MENUNGGU_KELULUSAN` untuk Warden. Emergency compatibility dipusatkan pada `jenis_permohonan === KECEMASAN`; ia mempengaruhi sorting, visual emphasis dan contextual guidance, bukan status atau authority. Approve/reject backend dan Guard transition kekal tidak berubah. Generic config `require_warden_approval=false` masih boleh menggunakan `AUTO_CONFIG_V2`; behavior sedia ada itu bukan emergency bypass Fasa 3.

Untuk bucket departure, frontend menggunakan `earliest_departure_time`, tarikh request authoritative dan `Asia/Kuala_Lumpur`; masa dalam 30 minit atau yang telah tiba diberi priority, manakala timing hilang/malformed tidak mereka priority. Dalam setiap bucket, timestamp `masa_mohon` yang sah disusun oldest-first, diikuti rekod tanpa timestamp dengan ordering fallback deterministic/stable.

`getOperationalTodayRecords` hanya memanggil `addWardenDeparturePriorityProjection_` selepas Warden disahkan. Helper mengklon row, mengutamakan `earliest_departure_time` yang dibawa request jika boleh digunakan dan menggunakan nilai `OUTING_TYPES` semasa hanya sebagai compatibility fallback. Projection ini derived dan tidak dipersist: tiada write ke `OUTING_REQUESTS` atau Sheet, dan Student, Guard, Admin serta Public tidak menerima fallback request-level tersebut.

Known limitation/future schema consideration: bagi request tanpa snapshot departure request-level, perubahan `OUTING_TYPES.earliest_departure_time` selepas submission boleh mentafsir semula priority Warden. Request dengan nilai request-level sah kekal stabil. Snapshot masa keluar per request boleh dipertimbangkan dalam schema/version akan datang; Fasa 3 tidak menambah request column, `OUTING_TYPES.operational_priority` atau schema baharu.

Presentation kad Warden adalah compact dan procedural, termasuk cue kecemasan atau departure serta butiran kecemasan/waris yang memang telah diizinkan. Control approval/rejection, validation, actor recording, checklist semester/overnight, filter/counter, authentication dan privacy boundary dikekalkan. Mobile sekitar 390px dan desktop 1280×720 disahkan tanpa overflow. Admin intelligence/`Perlu Tindakan`, Telegram timed reminder/escalation dan trigger, guardian shortcut/access scope serta threshold return urgency kekal Fasa 4+.

### Google Sheets

Google Sheets ialah database dan source of truth. Tab utama:

- `STUDENTS`
- `WARDENS`
- `GUARDS`
- `OUTING_REQUESTS`
- `AUDIT_LOG`
- `OUTING_TYPES` — source authoritative konfigurasi outing production
- `ADMIN_USERS` — identiti Admin private

Semua field masa sahaja yang keluar daripada Sheet (`masa_balik_dijangka`, `fixed_return_time`, `application_open_time`, `application_close_time`, `earliest_departure_time`) melalui normalisasi backend kanonik kepada `HH:mm` menggunakan `Asia/Kuala_Lumpur`. Frontend mempunyai pertahanan kecil untuk payload legacy 1899, tanpa menambah atau menolak offset masa secara manual.

### Notis Banner

Notis tunggal disimpan dalam Script Properties sebagai teks, status aktif, status penting, masa kemas kini dan identiti Admin. Property yang belum wujud dinormalisasikan sebagai banner tidak aktif; simpanan Admin pertama mengisinya secara automatik. Tiada setup property manual dan tiada sheet `ANNOUNCEMENTS`.

`getAnnouncementBannerAdmin` serta `updateAnnouncementBanner` memerlukan credential Admin; mutation dicatat sebagai `UPDATE_ANNOUNCEMENT_BANNER`. `getAnnouncementBanner` mengesahkan sesi Student, Warden/HEP, Guard atau Admin dan hanya memulangkan projection aktif yang selamat. Tiada action banner pada router GET awam. Nama Script Property, secret dan `updated_by` tidak dipulangkan kepada viewer biasa. Teks dibatasi panjangnya, disimpan sebagai plain text dan dirender melalui `textContent`, maka HTML/script tidak dilaksanakan.

Frontend meletakkan banner di dalam `appWorkspace`, bukan pada landing/Public Pemantauan. Normal menggunakan label `MAKLUMAN`; Important menggunakan `PENTING`. Dua salinan visual menghasilkan ticker kiri berterusan yang perlahan bagi setiap banner aktif; salinan kedua `aria-hidden`, dengan ruang sebelum ulangan dan tanpa `<marquee>`. Gerakan boleh dijeda melalui hover, fokus papan kekunci atau sentuhan dan dimatikan untuk `prefers-reduced-motion`; tinggi banner kekal stabil.

Konfigurasi banner tidak dibaca oleh resolver outing dan tidak boleh mengubah business rule. Contohnya, notis “Pulang Bermalam dibenarkan keluar mulai jam 2.00 petang.” tidak mengubah `earliest_departure_time`; Admin masih perlu mengubah `Tetapan Outing > Pulang Bermalam > Masa Keluar Paling Awal`.

Dalam workspace Pelajar, banner ialah notis operasi semasa manakala `ruleNotice` kuning ialah panduan sistem kontekstual. Ayat panduan pendua di bawah tajuk “Permohonan Pelajar” telah dibuang tanpa mengubah kedua-dua elemen atau borang.

v1.7.0 menambah lima header selfie secara idempotent melalui `setupSelfieProofV170()` dan mengekalkan `selfie_whatsapp` sebagai kolum legacy.

Foto profil menambah `photo_file_id` dan `photo_updated_at` pada `STUDENTS` secara idempotent melalui `setupStudentProfilePhotos()`. Fail profil berada dalam folder private berasingan dan tidak berkongsi lifecycle atau Telegram side effect selfie.

Fasa 2 eOuting v2.0 menambah `setupAdminOutingConfigV200()` untuk mencipta dua tab staging, meluaskan `AUDIT_LOG` secara additive dan seed lima jenis outing semasa. Script Property `OUTING_CONFIG_V2_ENABLED` diwujudkan dengan default `false`.

Fasa 3 menambah backend authentication dan API konfigurasi tanpa menambah UI Admin atau menukar `submitRequest`. Public config menggunakan GET read-only, manakala login, admin read dan semua write menggunakan POST dengan credential Admin pada setiap request.

Rekod Fasa 4 asal menambah role dan Dashboard Admin pada frontend ketika credential masih memory-only dan Student form masih hard-coded. Keadaan itu ialah sejarah implementasi, bukan architecture production semasa; session restore dan rendering config-driven diterangkan di bawah.

Fasa 4.6 menetapkan satu sahaja canonical `apiPost` frontend. Router ini memintas lima action Admin hanya dalam `?mock=1`; selain itu ia menghantar POST `no-store` ke GAS dan menyerahkan semua response kepada `parseApiResponse`. Duplicate dead declaration dibuang tanpa mengubah payload atau call site.

Fasa 5A memuatkan public `GET getOutingTypes` hanya selepas sesi Pelajar dibuka. Dropdown, visibility, required/disabled state, `same_day_only` dan `fixed_return_time` dirender daripada safe config. Kegagalan atau response kosong menggunakan lima legacy config dalam memory; `submitRequest` GAS dan feature flag default tidak berubah.

Foundation departure-rule menambah `departure_allowed_days` dan `earliest_departure_time` pada `OUTING_TYPES` sedia ada. Ia tidak mencipta modul polisi kedua. `allowed_days` serta application window mengawal masa permohonan; blank `application_open_time`/`application_close_time` bermaksud tiada threshold bagi medan itu, tanpa melemahkan validation `allowed_days`. Explicit empty-string update menggunakan `clearContent()` pada cell Sheet supaya blank ialah state tersimpan sebenar. Medan departure mengawal tarikh keluar yang diminta dan masa paling awal Guard boleh mengesahkan keluar. Enforcement production kini membaca row aktif kerana `OUTING_CONFIG_V2_ENABLED=true`.

Readiness hardening menambah POST Admin-only `getOutingConfigReadiness`. Ia membaca `OUTING_TYPES` tanpa mencipta atau mengubah sheet dan tidak mendedahkan property atau credential. Tetapan Outing memaparkan chip `Config Active`, `Legacy` atau `Config Issue` dengan sebab not-ready yang accessible; tiada control activation. Label config digunakan oleh Student, Telegram, statistik, Rekod Master, filter Admin, Checklist/filter Warden, label kontekstual dan return-selfie eligibility. `require_warden_approval=false` menghasilkan state `DILULUSKAN_WARDEN`, approver `AUTO_CONFIG_V2`, masa approval dan audit `AUTO_APPROVE_REQUEST` yang eksplisit.

### Config-driven Outing dan Jenis Custom

Konfigurasi jenis terpilih ialah source of truth frontend untuk visibility, required/disabled state dan payload `tarikh`, `tarikh_balik` serta `masa_balik_dijangka`. Tarikh paparan dinormalisasi kepada `YYYY-MM-DD`; `fixed_return_time` mengatasi input pengguna apabila ditetapkan. Jenis custom tidak memerlukan branch berdasarkan type code jika requirement boleh dinyatakan melalui `OUTING_TYPES`.

Jenis production `KLINIK` (`Keluar ke Klinik`) ialah contoh: same-day, tiada input tarikh keluar/balik manual, tetapi masa balik dijangka, lokasi, kenderaan, kelulusan Warden dan selfie diperlukan. UI custom menggunakan `Maklumat Tambahan`; tajuk `Maklumat Pulang Bermalam` kekal khusus untuk `PULANG_BERMALAM`. `earliest_departure_time` kosong bermaksud tiada sekatan masa paling awal. Readiness menolak kombinasi bercanggah seperti `departure_allowed_days` berisi sedangkan `require_leave_date=false`.

### Admin Session Restore

Login Admin dan restore berkongsi pembina payload `{ admin_id: identity, nama_admin: identity, pin }`. Rekod tab minimum `{ identity, pin, expiresAt }` disimpan dalam `sessionStorage` melalui key `eouting_admin_session_v1`; expiry ialah 12 jam absolute dan tidak ditulis semula ketika refresh. PIN Admin tidak masuk `localStorage`, dan sessionStorage tidak dianggap bukti authentication tanpa POST `loginAdmin` ke backend.

Bootstrap memeriksa saved Admin session, menunjukkan loader restore, menjalankan revalidation, membina semula `adminRuntimeCredential`, kemudian mengaktifkan shell. Ia tidak menunggu `getStudents`, `getWardens`, `getGuards` atau `getTodayRecords` terlebih dahulu. Default Admin section dimulakan selepas auth dan section lain dimuat secara lazy apabila dibuka; Tetapan Outing tidak lagi dimuat unconditional semasa restore.

Loader authentication yang sama meliputi login/restore Pelajar, Warden, Guard dan Admin. Operation token menghalang kerja lama menyembunyikan loader operasi lebih baharu; success, failure dan logout membersihkannya. Animasi CSS Clay-style menghormati `prefers-reduced-motion`, dan Public Pemantauan tidak menggunakan loader authenticated ini.

```text
Production v2.2.0: config-driven rendering + validation + dynamic consumers
Configuration:     OUTING_TYPES authoritative; Admin Tetapan Outing
Feature flag:      OUTING_CONFIG_V2_ENABLED=true; readiness Ready
```

## Boundary API

### Public GET

`GET getStudents` memulangkan direktori login minimum:

```text
student_id | nama | kelas
```

`GET getTodayRecords` memulangkan Public Monitoring minimum:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

`GET getOutingStats` memulangkan kiraan agregat sahaja. Ia tidak memulangkan row mentah, leaderboard individu, nama atau nombor matrik.

`GET getOutingTypes` memulangkan projection konfigurasi yang selamat. Selagi feature flag bukan `true`, ia memulangkan lima konfigurasi legacy daripada code. Apabila flag `true`, hanya row aktif dipulangkan mengikut `sort_order`; metadata version/audit/Admin tidak didedahkan.

### Authenticated POST

`POST getTodayRecords` mengesahkan credential sebenar dan boleh menyertakan nested `operational_urgency` yang role-safe:

- Pelajar: `student_id` + `no_matrik`, kemudian hanya rekod pelajar itu dipulangkan.
- Warden: nama Warden + PIN, kemudian rekod operasi penuh dipulangkan.
- Guard: nama Guard + PIN, kemudian rekod operasi penuh dipulangkan.

Jika credential operasi hilang atau salah, request gagal secara terkawal. Frontend tidak fallback kepada GET awam.

`POST getStudentAnnualSummary` mengesahkan Pelajar aktif menggunakan `student_id` + `no_matrik`. Satu set row `SELESAI` bagi tahun semasa menjadi sumber bersama bagi `total_outings` dan `history_records`, jadi kiraan dan senarai tidak boleh menggunakan scope berlainan. Setiap item sejarah hanya mengandungi:

```text
tarikh | jenis_permohonan | status
```

Row disusun paling baharu dahulu. Data tujuan, lokasi, kenderaan, approval, Guard, waris dan selfie tidak termasuk dalam response ini.

Action write lain kekal melalui POST:

- `submitRequest`
- `cancelStudentRequest`
- `approveRequest`
- `rejectRequest`
- `confirmOut`
- `confirmIn`
- `submitReturnSelfie`
- `loginAdmin`
- `getAdminOutingTypes`
- `createOutingType`
- `updateOutingType`
- `toggleOutingType`

Admin action mengesahkan `admin_id` atau `nama_admin` bersama PIN aktif pada setiap request. Create/update/toggle menggunakan `LockService`. Update dan toggle memerlukan `expected_config_version`; mismatch menghasilkan `CONFIG_VERSION_CONFLICT`.

## Aliran Data Utama

```text
Pelajar login -> submitRequest -> OUTING_REQUESTS
  -> Telegram permohonan
Pelajar login/Refresh Status -> POST getTodayRecords -> Status Semasa live/current
Pelajar login/Refresh Status -> POST getStudentAnnualSummary
  -> jumlah tahunan + Rekod Outing Saya daripada scope SELESAI tahun semasa yang sama
Pelajar login -> cancelStudentRequest -> DIBATALKAN_PELAJAR
  -> AUDIT_LOG + satu notifikasi Telegram non-blocking
Warden login -> POST getTodayRecords -> approve/reject
  -> Telegram keputusan
Guard login -> POST getTodayRecords -> confirmOut/confirmIn
  -> Telegram pergerakan
Pelajar login -> compress 3:4 -> submitStudentProfilePhoto -> STUDENTS metadata
Student/Warden/Guard/Admin -> POST getStudentProfilePhotos photo_variant=thumbnail (batch authenticated)
  -> Drive API v3 thumbnailLink server-side -> OAuth fetch -> safe thumbnail data URI
Authorised thumbnail click -> POST getStudentProfilePhotos photo_variant=full (one student)
  -> thumbnail/loading modal -> full stored image -> authenticated session cache
Pelajar selepas confirmIn -> kamera/preview/compress -> submitReturnSelfie
  -> LockService -> Drive private -> Telegram sendPhoto -> metadata Sheet
Public Monitoring -> GET getTodayRecords -> mapPublicMonitoringRecord
```

### Pembatalan Permohonan Pelajar

Pembatalan ialah transition generik berdasarkan status, bukan jenis outing. Semua jenis standard, `KLINIK` dan jenis custom config-driven menggunakan action POST `cancelStudentRequest` yang sama. Pelajar hanya boleh membatalkan rekod sendiri ketika status authoritative ialah `MENUNGGU_KELULUSAN` atau `DILULUSKAN_WARDEN`; sebab 5–500 aksara di-trim dan disahkan semula oleh backend.

Di dalam `ScriptLock`, backend membaca semula row authoritative, menyemak pemilikan dan status, kemudian menukar rekod tanpa delete kepada `DIBATALKAN_PELAJAR` serta menyimpan sebab, masa dan aktor `PELAJAR`. Status ini terminal/non-active: ia tidak menghalang permohonan baharu, tidak memasuki queue Warden/Guard, tidak dianggap sedang keluar dan tidak dikira sebagai outing selesai/berjaya. Approval/rejection Warden dan `confirmOut` Guard turut melakukan revalidation di bawah lock; jika Guard lebih dahulu menukar status kepada `KELUAR`, cancellation gagal dan tidak boleh menimpa state itu.

Selepas transaksi atomic serta audit `CANCEL_STUDENT_REQUEST` selesai, satu notifikasi Telegram dihantar untuk kedua-dua previous status yang dibenarkan. Mesej menggunakan label status mesra pengguna dan mengandungi nama, nombor matrik, jenis, sebab serta masa. Telegram ialah side effect non-blocking: hasil false atau exception hanya dilog sebagai warning, tanpa rollback atau cubaan pendua.

`getOperationalTodayRecords` menambah hanya `has_profile_photo` dan masa kemas kini. Selepas kad operasi dirender dengan placeholder, frontend membuat satu batch `thumbnail` bagi ID unik yang diperlukan. GAS mengesahkan viewer pada setiap request, menyelesaikan file private, mendapatkan `thumbnailLink` melalui Drive API v3 dan memuat turun thumbnail dengan OAuth server-side. Browser tidak menerima file ID, URL Drive, `thumbnailLink` atau token. Cache thumbnail/full, negative entry, single-flight dan version guard adalah berasingan. Kegagalan thumbnail mengekalkan initials tanpa fallback bulk kepada imej 600×800.

Klik thumbnail membuat satu request `full` untuk pelajar itu sahaja jika full-image cache belum tersedia. Modal memaparkan thumbnail/loading dahulu, kemudian menggantikannya dengan imej stored-compressed; pembukaan kedua menggunakan cache sesi. Kegagalan full menunjukkan error/retry selamat. Student editor boleh menggunakan imej penuh sendiri. Hanya thumbnail sebenar ialah button; initials kekal inert. `getTodayRecords` awam kekal pada projection enam medan tanpa metadata atau trigger foto.

## Status Bukti Selfie

Status lifecycle utama tidak berubah:

```text
confirmIn -> status = SELESAI
```

State bukti disimpan secara berasingan:

```text
selfie_status = BELUM_HANTAR
  -> submitReturnSelfie berjaya -> SUDAH_HANTAR
ATAU selfie_status = TIDAK_DIPERLUKAN
```

Rekod lama tanpa `selfie_status` kekal boleh dibaca. Rekod `SELESAI` yang mempunyai `masa_masuk` tetapi tiada metadata selfie dianggap belum menghantar bukti. `LockService` meliputi semakan duplicate, simpanan Drive, penghantaran Telegram dan kemas kini Sheet. Jika transaksi separa gagal, fail Drive dan/atau mesej Telegram dibersihkan; selepas Sheet berjaya ditanda lengkap, kegagalan `AUDIT_LOG` tidak mengubah hasil.

## Status dan Paparan

Nilai lifecycle backend:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `DIBATALKAN_PELAJAR` — terminal/non-active, dipaparkan sebagai `Dibatalkan oleh Pelajar`
- `KELUAR`
- `SELESAI`

Helper pusat frontend membentuk paparan kontekstual tanpa mengubah nilai backend. Bagi `Status Semasa` Pelajar, lifecycle ini dirender berasingan daripada state authoritative `operational_urgency`:

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar untuk Outing Biasa/Outing Sabtu atau Ahad/Kecemasan
- 🌙 Sedang Bermalam untuk Pulang Bermalam
- 🏖️ Sedang Bercuti untuk Cuti Semester
- ✅ Sudah Pulang
- 🔴 Lewat, dengan precedence tertinggi

Status kosong atau tidak dikenali dipaparkan sebagai `Status Tidak Diketahui`; ia tidak dipetakan kepada `MENUNGGU_KELULUSAN`. Helper daypart BM menggunakan `01:00–11:59` Pagi, `12:00–12:59` Tengah Hari, `13:00–18:59` Petang dan `19:00–00:59` Malam. Formatter locale lain masih boleh menggunakan singkatan seperti `PTG`.

Kiraan dan filter operasi terus menggunakan nilai `record.status`, termasuk satu kiraan gabungan `KELUAR`.

## Warden dan Guard

Warden dan HEP berkongsi role operasi backend `warden`. Role paparan staff diperoleh daripada row WARDENS yang telah diautentikasi: `HEP-*` → `HEP`, `W-*` → `WARDEN`, ID legacy/tidak dikenali → `WARDEN`. Frontend tidak menentukan role ini. Nilai lifecycle kekal `DILULUSKAN_WARDEN`, manakala paparan, audit dan Telegram menggunakan label aktor yang diselesaikan. Mereka menerima rekod operasi penuh melalui POST authenticated untuk Dashboard, approve/reject dan Checklist Permohonan.

Guard menerima rekod operasi penuh melalui POST authenticated. Quick filter Guard ialah Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat, dan digunakan pada `Sedia Untuk Keluar` serta `Sedang Keluar`.

## Public Monitoring

Public Monitoring v1.6.25 sentiasa menggunakan GET awam khusus dan dirender inline dalam shell landing, walaupun sesi Warden/Guard wujud. Lifecycle menggunakan scroll sasaran, loading jelas dan single-flight guard. Satu response menghasilkan satu render; timestamp dan `monitorHasLoadedOnce` hanya dikemas kini selepas berjaya.

Paparan terdiri daripada:

- kad ringkasan status;
- `Senarai Status Semasa` dengan nama, kelas, jenis permohonan, ikon dan status kontekstual.

Tiada kad `Rekod Hari Ini`, quick filter monitoring atau seksyen pendua `Belum Pulang Ke Asrama`.

Public Monitoring tidak merender `profilePhotoMarkup`, data URI, thumbnail atau preview trigger.

## PWA dan Cache

Displayed version kekal konsisten pada `APP_VERSION`, footer dan `version.json`. Cache/asset source semasa ialah `eouting-cache-v2.4.0-r1` dan query `2.4.0-r1`. Cache operasi backend 20 saat menyimpan source row sahaja; urgency sentiasa diterbitkan selepas cache read menggunakan masa semasa.

Service worker tidak membaca atau menulis response API/GAS, external request atau imej selfie sensitif dalam Cache Storage. Semasa activate, cache lama eOuting dibuang dan client semasa dituntut. Static app shell kekal cacheable. Popup `Update Available` kekal bergantung pada flow update sedia ada.

## Submission Validation v2.0 — Fasa 5B

`submitRequest` kini mempunyai dua laluan backend yang dipilih hanya oleh Script Property:

```text
OUTING_CONFIG_V2_ENABLED !== "true"
  -> validator legacy v1.7.1 yang sedia ada

OUTING_CONFIG_V2_ENABLED === "true"
  -> resolve type_code case-insensitive daripada OUTING_TYPES
  -> sahkan row config secara ketat dan active
  -> validate tarikh, masa, hari dan field wajib di server
  -> duplicate check dan append/audit/Telegram sedia ada
```

Frontend tidak menentukan authorization atau validation akhir. Config yang dihantar client tidak dipercayai; resolver sentiasa membaca `OUTING_TYPES`. Sheet hilang, jenis hilang/inactive atau config malformed gagal tertutup. Feature flag production ialah `true`; rollback kepada validator legacy dilakukan dengan menetapkannya kepada `false` tanpa redeployment.

`confirmOut` turut menyemak tarikh keluar yang diluluskan, configured departure day dan earliest departure time. Policy error yang sepadan dipaparkan kepada Guard dalam wording Melayu yang diallowlist; network/internal error kekal generik dan stack detail tidak didedahkan.

Semakan active request serta append submission berada dalam satu `ScriptLock`. Status `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR` menghalang duplicate; `SELESAI`, `DITOLAK_WARDEN` serta `DIBATALKAN_PELAJAR` tidak. Frontend juga menggunakan satu in-flight lock dan loading feedback. Action approve/reject Warden serta confirm-out/confirm-in Guard mempunyai lock UI masing-masing untuk menolak klik berganda tanpa mengubah boundary backend.

Status awal `submitRequest` disahkan sebelum write. `appendObjectRow_` membina row daripada nama header sebenar pada Sheet, bukan kedudukan object, kemudian submission membaca semula row persisted untuk mengesahkan status authoritative. Ini mengekalkan compatibility jika susunan header berbeza tanpa memperkenalkan schema atau lifecycle baharu.

## Operasi Admin

Shell Admin dan identiti sesi kekal visible apabila tujuh modul inline bertukar: `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`. Statistik menggunakan active-tab yang sama seperti modul lain dan tidak lagi mempunyai workspace atau butang kembali berasingan.

Pemantauan Admin menggunakan satu POST `getAdminMonitoring` untuk KPI dan rekod operasi aktif. Rekod Master menggunakan satu POST `searchAdminMasterRecords` dengan carian, filter dan pagination maksimum 50 rekod. Statistik individu menggunakan `getAdminIndividualStats` selepas credential Admin disahkan. Pengurusan staff menggunakan `getAdminStaff` serta write `createStaff`, `updateStaff` dan `toggleStaffStatus`; semua endpoint memanggil `validateAdminCredentials_()`.

`WARDENS` dan `GUARDS` kekal source of truth serta login Warden/Guard sedia ada terus membaca PIN dari tab masing-masing. Write staff dilindungi `LockService`; tiada model authentication atau sheet baharu diperkenalkan.

## UI Runtime Safeguards

Login Pelajar, Warden/HEP, Guard dan Admin serta editor Admin yang selamat menggunakan submit form sedia ada apabila Enter ditekan pada input satu baris. Tiada handler Enter global; textarea kekal newline dan action operasi/destructive memerlukan button/confirmation explicit. Lock disabled/loading sedia ada mencegah duplicate submission.

KPI yang sesuai menggunakan count-up kira-kira 450 ms daripada nilai lama kepada integer akhir tepat. Nilai tidak berubah tidak replay, `prefers-reduced-motion` memintas animasi, dan identifiers, tarikh, masa, telefon, pagination serta duration string tidak dianimasikan.
