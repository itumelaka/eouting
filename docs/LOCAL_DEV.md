# Local Development eOuting ITU

Dokumen ini menerangkan workflow local untuk pembangunan dan testing eOuting ITU.

Local repo path semasa:

```powershell
C:\Users\burnk\OneDrive\Documents-assets\eouting
```

GitHub repo:

```text
https://github.com/itumelaka/eouting
```

## Keperluan

- Git
- Browser
- VS Code atau editor pilihan
- Python untuk local static server
- Node.js untuk syntax check
- `clasp` untuk sync Google Apps Script

## Jalankan Frontend Secara Local

Dari folder repo:

```powershell
python -m http.server 8080
```

Buka:

```text
http://localhost:8080/
```

Gunakan local server, bukan buka `index.html` terus, supaya PWA/service worker dan path statik lebih hampir dengan GitHub Pages.

## Testing Workflow Live Mode

Semak flow asas:

1. Buka `http://localhost:8080/`.
2. Pastikan mode indicator menunjukkan live mode jika backend boleh dicapai.
3. Login Pelajar guna nama + `no_matrik`.
4. Submit permohonan `Outing Biasa` atau `Kecemasan`.
5. Semak `Rekod Saya / Status Semasa`.
6. Login Warden dengan wrong PIN dan pastikan ditolak.
7. Login Warden dengan PIN testing V1 `949494`.
8. Luluskan atau tolak permohonan.
9. Login Guard dengan wrong PIN dan pastikan ditolak.
10. Login Guard dengan PIN testing V1 `949494`.
11. Sahkan keluar.
12. Sahkan masuk.
13. Semak Dashboard Hari Ini.
14. Semak Pemantauan Semasa.

## Mobile / PWA Testing

Semak di telefon atau responsive browser tools:

- Header dan layout mobile.
- Install PWA.
- App boleh dibuka sebagai standalone.
- Rekod status masih boleh refresh.
- Toast/popup feedback tidak menutup form secara mengganggu.

## Syntax Checks

Frontend:

```powershell
node --check assets\app.js
```

Service worker:

```powershell
node --check service-worker.js
```

GAS parser check local:

```powershell
Get-Content -Raw gas\Code.gs | node --check -
```

## Git Workflow Asas

Sebelum mula kerja:

```powershell
git status
```

Selepas edit fail:

```powershell
git status --short
git diff
```

Commit hanya bila perubahan sudah diuji dan memang mahu disimpan ke repo.

## Nota Operasi

- Jangan commit data sensitif.
- Jangan masukkan token, secret, API key, password, atau deployment credential.
- PIN `949494` ialah temporary testing value untuk Live V1, bukan PIN production.
- Untuk backend live, `clasp push` perlu diikuti deployment version baru jika mahu web app users menerima perubahan.
