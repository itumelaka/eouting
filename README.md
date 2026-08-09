# eOuting ITU

eOuting ITU ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Versi repo semasa: **v2.1.0 — Statistik Selamat dan Operasi Guard Diperkemas**.

- Frontend/PWA: [GitHub Pages](https://itumelaka.github.io/eouting/)
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets
- Notifikasi: Telegram Bot melalui GAS
- Repo: [itumelaka/eouting](https://github.com/itumelaka/eouting)

## Status Production v2.1.0

Frontend production v2.1.0 diterbitkan melalui commit `chore: bump eOuting version to 2.1.0` (commit release ini). Production berada di [https://itumelaka.github.io/eouting/](https://itumelaka.github.io/eouting/) dan menggunakan endpoint GAS sedia ada.

Backend production semasa menggunakan GAS **Version 31**, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`. `gas/Code.gs` kekal source GAS executable kanonik dan `.claspignore` mengehadkan push kepada source GAS serta manifest yang dibenarkan.

Landing awam menggunakan empat kad kompak dalam grid 2×2 pada desktop/tablet: `Pelajar`, `Warden & HEP`, `Guard` dan `Pemantauan Semasa`. Pada skrin kecil ia menggunakan susunan satu kolum. Public Statistik telah dibuang; `Pemantauan Semasa` dibuka inline dalam shell landing dan kekal tanpa foto profil.

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
  -> Warden luluskan atau tolak
  -> Guard sahkan keluar
  -> Guard sahkan masuk
  -> status utama kekal SELESAI
  -> Pelajar ambil dan hantar bukti selfie pulang
```

## Bukti Pulang Asrama v1.7.0

Bukti selfie pulang diwajibkan selepas Guard mengesahkan masuk untuk semua jenis permohonan:

- `OUTING_BIASA`
- `OUTING_HUJUNG_MINGGU`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Selepas `confirmIn`, status utama rekod kekal `SELESAI` dan `selfie_status` menjadi state bukti yang berasingan. Pelajar melihat `Ambil Selfie & Lapor Pulang`, menggunakan kamera depan jika disokong, menyemak preview, mengambil semula jika perlu dan menghantar gambar. Frontend mengecilkan sisi terpanjang kepada kira-kira 1280px dan memampatkan kepada JPEG sebelum memanggil `submitReturnSelfie`.

Backend menyemak pemilikan melalui `student_id` + `no_matrik`, status `SELESAI`, kewujudan `masa_masuk`, MIME/base64 dan duplicate submission. Gambar disimpan secara private dalam folder Drive `eOuting - Bukti Selfie Pulang` dan dihantar sebagai imej sebenar ke Telegram melalui `sendPhoto`. Public Monitoring tidak menerima URL, file ID, nombor matrik atau metadata selfie.

## Foto Profil Pelajar

Pelajar berautentikasi boleh menambah atau mengganti foto profil sendiri. Frontend menerima JPEG, PNG atau WebP sehingga 2 MB, memotong paparan tengah kepada nisbah 3:4 dan mengecilkan kepada maksimum kira-kira 600×800 sebelum menghantar JPEG termampat. Metadata private disimpan pada `STUDENTS.photo_file_id` dan `STUDENTS.photo_updated_at`; base64 tidak disimpan dalam Sheet.

Warden/HEP, Guard dan Admin mengambil foto kompak melalui satu POST batch berautentikasi. API operasi hanya membawa indikator `has_profile_photo`; Public Monitoring dan semua GET awam tidak menerima foto, Drive ID atau metadata foto. Fail berada dalam folder private `eOuting - Foto Profil Pelajar` yang ditetapkan melalui `PROFILE_PHOTO_FOLDER_ID`. Foto profil tidak menggunakan field, folder atau Telegram workflow bukti selfie pulang.

Thumbnail sebenar boleh dibuka sebagai preview besar oleh Pelajar sendiri, Warden/HEP, Guard dan Admin yang telah dibenarkan. Preview menggunakan data URI 600×800-ish yang sudah berada dalam cache authenticated, tidak membuat request tambahan, tidak membuka tab baharu dan tidak mendedahkan URL atau ID Drive. Placeholder initials tidak boleh diklik. Modal menyokong butang tutup, klik backdrop, kekunci Escape, scroll lock dan pemulangan fokus.

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

Baseline release v2.0.0 ialah **177/177 lulus**. Syntax checks:

```powershell
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw | node --check -
```

## Modul Operasi Admin v2.1.0

Dashboard Admin mengekalkan shell dan enam modul inline dalam urutan dua baris: `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar` dan `Tetapan Outing`. Statistik tidak mempunyai workspace awam atau shell berasingan; agregat, filter bulan/tahun/kelas dan statistik individu hanya dimuat melalui sesi Admin. Rekod Master menyediakan carian/filter/pagination, Pemantauan ialah paparan operasi baca sahaja, dan jumlah outing tahunan turut dipaparkan kepada Pelajar. Endpoint Admin mengesahkan credential menggunakan `validateAdminCredentials_()` pada setiap permintaan.

Identiti staff kekal menggunakan tab `WARDENS` dan `GUARDS` sedia ada; tiada tab atau migration baharu diperlukan. Admin boleh menetapkan PIN semasa create atau reset melalui edit, tetapi PIN sedia ada tidak pernah dipulangkan ke frontend atau dimasukkan dalam audit. Perubahan staff direkod sebagai `CREATE_STAFF`, `UPDATE_STAFF`, `ACTIVATE_STAFF`, `DEACTIVATE_STAFF` dan `RESET_STAFF_PIN`.

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

Rollout awal production v2.0.0 menggunakan GAS **Version 24**. Production semasa ialah **Version 31**; `OUTING_CONFIG_V2_ENABLED` kekal `false` sehingga pengaktifan berasingan diluluskan. Preview foto dalam perubahan semasa ialah frontend-only dan tidak memerlukan setup helper atau deployment GAS baharu.

Lihat dokumentasi lanjut dalam [`docs/`](docs/), khususnya [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md), [Security](docs/SECURITY.md) dan [Local Development](docs/LOCAL_DEV.md).
