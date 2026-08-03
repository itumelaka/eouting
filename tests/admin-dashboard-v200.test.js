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

test("Admin PIN remains runtime-only and is never logged or stored", () => {
  assert.doesNotMatch(adminBlock, /localStorage|sessionStorage/);
  assert.doesNotMatch(adminBlock, /console\.(log|info|warn|error)/);
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
  assert.match(sessionSource, /loadAdminOutingTypesV200\(\)/);
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
  assert.match(styleSource, /\.admin-dashboard button:focus-visible/);
  assert.match(styleSource, /@media \(max-width: 760px\)/);
});
