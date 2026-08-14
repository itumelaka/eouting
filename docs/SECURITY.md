# Security Notes eOuting ITU

Dokumen ini menerangkan boundary keselamatan production **v2.2.1 / GAS Version 43**. Frontend ialah laman statik yang boleh diperiksa oleh pengguna; authorization sebenar mesti berlaku di GAS dan Google Sheets.

## Public Data Boundary

Public `getStudents` hanya mengembalikan:

```text
student_id | nama | kelas
```

Public GET `getTodayRecords` hanya mengembalikan:

```text
nama | kelas | jenis_permohonan | status | lewat | belum_masuk
```

Nama dibenarkan pada Public Monitoring read-only v1.6.25. PII dan metadata berikut kekal disekat:

- `student_id` daripada monitoring;
- `no_matrik` dan `request_id`;
- e-mel dan nombor telefon;
- nama/telefon waris;
- lokasi, tujuan dan maklumat kenderaan;
- sebab kecemasan penuh dan catatan dalaman;
- `sebab_batal_pelajar`, `masa_batal_pelajar` dan `dibatalkan_oleh`;
- nama pegawai/audit metadata;
- `selfie_status`, `selfie_file_id`, `selfie_url`, `masa_selfie` dan `selfie_telegram_message_id`;
- PIN, credential dan secret.

Endpoint compatibility `getOutingStats` hanya menyediakan aggregated counts, bukan row mentah atau leaderboard individu. Landing awam tidak menyediakan kad atau navigasi Statistik; UI Statistik dan data individu hanya tersedia dalam sesi Admin authenticated.

## Authenticated Operational Records

Rekod operasi menggunakan POST `getTodayRecords` yang berasingan:

- Pelajar: backend sahkan `student_id` + `no_matrik` dan hanya pulangkan rekod Pelajar itu.
- Warden: backend sahkan nama + PIN dan pulangkan rekod operasi Warden.
- Guard: backend sahkan nama + PIN dan pulangkan rekod operasi Guard.

Jika credential hilang atau salah, frontend menunjukkan error terkawal. Authenticated flow tidak fallback kepada public GET dan tidak merender data awam seolah-olah data operasi.

## PIN dan Session

PIN ialah basic internal access control, bukan authentication production-grade.

Backend memastikan:

- Warden/Guard login memerlukan nama + PIN aktif;
- approve/reject memerlukan credential Warden;
- confirm keluar/masuk memerlukan credential Guard;
- PIN kosong/null/whitespace ditolak;
- PIN tidak dipulangkan oleh response login atau public endpoint.

PIN yang ditaip digabungkan ke runtime session selepas fresh staff login supaya POST operasi boleh berjalan. Flow `Ingat peranti ini` sedia ada menggunakan localStorage dengan expiry; jangan gunakannya pada peranti public/shared tanpa kelulusan operasi. Shared Guard PC perlu log keluar selepas digunakan.

Admin menggunakan mekanisme berasingan dan tidak masuk ke localStorage. Login berjaya menyimpan `{ identity, pin, expiresAt }` dalam tab-scoped `sessionStorage` menggunakan key `eouting_admin_session_v1`. Expiry absolute ialah 12 jam dan refresh tidak memanjangkannya. Restore mesti menghantar semula `{ admin_id: identity, nama_admin: identity, pin }` kepada `loginAdmin`; sessionStorage sahaja bukan bukti authentication. Credential malformed/expired/rejected dibersihkan bersama runtime/partial session, dan logout menghapuskan saved record serta `adminRuntimeCredential`.

Jangan hardcode PIN dalam frontend, test fixture production atau dokumentasi.

## Service Worker dan Cache

- Request GAS/API menggunakan network sahaja.
- Service worker tidak memanggil `caches.match` atau `cache.put` untuk response dinamik.
- Cache eOuting lama dibuang semasa activate.
- Static app shell kekal cacheable.
- API/external request dan imej selfie sensitif tidak dimasukkan ke Cache Storage.
- Cache source semasa ialah `eouting-cache-v2.2.1-r4`; displayed app version ialah v2.2.1.

Ini menghalang response API lama yang mungkin mengandungi PII daripada kekal dalam Cache Storage selepas deployment.

## Backend Validation

GAS mesti mengesahkan:

- identiti dan status aktif Pelajar;
- identiti, status dan PIN Warden/Guard;
- role/action permission;
- transition status sebelum approve/reject/confirm;
- duplicate active request;
- rule masa Outing Biasa;
- credential operasi sebelum mengeluarkan row penuh.

