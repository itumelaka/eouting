# Project Status eOuting ITU

Status repo semasa: **v2.4.0 — production verified**.

## eOuting v2.4 Production

Frontend v2.4.0 diterbitkan melalui GitHub Pages di `https://itumelaka.github.io/eouting/`.

Verdict semasa pada **20 Ogos 2026** ialah **config-driven production ACTIVE dan Ready** pada release v2.4.0 dengan GAS Version 44. Displayed version ialah v2.4.0, cache/asset source revision ialah `2.4.0-r1` dan service-worker cache ialah `eouting-cache-v2.4.0-r1`. Production beroperasi normal.

`Notis Banner` V1 dan Student cancellation kekal live. `Status Semasa` kini berada di atas borang dan kekal authoritative untuk tindakan semasa. Bahagian bawah memaparkan Refresh Status, jumlah tahunan dan `Rekod Outing Saya`; jumlah serta sejarah menggunakan rekod authenticated `SELESAI` bagi tahun semasa. Operational Urgency Foundation Fasa 1 telah lengkap melalui commit `dde1fc4`; Student Live Status Clarity Fasa 2 melalui `89d6b46`; dan Warden Approval Prioritisation + Emergency Mode Fasa 3 melalui `5443375`. Full Node suite semasa lulus **420/420**; focused Phase 3 suite lulus **10/10**.

Ayat panduan outing pendua di bawah “Permohonan Pelajar” telah dibuang. Announcement Banner kekal untuk notis operasi semasa, `ruleNotice` kuning kekal authoritative untuk panduan kontekstual, dan borang outing tidak berubah.

Production boundary semasa:

- frontend release ialah `v2.4.0` dan backend production ialah GAS **Version 44**;
- Spreadsheet production ialah `1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg`;
- endpoint GAS production kekal `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`;
- `OUTING_CONFIG_V2_ENABLED=true`; `OUTING_TYPES` authoritative dan Tetapan Outing ialah interface operasi;
- `TELEGRAM_ENABLED=true` kekal aktif;
- readiness hijau dan chip Admin memaparkan `Config Active`;
- `require_selfie`, audit auto-approval, statistik, Telegram, filter operasi dan label contextual membaca config secara dinamik;
- application rules dan departure rules dipisahkan melalui `allowed_days`/application window serta `departure_allowed_days`/`earliest_departure_time`;
- blank `application_open_time` atau `application_close_time` bermaksud tiada threshold bagi medan tersebut; Admin boleh menggunakan `Kosongkan`, blank kekal blank, dan `allowed_days` tetap authoritative;
- `PULANG_BERMALAM` boleh dipohon pada mana-mana hari, departure semasa ialah Jumaat dan earliest time `17:00`, boleh diubah Admin mengikut arahan HEP.
- custom `KLINIK` (`Keluar ke Klinik`) beroperasi sebagai same-day tanpa tarikh manual, memerlukan masa balik, lokasi, kenderaan, kelulusan Warden dan selfie; dynamic section menggunakan `Maklumat Tambahan`;
- blank `earliest_departure_time` bermaksud tiada sekatan masa paling awal dan Admin boleh mengosongkannya tanpa current-time fallback;
- operational urgency backend memisahkan `NORMAL`, `DUE_SOON`, `LATE`, `CRITICAL` dan `ACTION_REQUIRED` daripada lifecycle;
- expected-return mengutamakan snapshot `tarikh_balik + masa_balik_dijangka` bagi standard dan custom type, dengan legacy daily fallback sahaja apabila wajar;
- active malformed timing menghasilkan `needs_review=true`; `confirmIn()` menggunakan resolver sama dan historical `lewat` kekal `Ya/Tidak`;
- projection operasi authenticated Pelajar, Warden/HEP, Guard dan Admin boleh menerima nested `operational_urgency`, tetapi Public Monitoring kekal pada allowlist enam medan;
- urgency diterbitkan selepas cache source operasi 20 saat dibaca dan tidak dicache sebagai state;
- Student `Status Semasa` merender urgency backend, expected return dan review state tanpa mengira threshold sendiri; local timer hanya mengemas kini wording tempoh dan meminta refresh authoritative selepas `next_transition_at`;

Runbook rollout dan rollback: [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md).

