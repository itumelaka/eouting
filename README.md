# eOuting ITU

**eOuting ITU** ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas bagi urusan outing.

Status semasa: **Pilot-running Live v1.3.1** untuk ujian operasi sebenar. Flow outing sebenar telah diuji dengan pelajar, rekod berjaya disimpan ke Google Sheets, dan notifikasi operasi berjalan. Sistem masih dalam fasa pilot-running, bukan final production atau production-grade security.

Live frontend:

```text
https://itumelaka.github.io/eouting
```

## Current Status

- **Frontend:** GitHub Pages
- **Backend:** Google Apps Script Web App
- **Database:** Google Sheets
- **Notification:** Telegram Bot
- **PWA:** supported
- **Deployment helper:** `clasp`
- **Version:** Live v1.3.1

## Ringkasan Feature

- Pelajar login guna nama + `no_matrik`.
- Warden/Guard login guna nama + PIN.
- Pelajar submit `Outing Biasa` atau `Kecemasan`.
- Warden approve / reject.
- Guard confirm keluar / masuk.
- `Rekod Saya` memisahkan `Rekod Aktif` dan `Sejarah Hari Ini`.
- Pemantauan Semasa read-only.
- Statistik Outing bulanan.
- Telegram notifications untuk action penting.
- PWA support.
- Remember-device session.
- `Muat Semula Sistem` untuk bantu refresh cache PWA/browser.

## Milestone Live v1.3.1

Flow utama pilot-running:

```text
student submit -> warden approve/reject -> guard keluar/masuk -> student status -> monitoring -> statistik -> Telegram alert
```

Perkara terkini:

- Ujian operasi sebenar berjaya dijalankan dengan rekod outing pelajar sebenar.
- Statistik Outing tersedia dengan summary cards, ranking kekerapan outing, Juara Outing Bulanan, class summary, status summary, dan filter bulan/tahun/kelas.
- Statistik year dropdown dihadkan kepada 2026-2030.
- Layout filter Statistik dipolish dan responsive.
- API/live fetch handling diperkukuh dalam v1.3.1.
- GET requests menggunakan cache-busting dan retry ringkas.
- Response HTML/error daripada GAS tidak lagi dipaparkan sebagai raw `Unexpected token <`.
- Mesej friendly dipaparkan jika sambungan live tidak stabil.
- Butang `Cuba Lagi` tersedia untuk ulang cuba live loading.
- Header clock menggunakan format 24 jam.
- PWA/cache update handling, remember-device session, dan Mock Mode `?mock=1` kekal tersedia.
- Telegram notification kekal berfungsi.

## Role Flow Semasa

### Pelajar

- Login guna nama + `no_matrik`.
- Hanya pelajar `Aktif` boleh login dan mohon outing.
- Submit `Outing Biasa` atau `Kecemasan`.
- Semak `Rekod Aktif` untuk permohonan sedang berjalan.
- Semak `Sejarah Hari Ini` untuk rekod selesai atau ditolak.

### Warden

- Login guna nama + PIN.
- Luluskan atau tolak permohonan.
- Telegram alert dihantar selepas action berjaya.

### Guard

- Login guna nama + PIN.
- Sahkan pelajar keluar.
- Sahkan pelajar masuk.
- Telegram alert dihantar selepas action berjaya, termasuk kes lewat jika berlaku.

### Pemantauan Semasa

- Paparan read-only untuk rekod hari ini.
- Sesuai untuk semakan operasi harian oleh pihak berkaitan.

### Statistik Outing

- Paparan read-only untuk ringkasan bulanan.
- Filter mengikut bulan, tahun, dan kelas.
- Menunjukkan total permohonan, selesai, kecemasan, lewat, leaderboard, ringkasan kelas, dan pecahan status.

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
- Local repo path: `C:\Users\burnk\OneDrive\Documents-assets\eouting`

## Nota Operasi

Live v1.3.1 ini sesuai untuk pilot-running dan ujian operasi sebenar. Sebelum rollout lebih luas, tetapkan PIN unik, semak sharing Spreadsheet, kawal Telegram group membership, bersihkan data test jika perlu, dan sediakan SOP untuk HEP/warden/guard.
