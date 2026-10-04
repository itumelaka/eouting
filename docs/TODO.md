# TODO eOuting ITU

Checkpoint **4 Oktober 2026**. Production GAS/Sheets kekal; V3 belum cutover. [Project Status](PROJECT_STATUS.md) menyimpan bukti lengkap; [Changelog](CHANGELOG.md) menyimpan milestone selesai supaya migration/QA lama tidak diulang.

## Wajib sebelum cutover

- [ ] Ambil fresh pre-flight production dengan waktu/authority konsisten untuk profil, config, request, audit dan foto. PASS rehearsal bukan parity production terkini; 34 profil penuh belum direfresh pada 4 Oktober.
- [ ] Reconcile gap live sekitar 12:40 MYT: production 424 vs D1 412; shared 397 (395 exact, 1 lifecycle, 1 serialization catatan), production-only 27 dan D1-only 15. Jangan menghasilkan sync daripada counts sahaja.
- [ ] Selesaikan lifecycle 14 production KELUAR: 13 missing D1 dan 1 pending D1; verify current roster/equation, latest-request authority, terminal transitions dan audit berkorelasi.
- [ ] Classify tambahan rehearsal staging: 3 pelajar, 15 request, 117 audit occurrences, 1 photo reference. Tetapkan exclusion/retention; jangan padam sebagai QA melalui andaian.
- [ ] Verify canonical LI UNISZA (kelas LI, institution UNISZA, non-LI institution kosong); audit insiden lifecycle LI terdahulu secara berasingan tanpa mendakwa kategori puncanya.
- [ ] Reconcile sasaran GAS mirror dan setiap ID retry queue serta tetapkan freshness/version protection atau target terasing. **Kekalkan OPERATIONAL_MIRROR_ENABLED=false staging** sehingga gate ini dipenuhi.
- [ ] Lengkapkan live mutation verification direct mirror gate pada fixture/sasaran yang terasing dan diluluskan. Local tests bukan live proof; disabled mutation D1 tetap queue.
- [ ] Lengkapkan matriks code/deployed/E2E bagi semua role/route, khususnya Admin, Guardian Contact, return-selfie dan hybrid dependencies. Route tersedia bukan parity siap.
- [ ] Jalankan rollback rehearsal dengan verification hasil restore, schema/config, lifecycle/roster, foto, audit multiplicity dan queue. Snapshot/SQL sahaja bukan bukti restore atau import.
- [ ] Tetapkan freeze/delta strategy, pemilik rollback, compatibility, fresh full/focused regression dan Go/No-Go sebelum sebarang cutover.

## Foto Phase 6C — gate belum verified

- [ ] Independent Drive metadata `isTrashed=true` selepas real trusted REMOVE.
- [ ] Duplicate/idempotent retry trusted REMOVE dengan operation ID sama secara E2E; UI kosong selepas REMOVE bukan bukti retry adapter.
- [ ] E2E audit failure selepas cleanup Drive trash, kemudian retry recovery audit; setakat ini hanya local-tested.
- [ ] Recovery `RECONCILE_REQUIRED` selepas keadaan Drive/D1 berubah ketika kuarantin; verified case sedia ada mempunyai postcondition konsisten.
- [ ] Verify akses/binari/folder permission foto production secara terkawal; parity 34 metadata/32 rujukan tidak menutup gate ini.
- [ ] Tentukan acceptance manual recovery dan pelan pengendalian pending/outcome-unknown sebelum cutover. Automatic/cron recovery dan cleanup belum implemented; jika diwajibkan untuk release, implement dan QA berasingan sebelum menutup gate.

## Bukti selesai — jangan ulang tanpa sebab

