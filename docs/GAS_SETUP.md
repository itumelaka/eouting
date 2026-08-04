# Setup Google Apps Script eOuting ITU

Google Apps Script ialah backend/API antara frontend GitHub Pages, Google Sheets, Google Drive dan Telegram. Backend production eOuting v2.0.0 menggunakan GAS Web App **Version 24** dan telah melalui smoke test Spreadsheet serta login Admin.

## Tanggungjawab Backend

- membaca `STUDENTS`, `WARDENS`, `GUARDS` dan `OUTING_REQUESTS`;
- mengesahkan login Pelajar, Warden dan Guard;
- menghalang duplicate active request;
- menguatkuasakan approve/reject dan confirm keluar/masuk;
- menyediakan projection public minimum dan rekod operasi authenticated;
- mengira statistik agregat;
- menulis `AUDIT_LOG`;
- menghantar notifikasi Telegram;
- mengesahkan, menyimpan dan menghantar bukti selfie pulang.

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
- `getOutingStats` hanya mengembalikan aggregate structures/counts.

Jangan tambah PII atau metadata operasi kepada response public tanpa security review dan regression test.

## Router Authenticated POST

`doPost(e)` mengendalikan:

- `loginStudent`
- `loginWarden`
- `loginGuard`
- `getTodayRecords` melalui validation operasi
- `submitRequest`
- `approveRequest`
- `rejectRequest`
- `confirmOut`
- `confirmIn`
- `submitReturnSelfie`

Authenticated `getTodayRecords` mengesahkan:

- Pelajar: `student_id` + `no_matrik`;
- Warden: nama Warden + PIN;
- Guard: nama Guard + PIN.

Pelajar hanya menerima rekod sendiri. Warden dan Guard menerima rekod operasi yang diperlukan. Credential tidak lengkap atau salah mesti menghasilkan error; jangan fallback kepada public GET.

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

Jangan dokumentasi atau commit nilai sebenar token, chat ID atau folder ID. Notifikasi Telegram lifecycle biasa kekal non-blocking. Untuk `submitReturnSelfie`, `sendPhoto` ialah langkah transaksi yang diperlukan dan kegagalan dikendalikan dengan cleanup.

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

Authorization Apps Script diperlukan untuk:

- Spreadsheet (`SpreadsheetApp`) bagi membaca/menulis rekod;
- Google Drive (`DriveApp`) bagi folder dan fail selfie;
- external request (`UrlFetchApp`) bagi Telegram Bot API.

Akaun yang menjalankan setup dan deployment perlu meluluskan scope berkaitan sebelum ujian production.

## `clasp` Workflow

Semak project:

```powershell
clasp status
```

Semak syntax GAS:

```powershell
Get-Content gas/Code.gs -Raw | node --check -
```

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
5. Uji Warden/Guard POST `getTodayRecords` dengan credential sah dan tidak sah.
6. Uji approve/reject serta confirm keluar/masuk.
7. Semak Telegram tanpa mendedahkan token dalam log.
8. Uji `submitReturnSelfie`, semak folder Drive private dan sahkan Telegram menerima foto melalui `sendPhoto`.
9. Sahkan Public Monitoring tidak mengandungi metadata selfie.
10. Jalankan regression suite repo dan pastikan **59/59 lulus**.

Jika `/exec` masih memulangkan behavior lama selepas `clasp push`, semak Manage deployments dan pastikan version baharu telah dipilih.

## Roadmap Keselamatan

PIN ialah basic internal access control, bukan authentication production-grade. Kerja masa hadapan termasuk PIN hashing, Google/domain login dan backend-issued session token.
