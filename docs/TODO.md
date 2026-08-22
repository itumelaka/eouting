# TODO eOuting ITU

Senarai kerja semasa bagi repo **v2.4.0 / GAS Version 55 / cache `2.4.0-r17`** pada 22 Ogos 2026. Fasa 1–6, Generic Application Date Window, Student Groups, Dynamic Student Login, active-request form suppression, Current Hostel Residents dan Premium Institutional UI r13–r17 lengkap serta production verified. Baseline kanonik semasa ialah **656/656**; rekod fasa terdahulu dikekalkan sebagai sejarah selesai.

## Done / Completed

### Authenticated UI regression fix — 22 Ogos 2026

- [x] Pulihkan header/logo dan metadata tarikh, hari serta masa yang kompak selepas login untuk Student, Warden/HEP, Guard dan Admin.
- [x] Sembunyikan banner kuning `#ruleNotice` pada Student authenticated tanpa mengubah eligibility, validation atau submission behavior.
- [x] Baiki kontras label/helper text pada editor Admin yang cerah.
- [x] Jadikan sub-navigation Admin mobile content-sized, berjarak jelas, tidak membalut dan kekal horizontally scrollable.
- [x] Verifikasi visual browser/mobile berjaya; production source commit `996d9c0` telah dipush ke `main`.

### Premium Institutional UI r13–r17

- [x] Premium Institutional Access/Login UI lengkap; header akhir ialah `Masuk Sistem` dan `Sila pilih peranan anda.` tanpa label `PORTAL AKSES INSTITUSI`.
- [x] Student r14, Warden/HEP r15, Guard r16 dan Admin r17 dashboard refresh lengkap tanpa perubahan business behavior.
- [x] Student profile card disatukan kepada tepat satu thumbnail/identity card tanpa mengubah upload/update authorization.
- [x] Production smoke Access/Login, Student, Warden/HEP, Guard dan Admin berjaya; display v2.4.0, cache `2.4.0-r17`, service worker `eouting-cache-v2.4.0-r17`, GAS Version 55 dan **656/656**.
- [x] Broad UI Phase 2 ditutup sebagai frontend-only; tiada GAS deployment diperlukan.

### Student Groups, Dynamic Login dan Current Hostel Residents

- [x] Foundation serta Admin management `STUDENT_GROUPS` dan `LI_INSTITUTIONS`, termasuk config validation, optimistic versioning dan deactivation guards.
- [x] Tambah `STUDENTS.institution_code`; dry-run/apply migration production selesai dengan **19 written, 0 unmatched, 0 conflicts**.
- [x] Aktifkan Dynamic Student Login bagi A2, A3, LI UMK dan LI UPM; `institution_code` authoritative, prefix ID migration-only, authentication kekal `student_id` + `no_matrik`.
- [x] Sediakan guarded activation dan rollback `Kembali ke Login Legacy`; ordinary kumpulan/institusi baharu kini kerja operasi Admin, bukan development TODO.
- [x] Sembunyikan borang permohonan apabila canonical active request wujud tanpa mengubah duplicate protection backend.
- [x] Tambah Current Hostel Residents sebagai derived presence; public aggregate-only dan roster nama minimum untuk Admin/Warden/Guard authenticated.
- [x] Production verified pada milestone v2.4.0 / r12 / GAS Version 55 dengan **587/587**; nilai ini dikekalkan sebagai rekod sejarah sebelum UI r13–r17.

### Generic Application Date Window

- [x] Commit `76c6898` menambah `application_open_date`/`application_close_date` optional dan generik untuk semua `OUTING_TYPES`, dengan canonical `YYYY-MM-DD`, inclusive boundaries dan strict date/range validation.
- [x] `setupAdminOutingConfigV200()` production menambah AC/AD secara idempotent; row lama kekal blank, tiada auto-population dan tiada schema `OUTING_REQUESTS` change.
- [x] Admin date inputs save/reload, summary, `Kosongkan`, persistent blank, no-current-date fallback dan config-version increment disahkan production.
- [x] Student future-open smoke mencapai backend, ditolak sebelum persistence dengan mesej BM tepat dan tidak menambah row request.
- [x] Backend Malaysia-time kekal authoritative; date/day/time rules additive dan safe projection hanya membawa dua tarikh untuk guidance.
- [x] **COMPLETE / PRODUCTION VERIFIED** pada 22 Ogos 2026; milestone release v2.4.0 / r7 / GAS Version 52 / **501/501**.

