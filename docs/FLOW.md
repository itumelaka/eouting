# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow **Live V1 proof-of-concept** untuk eOuting ITU.

Status semasa:

- GitHub Pages frontend live: `https://itumelaka.github.io/eouting`
- PWA install: siap
- Google Sheets live backend melalui GAS Web App: siap
- Student status tracking: siap
- Warden/Guard PIN login: siap
- Pemantauan Semasa read-only: siap
- Audit log asas: siap

## Flow Digital V1

```text
Pelajar login nama + no_matrik
   ↓
Pelajar submit Outing Biasa / Kecemasan
   ↓
Status: MENUNGGU_KELULUSAN
   ↓
Warden login nama + PIN
   ↓
Warden luluskan / tolak
   ↓
Jika diluluskan, Guard login nama + PIN
   ↓
Guard sahkan keluar
   ↓
Status: KELUAR
   ↓
Guard sahkan masuk
   ↓
Status: SELESAI
   ↓
Pelajar, dashboard, dan Pemantauan Semasa papar status terkini
```

## 1. Student Login

Pelajar login menggunakan:

- Nama pelajar
- `no_matrik`

GAS backend menyemak data dalam tab `STUDENTS`.

Syarat:

- `status = Aktif` boleh login dan mohon outing.
- `status = Tidak Aktif` tidak boleh login dan tidak boleh mohon outing.

## 2. Student Submit Request

Pelajar boleh submit:

- `Outing Biasa`
- `Kecemasan`

Maklumat asas:

- Tujuan
- Lokasi
- Jenis kenderaan
- Butiran kenderaan

Untuk `Kecemasan`, maklumat tambahan:

- Sebab kecemasan
- Telefon waris
- Hubungan waris
- Catatan kecemasan

Selepas submit berjaya, status awal ialah `MENUNGGU_KELULUSAN`. Pelajar boleh lihat status di `Rekod Saya`.

## 3. Rule Masa

Outing Biasa:

- Hanya Selasa / Rabu
- Hanya selepas 5:00 PM
- Perlu pulang sebelum atau pada 10:00 PM

Kecemasan:

- Boleh dihantar bila-bila masa
- Masih perlu kelulusan warden

## 4. Duplicate Active Request

Sistem block permohonan baru jika pelajar sudah ada active request hari ini.

Active status:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `KELUAR`

Jika status `DITOLAK_WARDEN` atau `SELESAI`, pelajar boleh membuat permohonan baru buat masa ini.

## 5. Warden Approval / Rejection

Warden login menggunakan:

- `nama_warden`
- PIN

Tindakan:

- Luluskan permohonan
- Tolak permohonan

Status selepas tindakan:

- Lulus: `DILULUSKAN_WARDEN`
- Tolak: `DITOLAK_WARDEN`

Backend validate PIN, status warden, dan action sebelum update rekod.

## 6. Guard Confirm Keluar

Guard login menggunakan:

- `nama_guard`
- PIN

Guard hanya boleh confirm keluar selepas status `DILULUSKAN_WARDEN`.

Status selepas confirm keluar:

- `KELUAR`

## 7. Guard Confirm Masuk

Guard sahkan masuk apabila pelajar pulang.

Status selepas confirm masuk:

- `SELESAI`

Jika masa masuk selepas had pulang, rekod ditanda `lewat = Ya`.

## 8. Student Status Tracking

Pelajar boleh lihat `Rekod Saya / Status Semasa`.

Paparan status mesra pengguna termasuk:

- Menunggu Kelulusan Warden
- Diluluskan Warden
- Ditolak Warden
- Sedang Outing
- Selesai / Selesai - Lewat

## 9. Dashboard Hari Ini

Dashboard memaparkan ringkasan:

- Menunggu Kelulusan
- Diluluskan
- Sedang Keluar
- Sudah Pulang
- Lewat
- Belum Masuk
- Kecemasan

## 10. Pemantauan Semasa

`Pemantauan Semasa` ialah paparan read-only untuk melihat rekod hari ini.

Ia membantu semakan operasi tanpa mengubah status rekod.

## Prinsip Penting

- Frontend role hiding bukan security sebenar.
- Semua validation penting dibuat dalam GAS backend.
- Semua action penting direkod dalam `AUDIT_LOG`.
- Live V1 ialah proof-of-concept / pilot-ready, bukan security production-grade.
