# Struktur Database Google Sheets

Google Sheets ialah database dan source of truth eOuting ITU v1.7.0. Frontend GitHub Pages tidak menyimpan salinan penuh data pelajar atau rekod operasi.

## `STUDENTS`

```text
student_id | no_matrik | nama | email | no_tel | kelas | jantina | status | catatan
```

- `student_id` ialah identifier dalaman yang digunakan oleh frontend login.
- Pelajar menaip `no_matrik` secara berasingan.
- Backend memadankan `student_id` + `no_matrik` terus dengan row penuh Google Sheets.
- Hanya pelajar `Aktif` boleh login dan membuat permohonan.
- `no_matrik` dan `no_tel` hendaklah berformat Plain text.

Public `getStudents` hanya mengeluarkan:

```text
student_id | nama | kelas
```

Field lain dalam sheet tidak menjadi sebahagian daripada direktori awam.

## `WARDENS`

```text
warden_id | nama_warden | email | no_tel | pin | status | catatan
```

Warden login dan tindakan operasi memerlukan nama + PIN yang sepadan dengan row aktif. PIN tidak boleh dipulangkan melalui direktori awam, dimasukkan ke log atau disimpan dalam repo.

## `GUARDS`

```text
guard_id | nama_guard | email | no_tel | pin | status | catatan
```

Guard login dan confirm keluar/masuk memerlukan nama + PIN yang sepadan dengan row aktif. Nombor telefon dan PIN hendaklah berformat Plain text jika perlu mengekalkan digit awal.

## `OUTING_REQUESTS`

```text
request_id | tarikh | hari | jenis_permohonan | student_id | no_matrik | nama | student_email | kelas | tujuan | lokasi | jenis_kenderaan | butiran_kenderaan | sebab_kecemasan | telefon_waris | hubungan_waris | catatan_kecemasan | masa_mohon | status | warden_approve_by | masa_approve | masa_keluar | guard_keluar_by | masa_masuk | guard_masuk_by | lewat | selfie_whatsapp | catatan | tarikh_balik | hari_balik | masa_balik_dijangka | selfie_status | selfie_file_id | selfie_url | masa_selfie | selfie_telegram_message_id
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

Status aktif yang menghalang duplicate request ialah `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR`. `SELESAI` dan `DITOLAK_WARDEN` tidak menghalang permohonan baharu.

`lewat` ialah flag operasi dan tidak menggantikan status lifecycle. `tarikh_balik`, `hari_balik` dan `masa_balik_dijangka` digunakan oleh Pulang Bermalam/Cuti Semester.

Kolum bukti selfie v1.7.0:

| Kolum | Nilai / format | Tujuan dan masa kemas kini |
|---|---|---|
| `selfie_status` | `BELUM_HANTAR` atau `SUDAH_HANTAR` | Dimulakan sebagai `BELUM_HANTAR` semasa `confirmIn`; menjadi `SUDAH_HANTAR` hanya selepas transaksi bukti berjaya. |
| `selfie_file_id` | ID fail Drive | Diisi selepas imej berjaya disimpan dan transaksi lengkap. |
| `selfie_url` | URL rujukan Drive | Diisi bersama file ID untuk rujukan staf yang dibenarkan; tidak dipaparkan secara awam. |
| `masa_selfie` | Tarikh/masa Asia/Kuala_Lumpur | Masa submission bukti yang berjaya. |
| `selfie_telegram_message_id` | ID mesej Telegram | Direkod selepas `sendPhoto` berjaya untuk kawalan dan cleanup transaksi. |

`selfie_whatsapp` dikekalkan sebagai kolum legacy dan tidak dinamakan semula atau dibuang. Akses code menggunakan nama header, bukan kedudukan kolum. Oleh itu, lima kolum baharu mungkin muncul secara fizikal selepas kolum kosong/berformat yang tidak digunakan tanpa menjejaskan mapping, selagi nama header tepat.

## Public Monitoring Projection

Public GET `getTodayRecords` membaca `OUTING_REQUESTS` tetapi memproyeksikan hanya:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Ia tidak mendedahkan `student_id`, `no_matrik`, `request_id`, e-mel, telefon, waris, lokasi, tujuan, kenderaan, nama pegawai, credential, `selfie_status`, URL/file ID Drive, masa selfie, ID mesej Telegram atau metadata audit/operasi lain.

Operational POST `getTodayRecords` kekal berasingan. Selepas credential disahkan, Pelajar menerima rekod sendiri manakala Warden/Guard menerima data operasi yang diperlukan oleh flow mereka. Tiada fallback kepada projection awam.

## Statistik

`getOutingStats` mengira statistik daripada `OUTING_REQUESTS` dan memulangkan aggregated counts sahaja. Ia tidak mengeluarkan row mentah, nama pelajar, nombor matrik atau leaderboard individu.

## `AUDIT_LOG`

```text
timestamp | action | request_id | user_role | user_name | details
```

Audit log menyimpan tindakan seperti submit, approve, reject, confirm out/in dan login. Jangan letakkan PIN, token Telegram atau PII yang tidak diperlukan dalam `details`. Retention policy kekal kerja masa hadapan.

## Kawalan Akses

- Spreadsheet mesti private dan hanya dikongsi kepada akaun yang perlu.
- Jangan publish sheet kepada public.
- Jangan simpan token, secret, PIN sebenar atau deployment credential dalam repo.
- Semua identity, status, PIN dan action permission mesti disahkan di GAS, bukan melalui paparan frontend.
