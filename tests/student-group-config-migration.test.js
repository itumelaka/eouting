const assert = require("node:assert/strict");
const test = require("node:test");
const {
  FakeSheet,
  STUDENT_HEADERS,
  STUDENT_HEADERS_V240,
  configuredSheets,
  createRuntime,
  studentRow
} = require("./support/student-group-config-runtime");

function migrationRows() {
  return [
    studentRow({ student_id: "A2-001", no_matrik: "M-A2", kelas: "A2" }),
    studentRow({ student_id: " liumk-001 ", no_matrik: "M-UMK", kelas: "LI" }),
    studentRow({ student_id: "LIUPM-002", no_matrik: "M-UPM", kelas: "LI", status: "TIDAK AKTIF" }),
    studentRow({ student_id: "LIXYZ-003", no_matrik: "M-UNKNOWN", kelas: "LI" }),
    studentRow({ student_id: "LIUMK-004", no_matrik: "M-MATCH", kelas: "LI", institution_code: "umk" }),
    studentRow({ student_id: "LIUPM-005", no_matrik: "M-CONFLICT", kelas: "LI", institution_code: "UMK" })
  ];
}

test("migration defaults to dry-run, proposes explicit prefixes, and writes nothing", () => {
  const sheets = configuredSheets(migrationRows());
  const before = JSON.stringify(sheets.STUDENTS.rows);
  const { context, getLockCount } = createRuntime({ sheets });
  const result = context.migrateStudentInstitutionCodesV240();

  assert.equal(result.dry_run, true);
  assert.equal(result.total_rows, 6);
  assert.equal(result.total_li, 5);
  assert.equal(result.matched_blank, 2);
  assert.equal(result.already_populated, 1);
  assert.equal(result.applied, 0);
  assert.equal(result.unmatched, 1);
  assert.equal(result.conflicts, 1);
  assert.equal(result.skipped_non_li, 1);
  assert.deepEqual({ ...result.proposed_by_institution }, { UMK: 2, UPM: 2 });
  assert.deepEqual(Array.from(result.unmatched_row_numbers), [5]);
  assert.deepEqual(Array.from(result.conflict_row_numbers), [7]);
  assert.equal(JSON.stringify(sheets.STUDENTS.rows), before);
  assert.equal(getLockCount(), 0);
});

test("apply uses ScriptLock and writes only safe blank matches, including inactive LI", () => {
  const sheets = configuredSheets(migrationRows());
  const canonicalBefore = sheets.STUDENTS.rows.slice(1).map((row) => [row[0], row[1], row[5], row[7]]);
  const { context, getLockCount } = createRuntime({ sheets });
  const result = context.migrateStudentInstitutionCodesV240({ dryRun: false });
  const institutionIndex = STUDENT_HEADERS_V240.indexOf("institution_code");

  assert.equal(getLockCount(), 1);
  assert.equal(result.applied, 2);
  assert.equal(sheets.STUDENTS.rows[2][institutionIndex], "UMK");
  assert.equal(sheets.STUDENTS.rows[3][institutionIndex], "UPM");
  assert.equal(sheets.STUDENTS.rows[4][institutionIndex], "");
  assert.equal(sheets.STUDENTS.rows[6][institutionIndex], "UMK");
  assert.deepEqual(sheets.STUDENTS.rows.slice(1).map((row) => [row[0], row[1], row[5], row[7]]), canonicalBefore);
  assert.equal(sheets.AUDIT_LOG.rows.length, 2);
  const auditText = JSON.stringify(sheets.AUDIT_LOG.rows[1]);
  assert.match(auditText, /MIGRATE_STUDENT_INSTITUTION_CODES_V240/);
  assert.equal(auditText.includes("LIUMK-001"), false);
  assert.equal(auditText.includes("M-UMK"), false);
});

test("repeated apply is idempotent and never overwrites conflicts", () => {
  const sheets = configuredSheets(migrationRows());
  const { context, getLockCount } = createRuntime({ sheets });
  const first = context.migrateStudentInstitutionCodesV240({ dryRun: false });
  const afterFirst = JSON.stringify(sheets.STUDENTS.rows);
  const auditRowsAfterFirst = sheets.AUDIT_LOG.rows.length;
  const second = context.migrateStudentInstitutionCodesV240({ dryRun: false });

  assert.equal(first.applied, 2);
  assert.equal(second.applied, 0);
  assert.equal(second.matched_blank, 0);
  assert.equal(second.already_populated, 3);
  assert.equal(second.conflicts, 1);
  assert.equal(JSON.stringify(sheets.STUDENTS.rows), afterFirst);
  assert.equal(sheets.AUDIT_LOG.rows.length, auditRowsAfterFirst);
  assert.equal(getLockCount(), 2);
});

test("migration requires the append-only institution_code header and never creates it implicitly", () => {
  const students = new FakeSheet("STUDENTS", [STUDENT_HEADERS, studentRow().slice(0, -1)]);
  const { context } = createRuntime({ sheets: { STUDENTS: students } });
  assert.throws(() => context.migrateStudentInstitutionCodesV240({ dryRun: true }), /Header STUDENTS|setupStudentGroupConfigV240/i);
  assert.deepEqual(students.rows[0], STUDENT_HEADERS);
});
