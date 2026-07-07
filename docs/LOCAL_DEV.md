# Local Development eOuting ITU

Dokumen ini menerangkan keperluan local repo di laptop untuk pembangunan eOuting ITU.

## Perlu ada local repo dalam laptop ke?

Jawapan ringkas: **Ya, sangat digalakkan.**

Boleh edit terus di GitHub web UI, tetapi untuk projek sistem seperti eOuting ITU, local repo lebih selamat dan lebih kemas.

## Kenapa local repo penting?

Local repo membantu untuk:

- Edit banyak fail dengan lebih selesa.
- Semak perubahan menggunakan `git diff`.
- Test frontend sebelum push.
- Simpan sejarah kerja melalui commit.
- Elak tersalah edit terus di production.
- Senang kerja dengan ChatGPT, Claude atau Codex.

## Cadangan lokasi folder

Contoh lokasi di laptop:

```powershell
C:\Users\burnk\OneDrive\Documents-assets\eouting
```

## Clone repo

```powershell
cd C:\Users\burnk\OneDrive\Documents-assets
git clone https://github.com/itumelaka/eouting.git
cd eouting
```

## Struktur folder cadangan

```text
eouting/
├─ README.md
├─ index.html
├─ assets/
│  ├─ app.js
│  └─ style.css
├─ docs/
│  ├─ FLOW.md
│  ├─ DATABASE.md
│  ├─ GAS_SETUP.md
│  ├─ LOCAL_DEV.md
│  ├─ SECURITY.md
│  └─ TODO.md
└─ .gitignore
```

## Git workflow asas

Sebelum mula kerja:

```powershell
git status
```

Selepas edit fail:

```powershell
git status --short
git add README.md docs/
git commit -m "docs: add initial eOuting planning documents"
git push
```

## Nota akaun

Pastikan GitHub account yang digunakan ada write access kepada organisasi/repo:

```text
itumelaka/eouting
```

## Perlu install apa?

Untuk dokumentasi awal, cukup ada:

- Git
- VS Code
- Browser

Untuk frontend statik, boleh test terus buka `index.html`. Bila sudah ada JavaScript module atau API call, elok guna local server seperti:

```powershell
python -m http.server 5500
```

Kemudian buka:

```text
http://localhost:5500
```