Role kelulusan HEP/Warden tidak dipercayai daripada frontend. Selepas credential nama + PIN dipadankan kepada row WARDENS aktif, backend memperoleh role daripada `warden_id` (`HEP-*`, `W-*`, fallback WARDEN). Tiada role atau lifecycle tambahan diperkenalkan; status kekal `DILULUSKAN_WARDEN`.

`submitRequest` mengesahkan initial status, menulis nilai mengikut susunan header Sheet sebenar dan membaca semula row persisted. Blank/tidak sah tidak boleh diterima sebagai status baru, dan paparan frontend tidak menaik taraf blank kepada pending secara visual.

Nilai masa sahaja Sheet dinormalkan server-side kepada `HH:mm` dengan `Asia/Kuala_Lumpur` sebelum keluar melalui API atau Telegram. Frontend tidak menggunakan aritmetik offset manual; fallback legacy hanya menghalang nilai epoch 1899 daripada bocor. Perubahan ini mengekalkan timestamp sebenar dan polisi lewat.

Untuk `cancelStudentRequest`, GAS mengesahkan semula identiti Pelajar aktif melalui `student_id` + `no_matrik`, memastikan request itu milik Pelajar tersebut dan mengesahkan sebab selepas trim pada julat 5–500 aksara. Frontend validation dan visibility butang hanyalah UX; backend tidak mempercayainya.

Cancellation menggunakan `ScriptLock`, kemudian membaca semula row serta status authoritative sebelum write. Hanya `MENUNGGU_KELULUSAN` dan `DILULUSKAN_WARDEN` diterima. Approval/rejection Warden serta Guard `confirmOut` turut dilindungi lock/revalidation supaya hanya satu transition menang; `KELUAR` tidak boleh ditimpa oleh `DIBATALKAN_PELAJAR`. Rekod dikekalkan dan audit `CANCEL_STUDENT_REQUEST` ditulis selepas kejayaan.

Notifikasi Telegram cancellation berlaku selepas transition atomic. Satu cubaan dibuat bagi setiap cancellation berjaya, termasuk previous status pending dan approved. Return false atau exception Telegram dilog sebagai warning tetapi tidak menggagalkan/rollback cancellation dan tidak menyebabkan mesej pendua. Attempt tidak dibuat apabila validation, ownership atau status ditolak.

Untuk `submitReturnSelfie`, GAS turut mengesahkan:

- `request_id`, `student_id` dan `no_matrik`;
- pemilikan rekod melalui padanan `student_id` + `no_matrik`;
- status tepat `SELESAI` dan kewujudan `masa_masuk`;
- duplicate submission di bawah `LockService`;
- MIME JPEG, PNG atau WebP;
- base64 tidak kosong, sah dan tidak berlebihan saiz;
- bukti ialah data imej, bukan URL Drive yang dibekalkan client.

Gambar disimpan dalam folder Google Drive private. `LockService` merangkumi semakan duplicate, simpanan Drive, penghantaran Telegram dan kemas kini Sheet. Kegagalan transaksi separa membersihkan fail Drive dan/atau mesej Telegram yang baru dibuat. Selepas transaksi utama berjaya, kegagalan audit hanya menghasilkan warning dan tidak menukar `SUDAH_HANTAR` kepada kegagalan.

## Foto Profil Pelajar

