const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

test("Admin sub-navigation preserves outing config and adds Student Management", () => {
  assert.match(html, /id="adminOutingTab"[\s\S]*?Tetapan Outing/);
  assert.match(html, /id="adminStudentsTab"[\s\S]*?Pengurusan Pelajar/);
  assert.match(html, /id="adminOutingSettingsPanel"/);
  assert.match(html, /id="adminTypeList"/);
  assert.match(html, /id="adminOutingTypeForm"/);
  assert.match(html, /id="adminStudentManagementPanel"/);
  assert.match(app, /setAdminSectionV200\("outing"\)/);
  assert.match(app, /setAdminSectionV200\("students"\)/);
});

test("Student Management exposes filters and all existing STUDENTS fields without delete", () => {
  for (const id of [
    "adminStudentClassFilter", "adminStudentStatusFilter", "adminStudentSearchInput",
    "adminStudentIdInput", "adminStudentMatricInput", "adminStudentNameInput",
    "adminStudentEmailInput", "adminStudentPhoneInput", "adminStudentClassInput",
    "adminStudentGenderInput", "adminStudentStatusInput", "adminStudentNoteInput"
  ]) assert.match(html, new RegExp(`id="${id}"`));
  assert.match(html, /value="LI">LI/);
  assert.doesNotMatch(html, /data-admin-student-delete|Padam Pelajar/);
  assert.doesNotMatch(app, /deleteStudent/);
});

test("frontend wires authenticated Admin student CRUD and immutable edit ID", () => {
  assert.match(app, /apiPost\("getAdminStudents"/);
  assert.match(app, /adminEditingStudentIdV200 \? "updateStudent" : "createStudent"/);
  assert.match(app, /apiPost\(action, payload\)/);
  assert.match(app, /apiPost\("toggleStudentStatus"/);
  assert.match(app, /buildAdminCredentialPayloadV200\(\)/);
  assert.match(app, /els\.adminStudentIdInput\.readOnly = true/);
  assert.match(app, /student_id: els\.adminStudentIdInput\.value\.trim\(\)/);
  assert.match(app, /no_matrik: els\.adminStudentMatricInput\.value\.trim\(\)/);
  assert.match(app, /no_tel: els\.adminStudentPhoneInput\.value\.trim\(\)/);
});

test("LI is a dynamic student class and never a separate landing role", () => {
  assert.match(html, /data-student-class="A2"/);
  assert.match(html, /data-student-class="A3"/);
  assert.match(html, /data-student-class="LI"[^>]*hidden/);
  assert.doesNotMatch(html, /data-role-choice="li"/i);
  assert.doesNotMatch(html + app, /pelajar praktikal/i);
  assert.match(app, /hasLiStudents = students\.some/);
  assert.match(app, /liButton\.hidden = !hasLiStudents/);
  assert.match(app, /selectedStudentLoginClass === "LI"/);
});

test("active/inactive cards include text, LI badge and responsive Clay layout", () => {
  assert.match(app, /Pelajar Latihan Industri \(LI\)/);
  assert.match(app, /Aktif" : "Tidak Aktif/);
  assert.match(app, /student-li-badge/);
  assert.match(css, /\.admin-subnav/);
  assert.match(css, /\.admin-student-list[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.admin-student-list[\s\S]*?grid-template-columns:\s*1fr/);
});
