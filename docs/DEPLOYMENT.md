# Deployment eOuting ITU

Versi live semasa: **v1.6.25**.

## Frontend-only Release

Gunakan flow ini jika `gas/Code.gs` tidak berubah:

1. bump `APP_VERSION` dalam `assets/app.js`;
2. kemas kini `version.json`;
3. bump `CACHE_NAME` dalam `service-worker.js`;
4. selaraskan query string CSS/JS dalam `index.html` dan app-shell service worker;
5. selaraskan footer dan regression expectation;
6. jalankan keseluruhan test suite, syntax checks dan `git diff --check`;
7. commit perubahan;
8. push ke GitHub;
9. tunggu GitHub Pages dan sahkan versi live/PWA update popup.

v1.6.24 ialah frontend-only release untuk Guard quick filter dan contextual empty-state.

## Backend GAS Release

Gunakan flow ini apabila `gas/Code.gs` berubah:

1. semak syntax GAS secara local;
2. jalankan `clasp push`;
3. buka Apps Script: `Deploy -> Manage deployments -> Edit`;
4. pilih `New version`, kemudian `Deploy`;
5. kekalkan deployment URL sedia ada;
6. uji endpoint live `/exec?action=getTodayRecords`;
7. uji flow authenticated POST yang terlibat;
8. kemudian commit dan push repo.

`clasp push` sahaja tidak menjamin deployment `/exec` menggunakan code baharu. Deployment version baharu tetap diperlukan.

v1.6.25 melibatkan frontend + GAS kerana public response `getTodayRecords` membenarkan nama dalam projection minimum, diikuti lifecycle dan layout Public Monitoring frontend.

## Semakan Release

```powershell
node --test tests/*.test.js
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw | node --check -
Get-Content version.json -Raw | ConvertFrom-Json
git diff --check
git status --short
```

Untuk v1.6.25, pastikan:

- `APP_VERSION = "1.6.25"`;
- cache ialah `eouting-cache-v1.6.25`;
- query string CSS/JS ialah `v=1.6.25`;
- footer menunjukkan v1.6.25;
- `version.json` menggunakan tarikh dan release note yang betul;
- API/GAS tidak dicache oleh service worker.

## Verifikasi Live

Frontend:

- buka `https://itumelaka.github.io/eouting/`;
- semak footer dan update popup;
- buka Public Monitoring sekali dan pastikan loading, scroll, data serta timestamp betul;
- semak Warden dan Guard masih menerima rekod operasi penuh.

Backend:

- GET public hanya mengandungi enam field yang dibenarkan;
- POST Pelajar hanya mengembalikan rekod Pelajar tersebut;
- POST Warden/Guard mengembalikan data operasi selepas credential sah;
- credential salah ditolak tanpa fallback GET.

Jika PWA masih menggunakan asset lama, semak cache name dan asset query strings dahulu. Jangan ubah deployment URL atau menambah `skipWaiting` automatik jika popup update semasa bergantung pada tindakan pengguna.
