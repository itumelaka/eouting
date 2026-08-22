const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  configuredSheets,
  createRuntime,
  studentRow
} = require("./support/student-group-config-runtime");

const auth = (extra = {}) => ({ admin_id: "ADM-001", pin: "2468", ...extra });
const groupInput = (extra = {}) => ({
  group_code: "A4", display_name: "Aras 4", institution_required: false,
  active: true, sort_order: 40, ...extra
});
const institutionInput = (extra = {}) => ({
  institution_code: "IMU", display_name: "IMU", active: true, sort_order: 30, ...extra
});
const studentInput = (extra = {}) => ({
  student_id: "A4-001", no_matrik: "004001", nama: "Pelajar A4", email: "", no_tel: "",
  kelas: "A4", institution_code: "", jantina: "", status: "AKTIF", catatan: "", ...extra
});

test("group and institution lists require Admin authentication and never expose PIN", () => {
  const { context } = createRuntime({ sheets: configuredSheets() });
  assert.throws(() => context.getAdminStudentGroups({}), /Admin|PIN/i);
  assert.throws(() => context.getAdminLiInstitutions({}), /Admin|PIN/i);
  const groups = context.getAdminStudentGroups(auth());
  const institutions = context.getAdminLiInstitutions(auth());
  assert.deepEqual(Array.from(groups, (row) => row.group_code), ["A2", "A3", "LI"]);
  assert.deepEqual(Array.from(institutions, (row) => row.institution_code), ["UMK", "UPM"]);
  assert.equal(JSON.stringify({ groups, institutions }).includes("2468"), false);
});

test("Admin creates A4 and IMU generically, rejects duplicates, invalidates cache, and audits safely", () => {
  const runtime = createRuntime({ sheets: configuredSheets() });
  const group = runtime.context.createStudentGroup(auth({ student_group: groupInput() }));
  const institution = runtime.context.createLiInstitution(auth({ li_institution: institutionInput() }));
  assert.equal(group.group_code, "A4");
  assert.equal(group.config_version, 1);
  assert.equal(institution.institution_code, "IMU");
  assert.equal(institution.config_version, 1);
  assert.throws(() => runtime.context.createStudentGroup(auth({ student_group: groupInput() })), /wujud/i);
  assert.throws(() => runtime.context.createLiInstitution(auth({ li_institution: institutionInput() })), /wujud/i);
  assert.equal(Object.keys(runtime.propertyValues).some((key) => key.includes("ADMINSTUDENTGROUPSV240")), true);
  assert.equal(Object.keys(runtime.propertyValues).some((key) => key.includes("ADMINLIINSTITUTIONSV240")), true);
  const auditText = JSON.stringify(runtime.sheetMap.get("AUDIT_LOG").rows);
  assert.match(auditText, /CREATE_STUDENT_GROUP/);
  assert.match(auditText, /CREATE_LI_INSTITUTION/);
  assert.equal(auditText.includes("2468"), false);
});

test("updates preserve immutable codes and enforce optimistic config versions", () => {
  const { context } = createRuntime({ sheets: configuredSheets() });
  const group = context.createStudentGroup(auth({ student_group: groupInput() }));
  const updatedGroup = context.updateStudentGroup(auth({
    group_code: "A4", expected_config_version: group.config_version,
    student_group: { group_code: "A4", display_name: "Aras Empat", sort_order: 41, institution_required: false }
  }));
  assert.equal(updatedGroup.config_version, 2);
  assert.equal(updatedGroup.display_name, "Aras Empat");
  assert.throws(() => context.updateStudentGroup(auth({
    group_code: "A4", expected_config_version: 2,
    student_group: { group_code: "A5", display_name: "A5", sort_order: 50, institution_required: false }
  })), /tidak boleh diubah/i);
  assert.throws(() => context.updateStudentGroup(auth({
    group_code: "A4", expected_config_version: 1,
    student_group: { group_code: "A4", display_name: "Lama", sort_order: 42, institution_required: false }
  })), /CONFIG_VERSION_CONFLICT/i);

  const institution = context.createLiInstitution(auth({ li_institution: institutionInput() }));
  const updatedInstitution = context.updateLiInstitution(auth({
    institution_code: "IMU", expected_config_version: institution.config_version,
    li_institution: { institution_code: "IMU", display_name: "International Medical University", sort_order: 31 }
  }));
  assert.equal(updatedInstitution.config_version, 2);
  assert.throws(() => context.updateLiInstitution(auth({
    institution_code: "IMU", expected_config_version: 2,
    li_institution: { institution_code: "UTEM", display_name: "UTeM", sort_order: 40 }
  })), /tidak boleh diubah/i);
});

test("deactivation rejects active references and permits unreferenced config", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A2-001", kelas: "A2", status: "AKTIF" }),
    studentRow({ student_id: "LIUMK-001", kelas: "LI", status: "AKTIF", institution_code: "UMK" })
  ]);
  const { context } = createRuntime({ sheets });
  assert.throws(() => context.toggleStudentGroupStatus(auth({ group_code: "A2", expected_config_version: 1, active: false })), /pelajar aktif/i);
  assert.throws(() => context.toggleLiInstitutionStatus(auth({ institution_code: "UMK", expected_config_version: 1, active: false })), /pelajar aktif/i);
  context.createStudentGroup(auth({ student_group: groupInput({ institution_required: true }) }));
  context.createLiInstitution(auth({ li_institution: institutionInput() }));
  sheets.STUDENTS.rows.push(studentRow({ student_id: "A4-INDUSTRI", kelas: "A4", status: "AKTIF", institution_code: "IMU" }));
  assert.throws(() => context.toggleLiInstitutionStatus(auth({ institution_code: "IMU", expected_config_version: 1, active: false })), /pelajar aktif/i);
  const group = context.toggleStudentGroupStatus(auth({ group_code: "A3", expected_config_version: 1, active: false }));
  const institution = context.toggleLiInstitutionStatus(auth({ institution_code: "UPM", expected_config_version: 1, active: false }));
  assert.equal(group.active, false);
  assert.equal(group.config_version, 2);
  assert.equal(institution.active, false);
  assert.equal(institution.config_version, 2);
});

