# Struktur Database Google Sheets

Database utama eOuting ITU menggunakan Google Sheets.

Status semasa:

- Spreadsheet title: `eOuting ITU Database`
- Spreadsheet ID: `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`
- GitHub Pages frontend: `https://itumelaka.github.io/eouting`
- Basic PWA setup: siap
- GAS backend: belum dibina

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

## Tab: WARDENS

Menyimpan senarai warden yang boleh meluluskan atau menolak permohonan.

Header V1:

```text
warden_id | nama_warden | email | no_tel | pin | status | catatan
```

Nota: PIN tidak digunakan dalam frontend mock mode. Untuk live mode, validation PIN atau authentication lebih kuat mesti dibuat di GAS backend.

## Tab: GUARDS

Menyimpan senarai guard / pengguna pos guard.

Header V1:

```text
guard_id | nama_guard | email | no_tel | pin | status | catatan
```

Nota: PIN tidak digunakan dalam frontend mock mode. Untuk live mode, validation PIN atau authentication lebih kuat mesti dibuat di GAS backend.

## Tab: OUTING_REQUESTS

Menyimpan semua rekod permohonan outing.

Header V1:

```text
request_id | tarikh | hari | jenis_permohonan | student_id | no_matrik | nama | student_email | kelas | tujuan | lokasi | jenis_kenderaan | butiran_kenderaan | sebab_kecemasan | telefon_waris | hubungan_waris | catatan_kecemasan | masa_mohon | status | warden_approve_by | masa_approve | masa_keluar | guard_keluar_by | masa_masuk | guard_masuk_by | lewat | selfie_whatsapp | catatan
```

Jenis permohonan:

- `OUTING_BIASA`
- `KECEMASAN`

Status utama:

- `Menunggu Kelulusan`
- `Diluluskan Warden`
- `Ditolak Warden`
- `Sedang Keluar`
- `Sudah Pulang`

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
AUTO_MARK_LATE
```

## Nota Penting

- Jangan simpan password, token, secret, API key atau deployment credential dalam repo.
- Frontend mock data hanya untuk UI testing.
- GAS backend V1 mesti validate identity, role, dan status sebelum menulis ke Spreadsheet.
- `GAS_WEB_APP_URL` di frontend kekal kosong sehingga GAS Web App siap deploy.
