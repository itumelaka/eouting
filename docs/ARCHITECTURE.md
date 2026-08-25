# Architecture eOuting ITU

Versi repo semasa: **v2.4.0** dengan frontend/cache production `2.4.0-r20` dan service worker `eouting-cache-v2.4.0-r20`. Production menggunakan GAS Version 55; full Node suite repo termasuk P0 backend yang di-HOLD ialah **726/726**. Version 56 bukan production.

## Performance dan scalability

GAS + Google Sheets masih sesuai untuk skala kecil/satu kampus ITU semasa. Bottleneck utama ialah row sejarah yang berulang kali diperlakukan sebagai current operational state: reconstruction current-hostel lama `O(S×R)`, departure audit projection lama `O(K×A)`, full historical request scans, contention `ScriptLock` global, polling tab tersembunyi dan Admin Students yang merender semua data/foto.

Julat perancangan berikut bukan hard limit: bawah kira-kira 5k–10k request biasanya manageable; sekitar 10k–25k optimisasi perlu tersedia; sekitar 25k–50k current-hostel dan historical query tanpa cache menjadi high risk; sekitar 50k–100k dengan concurrency material memerlukan pemisahan active/archive serta summary/index. Strategi archive diperlukan kemudian. Migrasi database tidak diperlukan sekarang; laluan medium-term pilihan ialah GAS + Sheets yang dioptimumkan/diarchive, sementara Postgres/Supabase hanyalah pilihan skala besar masa hadapan.

P0-1 yang telah diimplementasi dan diuji tetapi held from production menukar current-hostel kepada `O(S+R)` melalui Map latest-request-by-student satu laluan, mengekalkan hanya latest authoritative `KELUAR` sebagai outside. Snapshot presence `ScriptCache` dikongsi selama 20 saat dan invalidation dipusatkan; aggregate public, roster authenticated dan grouping kekal sama. P0-2 menukar departure audit kepada `O(K+A)` melalui Map mengikut `request_id`, mengekalkan action relevan serta row-order semantics dan menapis Student authenticated lebih awal apabila selamat. Warden/Guard dan schema tidak berubah.

Premium Institutional UI r13–r17 memberi Access/Login, Student, Warden/HEP, Guard dan Admin gaya responsif khusus role di atas boundary sedia ada. Refresh visual tidak menukar auth authority, API contract, lifecycle, Current Hostel Residents privacy model atau profile-photo authorization.

## Komponen

```text
GitHub Pages static frontend / PWA
  -> Google Apps Script Web App router
    -> Google Sheets
    -> Google Drive private profile-photo and selfie storage (separate folders)
    -> Telegram Bot notifications
    -> AUDIT_LOG
```

### Frontend PWA

Fail utama:

- `index.html`
- `assets/app.js`
- `assets/style.css`
- `service-worker.js`
- `version.json`

Frontend mengurus grid landing kompak 2×2, borang Pelajar, Dashboard Warden/HEP dan Guard, Public Monitoring read-only yang dibuka inline, tujuh modul Admin inline termasuk `Notis Banner`, update PWA serta input kamera/file untuk foto profil dan bukti pulang. Statistik tidak mempunyai laluan awam dan kekal di dalam shell Admin. Foto profil menawarkan input kamera `capture="user"` dan input galeri tanpa `capture`, kemudian kedua-duanya berkongsi crop 3:4 serta compression maksimum kira-kira 600×800; selfie kekal workflow berasingan pada resize sisi terpanjang kira-kira 1280px. Frontend role hiding bukan boundary keselamatan.

### GAS Router

`gas/Code.gs` menyediakan `doGet(e)` dan `doPost(e)`. Backend membaca dan menulis Google Sheets, mengesahkan credential, menguatkuasakan transition status, menyimpan selfie ke Google Drive, menulis audit log dan menghantar Telegram.

Telegram ialah side effect non-blocking bagi notifikasi lifecycle biasa. Untuk `submitReturnSelfie`, penghantaran imej melalui `sendPhoto` ialah sebahagian daripada hasil bukti yang diperlukan; kegagalan sebelum transaksi lengkap mencetuskan cleanup Drive/Telegram. Kegagalan audit selepas transaksi utama berjaya hanya diberi amaran dan tidak membatalkan submission.

### Generic Application Date Window

`OUTING_TYPES.application_open_date` dan `application_close_date` ialah policy fields optional, canonical `YYYY-MM-DD`, bagi setiap jenis outing. Backend GAS menormalkan config dengan ketat, menerima blank, menolak tarikh malformed/mustahil dan memerlukan close tidak lebih awal daripada open; same-day range sah. Semasa submission, tarikh Malaysia semasa dibanding secara inklusif sebelum allowed-day/time checks dan sebelum append. Oleh itu date, `allowed_days`, `application_open_time` dan `application_close_time` membentuk conjunction; kegagalan mana-mana syarat menghentikan persistence.

Frontend menerima kedua-dua tarikh melalui safe Student projection untuk notis UX sebelum buka atau selepas tutup, tetapi tidak menjadi authority. Jam/browser device boleh mempengaruhi panduan yang terlihat tetapi tidak boleh memintas GAS. Admin-only config metadata kekal di luar projection public/Student. Existing rows dengan blank dates melalui laluan legacy yang sama seperti sebelum feature.

Migration menggunakan `setupAdminOutingConfigV200()`/`ensureHeaders_()` dan menambah header di hujung tanpa reorder data. Production migration 22 Ogos 2026 menghasilkan kolum AC/AD, mengekalkan semua row blank dan tidak menyentuh `OUTING_REQUESTS`. Tiada row menerima tarikh automatik. Commit implementation ialah `76c6898`; production menggunakan GAS Version 52 dan frontend r7.

### No-Guard Departure — fallback terkawal

Architecture mengekalkan dua laluan keluar tanpa status atau database component baharu:

```text
normal:   DILULUSKAN_WARDEN -> Guard confirmOut -> KELUAR
fallback: DILULUSKAN_WARDEN -> Student request -> DEPARTURE_CONFIRMATION_REQUESTED
          -> Warden queue -> Warden remote confirm -> KELUAR -> WARDEN_REMOTE_CHECKOUT
```

