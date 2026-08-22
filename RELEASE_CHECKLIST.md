# eOuting v2.0.0 Release Checklist

Dokumen ini ialah runbook terkawal untuk release frontend production v2.0.0 dan kesinambungan ujian beta. Ia tidak memberi kebenaran automatik untuk migration, deployment atau pengaktifan feature flag.

> Catatan semasa (22 Ogos 2026): bahagian release lama di bawah ialah rekod sejarah. Aplikasi kekal v2.4.0 dengan cache `2.4.0-r7`; backend production ialah GAS Version 52 pada deployment/URL sedia ada. Phase 6 Guardian Contact Shortcut dan Generic Application Date Window berstatus COMPLETE / PRODUCTION VERIFIED. No-Guard Departure kekal sambungan operasi selepas Fasa 5 dan kini enabled melalui Admin. Baseline penuh ialah **501/501**. Source backend kanonik ialah `gas/Code.gs`; `gas/Code.production-v171.gs` tidak boleh dideploy.

## Close-out Generic Application Date Window — 22 Ogos 2026

- [x] Commit `76c6898` (`feat: add outing application date window`) pushed ke `main` dan OneDrive reference clone diselaraskan.
- [x] `application_open_date` dan `application_close_date` ditambah generik kepada `OUTING_TYPES`, bukan khusus `CUTI_SEMESTER`.
- [x] `setupAdminOutingConfigV200()` dijalankan; migration idempotent menghasilkan `AC`/`AD`, row sedia ada kekal blank dan `OUTING_REQUESTS` tidak berubah.
- [x] Admin save/reload mengesahkan tarikh sementara, summary `Buka`/`Tutup`, kenaikan config version, kemudian clear/reload kembali kepada `Tiada had tarikh` tanpa current-date fallback.
- [x] Student smoke sebelum future open date sampai ke backend, memasuki state menghantar, ditolak dengan mesej tarikh yang tepat dan tidak menambah row `OUTING_REQUESTS`.
- [x] Date bounds inklusif menggunakan `Asia/Kuala_Lumpur`; `allowed_days` dan application time window kekal additive dan backend authoritative.
- [x] Release sequence mengesahkan clasp user/tracked files/manifest, `clasp push`, migration, schema, GAS Version 52, existing deployment in-place, `@HEAD` untouched dan frontend r7 live.
- [x] Display version v2.4.0, asset/cache `2.4.0-r7` / `eouting-cache-v2.4.0-r7`, GAS Version 52 dan full regression **501/501**.
- [x] Tiada auto-population date window, lifecycle/approval/Guard/No-Guard/Guardian Contact/Telegram/trigger/Script Properties atau schema selain additive `OUTING_TYPES` change.

## Close-out Phase 6 — 22 Ogos 2026

- [x] Guardian Contact Shortcut Warden/HEP production verified bagi pending/approved `KECEMASAN` dan `KELUAR + CRITICAL/ACTION_REQUIRED`.
- [x] Broad projection hanya membawa `guardian_contact_available`; contact sebenar memerlukan authenticated `getGuardianContact`, authoritative recheck dan successful privacy-safe audit.
- [x] `AUTO_CONFIG_V2` emergency kekal `DILULUSKAN_WARDEN`, muncul di `Telah Diluluskan / Risiko Pulang`, tidak masuk pending queue dan tidak memerlukan approval kedua.
- [x] Guard kekal normal checkout authority; No-Guard kekal fallback sahaja.
- [x] Student smoke mengesahkan label Kecemasan, submission/auto-approval dan lifecycle; Warden/HEP smoke mengesahkan card, shortcut, contact reveal dan safe phone link.
- [x] Commit chain: `9c16f47`, `0caa4fc`, `67d493c`, `3e21c26`, `4c16b0a`.
- [x] Display version v2.4.0, asset/cache `2.4.0-r6` / `eouting-cache-v2.4.0-r6`, GAS Version 51 dan full regression **490/490**.
- [x] Tiada schema, lifecycle, trigger, Telegram cadence, Phase 5 threshold, Script Properties atau deployment ID/URL change.

## Guardrail release GAS semasa

Sebelum mencipta immutable version atau mengemas kini deployment Web App production:

