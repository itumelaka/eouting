const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  GROUP_HEADERS,
  INSTITUTION_HEADERS,
  configuredSheets,
  createRuntime,
  groupRow,
  institutionRow,
  studentRow
} = require("./support/student-group-config-runtime");

const root = path.join(__dirname, "..");
const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function plain(value) { return JSON.parse(JSON.stringify(value)); }

test("flag false returns the legacy A2/A3/LI login directory", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A2-001", kelas: "A2" }),
    studentRow({ student_id: "A3-001", kelas: "A3" }),
    studentRow({ student_id: "LI-001", kelas: "LI", institution_code: "UMK" })
  ]);
  const { context } = createRuntime({ sheets });
  const result = context.getStudentLoginDirectory();
  assert.equal(result.mode, "legacy");
  assert.deepEqual(Array.from(result.groups, (group) => group.key), ["A2", "A3", "LI"]);
});

test("ready enabled config builds minimal active non-empty groups in deterministic order", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A2-001", kelas: "A2" }),
    studentRow({ student_id: "A3-INACTIVE", kelas: "A3", status: "TIDAK AKTIF" }),
    studentRow({ student_id: "ANY-UMK", kelas: "LI", institution_code: "UMK" }),
    studentRow({ student_id: "ANY-UPM", kelas: "LI", institution_code: "UPM" })
  ]);
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = plain(context.getStudentLoginDirectory());
  assert.equal(result.mode, "dynamic");
  assert.deepEqual(result.groups.map((group) => group.label), ["A2", "LI UMK", "LI UPM"]);
  assert.deepEqual(result.groups.map((group) => group.key), ["GROUP:A2", "GROUP:LI:UMK", "GROUP:LI:UPM"]);
  assert.equal(result.groups.some((group) => group.label === "A3"), false);
  result.groups.forEach((group) => group.students.forEach((student) => {
    assert.deepEqual(Object.keys(student).sort(), ["nama", "student_id"]);
  }));
  assert.equal(JSON.stringify(result).includes("no_matrik"), false);
  assert.equal(JSON.stringify(result).includes("institution_code"), false);
  assert.equal(JSON.stringify(result).includes("status"), false);
});

test("future A4 and institution configs appear automatically only when represented", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A4-001", kelas: "A4" }),
    studentRow({ student_id: "LI-CUSTOM-001", kelas: "LI", institution_code: "IMU" })
  ]);
  sheets.STUDENT_GROUPS.rows.push(groupRow("A4", { display_name: "Aras 4", sort_order: 25 }));
  sheets.LI_INSTITUTIONS.rows.push(institutionRow("IMU", { display_name: "IMU", sort_order: 30 }));
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = plain(context.getStudentLoginDirectory());
  assert.deepEqual(result.groups.map((group) => group.label), ["Aras 4", "LI IMU"]);
  assert.equal(result.groups.some((group) => group.label === "A2"), false);
  assert.equal(result.groups.some((group) => group.label === "LI UMK"), false);
});

test("institution_code is authoritative and student ID prefixes are ignored at runtime", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "LIUMK-HISTORICAL", kelas: "LI", institution_code: "UPM" }),
    studentRow({ student_id: "LIUPM-HISTORICAL", kelas: "LI", institution_code: "UMK" })
  ]);
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = plain(context.getStudentLoginDirectory());
  assert.equal(result.groups.find((group) => group.key === "GROUP:LI:UMK").students[0].student_id, "LIUPM-HISTORICAL");
  assert.equal(result.groups.find((group) => group.key === "GROUP:LI:UPM").students[0].student_id, "LIUMK-HISTORICAL");
  const builder = gas.slice(gas.indexOf("function buildDynamicStudentLoginDirectoryV240_"), gas.indexOf("function compareStudentLoginConfigV240_"));
  assert.doesNotMatch(builder, /LIUMK-|LIUPM-/);
});

test("invalid enabled configuration falls back safely to legacy mode", () => {
  const sheets = configuredSheets([studentRow({ student_id: "A2-001", kelas: "A2" })]);
  sheets.STUDENT_GROUPS.rows.push(groupRow("A2"));
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = context.getStudentLoginDirectory();
  assert.equal(result.mode, "legacy");
  assert.equal(result.fallback, true);
  assert.equal(result.groups[0].students[0].student_id, "A2-001");
});

test("public route is dedicated and login authentication ignores forged presentation fields", () => {
  const sheets = configuredSheets([studentRow({ student_id: "A2-001", no_matrik: "001", kelas: "A2" })]);
  const { context } = createRuntime({ sheets });
  const authenticated = context.loginStudent({
    student_id: "A2-001",
    no_matrik: "001",
    kelas: "LI",
    group_code: "LI",
    institution_code: "UPM",
    login_group: "GROUP:LI:UPM"
  });
  assert.equal(authenticated.kelas, "A2");
  assert.equal(Object.prototype.hasOwnProperty.call(authenticated, "institution_code"), false);
  const doGet = gas.slice(gas.indexOf("function doGet"), gas.indexOf("function doPost"));
  assert.match(doGet, /getStudentLoginDirectory/);
});

