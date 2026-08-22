# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow semasa **v2.4.0**, cache revision `2.4.0-r6`, GAS Version 51 dan `OUTING_CONFIG_V2_ENABLED=true` (Active + Ready). Fasa 1–6 complete dan production verified. No-Guard Departure ialah sambungan operasi selepas Fasa 5, currently enabled melalui Admin; full Node baseline kanonik semasa ialah **490/490**.

## Flow keluar normal dan No-Guard

Normal Guard flow kekal primary/default:

```text
DILULUSKAN_WARDEN
  -> Guard authenticated pilih Sahkan Keluar
  -> confirmOut
  -> masa_keluar + guard_keluar_by
  -> KELUAR
```

Fallback apabila Guard tidak tersedia:

```text
DILULUSKAN_WARDEN
  -> Student authenticated bagi request sendiri pilih Mohon Pengesahan Keluar
  -> DEPARTURE_CONFIRMATION_REQUESTED (lifecycle masih DILULUSKAN_WARDEN)
  -> satu Telegram 🚪 kepada Warden/HEP + canonical eOuting URL
  -> Warden queue: Menunggu Pengesahan Keluar
  -> Warden authenticated pilih Sahkan Keluar
  -> authoritative re-read + DILULUSKAN_WARDEN -> KELUAR
  -> masa_keluar; guard_keluar_by kekal blank
  -> WARDEN_REMOTE_CHECKOUT (actor WARDEN, mode REMOTE_NO_GUARD)
  -> satu Telegram ✅ completion + canonical eOuting URL
```

Student tidak pernah self-checkout dan request sahaja tidak menghasilkan `KELUAR`. Eligibility tidak bergantung pada class A2/A3/LI atau jenis outing tertentu. `ScriptLock` dan re-read melindungi race/replay: Guard-first menutup fallback; Warden-first menolak Guard departure kedua. Duplicate pending request tidak mengulang audit/Telegram, dan replay Warden tidak mengulang completion Telegram.

`NO_GUARD_DEPARTURE_ENABLED` hanya aktif bagi nilai tepat `"true"`; safe default ialah false tetapi production close-out kini ON. Apabila OFF, Student request baharu dan Warden fallback confirmation ditolak, sejarah audit kekal, dan unresolved request boleh actionable semula apabila ON. Admin hanya mengawal toggle, bukan authority checkout.

Jika request Telegram gagal, request/waiting UI/queue kekal dan tiada retry automatik. Jika completion Telegram gagal selepas transition, audit dan flush, `KELUAR`, `masa_keluar` dan audit kekal committed, `guard_keluar_by` kekal blank, serta tiada rollback atau automatic retry.

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

Property yang belum wujud menghasilkan `active=false`; simpanan Admin pertama mengisi storage secara automatik. Tiada sheet `ANNOUNCEMENTS` atau setup property manual. Admin UI menyediakan teks, `Penting`, `Aktif`, simpan, current state, timestamp dan identiti pengemas kini.

Landing dan Public Pemantauan tidak memanggil endpoint ini. Banner dimuat selepas sesi authenticated Student, Warden/HEP, Guard atau Admin bermula dan dibersihkan ketika logout. Viewer biasa tidak menerima `updated_by`, nama property atau secret. Teks bounded dirender sebagai plain text, jadi HTML/script tidak dilaksanakan.

Normal dipaparkan sebagai `MAKLUMAN` dan Important sebagai `PENTING`. Kedua-duanya menggunakan ticker mendatar berterusan yang perlahan, dengan hover/fokus/sentuhan untuk pause dan paparan statik bagi `prefers-reduced-motion`; tiada `<marquee>`.

Kandungannya tidak pernah masuk ke `submitRequest`, `approveRequest`, `confirmOut`, `confirmIn` atau resolver `OUTING_TYPES`. Contohnya, banner “Pulang Bermalam dibenarkan keluar mulai jam 2.00 petang.” tidak mengubah `earliest_departure_time`; Admin mesti mengemas kini `Tetapan Outing > Pulang Bermalam > Masa Keluar Paling Awal` secara berasingan.

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
  -> dalam ScriptLock: semak duplicate active + append secara atomic
  -> simpan OUTING_REQUESTS + audit minimum + Telegram
