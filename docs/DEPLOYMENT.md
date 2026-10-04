# Deployment dan Rollback eOuting ITU

Checkpoint **4 Oktober 2026**. Production masih GitHub Pages + GAS/Sheets; tiada cutover. Runbook ini ialah panduan bagi perubahan yang diluluskan, bukan arahan menjalankan deployment/import sekarang. Bukti bertarikh: [Project Status](PROJECT_STATUS.md); sejarah rollout/incident: [Changelog](CHANGELOG.md).

## Boundary deployment semasa

- Frontend production v2.4.0 kekal GAS; localhost route yang dipetakan menggunakan Worker/D1 staging dan baki hybrid boleh menghubungi GAS.
- GAS operational mirror deployed Version 6 menunjuk spreadsheet production, update penuh tanpa freshness guard. Tiada bukti stale overwrite berlaku.
- Worker staging `8e835591-1d6d-4c48-bf0f-a6cb90d193b1` deployed dengan `OPERATIONAL_MIRROR_ENABLED=false`. Jangan enable sebelum target/queue direconcile.
- Queue 0 **sebelum deploy**; bukan current count. Disabled mutation D1 masih commit dan enqueue ID; scheduler disabled tidak membaca/memadam queue atau menganggap mirror berjaya.
- Cron 13:05:26 MYT SKIPPED dengan counts 0; direct gate local-tested sahaja. Focused 164/164 PASS bukan full suite.
- Trusted photo adapter QA ialah project/boundary berasingan daripada GAS mirror Version 6. Gate operational mirror tidak mematikan trusted photo, Telegram atau semua hybrid GAS actions.
- Diagnostic GAS sementara dibackup dan dikeluarkan daripada source local; tiada GAS deploy repair/cleanup. Jangan deploy GAS semata-mata untuk gate Worker.

## Staging Worker — sebelum deployment yang diluluskan

1. Sahkan repo/branch/HEAD, diff, target environment dan compatibility schema; jangan deploy dari snapshot/rehearsal SQL atau credentials.
2. Jalankan focused tests relevan dan syntax/diff-check seperti [Local QA](LOCAL_DEV.md). Full suite terkini perlu hasil bertarikh; jangan guna 744/744 Ogos atau focused 164 sebagai full release result.
3. Pastikan config **env.staging** mengekalkan `OPERATIONAL_MIRROR_ENABLED="false"`. Default environment lain tidak berubah; kod gate hanya disable explicit string `"false"` atau boolean false.
4. Verify upstream targets/account/environment tanpa mencetak secret. Mirror target production yang confirmed mesti terus disekat; asingkan target bagi live QA sebelum mutation.
5. Record queue count dengan read-only check yang diluluskan dan preserve queue; jangan run reconciliation untuk validation disabled gate.
6. Selepas deployment, record Worker Version ID dan verify runtime cron SKIPPED/zero counts. Live mutation direct gate memerlukan QA terasing; cron SKIPPED sahaja bukan buktinya.

Command contoh **dari root repo**, hanya apabila deployment staging diluluskan:

```powershell
npx wrangler deploy --config proxy/wrangler.toml --env staging
```

Jangan gunakan bare wrangler deploy. Insiden 22 September tersalah target pernah memerlukan rollback production Worker; versi rollback sejarah bukan pengesahan remote semasa.

## Re-enable operational mirror — gate berasingan

Sebelum sebarang enable: sahkan sasaran spreadsheet/project sebenar, tentukan authority/freshness protection, compare setiap pending ID kepada sumber production terkini, classify staging-only QA dan verify queue policy/retry. Snapshot D1 lama boleh overwrite status/approval/checkout production melalui adapter lama; shared lifecycle mismatch menjadikan auto replay tidak selamat. Queue kosong sebelum deploy tidak memenuhi gate masa hadapan.

Jangan execute SQL fix/reimport sebagai sebahagian mirror enable. Keputusan sync memerlukan mapping, jenis sel/timestamp, delta/freeze dan rollback yang reviewed. Disabled queue menyimpan ID, bukan immutable snapshot; apabila enabled retry membaca **rekod D1 terkini**.

## Rollback Worker dan cutover rehearsal

- Rollback staging kepada revision **yang masih mempunyai gate**, dengan explicit config/env dan disabled value. Revision lama tanpa gate boleh mengaktifkan mirror semula walaupun variable false wujud; pilih compatible revision atau deploy gate fix yang telah disahkan.
- Preserve `MIRROR_RETRY_QUEUE`, `PHOTO_OPERATIONS`, audit dan metadata; jangan padam atau mark success untuk menghilangkan pending.
- Jangan jalankan scheduler/manual retry atau mirror replay sebagai langkah rollback ketika disabled.
- Foto recovery manual tidak mengulang mutation Drive; jangan replay upload/remove apabila outcome unknown. Verify Drive/D1/journal postcondition dan audit correlation sebelum tindakan.
- Database rollback rehearsal **belum verified**. Backup/SQL local sahaja tidak membuktikan restore. Uji restore pada target terasing yang diluluskan dan verify data/config, lifecycle/roster, nullable/multiplicity, foto serta queue sebelum Go/No-Go.
- Production belum cutover; tiada alasan menukar production frontend kepada D1 atau rollback production data melalui staging. Full pre-flight/delta plan masih diperlukan.

