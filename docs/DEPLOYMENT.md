# Deployment eOuting ITU

Versi aplikasi production semasa: **v2.4.0**, cache/asset `2.4.0-r21`, service worker `eouting-cache-v2.4.0-r21` dan GAS **Version 57**. Full regression terakhir sebelum release ialah **744/744**.

## Production Version 57 — verified 27 Ogos 2026

- Frontend aktif tunggal ialah repository `itumelaka/eouting` pada `https://itumelaka.github.io/eouting/`. Repository `itumelaka/eoutingV2` telah retired/archived read-only dan routing `/eoutingV2` tidak lagi disokong.
- Existing production deployment berada pada Version 57 dengan description `eOuting v2.4.0 production - PERF-01 Phase 1 + config readiness fix`. Staging juga Version 57.
- Isolated Version 55 dikekalkan sebagai rollback/control dan bukan active production. Jangan arahkan frontend production kepadanya kecuali rollback terkawal diluluskan.
- Production smoke selesai dengan berjaya; Admin Config Readiness memaparkan `Config Active`.
- Readiness fix membenarkan configured `departure_allowed_days` dengan `same_day_only=true` walaupun `require_leave_date=false`. Non-same-day masih memerlukan leave date; runtime departure-day enforcement, Pulang Bermalam dan Guard approved-date validation tidak berubah.
- PERF-01 Phase 1 dan UI contrast/brightness close-out disahkan melalui full suite **744/744** dan pemerhatian pengguna production yang lebih pantas/lancar.
- Deferred performance backlog kekal berasingan: Telegram synchronous latency, GET timeout/retry policy, cache TTL/polling efficiency, large first-load images/assets dan broader lock/index architecture. Tiada satu pun item ini dianggap fixed oleh Version 57.

## Version 56 HOLD selepas insiden delivery — rekod sejarah 25 Ogos 2026

- P0-1 + P0-2 dipush ke source Apps Script, stored Version 56 `eOuting v2.4.0 performance P0-1 P0-2` dicipta dan production ditukar sementara daripada Version 55 kepada Version 56.
- Version 56 menunjukkan intermittent HTML 404 `script.googleusercontent.com`, latency teruk, browser fetch/CORS-like failures dan kegagalan health endpoint. Production segera dirollback kepada Version 55 dan kemudian lulus 10/10 health checks.
- Staging awam Version 56 yang diasingkan turut menghasilkan semula instability; fresh Version 55 control stabil. Staging Version 56 kemudian sihat tanpa perubahan source/metadata, sementara execution `doGet` berkorelasi selesai normal dalam beberapa saat walaupun client stalled atau menerima HTML 404.
- Bukti paling kuat menunjukkan anomali rollout/propagation redirect/result-delivery selepas execution yang berkaitan dengan Version 56. Google tidak mengesahkan outage dan P0 tidak dianggap terbukti innocent; **source-level evidence did not demonstrate P0 logic as the cause**.
- Pada close-out sejarah ini production kembali kepada Version 55 dengan description `eOuting v2.4.0 temporary rollback for production stability`. Keadaan itu telah digantikan oleh rollout Version 57 pada 27 Ogos 2026.

Announcement Banner authenticated POST turut gagal dimuat dalam window sama. Backend path banner tidak berubah dalam Version 56, tetapi POST tidak mempunyai `AbortController`/timeout 22 saat setara GET dan network/server errors disenyapkan sebagai banner tersembunyi. Corak itu konsisten dengan insiden delivery lebih luas, namun tiada execution banner `doPost` tertentu dapat dikenal pasti secara unik. POST resilience kekal backlog.

### Operational gate sebelum controlled retry — rekod sejarah

Selepas sekurang-kurangnya 24 jam, staging Version 56 yang diasingkan mesti lulus 10 health request sequential dengan `_ts` unik, tiga health request pada concurrency 3, dan lima current-hostel summary request. Gate memerlukan sifar HTML/404, sifar timeout, semua hostel-summary di bawah timeout frontend 22 saat dan privacy public kekal aggregate-only. Ini gate validasi operasi untuk retry, bukan SLA kekal.

## Student Groups / Dynamic Login / Current Hostel Residents close-out — 22 Ogos 2026