```

`fixed_return_time` mengatasi masa yang dihantar client. `same_day_only` menolak tarikh berbeza dan mengisi tarikh balik efektif jika field itu optional. Jika `require_warden_approval = true`, submission bermula `MENUNGGU_KELULUSAN`; jika `false`, backend menandainya `DILULUSKAN_WARDEN`, mengisi masa approval dan identiti sistem `AUTO_CONFIG_V2`, serta menulis audit `AUTO_APPROVE_REQUEST`. Guard hanya menerima state approved yang sah. Peraturan ini hanya boleh beroperasi apabila feature flag aktif.

Peraturan permohonan dan keluar adalah berasingan. `allowed_days` serta `application_open_time`/`application_close_time` menentukan bila borang boleh dihantar. Kedua-dua masa permohonan ialah optional: blank open time bermaksud tiada opening threshold, blank close time bermaksud tiada closing threshold, dan jika kedua-duanya blank tiada sekatan masa dikenakan. `allowed_days` tetap diperiksa secara berasingan dan authoritative. Admin boleh menggunakan `Kosongkan`; explicit blank membersihkan cell Sheet melalui `clearContent()` supaya nilai lama tidak dikekalkan. `departure_allowed_days` menentukan hari pada `tarikh` keluar, dan `earliest_departure_time` dikuatkuasakan semasa Guard menjalankan `confirmOut`. Row `PULANG_BERMALAM` production membenarkan permohonan pada mana-mana hari, departure Jumaat dan masa paling awal semasa `17:00`; Admin boleh mengubah masa itu mengikut arahan HEP.

Status `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR` dianggap active dan menghalang request baharu; `SELESAI`, `DITOLAK_WARDEN` serta `DIBATALKAN_PELAJAR` membenarkannya. Frontend mempunyai submission in-flight guard dan loading sendiri, tetapi atomic backend lock kekal protection authoritative.

## Student Form Config Rendering — Fasa 5A

```text
Pelajar login / student form dibuka
  -> GET getOutingTypes
  -> active sahaja + sort_order
  -> bina dropdown type_code/display_name
  -> apply visibility, required dan disabled state
  -> same_day_only sync tarikh
  -> fixed_return_time isi dan lock masa
  -> build payload daripada requirement config
       -> tarikh / tarikh_balik / masa_balik_dijangka apabila diperlukan
       -> normalize tarikh kepada YYYY-MM-DD

GET gagal atau config kosong
  -> lima legacy config dalam memory
  -> OUTING_HUJUNG_MINGGU kekal Sabtu/Ahad + 22:00
  -> retry tersedia untuk kegagalan request
```

Hidden field dikosongkan apabila tidak lagi relevan dan sentiasa disabled. Payload builder menggunakan konfigurasi terpilih, bukan whitelist type code frontend. Jenis custom boleh menggunakan requirement sedia ada tanpa branch baharu.

`KLINIK` (`Keluar ke Klinik`) menggunakan same-day return, tidak memaparkan tarikh keluar/balik manual, dan memerlukan masa balik dijangka, lokasi, kenderaan, kelulusan Warden serta selfie. Custom section menggunakan `Maklumat Tambahan`; `PULANG_BERMALAM` sahaja mengekalkan `Maklumat Pulang Bermalam`. `earliest_departure_time` kosong bermaksud tiada had masa paling awal dan Admin boleh mengosongkannya melalui `Kosongkan`. Readiness memaparkan `Config Issue / Not Ready` bagi kombinasi tidak konsisten seperti departure days bersama `require_leave_date=false`.

## Admin Dashboard dan Restore Production

```text
Pilih Admin
  -> isi admin_id atau nama_admin + PIN
  -> POST loginAdmin
  -> runtime credential dibina
  -> simpan { identity, pin, expiresAt } dalam sessionStorage tab
  -> buka Admin Dashboard
  -> load default Admin section; section lain lazy apabila dibuka

Refresh dengan eouting_admin_session_v1
  -> Memulihkan sesi Admin...
  -> POST loginAdmin { admin_id: identity, nama_admin: identity, pin }
  -> berjaya: bina runtime credential dan buka shell
  -> gagal/expired/malformed: bersihkan saved/runtime/partial session dan papar login

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

Jika backend memulangkan `CONFIG_VERSION_CONFLICT`, editor ditutup, data terkini direfresh dan Admin diminta membuka Edit semula. Dedicated sessionStorage mempunyai absolute expiry 12 jam; refresh tidak memanjangkannya, PIN tidak masuk localStorage dan backend revalidation tidak boleh dipintas. Logout mengosongkan saved session, credential runtime dan PIN input.

