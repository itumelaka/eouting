const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("Tetapan Pelajar contains compact Pelajar, Kumpulan, Institusi LI sub-tabs in order", () => {
  const panel = html.slice(html.indexOf('id="adminStudentManagementPanel"'), html.indexOf('id="adminMasterPanel"'));
  const labels = ["Pelajar", "Kumpulan", "Institusi LI"];
  let position = -1;
  labels.forEach((label) => {
    const next = panel.indexOf(`>${label}</button>`);
    assert.ok(next > position, `${label} must appear in order`);
    position = next;
  });
  assert.match(panel, /adminStudentPeoplePanel/);
  assert.match(panel, /adminStudentGroupsPanel/);
  assert.match(panel, /adminLiInstitutionsPanel/);
  assert.match(css, /\.admin-student-subtabs[\s\S]*grid-template-columns: repeat\(3/);
});

test("Group and institution lists, generic create editors, edit, toggle and versions are wired", () => {
  [
    "getAdminStudentGroups", "createStudentGroup", "updateStudentGroup", "toggleStudentGroupStatus",
    "getAdminLiInstitutions", "createLiInstitution", "updateLiInstitution", "toggleLiInstitutionStatus"
  ].forEach((action) => assert.match(app, new RegExp(`apiPost\\(\\"${action}\\"|\\"${action}\\"`)));
  assert.match(html, /id="adminStudentGroupCodeInput"/);
  assert.match(html, /id="adminLiInstitutionCodeInput"/);
  assert.match(app, /config_version/);
  assert.match(app, /data-config-toggle/);
  assert.equal(html.includes("deleteStudentGroup"), false);
  assert.equal(html.includes("deleteLiInstitution"), false);
});

test("Admin may enter future codes without A4 or IMU being hard-coded in runtime UI", () => {
  const studentPanel = html.slice(html.indexOf('id="adminStudentManagementPanel"'), html.indexOf('id="adminMasterPanel"'));
  assert.match(studentPanel, /pattern="\[A-Za-z\]\[A-Za-z0-9_\]\{1,31\}"/);
  assert.equal(studentPanel.includes('value="A4"'), false);
  assert.equal(studentPanel.includes('value="IMU"'), false);
  assert.match(app, /toUpperCase\(\)\.replace\(\/\[\^A-Z0-9_\]\/g/);
});

test("Student editor uses active config and conditionally shows authoritative institution assignment", () => {
  assert.match(html, /id="adminStudentInstitutionField" hidden/);
  assert.match(html, /id="adminStudentInstitutionInput"[^>]*disabled/);
  assert.match(app, /adminStudentGroupsV240\.filter\(\(group\) => group\.active\)/);
  assert.match(app, /group && group\.institution_required/);
  assert.match(app, /adminStudentInstitutionField\.hidden = !requiresInstitution/);
  assert.match(app, /institution_code:[\s\S]*adminStudentInstitutionInput/);
});

test("inactive current group and institution remain available for unrelated edits", () => {
  assert.match(app, /currentGroup && !currentGroup\.active/);
  assert.match(app, /current && !current\.active/);
  assert.match(app, /Tidak Aktif — semasa/);
  assert.match(app, /renderAdminStudentGroupOptionsV240\(student\)/);
  assert.match(app, /updateAdminStudentInstitutionFieldV240\(student\.institution_code\)/);
});

test("Admin-only Student and Master filters derive their options from group config", () => {
  assert.match(app, /renderAdminStudentGroupOptionsV240/);
  assert.match(app, /els\.adminStudentClassFilter, els\.adminMasterClass/);
  assert.match(app, /referencedCodes/);
});

test("readiness indicator remains aggregate-only beside the guarded activation control", () => {
  const panel = html.slice(html.indexOf('id="adminStudentManagementPanel"'), html.indexOf('id="adminMasterPanel"'));
  assert.match(panel, /Student Group Config/);
  assert.match(app, /getStudentGroupConfigReadiness/);
  assert.match(app, /readiness\.counts/);
  assert.match(panel, /adminDynamicLoginEnableButton/);
  assert.match(panel, /adminDynamicLoginConfirmInput/);
  assert.equal(panel.includes("STUDENT_GROUP_CONFIG_ENABLED"), false);
  assert.equal(app.includes('setProperty("STUDENT_GROUP_CONFIG_ENABLED", "true")'), false);
});

test("Student login retains legacy A2/A3/LI fallback with unchanged payload boundary", () => {
  const login = html.slice(html.indexOf('id="studentClassFilter"'), html.indexOf('id="studentLoginSelect"'));
  assert.match(login, /data-student-class="A2"/);
  assert.match(login, /data-student-class="A3"/);
  assert.match(login, /data-student-class="LI"/);
  assert.equal(login.includes('data-student-class="A4"'), false);
  const loginSubmit = app.slice(app.indexOf("async function handleStudentLogin"), app.indexOf("async function handleWardenLogin"));
  assert.match(loginSubmit, /loginStudent/);
  assert.match(loginSubmit, /student_id/);
  assert.match(loginSubmit, /no_matrik/);
  assert.equal(loginSubmit.includes("loginGroupKey"), false);
  assert.equal(loginSubmit.includes("getAdminStudentGroups"), false);
  assert.equal(gas.includes('setProperty(STUDENT_GROUP_CONFIG_PROPERTY, "true")'), false);
});

test("frontend runtime revision advances consistently to r17 without changing displayed version", () => {
  assert.match(app, /const APP_VERSION = "2\.4\.0"/);
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r19/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r19/);
  assert.match(serviceWorker, /eouting-cache-v2\.4\.0-r19/);
  assert.doesNotMatch(`${html}\n${serviceWorker}`, /2\.4\.0-r13/);
});
