# Deployment

Current version: **v1.6.16**

## Frontend

Frontend is hosted on GitHub Pages:

```text
https://itumelaka.github.io/eouting/
```

For frontend-only changes:

```text
git add .
git commit -m "..."
git push
```

GitHub Pages should update from the pushed branch. In normal operation, wait about 1-3 minutes before testing the live URL.

## Google Apps Script

Backend changes require a GAS deployment update.

For GAS changes:

```text
clasp push
```

Then in Apps Script:

```text
Manage deployments -> Edit -> New version -> Deploy
```

If `gas/Code.gs` is not changed, a GAS deployment is not needed.

## Cache / Service Worker Notes

If GitHub Pages appears stuck on an older build:

1. Compare raw GitHub file content with live GitHub Pages.
2. Verify `index.html` asset query strings.
3. Verify `service-worker.js` cache name.
4. Try a cache-bust URL:

```text
https://itumelaka.github.io/eouting/index.html?v=1.6.16
```

5. If needed, clear browser site data/service worker cache.

## Version Checklist

When bumping frontend version, update:

- `APP_VERSION` in `assets/app.js`
- visible footer version in `index.html`
- `assets/app.js?v=...` in `index.html`
- `assets/style.css?v=...` in `index.html`
- `CACHE_NAME` in `service-worker.js`
- app shell asset query strings in `service-worker.js`
- `version.json`

When changing GAS behavior, document whether deployment is needed.
