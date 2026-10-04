# Local Development dan Testing

Checkpoint **4 Oktober 2026**. Production kekal GAS/Sheets, tiada cutover. Version 57/r21 dan full 744/744 ialah close-out 27 Ogos, bukan baseline full suite semasa. [Project Status](PROJECT_STATUS.md) menyimpan bukti runtime/parity dan [Deployment](DEPLOYMENT.md) menyimpan rollback runbook.

## Pengasingan QA dan mirror disabled

Gunakan mock/local tests dahulu. Tanpa mock, localhost memetakan route D1 ke staging; action hybrid yang tidak dipetakan boleh menghubungi GAS. Override GAS beta tidak menukar mapping D1 localhost dan badge BETA API tidak membuktikan semua target terasing. Semak target setiap route sebelum sebarang live QA yang diluluskan.

Staging operational mirror false deployed pada Worker `8e835591-1d6d-4c48-bf0f-a6cb90d193b1`; GAS mirror Version 6 masih menuju spreadsheet production tanpa freshness guard. Jangan enable, menjalankan retry/scheduler atau mutation remote untuk QA local. Gate tidak mengasingkan Telegram/trusted photo/hybrid GAS. Queue 0 sebelum deploy ialah sejarah; mutation D1 baharu tetap enqueue ID, cron disabled preserve queue. Cron 13:05:26 MYT SKIPPED/counts 0 ialah live proof scheduler sahaja; direct gate local-tested, belum live mutation-tested.

Diagnostic GAS sementara telah dibackup dan dibuang source local tanpa GAS deploy; jangan menggunakan wrapper/route QA yang sudah dibuang. Private diagnostic sedia ada bukan arahan memanggil GAS remote dalam local QA.

## Keperluan

- Git
- Browser
- Python untuk static server
- Node.js untuk test dan syntax checks
- `clasp` untuk perubahan GAS

## Jalankan Frontend

```powershell
python -m http.server 8080
```

Buka `http://localhost:8080/`. Gunakan server HTTP; jangan buka `index.html` secara terus kerana path PWA/service worker berbeza.

Mock mode hanya untuk development/demo dan perlu diaktifkan secara sengaja dengan `?mock=1`. Production tidak boleh fallback senyap kepada data mock.

Dalam mock mode, rekod `SELESAI` yang mempunyai `masa_masuk` boleh menguji UI selfie: pilih/ambil gambar, preview, ambil semula, compression dan loading state. Submission mock menetapkan `selfie_status = SUDAH_HANTAR` serta `masa_selfie` pada rekod local dan tidak memanggil Google Drive atau Telegram. Tiada emulasi Drive atau Telegram local disediakan.

### Admin Dashboard Mock QA

Buka `http://localhost:8080/?mock=1`, pilih `Admin` dan gunakan credential local berikut:

- ID: `ADMIN-MOCK`
- nama alternatif: `Admin Mock QA`
- PIN mock: rujuk fixture mock dalam source local; jangan menyalin credential ke dokumentasi atau logs.

Credential ini hanya dibina apabila query tepat `mock=1` hadir. Tanpa query tersebut, action Admin mengikut routing D1 staging/GAS hybrid dan credential mock bukan pengasingan target. Mock login response tidak mengandungi PIN; runtime dan dedicated Admin sessionStorage tab dibersihkan semasa logout.

Lima jenis outing dan satu Notis Banner contoh disediakan dalam memory, termasuk `CUTI_SEMESTER` yang tidak aktif untuk QA toggle. Create, edit dan toggle hanya mengubah data memory dan tidak memanggil GAS atau Google Sheets. Refresh page mengembalikan seed asal.

URL senario tambahan:

- `http://localhost:8080/?mock=1&mockAdminError=1` — read pertama gagal sekali; tekan `Cuba Lagi` untuk berjaya.
- `http://localhost:8080/?mock=1&mockAdminConflict=1` — update/toggle pertama menghasilkan `CONFIG_VERSION_CONFLICT`, kemudian data terkini dimuatkan.

### Student Config Mock QA

Pilih identiti/nombor matrik fixture mock dalam source local. Data mock menggunakan kelas A2/A3; jangan salin data pelajar sebenar ke fixture.

