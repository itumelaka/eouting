const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("Guard keluar and masuk actions have distinct wording and non-danger visual treatments", () => {
  assert.match(styleSource, /\.out-button\s*\{[\s\S]*?#f2a62b[\s\S]*?#b95b08/);
  assert.match(styleSource, /\.in-button\s*\{[\s\S]*?#20a985[\s\S]*?#0d6655/);
  assert.doesNotMatch(styleSource.match(/\.out-button\s*\{[\s\S]*?\}/)[0], /danger|#e45c68|#aa2937/);
  assert.match(appSource, /SAHKAN KELUAR[\s\S]*MENINGGALKAN kampus[\s\S]*Teruskan dengan Sahkan Keluar/);
  assert.match(appSource, /SAHKAN MASUK[\s\S]*TELAH KEMBALI ke kampus[\s\S]*Teruskan dengan Sahkan Masuk/);
});

test("Guard return card is ultra-compact and retains only action-critical information", () => {
  const functionStart = appSource.indexOf("function guardOperationalCard");
  const functionEnd = appSource.indexOf("\nfunction getGuardReturnTiming", functionStart);
  const returnCardSource = appSource.slice(functionStart, functionEnd);

  assert.match(returnCardSource, /profilePhotoMarkup[\s\S]*requestId[\s\S]*className[\s\S]*requestType[\s\S]*statusDisplay/);
  assert.match(returnCardSource, /TINDAKAN KELUAR[\s\S]*TINDAKAN MASUK/);
  assert.match(returnCardSource, /Pastikan pelajar berada di pos[\s\S]*Pastikan pelajar telah kembali ke kampus/);
  assert.doesNotMatch(returnCardSource, /<details|Lihat Butiran|Tujuan:|Lokasi:|Kenderaan:|Pulang:|Keluar:|record-times/);
});

test("all Guard operational lists use the same responsive two-column grid", () => {
  const guardGridStart = styleSource.indexOf("#guardApprovedList,");
  const guardGridEnd = styleSource.indexOf("@media (max-width: 719px)", guardGridStart);
  const guardGridSource = styleSource.slice(guardGridStart, guardGridEnd);

  assert.notEqual(guardGridStart, -1);
  assert.match(guardGridSource, /#guardApprovedList,\s*#guardOutList,\s*#guardOvernightNotReturnedSection \[data-overnight-not-returned-list\] \{[\s\S]*?display: grid;[\s\S]*?gap: 12px;[\s\S]*?grid-template-columns: minmax\(0, 1fr\);[\s\S]*?min-width: 0;[\s\S]*?width: 100%/);
  assert.match(guardGridSource, /@media \(min-width: 820px\) \{\s*#guardApprovedList,\s*#guardOutList,\s*#guardOvernightNotReturnedSection \[data-overnight-not-returned-list\] \{\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(guardGridSource, /#student|#warden|#admin|#dashboard|monitor-/);
  assert.match(styleSource, /\.guard-operational-card \.record-actions \{[\s\S]*?grid-template-columns: 1fr/);
});

test("Guard card renderer and Sah Keluar/Sah Masuk hooks remain unchanged", () => {
  const renderStart = appSource.indexOf("function renderGuard");
  const renderEnd = appSource.indexOf("\nfunction renderDashboard", renderStart);
  const renderSource = appSource.slice(renderStart, renderEnd);
  const cardStart = appSource.indexOf("function guardOperationalCard");
  const cardEnd = appSource.indexOf("\nfunction getGuardReturnTiming", cardStart);
  const cardSource = appSource.slice(cardStart, cardEnd);

  assert.match(renderSource, /guardApprovedList\.innerHTML[\s\S]*recordCard\(record, "guard-out"\)/);
  assert.match(renderSource, /guardOutList\.innerHTML[\s\S]*recordCard\(record, "guard-in"\)/);
  assert.match(renderSource, /\[data-out\][\s\S]*confirmOut\(button\.dataset\.out, button\)/);
  assert.match(renderSource, /\[data-in\][\s\S]*confirmIn\(button\.dataset\.in, button\)/);
  assert.match(cardSource, /class="record-top"[\s\S]*class="record-person"[\s\S]*class="badge-stack"[\s\S]*guard-action-cue[\s\S]*\$\{actions\}/);
});

test("Guard section hierarchy states direction and safe usage", () => {
  assert.match(indexSource, /Keluar · Menunggu Pengesahan/);
  assert.match(indexSource, /Masuk · Menunggu Pengesahan/);
  assert.match(indexSource, /pelajar meninggalkan pos guard/);
  assert.match(indexSource, /pelajar telah kembali ke pos guard/);
});

test("Guard-only card path leaves other record card modes on the existing renderer", () => {
  assert.match(appSource, /if \(mode === "guard-out" \|\| mode === "guard-in"\) \{\s*return guardOperationalCard\(record, mode, actions\);\s*\}/);
  const cardStart = appSource.indexOf("function recordCard");
  const compactStart = appSource.indexOf("\nfunction guardOperationalCard", cardStart);
  assert.match(appSource.slice(cardStart, compactStart), /record-detail[\s\S]*record-times/);
});
