const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  FakeSheet,
  STUDENT_HEADERS,
  STUDENT_HEADERS_V240,
  configuredSheets,
  createRuntime,
  studentRow
} = require("./support/student-group-config-runtime");

const root = path.join(__dirname, "..");

test("setup reports created sheets, headers, seeds and a newly false flag", () => {
  const students = new FakeSheet("STUDENTS", [STUDENT_HEADERS, studentRow().slice(0, -1)]);
  const { context } = createRuntime({ sheets: { STUDENTS: students } });
  const result = context.setupStudentGroupConfigV240();

  assert.deepEqual(Array.from(result.sheets_created), ["STUDENT_GROUPS", "LI_INSTITUTIONS"]);
  assert.deepEqual(Array.from(result.headers_added.STUDENTS), ["institution_code"]);
  assert.deepEqual(Array.from(result.seeds_added.student_groups), ["A2", "A3", "LI"]);
  assert.deepEqual(Array.from(result.seeds_added.li_institutions), ["UMK", "UPM"]);
  assert.equal(result.flag_created_as_false, true);
  assert.equal(result.flag_existing_value, null);
  assert.equal(result.flag_effective_value, "false");
  assert.equal(result.students_rows_untouched, true);
  assert.equal(result.migration_run, false);
});

test("repeated setup is idempotent and preserves an existing true or false flag", () => {
  for (const flag of ["true", "false"]) {
    const sheets = configuredSheets([studentRow({ student_id: "LIUMK-001", kelas: "LI" })]);
    const before = JSON.stringify(sheets.STUDENTS.rows);
    const { context, propertyValues } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: flag } });
    const first = context.setupStudentGroupConfigV240();
    const second = context.setupStudentGroupConfigV240();
    assert.equal(first.flag_created_as_false, false);
    assert.equal(first.flag_existing_value, flag);
    assert.deepEqual(Array.from(second.sheets_created), []);
    assert.deepEqual(Array.from(second.seeds_added.student_groups), []);
    assert.equal(propertyValues.STUDENT_GROUP_CONFIG_ENABLED, flag);
    assert.equal(JSON.stringify(sheets.STUDENTS.rows), before);
  }
});

test("migration verification checks missing, invalid, non-LI and known-prefix conflicts", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "LIUMK-001", kelas: "LI", institution_code: "" }),
    studentRow({ student_id: "LIUPM-002", kelas: "LI", institution_code: "XYZ" }),
    studentRow({ student_id: "LIUMK-003", kelas: "LI", institution_code: "UPM" }),
    studentRow({ student_id: "A2-001", kelas: "A2", institution_code: "UMK" })
  ]);
  const { context } = createRuntime({ sheets });
  const result = context.verifyStudentInstitutionMigrationV240_();
  assert.equal(result.verified, false);
  assert.equal(result.counts.li_missing_institution, 1);
  assert.equal(result.counts.li_invalid_institution, 1);
  assert.equal(result.counts.non_li_with_institution, 1);
  assert.equal(result.counts.legacy_mapping_conflicts, 2);
  const dryRun = context.runStudentInstitutionMigration({ admin_id: "ADM-001", pin: "2468", mode: "dry-run", dryRun: true });
  assert.equal(dryRun.can_apply, false);
  assert.equal(context.assessStudentGroupConfigReadinessV240_().operational_state, "MIGRATION_BLOCKED");
});

test("readiness exposes setup-required, migration-required, blocked and ready states", () => {
  const missing = createRuntime().context.assessStudentGroupConfigReadinessV240_();
  assert.equal(missing.operational_state, "SETUP_REQUIRED");

  const requiredRuntime = createRuntime({ sheets: configuredSheets([
    studentRow({ student_id: "LIUMK-001", kelas: "LI" })
  ]) });
  assert.equal(requiredRuntime.context.assessStudentGroupConfigReadinessV240_().operational_state, "MIGRATION_REQUIRED");

  const blockedRuntime = createRuntime({ sheets: configuredSheets([
    studentRow({ student_id: "LIUNKNOWN-001", kelas: "LI" })
  ]) });
  assert.equal(blockedRuntime.context.assessStudentGroupConfigReadinessV240_().operational_state, "MIGRATION_BLOCKED");

  const readyRuntime = createRuntime({ sheets: configuredSheets([
    studentRow({ student_id: "LIUMK-001", kelas: "LI", institution_code: "UMK" })
  ]) });
  const ready = readyRuntime.context.assessStudentGroupConfigReadinessV240_();
  assert.equal(ready.admin_config_state, "READY_FOR_ADMIN_CONFIG");
  assert.equal(ready.operational_state, "READY_FOR_DYNAMIC_LOGIN");
});