- [ ] Sahkan `gas/appsscript.json` valid dan tepat mengekalkan `timeZone=Asia/Kuala_Lumpur`, `runtimeVersion=V8`, `webapp.executeAs=USER_DEPLOYING` serta `webapp.access=ANYONE_ANONYMOUS`.
- [ ] Jalankan full regression suite dan pastikan baseline semasa sekurang-kurangnya **501/501**, bersama syntax checks dan `git diff --check`.
- [ ] Sahkan login Admin berjaya dengan No-Guard ON dan OFF; toggle tidak boleh mengubah authentication atau derivation class.
- [ ] Sahkan pilihan kelas Pelajar datang secara dinamik daripada data, termasuk satu kelas bukan A2/A3 sebagai regression sentinel (contohnya LI), tanpa menjadikannya business rule.
- [ ] Sahkan flow Guard biasa keluar/masuk kekal laluan utama dan No-Guard hanya fallback yang dikawal Admin serta disahkan Warden.
- [ ] Kemas kini **deployment Web App production sedia ada** in-place; jangan cipta Web App pendua dan jangan ubah deployment ID/URL.
- [ ] Pilih immutable version baharu yang dimaksudkan; jangan ubah deployment `@HEAD`.
- [ ] Selepas deployment, smoke-test Admin, Pelajar dengan class dinamik, Warden, Guard dan endpoint production.
- [ ] Sahkan hanya satu trigger `scanReturnOperationalNotifications_` kekal, time-driven setiap lima minit.

Version 47 merekodkan pengajaran penting: deployment No-Guard MVP menggunakan immutable manifest tanpa block Web App yang established, lalu Admin login ditolak dan kelas dinamik LI hilang. Ini bukan data corruption dan bukan kegagalan business logic No-Guard; production segera rollback kepada Version 46. Version 48 memulihkan manifest serta login/class dinamik. Version 49 menambah request Telegram/operational URL, dan Version 50 menambah completion Telegram Warden. Version 50 deployed tetapi completion Telegram belum direkod sebagai visually verified live.

## Close-out Production v2.3.2 — 16 Ogos 2026

- [x] Commit `967cfd6` memindahkan `Status Semasa` ke atas borang dan memadatkan bahagian bawah kepada Refresh Status, jumlah tahunan dan `Rekod Outing Saya`.
- [x] Commit `f2f55cc` menyelaraskan jumlah outing dan sejarah kepada rekod authenticated `SELESAI` bagi tahun semasa.
- [x] Response sejarah hanya mengandungi `tarikh`, `jenis_permohonan` dan `status`; ownership Pelajar diperkukuh dan rekod disusun paling baharu dahulu.
- [x] Frontend v2.3.2, revision `2.3.2-r1`, cache `eouting-cache-v2.3.2-r1` dan GAS Version 44 disahkan production.
- [x] Smoke test production mengesahkan jumlah tahunan dan sejarah tahunan sepadan.
- [x] Full Node suite lulus **363/363**.

## Close-out Production Fixes v2.2.1 — 14 Ogos 2026 (sejarah)

- [x] Commit `868c323` membezakan `Diluluskan HEP` dan `Diluluskan Warden` menggunakan prefix authoritative `WARDENS.warden_id`, tanpa status lifecycle atau kolum baharu.
- [x] Commit `67b494c` mengesahkan status awal, memetakan append mengikut header Sheet sebenar dan membaca semula status persisted; status kosong dipaparkan sebagai `Status Tidak Diketahui`.
- [x] Commit `7d4ad23` menormalkan masa sahaja Sheet kepada `HH:mm`, membetulkan paparan `22:00`, Telegram, Guard timing dan late comparison tanpa offset hack.
- [x] Helper daypart menggunakan `01:00–11:59` Pagi, `12:00–12:59` Tengah Hari, `13:00–18:59` Petang dan `19:00–00:59` Malam.
- [x] Frontend v2.2.1, revision `2.2.1-r4`, cache `eouting-cache-v2.2.1-r4` dan GAS Version 43 disahkan production.
- [x] Full Node suite lulus **353/353** pada 14 Ogos 2026.

## Close-out Optional Application-Time Hotfix v2.2.1 — 14 Ogos 2026 (sejarah)

