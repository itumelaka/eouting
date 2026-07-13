# Project Status eOuting ITU

Status semasa: **live v1.6.25**.

- Frontend v1.6.25 telah commit dan push ke GitHub Pages.
- Backend GAS v1.6.25 telah `clasp push`, dideploy sebagai version live baharu dan diuji.
- Google Sheets kekal database/source of truth.
- Telegram notification untuk flow utama kekal aktif.
- Automated test baseline: **40/40 lulus**.

## Fungsi Disahkan

- Role Pelajar, Warden, Guard dan Public Monitoring read-only.
- Jenis `OUTING_BIASA`, `KECEMASAN`, `PULANG_BERMALAM`, `CUTI_SEMESTER`.
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
- Version, footer, asset query strings dan cache konsisten pada v1.6.25.

## Privacy Boundary

Public `getStudents`:

```text
student_id | nama | kelas
```

Public GET `getTodayRecords`:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Public response tidak mempunyai nombor matrik, internal/request ID, telefon, waris, lokasi, tujuan, kenderaan, credential atau metadata operasi. Nama dibenarkan untuk Public Monitoring v1.6.25.

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

## Future Work

- Google/domain login atau stronger auth.
- Hashed PIN storage.
- Backend-issued session token.
- Audit log retention policy.
- QR code dan upload selfie.
- Admin master-data page.
- Late-return escalation.
- Automated reports dan version injection.
