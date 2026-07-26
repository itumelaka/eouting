# Architecture eOuting ITU

Versi live semasa: **v1.7.0**.

## Komponen

```text
GitHub Pages static frontend / PWA
  -> Google Apps Script Web App router
    -> Google Sheets
    -> Google Drive private selfie storage
    -> Telegram Bot notifications
    -> AUDIT_LOG
```

### Frontend PWA

Fail utama:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `service-worker.js`
- `version.json`

Frontend mengurus pemilihan role, borang Pelajar, Dashboard Warden/Guard, Public Monitoring read-only, statistik agregat, update PWA serta input kamera/file untuk bukti pulang. Gambar dipreview, diresize kepada sisi terpanjang kira-kira 1280px dan dieksport sebagai JPEG termampat sebelum upload. Frontend role hiding bukan boundary keselamatan.

### GAS Router

`gas/Code.gs` menyediakan `doGet(e)` dan `doPost(e)`. Backend membaca dan menulis Google Sheets, mengesahkan credential, menguatkuasakan transition status, menyimpan selfie ke Google Drive, menulis audit log dan menghantar Telegram.

Telegram ialah side effect non-blocking bagi notifikasi lifecycle biasa. Untuk `submitReturnSelfie`, penghantaran imej melalui `sendPhoto` ialah sebahagian daripada hasil bukti yang diperlukan; kegagalan sebelum transaksi lengkap mencetuskan cleanup Drive/Telegram. Kegagalan audit selepas transaksi utama berjaya hanya diberi amaran dan tidak membatalkan submission.

### Google Sheets

Google Sheets ialah database dan source of truth. Tab utama:

- `STUDENTS`
- `WARDENS`
- `GUARDS`
- `OUTING_REQUESTS`
- `AUDIT_LOG`

v1.7.0 menambah lima header selfie secara idempotent melalui `setupSelfieProofV170()` dan mengekalkan `selfie_whatsapp` sebagai kolum legacy.

## Boundary API

### Public GET

`GET getStudents` memulangkan direktori login minimum:

```text
student_id | nama | kelas
```

`GET getTodayRecords` memulangkan Public Monitoring minimum:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

`GET getOutingStats` memulangkan kiraan agregat sahaja. Ia tidak memulangkan row mentah, leaderboard individu, nama atau nombor matrik.

### Authenticated POST

`POST getTodayRecords` mengesahkan credential sebenar:

- Pelajar: `student_id` + `no_matrik`, kemudian hanya rekod pelajar itu dipulangkan.
- Warden: nama Warden + PIN, kemudian rekod operasi penuh dipulangkan.
- Guard: nama Guard + PIN, kemudian rekod operasi penuh dipulangkan.

Jika credential operasi hilang atau salah, request gagal secara terkawal. Frontend tidak fallback kepada GET awam.

Action write lain kekal melalui POST:

- `submitRequest`
- `approveRequest`
- `rejectRequest`
- `confirmOut`
- `confirmIn`
- `submitReturnSelfie`

## Aliran Data Utama

```text
Pelajar login -> submitRequest -> OUTING_REQUESTS
  -> Telegram permohonan
Warden login -> POST getTodayRecords -> approve/reject
  -> Telegram keputusan
Guard login -> POST getTodayRecords -> confirmOut/confirmIn
  -> Telegram pergerakan
Pelajar selepas confirmIn -> kamera/preview/compress -> submitReturnSelfie
  -> LockService -> Drive private -> Telegram sendPhoto -> metadata Sheet
Public Monitoring -> GET getTodayRecords -> mapPublicMonitoringRecord
```

## Status Bukti Selfie

Status lifecycle utama tidak berubah:

```text
confirmIn -> status = SELESAI
```

State bukti disimpan secara berasingan:

```text
selfie_status = BELUM_HANTAR
  -> submitReturnSelfie berjaya
selfie_status = SUDAH_HANTAR
```

Rekod lama tanpa `selfie_status` kekal boleh dibaca. Rekod `SELESAI` yang mempunyai `masa_masuk` tetapi tiada metadata selfie dianggap belum menghantar bukti. `LockService` meliputi semakan duplicate, simpanan Drive, penghantaran Telegram dan kemas kini Sheet. Jika transaksi separa gagal, fail Drive dan/atau mesej Telegram dibersihkan; selepas Sheet berjaya ditanda lengkap, kegagalan `AUDIT_LOG` tidak mengubah hasil.

## Status dan Paparan

Nilai lifecycle backend:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `KELUAR`
- `SELESAI`

Helper pusat frontend membentuk paparan kontekstual tanpa mengubah nilai backend:

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar untuk Outing Biasa/Kecemasan
- 🌙 Sedang Bermalam untuk Pulang Bermalam
- 🏖️ Sedang Bercuti untuk Cuti Semester
- ✅ Sudah Pulang
- 🔴 Lewat, dengan precedence tertinggi

Kiraan dan filter operasi terus menggunakan nilai `record.status`, termasuk satu kiraan gabungan `KELUAR`.

## Warden dan Guard

Warden menerima rekod operasi penuh melalui POST authenticated untuk Dashboard, approve/reject dan Checklist Permohonan. Checklist menggunakan ikon status kontekstual dan `Copy Senarai Nama`.

Guard menerima rekod operasi penuh melalui POST authenticated. Quick filter Guard ialah Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat, dan digunakan pada `Sedia Untuk Keluar` serta `Sedang Keluar`.

## Public Monitoring

Public Monitoring v1.6.25 sentiasa menggunakan GET awam khusus, walaupun sesi Warden/Guard wujud. Lifecycle menggunakan scroll-to-workspace, loading jelas dan single-flight guard. Satu response menghasilkan satu render; timestamp dan `monitorHasLoadedOnce` hanya dikemas kini selepas berjaya.

Paparan terdiri daripada:

- kad ringkasan status;
- `Senarai Status Semasa` dengan nama, kelas, jenis permohonan, ikon dan status kontekstual.

Tiada kad `Rekod Hari Ini`, quick filter monitoring atau seksyen pendua `Belum Pulang Ke Asrama`.

## PWA dan Cache

Versi perlu konsisten pada `APP_VERSION`, footer, query string asset, `CACHE_NAME`, app-shell URLs dan `version.json`. Cache semasa ialah `eouting-cache-v1.7.0`.

Service worker tidak membaca atau menulis response API/GAS, external request atau imej selfie sensitif dalam Cache Storage. Semasa activate, cache lama eOuting dibuang dan client semasa dituntut. Static app shell kekal cacheable. Popup `Update Available` kekal bergantung pada flow update sedia ada.