### Phase 6 — Guardian Contact Shortcut

- [x] Commit `9c16f47` menambah shortcut Warden/HEP bagi pending/approved `KECEMASAN` serta `KELUAR + CRITICAL/ACTION_REQUIRED`.
- [x] Broad Warden projection membawa `guardian_contact_available` sahaja; raw telefon/hubungan kekal di belakang authenticated `getGuardianContact`, authoritative recheck dan audit fail-closed `GUARDIAN_CONTACT_ACCESSED`.
- [x] Commit `0caa4fc` menerima hanya boolean/string `true` bagi transport availability tanpa local eligibility reconstruction.
- [x] Commit `67d493c` membolehkan Admin mengosongkan `fixed_return_time` dan mengekalkan blank selepas reload.
- [x] Commit `3e21c26` memberi label date section Student yang tepat untuk Pulang Bermalam, Cuti Semester, Kecemasan dan fallback.
- [x] Commit `4c16b0a` memastikan auto-approved `AUTO_CONFIG_V2` emergency berada di approved/risk section berdasarkan `DILULUSKAN_WARDEN`, bukan actor, tanpa pending/approval kedua.
- [x] Student dan Warden/HEP production smoke berjaya; Guard/No-Guard, lifecycle, schema, trigger, Telegram cadence dan config semantics kekal.
- [x] Phase 6 **COMPLETE / PRODUCTION VERIFIED** pada 22 Ogos 2026; milestone release ketika close-out itu ialah v2.4.0 / r6 / GAS Version 51 / **490/490**.

### No-Guard Departure — sambungan operasi selepas Fasa 5

- [x] Commit `0dcafdc` menambah fallback generik ber-gate tanpa class/type restriction, self-checkout Student, Guard impersonation, lifecycle status atau kolum baharu.
- [x] Admin toggle `NO_GUARD_DEPARTURE_ENABLED` menggunakan safe default false; production kini ON, tetapi Admin tidak mendapat checkout authority.
- [x] `DEPARTURE_CONFIRMATION_REQUESTED` menjadi pending/dedup authority dan `WARDEN_REMOTE_CHECKOUT` merekod Warden actor/mode `REMOTE_NO_GUARD`; `guard_keluar_by` kekal blank.
- [x] Commit `ac929e5` memulihkan canonical manifest selepas failed Version 47 dan menambah regression bagi Admin auth, No-Guard ON/OFF serta dynamic A2/A3/LI fixtures.
- [x] Commit `64963de` / Version 49 menambah one-time request Telegram serta canonical operational eOuting links; live request/waiting UI/message telah disahkan.
- [x] Commit `1d750ab` / Version 50 menambah replay-safe Warden checkout completion Telegram; failure tidak rollback lifecycle dan full suite **465/465**.

### Telegram Return Reminder + Late Escalation Scanner — Fasa 5

- [x] Backend-only `scanReturnOperationalNotifications_()` menggunakan `getOperationalUrgency_()` authoritative dan hanya memilih `KELUAR + DUE_SOON/CRITICAL/ACTION_REQUIRED`.
- [x] Stage audit ialah `RETURN_REMINDER_SENT`, `RETURN_CRITICAL_SENT` dan `RETURN_ACTION_REQUIRED_SENT`; earlier event tidak menutup later escalation.
- [x] Batch maksimum 40 rekod/3,500 aksara dengan ordering deterministic mengikut expected return atau minutes late, request ID dan source position.
- [x] Existing `AUDIT_LOG` menyokong dedup same-stage; SENT event hanya ditulis selepas successful Telegram delivery.
- [x] Existing `ScriptLock` melindungi read/classify/dedup/send/audit sequence; send failure tidak mengubah request/lifecycle/urgency atau menulis SENT event.
- [x] Safe dry-run membina structured preview tanpa Telegram, SENT audit, request mutation atau trigger installation.
- [x] Practical exactly-once limitation direkod: Telegram success + audit failure boleh menghasilkan `SENT_AUDIT_PARTIAL` dan theoretical duplicate retry.
- [x] Existing lifecycle Telegram/sendPhoto dan Student/Warden/Guard/Admin/Public kekal; tiada frontend route, schema, destination/config, lifecycle atau urgency-threshold change.
- [x] Controlled production dry-run mengesahkan satu PREVIEW `ACTION_REQUIRED` tanpa Telegram/audit write.
- [x] Existing deployment diselaraskan in-place daripada actual pre-sync Version 45 kepada Version 46; ID, URL dan manifest behavior dikekalkan.
- [x] Satu controlled real `ACTION_REQUIRED` Telegram send berjaya dan pengguna mengesahkan tepat satu mesej diterima.
- [x] `RETURN_ACTION_REQUIRED_SENT` ditulis sekali dan same-stage dedup memulangkan `ALREADY_SENT` tanpa send kedua.
- [x] Tepat satu trigger `scanReturnOperationalNotifications_` setiap lima minit dipasang; temporary installer/tests dibuang selepas canonical source dipulihkan.
- [x] First natural trigger run completed pada `21 Aug 2026, 08:10:59` dalam `21.761` saat, tanpa audit atau notification duplicate.
- [x] Commit `54d526b` (`feat: add telegram return escalation scanner`); current focused suite **15/15**, full Node suite **444/444**. Temporary activation totals **17/17** dan **446/446** bukan baseline semasa.

