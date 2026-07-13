# Local Development dan Testing

Panduan ini merujuk eOuting ITU **v1.6.25**.

## Keperluan

- Git
- Browser
- Python untuk static server
- Node.js untuk test dan syntax checks
- `clasp` untuk perubahan GAS

## Jalankan Frontend

```powershell
python -m http.server 8080
```

Buka `http://localhost:8080/`. Gunakan server HTTP; jangan buka `index.html` secara terus kerana path PWA/service worker berbeza.

Mock mode hanya untuk development/demo dan perlu diaktifkan secara sengaja dengan `?mock=1`. Production tidak boleh fallback senyap kepada data mock.

## Automated Tests

Jalankan keseluruhan suite:

```powershell
node --test tests/*.test.js
```

Baseline release v1.6.25 ialah **40/40 lulus**.

Suite utama:

- `tests/student-directory-security.test.js`: projection direktori Pelajar dan login backend.
- `tests/student-login-dropdown-privacy.test.js`: dropdown nama tanpa nombor matrik.
- `tests/public-monitoring-statistics-security.test.js`: privacy public response, operational POST, credential runtime, statistik agregat dan status kontekstual.
- `tests/guard-quick-filter.test.js`: filter Guard dan contextual empty-state.
- `tests/public-monitoring-lifecycle.test.js`: one-click, scroll, GET awam, single-flight, error/cached refresh dan satu render.
- `tests/public-monitoring-compact-layout.test.js`: layout ringkas, `Senarai Status Semasa`, ringkasan dan isolation Warden/Guard.
- `tests/service-worker-security.test.js`: API network-only, cache cleanup, static cache dan version consistency.

Jalankan satu fail:

```powershell
node --test tests/public-monitoring-lifecycle.test.js
```

## Syntax dan Metadata Checks

```powershell
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw | node --check -
Get-Content version.json -Raw | ConvertFrom-Json
git diff --check
```

Repo tidak mempunyai konfigurasi Markdown lint khusus pada v1.6.25.

## Smoke Test Pelajar

1. Pastikan dropdown memaparkan nama dan filter A2/A3 berfungsi.
2. Pilih pelajar; `student_id` kekal value dalaman.
3. Masukkan nombor matrik betul dan sahkan login berjaya.
4. Cuba nombor matrik salah dan sahkan login ditolak.
5. Hantar permohonan dan semak Rekod Saya.
6. Uji `Ingat peranti ini` dan restore session.

## Smoke Test Warden

1. Login nama + PIN selepas fresh page load.
2. Pastikan Dashboard dan Checklist memuatkan nama sebenar.
3. Semak emoji/label kontekstual.
4. Refresh Permohonan.
5. Uji approve/reject dan Telegram.
6. Pastikan credential hilang menghasilkan error, bukan data Public Monitoring.

## Smoke Test Guard

1. Login nama + PIN.
2. Refresh dan semak `Sedia Untuk Keluar` serta `Sedang Keluar`.
3. Uji filter Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat.
4. Pastikan Outing Harian tidak menangkap Kecemasan.
5. Uji confirm keluar/masuk dan Telegram.

## Smoke Test Public Monitoring

1. Dari halaman utama tekan `Pemantauan Semasa` sekali.
2. Pastikan workspace aktif dan viewport scroll ke atas.
3. Pastikan satu GET `getTodayRecords` dibuat dan tiada POST authenticated digunakan.
4. Semak loading, ringkasan dan `Senarai Status Semasa`.
5. Semak setiap baris: nama, kelas, jenis, ikon dan label kontekstual.
6. Pastikan `Rekod Hari Ini`, quick filter monitor dan `Belum Pulang Ke Asrama` tidak wujud.
7. Klik refresh berulang semasa request aktif dan pastikan tiada overlap.
8. Simulasi refresh gagal dan pastikan data/timestamp lama kekal.

## PWA dan Cache

- Semak footer v1.6.25 dan popup update.
- Semak Cache Storage menggunakan `eouting-cache-v1.6.25`.
- Semak request GAS/API dalam Network dan pastikan ia tidak dimasukkan ke Cache Storage.
- Static HTML/CSS/JS/icon boleh kekal dicache.

## Workflow Git

```powershell
git status --short
git diff
```

Jangan commit token, secret, PIN sebenar, API key atau deployment credential. Untuk backend, `clasp push` mesti diikuti deployment Web App version baharu.
