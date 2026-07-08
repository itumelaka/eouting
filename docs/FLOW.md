# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow V1 untuk sistem eOuting ITU.

Status semasa:

- Frontend mock role-based access: siap
- Basic PWA setup: siap
- GitHub Pages live: `https://itumelaka.github.io/eouting`
- Main Google Spreadsheet database: disediakan
- GAS backend: belum dibina

## Flow Digital V1

```text
Pelajar login
   ↓
Pelajar submit Outing Biasa / Kecemasan
   ↓
Menunggu Kelulusan Warden
   ↓
Warden luluskan / tolak
   ↓
Jika diluluskan, Guard sahkan keluar
   ↓
Pelajar keluar outing
   ↓
Guard sahkan masuk
   ↓
Dashboard papar status, lewat, belum masuk, dan kecemasan
```

## 1. Student Login

Pelajar login menggunakan:

- Nama pelajar
- `no_matrik`

Live mode nanti mesti semak pelajar dalam tab `STUDENTS`.

Syarat wajib:

- `status = Aktif` boleh login dan mohon outing.
- `status = Tidak Aktif` tidak boleh login dan tidak boleh mohon outing.

## 2. Student Submit Request

Pelajar boleh submit:

- `Outing Biasa`
- `Kecemasan`

Maklumat outing:

- Tujuan
- Lokasi
- Jenis kenderaan
- Butiran kenderaan

Untuk `Kecemasan`, maklumat tambahan:

- Sebab kecemasan
- Telefon waris
- Hubungan waris
- Catatan kecemasan

## 3. Rule Masa Permohonan

Outing Biasa:

- Hanya Selasa / Rabu
- Hanya selepas 5:00 PM

Kecemasan:

- Boleh dihantar bila-bila masa
- Masih perlu kelulusan warden

## 4. Warden Approval

Warden pilih nama dalam mock mode.

Tindakan:

- Luluskan
- Tolak

Live mode nanti GAS backend mesti validate identity warden dan status warden sebelum update rekod.

## 5. Guard Confirmation

Guard pilih nama dalam mock mode.

Tindakan:

- Confirm keluar
- Confirm masuk

Guard hanya boleh confirm keluar selepas permohonan diluluskan warden.

## 6. Dashboard

Dashboard perlu papar ringkasan:

- Menunggu Kelulusan
- Diluluskan
- Sedang Keluar
- Sudah Pulang
- Lewat
- Belum Masuk
- Kecemasan

## Prinsip Penting

- Frontend role hiding bukan security sebenar.
- Semua validation sebenar mesti dibuat dalam GAS backend.
- Semua action penting perlu masuk `AUDIT_LOG`.
- Mock records kekal dalam memory semasa role switching untuk tujuan UI testing sahaja.