- Upload mengesahkan semula `student_id` + `no_matrik` pelajar aktif dan hanya mengemas kini row pelajar tersebut.
- MIME dibenarkan hanya JPEG, PNG dan WebP; SVG, bukan-imej dan payload berlebihan ditolak pada client dan GAS.
- `PROFILE_PHOTO_FOLDER_ID` menunjuk ke folder private yang berasingan daripada `SELFIE_FOLDER_ID`; code tidak memanggil `setSharing` atau menghasilkan URL public.
- API operasi memulangkan indikator sahaja. Byte foto kompak diperoleh melalui satu POST batch `photo_variant = "thumbnail"` yang mengesahkan Student, Warden/HEP, Guard atau Admin. Pelajar dihadkan kepada ID sendiri; staff operasi dihadkan kepada student operasi semasa.
- Selepas authorization, GAS menyelesaikan fail private, mendapatkan Drive API v3 `thumbnailLink` dan memuat turun thumbnail menggunakan OAuth Apps Script. Response hanya mengandungi data URI selamat; file ID, Drive URL, `thumbnailLink` dan token tidak dihantar.
- Thumbnail sebenar ialah trigger preview hanya selepas byte selamat wujud dalam cache authenticated. Modal meminta `photo_variant = "full"` untuk satu pelajar jika full cache kosong, menunjukkan loading/error/retry selamat dan menggunakan cache sesi pada pembukaan seterusnya.
- Cache thumbnail/full, loaded/negative state dan concurrent requests adalah berasingan serta diinvalidasi bersama selepas replacement/removal. Kegagalan thumbnail tidak membuat fallback bulk kepada imej stored 600×800.
- Preview memaparkan hanya nama serta kelas/ID yang sudah tersedia secara sah kepada viewer tersebut. Initials placeholder tidak interactive dan Public Monitoring tidak merender trigger preview.
- Public Monitoring/GET tidak menerima foto, file ID, data URI atau masa kemas kini foto.
- Semasa replacement, fail baharu dicipta dan metadata Sheet disimpan dahulu. Fail lama hanya ditrash selepas disahkan mempunyai parent folder profil yang dikonfigurasi. Kegagalan sebelum metadata baharu disimpan mengekalkan foto lama.
- Admin removal memerlukan credential aktif, pengesahan UI, mengosongkan metadata, mengehadkan trash kepada folder profil dan menulis `REMOVE_STUDENT_PROFILE_PHOTO` tanpa byte imej.
- Foto profil tidak dihantar ke Telegram dan tidak menggunakan mana-mana field `selfie_*`.
- Action sheet foto profil menyediakan kamera `accept="image/*" capture="user"` dan galeri `accept="image/*"` tanpa capture. Kedua-duanya tetap melalui allowlist MIME JPEG/PNG/WebP serta pipeline validation/upload yang sama; atribut capture ialah hint peranti, bukan security boundary.

Authorization tetap dijalankan pada setiap thumbnail/full request; cache tidak menyimpan keputusan authorization. Manifest tidak menambah explicit OAuth scope baharu kerana Drive dan external-request sudah digunakan oleh backend. `.claspignore` mesti mengehadkan deploy kepada `gas/appsscript.json` dan source kanonik `gas/Code.gs`; snapshot GAS lama tidak boleh berada dalam payload deploy.

Frontend role hiding, button visibility, PWA install dan local state bukan security enforcement.

## Backend Admin Config

### Notis Banner Authenticated

- Read Admin dan mutation banner ialah POST-only serta memerlukan credential Admin aktif.
- Viewer endpoint mengesahkan Student, Warden/HEP, Guard atau Admin dan hanya memulangkan `active`, `important`, `text` serta `updated_at` apabila aktif; `updated_by` hanya tersedia kepada Admin dan tidak didedahkan kepada ordinary viewer.
- Landing, Public Pemantauan dan semua GET awam tidak menerima banner atau nama Script Property.
- Teks di-trim, dihadkan kepada 500 aksara dan dirender frontend menggunakan `textContent`; input HTML/script kekal teks biasa.
- Property yang hilang bermaksud banner tidak aktif. Simpanan Admin pertama mengisi Script Properties secara automatik; tiada sheet `ANNOUNCEMENTS` atau setup property manual.
- Audit `UPDATE_ANNOUNCEMENT_BANNER` menyimpan status, flag penting dan ringkasan teks maksimum 120 aksara tanpa PIN, secret atau nilai property.
- Banner tidak digunakan sebagai input kepada mana-mana peraturan outing. Free text tidak boleh mengubah `OUTING_TYPES` atau `earliest_departure_time`; perubahan enforcement masih memerlukan mutation berasingan melalui Tetapan Outing.

- `OUTING_TYPES` kini authoritative bagi config-driven production; `ADMIN_USERS` kekal private.
- `ADMIN_USERS` tidak diseed dengan akaun atau PIN contoh.
- Fasa 3 menambah `loginAdmin`, public safe config GET dan Admin read/create/update/toggle melalui POST.
- Tiada Dashboard Admin, butang login Admin atau session token frontend dalam Fasa 3.
- `OUTING_CONFIG_V2_ENABLED` default kepada string `false` dan migration tidak pernah menetapkannya kepada `true`.
- Dalam rekod Fasa 3 asal, `submitRequest` masih menggunakan whitelist dan validation hard-coded v1.7.1; production semasa menggunakan resolver config-driven apabila flag aktif.
- `type_code` seed tidak ditukar atau ditimpa apabila migration dijalankan semula.
- Tab `ADMIN_USERS`, khususnya kolum `pin`, mesti kekal private dan tidak boleh diterbitkan melalui GET awam pada fasa akan datang.
- Login dan setiap Admin API mengesahkan `admin_id` atau `nama_admin`, PIN tepat dan status `AKTIF` terus terhadap Sheet.
- Response login, public config, Admin config dan audit tidak memulangkan PIN atau row `ADMIN_USERS`.
- Public `getOutingTypes` tidak mendedahkan `active`, `config_version`, `created_*`, `updated_*` atau metadata Admin.
- Create/update/toggle menggunakan `LockService`; optimistic `expected_config_version` menghalang overwrite konfigurasi yang sudah berubah.
- Semua boolean, masa, hari, `sort_order`, kod dan nama disahkan di GAS tanpa mempercayai frontend.

