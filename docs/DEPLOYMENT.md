# Deployment eOuting ITU

Versi repo semasa: **v2.0.0**. Backend production GAS **Version 24** telah dideploy dan smoke-tested bersama Spreadsheet serta login Admin sebelum release frontend ini.

## Rekod Rollout Production v2.0.0 — 4 Ogos 2026

- Frontend production: `https://itumelaka.github.io/eouting/`.
- Merge commit production: `4eedcbe` — `release: deploy eOuting v2.0.0`.
- Footer production memaparkan `v2.0.0`; badge `BETA API` tidak dipaparkan dan data production digunakan.
- Admin production login berjaya; flow Pelajar, Warden dan Guard berjaya dimuatkan.
- Public Monitoring berjaya pada klik pertama, Statistik berjaya dimuatkan dan auto-scroll mobile berjalan lancar.
- Backend kekal GAS deployment **Version 24**; nombor versi frontend dan GAS ialah dua version boundary yang berasingan.
- `OUTING_CONFIG_V2_ENABLED=false`; `submitRequest` production masih menggunakan validation legacy.
- `TELEGRAM_ENABLED=true` kekal aktif.
- Suite automatik penuh lulus **177/177** sebelum deployment.

Rollout ini tidak mengaktifkan config-driven submission dan tidak menukar endpoint production.

## Fasa 5B Belum Diaktifkan

Kod backend config-driven submission sudah tersedia di branch v2.0 tetapi `OUTING_CONFIG_V2_ENABLED` mesti kekal `false` sehingga migration live, semakan lima seed, backup dan QA rollback diluluskan. Jangan mengaktifkan flag sebelum versi GAS yang mengandungi resolver Fasa 5B dideploy dan `OUTING_TYPES` disahkan lengkap.

Urutan activation masa hadapan ialah: backup Sheet, jalankan migration idempotent, semak config active/schema, deploy GAS, uji legacy dengan flag `false`, aktifkan flag dalam tetingkap terkawal, kemudian uji submit/duplicate/Warden/Guard. Rollback segera hanya memerlukan flag dikembalikan kepada `false`; jangan padam tab atau rekod lama. Tiada langkah ini dilakukan dalam Fasa 5B semasa.

## Release Beta v2.0

Runbook authoritative ialah [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md). Metadata runtime, `version.json`, footer, query CSS/JS, `CACHE_NAME`, app-shell URLs dan regression expectation kini diselaraskan secara atomik kepada `v2.0.0`.

Beta pertama hendaklah menguji lima seed sahaja. Jenis custom, statistik dinamik, label Telegram dinamik dan penggunaan operasi `require_selfie` belum menjadi gate yang lengkap. `require_warden_approval=false` juga perlu dianggap high-impact kerana backend akan auto-approve sebagai `AUTO_CONFIG_V2`.

Keutamaan persekitaran ialah salinan Spreadsheet dan deployment GAS beta berasingan. Jika beta perlu menggunakan data production, backup, tetingkap perubahan, pemilik rollback dan kill switch flag mesti disahkan sebelum migration.

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

v1.6.24 ialah frontend-only release untuk Guard quick filter dan contextual empty-state. v1.7.0 bukan frontend-only kerana melibatkan GAS, schema berasaskan header, Google Drive dan Telegram. v1.7.1 turut mengubah frontend dan GAS bagi `OUTING_HUJUNG_MINGGU`, maka ia bukan frontend-only.

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

## Migration staging eOuting v2.0

Fasa 2 menyediakan `setupAdminOutingConfigV200()` tetapi tidak mengarahkan deployment production. Apabila fasa deployment diluluskan kemudian:

1. backup Spreadsheet;
2. sahkan code GAS yang akan dideploy dan `OUTING_CONFIG_V2_ENABLED` belum bernilai `true`;
3. jalankan `setupAdminOutingConfigV200()` sekali;
4. sahkan tab `OUTING_TYPES` mempunyai 26 header dan tepat lima seed unik;
5. sahkan tab `ADMIN_USERS` hanya mempunyai tujuh header tanpa akaun seed;
6. sahkan `entity_type` dan `entity_id` ditambah selepas header lama `AUDIT_LOG` serta row lama tidak berubah;
7. jalankan migration kali kedua dan sahkan `created_type_codes` kosong;
8. sahkan Script Property `OUTING_CONFIG_V2_ENABLED=false`;
9. uji semula `submitRequest` v1.7.1 sebelum mempertimbangkan activation pada fasa lain.

Jangan isi akaun Admin, mengaktifkan feature flag atau menganggap schema staging sebagai authorization boundary. Rollback Fasa 2 tidak boleh memadam tab/kolum yang mungkin sudah mengandungi data; matikan flag dan kembali kepada deployment stabil sambil mengekalkan data additive.

### Pemeriksaan Fasa 3 sebelum deployment masa hadapan

- Pastikan `OUTING_CONFIG_V2_ENABLED=false`; public `getOutingTypes` mesti memulangkan fallback legacy.
- Sahkan tiada akaun Admin contoh atau PIN berada dalam repo, test log atau deployment output.
- Isi akaun Admin sebenar hanya melalui Sheet private dan formatkan PIN sebagai Plain text.
- Uji login berjaya, PIN salah, Admin tidak aktif, optimistic conflict dan audit tanpa PIN.
- Sahkan create/update/toggle hanya melalui POST; jangan buka write action melalui GET.
- Sahkan tiada route delete dan `submitRequest` masih tidak membaca `OUTING_TYPES`.
- Jangan aktifkan flag sehingga Admin UI, config-driven form dan rollback production diluluskan pada fasa lain.

### Pemeriksaan Fasa 4 sebelum deployment masa hadapan

- Uji role dan panel login Admin pada desktop serta telefon.
- Pastikan DevTools localStorage/sessionStorage tidak mengandungi Admin PIN atau session Admin.
- Pastikan refresh browser selepas login memerlukan login Admin semula.
- Uji loading, empty, error, retry, create, edit, toggle dan conflict state.
- Pastikan tiada delete control dan tiada data `ADMIN_USERS` dipaparkan.
- Feature flag mesti kekal `false`; Admin Dashboard boleh menyediakan config tanpa menukar student form production.
- Deployment Fasa 4 memerlukan frontend dan GAS Fasa 3 serasi, tetapi tidak termasuk live migration atau activation tanpa kelulusan berasingan.

## Urutan Deployment v1.7.0

1. Kemas kini `gas/Code.gs` dan semak syntax.
2. Push/salin code GAS ke project production.
3. Jalankan `setupSelfieProofV170()` sekali menggunakan akaun yang mempunyai akses Spreadsheet dan Drive.
4. Semak summary setup, pastikan lima header wujud dan sahkan Script Property `SELFIE_FOLDER_ID` menunjuk ke folder `eOuting - Bukti Selfie Pulang`.
5. Sahkan `TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` tanpa mencetak nilainya ke log.
6. Apps Script: `Deploy -> Manage deployments -> Edit -> New version -> Deploy`; kekalkan deployment URL.
7. Merge/publish frontend ke GitHub Pages.
8. Sahkan popup update, footer, query asset dan cache menggunakan versi release yang sama.
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