- Metadata displayed frontend/footer/version berada pada `v2.4.0`; asset/cache source revision ialah `2.4.0-r1`.
- Backend GAS production ialah **Version 44** dan source kanonik ialah `gas/Code.gs`; `gas/Code.production-v171.gs` bukan source deploy.
- Google Sheets kekal database/source of truth.
- Google Drive private menyimpan bukti selfie dan Telegram `sendPhoto` menghantar imej sebenar.
- `.claspignore` mengekalkan whitelist/hygiene supaya hanya source GAS kanonik dan manifest berada dalam skop push.

## Fungsi Disahkan

- Landing mempunyai grid kompak 2×2 `Pelajar`, `Warden & HEP`, `Guard`, `Pemantauan Semasa`; Public Statistik tidak lagi tersedia.
- Warden dan HEP berkongsi role operasi backend `warden`; role paparan diperoleh daripada `WARDENS.warden_id` (`HEP-*` → HEP, `W-*` → WARDEN, unknown → WARDEN) sementara lifecycle kekal `DILULUSKAN_WARDEN`.
- Jenis `OUTING_BIASA`, `OUTING_HUJUNG_MINGGU`, `KECEMASAN`, `PULANG_BERMALAM`, `CUTI_SEMESTER`.
- Pelajar login dengan `student_id` dalaman + nombor matrik yang ditaip.
- `Status Semasa` Pelajar menggunakan rekod operasi live/current dan berada di atas borang; pembatalan serta return-selfie kekal di situ apabila layak.
- `Rekod Outing Saya` menggunakan response ringkasan tahunan authenticated yang sama dengan jumlah outing: hanya rekod `SELESAI` tahun semasa, tiga medan minimum dan susunan paling baharu dahulu.
- Warden approve/reject dan Guard confirm keluar/masuk menggunakan POST authenticated.
- Submission Pelajar mempunyai frontend in-flight guard dan atomic backend active-check + append; Warden/Guard actions mempunyai loading protection terhadap duplicate click.
- Status awal submission disahkan, ditulis mengikut susunan header Sheet sebenar dan dibaca semula; blank authoritative status dipaparkan sebagai `Status Tidak Diketahui`.
- Nilai masa sahaja Sheet dinormalkan kepada `HH:mm` dalam `Asia/Kuala_Lumpur`; `22:00` kekal `22:00` bagi paparan, Telegram dan late comparison tanpa tarikh 1899 atau offset manual.
- Helper daypart BM menggunakan Pagi `01:00–11:59`, Tengah Hari `12:00–12:59`, Petang `13:00–18:59` dan Malam `19:00–00:59`; formatter locale generik masih boleh menggunakan `PTG`.
- Pelajar melihat `Batal Permohonan` hanya ketika pending/approved; sebab wajib 5–500 aksara, status terminal `DIBATALKAN_PELAJAR`, paparan sejarah dan permohonan baharu telah disahkan live.
- Cancellation ialah status-driven untuk standard, `KLINIK` dan custom type; ownership serta current status disemak di bawah `ScriptLock`, dan `KELUAR` tidak boleh ditimpa.
- Cancelled row dikecualikan daripada queue Warden/Guard, outside/completed counts dan Public Monitoring reason; Admin/master authenticated boleh melihat label serta sebab.
- Setiap cancellation pending/approved menghasilkan tepat satu Telegram dengan previous status human-readable; failure kekal non-blocking.
- Runtime credential staff dipulihkan selepas fresh login.
- Tiada fallback authenticated kepada public records.
- Warden Checklist menggunakan emoji dan status kontekstual.
- Guard quick filter dan contextual empty-state berfungsi pada kedua-dua seksyen.
- Commit `d30d8d9` menggunakan grid responsif khusus untuk approved/sedia keluar, sedang keluar/menunggu masuk dan overnight belum pulang: satu kolum di bawah `820px`, dua kolum sama lebar mulai `820px`.
- Verifikasi browser production pada 20 Ogos 2026 dengan lebar viewport `1707px` menunjukkan computed columns `570px 570px`, posisi kiri berselang sekitar `270px`/`852px` dan lebar kad sekitar `570px`; kad Guard tidak merentasi kedua-dua kolum.
- Perubahan grid tidak mengubah rendering JavaScript Guard, hook `Sah Keluar`/`Sah Masuk`, backend, GAS, schema atau business rules.
- Operational Urgency Fasa 1 mengelaskan lebih 30 minit sebelum sebagai `NORMAL`, 0–30 minit sebelum sebagai `DUE_SOON`, selepas target hingga kurang 30 minit sebagai `LATE`, 30–kurang 60 minit sebagai `CRITICAL`, dan sekurang-kurangnya 60 minit sebagai `ACTION_REQUIRED`.
- Exact expected-return ialah `DUE_SOON`; historical `confirmIn` pada exact target menyimpan `Tidak`, manakala actual selepas target menyimpan `Ya`.
- Student Live Status Clarity Fasa 2 menggunakan state authoritative itu dalam `Status Semasa`, mengekalkan lifecycle berasingan, memaparkan masa/tarikh expected return dan review guidance, serta tidak membaca semula `OUTING_TYPES` atau reclassify urgency secara local.
- Timer Student 30 saat sedia ada digunakan semula untuk teks tempoh dan transition refresh; transition key serta single-flight menghalang duplicate/overlap. Tiada timer Student tambahan.
- Fasa 2 mengekalkan `SELESAI`, cancellation, return-selfie, annual summary/history, profile photo, Announcement Banner/`ruleNotice`, authentication dan privacy boundary.
- Warden Approval Prioritisation + Emergency Mode Fasa 3 menyusun pending kepada emergency, departure approaching/reached dan ordinary; `masa_mohon` sah oldest-first dalam setiap bucket, kemudian fallback deterministic bagi row tanpa timestamp.
- Emergency compatibility kekal `jenis_permohonan === KECEMASAN` dan hanya mengubah ordering, visual emphasis serta guidance. Ia tidak sendiri auto-approve, bypass Warden/Guard atau menukar lifecycle. Generic `require_warden_approval=false` dan `AUTO_CONFIG_V2` kekal behavior config sedia ada yang berasingan.
- Projection departure Warden mengutamakan `earliest_departure_time` request-level dan menggunakan nilai `OUTING_TYPES` semasa hanya sebagai fallback cloned/non-persistent. Tiada write Sheet atau peluasan Student, Guard, Admin dan Public projection.
- Known limitation: perubahan config selepas submission boleh mentafsir semula priority fallback-only; request dengan snapshot masa request-level sah kekal stabil. Snapshot departure per request ialah pertimbangan schema masa hadapan.
- Lifecycle, Warden approval priority dan return urgency kekal tiga dimensi berasingan. Approval/reject, actor recording, checklist semester/overnight, filter/counter, Guard authority dan privacy boundary dikekalkan.
- Admin operational intelligence/`Perlu Tindakan`, Telegram timed reminder/escalation, GAS time-driven trigger, guardian shortcut/access scope dan snapshot departure schema kekal belum dilaksanakan sebagai Fasa 4+.
- Public Monitoring membuka inline dalam shell landing, membuat GET awam khusus, mengelakkan overlap dan merender sekali.
- Public Monitoring mengekalkan data lama apabila refresh gagal.
- Public Monitoring hanya memaparkan ringkasan dan `Senarai Status Semasa`.
- Statistik hanya boleh dicapai sebagai modul inline Admin berautentikasi; filter bulan/tahun/kelas, KPI, ringkasan kelas/jenis/status dan statistik individu kekal tersedia.
- Tujuh modul Admin inline ialah `Pemantauan`, `Statistik`, `Rekod Master`, `Warden, HEP & Guard`, `Tetapan Pelajar`, `Tetapan Outing` dan `Notis Banner`.
- Rekod Master menyokong carian, filter dan pagination; Pemantauan Admin memaparkan operasi semasa secara baca sahaja; Pelajar melihat jumlah outing tahunan.
- Foto profil disimpan private melalui `PROFILE_PHOTO_FOLDER_ID` dan metadata `STUDENTS.photo_file_id`/`photo_updated_at`; batch authenticated `thumbnail` membekalkan imej kompak dengan initials fallback kepada Pelajar, Warden/HEP, Guard dan Admin.
- Foto penuh dimuat untuk satu pelajar sahaja apabila preview dibuka, kemudian dicache sepanjang sesi; placeholder dan Public Monitoring tidak mempunyai preview.
- API/GAS network-only dalam service worker; cache lama dibersihkan.
- Displayed version/footer ialah v2.4.0; asset query dan cache source konsisten pada `2.4.0-r1`.
- Config-driven production menggunakan `require_selfie` yang disnapshot; false menghasilkan `TIDAK_DIPERLUKAN`.
- Status utama kekal `SELESAI`; `selfie_status` menyimpan `BELUM_HANTAR`, `SUDAH_HANTAR` atau `TIDAK_DIPERLUKAN` secara berasingan.
- Front camera, preview, retake, resize, JPEG compression, loading dan mock submission telah disahkan.
- Foto profil Pelajar menawarkan action sheet `Ambil Foto`, `Pilih dari Galeri` dan `Batal`; kedua-dua sumber berkongsi pipeline lama dan telah disahkan pada telefon.
- Admin refresh restore disahkan berulang melalui tab sessionStorage dengan 12-hour absolute expiry dan mandatory `loginAdmin` revalidation; PIN tidak masuk localStorage.
- Global auth/restore loader disahkan untuk Pelajar, Warden, Guard dan Admin, termasuk cleanup serta reduced-motion; Public Pemantauan kekal berasingan.
- Admin shell muncul selepas authentication dan tab bukan default lazy-load; public/master bootstrap tidak lagi menghalang restore Admin.
- Backend mengesahkan pemilikan, status/masa masuk, MIME/base64/saiz dan duplicate submission dengan `LockService`.
- Cleanup transaksi separa serta audit failure non-fatal selepas submission lengkap telah disahkan.
- Public Monitoring dan service worker mengekalkan boundary privasi metadata selfie.
- Controlled smoke test 10 Ogos 2026 lulus bagi config activation, non-Friday rejection, Friday submission, Warden approval dan early Guard rejection.
- Guard kini memaparkan business-rule tarikh/hari/masa secara selamat; request 14 Ogos 2026 ditolak ketika confirm-out dicuba pada 10 Ogos 2026.
- Public Monitoring berfungsi pada klik pertama dan Statistik Admin inline berjaya dimuatkan tanpa meninggalkan sesi Admin.
- Production smoke test mengesahkan upload Pelajar, thumbnail Warden/HEP, Guard, Admin Pemantauan dan Admin Tetapan Pelajar, secure full preview, Public Pemantauan photo-free, keyboard Enter, rolling KPI serta two-tier performance optimisation.