### Frontend Admin — keadaan production semasa

- PIN berada dalam `adminRuntimeCredential` semasa runtime dan dedicated `sessionStorage` tab untuk restore terkawal.
- PIN input dikosongkan selepas login berjaya/gagal dan semasa logout.
- Admin tidak menggunakan `rememberSessionIfRequested` atau localStorage. Key `eouting_admin_session_v1` ialah satu-satunya persistence Admin yang diluluskan dalam architecture semasa.
- Saved session menyimpan original normalized identity, PIN dan absolute `expiresAt`; refresh tidak mengubah expiry.
- Restore sentiasa memerlukan revalidation `loginAdmin` sebelum UI privileged dipaparkan dan menggunakan semantic payload yang sama seperti login biasa.
- Credential dan response Admin tidak dicetak melalui `console`.
- Error login menggunakan mesej generik dan tidak memaparkan credential yang ditaip.
- Dashboard tidak membaca atau memaparkan row `ADMIN_USERS`.
- `type_code` read-only semasa edit; status active hanya melalui toggle dengan confirmation.
- Frontend validation ialah bantuan UX sahaja; GAS kekal authorization dan validation boundary.
- Logout membersihkan credential runtime, list config dan state editor Admin.
- Restore failure membersihkan saved record, runtime credential serta partial `currentSession` dan tidak membuat retry loop.

### Pengasingan Mock Admin Fasa 4.5

- Router Mock Admin hanya aktif apabila URL mempunyai query tepat `mock=1`.
- Live mode tidak mencipta credential Mock Admin dan terus menghantar action Admin kepada GAS.
- Credential `ADMIN-MOCK` / PIN QA ialah data development sahaja, bukan akaun `ADMIN_USERS` dan tidak diseed ke Google Sheets.
- Login response mock tidak memulangkan PIN dan router mock tidak log credential.
- Create, update dan toggle mock hanya menulis array memory tab semasa; tiada `fetch`, GAS atau persistence browser.
- PIN Admin mock/live tidak disimpan dalam localStorage. Dedicated Admin sessionStorage menggunakan schema/expiry yang sama dan dibersihkan semasa logout.
- Query `mockAdminError=1` dan `mockAdminConflict=1` hanya berfungsi bersama `mock=1`.

### Canonical POST Router Fasa 4.6

- Frontend mempunyai satu sahaja `apiPost`, mengelakkan security/mock guard ditambah pada declaration yang tidak efektif.
- Mock guard dinilai sebelum `fetch`; tanpa `mock=1`, action terus menggunakan GAS live.
- Live POST menggunakan `cache: no-store` dan semua response melalui `parseApiResponse`.
- HTML, JSON tidak sah, HTTP failure dan backend `ok: false` ditolak secara terkawal tanpa mengubah payload atau authorization GAS.

### Student Config Rendering Fasa 5A

- Pelajar hanya membaca safe public projection `getOutingTypes`; metadata Admin dan row `ADMIN_USERS` tidak terlibat.
- Loader berjalan selepas sesi Pelajar dibuka, bukan semasa Admin/Warden/Guard flow.
- Inactive config ditapis dan duplicate/invalid type code tidak dirender.
- Hidden field dikosongkan, dinyah-required dan disabled supaya nilai lama tidak terbawa dalam submission frontend.
- Kegagalan atau config kosong menggunakan legacy config tempatan, bukan data raw atau Admin API.
- Frontend config bukan authorization boundary; GAS `submitRequest` kekal validation source of truth. Fasa 5B membaca config terus daripada Sheet hanya apabila feature flag aktif.
- Mock public config hanya dipintas apabila query tepat `mock=1` digunakan.

### Submit Validation Fasa 5B