- [x] Commit `39265f1` (`fix: allow clearing outing application times`) disahkan live.
- [x] Admin boleh mengosongkan `Masa Permohonan Dibuka` dan `Masa Permohonan Ditutup` melalui butang `Kosongkan`.
- [x] Empty string menggunakan `clearContent()` supaya nilai Sheet benar-benar kosong dan kekal kosong selepas save/refresh.
- [x] Blank open/close time bermaksud tiada threshold masa bagi medan itu; `allowed_days` kekal authoritative.
- [x] Isu permohonan pagi `PULANG_BERMALAM` akibat nilai pembukaan `12:00` telah diselesaikan.
- [x] Frontend v2.2.1, revision/cache `2.2.1-r1` dan GAS Version 40 disahkan production.
- [x] Full Node suite lulus **336/336**.

## Close-out Production — 12 Ogos 2026

- [x] Duplicate submission Pelajar dilindungi oleh frontend in-flight state dan atomic backend `ScriptLock` bagi active status.
- [x] Approve/reject Warden serta confirm-out/confirm-in Guard mempunyai loading/in-flight protection.
- [x] Dynamic outing payload menggunakan requirement config; standard types dan custom `KLINIK` disahkan.
- [x] `Masa Keluar Paling Awal` boleh dikosongkan tanpa current-time fallback; readiness mengesan kombinasi config bercanggah.
- [x] Admin session refresh disahkan melalui sessionStorage tab + mandatory `loginAdmin` revalidation, absolute expiry 12 jam dan tiada PIN dalam localStorage.
- [x] Global login/restore loader disahkan untuk Pelajar, Warden, Guard dan Admin; Public Pemantauan kekal berasingan.
- [x] Student profile photo menawarkan `Ambil Foto`, `Pilih dari Galeri` dan `Batal`; kamera/galeri berkongsi pipeline dan return-selfie tidak berubah.
- [x] Cancellation pending dan selepas approval disahkan menggunakan button/action sheet yang sama bagi standard serta custom type.
- [x] Sebab wajib 5–500 aksara disahkan frontend/backend; whitespace-only/terlalu pendek/panjang ditolak.
- [x] `DIBATALKAN_PELAJAR` masuk sejarah, tidak masuk queue Guard/Warden, tidak dikira sedang keluar/selesai dan membenarkan Pelajar memohon semula.
- [x] Race Guard `confirmOut` disahkan tidak membenarkan `KELUAR` ditimpa cancellation.
- [x] Telegram cancellation disahkan bagi pending dan approved dengan tepat satu mesej; failure tidak rollback cancellation.
- [x] Mobile/PWA disahkan pada revision `2.2.0-r6` dengan cache `eouting-cache-v2.2.0-r6`.
- [x] GAS Version 39 live dan cancellation smoke test production lulus.
- [x] Full Node suite semasa lulus **332/332**; syntax checks frontend/service worker/GAS lulus.

## Close-out Announcement Banner V1 — 11 Ogos 2026

- [x] `Notis Banner` Admin dan tiga action POST authenticated live pada GAS Version 37.
- [x] Satu banner global disimpan dalam Script Properties tanpa sheet atau setup property manual.
- [x] Normal `MAKLUMAN`, Important `PENTING`, timestamp dan current state disahkan.
- [x] Ticker berterusan, hover/focus/touch pause dan paparan reduced-motion statik disahkan.
- [x] Pelajar, Warden/HEP, Guard dan Admin authenticated boleh melihat banner; landing dan Public Pemantauan kekal tanpa banner.
- [x] Ayat panduan Pelajar pendua dibuang; `ruleNotice`, Announcement Banner dan borang outing kekal.
- [x] Focused tests lulus **12/12** dan full Node suite lulus **287/287**.
- [x] Displayed version kekal v2.2.0 dan cache revision ditutup pada `2.2.0-r4`.

## Close-out Config-driven Production — 10 Ogos 2026

- [x] `OUTING_CONFIG_V2_ENABLED=true` diaktifkan secara terkawal selepas Admin readiness hijau.
- [x] `OUTING_TYPES` menjadi source authoritative dan Tetapan Outing menjadi interface konfigurasi operasi.
- [x] Status Admin dipadatkan kepada `Config Active`, `Legacy` atau `Config Issue` dengan reason access yang accessible.
- [x] `PULANG_BERMALAM` menerima permohonan pada mana-mana hari, tetapi departure production semasa ialah Jumaat mulai `17:00`; masa boleh diubah Admin mengikut arahan HEP.
- [x] Submission, Warden approval dan early Guard rejection lulus smoke test production.
- [x] Bug payload tarikh overnight yang ditemui semasa activation test telah dibaiki dan diuji semula.
- [x] Guard menerima mesej polisi tarikh/hari/masa yang selamat; error lain kekal generik.
- [x] GAS Version 36 dideploy tanpa menukar URL production.