## Privacy Boundary

Public `getStudents`:

```text
student_id | nama | kelas
```

Public GET `getTodayRecords`:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Public response tidak mempunyai nombor matrik, internal/request ID, telefon, waris, lokasi, tujuan, kenderaan, credential atau metadata operasi. Nama kekal dibenarkan pada Public Monitoring read-only; boundary ini diperkenalkan pada v1.6.25 dan diteruskan dalam v1.7.0.

Metadata urgency tepat—termasuk `operational_urgency`, expected-return/evaluated timestamp, minit, next transition, action code dan timing diagnostic—juga tidak termasuk dalam projection awam.

Metadata selfie, foto profil, URL/file ID Drive dan Telegram message ID juga tidak termasuk dalam projection awam.

Operational POST kekal berasingan dan memerlukan credential role sebenar.

## Status Kontekstual

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar
- 🌙 Sedang Bermalam
- 🏖️ Sedang Bercuti
- ✅ Sudah Pulang
- 🔴 Lewat

Nilai backend `KELUAR` tidak berubah.

## Deployment Milestone

- **v1.6.24:** frontend-only Guard filter release.
- **v1.6.25:** frontend + GAS Public Monitoring/privacy release.
- **v1.7.0:** frontend + GAS + Google Drive + Telegram return-selfie release; GAS Version 21.
- **v1.7.1:** menambah Outing Sabtu / Ahad; Pull Request #2 digabungkan melalui `fa7227e` daripada `1e6303c`.
- **v2.0.0:** production frontend rollout pada 4 Ogos 2026 melalui `4eedcbe`; backend kekal GAS Version 24 dengan feature flag config-driven submission masih `false`.
- **v2.1.0:** Guard UI diperkemas, jumlah outing tahunan Pelajar, statistik individu Admin berautentikasi, tempoh outing sebenar, hygiene clasp dan pembaikan rendering Statistik Admin. Production kini menggunakan GAS Version 31 dengan foto profil operational; preview besar semasa ialah perubahan frontend-only.
- **v2.2.0:** tujuh modul Admin inline, pengurusan operasi/master data, foto profil private dengan thumbnail batch/full on-demand, identifikasi Warden/Guard/Admin, rolling KPI, Enter UX dan cache delivery. GAS Version 32 serta semua smoke test ketika rollout awal disahkan live pada 9 Ogos 2026.
- **10 Ogos 2026:** config-driven production diaktifkan dan disahkan pada GAS Version 36; cache revision `2.2.0-r1`, readiness hijau dan rollback flag-false kekal tersedia tanpa redeployment.
- **11 Ogos 2026:** Announcement Banner V1 dideploy dan disahkan pada GAS Version 37; ticker serta cleanup panduan Pelajar ditutup pada cache `2.2.0-r4`, dengan config-driven kekal Active + Ready.
- **12 Ogos 2026:** duplicate/action loading, dynamic custom payload dan KLINIK config fixes, Admin refresh restore, global auth loader serta foto profil camera/gallery disahkan pada cache r5 (rekod sejarah sebelum cancellation).
- **12 Ogos 2026:** Student cancellation dideploy dan disahkan live untuk pending/approved, mandatory reason, status `DIBATALKAN_PELAJAR`, history/re-request, queue Guard/Warden dan Telegram. Cache r6 serta GAS Version 39 aktif; production beroperasi normal.
- **14 Ogos 2026:** hotfix `39265f1` dideploy sebagai v2.2.1 / cache r1 / GAS Version 40. Blank application open time disahkan kekal kosong dan isu permohonan pagi `PULANG_BERMALAM` telah diselesaikan; baseline **336/336** lulus.
- **14 Ogos 2026:** commits `868c323`, `67b494c` dan `7d4ad23` menutup paparan HEP/Warden, persistence status/header-order serta normalisasi masa/daypart. Close-out tersebut menggunakan v2.2.1 / cache r4 / GAS Version 43 dengan baseline **353/353**.
- **16 Ogos 2026:** commit `967cfd6` menutup hierarki `Status Semasa` dan compact history; commit `f2f55cc` menyelaraskan jumlah/sejarah tahunan. Production v2.3.2 / cache `2.3.2-r1` / GAS Version 44 disahkan melalui smoke test dengan baseline **363/363**.
- **20 Ogos 2026:** commit `d30d8d9` menambah grid responsif khusus pada tiga senarai operasi Guard dan disahkan sebagai dua kolum sebenar pada production desktop. Milestone v2.4.0 / cache `2.4.0-r1` itu tidak mengubah rendering/action Guard atau backend; baseline ketika itu **385/385**.
- **20 Ogos 2026:** commit `dde1fc4` menambah Operational Urgency Foundation Fasa 1 pada backend tanpa perubahan schema atau UI; baseline milestone itu ialah **399/399**.
- **20 Ogos 2026:** commit `89d6b46` melengkapkan Student Live Status Clarity Fasa 2 sebagai presentation frontend yang menggunakan urgency Fasa 1; baseline repo meningkat kepada **410/410** tanpa schema, version atau deployment change.
- **20 Ogos 2026:** commit `5443375` melengkapkan Warden Approval Prioritisation + Emergency Mode Fasa 3 sebagai repository milestone; baseline repo meningkat kepada **420/420** dan focused suite **10/10** tanpa schema, version atau deployment change.