## Pre-migration pada target yang diluluskan

Sebelum perubahan schema/data/config yang diluluskan, ambil backup penuh dataset sasaran (keseluruhan Spreadsheet bagi GAS/Sheets, atau database/config D1 yang berkaitan). Rekod fail backup, masa dan pemiliknya; pastikan backup boleh dikenal pasti untuk rollback. Backup sahaja bukan bukti restore berjaya. Sahkan schema terhadap migration/source semasa, penambahan idempotent dan preservation rekod lama; jangan gunakan bilangan header checkpoint lama atau mengulang migration yang sudah selesai tanpa bukti gap.

Untuk target baharu, provision Admin secara manual melalui storage private yang sesuai dengan backend sasaran: ID unik, identiti, PIN unik dan status aktif. Format PIN sebagai Plain text jika menggunakan Sheet; jangan seed akaun/PIN melalui migration atau mencetak credential. Sahkan login sah, PIN salah dan Admin inactive ditolak sebelum QA privileged.

## Containment scanner Telegram

Dalam Apps Script, semak Triggers untuk handler `scanReturnOperationalNotifications_`, time-driven setiap lima minit; trigger tambahan bagi handler sama ialah anomaly. Semak Executions untuk timestamp, duration dan status scheduled run. Jika duplicate runaway bagi request/stage sama disahkan, disable/remove **hanya scanner trigger berkaitan** untuk menghentikan scheduled delivery sementara investigation. Jangan ubah/padam `AUDIT_LOG` untuk membaiki dedup; sejarah audit diperlukan untuk reconciliation kerana Telegram delivery dan audit write tidak atomic. Ini berasingan daripada gate operational mirror Worker dan bukan arahan memutasi production dalam QA local.

## Retry selfie selepas outcome separa

Jangan retry dengan mengubah `selfie_status` secara manual selepas outcome separa atau tidak pasti tanpa reconciliation Sheets, Drive dan Telegram. Cleanup/idempotency backend mesti kekal authoritative; nilai compatibility backend/schema sebelum rollback frontend sahaja dan preserve metadata, folder private serta audit.

## Frontend release

Untuk release frontend yang diluluskan, selaraskan APP_VERSION/footer/version.json dan cache/asset query/app-shell URLs; cache-only revision tidak semestinya bump product version. Jalankan suite relevan/full mengikut skop, syntax, privacy/PWA checks, review diff dan publish mengikut proses projek. API/external/imej sensitif kekal network-only. Verify delivery/PWA selepas publish; jangan menukar production endpoint kepada staging tanpa cutover gate.

Jika PWA masih menggunakan aset lama, semak cache name dan asset query strings dahulu. Jangan ubah deployment URL atau tambah automatic `skipWaiting` apabila popup update bergantung pada tindakan pengguna; kekalkan flow update sedia ada semasa rollback.

## GAS production — perubahan berasingan

`gas/Code.gs` ialah source executable kanonik; `gas/appsscript.json` ialah manifest. Whitelist `.claspignore` hanya Code.gs/appsscript.json relatif kepada GAS root. Snapshot .gs atau diagnostic QA sementara tidak boleh masuk payload.

Sebelum GAS release yang diluluskan:

1. Semak source, focused/full tests, syntax GAS melalui stdin, diff-check dan `clasp show-file-status`; sahkan hanya source/manifest kanonik.
2. Preserve manifest `Asia/Kuala_Lumpur`, `V8`, `USER_DEPLOYING`, `ANYONE_ANONYMOUS`; anonymous transport bukan application authority.
3. Sahkan project, spreadsheet, Drive folders dan deployment intended tanpa mendedahkan ID/secret. Project QA photo mesti terasing; deployment berasingan dalam project sama berkongsi Script Properties.
4. Push source dan pilih immutable version baharu pada deployment sedia ada hanya selepas authorization; push sahaja tidak menukar /exec. Jangan ubah @HEAD atau create duplicate Web App tanpa keperluan reviewed.
5. Helper setup/schema yang sudah selesai **jangan diulang** kecuali gap schema/property dibuktikan. Date-window production migration selesai 22 Ogos; profile/selfie setup terdahulu selesai.
6. Verify login semua role, dynamic groups, readiness, lifecycle, guarded No-Guard, public projection, trusted/legacy photo boundary, return-selfie dan audit/Telegram yang terlibat pada fixture diluluskan.

Jika GAS deployment bermasalah, pilih compatible immutable version stabil sambil preserve URL/manifest/schema/data. V2 rollback `OUTING_CONFIG_V2_ENABLED=false` mengembalikan validation legacy; dynamic-login rollback melalui Admin `Kembali ke Login Legacy`. Kedua-duanya **bukan** kill switch operational mirror Worker. Jangan menukar feature flags production sebagai langkah staging mirror rollback.

## Bukti release dan Go/No-Go

Record SHA, environment, deployment version, masa MYT, target authority, hasil local tests vs live QA dan rollback owner; jangan record PIN/Drive IDs/data pelajar. Gunakan [Release Checklist](../RELEASE_CHECKLIST.md). Full 744/744 dan GAS Version 57/r21 ialah close-out 27 Ogos dalam changelog, bukan gate angka minimum atau status deployment semasa yang diandaikan.
