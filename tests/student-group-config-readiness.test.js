const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FakeSheet,
  GROUP_HEADERS,
  INSTITUTION_HEADERS,
  STUDENT_HEADERS_V240,
  configuredSheets,
  createRuntime,
  groupRow,
  institutionRow,
  studentRow
} = require("./support/student-group-config-runtime");

function codes(list) { return Array.from(list, (entry) => entry.code); }

test("flag false reports migration-needed while preserving legacy-safe readiness", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A2-001", kelas: "A2" }),
    studentRow({ student_id: "LIUMK-001", kelas: "LI", institution_code: "" })
  ]);
  const { context } = createRuntime({ sheets });
  const result = context.assessStudentGroupConfigReadinessV240_();

  assert.equal(result.enabled, false);
  assert.equal(result.mode, "LEGACY_SAFE");
  assert.equal(result.foundation_ready, true);
  assert.equal(result.migration_ready, false);
  assert.equal(result.migration_needed, true);
  assert.equal(result.ready, true);
  assert.match(codes(result.migration_issues).join(","), /LI_STUDENTS_MISSING_OR_INVALID_INSTITUTION/);
});

test("readiness detects missing sheets, header, and required seeds without creating sheets", () => {
  const students = new FakeSheet("STUDENTS", [STUDENT_HEADERS_V240.slice(0, -1)]);
  const groups = new FakeSheet("STUDENT_GROUPS", [GROUP_HEADERS, groupRow("A2")]);
  const { context, sheetMap } = createRuntime({ sheets: { STUDENTS: students, STUDENT_GROUPS: groups } });
  const result = context.assessStudentGroupConfigReadinessV240_();
  const issueCodes = codes(result.issues);

  assert.equal(result.ready, false);
  assert.match(issueCodes.join(","), /MISSING_LI_INSTITUTIONS_SHEET/);
  assert.match(issueCodes.join(","), /MISSING_STUDENTS_INSTITUTION_CODE_HEADER/);
  assert.match(issueCodes.join(","), /MISSING_REQUIRED_GROUP_A3/);
  assert.match(issueCodes.join(","), /MISSING_REQUIRED_GROUP_LI/);
  assert.equal(sheetMap.has("LI_INSTITUTIONS"), false);
});

test("duplicate codes and malformed config records fail readiness", () => {
  const sheets = configuredSheets();
  sheets.STUDENT_GROUPS.rows.push(groupRow("A2"));
  sheets.LI_INSTITUTIONS.rows.push(institutionRow("UPM", { sort_order: 0 }));
  const { context } = createRuntime({ sheets });
  const result = context.assessStudentGroupConfigReadinessV240_();

  assert.equal(result.ready, false);
  assert.equal(result.counts.duplicate_group_codes, 1);
  assert.equal(result.counts.invalid_institution_records, 1);
  assert.match(codes(result.issues).join(","), /DUPLICATE_STUDENT_GROUP_CODES/);
  assert.match(codes(result.issues).join(","), /INVALID_LI_INSTITUTION_RECORDS/);
});

test("invalid Student group reference is always a foundation failure", () => {
  const sheets = configuredSheets([studentRow({ student_id: "A4-001", kelas: "A4" })]);
  const { context } = createRuntime({ sheets });
  const result = context.assessStudentGroupConfigReadinessV240_();
  assert.equal(result.ready, false);
  assert.equal(result.counts.students_with_invalid_group, 1);
  assert.match(codes(result.issues).join(","), /STUDENTS_WITH_INVALID_GROUP/);
});

test("enabled flag blocks LI without institution and non-LI with institution", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "LIUMK-001", kelas: "LI", institution_code: "" }),
    studentRow({ student_id: "A2-001", kelas: "A2", institution_code: "UMK" })
  ]);
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = context.assessStudentGroupConfigReadinessV240_();

  assert.equal(result.enabled, true);
  assert.equal(result.ready, false);
  assert.equal(result.counts.li_students_missing_or_invalid_institution, 1);
  assert.equal(result.counts.non_li_students_with_institution, 1);
  assert.match(codes(result.migration_issues).join(","), /LI_STUDENTS_MISSING_OR_INVALID_INSTITUTION/);
  assert.match(codes(result.migration_issues).join(","), /NON_LI_STUDENTS_WITH_INSTITUTION/);
});

test("enabled flag detects active references to inactive group and institution", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A2-001", kelas: "A2" }),
    studentRow({ student_id: "LIUMK-001", kelas: "LI", institution_code: "UMK" })
  ]);
  sheets.STUDENT_GROUPS = new FakeSheet("STUDENT_GROUPS", [
    GROUP_HEADERS, groupRow("A2", { active: false }), groupRow("A3"), groupRow("LI")
  ]);
  sheets.LI_INSTITUTIONS = new FakeSheet("LI_INSTITUTIONS", [
    INSTITUTION_HEADERS, institutionRow("UMK", { active: false }), institutionRow("UPM")
  ]);
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = context.assessStudentGroupConfigReadinessV240_();

  assert.equal(result.counts.active_students_with_inactive_or_missing_group, 1);
  assert.equal(result.counts.active_li_students_with_inactive_or_missing_institution, 1);
  assert.match(codes(result.migration_issues).join(","), /ACTIVE_STUDENTS_WITH_INACTIVE_OR_MISSING_GROUP/);
  assert.match(codes(result.migration_issues).join(","), /ACTIVE_LI_STUDENTS_WITH_INACTIVE_OR_MISSING_INSTITUTION/);
});

test("inactive legacy LI rows still require migration data but do not trigger active-reference issue", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "LIUPM-OLD", kelas: "LI", status: "TIDAK AKTIF", institution_code: "" })
  ]);
  const { context } = createRuntime({ sheets, properties: { STUDENT_GROUP_CONFIG_ENABLED: "true" } });
  const result = context.assessStudentGroupConfigReadinessV240_();
  assert.equal(result.counts.li_students_missing_or_invalid_institution, 1);
  assert.equal(result.counts.active_li_students_with_inactive_or_missing_institution, 0);
});

test("Admin readiness endpoint authenticates and exposes aggregate diagnostics only", () => {
  const sheets = configuredSheets([studentRow({ student_id: "PRIVATE-ID", kelas: "A2", no_matrik: "PRIVATE-MATRIC" })]);
  const { context } = createRuntime({ sheets });
  assert.throws(() => context.getStudentGroupConfigReadiness({}), /Admin|PIN/i);
  const result = context.getStudentGroupConfigReadiness({ admin_id: "ADM-001", pin: "2468" });
  const serialized = JSON.stringify(result);
  assert.equal(result.ready, true);
  assert.equal(serialized.includes("PRIVATE-ID"), false);
  assert.equal(serialized.includes("PRIVATE-MATRIC"), false);
  assert.equal(serialized.includes("created_by"), false);
  assert.equal(serialized.includes("config_version"), false);
});
