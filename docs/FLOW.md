# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow **Live/pilot stable v1.6.16** untuk eOuting ITU.

Status semasa:

- GitHub Pages frontend live: `https://itumelaka.github.io/eouting`
- Google Sheets live backend melalui Google Apps Script Web App.
- PWA install dan version/cache update detection.
- Login Pelajar, Warden, dan Guard.
- Warden/Guard PIN validation di backend.
- Duplicate active request prevention di backend.
- Warden Dashboard dengan auto-refresh 60 saat dan manual `Refresh Permohonan`.
- Guard Dashboard dengan `Refresh Status` dan auto-refresh.
- Pemantauan Semasa read-only dengan loading state, summary cards, filter, dan Senarai Nama Semasa.
- Statistik Outing read-only.
- Telegram Bot notification asas.
- Audit log asas dalam `AUDIT_LOG`.

## Record Lifecycle

Status lifecycle dalam `OUTING_REQUESTS`:

```text
MENUNGGU_KELULUSAN
DILULUSKAN_WARDEN
DITOLAK_WARDEN
KELUAR
SELESAI
```

Status tambahan paparan seperti `LEWAT` dikira melalui medan `lewat` dan logic UI, bukan status lifecycle utama yang menggantikan status di atas.

## Flow Digital Live v1.6.16

```text
Pelajar login nama + no_matrik
   ↓
Pelajar submit OUTING_BIASA / KECEMASAN / PULANG_BERMALAM / CUTI_SEMESTER
   ↓
Backend semak duplicate active request
   ↓
Status: MENUNGGU_KELULUSAN
   ↓
Telegram alert permohonan baru
   ↓
Warden login nama + PIN
   ↓
Warden semak dashboard / checklist / copy senarai nama jika perlu
   ↓
Warden luluskan atau tolak
   ↓
Jika ditolak: DITOLAK_WARDEN
   ↓
Jika diluluskan: DILULUSKAN_WARDEN
   ↓
Guard login nama + PIN
   ↓
Guard refresh status jika perlu
   ↓
Guard sahkan keluar
   ↓
Status: KELUAR
   ↓
Guard sahkan masuk
   ↓
Status: SELESAI
   ↓
Pelajar, Warden, Guard, Pemantauan Semasa, Statistik, dan laporan papar rekod terkini
```

## Pelajar

Pelajar login menggunakan:

- Nama pelajar
- `no_matrik`

GAS backend menyemak data dalam tab `STUDENTS`.

Syarat:

- `status = Aktif` boleh login dan mohon outing.
- `status = Tidak Aktif` tidak boleh login dan tidak boleh mohon outing.
- Pelajar tidak boleh submit request baru jika masih ada active request.

Jenis permohonan:

- `OUTING_BIASA`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Maklumat asas:

- Tujuan
- Lokasi
- Jenis kenderaan
- Butiran kenderaan
- Tarikh/masa berkaitan jika jenis permohonan memerlukan maklumat tambahan

Untuk `KECEMASAN`, maklumat tambahan boleh termasuk:

- Sebab kecemasan
- Telefon waris
- Hubungan waris
- Catatan kecemasan

## Rekod Saya

`Rekod Saya` membezakan rekod aktif dan rekod selesai/ditolak.

Rekod aktif:

- `MENUNGGU_KELULUSAN`
- `DILULUSKAN_WARDEN`
- `KELUAR`

Rekod aktif akan menghalang duplicate request pelajar yang sama di backend.

Rekod selesai/ditolak:

- `SELESAI`
- `DITOLAK_WARDEN`

Rekod selesai dan ditolak tidak menghalang permohonan baru.

## Rule Masa

Outing Biasa:

- Hanya Selasa / Rabu.
- Masa keluar selepas 5:00 PM.
- Pelajar perlu balik sebelum atau pada 10:00 PM.

Kecemasan:

- Boleh dihantar bila-bila masa.
- Masih perlu kelulusan warden.

Pulang Bermalam dan Cuti Semester:

- Menggunakan flow kelulusan Warden dan pengesahan Guard yang sama.
- Dipaparkan dalam checklist dan dashboard mengikut status semasa.

## Warden

Warden login menggunakan:

- Nama Warden
- PIN

Backend validate:

- Nama Warden.
- PIN tidak kosong.
- PIN betul.
- Status Warden aktif.

Tindakan utama:

