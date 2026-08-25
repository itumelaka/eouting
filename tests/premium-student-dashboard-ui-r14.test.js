const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const studentCssStart = css.indexOf("Premium Institutional Student Dashboard — r14");
const studentCssEnd = css.indexOf("Premium Institutional Warden Dashboard — r15", studentCssStart);
const studentCss = css.slice(studentCssStart, studentCssEnd);

test("r14 keeps one authenticated Student dashboard and one application form", () => {
  assert.equal((html.match(/<section class="tab-panel active" id="pelajar"/g) || []).length, 1);
  assert.equal((html.match(/<form\b[^>]*id="requestForm"/g) || []).length, 1);
  assert.match(html, /id="loggedStudentName"/);
  assert.match(html, /id="loggedStudentMeta"/);
  assert.match(html, /id="logoutButton"/);
});

test("Student identity card consolidates profile identity and photo controls", () => {
  assert.equal((html.match(/id="studentIdentityProfilePhoto"/g) || []).length, 1);
  assert.doesNotMatch(html, /id="studentProfilePhotoPreview"|id="studentProfilePhotoPanel"|id="studentProfilePhotoTitle"/);
  assert.match(html, /student-identity-copy[\s\S]*?studentIdentityProfilePhoto[\s\S]*?>Pelajar<[\s\S]*?loggedStudentName[\s\S]*?loggedStudentMeta[\s\S]*?studentProfilePhotoUpdated[\s\S]*?studentProfilePhotoPicker/);
  assert.match(css, /student-identity-details/);
  assert.match(css, /student-profile-photo-controls/);
});

test("single identity thumbnail preserves preview and upload wiring", () => {
  const render = app.slice(app.indexOf("function renderStudentProfilePhotoArea"), app.indexOf("async function handleStudentProfilePhotoSelection"));
  const setup = app.slice(app.indexOf("function setupStudentProfilePhotoControls"), app.indexOf("function normalizeWardenStaffRole"));
  assert.equal((render.match(/profilePhotoMarkup\(/g) || []).length, 1);
  assert.match(render, /studentIdentityProfilePhoto\.innerHTML = profilePhotoMarkup/);
  assert.match(render, /profile-photo-identity/);
  assert.match(render, /studentProfilePhotoUpdated\.textContent = updatedAt \? `Dikemas kini:/);
  assert.match(render, /studentProfilePhotoPicker\.textContent = hasPhoto \? "Kemaskini Foto" : "Tambah Foto"/);
  assert.match(setup, /studentProfilePhotoPicker\.addEventListener\("click", openProfilePhotoSourceChooser\)/);
  assert.match(setup, /addEventListener\("change", handleStudentProfilePhotoSelection\)/);
});

test("authoritative active states still hide only the existing request section", () => {
  assert.match(app, /function isActiveStudentRecord\(record\)[\s\S]*?MENUNGGU_KELULUSAN[\s\S]*?DILULUSKAN_WARDEN[\s\S]*?KELUAR/);
  assert.match(app, /function updateStudentRequestSectionVisibility\(currentRecord\)[\s\S]*?studentRequestSection\.hidden = hasActiveRequest[\s\S]*?studentActiveRequestNotice\.hidden = !hasActiveRequest/);
  assert.match(css, /\.student-request-section\[hidden\],[\s\S]*?\.student-active-request-notice\[hidden\][\s\S]*?display:\s*none\s*!important/);
});

test("terminal and no-active records continue to restore the canonical form", () => {
  const activeHelper = app.slice(app.indexOf("function isActiveStudentRecord"), app.indexOf("function buildCurrentHostelRosterAccessPayloadV240"));
  assert.doesNotMatch(activeHelper, /SELESAI|DITOLAK_WARDEN|DIBATALKAN_PELAJAR/);
  assert.match(app, /const hasActiveRequest = Boolean\(currentRecord && isActiveStudentRecord\(currentRecord\)\)/);
});

test("current status, annual summary and private history remain in Student scope", () => {
  assert.match(html, /id="studentCurrentStatus"[^>]*aria-live="polite"/);
  assert.match(html, /id="studentAnnualSummary"[^>]*aria-live="polite"/);
  assert.match(html, /id="studentRecordsList"[^>]*role="list"/);
  assert.match(app, /const studentRecords = outingRecords\.filter\(isRecordForCurrentStudent\)/);
  assert.match(app, /renderStudentAnnualHistory\(\)/);
});

test("existing cancel, departure confirmation and return-selfie boundaries are unchanged", () => {
  assert.match(app, /canStudentCancelRequest\(record\)[\s\S]*?data-student-cancel/);
  assert.match(app, /studentLifecycleStatus\(record\) !== "DILULUSKAN_WARDEN"/);
  assert.match(app, /data-request-departure-confirmation=/);
  assert.match(app, /function isReturnSelfieEligible\(record\)[\s\S]*?rawStatus === "SELESAI"/);
  assert.match(app, /data-selfie-input=/);
  assert.match(app, /data-selfie-submit=/);
});

test("Student styling is explicitly scoped away from staff and Admin dashboards", () => {
  assert.match(studentCss, /body:has\(#appWorkspace\.active #pelajar\.tab-panel\.active\)/);
  assert.doesNotMatch(studentCss, /#(?:warden|guard|adminDashboard)\b/);
  assert.doesNotMatch(studentCss, /\.(?:warden|guard|admin)-[a-z-]+/);
});

test("dark glass status hierarchy uses textual badges and existing lifecycle content", () => {
  assert.match(studentCss, /\.student-current-status-section\s*\{[\s\S]*?linear-gradient[\s\S]*?border-left:/);
  assert.match(studentCss, /\.student-current-card:has\(\.badge-pending\)/);
  assert.match(studentCss, /\.student-current-card:has\(\.badge-approved\)/);
  assert.match(studentCss, /\.student-current-card:has\(\.badge-out\)/);
  assert.match(studentCss, /\.student-current-card:has\(\.badge-returned\)/);
  assert.match(app, /<strong>Status Semasa:<\/strong>/);
});

test("mobile Student dashboard is bounded and touch friendly", () => {
  assert.match(studentCss, /@media \(max-width: 520px\)/);
  assert.match(studentCss, /\.app-shell\s*\{\s*padding:\s*10px 9px 20px;/s);
  assert.match(studentCss, /#requestForm\s*\{[^}]*padding:\s*14px 12px/s);
  assert.match(studentCss, /min-width:\s*0/);
  assert.match(studentCss, /min-height:\s*(?:42|44|46|48)px/);
  assert.match(studentCss, /\.app-shell\s*\{[^}]*width:\s*100%/s);
});

test("focus, disabled, autofill and reduced-motion states remain explicit", () => {
  assert.match(studentCss, /:focus-visible/);
  assert.match(studentCss, /:disabled/);
  assert.match(studentCss, /input:-webkit-autofill/);
  assert.match(studentCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Student r14 visuals remain under the r21 presentation cache while display version stays v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r21/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r14/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
});
