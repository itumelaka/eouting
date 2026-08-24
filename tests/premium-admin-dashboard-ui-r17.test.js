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
const adminCssStart = css.indexOf("Premium Institutional Admin Dashboard — r17");
const adminCssEnd = css.indexOf("Production UI regression patch", adminCssStart);
const adminCss = css.slice(adminCssStart, adminCssEnd);

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist after ${start}`);
  return app.slice(from, to);
}

test("r17 keeps one authenticated Admin dashboard and the shared session controls", () => {
  assert.equal((html.match(/<section class="tab-panel admin-dashboard" id="admin"/g) || []).length, 1);
  assert.match(html, /admin-dashboard-kicker">Konsol Pentadbiran/);
  assert.match(html, /<h2 id="adminDashboardTitle">Admin eOuting<\/h2>/);
  assert.equal((html.match(/id="sessionRole"/g) || []).length, 1);
  assert.equal((html.match(/id="sessionName"/g) || []).length, 1);
  assert.equal((html.match(/id="logoutButton"/g) || []).length, 1);
});

test("all seven Admin sections keep their existing tabs, panels and dynamic routing", () => {
  const routing = sourceBetween("function setAdminSectionV200", "async function loadAdminMonitoringV210");
  const sections = ["monitoring", "statistics", "master", "students", "staff", "outing", "announcement"];
  const panels = ["adminMonitoringPanel", "adminStatisticsPanel", "adminMasterPanel", "adminStudentManagementPanel", "adminStaffPanel", "adminOutingSettingsPanel", "adminAnnouncementPanel"];
  for (const section of sections) assert.match(routing, new RegExp(`\\"${section}\\"`));
  for (const panel of panels) assert.match(html, new RegExp(`id="${panel}"[\\s\\S]*?role="tabpanel"|role="tabpanel"[\\s\\S]*?id="${panel}"`));
  assert.match(routing, /panel\.hidden = name !== nextSection/);
  assert.match(routing, /aria-selected/);
});

test("Admin monitoring retains backend-authoritative KPIs, filters and action queue", () => {
  const intelligence = sourceBetween("function getAdminOperationalIntelligenceV240", "function getAdminUrgencyLabelV240");
  const filtering = sourceBetween("function matchesAdminMonitoringFilterV240", "function renderAdminMonitoringV210");
  const rendering = sourceBetween("function renderAdminMonitoringV210", "function normalizeAdminLiInstitutionV240");
  for (const key of ["pending", "approved", "out", "due_soon", "late", "critical", "action_required", "needs_review", "pending_emergency"]) {
    assert.match(`${intelligence}\n${filtering}\n${rendering}`, new RegExp(key));
  }
  const urgency = sourceBetween("function getAdminOperationalUrgencyV240", "function isAdminActiveOperationalRecordV240");
  assert.match(urgency, /record && record\.operational_urgency/);
  assert.match(rendering, /renderAdminActionQueueV240\(intelligence\.queue\)/);
  assert.match(html, /id="adminMonitoringKpis"/);
  assert.match(html, /id="adminActionQueue"/);
});

test("Current Hostel Residents remains authenticated, grouped and names-only", () => {
  assert.match(html, /id="adminCurrentHostelRoster"[^>]*aria-live="polite"/);
  const roster = sourceBetween("function currentHostelRosterHtmlV240", "function renderStaffCurrentHostelRosterV240");
  const access = sourceBetween("function buildCurrentHostelRosterAccessPayloadV240", "function renderPublicCurrentHostelSummaryV240");
  assert.match(roster, /groups\.map/);
  assert.match(roster, /student\.nama/);
  assert.doesNotMatch(roster, /guardian|phone|no_tel/);
  assert.match(access, /currentSession\.role === "admin"/);
});

test("monitoring cards retain lifecycle facts and authorized profile thumbnails", () => {
  const rendering = sourceBetween("function renderAdminMonitoringV210", "function normalizeAdminLiInstitutionV240");
  assert.match(rendering, /profilePhotoMarkup/);
  assert.match(rendering, /profile-photo-thumbnail admin-monitoring-thumbnail/);
  assert.match(rendering, /Mohon/);
  assert.match(rendering, /Keluar/);
  assert.match(rendering, /Jangka Pulang/);
  assert.match(rendering, /adminMonitoringStatusLabelV210/);
});

test("Tetapan Pelajar keeps the Pelajar, Kumpulan and Institusi LI inner tabs", () => {
  const subtabs = sourceBetween("function setAdminStudentSubtabV240", "async function loadAdminStudentConfigV240");
  for (const id of ["adminStudentPeoplePanel", "adminStudentGroupsPanel", "adminLiInstitutionsPanel"]) assert.match(html, new RegExp(`id="${id}"`));
  for (const label of ["Pelajar", "Kumpulan", "Institusi LI"]) assert.match(html, new RegExp(`>${label}<`));
  assert.match(subtabs, /\["students", "groups", "institutions"\]/);
  assert.match(subtabs, /panel\.hidden = name !== activeAdminStudentSubtabV240/);
});

test("student management retains config-driven institution visibility, validation and payload", () => {
  const field = sourceBetween("function updateAdminStudentInstitutionFieldV240", "function renderAdminStudentGroupListV240");
  const payload = sourceBetween("function buildAdminStudentFormPayloadV200", "async function handleAdminStudentSubmitV200");
  const submit = sourceBetween("async function handleAdminStudentSubmitV200", "function setAdminStudentEditorMessageV200");
  assert.match(field, /group\.institution_required/);
  assert.match(field, /required = requiresInstitution/);
  for (const key of ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "institution_code", "jantina", "status", "catatan"]) assert.match(payload, new RegExp(key));
  assert.match(submit, /ID pelajar, no\. matrik dan nama diperlukan/);
  assert.match(submit, /"updateStudent" : "createStudent"/);
});

test("group management preserves create, update, deactivation and optimistic versions", () => {
  const editor = sourceBetween("function openAdminStudentGroupEditorV240", "function openAdminLiInstitutionEditorV240");
  const save = sourceBetween("async function saveAdminStudentGroupV240", "async function saveAdminLiInstitutionV240");
  const toggle = sourceBetween("async function toggleAdminStudentConfigV240", "function setStudentConfigMessageV240");
  assert.match(editor, /readOnly = Boolean\(group\)/);
  assert.match(save, /"updateStudentGroup" : "createStudentGroup"/);
  assert.match(save, /expected_config_version/);
  assert.match(toggle, /"toggleStudentGroupStatus"/);
  assert.doesNotMatch(`${save}\n${toggle}`, /deleteStudentGroup/);
});

test("institution management preserves create, update, deactivation and optimistic versions", () => {
  const editor = sourceBetween("function openAdminLiInstitutionEditorV240", "function closeAdminStudentGroupEditorV240");
  const save = sourceBetween("async function saveAdminLiInstitutionV240", "function handleAdminStudentGroupActionV240");
  const toggle = sourceBetween("async function toggleAdminStudentConfigV240", "function setStudentConfigMessageV240");
  assert.match(editor, /readOnly = Boolean\(institution\)/);
  assert.match(save, /"updateLiInstitution" : "createLiInstitution"/);
  assert.match(save, /expected_config_version/);
  assert.match(toggle, /"toggleLiInstitutionStatus"/);
  assert.doesNotMatch(`${save}\n${toggle}`, /deleteLiInstitution/);
});

test("all canonical rollout readiness states remain visible and data-driven", () => {
  const readiness = sourceBetween("function renderAdminStudentReadinessV240", "function renderAdminDynamicLoginControlV240");
  for (const state of ["LEGACY_SAFE", "SETUP_REQUIRED", "MIGRATION_REQUIRED", "MIGRATION_BLOCKED", "READY_FOR_ADMIN_CONFIG", "READY_FOR_DYNAMIC_LOGIN"]) {
    assert.match(readiness, new RegExp(state));
  }
  assert.match(readiness, /readiness\.operational_state/);
  assert.match(readiness, /readiness\.issues/);
  assert.match(readiness, /readiness\.migration_issues/);
});

test("migration safeguards retain dry-run, confirmation, apply gating and all metrics", () => {
  const tools = sourceBetween("function renderAdminStudentMigrationResultV240", "function openAdminStudentGroupEditorV240");
  for (const metric of ["total_rows", "total_li", "matched_blank", "rows_existing", "applied", "unmatched", "conflicts", "skipped_non_li"]) assert.match(tools, new RegExp(metric));
  assert.match(tools, /mode: "dry-run"/);
  assert.match(tools, /dryRun: true/);
  assert.match(tools, /adminStudentMigrationDryRunV240\.can_apply === true/);
  assert.match(tools, /confirm_apply: true/);
  assert.match(tools, /mode: "apply"/);
});

test("Dynamic Student Login keeps explicit ON/OFF, confirmation and legacy rollback", () => {
  const dynamic = sourceBetween("function renderAdminDynamicLoginControlV240", "async function refreshAdminStudentReadinessV240");
  assert.match(dynamic, /Status: \$\{enabled \? "ON" : "OFF"\}/);
  assert.match(dynamic, /adminDynamicLoginConfirmInput\.checked/);
  assert.match(dynamic, /setStudentGroupConfigEnabled/);
  assert.match(dynamic, /confirm_enable: enabled === true/);
  assert.match(dynamic, /Login legacy telah dipulihkan/);
  assert.match(html, /id="adminDynamicLoginDisableButton"[^>]*>Kembali ke Login Legacy</);
});

test("No-Guard remains the existing Admin configuration workflow", () => {
  const load = sourceBetween("async function loadAdminNoGuardDepartureConfig", "function renderAdminNoGuardDepartureConfig");
  const save = sourceBetween("async function saveAdminNoGuardDepartureConfig", "async function loadAdminAnnouncementV1");
  assert.match(html, /id="adminNoGuardDepartureForm"/);
  assert.match(html, /Fallback Pengesahan Keluar Tanpa Guard/);
  assert.match(load, /getNoGuardDepartureConfig/);
  assert.match(save, /updateNoGuardDepartureConfig/);
  assert.match(save, /enabled/);
});

test("r17 Admin CSS is dark navy with emerald/cyan security accents and scoped to Admin", () => {
  assert.notEqual(adminCssStart, -1);
  assert.match(adminCss, /body:has\(#admin\.admin-dashboard\.active\)/);
  assert.match(adminCss, /var\(--access-navy-950\)|#071b32|#0d2638/);
  assert.match(adminCss, /#10b981|#2dd4bf/);
  assert.match(adminCss, /rgba\(6, 182, 212|rgba\(103, 232, 249/);
  assert.match(adminCss, /\.admin-kpi-grid/);
  assert.match(adminCss, /\.admin-action-queue/);
  assert.match(adminCss, /\.admin-current-hostel-roster/);
  assert.doesNotMatch(adminCss, /#(?:pelajar|warden|guard|dashboard)\b/);
});

test("Admin semantic urgency, action and readiness states remain visibly distinct", () => {
  for (const state of ["due-soon", "late", "critical", "action-required"]) assert.match(adminCss, new RegExp(`admin-ops-urgency-${state}`));
  for (const state of ["action-required", "critical", "needs-review", "pending-emergency"]) assert.match(adminCss, new RegExp(`admin-action-${state}`));
  assert.match(adminCss, /admin-config-status\[data-state="active"\]/);
  assert.match(adminCss, /admin-config-status\[data-state="issue"\]/);
  assert.match(adminCss, /admin-config-status\[data-state="legacy"\]/);
});

test("Admin layout is responsive, touch-safe and accessibility-aware", () => {
  assert.match(adminCss, /@media \(max-width: 1080px\)/);
  assert.match(adminCss, /@media \(max-width: 760px\)/);
  assert.match(adminCss, /@media \(max-width: 430px\)/);
  assert.match(adminCss, /overflow-x:\s*auto/);
  assert.match(adminCss, /min-width:\s*0/);
  assert.match(adminCss, /\.admin-config-status summary[\s\S]*?white-space:\s*normal/);
  assert.match(adminCss, /overflow-wrap:\s*anywhere/);
  assert.match(adminCss, /min-height:\s*(?:42|44|48)px/);
  assert.match(adminCss, /:focus-visible/);
  assert.match(adminCss, /:disabled/);
  assert.match(adminCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(adminCss, /transition:\s*none/);
});

test("r17 cache is consistent while displayed application version stays v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r20/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r20/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r20/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r16/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
  assert.equal(version.version, "2.4.0");
});
