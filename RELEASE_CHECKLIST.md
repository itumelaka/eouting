# eOuting v2.0.0 Release Checklist

Dokumen ini ialah runbook terkawal untuk release frontend production v2.0.0 dan kesinambungan ujian beta. Ia tidak memberi kebenaran automatik untuk migration, deployment atau pengaktifan feature flag.

## Keputusan Semasa

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

## Had Beta yang Diketahui

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
