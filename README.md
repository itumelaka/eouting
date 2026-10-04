# eOuting ITU

eOuting ITU merekod, meluluskan dan memantau pergerakan keluar masuk pelajar Institut Teknologi Unggas.

**Production kekal GAS/Google Sheets; V3 Worker/D1 masih staging, tiada cutover.** Frontend aktif ialah [GitHub Pages eOuting](https://itumelaka.github.io/eouting/) daripada [itumelaka/eouting](https://github.com/itumelaka/eouting). Frontend eoutingV2 telah retired. Version/frontend metadata ialah v2.4.0; rekod rollout GAS Version 57/r21 pada 27 Ogos ialah sejarah, bukan semakan deployment baharu.

## Checkpoint 4 Oktober 2026

- Production live sekitar **12:40 MYT: 424 request**, D1 snapshot **412**; shared **397**, production-only **27**, D1-only **15**. Shared exact **395**; satu perubahan lifecycle dan satu isu serialization `catatan`. Daripada **14 production KELUAR**, **13 missing D1** dan **1 pending D1**. Snapshot tidak dijamin current selepas semakan.
- Parity rehearsal sahaja: **34 profil** pada snapshot terdahulu; **34 metadata foto/32 rujukan**, **397 request pada 39 medan**, **3097 audit occurrences matched**. Ini bukan parity production terkini. Metadata foto tidak membuktikan akses/binari Drive.
- Mirror GAS **Version 6** menunjuk spreadsheet production dan update snapshot tanpa freshness guard; **tiada bukti stale overwrite berlaku**.
- `OPERATIONAL_MIRROR_ENABLED=false` deployed **staging sahaja**, Worker `8e835591-1d6d-4c48-bf0f-a6cb90d193b1`. Cron **13:05:26 MYT SKIPPED**, processed/succeeded/failed **0**. Direct gate local-tested, belum live mutation-tested.
- Queue **0 sebelum deploy**. Mutation D1 ketika disabled masih berjalan dan ID dikekalkan/enqueued; cron tidak memadam queue. **Jangan enable sebelum sasaran dan queue direconcile.** Gate ini tidak menyekat semua GAS/Telegram/photo actions.
- Gate implementation **focused 164/164 PASS**, bukan full suite. Diagnostic GAS sementara dibackup dan dibuang daripada source local; tiada GAS deploy dibuat.

Bukti lengkap, had verification dan gate terbuka: [Project Status](docs/PROJECT_STATUS.md). Fresh production pre-flight, lifecycle/roster invariants, classification tambahan staging, rollback rehearsal dan QA foto/flow masih wajib sebelum cutover.

## Architecture dan authority

```text
Production PWA -> GAS -> Google Sheets (authority)
                    -> private Google Drive -> Telegram + AUDIT_LOG
Localhost staging -> Worker -> D1 (flow yang telah dimigrasikan)
                            -> operational mirror DISABLED -> retry queue dikekalkan
Trusted photo     -> D1 metadata + PHOTO_OPERATIONS/CAS -> HMAC GAS QA adapter -> private Drive
```

Selepas cutover yang belum dibuat, D1 disasarkan menjadi authority operasi/metadata dan Sheets downstream mirror/reporting. Jangan gunakan staging sebagai writable master production kedua. Source/frontend kini mempunyai route Admin, roster, staff create/update/toggle, Guardian Contact, return-selfie dan trusted photo; ketersediaan route tidak membuktikan deployed/E2E parity. Fungsi hybrid yang berbaki boleh menggunakan GAS.

## Flow dan role

- Pelajar login dengan `student_id + no_matrik`, memohon, membatalkan pending/approved dengan sebab 5–500 aksara, melihat status/history sendiri dan menghantar selfie jika diwajibkan.
- Warden/HEP login nama + PIN, approve/reject dan mengendalikan fallback No-Guard. Guard mengesahkan keluar/masuk. Admin mengurus config/master data dan tidak memperoleh checkout authority.
- Lifecycle: `MENUNGGU_KELULUSAN -> DILULUSKAN_WARDEN -> KELUAR -> SELESAI`; rejected/cancelled terminal tidak menghalang permohonan baharu. Backend menguatkuasakan ownership, race/idempotency dan duplicate active request.
- No-Guard request Student hanya menulis `DEPARTURE_CONFIRMATION_REQUESTED`; Warden authenticated melakukan checkout akhir dengan audit `WARDEN_REMOTE_CHECKOUT`, tanpa memalsukan Guard. Gate No-Guard berasingan daripada gate mirror.
- `OUTING_TYPES` mengawal date/day/time window, departure restrictions, kelulusan dan selfie. Jenis standard dan custom menggunakan config; readiness dan backend validation mengatasi state browser.
- Urgency `NORMAL/DUE_SOON/LATE/CRITICAL/ACTION_REQUIRED`, approval priority dan lifecycle ialah dimensi berasingan. Guardian Contact memerlukan Warden authentication, eligibility recheck dan audit sebelum disclosure.
- Canonical LI UNISZA ialah `kelas=LI`, `institution_code=UNISZA`; non-LI institution kosong. Prefix ID migration-only; kumpulan login data-driven.
- Current Hostel Residents ialah derived active students tolak latest authoritative `KELUAR`, bukan bukti fizikal atau field presence kedua.

## Foto dan privasi

Foto profil dan selfie pulang menggunakan folder/lifecycle berasingan. Profile thumbnail batch dan full preview satu pelajar memerlukan authorization, menggunakan cache sesi, serta tidak mendedahkan Drive ID/URL/token. Return-selfie memerlukan ownership, `SELESAI` dan `masa_masuk`; status bukti berasingan daripada lifecycle.

Trusted D1 READ/UPLOAD/REMOVE, manual recovery termasuk real staging timeout, dan cleanup old-photo manual/retry telah mempunyai QA staging terhad. Independent Drive trash proof selepas REMOVE, duplicate trusted REMOVE E2E, cleanup audit-failure E2E dan changed-state recovery masih terbuka; automatic recovery/cleanup belum tersedia. Lihat [bukti foto](docs/PROJECT_STATUS.md#phase-6c--trusted-photo-migration--kemas-kini-28-september-2026).

Public monitoring hanya membawa `nama | kelas | jenis_permohonan | status | lewat | belum_masuk`. Direktori public tidak membawa no. matrik; roster nama minimum authenticated dan summary aggregate-only. Tiada fallback operational POST gagal kepada public data. API/imej sensitif network-only, tidak disimpan dalam PWA Cache Storage. Admin restore menggunakan sessionStorage tab, expiry absolute 12 jam dan backend revalidation; PIN tidak masuk localStorage/log.

## Local development dan validation

Mock UI terasing:

```powershell
python -m http.server 8080
```

Buka `http://localhost:8080/?mock=1`. Tanpa mock, localhost boleh menghubungi staging/hybrid remote; static server sahaja tidak mengasingkan database atau Telegram. Gunakan [Local QA](docs/LOCAL_DEV.md) untuk focused tests dan senario selamat.

```powershell
node --test tests/*.test.js
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw -Encoding utf8 | node --check -
git diff --check
```

Command full suite bukan dakwaan full suite semasa sudah PASS. Full **744/744** ialah close-out **27 Ogos**; focused **164/164** ialah implementation gate **4 Oktober**. Dokumentasi ini tidak mengarahkan deploy atau migration.

## Dokumentasi projek

| Dokumen | Tujuan |
|---|---|
| [Project Status](docs/PROJECT_STATUS.md) | Checkpoint, bukti dan had verification |
| [TODO](docs/TODO.md) | Gate cutover dan future enhancements |
| [Architecture](docs/ARCHITECTURE.md) | Authority, komponen dan API boundaries |
| [Database](docs/DATABASE.md) | Schema, mapping dan reconciliation |
| [Flow](docs/FLOW.md) | Lifecycle dan role flow |
| [Deployment](docs/DEPLOYMENT.md) | Runbook deployment/rollback |
| [Release Checklist](RELEASE_CHECKLIST.md) | Go/No-Go gates |
| [Local Development](docs/LOCAL_DEV.md) | Mock, tests dan QA |
| [GAS Setup](docs/GAS_SETUP.md) | Source/manifest/helper GAS |
| [Security](docs/SECURITY.md) | Authentication, privacy dan mirror risks |
| [Changelog](docs/CHANGELOG.md) | Sejarah bertarikh; bukan status runtime semasa |