- Migration LI selesai: 19 written, 0 unmatched, 0 conflicts; readiness mencapai Ready dan `STUDENT_GROUP_CONFIG_ENABLED=true`.
- Smoke login berjaya untuk A2, A3, LI UMK dan LI UPM. Rollback operasi ialah `Admin -> Tetapan Pelajar -> Kembali ke Login Legacy`.
- Active-request form suppression disahkan bagi Pelajar dengan request aktif dan tiada request.
- Public aggregate Current Hostel Residents serta authenticated Guard roster disahkan; privacy split dan dynamic grouping tepat.
- Milestone ini menggunakan Version 55 dan frontend r20 pada 25 Ogos; current production kemudian maju ke Version 57/r21 pada 27 Ogos. UI r13–r20 sendiri tidak memerlukan deployment backend baharu.
- Operasi penghuni semasa hendaklah ditafsir sebagai “Anggaran semasa berdasarkan rekod keluar/masuk eOuting.” Hanya `KELUAR` bermaksud outside; approved-but-not-checked-out kekal in hostel, `SELESAI` kembali in hostel dan inactive Student dikecualikan.

## Generic Application Date Window production close-out — 22 Ogos 2026

Release commit `76c6898` (`feat: add outing application date window`) menggunakan sequence terkawal berikut: clasp authorized user dan tracked files disahkan; canonical `gas/appsscript.json` disemak; `clasp push` selesai; `setupAdminOutingConfigV200()` dijalankan; schema AC/AD disahkan; GAS Version 52 dicipta; existing production deployment dikemas kini in-place; deployment `@HEAD` tidak disentuh; commit dipush ke `main`; OneDrive reference clone diselaraskan; frontend r7 disahkan live; kemudian Admin dan Student smoke diluluskan. Deployment ID/URL kekal.

Migration menambah `application_open_date` dan `application_close_date` secara idempotent di hujung `OUTING_TYPES`, tanpa reorder destructive, tanpa perubahan `OUTING_REQUESTS` dan tanpa auto-population. Semua row production disahkan blank selepas migration.

Admin persistence smoke menggunakan `CUTI_SEMESTER` secara sementara sahaja: `2026-10-09`/`2026-10-10` persisted selepas save/reload, summary menunjukkan `Buka 09 Oktober 2026` dan `Tutup 10 Oktober 2026`, serta config version meningkat. Kedua-dua tarikh kemudian dikosongkan; save/reload mengembalikan `Tiada had tarikh`, blank kekal dan tiada current-date fallback. Tarikh ujian tersebut bukan konfigurasi production aktif.

Student enforcement smoke menggunakan future open date sementara. UI memaparkan `Permohonan dibuka mulai 1 Oktober 2026.`; percubaan submission memasuki state `Menghantar`, sampai ke GAS, ditolak backend dengan mesej sama dan tidak menambah row Cuti Semester dalam `OUTING_REQUESTS`. Tarikh sementara kemudian dibersihkan. Ini mengesahkan frontend notice ialah guidance dan backend `Asia/Kuala_Lumpur` ialah authority sebelum persistence.

## Phase 6 production verification — 22 Ogos 2026

- Existing production deployment ID/URL kekal dan GAS **Version 51** menyajikan Guardian Contact Shortcut.
- Student smoke mengesahkan label `KECEMASAN` ialah `Maklumat Tarikh Keluar` / `Tarikh Keluar`, guardian fields hadir mengikut config, submission berjaya dan `require_warden_approval=false` menghasilkan `AUTO_CONFIG_V2` + `DILULUSKAN_WARDEN` tanpa mengubah Guard checkout.
- Warden/HEP smoke mengesahkan auto-approved emergency muncul di `Telah Diluluskan / Risiko Pulang`, bukan `Menunggu Kelulusan`; kad menunjukkan `Kecemasan`, `Diluluskan Warden`, actor `AUTO_CONFIG_V2` dan `📞 Hubungi Penjaga`.
- Fetch contact authenticated berjaya mendedahkan contact secara on-demand dan menghasilkan link `📞 Telefon Sekarang`. Broad list payload kekal tanpa `telefon_waris`/`hubungan_waris`.
- Release chain: `9c16f47` feature, `0caa4fc` smoke normalization, `67d493c` fixed-time clear, `3e21c26` dynamic date labels dan `4c16b0a` auto-approved emergency visibility. Frontend/cache akhir ialah `2.4.0-r6` / `eouting-cache-v2.4.0-r6`.
- Tiada lifecycle, global approval rule, Guard authority, No-Guard semantics, Telegram cadence, Phase 5 threshold, trigger, schema atau Script Properties change dalam close-out ini.

## No-Guard deployment chronology — Versions 47–50