### Admin Operational Intelligence + Perlu Tindakan — Fasa 4

- [x] KPI Admin operational merangkumi `Sedang Di Luar`, `Hampir Waktu Pulang`, `Lewat`, `Kritikal`, `Tindakan Segera`, `Perlu Semak Masa` dan `Kecemasan Menunggu` daripada dataset normalized yang sama.
- [x] Urgency KPI menggunakan exact backend state dan mutually exclusive; lifecycle `Sedang Di Luar` boleh overlap.
- [x] Queue `Perlu Tindakan` mengutamakan `ACTION_REQUIRED`, `CRITICAL`, active `needs_review`, kemudian pending `KECEMASAN`; ordinary `LATE`, `DUE_SOON`, `NORMAL`, pending bukan kecemasan dan terminal record dikecualikan.
- [x] Ordering lewat menggunakan `minutes_late` descending, kemudian oldest timestamp, timestamped-before-missing, stable identifier dan source position tanpa persistence.
- [x] Urgency backend kekal authoritative; malformed/contradictory metadata tidak menghasilkan state rekaan dan review memerlukan `needs_review=true`.
- [x] Pending emergency kekal informational sahaja; tiada approval Admin, bypass Warden, perubahan `require_warden_approval`, guardian/waris exposure, shortcut atau phone button.
- [x] Existing refresh path, Admin authentication/views/filters/actions, Student/Warden/Guard/Public dan privacy boundary dikekalkan; tiada GAS/schema/lifecycle/threshold/version/deployment change.
- [x] Commit `d0be685` (`feat: add admin operational intelligence`); focused suite **9/9**, full Node suite **429/429**.

### Warden Approval Prioritisation + Emergency Mode — Fasa 3

- [x] Pending Warden disusun mengikut emergency, departure approaching/reached dan ordinary tanpa menambah lifecycle state.
- [x] Dalam setiap bucket, `masa_mohon` sah disusun oldest-first; row tanpa timestamp menyusul menggunakan fallback deterministic/stable.
- [x] Compatibility `jenis_permohonan === KECEMASAN` dipusatkan untuk ordering, visual emphasis dan procedural guidance Warden.
- [x] Emergency priority tidak secara sendiri auto-approve, bypass authority Warden/Guard atau mengubah lifecycle; generic config `require_warden_approval=false`/`AUTO_CONFIG_V2` kekal authoritative dan tidak diubah.
- [x] Departure priority menggunakan `earliest_departure_time`, tarikh request authoritative dan zon masa Malaysia; timing hilang/malformed tidak mereka priority.
- [x] Projection Warden mengutamakan masa request-level, menggunakan `OUTING_TYPES` semasa hanya sebagai cloned fallback dan tidak menulis ke `OUTING_REQUESTS` atau Sheet.
- [x] Student, Guard, Admin dan Public projection tidak diluaskan; authentication, approve/reject, validation, actor recording, checklist/filter/counter dan privacy boundary dikekalkan.
- [x] Kad priority kompak disahkan pada mobile sekitar 390px dan desktop 1280×720 tanpa horizontal overflow.
- [x] Commit `5443375` (`feat: prioritize warden emergency approvals`); focused suite **10/10**, full Node suite **420/420**.

