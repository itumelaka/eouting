# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow repo semasa **v1.7.1**.

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

Tiada delete flow. `type_code` immutable. Fasa 5A menggunakan public projection untuk rendering borang Pelajar. Fasa 5B menambah validation config-driven pada `submitRequest`, tetapi laluan itu hanya boleh dicapai apabila `OUTING_CONFIG_V2_ENABLED` tepat `"true"`; default dan production semasa kekal pada validator legacy.

## Backend Submission Config — Fasa 5B

```text
submitRequest
  -> flag false: jalankan whitelist dan validator legacy tanpa OUTING_TYPES
  -> flag true: resolve row OUTING_TYPES daripada type_code
       -> type mesti active dan schema lengkap/sah
       -> allowed_days + application window
       -> tarikh/masa server-side + fixed_return_time + same_day_only
       -> required fields menurut config
  -> semak pelajar aktif
  -> duplicate request protection sedia ada
  -> simpan OUTING_REQUESTS + audit minimum + Telegram
```

`fixed_return_time` mengatasi masa yang dihantar client. `same_day_only` menolak tarikh berbeza dan mengisi tarikh balik efektif jika field itu optional. Jika `require_warden_approval = true`, submission bermula `MENUNGGU_KELULUSAN`; jika `false`, backend menandainya `DILULUSKAN_WARDEN` dengan identiti sistem `AUTO_CONFIG_V2`. Peraturan ini hanya boleh beroperasi apabila feature flag aktif.

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
  -> confirmIn menetapkan status SELESAI dan selfie_status BELUM_HANTAR
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

Selepas Guard mengesahkan masuk, bukti selfie pulang diwajibkan untuk kelima-lima jenis permohonan. Sebelum submission, dashboard menunjukkan `Bukti Selfie Belum Dihantar`. Selepas berjaya, action upload hilang dan dashboard menunjukkan `Bukti Selfie Dihantar` bersama `Masa Bukti`.

## Warden

Warden login menggunakan nama + PIN. PIN yang ditaip disimpan dalam runtime session untuk request operasi semasa; flow remember-device sedia ada kekal berfungsi.

Warden boleh:

- refresh permohonan;
- melihat Dashboard dan Checklist Permohonan;
- approve/reject;
- salin senarai nama dengan emoji status.

Checklist memaparkan semua jenis permohonan. Ikon dan label menggunakan status kontekstual pusat.

## Guard

Guard login menggunakan nama + PIN dan menerima rekod operasi penuh melalui POST authenticated.

Seksyen utama:

- `Sedia Untuk Keluar`;
- `Sedang Keluar`.

Quick filter Guard:

- Semua
- Outing Harian
- Pulang Bermalam
- Cuti Semester
- Kecemasan
- Lewat

Filter digunakan pada kedua-dua seksyen. Empty-state berubah mengikut filter dan seksyen. `Kecemasan` tidak dianggap Outing Harian.

`confirmIn` kekal tanggungjawab Guard dan masih menerima catatan masuk optional. Guard tidak mengambil atau upload selfie; bukti dihantar oleh Pelajar selepas status menjadi `SELESAI`.

## Flow Bukti Selfie dan Retry

Syarat backend untuk `submitReturnSelfie`:

- `request_id`, `student_id` dan `no_matrik` diperlukan;
- rekod mesti dimiliki oleh identiti Pelajar tersebut;
- status mesti `SELESAI` dan `masa_masuk` mesti wujud;
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
aktifkan monitorWorkspace
  -> sembunyikan workspace lain
  -> scroll ke permulaan workspace
  -> tunjuk loading
  -> GET awam khusus
  -> mapPublicMonitoringRecord
  -> update outingRecords
  -> render sekali
  -> update timestamp dan monitorHasLoadedOnce
  -> tamat loading
```

Single-flight guard menghalang request bertindih. First-load gagal menunjukkan ralat jelas. Refresh gagal selepas kejayaan mengekalkan data lama dan timestamp lama.

Paparan hanya mempunyai kad ringkasan dan `Senarai Status Semasa`. Setiap baris menunjukkan nama, kelas, jenis permohonan, ikon dan label kontekstual. Ia tidak mempunyai action approve/reject atau confirm keluar/masuk.

## Statistik

`getOutingStats` memulangkan agregat sahaja. Statistik tidak memaparkan leaderboard individu atau row rekod mentah.

## Local Mock QA Admin

```text
?mock=1
  -> bina satu credential Admin QA dan lima OUTING_TYPES dalam memory
  -> apiPost memintas lima action Admin sahaja
  -> login/list/create/update/toggle diproses tanpa fetch atau GAS
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