test("enabled mode treats institution_code as authoritative after migration", () => {
  const runtime = createRuntime({
    sheets: configuredSheets([
      studentRow({ student_id: "LIUMK-HISTORICAL", kelas: "LI", institution_code: "UPM" }),
      studentRow({ student_id: "LI-CUSTOM", kelas: "LI", institution_code: "UMK" })
    ]),
    properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" }
  });
  const result = runtime.context.assessStudentGroupConfigReadinessV240_();
  assert.equal(result.mode, "CONFIG_ENABLED");
  assert.equal(result.operational_state, "READY_FOR_DYNAMIC_LOGIN");
  assert.equal(result.ready_for_dynamic_login, true);
});

test("future enablement guard requires authoritative assignment readiness, not historical prefix consistency", () => {
  const blocked = createRuntime({ sheets: configuredSheets([
    studentRow({ student_id: "LIUPM-001", kelas: "LI", institution_code: "" })
  ]) });
  assert.equal(blocked.context.canEnableStudentGroupConfigV240_(), false);
  const ready = createRuntime({ sheets: configuredSheets([
    studentRow({ student_id: "LIUPM-001", kelas: "LI", institution_code: "UMK" })
  ]) });
  assert.equal(ready.context.canEnableStudentGroupConfigV240_(), true);
});

test("authenticated dry-run counts UMK/UPM, returns aggregates and never writes", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "LIUMK-PRIVATE", no_matrik: "PRIVATE-MATRIC", kelas: "LI" }),
    studentRow({ student_id: "LIUPM-PRIVATE", no_matrik: "PRIVATE-MATRIC-2", kelas: "LI" })
  ]);
  const before = JSON.stringify(sheets.STUDENTS.rows);
  const { context, getLockCount } = createRuntime({ sheets });
  assert.throws(() => context.runStudentInstitutionMigration({ mode: "dry-run", dryRun: true }), /Admin|PIN/i);
  const result = context.runStudentInstitutionMigration({ admin_id: "ADM-001", pin: "2468", mode: "dry-run", dryRun: true });
  assert.equal(result.can_apply, true);
  assert.equal(result.rows_proposed, 2);
  assert.equal(result.rows_written, 0);
  assert.equal(result.applied, 0);
  assert.deepEqual({ ...result.proposed_by_institution }, { UMK: 1, UPM: 1 });
  assert.equal(getLockCount(), 0);
  assert.equal(JSON.stringify(sheets.STUDENTS.rows), before);
  assert.equal(JSON.stringify(result).includes("PRIVATE"), false);
});

test("apply rejects missing explicit acknowledgement and dryRun=false", () => {
  const sheets = configuredSheets([studentRow({ student_id: "LIUMK-001", kelas: "LI" })]);
  const { context, getLockCount } = createRuntime({ sheets });
  const credential = { admin_id: "ADM-001", pin: "2468", mode: "apply" };
  assert.throws(() => context.runStudentInstitutionMigration({ ...credential, dryRun: false }), /confirm_apply/i);
  assert.throws(() => context.runStudentInstitutionMigration({ ...credential, confirm_apply: true }), /dryRun=false/i);
  assert.equal(getLockCount(), 0);
});

