# Local Development dan Testing

Panduan ini merujuk eOuting ITU **v2.0.0**.

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

Credential ini hanya dibina apabila query tepat `mock=1` hadir. Tanpa query tersebut, semua action Admin menggunakan GAS live dan credential mock tidak diterima. Mock login response tidak mengandungi PIN; PIN hanya berada dalam runtime tab semasa dan dibersihkan semasa logout.

Lima jenis outing disediakan dalam memory, termasuk `CUTI_SEMESTER` yang tidak aktif untuk QA toggle. Create, edit dan toggle hanya mengubah array memory dan tidak memanggil GAS atau Google Sheets. Refresh page mengembalikan seed asal.

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

Backend semasa belum mengeluarkan session token Admin. PIN yang ditaip disimpan hanya dalam memory runtime tab untuk menghantar authenticated Admin POST berikutnya; ia tidak disimpan dalam `localStorage`, `sessionStorage`, URL atau log. Logout membersihkan credential runtime tersebut.

Dengan `OUTING_CONFIG_V2_ENABLED=false`, jangkaan yang betul ialah:

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

Baseline release v2.0.0 ialah **177/177 lulus**.

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
8. logout dan pastikan refresh browser tidak memulihkan session Admin.

Suite utama:

- `tests/student-directory-security.test.js`: projection direktori Pelajar dan login backend.
- `tests/student-login-dropdown-privacy.test.js`: dropdown nama tanpa nombor matrik.
- `tests/public-monitoring-statistics-security.test.js`: privacy public response, operational POST, credential runtime, statistik agregat dan status kontekstual.
- `tests/guard-quick-filter.test.js`: filter Guard dan contextual empty-state.
- `tests/public-monitoring-lifecycle.test.js`: one-click, scroll, GET awam, single-flight, error/cached refresh dan satu render.
- `tests/public-monitoring-compact-layout.test.js`: layout ringkas, `Senarai Status Semasa`, ringkasan dan isolation Warden/Guard.
- `tests/service-worker-security.test.js`: API network-only, cache cleanup, static cache dan version consistency.
- `tests/selfie-proof-v170.test.js`: eligibility keempat-empat jenis, mapping/private projection, compression/upload, backend validation, duplicate protection, migration, confirmIn, cleanup dan audit failure selepas transaksi berjaya.

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

1. Pastikan dropdown memaparkan nama dan filter A2/A3 berfungsi.
2. Pilih pelajar; `student_id` kekal value dalaman.
3. Masukkan nombor matrik betul dan sahkan login berjaya.
4. Cuba nombor matrik salah dan sahkan login ditolak.
5. Hantar permohonan dan semak Rekod Saya.
6. Uji `Ingat peranti ini` dan restore session.
7. Selepas Guard confirm masuk, semak badge `Bukti Selfie Belum Dihantar`.
8. Uji capture/pilih gambar, preview, ambil semula dan `Hantar Bukti`.
9. Dalam mock mode, sahkan badge bertukar kepada `Bukti Selfie Dihantar` tanpa request Drive/Telegram.

## Smoke Test Warden

1. Login nama + PIN selepas fresh page load.
2. Pastikan Dashboard dan Checklist memuatkan nama sebenar.
3. Semak emoji/label kontekstual.
4. Refresh Permohonan.
5. Uji approve/reject dan Telegram.
6. Pastikan credential hilang menghasilkan error, bukan data Public Monitoring.

## Smoke Test Guard

1. Login nama + PIN.
2. Refresh dan semak `Sedia Untuk Keluar` serta `Sedang Keluar`.
3. Uji filter Semua, Outing Harian, Pulang Bermalam, Cuti Semester, Kecemasan dan Lewat.
4. Pastikan Outing Harian tidak menangkap Kecemasan.
5. Uji confirm keluar/masuk dan Telegram.

## Smoke Test Public Monitoring

1. Dari halaman utama tekan `Pemantauan Semasa` sekali.
2. Pastikan workspace aktif dan viewport scroll ke atas.
3. Pastikan satu GET `getTodayRecords` dibuat dan tiada POST authenticated digunakan.
4. Semak loading, ringkasan dan `Senarai Status Semasa`.
5. Semak setiap baris: nama, kelas, jenis, ikon dan label kontekstual.
6. Pastikan `Rekod Hari Ini`, quick filter monitor dan `Belum Pulang Ke Asrama` tidak wujud.
7. Klik refresh berulang semasa request aktif dan pastikan tiada overlap.
8. Simulasi refresh gagal dan pastikan data/timestamp lama kekal.

## PWA dan Cache

- Semak footer v2.0.0 dan popup update.
- Semak Cache Storage menggunakan `eouting-cache-v2.0.0`.
- Semak request GAS/API dalam Network dan pastikan ia tidak dimasukkan ke Cache Storage.
- Semak request external dan imej selfie sensitif tidak dimasukkan ke Cache Storage.
- Static HTML/CSS/JS/icon boleh kekal dicache.

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
