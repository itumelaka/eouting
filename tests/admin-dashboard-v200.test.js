const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

const adminBlock = appSource.slice(
  appSource.indexOf("function showAdminLoginPanelV200"),
  appSource.indexOf("function setupStudentClassFilter")
);

function extractFunction(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  const asyncStart = appSource.indexOf(`async function ${name}`);
  const actualStart = start === -1 ? asyncStart : start;
  assert.notEqual(actualStart, -1, `${name} must exist`);
  const endCandidates = [
    appSource.indexOf(`function ${nextName}`, actualStart + 1),
    appSource.indexOf(`async function ${nextName}`, actualStart + 1)
  ].filter((index) => index > actualStart);
  const end = endCandidates.length ? Math.min(...endCandidates) : appSource.length;
  return appSource.slice(actualStart, end);
}

test("Admin role and accessible login form exist", () => {
  assert.match(indexSource, /data-role-choice="admin"/);
  assert.match(indexSource, /id="adminLoginPanel"/);
  assert.match(indexSource, /for="adminIdentityInput"/);
  assert.match(indexSource, /for="adminPinInput"/);
  assert.match(indexSource, /id="adminLoginMessage"[^>]*aria-live="polite"/);
});

test("Admin PIN remains out of localStorage and uses only the dedicated tab session", () => {
  assert.doesNotMatch(adminBlock, /localStorage/);
  assert.match(adminBlock, /sessionStorage/);
  assert.match(adminBlock, /ADMIN_SESSION_STORAGE_KEY/);
  assert.match(adminBlock, /adminRuntimeCredential\s*=\s*\{/);
  assert.match(adminBlock, /els\.adminPinInput\.value\s*=\s*""/);
});

test("successful Admin login opens the Admin Dashboard", () => {
  const loginSource = extractFunction("handleAdminLoginV200", "setAdminLoginLoadingV200");
  const sessionSource = extractFunction("startAdminSessionV200", "clearAdminRuntimeCredentialV200");
  assert.match(loginSource, /apiPost\("loginAdmin"/);
  assert.match(loginSource, /startAdminSessionV200\(admin\)/);
  assert.match(sessionSource, /role:\s*"admin"/);
  assert.match(sessionSource, /els\.adminDashboard\.classList\.add\("active"\)/);
  assert.doesNotMatch(sessionSource, /loadAdminOutingTypesV200\(\)/);
  assert.match(sessionSource, /setAdminSectionV200\("monitoring"\)/);
});

test("Admin session hides only the main role navigation and keeps Admin sub-navigation visible", () => {
  const sessionSource = extractFunction("startAdminSessionV200", "clearAdminRuntimeCredentialV200");
  const clearSource = extractFunction("clearAdminRuntimeCredentialV200", "buildAdminCredentialPayloadV200");

  assert.match(sessionSource, /document\.querySelector\("\.tabs"\)/);
  assert.match(sessionSource, /tabs\.hidden\s*=\s*true/);
  assert.match(styleSource, /\.tabs\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
  assert.match(clearSource, /tabs\.hidden\s*=\s*false/);

  assert.match(indexSource, /class="tab-button active"[^>]*data-tab="pelajar">Pelajar<\/button>/);
  assert.match(indexSource, /class="tab-button"[^>]*data-tab="warden">Warden &amp; HEP<\/button>/);
  assert.match(indexSource, /class="tab-button"[^>]*data-tab="guard">Guard<\/button>/);
  assert.match(indexSource, /class="tab-button"[^>]*data-tab="dashboard">Dashboard<\/button>/);
  assert.doesNotMatch(indexSource, /<nav class="tabs"[^>]*hidden/);

  assert.match(indexSource, /class="admin-subnav"[^>]*role="tablist"/);
  assert.match(indexSource, /id="adminOutingTab"[\s\S]*?Tetapan Outing/);
  assert.match(indexSource, /id="adminStudentsTab"[\s\S]*?Pengurusan Pelajar/);
  assert.doesNotMatch(sessionSource, /admin-subnav[^\n]*hidden\s*=\s*true/);
});

test("Student session keeps the main Pelajar navigation available", () => {
  const clearSource = extractFunction("clearAdminRuntimeCredentialV200", "buildAdminCredentialPayloadV200");
  assert.match(indexSource, /<nav class="tabs" aria-label="Bahagian sistem">/);
  assert.match(indexSource, /data-tab="pelajar">Pelajar<\/button>/);
  assert.doesNotMatch(indexSource, /<nav class="tabs"[^>]*hidden/);
  assert.match(clearSource, /tabs\.hidden\s*=\s*false/);
});

test("Warden and Guard main navigation buttons remain unchanged", () => {
  assert.match(indexSource, /data-tab="warden">Warden &amp; HEP<\/button>/);
  assert.match(indexSource, /data-tab="guard">Guard<\/button>/);
  assert.match(indexSource, /data-tab="dashboard">Dashboard<\/button>/);
});

test("Admin sub-navigation remains available inside the Admin workspace", () => {
  assert.match(indexSource, /class="admin-subnav"[^>]*role="tablist"/);
  assert.match(indexSource, /data-admin-section="outing"[\s\S]*?Tetapan Outing|Tetapan Outing[\s\S]*?data-admin-section="outing"/);
  assert.match(indexSource, /data-admin-section="students"[\s\S]*?Pengurusan Pelajar|Pengurusan Pelajar[\s\S]*?data-admin-section="students"/);
});

test("failed Admin login shows a safe generic error", () => {
  const source = extractFunction("handleAdminLoginV200", "setAdminLoginLoadingV200");
  assert.match(source, /ID atau nama Admin atau PIN tidak sah\./);
  assert.match(source, /adminRuntimeCredential\s*=\s*null/);
  assert.doesNotMatch(source, /setAdminLoginMessageV200\(error\.message/);
});

test("Admin list loads authenticated active and inactive configuration", () => {
  const loadSource = extractFunction("loadAdminOutingTypesV200", "adminOutingTypeSortV200");
  const renderSource = extractFunction("renderAdminOutingTypesV200", "renderAdminOutingTypesErrorV200");
  assert.match(loadSource, /apiPost\("getAdminOutingTypes"/);
  assert.match(loadSource, /sort\(adminOutingTypeSortV200\)/);
  assert.match(renderSource, /active \? "Aktif" : "Tidak Aktif"/);
  assert.match(renderSource, /type\.type_code/);
  assert.match(renderSource, /type\.config_version/);
  assert.match(renderSource, /formatAdminDaysV200/);
});

test("loading, empty, error and retry states are wired", () => {
  assert.match(adminBlock, /Memuatkan konfigurasi/);
  assert.match(adminBlock, /Tiada jenis outing dikonfigurasi/);
  assert.match(adminBlock, /data-admin-retry="1"/);
  assert.match(adminBlock, /loadAdminOutingTypesV200\(\)/);
  assert.match(indexSource, /id="adminDashboardMessage"[^>]*aria-live="polite"/);
});

test("create, edit and toggle actions call the controlled POST APIs", () => {
  assert.match(adminBlock, /apiPost\("createOutingType"/);
  assert.match(adminBlock, /apiPost\("updateOutingType"/);
  assert.match(adminBlock, /apiPost\("toggleOutingType"/);
  assert.match(adminBlock, /window\.confirm\(confirmation\)/);
  assert.match(adminBlock, /window\.confirm\(`Pasti mahu/);
  assert.match(adminBlock, /await loadAdminOutingTypesV200\(\)/);
});

test("Tetapan Outing separates application and departure rules", () => {
  assert.match(indexSource, /<legend>Peraturan Permohonan<\/legend>/);
  assert.match(indexSource, /<legend>Peraturan Keluar<\/legend>/);
  assert.match(indexSource, /id="adminDepartureAllowedDays"/);
  assert.match(indexSource, /id="adminEarliestDepartureTimeInput"[^>]*type="time"/);
  assert.match(adminBlock, /departure_allowed_days/);
  assert.match(adminBlock, /earliest_departure_time/);
});

test("type_code is read-only during edit and active is excluded from update", () => {
  const editSource = extractFunction("openAdminEditEditorV200", "closeAdminEditorV200");
  const submitSource = extractFunction("handleAdminTypeSubmitV200", "handleAdminToggleV200");
  assert.match(editSource, /adminTypeCodeInput\.readOnly\s*=\s*true/);
  assert.match(editSource, /adminActiveField\.hidden\s*=\s*true/);
  assert.match(submitSource, /delete updateConfig\.type_code/);
  assert.match(submitSource, /delete updateConfig\.active/);
});

test("update and toggle send expected_config_version and handle conflicts", () => {
  const submitSource = extractFunction("handleAdminTypeSubmitV200", "handleAdminToggleV200");
  const toggleSource = extractFunction("handleAdminToggleV200", "isAdminConfigConflictV200");
  assert.match(submitSource, /expected_config_version:\s*Number\(els\.adminConfigVersionInput\.value\)/);
  assert.match(toggleSource, /expected_config_version:\s*Number\(type\.config_version\)/);
  assert.match(submitSource, /isAdminConfigConflictV200\(error\)/);
  assert.match(toggleSource, /isAdminConfigConflictV200\(error\)/);
  assert.match(adminBlock, /Data terkini telah dimuatkan/);
});

test("there is no delete control or delete API", () => {
  assert.doesNotMatch(indexSource, /data-admin-delete|deleteOutingType|Padam Jenis/);
  assert.doesNotMatch(adminBlock, /data-admin-delete|deleteOutingType/);
  assert.doesNotMatch(gasSource, /function\s+deleteOutingType|action\s*===\s*["']deleteOutingType/);
});

test("logout clears Admin credentials and responsive focus styles exist", () => {
  const clearSource = extractFunction("clearAdminRuntimeCredentialV200", "buildAdminCredentialPayloadV200");
  assert.match(clearSource, /adminRuntimeCredential\s*=\s*null/);
  assert.match(clearSource, /adminPinInput\.value\s*=\s*""/);
  assert.match(adminBlock, /logoutButton\.addEventListener/);
  assert.match(adminBlock, /function exitAdminSessionV200[\s\S]*clearSavedAdminSessionV220\(\)/);
  assert.match(styleSource, /\.admin-dashboard button:focus-visible/);
  assert.match(styleSource, /@media \(max-width: 760px\)/);
});
