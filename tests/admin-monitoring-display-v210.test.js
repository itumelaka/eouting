const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function createFrontendContext() {
  const context = vm.createContext({ Intl, Date, BM_MONTHS: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"] });
  vm.runInContext([
    "const BM_MONTHS = globalThis.BM_MONTHS;",
    extractFunction(appSource, "parseFlexibleDate"),
    extractFunction(appSource, "getKualaLumpurParts"),
    extractFunction(appSource, "formatDisplayTime"),
    extractFunction(appSource, "formatDisplayDate"),
    extractFunction(appSource, "formatDisplayDateTime"),
    extractFunction(appSource, "normalizeTimeOnlyValue"),
    extractFunction(appSource, "formatExpectedReturnTime"),
    extractFunction(appSource, "formatAdminExpectedReturnV210"),
    extractFunction(appSource, "adminMonitoringStatusLabelV210")
  ].join("\n"), context);
  return context;
}

test("KELUAR is rendered as a compact horizontal Sedang Keluar badge", () => {
  const context = createFrontendContext();
  assert.equal(context.adminMonitoringStatusLabelV210("KELUAR"), "Sedang Keluar");
  const renderer = extractFunction(appSource, "renderAdminMonitoringV210");
  assert.match(renderer, /status-badge admin-ops-status/);
  assert.match(renderer, /is-out/);
  assert.doesNotMatch(renderer, /LEWAT ·[^<]*\$\{escapeHtml\(row\.status\)\}/);
  assert.match(styleSource, /\.admin-ops-status\s*\{[^}]*display:inline-flex[^}]*white-space:nowrap[^}]*width:auto/s);
  assert.match(styleSource, /\.admin-ops-status\.is-out\s*\{[^}]*#ffe1ad/s);
});

test("monitoring card uses a responsive metadata grid instead of a narrow status column", () => {
  const renderer = extractFunction(appSource, "renderAdminMonitoringV210");
  assert.match(renderer, /admin-ops-summary/);
  assert.match(renderer, /admin-ops-meta/);
  assert.match(renderer, /<dt>Mohon<\/dt>/);
  assert.match(renderer, /<dt>Keluar<\/dt>/);
  assert.match(renderer, /<dt>Jangka Pulang<\/dt>/);
  assert.doesNotMatch(styleSource, /\.admin-ops-card\s*\{[^}]*grid-template-columns:minmax\(180px,1\.2fr\) auto/s);
  assert.match(styleSource, /@media \(max-width:760px\)[\s\S]*\.admin-ops-card dl[^}]*grid-template-columns:1fr/);
});

test("expected return combines Malaysia-local date and time and hides Sheet sentinels", () => {
  const context = createFrontendContext();
  assert.equal(
    context.formatAdminExpectedReturnV210({ expected_return_at: "2026-08-09 09:55:00" }),
    "09 Ogos 2026, 9:55 PG"
  );
  assert.equal(
    context.formatAdminExpectedReturnV210({ tarikh_balik: "2026-08-08T16:00:00.000Z", masa_balik_dijangka: "1899-12-30T14:34:35.000Z" }),
    "09 Ogos 2026, 9:30 PTG"
  );
  assert.equal(
    context.formatAdminExpectedReturnV210({ tarikh_balik: "2026-08-16", masa_balik_dijangka: "22:00" }),
    "16 Ogos 2026, 10:00 PTG"
  );
  assert.equal(context.formatAdminExpectedReturnV210({}), "-");
});

test("GAS monitoring boundary canonicalizes Sheet return Date and time-only Date", () => {
  const context = vm.createContext({
    console,
    SpreadsheetApp: { getActive: () => ({ getSpreadsheetTimeZone: () => "Asia/Kuala_Lumpur" }) },
    Session: { getScriptTimeZone: () => "Asia/Kuala_Lumpur" },
    Utilities: {
      formatDate(value, _zone, format) {
        if (format === "HH:mm") return "09:55";
        if (format === "yyyy-MM-dd") return "2026-08-09";
        return "2026-08-09 09:55:00";
      }
    },
    LockService: {}, PropertiesService: {}, ContentService: {}, UrlFetchApp: {}, DriveApp: {}
  });
  vm.runInContext(gasSource, context);
  context.isAdminRecordOverdue_ = () => true;
  context.calculateOutingDurationMinutes_ = () => 0;
  const result = context.toAdminOperationalRecord_({
    request_id: "R1", status: "KELUAR",
    tarikh_balik: new Date("2026-08-08T16:00:00.000Z"),
    masa_balik_dijangka: new Date("1899-12-30T01:55:00.000Z")
  }, new Date());
  assert.equal(result.tarikh_balik, "2026-08-09");
  assert.equal(result.masa_balik_dijangka, "09:55");
  assert.equal(result.expected_return_at, "2026-08-09 09:55:00");
  assert.equal(result.lewat, true);
  assert.doesNotMatch(JSON.stringify(result), /1899-12-30|T16:00:00\.000Z/);
});

test("missing return components stay blank at the GAS boundary and late indicator remains prominent", () => {
  const projection = extractFunction(gasSource, "toAdminOperationalRecord_");
  assert.match(projection, /returnDate && returnTime \? returnDate \+ " " \+ returnTime \+ ":00" : ""/);
  const renderer = extractFunction(appSource, "renderAdminMonitoringV210");
  assert.match(renderer, /admin-ops-late/);
  assert.match(renderer, /Lewat · Belum pulang pada waktu dijangka/);
});
