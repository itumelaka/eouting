const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing source marker: ${endMarker}`);
  return appSource.slice(start, end);
}

test("mock Admin is enabled only by the explicit mock=1 query", () => {
  assert.match(appSource, /const ALLOW_MOCK_MODE = new URLSearchParams\(window\.location\.search\)\.get\("mock"\) === "1"/);
  assert.match(appSource, /const MOCK_ADMIN_QA = ALLOW_MOCK_MODE\s*\?/);
  assert.match(appSource, /let mockAdminOutingTypesV200 = ALLOW_MOCK_MODE\s*\?/);
  assert.match(appSource, /let mockAdminStudentsV200 = ALLOW_MOCK_MODE\s*\?/);
});

test("mock Student Management includes LI and stays within mock transport", () => {
  const seedSource = sourceBetween("function buildMockAdminStudentsV200", "function buildMockAdminOutingTypesV200");
  assert.match(seedSource, /kelas: "LI"/);
  assert.match(seedSource, /status: "TIDAK AKTIF"/);
  const mockSource = sourceBetween("async function mockAdminApiPostV200", "function cloneMockAdminValueV200");
  for (const action of ["getAdminStudents", "createStudent", "updateStudent", "toggleStudentStatus"]) {
    assert.match(mockSource, new RegExp(`action === "${action}"`));
  }
  assert.doesNotMatch(mockSource, /fetch\(|GAS_WEB_APP_URL|apiPost\(/);
});

test("mock Admin has exactly five legacy types including an inactive QA row", () => {
  const seedSource = sourceBetween("function buildMockAdminOutingTypesV200", "async function mockAdminApiPostV200");
  const typeCodes = seedSource.match(/type_code: REQUEST_TYPE\.(normal|weekend|emergency|overnight|semester)/g) || [];
  assert.equal(typeCodes.length, 5);
  assert.match(seedSource, /type_code: REQUEST_TYPE\.semester[\s\S]*?active: false/);
});

test("live apiPost cannot use mock credentials and mock writes never call GAS", () => {
  const apiPostStarts = [...appSource.matchAll(/async function apiPost\(action, payload\)/g)]
    .map((match) => match.index);
  const apiPostDefinitions = apiPostStarts.map((start) => {
    const nextFunction = appSource.indexOf("\nasync function ", start + 1);
    return appSource.slice(start, nextFunction === -1 ? appSource.length : nextFunction);
  });
  assert.ok(apiPostDefinitions.length >= 1);
  apiPostDefinitions.forEach((apiPostSource) => {
    assert.match(apiPostSource, /if \(ALLOW_MOCK_MODE && MOCK_ADMIN_ACTIONS_V200\.has\(action\)\)/);
    assert.match(apiPostSource, /return mockAdminApiPostV200\(action, payload\)/);
    assert.match(apiPostSource, /fetch\(getGasWebAppUrlV200\(\)/);
  });

  const mockSource = sourceBetween("async function mockAdminApiPostV200", "function cloneMockAdminValueV200");
  assert.match(mockSource, /if \(!ALLOW_MOCK_MODE \|\| !MOCK_ADMIN_QA/);
  assert.doesNotMatch(mockSource, /fetch\(|GAS_WEB_APP_URL|apiPost\(/);
});

test("mock login response excludes PIN and failures remain safe", () => {
  const mockSource = sourceBetween("async function mockAdminApiPostV200", "function cloneMockAdminValueV200");
  const loginResponse = mockSource.slice(
    mockSource.indexOf('if (action === "loginAdmin")'),
    mockSource.indexOf('if (action === "getAdminOutingTypes")')
  );
  assert.match(loginResponse, /admin_id: MOCK_ADMIN_QA\.admin_id/);
  assert.match(loginResponse, /nama_admin: MOCK_ADMIN_QA\.nama_admin/);
  assert.doesNotMatch(loginResponse, /pin\s*:/i);
  assert.doesNotMatch(mockSource, /console\.(log|info|warn|error)/);
});

test("mock mode provides one-shot read error and config-version conflict QA", () => {
  assert.match(appSource, /get\("mockAdminError"\) === "1"/);
  assert.match(appSource, /get\("mockAdminConflict"\) === "1"/);
  const mockSource = sourceBetween("async function mockAdminApiPostV200", "function cloneMockAdminValueV200");
  assert.match(mockSource, /mockAdminReadErrorPendingV200 = false/);
  assert.match(mockSource, /mockAdminConflictPendingV200 = false/);
  assert.match(mockSource, /CONFIG_VERSION_CONFLICT/);
});

test("Admin PIN uses only the dedicated tab session in mock and live frontend flows", () => {
  const adminSource = sourceBetween("function showAdminLoginPanelV200", "function setupStudentClassFilter");
  assert.doesNotMatch(adminSource, /localStorage/);
  assert.match(adminSource, /sessionStorage/);
  assert.match(adminSource, /ADMIN_SESSION_STORAGE_KEY/);
  assert.match(adminSource, /adminRuntimeCredential = null/);
  assert.match(adminSource, /els\.adminPinInput\.value = ""/);
});