- Semak permohonan menunggu.
- Luluskan permohonan.
- Tolak permohonan.
- Manual `Refresh Permohonan`.
- Auto-refresh dashboard setiap 60 saat semasa berada di halaman Warden.

Status selepas tindakan:

- Lulus: `DILULUSKAN_WARDEN`
- Tolak: `DITOLAK_WARDEN`

## Warden Checklist Permohonan

Checklist Warden ialah paparan ringkas/read-only untuk semua jenis permohonan:

- `OUTING_BIASA`
- `KECEMASAN`
- `PULANG_BERMALAM`
- `CUTI_SEMESTER`

Filter checklist:

- Semua
- Outing
- Bermalam
- Cuti Semester
- Kecemasan

Checklist memaparkan:

- Ikon/checkbox visual status.
- Nama pelajar.
- Kelas.
- Tarikh/masa berkaitan.
- Badge jenis permohonan.
- Badge status sebenar.

Klik row status `MENUNGGU_KELULUSAN` boleh membawa Warden kepada kad detail approve/reject sedia ada. Row status lain adalah read-only.

## Copy Senarai Nama

`Copy Senarai Nama` di Warden Checklist menyalin teks ringkas untuk WhatsApp.

Status yang dimasukkan:

- `MENUNGGU_KELULUSAN` = 🟡
- `DILULUSKAN_WARDEN` = 🟢
- `KELUAR` = 🚶
- `SELESAI` = ✅

Status yang dikecualikan:

- `DITOLAK_WARDEN`

Output clipboard mengandungi header mengikut filter semasa, senarai ikon + nombor + nama, dan petunjuk ikon.

## Guard

Guard login menggunakan:

- Nama Guard
- PIN

Backend validate:

- Nama Guard.
- PIN tidak kosong.
- PIN betul.
- Status Guard aktif.

Tindakan:

- `Refresh Status` untuk memuat semula rekod dari Google Sheets.
- Confirm keluar selepas status `DILULUSKAN_WARDEN`.
- Confirm masuk selepas status `KELUAR`.

Status selepas confirm keluar:

- `KELUAR`

Status selepas confirm masuk:

- `SELESAI`

Jika masa masuk selepas had pulang, rekod ditanda lewat melalui medan `lewat`.

## Pemantauan Semasa

`Pemantauan Semasa` ialah paparan read-only untuk melihat rekod terkini tanpa mengubah status.

Komponen utama:

- Loading state `Memuatkan rekod pemantauan...`
- Refresh manual.
- Timestamp kemas kini.
- Summary cards.
- Filter.
- Senarai rekod detail.
- Panel `Senarai Nama Semasa`.

Panel `Senarai Nama Semasa` memaparkan format live seperti output WhatsApp:

```text
SENARAI NAMA PERMOHONAN eOUTING

🟡 1. NAMA PELAJAR
🟢 2. NAMA PELAJAR
🚶 3. NAMA PELAJAR
✅ 4. NAMA PELAJAR

Petunjuk:
🟡 Menunggu kelulusan
🟢 Diluluskan warden
🚶 Sedang keluar
✅ Sudah balik ke asrama
```

Status `DITOLAK_WARDEN` tidak dipaparkan dalam senarai nama semasa.

## Dashboard Dan Statistik

Dashboard dan Pemantauan boleh memaparkan:

- Menunggu Kelulusan
- Diluluskan
- Sedang Keluar
- Sudah Pulang
- Lewat
- Belum Masuk
- Kecemasan

`Statistik` ialah paparan read-only untuk ringkasan bulanan outing.

Filter tersedia:

- Bulan
- Tahun
- Kelas

Paparan Statistik menunjukkan ringkasan permohonan, status, kelas, dan kekerapan pelajar.

## PWA Dan Update

PWA menggunakan:

- `APP_VERSION` dalam frontend.
- Query string versi untuk asset.
- `version.json` untuk update detection.
- Service worker cache version.
- Update popup / `Apa yang baharu`.

Setiap release frontend perlu menaikkan versi supaya telefon/PWA menerima asset baru.

## Prinsip Penting

- Frontend role hiding bukan security sebenar.
- Semua validation penting dibuat dalam GAS backend.
- Semua action penting direkod dalam `AUDIT_LOG`.
- eOuting v1.6.16 ialah live/pilot stable, bukan final production security.