Restore Admin tidak lagi menunggu `getStudents`, `getWardens`, `getGuards` atau `getTodayRecords`, dan tidak memuat Tetapan Outing unconditional. Shell privileged hanya dipaparkan selepas `loginAdmin` berjaya.

## Loader Authentication dan Restore

Pelajar, Warden, Guard dan Admin berkongsi satu loader untuk fresh login serta saved-session restore. Teks restore adalah role-aware (`Memulihkan sesi Pelajar/Warden/Guard/Admin...`) dengan secondary text `Mengesahkan akses dan memuatkan paparan`. Operation token memastikan completion lama tidak menyembunyikan loader request yang lebih baharu. `finally`/logout membersihkan loader tanpa artificial delay dan `prefers-reduced-motion` mematikan animasi. Public Pemantauan menggunakan lifecycle loadingnya sendiri.

## Lifecycle Rekod

```text
MENUNGGU_KELULUSAN
  -> DILULUSKAN_WARDEN atau DITOLAK_WARDEN
  -> DIBATALKAN_PELAJAR oleh Pelajar
DILULUSKAN_WARDEN
  -> KELUAR
  -> DIBATALKAN_PELAJAR oleh Pelajar
KELUAR
  -> SELESAI
```

`DIBATALKAN_PELAJAR` ialah terminal/non-active dan berlabel `Dibatalkan oleh Pelajar`; ia tidak boleh beralih ke `KELUAR`/`SELESAI`. `lewat` ialah flag tambahan. Label kontekstual frontend tidak menukar nilai status backend. Bukti pulang menggunakan `selfie_status` yang berasingan; penghantaran selfie tidak memperkenalkan status lifecycle utama baharu.

Status awal `submitRequest` disahkan sebelum append. `appendObjectRow_` mengikut susunan header Sheet sebenar, kemudian row persisted dibaca semula untuk memastikan status authoritative ialah status yang dijangka. Blank/tidak dikenali tidak dipetakan kepada pending; paparan selamat ialah `Status Tidak Diketahui`.

## Flow Operational Urgency — Fasa 1

Urgency ialah derived state berasingan dan tidak menukar lifecycle:

```text
normalized operational source row (cache maksimum 20 saat)
  -> baca current now dalam Asia/Kuala_Lumpur
  -> jika status bukan KELUAR: applicable=false
  -> resolve tarikh_balik + masa_balik_dijangka
       -> fallback tarikh/22:00 hanya untuk legacy daily yang wajar
       -> malformed/indeterminate: needs_review=true
  -> derive NORMAL / DUE_SOON / LATE / CRITICAL / ACTION_REQUIRED
  -> nested operational_urgency dalam projection authenticated
```

Sempadan evaluator menggunakan exact elapsed time: lebih 30 minit sebelum ialah `NORMAL`; 0–30 minit sebelum termasuk tepat target ialah `DUE_SOON`; selepas target hingga kurang 30 minit ialah `LATE`; 30 hingga kurang 60 minit ialah `CRITICAL`; dan 60 minit atau lebih ialah `ACTION_REQUIRED`.

Target snapshotted yang valid digunakan untuk semua type code, termasuk custom `KLINIK`, maka expected return tidak lagi tersalah fallback kepada 22:00. Urgency dibuat selepas cache read dan tidak disimpan dalam cache atau Sheet.

```text
Guard confirmIn
  -> ScriptLock + authoritative row re-read
  -> resolve expected-return target yang sama
  -> actual == target: lewat=Tidak
  -> actual > target: lewat=Ya
  -> timing indeterminate: lewat=Ya secara konservatif
  -> status=SELESAI
```

Historical `lewat` kekal `Ya/Tidak`. Active malformed timing kekal kelihatan sebagai `needs_review=true`; keputusan konservatif semasa `confirmIn` ialah known limitation untuk semakan polisi masa hadapan.

## Flow Student Live Status Clarity — Fasa 2

Fasa 2 merender foundation backend Fasa 1 tanpa memindahkan threshold classification ke browser:

```text
authenticated Student record
      ↓
operational_urgency daripada GAS
      ↓
Student Status Semasa
      ↓
local duration text update daripada expected_return_at
      ↓
next_transition_at crossed
      ↓
authoritative backend refresh
```

