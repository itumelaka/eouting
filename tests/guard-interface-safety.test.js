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

test("Guard return card defaults to operational fields and hides history in expandable details", () => {
  const functionStart = appSource.indexOf("function guardReturnCard");
  const functionEnd = appSource.indexOf("\nfunction getGuardReturnTiming", functionStart);
  const returnCardSource = appSource.slice(functionStart, functionEnd);
  const collapsedSource = returnCardSource.slice(0, returnCardSource.indexOf('<details class="guard-record-details">'));

  assert.match(collapsedSource, /className[\s\S]*requestTypeLabel[\s\S]*Keluar:[\s\S]*Pulang:/);
  assert.match(appSource, /guard-return-timing[\s\S]*<details class="guard-record-details">[\s\S]*<summary>Lihat Butiran<\/summary>/);
  assert.doesNotMatch(collapsedSource, /Tindakan Masuk|Sedang di luar|ID \$\{/);
  assert.match(returnCardSource, /ID Permohonan:[\s\S]*Jenis Permohonan:[\s\S]*Tujuan:[\s\S]*Lokasi:[\s\S]*Kenderaan:/);
  assert.match(appSource, /Dalam tempoh dibenarkan/);
  assert.match(appSource, /`Lewat \$\{formatGuardOverdueDuration/);
});

test("Guard overnight return list uses a responsive two-column grid", () => {
  assert.match(styleSource, /#guardOvernightNotReturnedSection \[data-overnight-not-returned-list\] \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styleSource, /@media \(min-width: 720px\) \{[\s\S]*?#guardOvernightNotReturnedSection \[data-overnight-not-returned-list\][\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styleSource, /\.guard-return-card \.record-actions \{[\s\S]*?grid-template-columns: 1fr/);
});

test("Guard section hierarchy states direction and safe usage", () => {
  assert.match(indexSource, /Keluar · Menunggu Pengesahan/);
  assert.match(indexSource, /Masuk · Menunggu Pengesahan/);
  assert.match(indexSource, /pelajar meninggalkan pos guard/);
  assert.match(indexSource, /pelajar telah kembali ke pos guard/);
});

test("Guard-only card path leaves other record card modes on the existing renderer", () => {
  assert.match(appSource, /if \(mode === "guard-in"\) \{\s*return guardReturnCard\(record, actions\);\s*\}/);
  assert.match(appSource, /mode === "guard-in" \|\| mode === "guard-out"/);
});