Rollback config-driven tidak memerlukan redeployment: tetapkan `OUTING_CONFIG_V2_ENABLED=false` untuk kembali kepada submission/config legacy. Reactivation menggunakan `true` hanya selepas Tetapan Outing menunjukkan readiness hijau.

## Close-out Production v2.2.0 — 9 Ogos 2026

- [x] GAS Version 32 dideploy pada deployment Web App sedia ada tanpa menukar URL/access settings.
- [x] Flow Pelajar, Warden/HEP, Guard dan enam modul Admin telah melalui smoke test production.
- [x] Foto profil private, batch thumbnail dan full preview on-demand disahkan live.
- [x] Public Pemantauan kekal photo-free dan Public Statistik tidak tersedia.
- [x] Enter UX, rolling KPI dan cache/service-worker delivery disahkan.
- [x] `APP_VERSION`, `version.json`, footer, asset query strings dan `CACHE_NAME` diselaraskan kepada `2.2.0`.
- [x] `clasp show-file-status`/`.claspignore` mengehadkan source deploy kepada `gas/appsscript.json` dan `gas/Code.gs`.
- [x] Dokumentasi current-state dan changelog disatukan untuk release v2.2.0.

Urutan release seterusnya kekal: jalankan tests dan diff/status checks; semak `clasp show-file-status`; jalankan `clasp push` hanya jika GAS berubah; edit deployment Web App sedia ada kepada `New version`; kekalkan URL/access; authorize jika diminta; smoke-test production dan GitHub Pages/cache; kemudian tutup metadata frontend selepas backend production disahkan.

## Keputusan v2.0 — Rekod Sejarah

- Status code: rollout production selesai dan disahkan pada 4 Ogos 2026.
- Status production frontend v2.0: berjaya.
- Versi production repo: `v2.0.0`.
- Backend production: GAS Version 24, telah melalui smoke test Spreadsheet dan login Admin.
- `OUTING_CONFIG_V2_ENABLED=false`; validation submission legacy kekal aktif.
- `TELEGRAM_ENABLED=true` kekal aktif.

## Rekod Pengesahan Production — 4 Ogos 2026

- [x] Frontend live di `https://itumelaka.github.io/eouting/`.
- [x] Footer memaparkan `v2.0.0`.
- [x] Badge `BETA API` tidak dipaparkan dan data production digunakan.
- [x] Admin production login berjaya.
- [x] Flow Pelajar, Warden dan Guard berjaya dimuatkan.
- [x] Public Monitoring berfungsi pada klik pertama.
- [x] Statistik berjaya dimuatkan.
- [x] Intentional auto-scroll mobile berjalan lancar.
- [x] Backend production kekal GAS Version 24.
- [x] `OUTING_CONFIG_V2_ENABLED=false`; validator submission legacy masih aktif.
- [x] `TELEGRAM_ENABLED=true`.
- [x] Suite automatik penuh lulus **177/177** sebelum deployment.
- [x] Merge commit production ialah `4eedcbe` (`release: deploy eOuting v2.0.0`).

## Had Beta yang Diketahui — Rekod Sejarah

- Gunakan lima jenis seed dahulu. Jenis custom belum dijamin mempunyai label mesra pengguna dalam semua mesej Telegram.
- Statistik masih mengira kategori legacy dan belum dinamik sepenuhnya untuk jenis custom.
- `require_selfie` tersedia dalam schema/Admin tetapi belum mengubah lifecycle selfie. Jangan gunakan nilai ini sebagai kawalan operasi sehingga fasa susulan siap.
- `require_warden_approval = false` menyebabkan auto-approval backend `AUTO_CONFIG_V2`; kekalkan `true` untuk semua row beta sehingga ujian khusus diluluskan.
- PIN Admin masih disimpan dalam Sheet. Gunakan PIN unik beta, hadkan editor Sheet dan jangan guna semula PIN peribadi/warden/guard.

## Gate 0 — Kelulusan dan Persekitaran