Eligibility bersifat generik berdasarkan ownership Pelajar, lifecycle approved yang masih unresolved, feature gate dan authentication; ia bukan rule kelas atau jenis outing. Student request tidak menukar lifecycle dan tidak memberi authority self-checkout. Warden authentication diperlukan untuk transition akhir. Admin endpoint hanya membaca/menukar `NO_GUARD_DEPARTURE_ENABLED` dan tidak memberi Admin kuasa checkout. Property hilang, malformed atau selain string tepat `"true"` fail closed kepada disabled; production close-out kini enabled.

Request dan confirmation menggunakan existing `ScriptLock` serta authoritative re-read. Guard-first menyebabkan fallback tidak lagi actionable, manakala Warden-first menjadikan Guard departure kedua tidak sah. Warden transition menetapkan `masa_keluar`, membiarkan `guard_keluar_by` blank dan menulis `WARDEN_REMOTE_CHECKOUT` dengan actor role `WARDEN` serta mode `REMOTE_NO_GUARD`. Pending fallback berasal daripada `AUDIT_LOG` event `DEPARTURE_CONFIRMATION_REQUESTED`, bukan lifecycle status atau kolum baharu.

Selepas request audit berjaya, satu Telegram `🚪 PENGESAHAN KELUAR TANPA GUARD` dibina dengan canonical `EOUTING_APP_URL`. Audit request ialah dedup authority; duplicate pending tidak menghantar lagi. Send gagal tidak rollback request dan tiada retry automatik. Selepas row transition, `WARDEN_REMOTE_CHECKOUT` audit dan Spreadsheet flush berjaya, satu Telegram `✅ PENGESAHAN KELUAR OLEH WARDEN` dihantar. Failure tidak rollback `KELUAR`, `masa_keluar` atau audit; replay tidak menghantar lagi dan tiada retry automatik. Tiada notification audit `DEPARTURE_CONFIRMATION_TELEGRAM_SENT`.

`EOUTING_APP_URL=https://itumelaka.github.io/eouting/` digunakan pada submission baharu termasuk kecemasan, No-Guard request, Phase 5 `DUE_SOON`/`CRITICAL`/`ACTION_REQUIRED`, dan Warden remote completion. Approval/rejection lifecycle sahaja, cancellation dan normal Guard movement tidak termasuk dalam claim ini.

Web App contract `USER_DEPLOYING + ANYONE_ANONYMOUS` membolehkan static frontend memanggil API sementara authorization aplikasi kekal pada validation backend. `ANYONE_ANONYMOUS` ialah transport-level access, bukan unrestricted business authority.

### Operational Urgency Foundation — Fasa 1

Backend memisahkan dua dimensi rekod:

```text
lifecycle: MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
urgency:   NORMAL | DUE_SOON | LATE | CRITICAL | ACTION_REQUIRED
```

Urgency hanya applicable sebagai active-return escalation bagi lifecycle `KELUAR`. Resolver expected-return mengutamakan snapshot `tarikh_balik + masa_balik_dijangka` tanpa mengehadkannya kepada type code tertentu, maka jenis custom/config-driven dengan timing valid menggunakan target sendiri dan bukan fallback 22:00. Bagi rekod legacy harian sahaja, tarikh boleh fallback kepada `tarikh` dan masa kosong boleh fallback kepada 22:00. Timing malformed atau indeterminate menghasilkan metadata diagnostic dengan `needs_review=true`.

Evaluator menggunakan `Asia/Kuala_Lumpur` dan exact elapsed time. Lebih 30 minit sebelum target ialah `NORMAL`; 0–30 minit sebelum termasuk tepat target ialah `DUE_SOON`; selepas target hingga kurang 30 minit ialah `LATE`; 30 hingga kurang 60 minit ialah `CRITICAL`; dan 60 minit atau lebih ialah `ACTION_REQUIRED`.

`confirmIn()` menggunakan resolver authoritative yang sama dan menyimpan historical `lewat` dalam format schema sedia ada `Ya`/`Tidak`: tepat target ialah `Tidak`, selepas target ialah `Ya`. Timing yang benar-benar indeterminate disimpan secara konservatif sebagai `Ya`; active malformed row pula kekal reviewable melalui `needs_review=true`.

`getOperationalTodayRecords` membaca normalized source rows daripada cache 20 saat, mengambil masa semasa, kemudian menghasilkan nested `operational_urgency` bagi projection authenticated Pelajar, Warden/HEP, Guard dan Admin. State urgency itu sendiri tidak dicache dan tidak ditambah kepada raw Sheet row. Public GET kekal enam medan tanpa timestamp, minit, transition, action code atau diagnostic urgency. Tiada perubahan schema dibuat.

Pada close-out Fasa 1, foundation ini belum mempunyai frontend urgency UI, Warden priority sorting, Admin intelligence dashboard, timed Telegram reminder/escalation atau guardian shortcut.

### Student Live Status Clarity — Fasa 2

Pembahagian tanggungjawab kekal tegas:

```text
GAS/backend
  -> resolve expected-return target
  -> classify authoritative urgency state
  -> supply expected_return_at + next_transition_at

Student frontend
  -> render lifecycle dan urgency sebagai dimensi berasingan
  -> update teks tempoh daripada expected_return_at
  -> refresh GAS apabila next_transition_at dilepasi
  -> tidak reclassify urgency secara local
```

Satu timer refresh Pelajar 30 saat yang sedia ada digunakan untuk kemas kini teks tempoh dan pemeriksaan transition. Transition key menekan refresh transition pendua; tiada timer tambahan atau request Pelajar bertindih. Pengiraan local hanya untuk wording tempoh (`Kurang 1 minit`, minit, jam + minit dan bentuk lewat yang setara), bukan untuk sempadan `NORMAL` hingga `ACTION_REQUIRED`.

Rekod hari sama memaparkan masa `expected_return_at`; rekod kemudian atau bermalam memaparkan tarikh dan masa. Frontend tidak membaca `OUTING_TYPES` semasa untuk membina semula target kerana snapshot request/backend ialah sumber authoritative. Metadata hilang, malformed atau `needs_review=true` masuk ke paparan review selamat tanpa countdown/state lewat rekaan.

Fasa 2 hanya mengubah presentation Pelajar dalam `assets/app.js` dan `assets/style.css`, dengan regression coverage dalam `tests/student-current-status-layout.test.js` dan `tests/student-live-status-clarity-phase2.test.js`. Lifecycle `SELESAI`, cancellation, return-selfie, annual history, profile photo, Announcement Banner/`ruleNotice`, authentication dan privacy boundary tidak berubah. Warden prioritisation, emergency mode, Admin operational intelligence/`Perlu Tindakan`, Telegram timed reminder/escalation, GAS time-driven trigger dan guardian shortcut kekal Fasa 3+; tiada schema, backend threshold, version atau deployment change dalam Fasa 2.

