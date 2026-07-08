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
9. Test `Ingat peranti ini`, refresh browser/PWA, dan pastikan sesi student restore.
10. Login Warden dengan wrong PIN dan pastikan ditolak.
11. Login Warden dengan PIN testing semasa.
12. Jika test remember-device Warden, tick `Ingat peranti ini`, refresh, dan pastikan masih login.
13. Luluskan atau tolak permohonan.
14. Pastikan Telegram alert approve/reject diterima.
15. Login Guard dengan wrong PIN dan pastikan ditolak.
16. Login Guard dengan PIN testing semasa.
17. Jika test guard PC, tick `Ingat peranti ini`, refresh, dan pastikan sesi Guard restore.
18. Sahkan keluar.
19. Sahkan masuk.
20. Pastikan Telegram alert keluar/masuk diterima.
21. Semak Dashboard Hari Ini.
22. Semak Pemantauan Semasa.
23. Tekan `Log Keluar` dan pastikan sesi localStorage dibuang.

## Mock Mode Development

Production mesti guna Live Mode Google Sheets.

Mock Mode hanya untuk development/demo dan mesti diaktifkan secara sengaja:

```text
http://localhost:8080/?mock=1
https://itumelaka.github.io/eouting/?mock=1
```

Tanpa `?mock=1`, app tidak akan fallback senyap kepada demo data. Jika sambungan live gagal, pengguna akan nampak mesej:

```text
Sambungan Live Gagal
Sistem tidak dapat berhubung dengan Google Sheets. Sila semak internet atau tekan Muat Semula Sistem.
```

Untuk pilot/production, pengguna perlu semak internet atau tekan `Muat Semula Sistem`, bukan terus guna mock data.

## GitHub Pages Testing

Selepas push frontend:

- Buka `https://itumelaka.github.io/eouting`.
- Semak browser console untuk error.
- Test student login, warden, guard, dashboard, dan monitoring.
- Semak footer version, contoh `eOuting ITU • v1.2.2`.
- Test butang `Muat Semula Sistem` jika PWA/browser masih memegang cache lama.
- Jika GitHub Pages masih papar code lama, guna cache-busting URL:

```text
https://itumelaka.github.io/eouting/?v=YYYYMMDD-HHMM
```

Pengguna biasa patut guna `Muat Semula Sistem` dahulu, bukan clear semua browsing data. Jika PWA masih stale selepas itu, guna cache-busting URL atau reinstall PWA sebagai pilihan terakhir.

## Version Bump / PWA Cache Workflow

Untuk setiap release frontend:

1. Update `APP_VERSION` dalam `assets/app.js`.
2. Update query string asset dalam `index.html`:

```text
assets/style.css?v=<version>
assets/app.js?v=<version>
```

3. Update `CACHE_NAME` dalam `service-worker.js`, contoh:

```text
eouting-cache-v<version>
```

4. Update `APP_SHELL_ASSETS` dalam `service-worker.js` supaya query string JS/CSS sama dengan version release.
5. Jalankan syntax check:

```powershell
node --check assets\app.js
node --check service-worker.js
```

6. Deploy ke GitHub Pages.
7. Buka app dan semak toast `Versi Baru Tersedia` atau guna `Muat Semula Sistem`.

## Mobile / PWA Testing

Semak di telefon atau responsive browser tools:

- Header dan layout mobile.
- Install PWA.
- App boleh dibuka sebagai standalone.
- `Ingat peranti ini` restore sesi selepas refresh/reopen selagi belum expired.
- `Muat Semula Sistem` tidak sepatutnya memadam localStorage session; sesi remember-device masih restore selepas reload jika belum expired.
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
- Shared guard PC perlu tekan `Log Keluar` selepas digunakan.
- Warden/Guard PIN jangan disimpan pada public/shared device kecuali diluluskan untuk operasi pilot.
- Production improvement: backend-issued session token atau Google login menggantikan PIN persistence.
- Mock Mode ialah demo sahaja dan tidak boleh digunakan untuk operasi sebenar.
