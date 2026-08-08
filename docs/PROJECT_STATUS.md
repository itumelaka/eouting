# Project Status eOuting ITU

Status repo semasa: **v2.1.0 — production frontend release**.

## eOuting v2.1 Production

Frontend v2.1.0 diterbitkan melalui commit `chore: bump eOuting version to 2.1.0` (commit release ini). URL production ialah `https://itumelaka.github.io/eouting/`.

Verdict semasa ialah **release production v2.1.0** dengan GAS Version 27 yang telah live. Footer dan cache repo diselaraskan kepada `v2.1.0`.

Production boundary semasa:

- frontend release ialah `v2.1.0` dan backend production ialah GAS **Version 27**;
- Spreadsheet production ialah `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`;
- endpoint GAS production kekal `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`;
- `OUTING_CONFIG_V2_ENABLED=false`, maka validation submission legacy masih aktif;
- `TELEGRAM_ENABLED=true` kekal aktif;
- pengaktifan config-driven submission memerlukan keputusan dan verifikasi berasingan;
- `require_selfie` belum mengawal lifecycle;
- statistik dan label Telegram belum dinamik sepenuhnya untuk jenis custom.

Runbook rollout dan rollback: [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md).

- Metadata frontend, footer dan cache repo berada pada `v2.1.0`.
- Release v2.1.0 dikenal pasti melalui commit `chore: bump eOuting version to 2.1.0`.
- Backend GAS production ialah **Version 27**.
- Google Sheets kekal database/source of truth.
- Google Drive private menyimpan bukti selfie dan Telegram `sendPhoto` menghantar imej sebenar.
- Automated test suite sebelum deployment: **177/177 lulus**.

## Fungsi Disahkan

- Role Pelajar, Warden, Guard dan Public Monitoring read-only.
- Jenis `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM`, `CUTI_SEMESTER`.
- Pelajar login dengan `student_id` dalaman + nombor matrik yang ditaip.
- Warden approve/reject dan Guard confirm keluar/masuk menggunakan POST authenticated.
- Runtime credential staff dipulihkan selepas fresh login.
- Tiada fallback authenticated kepada public records.
- Warden Checklist menggunakan emoji dan status kontekstual.
- Guard quick filter dan contextual empty-state berfungsi pada kedua-dua seksyen.
- Public Monitoring membuka sekali klik, scroll, membuat GET awam khusus, mengelakkan overlap dan merender sekali.
- Public Monitoring mengekalkan data lama apabila refresh gagal.
- Public Monitoring hanya memaparkan ringkasan dan `Senarai Status Semasa`.
- Statistik agregat kekal public tanpa nama individu; Admin berautentikasi boleh melihat statistik individu mengikut filter yang sama.
- API/GAS network-only dalam service worker; cache lama dibersihkan.
- Version, footer, asset query strings dan cache konsisten pada v2.1.0.
- Bukti selfie wajib untuk semua lima jenis permohonan selepas `confirmIn`.
- Status utama kekal `SELESAI`; `selfie_status` menyimpan `BELUM_HANTAR` / `SUDAH_HANTAR` secara berasingan.
- Front camera, preview, retake, resize, JPEG compression, loading dan mock submission telah disahkan.
- Backend mengesahkan pemilikan, status/masa masuk, MIME/base64/saiz dan duplicate submission dengan `LockService`.
- Cleanup transaksi separa serta audit failure non-fatal selepas submission lengkap telah disahkan.
- Public Monitoring dan service worker mengekalkan boundary privasi metadata selfie.
- Admin production login serta flow Pelajar, Warden dan Guard kekal berfungsi pada v2.1.0.
- Public Monitoring berfungsi pada klik pertama, Statistik berjaya dimuatkan dan intentional auto-scroll mobile berjalan lancar.

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

Metadata selfie, URL/file ID Drive dan Telegram message ID juga tidak termasuk dalam projection awam v1.7.0.

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
- **v2.1.0:** Guard UI diperkemas, jumlah outing tahunan Pelajar, statistik individu Admin berautentikasi, tempoh outing sebenar, hygiene clasp dan pembaikan rendering Statistik Admin; backend GAS Version 27.

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
- Admin master-data page.
- Late-return escalation.
- Automated reports dan version injection.
