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

Semak flow asas browser/local:

1. Buka `http://localhost:8080/`.
2. Pastikan mode indicator menunjukkan live mode jika backend boleh dicapai.
3. Login Pelajar guna nama + `no_matrik`.
4. Submit permohonan `Kecemasan` untuk test di luar waktu outing biasa.
5. Submit `Outing Biasa` hanya semasa rule masa membenarkan.
6. Semak `Rekod Aktif`.
7. Semak `Sejarah Hari Ini`.
8. Pastikan rekod `SELESAI` / `DITOLAK_WARDEN` compact dan tidak block request baru.
9. Login Warden dengan wrong PIN dan pastikan ditolak.
10. Login Warden dengan PIN testing semasa.
11. Luluskan atau tolak permohonan.
12. Pastikan Telegram alert approve/reject diterima.
13. Login Guard dengan wrong PIN dan pastikan ditolak.
14. Login Guard dengan PIN testing semasa.
15. Sahkan keluar.
16. Sahkan masuk.
17. Pastikan Telegram alert keluar/masuk diterima.
18. Semak Dashboard Hari Ini.
19. Semak Pemantauan Semasa.

## GitHub Pages Testing

Selepas push frontend:

- Buka `https://itumelaka.github.io/eouting`.
- Semak browser console untuk error.
- Test student login, warden, guard, dashboard, dan monitoring.
- Jika GitHub Pages masih papar code lama, guna cache-busting URL:

```text
https://itumelaka.github.io/eouting/?v=YYYYMMDD-HHMM
```

Jika PWA masih papar versi lama, clear PWA/browser cache atau uninstall/reinstall PWA sementara testing.

## Mobile / PWA Testing

Semak di telefon atau responsive browser tools:

- Header dan layout mobile.
- Install PWA.
- App boleh dibuka sebagai standalone.
- Rekod status masih boleh refresh.
- Toast/popup feedback tidak menutup form secara mengganggu.
- `Rekod Aktif` dan `Sejarah Hari Ini` masih kemas di skrin kecil.

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
- PIN testing ialah temporary value untuk Live V1.2, bukan PIN production.
- Untuk backend live, `clasp push` perlu diikuti deployment version baru jika mahu web app users menerima perubahan.
- Pastikan Telegram group menerima alert semasa test live.