### Warden Approval Prioritisation + Emergency Mode — Fasa 3

Fasa 3 menambah dimensi approval-priority yang berasingan daripada lifecycle dan return urgency:

```text
lifecycle:                MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
warden approval priority: EMERGENCY -> DEPARTURE_APPROACHING/REACHED -> ORDINARY
return urgency:           NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
```

Priority hanya menyusun rekod `MENUNGGU_KELULUSAN` untuk Warden. Emergency compatibility dipusatkan pada `jenis_permohonan === KECEMASAN`; ia mempengaruhi sorting, visual emphasis dan contextual guidance, bukan status atau authority. Approve/reject backend dan Guard transition kekal tidak berubah. Generic config `require_warden_approval=false` masih boleh menggunakan `AUTO_CONFIG_V2`; behavior sedia ada itu bukan emergency bypass Fasa 3.

Untuk bucket departure, frontend menggunakan `earliest_departure_time`, tarikh request authoritative dan `Asia/Kuala_Lumpur`; masa dalam 30 minit atau yang telah tiba diberi priority, manakala timing hilang/malformed tidak mereka priority. Dalam setiap bucket, timestamp `masa_mohon` yang sah disusun oldest-first, diikuti rekod tanpa timestamp dengan ordering fallback deterministic/stable.

`getOperationalTodayRecords` hanya memanggil `addWardenDeparturePriorityProjection_` selepas Warden disahkan. Helper mengklon row, mengutamakan `earliest_departure_time` yang dibawa request jika boleh digunakan dan menggunakan nilai `OUTING_TYPES` semasa hanya sebagai compatibility fallback. Projection ini derived dan tidak dipersist: tiada write ke `OUTING_REQUESTS` atau Sheet, dan Student, Guard, Admin serta Public tidak menerima fallback request-level tersebut.

Known limitation/future schema consideration: bagi request tanpa snapshot departure request-level, perubahan `OUTING_TYPES.earliest_departure_time` selepas submission boleh mentafsir semula priority Warden. Request dengan nilai request-level sah kekal stabil. Snapshot masa keluar per request boleh dipertimbangkan dalam schema/version akan datang; Fasa 3 tidak menambah request column, `OUTING_TYPES.operational_priority` atau schema baharu.

Presentation kad Warden adalah compact dan procedural, termasuk cue kecemasan atau departure serta butiran kecemasan/waris yang memang telah diizinkan. Control approval/rejection, validation, actor recording, checklist semester/overnight, filter/counter, authentication dan privacy boundary dikekalkan. Mobile sekitar 390px dan desktop 1280×720 disahkan tanpa overflow. Pada close-out Fasa 3, Admin intelligence/`Perlu Tindakan` masih future; ia kini dilengkapkan oleh Fasa 4 tanpa mengubah flow approval Warden.

### Admin Operational Intelligence + Perlu Tindakan — Fasa 4

Pemantauan Admin authenticated menggunakan nested `operational_urgency` yang sama daripada backend Fasa 1. Browser tidak memiliki threshold engine kedua dan tidak mengubah `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL`, `ACTION_REQUIRED` atau `needs_review`. Metadata malformed/contradictory tidak difabrikasi; review hanya wujud apabila backend memberi `needs_review=true`.

Satu normalized Admin dataset menjadi input bersama untuk KPI dan queue. `Sedang Di Luar` mengira semua `KELUAR`; urgency KPI mengira tepat `KELUAR + DUE_SOON`, `KELUAR + LATE`, `KELUAR + CRITICAL` dan `KELUAR + ACTION_REQUIRED`; `Perlu Semak Masa` mengira active record dengan `needs_review=true`; dan `Kecemasan Menunggu` mengira `MENUNGGU_KELULUSAN + KECEMASAN`. Urgency KPI mutually exclusive, manakala jumlah lifecycle `Sedang Di Luar` boleh overlap.

Queue frontend-derived `Perlu Tindakan` menggunakan bucket `ACTION_REQUIRED -> CRITICAL -> NEEDS_REVIEW -> PENDING_EMERGENCY`. Ordinary `LATE`, `DUE_SOON`, `NORMAL`, pending bukan kecemasan dan record terminal tidak dimasukkan. Dalam dua bucket lewat, `minutes_late` terbesar didahulukan; kemudian timestamp sah oldest-first, timestamped-before-missing, stable request ID dan source position memastikan ordering deterministic. Priority ini tidak ditulis ke Sheet atau schema.

Pending emergency ialah signal operasi kepada Admin sahaja; approval Warden, `require_warden_approval`, lifecycle dan Guard authority tidak berubah. Kad tidak meluaskan data guardian/waris atau menambah shortcut/phone button. Existing Admin refresh path membina semula KPI dan queue daripada response authoritative yang sama tanpa timer/polling baharu. Fasa 4 hanya mengubah frontend dan tests; tiada GAS atau schema change.

Empat lapisan kekal berasingan:

```text
lifecycle:                MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
warden approval priority: EMERGENCY -> DEPARTURE_APPROACHING/REACHED -> ORDINARY
return urgency:           NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
admin action queue:       ACTION_REQUIRED -> CRITICAL -> NEEDS_REVIEW -> PENDING_EMERGENCY
```

### Telegram Return Reminder + Late Escalation Scanner — Fasa 5

`scanReturnOperationalNotifications_(options)` ialah backend-only scanner yang menggunakan `getOperationalUrgency_(record, now)` authoritative. Ia hanya menerima `KELUAR + DUE_SOON/CRITICAL/ACTION_REQUIRED`; timing invalid, `needs_review`, ordinary `LATE`, lifecycle lain dan request ID yang tidak selamat dikecualikan. Tiada threshold classification baharu, historical `lewat` classifier atau frontend invocation path.

Mapping delivery history ialah `DUE_SOON -> RETURN_REMINDER_SENT`, `CRITICAL -> RETURN_CRITICAL_SENT` dan `ACTION_REQUIRED -> RETURN_ACTION_REQUIRED_SENT`. Existing `AUDIT_LOG` membekalkan dedup per `request_id + stage`; earlier-stage event tidak menutup eligibility bagi later stage. Ini history notification sahaja, bukan lifecycle atau return urgency.

