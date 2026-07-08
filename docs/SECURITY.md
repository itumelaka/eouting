# Security Notes eOuting ITU

Dokumen ini menerangkan kawalan keselamatan asas untuk sistem eOuting ITU.

Status semasa:

- Frontend GitHub Pages: `https://itumelaka.github.io/eouting`
- Basic PWA setup: siap
- Frontend mock role-based access: siap
- Main Spreadsheet database: disediakan
- GAS backend: belum dibina

## Prinsip Utama

Frontend GitHub Pages ialah laman statik. Semua kod frontend boleh dilihat oleh pengguna.

Jangan anggap perkara berikut sebagai security sebenar:

- Tab atau panel yang disembunyikan di frontend.
- Role switching di frontend mock mode.
- Warden/Guard pilih nama sahaja dalam mock mode.
- `GAS_WEB_APP_URL` kosong di frontend.

Security sebenar mesti dibuat dalam GAS backend.

## Jangan Commit Data Sensitif

Jangan simpan perkara berikut dalam GitHub repo:

- Password.
- Token.
- Secret.
- API key.
- PIN sebenar.
- Deployment credential.
- Data pelajar penuh yang tidak perlu didedahkan.

## Mock Mode Semasa

Mock access semasa hanya untuk UI testing:

- Pelajar guna nama + `no_matrik`.
- Warden pilih nama sahaja.
- Guard pilih nama sahaja.
- Tiada PIN sebenar digunakan dalam frontend mock mode.

Ini bukan authentication sebenar.

## Live Mode Validation

GAS backend V1 mesti validate:

- Student identity: nama + `no_matrik`.
- Student status: hanya `Aktif` boleh login/request outing.
- Warden identity dan status sebelum approve/reject.
- Guard identity dan status sebelum confirm keluar/masuk.
- Role/action permission untuk setiap request.
- Outing Biasa hanya Selasa/Rabu selepas 5:00 PM.
- Kecemasan boleh dihantar bila-bila masa tetapi tetap perlu kelulusan warden.

## Role Permission

| Action | Role dibenarkan |
|---|---|
| submitRequest | Student |
| approveRequest | Warden |
| rejectRequest | Warden |
| confirmOut | Guard |
| confirmIn | Guard |
| getTodayRecords | Warden / Guard / dashboard role yang dibenarkan |

## Audit Log

Semua tindakan penting perlu direkod dalam `AUDIT_LOG`.

Header V1:

```text
timestamp | action | request_id | user_role | user_name | details
```

Audit log perlu digunakan untuk:

- Permohonan dihantar.
- Permohonan diluluskan.
- Permohonan ditolak.
- Guard sahkan keluar.
- Guard sahkan masuk.
- Error atau validation penting jika perlu.

## PIN / Authentication Future

PIN tidak digunakan dalam frontend mock mode.

Untuk live mode, sistem boleh tambah:

- PIN warden/guard.
- Hash PIN di Spreadsheet.
- Google Account login untuk warden.
- Kaedah authentication lebih kuat.

Jika PIN digunakan:

- Jangan hardcode PIN di frontend.
- Jangan simpan PIN plain text jika boleh dielakkan.
- Validation PIN mesti berlaku di GAS backend.

## Had Sistem V1

- Link GitHub Pages boleh dibuka oleh sesiapa yang ada URL.
- PWA cache menyimpan fail frontend statik sahaja.
- Jika GAS Web App dibuka kepada anyone with link, backend validation wajib ketat.
- Spreadsheet mengandungi data dalaman dan perlu dijaga aksesnya.
