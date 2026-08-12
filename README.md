# eOuting ITU

eOuting ITU ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Versi repo semasa: **v2.2.0 — Operasi Bersepadu dan Foto Profil Private Dua Peringkat**.

- Frontend/PWA: [GitHub Pages](https://itumelaka.github.io/eouting/)
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets
- Notifikasi: Telegram Bot melalui GAS
- Repo: [itumelaka/eouting](https://github.com/itumelaka/eouting)

## Status Production v2.2.0

Frontend production v2.2.0 diterbitkan melalui GitHub Pages di [https://itumelaka.github.io/eouting/](https://itumelaka.github.io/eouting/) dan menggunakan endpoint GAS production sedia ada.

Revision aset frontend semasa ialah `2.2.0-r5` dan service worker menggunakan `eouting-cache-v2.2.0-r5`. Revision r5 memastikan mobile/PWA menerima pilihan kamera atau galeri bagi foto profil tanpa menaikkan displayed application version.

Backend production semasa menggunakan GAS **Version 37**, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`. `OUTING_CONFIG_V2_ENABLED=true` telah aktif sejak 10 Ogos 2026 dan `OUTING_TYPES` ialah source authoritative bagi peraturan outing yang disokong. `gas/Code.gs` ialah source GAS executable kanonik dan `.claspignore` mengehadkan push kepada `gas/Code.gs` serta `gas/appsscript.json`. Snapshot lama `gas/Code.production-v171.gs` bukan source kanonik dan tidak boleh dideploy.

Landing awam menggunakan empat kad kompak dalam grid 2×2 pada desktop/tablet: `Pelajar`, `Warden & HEP`, `Guard` dan `Pemantauan Semasa`. Pada skrin kecil ia menggunakan susunan satu kolum. Akses Admin kekal sebagai control kompak berasingan. Public Statistik telah dibuang; `Pemantauan Semasa` dibuka inline dalam shell landing dan kekal tanpa foto profil.

Admin turut mempunyai `Notis Banner` untuk satu makluman operasi global pada satu masa. Admin boleh menetapkan teks, `Penting`, `Aktif`, menyimpan perubahan dan melihat keadaan semasa, timestamp serta identiti pengemas kini. Konfigurasi disimpan dalam Script Properties; property yang belum wujud bermaksud banner tidak aktif dan simpanan Admin pertama mengisinya secara automatik. Tiada sheet `ANNOUNCEMENTS` atau setup Script Property manual diperlukan.

Pelajar, Warden/HEP, Guard dan Admin yang telah disahkan menerima projection selamat melalui POST `getAnnouncementBanner`; Admin menggunakan `getAnnouncementBannerAdmin` dan `updateAnnouncementBanner`. Mutation memerlukan authentication Admin dan direkod sebagai `UPDATE_ANNOUNCEMENT_BANNER`. Public landing serta Public Pemantauan tidak memanggil atau menerima banner. Nama property/secret dan `updated_by` tidak didedahkan kepada viewer biasa. Teks mempunyai had panjang, dirender sebagai plain text dan HTML/script tidak dilaksanakan.

Mod Normal berlabel `MAKLUMAN`, manakala mod Important berlabel `PENTING`. Kedua-duanya menggunakan ticker kiri berterusan yang perlahan dan mudah dibaca, dengan ruang sebelum ulangan serta tanpa `<marquee>`. Hover, fokus papan kekunci dan interaksi sentuh boleh menjeda gerakan; `prefers-reduced-motion` memaparkan teks statik. Susun atur stabil dan kekal mudah dibaca pada mobile.

Banner ialah komunikasi sahaja. Contohnya, teks “Pulang Bermalam dibenarkan keluar mulai jam 2.00 petang.” tidak mengubah `earliest_departure_time`. Admin mesti mengemas kini `Admin > Tetapan Outing > Pulang Bermalam > Masa Keluar Paling Awal` secara berasingan jika enforcement sebenar hendak berubah.

Dalam workspace Pelajar, Announcement Banner menyampaikan notis operasi semasa, manakala `ruleNotice` kuning kekal authoritative untuk panduan peraturan kontekstual. Ayat panduan pendua di bawah “Permohonan Pelajar” telah dibuang; banner, `ruleNotice` dan borang outing kekal.

## Architecture Ringkas

```text
Browser / PWA di GitHub Pages
  -> Google Apps Script Web App
    -> Google Sheets
    -> Google Drive (foto profil dan bukti selfie dalam folder private berasingan)
    -> Telegram Bot
    -> AUDIT_LOG
```

Frontend mengurus paparan, kamera dan pemampatan gambar. GAS menguatkuasakan login, permission tindakan, lifecycle rekod dan penghantaran bukti. Google Sheets ialah source of truth, manakala Google Drive menyimpan selfie secara private. Kegagalan Telegram untuk notifikasi biasa tidak membatalkan tindakan utama; bagi bukti selfie, simpanan Drive, penghantaran `sendPhoto` dan kemas kini Sheet dilindungi dengan cleanup transaksi separa.

## Role

- **Pelajar:** pilih nama, masukkan nombor matrik, hantar permohonan dan lihat rekod sendiri.
- **Warden/HEP:** berkongsi role backend `warden`, login nama + PIN, refresh rekod, approve/reject, guna Checklist Permohonan dan salin senarai nama.
- **Guard:** login nama + PIN, lihat `Sedia Untuk Keluar` dan `Sedang Keluar`, kemudian sahkan keluar/masuk.
- **Admin:** login ID/nama + PIN, urus modul operasi/config, dan memulihkan sesi tab secara selamat selepas refresh melalui revalidasi backend.
- **Public Monitoring read-only:** lihat ringkasan dan `Senarai Status Semasa` tanpa tindakan operasi.

## Jenis Permohonan

- `OUTING_BIASA`
- `OUTING_HUJUNG_MINGGU`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Semua jenis menggunakan aliran utama yang sama:

```text
Pelajar hantar permohonan
  -> Warden luluskan atau tolak (legacy dan config require_warden_approval=true)
     ATAU auto-approve beridentiti AUTO_CONFIG_V2 (config require_warden_approval=false)
  -> Guard sahkan keluar
  -> Guard sahkan masuk
  -> status utama kekal SELESAI
  -> Pelajar hantar bukti selfie jika diwajibkan
```

Frontend membina medan serta payload daripada konfigurasi jenis yang dipilih. `require_leave_date`, `require_return_date`, `require_return_time`, `fixed_return_time`, `same_day_only`, lokasi, kenderaan dan requirement lain menentukan nilai `tarikh`, `tarikh_balik` serta `masa_balik_dijangka`; tarikh dinormalisasi kepada `YYYY-MM-DD`. Jenis custom baharu tidak patut memerlukan branch frontend hard-coded.

Jenis custom production `KLINIK` dipaparkan sebagai **Keluar ke Klinik**. Ia ialah outing hari sama tanpa input tarikh keluar/balik manual, memerlukan masa balik dijangka, lokasi, kenderaan, kelulusan Warden dan selfie pulang. Ruang dinamik menggunakan tajuk neutral `Maklumat Tambahan`; `PULANG_BERMALAM` mengekalkan `Maklumat Pulang Bermalam`. Nilai `earliest_departure_time` kosong bermaksud tiada had masa keluar paling awal dan boleh dikosongkan Admin melalui `Kosongkan`.

Submission Pelajar mempunyai lock in-flight frontend dan loading feedback. Di backend, semakan active request serta append berlaku secara atomic di bawah `ScriptLock`; `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR` menghalang duplicate, manakala `SELESAI` serta `DITOLAK_WARDEN` membenarkan permohonan baharu. Approve/reject Warden dan confirm-out/confirm-in Guard turut mempunyai perlindungan klik berganda semasa action berjalan.

Konfigurasi production membezakan dua konsep:

- **Peraturan permohonan:** `allowed_days`, `application_open_time` dan `application_close_time` menentukan bila pelajar boleh menghantar permohonan.
- **Peraturan keluar:** `departure_allowed_days` dan `earliest_departure_time` menentukan hari serta masa paling awal pelajar yang diluluskan boleh keluar secara fizikal.

Untuk `PULANG_BERMALAM`, pelajar boleh memohon pada mana-mana hari, tetapi tarikh keluar yang diminta kini mesti hari Jumaat dan masa keluar paling awal pada row production ialah `17:00`. Nilai masa ini ialah konfigurasi operasi yang boleh diubah oleh Admin melalui Tetapan Outing mengikut arahan semasa HEP; ia bukan polisi kekal yang hard-coded.

## Bukti Pulang Asrama v1.7.0

Dalam production config-driven, `require_selfie` ialah authoritative dan disnapshot pada rekod semasa submission: `false` menggunakan `TIDAK_DIPERLUKAN`, manakala `true` menjadi `BELUM_HANTAR` selepas `confirmIn`.

- `OUTING_BIASA`
- `OUTING_HUJUNG_MINGGU`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Selepas `confirmIn`, status utama rekod kekal `SELESAI` dan `selfie_status` menjadi state bukti yang berasingan. Pelajar melihat `Ambil Selfie & Lapor Pulang`, menggunakan kamera depan jika disokong, menyemak preview, mengambil semula jika perlu dan menghantar gambar. Frontend mengecilkan sisi terpanjang kepada kira-kira 1280px dan memampatkan kepada JPEG sebelum memanggil `submitReturnSelfie`.

Backend menyemak pemilikan melalui `student_id` + `no_matrik`, status `SELESAI`, kewujudan `masa_masuk`, MIME/base64 dan duplicate submission. Gambar disimpan secara private dalam folder Drive `eOuting - Bukti Selfie Pulang` dan dihantar sebagai imej sebenar ke Telegram melalui `sendPhoto`. Public Monitoring tidak menerima URL, file ID, nombor matrik atau metadata selfie.

Tetapan Outing ialah interface operasi bagi `OUTING_TYPES`. Status readiness dipaparkan sebagai chip kompak dan accessible: `Config Active`, `Legacy` atau `Config Issue`; sebab kegagalan kekal boleh dibuka apabila tidak ready. Production semasa ialah **Config Active · Ready**. Tiada toggle feature flag pada UI.

Jenis aktif dan label config-driven digunakan secara dinamik oleh borang/label Pelajar, Telegram, grouping/filter Statistik, filter Admin, filter/Checklist Warden, label outing kontekstual dan eligibility return-selfie. Konfigurasi aktif tetap mesti lulus readiness validation; jenis custom tidak dianggap selamat tanpa ujian.

Semasa `confirmOut`, GAS menyemak tarikh keluar yang diluluskan, hari keluar yang dibenarkan dan `earliest_departure_time`. Kegagalan polisi dipaparkan kepada Guard dalam wording Melayu yang selamat; error network/internal kekal generik tanpa stack detail. Smoke test 10 Ogos 2026 mengesahkan permohonan untuk 14 Ogos 2026 tidak boleh disahkan keluar pada 10 Ogos 2026 dan Guard menerima maklum balas tarikh yang jelas.

## Foto Profil Pelajar

Pelajar berautentikasi boleh menambah atau mengganti foto profil sendiri. Frontend menerima JPEG, PNG atau WebP sehingga 2 MB, memotong paparan tengah kepada nisbah 3:4 dan mengecilkan kepada maksimum kira-kira 600×800 sebelum menghantar JPEG termampat. Metadata private disimpan pada `STUDENTS.photo_file_id` dan `STUDENTS.photo_updated_at`; base64 tidak disimpan dalam Sheet.

Tindakan foto profil membuka action sheet `Ambil Foto`, `Pilih dari Galeri` dan `Batal`. Kamera menggunakan `accept="image/*"` bersama `capture="user"` untuk mengutamakan kamera depan apabila disokong; galeri menggunakan input berasingan tanpa `capture`. Kedua-duanya masuk ke pipeline validation, crop, compression, upload dan cache yang sama. Return-selfie kekal workflow berasingan.

Satu foto aktif dimaksudkan bagi setiap pelajar. Semasa replacement, fail baharu dicipta dan metadata Sheet di-commit/flush dahulu; hanya selepas itu fail lama yang disahkan berada dalam folder profil ditrash. Admin boleh membuang foto melalui tindakan confirmed berautentikasi.

Warden/HEP, Guard dan Admin mengambil foto kompak melalui satu POST batch berautentikasi dengan `photo_variant = "thumbnail"`. GAS mengesahkan viewer dahulu, mendapatkan `thumbnailLink` melalui Drive API v3 dan memuat turun thumbnail menggunakan OAuth Apps Script pada server. Browser hanya menerima data URI imej selamat; file ID, URL Drive, `thumbnailLink` dan token tidak pernah dipulangkan. API operasi hanya membawa indikator `has_profile_photo`; Public Monitoring dan semua GET awam tidak menerima foto atau metadata foto. Fail berada dalam folder private `eOuting - Foto Profil Pelajar` yang ditetapkan melalui `PROFILE_PHOTO_FOLDER_ID`.

Thumbnail sebenar boleh dibuka sebagai preview besar oleh Pelajar sendiri, Warden/HEP, Guard dan Admin yang telah dibenarkan. Jika imej penuh belum dicache, modal menunjukkan thumbnail/loading kemudian membuat satu request `photo_variant = "full"` untuk pelajar tersebut sahaja. Imej penuh menggantikan thumbnail dan dicache sepanjang sesi; pembukaan kedua tidak membuat request semula. Kegagalan menunjukkan retry selamat. Placeholder initials tidak boleh diklik. Modal menyokong butang tutup, klik backdrop, kekunci Escape, scroll lock dan pemulangan fokus.

Backend menyimpan nilai status asal seperti `KELUAR`. Frontend memaparkan label kontekstual:

| Keadaan | Paparan UI |
|---|---|
| Menunggu kelulusan | 🟡 Menunggu Kelulusan |
| Diluluskan | 🟢 Diluluskan |
| `OUTING_BIASA` / `OUTING_HUJUNG_MINGGU` / `KECEMASAN` + `KELUAR` | 🚶 Sedang Keluar |
| `PULANG_BERMALAM` + `KELUAR` | 🌙 Sedang Bermalam |
| `CUTI_SEMESTER` + `KELUAR` | 🏖️ Sedang Bercuti |
| Sudah pulang | ✅ Sudah Pulang |
| Lewat | 🔴 Lewat |

Status lewat mempunyai precedence paparan tetapi tidak menggantikan nilai lifecycle backend.

## Public Monitoring v1.6.25

Sekali tekan `Pemantauan Semasa`, frontend membukanya inline dalam shell landing dan:

1. mengaktifkan workspace dan menyembunyikan workspace lain;
2. scroll ke permulaan workspace;
3. menunjukkan loading;
4. membuat satu GET awam `getTodayRecords`;
5. memetakan response awam dan merender sekali;
6. mengemas kini timestamp hanya selepas berjaya.

Single-flight guard menghalang klik, refresh manual dan auto-refresh daripada menghasilkan request bertindih. Refresh gagal mengekalkan data lama. Paparan dipadatkan kepada kad ringkasan dan `Senarai Status Semasa`; `Rekod Hari Ini`, quick filter rekod terperinci dan seksyen pendua `Belum Pulang Ke Asrama` telah dibuang.

Setiap baris memaparkan nama sebenar, kelas, jenis permohonan, ikon dan label status kontekstual.

## Boundary Privasi

Public GET `getTodayRecords` hanya mengembalikan enam medan:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Ia tidak mengembalikan `student_id`, `no_matrik`, `request_id`, e-mel, telefon, waris, lokasi, tujuan, kenderaan, PIN, credential, foto profil, Drive ID atau metadata operasi dalaman.

Rekod operasi penuh untuk Pelajar, Warden dan Guard menggunakan POST authenticated yang berasingan. Tiada fallback daripada kegagalan POST operasi kepada data GET awam. Public Monitoring kekal read-only.

Direktori awam `getStudents` pula hanya mengembalikan `student_id`, `nama` dan `kelas`; nombor matrik ditaip berasingan dan disemak terus oleh backend semasa login.

## Guard Quick Filter

Dashboard Guard menggunakan satu filter aktif pada satu masa:

- Semua
- Outing Harian
- Pulang Bermalam
- Cuti Semester
- Kecemasan
- Lewat

Filter digunakan pada kedua-dua seksyen Guard dengan empty-state kontekstual. `Kecemasan` tidak dicampurkan dengan Outing Harian.

## Development dan Test

Jalankan frontend secara local:

```powershell
python -m http.server 8080
```

Jalankan keseluruhan suite:

```powershell
node --test tests/*.test.js
```

Baseline repo yang disahkan pada 12 Ogos 2026 ialah **317/317 lulus**. Syntax checks:

```powershell
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw | node --check -
```

## Modul Operasi Admin v2.2.0

Login Admin menyimpan credential minimum `{ identity, pin, expiresAt }` dalam `sessionStorage` tab di bawah key `eouting_admin_session_v1`, dengan absolute expiry 12 jam yang tidak dilanjutkan oleh refresh. PIN tidak ditulis ke `localStorage`. Refresh memanggil semula `loginAdmin` menggunakan semantic payload yang sama seperti login biasa sebelum shell privileged dipaparkan. Selepas sah, shell Admin muncul dahulu; default section dimuat dan tab lain lazy-load apabila dibuka.

Satu loader authentication/restore Clay-style digunakan oleh Pelajar, Warden, Guard dan Admin untuk login serta restore sebenar. Ia dibuang terus pada success, failure atau logout, menggunakan operation token untuk mengelakkan race, dan menghormati `prefers-reduced-motion`. Public Pemantauan kekal berasingan.

Dashboard Admin mengekalkan shell dan tujuh modul inline: `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`. Statistik tidak mempunyai workspace awam atau shell berasingan; agregat, filter bulan/tahun/kelas dan statistik individu hanya dimuat melalui sesi Admin. Rekod Master menyediakan carian/filter/pagination, Pemantauan ialah paparan operasi baca sahaja, dan jumlah outing tahunan turut dipaparkan kepada Pelajar. Endpoint Admin mengesahkan credential menggunakan `validateAdminCredentials_()` pada setiap permintaan.

Identiti staff kekal menggunakan tab `WARDENS` dan `GUARDS` sedia ada; tiada tab atau migration baharu diperlukan. Admin boleh menetapkan PIN semasa create atau reset melalui edit, tetapi PIN sedia ada tidak pernah dipulangkan ke frontend atau dimasukkan dalam audit. Perubahan staff direkod sebagai `CREATE_STAFF`, `UPDATE_STAFF`, `ACTIVATE_STAFF`, `DEACTIVATE_STAFF` dan `RESET_STAFF_PIN`.

KPI menggunakan animasi count-up halus kira-kira 450 ms daripada nilai sebelumnya kepada integer tepat. Nilai yang tidak berubah tidak dimainkan semula dan `prefers-reduced-motion` dihormati. Animasi tidak digunakan pada ID, tarikh, masa, telefon, pagination atau string tempoh.

Enter menghantar borang login Pelajar, Warden/HEP, Guard dan Admin serta borang tambah/edit Admin yang selamat. Handler menggunakan submit form sedia ada dengan lock disabled/loading; tiada shortcut Enter global. Enter dalam textarea kekal newline, manakala tindakan operasi atau destructive seperti approve, reject, sahkan keluar/masuk, reset PIN dan buang foto kekal explicit.

## Deployment Ringkas

Frontend-only:

1. selaraskan `APP_VERSION`, `version.json`, cache service worker, asset query strings dan footer;
2. jalankan test dan syntax checks;
3. commit dan push;
4. tunggu GitHub Pages dan semak versi live.

Backend GAS:

1. semak Git diff dan jalankan suite/syntax checks;
2. semak whitelist dengan `clasp show-file-status`;
3. commit dan push source yang telah disahkan;
4. jalankan `clasp push` secara manual;
5. jalankan setup helper hanya jika schema atau konfigurasi memerlukannya;
6. dalam Manage deployments pilih `New version` sambil mengekalkan URL production;
7. jalankan smoke test endpoint dan flow hujung-ke-hujung.

Rollout awal production v2.0.0 menggunakan GAS **Version 24**. Production v2.2.0 semasa ialah GAS **Version 37**, `OUTING_CONFIG_V2_ENABLED=true`, readiness hijau dan source frontend menggunakan cache `2.2.0-r5`. Rollback segera boleh dibuat dengan menetapkan property kepada `false`; ia mengembalikan laluan legacy tanpa code push atau GAS deployment.

Lihat dokumentasi lanjut dalam [`docs/`](docs/), khususnya [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md), [Security](docs/SECURITY.md) dan [Local Development](docs/LOCAL_DEV.md).
