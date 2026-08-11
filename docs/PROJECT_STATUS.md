# Project Status eOuting ITU

Status repo semasa: **v2.2.0 — production verified**.

## eOuting v2.2 Production

Frontend v2.2.0 diterbitkan melalui GitHub Pages di `https://itumelaka.github.io/eouting/`.

Verdict semasa ialah **config-driven production ACTIVE dan Ready** pada release v2.2.0 dengan GAS Version 36. Displayed version kekal v2.2.0 dan cache/asset source revision ialah `2.2.0-r2`.

Repo kini turut mengandungi `Notis Banner` V1. Backend ciri ini belum live pada baseline GAS Version 36 dan memerlukan deployment GAS terkawal; ciri gagal secara tertutup (banner tersembunyi) sehingga action backend tersedia. Tiada config outing atau feature flag diubah.

Production boundary semasa:

- frontend release ialah `v2.2.0` dan backend production ialah GAS **Version 36**;
- Spreadsheet production ialah `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`;
- endpoint GAS production kekal `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`;
- `OUTING_CONFIG_V2_ENABLED=true`; `OUTING_TYPES` authoritative dan Tetapan Outing ialah interface operasi;
- `TELEGRAM_ENABLED=true` kekal aktif;
- readiness hijau dan chip Admin memaparkan `Config Active`;
- `require_selfie`, audit auto-approval, statistik, Telegram, filter operasi dan label contextual membaca config secara dinamik;
- application rules dan departure rules dipisahkan melalui `allowed_days`/application window serta `departure_allowed_days`/`earliest_departure_time`;
- `PULANG_BERMALAM` boleh dipohon pada mana-mana hari, departure semasa ialah Jumaat dan earliest time `17:00`, boleh diubah Admin mengikut arahan HEP.

Runbook rollout dan rollback: [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md).

- Metadata displayed frontend/footer/version berada pada `v2.2.0`; asset/cache source revision ialah `2.2.0-r2`.
- Backend GAS production ialah **Version 36** dan source kanonik ialah `gas/Code.gs`; `gas/Code.production-v171.gs` bukan source deploy.
- Google Sheets kekal database/source of truth.
- Google Drive private menyimpan bukti selfie dan Telegram `sendPhoto` menghantar imej sebenar.
- `.claspignore` mengekalkan whitelist/hygiene supaya hanya source GAS kanonik dan manifest berada dalam skop push.

## Fungsi Disahkan

- Landing mempunyai grid kompak 2×2 `Pelajar`, `Warden & HEP`, `Guard`, `Pemantauan Semasa`; Public Statistik tidak lagi tersedia.
- Warden dan HEP berkongsi role backend `warden`, dengan istilah Warden/HEP pada UI.
- Jenis `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM`, `CUTI_SEMESTER`.
- Pelajar login dengan `student_id` dalaman + nombor matrik yang ditaip.
- Warden approve/reject dan Guard confirm keluar/masuk menggunakan POST authenticated.
- Runtime credential staff dipulihkan selepas fresh login.
- Tiada fallback authenticated kepada public records.
- Warden Checklist menggunakan emoji dan status kontekstual.
- Guard quick filter dan contextual empty-state berfungsi pada kedua-dua seksyen.
- Public Monitoring membuka inline dalam shell landing, membuat GET awam khusus, mengelakkan overlap dan merender sekali.
- Public Monitoring mengekalkan data lama apabila refresh gagal.
- Public Monitoring hanya memaparkan ringkasan dan `Senarai Status Semasa`.
- Statistik hanya boleh dicapai sebagai modul inline Admin berautentikasi; filter bulan/tahun/kelas, KPI, ringkasan kelas/jenis/status dan statistik individu kekal tersedia.
- Tujuh modul Admin inline ialah `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`.
- Rekod Master menyokong carian, filter dan pagination; Pemantauan Admin memaparkan operasi semasa secara baca sahaja; Pelajar melihat jumlah outing tahunan.
- Foto profil disimpan private melalui `PROFILE_PHOTO_FOLDER_ID` dan metadata `STUDENTS.photo_file_id`/`photo_updated_at`; batch authenticated `thumbnail` membekalkan imej kompak dengan initials fallback kepada Pelajar, Warden/HEP, Guard dan Admin.
- Foto penuh dimuat untuk satu pelajar sahaja apabila preview dibuka, kemudian dicache sepanjang sesi; placeholder dan Public Monitoring tidak mempunyai preview.
- API/GAS network-only dalam service worker; cache lama dibersihkan.
- Displayed version/footer kekal v2.2.0; asset query dan cache source konsisten pada `2.2.0-r2`.
- Config-driven production menggunakan `require_selfie` yang disnapshot; false menghasilkan `TIDAK_DIPERLUKAN`.
- Status utama kekal `SELESAI`; `selfie_status` menyimpan `BELUM_HANTAR`, `SUDAH_HANTAR` atau `TIDAK_DIPERLUKAN` secara berasingan.
- Front camera, preview, retake, resize, JPEG compression, loading dan mock submission telah disahkan.
- Backend mengesahkan pemilikan, status/masa masuk, MIME/base64/saiz dan duplicate submission dengan `LockService`.
- Cleanup transaksi separa serta audit failure non-fatal selepas submission lengkap telah disahkan.
- Public Monitoring dan service worker mengekalkan boundary privasi metadata selfie.
- Controlled smoke test 10 Ogos 2026 lulus bagi config activation, non-Friday rejection, Friday submission, Warden approval dan early Guard rejection.
- Guard kini memaparkan business-rule tarikh/hari/masa secara selamat; request 14 Ogos 2026 ditolak ketika confirm-out dicuba pada 10 Ogos 2026.
- Public Monitoring berfungsi pada klik pertama dan Statistik Admin inline berjaya dimuatkan tanpa meninggalkan sesi Admin.
- Production smoke test mengesahkan upload Pelajar, thumbnail Warden/HEP, Guard, Admin Pemantauan dan Admin Tetapan Pelajar, secure full preview, Public Pemantauan photo-free, keyboard Enter, rolling KPI serta two-tier performance optimisation.

