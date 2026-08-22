# Setup Google Apps Script eOuting ITU

Google Apps Script ialah backend/API antara frontend GitHub Pages, Google Sheets, Google Drive dan Telegram. Repo eOuting v2.4.0 menggunakan backend production GAS Web App **Version 52**, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint sedia ada yang tidak berubah. Manifest kanonik ialah `Asia/Kuala_Lumpur`, runtime `V8`, `ANYONE_ANONYMOUS` dan `USER_DEPLOYING`. `OUTING_CONFIG_V2_ENABLED=true`; config-driven kekal Active + Ready. `NO_GUARD_DEPARTURE_ENABLED` mempunyai safe default false dan kini enabled melalui Admin. Source backend kanonik ialah `gas/Code.gs`; `gas/Code.production-v171.gs` bukan source deploy. Phase 5 scanner production kekal tepat satu trigger `scanReturnOperationalNotifications_` setiap lima minit. Phase 6 Guardian Contact Shortcut dan Generic Application Date Window telah production verified; date window tidak menambah trigger, Script Properties atau schema `OUTING_REQUESTS`.

## Tanggungjawab Backend

- membaca `STUDENTS`, `WARDENS`, `GUARDS` dan `OUTING_REQUESTS`;
- mengesahkan login Pelajar, Warden dan Guard;
- menghalang duplicate active request;
- membatalkan permohonan milik Pelajar secara atomic daripada status menunggu atau diluluskan, tanpa memadam rekod;
- menguatkuasakan approve/reject dan confirm keluar/masuk;
- menguatkuasakan No-Guard fallback generik: request milik Student tidak mengubah lifecycle, Warden authenticated sahaja boleh mengesahkan remote checkout, dan Guard identity tidak difabrikasi;
- menyelesaikan expected-return authoritative dan menerbitkan urgency `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL` atau `ACTION_REQUIRED` bagi rekod aktif `KELUAR`;
- menyediakan projection public minimum dan rekod operasi authenticated;
- menyediakan jumlah serta sejarah minimum authenticated bagi rekod `SELESAI` Pelajar dalam tahun semasa;
- mengira statistik agregat;
- menulis `AUDIT_LOG`;
- menyimpan dan menyediakan satu Notis Banner authenticated melalui Script Properties;
- menghantar notifikasi Telegram;
- mengesahkan, menyimpan dan menghantar bukti selfie pulang.
- mengesahkan upload/removal foto profil serta penghantaran thumbnail batch/full on-demand private kepada viewer yang dibenarkan.

## Router Public GET

`doGet(e)` menyokong action sedia ada seperti:

- `health`
- `getStudents`
- `getWardens`
- `getGuards`
- `getTodayRecords`
- `getOutingStats`

Boundary penting:

- `getStudents` hanya mengembalikan `student_id`, `nama`, `kelas`.
- `getTodayRecords` hanya mengembalikan `nama`, `kelas`, `jenis_permohonan`, `status`, `lewat`, `belum_masuk`.
- `getTodayRecords` awam tidak mengembalikan nested `operational_urgency` atau timing diagnostic tepat.
- `getOutingStats` hanya mengembalikan aggregate structures/counts.

Jangan tambah PII atau metadata operasi kepada response public tanpa security review dan regression test.

## Router Authenticated POST

`doPost(e)` mengendalikan:

- `loginStudent`
- `loginWarden`
- `loginGuard`
- `getTodayRecords` melalui validation operasi
- `submitRequest`
- `cancelStudentRequest`
- `approveRequest`
- `rejectRequest`
- `confirmOut`
- `confirmIn`
- `submitReturnSelfie`

Authenticated `getTodayRecords` mengesahkan:

- Pelajar: `student_id` + `no_matrik`;
- Warden: nama Warden + PIN;
- Guard: nama Guard + PIN.

Pelajar hanya menerima rekod sendiri. Warden dan Guard menerima rekod operasi yang diperlukan. Projection authenticated Pelajar, Warden/HEP, Guard dan Admin boleh menerima nested `operational_urgency`; ia diterbitkan selepas cache source operasi 20 saat dibaca dan tidak dicache sebagai state. Credential tidak lengkap atau salah mesti menghasilkan error; jangan fallback kepada public GET.

## Credential dan Secret

- Jangan hardcode atau commit PIN sebenar.
- Jangan pulangkan PIN melalui response API.
- Jangan cetak credential atau row sensitif ke log/debug output.
- Telegram token dan chat ID mesti berada dalam Apps Script Script Properties.
- Deployment credential kekal di luar repo.

Script Properties Telegram:

