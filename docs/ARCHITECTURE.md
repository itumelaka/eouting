# Architecture eOuting ITU

Versi live semasa: **v1.6.25**.

## Komponen

```text
GitHub Pages static frontend / PWA
  -> Google Apps Script Web App router
    -> Google Sheets
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

Frontend mengurus pemilihan role, borang Pelajar, Dashboard Warden/Guard, Public Monitoring read-only, statistik agregat dan update PWA. Frontend role hiding bukan boundary keselamatan.

### GAS Router

`gas/Code.gs` menyediakan `doGet(e)` dan `doPost(e)`. Backend membaca dan menulis Google Sheets, mengesahkan credential, menguatkuasakan transition status, menulis audit log dan menghantar Telegram.

Telegram ialah side effect non-blocking; kegagalannya tidak sepatutnya membatalkan operasi utama yang telah berjaya.

### Google Sheets

Google Sheets ialah database dan source of truth. Tab utama:

- `STUDENTS`
- `WARDENS`
- `GUARDS`
- `OUTING_REQUESTS`
- `AUDIT_LOG`

Tiada perubahan schema diperlukan untuk hardening v1.6.20-v1.6.25.

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

## Aliran Data Utama

```text
Pelajar login -> submitRequest -> OUTING_REQUESTS
  -> Telegram permohonan
Warden login -> POST getTodayRecords -> approve/reject
  -> Telegram keputusan
Guard login -> POST getTodayRecords -> confirmOut/confirmIn
  -> Telegram pergerakan
Public Monitoring -> GET getTodayRecords -> mapPublicMonitoringRecord
```

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

Versi perlu konsisten pada `APP_VERSION`, footer, query string asset, `CACHE_NAME`, app-shell URLs dan `version.json`. Cache semasa ialah `eouting-cache-v1.6.25`.

Service worker tidak membaca atau menulis response API/GAS dalam Cache Storage. Semasa activate, cache lama eOuting dibuang dan client semasa dituntut. Static app shell kekal cacheable. Popup `Update Available` kekal bergantung pada flow update sedia ada.