Lifecycle dan urgency terus bergerak sebagai dimensi berasingan. Contoh `status=KELUAR` + `operational_urgency.state=CRITICAL` memaparkan kedua-duanya; `CRITICAL` tidak menulis atau menggantikan `KELUAR`.

Timer Student 30 saat yang sedia ada mengemas kini wording tempoh dan memeriksa `next_transition_at`. Frontend boleh membentuk `Kurang 1 minit`, `24 minit`, `1 jam 42 minit` dan wording lewat yang setara daripada `expected_return_at`, tetapi tidak mengubah `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL` atau `ACTION_REQUIRED` secara local. Apabila transition dilepasi, transition key memastikan satu refresh authoritative bagi transition itu; single-flight sedia ada mencegah overlap dan tiada timer kedua ditambah.

```text
operational_urgency hilang / malformed / needs_review=true
      ↓
MAKLUMAT WAKTU PULANG PERLU DISEMAK
      ↓
tiada countdown atau late state rekaan
```

Paparan expected return menggunakan masa bagi rekod hari sama dan tarikh + masa bagi rekod kemudian/bermalam. Target datang daripada snapshot request/backend; frontend tidak membaca semula `OUTING_TYPES`. Wording hard-coded “pulang sebelum 10:00 malam” tidak lagi digunakan.

Flow `SELESAI`, cancellation, return-selfie, annual summary/history, profile photo, Announcement Banner/`ruleNotice`, authentication dan privacy boundary kekal. Warden priority sorting, emergency mode, Admin urgency KPI/`Perlu Tindakan`, Telegram timed reminder/escalation, GAS time-driven trigger dan guardian/waris shortcut tidak termasuk dalam Fasa 2.

## Flow Warden Approval Prioritisation + Emergency Mode — Fasa 3

```text
authenticated Warden records
        ↓
pending requests
        ↓
emergency classification
        ↓
departure-priority classification
        ↓
stable oldest-first sorting
        ↓
Warden cards/actions
```

Pending requests dibahagikan kepada emergency, departure approaching/reached, kemudian ordinary. Emergency compatibility menggunakan helper pusat bagi `jenis_permohonan === KECEMASAN`. Bagi non-emergency, departure diberi priority jika `earliest_departure_time` berada dalam 30 minit seterusnya atau telah tiba pada tarikh request authoritative dalam zon masa Malaysia. Timing hilang atau malformed tidak menghasilkan priority. Dalam setiap bucket, `masa_mohon` sah disusun oldest-first; row tanpa timestamp menyusul dengan fallback deterministic/stable.

Backend mengutamakan `earliest_departure_time` request-level yang boleh digunakan. Jika tiada, nilai semasa `OUTING_TYPES` boleh ditambah hanya pada cloned projection Warden authenticated. Nilai fallback tidak ditulis ke `OUTING_REQUESTS` atau Sheet dan tidak dihantar sebagai fallback request-level kepada Student, Guard, Admin atau Public. Akibatnya, config yang berubah selepas submission boleh mentafsir semula priority bagi fallback-only record; snapshot request-level yang sah kekal stabil. Snapshot departure per request ialah pertimbangan schema masa hadapan.

Classification ini hanya mengubah ordering dan presentation. Action approve/reject, authentication, rejection validation, actor recording, lifecycle transition dan Guard authority tidak berubah. Emergency priority tidak auto-approve atau bypass Warden/Guard. Secara berasingan, generic config `require_warden_approval=false` kekal authoritative dan boleh menggunakan `AUTO_CONFIG_V2`; Fasa 3 tidak mengubah flow itu.

```text
Lifecycle:                MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
Warden approval priority: EMERGENCY -> DEPARTURE_APPROACHING/REACHED -> ORDINARY
Return urgency:           NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
```

Contoh `MENUNGGU_KELULUSAN + emergency approval priority` berbeza daripada `KELUAR + CRITICAL return urgency`. Fasa 3 tidak menambah lifecycle state, request column, `OUTING_TYPES.operational_priority`, Admin urgency queue/KPI, Telegram timed reminder/escalation atau trigger, guardian shortcut/access scope, threshold return urgency, version atau deployment. Admin queue/KPI kemudian ditambah oleh Fasa 4 tanpa mengubah batas Fasa 3 yang lain.