- [ ] Pemilik release dinamakan.
- [ ] Tarikh/tetingkap beta dipersetujui.
- [ ] Tentukan sama ada beta menggunakan salinan Spreadsheet/GAS berasingan atau production secara terkawal.
- [ ] Untuk ujian pertama, utamakan salinan Spreadsheet dan deployment GAS beta berasingan.
- [ ] Sahkan URL frontend beta tidak menggantikan GitHub Pages production tanpa kelulusan.
- [ ] Rekod deployment GAS production semasa dan commit/tag terakhir yang diketahui stabil.
- [ ] Sahkan semua pihak memahami had beta di atas.

## Gate 1 — Baseline Code dan Versi

- [ ] Branch ialah `feat/admin-outing-config-v2` atau branch release yang diluluskan.
- [ ] Working tree telah diaudit; tiada fail rahsia, data Sheet atau PIN sebenar.
- [ ] `node --check assets/app.js` lulus.
- [ ] `type gas\Code.gs | node --check -` lulus.
- [ ] `node --test tests/*.test.js` lulus sepenuhnya.
- [ ] `git diff --check` lulus.
- [ ] Semak `APP_VERSION`, `version.json`, footer, asset query strings dan `CACHE_NAME` masih konsisten.
- [x] Metadata runtime, footer, asset query, `version.json` dan cache dibump secara atomik kepada `2.0.0`.
- [ ] Kemas kini release note beta tanpa menukar manifest identity, scope atau icon secara tidak sengaja.
- [ ] Jalankan semula semua syntax check dan tests selepas version bump.

## Gate 2 — Backup dan Migration

- [ ] Export/backup keseluruhan Spreadsheet sebelum migration.
- [ ] Rekod nama fail backup, masa dan pemiliknya.
- [ ] Sahkan tab `OUTING_REQUESTS`, `STUDENTS`, `WARDENS`, `GUARDS` dan `AUDIT_LOG` boleh dibaca.
- [ ] Jalankan `setupAdminOutingConfigV200()` sekali pada persekitaran beta/diluluskan.
- [ ] Jalankan fungsi yang sama kali kedua dan sahkan tiada duplicate seed/header.
- [ ] Sahkan `OUTING_TYPES` mempunyai tepat lima seed yang dijangka.
- [ ] Sahkan `ADMIN_USERS` wujud tetapi kosong; migration tidak boleh seed Admin.
- [ ] Sahkan `AUDIT_LOG` mendapat `entity_type` dan `entity_id` di hujung tanpa susun semula data lama.
- [ ] Sahkan `OUTING_REQUESTS` dan semua rekod legacy tidak berubah.
- [ ] Sahkan Script Property `OUTING_CONFIG_V2_ENABLED` ialah `false`.

## Gate 3 — Semakan OUTING_TYPES

- [ ] `OUTING_BIASA` aktif, Selasa/Rabu, buka `17:00`, pulang tetap `22:00`.
- [ ] `OUTING_HUJUNG_MINGGU` aktif, Sabtu/Ahad, hari sama, pulang tetap `22:00`.
- [ ] `KECEMASAN` aktif, semua hari, sebab kecemasan wajib.
- [ ] `PULANG_BERMALAM` aktif, tarikh/masa balik serta waris wajib.
- [ ] `CUTI_SEMESTER` aktif, tarikh/masa balik serta waris wajib.
- [ ] Semua row mempunyai `config_version = 1` selepas seed.
- [ ] Semua `type_code` uppercase, unik dan tidak diubah.
- [ ] Semua row beta mengekalkan `require_warden_approval = true`.
- [ ] Jangan tambah jenis custom sebelum lima flow seed lulus hujung-ke-hujung.

## Gate 4 — Admin Sebenar

- [ ] Tambah satu row Admin secara manual; jangan ubah migration untuk seed akaun.
- [ ] Gunakan `admin_id` unik, `nama_admin`, PIN unik dan `status = AKTIF`.
- [ ] Jangan commit, screenshot atau log PIN.
- [ ] Hadkan akses editor Spreadsheet kepada pegawai yang diperlukan sahaja.
- [ ] Uji login betul, PIN salah dan Admin tidak aktif.
- [ ] Sahkan response, console, localStorage, sessionStorage dan audit tidak mengandungi PIN.
- [ ] Sediakan prosedur menukar/menyahaktif PIN selepas beta.

## Gate 5 — Deploy GAS Beta dengan Flag False