- **Version 47 — `eOuting v2.4.0 No-Guard Departure MVP`:** deployed, kemudian gagal kerana immutable deployment manifest tiada established Web App execution/access block. Valid Admin login ditolak dan class dinamik LI hilang. Rollback segera dibuat kepada Version 46. Tiada data corruption; No-Guard business logic bukan root cause.
- **Version 48 — `eOuting v2.4.0 No-Guard Departure MVP manifest fix`:** commit `ac929e5` memulihkan manifest, Admin/Student login, A2/A3/LI dynamic class regression, Admin config endpoint dan Web App authority. Safe OFF diverifikasi, kemudian ciri diaktifkan melalui Admin dan Student approved request memaparkan `Mohon Pengesahan Keluar`.
- **Version 49 — `eOuting v2.4.0 No-Guard Telegram alerts`:** commit `64963de` menambah one-time request Telegram serta canonical eOuting URL kepada operational messages yang disokong. Live verification mengesahkan waiting UI dan request alert dengan Student/type/location/time/link.
- **Version 50 — `eOuting v2.4.0 Warden remote checkout Telegram`:** commit `1d750ab` menambah one-time completion Telegram selepas transition/audit/flush berjaya. Deployment Version 50 berjaya dan automated baseline ialah 465/465; live visual verification completion message belum direkodkan.

Deployment Web App production kekal ID `AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f` pada URL `https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec`. Manifest kanonik sebelum setiap immutable version mesti disahkan:

```json
{
  "timeZone": "Asia/Kuala_Lumpur",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

Gunakan existing deployment in-place, pilih immutable version yang dimaksudkan, biarkan `@HEAD` tidak disentuh, elakkan Web App pendua, kemudian uji Admin login dan class dinamik termasuk contoh non-A2/A3. Pastikan tepat satu trigger `scanReturnOperationalNotifications_` setiap lima minit kekal.

## Phase 5 production synchronization dan activation — 21 Ogos 2026

- Historical documented current baseline sebelum audit ialah Version 44. Audit deployment mendapati actual production ketika itu ialah Version 45 tanpa description; origin Version 45 tidak diketahui dan tidak diandaikan.
- Existing production deployment `AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f` dikemas kini in-place kepada Version 46 dengan description `eOuting v2.4.0 Phase 1-5 operational safety sync`. URL kekal sama dan tiada Web App atau API executable deployment baharu dicipta.
- Manifest production ketika baseline itu menggunakan timezone kanonik `Asia/Kuala_Lumpur`, access `ANYONE_ANONYMOUS` dan execute-as `USER_DEPLOYING`.
- Sebelum sync, latest Apps Script HEAD/manual dry-run mengelaskan `OUT-20260820-234127-3513` sebagai `ACTION_REQUIRED`, tetapi deployed PWA memaparkan `MAKLUMAT WAKTU PULANG PERLU DISEMAK`. Selepas Version 46, Student dan Admin sama-sama menunjukkan lifecycle `KELUAR`, urgency `ACTION_REQUIRED`, expected return `2026-08-20 22:00` dan queue Admin `Perlu Tindakan -> Tindakan Segera`. Kesimpulan: deployment lama menyajikan code revision lebih lama daripada latest project source; data tidak corrupt.
- Controlled dry-run melalui `runReturnOperationalNotificationsDryRun()` pada `2026-08-20T23:49:09+08:00` menghasilkan satu PREVIEW `ACTION_REQUIRED`, zero send/failure/audit write dan trigger count sifar. Wrapper maintenance ini parameterless, hard-coded dry-run dan tidak exposed melalui frontend/HTTP routes.
- Satu controlled real Telegram send berjaya bagi test request; `RETURN_ACTION_REQUIRED_SENT` menaikkan `AUDIT_LOG` 1036 -> 1037 dan same-stage check memulangkan `ALREADY_SENT` tanpa send kedua.
- Tepat satu time-driven trigger setiap lima minit kini menyasarkan `scanReturnOperationalNotifications_`, ID `9156626915782557696`. Wrapper dry-run bukan trigger target. Scheduled call tanpa options ialah non-dry production mode.
- First natural execution pada `21 Aug 2026, 08:10:59` completed dalam `21.761` saat dengan displayed error rate `0%`; audit kekal 1037 dan tiada notification baharu diperhatikan.

### Trigger verification dan containment

Dalam Apps Script, halaman Triggers mesti menunjukkan tepat satu scanner trigger: handler `scanReturnOperationalNotifications_`, event source time-driven dan cadence setiap lima minit. Semak halaman Executions untuk timestamp, duration dan status scheduled run. Trigger tambahan bagi handler sama ialah anomaly.

Jika duplicate runaway bagi request/stage yang sama disahkan, emergency containment ialah disable/remove **hanya** scanner trigger tersebut dan hentikan scheduled delivery untuk investigation. Jangan padam atau ubah `AUDIT_LOG` untuk “membaiki” dedup; sejarah audit diperlukan untuk diagnosis. Telegram delivery dan audit write bukan atomic, maka audit-backed idempotency tidak menjamin transactional exactly-once.

## Production verification — Student hierarchy dan annual history (16 Ogos 2026)

- Commit compact history `967cfd6` dan annual-history consistency `f2f55cc` disahkan live.
- `Status Semasa` berada di atas borang, menggunakan rekod live/current dan kekal kawasan authoritative bagi pembatalan serta return-selfie yang layak.
- Bahagian bawah memaparkan Refresh Status, jumlah outing tahunan dan `Rekod Outing Saya` dalam baris ringkas.
- Jumlah dan sejarah menggunakan skop authenticated yang sama: rekod `SELESAI` bagi tahun semasa. Response sejarah hanya membawa `tarikh`, `jenis_permohonan` dan `status`, dengan ownership Pelajar diperkukuh dan rekod terbaru dahulu.
- GAS Version 44 live; smoke test production mengesahkan jumlah tahunan dan sejarah sepadan.
- Frontend v2.3.2, revision `2.3.2-r1`, cache `eouting-cache-v2.3.2-r1` dan full suite **363/363** disahkan.

## Production verification — role, status dan masa (14 Ogos 2026, sejarah)

- Commits `868c323`, `67b494c` dan `7d4ad23` disahkan live pada GAS Version 43.
- Paparan kelulusan HEP/Warden menggunakan prefix authoritative `WARDENS.warden_id`; lifecycle kekal `DILULUSKAN_WARDEN`.
- Status awal submission disahkan dan dipersist mengikut susunan header Sheet sebenar; blank authoritative status tidak dipaparkan sebagai pending.
- Masa sahaja Sheet dinormalkan kepada `HH:mm`; `2026-08-16` + `22:00` dipaparkan sebagai `16 Ogos 2026, 10:00 PTG`, late comparison menggunakan tepat 22:00 dan Telegram tidak mendedahkan tarikh 1899.
- Helper klasifikasi daypart BM menggunakan sempadan Pagi/Tengah Hari/Petang/Malam yang diluluskan; formatter locale generik masih boleh menggunakan singkatan `PTG`.
- Frontend/cache revision `2.2.1-r4`, service worker `eouting-cache-v2.2.1-r4` dan full suite **353/353** disahkan.

## Optional application-time hotfix — historical snapshot (14 Ogos 2026)

- Hotfix `39265f1` (`fix: allow clearing outing application times`) live sebagai v2.2.1, revision/cache `2.2.1-r1` dan GAS Version 40.
- Butang `Kosongkan` bagi masa permohonan dibuka/ditutup disahkan membersihkan cell Sheet melalui `clearContent()` dan blank kekal blank selepas save/refresh.
- Blank open/close time tidak mengenakan threshold masa; `allowed_days` kekal enforced secara berasingan.
- Nilai pembukaan `12:00` pada `PULANG_BERMALAM` telah dikosongkan dan permohonan pagi tidak lagi disekat semata-mata oleh opening time.
- Full Node suite lulus **336/336**.

## Production verification — 12 Ogos 2026

- Admin refresh restore melalui `eouting_admin_session_v1` dan backend `loginAdmin` revalidation disahkan pada refresh berulang.
- Global login/restore loader disahkan untuk Pelajar, Warden, Guard dan Admin tanpa mendedahkan shell Admin sebelum authentication.
- Dynamic payload/config fixes disahkan untuk standard types dan custom `KLINIK`; blank earliest-departure time bermaksud tiada sekatan.
- Student profile-photo action sheet `Ambil Foto` / `Pilih dari Galeri` disahkan pada telefon; return-selfie kekal berasingan.
- Revision r6 memaksa mobile/PWA mengambil UI pembatalan Pelajar tanpa menukar displayed v2.2.0.
- Pembatalan production disahkan bagi request pending: sebab wajib diterima, status menjadi `DIBATALKAN_PELAJAR`, rekod masuk sejarah, permohonan baharu dibenarkan dan Telegram diterima.
- Flow approved menggunakan eligibility/race guard yang sama; cancelled row tidak berada dalam queue Warden/Guard atau status sedang keluar.
- GAS Version 39 menghantar satu Telegram cancellation bagi previous status pending atau approved; delivery failure kekal non-blocking.
- Suite semasa lulus **332/332** dan syntax checks `assets/app.js`, `service-worker.js` serta `gas/Code.gs` lulus.

## Notis Banner V1 — Live

Production GAS Version 37 menyediakan `getAnnouncementBannerAdmin`, `updateAnnouncementBanner` dan `getAnnouncementBanner`; frontend `Notis Banner` telah live dan disahkan. Satu banner global menggunakan Script Properties yang diwujudkan pada simpanan Admin pertama, tanpa sheet `ANNOUNCEMENTS` atau setup property manual. Close-out sejarah ini menggunakan cache `2.2.0-r4`; active cache production semasa ialah `2.4.0-r21`.

Admin UI, save, Normal `MAKLUMAN`, authenticated display, timestamp, ticker berterusan, pause hover/focus/touch, reduced-motion statik dan privacy Public Pemantauan telah disahkan. Focused tests lulus **12/12** dan full Node suite **287/287**. Ayat panduan Pelajar pendua turut dibuang sementara Announcement Banner, `ruleNotice` kuning dan borang kekal. Tiada deployment tambahan diperlukan untuk close-out dokumentasi ini.

## Config-driven Production Activation — 10 Ogos 2026

- `OUTING_CONFIG_V2_ENABLED=true`; `OUTING_TYPES` authoritative dan Tetapan Outing ialah interface operasi.
- Admin menunjukkan chip `Config Active`; readiness ialah `Ready`.
- Smoke test production lulus untuk non-Friday rejection, Friday submission, Warden approval dan rejection awal Guard dengan mesej tarikh yang jelas.
- GAS Version 36 membawa enforcement/feedback akhir tanpa menukar deployment URL atau Spreadsheet.

Emergency rollback:

```text
OUTING_CONFIG_V2_ENABLED=false
```

Kesan: production kembali kepada submission/config legacy tanpa code push, `clasp push` atau deployment GAS. Data `OUTING_TYPES` dan audit tidak dipadam. Untuk reactivation, tetapkan semula `true` hanya selepas Admin menunjukkan readiness hijau dan konfigurasi production telah disemak.

## Release Production v2.2.0 — 9 Ogos 2026 (sejarah sebelum activation)

- GAS Version 33 ialah baseline pada Web App sedia ada dan URL/access settings dikekalkan.
- Dua-tier delivery foto profil (`thumbnail` batch dan `full` on-demand) telah disahkan untuk Pelajar, Warden/HEP, Guard, Admin Pemantauan dan Admin Tetapan Pelajar.
- Public Pemantauan kekal photo-free; return selfie kekal pada folder/schema/Telegram workflow berasingan.
- Enam modul Admin inline, Statistik selamat, Rekod Master, rolling KPI, Enter UX serta cache/service-worker delivery telah melalui smoke test production.
- Pada close-out 9 Ogos, frontend release metadata/cache ialah v2.2.0 dan readiness hardening belum dideploy; keadaan ini digantikan oleh activation Version 36 pada 10 Ogos.

## Release Production v2.1.0 — 9 Ogos 2026

- Release commit: `chore: bump eOuting version to 2.1.0` (commit yang membawa rekod ini).
- Frontend: Guard keluar/masuk diperkemas, kad Sahkan Masuk kompak dan pembaikan rendering Statistik Admin.
- Statistik selamat: jumlah outing tahunan Pelajar, statistik individu Admin berautentikasi dan tempoh sebenar `masa_keluar` → `masa_masuk`.
- Deployment hygiene: `gas/Code.gs` kekal source kanonik dan `.claspignore` mengehadkan skop push.
- GAS production Version 29 telah live sebelum perubahan ini; URL dan Spreadsheet production tidak berubah.

## Rekod Rollout Production v2.0.0 — 4 Ogos 2026

- Frontend production: `https://itumelaka.github.io/eouting/`.
- Merge commit production: `4eedcbe` — `release: deploy eOuting v2.0.0`.
- Footer production memaparkan `v2.0.0`; badge `BETA API` tidak dipaparkan dan data production digunakan.
- Admin production login berjaya; flow Pelajar, Warden dan Guard berjaya dimuatkan.
- Public Monitoring berjaya pada klik pertama, Statistik berjaya dimuatkan dan auto-scroll mobile berjalan lancar.
- Backend kekal GAS deployment **Version 24**; nombor versi frontend dan GAS ialah dua version boundary yang berasingan.
- `OUTING_CONFIG_V2_ENABLED=false`; `submitRequest` production masih menggunakan validation legacy.
- `TELEGRAM_ENABLED=true` kekal aktif.
- Suite automatik penuh lulus **177/177** sebelum deployment.