test("config-aware Admin Student writes enforce active assignments and institution rules while flag remains false", () => {
  const runtime = createRuntime({ sheets: configuredSheets(), properties: { STUDENT_GROUP_CONFIG_ENABLED: "false" } });
  runtime.context.createStudentGroup(auth({ student_group: groupInput() }));
  runtime.context.createLiInstitution(auth({ li_institution: institutionInput() }));
  const a4 = runtime.context.createStudent(auth({ student: studentInput() }));
  assert.equal(a4.kelas, "A4");
  assert.equal(a4.institution_code, "");
  assert.throws(() => runtime.context.createStudent(auth({ student: studentInput({ student_id: "BAD-001", no_matrik: "BAD001", institution_code: "IMU" }) })), /mesti kosong/i);
  assert.throws(() => runtime.context.createStudent(auth({ student: studentInput({ student_id: "LI-NEW", no_matrik: "LI001", kelas: "LI", institution_code: "" }) })), /Institusi diperlukan/i);
  const li = runtime.context.createStudent(auth({ student: studentInput({ student_id: "LI-NEW", no_matrik: "LI001", kelas: "LI", institution_code: "IMU" }) }));
  assert.equal(li.institution_code, "IMU");
  runtime.context.toggleStudentGroupStatus(auth({ group_code: "A3", expected_config_version: 1, active: false }));
  assert.throws(() => runtime.context.createStudent(auth({ student: studentInput({ student_id: "A3-NEW", no_matrik: "A3001", kelas: "A3" }) })), /tidak aktif/i);
  assert.equal(runtime.context.isStudentGroupConfigEnabledV240_(), false);
});

test("inactive current assignments survive unrelated edits but cannot be newly assigned", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A3-OLD", no_matrik: "A3000", kelas: "A3", status: "TIDAK AKTIF" }),
    studentRow({ student_id: "LIUPM-OLD", no_matrik: "LI000", kelas: "LI", status: "TIDAK AKTIF", institution_code: "UPM" })
  ]);
  const { context } = createRuntime({ sheets });
  context.toggleStudentGroupStatus(auth({ group_code: "A3", expected_config_version: 1, active: false }));
  context.toggleLiInstitutionStatus(auth({ institution_code: "UPM", expected_config_version: 1, active: false }));
  const a3 = context.updateStudent(auth({ student_id: "A3-OLD", student: studentInput({ student_id: "A3-OLD", no_matrik: "A3000", nama: "Nama Baharu", kelas: "A3", status: "TIDAK AKTIF" }) }));
  const li = context.updateStudent(auth({ student_id: "LIUPM-OLD", student: studentInput({ student_id: "LIUPM-OLD", no_matrik: "LI000", nama: "LI Baharu", kelas: "LI", institution_code: "UPM", status: "TIDAK AKTIF" }) }));
  assert.equal(a3.kelas, "A3");
  assert.equal(li.institution_code, "UPM");
  assert.throws(() => context.createStudent(auth({ student: studentInput({ student_id: "A3-NEW", no_matrik: "A3002", kelas: "A3" }) })), /tidak aktif/i);
  assert.throws(() => context.createStudent(auth({ student: studentInput({ student_id: "LI-NEW", no_matrik: "LI002", kelas: "LI", institution_code: "UPM" }) })), /tidak aktif/i);
});

test("backend never silently clears an invalid institution value on an unrelated edit", () => {
  const sheets = configuredSheets([
    studentRow({ student_id: "A2-WITH-INST", no_matrik: "A2000", kelas: "A2", status: "TIDAK AKTIF", institution_code: "UMK" })
  ]);
  const { context } = createRuntime({ sheets });
  assert.throws(() => context.updateStudent(auth({
    student_id: "A2-WITH-INST",
    student: studentInput({ student_id: "A2-WITH-INST", no_matrik: "A2000", nama: "Nama Baharu", kelas: "A2", institution_code: "", status: "TIDAK AKTIF" })
  })), /Betulkan penugasan secara eksplisit/i);
  const institutionIndex = sheets.STUDENTS.rows[0].indexOf("institution_code");
  assert.equal(sheets.STUDENTS.rows[1][institutionIndex], "UMK");
});

test("management APIs are POST-only and no destructive delete endpoint exists", () => {
  const root = path.join(__dirname, "..");
  const source = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
  const doGet = source.slice(source.indexOf("function doGet"), source.indexOf("function doPost"));
  const doPost = source.slice(source.indexOf("function doPost"), source.indexOf("function setupDatabase"));
  assert.equal(doGet.includes("getAdminStudentGroups"), false);
  assert.equal(doPost.includes("getAdminStudentGroups"), true);
  assert.equal(doPost.includes("getAdminLiInstitutions"), true);
  assert.equal(source.includes("deleteStudentGroup"), false);
  assert.equal(source.includes("deleteLiInstitution"), false);
});
