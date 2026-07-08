# Setup Google Apps Script untuk eOuting ITU

Google Apps Script digunakan sebagai backend/API antara GitHub Pages dan Google Sheets.

Status semasa:

- Frontend live: `https://itumelaka.github.io/eouting`
- Spreadsheet title: `eOuting ITU Database`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- Apps Script ID: `1-rLUp8L6ep6jR_-3h_Y-rofpdaaUFUCE92uLQ59gba2wsOunN53s9JZR`
- GAS backend Live V1: siap
- `clasp` workflow: configured

## Tujuan GAS Backend

GAS backend V1:

- Membaca data `STUDENTS`, `WARDENS`, dan `GUARDS`.
- Login student menggunakan nama + `no_matrik`.
- Login Warden/Guard menggunakan nama + PIN.
- Menulis permohonan ke `OUTING_REQUESTS`.
- Mengemaskini status approve/reject/keluar/masuk.
- Mengambil rekod hari ini untuk student status, dashboard, dan monitoring.
- Menulis tindakan penting ke `AUDIT_LOG`.
- Validate identity, role, status, PIN, dan action permission.

## Functions V1

```text
doGet(e)
doPost(e)
getStudents()
getWardens()
getGuards()
submitRequest(payload)
approveRequest(payload)
rejectRequest(payload)
confirmOut(payload)
confirmIn(payload)
getTodayRecords()
appendAuditLog(action, requestId, userRole, userName, details)
jsonResponse(data)
errorResponse(message)
```

## clasp Workflow

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

## Deploy Web App Version Baru

Dalam Apps Script editor:

```text
Deploy -> Manage deployments -> Edit -> New version -> Deploy
```

Cadangan setting V1:

```text
Execute as: Me
Who has access: Anyone with the link
```

Jika Web App boleh dipanggil oleh sesiapa dengan link, backend validation wajib ketat. Jangan bergantung kepada frontend role hiding.

## Response Format

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": "Ralat ringkas untuk frontend."
}
```

## Nota Pelaksanaan

- Jangan commit token, secret, password, API key, atau deployment credential.
- PIN V1 hanya untuk pilot/basic access control dan perlu ditukar kepada PIN unik sebelum penggunaan sebenar.
- Setiap deployment backend perlu diuji semula dengan frontend live.