Rollout ini tidak mengaktifkan config-driven submission dan tidak menukar endpoint production.

## Fasa 5B — Rekod Activation Selesai

Urutan backup, migration idempotent, legacy check, readiness hijau dan controlled activation telah selesai. Production kini menggunakan config-driven submission. Lima flow seed dan consumer dinamik mesti terus diuji apabila konfigurasi operational berubah; active custom config tidak dikecualikan daripada readiness dan regression QA.

## Release Beta v2.0 — sejarah; frontend beta telah retired

Runbook authoritative ialah [`RELEASE_CHECKLIST.md`](../RELEASE_CHECKLIST.md). Display version/`version.json` kekal `v2.4.0`, manakala query CSS/JS, `CACHE_NAME`, app-shell URLs dan regression expectation production semasa diselaraskan kepada `2.4.0-r21`. Arahan beta berikut dikekalkan sebagai sejarah sahaja; `eoutingV2` bukan frontend aktif.

Beta pertama hendaklah menguji lima seed dan sekurang-kurangnya satu jenis custom. Gate mesti meliputi `require_selfie=true/false`, `require_warden_approval=true/false`, audit `AUTO_APPROVE_REQUEST`, Guard transition, Telegram, statistik dan filter. `require_warden_approval=false` kekal high-impact walaupun auto-approval kini eksplisit dan diaudit.