- [ ] Cipta version GAS beta baharu tanpa menggantikan deployment production sebelum diluluskan.
- [ ] Pastikan execute-as/access setting sama seperti polisi sedia ada.
- [ ] Rekod version/deployment ID beta tanpa merekod credential.
- [ ] Pastikan frontend beta menunjuk URL GAS beta yang betul.
- [ ] Sahkan `OUTING_CONFIG_V2_ENABLED = false` selepas deploy.
- [ ] GET health berjaya.
- [ ] Public GET `getOutingTypes` memulangkan lima fallback legacy yang selamat.
- [ ] Admin login dan `getAdminOutingTypes` berfungsi melalui POST.
- [ ] Create/edit/toggle diuji dengan jenis QA atau salinan data, termasuk conflict version.
- [ ] Sahkan tiada delete control/API.

## Gate 6 — Regression Semua Role dengan Flag False

- [ ] Pelajar A2 login dan submit setiap jenis yang relevan.
- [ ] Pelajar A3 login dan rekod dipadankan kepada akaun sendiri.
- [ ] Duplicate permohonan aktif ditolak.
- [ ] Warden melihat, meluluskan dan menolak permohonan.
- [ ] Guard mengesahkan keluar dan masuk.
- [ ] Selfie pulang berfungsi seperti production semasa.
- [ ] Public Monitoring tidak mendedahkan data sensitif.
- [ ] Statistik sedia ada masih berfungsi untuk lima kategori legacy.
- [ ] Telegram menerima mesej tanpa PIN/config penuh.
- [ ] Refresh, cache/PWA dan logout semua role diuji pada desktop dan telefon.

## Gate 7 — Activation Terkawal

- [ ] Semua Gate 0–6 ditandatangani oleh pemilik release.
- [ ] Backup masih tersedia dan boleh dikenal pasti.
- [ ] Catat nilai flag sebelum perubahan.
- [ ] Aktifkan `OUTING_CONFIG_V2_ENABLED = true` secara manual sahaja.
- [ ] Uji public `getOutingTypes`: active sahaja, susunan betul, safe fields sahaja.
- [ ] Uji submit lima jenis seed dengan validation config-driven.
- [ ] Uji inactive/missing/malformed config ditolak secara selamat.
- [ ] Uji `fixed_return_time`, `same_day_only`, hari dan application window.
- [ ] Uji duplicate protection selepas flag aktif.
- [ ] Uji Admin edit/toggle dan optimistic conflict.
- [ ] Uji Warden/Guard/Monitoring/Selfie/Telegram sekali lagi.
- [ ] Jangan cipta jenis custom atau set `require_warden_approval = false` sehingga ujian berasingan diluluskan.

## Gate 8 — Go/No-Go

- [ ] Tiada ralat kritikal atau kebocoran credential/PII.
- [ ] Tiada kehilangan atau perubahan rekod legacy.
- [ ] Semua role lulus pada peranti sasaran.
- [ ] Rollback telah diuji atau sekurang-kurangnya disimulasikan pada beta.
- [ ] Jika mana-mana gate gagal, keputusan ialah No-Go dan flag dikekalkan/dikembalikan kepada `false`.
- [ ] Jika semua gate lulus, rekod keputusan, masa, version GAS dan pegawai yang meluluskan.

## Rollback Plan

Gunakan urutan paling kecil dahulu:

1. Tetapkan `OUTING_CONFIG_V2_ENABLED = false` dan sahkan submission kembali ke validator legacy.
2. Jika frontend beta bermasalah, pulihkan frontend/tag/version stabil terakhir dan bump cache/asset metadata secara konsisten.
3. Jika backend masih bermasalah, pilih semula deployment GAS stabil terakhir sambil mengekalkan URL production yang diluluskan.
4. Uji login Pelajar, submit legacy, Warden approve, Guard keluar/masuk dan Public Monitoring.
5. Jangan padam `OUTING_TYPES`, `ADMIN_USERS`, kolum tambahan `AUDIT_LOG` atau rekod config semasa rollback.
6. Nyahaktifkan Admin beta jika akses tidak lagi diperlukan; jangan padam audit.
7. Rekod insiden, masa rollback, version yang dipulihkan dan pemeriksaan data selepas rollback.

Rollback frontend dan GAS tidak semestinya perlu dilakukan serentak. Flag `false` ialah kill switch pertama kerana ia memulihkan validation submission legacy tanpa memusnahkan schema atau data config.