- `http://localhost:8080/?mock=1` — empat config aktif; `CUTI_SEMESTER` inactive dan tidak muncul.
- `http://localhost:8080/?mock=1&mockOutingTypes=optional` — satu jenis tanpa medan wajib untuk menguji hidden/disabled/required false.
- `http://localhost:8080/?mock=1&mockOutingTypes=empty` — response kosong dan fallback lima legacy types.
- `http://localhost:8080/?mock=1&mockOutingTypes=error-once` — request pertama gagal, fallback legacy dipaparkan dan `Cuba Lagi` memuatkan config aktif.

Semak Weekend mengisi `22:00` secara read-only. Tukar kepada Pulang Bermalam dan pastikan masa lama dikosongkan. Field tersembunyi mesti `disabled` serta tidak `required`.

### Credential, config dan live QA

Admin restore menggunakan runtime credential dan dedicated sessionStorage tab dengan expiry absolute 12 jam serta loginAdmin revalidation; tidak localStorage/URL/log. Mock logout membersihkan saved/runtime state.

Live QA mesti pada target/fixture terasing yang diluluskan, dengan target D1/GAS/Drive/Telegram diperiksa mengikut route. `?api=` localhost hanya override GAS yang diterima, bukan endpoint D1 mapped. Invalid override boleh fallback kepada endpoint default; jangan menganggap URL override sebagai isolation guarantee. Jangan gunakan credential production untuk mock.

OUTING_CONFIG_V2_ENABLED=false ialah V2 legacy-validation rollback, bukan gate mirror. Jangan tukar property GAS/Telegram/config production untuk menjalankan QA staging. Rehearsal parity bukan current production parity; snapshot comparison local tidak memerlukan live mutation.

## Automated Tests

Jalankan keseluruhan suite:

```powershell
node --test tests/*.test.js
```

Full **744/744** ialah sejarah release 27 Ogos. Hasil implementation mirror gate 4 Oktober ialah **focused 164/164 PASS**, syntax/diff-check PASS; bukan full suite semasa dan tidak dijalankan semula dalam audit dokumentasi.

Command focused yang menghasilkan checkpoint 164/164:

```powershell
node --test tests/operational-mirror-gate.test.js tests/staging-mirror-retry-queue.test.js tests/staging-student-cancellation-d1.test.js tests/worker-proxy.test.js tests/staging-submit-request-d1.test.js tests/staging-warden-decisions-d1.test.js tests/staging-no-guard-student-d1.test.js tests/staging-no-guard-warden-d1.test.js
```

Coverage direct disabled fetch, scheduler early gate, mutation success/enqueue, queue retention dan default environment compatibility menggunakan fixtures local. Gate tests tidak mengakses remote atau membuktikan live mutation. Syntax Worker ES module boleh disemak melalui stdin:

```powershell
Get-Content proxy/staging-worker-base.js -Raw -Encoding utf8 | node --input-type=module --check -
```

Untuk photo suites, cari fail `tests/*photo*.test.js` dan jalankan suite relevan setempat. Hasil historical focused/full dan E2E setiap kes ada dalam status/changelog; local contract PASS tidak menutup open photo gates.

Focused date-window coverage berada dalam suite schema/Admin/Student/submission sedia ada. Ia meliputi idempotent header migration, blank compatibility, save/clear/reload, invalid/reversed/same-day ranges, safe projection, inclusive Malaysia midnight boundaries, additive day/time rules dan backend rejection tanpa append.

Focused regression yang paling relevan:

```powershell
node --test tests/no-guard-departure-mvp.test.js tests/no-guard-auth-directory-regression.test.js tests/telegram-return-notifications-phase5.test.js
```

Coverage meliputi safe-default/config ON-OFF, Student ownership tanpa self-checkout, Warden authentication, dynamic A2/A3/LI fixtures, Guard/Warden race ordering, audit-backed pending/dedup, Telegram failure semantics, completion single-send dan canonical eOuting URL. Credential fixtures adalah test-only; jangan mencetak atau memasukkan credential/data production ke test.

Jalankan focused Phase 3 suite:

```powershell
node --test tests/warden-approval-priority-phase3.test.js
```

Focused Phase 3 baseline ialah milestone **10/10 lulus**.

Jalankan focused Phase 4 suite:

```powershell
node --test tests/admin-operational-intelligence-phase4.test.js
```