- [x] Rehearsal local parity: 34 profil snapshot terdahulu; 34 metadata foto/32 rujukan, 397 request/39 medan, 3097 audit occurrences pada 4 Oktober. Missing/mismatch sumber 0 mengikut comparison masing-masing; bukan parity live.
- [x] Lima purpose mismatch eksport awal dibuktikan encoding output PowerShell; UTF-8 reexport menghasilkan U+00B2 dan 5/5 matched, tanpa database fix.
- [x] Mirror gate staging deployed Worker `8e835591-1d6d-4c48-bf0f-a6cb90d193b1`; cron 13:05:26 MYT SKIPPED, semua counts 0. Queue sebelum deploy 0; direct gate hanya local-tested, focused 164/164 PASS.
- [x] Trusted READ/UPLOAD dan satu REMOVE UI Admin staging; metadata/journal/audit verified dengan had bukti dalam status.
- [x] Manual recovery: negative inspection guards, synthetic REMOVE/retry, synthetic UPLOAD fail-closed, real UPLOAD expected-new/expected-old CAS, RECONCILE_REQUIRED dengan postcondition konsisten, serta real staging timeout selepas Drive create.
- [x] Cleanup old-photo manual staging: TRASHED kemudian ALREADY_TRASHED, tepat satu audit, foto baharu dan journal unchanged. Tidak menutup audit-failure E2E.
- [x] QA-only timeout hook dan diagnostic GAS sementara dikeluarkan dari source; diagnostic dibackup, tiada GAS deploy sesi repair.
- [x] September lifecycle/No-Guard staging QA dan async mirror/retry implementation; mirror operational sekarang disabled, bukan ulang QA mirror ke production.
- [x] Production V2 rollout/LI migration/date-window/guardian/urgency/performance/UI terdahulu direkod bertarikh dalam changelog. Full 744/744 ialah 27 Ogos, bukan full suite terkini.

## Verification operasi terdahulu — belum ditutup

Item berikut kekal terbuka mengikut skop asal HEAD; ia bukan bukti kegagalan atau arahan mengulang smoke QA yang sudah verified. Jika flow berkaitan masuk skop release/cutover, masukkan acceptance evidence yang sesuai dalam gate QA sebelum menutupnya.

- [ ] Verify approval Cuti Semester dan flow Guard dalam operasi sebenar.
- [ ] Verify Public Monitoring ketika rekod Cuti Semester/Pulang Bermalam aktif.
- [ ] Verify CSV reports selepas lebih banyak rekod Cuti Semester tersedia.

## Future enhancements dan operasi berterusan

Ini berasingan daripada gate cutover; tiada tuntutan sudah implemented.

- [ ] Nilai sama ada optimistic version column diperlukan untuk `STUDENTS` selepas beta concurrency QA. Ini pertimbangan masa hadapan, bukan requirement schema atau release gate yang sudah diputuskan.
- Stronger/domain auth, hashed PIN, backend-issued session token dan role/access review.
- Retention/deletion policy audit, selfie dan profile photo; consent/privacy notice; evidence review UI dan automated retention cleanup.
- Notification observability, long-term trigger monitoring, Telegram failure retry/outbox dan channel WhatsApp/email masa hadapan. Mirror retry queue bukan Telegram retry.
- Kurangkan latency Telegram synchronous, review GET/POST timeout/retry, TTL/invalidation/polling, first-load assets dan active/archive/lock/index architecture.
- Review konservatif historical lewat=Ya bagi timing indeterminate; pertimbang snapshot earliest_departure_time supaya config tidak mentafsir semula fallback-only priority.
- QR/deep links, automated reports/version injection dan panduan pengguna/SOP operasi.
- Backup berkala, audit akses Sheets/Drive/GAS/Telegram, PIN rotation dan QA operasi jenis custom/config. Supabase/Postgres bukan keperluan cutover semasa.

Runbook [Deployment](DEPLOYMENT.md), [Release Checklist](../RELEASE_CHECKLIST.md) dan [Local QA](LOCAL_DEV.md) mengekalkan mirror disabled; tiada scheduler/retry/import automatik dibenarkan oleh checklist ini.