## Privacy Boundary

Public `getStudents`:

```text
student_id | nama | kelas
```

Public GET `getTodayRecords`:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Public response tidak mempunyai nombor matrik, internal/request ID, telefon, waris, lokasi, tujuan, kenderaan, credential atau metadata operasi. Nama kekal dibenarkan pada Public Monitoring read-only; boundary ini diperkenalkan pada v1.6.25 dan diteruskan dalam v1.7.0.

Metadata selfie, foto profil, URL/file ID Drive dan Telegram message ID juga tidak termasuk dalam projection awam.

Operational POST kekal berasingan dan memerlukan credential role sebenar.

## Status Kontekstual

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar
- 🌙 Sedang Bermalam
- 🏖️ Sedang Bercuti
- ✅ Sudah Pulang
- 🔴 Lewat

Nilai backend `KELUAR` tidak berubah.

## Deployment Milestone

- **v1.6.24:** frontend-only Guard filter release.
- **v1.6.25:** frontend + GAS Public Monitoring/privacy release.
- **v1.7.0:** frontend + GAS + Google Drive + Telegram return-selfie release; GAS Version 21.
- **v1.7.1:** menambah Outing Sabtu / Ahad; Pull Request #2 digabungkan melalui `fa7227e` daripada `1e6303c`.
- **v2.0.0:** production frontend rollout pada 4 Ogos 2026 melalui `4eedcbe`; backend kekal GAS Version 24 dengan feature flag config-driven submission masih `false`.
- **v2.1.0:** Guard UI diperkemas, jumlah outing tahunan Pelajar, statistik individu Admin berautentikasi, tempoh outing sebenar, hygiene clasp dan pembaikan rendering Statistik Admin. Production kini menggunakan GAS Version 31 dengan foto profil operational; preview besar semasa ialah perubahan frontend-only.
- **v2.2.0:** enam modul Admin inline, pengurusan operasi/master data, foto profil private dengan thumbnail batch/full on-demand, identifikasi Warden/Guard/Admin, rolling KPI, Enter UX dan cache delivery. GAS Version 32 serta semua smoke test semasa disahkan live pada 9 Ogos 2026.
- **10 Ogos 2026:** config-driven production diaktifkan dan disahkan pada GAS Version 36; cache revision `2.2.0-r1`, readiness hijau dan rollback flag-false kekal tersedia tanpa redeployment.

## Production Validation v1.7.0

Ujian production berjaya menggunakan request `OUT-20260726-121316-1479`:

- status utama: `SELESAI`;
- `selfie_status`: `SUDAH_HANTAR`;
- `selfie_file_id` dan `selfie_url`: terisi;
- `masa_selfie`: `2026-07-26 12:18:00`;
- `selfie_telegram_message_id`: `98`;
- imej berjaya disimpan dalam Drive private dan dihantar ke Telegram.

## Future Work

- Google/domain login atau stronger auth.
- Hashed PIN storage.
- Backend-issued session token.
- Audit log dan selfie retention/deletion policy.
- Admin/Warden evidence review UI.
- Automated cleanup selepas retention period.
- Telegram retry queue.
- Consent/privacy notice refinement.
- QR code.
- Late-return escalation.
- Automated reports dan version injection.
