const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist after ${start}`);
  return app.slice(from, to);
}

function loadMatcher() {
  const source = sourceBetween(
    "function normalizeGuardSearchQueryV18",
    "function filterGuardRecordsBySearchV18"
  );
  const context = vm.createContext({});
  vm.runInContext(`${source}\nglobalThis.matches = guardRecordMatchesSearchV18;`, context);
  return context.matches;
}

test("r18 has exactly one accessible Guard search inside shared operational controls", () => {
  assert.equal((html.match(/id="guardStudentSearch"/g) || []).length, 1);
  assert.equal((html.match(/id="guardSearchControl"/g) || []).length, 1);
  assert.match(html, /id="guardOperationalControls"[\s\S]*id="guardStudentSearch"[\s\S]*Keluar · Menunggu Pengesahan/);
  assert.match(html, /type="search"[\s\S]*aria-label="Cari pelajar"[\s\S]*placeholder="Taip nama pelajar\.\.\."/);
  assert.doesNotMatch(html, /<label[^>]*for="guardStudentSearch"/);
});

test("search matches partial Student names case-insensitively and trims input", () => {
  const matches = loadMatcher();
  const record = { nama: "AHMAD ADAM 'ALIMI BIN ABDUL SHUKOR" };
  assert.equal(matches(record, "adam"), true);
  assert.equal(matches(record, "  AdAm  "), true);
  assert.equal(matches(record, "aisyah"), false);
});

test("empty and whitespace searches restore records", () => {
  const matches = loadMatcher();
  assert.equal(matches({ nama: "Nur Aisyah" }, ""), true);
  assert.equal(matches({ nama: "Nur Aisyah" }, "   "), true);
});

test("loaded identifiers and class fields are safely searchable", () => {
  const matches = loadMatcher();
  const record = {
    student_id: "S-0042",
    no_matrik: "M2026042",
    request_id: "REQ-ADAM-42",
    kelas: "A3"
  };
  for (const query of ["s-0042", "2026042", "adam-42", "a3"]) {
    assert.equal(matches(record, query), true, `${query} should match`);
  }
});

test("input and clear controls re-render locally without a keystroke API call", () => {
  const search = sourceBetween("function ensureGuardSearchV18", "const QUICK_FILTERS_V15");
  assert.match(search, /addEventListener\("input"/);
  assert.match(search, /guardSearchQueryV18 = els\.guardStudentSearch\.value/);
  assert.match(search, /renderGuardSearchResultsV18\(\)/);
  assert.doesNotMatch(search, /apiGet|apiPost|fetch\s*\(/);
  assert.match(search, /guardSearchClear\.addEventListener\("click"/);
  assert.match(search, /resetGuardSearchV18\(\)[\s\S]*renderGuardSearchResultsV18\(\)[\s\S]*\.focus\(\)/);
});

test("search and the authoritative active Guard chip are reapplied together", () => {
  const ensure = sourceBetween("function ensureQuickFilterGroupV15", "function applyQuickFilterV15");
  const rerender = sourceBetween("function renderGuardSearchResultsV18", "function updateGuardSearchClearV18");
  assert.match(ensure, /quick-filter-button\.active/);
  assert.match(ensure, /activeButton \? activeButton\.dataset\.filterValue : "all"/);
  assert.match(rerender, /renderGuard\(\)[\s\S]*renderOvernightNotReturnedSectionsV15\(\)[\s\S]*ensureQuickFiltersV15\(\)/);
});

test("all three Guard operational queue paths apply search filtering", () => {
  const guard = sourceBetween("function renderGuard()", "function renderDashboard");
  const overnight = sourceBetween("function renderOvernightListV15", "function isOvernightNotReturnedV15");
  assert.match(guard, /filterGuardRecordsBySearchV18[\s\S]*STATUS\.approved/);
  assert.match(guard, /filterGuardRecordsBySearchV18[\s\S]*STATUS\.out/);
  assert.match(overnight, /filterGuardRecordsBySearchV18[\s\S]*isOvernightNotReturnedV15/);
});

test("search uses a distinct contextual empty result", () => {
  assert.match(app, /Tiada pelajar sepadan dengan carian\./);
  const empty = sourceBetween("function guardOperationalEmptyMessageV18", "function renderGuardSearchResultsV18");
  assert.match(empty, /normalizeGuardSearchQueryV18/);
  assert.match(empty, /: normalMessage/);
});

test("query state survives render refresh while logout may reset it", () => {
  const refresh = sourceBetween("async function refreshGuardRecords", "function startGuardAutoRefresh");
  const logoutStart = app.indexOf('els.logoutButton.addEventListener("click", () => {');
  const logout = app.slice(logoutStart, app.indexOf("document.querySelectorAll", logoutStart));
  assert.doesNotMatch(refresh, /guardSearchQueryV18\s*=/);
  assert.match(logout, /resetGuardSearchV18\(\)/);
  assert.match(app, /refreshGuardRecords\("auto"\)[\s\S]*30000/);
});

test("Current Hostel Residents and Guard action/profile paths stay outside search logic", () => {
  const search = sourceBetween("function normalizeGuardSearchQueryV18", "const QUICK_FILTERS_V15");
  assert.doesNotMatch(search, /currentHostel|profilePhoto|confirmOut|confirmIn|Sahkan/);
  assert.match(app, /globalThis\.renderStaffCurrentHostelRosterV240\?\.\(\)/);
});

test("r18 search is mobile-safe, keyboard visible and touch sized", () => {
  assert.match(css, /\.guard-search-control[\s\S]*max-width:\s*720px[\s\S]*min-width:\s*0[\s\S]*width:\s*100%/);
  assert.match(css, /@media \(max-width: 620px\)[\s\S]*\.guard-search-control \{ max-width: none; \}/);
  assert.match(css, /\.guard-search-clear[\s\S]*min-height:\s*44px[\s\S]*min-width:\s*44px/);
  assert.match(css, /\.guard-search-control[\s\S]*display:\s*flex[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\.guard-search-control:focus-within/);
  assert.match(css, /#guard :where\(button, summary, \[tabindex\]\):focus-visible/);
});

test("r18 Guard search remains green under the r19 runtime cache", () => {
  assert.match(html, /style\.css\?v=2\.4\.0-r19/);
  assert.match(html, /app\.js\?v=2\.4\.0-r19/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r19/);
  assert.match(app, /const APP_VERSION = "2\.4\.0"/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
});
