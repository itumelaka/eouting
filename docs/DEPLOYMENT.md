# Deployment eOuting ITU

Versi live semasa: **v1.7.0**. Backend production menggunakan GAS **Version 21**, dideploy pada **26 Jul 2026**.

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

v1.6.24 ialah frontend-only release untuk Guard quick filter dan contextual empty-state. v1.7.0 bukan frontend-only kerana melibatkan GAS, schema berasaskan header, Google Drive dan Telegram.

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

## Urutan Deployment v1.7.0

1. Kemas kini `gas/Code.gs` dan semak syntax.
2. Push/salin code GAS ke project production.
3. Jalankan `setupSelfieProofV170()` sekali menggunakan akaun yang mempunyai akses Spreadsheet dan Drive.
4. Semak summary setup, pastikan lima header wujud dan sahkan Script Property `SELFIE_FOLDER_ID` menunjuk ke folder `eOuting - Bukti Selfie Pulang`.
5. Sahkan `TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` tanpa mencetak nilainya ke log.
6. Apps Script: `Deploy -> Manage deployments -> Edit -> New version -> Deploy`; kekalkan deployment URL.
7. Merge/publish frontend ke GitHub Pages.
8. Sahkan popup update, footer `eOuting ITU • v1.7.0`, query asset dan cache v1.7.0.
9. Jalankan ujian hujung-ke-hujung: submit request, Warden approve, Guard confirm out/in, Pelajar hantar selfie, kemudian sahkan Sheet, Drive dan Telegram.

Production semasa telah melalui urutan ini dan menggunakan GAS Version 21. Pull Request #1 telah digabungkan ke `main` melalui merge commit `beec1e0`.

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

Untuk v1.7.0, pastikan:

- `APP_VERSION = "1.7.0"`;
- cache ialah `eouting-cache-v1.7.0`;
- query string CSS/JS ialah `v=1.7.0`;
- footer menunjukkan v1.7.0;
- `version.json` menggunakan tarikh dan release note yang betul;
- API/GAS, external request dan imej selfie sensitif tidak dicache oleh service worker;
- keseluruhan suite menunjukkan **59/59 lulus**.

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
- `submitReturnSelfie` menolak pemilikan/status/input yang tidak sah dan duplicate submission;
- imej berada dalam folder Drive private dan Telegram menerima foto sebenar;
- Public Monitoring tidak mengandungi metadata selfie.

Jika PWA masih menggunakan asset lama, semak cache name dan asset query strings dahulu. Jangan ubah deployment URL atau menambah `skipWaiting` automatik jika popup update semasa bergantung pada tindakan pengguna.

## Caution dan Rollback

- Jangan rollback frontend sahaja jika backend/schema v1.7.0 masih menerima submission selfie tanpa menilai compatibility.
- Jangan padam lima header selfie atau `SELFIE_FOLDER_ID` semasa rollback; data production dan fail sedia ada perlu dipelihara.
- Jangan jadikan folder Drive public untuk memudahkan rollback atau debugging.
- Jika deployment GAS baharu bermasalah, pilih semula version deployment terakhir yang diketahui stabil sambil mengekalkan URL, kemudian uji semua flow.
- Jangan retry secara manual dengan mengubah `selfie_status` selepas hasil separa tanpa memeriksa Sheet, Drive dan Telegram; cleanup/idempotency perlu kekal authoritative.
