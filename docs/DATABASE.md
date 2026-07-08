# Struktur Database Google Sheets

Database utama eOuting ITU menggunakan Google Sheets.

Status semasa:

- Spreadsheet title: `eOuting ITU Database`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- GitHub Pages frontend: `https://itumelaka.github.io/eouting`
- GAS backend Live v1.3.1: siap
- Basic PWA setup: siap
- Telegram Bot notification: siap, config melalui Script Properties

Setiap tab dalam Google Sheets mewakili satu jadual data.

## Tab: STUDENTS

Menyimpan senarai pelajar.

Header V1:

```text
student_id | no_matrik | nama | email | no_tel | kelas | jantina | status | catatan
```

Peraturan status pelajar:

- `Aktif` = boleh login dan mohon outing.
- `Tidak Aktif` = tidak boleh login dan tidak boleh mohon outing.

Nota format:

- `no_matrik` perlu diformat sebagai **Plain text**.
- `no_tel` perlu diformat sebagai **Plain text** supaya nombor bermula dengan `0` tidak hilang.

## Tab: WARDENS

Menyimpan senarai warden yang boleh meluluskan atau menolak permohonan.

Header V1:

```text
warden_id | nama_warden | email | no_tel | pin | status | catatan
```

Nota V1:

- `pin` digunakan untuk basic access control live mode.
- PIN perlu divalidasi di GAS backend.
- PIN tidak boleh didedahkan melalui GET responses.
- `no_tel` perlu diformat sebagai **Plain text**.

## Tab: GUARDS

Menyimpan senarai guard / pengguna pos guard.

Header V1:

```text
guard_id | nama_guard | email | no_tel | pin | status | catatan
```

Nota V1:

- `pin` digunakan untuk basic access control live mode.
- PIN perlu divalidasi di GAS backend.
- PIN tidak boleh didedahkan melalui GET responses.
- `no_tel` perlu diformat sebagai **Plain text**.

## Tab: OUTING_REQUESTS

Menyimpan semua rekod permohonan outing. Tab ini ialah **source of truth** untuk lifecycle permohonan.

Header V1:

```text
request_id | tarikh | hari | jenis_permohonan | student_id | no_matrik | nama | student_email | kelas | tujuan | lokasi | jenis_kenderaan | butiran_kenderaan | sebab_kecemasan | telefon_waris | hubungan_waris | catatan_kecemasan | masa_mohon | status | warden_approve_by | masa_approve | masa_keluar | guard_keluar_by | masa_masuk | guard_masuk_by | lewat | selfie_whatsapp | catatan
```

Jenis permohonan:

- `OUTING_BIASA`
- `KECEMASAN`

Status lifecycle V1:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `KELUAR`
- `SELESAI`

Nota format:

- `no_matrik` perlu diformat sebagai **Plain text**.
- `telefon_waris` perlu diformat sebagai **Plain text**.
- `no_tel` dan nombor telefon lain perlu kekal **Plain text** supaya digit awal tidak hilang.
- Masa dan tarikh boleh disimpan sebagai Date/DateTime atau string yang konsisten; frontend dan backend V1 sudah menyokong paparan BM friendly.

## Statistik Outing

Action `getOutingStats` menggunakan tab `OUTING_REQUESTS` sebagai **source of truth**. Statistik dikira daripada rekod outing yang sudah disimpan, bukan daripada data dummy frontend.

Field utama yang digunakan untuk kiraan statistik:

- `tarikh` atau fallback `masa_mohon`
- `status`
- `student_id`
- `nama`
- `kelas`
- `jenis_permohonan`
- `lewat`

Status yang dikira:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `KELUAR`
- `SELESAI`

Paparan Statistik boleh filter mengikut bulan, tahun, dan kelas. Tahun frontend v1.3.1 dihadkan kepada 2026-2030 untuk operasi semasa.

## Tab: AUDIT_LOG

Menyimpan rekod tindakan penting untuk rujukan dan semakan.

Header V1:

```text
timestamp | action | request_id | user_role | user_name | details
```

Contoh action:

```text
SUBMIT_REQUEST
APPROVE_REQUEST
REJECT_REQUEST
CONFIRM_OUT
CONFIRM_IN
LOGIN_STUDENT
LOGIN_WARDEN
LOGIN_GUARD
```

## Nota Penting

- Jangan simpan token, secret, API key, atau deployment credential dalam repo.
- PIN V1 ialah basic access control, bukan security production-grade.
- Spreadsheet perlu kekal private dan hanya dikongsi kepada akaun yang perlu.
- Backend mesti validate identity, role, status, PIN, dan action permission sebelum menulis ke Spreadsheet.
- Telegram token dan chat ID tidak disimpan dalam sheet atau repo.
- Telegram config disimpan dalam Apps Script Script Properties:
  - `TELEGRAM_ENABLED`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