### Student Live Status Clarity — Fasa 2

- [x] Student `Status Semasa` menggunakan nested `operational_urgency` backend dan mengekalkan lifecycle sebagai dimensi berasingan.
- [x] State `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL`, `ACTION_REQUIRED` dan `needs_review=true` dirender tanpa threshold classification local.
- [x] `expected_return_at` menjadi sumber paparan masa hari sama atau tarikh + masa bagi rekod kemudian/bermalam; frontend tidak membaca semula `OUTING_TYPES`.
- [x] Timer Student 30 saat sedia ada mengemas kini wording tempoh sahaja dan refresh GAS apabila `next_transition_at` dilepasi; transition key/single-flight mencegah duplicate dan overlap tanpa timer tambahan.
- [x] Metadata hilang/malformed atau `needs_review=true` menghasilkan panduan review selamat tanpa countdown/late state rekaan; wording hard-coded 10 malam telah dibuang.
- [x] `SELESAI`, cancellation, return-selfie, annual summary/history, profile photo, Announcement Banner/`ruleNotice`, authentication dan privacy boundary dikekalkan.
- [x] Perubahan implementation terhad kepada `assets/app.js`, `assets/style.css`, `tests/student-current-status-layout.test.js` dan `tests/student-live-status-clarity-phase2.test.js`.
- [x] Commit `89d6b46` (`feat: improve student live outing status`); full Node suite **410/410**.

### Operational Urgency Foundation — Fasa 1

- [x] Satu resolver expected-return backend mengutamakan snapshot `tarikh_balik + masa_balik_dijangka` bagi semua standard dan custom/config-driven type.
- [x] Legacy daily fallback kepada tarikh outing dan 22:00 dikekalkan hanya apabila wajar; malformed active timing menghasilkan `needs_review=true`.
- [x] Urgency kekal berasingan daripada lifecycle dengan state `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL` dan `ACTION_REQUIRED`.
- [x] Threshold exact: lebih 30 minit sebelum, 0–30 minit sebelum, selepas due hingga kurang 30 minit lewat, 30–kurang 60 minit lewat, dan sekurang-kurangnya 60 minit lewat.
- [x] `confirmIn()` menggunakan resolver authoritative yang sama, di bawah lock, sambil mengekalkan historical `lewat=Ya/Tidak` dan idempotency.
- [x] Projection authenticated Pelajar, Warden/HEP, Guard dan Admin boleh menerima nested `operational_urgency`; Public Monitoring kekal tanpa precise urgency metadata.
- [x] Urgency diterbitkan selepas cache source 20 saat dibaca dan tidak dicache sebagai state; tiada schema change.
- [x] Commit `dde1fc4`; full Node suite **399/399**.

### eOuting v2.4.0 Guard Responsive Grid

- [x] Commit `d30d8d9` menjadikan senarai approved/sedia keluar, sedang keluar/menunggu masuk dan overnight belum pulang sebagai grid responsif khusus Guard.
- [x] Satu kolum digunakan di bawah `820px`; dua kolum sama lebar digunakan mulai `820px`, dengan gap konsisten dan perlindungan overflow.
- [x] Browser production pada 20 Ogos 2026 mengesahkan computed columns `570px 570px` pada viewport `1707px`, posisi kad berselang sekitar `270px`/`852px` dan kad tidak merentasi kedua-dua kolum.
- [x] Rendering JavaScript Guard, hook `Sah Keluar`/`Sah Masuk`, backend, GAS, schema dan business rules kekal tidak berubah.
- [x] Full Node suite bagi milestone Guard grid **385/385** pada 20 Ogos 2026.

### eOuting v2.3.2 Production Close-out (sejarah)

- [x] `Status Semasa` dipindahkan ke atas borang sebagai kawasan authoritative bagi current record, pembatalan dan return-selfie yang layak.
- [x] Bahagian bawah Pelajar dipadatkan kepada Refresh Status, jumlah tahunan dan `Rekod Outing Saya`.
- [x] Commit `967cfd6` menutup compact history; commit `f2f55cc` menyelaraskan jumlah/sejarah kepada scope authenticated `SELESAI` tahun semasa.
- [x] Response sejarah minimum hanya `tarikh`, `jenis_permohonan` dan `status`, dengan ownership diperkukuh dan newest-first.
- [x] Frontend v2.3.2 / cache `2.3.2-r1` / GAS Version 44 serta smoke test jumlah-sejarah disahkan production.
- [x] Full Node suite bagi milestone v2.3.2 **363/363** pada 16 Ogos 2026.