## Flow Admin Operational Intelligence + Perlu Tindakan — Fasa 4

```text
authenticated Admin monitoring records
        ↓
backend operational_urgency
        ↓
normalized Admin dataset
        ↓
KPI calculation
        ↓
Perlu Tindakan queue
        ↓
Admin operational cards
```

KPI dan queue sentiasa menggunakan dataset normalized yang sama selepas laluan refresh Pemantauan Admin sedia ada menerima response authoritative. Tiada urgency engine browser, local state transition, aggressive polling loop atau timer kedua ditambah.

KPI ialah `Sedang Di Luar` bagi semua `KELUAR`; `Hampir Waktu Pulang`, `Lewat`, `Kritikal` dan `Tindakan Segera` bagi exact backend state `DUE_SOON`, `LATE`, `CRITICAL` dan `ACTION_REQUIRED` pada `KELUAR`; `Perlu Semak Masa` bagi active `needs_review=true`; serta `Kecemasan Menunggu` bagi `MENUNGGU_KELULUSAN + KECEMASAN`. Urgency KPI mutually exclusive, manakala jumlah `Sedang Di Luar` boleh overlap.

Queue hanya memasukkan `KELUAR + ACTION_REQUIRED`, `KELUAR + CRITICAL`, active `needs_review=true` dan pending `KECEMASAN`, mengikut susunan itu. `NORMAL`, `DUE_SOON`, ordinary `LATE`, pending bukan kecemasan dan terminal/completed dikecualikan. Dalam bucket lewat, `minutes_late` paling besar disusun dahulu; kemudian oldest valid request/submission timestamp, timestamped-before-missing, stable request identifier dan source position menjadi deterministic tie-breaker. Ordering ini hanya presentation frontend dan tidak dipersist.

Metadata urgency malformed atau contradictory tidak menghasilkan urgency rekaan; kad review hanya muncul apabila backend memberikan `needs_review=true`. Pending emergency ialah intelligence, bukan approval: Admin tidak memintas Warden, tidak mengubah `require_warden_approval` dan tidak memperoleh approval authority. Kad tidak menambah data guardian/waris, shortcut atau phone button.

```text
Lifecycle:                MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
Warden approval priority: EMERGENCY -> DEPARTURE_APPROACHING/REACHED -> ORDINARY
Return urgency:           NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
Admin action queue:       ACTION_REQUIRED -> CRITICAL -> NEEDS_REVIEW -> PENDING_EMERGENCY
```

## Flow Telegram Return Reminder + Late Escalation — Fasa 5

```text
Apps Script time-driven trigger — every 5 minutes
        ↓
scanReturnOperationalNotifications_()
        ↓
operational KELUAR rows
        ↓
getOperationalUrgency_
        ↓
eligible DUE_SOON / CRITICAL / ACTION_REQUIRED stage
        ↓
AUDIT_LOG request_id + stage dedup
        ↓
bounded deterministic batch
        ↓
Telegram send
        ↓
successful SENT audit per request
```

Tepat satu trigger, ID `9156626915782557696`, menyasarkan private scanner secara langsung; wrapper maintenance bukan trigger target. Scheduled call tidak membawa options, maka ia ialah normal non-dry production execution. Seluruh non-dry flow berada dalam existing `ScriptLock`: source dan audit dibaca, urgency authoritative dikira, candidate didedup dan disusun, batch dihantar, kemudian successful audit ditulis sebelum lock dilepaskan. Concurrent scan menunggu dan membaca event scan terdahulu. Telegram failure tidak menulis SENT event atau mengubah lifecycle, urgency dan request data; retry masa hadapan masih dibenarkan.

```text
runReturnOperationalNotificationsDryRun()
        ↓
hard-coded dryRun=true
        ↓
same read + classify + audit check + ordered/bounded PREVIEW
        ↓
skip Telegram send
skip SENT audit write
skip request mutation
skip trigger installation
```

Wrapper manual ini parameterless, tidak boleh menerima non-dry caller input dan tidak berada dalam frontend, `doGet` atau `doPost`. Optional explicit `now` hanya digunakan secara internal/test. Batch maksimum ialah 40 rekod dan 3,500 aksara; `DUE_SOON` earliest expected return dahulu, `CRITICAL`/`ACTION_REQUIRED` greatest minutes late dahulu, diikuti request ID dan source position. Oversized group dipecah secara deterministic.

