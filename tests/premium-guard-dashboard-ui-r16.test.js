const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8"));
const guardCssStart = css.indexOf("Premium Institutional Guard Dashboard — r16");
const guardCssEnd = css.indexOf("Premium Institutional Admin Dashboard — r17", guardCssStart);
const guardCss = css.slice(guardCssStart, guardCssEnd);

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist after ${start}`);
  return app.slice(from, to);
}

test("r16 keeps one authenticated Guard dashboard and the shared session/logout controls", () => {
  assert.equal((html.match(/<section class="tab-panel guard-dashboard" id="guard"/g) || []).length, 1);
  assert.match(html, /guard-dashboard-kicker">Operasi Keselamatan/);
  assert.match(html, /<h2>Pengesahan Guard<\/h2>/);
  assert.equal((html.match(/id="sessionRole"/g) || []).length, 1);
  assert.equal((html.match(/id="sessionName"/g) || []).length, 1);
  assert.equal((html.match(/id="logoutButton"/g) || []).length, 1);
});

test("Current Hostel Residents is absent from Guard while Warden, Admin and public views remain", () => {
  const guardPanel = html.slice(html.indexOf('<section class="tab-panel guard-dashboard"'), html.indexOf('<section class="tab-panel" id="dashboard"'));
  assert.doesNotMatch(guardPanel, /Penghuni Semasa Asrama|guardCurrentHostelRoster/);
  assert.match(html, /id="wardenCurrentHostelRoster"[^>]*aria-live="polite"/);
  assert.match(html, /id="adminCurrentHostelRoster"[^>]*aria-live="polite"/);
  assert.match(html, /id="publicCurrentHostelKpis"[^>]*aria-live="polite"/);
});

test("waiting-to-leave and currently-out queues retain authoritative lifecycle filters", () => {
  assert.match(html, /Keluar · Menunggu Pengesahan/);
  assert.match(html, /Masuk · Menunggu Pengesahan/);
  assert.match(html, /id="guardApprovedList"/);
  assert.match(html, /id="guardOutList"/);
  const render = sourceBetween("function renderGuard()", "function renderDashboard");
  assert.match(render, /record\.status === STATUS\.approved/);
  assert.match(render, /record\.status === STATUS\.out/);
  assert.match(render, /recordCard\(record, "guard-out"\)/);
  assert.match(render, /recordCard\(record, "guard-in"\)/);
  assert.match(render, /Tiada pelajar sedang keluar/);
});

test("Sahkan Keluar handler, payload, masa_keluar and guard_keluar_by behavior are unchanged", () => {
  const render = sourceBetween("function renderGuard()", "function renderDashboard");
  const confirm = sourceBetween("async function confirmOut", "async function confirmIn");
  assert.match(render, /data-out[\s\S]*confirmOut\(button\.dataset\.out, button\)/);
  assert.match(confirm, /currentSession\.role !== "guard"/);
  assert.match(confirm, /previousRecord\.status !== STATUS\.approved/);
  assert.match(confirm, /apiPost\("confirmOut"/);
  assert.match(confirm, /status: STATUS\.out/);
  assert.match(confirm, /masa_keluar: record\.masa_keluar \|\| now/);
  assert.match(confirm, /guard_keluar_by: currentSession\.user\.name/);
});

test("Sahkan Masuk handler, payload, masa_masuk and completion behavior are unchanged", () => {
  const render = sourceBetween("function renderGuard()", "function renderDashboard");
  const confirm = sourceBetween("async function confirmIn", "function isGuardActionPending");
  assert.match(render, /data-in[\s\S]*confirmIn\(button\.dataset\.in, button\)/);
  assert.match(confirm, /currentSession\.role !== "guard"/);
  assert.match(confirm, /previousRecord\.status !== STATUS\.out/);
  assert.match(confirm, /apiPost\("confirmIn"/);
  assert.match(confirm, /status: STATUS\.returned/);
  assert.match(confirm, /masa_masuk: record\.masa_masuk \|\| now/);
  assert.match(confirm, /selfie_status: RETURN_SELFIE_STATUS\.pending/);
});

test("cards preserve action hooks while making leaving and returning direction textual", () => {
  const actions = sourceBetween("function actionButtons", "function emptyState");
  const card = sourceBetween("function guardOperationalCard", "function getGuardReturnTiming");
  assert.match(actions, /data-out[\s\S]*Sahkan Keluar/);
  assert.match(actions, /data-in[\s\S]*Sahkan Masuk/);
  assert.match(card, /PELAJAR AKAN KELUAR/);
  assert.match(card, /PELAJAR PULANG/);
  assert.match(card, /TINDAKAN KELUAR/);
  assert.match(card, /TINDAKAN MASUK/);
});

test("Kecemasan and every backend-derived urgency state remain textual without frontend calculation", () => {
  const card = sourceBetween("function guardOperationalCard", "function getGuardReturnTiming");
  const urgency = sourceBetween("function guardOperationalUrgencyHtml", "function getGuardReturnTiming");
  assert.match(card, /badge-emergency">Kecemasan/);
  assert.match(card, /guard-emergency-safety/);
  assert.match(urgency, /record && record\.operational_urgency/);
  assert.match(urgency, /NORMAL: "Normal"/);
  assert.match(urgency, /DUE_SOON: "Hampir Waktu Pulang"/);
  assert.match(urgency, /LATE: "Lewat"/);
  assert.match(urgency, /CRITICAL: "Kritikal"/);
  assert.match(urgency, /ACTION_REQUIRED: "Tindakan Segera"/);
  assert.doesNotMatch(urgency, /Date|minutes|threshold|calculate|derive/i);
});

test("authorized profile thumbnails remain compact and use the existing authenticated loader", () => {
  const card = sourceBetween("function guardOperationalCard", "function getGuardReturnTiming");
  const refresh = sourceBetween("async function refreshGuardRecords", "function startGuardAutoRefresh");
  assert.match(card, /profilePhotoMarkup[\s\S]*profile-photo-thumbnail/);
  assert.match(refresh, /record\.has_profile_photo/);
  assert.match(refresh, /loadProfilePhotoThumbnailsForStudents/);
  assert.doesNotMatch(refresh, /loadFullProfilePhotoForStudent/);
});

test("No-Guard and Warden remote checkout remain outside the Guard action path", () => {
  const render = sourceBetween("function renderGuard()", "function renderDashboard");
  const card = sourceBetween("function guardOperationalCard", "function getGuardReturnTiming");
  const remote = sourceBetween("async function confirmWardenRemoteCheckout", "function isReturnSelfieSubmitted");
  assert.doesNotMatch(render, /confirmWardenRemoteCheckout|data-warden-remote-checkout/);
  assert.doesNotMatch(card, /No-Guard|warden-remote|data-warden-remote-checkout/);
  assert.match(remote, /currentSession\.role !== "warden"/);
});

test("Student departure confirmation and return-selfie paths remain separate from Guard rendering", () => {
  const departure = sourceBetween("function studentDepartureConfirmationActionHtml", "function isNoGuardDepartureEnabledForRecord");
  const card = sourceBetween("function guardOperationalCard", "function getGuardReturnTiming");
  assert.match(departure, /departure_confirmation_pending/);
  assert.match(departure, /data-request-departure-confirmation/);
  assert.doesNotMatch(card, /data-request-departure-confirmation|return-selfie|selfie_status/);
});

test("manual refresh and 30-second automatic refresh remain on the existing Guard path", () => {
  const controls = sourceBetween("function ensureGuardRefreshControls", "function updateGuardLastUpdated");
  const auto = sourceBetween("function startGuardAutoRefresh", "function stopGuardAutoRefresh");
  assert.match(controls, /guardRefreshButton\.addEventListener\("click", \(\) => refreshGuardRecords\("button"\)\)/);
  assert.match(auto, /currentSession\.role !== "guard"/);
  assert.match(auto, /refreshGuardRecords\("auto"\)/);
  assert.match(auto, /30000/);
});

test("r16 Guard CSS is dark, amber, responsive and scoped away from other dashboards", () => {
  assert.notEqual(guardCssStart, -1);
  assert.match(guardCss, /body:has\(#appWorkspace\.active #guard\.tab-panel\.active\)/);
  assert.match(guardCss, /#f59e0b|#fbbf24/);
  assert.match(guardCss, /#guardApprovedList, #guardOutList/);
  assert.match(guardCss, /@media \(min-width: 1000px\)[\s\S]*?repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(guardCss, /@media \(max-width: 430px\)/);
  assert.match(guardCss, /min-width:\s*0/);
  assert.doesNotMatch(guardCss, /#(?:pelajar|warden|adminDashboard|dashboard)\b/);
});

test("Guard urgency, emergency, actions and accessibility have explicit visual states", () => {
  for (const state of ["normal", "due-soon", "late", "critical", "action-required"]) {
    assert.match(guardCss, new RegExp(`\\.guard-urgency-${state}`));
  }
  assert.match(guardCss, /\.badge-emergency/);
  assert.match(guardCss, /\.out-button/);
  assert.match(guardCss, /\.in-button/);
  assert.match(guardCss, /min-height:\s*(?:42|44|48)px/);
  assert.match(guardCss, /:focus-visible/);
  assert.match(guardCss, /:disabled/);
  assert.match(guardCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(guardCss, /transition:\s*none/);
});

test("r16 Guard visuals remain under the r21 cache while displayed version stays v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r21/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r15/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
  assert.equal(version.version, "2.4.0");
});