Stage batch dibataskan kepada 40 rekod dan 3,500 aksara. `DUE_SOON` menggunakan earliest expected return, stage lewat menggunakan greatest `minutes_late`, kemudian request ID dan source position sebagai deterministic fallback. Message projection sengaja tidak membawa guardian/waris, selfie, diagnostics, raw action code atau secret Telegram.

Scanner menggunakan existing `ScriptLock` merentasi source read, urgency calculation, audit check, batch build, Telegram send dan post-success audit write. Concurrent scan menunggu lock dan kemudian melihat audit yang ditulis scan terdahulu. Send gagal tidak menulis SENT event atau mengubah source/lifecycle/urgency.

Idempotency adalah praktikal, bukan exactly-once transactional. Telegram delivery dan Google Sheets audit write tidak atomic; send berjaya diikuti audit failure boleh menghasilkan `SENT_AUDIT_PARTIAL` dan membuka kemungkinan duplicate pada retry kemudian.

`runReturnOperationalNotificationsDryRun()` ialah wrapper maintenance public yang parameterless dan hard-coded kepada `dryRun: true`. Ia menghasilkan structured ordered/bounded preview selepas source/audit read tanpa Telegram send, SENT audit write, request mutation atau trigger installation. Wrapper tidak berada dalam `doGet`/`doPost` atau frontend dan caller tidak boleh menukarnya kepada non-dry mode. Optional explicit `now` kekal hanya capability internal/test scanner.

Lapisan scheduling production ialah tepat satu Apps Script time-driven trigger setiap lima minit, ID `9156626915782557696`, yang terus menyasarkan private `scanReturnOperationalNotifications_`. Ia tidak menyasarkan wrapper maintenance. Scheduled invocation tidak memberi options, maka scanner berjalan dalam normal non-dry production mode:

```text
Apps Script 5-minute trigger
  -> scanReturnOperationalNotifications_()
  -> operational KELUAR rows
  -> getOperationalUrgency_ authoritative
  -> DUE_SOON / CRITICAL / ACTION_REQUIRED
  -> AUDIT_LOG request_id + stage dedup
  -> bounded Telegram batch
  -> successful RETURN_*_SENT audit
```

Private scanner tidak selectable dalam Add Trigger UI kerana trailing `_`; temporary idempotent installer yang fixed kepada handler/cadence itu digunakan sekali dengan duplicate guard, kemudian dibuang. Canonical source dipulihkan dan dipush semula tanpa menghapuskan trigger. Tiada API executable deployment diwujudkan.

Controlled dry-run dan real `ACTION_REQUIRED` send bagi `OUT-20260820-234127-3513` mengesahkan classification, Telegram delivery, `RETURN_ACTION_REQUIRED_SENT` dan `ALREADY_SENT`. Natural run pertama pada `21 Aug 2026, 08:10:59` selesai dalam `21.761` saat dengan error rate dipaparkan `0%`; audit kekal 1037 dan tiada duplicate test notification. Idempotency tetap praktikal, bukan exactly-once transactional: Telegram delivery dan Sheet audit write tidak atomic, jadi delivery berjaya diikuti audit failure masih boleh menyebabkan retry duplicate secara teori.

```text
lifecycle:          MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
return urgency:     NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
notification audit: RETURN_REMINDER_SENT | RETURN_CRITICAL_SENT | RETURN_ACTION_REQUIRED_SENT
```

### Guardian Contact Shortcut — Fasa 6

Phase 6 menambah boundary akses contact yang sempit untuk Warden/HEP authenticated. Eligibility authoritative kekal pending/approved `KECEMASAN`, atau `KELUAR + CRITICAL/ACTION_REQUIRED`. `getOperationalTodayRecords` menghapuskan `telefon_waris`, `hubungan_waris` dan `nama_waris` daripada broad projection; hanya Warden menerima `guardian_contact_available` yang dihitung backend.

`getGuardianContact` ialah POST authenticated dan tidak berada pada public GET. Endpoint membaca semula request, mengira semula urgency dan mengesahkan eligibility sebelum disclosure. Telefon dinormalisasi kepada URI `tel:` yang selamat. Successful retrieval memerlukan audit `GUARDIAN_CONTACT_ACCESSED` dengan context `EMERGENCY_REQUEST`, `CRITICAL_RETURN` atau `ACTION_REQUIRED_RETURN`; audit tidak mengandungi phone/relation, dan kegagalan audit fail-closed. Source nama penjaga tidak wujud, jadi projection detail menggunakan nama kosong dan UI memaparkan `Tidak direkodkan`.

Frontend hanya merender shortcut apabila boolean availability yang selamat diterima; transport string `"true"` dinormalisasi tetapi nilai lain ditolak. Approved/risk membership menerima display status approved atau raw lifecycle `DILULUSKAN_WARDEN`, tanpa membaca `warden_approve_by`. Oleh itu `AUTO_CONFIG_V2` dan human-approved emergency berkongsi section read-only, sementara pending sorting Fasa 3, Guard checkout dan No-Guard fallback kekal berasingan.

Fasa 6 tidak menambah schema, lifecycle, global approval rule, trigger, Telegram cadence, threshold, Script Property atau automatic outbound contact. Emergency priority kekal operational ordering; auto-approval hanya berlaku apabila `OUTING_TYPES.require_warden_approval=false`.

### Dynamic Student Login dan Student Group Configuration

Backend membina direktori login melalui `getStudentLoginDirectory`. Public projection setiap Pelajar hanya `student_id` + `nama`; `no_matrik` tidak dihantar dan kekal input authentication bersama `student_id` terhadap row `STUDENTS` authoritative. Visual group ialah presentation/login grouping sahaja: kelas kanonik A2/A3/LI tidak berubah.

`STUDENT_GROUPS` dan `LI_INSTITUTIONS` menentukan kumpulan aktif serta susunan. Bagi LI, `STUDENTS.institution_code` authoritative; prefix `LIUMK-`/`LIUPM-` hanya digunakan semasa migration dan tidak dirujuk untuk grouping runtime. Config invalid atau feature disabled fallback selamat kepada direktori legacy. Activation dan rollback dikawal Admin dengan readiness guard.

### Current Hostel Residents