Stage mapping ialah `DUE_SOON -> RETURN_REMINDER_SENT`, `CRITICAL -> RETURN_CRITICAL_SENT`, `ACTION_REQUIRED -> RETURN_ACTION_REQUIRED_SENT`. Same-stage event menghalang repeat stage, tetapi reminder tidak menghalang critical dan critical tidak menghalang action-required.

Practical exactly-once limitation kekal: Telegram send dan Sheet audit bukan atomic. Send berjaya diikuti audit failure boleh dilaporkan sebagai `SENT_AUDIT_PARTIAL`; retry kemudian secara teori boleh duplicate. Trigger production kini aktif, tetapi tiada browser/frontend route kepada scanner.

## Flow Guardian Contact Shortcut — Fasa 6

```text
authenticated Warden/HEP operational list
        ↓
backend broad projection removes telefon_waris / hubungan_waris
        ↓
eligible row receives guardian_contact_available=true
        ↓
frontend renders 📞 Hubungi Penjaga
        ↓
POST getGuardianContact with Warden credentials + request_id
        ↓
re-read authoritative request + re-evaluate urgency
        ↓
validate pending/approved KECEMASAN
  OR KELUAR + CRITICAL/ACTION_REQUIRED
        ↓
normalize safe tel: phone
        ↓
write GUARDIAN_CONTACT_ACCESSED without raw contact
        ↓
return details and render 📞 Telefon Sekarang
```

Audit context ialah `EMERGENCY_REQUEST`, `CRITICAL_RETURN` atau `ACTION_REQUIRED_RETURN`; audit failure menghalang disclosure. Tiada WhatsApp/SMS atau automatic outbound contact. Source ialah `OUTING_REQUESTS.telefon_waris` dan `hubungan_waris`; nama penjaga tiada dalam schema dan dipaparkan sebagai `Tidak direkodkan`.

Jika `OUTING_TYPES.require_warden_approval=false`, submission kekal auto-approved oleh `AUTO_CONFIG_V2` kepada `DILULUSKAN_WARDEN`. Frontend mengenali lifecycle authoritative itu dan meletakkan emergency di `Telah Diluluskan / Risiko Pulang`, bukan `Menunggu Kelulusan`, tanpa actor-based filter atau approval kedua. Guard terus melakukan checkout normal; No-Guard hanya fallback yang dikawal berasingan.

## Flow Pembatalan Pelajar

```text
MENUNGGU_KELULUSAN atau DILULUSKAN_WARDEN
  -> Pelajar tekan Batal Permohonan
  -> action sheet accessible meminta Sebab Batal Permohonan
  -> trim + validation frontend 5–500 aksara
  -> POST cancelStudentRequest dengan identiti Pelajar
  -> ScriptLock
       -> revalidate identiti dan pemilikan
       -> baca semula row/status authoritative
       -> revalidate sebab 5–500 aksara
       -> status = DIBATALKAN_PELAJAR
       -> simpan sebab_batal_pelajar, masa_batal_pelajar, dibatalkan_oleh=PELAJAR
       -> flush
  -> AUDIT_LOG CANCEL_STUDENT_REQUEST
  -> satu notifikasi Telegram non-blocking
  -> rekod masuk sejarah dan Pelajar boleh memohon semula
```

Flow ini status-driven dan sama bagi jenis standard, `KLINIK` serta jenis custom masa hadapan. Dialog menyediakan `Sahkan Batal Permohonan`, `Kembali`, loading `Membatalkan...`, duplicate-submit protection, Escape/backdrop close dan focus restoration. Selepas berjaya, sebab serta masa pembatalan kelihatan dalam sejarah authenticated dan butang batal hilang.

Approval/rejection Warden serta `confirmOut` Guard turut membaca semula state di bawah lock. Hanya satu transition menang: jika Guard telah menetapkan `KELUAR`, cancellation ditolak dan tidak boleh menimpa `KELUAR`. Rekod cancelled hilang daripada queue pending/approved Warden dan daripada `Sedia Untuk Keluar`/`Sedang Keluar` Guard. Public Monitoring tidak mendedahkan sebab dan tidak menganggapnya sedia keluar atau sedang keluar; statistik tidak mengiranya sebagai selesai/berjaya.