```text
TELEGRAM_ENABLED
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Script Property bukti selfie:

```text
SELFIE_FOLDER_ID
```

Script Property foto profil pelajar:

```text
PROFILE_PHOTO_FOLDER_ID=1EpnqLVO8iWHRpF8MuqsyVAN55T7eq5X3
```

Script Property config-driven:

```text
OUTING_CONFIG_V2_ENABLED=true
```

Emergency rollback ialah menukarnya kepada `false`; ini mengaktifkan semula laluan legacy tanpa push atau deployment. Reactivation kepada `true` hanya dibuat apabila chip Admin menunjukkan readiness hijau.

Script Property No-Guard:

```text
NO_GUARD_DEPARTURE_ENABLED=true|false
```

Parser fail closed: missing, malformed atau nilai selain string tepat `"true"` bermaksud disabled. Safe default ialah false; production close-out kini enabled melalui `Admin > Tetapan Outing > Fallback Pengesahan Keluar Tanpa Guard`. Admin mengawal config sahaja dan tidak memperoleh remote checkout authority. Apabila disabled, request/confirmation baharu disekat tetapi audit history kekal.

Script Properties Notis Banner dicipta secara automatik apabila Admin menyimpan buat kali pertama: teks, status aktif/penting, masa dan identiti pengemas kini. Tiada setup property manual atau sheet `ANNOUNCEMENTS` diperlukan. Jika semua property belum wujud, backend menganggap banner tidak aktif. Nilai ini hanya untuk paparan dan tidak menggantikan konfigurasi `OUTING_TYPES`.

Action `getAnnouncementBannerAdmin` dan `updateAnnouncementBanner` memerlukan credential Admin aktif; update direkod sebagai `UPDATE_ANNOUNCEMENT_BANNER`. `getAnnouncementBanner` mengesahkan Student, Warden/HEP, Guard atau Admin dan memulangkan projection viewer-safe sahaja. Public GET tidak menyediakan banner, nama/nilai Script Property tidak didedahkan dan `updated_by` tidak dihantar kepada ordinary viewer. Teks dibatasi kepada 500 aksara dan dirawat sebagai plain text.

Jangan dokumentasi atau commit nilai sebenar token, chat ID atau folder ID. Notifikasi Telegram lifecycle biasa kekal non-blocking. Setiap pembatalan Pelajar yang berjaya daripada `MENUNGGU_KELULUSAN` atau `DILULUSKAN_WARDEN` mencuba tepat satu mesej Telegram selepas transaksi: nama, nombor matrik jika tersedia, jenis outing mesra pengguna, status sebelumnya yang mesra pengguna, sebab dan masa pembatalan. Kegagalan Telegram dicatat mengikut convention backend tetapi tidak menggagalkan atau rollback pembatalan. Percubaan pembatalan yang ditolak tidak menghantar mesej. Untuk `submitReturnSelfie`, `sendPhoto` ialah langkah transaksi yang diperlukan dan kegagalan dikendalikan dengan cleanup.

## Migration Generic Application Date Window

Commit `76c6898` menambah dua header optional di hujung `OUTING_TYPES`:

```text
AC: application_open_date
AD: application_close_date
```

Jalankan `setupAdminOutingConfigV200()` menggunakan source baharu selepas authorization yang sah. Helper `ensureHeaders_()` menjadikan migration idempotent: header hilang ditambah tanpa reorder/destructive rewrite, row sedia ada menerima blank, dan rerun tidak menduplikasi kolum. Fungsi tidak mengisi tarikh production, tidak mengubah `OUTING_REQUESTS` dan tidak menetapkan Script Properties baharu.

Production migration telah berjaya pada 22 Ogos 2026. AC/AD disahkan tepat dan semua row production termasuk `CUTI_SEMESTER` disahkan blank selepas migration serta selepas smoke clear. Konfigurasi tarikh mesti dibuat secara manual melalui Admin hanya apabila polisi operasi memerlukannya.

Validation backend menerima blank atau canonical `YYYY-MM-DD`, menolak tarikh tidak sah dan close-before-open, serta membenarkan same-day range. Enforcement submission menggunakan tarikh `Asia/Kuala_Lumpur`, sempadan inklusif dan berlaku sebelum append. `allowed_days` dan application time window terus diperiksa secara additive.

## Setup Bukti Selfie v1.7.0

Jalankan fungsi berikut sekali selepas code GAS v1.7.0 tersedia:

```javascript
setupSelfieProofV170()
```

Fungsi ini:

1. mencari sheet `OUTING_REQUESTS`;
2. menambah hanya header selfie yang belum wujud;
3. mengekalkan semua kolum dan data lama;
4. mencari atau mencipta folder `eOuting - Bukti Selfie Pulang`;
5. menyimpan folder ID dalam `SELFIE_FOLDER_ID`;
6. memulangkan summary untuk semakan manual.

Fungsi ini idempotent dan tidak perlu dipanggil pada setiap request. Folder Drive mesti kekal private dan hanya dikongsi kepada pentadbir/staf yang benar-benar memerlukan akses. Jangan ubah permission menjadi public atau publicly editable.

## Setup Foto Profil Pelajar

Selepas source GAS baharu tersedia, jalankan sekali:

```javascript
setupStudentProfilePhotos()
```

Helper ini menambah hanya `photo_file_id` dan `photo_updated_at` yang belum wujud, tidak menimpa data pelajar, mengesahkan folder `eOuting - Foto Profil Pelajar`, dan menetapkan `PROFILE_PHOTO_FOLDER_ID` kepada ID yang disahkan jika property masih kosong. Jika property sedia ada berbeza, helper berhenti tanpa menukarnya. Folder tidak dicipta dan tidak dijadikan public oleh code.

Authorization Apps Script diperlukan untuk:

- Spreadsheet (`SpreadsheetApp`) bagi membaca/menulis rekod;
- Google Drive (`DriveApp`) bagi folder dan fail selfie;
- external request (`UrlFetchApp`) bagi Telegram Bot API.
- token Apps Script + `UrlFetchApp` bagi metadata Drive API v3 dan server-side thumbnail download; `thumbnailLink` tidak dihantar ke browser.

Akaun yang menjalankan setup dan deployment perlu meluluskan scope berkaitan sebelum ujian production.

## `clasp` Workflow

Semak whitelist sebenar sebelum push:

```powershell
clasp show-file-status
```

Semak syntax GAS:

```powershell
Get-Content gas/Code.gs -Raw | node --check -
```

`gas/Code.gs` ialah source GAS executable kanonik. `.claspignore` mengehadkan upload kepada fail itu dan `appsscript.json`; jangan letakkan snapshot `.gs` arkib dalam skop clasp kecuali ia diabaikan secara eksplisit. Sebelum version/deploy, validasikan manifest tepat mengekalkan `timeZone=Asia/Kuala_Lumpur`, `runtimeVersion=V8`, `webapp.executeAs=USER_DEPLOYING` dan `webapp.access=ANYONE_ANONYMOUS`. Version 47 membuktikan immutable version boleh gagal walaupun source business logic betul jika Web App block hilang.

Push code:

```powershell
clasp push
```

Kemudian deploy Web App version baharu:

```text
Deploy -> Manage deployments -> Edit -> New version -> Deploy
```

Kekalkan URL deployment sedia ada. `clasp push` tidak menggantikan langkah deployment version.

## Verifikasi Selepas Deployment

1. Uji `/exec?action=health` jika diperlukan.
2. Uji `/exec?action=getTodayRecords` dan sahkan hanya enam field public.
3. Uji `getStudents` dan sahkan nombor matrik tidak wujud.
4. Uji login Pelajar dengan nombor matrik betul dan salah.
5. Uji login Admin serta class options dinamik termasuk contoh non-A2/A3 dengan No-Guard ON dan OFF.
6. Sahkan deployment production sedia ada dikemas kini in-place, `@HEAD` tidak disentuh dan tiada Web App pendua.
7. Sahkan tepat satu trigger `scanReturnOperationalNotifications_` setiap lima minit.
8. Uji Warden/Guard POST `getTodayRecords` dengan credential sah dan tidak sah.
9. Uji approve/reject serta confirm keluar/masuk.
10. Uji pembatalan Pelajar bagi status menunggu dan diluluskan: sebab 5–500 aksara, metadata pembatalan, sejarah, kebolehan memohon semula, serta pengecualian daripada queue Warden/Guard.
11. Semak tepat satu notifikasi Telegram pembatalan bagi setiap transaksi berjaya, termasuk status sebelumnya yang mesra pengguna; simulasi kegagalan Telegram dan sahkan pembatalan kekal berjaya tanpa token didedahkan dalam log.
12. Uji `submitReturnSelfie`, semak folder Drive private dan sahkan Telegram menerima foto melalui `sendPhoto`.
13. Sahkan Public Monitoring tidak mengandungi metadata selfie atau pembatalan.
14. Uji tambah/ganti foto Pelajar, `photo_variant = "thumbnail"` pada Warden/Guard/Admin dan confirmed Admin removal; sahkan folder profil kekal private dan berasingan daripada selfie.
15. Uji klik preview pada Pelajar, Warden/HEP, Guard dan Admin; sahkan modal membuat maksimum satu `photo_variant = "full"` bagi student yang belum dicache, pembukaan kedua menggunakan cache, dan tiada URL/ID Drive didedahkan.
16. Sahkan Public Monitoring tidak mengandungi `has_profile_photo`, `photo_file_id`, `photo_updated_at`, data URI atau trigger preview.
17. Jalankan regression suite repo dan pastikan semua ujian lulus.

Jika `/exec` masih memulangkan behavior lama selepas `clasp push`, semak Manage deployments dan pastikan version baharu telah dipilih.

## Roadmap Keselamatan

PIN ialah basic internal access control, bukan authentication production-grade. Kerja masa hadapan termasuk PIN hashing, Google/domain login dan backend-issued session token.
