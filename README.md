# eOuting ITU

eOuting ITU ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Status live semasa: **v1.6.25**.

- Frontend/PWA: [GitHub Pages](https://itumelaka.github.io/eouting/)
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets
- Notifikasi: Telegram Bot melalui GAS
- Repo: [itumelaka/eouting](https://github.com/itumelaka/eouting)

## Architecture Ringkas

```text
Browser / PWA di GitHub Pages
  -> Google Apps Script Web App
    -> Google Sheets
    -> Telegram Bot
    -> AUDIT_LOG
```

Frontend mengurus paparan dan interaksi. GAS menguatkuasakan login, permission tindakan dan lifecycle rekod. Google Sheets ialah source of truth. Kegagalan Telegram tidak membatalkan tindakan utama yang sudah berjaya.

## Role

- **Pelajar:** pilih nama, masukkan nombor matrik, hantar permohonan dan lihat rekod sendiri.
- **Warden:** login nama + PIN, refresh rekod, approve/reject, guna Checklist Permohonan dan salin senarai nama.
- **Guard:** login nama + PIN, lihat `Sedia Untuk Keluar` dan `Sedang Keluar`, kemudian sahkan keluar/masuk.
- **Public Monitoring read-only:** lihat ringkasan dan `Senarai Status Semasa` tanpa tindakan operasi.

## Jenis Permohonan

- `OUTING_BIASA`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Semua jenis menggunakan aliran utama yang sama:

```text
Pelajar hantar permohonan
  -> Warden luluskan atau tolak
  -> Guard sahkan keluar
  -> Guard sahkan masuk
```

Backend menyimpan nilai status asal seperti `KELUAR`. Frontend memaparkan label kontekstual:

| Keadaan | Paparan UI |
|---|---|
| Menunggu kelulusan | 🟡 Menunggu Kelulusan |
| Diluluskan | 🟢 Diluluskan |
| `OUTING_BIASA` / `KECEMASAN` + `KELUAR` | 🚶 Sedang Keluar |
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

Baseline v1.6.25 ialah **40/40 lulus**. Syntax checks:

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

1. jalankan `clasp push`;
2. Apps Script: `Deploy -> Manage deployments -> Edit -> New version -> Deploy`;
3. kekalkan deployment URL;
4. uji `/exec?action=getTodayRecords`;
5. kemudian commit dan push repo.

Lihat dokumentasi lanjut dalam [`docs/`](docs/), khususnya [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md), [Security](docs/SECURITY.md) dan [Local Development](docs/LOCAL_DEV.md).
