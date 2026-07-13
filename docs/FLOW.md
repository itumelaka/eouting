# Flow Sistem eOuting ITU

Dokumen ini menerangkan flow live **v1.6.25**.

## Lifecycle Rekod

```text
MENUNGGU_KELULUSAN
  -> DILULUSKAN_WARDEN atau DITOLAK_WARDEN
DILULUSKAN_WARDEN
  -> KELUAR
KELUAR
  -> SELESAI
```

`lewat` ialah flag tambahan. Label kontekstual frontend tidak menukar nilai status backend.

## Flow Utama

```text
Pelajar pilih nama + masukkan no_matrik
  -> backend sahkan student_id + no_matrik dari STUDENTS
  -> Pelajar hantar OUTING_BIASA / KECEMASAN / PULANG_BERMALAM / CUTI_SEMESTER
  -> backend halang duplicate active request
  -> MENUNGGU_KELULUSAN + Telegram
Warden login nama + PIN
  -> POST getTodayRecords authenticated
  -> approve atau reject + Telegram
Guard login nama + PIN
  -> POST getTodayRecords authenticated
  -> confirm keluar / masuk + Telegram
Pelajar, Warden dan Guard refresh melalui laluan authenticated masing-masing
```

## Pelajar

Direktori public hanya membekalkan `student_id`, `nama` dan `kelas`. Dropdown menggunakan `student_id` sebagai value dalaman dan memaparkan nama. Nombor matrik ditaip berasingan dan backend memadankan kedua-dua credential dengan row Google Sheets.

Pelajar hanya menerima rekod sendiri melalui authenticated POST `getTodayRecords`. Active request menghalang permohonan baharu sehingga selesai atau ditolak.

## Warden

Warden login menggunakan nama + PIN. PIN yang ditaip disimpan dalam runtime session untuk request operasi semasa; flow remember-device sedia ada kekal berfungsi.

Warden boleh:

- refresh permohonan;
- melihat Dashboard dan Checklist Permohonan;
- approve/reject;
- salin senarai nama dengan emoji status.

Checklist memaparkan semua jenis permohonan. Ikon dan label menggunakan status kontekstual pusat.

## Guard

Guard login menggunakan nama + PIN dan menerima rekod operasi penuh melalui POST authenticated.

Seksyen utama:

- `Sedia Untuk Keluar`;
- `Sedang Keluar`.

Quick filter Guard:

- Semua
- Outing Harian
- Pulang Bermalam
- Cuti Semester
- Kecemasan
- Lewat

Filter digunakan pada kedua-dua seksyen. Empty-state berubah mengikut filter dan seksyen. `Kecemasan` tidak dianggap Outing Harian.

## Status Kontekstual

- 🟡 Menunggu Kelulusan
- 🟢 Diluluskan
- 🚶 Sedang Keluar untuk `OUTING_BIASA` atau `KECEMASAN` + `KELUAR`
- 🌙 Sedang Bermalam untuk `PULANG_BERMALAM` + `KELUAR`
- 🏖️ Sedang Bercuti untuk `CUTI_SEMESTER` + `KELUAR`
- ✅ Sudah Pulang
- 🔴 Lewat

Lewat mengatasi paparan status lain. Kiraan/filter masih bergantung pada nilai backend seperti `record.status === KELUAR`.

## Public Monitoring Read-only

Public Monitoring menggunakan GET awam `getTodayRecords`, tidak kira sama ada browser mempunyai sesi lain. Response hanya mengandungi nama, kelas, jenis permohonan, status, lewat dan belum_masuk.

Flow pembukaan:

```text
aktifkan monitorWorkspace
  -> sembunyikan workspace lain
  -> scroll ke permulaan workspace
  -> tunjuk loading
  -> GET awam khusus
  -> mapPublicMonitoringRecord
  -> update outingRecords
  -> render sekali
  -> update timestamp dan monitorHasLoadedOnce
  -> tamat loading
```

Single-flight guard menghalang request bertindih. First-load gagal menunjukkan ralat jelas. Refresh gagal selepas kejayaan mengekalkan data lama dan timestamp lama.

Paparan hanya mempunyai kad ringkasan dan `Senarai Status Semasa`. Setiap baris menunjukkan nama, kelas, jenis permohonan, ikon dan label kontekstual. Ia tidak mempunyai action approve/reject atau confirm keluar/masuk.

## Statistik

`getOutingStats` memulangkan agregat sahaja. Statistik tidak memaparkan leaderboard individu atau row rekod mentah.

## Prinsip Keselamatan

- Frontend role hiding bukan authorization.
- Semua action operasi disahkan di GAS.
- POST authenticated tidak fallback kepada GET awam.
- Public Monitoring tidak boleh mengubah status.
- API/GAS tidak dicache oleh service worker.
