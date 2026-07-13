# Security Notes eOuting ITU

Dokumen ini menerangkan boundary keselamatan live **v1.6.25**. Frontend ialah laman statik yang boleh diperiksa oleh pengguna; authorization sebenar mesti berlaku di GAS dan Google Sheets.

## Public Data Boundary

Public `getStudents` hanya mengembalikan:

```text
student_id | nama | kelas
```

Public GET `getTodayRecords` hanya mengembalikan:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Nama dibenarkan pada Public Monitoring read-only v1.6.25. PII dan metadata berikut kekal disekat:

- `student_id` daripada monitoring;
- `no_matrik` dan `request_id`;
- e-mel dan nombor telefon;
- nama/telefon waris;
- lokasi, tujuan dan maklumat kenderaan;
- sebab kecemasan penuh dan catatan dalaman;
- nama pegawai/audit metadata;
- PIN, credential dan secret.

Public `getOutingStats` hanya menyediakan aggregated counts, bukan row mentah atau leaderboard individu.

## Authenticated Operational Records

Rekod operasi menggunakan POST `getTodayRecords` yang berasingan:

- Pelajar: backend sahkan `student_id` + `no_matrik` dan hanya pulangkan rekod Pelajar itu.
- Warden: backend sahkan nama + PIN dan pulangkan rekod operasi Warden.
- Guard: backend sahkan nama + PIN dan pulangkan rekod operasi Guard.

Jika credential hilang atau salah, frontend menunjukkan error terkawal. Authenticated flow tidak fallback kepada public GET dan tidak merender data awam seolah-olah data operasi.

## PIN dan Session

PIN ialah basic internal access control, bukan authentication production-grade.

Backend memastikan:

- Warden/Guard login memerlukan nama + PIN aktif;
- approve/reject memerlukan credential Warden;
- confirm keluar/masuk memerlukan credential Guard;
- PIN kosong/null/whitespace ditolak;
- PIN tidak dipulangkan oleh response login atau public endpoint.

PIN yang ditaip digabungkan ke runtime session selepas fresh staff login supaya POST operasi boleh berjalan. Flow `Ingat peranti ini` sedia ada menggunakan localStorage dengan expiry; jangan gunakannya pada peranti public/shared tanpa kelulusan operasi. Shared Guard PC perlu log keluar selepas digunakan.

Jangan hardcode PIN dalam frontend, test fixture production atau dokumentasi.

## Service Worker dan Cache

- Request GAS/API menggunakan network sahaja.
- Service worker tidak memanggil `caches.match` atau `cache.put` untuk response dinamik.
- Cache eOuting lama dibuang semasa activate.
- Static app shell kekal cacheable.
- Cache live semasa ialah `eouting-cache-v1.6.25`.

Ini menghalang response API lama yang mungkin mengandungi PII daripada kekal dalam Cache Storage selepas deployment.

## Backend Validation

GAS mesti mengesahkan:

- identiti dan status aktif Pelajar;
- identiti, status dan PIN Warden/Guard;
- role/action permission;
- transition status sebelum approve/reject/confirm;
- duplicate active request;
- rule masa Outing Biasa;
- credential operasi sebelum mengeluarkan row penuh.

Frontend role hiding, button visibility, PWA install dan local state bukan security enforcement.

## Telegram dan Deployment Secrets

Jangan commit:

- Telegram bot token atau secret chat configuration;
- PIN sebenar;
- password, API key atau access token;
- Apps Script/deployment credential;
- data Google Sheets atau PII pelajar;
- secret dalam logs, screenshots atau debug output.

Telegram configuration mesti disimpan dalam Apps Script Script Properties. Deployment URL boleh kekal dalam frontend, tetapi credential untuk mengurus deployment tidak boleh berada dalam repo.

## Spreadsheet dan Audit

- Spreadsheet mesti private dan dikongsi kepada akaun yang perlu sahaja.
- Jangan publish tab sebagai public.
- Audit log tidak boleh menyimpan PIN atau raw credential.
- Semak access owner/editor secara berkala.
- Retention dan backup policy masih perlu ditetapkan.

## Roadmap

- PIN unik dan hashed.
- Google Account/domain-restricted login.
- Backend-issued session token.
- Audit retention dan role-based access review.
- Deployment permission dan backup policy yang lebih ketat.
