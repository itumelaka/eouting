# eOuting Release Checklist

Checkpoint **4 Oktober 2026**: production GAS/Sheets kekal; V3 belum cutover. Checklist tidak memberi authorization deployment/import. [Project Status](docs/PROJECT_STATUS.md) ialah rujukan bukti, [Deployment](docs/DEPLOYMENT.md) ialah runbook, [Changelog](docs/CHANGELOG.md) menyimpan sejarah release.

## Bukti selesai dengan had skop

- [x] Rehearsal parity: 34 profil snapshot terdahulu; 34 metadata foto/32 rujukan, 397 request/39 medan dan 3097 audit occurrences matched pada 4 Oktober. Bukan current production parity atau Drive binary/access verification.
- [x] Comparison live sekitar 12:40 MYT: production 424, D1 412, shared 397, production-only 27, D1-only 15; shared exact 395 dan 2 berbeza (lifecycle/serialization catatan). Daripada 14 production KELUAR, 13 missing dan 1 pending D1.
- [x] Mirror target production dan snapshot overwrite tanpa freshness guard confirmed; tiada bukti stale overwrite berlaku.
- [x] Staging mirror disabled pada Worker `8e835591-1d6d-4c48-bf0f-a6cb90d193b1`; cron 13:05:26 MYT SKIPPED, semua counts 0. Queue sebelum deploy 0; direct gate local-tested sahaja, focused 164/164 PASS.
- [x] Trusted photo staging READ/UPLOAD/REMOVE, manual recovery termasuk real timeout, dan old-photo manual cleanup/retry mempunyai bukti terhad dalam status; open gates kekal unchecked.
- [x] Diagnostic GAS sementara dibackup/dibuang source local; tiada GAS deploy repair. Tiada sync/import/cutover sesi reconciliation.

## Wajib sebelum V3 Go/No-Go

- [ ] Fresh production pre-flight konsisten/bertarikh dan pelan freeze/delta; profile snapshot terdahulu tidak dianggap refreshed.
- [ ] Reconcile semua missing/mismatch termasuk lifecycle 14 KELUAR dan catatan berdasarkan jenis sel/mapping; classify staging-only students/requests/audits/photos.
- [ ] Verify invariant lifecycle/latest-request/roster, canonical LI UNISZA dan privacy/role boundaries.
- [ ] Verify seluruh matriks code/deployed/E2E semua role/config/Guardian/return-selfie/photo; route tersedia bukan bukti parity.
- [ ] Verify independent Drive trash selepas REMOVE, duplicate trusted REMOVE E2E, cleanup audit-failure/retry E2E dan changed-state RECONCILE_REQUIRED recovery.
- [ ] Tetapkan acceptance manual pending/outcome-unknown recovery; automatic/cron recovery/cleanup belum tersedia.
- [ ] Rehearse rollback/restore pada target terasing dan verify hasil, bukan hanya backup/SQL wujud.
- [ ] Run full suite semasa dan focused suite relevan; record command/tarikh/results dan syntax/diff-check. 164/164 ialah focused; 744/744 ialah sejarah Ogos, bukan assertion PASS semasa.
- [ ] Sahkan target environment/config/deployment, operational ownership, permissions, monitoring, backup serta rollback owner.
- [ ] Pemilik release memutuskan Go/No-Go selepas semua gate wajib selesai. **NO-GO cutover sekarang.**

## Gate QA konfigurasi

Pada fixture/target terasing yang diluluskan, sahkan matriks berikut untuk jenis standard dan sekurang-kurangnya satu jenis custom yang relevan; code/local test sahaja bukan bukti E2E:

- [ ] Uji semua kombinasi `require_selfie=true/false` dan `require_warden_approval=true/false`; sahkan approval, Guard transition serta selfie required/tidak diperlukan mengikut snapshot request.
- [ ] Auto-approval menggunakan `AUTO_CONFIG_V2` dan audit `AUTO_APPROVE_REQUEST`, tanpa approval kedua atau bypass checkout authority; human approval kekal apabila diwajibkan.
- [ ] Missing/inactive/malformed config ditolak selamat sebelum persistence; uji `fixed_return_time`, `same_day_only`, tarikh/hari/application window serta duplicate protection.
- [ ] Consumer Telegram, statistik dan filter/label Admin/Warden menggunakan jenis/config yang betul, termasuk custom type; semak audit tanpa credential dan privacy projections. Jangan menggunakan operational mirror disabled sebagai cara sync atau proof parity.

## Gate operational mirror staging

- [ ] Reconcile target spreadsheet/project dan every queued ID terhadap authority terkini; tetapkan freshness/version protection atau target terasing sebelum enable.
- [ ] Verify direct disabled gate dengan live mutation pada fixture/sasaran terasing yang diluluskan; cron SKIPPED sahaja bukan bukti mutation.
- [ ] Kekalkan disabled semasa deployment/rollback Worker. Revision lama tanpa gate boleh mengaktifkan penghantaran semula.
- [ ] Preserve queue; jangan delete/mark success atau manual replay ketika disabled. Mutation D1 masih commit/enqueue; queue 0 sebelum deploy tidak membuktikan queue semasa kosong.
- [ ] Gunakan explicit `--config proxy/wrangler.toml --env staging` dari root repo bagi deployment yang diluluskan. Jangan deploy default environment.

## Guardrails GAS/frontend release berasingan

- [ ] Sahkan GAS Code.gs/manifest kanonik dan whitelist; tiada snapshot/diagnostic sementara dalam push.
- [ ] Preserve manifest timezone/runtime/Web App executeAs/access, target project dan URL sedia ada; immutable deployment version dipilih dengan sengaja.
- [ ] Jangan rerun helper migration/seed yang sudah selesai tanpa bukti schema gap.
- [ ] Verify Admin restore backend revalidation, dynamic groups, readiness, Guard primary/No-Guard fallback, Student ownership, public allowlist dan sensitive-cache exclusion.
- [ ] Selaraskan frontend product/cache metadata dan verify PWA delivery bagi release yang diluluskan.
- [ ] Preserve schema/data/audit/folders semasa rollback; V2 config/dynamic-login rollback bukan mirror gate.

Historical release/version/suite details tidak lagi menjadi unchecked checklist aktif; ia kekal bertarikh dalam changelog. Future enhancements disenaraikan dalam [TODO](docs/TODO.md), berasingan daripada gate release ini.
