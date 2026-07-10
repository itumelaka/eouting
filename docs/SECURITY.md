# Security Notes eOuting ITU

Dokumen ini menerangkan realiti keselamatan untuk **Live/pilot stable v1.6.16** eOuting ITU.

## Status Semasa

- Frontend GitHub Pages: `https://itumelaka.github.io/eouting`
- Google Sheets live backend melalui GAS: siap
- Warden/Guard PIN login: siap
- Backend staff action PIN hardening: siap
- Empty/blank PIN rejected by backend: siap
- Duplicate active request prevention in backend: siap
- Telegram Bot notification: siap
- Audit log asas: siap
- PWA/version cache update: siap

## Prinsip Utama

Frontend GitHub Pages ialah laman statik. Kod frontend boleh dilihat oleh pengguna.

Jangan anggap perkara berikut sebagai security sebenar:

- Tab atau panel yang disembunyikan di frontend.
- Role switching di frontend.
- Paparan button yang disembunyikan.
- Mode indicator.
- PWA install.

Security sebenar mesti dibuat di GAS backend dan kawalan akses Google/Spreadsheet.

## PIN Reality

v1.6.16 menggunakan PIN sebagai basic internal access control untuk Warden dan Guard.

Backend memastikan:

- login Warden/Guard memerlukan nama + PIN.
- approve/reject memerlukan nama Warden + PIN.
- confirm keluar/masuk memerlukan nama Guard + PIN.
- PIN kosong/null/whitespace ditolak.
- lookup staff mesti match nama + PIN + status aktif.
- PIN tidak dipulangkan dalam GET master-data response.

Nota penting:

- Ini bukan final production-grade authentication.
- Setiap Warden/Guard patut diberi PIN unik.
- PIN tidak boleh didedahkan melalui frontend logs atau GET endpoints.
- PIN tidak boleh hardcode di frontend.

## Remember Device / PWA Session

PWA menyokong pilihan `Ingat peranti ini` untuk mengurangkan login berulang semasa pilot.

Realiti keselamatan:

- Sesi disimpan di browser/PWA localStorage dengan expiry.
- Student session tamat selepas 24 jam.
- Warden/Guard session tamat selepas 12 jam.
- Warden/Guard PIN hanya disimpan jika pengguna memilih `Ingat peranti ini`.
- Shared guard PC perlu `Log Keluar` selepas digunakan.
- Warden/Guard PIN tidak patut disimpan pada public/shared device kecuali diluluskan oleh operasi.

Cadangan future:

- Ganti PIN persistence dengan backend-issued session token.
- Pertimbang Google login / domain restriction.
- Hash PIN instead of storing plain text.
- Hadkan Pemantauan/Statistik kepada Warden/HEP jika diperlukan.

## Backend Validation

GAS backend validate:

- Student identity: nama + `no_matrik`.
- Student status: hanya `Aktif` boleh login/request outing.
- Warden identity, status, dan PIN sebelum approve/reject.
- Guard identity, status, dan PIN sebelum confirm keluar/masuk.
- Role/action permission untuk setiap write action.
- Outing Biasa hanya Selasa/Rabu selepas 5:00 PM.
- Kecemasan boleh dihantar bila-bila masa tetapi tetap perlu kelulusan warden.
- Guard tidak boleh confirm keluar jika belum diluluskan warden.
- Student duplicate active request blocked for active statuses.

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
| `getOutingStats` | Live app / Statistik read-only |

## Audit Log

Tindakan utama direkod dalam `AUDIT_LOG`.

Header:

```text
timestamp | action | request_id | user_role | user_name | details
```

Audit log digunakan untuk:

- Permohonan dihantar.
- Permohonan diluluskan.
- Permohonan ditolak.
- Guard sahkan keluar.
- Guard sahkan masuk.

Retention policy masih future TODO.

## Jangan Commit Data Sensitif

Jangan simpan perkara berikut dalam GitHub repo:

- Password.
- Token.
- Secret.
- API key.
- Deployment credential.
- PIN sebenar production.
- Telegram bot token.
- Telegram chat ID jika dianggap sensitif untuk operasi.
- Data pelajar penuh yang tidak perlu didedahkan.

## Spreadsheet Access

Spreadsheet mengandungi data dalaman.

Amalan wajib:

- Kekalkan sharing Spreadsheet secara private.
- Beri akses hanya kepada akaun yang perlu.
- Semak akses owner/editor secara berkala.
- Jangan publish Spreadsheet kepada public.

## Future Security Improvements

- PIN unik per Warden/Guard.
- Hash PIN, bukan simpan plain text.
- Google Account login / domain-restricted access.
- Backend-issued session token untuk PWA remember-device.
- Audit log retention policy.
- Role-based access hardening.
- Deployment permissions lebih ketat.
- SOP siapa boleh akses Pemantauan Semasa dan Statistik.
- Backup dan retention policy untuk Spreadsheet.
