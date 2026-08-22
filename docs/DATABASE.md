# Struktur Database Google Sheets

Google Sheets ialah database dan source of truth eOuting ITU v2.4.0. Production menggunakan Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`; frontend GitHub Pages tidak menyimpan salinan penuh data pelajar atau rekod operasi.

## `STUDENTS`

```text
student_id | no_matrik | nama | email | no_tel | kelas | jantina | status | catatan | photo_file_id | photo_updated_at | institution_code
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
- `institution_code` ialah assignment authoritative bagi Pelajar dalam kelas/group yang memerlukan institusi, kini LI. Ia kosong bagi A2/A3 dan tidak mengubah nilai kelas kanonik `LI`.

Public `getStudents` hanya mengeluarkan:

```text
student_id | nama | kelas
```

Field lain dalam sheet tidak menjadi sebahagian daripada direktori awam.

## `STUDENT_GROUPS`

```text
group_code | display_name | institution_required | active | sort_order | config_version | created_at | created_by | updated_at | updated_by
```

Konfigurasi ini menentukan kumpulan Pelajar dan sama ada sub-kumpulan institusi diperlukan. Code immutable, versioning optimistic dan deactivation guards dikawal melalui Admin; tiada destructive delete workflow.

## `LI_INSTITUTIONS`

```text
institution_code | display_name | active | sort_order | config_version | created_at | created_by | updated_at | updated_by
```

`institution_code` dipadankan dengan `STUDENTS.institution_code`. Prefix Student ID hanya input migration legacy dan bukan runtime source of truth.

## `WARDENS`

```text
warden_id | nama_warden | email | no_tel | pin | status | catatan
```

Warden login dan tindakan operasi memerlukan nama + PIN yang sepadan dengan row aktif. `warden_id` ialah sumber authoritative bagi role paparan approval: prefix `HEP-` menghasilkan HEP, prefix `W-` menghasilkan WARDEN, dan ID legacy/tidak dikenali fallback kepada WARDEN. Tiada kolum `staff_role` atau `approval_role`; lifecycle kekal `DILULUSKAN_WARDEN`. PIN tidak boleh dipulangkan melalui direktori awam, dimasukkan ke log atau disimpan dalam repo.

## `GUARDS`

```text
guard_id | nama_guard | email | no_tel | pin | status | catatan
```

Guard login dan confirm keluar/masuk memerlukan nama + PIN yang sepadan dengan row aktif. Nombor telefon dan PIN hendaklah berformat Plain text jika perlu mengekalkan digit awal.

## `OUTING_REQUESTS`

```text
request_id | tarikh | hari | jenis_permohonan | student_id | no_matrik | nama | student_email | kelas | tujuan | lokasi | jenis_kenderaan | butiran_kenderaan | sebab_kecemasan | telefon_waris | hubungan_waris | catatan_kecemasan | masa_mohon | status | warden_approve_by | masa_approve | masa_keluar | guard_keluar_by | masa_masuk | guard_masuk_by | lewat | selfie_whatsapp | catatan | tarikh_balik | hari_balik | masa_balik_dijangka | selfie_status | selfie_file_id | selfie_url | masa_selfie | selfie_telegram_message_id | sebab_batal_pelajar | masa_batal_pelajar | dibatalkan_oleh
```

Jenis permohonan:

