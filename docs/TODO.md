# TODO eOuting ITU

Senarai kerja pembangunan sistem eOuting ITU.

## Completed

- [x] Initial documentation.
- [x] Mock role-based frontend.
- [x] Pelajar login name + `no_matrik`.
- [x] Warden select name mock access.
- [x] Guard select name mock access.
- [x] Outing Biasa / Kecemasan frontend flow.
- [x] Emergency request fields.
- [x] Vehicle fields.
- [x] Warden approve/reject mock flow.
- [x] Guard confirm keluar/masuk mock flow.
- [x] Dashboard summary including Belum Masuk and Kecemasan.
- [x] Branded header.
- [x] Basic PWA setup.
- [x] GitHub Pages live at `https://itumelaka.github.io/eouting`.
- [x] Main database schema prepared.
- [x] Google Spreadsheet database prepared.
- [x] Apps Script project prepared.

## Next: GAS Backend V1

- [ ] Build GAS backend V1.
- [ ] Implement `doGet(e)`.
- [ ] Implement `doPost(e)`.
- [ ] Implement `getStudents()`.
- [ ] Implement `getWardens()`.
- [ ] Implement `getGuards()`.
- [ ] Implement `submitRequest(payload)`.
- [ ] Implement `approveRequest(payload)`.
- [ ] Implement `rejectRequest(payload)`.
- [ ] Implement `confirmOut(payload)`.
- [ ] Implement `confirmIn(payload)`.
- [ ] Implement `getTodayRecords()`.
- [ ] Implement `appendAuditLog(action, requestId, userRole, userName, details)`.
- [ ] Implement `jsonResponse(data)`.
- [ ] Implement `errorResponse(message)`.

## Testing

- [ ] Test GAS functions with sample payloads.
- [ ] Test student status rule: `Aktif` can request, `Tidak Aktif` cannot.
- [ ] Test Outing Biasa Tuesday/Wednesday after 5:00 PM rule.
- [ ] Test Kecemasan can submit anytime.
- [ ] Test warden approve/reject.
- [ ] Test guard confirm keluar/masuk.
- [ ] Test dashboard records.
- [ ] Test late / belum masuk cases.

## Frontend Live Connection

- [ ] Deploy GAS Web App.
- [ ] Connect frontend to `GAS_WEB_APP_URL`.
- [ ] Replace mock data with live Spreadsheet data.
- [ ] Keep no real secret, token, password, API key or PIN in frontend.

## V2 Cadangan

- [ ] PIN or stronger authentication for warden/guard.
- [ ] QR code outing pass.
- [ ] Upload selfie to Google Drive.
- [ ] Telegram/WhatsApp alert for late or not returned cases.
- [ ] Weekly/monthly report.
- [ ] Export CSV/PDF.
