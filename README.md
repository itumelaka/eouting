# eOuting ITU

**eOuting ITU / eOuting SKM OLP** ialah sistem digital untuk merekod, meluluskan, memantau, dan melapor pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Status semasa: **Live stable v1.6.7**.

Live frontend:

```text
https://itumelaka.github.io/eouting/
```

Repo:

```text
https://github.com/itumelaka/eouting
```

## Current Status

- **Frontend:** GitHub Pages
- **Backend:** Google Apps Script Web App
- **Database:** Google Sheets
- **Notification:** Telegram Bot
- **Mode:** Live Mode: Google Sheets
- **PWA:** supported
- **Deployment helper:** `clasp`
- **Current stable version:** `v1.6.7`

Live v1.6.7 is confirmed working with Google Sheets, deployed GAS backend, and Telegram notifications.

## Roles

- **Pelajar:** submit permohonan dan semak `Rekod Saya`.
- **Warden:** lulus/tolak permohonan, muat turun laporan CSV, dan jalankan utility refresh.
- **Guard:** sahkan keluar/masuk pelajar.
- **Pemantauan Semasa:** read-only monitoring untuk rekod aktif dan rekod hari ini.
- **Statistik:** ringkasan bulanan, leaderboard, ringkasan kelas, dan pecahan status.

## Request Types

- **Outing Biasa**
- **Kecemasan**
- **Pulang Bermalam**
- **Cuti Semester**

## Cuti Semester

`Cuti Semester` menggunakan header sedia ada dalam `OUTING_REQUESTS`; tiada kolum spreadsheet baru diperlukan.

Mapping utama:

- `jenis_permohonan = CUTI_SEMESTER`
- `tarikh = Tarikh Keluar / Tarikh Mula Cuti`
- `tarikh_balik = Tarikh Pulang Ke Asrama`
- `masa_balik_dijangka = Masa Dijangka Pulang Ke Asrama`
- `telefon_waris` dan `hubungan_waris` wajib diisi

Behavior:

- Pelajar boleh submit Cuti Semester melalui borang Pelajar.
- Warden boleh lihat permohonan pending walaupun `tarikh` ialah tarikh masa depan.
- Guard boleh proses rekod yang telah diluluskan.
- Pemantauan Semasa mengekalkan rekod aktif sehingga status `SELESAI`.
- Paparan masa pulang diformat sebagai masa bersih seperti `22:00`, bukan ISO/1899 date time.

## Data Visibility

`getTodayRecords()` di GAS memulangkan:

- rekod dengan aktiviti hari ini
- rekod aktif dengan status:
  - `MENUNGGU_KELULUSAN`
  - `DILULUSKAN_WARDEN`
  - `KELUAR`
- rekod `PULANG_BERMALAM` / `CUTI_SEMESTER` yang belum selesai

Rekod selesai/ditolak lama tidak dipulangkan berlebihan kecuali berkaitan aktiviti hari ini.

## UI Notes

- Field borang dikawal oleh central request type field handler.
- Field Cuti Semester dipaparkan dengan betul.
- Footer utility/report buttons hanya dipaparkan pada skrin Warden:
  - `Muat Turun Laporan Hari Ini`
  - `Muat Turun Laporan Bulanan`
  - `Muat Semula Sistem`
  - `Apa yang baharu v1.x.x`
- Landing page, Pelajar, Guard, Pemantauan Semasa, dan Statistik tidak memaparkan utility/report footer buttons.

## Deployment Summary

Frontend-only change:

```text
git commit
git push
```

GAS change:

```text
clasp push
Apps Script > Manage deployments > Edit > New version > Deploy
```

Jika GitHub Pages kelihatan tersekat pada versi lama, semak raw GitHub berbanding live Pages dan cuba cache-bust URL seperti:

```text
https://itumelaka.github.io/eouting/index.html?v=166-force
```

## Recent Changelog

- **v1.6.7:** Guard dashboard refresh controls, PWA cache/version bump, and backend hardening release.
- **v1.6.3:** Cuti Semester fields visible on student form.
- **v1.6.4:** Central request type form handling.
- **v1.6.5:** Cuti Semester return time display fix.
- **v1.6.6:** Footer utilities visible only on Warden screen.

## Live URLs / IDs

- GitHub repo: `https://github.com/itumelaka/eouting`
- GitHub Pages: `https://itumelaka.github.io/eouting/`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- Local repo path: `C:\Users\burnk\OneDrive\Documents-assets\eouting`