Telegram cancellation dihantar sekali bagi previous status pending atau approved. Ia mengandungi nama, nombor matrik, jenis, status sebelum batal dalam label manusia, sebab dan masa. Failure hanya dilog sebagai warning, tidak rollback cancellation dan tidak menghasilkan percubaan pendua.

## Flow Utama

```text
Pelajar pilih nama + masukkan no_matrik
  -> backend sahkan student_id + no_matrik dari STUDENTS
  -> Pelajar hantar OUTING_BIASA / OUTING_HUJUNG_MINGGU / KECEMASAN / PULANG_BERMALAM / CUTI_SEMESTER
  -> backend halang duplicate active request
  -> MENUNGGU_KELULUSAN + Telegram
Warden login nama + PIN
  -> POST getTodayRecords authenticated
  -> derive role daripada WARDENS.warden_id
  -> approve atau reject + Telegram role-aware
Guard login nama + PIN
  -> POST getTodayRecords authenticated
  -> confirm keluar / masuk + Telegram
  -> confirmIn menetapkan status SELESAI
     -> BELUM_HANTAR jika bukti diwajibkan
     -> TIDAK_DIPERLUKAN jika config-driven require_selfie=false
Pelajar refresh rekod sendiri
  -> POST getTodayRecords untuk Status Semasa live/current
  -> POST getStudentAnnualSummary untuk jumlah + sejarah SELESAI tahun semasa
  -> lihat “Ambil Selfie & Lapor Pulang”
  -> kamera depan / pilih gambar -> preview -> ambil semula atau hantar
  -> resize kira-kira 1280px + JPEG compression
  -> submitReturnSelfie
  -> Drive private + Telegram sendPhoto + metadata Sheet
  -> selfie_status SUDAH_HANTAR
Pelajar, Warden dan Guard refresh melalui laluan authenticated masing-masing
```

Field masa sahaja dinormalkan di boundary GAS kepada `HH:mm` dalam `Asia/Kuala_Lumpur` sebelum digunakan oleh config, rekod operasi, Guard, late comparison atau Telegram. Frontend hanya menggabungkan tarikh dan masa canonical serta mempunyai fallback terkawal untuk payload 1899 legacy; tiada pampasan offset manual. Helper daypart BM mengelaskan `01:00–11:59` sebagai Pagi, `12:00–12:59` sebagai Tengah Hari, `13:00–18:59` sebagai Petang dan `19:00–00:59` sebagai Malam. Formatter locale generik masih boleh menghasilkan singkatan seperti `PTG`.

## Pelajar

Direktori public hanya membekalkan `student_id`, `nama` dan `kelas`. Dropdown menggunakan `student_id` sebagai value dalaman dan memaparkan nama. Nombor matrik ditaip berasingan dan backend memadankan kedua-dua credential dengan row Google Sheets.

Pelajar hanya menerima rekod sendiri melalui authenticated POST. `getTodayRecords` membekalkan rekod operasi live/current dan nested `operational_urgency` untuk `Status Semasa`; active request menghalang permohonan baharu sehingga selesai, ditolak atau dibatalkan. Student presentation menggunakan state, `expected_return_at` dan `next_transition_at` authoritative daripada backend dan tidak memiliki threshold classification. Butang `Batal Permohonan` hanya hadir untuk rekod sendiri yang pending/approved.

Hierarki workspace Pelajar ialah Announcement Banner, navigasi, `ruleNotice`, identiti, `Status Semasa`, borang outing, kemudian bahagian bawah Refresh Status, jumlah tahunan dan `Rekod Outing Saya`. `Status Semasa` di atas borang ialah kawasan authoritative untuk rekod aktif/actionable serta tindakan pembatalan atau return-selfie apabila layak. Borang dan logic pemilihan current record tidak berubah.

`Rekod Outing Saya` menggunakan `history_records` daripada authenticated `getStudentAnnualSummary`, bukan dataset hari ini. Backend membina `total_outings` dan `history_records` daripada set `SELESAI` tahun semasa yang sama; pending, approved, `KELUAR`, rejected dan cancelled tidak termasuk kerana ia tidak dikira oleh jumlah tahunan. Setiap baris hanya menunjukkan tarikh, jenis outing dan status ringkas, paling baharu dahulu. Initial load dan butang Refresh Status memuat semula current/live status, jumlah tahunan dan sejarah tahunan.