### eOuting v2.2.1 Production Close-out (sejarah)

- [x] Tujuh modul Admin inline: Pemantauan, Statistik, Rekod Master, Warden/HEP/Guard, Tetapan Pelajar, Tetapan Outing dan Notis Banner.
- [x] Pengurusan staff, pelajar dan outing type serta Rekod Master search/filter/pagination.
- [x] Foto profil private: self-upload, crop/compression, metadata STUDENTS, Admin removal dan initials fallback.
- [x] Two-tier photo delivery: unique-ID thumbnail batch, server-side Drive thumbnail, one-student full preview, cache sesi, duplicate suppression dan safe failure.
- [x] Thumbnail production disahkan untuk Warden/HEP, Guard, Admin Pemantauan dan Admin Tetapan Pelajar; Public Pemantauan kekal photo-free.
- [x] Statistik individu Admin, annual count Pelajar, rolling KPI/reduced-motion dan scoped Enter submission.
- [x] GAS Version 43 ialah baseline production pada close-out 14 Ogos 2026; config-driven active, readiness hijau, Notis Banner V1 dan Student cancellation live.
- [x] Cache/asset source revision `2.2.1-r4` dengan displayed app version v2.2.1 pada close-out tersebut.
- [x] Setiap banner aktif menggunakan ticker kiri berterusan; hover/focus/touch pause dan reduced-motion kekal statik.
- [x] Controlled activation: submission, Warden approval, early Guard rejection dan safe policy feedback disahkan.
- [x] Notis Banner V1 live: satu notis Script Properties, Admin edit/aktif/penting, viewer authenticated, safe text, audit dan reduced-motion.
- [x] Deploy Notis Banner sebagai GAS Version 37 dan sahkan Admin UI/save, Normal banner, authenticated display, timestamp serta public privacy.
- [x] Full Node suite **353/353** pada 14 Ogos 2026.
- [x] Buang ayat panduan outing pendua di bawah “Permohonan Pelajar”; kekalkan Announcement Banner, `ruleNotice` dan borang.
- [x] Atomic duplicate outing protection: frontend in-flight state serta backend `ScriptLock` untuk active-check + append.
- [x] In-flight loading Warden approve/reject dan Guard confirm-out/confirm-in.
- [x] Dynamic payload fields untuk semua jenis config/custom; KLINIK dan standard types regression-tested.
- [x] Admin boleh `Kosongkan` earliest departure time; blank tidak berubah menjadi current time.
- [x] Hotfix `39265f1`: Admin boleh `Kosongkan` application open/close time; `clearContent()` memastikan blank kekal blank, tiada fallback `00:00`/`12:00`/masa semasa, dan `allowed_days` kekal enforced.
- [x] Rekod deployment awal v2.2.1 / cache r1 / GAS Version 40: isu permohonan pagi `PULANG_BERMALAM` disahkan selesai.
- [x] Admin refresh persistence melalui `eouting_admin_session_v1`, 12-hour absolute expiry dan mandatory backend revalidation.
- [x] Global auth/restore loader Pelajar, Warden, Guard dan Admin dengan operation token serta reduced-motion.
- [x] Foto profil Pelajar menawarkan kamera depan atau galeri melalui satu shared processing pipeline; return-selfie kekal berasingan.
- [x] Rekod mobile/PWA awal v2.2.1 disahkan menggunakan cache `2.2.1-r1`.
- [x] Student cancellation untuk pending/approved pada semua jenis standard/config-driven, termasuk mandatory reason dan status terminal `DIBATALKAN_PELAJAR`.
- [x] Cancellation metadata additive, history/re-request, Warden/Guard/Public Monitoring/statistics exclusions dan race-safe `ScriptLock` transition.
- [x] Telegram cancellation tepat satu mesej bagi pending serta approved; previous status human-readable dan failure non-blocking.
- [x] Paparan approval HEP/Warden menggunakan prefix authoritative `WARDENS.warden_id` tanpa schema atau lifecycle baharu.
- [x] Status awal submission disahkan, dipersist mengikut header Sheet sebenar dan dibaca semula; blank dipaparkan sebagai `Status Tidak Diketahui`.
- [x] Masa sahaja Sheet dinormalkan kepada `HH:mm`; paparan/Telegram/late comparison `22:00` tidak lagi membawa tarikh 1899 atau offset manual.
- [x] Helper daypart BM diselaraskan kepada Pagi `01:00–11:59`, Tengah Hari `12:00–12:59`, Petang `13:00–18:59` dan Malam `19:00–00:59`.