test("apply rejects an incomplete foundation before any migration write", () => {
  const sheets = configuredSheets([studentRow({ student_id: "LIUMK-001", kelas: "LI" })]);
  delete sheets.STUDENT_GROUPS;
  const before = JSON.stringify(sheets.STUDENTS.rows);
  const { context } = createRuntime({ sheets });
  assert.throws(() => context.runStudentInstitutionMigration({
    admin_id: "ADM-001", pin: "2468", mode: "apply", dryRun: false, confirm_apply: true
  }), /setup|belum lengkap/i);
  assert.equal(JSON.stringify(sheets.STUDENTS.rows), before);
});

test("guarded apply independently blocks unmatched and conflict cases", () => {
  const cases = [
    [studentRow({ student_id: "LIUNKNOWN-002", kelas: "LI" })],
    [studentRow({ student_id: "LIUPM-003", kelas: "LI", institution_code: "UMK" })]
  ];
  cases.forEach((rows) => {
    const sheets = configuredSheets(rows);
    const before = JSON.stringify(sheets.STUDENTS.rows);
    const { context, getLockCount } = createRuntime({ sheets });
    assert.throws(() => context.runStudentInstitutionMigration({
      admin_id: "ADM-001", pin: "2468", mode: "apply", dryRun: false, confirm_apply: true
    }), /tidak sepadan|konflik/i);
    assert.equal(getLockCount(), 1);
    assert.equal(JSON.stringify(sheets.STUDENTS.rows), before);
  });
});

test("guarded apply locks, writes safe rows, audits a summary and verifies", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "LIUMK-001", kelas: "LI" }),
    studentRow({ student_id: "LIUPM-002", kelas: "LI", status: "TIDAK AKTIF" })
  ]);
  const { context, getLockCount } = createRuntime({ sheets });
  const result = context.runStudentInstitutionMigration({
    admin_id: "ADM-001", pin: "2468", mode: "apply", dryRun: false, confirm_apply: true
  });
  assert.equal(getLockCount(), 1);
  assert.equal(result.lock_acquired, true);
  assert.equal(result.rows_proposed, 2);
  assert.equal(result.rows_written, 2);
  assert.equal(result.audit_logged, true);
  assert.equal(result.verification.verified, true);
  const audit = JSON.stringify(sheets.AUDIT_LOG.rows[1]);
  assert.match(audit, /MIGRATE_STUDENT_INSTITUTION_CODES_V240/);
  assert.equal(audit.includes("LIUMK-001"), false);
});

test("repeated guarded apply is idempotent and does not create a second audit row", () => {
  const sheets = configuredSheets([studentRow({ student_id: "LIUMK-001", kelas: "LI" })]);
  const { context } = createRuntime({ sheets });
  const payload = { admin_id: "ADM-001", pin: "2468", mode: "apply", dryRun: false, confirm_apply: true };
  const first = context.runStudentInstitutionMigration(payload);
  const afterFirst = JSON.stringify(sheets.STUDENTS.rows);
  const second = context.runStudentInstitutionMigration(payload);
  assert.equal(first.rows_written, 1);
  assert.equal(second.rows_written, 0);
  assert.equal(second.rows_existing, 1);
  assert.equal(second.audit_logged, false);
  assert.equal(JSON.stringify(sheets.STUDENTS.rows), afterFirst);
  assert.equal(sheets.AUDIT_LOG.rows.length, 2);
});

test("Admin maintenance UI keeps Phase C migration guards without arbitrary property controls", () => {
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
  assert.match(html, /adminStudentReadinessRefreshButton/);
  assert.match(html, /adminStudentMigrationDryRunButton/);
  assert.match(html, /adminStudentMigrationConfirmInput[^>]*disabled/);
  assert.match(html, /adminStudentMigrationApplyButton[^>]*disabled/);
  assert.match(app, /confirm_apply:\s*true/);
  assert.doesNotMatch(html, /Script Property|STUDENT_GROUP_CONFIG_ENABLED/);
});

test("rollback remains non-destructive: false flag and legacy path, with no cleanup helper", () => {
  const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
  assert.match(gas, /mode:\s*enabled \? "CONFIG_ENABLED" : "LEGACY_SAFE"/);
  assert.match(gas, /rollback remains the existing false flag/i);
  assert.doesNotMatch(gas, /function\s+(delete|rollback|cleanup)Student(Group|Institution)/i);
});