Pelajar boleh upload/ganti foto profil sendiri. Tindakan membuka action sheet `Ambil Foto`, `Pilih dari Galeri` dan `Batal`. Kamera menggunakan `capture="user"`; galeri tidak mempunyai capture. Kedua-duanya berkongsi handler validation, crop 3:4, compression, upload, preview dan cache yang sama. Escape/backdrop/Batal menutup chooser dan memulangkan fokus. Return-selfie tidak berkongsi input atau handler ini.

Identity/editor memuatkan thumbnail melalui batch authenticated dan editor sendiri boleh menggunakan imej penuh. Klik thumbnail membuka modal; jika full cache belum tersedia, satu request authenticated `photo_variant = "full"` dibuat untuk pelajar itu sahaja. Initials tidak mempunyai tindakan klik.

Semasa flag `false`, semua jenis legacy kekal memerlukan bukti selepas Guard mengesahkan masuk. Dalam config-driven mode, `require_selfie` disnapshot pada submission; `false` memaparkan `Bukti Selfie Tidak Diperlukan`, manakala `true` memaparkan action `Bukti Selfie Belum Dihantar`. Selepas berjaya, action upload hilang dan dashboard menunjukkan `Bukti Selfie Dihantar` bersama `Masa Bukti`.

## Warden / HEP

Warden dan HEP berkongsi role operasi backend `warden`. Selepas authentication terhadap row WARDENS sedia ada, backend memperoleh role staff daripada `warden_id`: `HEP-*` → HEP, `W-*` → WARDEN dan ID legacy/tidak dikenali → WARDEN. Frontend menyimpan `staffRole` untuk paparan tetapi tidak menjadi sumber kepercayaan. Approval tetap menulis lifecycle `DILULUSKAN_WARDEN` dan nama sedia ada dalam `warden_approve_by`; paparan sejarah serta Telegram menyelesaikan label aktor daripada WARDENS. Login menggunakan nama + PIN dan flow remember-device sedia ada kekal berfungsi.

Warden boleh:

- refresh permohonan;
- melihat Dashboard dan Checklist Permohonan;
- approve/reject dengan in-flight lock/loading yang menolak duplicate click;
- salin senarai nama dengan emoji status.
- melihat `📞 Hubungi Penjaga` secara on-demand bagi record Phase 6 yang backend tandakan eligible; broad list tidak membawa raw contact.

Rekod `DIBATALKAN_PELAJAR` tidak berada dalam pending approval atau approved/actionable queue Warden. Jika muncul dalam sejarah authenticated, label dan sebab pembatalan boleh dipaparkan.

Checklist memaparkan semua jenis permohonan. Ikon dan label menggunakan status kontekstual pusat.

Kad Warden/HEP dan Guard memuat `photo_variant = "thumbnail"` melalui satu batch authenticated bagi ID operasi unik yang dibenarkan. Request serentak/duplicate ditekan dan kegagalan menggunakan initials. Klik foto sebenar membuka thumbnail/loading modal lalu memuat satu `photo_variant = "full"` jika belum dicache; butang approve/reject/confirm kekal berasingan serta explicit.

## Guard

Guard login menggunakan nama + PIN dan menerima rekod operasi penuh melalui POST authenticated.

Seksyen utama:

- `Sedia Untuk Keluar`;
- `Sedang Keluar`.

Rekod `DIBATALKAN_PELAJAR` tidak layak untuk kedua-dua seksyen, `confirmOut` atau `confirmIn`.

Tindakan `Sahkan Keluar` menggunakan penegasan oren dan `Sahkan Masuk` menggunakan penegasan hijau. Kedua-duanya kekal pada handler `confirmOut`/`confirmIn` sedia ada dan tidak dicetuskan oleh shortcut Enter generik.

Kedua-dua tindakan menggunakan in-flight lock/loading tersendiri supaya klik berulang tidak menghasilkan request kedua; success/error dan backend validation kekal authoritative.

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

Public Monitoring menggunakan GET awam `getTodayRecords`, tidak kira sama ada browser mempunyai sesi lain. Response hanya mengandungi nama, kelas, jenis permohonan, status, lewat dan belum_masuk. Ia tidak menerima nested `operational_urgency`, expected-return timestamp, minit ke target/lewat, transition, action code atau timing diagnostic.

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

Selepas login, identiti sesi, tajuk `Admin eOuting` dan navigasi kekal visible. Tujuh panel inline ialah `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`.

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
