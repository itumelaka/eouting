const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const wardenCssStart = css.indexOf("Premium Institutional Warden Dashboard — r15");
const wardenCssEnd = css.indexOf("Premium Institutional Guard Dashboard — r16", wardenCssStart);
const wardenCss = css.slice(wardenCssStart, wardenCssEnd);

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist after ${start}`);
  return app.slice(from, to);
}

function sourceBetweenLast(start, end) {
  const from = app.lastIndexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist after final ${start}`);
  return app.slice(from, to);
}

test("r15 keeps one authenticated Warden dashboard and compact session controls", () => {
  assert.equal((html.match(/<section class="tab-panel warden-dashboard" id="warden"/g) || []).length, 1);
  const wardenPanel = html.slice(html.indexOf('id="warden"'), html.indexOf('id="guard"'));
  assert.doesNotMatch(wardenPanel, /Operasi Warden &amp; HEP|Semakan Warden|Luluskan atau tolak permohonan/);
  assert.equal((html.match(/id="sessionRole"/g) || []).length, 1);
  assert.equal((html.match(/id="sessionName"/g) || []).length, 1);
  assert.equal((html.match(/id="logoutButton"/g) || []).length, 1);
});

test("authenticated Current Hostel Residents roster remains grouped, collapsed and names-only", () => {
  assert.match(html, /id="wardenCurrentHostelRoster"[^>]*aria-live="polite"/);
  const roster = sourceBetween("function currentHostelRosterHtmlV240", "function renderStaffCurrentHostelRosterV240");
  const access = sourceBetween("function buildCurrentHostelRosterAccessPayloadV240", "function renderPublicCurrentHostelSummaryV240");
  assert.match(roster, /<details class="current-hostel-group-roster">/);
  assert.match(roster, /student\.nama/);
  assert.doesNotMatch(roster, /no_matrik|student_id|guardian|phone/);
  assert.match(access, /currentSession\.role === "warden" \|\| currentSession\.role === "guard"/);
});

test("pending, departure-confirmation and approved-risk queues remain authoritative", () => {
  assert.match(html, /id="wardenList"/);
  assert.match(html, /id="wardenDepartureConfirmationList"/);
  assert.match(html, /id="wardenApprovedList"/);
  const render = sourceBetween("function renderWarden()", "function guardianContactShortcutHtml");
  assert.match(render, /sortWardenPendingRequests/);
  assert.match(render, /recordCard\(record, "warden"\)/);
  assert.match(render, /wardenDepartureConfirmationCard/);
  assert.match(render, /recordCard\(record, "warden-readonly"\)/);
});

test("approve, reject and existing rejection note behavior remain unchanged", () => {
  const render = sourceBetween("function renderWarden()", "function guardianContactShortcutHtml");
  const actions = sourceBetween("function actionButtons", "function emptyState");
  const update = sourceBetween("async function updateStatus", "async function confirmOut");
  assert.match(render, /data-approve[\s\S]*updateStatus\(button\.dataset\.approve, STATUS\.approved, button\)/);
  assert.match(render, /data-reject[\s\S]*updateStatus\(button\.dataset\.reject, STATUS\.rejected, button\)/);
  assert.match(actions, /data-approve[\s\S]*Luluskan[\s\S]*data-reject[\s\S]*Tolak/);
  assert.match(update, /status === STATUS\.approved \? "approveRequest" : "rejectRequest"/);
  assert.match(update, /catatan: status === STATUS\.rejected \? "Ditolak oleh warden\." : ""/);
});

test("Kecemasan priority remains visibly textual without implying auto-approval", () => {
  const priority = sourceBetween("function wardenPriorityPresentation", "function classSummaryCard");
  const card = sourceBetween("function recordCard", "function guardOperationalCard");
  assert.match(priority, /Kecemasan/);
  assert.match(priority, /Perlu perhatian segera/);
  assert.match(priority, /ambil tindakan mengikut prosedur/);
  assert.match(card, /badge-emergency/);
  assert.doesNotMatch(priority, /auto|automatik/i);
});

test("all existing backend-provided urgency states get text labels without recalculation", () => {
  const urgency = sourceBetween("function wardenOperationalUrgencyHtml", "async function fetchGuardianContact");
  assert.match(urgency, /NORMAL: "Normal"/);
  assert.match(urgency, /DUE_SOON: "Hampir Waktu Pulang"/);
  assert.match(urgency, /LATE: "Lewat"/);
  assert.match(urgency, /CRITICAL: "Kritikal"/);
  assert.match(urgency, /ACTION_REQUIRED: "Tindakan Segera"/);
  assert.match(urgency, /record && record\.operational_urgency/);
  assert.doesNotMatch(urgency, /Date|minutes|threshold|calculate|derive/i);
});