Focused Phase 4 baseline ialah **9/9 lulus**. Suite ini meliputi definisi KPI mutually exclusive, inclusion/exclusion dan deterministic ordering queue, invalid urgency safe handling, label BM tanpa raw codes/guardian data, responsive layout, role boundaries serta penggunaan refresh Admin sedia ada tanpa threshold engine atau timer baharu.

Jalankan focused Phase 5 suite:

```powershell
node --test tests/telegram-return-notifications-phase5.test.js
```

Focused Phase 5 baseline ialah **15/15 lulus**. Ia meliputi eligibility/exclusion authoritative, stage progression, audit dedup, batching/order, dry-run, send/audit failure, duplicate source row, ScriptLock pattern, sensitive-data exclusion dan frontend/role boundaries. Temporary installer coverage pernah menaikkan focused total kepada **17/17**, tetapi bukan sebahagian canonical suite semasa.

Dry-run maintenance tersedia dalam GAS untuk QA terkawal melalui wrapper public parameterless:

```javascript
runReturnOperationalNotificationsDryRun()
```

Wrapper hard-coded kepada `dryRun: true`, tidak menerima caller options, tidak exposed melalui frontend/`doGet`/`doPost` dan tidak boleh digunakan untuk menukar kepada non-dry mode. Dry-run tidak send Telegram, menulis SENT audit, mengubah request atau memasang trigger. Jangan menjalankan private `scanReturnOperationalNotifications_` secara manual untuk maintenance biasa; production non-dry execution ialah tanggungjawab trigger lima minit yang telah diluluskan.

Suite v2.0 bertambah mengikut fasa. Fasa 4 menambah `tests/admin-dashboard-v200.test.js` untuk login form, credential handling, dashboard/list states, create/edit/toggle wiring, optimistic conflict, larangan delete dan logout cleanup.
Fasa 4.5 menambah `tests/admin-dashboard-mock-v200.test.js` untuk pengasingan mock/live, lima seed, write tanpa GAS, safe login response serta one-shot error/conflict QA.
Fasa 5A menambah `tests/student-config-form-v200.test.js` untuk loader, dropdown, sorting, inactive filtering, fallback, field mapping, fixed return time dan mock isolation.

Ujian manual Admin Dashboard:

1. buka role Admin dan cuba PIN salah; pastikan mesej generik;
2. login Admin aktif dan pastikan PIN input kosong;
3. refresh list dan sahkan active/inactive serta turutan;
4. buka create, semak semua medan dan batalkan confirmation;
5. edit row dan pastikan `type_code` read-only serta active tidak boleh diubah;
6. uji conflict melalui `mockAdminConflict=1` dan pastikan data direfresh;
7. toggle active/inactive dengan confirmation;
8. refresh dan pastikan `loginAdmin` dipanggil semula, Admin dipulihkan, expiry asal kekal dan tab bukan default tidak dimuat eager;
9. logout dan pastikan refresh browser tidak memulihkan session Admin.

Suite utama:

- `tests/admin-session-refresh-v220.test.js`: schema session Admin, payload login/restore sama, backend rejection, absolute expiry, logout dan lazy bootstrap.
- `tests/auth-loading-v220.test.js`: loader shared semua role, cleanup success/failure/logout dan reduced-motion.
- `tests/profile-photo-source-v220.test.js`: action sheet kamera/galeri, shared handler, cancellation/failure cleanup dan pengasingan return-selfie.
- `tests/student-cancellation.test.js`: kelayakan pending/approved, sebab wajib, ownership dan race safety, metadata/audit, sejarah/permohonan semula, pengecualian queue serta tepat satu Telegram non-blocking.
- `tests/secure-outing-statistics.test.js`: jumlah dan yearly history menggunakan scope authenticated `SELESAI` yang sama, response minimum, ownership dan newest-first.
- `tests/student-current-status-layout.test.js`: `Status Semasa` live/current di atas borang, compact yearly history di bawah dan refresh kedua-dua data source.
- `tests/student-live-status-clarity-phase2.test.js`: rendering semua state urgency/review, lifecycle separation, expected-return display, local duration wording, authoritative transition refresh, duplicate suppression serta perlindungan flow Student sedia ada.
- `tests/warden-approval-priority-phase3.test.js`: emergency-first, departure approaching/reached, oldest-first/stable fallback, Malaysia timezone, non-fabricated timing, non-bypass guidance, Warden-only projection dan responsive priority card.
- `tests/announcement-banner-v1.test.js`: Admin UI/save, authenticated projection, ticker sentiasa aktif, hover/fokus pause, reduced-motion, public privacy dan cleanup panduan Pelajar.
- `tests/student-directory-security.test.js`: projection direktori Pelajar dan login backend.
- `tests/student-login-dropdown-privacy.test.js`: dropdown nama tanpa nombor matrik.
- `tests/public-monitoring-statistics-security.test.js`: privacy public response, operational POST, credential runtime, statistik agregat dan status kontekstual.
- `tests/operational-urgency-phase1.test.js`: exact urgency boundaries, same-day/multi-day/custom/legacy target resolution, Malaysia timezone, malformed timing, `confirmIn` historical `lewat`, idempotency dan Public Monitoring privacy.
- `tests/guard-quick-filter.test.js`: filter Guard dan contextual empty-state.
- `tests/public-monitoring-lifecycle.test.js`: one-click, scroll, GET awam, single-flight, error/cached refresh dan satu render.
- `tests/public-monitoring-compact-layout.test.js`: layout ringkas, `Senarai Status Semasa`, ringkasan dan isolation Warden/Guard.
- `tests/service-worker-security.test.js`: API network-only, cache cleanup, static cache dan version consistency.
- `tests/selfie-proof-v170.test.js`: eligibility keempat-empat jenis, mapping/private projection, compression/upload, backend validation, duplicate protection, migration, confirmIn, cleanup dan audit failure selepas transaksi berjaya.
- `tests/student-profile-photo.test.js`: metadata private, batch authorization, cache normalization, upload/removal, modal preview, keyboard/backdrop close, no N+1 dan isolation Public Monitoring.

Jalankan satu fail:

```powershell
node --test tests/public-monitoring-lifecycle.test.js
```

## Syntax dan Metadata Checks

```powershell
node --check assets/app.js
node --check service-worker.js
Get-Content gas/Code.gs -Raw -Encoding utf8 | node --check -
Get-Content version.json -Raw | ConvertFrom-Json
git diff --check
```

Untuk dokumentasi, jalankan diff-check dan semak relative links serta angka/status; jangan menjalankan remote QA hanya untuk documentation edit.

## Smoke Test Pelajar (mock/local; live memerlukan target terasing)

0. Selepas login, sahkan ruleNotice besar disembunyikan pada Student authenticated; identiti → `Status Semasa` → borang → Refresh Status/jumlah tahunan/`Rekod Outing Saya`; ayat panduan pendua tidak wujud.
1. Pastikan dropdown minimum dan kumpulan dinamik berfungsi, termasuk canonical LI UNISZA pada fixture sesuai.
2. Pilih fixture pelajar; `student_id` kekal value dalaman.
3. Masukkan nombor matrik betul dan sahkan login berjaya.
4. Cuba nombor matrik salah dan sahkan login ditolak.
5. Hantar permohonan dan semak current/action pada `Status Semasa`; sahkan `Rekod Outing Saya` hanya memaparkan tarikh, jenis dan status bagi rekod `SELESAI` tahun semasa.
6. Uji `Ingat peranti ini` dan restore session.
7. Selepas Guard confirm masuk, semak badge `Bukti Selfie Belum Dihantar`.
8. Uji capture/pilih gambar, preview, ambil semula dan `Hantar Bukti`.
9. Dalam mock mode, sahkan badge bertukar kepada `Bukti Selfie Dihantar` tanpa request Drive/Telegram.
10. Tekan tindakan foto profil dan sahkan action sheet `Ambil Foto`, `Pilih dari Galeri`, `Batal`; kamera mengutamakan depan, galeri tidak memaksa kamera, cancel tidak meninggalkan loading, dan kedua-dua selection melalui validation/compression/upload yang sama.
11. Jika foto profil sebenar tersedia, sahkan identity menggunakan thumbnail, klik foto dan pastikan modal menunjukkan thumbnail/loading sebelum full image jika cache kosong; pembukaan kedua menggunakan full-image cache. Escape/backdrop/close dan fokus kembali mesti berfungsi. Initials tidak boleh diklik.
12. Batalkan satu permohonan menunggu dan satu yang telah diluluskan melalui action sheet yang sama; sebab 5–500 aksara wajib, rekod menjadi `DIBATALKAN_PELAJAR` dalam sejarah, tidak muncul dalam queue operasi dan Pelajar boleh memohon semula.
13. Sahkan pembatalan standard/custom type memaparkan loading yang selamat, klik berulang tidak menduplikasi action/Telegram, dan invalid reason atau status yang tidak boleh dibatalkan ditolak tanpa notifikasi.

