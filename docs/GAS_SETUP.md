# Setup Google Apps Script untuk eOuting ITU

Google Apps Script digunakan sebagai backend/API antara GitHub Pages dan Google Sheets.

Status semasa:

- Frontend live: `https://itumelaka.github.io/eouting`
- Spreadsheet title: `eOuting ITU Database`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- Apps Script ID: `1-rLUp8L6ep6jR_-3h_Y-rofpdaaUFUCE92uLQ59gba2wsOunN53s9JZR`
- GAS backend: Live/pilot stable v1.6.16
- `clasp` workflow: configured
- Telegram Bot notification: siap

## Tujuan GAS Backend

GAS backend:

- Membaca data `STUDENTS`, `WARDENS`, dan `GUARDS`.
- Login Pelajar menggunakan nama + `no_matrik`.
- Login Warden/Guard menggunakan nama + PIN.
- Menulis permohonan ke `OUTING_REQUESTS`.
- Menghalang duplicate active request di backend.
- Mengemaskini status approve/reject/keluar/masuk.
- Mengambil rekod hari ini untuk Student, Warden, Guard, dashboard, dan monitoring.
- Mengira Statistik Outing bulanan melalui `getOutingStats`.
- Menulis tindakan penting ke `AUDIT_LOG`.
- Validate identity, role, status, PIN, dan action permission.
- Menghantar Telegram notification asas.

## Functions Live v1.6.16

Fungsi utama yang digunakan oleh frontend:

```text
doGet(e)
doPost(e)
getStudents()
getWardens()
getGuards()
loginStudent(payload)
loginWarden(payload)
loginGuard(payload)
submitRequest(payload)
approveRequest(payload)
rejectRequest(payload)
confirmOut(payload)
confirmIn(payload)
getTodayRecords()
getOutingStats(params)
```

Fungsi helper penting:

```text
findStudent_()
findActiveWarden_()
findActiveGuard_()
appendAuditLog()
jsonResponse()
errorResponse()
testTelegramNotification()
```

Nama helper sebenar perlu disemak dalam `gas/Code.gs` sebelum edit backend kerana helper underscore adalah implementation detail.

## Backend Hardening Semasa

v1.6.16 mengekalkan beberapa hardening penting:

- Warden approve/reject wajib nama + PIN.
- Guard confirm keluar/masuk wajib nama + PIN.
- PIN kosong/null/whitespace ditolak.
- Staff lookup mesti match nama + PIN + active.
- PIN tidak dipulangkan dalam response atau audit details.
- `submitRequest` menghalang duplicate active request untuk pelajar sama.
- Active statuses ialah `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN`, dan `KELUAR`.
- Status `SELESAI` dan `DITOLAK_WARDEN` tidak block permohonan baru.

## clasp Workflow Operasi

Install clasp jika belum ada:

```powershell
npm install -g @google/clasp
```

Login Google account:

```powershell
clasp login
```

Pastikan guna Google account yang ada akses kepada Apps Script project.

Project ini menggunakan `.clasp.json` dengan `rootDir` ke folder `gas`.

Contoh semakan:

```powershell
clasp status
```

Push perubahan Apps Script:

```powershell
clasp push
```

Nota penting:

- `clasp push` hanya update fail Apps Script dalam project.
- Web app users tidak semestinya dapat backend terbaru selepas `clasp push`.
- Untuk live web app, buat deployment version baru.
- Selepas tambah atau ubah GAS actions, jalankan `clasp push`.
- Kemudian update Apps Script Web App melalui `Manage deployments -> Edit -> New version -> Deploy`.
- Jika `/exec` memulangkan `Unknown action` tetapi code sudah wujud secara local, deployment version kemungkinan masih stale.

Workflow ringkas:

```text
edit gas/Code.gs locally
   ↓
syntax check jika sesuai
   ↓
clasp push
   ↓
Deploy -> Manage deployments -> Edit -> New version -> Deploy
   ↓
test live frontend dan Telegram
```

## Deploy Web App Version Baru

Dalam Apps Script editor:

```text
Deploy -> Manage deployments -> Edit -> New version -> Deploy
```

Cadangan setting pilot semasa:

```text
Execute as: Me
Who has access: Anyone with the link
```

Jika Web App boleh dipanggil oleh sesiapa dengan link, backend validation wajib ketat. Jangan bergantung kepada frontend role hiding.

## API Action Ringkas

Frontend memanggil GAS Web App dengan action seperti:

```text
loginStudent
loginWarden
loginGuard
submitRequest
approveRequest
rejectRequest
confirmOut
confirmIn
getTodayRecords
getOutingStats
```

Response success:

```json
{
  "ok": true,
  "data": {}
}
```

Response error:

```json
{
  "ok": false,
  "error": "Ralat ringkas untuk frontend."
}
```

Frontend mesti treat error message sebagai paparan pengguna, bukan sebagai bukti security. Security sebenar dibuat dalam backend.

## Telegram Notification

Backend boleh hantar notifikasi Telegram untuk action penting:

- Permohonan outing baru.
- Permohonan kecemasan baru.
- Warden luluskan permohonan.
- Warden tolak permohonan.
- Guard sahkan keluar.
- Guard sahkan masuk.
- Pelajar masuk lewat.

Setup ringkas:

1. Cipta bot melalui BotFather.
2. Add bot ke Telegram group operasi.
3. Disable group privacy jika bot perlu baca group updates untuk dapatkan chat ID.
4. Dapatkan group chat ID menggunakan Telegram `getUpdates`.
5. Simpan config dalam Apps Script Script Properties.
6. Run `testTelegramNotification()`.
7. Test submit, approve/reject, keluar, masuk, dan lewat.

Token bot dan chat ID **mesti** disimpan dalam Apps Script Script Properties, bukan dalam code repo.

Script Properties yang digunakan:

```text
TELEGRAM_ENABLED
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

Cadangan nilai:

```text
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<token daripada BotFather>
TELEGRAM_CHAT_ID=<chat id group/channel/user>
```

Cara set di Apps Script:

```text
Project Settings -> Script Properties -> Add script property
```

Manual test selepas properties diset:

```text
Run function: testTelegramNotification
```

Expected message:

```text
Ujian Telegram eOuting ITU berjaya.
```

Nota keselamatan:

- Jangan hardcode Telegram token atau chat ID dalam `Code.gs`.
- Jangan print token dalam logs.
- Jika Telegram gagal, action utama eOuting masih perlu berjaya.
- Selepas `clasp push`, deploy version baru supaya Web App menggunakan backend terbaru.
- Jangan masukkan real token, secret, atau chat ID ke dokumentasi atau repo.

## Nota Pelaksanaan

- Jangan commit token, secret, password, API key, atau deployment credential.
- PIN sekarang hanya untuk pilot/basic internal access control.
- Roadmap security masih termasuk hash PIN, Google login/domain restriction, dan backend-issued session token.
- Setiap deployment backend perlu diuji semula dengan frontend live.