### eOuting v2.0 — Fasa 2 Schema dan Migration

- [x] Tambah schema staging `OUTING_TYPES` dan `ADMIN_USERS`.
- [x] Luaskan `AUDIT_LOG` dengan `entity_type` dan `entity_id` secara additive.
- [x] Tambah migration idempotent `setupAdminOutingConfigV200()`.
- [x] Seed lima jenis outing v1.7.1 sekali sahaja tanpa menimpa row sedia ada.
- [x] Tambah Script Property `OUTING_CONFIG_V2_ENABLED` dengan default `false`.
- [x] Kekalkan `submitRequest` dan flow production hard-coded.
- [x] Tambah regression tests untuk schema, idempotency, compatibility audit dan feature flag.

### eOuting v2.0 — Fasa 3 Backend Config API

- [x] Tambah `loginAdmin` dan validation Admin aktif tanpa mendedahkan PIN.
- [x] Tambah public safe `getOutingTypes` dengan fallback legacy semasa flag `false`.
- [x] Tambah authenticated `getAdminOutingTypes` untuk active/inactive dan metadata config.
- [x] Tambah create/update/toggle di bawah `LockService` tanpa delete API.
- [x] Tambah uppercase/unique/immutable `type_code` dan backend validation semua medan config.
- [x] Tambah optimistic `expected_config_version` dan increment version.
- [x] Tambah audit create/update/activate/deactivate dengan entity `OUTING_TYPE` tanpa PIN.
- [x] Kekalkan `submitRequest` serta UI production hard-coded.

### eOuting v2.0 — Fasa 4 Admin Dashboard

- [x] Tambah role, panel login dan runtime-only session Admin.
- [x] Tambah responsive Dashboard active/inactive dengan loading, empty, error dan retry.
- [x] Tambah controlled create form untuk semua medan konfigurasi.
- [x] Tambah edit dengan immutable `type_code` dan optimistic config version.
- [x] Tambah confirmation toggle aktif/nyahaktif tanpa delete.
- [x] Tambah conflict refresh dan mesej mesra pengguna.
- [x] Pastikan logout membersihkan PIN/credential runtime dan Admin tidak disimpan ke localStorage.
- [x] Tambah accessibility labels, focus, disabled dan aria-live states.

### Core System

- [x] GitHub Pages frontend dan PWA live.
- [x] Google Apps Script backend dideploy dan disambungkan ke Google Sheets.
- [x] Pelajar, Warden dan Guard login.
- [x] Flow `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM` dan `CUTI_SEMESTER`.
- [x] Backend duplicate active request prevention.
- [x] Warden approve/reject dan Guard confirm keluar/masuk.
- [x] Telegram notification basic flow dan `AUDIT_LOG`.
- [x] Warden Dashboard refresh, Checklist Permohonan dan Copy Senarai Nama.
- [x] Guard refresh dan auto-refresh.
- [x] Statistik aggregated counts dan CSV report controls.
- [x] PWA version/cache update strategy dan update popup.

### Privacy dan Authenticated Records

- [x] Student list privacy hardening.
- [x] Public `getStudents` minimum kepada `student_id`, `nama`, `kelas`.
- [x] Authenticated operational records untuk Pelajar, Warden dan Guard.
- [x] Tiada fallback authenticated POST kepada public GET.
- [x] Public Monitoring data minimisation kepada enam field.
- [x] Statistik individu/leaderboard dibuang daripada public dan disediakan semula hanya dalam modul Admin authenticated.
- [x] API/GAS dikecualikan daripada Cache Storage dan cache lama dibersihkan.
- [x] Staff runtime credential restoration selepas fresh login.
- [x] Foto profil private dengan batch authenticated, initials fallback dan Admin removal ber-audit.
- [x] Preview besar foto profil authorised menggunakan full-image on-demand satu pelajar, cache sesi dan retry selamat tanpa Drive URL/ID atau N+1 list request.

### Status dan Guard UX

