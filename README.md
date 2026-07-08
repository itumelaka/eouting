# eOuting ITU

**eOuting ITU** ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas bagi urusan outing.

Status semasa: **Pilot-ready Live V1.2** untuk ujian operasi sebenar bersama pelajar. Sistem sudah berfungsi end-to-end, tetapi belum dianggap final production atau bank-grade security.

Live frontend:

```text
https://itumelaka.github.io/eouting
```

## Current Status

- **Frontend:** GitHub Pages
- **Backend:** Google Apps Script Web App
- **Database:** Google Sheets
- **Notification:** Telegram Bot
- **Deployment helper:** `clasp`
- **PWA:** supported

## Milestone Live V1.2

Flow utama sudah berjalan:

```text
student submit -> warden approve/reject -> guard keluar/masuk -> student status -> monitoring -> Telegram alert
```

Fungsi terkini:

- Live GitHub Pages frontend.
- Google Apps Script backend.
- Google Sheets database.
- PWA install support.
- Student login guna nama + `no_matrik`.
- Warden login guna nama + PIN.
- Guard login guna nama + PIN.
- Student submit `Outing Biasa` atau `Kecemasan`.
- Warden approve / reject.
- Guard confirm keluar / masuk.
- `Rekod Saya` memisahkan `Rekod Aktif` dan `Sejarah Hari Ini`.
- Rekod selesai/ditolak kekal sebagai sejarah compact dan tidak block permohonan baru.
- Active record masih block duplicate request.
- Pemantauan Semasa read-only.
- BM date/time formatting dan phone display formatting.
- 3D clay role navigation dan toast popup.
- Telegram Bot notification berfungsi.

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

## Nota Operasi

Live V1.2 ini sesuai untuk pilot / ujian operasi sebenar. Sebelum rollout lebih luas, tetapkan PIN unik, semak sharing Spreadsheet, kawal Telegram group membership, dan sediakan SOP untuk HEP/warden/guard.
