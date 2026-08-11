# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow production semasa **v2.2.0** dengan GAS Version 36 dan `OUTING_CONFIG_V2_ENABLED=true`.

## Backend Config API v2.0

```text
Public GET getOutingTypes
  -> flag false: lima legacy config dari code
  -> flag true: OUTING_TYPES active sahaja, sort_order, safe projection

Admin POST loginAdmin / getAdminOutingTypes
  -> admin_id atau nama_admin + PIN
  -> ADMIN_USERS status AKTIF

Admin POST create/update/toggle
  -> credential validation
  -> LockService
  -> backend field validation
  -> optimistic config_version untuk update/toggle
  -> OUTING_TYPES
  -> AUDIT_LOG entity OUTING_TYPE
```

Tiada delete flow. `type_code` immutable. Production kini menggunakan public projection untuk rendering borang Pelajar dan validation config-driven pada `submitRequest`; resolver membaca `OUTING_TYPES` authoritative apabila property tepat `"true"`.

## Notis Banner V1

```text
Admin POST getAnnouncementBannerAdmin / updateAnnouncementBanner
  -> validate Admin aktif + PIN
  -> trim / had 500 aksara / boolean ketat
  -> Script Properties + LockService
  -> AUDIT_LOG UPDATE_ANNOUNCEMENT_BANNER

Authenticated POST getAnnouncementBanner
  -> validate Student / Warden / Guard / Admin
  -> active=false: { active: false }
  -> active=true: safe projection text, important, updated_at
```

Landing dan Public Pemantauan tidak memanggil endpoint ini. Banner dimuat selepas sesi authenticated bermula dan dibersihkan ketika logout. Kandungannya tidak pernah masuk ke `submitRequest`, `approveRequest`, `confirmOut`, `confirmIn` atau resolver `OUTING_TYPES`; perubahan operasi sebenar masih dibuat melalui Tetapan Outing.

## Backend Submission Config — Fasa 5B

```text
submitRequest
  -> flag false: jalankan whitelist dan validator legacy tanpa OUTING_TYPES
  -> flag true: resolve row OUTING_TYPES daripada type_code
       -> type mesti active dan schema lengkap/sah
       -> allowed_days + application window berdasarkan masa permohonan
       -> departure_allowed_days berdasarkan tarikh keluar yang diminta
       -> tarikh/masa server-side + fixed_return_time + same_day_only
       -> required fields menurut config
  -> semak pelajar aktif
  -> duplicate request protection sedia ada
  -> simpan OUTING_REQUESTS + audit minimum + Telegram
```

`fixed_return_time` mengatasi masa yang dihantar client. `same_day_only` menolak tarikh berbeza dan mengisi tarikh balik efektif jika field itu optional. Jika `require_warden_approval = true`, submission bermula `MENUNGGU_KELULUSAN`; jika `false`, backend menandainya `DILULUSKAN_WARDEN`, mengisi masa approval dan identiti sistem `AUTO_CONFIG_V2`, serta menulis audit `AUTO_APPROVE_REQUEST`. Guard hanya menerima state approved yang sah. Peraturan ini hanya boleh beroperasi apabila feature flag aktif.

Peraturan permohonan dan keluar adalah berasingan. `allowed_days` serta `application_open_time`/`application_close_time` menentukan bila borang boleh dihantar. `departure_allowed_days` menentukan hari pada `tarikh` keluar, dan `earliest_departure_time` dikuatkuasakan semasa Guard menjalankan `confirmOut`. Row `PULANG_BERMALAM` production membenarkan permohonan pada mana-mana hari, departure Jumaat dan masa paling awal semasa `17:00`; Admin boleh mengubah masa itu mengikut arahan HEP.

## Student Form Config Rendering — Fasa 5A

```text
Pelajar login / student form dibuka
  -> GET getOutingTypes
  -> active sahaja + sort_order
  -> bina dropdown type_code/display_name
  -> apply visibility, required dan disabled state
  -> same_day_only sync tarikh
  -> fixed_return_time isi dan lock masa

GET gagal atau config kosong
  -> lima legacy config dalam memory
  -> OUTING_HUJUNG_MINGGU kekal Sabtu/Ahad + 22:00
  -> retry tersedia untuk kegagalan request
```

Hidden field dikosongkan apabila tidak lagi relevan dan sentiasa disabled. Rendering ini tidak menukar payload contract atau backend `submitRequest`.

## Admin Dashboard v2.0 — Fasa 4