- [x] Warden emoji status menggantikan indikator kotak lama.
- [x] Contextual status labels melalui helper pusat.
- [x] `Sedang Bercuti`, `Sedang Bermalam` dan `Sedang Keluar` tanpa mengubah status backend.
- [x] Guard filter cleanup kepada filter yang relevan sahaja.
- [x] Guard `Kecemasan` filter yang berasingan daripada Outing Harian.
- [x] Contextual empty-state bagi kedua-dua seksyen Guard.

### Public Monitoring v1.6.25

- [x] Public name display dengan restricted response fields.
- [x] Public Monitoring one-click loading.
- [x] Scroll reset ke permulaan `monitorWorkspace`.
- [x] Dedicated public GET loader.
- [x] Single-flight guard untuk klik, refresh dan auto-refresh.
- [x] Duplicate render removal; satu response dirender sekali.
- [x] Timestamp hanya berubah selepas fetch berjaya.
- [x] Cached data dikekalkan selepas refresh gagal.
- [x] Compact Public Monitoring layout.
- [x] `Rekod Hari Ini`, quick filter monitor dan seksyen `Belum Pulang Ke Asrama` pendua dibuang.
- [x] `Senarai Status Semasa` memaparkan nama, kelas, jenis, ikon dan label kontekstual.

### Bukti Pulang Asrama v1.7.0

- [x] Bukti selfie pulang untuk `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM` dan `CUTI_SEMESTER`.
- [x] Kamera depan, preview, ambil semula, resize kira-kira 1280px dan JPEG compression.
- [x] `submitReturnSelfie` dengan validation pemilikan, `SELESAI`, `masa_masuk`, MIME/base64/saiz.
- [x] `LockService` duplicate protection dan idempotent rejection.
- [x] Folder Google Drive private `eOuting - Bukti Selfie Pulang`.
- [x] Telegram `sendPhoto` dan metadata selfie dalam `OUTING_REQUESTS`.
- [x] `setupSelfieProofV170()` serta Script Property `SELFIE_FOLDER_ID`.
- [x] Cleanup transaksi separa dan audit-log failure non-fatal selepas transaksi berjaya.
- [x] Mock-mode submission tanpa Drive atau Telegram.
- [x] Service-worker dan Public Monitoring privacy hardening untuk bukti selfie.
- [x] Test suite **59/59 lulus**.
- [x] Pull Request #1 digabungkan dan frontend v1.7.0 live di GitHub Pages.
- [x] GAS Version 21 dideploy dan ujian production hujung-ke-hujung berjaya.

## Operations Checklist

- [ ] Teruskan pemantauan operasi selepas v1.7.0.
- [ ] Verify Cuti Semester approval and Guard flow in real operation.
- [ ] Verify Public Monitoring during active Cuti Semester/Pulang Bermalam records.
- [ ] Verify CSV reports after more Cuti Semester records.
- [ ] Confirm Telegram group membership for operations.
- [ ] Clean test data before official reporting if needed.
- [ ] Assign/rotate unique PINs for Warden/Guard when needed.
- [ ] Prepare user guide for Pelajar.
- [ ] Prepare SOP for Warden/Guard/HEP.
- [ ] Backup spreadsheet/template regularly.
- [ ] Confirm who can access Spreadsheet and Apps Script.

## Near TODO

- [x] Tambah foundation peraturan keluar pada `OUTING_TYPES`: hari keluar dan masa keluar paling awal, tanpa mengaktifkan config-driven production.
- [x] Admin/HEP menetapkan `earliest_departure_time=17:00` untuk `PULANG_BERMALAM`; nilai ini boleh diubah mengikut arahan operasi semasa.