- `OUTING_CONFIG_V2_ENABLED` mesti tepat `"true"`; semua nilai lain menggunakan validator legacy.
- Backend tidak menerima row config atau required flags daripada payload Pelajar.
- `type_code` dinormalisasi case-insensitive, tetapi mesti mematuhi format terkawal dan sepadan dengan row active.
- Semua boolean Sheet dibaca secara ketat. Nilai tidak dikenali, header/sheet hilang, config version tidak sah atau schema malformed gagal tertutup dengan mesej selamat.
- Tarikh menggunakan format ISO `YYYY-MM-DD`, masa menggunakan `HH:mm`, dan `allowed_days` serta application window dinilai dalam zon `Asia/Kuala_Lumpur`.
- `fixed_return_time` dikuatkuasakan oleh backend; nilai client tidak boleh mengatasinya.
- `require_warden_approval = false` menggunakan auto-approval backend beridentiti `AUTO_CONFIG_V2`; client tidak boleh memilih status awal sendiri.
- Audit hanya menyimpan type code dan config version tambahan, bukan config penuh atau credential.
- Feature flag production ialah `true` sejak controlled activation 10 Ogos 2026. Rollback kepada `false` mengembalikan validator legacy tanpa redeployment; reactivation hanya apabila readiness hijau.

### Guard Policy Error Boundary

- `confirmOut` menolak future approved departure date, disallowed configured day dan waktu sebelum `earliest_departure_time`.
- Hanya bentuk mesej polisi tarikh/hari/masa Melayu yang diallowlist dipaparkan kepada Guard.
- Network, unrelated dan internal failures menggunakan mesej retry generic; stack, line number dan internal exception tidak didedahkan.

## Telegram dan Deployment Secrets

Jangan commit:

- Telegram bot token atau secret chat configuration;
- PIN sebenar;
- password, API key atau access token;
- Apps Script/deployment credential;
- data Google Sheets atau PII pelajar;
- secret dalam logs, screenshots atau debug output.

Telegram configuration mesti disimpan dalam Apps Script Script Properties. Deployment URL boleh kekal dalam frontend, tetapi credential untuk mengurus deployment tidak boleh berada dalam repo.

Selfie dihantar sebagai foto sebenar melalui Telegram `sendPhoto`. Pentadbir atau staf yang mempunyai akses kepada folder Drive atau group Telegram boleh melihat selfie yang dihantar; akses tersebut ialah tanggungjawab privasi operasi dan perlu disemak secara berkala. Sistem tidak mendakwa encryption tambahan selain perlindungan default platform Google Drive dan Telegram.

## Spreadsheet dan Audit

- Spreadsheet mesti private dan dikongsi kepada akaun yang perlu sahaja.
- Jangan publish tab sebagai public.
- Audit log tidak boleh menyimpan PIN atau raw credential.
- `entity_type` dan `entity_id` ialah metadata audit generik; jangan gunakan kedua-duanya untuk menyimpan secret atau PII yang tidak diperlukan.
- Semak access owner/editor secara berkala.
- Retention dan backup policy masih perlu ditetapkan.
- Retention/deletion policy khusus untuk selfie masih perlu ditetapkan.
- Retention/deletion policy khusus untuk foto profil juga perlu ditetapkan.

## Roadmap

- PIN unik dan hashed.
- Google Account/domain-restricted login.
- Backend-issued session token.
- Audit retention dan role-based access review.
- Evidence review UI, retention selfie dan automated cleanup.
- Refinement notis consent/privacy Pelajar.
- Deployment permission dan backup policy yang lebih ketat.

## Pengurusan Pelajar Beta

- Semua read/write Pengurusan Pelajar memerlukan credential Admin aktif dan menggunakan POST.
- PIN Admin kekal dalam runtime browser sahaja dan tidak dimasukkan dalam response atau audit.
- Create/update/toggle menggunakan `LockService`; semakan keunikan `student_id` dan `no_matrik` diulang dalam lock.
- Audit menyimpan identiti Admin, `student_id`, tindakan dan ringkasan medan berubah sahaja.
- Nyahaktif tidak memadam pelajar atau rekod outing lama; public `getStudents` memang menapis rekod tidak aktif.

## Modul Operasi Admin

- Pemantauan, Statistik individu, Rekod Master, Warden/HEP/Guard dan Tetapan Pelajar ialah modul inline Admin; data sensitifnya menggunakan POST-only dan memerlukan credential Admin aktif pada setiap request.
- Public GET kekal aggregate/safe projection dan tidak mendapat akses kepada dataset Admin.
- Senarai staff tidak memulangkan PIN; reset PIN hanya diterima pada write individu dan tidak dicatat dalam audit.
- Rekod Master mengecualikan nombor telefon waris daripada list serta butiran yang dikembangkan.
- Write staff menggunakan lock, validasi role `WARDEN`/`GUARD`, pencegahan ID/nama pendua dan confirmation UI untuk nyahaktif.
