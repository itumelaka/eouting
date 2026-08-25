const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist after ${start}`);
  return app.slice(from, to);
}

test("Guard dashboard removes only its Current Hostel Residents section", () => {
  const guard = html.slice(
    html.indexOf('<section class="tab-panel guard-dashboard"'),
    html.indexOf('<section class="tab-panel" id="dashboard"')
  );
  assert.doesNotMatch(guard, /Penghuni Semasa Asrama|guardCurrentHostelRoster|current-hostel-roster/);
  assert.match(html, /id="wardenCurrentHostelRoster"/);
  assert.match(html, /id="adminCurrentHostelRoster"/);
  assert.match(html, /id="publicCurrentHostelKpis"/);
  assert.match(html, /id="publicCurrentHostelGroups"/);
});

test("Guard initial load and refresh no longer request the authenticated roster", () => {
  const initialLoad = sourceBetween("async function loadTodayRecords", "async function apiPost");
  const guardRefresh = sourceBetween("async function refreshGuardRecords", "function startGuardAutoRefresh");
  assert.match(initialLoad, /currentSession\.role === "warden"/);
  assert.doesNotMatch(initialLoad, /\["warden", "guard"\]/);
  assert.doesNotMatch(guardRefresh, /getCurrentHostelRoster|staffCurrentHostelRosterV240/);
  assert.match(guardRefresh, /apiPost\("getTodayRecords", buildTodayRecordsAccessPayload\(\)\)/);
});

test("Warden and Admin authenticated roster requests remain", () => {
  const wardenLoad = sourceBetween("async function loadWardenRecordsOnly", "function setWardenLoadingState");
  const adminLoad = sourceBetween("async function loadAdminMonitoringV210", "function adminMonitoringStatusLabelV210");
  assert.match(wardenLoad, /apiPost\("getCurrentHostelRoster"/);
  assert.match(adminLoad, /apiPost\("getCurrentHostelRoster"/);
  assert.match(sourceBetween("function renderStaffCurrentHostelRosterV240", "function updateStudentRequestSectionVisibility"), /admin[\s\S]*warden/);
});

test("Guard search, chips and action handlers remain intact", () => {
  const guardRender = sourceBetween("function renderGuard()", "function renderDashboard");
  assert.equal((html.match(/id="guardStudentSearch"/g) || []).length, 1);
  assert.match(app, /const GUARD_QUICK_FILTERS_V15/);
  assert.match(guardRender, /confirmOut\(button\.dataset\.out, button\)/);
  assert.match(guardRender, /confirmIn\(button\.dataset\.in, button\)/);
});

test("Guard automatic refresh remains 30 seconds under the r21 presentation cache", () => {
  const autoRefresh = sourceBetween("function startGuardAutoRefresh", "function stopGuardAutoRefresh");
  assert.match(autoRefresh, /refreshGuardRecords\("auto"\)/);
  assert.match(autoRefresh, /30000/);
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r21/);
  assert.match(app, /const APP_VERSION = "2\.4\.0"/);
});