## Smoke Test Warden

1. Login nama + PIN selepas fresh page load.
2. Pastikan Dashboard dan Checklist memuatkan nama sebenar.
3. Semak emoji/label kontekstual.
4. Refresh Permohonan.
5. Uji approve/reject dan Telegram; klik berulang semasa loading mesti tidak menghantar action kedua.
6. Pastikan credential hilang menghasilkan error, bukan data Public Monitoring.
7. Klik foto sebenar pada kad Warden/HEP dan sahkan list menggunakan satu batch thumbnail, preview membuat hanya satu request full jika belum dicache, dan approve/reject tidak terganggu.
8. Sahkan permohonan yang telah dibatalkan Pelajar tidak muncul dalam queue dan race approve/reject tidak menimpa status authoritative.
9. Untuk `KECEMASAN` pending/approved atau `KELUAR + CRITICAL/ACTION_REQUIRED`, sahkan `📞 Hubungi Penjaga` muncul hanya dalam view Warden/HEP; klik dan pastikan contact dimuat melalui POST authenticated, kemudian `📞 Telefon Sekarang` menggunakan URI `tel:` selamat.
10. Uji `AUTO_CONFIG_V2` emergency: ia mesti berada di `Telah Diluluskan / Risiko Pulang`, tidak berada di `Menunggu Kelulusan`, tidak mempunyai approve/reject kedua dan Guard kekal checkout authority.
11. Sahkan row tanpa `guardian_contact_available=true` tidak mempunyai shortcut, dan list payload/DOM awal tidak mengandungi raw telefon/hubungan.

## Smoke Test Guard

1. Login nama + PIN.
2. Refresh dan semak `Sedia Untuk Keluar` serta `Sedang Keluar`.
3. Uji filter Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat.
4. Pastikan Outing Harian tidak menangkap Kecemasan.
5. Uji confirm keluar/masuk dan Telegram; klik berulang semasa loading mesti tidak menghantar action kedua.
6. Klik foto sebenar pada setiap jenis kad Guard dan sahkan satu batch thumbnail digunakan, full preview dimuat on-demand/cached dan tidak mengganggu `Sahkan Keluar`/`Sahkan Masuk`; initials kekal inert.
7. Untuk `PULANG_BERMALAM`, uji future approved date, disallowed departure day dan sebelum `earliest_departure_time`; policy error mesti jelas dan error network/internal mesti kekal generic.
8. Sahkan permohonan yang dibatalkan tidak boleh `confirmOut`; dalam race serentak, transaksi pertama yang sah menang dan status `KELUAR` tidak ditimpa cancellation.

## Smoke Test Public Monitoring

1. Dari halaman utama tekan `Pemantauan Semasa` sekali.
2. Pastikan workspace aktif dan viewport scroll ke atas.
3. Pastikan satu GET `getTodayRecords` dibuat dan tiada POST authenticated digunakan.
4. Semak loading, ringkasan dan `Senarai Status Semasa`.
5. Semak setiap baris: nama, kelas, jenis, ikon dan label kontekstual.
6. Pastikan `Rekod Hari Ini`, quick filter monitor dan `Belum Pulang Ke Asrama` tidak wujud.
7. Klik refresh berulang semasa request aktif dan pastikan tiada overlap.
8. Simulasi refresh gagal dan pastikan data/timestamp lama kekal.
9. Pastikan tiada thumbnail, preview trigger, data URI atau metadata foto profil muncul.
10. Pastikan Public Pemantauan dan landing tidak memaparkan atau meminta Announcement Banner.

## Smoke Test Admin