test("Guardian Contact remains authenticated, on-demand and privacy-conscious", () => {
  const shortcut = sourceBetween("function guardianContactShortcutHtml", "function guardianContactPanelHtml");
  const fetch = sourceBetween("async function fetchGuardianContact", "function wardenDepartureConfirmationCard");
  assert.match(shortcut, /Hubungi Penjaga/);
  assert.match(shortcut, /guardian_contact_available !== true/);
  assert.match(shortcut, /data-guardian-contact-panel[\s\S]*hidden/);
  assert.match(fetch, /currentSession\.role !== "warden"/);
  assert.match(fetch, /apiPost\("getGuardianContact"/);
  assert.doesNotMatch(shortcut, /guardian_phone|call_uri|tel:/);
});

test("No-Guard remote checkout remains a distinct Warden action, not Guard flow", () => {
  const card = sourceBetween("function wardenDepartureConfirmationCard", "async function confirmWardenRemoteCheckout");
  const action = sourceBetween("async function confirmWardenRemoteCheckout", "function isReturnSelfieSubmitted");
  assert.match(card, /Operasi No-Guard/);
  assert.match(card, /data-warden-remote-checkout/);
  assert.match(action, /currentSession\.role !== "warden"/);
  assert.match(action, /apiPost\("confirmWardenRemoteCheckout"/);
  assert.doesNotMatch(action, /apiPost\("confirmOut"|currentSession\.role !== "guard"/);
});

test("Student departure-confirmation request and semester checklist controls remain", () => {
  const render = sourceBetween("function renderWarden()", "function guardianContactShortcutHtml");
  const checklist = sourceBetweenLast("function ensureWardenSemesterChecklist", "function renderWardenSemesterChecklist");
  assert.match(render, /departure_confirmation_pending === true/);
  assert.match(checklist, /wardenSemesterChecklist/);
  assert.match(checklist, /wardenChecklistFilterButtons/);
  assert.match(checklist, /wardenCopyNamesButton/);
  assert.match(checklist, /Refresh Permohonan|ensureWardenRefreshControls/);
});

test("Warden refresh remains a compact operational control without a utility panel", () => {
  const controls = sourceBetweenLast("function ensureWardenRefreshControls", "async function refreshWardenRecords");
  assert.match(controls, /warden-operational-controls/);
  assert.match(controls, /Refresh Permohonan/);
  assert.match(controls, /refreshWardenRecords\("button"\)/);
  assert.doesNotMatch(controls, /Utiliti Warden|warden-utility-actions|moveWardenUtilityButtons/);
});

test("r15 Warden styling is dark, indigo, responsive and operationally scoped", () => {
  assert.match(wardenCss, /body:has\(#appWorkspace\.active #warden\.tab-panel\.active\)/);
  assert.match(wardenCss, /#818cf8|#4f46e5/);
  assert.match(wardenCss, /#wardenList, #wardenDepartureConfirmationList, #wardenApprovedList/);
  assert.match(wardenCss, /@media \(max-width: 520px\)/);
  assert.match(wardenCss, /min-width:\s*0/);
  assert.doesNotMatch(wardenCss, /#(?:pelajar|guard|adminDashboard)\b/);
});

test("urgency, emergency, Guardian Contact and No-Guard use textual visual treatments", () => {
  assert.match(wardenCss, /\.warden-urgency-normal/);
  assert.match(wardenCss, /\.warden-urgency-due-soon/);
  assert.match(wardenCss, /\.warden-urgency-late/);
  assert.match(wardenCss, /\.warden-urgency-critical/);
  assert.match(wardenCss, /\.warden-urgency-action-required/);
  assert.match(wardenCss, /\.badge-emergency/);
  assert.match(wardenCss, /\.guardian-contact-panel/);
  assert.match(wardenCss, /\.warden-remote-cue/);
});

test("mobile controls retain touch targets and safe single-column cards", () => {
  assert.match(wardenCss, /@media \(max-width: 520px\)[\s\S]*?#warden \.record-actions[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(wardenCss, /min-height:\s*(?:42|44|46|48)px/);
  assert.match(wardenCss, /\.app-shell \{ padding:\s*10px 9px 22px;/);
  assert.match(wardenCss, /\.guardian-contact-details div[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("focus, disabled and reduced-motion states remain explicit", () => {
  assert.match(wardenCss, /:focus-visible/);
  assert.match(wardenCss, /:disabled/);
  assert.match(wardenCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(wardenCss, /transition:\s*none/);
});

test("r15 Warden visuals remain under the r17 cache while displayed version stays v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r21/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r14/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
});