```text
Pilih Admin
  -> isi admin_id atau nama_admin + PIN
  -> POST loginAdmin
  -> credential disimpan dalam memory runtime sahaja
  -> buka Admin Dashboard
  -> POST getAdminOutingTypes

Tambah
  -> form semua medan config
  -> confirmation
  -> POST createOutingType
  -> refresh list

Edit
  -> type_code read-only, active tiada dalam form edit
  -> expected_config_version
  -> POST updateOutingType
  -> refresh list

Aktif/Nyahaktif
  -> confirmation + expected_config_version
  -> POST toggleOutingType
  -> refresh list
```

Jika backend memulangkan `CONFIG_VERSION_CONFLICT`, editor ditutup, data terkini direfresh dan Admin diminta membuka Edit semula. Logout mengosongkan credential runtime dan PIN input. Tiada “ingat peranti” untuk Admin.

## Lifecycle Rekod

```text
MENUNGGU_KELULUSAN
  -> DILULUSKAN_WARDEN atau DITOLAK_WARDEN
DILULUSKAN_WARDEN
  -> KELUAR
KELUAR
  -> SELESAI
```

`lewat` ialah flag tambahan. Label kontekstual frontend tidak menukar nilai status backend. Bukti pulang menggunakan `selfie_status` yang berasingan; penghantaran selfie tidak memperkenalkan status lifecycle utama baharu.

## Flow Utama

```text
Pelajar pilih nama + masukkan no_matrik
  -> backend sahkan student_id + no_matrik dari STUDENTS
  -> Pelajar hantar OUTING_BIASA / OUTING_HUJUNG_MINGGU / KECEMASAN / PULANG_BERMALAM / CUTI_SEMESTER
  -> backend halang duplicate active request
  -> MENUNGGU_KELULUSAN + Telegram
Warden login nama + PIN
  -> POST getTodayRecords authenticated
  -> approve atau reject + Telegram
Guard login nama + PIN
  -> POST getTodayRecords authenticated
  -> confirm keluar / masuk + Telegram
  -> confirmIn menetapkan status SELESAI
     -> BELUM_HANTAR jika bukti diwajibkan
     -> TIDAK_DIPERLUKAN jika config-driven require_selfie=false
Pelajar refresh rekod sendiri
  -> lihat “Ambil Selfie & Lapor Pulang”
  -> kamera depan / pilih gambar -> preview -> ambil semula atau hantar
  -> resize kira-kira 1280px + JPEG compression
  -> submitReturnSelfie
  -> Drive private + Telegram sendPhoto + metadata Sheet
  -> selfie_status SUDAH_HANTAR
Pelajar, Warden dan Guard refresh melalui laluan authenticated masing-masing
```

## Pelajar

Direktori public hanya membekalkan `student_id`, `nama` dan `kelas`. Dropdown menggunakan `student_id` sebagai value dalaman dan memaparkan nama. Nombor matrik ditaip berasingan dan backend memadankan kedua-dua credential dengan row Google Sheets.

Pelajar hanya menerima rekod sendiri melalui authenticated POST `getTodayRecords`. Active request menghalang permohonan baharu sehingga selesai atau ditolak.

Pelajar boleh upload/ganti foto profil sendiri. Identity/editor memuatkan thumbnail melalui batch authenticated dan editor sendiri boleh menggunakan imej penuh. Klik thumbnail membuka modal; jika full cache belum tersedia, satu request authenticated `photo_variant = "full"` dibuat untuk pelajar itu sahaja. Initials tidak mempunyai tindakan klik.

Semasa flag `false`, semua jenis legacy kekal memerlukan bukti selepas Guard mengesahkan masuk. Dalam config-driven mode, `require_selfie` disnapshot pada submission; `false` memaparkan `Bukti Selfie Tidak Diperlukan`, manakala `true` memaparkan action `Bukti Selfie Belum Dihantar`. Selepas berjaya, action upload hilang dan dashboard menunjukkan `Bukti Selfie Dihantar` bersama `Masa Bukti`.

## Warden / HEP

Warden dan HEP berkongsi role backend `warden`. Login menggunakan nama + PIN; PIN yang ditaip disimpan dalam runtime session untuk request operasi semasa dan flow remember-device sedia ada kekal berfungsi.

Warden boleh:

- refresh permohonan;
- melihat Dashboard dan Checklist Permohonan;
- approve/reject;
- salin senarai nama dengan emoji status.

