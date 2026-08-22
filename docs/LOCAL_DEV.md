# Local Development dan Testing

Panduan ini merujuk eOuting ITU **v2.4.0**, cache revision `2.4.0-r7` dan production GAS Version 52. Fasa 1–6 serta Generic Application Date Window lengkap dan production verified; No-Guard Departure kekal sambungan operasi selepas Fasa 5. Production No-Guard kini enabled melalui Admin; Phase 5 scheduling kekal satu trigger private scanner setiap lima minit.

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
- PIN: `2468`

Credential ini hanya dibina apabila query tepat `mock=1` hadir. Tanpa query tersebut, semua action Admin menggunakan GAS live dan credential mock tidak diterima. Mock login response tidak mengandungi PIN; runtime dan dedicated Admin sessionStorage tab dibersihkan semasa logout.

Lima jenis outing dan satu Notis Banner contoh disediakan dalam memory, termasuk `CUTI_SEMESTER` yang tidak aktif untuk QA toggle. Create, edit dan toggle hanya mengubah data memory dan tidak memanggil GAS atau Google Sheets. Refresh page mengembalikan seed asal.

URL senario tambahan:

- `http://localhost:8080/?mock=1&mockAdminError=1` — read pertama gagal sekali; tekan `Cuba Lagi` untuk berjaya.
- `http://localhost:8080/?mock=1&mockAdminConflict=1` — update/toggle pertama menghasilkan `CONFIG_VERSION_CONFLICT`, kemudian data terkini dimuatkan.

### Student Config Mock QA

Login Pelajar mock menggunakan `Ahmad Hakimi` / `M001`. Data mock menggunakan kelas A2/A3.

- `http://localhost:8080/?mock=1` — empat config aktif; `CUTI_SEMESTER` inactive dan tidak muncul.
- `http://localhost:8080/?mock=1&mockOutingTypes=optional` — satu jenis tanpa medan wajib untuk menguji hidden/disabled/required false.
- `http://localhost:8080/?mock=1&mockOutingTypes=empty` — response kosong dan fallback lima legacy types.
- `http://localhost:8080/?mock=1&mockOutingTypes=error-once` — request pertama gagal, fallback legacy dipaparkan dan `Cuba Lagi` memuatkan config aktif.

Semak Weekend mengisi `22:00` secara read-only. Tukar kepada Pulang Bermalam dan pastikan masa lama dikosongkan. Field tersembunyi mesti `disabled` serta tidak `required`.

### Localhost Beta GAS QA

Gunakan override ini hanya untuk menghubungkan frontend localhost kepada deployment GAS beta. Endpoint production kekal default dan query `api` sengaja diabaikan pada GitHub Pages atau hostname selain `localhost`/`127.0.0.1`.

Jalankan static server dari root repo:

```powershell
py -m http.server 8080
```

URL pembukaan pertama:

```text
http://localhost:8080/?api=<URL-ENCODED-BETA-GAS-WEB-APP-URL>
```

Nilai URL GAS beta mesti di-URL-encode sepenuhnya. Jangan letakkan PIN, token Telegram atau credential lain dalam query string. Selepas URL beta diterima, endpoint disimpan dalam `sessionStorage` untuk tab localhost itu sahaja. Reload tanpa query masih menggunakan endpoint sesi; menutup tab membersihkan override sesi. Override yang mempunyai protocol bukan HTTPS, domain selain `script.google.com`, path bukan `/macros/s/.../exec`, query tambahan atau fragment akan ditolak dan frontend kembali kepada endpoint production.

Apabila override aktif, footer menunjukkan label `BETA API` sahaja. URL GAS penuh tidak dipaparkan. Jangan jalankan ujian ini melalui URL GitHub Pages production.

Ujian Admin beta:

1. buka URL localhost beta dan pastikan label `BETA API` kelihatan;
2. pilih role Admin;
3. masukkan `ADMIN-BETA-01`;
4. baca PIN secara manual daripada tab `ADMIN_USERS` dalam Spreadsheet beta dan taip ke form;
5. cuba PIN salah dahulu dan pastikan mesej generik `ID atau nama Admin atau PIN tidak sah`;
6. login dengan PIN beta yang betul dan pastikan input PIN dikosongkan;
7. semak lima seed, refresh, create/edit/toggle dan conflict handling pada beta sahaja;
8. logout dan pastikan credential runtime serta senarai Admin dibersihkan.

Backend semasa belum mengeluarkan session token Admin. PIN berada dalam memory runtime untuk authenticated POST dan dedicated `sessionStorage` tab `eouting_admin_session_v1` untuk refresh restore; ia tidak disimpan dalam `localStorage`, URL atau log. Rekod menyimpan original normalized identity, PIN dan absolute `expiresAt` 12 jam. Restore mesti lulus `loginAdmin`, refresh tidak memanjangkan expiry, dan logout membersihkan saved/runtime state.

Untuk QA rollback/beta dengan `OUTING_CONFIG_V2_ENABLED=false` (bukan state production semasa), jangkaan yang betul ialah:

- authentication Admin serta Admin read/create/update/toggle masih boleh berfungsi untuk menyediakan konfigurasi beta;
- public `getOutingTypes` memulangkan fallback lima jenis legacy;
- `submitRequest` terus menggunakan validation legacy;
- konfigurasi v2 belum menjadi production flow.

Jangan aktifkan feature flag hanya untuk membuka atau memuatkan Admin Dashboard. `TELEGRAM_ENABLED` juga mesti kekal `false` sepanjang connection test ini.

## Automated Tests

Jalankan keseluruhan suite:

```powershell
node --test tests/*.test.js
```

Baseline kanonik semasa selepas Generic Application Date Window production close-out ialah **501/501 lulus**. Temporary installer verification Phase 5 pernah menghasilkan **446/446**, tetapi itu ialah milestone sejarah dan bukan baseline semasa.

Focused date-window coverage berada dalam suite schema/Admin/Student/submission sedia ada. Ia meliputi idempotent header migration, blank compatibility, save/clear/reload, invalid/reversed/same-day ranges, safe projection, inclusive Malaysia midnight boundaries, additive day/time rules dan backend rejection tanpa append.

Focused regression yang paling relevan:

```powershell
node --test tests/no-guard-departure-mvp.test.js tests/no-guard-auth-directory-regression.test.js tests/telegram-return-notifications-phase5.test.js
```

Coverage meliputi safe-default/config ON-OFF, Student ownership tanpa self-checkout, Warden authentication, dynamic A2/A3/LI fixtures, Guard/Warden race ordering, audit-backed pending/dedup, Telegram failure semantics, completion single-send dan canonical eOuting URL. Nama/PIN fixture seperti `ADMIN-MOCK`/`2468` atau Pelajar LI Regression ialah data test-only, bukan credential production atau business restriction.

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

Suite v2.0 bertambah mengikut fasa. Fasa 4 menambah `tests/admin-dashboard-v200.test.js` untuk login form, runtime-only PIN, dashboard/list states, create/edit/toggle wiring, optimistic conflict, larangan delete dan logout cleanup.
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
Get-Content gas/Code.gs -Raw | node --check -
Get-Content version.json -Raw | ConvertFrom-Json
git diff --check
```

Repo tidak mempunyai konfigurasi Markdown lint khusus pada v1.7.0.

## Smoke Test Pelajar

0. Selepas login, sahkan `ruleNotice` → identiti → `Status Semasa` → borang → Refresh Status/jumlah tahunan/`Rekod Outing Saya`; ayat panduan pendua tidak wujud.
1. Pastikan dropdown memaparkan nama dan filter A2/A3 berfungsi.
2. Pilih pelajar; `student_id` kekal value dalaman.
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

## PWA dan Cache

- Semak footer v2.4.0 dan popup update.
- Semak Cache Storage menggunakan `eouting-cache-v2.4.0-r7` dan asset query `2.4.0-r7`; displayed app version ialah v2.4.0.
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

Jangan commit token, secret, PIN sebenar, API key atau deployment credential. Untuk backend, `clasp push` mesti diikuti deployment Web App version baharu.

## Beta QA — Pengurusan Pelajar LI

Gunakan akaun Admin beta sahaja. Jangan gunakan PIN sebenar dalam Git, nota ujian atau tangkap layar.

1. Buka frontend localhost dengan endpoint GAS beta dan login sebagai Admin.
2. Pilih sub-tab `Pengurusan Pelajar`; pastikan `Tetapan Outing` masih boleh dibuka semula tanpa kehilangan fungsi CRUD sedia ada.
3. Tekan `Tambah Pelajar` dan cipta satu rekod sementara:
   - `student_id`: ID beta unik;
   - `no_matrik`: nilai unik berbentuk teks (uji nilai bermula sifar);
   - `nama`: nama ujian yang jelas;
   - `kelas`: `LI`;
   - `status`: `AKTIF`.
4. Semak carian melalui `student_id`, `no_matrik` dan `nama`; semak juga filter `LI` dan `Aktif`.
5. Log keluar Admin, buka flow `Pelajar` dan sahkan pilihan kelas `LI` muncul kerana sekurang-kurangnya seorang pelajar LI aktif wujud.
6. Pilih kelas LI, login menggunakan nama dan no. matrik sementara, kemudian sahkan flow Pelajar biasa masih berfungsi.
7. Login Admin semula, nyahaktifkan pelajar sementara dan refresh flow Pelajar; pilihan/nama LI mesti hilang jika tiada lagi pelajar LI aktif.
8. Aktifkan semula rekod itu dan sahkan kelas serta nama LI muncul kembali.
9. Edit nama/no. telefon/catatan dan pastikan `student_id` read-only. Cuba no. matrik yang sudah digunakan dan pastikan backend menolak perubahan.
10. Semak `AUDIT_LOG` beta untuk `CREATE_STUDENT`, `UPDATE_STUDENT`, `DEACTIVATE_STUDENT` dan `ACTIVATE_STUDENT`; pastikan tiada PIN direkodkan.

STUDENTS tidak menerima kolum version dalam fasa ini. Konflik serentak dikurangkan dengan `LockService` dan semakan duplicate di dalam lock; tiada migration schema diperlukan.
