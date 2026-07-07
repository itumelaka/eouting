# Security Notes eOuting ITU

Dokumen ini menerangkan kawalan keselamatan asas untuk sistem eOuting ITU.

## Prinsip utama

Sistem ini mengurus data dalaman pelajar. Oleh itu, jangan anggap ia sekadar borang biasa.

Data seperti nama pelajar, kelas, rekod outing, masa keluar, masa masuk dan catatan warden perlu dijaga dengan baik.

## Jangan commit data sensitif

Jangan simpan perkara berikut dalam GitHub repo:

- Senarai penuh pelajar sebenar jika tidak perlu.
- No kad pengenalan.
- No telefon sensitif.
- Password atau PIN plain text.
- Apps Script deployment secret jika ada.
- Spreadsheet ID jika dianggap dalaman dan tidak mahu didedahkan.

## Frontend bukan tempat simpan rahsia

GitHub Pages ialah laman statik. Semua kod frontend boleh dilihat oleh pengguna.

Jangan letak perkara ini dalam `index.html` atau JavaScript frontend:

```text
password admin
PIN sebenar
secret key
private token
Apps Script internal secret
```

## PIN warden dan guard

Untuk frontend mock / draft mode, Warden dan Guard belum perlu PIN supaya UI testing mudah dibuat.

Mock access semasa hanya untuk testing frontend:

- Student access guna nama + `no_matrik`.
- Warden access guna selected warden name sahaja.
- Guard access guna selected guard name sahaja.
- Ini bukan authentication sebenar dan tidak boleh dianggap selamat untuk live mode.

Untuk future live mode, sistem perlu guna PIN atau authentication lebih kuat untuk warden/guard.

Tetapi:

- Jangan simpan PIN sebagai plain text dalam Google Sheets.
- Simpan hash PIN jika boleh.
- Jangan hardcode PIN dalam frontend.
- Validation PIN perlu berlaku di Apps Script, bukan di frontend sahaja.

## Validasi live mode

Backend validation dalam Google Apps Script adalah wajib. Frontend hiding sahaja bukan security sebenar kerana kod GitHub Pages boleh dilihat dan diubah oleh pengguna.

Keperluan validation live mode:

- Student validation mesti semak `student_id`, `no_matrik`, dan `status = Aktif` dari sheet `STUDENTS`.
- Warden validation mesti semak `warden_id`, PIN atau authentication lebih kuat, dan `status = Aktif`.
- Guard validation mesti semak `guard_id`, PIN atau authentication lebih kuat, dan `status = Aktif`.

Schema `STUDENTS` perlu ada medan asas berikut:

```text
student_id
no_matrik
nama
kelas
jantina
status
```

## Kawalan role

Setiap action perlu semak role.

Contoh:

| Action | Role dibenarkan |
|---|---|
| createOutingRequest | Pelajar |
| approveRequest | Warden |
| rejectRequest | Warden |
| checkOutStudent | Guard |
| checkInStudent | Guard |
| markSelfieReceived | Warden |

## Audit log

Semua tindakan penting perlu direkod dalam `AUDIT_LOG`.

Sekurang-kurangnya rekod:

- Siapa buat tindakan.
- Bila tindakan dibuat.
- Apa tindakan dibuat.
- Request ID yang terlibat.

## Had sistem V1

Versi awal mungkin tidak setanding sistem enterprise login penuh.

Risiko yang perlu diketahui:

- Link GitHub Pages boleh dibuka oleh sesiapa yang ada URL.
- Jika Apps Script Web App dibuka kepada anyone with link, backend perlu validation yang baik.
- PIN mudah boleh dikongsi.
- Upload selfie ke Google Drive memerlukan kawalan akses tambahan.

## Cadangan penambahbaikan V2

- Login Google Account untuk warden.
- Separate dashboard untuk guard.
- QR code outing pass yang ada request ID.
- Expiry outing pass pada jam 10:00 malam.
- Upload selfie ke Google Drive.
- Telegram alert kepada warden jika pelajar belum masuk selepas 10:00 malam.