Keutamaan persekitaran ialah salinan Spreadsheet dan deployment GAS beta berasingan. Jika beta perlu menggunakan data production, backup, tetingkap perubahan, pemilik rollback dan kill switch flag mesti disahkan sebelum migration.

## Frontend-only Release

Gunakan flow ini jika `gas/Code.gs` tidak berubah:

1. bump `APP_VERSION` dalam `assets/app.js`;
2. kemas kini `version.json`;
3. bump `CACHE_NAME` dalam `service-worker.js`;
4. selaraskan query string CSS/JS dalam `index.html` dan app-shell service worker;
5. selaraskan footer dan regression expectation;
6. jalankan keseluruhan test suite, syntax checks dan `git diff --check`;
7. commit perubahan;
8. push ke GitHub;
9. tunggu GitHub Pages dan sahkan versi live/PWA update popup.

Untuk perubahan cache-only, displayed `APP_VERSION`/`version.json` boleh kekal jika product version tidak berubah; bump namespace `CACHE_NAME`, query CSS/JS, app-shell URLs dan regression expectation secara konsisten seperti r4 → r5.

v1.6.24 ialah frontend-only release untuk Guard quick filter dan contextual empty-state. v1.7.0 bukan frontend-only kerana melibatkan GAS, schema berasaskan header, Google Drive dan Telegram. v1.7.1 turut mengubah frontend dan GAS bagi `OUTING_HUJUNG_MINGGU`, maka ia bukan frontend-only.

## Backend GAS Release

Gunakan flow ini apabila `gas/Code.gs` berubah:

`gas/Code.gs` ialah satu-satunya source GAS executable kanonik. `.claspignore` mesti kekal sebagai whitelist untuk `Code.gs` dan `appsscript.json`; snapshot arkib tidak boleh berada dalam skop `rootDir` tanpa ignore yang eksplisit.

1. jalankan focused/full tests dan syntax checks;
2. jalankan `git diff --check` serta semak `git status --short`;
3. semak whitelist dengan `clasp show-file-status`;
4. pastikan hanya `gas/appsscript.json` dan `gas/Code.gs` berada dalam skop clasp;
5. commit dan push Git source yang telah disahkan;
6. jalankan `clasp push` hanya apabila GAS berubah;
7. buka Apps Script: `Deploy -> Manage deployments -> Edit`;
8. pilih `New version`;
9. kekalkan deployment URL dan access settings sedia ada, kemudian `Deploy`;
10. authorize jika Google meminta scope semasa;
11. smoke-test endpoint public, POST authenticated dan flow yang terlibat;
12. sahkan GitHub Pages, footer, asset query dan cache delivery;
13. bump/tutup release frontend selepas backend production disahkan, kemudian rekod Git SHA, GAS version, URL, Spreadsheet ID dan tarikh.

`clasp push` sahaja tidak menjamin deployment `/exec` menggunakan code baharu. Deployment version baharu tetap diperlukan.

## Migration staging eOuting v2.0

Fasa 2 menyediakan `setupAdminOutingConfigV200()` tetapi tidak mengarahkan deployment production. Apabila fasa deployment diluluskan kemudian:

1. backup Spreadsheet;
2. sahkan code GAS yang akan dideploy dan `OUTING_CONFIG_V2_ENABLED` belum bernilai `true`;
3. jalankan `setupAdminOutingConfigV200()` sekali;
4. sahkan tab `OUTING_TYPES` mempunyai 26 header dan tepat lima seed unik;
5. sahkan tab `ADMIN_USERS` hanya mempunyai tujuh header tanpa akaun seed;
6. sahkan `entity_type` dan `entity_id` ditambah selepas header lama `AUDIT_LOG` serta row lama tidak berubah;
7. jalankan migration kali kedua dan sahkan `created_type_codes` kosong;
8. sahkan Script Property `OUTING_CONFIG_V2_ENABLED=false`;
9. uji semula `submitRequest` v1.7.1 sebelum mempertimbangkan activation pada fasa lain.

Jangan isi akaun Admin, mengaktifkan feature flag atau menganggap schema staging sebagai authorization boundary. Rollback Fasa 2 tidak boleh memadam tab/kolum yang mungkin sudah mengandungi data; matikan flag dan kembali kepada deployment stabil sambil mengekalkan data additive.

### Pemeriksaan Fasa 3 sebelum deployment masa hadapan

- Pastikan `OUTING_CONFIG_V2_ENABLED=false`; public `getOutingTypes` mesti memulangkan fallback legacy.
- Sahkan tiada akaun Admin contoh atau PIN berada dalam repo, test log atau deployment output.
- Isi akaun Admin sebenar hanya melalui Sheet private dan formatkan PIN sebagai Plain text.
- Uji login berjaya, PIN salah, Admin tidak aktif, optimistic conflict dan audit tanpa PIN.
- Sahkan create/update/toggle hanya melalui POST; jangan buka write action melalui GET.
- Sahkan tiada route delete dan `submitRequest` masih tidak membaca `OUTING_TYPES`.
- Jangan aktifkan flag sehingga Admin UI menunjukkan `Config-driven Ready`, semua sebab readiness kosong, config production disemak oleh Admin/HEP dan rollback production diluluskan.

### Pemeriksaan Admin frontend semasa

- Uji role dan panel login Admin pada desktop serta telefon.
- Pastikan localStorage tidak mengandungi Admin PIN. Dedicated sessionStorage hanya boleh menggunakan key `eouting_admin_session_v1` dengan `identity`, `pin` dan absolute `expiresAt`.
- Pastikan refresh memanggil backend `loginAdmin`, memulihkan Admin apabila credential sah, tidak memanjangkan expiry dan membersihkan session apabila ditolak.
- Uji loading, empty, error, retry, create, edit, toggle dan conflict state.
- Pastikan tiada delete control dan tiada data `ADMIN_USERS` dipaparkan.
- Feature flag mesti kekal `false`; Admin Dashboard boleh menyediakan config tanpa menukar student form production.
- Deployment Fasa 4 memerlukan frontend dan GAS Fasa 3 serasi, tetapi tidak termasuk live migration atau activation tanpa kelulusan berasingan.

## Urutan Deployment v1.7.0

1. Kemas kini `gas/Code.gs` dan semak syntax.
2. Push/salin code GAS ke project production.
3. Jalankan `setupSelfieProofV170()` sekali menggunakan akaun yang mempunyai akses Spreadsheet dan Drive.
4. Semak summary setup, pastikan lima header wujud dan sahkan Script Property `SELFIE_FOLDER_ID` menunjuk ke folder `eOuting - Bukti Selfie Pulang`.
5. Sahkan `TELEGRAM_ENABLED`, `TELEGRAM_BOT_TOKEN` dan `TELEGRAM_CHAT_ID` tanpa mencetak nilainya ke log.
6. Apps Script: `Deploy -> Manage deployments -> Edit -> New version -> Deploy`; kekalkan deployment URL.
7. Merge/publish frontend ke GitHub Pages.
8. Sahkan popup update, footer, query asset dan cache menggunakan versi release yang sama.
9. Jalankan ujian hujung-ke-hujung: submit request, Warden approve, Guard confirm out/in, Pelajar hantar selfie, kemudian sahkan Sheet, Drive dan Telegram.

Rollout v1.7.0 melalui urutan ini menggunakan GAS Version 21. Pull Request #1 telah digabungkan ke `main` melalui merge commit `beec1e0`.

## Rekod Deployment Foto Profil Pelajar

Foto profil dan two-tier thumbnail/full delivery telah beroperasi pada production GAS Version 32. Urutan Version 30 di bawah ialah rekod rollout asal dan tidak perlu diulang:

1. Jalankan semula semua ujian pada commit release.
2. Jalankan `clasp push` secara manual daripada source kanonik `gas/Code.gs`.
3. Dalam Apps Script, jalankan `setupStudentProfilePhotos()` sekali dengan akaun yang boleh mengakses Spreadsheet dan folder Drive.
4. Sahkan summary menunjukkan header `photo_file_id`, `photo_updated_at`, folder ID `1EpnqLVO8iWHRpF8MuqsyVAN55T7eq5X3`, dan Script Property `PROFILE_PHOTO_FOLDER_ID`.
5. Pastikan folder profil dan folder selfie kekal private dan berasingan.
6. Cipta deployment Web App **Version 30** melalui Manage deployments sambil mengekalkan URL production.
7. Smoke-test upload/ganti Pelajar, kad Warden/HEP, ketiga-tiga kad Guard, thumbnail/removal Admin dan audit log.
8. Sahkan GET Public Monitoring tidak mengandungi sebarang field atau byte foto profil.

Deployment Version 30/31, optimisasi Version 32 dan setup schema telah selesai. Jangan jalankan semula helper kecuali header/property benar-benar perlu dibaiki dan perubahan itu diluluskan.

## Semakan Release

```powershell
node --test tests/*.test.js
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw | node --check -
Get-Content version.json -Raw | ConvertFrom-Json
git diff --check
git status --short
```

Untuk v1.7.0, pastikan:

- `APP_VERSION = "1.7.0"`;
- cache ialah `eouting-cache-v1.7.0`;
- query string CSS/JS ialah `v=1.7.0`;
- footer menunjukkan v1.7.0;
- `version.json` menggunakan tarikh dan release note yang betul;
- API/GAS, external request dan imej selfie sensitif tidak dicache oleh service worker;
- keseluruhan suite menunjukkan **59/59 lulus**.

## Verifikasi Live

Frontend:

- buka `https://itumelaka.github.io/eouting/`;
- semak footer dan update popup;
- semak asset query `2.4.0-r21` dan Cache Storage `eouting-cache-v2.4.0-r21`, khususnya selepas refresh/reopen PWA mobile;
- login Admin, refresh berulang dan sahkan restore hanya selepas backend validation serta tab bukan default kekal lazy;
- login Pelajar pada telefon, buka foto profil dan sahkan `Ambil Foto`, `Pilih dari Galeri` serta `Batal`; return-selfie mesti kekal sama;
- buka Public Monitoring sekali dan pastikan loading, scroll, data serta timestamp betul;
- semak Warden dan Guard masih menerima rekod operasi penuh.

Backend:

- GET public hanya mengandungi enam field yang dibenarkan;
- POST Pelajar hanya mengembalikan rekod Pelajar tersebut;
- POST Warden/Guard mengembalikan data operasi selepas credential sah;
- credential salah ditolak tanpa fallback GET.
- `cancelStudentRequest` mengesahkan pemilikan, sebab 5–500 aksara dan status authoritative; uji pending serta approved, kemudian sahkan `DIBATALKAN_PELAJAR`, metadata, audit dan tepat satu Telegram;
- cancelled row tidak muncul dalam queue Warden/Guard, Public Monitoring tidak mendedahkan sebab, dan Pelajar boleh membuat request baharu;
- `submitReturnSelfie` menolak pemilikan/status/input yang tidak sah dan duplicate submission;
- imej berada dalam folder Drive private dan Telegram menerima foto sebenar;
- Public Monitoring tidak mengandungi metadata selfie.
- foto profil hanya boleh dimuat melalui POST batch berautentikasi dan Public Monitoring tidak mengandungi metadata/byte foto;
- replacement/removal hanya mentrash fail yang disahkan berada dalam folder profil yang dikonfigurasi, tanpa menyentuh folder selfie.

Jika PWA masih menggunakan asset lama, semak cache name dan asset query strings dahulu. Jangan ubah deployment URL atau menambah `skipWaiting` automatik jika popup update semasa bergantung pada tindakan pengguna.

## Caution dan Rollback

- Jangan rollback frontend sahaja jika backend/schema v1.7.0 masih menerima submission selfie tanpa menilai compatibility.
- Jangan padam lima header selfie atau `SELFIE_FOLDER_ID` semasa rollback; data production dan fail sedia ada perlu dipelihara.
- Jangan jadikan folder Drive public untuk memudahkan rollback atau debugging.
- Jika deployment GAS baharu bermasalah, pilih semula version deployment terakhir yang diketahui stabil sambil mengekalkan URL, kemudian uji semua flow.
- Jangan retry secara manual dengan mengubah `selfie_status` selepas hasil separa tanpa memeriksa Sheet, Drive dan Telegram; cleanup/idempotency perlu kekal authoritative.
