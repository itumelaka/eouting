# Architecture eOuting ITU

Versi repo semasa: **v2.2.0** dengan cache frontend `2.2.0-r4`. Production menggunakan GAS Version 37, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint Web App production sedia ada. Config-driven mode kekal aktif dan ready sejak 10 Ogos 2026. Backend kanonik ialah `gas/Code.gs`; snapshot `gas/Code.production-v171.gs` bukan source deploy.

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

Frontend mengurus grid landing kompak 2×2, borang Pelajar, Dashboard Warden/HEP dan Guard, Public Monitoring read-only yang dibuka inline, tujuh modul Admin inline termasuk `Notis Banner`, update PWA serta input kamera/file untuk foto profil dan bukti pulang. Statistik tidak mempunyai laluan awam dan kekal di dalam shell Admin. Foto profil dipotong 3:4 dan dikecilkan kepada maksimum kira-kira 600×800; selfie kekal pada resize sisi terpanjang kira-kira 1280px. Frontend role hiding bukan boundary keselamatan.

### GAS Router

`gas/Code.gs` menyediakan `doGet(e)` dan `doPost(e)`. Backend membaca dan menulis Google Sheets, mengesahkan credential, menguatkuasakan transition status, menyimpan selfie ke Google Drive, menulis audit log dan menghantar Telegram.

Telegram ialah side effect non-blocking bagi notifikasi lifecycle biasa. Untuk `submitReturnSelfie`, penghantaran imej melalui `sendPhoto` ialah sebahagian daripada hasil bukti yang diperlukan; kegagalan sebelum transaksi lengkap mencetuskan cleanup Drive/Telegram. Kegagalan audit selepas transaksi utama berjaya hanya diberi amaran dan tidak membatalkan submission.

### Google Sheets

Google Sheets ialah database dan source of truth. Tab utama:

- `STUDENTS`
- `WARDENS`
- `GUARDS`
- `OUTING_REQUESTS`
- `AUDIT_LOG`
- `OUTING_TYPES` — source authoritative konfigurasi outing production
- `ADMIN_USERS` — identiti Admin private

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

Fasa 4 menambah role dan Dashboard Admin pada frontend. Credential Admin disimpan dalam memory runtime sahaja; PIN tidak dimasukkan ke localStorage, log atau DOM selepas login. Dashboard membaca active/inactive config, menyediakan create/edit/toggle terkawal dan menghantar `expected_config_version` untuk update/toggle. Student form masih hard-coded.

Fasa 4.6 menetapkan satu sahaja canonical `apiPost` frontend. Router ini memintas lima action Admin hanya dalam `?mock=1`; selain itu ia menghantar POST `no-store` ke GAS dan menyerahkan semua response kepada `parseApiResponse`. Duplicate dead declaration dibuang tanpa mengubah payload atau call site.

Fasa 5A memuatkan public `GET getOutingTypes` hanya selepas sesi Pelajar dibuka. Dropdown, visibility, required/disabled state, `same_day_only` dan `fixed_return_time` dirender daripada safe config. Kegagalan atau response kosong menggunakan lima legacy config dalam memory; `submitRequest` GAS dan feature flag default tidak berubah.

Foundation departure-rule menambah `departure_allowed_days` dan `earliest_departure_time` pada `OUTING_TYPES` sedia ada. Ia tidak mencipta modul polisi kedua. `allowed_days` serta application window mengawal masa permohonan; medan departure mengawal tarikh keluar yang diminta dan masa paling awal Guard boleh mengesahkan keluar. Enforcement production kini membaca row aktif kerana `OUTING_CONFIG_V2_ENABLED=true`.

Readiness hardening menambah POST Admin-only `getOutingConfigReadiness`. Ia membaca `OUTING_TYPES` tanpa mencipta atau mengubah sheet dan tidak mendedahkan property atau credential. Tetapan Outing memaparkan chip `Config Active`, `Legacy` atau `Config Issue` dengan sebab not-ready yang accessible; tiada control activation. Label config digunakan oleh Student, Telegram, statistik, Rekod Master, filter Admin, Checklist/filter Warden, label kontekstual dan return-selfie eligibility. `require_warden_approval=false` menghasilkan state `DILULUSKAN_WARDEN`, approver `AUTO_CONFIG_V2`, masa approval dan audit `AUTO_APPROVE_REQUEST` yang eksplisit.

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

`POST getTodayRecords` mengesahkan credential sebenar:

- Pelajar: `student_id` + `no_matrik`, kemudian hanya rekod pelajar itu dipulangkan.
- Warden: nama Warden + PIN, kemudian rekod operasi penuh dipulangkan.
- Guard: nama Guard + PIN, kemudian rekod operasi penuh dipulangkan.

Jika credential operasi hilang atau salah, request gagal secara terkawal. Frontend tidak fallback kepada GET awam.

Action write lain kekal melalui POST:

- `submitRequest`
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
- `KELUAR`
- `SELESAI`

Helper pusat frontend membentuk paparan kontekstual tanpa mengubah nilai backend:

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar untuk Outing Biasa/Outing Sabtu atau Ahad/Kecemasan
- 🌙 Sedang Bermalam untuk Pulang Bermalam
- 🏖️ Sedang Bercuti untuk Cuti Semester
- ✅ Sudah Pulang
- 🔴 Lewat, dengan precedence tertinggi

Kiraan dan filter operasi terus menggunakan nilai `record.status`, termasuk satu kiraan gabungan `KELUAR`.

## Warden dan Guard

Warden dan HEP berkongsi role backend `warden`. Mereka menerima rekod operasi penuh melalui POST authenticated untuk Dashboard, approve/reject dan Checklist Permohonan. Checklist menggunakan ikon status kontekstual dan `Copy Senarai Nama`; kad operasi mempunyai identifikasi foto authenticated.

Guard menerima rekod operasi penuh melalui POST authenticated. Quick filter Guard ialah Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat, dan digunakan pada `Sedia Untuk Keluar` serta `Sedang Keluar`.

## Public Monitoring

Public Monitoring v1.6.25 sentiasa menggunakan GET awam khusus dan dirender inline dalam shell landing, walaupun sesi Warden/Guard wujud. Lifecycle menggunakan scroll sasaran, loading jelas dan single-flight guard. Satu response menghasilkan satu render; timestamp dan `monitorHasLoadedOnce` hanya dikemas kini selepas berjaya.

Paparan terdiri daripada:

- kad ringkasan status;
- `Senarai Status Semasa` dengan nama, kelas, jenis permohonan, ikon dan status kontekstual.

Tiada kad `Rekod Hari Ini`, quick filter monitoring atau seksyen pendua `Belum Pulang Ke Asrama`.

Public Monitoring tidak merender `profilePhotoMarkup`, data URI, thumbnail atau preview trigger.

## PWA dan Cache

Displayed version kekal konsisten pada `APP_VERSION`, footer dan `version.json`. Cache/asset source semasa ialah `eouting-cache-v2.2.0-r4` dan query `2.2.0-r4`; revision ini tidak menaikkan aplikasi kepada v2.3.0.

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

## Operasi Admin

Shell Admin dan identiti sesi kekal visible apabila tujuh modul inline bertukar: `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`. Statistik menggunakan active-tab yang sama seperti modul lain dan tidak lagi mempunyai workspace atau butang kembali berasingan.

Pemantauan Admin menggunakan satu POST `getAdminMonitoring` untuk KPI dan rekod operasi aktif. Rekod Master menggunakan satu POST `searchAdminMasterRecords` dengan carian, filter dan pagination maksimum 50 rekod. Statistik individu menggunakan `getAdminIndividualStats` selepas credential Admin disahkan. Pengurusan staff menggunakan `getAdminStaff` serta write `createStaff`, `updateStaff` dan `toggleStaffStatus`; semua endpoint memanggil `validateAdminCredentials_()`.

`WARDENS` dan `GUARDS` kekal source of truth serta login Warden/Guard sedia ada terus membaca PIN dari tab masing-masing. Write staff dilindungi `LockService`; tiada model authentication atau sheet baharu diperkenalkan.

## UI Runtime Safeguards

Login Pelajar, Warden/HEP, Guard dan Admin serta editor Admin yang selamat menggunakan submit form sedia ada apabila Enter ditekan pada input satu baris. Tiada handler Enter global; textarea kekal newline dan action operasi/destructive memerlukan button/confirmation explicit. Lock disabled/loading sedia ada mencegah duplicate submission.

KPI yang sesuai menggunakan count-up kira-kira 450 ms daripada nilai lama kepada integer akhir tepat. Nilai tidak berubah tidak replay, `prefers-reduced-motion` memintas animasi, dan identifiers, tarikh, masa, telefon, pagination serta duration string tidak dianimasikan.
