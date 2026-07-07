# Flow Sistem eOuting ITU

Dokumen ini menerangkan aliran kerja sistem eOuting ITU berdasarkan proses manual semasa di Institut Teknologi Unggas.

## Flow manual semasa

1. Pelajar ingin keluar outing selepas waktu pejabat.
2. Pelajar menyerahkan kad outing kepada warden bertugas.
3. Warden menandatangani kad outing sebagai kebenaran keluar.
4. Pelajar menyerahkan atau meletakkan kad outing di pos guard.
5. Pelajar menulis rekod keluar dalam buku outing guard.
6. Pelajar keluar dari kawasan institut.
7. Pelajar pulang sebelum atau pada jam 10:00 malam.
8. Pelajar menandatangani buku outing di pos guard.
9. Pelajar mengambil selfie dan menghantar bukti pulang ke WhatsApp group.

## Flow digital yang dicadangkan

```text
Pelajar Mohon
   ↓
Menunggu Kelulusan Warden
   ↓
Diluluskan / Ditolak Warden
   ↓
Jika diluluskan, guard sahkan keluar
   ↓
Pelajar keluar outing
   ↓
Guard sahkan masuk
   ↓
Warden semak status akhir
```

## Langkah 1: Pelajar membuat permohonan

Pelajar mengisi maklumat asas:

- Nama pelajar
- Kelas / kumpulan
- Tujuan outing
- Lokasi outing
- No telefon
- Masa permohonan

Status selepas submit:

```text
MENUNGGU KELULUSAN WARDEN
```

Pada tahap ini, pelajar masih belum dibenarkan keluar.

## Langkah 2: Warden membuat keputusan

Warden menyemak permohonan melalui dashboard warden.

Tindakan warden:

- Luluskan
- Tolak
- Tambah catatan

Jika diluluskan, status berubah kepada:

```text
DILULUSKAN WARDEN
```

Jika ditolak, status berubah kepada:

```text
DITOLAK WARDEN
```

## Langkah 3: Guard sahkan keluar

Guard hanya boleh sahkan keluar jika permohonan telah diluluskan oleh warden.

Maklumat yang direkod:

- Masa keluar sebenar
- Nama guard / ID guard
- Status keluar

Status selepas guard sahkan keluar:

```text
KELUAR
```

## Langkah 4: Guard sahkan masuk

Apabila pelajar pulang, guard sahkan masuk dalam sistem.

Maklumat yang direkod:

- Masa masuk sebenar
- Nama guard / ID guard
- Status pulang
- Flag lewat atau tidak

Jika masa masuk sebelum atau pada 10:00 malam:

```text
SELESAI
```

Jika masa masuk selepas 10:00 malam:

```text
SELESAI - LEWAT
```

## Langkah 5: Bukti pulang

Untuk versi awal, bukti selfie masih boleh dihantar ke WhatsApp group seperti proses manual semasa.

Dalam sistem, warden boleh tanda:

```text
Bukti WhatsApp diterima: Ya / Tidak
```

Untuk versi akan datang, sistem boleh ditambah fungsi upload selfie ke Google Drive.

## Status lifecycle

Status yang dicadangkan:

```text
MOHON
MENUNGGU KELULUSAN
DILULUSKAN WARDEN
DITOLAK WARDEN
KELUAR
SELESAI
SELESAI - LEWAT
BELUM MASUK
DIBATALKAN
```

## Prinsip penting

- Pelajar tidak boleh approve sendiri.
- Pelajar tidak boleh sahkan keluar sendiri.
- Pelajar tidak boleh sahkan masuk sendiri.
- Guard tidak boleh sahkan keluar jika belum diluluskan warden.
- Masa keluar dan masuk direkod oleh sistem, bukan ditaip manual oleh pelajar.
- Semua tindakan penting perlu masuk ke audit log.