Checklist memaparkan semua jenis permohonan. Ikon dan label menggunakan status kontekstual pusat.

Kad Warden/HEP dan Guard memuat `photo_variant = "thumbnail"` melalui satu batch authenticated bagi ID operasi unik yang dibenarkan. Request serentak/duplicate ditekan dan kegagalan menggunakan initials. Klik foto sebenar membuka thumbnail/loading modal lalu memuat satu `photo_variant = "full"` jika belum dicache; butang approve/reject/confirm kekal berasingan serta explicit.

## Guard

Guard login menggunakan nama + PIN dan menerima rekod operasi penuh melalui POST authenticated.

Seksyen utama:

- `Sedia Untuk Keluar`;
- `Sedang Keluar`.

Tindakan `Sahkan Keluar` menggunakan penegasan oren dan `Sahkan Masuk` menggunakan penegasan hijau. Kedua-duanya kekal pada handler `confirmOut`/`confirmIn` sedia ada dan tidak dicetuskan oleh shortcut Enter generik.

Quick filter Guard:

- Semua
- Outing Harian
- Pulang Bermalam
- Cuti Semester
- Kecemasan
- Lewat

Filter digunakan pada kedua-dua seksyen. Empty-state berubah mengikut filter dan seksyen. `Kecemasan` tidak dianggap Outing Harian.

`confirmIn` kekal tanggungjawab Guard dan masih menerima catatan masuk optional. Guard tidak mengambil atau upload selfie; bukti dihantar oleh Pelajar selepas status menjadi `SELESAI`.

Sebelum `confirmOut`, backend menyemak tarikh keluar approved/requested, configured departure day dan earliest departure time. Tarikh masa hadapan, hari tidak dibenarkan dan masa terlalu awal ditolak. Policy failure dipaparkan dalam Malay operational wording yang selamat, manakala unrelated/network/internal failure kekal generic tanpa stack detail. Contoh production: request 14 Ogos 2026 tidak boleh disahkan keluar pada 10 Ogos 2026.

Tetapan Outing memaparkan readiness sebagai chip compact `Config Active`, `Legacy` atau `Config Issue`; reason not-ready boleh dibuka secara accessible dan tiada feature-flag toggle.

## Flow Bukti Selfie dan Retry

Syarat backend untuk `submitReturnSelfie`:

- `request_id`, `student_id` dan `no_matrik` diperlukan;
- rekod mesti dimiliki oleh identiti Pelajar tersebut;
- status mesti `SELESAI` dan `masa_masuk` mesti wujud;
- `selfie_status` tidak boleh `TIDAK_DIPERLUKAN`;
- MIME hanya JPEG, PNG atau WebP, dengan base64 sah dan dalam had saiz;
- bukti terdahulu tidak boleh dihantar semula.

`LockService` mengelakkan dua submission serentak daripada mencipta fail atau mesej berganda. Jika Drive atau Telegram gagal sebelum transaksi lengkap, frontend menunjukkan ralat yang boleh diambil tindakan dan backend membersihkan artifak separa. Pelajar boleh retry selepas kegagalan terkawal. Selepas Sheet berjaya ditanda `SUDAH_HANTAR`, hasil itu authoritative; kegagalan audit hanya direkod sebagai warning dan tidak menyebabkan error atau rollback.

Submission kedua selepas kejayaan ditolak dengan mesej bahawa bukti telah dihantar sebelum ini.

## Status Kontekstual

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar untuk `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU` atau `KECEMASAN` + `KELUAR`
- 🌙 Sedang Bermalam untuk `PULANG_BERMALAM` + `KELUAR`
- 🏖️ Sedang Bercuti untuk `CUTI_SEMESTER` + `KELUAR`
- ✅ Sudah Pulang
- 🔴 Lewat

Lewat mengatasi paparan status lain. Kiraan/filter masih bergantung pada nilai backend seperti `record.status === KELUAR`.

## Public Monitoring Read-only

Public Monitoring menggunakan GET awam `getTodayRecords`, tidak kira sama ada browser mempunyai sesi lain. Response hanya mengandungi nama, kelas, jenis permohonan, status, lewat dan belum_masuk.

Flow pembukaan:

```text
aktifkan panel monitoring inline pada shell landing
  -> sembunyikan panel login lain
  -> scroll ke permulaan panel
  -> tunjuk loading
  -> GET awam khusus
  -> mapPublicMonitoringRecord
  -> update outingRecords
  -> render sekali
  -> update timestamp dan monitorHasLoadedOnce
  -> tamat loading
```