## Production Validation v1.7.0

Ujian production berjaya menggunakan request `OUT-20260726-121316-1479`:

- status utama: `SELESAI`;
- `selfie_status`: `SUDAH_HANTAR`;
- `selfie_file_id` dan `selfie_url`: terisi;
- `masa_selfie`: `2026-07-26 12:18:00`;
- `selfie_telegram_message_id`: `98`;
- imej berjaya disimpan dalam Drive private dan dihantar ke Telegram.

## Future Work

- Google/domain login atau stronger auth.
- Hashed PIN storage.
- Backend-issued session token.
- Audit log dan selfie retention/deletion policy.
- Admin/Warden evidence review UI.
- Automated cleanup selepas retention period.
- Telegram retry queue.
- Consent/privacy notice refinement.
- QR code.
- Review polisi bagi timing yang benar-benar indeterminate ketika `confirmIn`; sementara ini historical `lewat` disimpan secara konservatif sebagai `Ya`, manakala active malformed record menggunakan `needs_review=true`.
- Bina Fasa 4+ di atas Fasa 1–3: Admin operational intelligence/`Perlu Tindakan`, Telegram timed reminder/escalation + GAS trigger dan guardian/waris shortcut masih belum dilaksanakan.
- Pertimbang snapshot `earliest_departure_time` per request dalam schema/version masa hadapan supaya perubahan config tidak mentafsir semula fallback-only Warden priority.
- Automated reports dan version injection.
