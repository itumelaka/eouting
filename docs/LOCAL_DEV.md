# Local Development dan Testing

Panduan ini merujuk eOuting ITU **v1.7.1**.

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

## Automated Tests

Jalankan keseluruhan suite:

```powershell
node --test tests/*.test.js
```

Baseline release v1.7.1 ialah **60/60 lulus**.

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

- Semak footer v1.7.1 dan popup update.
- Semak Cache Storage menggunakan `eouting-cache-v1.7.1`.
- Semak request GAS/API dalam Network dan pastikan ia tidak dimasukkan ke Cache Storage.
- Semak request external dan imej selfie sensitif tidak dimasukkan ke Cache Storage.
- Static HTML/CSS/JS/icon boleh kekal dicache.

## Workflow Git

```powershell
git status --short
git diff
```

Jangan commit token, secret, PIN sebenar, API key atau deployment credential. Untuk backend, `clasp push` mesti diikuti deployment Web App version baharu.
