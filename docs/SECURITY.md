# Security Notes eOuting ITU

Dokumen ini menerangkan realiti keselamatan untuk **Live V1 proof-of-concept** eOuting ITU.

Status semasa:

- Frontend GitHub Pages: `https://itumelaka.github.io/eouting`
- Basic PWA setup: siap
- Google Sheets live backend melalui GAS: siap
- Warden/Guard PIN login: siap
- Audit log asas: siap

## Prinsip Utama

Frontend GitHub Pages ialah laman statik. Kod frontend boleh dilihat oleh pengguna.

Jangan anggap perkara berikut sebagai security sebenar:

- Tab atau panel yang disembunyikan di frontend.
- Role switching di frontend.
- Paparan button yang disembunyikan.
- Mode indicator.
- PWA install.

Security sebenar mesti dibuat di GAS backend dan kawalan akses Google/Spreadsheet.

## V1 PIN Reality

Live V1 menggunakan PIN sebagai basic access control untuk Warden dan Guard.

PIN testing sementara:

```text
949494
```

Nota penting:

- Ini bukan bank-grade security.
- PIN testing perlu ditukar sebelum pilot sebenar.
- Setiap Warden/Guard patut diberi PIN unik.
- PIN tidak boleh didedahkan melalui frontend logs atau GET endpoints.
- PIN tidak boleh hardcode di frontend.

## Jangan Commit Data Sensitif

Jangan simpan perkara berikut dalam GitHub repo:

- Password.
- Token.
- Secret.
- API key.
- Deployment credential.
- PIN sebenar production.
- Data pelajar penuh yang tidak perlu didedahkan.

## Spreadsheet Access

Spreadsheet mengandungi data dalaman.

Amalan wajib:

- Kekalkan sharing Spreadsheet secara private.
- Beri akses hanya kepada akaun yang perlu.
- Semak akses owner/editor secara berkala.
- Jangan publish Spreadsheet kepada public.

## Backend Validation

GAS backend V1 mesti validate:

- Student identity: nama + `no_matrik`.
- Student status: hanya `Aktif` boleh login/request outing.
- Warden identity, status, dan PIN sebelum approve/reject.
- Guard identity, status, dan PIN sebelum confirm keluar/masuk.
- Role/action permission untuk setiap request.
- Outing Biasa hanya Selasa/Rabu selepas 5:00 PM.
- Kecemasan boleh dihantar bila-bila masa tetapi tetap perlu kelulusan warden.
- Guard tidak boleh confirm keluar jika belum diluluskan warden.

## Role Permission

| Action | Role dibenarkan |
|---|---|
| `loginStudent` | Student |
| `loginWarden` | Warden |
| `loginGuard` | Guard |
| `submitRequest` | Student |
| `approveRequest` | Warden |
| `rejectRequest` | Warden |
| `confirmOut` | Guard |
| `confirmIn` | Guard |
| `getTodayRecords` | Live app / monitoring use |

## Audit Log

Semua tindakan penting perlu direkod dalam `AUDIT_LOG`.

Header V1:

```text
timestamp | action | request_id | user_role | user_name | details
```

Audit log digunakan untuk:

- Login penting.
- Permohonan dihantar.
- Permohonan diluluskan.
- Permohonan ditolak.
- Guard sahkan keluar.
- Guard sahkan masuk.
- Error atau validation penting jika perlu.

## Future Improvements

- PIN unik per Warden/Guard.
- Hash PIN, bukan simpan plain text.
- Google Account login / domain-restricted access.
- Audit review berkala.
- Deployment permissions lebih ketat.
- SOP siapa boleh akses Pemantauan Semasa.
- Backup dan retention policy untuk Spreadsheet.

## Had Sistem V1

- Live V1 ialah proof-of-concept / pilot-ready, bukan final production security.
- Link GitHub Pages boleh dibuka oleh sesiapa yang ada URL.
- Jika GAS Web App dibuka kepada anyone with link, backend validation mesti ketat.
- PWA cache menyimpan fail frontend statik sahaja.
