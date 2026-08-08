# eOuting ITU

eOuting ITU ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Versi repo semasa: **v2.0.0 — Admin Tetapan Outing dan Pengurusan Pelajar**.

- Frontend/PWA: [GitHub Pages](https://itumelaka.github.io/eouting/)
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets
- Notifikasi: Telegram Bot melalui GAS
- Repo: [itumelaka/eouting](https://github.com/itumelaka/eouting)

## Status Production v2.0.0

Rollout production selesai dan disahkan pada **4 Ogos 2026** melalui merge commit `4eedcbe` (`release: deploy eOuting v2.0.0`). Frontend production berada di [https://itumelaka.github.io/eouting/](https://itumelaka.github.io/eouting/) dan memaparkan footer `v2.0.0` tanpa badge `BETA API`.

Backend production menggunakan GAS **Version 26** setakat **8 Ogos 2026**, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`. `gas/Code.gs` ialah satu-satunya source GAS executable kanonik; snapshot arkib tidak boleh dimasukkan ke dalam skop upload clasp.

## Architecture Ringkas

```text
Browser / PWA di GitHub Pages
  -> Google Apps Script Web App
    -> Google Sheets
    -> Google Drive (bukti selfie private)
    -> Telegram Bot
    -> AUDIT_LOG
```

Frontend mengurus paparan, kamera dan pemampatan gambar. GAS menguatkuasakan login, permission tindakan, lifecycle rekod dan penghantaran bukti. Google Sheets ialah source of truth, manakala Google Drive menyimpan selfie secara private. Kegagalan Telegram untuk notifikasi biasa tidak membatalkan tindakan utama; bagi bukti selfie, simpanan Drive, penghantaran `sendPhoto` dan kemas kini Sheet dilindungi dengan cleanup transaksi separa.

## Role

- **Pelajar:** pilih nama, masukkan nombor matrik, hantar permohonan dan lihat rekod sendiri.
- **Warden:** login nama + PIN, refresh rekod, approve/reject, guna Checklist Permohonan dan salin senarai nama.
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

Sekali tekan `Pemantauan Semasa`, frontend:

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

Ia tidak mengembalikan `student_id`, `no_matrik`, `request_id`, e-mel, telefon, waris, lokasi, tujuan, kenderaan, PIN, credential atau metadata operasi dalaman.

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

## Deployment Ringkas

Frontend-only:

1. selaraskan `APP_VERSION`, `version.json`, cache service worker, asset query strings dan footer;
2. jalankan test dan syntax checks;
3. commit dan push;
4. tunggu GitHub Pages dan semak versi live.

Backend GAS:

1. kemas kini source kanonik `gas/Code.gs`;
2. jalankan `setupSelfieProofV170()` sekali dan sahkan `SELFIE_FOLDER_ID`;
3. sahkan Script Properties Telegram;
4. deploy Web App version baharu sambil mengekalkan URL;
5. publish frontend dan semak footer/popup versi semasa;
6. jalankan ujian hujung-ke-hujung.

Rollout awal production v2.0.0 menggunakan GAS **Version 24** dan telah melalui smoke test Spreadsheet serta login Admin. Deployment semasa telah bergerak ke **Version 26**; `OUTING_CONFIG_V2_ENABLED` kekal `false` sehingga pengaktifan berasingan diluluskan.

Lihat dokumentasi lanjut dalam [`docs/`](docs/), khususnya [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md), [Security](docs/SECURITY.md) dan [Local Development](docs/LOCAL_DEV.md).
