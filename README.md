# eOuting ITU

**eOuting ITU** ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas bagi urusan outing.

Status semasa: **Live V1 proof-of-concept siap dan berfungsi end-to-end**.

Live frontend:

```text
https://itumelaka.github.io/eouting
```

Milestone semasa:

```text
Live V1 POC completed: submit -> approve/reject -> guard keluar/masuk -> student status -> monitoring.
```

## Objektif

- Memudahkan pelajar membuat permohonan outing secara digital.
- Membantu warden meluluskan atau menolak permohonan dengan rekod masa.
- Membantu guard mengesahkan keluar dan masuk di pos guard.
- Memberi status semasa kepada pelajar melalui `Rekod Saya`.
- Menyediakan dashboard dan pemantauan ringkas untuk operasi harian.
- Menyimpan rekod dalam Google Sheets untuk rujukan disiplin dan laporan.

## Stack Semasa

- **Frontend:** GitHub Pages
- **UI:** Vanilla HTML/CSS/JS
- **Backend/API:** Google Apps Script Web App
- **Database:** Google Sheets
- **PWA:** Basic install support
- **GAS sync:** `clasp`

## Role Flow Semasa

### Pelajar

- Login guna nama + `no_matrik`.
- Hanya pelajar `Aktif` boleh login dan mohon outing.
- Submit `Outing Biasa` atau `Kecemasan`.
- Semak status melalui `Rekod Saya / Status Semasa`.
- Sistem block duplicate active request untuk hari yang sama.

### Warden

- Login guna `nama_warden` + PIN.
- Luluskan atau tolak permohonan.
- Action disahkan semula oleh GAS backend.

### Guard

- Login guna `nama_guard` + PIN.
- Sahkan pelajar keluar.
- Sahkan pelajar masuk.
- Action disahkan semula oleh GAS backend.

### Pemantauan Semasa

- Paparan read-only untuk melihat rekod hari ini.
- Sesuai untuk semakan operasi harian.

## Waktu Operasi Outing Biasa

Outing Biasa:

- Hari: **Selasa dan Rabu sahaja**
- Masa: **selepas 5:00 petang**
- Pulang: **sebelum atau pada 10:00 malam**

`Kecemasan` boleh dihantar di luar waktu outing biasa, tetapi masih perlu kelulusan warden.

## Live URLs / IDs

- GitHub repo: `https://github.com/itumelaka/eouting`
- GitHub Pages: `https://itumelaka.github.io/eouting`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- GAS Script ID: `1-rLUp8L6ep6jR_-3h_Y-rofpdaaUFUCE92uLQ59gba2wsOunN53s9JZR`

## Nota Status

Live V1 ini sesuai sebagai proof-of-concept / pilot-ready untuk ujian dalaman. Ia belum perlu dianggap production-grade security sehingga PIN unik, kawalan akses lebih kuat, SOP operasi, dan semakan audit diperkemaskan.
