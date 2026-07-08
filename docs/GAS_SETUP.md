# Setup Google Apps Script untuk eOuting ITU

Google Apps Script akan digunakan sebagai backend/API antara GitHub Pages dan Google Sheets.

Status semasa:

- Frontend live: `https://itumelaka.github.io/eouting`
- Spreadsheet title: `eOuting ITU Database`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- Apps Script ID: `1-rLUp8L6ep6jR_-3h_Y-rofpdaaUFUCE92uLQ59gba2wsOunN53s9JZR`
- GAS backend code: belum dibina
- `GAS_WEB_APP_URL` di frontend: kekal kosong sehingga deploy

## Tujuan GAS Backend

GAS backend V1 perlu:

- Membaca data `STUDENTS`, `WARDENS`, dan `GUARDS`.
- Menulis permohonan ke `OUTING_REQUESTS`.
- Mengemaskini status approve/reject/keluar/masuk.
- Membina dashboard data daripada Spreadsheet.
- Menulis semua tindakan penting ke `AUDIT_LOG`.
- Validate identity, role, dan status.

## Functions Yang Akan Dibina

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

## Deployment Apps Script

Apps Script perlu dideploy sebagai Web App selepas backend siap.

Cadangan setting awal:

```text
Execute as: Me
Who has access: Anyone with the link
```

Nota: Jika Web App boleh dipanggil oleh sesiapa dengan link, backend validation menjadi wajib. Jangan bergantung pada frontend role hiding.

## Rule Validation Wajib

GAS perlu semak:

- Student login guna nama + `no_matrik`.
- Student mesti `status = Aktif`.
- `Outing Biasa` hanya Selasa/Rabu selepas 5:00 PM.
- `Kecemasan` boleh dihantar bila-bila masa tetapi tetap perlu kelulusan warden.
- Warden mesti valid sebelum approve/reject.
- Guard mesti valid sebelum confirm keluar/masuk.
- Guard tidak boleh confirm keluar jika belum diluluskan warden.
- Masa masuk selepas had pulang perlu ditanda `lewat`.
- Semua action penting perlu ditulis ke `AUDIT_LOG`.

## Response Format Cadangan

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
  "message": "Ralat ringkas untuk frontend."
}
```

## Nota Pelaksanaan

- Untuk V1, semua code boleh bermula dalam `Code.gs`.
- Jangan commit deployment URL, token, secret, password, API key atau PIN sebenar.
- Selepas deploy, frontend baru boleh disambungkan kepada `GAS_WEB_APP_URL`.