- [x] Fasa 6: audit beta readiness, metadata, migration/security boundaries serta sediakan rollout dan rollback checklist.
- [x] Fasa 4.5: Local/Mock QA Admin dengan lima seed, credential development terasing, error/retry dan optimistic conflict.
- [x] Fasa 4.6: buang duplicate `apiPost` dan kekalkan satu canonical POST router dengan regression coverage.
- [x] Fasa 5A: config-driven student form rendering dengan safe GET, legacy fallback dan mock QA.
- [x] Fasa 5B: selaraskan submission/validation config-driven di belakang feature flag dengan fail-closed config resolution dan legacy fallback.
- [x] Bina `getOutingTypes` dengan kontrak public projection selamat.
- [x] Bina CRUD backend dan Dashboard Admin pada fasa berasingan.
- [x] Aktifkan config-driven submission selepas live migration, readiness, feature flag dan rollback diuji/diluluskan.
- [ ] Sediakan persekitaran beta berasingan atau kelulusan khusus jika menggunakan data production.
- [x] Sambungkan `require_selfie` kepada lifecycle config-driven dengan state `TIDAK_DIPERLUKAN` tanpa mengubah legacy.
- [x] Jadikan statistik, label Telegram, Rekod Master dan Checklist Warden config-aware untuk jenis custom.
- [x] Tambah readiness read-only Admin untuk schema, config aktif, pendua, versi, hari/masa dan konsistensi consumer.
- [x] Deploy hardening, sahkan readiness production, lakukan controlled activation dan deploy Guard feedback sebagai GAS Version 36.
- [ ] Optional deep-link terus ke Warden page/request; canonical eOuting URL biasa sudah ditambah kepada operational messages yang disokong.
- [ ] Dedicated `Kemas Kini Aplikasi` button separate from `Muat Semula Aplikasi`, if still required.
- [ ] Optional `request_id` deep link/highlight later.
- [ ] Daily WhatsApp summary/report.
- [ ] Review keputusan konservatif `lewat=Ya` apabila timing benar-benar indeterminate semasa `confirmIn`; active malformed record kini memberi `needs_review=true`.
- [x] Fasa 6 Guardian Contact Shortcut dan safe phone-call link untuk Warden/HEP telah production verified.
- [ ] Notification observability/long-term trigger monitoring dan notification channel masa hadapan.
- [ ] Pertimbang snapshot request-level `earliest_departure_time` dalam schema/version masa hadapan; sementara itu perubahan config boleh mentafsir semula priority fallback-only Warden, manakala snapshot request-level sah kekal stabil.

## Security / Access Improvements

- [ ] Consider Google login / stronger auth.
- [ ] Consider domain-restricted access for staff.
- [ ] Hash PIN instead of storing plain text.
- [ ] Add backend-issued session token if stronger API session control is required.
- [ ] Review audit log format and retention.
- [ ] Tetapkan retention/deletion policy untuk selfie.
- [ ] Review GAS Web App deployment permission.
- [ ] Decide SOP for changing Warden/Guard PIN.
- [ ] Review role-based access hardening.
- [x] Buang Public Statistik dan kekalkan Statistik individu hanya dalam Admin authenticated.

## Future Enhancements

- [ ] QR code.
- [ ] Admin/Warden evidence review UI.
- [ ] Automated cleanup selfie selepas retention period.
- [ ] Optional Telegram retry strategy untuk kegagalan No-Guard request/completion; automatic retry belum dilaksanakan.
- [ ] Refinement notis consent/privacy Pelajar.
- [x] Admin beta page for managing STUDENTS (A2, A3 dan LI) tanpa schema migration.
- [ ] Nilai sama ada optimistic version column diperlukan untuk STUDENTS selepas beta concurrency QA.
- [x] Late-return escalation notification di atas operational urgency foundation.
- [x] Warden approval prioritisation tanpa mengubah lifecycle.
- [x] Emergency priority presentation/handling compatibility untuk Warden tanpa approval bypass baharu.
- [x] Admin operational urgency KPI dan queue `Perlu Tindakan`.
- [x] Backend Telegram return reminder/escalation scanner dengan batching, audit dedup dan dry-run.
- [x] Jalankan controlled production dry-run selepas kelulusan operasi.
- [x] Selaraskan existing production Web App deployment kepada Version 46 tanpa menukar deployment ID/URL.
- [x] Jalankan satu controlled real Telegram send dan sahkan audit/dedup production.
- [x] Aktifkan tepat satu time-driven trigger/lima-minit dan sahkan first natural execution.
- [x] Guardian/waris shortcut untuk eligibility operasi Warden/HEP yang diluluskan.
- [x] Safe `tel:` phone-call button selepas authenticated contact fetch.
- [ ] Long-term trigger monitoring dan notification observability improvements.
- [ ] Additional notification channels selepas acceptance berasingan.
- [ ] Optional WhatsApp notification later if required.
- [ ] Daily/weekly/monthly report automation.
- [ ] Automated version injection/build step.
- [ ] Supabase migration can remain future TODO only; not a current requirement.
