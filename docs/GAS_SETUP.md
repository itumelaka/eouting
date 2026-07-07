# Setup Google Apps Script untuk eOuting ITU

Google Apps Script digunakan sebagai backend/API antara GitHub Pages dan Google Sheets.

## Kenapa perlu Google Apps Script?

GitHub Pages hanya boleh host frontend statik seperti HTML, CSS dan JavaScript.

Untuk menulis data ke Google Sheets, sistem perlukan backend. Google Apps Script sesuai kerana ia boleh:

- Menerima request daripada frontend.
- Membaca senarai pelajar daripada Google Sheets.
- Menulis permohonan outing ke Google Sheets.
- Mengemaskini status kelulusan, keluar dan masuk.
- Mengurus audit log.

## Komponen yang diperlukan

1. GitHub repo untuk frontend:

```text
https://github.com/itumelaka/eouting
```

2. GitHub Pages untuk paparan sistem:

```text
https://itumelaka.github.io/eouting/
```

3. Google Spreadsheet sebagai database.

4. Google Apps Script project sebagai backend/API.

## Cadangan nama Apps Script project

```text
eOuting ITU API
```

## Cadangan nama Google Spreadsheet

```text
eOuting ITU Database
```

## Deployment Apps Script

Apps Script perlu dideploy sebagai Web App.

Cadangan setting awal:

```text
Execute as: Me
Who has access: Anyone with the link
```

Nota: Setting ini memudahkan frontend GitHub Pages berhubung dengan GAS. Namun kawalan akses tetap perlu dibuat dalam kod, contohnya PIN warden/guard dan validation request.

## API action yang dicadangkan

Frontend boleh memanggil GAS dengan action seperti berikut:

```text
getStudents
createOutingRequest
getTodayRequests
approveRequest
rejectRequest
checkOutStudent
checkInStudent
markSelfieReceived
getDashboardSummary
```

## Contoh struktur request

```json
{
  "action": "createOutingRequest",
  "student_id": "S001",
  "tujuan": "Beli barang keperluan",
  "lokasi": "Kedai berhampiran"
}
```

## Contoh struktur response

```json
{
  "ok": true,
  "message": "Permohonan berjaya dihantar.",
  "data": {
    "request_id": "REQ-20260707-0001",
    "status": "MENUNGGU KELULUSAN"
  }
}
```

## Rule validation dalam GAS

GAS perlu semak:

- Hari mestilah Selasa atau Rabu.
- Masa permohonan mestilah selepas 5:00 petang.
- Pelajar mestilah aktif.
- Pelajar tidak boleh ada outing aktif yang belum selesai.
- Guard tidak boleh check-out jika belum diluluskan warden.
- Masa masuk selepas 10:00 malam perlu ditanda lewat.

## Fail Apps Script yang dicadangkan

```text
Code.gs
Config.gs
Sheets.gs
Auth.gs
OutingService.gs
DashboardService.gs
AuditService.gs
```

Untuk permulaan, semua boleh diletakkan dalam `Code.gs` dahulu. Bila sistem makin besar, baru pecahkan ikut fail.