Presence diturunkan setiap refresh daripada Pelajar aktif dan authoritative current lifecycle: hanya `KELUAR` bermaksud di luar. Tiada presence flag, cache jangka panjang atau `IN_HOSTEL` source of truth. `getCurrentHostelSummary` ialah GET aggregate-only; `getCurrentHostelRoster` ialah POST authenticated bagi Admin, Warden/HEP dan Guard, dengan projection nama minimum.

Grouping roster menggunakan login directory/config yang sama, tetapi core presence calculation tidak bergantung pada `institution_code`, prefix ID atau label group. Public UI tidak pernah menerima hidden resident names.

### Google Sheets

Google Sheets ialah database dan source of truth. Tab utama:

- `STUDENTS`
- `WARDENS`
- `GUARDS`
- `OUTING_REQUESTS`
- `AUDIT_LOG`
- `OUTING_TYPES` — source authoritative konfigurasi outing production
- `ADMIN_USERS` — identiti Admin private
- `STUDENT_GROUPS` — konfigurasi kumpulan login/presentation
- `LI_INSTITUTIONS` — konfigurasi institusi LI

Semua field masa sahaja yang keluar daripada Sheet (`masa_balik_dijangka`, `fixed_return_time`, `application_open_time`, `application_close_time`, `earliest_departure_time`) melalui normalisasi backend kanonik kepada `HH:mm` menggunakan `Asia/Kuala_Lumpur`. Frontend mempunyai pertahanan kecil untuk payload legacy 1899, tanpa menambah atau menolak offset masa secara manual.

### Notis Banner

Notis tunggal disimpan dalam Script Properties sebagai teks, status aktif, status penting, masa kemas kini dan identiti Admin. Property yang belum wujud dinormalisasikan sebagai banner tidak aktif; simpanan Admin pertama mengisinya secara automatik. Tiada setup property manual dan tiada sheet `ANNOUNCEMENTS`.

`getAnnouncementBannerAdmin` serta `updateAnnouncementBanner` memerlukan credential Admin; mutation dicatat sebagai `UPDATE_ANNOUNCEMENT_BANNER`. `getAnnouncementBanner` mengesahkan sesi Student, Warden/HEP, Guard atau Admin dan hanya memulangkan projection aktif yang selamat. Tiada action banner pada router GET awam. Nama Script Property, secret dan `updated_by` tidak dipulangkan kepada viewer biasa. Teks dibatasi panjangnya, disimpan sebagai plain text dan dirender melalui `textContent`, maka HTML/script tidak dilaksanakan.

Frontend meletakkan banner di dalam `appWorkspace`, bukan pada landing/Public Pemantauan. Normal menggunakan label `MAKLUMAN`; Important menggunakan `PENTING`. Dua salinan visual menghasilkan ticker kiri berterusan yang perlahan bagi setiap banner aktif; salinan kedua `aria-hidden`, dengan ruang sebelum ulangan dan tanpa `<marquee>`. Gerakan boleh dijeda melalui hover, fokus papan kekunci atau sentuhan dan dimatikan untuk `prefers-reduced-motion`; tinggi banner kekal stabil.

Konfigurasi banner tidak dibaca oleh resolver outing dan tidak boleh mengubah business rule. Contohnya, notis “Pulang Bermalam dibenarkan keluar mulai jam 2.00 petang.” tidak mengubah `earliest_departure_time`; Admin masih perlu mengubah `Tetapan Outing > Pulang Bermalam > Masa Keluar Paling Awal`.

Dalam workspace Pelajar, banner ialah notis operasi semasa manakala `ruleNotice` kuning ialah panduan sistem kontekstual. Ayat panduan pendua di bawah tajuk “Permohonan Pelajar” telah dibuang tanpa mengubah kedua-dua elemen atau borang.

v1.7.0 menambah lima header selfie secara idempotent melalui `setupSelfieProofV170()` dan mengekalkan `selfie_whatsapp` sebagai kolum legacy.

Foto profil menambah `photo_file_id` dan `photo_updated_at` pada `STUDENTS` secara idempotent melalui `setupStudentProfilePhotos()`. Fail profil berada dalam folder private berasingan dan tidak berkongsi lifecycle atau Telegram side effect selfie.

Fasa 2 eOuting v2.0 menambah `setupAdminOutingConfigV200()` untuk mencipta dua tab staging, meluaskan `AUDIT_LOG` secara additive dan seed lima jenis outing semasa. Script Property `OUTING_CONFIG_V2_ENABLED` diwujudkan dengan default `false`.

Fasa 3 menambah backend authentication dan API konfigurasi tanpa menambah UI Admin atau menukar `submitRequest`. Public config menggunakan GET read-only, manakala login, admin read dan semua write menggunakan POST dengan credential Admin pada setiap request.

Rekod Fasa 4 asal menambah role dan Dashboard Admin pada frontend ketika credential masih memory-only dan Student form masih hard-coded. Keadaan itu ialah sejarah implementasi, bukan architecture production semasa; session restore dan rendering config-driven diterangkan di bawah.

Fasa 4.6 menetapkan satu sahaja canonical `apiPost` frontend. Router ini memintas lima action Admin hanya dalam `?mock=1`; selain itu ia menghantar POST `no-store` ke GAS dan menyerahkan semua response kepada `parseApiResponse`. Duplicate dead declaration dibuang tanpa mengubah payload atau call site.

Fasa 5A memuatkan public `GET getOutingTypes` hanya selepas sesi Pelajar dibuka. Dropdown, visibility, required/disabled state, `same_day_only` dan `fixed_return_time` dirender daripada safe config. Kegagalan atau response kosong menggunakan lima legacy config dalam memory; `submitRequest` GAS dan feature flag default tidak berubah.

Foundation departure-rule menambah `departure_allowed_days` dan `earliest_departure_time` pada `OUTING_TYPES` sedia ada. Ia tidak mencipta modul polisi kedua. Generic date window, `allowed_days` serta application time window mengawal masa permohonan; blank date/time fields bermaksud tiada threshold bagi medan itu tanpa melemahkan restriction lain. Explicit empty-string update membersihkan cell Sheet supaya blank ialah state tersimpan sebenar. Medan departure mengawal tarikh keluar yang diminta dan masa paling awal Guard boleh mengesahkan keluar. Enforcement production kini membaca row aktif kerana `OUTING_CONFIG_V2_ENABLED=true`.