- `OUTING_BIASA`
- `OUTING_HUJUNG_MINGGU`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`
- custom aktif seperti `KLINIK` apabila row `OUTING_TYPES` production dikonfigurasi dan ready

Status lifecycle:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `DIBATALKAN_PELAJAR`
- `KELUAR`
- `SELESAI`

Status aktif yang menghalang duplicate request ialah `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR`. `SELESAI`, `DITOLAK_WARDEN` dan `DIBATALKAN_PELAJAR` tidak menghalang permohonan baharu. `DIBATALKAN_PELAJAR` ialah status terminal/non-active berlabel `Dibatalkan oleh Pelajar`; ia tidak dianggap outing selesai/berjaya atau sedang keluar. Backend menjalankan fresh active-check dan append dalam satu `ScriptLock`, jadi perlindungan tidak bergantung pada lock UI frontend sahaja.

`submitRequest` mengesahkan status awal sebelum persistence. `appendObjectRow_` memetakan setiap nilai berdasarkan nama dan susunan header sebenar `OUTING_REQUESTS`, kemudian row dibaca semula untuk mengesahkan status persisted. Blank atau status tidak sah ditolak daripada persistence; jika rekod legacy masih mempunyai status kosong/tidak dikenali, UI memaparkan `Status Tidak Diketahui` dan tidak menganggapnya pending.

Kolum pembatalan Pelajar:

| Kolum | Nilai / format | Tujuan |
|---|---|---|
| `sebab_batal_pelajar` | Teks di-trim, 5–500 aksara | Sebab wajib yang disahkan pada frontend dan backend. |
| `masa_batal_pelajar` | Tarikh/masa Asia/Kuala_Lumpur | Masa pembatalan berjaya. |
| `dibatalkan_oleh` | `PELAJAR` | Aktor/source pembatalan. |

Cancellation mengekalkan row asal dan hanya mengemas kini status serta metadata; rekod tidak pernah dipadam. Header ditambah secara additive melalui `ensureHeaders_`, dan lookup/write kekal berdasarkan nama header supaya row lama tanpa metadata pembatalan terus serasi. Action `cancelStudentRequest` menulis audit `CANCEL_STUDENT_REQUEST` selepas transition atomic berjaya.

`lewat` ialah fakta sejarah `Ya/Tidak` dan tidak menggantikan status lifecycle. Operational urgency juga derived dan tidak disimpan sebagai lifecycle atau kolum baharu. Resolver mengutamakan `tarikh_balik + masa_balik_dijangka` bagi setiap standard atau custom/config-driven type yang mempunyai snapshot valid. Legacy daily record sahaja boleh fallback kepada `tarikh` dan 22:00 apabila wajar. `masa_balik_dijangka` dinormalkan kepada `HH:mm` dalam zon `Asia/Kuala_Lumpur`; representasi Date epoch 1899 tidak menjadi data API.

`confirmIn()` menggunakan expected-return resolver yang sama: actual tepat target menyimpan `lewat=Tidak`, manakala actual selepas target menyimpan `lewat=Ya`. Timing yang benar-benar indeterminate disimpan secara konservatif sebagai `Ya`; sebelum selesai, active malformed row diterbitkan dengan `needs_review=true`. Keputusan konservatif ini ialah known limitation/future review item dan tidak memerlukan perubahan schema.

`getStudentAnnualSummary` tidak menambah kolum atau sheet. Ia membaca row milik Pelajar yang telah disahkan, memilih hanya `SELESAI` bagi tahun semasa dan menggunakan set yang sama untuk `total_outings` serta `history_records`. Projection sejarah hanya `tarikh`, `jenis_permohonan` dan `status`, disusun paling baharu dahulu.

No-Guard Departure tidak menambah kolum `OUTING_REQUESTS`. Pending fallback ialah derived state daripada `AUDIT_LOG` event `DEPARTURE_CONFIRMATION_REQUESTED` bagi request yang masih `DILULUSKAN_WARDEN`; ia bukan lifecycle status. Warden confirmation menukar row kepada `KELUAR`, menetapkan `masa_keluar` authoritative dan sengaja mengekalkan `guard_keluar_by` kosong. Identiti Warden berada dalam audit `WARDEN_REMOTE_CHECKOUT`, bukan dalam medan Guard.

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

Current Hostel Residents tidak menambah kolum atau sheet presence. Nilainya diturunkan sebagai:

```text
ACTIVE STUDENTS - current lifecycle KELUAR = CURRENT HOSTEL RESIDENTS
```

Public summary membawa aggregate/group counts sahaja. Roster authenticated untuk Admin/Warden/Guard memproyeksikan `nama` sahaja. Tiada `IN_HOSTEL` field atau source of truth kedua.

Public GET `getTodayRecords` membaca `OUTING_REQUESTS` tetapi memproyeksikan hanya:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Ia tidak mendedahkan `student_id`, `no_matrik`, `request_id`, e-mel, telefon, waris, lokasi, tujuan, kenderaan, nama pegawai, credential, sebab/masa pembatalan, `selfie_status`, URL/file ID Drive, masa selfie, ID mesej Telegram, nested `operational_urgency`, expected-return/evaluated timestamp, minit, transition, action code, timing diagnostic atau metadata audit/operasi lain. Rekod cancelled tidak dipaparkan sebagai sedang keluar atau sedia keluar.

Operational POST `getTodayRecords` kekal berasingan. Selepas credential disahkan, Pelajar menerima rekod sendiri manakala Warden/Guard menerima data operasi yang diperlukan oleh flow mereka; projection authenticated Admin turut boleh menerima nested `operational_urgency`. Urgency dihitung selepas cache source 20 saat dibaca, tidak dicache sebagai state dan tidak menambah kolum `OUTING_REQUESTS`. Tiada fallback kepada projection awam.

## Statistik

`getOutingStats` mengira aggregated counts daripada `OUTING_REQUESTS` dan boleh kekal sebagai endpoint compatibility tanpa row mentah, nama pelajar atau nombor matrik. `DIBATALKAN_PELAJAR` boleh muncul sebagai jumlah status tersendiri tetapi tidak dikira sebagai `SELESAI`, outing berjaya atau sedang keluar. UI awam tidak menyediakan navigasi Statistik. Modul Statistik inline Admin menggunakan laluan authenticated berasingan untuk statistik individu.

## `OUTING_TYPES` — authoritative production configuration

```text
type_code | display_name | description | active | sort_order | allowed_days | application_open_time | application_close_time | fixed_return_time | same_day_only | require_leave_date | require_return_date | require_return_time | require_guardian_phone | require_guardian_relation | require_emergency_reason | require_purpose | require_location | require_vehicle | require_warden_approval | require_selfie | config_version | created_at | created_by | updated_at | updated_by | departure_allowed_days | earliest_departure_time | application_open_date | application_close_date
```

`setupAdminOutingConfigV200()` mencipta tab ini secara idempotent dan seed lima jenis sedia ada. `type_code` ialah identifier immutable: migration tidak menamakan semula atau menimpa row yang sudah wujud. `allowed_days` menentukan hari permohonan boleh dihantar, manakala `departure_allowed_days` menentukan hari pelajar dibenarkan keluar. Kedua-duanya menggunakan nama hari BM uppercase dipisahkan koma. `application_open_time`, `application_close_time`, `fixed_return_time` dan `earliest_departure_time` ialah nilai masa sahaja yang dibaca sebagai canonical `HH:mm` menggunakan `Asia/Kuala_Lumpur`. Open/close time ialah optional; blank bermaksud tiada threshold tetapi `allowed_days` tetap enforced. Explicit empty-string update membersihkan cell melalui `clearContent()` supaya blank tidak menjadi `00:00`, `12:00` atau masa semasa. Nilai `earliest_departure_time` kosong bermaksud tiada masa minimum dikonfigurasi. Nilai boolean disimpan sebagai boolean Sheet.

`application_open_date` dan `application_close_date` ialah medan optional generik, disimpan sebagai canonical `YYYY-MM-DD`. Kedua-duanya blank bermaksud tiada restriction tarikh; open sahaja membenarkan mulai tarikh itu; close sahaja membenarkan sehingga dan termasuk tarikh itu; kedua-duanya membentuk julat inklusif. Close mesti sama atau selepas open. Tarikh malformed atau mustahil ditolak. Enforcement menggunakan current date `Asia/Kuala_Lumpur` dan kekal additive dengan `allowed_days` serta application open/close time.

Migration production 22 Ogos 2026 menambah `AC: application_open_date` dan `AD: application_close_date` melalui `setupAdminOutingConfigV200()`. Penambahan ini idempotent, tidak melakukan reorder destructive, tidak mengubah `OUTING_REQUESTS` dan membiarkan row sedia ada valid dengan blank dates. Pemeriksaan production mengesahkan semua row kekal blank; tiada jenis termasuk `CUTI_SEMESTER` menerima nilai automatik.

Production menggunakan `OUTING_CONFIG_V2_ENABLED=true`, maka `submitRequest` membaca row aktif daripada tab ini. Tetapan Outing ialah interface operasi Admin bagi read/create/update/toggle. Jenis dan label config mengalir kepada Student labels/forms/payload, Telegram, Statistik grouping/filtering, Admin filters, Warden filters/checklists, contextual outing labels dan return-selfie eligibility. Requirement config menentukan `tarikh`, `tarikh_balik` dan `masa_balik_dijangka`; jenis custom tidak memerlukan branch frontend berdasarkan type code. Setiap konfigurasi aktif mesti lulus readiness validation dan regression QA.

Andaian seed konservatif:

| Jenis | Hari permohonan | Buka permohonan | Hari keluar | Keluar paling awal | Pulang tetap | Hari sama | Tarikh balik/masa | Waris |
|---|---|---|---|---|---|---:|---:|---:|
| `OUTING_BIASA` | Selasa, Rabu | 17:00 | Tiada had tambahan | Tiada | 22:00 | Ya | Tidak | Tidak |
| `OUTING_HUJUNG_MINGGU` | Sabtu, Ahad | Tiada had dipetakan | Tiada had tambahan | Tiada | 22:00 | Ya | Ya | Tidak |
| `KECEMASAN` | Semua hari | Tiada had dipetakan | Tiada had tambahan | Tiada | 22:00 | Ya | Tidak | Tidak |
| `PULANG_BERMALAM` | Semua hari | Tiada had dipetakan | Jumaat | 17:00 pada row semasa | Ikut permohonan | Tidak | Ya | Ya |
| `CUTI_SEMESTER` | Semua hari | Tiada had dipetakan | Tiada had tambahan | Tiada | Ikut permohonan | Tidak | Ya | Ya |

Untuk `PULANG_BERMALAM`, permohonan boleh dibuat pada mana-mana hari. Tarikh keluar yang diminta mesti hari Jumaat. Guard hanya boleh mengesahkan keluar pada tarikh yang diluluskan, hari yang dibenarkan dan pada/selepas `earliest_departure_time`. Row production semasa ialah `17:00`, tetapi Admin boleh mengubahnya mengikut arahan HEP; nilai itu ialah konfigurasi operasi, bukan rule hard-coded kekal.

Custom production `KLINIK` mempunyai display name `Keluar ke Klinik`, `same_day_only=true`, tiada tarikh keluar/balik manual, serta memerlukan masa balik dijangka, lokasi, kenderaan, kelulusan Warden dan return selfie. `earliest_departure_time` dan `departure_allowed_days` boleh kosong apabila tiada restriction tarikh/hari keluar. Readiness menolak inconsistency seperti `departure_allowed_days` berisi ketika `require_leave_date=false`.

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

No-Guard menggunakan dua audit event sedia ada tanpa notification audit tambahan:

- `DEPARTURE_CONFIRMATION_REQUESTED` — request Pelajar yang authenticated untuk rekod sendiri; event ini juga menjadi dedup authority bagi Telegram request.
- `WARDEN_REMOTE_CHECKOUT` — transition akhir oleh Warden authenticated, `user_role=WARDEN`, details mode `REMOTE_NO_GUARD`; row menjadi `KELUAR` dan `guard_keluar_by` kekal neutral.

Tiada event `DEPARTURE_CONFIRMATION_TELEGRAM_SENT`. Kegagalan Telegram tidak memadam atau mengubah kedua-dua audit/lifecycle yang telah committed.

## Announcement Banner V1 — Script Properties

V1 menyokong satu banner global, maka ia menggunakan Script Properties dan bukannya Google Sheet. Tiada sheet `ANNOUNCEMENTS`, migration sheet atau setup property manual. Jika property banner belum wujud, backend menganggap banner tidak aktif; simpanan pertama melalui `Admin > Notis Banner` mencipta atau mengemas kini teks, status aktif/penting, masa dan identiti pengemas kini.

Nama property dan nilai dalaman tidak menjadi sebahagian daripada projection viewer. Konfigurasi banner ialah data komunikasi sahaja dan tidak dirujuk oleh `OUTING_TYPES`, submission validation atau enforcement Guard.

No-Guard menggunakan Script Property `NO_GUARD_DEPARTURE_ENABLED`, bukan Sheet atau kolum schema. Parser ialah strict: hanya nilai tepat `"true"` mengaktifkan ciri; property hilang, malformed atau nilai lain bermaksud disabled. Safe default ialah `false`, manakala current production state pada close-out ini ialah enabled melalui Admin UI. Property secret/value mentah tidak dimasukkan ke public projection.

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

`kelas` ialah nilai data yang diterbitkan secara dinamik daripada rekod Student; ia tidak dihadkan oleh business rule kepada A2/A3/LI. A2, A3 dan LI digunakan dalam regression fixture untuk memastikan class termasuk non-A2/A3 kekal tersedia. `student_id` immutable dan unik, manakala `no_matrik` juga unik. Nilai no. matrik dan no. telefon dirawat sebagai teks untuk mengekalkan sifar di hadapan. Tiada kolum version ditambah; write serentak dilindungi dengan `LockService` dan duplicate recheck.

## WARDENS dan GUARDS

Pengurusan staff Admin menggunakan schema sedia ada tanpa migration:

```text
WARDENS: warden_id | nama_warden | email | no_tel | pin | status | catatan
GUARDS:  guard_id  | nama_guard  | email | no_tel | pin | status | catatan
```

Role menentukan tab dan nama medan identiti; ID tidak boleh ditukar selepas create. API senarai memulangkan `pin_configured` sahaja dan tidak pernah memulangkan nilai `pin`.
