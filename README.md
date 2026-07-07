# eOuting ITU

**eOuting ITU** ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas bagi urusan outing selepas waktu pejabat.

Sistem ini dicadangkan menggantikan sebahagian proses manual seperti kad outing, tandatangan warden, buku outing di pos guard, dan semakan bukti pulang melalui WhatsApp.

## Objektif

- Memudahkan warden mengesan pelajar yang keluar outing.
- Merekod masa permohonan, kelulusan, keluar dan masuk secara automatik.
- Memastikan outing hanya berlaku pada hari dan masa yang dibenarkan.
- Membantu guard menyemak pelajar yang telah mendapat kebenaran warden.
- Memberi dashboard ringkas kepada warden untuk melihat status semasa.
- Menyediakan rekod digital untuk rujukan disiplin dan laporan.

## Waktu operasi outing

Outing hanya terpakai selepas waktu pejabat:

- Hari: **Selasa dan Rabu sahaja**
- Masa mula keluar: **5:00 petang**
- Masa akhir pulang: **sebelum atau pada 10:00 malam**

Sebarang rekod masuk selepas 10:00 malam akan ditanda sebagai **lewat**.

## Flow utama sistem

```text
Pelajar mohon outing
   ↓
Warden semak dan beri kebenaran
   ↓
Guard sahkan pelajar keluar di pos guard
   ↓
Pelajar pulang sebelum / pada 10:00 malam
   ↓
Guard sahkan pelajar masuk
   ↓
Warden semak status akhir dan bukti WhatsApp/selfie
```

## Peranan pengguna

### Pelajar

- Membuat permohonan outing.
- Menyemak status permohonan.
- Menunjukkan outing pass digital kepada guard selepas diluluskan.

### Warden

- Meluluskan atau menolak permohonan outing.
- Melihat senarai pelajar yang sedang keluar.
- Melihat senarai pelajar yang belum pulang.
- Menanda bukti WhatsApp/selfie telah diterima.
- Menambah catatan jika perlu.

### Guard

- Menyemak pelajar yang telah diluluskan oleh warden.
- Mengesahkan masa keluar.
- Mengesahkan masa masuk.

## Cadangan teknologi

- **Frontend:** GitHub Pages
- **Database:** Google Sheets
- **Backend/API:** Google Apps Script Web App

## Cadangan URL

```text
https://itumelaka.github.io/eouting/
```

## Status projek

Projek ini berada pada peringkat perancangan dan dokumentasi awal.