Readiness hardening menambah POST Admin-only `getOutingConfigReadiness`. Ia membaca `OUTING_TYPES` tanpa mencipta atau mengubah sheet dan tidak mendedahkan property atau credential. Tetapan Outing memaparkan chip `Config Active`, `Legacy` atau `Config Issue` dengan sebab not-ready yang accessible; tiada control activation. Label config digunakan oleh Student, Telegram, statistik, Rekod Master, filter Admin, Checklist/filter Warden, label kontekstual dan return-selfie eligibility. `require_warden_approval=false` menghasilkan state `DILULUSKAN_WARDEN`, approver `AUTO_CONFIG_V2`, masa approval dan audit `AUTO_APPROVE_REQUEST` yang eksplisit.

### Config-driven Outing dan Jenis Custom

Konfigurasi jenis terpilih ialah source of truth frontend untuk visibility, required/disabled state dan payload `tarikh`, `tarikh_balik` serta `masa_balik_dijangka`. Tarikh paparan dinormalisasi kepada `YYYY-MM-DD`; `fixed_return_time` mengatasi input pengguna apabila ditetapkan. Jenis custom tidak memerlukan branch berdasarkan type code jika requirement boleh dinyatakan melalui `OUTING_TYPES`.

Jenis production `KLINIK` (`Keluar ke Klinik`) ialah contoh: same-day, tiada input tarikh keluar/balik manual, tetapi masa balik dijangka, lokasi, kenderaan, kelulusan Warden dan selfie diperlukan. UI custom menggunakan `Maklumat Tambahan`; tajuk `Maklumat Pulang Bermalam` kekal khusus untuk `PULANG_BERMALAM`. `earliest_departure_time` kosong bermaksud tiada sekatan masa paling awal. Readiness menolak kombinasi bercanggah seperti `departure_allowed_days` berisi sedangkan `require_leave_date=false`.

### Admin Session Restore

Login Admin dan restore berkongsi pembina payload `{ admin_id: identity, nama_admin: identity, pin }`. Rekod tab minimum `{ identity, pin, expiresAt }` disimpan dalam `sessionStorage` melalui key `eouting_admin_session_v1`; expiry ialah 12 jam absolute dan tidak ditulis semula ketika refresh. PIN Admin tidak masuk `localStorage`, dan sessionStorage tidak dianggap bukti authentication tanpa POST `loginAdmin` ke backend.

Bootstrap memeriksa saved Admin session, menunjukkan loader restore, menjalankan revalidation, membina semula `adminRuntimeCredential`, kemudian mengaktifkan shell. Ia tidak menunggu `getStudents`, `getWardens`, `getGuards` atau `getTodayRecords` terlebih dahulu. Default Admin section dimulakan selepas auth dan section lain dimuat secara lazy apabila dibuka; Tetapan Outing tidak lagi dimuat unconditional semasa restore.

Loader authentication yang sama meliputi login/restore Pelajar, Warden, Guard dan Admin. Operation token menghalang kerja lama menyembunyikan loader operasi lebih baharu; success, failure dan logout membersihkannya. Animasi CSS Clay-style menghormati `prefers-reduced-motion`, dan Public Pemantauan tidak menggunakan loader authenticated ini.

```text
Production v2.2.0: config-driven rendering + validation + dynamic consumers
Configuration:     OUTING_TYPES authoritative; Admin Tetapan Outing
Feature flag:      OUTING_CONFIG_V2_ENABLED=true; readiness Ready
```

## Boundary API

### Public GET

`GET getStudents` memulangkan direktori login minimum:

```text
student_id | nama | kelas
```

`GET getTodayRecords` memulangkan Public Monitoring minimum:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

`GET getOutingStats` memulangkan kiraan agregat sahaja. Ia tidak memulangkan row mentah, leaderboard individu, nama atau nombor matrik.

`GET getOutingTypes` memulangkan projection konfigurasi yang selamat. Selagi feature flag bukan `true`, ia memulangkan lima konfigurasi legacy daripada code. Apabila flag `true`, hanya row aktif dipulangkan mengikut `sort_order`; metadata version/audit/Admin tidak didedahkan.

`GET getStudentLoginDirectory` memulangkan kumpulan login dengan Pelajar minimum `student_id` + `nama`; `no_matrik`, contact dan raw `institution_code` tidak dipulangkan.

`GET getCurrentHostelSummary` memulangkan aggregate total dan breakdown kumpulan selamat sahaja, tanpa nama atau identifier Pelajar.

### Authenticated POST

`POST getTodayRecords` mengesahkan credential sebenar dan boleh menyertakan nested `operational_urgency` yang role-safe:

- Pelajar: `student_id` + `no_matrik`, kemudian hanya rekod pelajar itu dipulangkan.
- Warden: nama Warden + PIN, kemudian rekod operasi penuh dipulangkan.
- Guard: nama Guard + PIN, kemudian rekod operasi penuh dipulangkan.

Jika credential operasi hilang atau salah, request gagal secara terkawal. Frontend tidak fallback kepada GET awam.

`POST getStudentAnnualSummary` mengesahkan Pelajar aktif menggunakan `student_id` + `no_matrik`. Satu set row `SELESAI` bagi tahun semasa menjadi sumber bersama bagi `total_outings` dan `history_records`, jadi kiraan dan senarai tidak boleh menggunakan scope berlainan. Setiap item sejarah hanya mengandungi:

```text
tarikh | jenis_permohonan | status
```

Row disusun paling baharu dahulu. Data tujuan, lokasi, kenderaan, approval, Guard, waris dan selfie tidak termasuk dalam response ini.

Action write lain kekal melalui POST:

- `submitRequest`
- `cancelStudentRequest`
- `approveRequest`
- `rejectRequest`
- `confirmOut`
- `confirmIn`
- `submitReturnSelfie`
- `loginAdmin`
- `getAdminOutingTypes`
- `createOutingType`
- `updateOutingType`
- `toggleOutingType`
- `getCurrentHostelRoster` — read authenticated untuk Admin, Warden/HEP dan Guard; projection Pelajar hanya `nama`

Admin action mengesahkan `admin_id` atau `nama_admin` bersama PIN aktif pada setiap request. Create/update/toggle menggunakan `LockService`. Update dan toggle memerlukan `expected_config_version`; mismatch menghasilkan `CONFIG_VERSION_CONFLICT`.

## Aliran Data Utama

