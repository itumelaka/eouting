const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

const wardenHtml = html.slice(html.indexOf('id="warden"'), html.indexOf('id="guard"'));
const adminMasterHtml = html.slice(html.indexOf('id="adminMasterPanel"'), html.indexOf('id="adminStaffPanel"'));

test("authenticated Warden intro and large utility copy are removed", () => {
  assert.doesNotMatch(wardenHtml, /Operasi Warden &amp; HEP|Semakan Warden|Luluskan atau tolak permohonan/);
  assert.doesNotMatch(app, /Utiliti Warden/);
  assert.doesNotMatch(css, /warden-refresh-panel|warden-dashboard-heading|warden-utility-actions/);
});

test("Refresh Permohonan remains compact and keeps its original handler", () => {
  const controls = sourceBetween("function ensureWardenRefreshControls", "async function refreshWardenRecords");
  assert.match(controls, /className = "warden-operational-controls"/);
  assert.match(controls, /wardenPanel\.insertBefore\(panel, wardenPanel\.firstChild\)/);
  assert.match(controls, /id="wardenRefreshButton"[^>]*>Refresh Permohonan</);
  assert.match(controls, /addEventListener\("click", \(\) => refreshWardenRecords\("button"\)\)/);
  assert.doesNotMatch(controls, /section|moveWardenUtilityButtons|footer/);
});

test("Warden operational roster and all three queues remain in natural order", () => {
  const ids = ["wardenCurrentHostelRoster", "wardenList", "wardenDepartureConfirmationList", "wardenApprovedList"];
  let last = -1;
  for (const id of ids) {
    const position = wardenHtml.indexOf(`id="${id}"`);
    assert.ok(position > last, `${id} must remain after the preceding Warden area`);
    last = position;
  }
});

test("existing report ownership moves to Admin Rekod Master without duplicate handlers", () => {
  assert.match(adminMasterHtml, /id="adminReportActions"/);
  const ensure = sourceBetween("function ensureCsvExportButtonsV15", "function exportRecordsCsvV15");
  assert.match(ensure, /adminReportActions/);
  assert.match(ensure, /Muat Turun Laporan Hari Ini/);
  assert.match(ensure, /exportRecordsCsvV15\("today"\)/);
  assert.match(ensure, /Muat Turun Laporan Bulanan/);
  assert.match(ensure, /exportRecordsCsvV15\("month"\)/);
  assert.doesNotMatch(ensure, /app-footer|warden/);
  assert.equal((app.match(/function exportRecordsCsvV15\(/g) || []).length, 1);
  const exportHandler = sourceBetween("function exportRecordsCsvV15", "function normalizeRecordDateKeyV15");
  assert.match(exportHandler, /outingRecords\.filter/);
  assert.match(exportHandler, /downloadCsvV15\(recordsToCsvV15\(records\)/);
});

test("release notes are no longer mounted into the Warden flow", () => {
  const enhancement = sourceBetween("function enhanceOperationalMonitoringV15", "function normalizeGuardSearchQueryV18");
  const controls = sourceBetween("function ensureWardenRefreshControls", "async function refreshWardenRecords");
  assert.doesNotMatch(enhancement, /ensureReleaseNotesV15/);
  assert.doesNotMatch(controls, /releaseNotes|Apa yang baharu/);
});

test("Warden authorization, queue actions and refresh logic remain intact", () => {
  const refresh = sourceBetween("async function refreshWardenRecords", "function setWardenLoadingState");
  const render = sourceBetween("function renderWarden()", "function guardianContactShortcutHtml");
  assert.match(refresh, /currentSession\.role !== "warden"/);
  assert.match(refresh, /loadWardenRecordsOnly\(\)/);
  assert.match(render, /updateStatus\(button\.dataset\.approve, STATUS\.approved, button\)/);
  assert.match(render, /updateStatus\(button\.dataset\.reject, STATUS\.rejected, button\)/);
  assert.match(render, /confirmWardenRemoteCheckout/);
});

test("Admin report placement remains behind the existing authenticated Admin session", () => {
  const session = sourceBetween("function startAdminSessionV200", "function buildAdminLoginPayloadV220");
  assert.match(session, /role: "admin"/);
  assert.match(session, /els\.adminDashboard\.classList\.add\("active"\)/);
  assert.match(adminMasterHtml, /role="tabpanel"[^>]*hidden/);
  assert.doesNotMatch(sourceBetween("function ensureCsvExportButtonsV15", "function exportRecordsCsvV15"), /loginAdmin|adminRuntimeCredential|permission/);
});

test("Guard r18 search and lifecycle controls remain untouched", () => {
  assert.match(html, /id="guardStudentSearch"[^>]*aria-label="Cari pelajar"/);
  assert.match(html, /id="guardSearchClear"/);
  assert.match(app, /ensureGuardSearchV18\(\)/);
  assert.match(app, /Sahkan Keluar/);
  assert.match(app, /Sahkan Masuk/);
});

test("r18 behavior remains consistent under r20 and display version remains v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r20/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r20/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r20/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r18/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
});