Single-flight guard menghalang request bertindih. First-load gagal menunjukkan ralat jelas. Refresh gagal selepas kejayaan mengekalkan data lama dan timestamp lama.

Paparan hanya mempunyai kad ringkasan dan `Senarai Status Semasa`. Setiap baris menunjukkan nama, kelas, jenis permohonan, ikon dan label kontekstual. Ia tidak mempunyai action approve/reject, confirm keluar/masuk, thumbnail atau preview foto profil.

## Statistik

Public Statistik tidak mempunyai kad atau navigasi. Admin memilih tab `Statistik` dalam shell Admin yang sama; filter bulan/tahun/kelas, Jana Statistik, Refresh, KPI, statistik individu, ringkasan kelas dan pecahan status dimuat melalui credential Admin tanpa logout atau workspace kedua. Endpoint agregat lama boleh kekal untuk compatibility tetapi tidak didedahkan melalui UI awam.

## Local Mock QA Admin

```text
?mock=1
  -> bina satu credential Admin QA dan lima OUTING_TYPES dalam memory
  -> apiPost memintas sembilan action Admin outing/pelajar sahaja
  -> login dan list/create/update/toggle outing/pelajar diproses tanpa fetch atau GAS
  -> logout kosongkan credential runtime
  -> refresh page reset data mock
```

Tanpa `mock=1`, cabang mock tidak boleh dicapai dan `apiPost` meneruskan request ke GAS. `mockAdminError=1` menggagalkan read pertama untuk menguji error/retry; `mockAdminConflict=1` menggagalkan write pertama dengan conflict version dan memaksa refresh data.

## Prinsip Keselamatan

- Frontend role hiding bukan authorization.
- Semua action operasi disahkan di GAS.
- POST authenticated tidak fallback kepada GET awam.
- Public Monitoring tidak boleh mengubah status.
- API/GAS tidak dicache oleh service worker.
- Imej selfie dan metadata private tidak dipaparkan oleh Public Monitoring atau dicache sebagai response sensitif.

## Admin Inline

Selepas login, identiti sesi, tajuk `Admin eOuting` dan navigasi kekal visible. Enam panel inline ialah `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar` dan `Tetapan Outing`.

`Admin login -> Tetapan Pelajar -> getAdminStudents/createStudent/updateStudent/toggleStudentStatus` menggunakan POST dan credential Admin runtime sedia ada. Status `TIDAK AKTIF` menyebabkan rekod tidak lagi dipulangkan oleh public `getStudents`, tanpa mengubah `OUTING_REQUESTS` atau sejarah outing. LI ialah nilai `kelas` dalam STUDENTS, bukan role login baharu. Thumbnail sebenar Admin boleh dipreview daripada batch authenticated yang sama; removal kekal tindakan berasingan dan ber-audit.

## Foto Profil Dua Peringkat

```text
Operational/list render -> initials segera
  -> POST getStudentProfilePhotos photo_variant=thumbnail (ID unik, batch)
  -> authorize viewer -> Drive API v3 metadata -> server-side OAuth thumbnail fetch
  -> safe data URI sahaja -> thumbnail session cache

Klik thumbnail -> semak full-image session cache
  -> cache hit: buka terus
  -> cache miss: modal thumbnail/loading
       -> POST getStudentProfilePhotos photo_variant=full (satu student_id)
       -> full image menggantikan thumbnail -> cache sesi
       -> failure: error/retry selamat
```

`thumbnailLink`, Drive file ID/URL dan OAuth token tidak meninggalkan GAS. Thumbnail gagal tidak menyebabkan bulk fallback imej 600×800. Public Pemantauan tidak memanggil endpoint atau merender metadata foto.

## Keyboard dan Rolling KPI

Enter menghantar login Pelajar, Warden/HEP, Guard dan Admin serta editor Admin biasa apabila fokus pada input/select satu baris. Submit menggunakan handler/button sedia ada dan lock loading; textarea kekal newline. Tiada shortcut global atau Enter untuk approve, reject, sahkan keluar/masuk, nyahaktif, reset PIN, buang foto atau logout.

KPI yang sesuai bergerak daripada nilai sebelumnya kepada integer akhir tepat dalam kira-kira 450 ms. Nilai sama tidak replay dan reduced-motion memaparkan nilai akhir terus. ID, tarikh, masa, telefon, pagination dan duration string tidak dianimasikan.