```text
Pelajar login -> submitRequest -> OUTING_REQUESTS
  -> Telegram permohonan
Pelajar login/Refresh Status -> POST getTodayRecords -> Status Semasa live/current
Pelajar login/Refresh Status -> POST getStudentAnnualSummary
  -> jumlah tahunan + Rekod Outing Saya daripada scope SELESAI tahun semasa yang sama
Pelajar login -> cancelStudentRequest -> DIBATALKAN_PELAJAR
  -> AUDIT_LOG + satu notifikasi Telegram non-blocking
Warden login -> POST getTodayRecords -> approve/reject
  -> Telegram keputusan
Guard login -> POST getTodayRecords -> confirmOut/confirmIn
  -> Telegram pergerakan
Pelajar login -> compress 3:4 -> submitStudentProfilePhoto -> STUDENTS metadata
Student/Warden/Guard/Admin -> POST getStudentProfilePhotos photo_variant=thumbnail (batch authenticated)
  -> Drive API v3 thumbnailLink server-side -> OAuth fetch -> safe thumbnail data URI
Authorised thumbnail click -> POST getStudentProfilePhotos photo_variant=full (one student)
  -> thumbnail/loading modal -> full stored image -> authenticated session cache
Pelajar selepas confirmIn -> kamera/preview/compress -> submitReturnSelfie
  -> LockService -> Drive private -> Telegram sendPhoto -> metadata Sheet
Public Monitoring -> GET getTodayRecords -> mapPublicMonitoringRecord
```

### Pembatalan Permohonan Pelajar

Pembatalan ialah transition generik berdasarkan status, bukan jenis outing. Semua jenis standard, `KLINIK` dan jenis custom config-driven menggunakan action POST `cancelStudentRequest` yang sama. Pelajar hanya boleh membatalkan rekod sendiri ketika status authoritative ialah `MENUNGGU_KELULUSAN` atau `DILULUSKAN_WARDEN`; sebab 5–500 aksara di-trim dan disahkan semula oleh backend.

Di dalam `ScriptLock`, backend membaca semula row authoritative, menyemak pemilikan dan status, kemudian menukar rekod tanpa delete kepada `DIBATALKAN_PELAJAR` serta menyimpan sebab, masa dan aktor `PELAJAR`. Status ini terminal/non-active: ia tidak menghalang permohonan baharu, tidak memasuki queue Warden/Guard, tidak dianggap sedang keluar dan tidak dikira sebagai outing selesai/berjaya. Approval/rejection Warden dan `confirmOut` Guard turut melakukan revalidation di bawah lock; jika Guard lebih dahulu menukar status kepada `KELUAR`, cancellation gagal dan tidak boleh menimpa state itu.

Selepas transaksi atomic serta audit `CANCEL_STUDENT_REQUEST` selesai, satu notifikasi Telegram dihantar untuk kedua-dua previous status yang dibenarkan. Mesej menggunakan label status mesra pengguna dan mengandungi nama, nombor matrik, jenis, sebab serta masa. Telegram ialah side effect non-blocking: hasil false atau exception hanya dilog sebagai warning, tanpa rollback atau cubaan pendua.

`getOperationalTodayRecords` menambah hanya `has_profile_photo` dan masa kemas kini. Selepas kad operasi dirender dengan placeholder, frontend membuat satu batch `thumbnail` bagi ID unik yang diperlukan. GAS mengesahkan viewer pada setiap request, menyelesaikan file private, mendapatkan `thumbnailLink` melalui Drive API v3 dan memuat turun thumbnail dengan OAuth server-side. Browser tidak menerima file ID, URL Drive, `thumbnailLink` atau token. Cache thumbnail/full, negative entry, single-flight dan version guard adalah berasingan. Kegagalan thumbnail mengekalkan initials tanpa fallback bulk kepada imej 600×800.

Klik thumbnail membuat satu request `full` untuk pelajar itu sahaja jika full-image cache belum tersedia. Modal memaparkan thumbnail/loading dahulu, kemudian menggantikannya dengan imej stored-compressed; pembukaan kedua menggunakan cache sesi. Kegagalan full menunjukkan error/retry selamat. Student editor boleh menggunakan imej penuh sendiri. Hanya thumbnail sebenar ialah button; initials kekal inert. `getTodayRecords` awam kekal pada projection enam medan tanpa metadata atau trigger foto.

## Status Bukti Selfie

Status lifecycle utama tidak berubah:

```text
confirmIn -> status = SELESAI
```

State bukti disimpan secara berasingan:

```text
selfie_status = BELUM_HANTAR
  -> submitReturnSelfie berjaya -> SUDAH_HANTAR
ATAU selfie_status = TIDAK_DIPERLUKAN
```

Rekod lama tanpa `selfie_status` kekal boleh dibaca. Rekod `SELESAI` yang mempunyai `masa_masuk` tetapi tiada metadata selfie dianggap belum menghantar bukti. `LockService` meliputi semakan duplicate, simpanan Drive, penghantaran Telegram dan kemas kini Sheet. Jika transaksi separa gagal, fail Drive dan/atau mesej Telegram dibersihkan; selepas Sheet berjaya ditanda lengkap, kegagalan `AUDIT_LOG` tidak mengubah hasil.

## Status dan Paparan

Nilai lifecycle backend:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `DITOLAK_WARDEN`
- `DIBATALKAN_PELAJAR` — terminal/non-active, dipaparkan sebagai `Dibatalkan oleh Pelajar`
- `KELUAR`
- `SELESAI`

Helper pusat frontend membentuk paparan kontekstual tanpa mengubah nilai backend. Bagi `Status Semasa` Pelajar, lifecycle ini dirender berasingan daripada state authoritative `operational_urgency`:

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar untuk Outing Biasa/Outing Sabtu atau Ahad/Kecemasan
- 🌙 Sedang Bermalam untuk Pulang Bermalam
- 🏖️ Sedang Bercuti untuk Cuti Semester
- ✅ Sudah Pulang
- 🔴 Lewat, dengan precedence tertinggi

Status kosong atau tidak dikenali dipaparkan sebagai `Status Tidak Diketahui`; ia tidak dipetakan kepada `MENUNGGU_KELULUSAN`. Helper daypart BM menggunakan `01:00–11:59` Pagi, `12:00–12:59` Tengah Hari, `13:00–18:59` Petang dan `19:00–00:59` Malam. Formatter locale lain masih boleh menggunakan singkatan seperti `PTG`.

