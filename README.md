# eOuting ITU

eOuting ITU ialah sistem digital untuk merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas.

Versi repo semasa: **v2.4.0 — Production Verified**.

- Frontend/PWA: [GitHub Pages](https://itumelaka.github.io/eouting/)
- Backend: Google Apps Script (GAS) Web App
- Database: Google Sheets
- Notifikasi: Telegram Bot melalui GAS
- Repo: [itumelaka/eouting](https://github.com/itumelaka/eouting)

## Status Production v2.4.0

Frontend production v2.4.0 diterbitkan melalui GitHub Pages di [https://itumelaka.github.io/eouting/](https://itumelaka.github.io/eouting/) dan menggunakan endpoint GAS production sedia ada.

Revision aset frontend semasa ialah `2.4.0-r6` dan service worker menggunakan `eouting-cache-v2.4.0-r6`.

Backend production semasa menggunakan GAS **Version 51**, Spreadsheet `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg` dan endpoint `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`. Frontend kanonik kekal `https://itumelaka.github.io/eouting/`. Manifest Web App kanonik ialah timezone `Asia/Kuala_Lumpur`, runtime `V8`, `executeAs=USER_DEPLOYING` dan `access=ANYONE_ANONYMOUS`; access anonymous ini ialah akses transport API, bukan kuasa aplikasi tanpa authentication. `OUTING_CONFIG_V2_ENABLED=true` telah aktif sejak 10 Ogos 2026 dan `OUTING_TYPES` ialah source authoritative bagi peraturan outing yang disokong. `gas/Code.gs` ialah source GAS executable kanonik dan `.claspignore` mengehadkan push kepada `gas/Code.gs` serta `gas/appsscript.json`. Snapshot lama `gas/Code.production-v171.gs` bukan source kanonik dan tidak boleh dideploy.

Production yang disahkan sehingga 22 Ogos 2026 meletakkan `Status Semasa` Pelajar di atas borang sebagai kawasan authoritative bagi rekod aktif serta tindakan batal/selfie yang layak. Bahagian bawah mengandungi `Refresh Status`, jumlah outing tahunan dan `Rekod Outing Saya` dalam baris kompak. Jumlah dan sejarah menggunakan skop authenticated yang sama: hanya rekod `SELESAI` bagi tahun semasa, disusun paling baharu dahulu. Foundation Operational Urgency Fasa 1 telah dilengkapkan melalui commit `dde1fc4`; Student Live Status Clarity Fasa 2 melalui `89d6b46`; Warden Approval Prioritisation + Emergency Mode Fasa 3 melalui `5443375`; Admin Operational Intelligence + `Perlu Tindakan` Fasa 4 melalui `d0be685`; Telegram Return Reminder + Late Escalation Scanner Fasa 5 melalui `54d526b`; dan Guardian Contact Shortcut Fasa 6 melalui `9c16f47` bersama hardening `0caa4fc`, `67d493c`, `3e21c26` dan `4c16b0a`. Fasa 1–6 kini lengkap dan production verified. No-Guard Departure kekal sambungan operasi selepas Fasa 5. Full Node baseline kanonik semasa ialah **490/490 lulus**.

## No-Guard Departure — sambungan operasi selepas Fasa 5

Flow Guard biasa kekal laluan utama: `DILULUSKAN_WARDEN -> Guard Sahkan Keluar -> KELUAR`. Jika Guard tidak tersedia dan `NO_GUARD_DEPARTURE_ENABLED` diaktifkan, Pelajar bagi mana-mana request yang layak boleh memilih `Mohon Pengesahan Keluar`; ciri ini tidak terhad kepada kelas atau jenis outing tertentu. Permintaan hanya menulis audit `DEPARTURE_CONFIRMATION_REQUESTED`, mengekalkan lifecycle `DILULUSKAN_WARDEN`, menghantar satu amaran Telegram kepada Warden/HEP dan memaparkan keadaan menunggu. Pelajar tidak pernah self-checkout.

Warden yang authenticated melihat queue `Menunggu Pengesahan Keluar` dan melakukan pengesahan akhir. Di bawah `ScriptLock`, backend membaca semula rekod secara authoritative, menukar `DILULUSKAN_WARDEN -> KELUAR`, menetapkan `masa_keluar`, membiarkan `guard_keluar_by` kosong dan menulis `WARDEN_REMOTE_CHECKOUT` dengan actor role `WARDEN` serta mode `REMOTE_NO_GUARD`. Guard-first menghalang fallback kemudian; Warden-first menghalang transition keluar Guard kedua. Tiada status lifecycle atau kolum `OUTING_REQUESTS` baharu.

Admin mengawal feature gate melalui `Tetapan Outing -> Fallback Pengesahan Keluar Tanpa Guard -> Aktifkan fungsi ON/OFF`. Safe default ialah `false`: property hilang, malformed atau selain nilai tepat `"true"` bermaksud disabled. Keadaan production pada close-out ini berbeza: `NO_GUARD_DEPARTURE_ENABLED` kini **ON**. Admin hanya mengawal konfigurasi dan tidak memperoleh kuasa remote checkout. Apabila OFF, request baharu dan confirmation fallback disekat tetapi audit lama kekal; pending unresolved menjadi actionable semula selepas ciri diaktifkan kembali.

Request baharu menghantar satu mesej `🚪 PENGESAHAN KELUAR TANPA GUARD` dengan nama Pelajar, label jenis, lokasi, masa request, arahan Warden dan URL eOuting. Audit request ialah kuasa dedup: repeated pending request tidak menambah audit atau Telegram. Delivery gagal tidak membatalkan pending state dan belum mempunyai retry automatik. Selepas Warden checkout dan audit/flush berjaya, Version 50 menghantar satu mesej `✅ PENGESAHAN KELUAR OLEH WARDEN` dengan Pelajar, jenis, lokasi, nama Warden, `masa_keluar`, status `KELUAR` dan URL eOuting. Kegagalan mesej completion tidak rollback lifecycle/audit dan tidak retry; replay juga tidak menghantar semula.

Backend constant `EOUTING_APP_URL` menunjuk `https://itumelaka.github.io/eouting/`. URL ini ditambah pada submission outing baharu termasuk kecemasan, request No-Guard, reminder Phase 5 `DUE_SOON`, escalation `CRITICAL`/`ACTION_REQUIRED`, dan confirmation Warden remote checkout. Ini bukan perubahan kepada semua mesej Telegram: approval/rejection lifecycle sahaja, cancellation Pelajar dan movement Guard biasa tidak dinyatakan sebagai menerima URL secara automatik.

Version 49 request Telegram telah disahkan secara visual di production. Version 50 telah berjaya dideploy dan dilindungi automated tests, tetapi mesej completion Warden belum direkod sebagai telah disahkan secara visual dalam production.

Commit `d30d8d9` menambah grid responsif khusus pada senarai operasi Guard: approved/sedia keluar, sedang keluar/menunggu masuk dan overnight belum pulang. Ketiga-tiganya menggunakan satu kolum di bawah `820px` dan dua kolum sama lebar mulai `820px`. Verifikasi browser production pada 20 Ogos 2026 (`window.innerWidth = 1707`) menunjukkan computed columns `570px 570px`, posisi kad berselang sekitar `270px`/`852px` dan lebar kad sekitar `570px`, maka kad tidak merentasi kedua-dua kolum. Rendering JavaScript Guard, hook `Sah Keluar`/`Sah Masuk`, backend, GAS, schema dan business rules tidak berubah.

`Rekod Outing Saya` menerima hanya `tarikh`, `jenis_permohonan` dan `status` daripada response ringkasan tahunan. Tujuan, lokasi, kenderaan, approval, Guard, waris dan data selfie tidak dihantar. `Status Semasa` di bahagian atas terus menggunakan rekod operasi live/current dan tidak mengambil data daripada sejarah tahunan.

Landing awam menggunakan empat kad kompak dalam grid 2×2 pada desktop/tablet: `Pelajar`, `Warden & HEP`, `Guard` dan `Pemantauan Semasa`. Pada skrin kecil ia menggunakan susunan satu kolum. Akses Admin kekal sebagai control kompak berasingan. Public Statistik telah dibuang; `Pemantauan Semasa` dibuka inline dalam shell landing dan kekal tanpa foto profil.

Admin turut mempunyai `Notis Banner` untuk satu makluman operasi global pada satu masa. Admin boleh menetapkan teks, `Penting`, `Aktif`, menyimpan perubahan dan melihat keadaan semasa, timestamp serta identiti pengemas kini. Konfigurasi disimpan dalam Script Properties; property yang belum wujud bermaksud banner tidak aktif dan simpanan Admin pertama mengisinya secara automatik. Tiada sheet `ANNOUNCEMENTS` atau setup Script Property manual diperlukan.

Pelajar, Warden/HEP, Guard dan Admin yang telah disahkan menerima projection selamat melalui POST `getAnnouncementBanner`; Admin menggunakan `getAnnouncementBannerAdmin` dan `updateAnnouncementBanner`. Mutation memerlukan authentication Admin dan direkod sebagai `UPDATE_ANNOUNCEMENT_BANNER`. Public landing serta Public Pemantauan tidak memanggil atau menerima banner. Nama property/secret dan `updated_by` tidak didedahkan kepada viewer biasa. Teks mempunyai had panjang, dirender sebagai plain text dan HTML/script tidak dilaksanakan.

Mod Normal berlabel `MAKLUMAN`, manakala mod Important berlabel `PENTING`. Kedua-duanya menggunakan ticker kiri berterusan yang perlahan dan mudah dibaca, dengan ruang sebelum ulangan serta tanpa `<marquee>`. Hover, fokus papan kekunci dan interaksi sentuh boleh menjeda gerakan; `prefers-reduced-motion` memaparkan teks statik. Susun atur stabil dan kekal mudah dibaca pada mobile.

Banner ialah komunikasi sahaja. Contohnya, teks “Pulang Bermalam dibenarkan keluar mulai jam 2.00 petang.” tidak mengubah `earliest_departure_time`. Admin mesti mengemas kini `Admin > Tetapan Outing > Pulang Bermalam > Masa Keluar Paling Awal` secara berasingan jika enforcement sebenar hendak berubah.

Dalam workspace Pelajar, Announcement Banner menyampaikan notis operasi semasa, manakala `ruleNotice` kuning kekal authoritative untuk panduan peraturan kontekstual. Ayat panduan pendua di bawah “Permohonan Pelajar” telah dibuang; banner, `ruleNotice` dan borang outing kekal.

## Operational Urgency Foundation — Fasa 1

Backend kini mempunyai satu resolver sasaran pulang dan evaluator operational urgency yang authoritative untuk rekod aktif `KELUAR`. Lifecycle seperti `KELUAR` dan `SELESAI` kekal berasingan daripada urgency. State urgency ialah `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL` dan `ACTION_REQUIRED`:

| Jarak daripada masa dijangka pulang | Urgency |
|---|---|
| Lebih 30 minit sebelum | `NORMAL` |
| 0–30 minit sebelum, termasuk tepat masa | `DUE_SOON` |
| Selepas masa dijangka hingga kurang 30 minit lewat | `LATE` |
| 30 hingga kurang 60 minit lewat | `CRITICAL` |
| 60 minit lewat atau lebih | `ACTION_REQUIRED` |

Sasaran pulang mengutamakan snapshot `tarikh_balik + masa_balik_dijangka` bagi semua jenis, termasuk jenis custom/config-driven seperti `KLINIK`; data valid tidak lagi tersalah menggunakan fallback 22:00. Fallback tarikh hari sama dan 22:00 hanya dikekalkan bagi rekod legacy harian yang wajar. Rekod aktif dengan timing malformed atau tidak lengkap menerima diagnosis `needs_review=true`, bukan dianggap normal.

`confirmIn()` menggunakan resolver yang sama untuk menyimpan fakta sejarah `lewat` sebagai `Ya` atau `Tidak`. Bagi timing yang benar-benar indeterminate ketika pengesahan masuk, keputusan konservatif ialah `lewat=Ya`; perkara ini kekal known limitation untuk semakan polisi masa hadapan.

Projection operasi authenticated bagi Pelajar, Warden/HEP, Guard dan Admin boleh menerima objek nested `operational_urgency`. Urgency dihitung selepas source row dibaca daripada cache operasi 20 saat dan tidak dicache sebagai state. Public Monitoring kekal pada allowlist enam medan dan tidak menerima masa tepat, kiraan minit, transition, action code atau diagnostic urgency. Tiada schema baharu diperlukan.

Pada close-out Fasa 1, foundation ini belum mempunyai UI urgency Pelajar, priority sorting Warden, dashboard intelligence Admin, reminder/escalation Telegram berjadual atau shortcut guardian.

## Student Live Status Clarity — Fasa 2

Commit `89d6b46` (`feat: improve student live outing status`) melengkapkan presentation Student bagi urgency yang dibina dalam Fasa 1. `Status Semasa` menggunakan nested `operational_urgency` daripada backend dan menyokong `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL`, `ACTION_REQUIRED` serta `needs_review=true`. Lifecycle kekal kelihatan sebagai konsep berasingan; contohnya, rekod boleh mempunyai `status=KELUAR` dan urgency `CRITICAL` pada masa yang sama. Urgency tidak menggantikan lifecycle.

Frontend Pelajar tidak mengira threshold atau menukar state urgency sendiri. GAS kekal authoritative untuk state, `expected_return_at` dan `next_transition_at`. Frontend hanya memformat masa pulang dijangka—masa sahaja bagi rekod hari sama, tarikh dan masa bagi rekod kemudian/bermalam—serta mengemas kini teks tempoh seperti `Kurang 1 minit`, `24 minit` atau `1 jam 42 minit` daripada `expected_return_at`. Apabila `next_transition_at` dilepasi, timer refresh Pelajar 30 saat yang sedia ada meminta status authoritative baharu; transition key menghalang refresh transition pendua dan tiada timer Pelajar kedua atau request bertindih ditambah.

Wording lama Pelajar yang hard-coded “pulang sebelum 10:00 malam” telah dibuang. UI tidak membaca semula `OUTING_TYPES` untuk mereka sasaran pulang; snapshot request/backend kekal authoritative. Jika metadata urgency hilang, malformed atau `needs_review=true`, Pelajar melihat panduan selamat `MAKLUMAT WAKTU PULANG PERLU DISEMAK` tanpa countdown atau state lewat rekaan.

Flow `SELESAI`, pembatalan, return-selfie, ringkasan/sejarah tahunan, foto profil, Announcement Banner/`ruleNotice`, authentication dan privacy boundary sedia ada dikekalkan. Fasa 2 tidak menambah Warden priority sorting, emergency priority configuration/mode, KPI urgency Admin atau `Perlu Tindakan`, Telegram timed reminder/escalation, GAS time-driven trigger, shortcut guardian/waris, schema/threshold backend, version bump atau deployment. Semua itu kekal kerja Fasa 3+.

## Warden Approval Prioritisation + Emergency Mode — Fasa 3

Commit `5443375` (`feat: prioritize warden emergency approvals`) melengkapkan susunan kerja approval Warden tanpa menambah lifecycle state. Rekod pending disusun mengikut bucket: (1) kecemasan, (2) masa keluar dalam 30 minit atau telah tiba, kemudian (3) pending biasa. Dalam setiap bucket, `masa_mohon` yang sah disusun paling lama menunggu dahulu; rekod tanpa timestamp yang boleh digunakan menyusul dengan fallback ordering yang deterministic/stable. Sorting ini hanya untuk kerja approval Warden.

Keserasian kecemasan kekal `jenis_permohonan === KECEMASAN` dan dipusatkan untuk prioritisation Warden. Ia mempengaruhi ordering, penegasan visual dan panduan kontekstual sahaja; ia tidak secara sendiri auto-approve, memintas kuasa Warden atau Guard, atau menukar lifecycle. Peraturan config generik sedia ada kekal authoritative: jika sesuatu jenis mempunyai `require_warden_approval=false`, flow `AUTO_CONFIG_V2` boleh meluluskannya secara automatik. Fasa 3 tidak memperkenalkan atau mengubah behavior generik itu.

Bagi pending bukan kecemasan, priority departure menggunakan `earliest_departure_time`, tarikh request authoritative dan zon masa Malaysia. Timing hilang atau malformed tidak menghasilkan priority rekaan. Backend mengutamakan nilai request-carried yang boleh digunakan; nilai semasa `OUTING_TYPES` hanya fallback compatibility pada cloned projection Warden authenticated. Fallback itu tidak ditulis semula ke `OUTING_REQUESTS` atau mana-mana Sheet dan tidak meluaskan projection Student, Guard, Admin atau Public.

Known limitation: request tanpa snapshot departure pada tahap request boleh ditafsir menggunakan `OUTING_TYPES.earliest_departure_time` semasa ketika dipaparkan kepada Warden. Perubahan config selepas submission boleh mengubah priority fallback-only, manakala request yang sudah membawa masa request-level yang sah kekal stabil. Snapshot departure per request ialah pertimbangan schema/version masa hadapan, bukan sebahagian Fasa 3.

Kad Warden authenticated boleh memaparkan cue kompak seperti `Kecemasan`, `Perlu perhatian segera`, `Masa keluar hampir tiba` atau `Masa keluar telah tiba`, bersama fakta/prosedur dan butiran kecemasan/waris yang memang telah dibenarkan. Approve/reject, validation rejection, actor approval, transition lifecycle, kuasa Guard, checklist semester/overnight, filter/counter serta UI Student/Guard/Admin/Public kekal. Layout disahkan pada mobile sekitar 390px tanpa overflow dan desktop 1280×720. Pada close-out Fasa 3, Admin operational intelligence/`Perlu Tindakan` masih belum dilaksanakan; fungsi itu kini dilengkapkan dalam Fasa 4 tanpa mengubah kuasa Warden.

## Admin Operational Intelligence + Perlu Tindakan — Fasa 4

Commit `d0be685` (`feat: add admin operational intelligence`) melengkapkan lapisan intelligence dalam Pemantauan Admin menggunakan nested `operational_urgency` authoritative daripada backend. Frontend tidak mengelaskan semula threshold. KPI semasa ialah:

| KPI Admin | Definisi |
|---|---|
| `Sedang Di Luar` | Semua lifecycle `KELUAR`, tanpa mengira urgency |
| `Hampir Waktu Pulang` | `KELUAR + DUE_SOON` |
| `Lewat` | `KELUAR + LATE` sahaja |
| `Kritikal` | `KELUAR + CRITICAL` |
| `Tindakan Segera` | `KELUAR + ACTION_REQUIRED` |
| `Perlu Semak Masa` | Rekod operasi aktif dengan `needs_review=true` |
| `Kecemasan Menunggu` | `MENUNGGU_KELULUSAN + KECEMASAN` |

Kategori urgency adalah mutually exclusive; `Sedang Di Luar` ialah jumlah lifecycle keseluruhan dan boleh overlap. Queue `Perlu Tindakan` memasukkan, mengikut priority: `ACTION_REQUIRED`, `CRITICAL`, active `needs_review`, kemudian pending `KECEMASAN`. `NORMAL`, `DUE_SOON`, ordinary `LATE`, pending bukan kecemasan dan rekod terminal/completed dikecualikan.

Dalam bucket `ACTION_REQUIRED` dan `CRITICAL`, `minutes_late` lebih besar didahulukan. Selepas itu ordering menggunakan timestamp request/submission sah paling lama, rekod bertimestamp sebelum timestamp hilang, stable request identifier dan source position sebagai tie-breaker akhir. Susunan ini presentation frontend sahaja dan tidak dipersist.

Kad operasi menggunakan label BM `Tindakan Segera`, `Kritikal`, `Semak Data Masa` dan `Kecemasan Menunggu`, serta hanya memaparkan maklumat Student/matrik yang sudah dibenarkan, lifecycle, jenis request, expected return, tempoh dan guidance ringkas. Metadata urgency malformed atau contradictory tidak menghasilkan state rekaan; review hanya dipaparkan apabila backend memberi `needs_review=true`. Tiada data waris baharu, shortcut waris atau phone button ditambah.

Pending emergency dalam Admin ialah intelligence sahaja: Admin tidak meluluskan request, tidak memintas Warden, tidak mengubah `require_warden_approval` dan tidak memperoleh authority approval baharu. Refresh Pemantauan Admin sedia ada digunakan semula; KPI dan queue dibina daripada normalized dataset yang sama selepas response authoritative, tanpa polling agresif atau urgency engine kedua.

Browser verification repository dilakukan pada desktop `1280×720` dan mobile `390×844`: tiada horizontal overflow, label KPI tidak terpotong, queue menjadi satu kolum pada mobile, empat kategori kad muat, raw machine code/waris tidak kelihatan dan navigation/filter Admin kekal usable. Ini bukan tuntutan deployment production berasingan.

Empat dimensi kekal berasingan:

```text
Lifecycle:                MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
Warden approval priority: EMERGENCY -> DEPARTURE_APPROACHING/REACHED -> ORDINARY
Return urgency:           NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
Admin action queue:       ACTION_REQUIRED -> CRITICAL -> NEEDS_REVIEW -> PENDING_EMERGENCY
```

`MENUNGGU_KELULUSAN + emergency approval priority`, `KELUAR + CRITICAL return urgency` dan keahlian queue Admin ialah konsep berasingan. Pada close-out Fasa 4, reminder/escalation Telegram masih future; scanner kemudian dilengkapkan sebagai milestone repo Fasa 5 pada 20 Ogos dan di-deploy/diaktifkan pada 21 Ogos tanpa mengubah pemisahan konsep tersebut.

## Telegram Return Reminder + Late Escalation Scanner — Fasa 5

Commit `54d526b` (`feat: add telegram return escalation scanner`) menambah entry point backend-only `scanReturnOperationalNotifications_(options)`. Scanner hanya menilai lifecycle `KELUAR` melalui `getOperationalUrgency_(record, now)` authoritative daripada Fasa 1; ia tidak mempunyai timing/urgency engine kedua dan tidak menggunakan historical `lewat` sebagai classifier aktif.

Stage notification dan audit mapping adalah tepat:

```text
DUE_SOON        -> RETURN_REMINDER_SENT
CRITICAL        -> RETURN_CRITICAL_SENT
ACTION_REQUIRED -> RETURN_ACTION_REQUIRED_SENT
```

`NORMAL`, ordinary `LATE`, `needs_review=true`, timing invalid/hilang, lifecycle bukan `KELUAR`, request ID hilang/duplicate dan same-stage event yang sudah diaudit dikecualikan. Event peringatan terdahulu tidak menghalang `RETURN_CRITICAL_SENT`, dan event kritikal tidak menghalang `RETURN_ACTION_REQUIRED_SENT`.

Setiap stage dibatch sehingga maksimum 40 rekod atau 3,500 aksara per mesej; kumpulan lebih besar dipecah secara deterministic. `DUE_SOON` disusun earliest `expected_return_at` dahulu, manakala `CRITICAL`/`ACTION_REQUIRED` menggunakan greatest `minutes_late` dahulu, kemudian request ID dan source position. Mesej tidak mengandungi telefon/hubungan waris, selfie URL/metadata, diagnostic/action code mentah atau token/config Telegram.

Dedup menggunakan `AUDIT_LOG`: `request_id + stage event` disemak sebelum send, dan SENT event hanya ditulis bagi setiap request selepas batch Telegram berjaya. Seluruh read/classify/dedup/send/audit flow berjalan dalam existing `ScriptLock`. Telegram gagal tidak menukar request, lifecycle atau urgency dan tidak menulis successful SENT audit, maka scan masa hadapan boleh retry.

Ini ialah practical idempotency, bukan transactional exactly-once. Telegram dan Google Sheets tidak boleh berada dalam satu atomic transaction; jika Telegram berjaya tetapi write `AUDIT_LOG` gagal, state `SENT_AUDIT_PARTIAL` boleh dilaporkan dan retry kemudian secara teori boleh menghantar duplicate.

Preview maintenance selamat tersedia melalui wrapper public parameterless:

```javascript
runReturnOperationalNotificationsDryRun()
```

Wrapper ini hard-coded kepada `scanReturnOperationalNotifications_({ dryRun: true })`, tidak menerima caller input, tidak didedahkan melalui `doGet`/`doPost` atau frontend dan tidak boleh bertukar kepada non-dry mode. Dry-run membaca source, menilai eligibility, menyemak audit dan membina ordered/bounded preview tanpa menghantar Telegram, menulis SENT audit, mengubah request row atau memasang trigger.

Fasa 5 kini live melalui tepat satu time-driven trigger setiap lima minit yang menyasarkan private `scanReturnOperationalNotifications_`, bukan wrapper dry-run. Trigger ID ialah `9156626915782557696`. Scanner dipanggil tanpa options, maka scheduled execution menggunakan normal non-dry production mode. Installer idempotent sementara digunakan kerana nama private berakhir dengan `_` dan tidak selectable dalam Add Trigger UI; ia menolak duplicate, tidak menjalankan scanner/Telegram atau memadam trigger, kemudian dibuang bersama temporary tests selepas trigger berjaya dicipta. Canonical source dipulihkan dan trigger kekal hidup.

Controlled production dry-run pada `2026-08-20T23:49:09+08:00` mengelaskan `OUT-20260820-234127-3513` sebagai `ACTION_REQUIRED` dan membina satu PREVIEW batch dengan `dry_run=true`, zero send/failure/audit write serta trigger count masih sifar. Satu controlled real send kemudian menghantar tepat satu mesej `TINDAKAN SEGERA DIPERLUKAN` bagi rekod itu. Delivery disahkan pengguna; `RETURN_ACTION_REQUIRED_SENT` ditulis pada `2026-08-21 07:27:40 +08:00`, `AUDIT_LOG` meningkat tepat 1036 → 1037 dan semakan same-stage memulangkan `ALREADY_SENT` tanpa send kedua.

Trigger natural pertama berjalan pada `21 Aug 2026, 08:10:59`, selesai dalam `21.761` saat dengan displayed error rate `0%`. `AUDIT_LOG` kekal 1037, tiada notifikasi baharu diperhatikan dan test request kekal mempunyai tepat satu `RETURN_ACTION_REQUIRED_SENT`. Ini ialah production proof bagi audit-backed dedup, bukan jaminan transactional exactly-once.

Deployment sync menyelesaikan mismatch production yang nyata: sebelum sync, latest Apps Script HEAD/dry-run mengelaskan test request sebagai `ACTION_REQUIRED`, tetapi deployed PWA masih memaparkan `MAKLUMAT WAKTU PULANG PERLU DISEMAK`. Selepas Version 46, Student dan Admin bersetuju pada lifecycle `KELUAR`, urgency `ACTION_REQUIRED`, expected return `2026-08-20 22:00` dan queue Admin `Perlu Tindakan -> Tindakan Segera`. Puncanya ialah Web App deployed menyajikan code revision lebih lama daripada latest Apps Script source, bukan data corruption.

Browser production selepas Version 46 disahkan pada desktop `1280×720` dan mobile `390×844`: Student status/urgency/expected return, Warden approve/reject, Guard confirm-out/confirm-in, Admin urgency KPI/queue dan Public Monitoring privacy boundary kekal berfungsi. Tiada horizontal overflow atau browser console error diperhatikan.

Repository/local browser verification pada viewport mobile kira-kira 425px mengesahkan Student, Warden, Guard, Admin dan Public Monitoring masih load tanpa visible regression atau horizontal overflow. Tiada scanner route dalam `assets/app.js`, `index.html`, `doGet` atau `doPost`; browser tidak boleh memanggil scanner. Notification submission, approval/rejection, pergerakan Guard, cancellation dan return-selfie `sendPhoto` sedia ada kekal tidak berubah.

Dimensi semasa kekal berasingan:

```text
Lifecycle:          MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI
Return urgency:     NORMAL -> DUE_SOON -> LATE -> CRITICAL -> ACTION_REQUIRED
Notification audit: RETURN_REMINDER_SENT | RETURN_CRITICAL_SENT | RETURN_ACTION_REQUIRED_SENT
```

Notification audit ialah sejarah delivery/dedup, bukan lifecycle atau urgency. Fasa 6 tidak mengubah cadence Telegram, threshold Fasa 5, trigger schedule atau notification-state schema. Direct Student/WhatsApp/email notification, Admin acknowledgement, notification observability jangka panjang dan channel tambahan kekal kerja masa hadapan.

## Guardian Contact Shortcut — Fasa 6

Fasa 6 berstatus **COMPLETE / PRODUCTION VERIFIED** pada 22 Ogos 2026. Warden/HEP authenticated melihat `📞 Hubungi Penjaga` bagi pending atau approved `KECEMASAN`, serta rekod `KELUAR` dengan urgency authoritative `CRITICAL` atau `ACTION_REQUIRED`. Broad Warden projection hanya membawa `guardian_contact_available`; `telefon_waris` dan `hubungan_waris` dibuang daripada list payload. Butiran sebenar hanya diperoleh melalui POST authenticated `getGuardianContact`, selepas Warden aktif disahkan, rekod dibaca semula dan urgency dinilai semula. Retrieval berjaya menulis `GUARDIAN_CONTACT_ACCESSED` dengan context `EMERGENCY_REQUEST`, `CRITICAL_RETURN` atau `ACTION_REQUIRED_RETURN`; telefon/hubungan tidak ditulis ke audit dan audit failure menghalang disclosure.

UI memaparkan butiran hanya selepas fetch, kemudian menyediakan `📞 Telefon Sekarang` menggunakan normalisasi `tel:` yang selamat. Source data ialah `OUTING_REQUESTS.telefon_waris` dan `OUTING_REQUESTS.hubungan_waris`; tiada source nama penjaga, maka UI menggunakan `Tidak direkodkan`. Tiada WhatsApp/SMS automation atau outbound contact automatik.

`require_warden_approval=false` kekal auto-approval config-driven yang sah: `AUTO_CONFIG_V2` menghasilkan lifecycle `DILULUSKAN_WARDEN` tanpa approval manusia. Smoke production menemui kad ini tidak muncul di section approved/risk walaupun backend dan projection sudah betul. Commit `4c16b0a` membolehkan membership frontend mengenali lifecycle authoritative `DILULUSKAN_WARDEN` tanpa bergantung pada actor. Rekod kini berada di `Telah Diluluskan / Risiko Pulang`, bukan `Menunggu Kelulusan`; tiada approval kedua, Guard kekal checkout authority dan No-Guard kekal fallback sahaja.

Fix sokongan production ialah `0caa4fc` untuk menerima hanya boolean `true` atau transport string `"true"` bagi availability flag tanpa membina eligibility local; `67d493c` untuk mengosongkan `fixed_return_time` melalui Admin dengan blank round-trip; dan `3e21c26` untuk label Student: `PULANG_BERMALAM` → `Maklumat Pulang Bermalam`/`Tarikh Keluar`, `CUTI_SEMESTER` → `Maklumat Cuti Semester`/`Tarikh Mula Cuti`, `KECEMASAN` → `Maklumat Tarikh Keluar`/`Tarikh Keluar`, fallback → `Maklumat Permohonan`/`Tarikh Keluar`. Perubahan label dan clear UI tidak mengubah backend, config atau business rules.

## Architecture Ringkas

```text
Browser / PWA di GitHub Pages
  -> Google Apps Script Web App
    -> Google Sheets
    -> Google Drive (foto profil dan bukti selfie dalam folder private berasingan)
    -> Telegram Bot
    -> AUDIT_LOG
```

Frontend mengurus paparan, kamera dan pemampatan gambar. GAS menguatkuasakan login, permission tindakan, lifecycle rekod dan penghantaran bukti. Google Sheets ialah source of truth, manakala Google Drive menyimpan selfie secara private. Kegagalan Telegram untuk notifikasi biasa tidak membatalkan tindakan utama; bagi bukti selfie, simpanan Drive, penghantaran `sendPhoto` dan kemas kini Sheet dilindungi dengan cleanup transaksi separa.

## Role

- **Pelajar:** pilih nama, masukkan nombor matrik, hantar permohonan dan lihat rekod sendiri.
- **Warden/HEP:** berkongsi role operasi backend `warden`, login nama + PIN, refresh rekod, approve/reject, guna Checklist Permohonan dan salin senarai nama. Role paparan staff diperoleh daripada `WARDENS.warden_id`: `HEP-*` ialah HEP, `W-*` ialah WARDEN dan ID legacy/tidak dikenali fallback kepada WARDEN. Lifecycle kelulusan kekal `DILULUSKAN_WARDEN`.
- **Guard:** login nama + PIN, lihat `Sedia Untuk Keluar` dan `Sedang Keluar`, kemudian sahkan keluar/masuk.
- **Admin:** login ID/nama + PIN, urus modul operasi/config, dan memulihkan sesi tab secara selamat selepas refresh melalui revalidasi backend.
- **Public Monitoring read-only:** lihat ringkasan dan `Senarai Status Semasa` tanpa tindakan operasi.

## Jenis Permohonan

- `OUTING_BIASA`
- `OUTING_HUJUNG_MINGGU`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Semua jenis menggunakan aliran utama yang sama:

```text
Pelajar hantar permohonan
  -> Warden luluskan atau tolak (legacy dan config require_warden_approval=true)
     ATAU auto-approve beridentiti AUTO_CONFIG_V2 (config require_warden_approval=false)
  -> Guard sahkan keluar
  -> Guard sahkan masuk
  -> status utama kekal SELESAI
  -> Pelajar hantar bukti selfie jika diwajibkan
```

Frontend membina medan serta payload daripada konfigurasi jenis yang dipilih. `require_leave_date`, `require_return_date`, `require_return_time`, `fixed_return_time`, `same_day_only`, lokasi, kenderaan dan requirement lain menentukan nilai `tarikh`, `tarikh_balik` serta `masa_balik_dijangka`; tarikh dinormalisasi kepada `YYYY-MM-DD`. Jenis custom baharu tidak patut memerlukan branch frontend hard-coded.

Jenis custom production `KLINIK` dipaparkan sebagai **Keluar ke Klinik**. Ia ialah outing hari sama tanpa input tarikh keluar/balik manual, memerlukan masa balik dijangka, lokasi, kenderaan, kelulusan Warden dan selfie pulang. Ruang dinamik menggunakan tajuk neutral `Maklumat Tambahan`; `PULANG_BERMALAM` mengekalkan `Maklumat Pulang Bermalam`. Nilai `earliest_departure_time` kosong bermaksud tiada had masa keluar paling awal dan boleh dikosongkan Admin melalui `Kosongkan`.

Submission Pelajar mempunyai lock in-flight frontend dan loading feedback. Di backend, semakan active request serta append berlaku secara atomic di bawah `ScriptLock`; `MENUNGGU_KELULUSAN`, `DILULUSKAN_WARDEN` dan `KELUAR` menghalang duplicate, manakala `SELESAI` serta `DITOLAK_WARDEN` membenarkan permohonan baharu. Approve/reject Warden dan confirm-out/confirm-in Guard turut mempunyai perlindungan klik berganda semasa action berjalan.

Status awal `submitRequest` disahkan sebelum persistence. `appendObjectRow_` memetakan nilai mengikut susunan header sebenar `OUTING_REQUESTS`, kemudian row dibaca semula untuk mengesahkan status authoritative. Status kosong/tidak dikenali tidak lagi dipaparkan sebagai pending palsu; UI menggunakan `Status Tidak Diketahui`.

Pelajar boleh membatalkan rekod sendiri yang masih `MENUNGGU_KELULUSAN` atau `DILULUSKAN_WARDEN` melalui `Batal Permohonan`. `Sebab Batal Permohonan` wajib diisi, di-trim dan mestilah 5–500 aksara pada frontend serta backend. Rekod tidak dipadam: action `cancelStudentRequest` menukarnya secara atomic kepada status terminal/non-active `DIBATALKAN_PELAJAR` (`Dibatalkan oleh Pelajar`), menyimpan sebab/masa/aktor, memindahkannya ke sejarah dan membenarkan permohonan baharu. Flow ini status-driven untuk jenis standard, `KLINIK` dan semua jenis custom config-driven. Setiap pembatalan berjaya menghantar satu notifikasi Telegram yang mengandungi status terdahulu secara mesra pengguna; kegagalan Telegram hanya diberi amaran dan tidak menggagalkan pembatalan.

Konfigurasi production membezakan dua konsep:

- **Peraturan permohonan:** `allowed_days`, `application_open_time` dan `application_close_time` menentukan bila pelajar boleh menghantar permohonan.
- **Peraturan keluar:** `departure_allowed_days` dan `earliest_departure_time` menentukan hari serta masa paling awal pelajar yang diluluskan boleh keluar secara fizikal.

Admin boleh menggunakan butang `Kosongkan` untuk membuang masa permohonan dibuka atau ditutup. Nilai kosong kekal kosong dan bermaksud tiada threshold masa bagi medan tersebut; jika kedua-duanya kosong, permohonan tidak dihadkan oleh masa tetapi `allowed_days` tetap dikuatkuasakan. Nilai kosong tidak ditukar kepada `00:00`, `12:00` atau masa semasa.

Untuk `PULANG_BERMALAM`, pelajar boleh memohon pada mana-mana hari, tetapi tarikh keluar yang diminta kini mesti hari Jumaat dan masa keluar paling awal pada row production ialah `17:00`. Nilai masa ini ialah konfigurasi operasi yang boleh diubah oleh Admin melalui Tetapan Outing mengikut arahan semasa HEP; ia bukan polisi kekal yang hard-coded.

Nilai masa sahaja daripada Google Sheets — termasuk `masa_balik_dijangka`, `fixed_return_time`, `application_open_time`, `application_close_time` dan `earliest_departure_time` — dinormalkan di GAS kepada `HH:mm` menggunakan `Asia/Kuala_Lumpur` sebelum dihantar kepada frontend atau Telegram. Ini mengelakkan tarikh epoch 1899, offset sejarah dan peralihan masa; contoh `2026-08-16` + `22:00` kini dipaparkan sebagai `16 Ogos 2026, 10:00 PTG`. Formatter locale generik masih boleh menggunakan singkatan seperti `PTG`.

Helper klasifikasi waktu BM berkongsi sempadan rasmi eOuting: `01:00–11:59` Pagi, `12:00–12:59` Tengah Hari, `13:00–18:59` Petang dan `19:00–00:59` Malam. Pernyataan ini menerangkan klasifikasi helper, bukan mendakwa semua timestamp locale memaparkan perkataan penuh tersebut.

## Bukti Pulang Asrama v1.7.0

Dalam production config-driven, `require_selfie` ialah authoritative dan disnapshot pada rekod semasa submission: `false` menggunakan `TIDAK_DIPERLUKAN`, manakala `true` menjadi `BELUM_HANTAR` selepas `confirmIn`.

- `OUTING_BIASA`
- `OUTING_HUJUNG_MINGGU`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Selepas `confirmIn`, status utama rekod kekal `SELESAI` dan `selfie_status` menjadi state bukti yang berasingan. Pelajar melihat `Ambil Selfie & Lapor Pulang`, menggunakan kamera depan jika disokong, menyemak preview, mengambil semula jika perlu dan menghantar gambar. Frontend mengecilkan sisi terpanjang kepada kira-kira 1280px dan memampatkan kepada JPEG sebelum memanggil `submitReturnSelfie`.

Backend menyemak pemilikan melalui `student_id` + `no_matrik`, status `SELESAI`, kewujudan `masa_masuk`, MIME/base64 dan duplicate submission. Gambar disimpan secara private dalam folder Drive `eOuting - Bukti Selfie Pulang` dan dihantar sebagai imej sebenar ke Telegram melalui `sendPhoto`. Public Monitoring tidak menerima URL, file ID, nombor matrik atau metadata selfie.

Tetapan Outing ialah interface operasi bagi `OUTING_TYPES`. Status readiness dipaparkan sebagai chip kompak dan accessible: `Config Active`, `Legacy` atau `Config Issue`; sebab kegagalan kekal boleh dibuka apabila tidak ready. Production semasa ialah **Config Active · Ready**. Tiada toggle feature flag pada UI.

Jenis aktif dan label config-driven digunakan secara dinamik oleh borang/label Pelajar, Telegram, grouping/filter Statistik, filter Admin, filter/Checklist Warden, label outing kontekstual dan eligibility return-selfie. Konfigurasi aktif tetap mesti lulus readiness validation; jenis custom tidak dianggap selamat tanpa ujian.

Semasa `confirmOut`, GAS menyemak tarikh keluar yang diluluskan, hari keluar yang dibenarkan dan `earliest_departure_time`. Kegagalan polisi dipaparkan kepada Guard dalam wording Melayu yang selamat; error network/internal kekal generik tanpa stack detail. Smoke test 10 Ogos 2026 mengesahkan permohonan untuk 14 Ogos 2026 tidak boleh disahkan keluar pada 10 Ogos 2026 dan Guard menerima maklum balas tarikh yang jelas.

## Foto Profil Pelajar

Pelajar berautentikasi boleh menambah atau mengganti foto profil sendiri. Frontend menerima JPEG, PNG atau WebP sehingga 2 MB, memotong paparan tengah kepada nisbah 3:4 dan mengecilkan kepada maksimum kira-kira 600×800 sebelum menghantar JPEG termampat. Metadata private disimpan pada `STUDENTS.photo_file_id` dan `STUDENTS.photo_updated_at`; base64 tidak disimpan dalam Sheet.

Tindakan foto profil membuka action sheet `Ambil Foto`, `Pilih dari Galeri` dan `Batal`. Kamera menggunakan `accept="image/*"` bersama `capture="user"` untuk mengutamakan kamera depan apabila disokong; galeri menggunakan input berasingan tanpa `capture`. Kedua-duanya masuk ke pipeline validation, crop, compression, upload dan cache yang sama. Return-selfie kekal workflow berasingan.

Satu foto aktif dimaksudkan bagi setiap pelajar. Semasa replacement, fail baharu dicipta dan metadata Sheet di-commit/flush dahulu; hanya selepas itu fail lama yang disahkan berada dalam folder profil ditrash. Admin boleh membuang foto melalui tindakan confirmed berautentikasi.

Warden/HEP, Guard dan Admin mengambil foto kompak melalui satu POST batch berautentikasi dengan `photo_variant = "thumbnail"`. GAS mengesahkan viewer dahulu, mendapatkan `thumbnailLink` melalui Drive API v3 dan memuat turun thumbnail menggunakan OAuth Apps Script pada server. Browser hanya menerima data URI imej selamat; file ID, URL Drive, `thumbnailLink` dan token tidak pernah dipulangkan. API operasi hanya membawa indikator `has_profile_photo`; Public Monitoring dan semua GET awam tidak menerima foto atau metadata foto. Fail berada dalam folder private `eOuting - Foto Profil Pelajar` yang ditetapkan melalui `PROFILE_PHOTO_FOLDER_ID`.

Thumbnail sebenar boleh dibuka sebagai preview besar oleh Pelajar sendiri, Warden/HEP, Guard dan Admin yang telah dibenarkan. Jika imej penuh belum dicache, modal menunjukkan thumbnail/loading kemudian membuat satu request `photo_variant = "full"` untuk pelajar tersebut sahaja. Imej penuh menggantikan thumbnail dan dicache sepanjang sesi; pembukaan kedua tidak membuat request semula. Kegagalan menunjukkan retry selamat. Placeholder initials tidak boleh diklik. Modal menyokong butang tutup, klik backdrop, kekunci Escape, scroll lock dan pemulangan fokus.

Backend menyimpan nilai status asal seperti `KELUAR`. Frontend memaparkan label kontekstual:

| Keadaan | Paparan UI |
|---|---|
| Menunggu kelulusan | 🟡 Menunggu Kelulusan |
| Diluluskan | 🟢 Diluluskan |
| `OUTING_BIASA` / `OUTING_HUJUNG_MINGGU` / `KECEMASAN` + `KELUAR` | 🚶 Sedang Keluar |
| `PULANG_BERMALAM` + `KELUAR` | 🌙 Sedang Bermalam |
| `CUTI_SEMESTER` + `KELUAR` | 🏖️ Sedang Bercuti |
| Sudah pulang | ✅ Sudah Pulang |
| Lewat | 🔴 Lewat |

Paparan lewat legacy tidak menggantikan lifecycle backend. Dalam Student Live Status Fasa 2, urgency juga tidak menggantikan lifecycle; contoh `status=KELUAR` bersama urgency `CRITICAL` mengekalkan kedua-dua nilai.

## Public Monitoring v1.6.25

Sekali tekan `Pemantauan Semasa`, frontend membukanya inline dalam shell landing dan:

1. mengaktifkan workspace dan menyembunyikan workspace lain;
2. scroll ke permulaan workspace;
3. menunjukkan loading;
4. membuat satu GET awam `getTodayRecords`;
5. memetakan response awam dan merender sekali;
6. mengemas kini timestamp hanya selepas berjaya.

Single-flight guard menghalang klik, refresh manual dan auto-refresh daripada menghasilkan request bertindih. Refresh gagal mengekalkan data lama. Paparan dipadatkan kepada kad ringkasan dan `Senarai Status Semasa`; `Rekod Hari Ini`, quick filter rekod terperinci dan seksyen pendua `Belum Pulang Ke Asrama` telah dibuang.

Setiap baris memaparkan nama sebenar, kelas, jenis permohonan, ikon dan label status kontekstual.

## Boundary Privasi

Public GET `getTodayRecords` hanya mengembalikan enam medan:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Ia tidak mengembalikan `student_id`, `no_matrik`, `request_id`, e-mel, telefon, waris, lokasi, tujuan, kenderaan, PIN, credential, foto profil, Drive ID atau metadata operasi dalaman.

Rekod operasi penuh untuk Pelajar, Warden dan Guard menggunakan POST authenticated yang berasingan. Tiada fallback daripada kegagalan POST operasi kepada data GET awam. Public Monitoring kekal read-only.

Direktori awam `getStudents` pula hanya mengembalikan `student_id`, `nama` dan `kelas`; nombor matrik ditaip berasingan dan disemak terus oleh backend semasa login.

## Guard Quick Filter

Dashboard Guard menggunakan satu filter aktif pada satu masa:

- Semua
- Outing Harian
- Pulang Bermalam
- Cuti Semester
- Kecemasan
- Lewat

Filter digunakan pada kedua-dua seksyen Guard dengan empty-state kontekstual. `Kecemasan` tidak dicampurkan dengan Outing Harian.

## Development dan Test

Jalankan frontend secara local:

```powershell
python -m http.server 8080
```

Jalankan keseluruhan suite:

```powershell
node --test tests/*.test.js
```

Baseline repo kanonik semasa selepas Phase 6 close-out ialah **490/490 lulus**. Focused Phase 5 suite `tests/telegram-return-notifications-phase5.test.js` ialah milestone **15/15 lulus**. Temporary installer verification pernah mencapai **17/17 focused** dan **446/446 full**, tetapi test sementara telah dibuang dan angka itu bukan baseline semasa. Focused Phase 4 suite `tests/admin-operational-intelligence-phase4.test.js` kekal milestone **9/9 lulus**. Regression Guardian Contact/visibility dilindungi oleh `tests/guardian-contact-shortcut-phase6.test.js` dan `tests/guardian-contact-smoke-patch-phase6.test.js`; No-Guard kekal dilindungi oleh suite khususnya. Syntax checks:

```powershell
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw | node --check -
```

## Modul Operasi Admin v2.2.0

Login Admin menyimpan credential minimum `{ identity, pin, expiresAt }` dalam `sessionStorage` tab di bawah key `eouting_admin_session_v1`, dengan absolute expiry 12 jam yang tidak dilanjutkan oleh refresh. PIN tidak ditulis ke `localStorage`. Refresh memanggil semula `loginAdmin` menggunakan semantic payload yang sama seperti login biasa sebelum shell privileged dipaparkan. Selepas sah, shell Admin muncul dahulu; default section dimuat dan tab lain lazy-load apabila dibuka.

Satu loader authentication/restore Clay-style digunakan oleh Pelajar, Warden, Guard dan Admin untuk login serta restore sebenar. Ia dibuang terus pada success, failure atau logout, menggunakan operation token untuk mengelakkan race, dan menghormati `prefers-reduced-motion`. Public Pemantauan kekal berasingan.

Dashboard Admin mengekalkan shell dan tujuh modul inline: `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`. Statistik tidak mempunyai workspace awam atau shell berasingan; agregat, filter bulan/tahun/kelas dan statistik individu hanya dimuat melalui sesi Admin. Rekod Master menyediakan carian/filter/pagination, Pemantauan ialah paparan operasi baca sahaja, dan jumlah outing tahunan turut dipaparkan kepada Pelajar. Endpoint Admin mengesahkan credential menggunakan `validateAdminCredentials_()` pada setiap permintaan.

Identiti staff kekal menggunakan tab `WARDENS` dan `GUARDS` sedia ada; tiada tab atau migration baharu diperlukan. Admin boleh menetapkan PIN semasa create atau reset melalui edit, tetapi PIN sedia ada tidak pernah dipulangkan ke frontend atau dimasukkan dalam audit. Perubahan staff direkod sebagai `CREATE_STAFF`, `UPDATE_STAFF`, `ACTIVATE_STAFF`, `DEACTIVATE_STAFF` dan `RESET_STAFF_PIN`.

KPI menggunakan animasi count-up halus kira-kira 450 ms daripada nilai sebelumnya kepada integer tepat. Nilai yang tidak berubah tidak dimainkan semula dan `prefers-reduced-motion` dihormati. Animasi tidak digunakan pada ID, tarikh, masa, telefon, pagination atau string tempoh.

Enter menghantar borang login Pelajar, Warden/HEP, Guard dan Admin serta borang tambah/edit Admin yang selamat. Handler menggunakan submit form sedia ada dengan lock disabled/loading; tiada shortcut Enter global. Enter dalam textarea kekal newline, manakala tindakan operasi atau destructive seperti approve, reject, sahkan keluar/masuk, reset PIN dan buang foto kekal explicit.

## Deployment Ringkas

Frontend-only:

1. selaraskan `APP_VERSION`, `version.json`, cache service worker, asset query strings dan footer;
2. jalankan test dan syntax checks;
3. commit dan push;
4. tunggu GitHub Pages dan semak versi live.

Backend GAS:

1. semak Git diff dan jalankan suite/syntax checks;
2. semak whitelist dengan `clasp show-file-status`;
3. commit dan push source yang telah disahkan;
4. jalankan `clasp push` secara manual;
5. jalankan setup helper hanya jika schema atau konfigurasi memerlukannya;
6. dalam Manage deployments pilih `New version` sambil mengekalkan URL production;
7. jalankan smoke test endpoint dan flow hujung-ke-hujung.

Rollout awal production v2.0.0 menggunakan GAS **Version 24**. Production v2.4.0 semasa ialah GAS **Version 51**, `OUTING_CONFIG_V2_ENABLED=true`, readiness hijau dan source frontend menggunakan cache `2.4.0-r6`. Version 44–50 kekal milestone sejarah sebelum Phase 6 Version 51. Rollback config-driven segera boleh dibuat dengan menetapkan property kepada `false`; ia mengembalikan laluan legacy tanpa code push atau GAS deployment.

Lihat dokumentasi lanjut dalam [`docs/`](docs/), khususnya [Architecture](docs/ARCHITECTURE.md), [Deployment](docs/DEPLOYMENT.md), [Security](docs/SECURITY.md) dan [Local Development](docs/LOCAL_DEV.md).
