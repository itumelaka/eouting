# Struktur Database Google Sheets

Google Sheets ialah database dan source of truth eOuting ITU v2.2.0. Production menggunakan Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`; frontend GitHub Pages tidak menyimpan salinan penuh data pelajar atau rekod operasi.

## `STUDENTS`

```text
student_id | no_matrik | nama | email | no_tel | kelas | jantina | status | catatan | photo_file_id | photo_updated_at
```

- `student_id` ialah identifier dalaman yang digunakan oleh frontend login.
- Pelajar menaip `no_matrik` secara berasingan.
- Backend memadankan `student_id` + `no_matrik` terus dengan row penuh Google Sheets.
- Hanya pelajar `Aktif` boleh login dan membuat permohonan.
- `no_matrik` dan `no_tel` hendaklah berformat Plain text.
- `photo_file_id` ialah ID fail private dalam folder foto profil yang dikonfigurasi; ia tidak dipulangkan oleh GET awam.
- `photo_updated_at` ialah masa kemas kini berjaya dalam zon Asia/Kuala_Lumpur. Base64 tidak disimpan dalam Sheet.
- Admin list menerima hanya `has_profile_photo` dan `photo_updated_at`; `photo_file_id` tidak dihantar. Thumbnail dibaca melalui POST batch authenticated `photo_variant = "thumbnail"` dan dipetakan menggunakan `student_id` yang dinormalisasi. Drive metadata/URL/token kekal server-side.
- Preview besar tidak menambah schema atau menyimpan data baharu. POST authenticated `photo_variant = "full"` membaca satu imej stored-compressed untuk satu pelajar apabila diperlukan dan frontend mencachenya sepanjang sesi.

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
- `OUTING_HUJUNG_MINGGU`
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

`OUTING_HUJUNG_MINGGU` hanya menerima tarikh Sabtu atau Ahad, menggunakan tarikh keluar dan balik yang sama, serta masa balik dijangka `22:00`.

Kolum bukti selfie v1.7.0:

| Kolum | Nilai / format | Tujuan dan masa kemas kini |
|---|---|---|
| `selfie_status` | kosong, `BELUM_HANTAR`, `SUDAH_HANTAR` atau `TIDAK_DIPERLUKAN` | Legacy submission kekal kosong sehingga `confirmIn`, kemudian `BELUM_HANTAR`. Config-driven `require_selfie=false` disnapshot sebagai `TIDAK_DIPERLUKAN`; `true` menjadi `BELUM_HANTAR` semasa `confirmIn`. Hanya transaksi bukti berjaya menetapkan `SUDAH_HANTAR`. |
| `selfie_file_id` | ID fail Drive | Diisi selepas imej berjaya disimpan dan transaksi lengkap. |
| `selfie_url` | URL rujukan Drive | Diisi bersama file ID untuk rujukan staf yang dibenarkan; tidak dipaparkan secara awam. |
| `masa_selfie` | Tarikh/masa Asia/Kuala_Lumpur | Masa submission bukti yang berjaya. |
| `selfie_telegram_message_id` | ID mesej Telegram | Direkod selepas `sendPhoto` berjaya untuk kawalan dan cleanup transaksi. |

`selfie_whatsapp` dikekalkan sebagai kolum legacy dan tidak dinamakan semula atau dibuang. Akses code menggunakan nama header, bukan kedudukan kolum. Oleh itu, lima kolum baharu mungkin muncul secara fizikal selepas kolum kosong/berformat yang tidak digunakan tanpa menjejaskan mapping, selagi nama header tepat.

Field `selfie_*`, folder `SELFIE_FOLDER_ID`, submission `submitReturnSelfie` dan Telegram `sendPhoto` tidak digunakan oleh foto profil. Foto profil hanya menggunakan `STUDENTS.photo_file_id`, `photo_updated_at` dan `PROFILE_PHOTO_FOLDER_ID`; kedua-dua bukti kekal private dan berasingan.

## Public Monitoring Projection

Public GET `getTodayRecords` membaca `OUTING_REQUESTS` tetapi memproyeksikan hanya:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Ia tidak mendedahkan `student_id`, `no_matrik`, `request_id`, e-mel, telefon, waris, lokasi, tujuan, kenderaan, nama pegawai, credential, `selfie_status`, URL/file ID Drive, masa selfie, ID mesej Telegram atau metadata audit/operasi lain.

Operational POST `getTodayRecords` kekal berasingan. Selepas credential disahkan, Pelajar menerima rekod sendiri manakala Warden/Guard menerima data operasi yang diperlukan oleh flow mereka. Tiada fallback kepada projection awam.

## Statistik

`getOutingStats` mengira aggregated counts daripada `OUTING_REQUESTS` dan boleh kekal sebagai endpoint compatibility tanpa row mentah, nama pelajar atau nombor matrik. UI awam tidak menyediakan navigasi Statistik. Modul Statistik inline Admin menggunakan laluan authenticated berasingan untuk statistik individu.

## `OUTING_TYPES` — authoritative production configuration

```text
type_code | display_name | description | active | sort_order | allowed_days | application_open_time | application_close_time | fixed_return_time | same_day_only | require_leave_date | require_return_date | require_return_time | require_guardian_phone | require_guardian_relation | require_emergency_reason | require_purpose | require_location | require_vehicle | require_warden_approval | require_selfie | config_version | created_at | created_by | updated_at | updated_by | departure_allowed_days | earliest_departure_time
```

`setupAdminOutingConfigV200()` mencipta tab ini secara idempotent dan seed lima jenis sedia ada. `type_code` ialah identifier immutable: migration tidak menamakan semula atau menimpa row yang sudah wujud. `allowed_days` menentukan hari permohonan boleh dihantar, manakala `departure_allowed_days` menentukan hari pelajar dibenarkan keluar. Kedua-duanya menggunakan nama hari BM uppercase dipisahkan koma. `earliest_departure_time` ialah masa keluar paling awal dalam format `HH:mm`; nilai kosong bermaksud tiada masa minimum dikonfigurasi. Nilai boolean disimpan sebagai boolean Sheet.

Production menggunakan `OUTING_CONFIG_V2_ENABLED=true`, maka `submitRequest` membaca row aktif daripada tab ini. Tetapan Outing ialah interface operasi Admin bagi read/create/update/toggle. Jenis dan label config mengalir kepada Student labels/forms, Telegram, Statistik grouping/filtering, Admin filters, Warden filters/checklists, contextual outing labels dan return-selfie eligibility. Setiap konfigurasi aktif mesti lulus readiness validation; jenis custom masih memerlukan ujian.

Andaian seed konservatif:

| Jenis | Hari permohonan | Buka permohonan | Hari keluar | Keluar paling awal | Pulang tetap | Hari sama | Tarikh balik/masa | Waris |
|---|---|---|---|---|---|---:|---:|---:|
| `OUTING_BIASA` | Selasa, Rabu | 17:00 | Tiada had tambahan | Tiada | 22:00 | Ya | Tidak | Tidak |
| `OUTING_HUJUNG_MINGGU` | Sabtu, Ahad | Tiada had dipetakan | Tiada had tambahan | Tiada | 22:00 | Ya | Ya | Tidak |
| `KECEMASAN` | Semua hari | Tiada had dipetakan | Tiada had tambahan | Tiada | 22:00 | Ya | Tidak | Tidak |
| `PULANG_BERMALAM` | Semua hari | Tiada had dipetakan | Jumaat | 17:00 pada row semasa | Ikut permohonan | Tidak | Ya | Ya |
| `CUTI_SEMESTER` | Semua hari | Tiada had dipetakan | Tiada had tambahan | Tiada | Ikut permohonan | Tidak | Ya | Ya |

Untuk `PULANG_BERMALAM`, permohonan boleh dibuat pada mana-mana hari. Tarikh keluar yang diminta mesti hari Jumaat. Guard hanya boleh mengesahkan keluar pada tarikh yang diluluskan, hari yang dibenarkan dan pada/selepas `earliest_departure_time`. Row production semasa ialah `17:00`, tetapi Admin boleh mengubahnya mengikut arahan HEP; nilai itu ialah konfigurasi operasi, bukan rule hard-coded kekal.

Semua seed bermula `active = true`, `require_purpose = true`, `require_location = true`, `require_vehicle = true`, `require_warden_approval = true`, `require_selfie = true` dan `config_version = 1`. Dalam config-driven mode, `require_selfie` ialah authoritative: false menghasilkan `selfie_status=TIDAK_DIPERLUKAN`. `require_warden_approval=false` menghasilkan approval `AUTO_CONFIG_V2` dan audit `AUTO_APPROVE_REQUEST`. `created_at`, `created_by`, `updated_at` dan `updated_by` ialah metadata audit config; `config_version` menyokong optimistic concurrency.

## `ADMIN_USERS`

```text
admin_id | nama_admin | pin | status | catatan | created_at | updated_at
```

Tiada admin diseed. Fasa 3 menyediakan `loginAdmin` dan credential validation menggunakan `admin_id` atau `nama_admin` + PIN bagi row berstatus `AKTIF`. Response login dan config tidak memulangkan PIN atau row `ADMIN_USERS`.

Semua write config memerlukan credential Admin semasa dan berjalan di bawah `LockService`. `type_code` dinormalisasi uppercase, mesti unik dan tidak boleh ditukar. Tiada delete API. Update/toggle menaikkan `config_version`; client mesti menghantar `expected_config_version` semasa untuk mengelakkan lost update.

## `AUDIT_LOG`

```text
timestamp | action | request_id | user_role | user_name | details | entity_type | entity_id
```

`entity_type` dan `entity_id` ditambah selepas enam kolum legacy tanpa menyusun semula header atau data lama. Rekod lifecycle sedia ada boleh membiarkan kedua-duanya kosong. Audit log menyimpan tindakan seperti submit, approve, reject, confirm out/in dan login. Jangan letakkan PIN, token Telegram atau PII yang tidak diperlukan dalam `details`. Retention policy kekal kerja masa hadapan.

Untuk submission config-driven, audit `SUBMIT_REQUEST` hanya menambah `config_version` yang digunakan bersama `jenis_permohonan`; keseluruhan row config tidak disalin ke audit. Schema `OUTING_REQUESTS` dan rekod lama tidak diubah oleh Fasa 5B.

Kemas kini Announcement Banner direkod sebagai `UPDATE_ANNOUNCEMENT_BANNER`. Audit menyimpan identiti Admin dan ringkasan tindakan yang diperlukan, bukan secret atau nama/nilai Script Property.

## Announcement Banner V1 — Script Properties

V1 menyokong satu banner global, maka ia menggunakan Script Properties dan bukannya Google Sheet. Tiada sheet `ANNOUNCEMENTS`, migration sheet atau setup property manual. Jika property banner belum wujud, backend menganggap banner tidak aktif; simpanan pertama melalui `Admin > Notis Banner` mencipta atau mengemas kini teks, status aktif/penting, masa dan identiti pengemas kini.

Nama property dan nilai dalaman tidak menjadi sebahagian daripada projection viewer. Konfigurasi banner ialah data komunikasi sahaja dan tidak dirujuk oleh `OUTING_TYPES`, submission validation atau enforcement Guard.

## Kawalan Akses

- Spreadsheet mesti private dan hanya dikongsi kepada akaun yang perlu.
- Jangan publish sheet kepada public.
- Jangan simpan token, secret, PIN sebenar atau deployment credential dalam repo.
- Semua identity, status, PIN dan action permission mesti disahkan di GAS, bukan melalui paparan frontend.

## STUDENTS dan Pelajar LI

Pengurusan Pelajar menggunakan schema STUDENTS yang diluaskan secara additive oleh `setupStudentProfilePhotos()`:

```text
student_id | no_matrik | nama | email | no_tel | kelas | jantina | status | catatan | photo_file_id | photo_updated_at
```

`kelas` dibenarkan ialah A2, A3 atau LI; LI bermaksud Pelajar Latihan Industri (LI). `student_id` immutable dan unik, manakala `no_matrik` juga unik. Nilai no. matrik dan no. telefon dirawat sebagai teks untuk mengekalkan sifar di hadapan. Tiada kolum version ditambah; write serentak dilindungi dengan `LockService` dan duplicate recheck.

## WARDENS dan GUARDS

Pengurusan staff Admin menggunakan schema sedia ada tanpa migration:

```text
WARDENS: warden_id | nama_warden | email | no_tel | pin | status | catatan
GUARDS:  guard_id  | nama_guard  | email | no_tel | pin | status | catatan
```

Role menentukan tab dan nama medan identiti; ID tidak boleh ditukar selepas create. API senarai memulangkan `pin_configured` sahaja dan tidak pernah memulangkan nilai `pin`.
