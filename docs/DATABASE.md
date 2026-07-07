# Struktur Database Google Sheets

Database utama eOuting ITU dicadangkan menggunakan Google Sheets.

Setiap tab dalam Google Sheets mewakili satu jadual data.

## Tab: STUDENTS

Menyimpan senarai pelajar aktif.

| Column | Keterangan |
|---|---|
| student_id | ID unik pelajar |
| nama | Nama penuh pelajar |
| kelas | Kelas / kumpulan |
| jantina | Lelaki / Perempuan |
| no_telefon | No telefon pelajar jika perlu |
| status | Aktif / Tidak Aktif |

Contoh:

| student_id | nama | kelas | jantina | no_telefon | status |
|---|---|---|---|---|---|
| S001 | Ahmad Hakimi | A1 | Lelaki |  | Aktif |
| S002 | Nur Aisyah | A1 | Perempuan |  | Aktif |

## Tab: WARDENS

Menyimpan senarai warden yang boleh meluluskan permohonan.

| Column | Keterangan |
|---|---|
| warden_id | ID unik warden |
| nama_warden | Nama warden |
| pin_hash | PIN yang telah di-hash, bukan plain text |
| status | Aktif / Tidak Aktif |

## Tab: GUARDS

Menyimpan senarai guard / pengguna pos guard.

| Column | Keterangan |
|---|---|
| guard_id | ID unik guard |
| nama_guard | Nama guard |
| pin_hash | PIN yang telah di-hash, bukan plain text |
| status | Aktif / Tidak Aktif |

## Tab: OUTING_REQUESTS

Tab paling penting untuk menyimpan rekod outing.

| Column | Keterangan |
|---|---|
| request_id | ID unik permohonan |
| tarikh | Tarikh outing |
| hari | Hari outing |
| student_id | ID pelajar |
| nama | Nama pelajar ketika permohonan dibuat |
| kelas | Kelas pelajar ketika permohonan dibuat |
| tujuan | Tujuan outing |
| lokasi | Lokasi outing |
| no_telefon | No telefon jika diperlukan |
| masa_mohon | Timestamp permohonan |
| status | Status semasa permohonan |
| warden_approve_by | Nama/ID warden yang luluskan |
| masa_approve | Timestamp kelulusan |
| reject_reason | Sebab ditolak jika ada |
| masa_keluar | Timestamp keluar sebenar |
| guard_keluar_by | Nama/ID guard yang sahkan keluar |
| masa_masuk | Timestamp masuk sebenar |
| guard_masuk_by | Nama/ID guard yang sahkan masuk |
| lewat | Ya / Tidak |
| selfie_whatsapp | Ya / Tidak |
| catatan | Catatan warden / guard |
| created_at | Timestamp rekod dibuat |
| updated_at | Timestamp rekod dikemaskini |

## Tab: AUDIT_LOG

Menyimpan rekod tindakan penting untuk rujukan.

| Column | Keterangan |
|---|---|
| timestamp | Masa tindakan berlaku |
| action | Jenis tindakan |
| request_id | ID permohonan berkaitan |
| user_role | Pelajar / Warden / Guard / System |
| user_name | Nama pengguna |
| details | Butiran tindakan |

Contoh action:

```text
CREATE_REQUEST
APPROVE_REQUEST
REJECT_REQUEST
CHECK_OUT
CHECK_IN
MARK_SELFIE_RECEIVED
AUTO_MARK_LATE
CANCEL_REQUEST
```

## Tab: SETTINGS

Menyimpan tetapan sistem.

| key | value | description |
|---|---|---|
| allowed_days | Tuesday,Wednesday | Hari outing dibenarkan |
| outing_start_time | 17:00 | Masa mula outing |
| outing_end_time | 22:00 | Masa akhir pulang |
| institute_name | Institut Teknologi Unggas | Nama institusi |

## Nota penting

- Jangan simpan password atau secret API dalam GitHub.
- PIN tidak digalakkan disimpan sebagai plain text.
- Spreadsheet ID dan Web App URL boleh disimpan dalam Apps Script properties atau config yang tidak mendedahkan secret kritikal.
- Data pelajar perlu dijaga sebagai data dalaman institut.