1. Login Admin dan pastikan identiti, tajuk serta tujuh tab inline kekal visible ketika bertukar panel.
2. Pastikan `Statistik` aktif inline dan filter/KPI/statistik individu dimuat tanpa butang `Kembali ke Admin`.
3. Dalam `Tetapan Pelajar`, sahkan list menggunakan thumbnail cache, klik foto dan pastikan satu full image dimuat on-demand lalu dicache; `Buang Foto` kekal tindakan berasingan dengan confirmation serta invalidasi kedua-dua cache.
4. Semak Rekod Master search/filter/pagination, Pemantauan dan pengurusan Warden/HEP/Guard masih boleh ditukar tanpa login semula.
5. Dalam `Notis Banner`, uji teks, `Penting`, `Aktif`, simpan, current state, timestamp dan updater; sahkan Normal/Penting bergerak sama dan viewer authenticated menerima projection selamat.
6. Refresh berulang selepas login dan sahkan restore loader, backend revalidation, shell selepas auth, default data dahulu serta lazy inactive sections.

## PWA dan Cache (metadata r21 close-out 27 Ogos)

- Semak footer v2.4.0 dan popup update.
- Semak Cache Storage production menggunakan `eouting-cache-v2.4.0-r21` dan asset query `2.4.0-r21`; displayed app version ialah v2.4.0.
- Semak request GAS/API dalam Network dan pastikan ia tidak dimasukkan ke Cache Storage.
- Semak request external dan imej selfie sensitif tidak dimasukkan ke Cache Storage.
- Static HTML/CSS/JS/icon boleh kekal dicache.

## Keyboard dan KPI QA

- Tekan Enter pada login Pelajar, PIN Warden/HEP, PIN Guard dan PIN Admin; pastikan handler login biasa dipanggil sekali sahaja.
- Tekan Enter pada input/select editor Admin biasa; pastikan Save dihantar sekali dan disabled/loading lock dihormati.
- Tekan Enter dalam textarea; pastikan newline terbentuk dan form tidak dihantar.
- Pastikan tiada Enter generik mencetuskan approve/reject, `Sahkan Keluar`, `Sahkan Masuk`, reset PIN, nyahaktif, buang foto atau logout.
- Semak KPI count-up kira-kira 450 ms, exact integer akhir, previous-to-new, tiada replay apabila nilai sama dan reduced-motion bypass.

## Workflow Git

```powershell
git status --short
git diff
```

Jangan commit token, secret, PIN sebenar, API key atau deployment credential. GAS source push tidak menukar immutable Web App deployment. Audit/QA local tidak memberi kebenaran push/deploy.

## Beta QA — Pengurusan Pelajar LI

Gunakan akaun Admin beta sahaja. Jangan gunakan PIN sebenar dalam Git, nota ujian atau tangkap layar.

1. Buka frontend localhost dengan endpoint GAS beta dan login sebagai Admin.
2. Pilih sub-tab `Pengurusan Pelajar`; pastikan `Tetapan Outing` masih boleh dibuka semula tanpa kehilangan fungsi CRUD sedia ada.
3. Tekan `Tambah Pelajar` dan cipta satu rekod sementara:
   - `student_id`: ID beta unik;
   - `no_matrik`: nilai unik berbentuk teks (uji nilai bermula sifar);
   - `nama`: nama ujian yang jelas;
   - `kelas`: `LI`, `institution_code`: institusi fixture aktif (model canonical UNISZA jika sesuai);
   - `status`: `AKTIF`.
4. Semak carian melalui `student_id`, `no_matrik` dan `nama`; semak juga filter `LI` dan `Aktif`.
5. Log keluar Admin, buka flow Pelajar dan sahkan kumpulan LI/institusi fixture muncul melalui directory config aktif; legacy fallback perlu diuji berasingan.
6. Pilih kelas LI, login menggunakan nama dan no. matrik sementara, kemudian sahkan flow Pelajar biasa masih berfungsi.
7. Login Admin semula, nyahaktifkan pelajar sementara dan refresh flow Pelajar; pilihan/nama LI mesti hilang jika tiada lagi pelajar LI aktif.
8. Aktifkan semula rekod itu dan sahkan kelas serta nama LI muncul kembali.
9. Edit nama/no. telefon/catatan dan pastikan `student_id` read-only. Cuba no. matrik yang sudah digunakan dan pastikan backend menolak perubahan.
10. Semak `AUDIT_LOG` beta untuk `CREATE_STUDENT`, `UPDATE_STUDENT`, `DEACTIVATE_STUDENT` dan `ACTIVATE_STUDENT`; pastikan tiada PIN direkodkan.

STUDENTS tidak menerima kolum version dalam fasa ini. Konflik serentak dikurangkan dengan `LockService` dan semakan duplicate di dalam lock; tiada migration schema diperlukan.
