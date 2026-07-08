# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow **Pilot-running Live v1.3.1** untuk eOuting ITU.

Status semasa:

- GitHub Pages frontend live: `https://itumelaka.github.io/eouting`
- Google Sheets live backend melalui GAS Web App.
- Ujian operasi sebenar telah berjalan dan rekod outing berjaya disimpan.
- PWA install support.
- Remember-device session.
- Student `Rekod Aktif` / `Sejarah Hari Ini`.
- Warden/Guard PIN login.
- Pemantauan Semasa read-only.
- Statistik Outing bulanan read-only.
- Telegram Bot notification berfungsi.
- Audit log asas dalam `AUDIT_LOG`.

## Record Lifecycle

Status lifecycle dalam `OUTING_REQUESTS`:

```text
MENUNGGU_KELULUSAN
DILULUSKAN_WARDEN
DITOLAK_WARDEN
KELUAR
SELESAI
```

## Flow Digital Live v1.3.1

```text
Pelajar login nama + no_matrik
   ↓
Pelajar submit Outing Biasa / Kecemasan
   ↓
Status: MENUNGGU_KELULUSAN
   ↓
Telegram alert permohonan baru
   ↓
Warden login nama + PIN
   ↓
Warden luluskan / tolak
   ↓
Telegram alert approve/reject
   ↓
Jika diluluskan, Guard login nama + PIN
   ↓
Guard sahkan keluar
   ↓
Status: KELUAR + Telegram alert keluar
   ↓
Guard sahkan masuk
   ↓
Status: SELESAI + Telegram alert masuk / lewat jika berkaitan
   ↓
Pelajar, dashboard, Pemantauan Semasa, dan Statistik papar rekod terkini
```

## Pelajar

Pelajar login menggunakan:

- Nama pelajar
- `no_matrik`

GAS backend menyemak data dalam tab `STUDENTS`.

Syarat:

- `status = Aktif` boleh login dan mohon outing.
- `status = Tidak Aktif` tidak boleh login dan tidak boleh mohon outing.

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

## Rekod Saya

`Rekod Saya` dibahagikan kepada dua bahagian:

### Rekod Aktif

Mengandungi status:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `KELUAR`

Jika ada rekod aktif, sistem block duplicate request untuk hari tersebut.

### Sejarah Hari Ini

Mengandungi status:

- `SELESAI`
- `DITOLAK_WARDEN`

Sejarah hari ini dikekalkan untuk rujukan. Rekod tidak dipadam dan tidak disembunyikan secara kekal. Rekod selesai/ditolak dipaparkan secara compact dan tidak block permohonan baru.

## Rule Masa

Outing Biasa:

- Hanya Selasa / Rabu
- Selepas 5:00 PM
- Sebelum atau pada 10:00 PM untuk pulang

Kecemasan:

- Boleh dihantar bila-bila masa
- Masih perlu kelulusan warden

## Warden

Warden login menggunakan:

- Nama warden
- PIN

Tindakan:

- Luluskan permohonan
- Tolak permohonan

Status selepas tindakan:

- Lulus: `DILULUSKAN_WARDEN`
- Tolak: `DITOLAK_WARDEN`

Telegram alert dihantar selepas approve/reject berjaya.

## Guard

Guard login menggunakan:

- Nama guard
- PIN

Tindakan:

- Confirm keluar selepas status `DILULUSKAN_WARDEN`
- Confirm masuk selepas status `KELUAR`

Status selepas confirm keluar:

- `KELUAR`

Status selepas confirm masuk:

- `SELESAI`

Jika masa masuk selepas had pulang, rekod ditanda `lewat = Ya` dan Telegram alert lewat dihantar.

## Dashboard Dan Pemantauan

Dashboard Hari Ini memaparkan:

- Menunggu Kelulusan
- Diluluskan
- Sedang Keluar
- Sudah Pulang
- Lewat
- Belum Masuk
- Kecemasan

`Pemantauan Semasa` ialah paparan read-only untuk melihat rekod hari ini tanpa mengubah status.

## Statistik Outing

`Statistik` ialah paparan read-only untuk ringkasan bulanan outing.

Filter tersedia:

- Bulan
- Tahun
- Kelas

Paparan Statistik menunjukkan:

- Jumlah permohonan bulanan.
- Jumlah outing selesai.
- Jumlah kecemasan.
- Jumlah lewat.
- Jumlah pelajar terlibat.
- `Juara Outing Bulanan` / Ranking Kekerapan Outing.
- Ringkasan mengikut kelas.
- Pecahan status permohonan.

Statistik sekarang dibuka sebagai read-only, sama seperti Pemantauan Semasa. Versi akan datang boleh hadkan akses Statistik kepada Warden/HEP sahaja jika diperlukan.

## Prinsip Penting

- Frontend role hiding bukan security sebenar.
- Semua validation penting dibuat dalam GAS backend.
- Semua action penting direkod dalam `AUDIT_LOG`.
- Live v1.3.1 ialah pilot-running untuk ujian operasi sebenar, bukan final production security.
