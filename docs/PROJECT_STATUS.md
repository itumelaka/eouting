# Project Status eOuting ITU

Status repo semasa: **v1.7.1 — Outing Sabtu / Ahad**.

## eOuting v2.0 Beta Readiness

Branch `feat/admin-outing-config-v2` telah melengkapkan Fasa 1–5B: baseline, schema/migration additive, Admin backend/API, Admin Dashboard, mock QA, canonical POST router, borang Pelajar config-driven dan validation submission feature-gated.

Verdict semasa ialah **bersedia secara bersyarat untuk beta terkawal**, bukan production v2.0 umum. Runtime/PWA metadata sengaja kekal `v1.7.1`; versi dicadangkan apabila beta benar-benar diterbitkan ialah `v2.0.0-beta.1`.

Release gate yang belum selesai:

- backup dan migration pada persekitaran beta;
- Admin sebenar ditambah manual dan akses Sheet disemak;
- deployment GAS/frontend beta berasingan;
- QA semua role dengan flag `false`, kemudian activation manual terkawal;
- `require_selfie` belum mengawal lifecycle;
- statistik dan label Telegram belum dinamik sepenuhnya untuk jenis custom.

Runbook rollout dan rollback: [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md).

- Metadata frontend, footer dan cache repo berada pada `v1.7.1`.
- Pull Request #1 telah digabungkan ke `main`: merge commit `beec1e0`, feature commit `21996a2`.
- Backend GAS production dideploy sebagai **Version 21** pada **26 Jul 2026**.
- Google Sheets kekal database/source of truth.
- Google Drive private menyimpan bukti selfie dan Telegram `sendPhoto` menghantar imej sebenar.
- Automated test baseline selepas Fasa 5B: **125/125 lulus**.

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
- Statistik hanya aggregated counts; leaderboard individu telah dibuang.
- API/GAS network-only dalam service worker; cache lama dibersihkan.
- Version, footer, asset query strings dan cache konsisten pada v1.7.1.
- Bukti selfie wajib untuk semua lima jenis permohonan selepas `confirmIn`.
- Status utama kekal `SELESAI`; `selfie_status` menyimpan `BELUM_HANTAR` / `SUDAH_HANTAR` secara berasingan.
- Front camera, preview, retake, resize, JPEG compression, loading dan mock submission telah disahkan.
- Backend mengesahkan pemilikan, status/masa masuk, MIME/base64/saiz dan duplicate submission dengan `LockService`.
- Cleanup transaksi separa serta audit failure non-fatal selepas submission lengkap telah disahkan.
- Public Monitoring dan service worker mengekalkan boundary privasi metadata selfie.

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