test("guarded activation requires Admin, confirmation and full readiness", () => {
  const readySheets = configuredSheets([studentRow({ student_id: "LI-CUSTOM", kelas: "LI", institution_code: "UMK" })]);
  const readyRuntime = createRuntime({ sheets: readySheets });
  assert.throws(() => readyRuntime.context.setStudentGroupConfigEnabled({ enabled: true, confirm_enable: true }), /Admin|PIN/i);
  assert.throws(() => readyRuntime.context.setStudentGroupConfigEnabled({ admin_id: "ADM-001", pin: "2468", enabled: true }), /confirm_enable/i);

  const blockedSheets = configuredSheets([studentRow({ student_id: "LI-MISSING", kelas: "LI", institution_code: "" })]);
  const blockedRuntime = createRuntime({ sheets: blockedSheets });
  assert.throws(() => blockedRuntime.context.setStudentGroupConfigEnabled({
    admin_id: "ADM-001", pin: "2468", enabled: true, confirm_enable: true
  }), /readiness/i);
  assert.equal(blockedRuntime.propertyValues.STUDENT_GROUP_CONFIG_ENABLED, undefined);
});

test("activation and rollback toggle only the guarded flag, lock, audit and invalidate caches", () => {
  const sheets = configuredSheets([studentRow({ student_id: "LI-CUSTOM", kelas: "LI", institution_code: "UMK" })]);
  const runtime = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "false" } });
  const credential = { admin_id: "ADM-001", pin: "2468", confirm_enable: true };
  const enabled = runtime.context.setStudentGroupConfigEnabled({ ...credential, enabled: true });
  assert.equal(enabled.enabled, true);
  assert.equal(runtime.propertyValues.STUDENT_GROUP_CONFIG_ENABLED, "true");
  assert.equal(runtime.getLockCount(), 1);
  assert.ok(runtime.propertyValues.EOUTING_CACHE_GENERATION_STUDENTLOGINDIRECTORYV240);
  const disabled = runtime.context.setStudentGroupConfigEnabled({ admin_id: "ADM-001", pin: "2468", enabled: false });
  assert.equal(disabled.enabled, false);
  assert.equal(runtime.propertyValues.STUDENT_GROUP_CONFIG_ENABLED, "false");
  assert.equal(runtime.getLockCount(), 2);
  const auditText = JSON.stringify(sheets.AUDIT_LOG.rows);
  assert.match(auditText, /ENABLE_STUDENT_GROUP_CONFIG_V240/);
  assert.match(auditText, /DISABLE_STUDENT_GROUP_CONFIG_V240/);
  assert.equal(auditText.includes("2468"), false);
  assert.equal(typeof runtime.context.setScriptProperty, "undefined");
});

test("Student, config, migration and flag changes invalidate the dynamic directory cache", () => {
  assert.match(gas, /function invalidateStudentDirectoryCache_[\s\S]*invalidateStudentLoginDirectoryCacheV240_/);
  assert.match(gas, /function invalidateStudentGroupConfigCacheV240_[\s\S]*invalidateStudentLoginDirectoryCacheV240_/);
  const migrationApply = gas.slice(gas.indexOf("function migrateStudentInstitutionCodesCoreV240_"), gas.indexOf("function verifyStudentInstitutionMigrationV240_"));
  assert.match(migrationApply, /invalidateStudentLoginDirectoryCacheV240_/);
  const activation = gas.slice(gas.indexOf("function setStudentGroupConfigEnabled"), gas.indexOf("function getSheetHeadersV240_"));
  assert.match(activation, /invalidateStudentGroupConfigCacheV240_/);
});

test("frontend dynamically renders wrapped groups while sending only canonical login credentials", () => {
  assert.match(app, /getStudentLoginDirectory/);
  assert.match(app, /studentLoginDirectoryV240\.mode === "dynamic" \? "Pilih Kumpulan" : "Pilih Kelas"/);
  assert.match(app, /data-student-login-group/);
  const loginHandler = app.slice(app.indexOf("async function handleStudentLoginSubmitV211"), app.indexOf("els.studentLoginPanel.addEventListener"));
  assert.match(loginHandler, /student_id:/);
  assert.match(loginHandler, /no_matrik:/);
  assert.doesNotMatch(loginHandler, /loginGroupKey|group_code|institution_code|kelas:/);
  const pillCss = css.slice(css.indexOf(".student-class-pills"), css.indexOf(".student-class-pill {"));
  assert.match(pillCss, /flex-wrap:\s*wrap/);
  assert.match(pillCss, /max-width:\s*100%/);
});

test("Admin UI exposes acknowledged enable and immediate legacy rollback only", () => {
  const panel = html.slice(html.indexOf('id="adminStudentConfigStatus"'), html.indexOf('id="adminStudentPeoplePanel"'));
  assert.match(panel, /adminDynamicLoginStatus/);
  assert.match(panel, /adminDynamicLoginConfirmInput[^>]*disabled/);
  assert.match(panel, /adminDynamicLoginEnableButton[^>]*disabled/);
  assert.match(panel, /adminDynamicLoginDisableButton[^>]*hidden/);
  assert.doesNotMatch(panel, /STUDENT_GROUP_CONFIG_ENABLED|Script Property/);
  assert.match(app, /await refreshAdminStudentReadinessV240\(\)/);
});

test("remember-device schema and restored canonical Student session remain compatible", () => {
  const saveSession = app.slice(app.indexOf("function saveSession"), app.indexOf("function getSavedSession"));
  assert.match(saveSession, /session\.student_id/);
  assert.match(saveSession, /session\.no_matrik/);
  assert.match(saveSession, /session\.kelas/);
  assert.doesNotMatch(saveSession, /loginGroupKey/);
  assert.match(app, /function findStudentForSavedSession/);
});

test("Phase D keeps version.json stable and advances only runtime cache references", () => {
  const version = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8"));
  const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
  assert.equal(version.version, "2.4.0");
  assert.match(html, /2\.4\.0-r11/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r11/);
});