Kiraan dan filter operasi terus menggunakan nilai `record.status`, termasuk satu kiraan gabungan `KELUAR`.

## Warden dan Guard

Warden dan HEP berkongsi role operasi backend `warden`. Role paparan staff diperoleh daripada row WARDENS yang telah diautentikasi: `HEP-*` → `HEP`, `W-*` → `WARDEN`, ID legacy/tidak dikenali → `WARDEN`. Frontend tidak menentukan role ini. Nilai lifecycle kekal `DILULUSKAN_WARDEN`, manakala paparan, audit dan Telegram menggunakan label aktor yang diselesaikan. Mereka menerima rekod operasi penuh melalui POST authenticated untuk Dashboard, approve/reject dan Checklist Permohonan.

Guard menerima rekod operasi penuh melalui POST authenticated. Quick filter Guard ialah Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat, dan digunakan pada `Sedia Untuk Keluar` serta `Sedang Keluar`.

## Public Monitoring

Public Monitoring v1.6.25 sentiasa menggunakan GET awam khusus dan dirender inline dalam shell landing, walaupun sesi Warden/Guard wujud. Lifecycle menggunakan scroll sasaran, loading jelas dan single-flight guard. Satu response menghasilkan satu render; timestamp dan `monitorHasLoadedOnce` hanya dikemas kini selepas berjaya.

Paparan terdiri daripada:

- kad ringkasan status;
- `Senarai Status Semasa` dengan nama, kelas, jenis permohonan, ikon dan status kontekstual.

Tiada kad `Rekod Hari Ini`, quick filter monitoring atau seksyen pendua `Belum Pulang Ke Asrama`.

Public Monitoring tidak merender `profilePhotoMarkup`, data URI, thumbnail atau preview trigger.

## PWA dan Cache

Displayed version kekal konsisten pada `APP_VERSION`, footer dan `version.json`. Cache/asset source production semasa ialah `eouting-cache-v2.4.0-r20` dan query `2.4.0-r20`. Version 55 mengekalkan behavior production sedia ada; shared 20-second presence snapshot P0 berada dalam Version 56 yang di-HOLD dan tidak boleh dianggap live production.

Service worker tidak membaca atau menulis response API/GAS, external request atau imej selfie sensitif dalam Cache Storage. Semasa activate, cache lama eOuting dibuang dan client semasa dituntut. Static app shell kekal cacheable. Popup `Update Available` kekal bergantung pada flow update sedia ada.

## Submission Validation v2.0 — Fasa 5B

`submitRequest` kini mempunyai dua laluan backend yang dipilih hanya oleh Script Property:

```text
OUTING_CONFIG_V2_ENABLED !== "true"
  -> validator legacy v1.7.1 yang sedia ada

OUTING_CONFIG_V2_ENABLED === "true"
  -> resolve type_code case-insensitive daripada OUTING_TYPES
  -> sahkan row config secara ketat dan active
  -> validate tarikh, masa, hari dan field wajib di server
  -> duplicate check dan append/audit/Telegram sedia ada
```

Frontend tidak menentukan authorization atau validation akhir. Config yang dihantar client tidak dipercayai; resolver sentiasa membaca `OUTING_TYPES`. Sheet hilang, jenis hilang/inactive atau config malformed gagal tertutup. Feature flag production ialah `true`; rollback kepada validator legacy dilakukan dengan menetapkannya kepada `false` tanpa redeployment.

`confirmOut` turut menyemak tarikh keluar yang diluluskan, configured departure day dan earliest departure time. Policy error yang sepadan dipaparkan kepada Guard dalam wording Melayu yang diallowlist; network/internal error kekal generik dan stack detail tidak didedahkan.

Semakan active request serta append submission berada dalam satu `ScriptLock`. Status `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR` menghalang duplicate; `SELESAI`, `DITOLAK_WARDEN` serta `DIBATALKAN_PELAJAR` tidak. Frontend juga menggunakan satu in-flight lock dan loading feedback. Action approve/reject Warden serta confirm-out/confirm-in Guard mempunyai lock UI masing-masing untuk menolak klik berganda tanpa mengubah boundary backend.

Status awal `submitRequest` disahkan sebelum write. `appendObjectRow_` membina row daripada nama header sebenar pada Sheet, bukan kedudukan object, kemudian submission membaca semula row persisted untuk mengesahkan status authoritative. Ini mengekalkan compatibility jika susunan header berbeza tanpa memperkenalkan schema atau lifecycle baharu.

## Operasi Admin

Shell Admin dan identiti sesi kekal visible apabila tujuh modul inline bertukar: `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`. Statistik menggunakan active-tab yang sama seperti modul lain dan tidak lagi mempunyai workspace atau butang kembali berasingan.

Pemantauan Admin menggunakan satu POST `getAdminMonitoring` untuk KPI, rekod operasi aktif dan nested urgency authoritative. KPI operational dan queue `Perlu Tindakan` dibina daripada normalized dataset yang sama pada setiap refresh. Queue menggunakan presentation ordering sahaja dan tidak menulis priority ke backend. Rekod Master menggunakan satu POST `searchAdminMasterRecords` dengan carian, filter dan pagination maksimum 50 rekod. Statistik individu menggunakan `getAdminIndividualStats` selepas credential Admin disahkan. Pengurusan staff menggunakan `getAdminStaff` serta write `createStaff`, `updateStaff` dan `toggleStaffStatus`; semua endpoint memanggil `validateAdminCredentials_()`.

`WARDENS` dan `GUARDS` kekal source of truth serta login Warden/Guard sedia ada terus membaca PIN dari tab masing-masing. Write staff dilindungi `LockService`; tiada model authentication atau sheet baharu diperkenalkan.

## UI Runtime Safeguards

Login Pelajar, Warden/HEP, Guard dan Admin serta editor Admin yang selamat menggunakan submit form sedia ada apabila Enter ditekan pada input satu baris. Tiada handler Enter global; textarea kekal newline dan action operasi/destructive memerlukan button/confirmation explicit. Lock disabled/loading sedia ada mencegah duplicate submission.

KPI yang sesuai menggunakan count-up kira-kira 450 ms daripada nilai lama kepada integer akhir tepat. Nilai tidak berubah tidak replay, `prefers-reduced-motion` memintas animasi, dan identifiers, tarikh, masa, telefon, pagination serta duration string tidak dianimasikan.
