# Struktur Database Google Sheets

Database utama eOuting ITU menggunakan Google Sheets.

Status semasa:

- Spreadsheet title: `eOuting ITU Database`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- GitHub Pages frontend: `https://itumelaka.github.io/eouting`
- GAS backend: Live/pilot stable v1.6.16
- PWA/version cache update: siap
- Telegram Bot notification: siap, config melalui Script Properties

Setiap tab dalam Google Sheets mewakili satu jadual data.

## Tab: STUDENTS

Menyimpan senarai pelajar.

Header:

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

Menyimpan senarai Warden yang boleh meluluskan atau menolak permohonan.

Header:

```text
warden_id | nama_warden | email | no_tel | pin | status | catatan
```

Nota:

- `pin` digunakan untuk basic internal access control.
- PIN divalidasi di GAS backend.
- PIN kosong/null/whitespace ditolak oleh backend.
- Staff action Warden perlu match nama + PIN + status aktif.
- PIN tidak boleh didedahkan dalam response atau audit details.
- `no_tel` perlu diformat sebagai **Plain text**.

## Tab: GUARDS

Menyimpan senarai Guard / pengguna pos guard.

Header:

```text
guard_id | nama_guard | email | no_tel | pin | status | catatan
```

Nota:

- `pin` digunakan untuk basic internal access control.
- PIN divalidasi di GAS backend.
- PIN kosong/null/whitespace ditolak oleh backend.
- Staff action Guard perlu match nama + PIN + status aktif.
- PIN tidak boleh didedahkan dalam response atau audit details.
- `no_tel` perlu diformat sebagai **Plain text**.

## Tab: OUTING_REQUESTS

Menyimpan semua rekod permohonan outing. Tab ini ialah **source of truth** untuk lifecycle permohonan.

Header semasa:

```text
request_id | tarikh | hari | jenis_permohonan | student_id | no_matrik | nama | student_email | kelas | tujuan | lokasi | jenis_kenderaan | butiran_kenderaan | sebab_kecemasan | telefon_waris | hubungan_waris | catatan_kecemasan | masa_mohon | status | warden_approve_by | masa_approve | masa_keluar | guard_keluar_by | masa_masuk | guard_masuk_by | lewat | selfie_whatsapp | catatan | tarikh_balik | hari_balik | masa_balik_dijangka
```

Jenis permohonan:

- `OUTING_BIASA`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Status lifecycle:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `KELUAR`
- `SELESAI`

Status aktif untuk duplicate prevention:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `KELUAR`

Status yang tidak block permohonan baru:

- `SELESAI`
- `DITOLAK_WARDEN`

Nota medan:

- `lewat` digunakan untuk tanda pulang lewat.
- `selfie_whatsapp` wujud sebagai medan data, tetapi upload selfie belum menjadi feature production.
- `tarikh_balik`, `hari_balik`, dan `masa_balik_dijangka` digunakan untuk jenis permohonan yang memerlukan maklumat balik/pulang.

Nota format:

- `no_matrik` perlu diformat sebagai **Plain text**.
- `telefon_waris` perlu diformat sebagai **Plain text**.
- Nombor telefon perlu kekal **Plain text** supaya digit awal tidak hilang.
- Masa dan tarikh perlu konsisten supaya frontend dan GAS boleh memaparkan data dengan betul.

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

Paparan Statistik boleh filter mengikut bulan, tahun, dan kelas.

## Pemantauan Semasa

`Pemantauan Semasa` membaca rekod semasa melalui backend dan memaparkan:

- Summary cards.
- Rekod detail.
- Senarai Nama Semasa.
- Status icons.
- Loading/error state.

Paparan ini read-only dan tidak menulis data ke Spreadsheet.

## Warden Checklist Permohonan

Warden Checklist membaca data daripada `OUTING_REQUESTS`.

Checklist merangkumi semua jenis:

- `OUTING_BIASA`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Copy Senarai Nama memasukkan status:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `KELUAR`
- `SELESAI`

Copy Senarai Nama mengecualikan:

- `DITOLAK_WARDEN`

## Tab: AUDIT_LOG

Menyimpan rekod tindakan penting untuk rujukan dan semakan.

Header:

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

Audit log asas sudah wujud. Retention policy dan paparan admin audit masih future roadmap.

## Nota Penting

- Jangan simpan token, secret, API key, atau deployment credential dalam repo.
- PIN sekarang ialah basic internal access control, bukan security production-grade.
- Spreadsheet perlu kekal private dan hanya dikongsi kepada akaun yang perlu.
- Backend mesti validate identity, role, status, PIN, dan action permission sebelum menulis ke Spreadsheet.
- Telegram token dan chat ID tidak disimpan dalam sheet atau repo.
- Telegram config disimpan dalam Apps Script Script Properties:
  - `TELEGRAM_ENABLED`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_CHAT_ID`
