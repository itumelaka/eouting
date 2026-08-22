const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  FakeSheet,
  GROUP_HEADERS,
  INSTITUTION_HEADERS,
  STUDENT_HEADERS,
  createRuntime,
  groupRow
} = require("./support/student-group-config-runtime");

function objects(sheet) {
  const [headers, ...rows] = sheet.rows;
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

test("setup creates both config sheets, appends institution_code, and defaults flag false", () => {
  const students = new FakeSheet("STUDENTS", [STUDENT_HEADERS, ["A2-001", "001", "Nama"]]);
  const runtime = createRuntime({ sheets: { STUDENTS: students } });
  const result = runtime.context.setupStudentGroupConfigV240();

  assert.deepEqual(runtime.sheetMap.get("STUDENT_GROUPS").rows[0], GROUP_HEADERS);
  assert.deepEqual(runtime.sheetMap.get("LI_INSTITUTIONS").rows[0], INSTITUTION_HEADERS);
  assert.deepEqual(students.rows[0].slice(0, STUDENT_HEADERS.length), STUDENT_HEADERS);
  assert.equal(students.rows[0].at(-1), "institution_code");
  assert.equal(students.rows[1][0], "A2-001");
  assert.equal(runtime.propertyValues.STUDENT_GROUP_CONFIG_ENABLED, "false");
  assert.equal(result.student_group_config_enabled, false);
});

test("setup seeds A2/A3/LI and UMK/UPM once with deterministic sort orders", () => {
  const runtime = createRuntime();
  const first = runtime.context.setupStudentGroupConfigV240();
  const second = runtime.context.setupStudentGroupConfigV240();
  const groups = objects(runtime.sheetMap.get("STUDENT_GROUPS"));
  const institutions = objects(runtime.sheetMap.get("LI_INSTITUTIONS"));

  assert.deepEqual(Array.from(first.created_group_codes), ["A2", "A3", "LI"]);
  assert.deepEqual(Array.from(first.created_institution_codes), ["UMK", "UPM"]);
  assert.deepEqual(Array.from(second.created_group_codes), []);
  assert.deepEqual(Array.from(second.created_institution_codes), []);
  assert.deepEqual(groups.map((row) => [row.group_code, row.sort_order]), [["A2", 10], ["A3", 20], ["LI", 30]]);
  assert.deepEqual(institutions.map((row) => [row.institution_code, row.sort_order]), [["UMK", 10], ["UPM", 20]]);
  assert.equal(groups.find((row) => row.group_code === "LI").institution_required, true);
});

test("setup preserves existing rows and never overwrites existing config", () => {
  const customA2 = groupRow("A2", { display_name: "Kumpulan A2 Khas", active: false, sort_order: 99 });
  const runtime = createRuntime({
    sheets: { STUDENT_GROUPS: new FakeSheet("STUDENT_GROUPS", [GROUP_HEADERS, customA2]) },
    properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" }
  });
  runtime.context.setupStudentGroupConfigV240();
  const groups = objects(runtime.sheetMap.get("STUDENT_GROUPS"));
  const a2 = groups.find((row) => row.group_code === "A2");

  assert.equal(a2.display_name, "Kumpulan A2 Khas");
  assert.equal(a2.active, false);
  assert.equal(a2.sort_order, 99);
  assert.equal(groups.filter((row) => row.group_code === "A2").length, 1);
  assert.equal(runtime.propertyValues.STUDENT_GROUP_CONFIG_ENABLED, "true");
});

test("code normalization accepts rollout-safe codes and rejects unsafe punctuation", () => {
  const { context } = createRuntime();
  ["A2", "A3", "A4", "LI", "UMK", "UPM", "IMU", "UTEM", "group_01"].forEach((code) => {
    assert.match(context.normalizeStudentConfigCodeV240_(code, "code"), /^[A-Z][A-Z0-9_]+$/);
  });
  ["", "A", "A-2", "LI UMK", "../UMK", "@UPM"].forEach((code) => {
    assert.throws(() => context.normalizeStudentConfigCodeV240_(code, "code"), /code|aksara/i);
  });
});

test("record validators enforce booleans, positive sort order, config version, and display text", () => {
  const { context } = createRuntime();
  const validGroup = { group_code: "A4", display_name: "Aras 4", institution_required: false, active: true, sort_order: 40, config_version: 1 };
  const validInstitution = { institution_code: "IMU", display_name: "International Medical University", active: true, sort_order: 30, config_version: 2 };
  assert.equal(context.validateStudentGroupConfigRecordV240_(validGroup).group_code, "A4");
  assert.equal(context.validateLiInstitutionConfigRecordV240_(validInstitution).institution_code, "IMU");
  assert.throws(() => context.validateStudentGroupConfigRecordV240_({ ...validGroup, active: "maybe" }), /boolean/i);
  assert.throws(() => context.validateStudentGroupConfigRecordV240_({ ...validGroup, institution_required: "maybe" }), /boolean/i);
  assert.throws(() => context.validateStudentGroupConfigRecordV240_({ ...validGroup, sort_order: 0 }), /sort_order/i);
  assert.throws(() => context.validateStudentGroupConfigRecordV240_({ ...validGroup, config_version: 1.5 }), /config_version/i);
  assert.throws(() => context.validateLiInstitutionConfigRecordV240_({ ...validInstitution, display_name: "" }), /display_name/i);
});

test("lookup, immutable-code, active-state, and deterministic sort helpers are canonical", () => {
  const { context } = createRuntime();
  const rows = [
    { group_code: "LI", display_name: "LI", sort_order: 30, active: true },
    { group_code: "A3", display_name: "A3", sort_order: 20, active: false },
    { group_code: "A2", display_name: "A2", sort_order: 10, active: true }
  ];
  assert.equal(context.findStudentGroupConfigByCodeV240_(rows, " a2 ").group_code, "A2");
  assert.equal(context.isStudentConfigRecordActiveV240_(rows[0]), true);
  assert.equal(context.isStudentGroupConfigActiveV240_(rows[1]), false);
  assert.equal(context.isLiInstitutionConfigActiveV240_({ active: true }), true);
  assert.deepEqual(context.sortStudentConfigRowsV240_(rows, "group_code").map((row) => row.group_code).slice(), ["A2", "A3", "LI"]);
  assert.equal(context.assertStudentConfigCodeImmutableV240_("a2", " A2 ", "group_code"), "A2");
  assert.throws(() => context.assertStudentConfigCodeImmutableV240_("A2", "A3", "group_code"), /tidak boleh diubah/i);
});

test("deactivation guards count only active references and expose no delete mutation", () => {
  const { context } = createRuntime();
  const students = [
    { kelas: "A2", status: "AKTIF", institution_code: "" },
    { kelas: "A2", status: "TIDAK AKTIF", institution_code: "" },
    { kelas: "LI", status: "AKTIF", institution_code: "UMK" },
    { kelas: "LI", status: "TIDAK AKTIF", institution_code: "UMK" }
  ];
  assert.equal(context.countActiveStudentsReferencingGroupV240_("A2", students), 1);
  assert.equal(context.countActiveLiStudentsReferencingInstitutionV240_("UMK", students), 1);
  assert.throws(() => context.assertStudentGroupCanDeactivateV240_("A2", students), /1 pelajar aktif/i);
  assert.throws(() => context.assertLiInstitutionCanDeactivateV240_("UMK", students), /1 pelajar LI aktif/i);
  assert.equal(context.assertStudentGroupCanDeactivateV240_("A3", students), true);
  assert.equal(typeof context.deleteStudentGroup, "undefined");
});

test("Phase A adds no frontend dependency and does not register migration as an HTTP action", () => {
  const root = path.join(__dirname, "..");
  const frontend = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
  const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
  const doPostBody = gas.slice(gas.indexOf("function doPost"), gas.indexOf("function setupDatabase"));
  assert.equal(frontend.includes("STUDENT_GROUP_CONFIG_ENABLED"), false);
  assert.equal(frontend.includes("STUDENT_GROUPS"), false);
  assert.equal(doPostBody.includes("migrateStudentInstitutionCodesV240"), false);
  assert.equal(doPostBody.includes("getStudentGroupConfigReadiness"), true);
});
