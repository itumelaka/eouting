# eOuting ITU

**eOuting ITU / eOuting SKM OLP** ialah sistem digital untuk merekod, meluluskan, memantau, dan melapor pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Status semasa: **Live/pilot stable v1.6.16**.

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
- **PWA:** supported with version/cache update strategy
- **Deployment helper:** `clasp`
- **Current version:** `v1.6.16`

Live/pilot stable v1.6.16 includes Google Sheets integration, deployed GAS backend, Telegram notifications, staff PIN hardening, duplicate active request prevention, Guard refresh, Warden auto-refresh, Warden checklist, copy name list, Pemantauan Semasa live board, PWA update detection, and stale staff login error cleanup.

## Roles

- **Pelajar:** submit permohonan dan semak `Rekod Saya`.
- **Warden:** lulus/tolak permohonan, semak Checklist Permohonan, copy senarai nama aktif, refresh permohonan, muat turun laporan CSV, dan akses utiliti Warden.
- **Guard:** sahkan keluar/masuk pelajar, dengan manual refresh dan auto-refresh.
- **Pemantauan Semasa:** read-only monitoring untuk rekod aktif dan rekod hari ini.
- **Statistik:** ringkasan bulanan, leaderboard, ringkasan kelas, dan pecahan status.

## Request Types

- **Outing Biasa** (`OUTING_BIASA`)
- **Kecemasan** (`KECEMASAN`)
- **Pulang Bermalam** (`PULANG_BERMALAM`)
- **Cuti Semester** (`CUTI_SEMESTER`)

## Key Features

- Backend staff action wajib nama + PIN aktif.
- Backend duplicate active request prevention untuk status `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN`, dan `KELUAR`.
- Warden Dashboard auto-refresh setiap 60 saat dan manual `Refresh Permohonan`.
- Guard page ada `Refresh Status` dan auto-refresh.
- Warden Checklist Permohonan meliputi semua jenis permohonan.
- Copy Senarai Nama untuk WhatsApp dengan ikon status dan petunjuk.
- Pemantauan Semasa read-only dengan loading state, summary cards, Senarai Nama Semasa, dan animasi live.
- PWA versioning melalui `APP_VERSION`, asset query strings, `service-worker.js`, dan `version.json`.
- Update available / `Apa yang baharu` popup.
- Audit log dan Telegram notification basic flow.
- CSV/report download dan Statistik view.

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

Jika GitHub Pages kelihatan tersekat pada versi lama, semak raw GitHub berbanding live Pages dan cuba cache-bust URL:

```text
https://itumelaka.github.io/eouting/index.html?v=1.6.16
```

## Recent Changelog

- **v1.6.16:** Fix stale staff login error toast and empty notice/banner.
- **v1.6.15:** Refine Warden utility actions and reduce Warden auto-refresh to 60 seconds.
- **v1.6.14:** Add Warden auto-refresh and move utility buttons closer to dashboard.
- **v1.6.13:** Add animated live name list to Pemantauan Semasa.
- **v1.6.12:** Improve Pemantauan Semasa loading state and live animations.
- **v1.6.11:** Status icons and legend in copied Warden name list.
- **v1.6.10:** Copy Senarai Nama for active Warden requests.
- **v1.6.9:** Warden checklist expanded to all request types.
- **v1.6.8:** Guard refresh visibility and Warden checklist status improvements.

## Live URLs / IDs

- GitHub repo: `https://github.com/itumelaka/eouting`
- GitHub Pages: `https://itumelaka.github.io/eouting/`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- Local repo path: `C:\Users\burnk\OneDrive\Documents-assets\eouting`
