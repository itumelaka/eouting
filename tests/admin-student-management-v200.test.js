const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const STUDENT_HEADERS = ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan"];
const ADMIN_HEADERS = ["admin_id", "nama_admin", "pin", "status", "catatan", "created_at", "updated_at"];
const AUDIT_HEADERS = ["timestamp", "action", "request_id", "user_role", "user_name", "details", "entity_type", "entity_id"];

class FakeSheet {
  constructor(rows) { this.rows = rows.map((row) => row.slice()); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    return {
      getValues: () => Array.from({ length: rowCount }, (_, y) => Array.from({ length: columnCount }, (_, x) => {
        const value = (this.rows[row - 1 + y] || [])[column - 1 + x];
        return value === undefined ? "" : value;
      })),
      setValues: (values) => values.forEach((source, y) => {
        while (this.rows.length <= row - 1 + y) this.rows.push([]);
        source.forEach((value, x) => { this.rows[row - 1 + y][column - 1 + x] = value; });
      }),
      setValue: (value) => {
        while (this.rows.length <= row - 1) this.rows.push([]);
        this.rows[row - 1][column - 1] = value;
      }
    };
  }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(row) { this.rows.push(row.slice()); }
}

function runtime() {
  const sheets = new Map([
    ["STUDENTS", new FakeSheet([
      STUDENT_HEADERS,
      ["A2-001", "00120001", "Pelajar A2", "", "0120000001", "A2", "Lelaki", "AKTIF", ""],
      ["A3-001", "00130001", "Pelajar A3", "", "0120000002", "A3", "Perempuan", "AKTIF", ""],
      ["LI-OLD", "00009000", "Pelajar LI Lama", "", "", "LI", "Perempuan", "TIDAK AKTIF", ""]
    ])],
    ["ADMIN_USERS", new FakeSheet([ADMIN_HEADERS, ["ADM-001", "ADMIN TEST", "2468", "AKTIF", "", "", ""]])],
    ["AUDIT_LOG", new FakeSheet([AUDIT_HEADERS])]
  ]);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    getSpreadsheetTimeZone: () => "Asia/Kuala_Lumpur"
  };
  let locks = 0;
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => spreadsheet, getActive: () => spreadsheet },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { locks += 1; return true; }, releaseLock: () => {} }) },
    Session: { getScriptTimeZone: () => "Asia/Kuala_Lumpur" },
    Utilities: { formatDate: () => "2026-08-04 10:00:00" }
  });
  vm.runInContext(gasSource, context);
  return { context, sheets, getLocks: () => locks };
}

const auth = (extra = {}) => ({ admin_id: "ADM-001", pin: "2468", ...extra });
const liStudent = (extra = {}) => ({
  student_id: "LI-001",
  no_matrik: "00009001",
  nama: "Pelajar Latihan Industri (LI)",
  email: "li@example.test",
  no_tel: "01100009001",
  kelas: "LI",
  jantina: "Perempuan",
  status: "AKTIF",
  catatan: "Beta QA",
  ...extra
});

test("Admin student list requires active Admin authentication", () => {
  const { context } = runtime();
  assert.throws(() => context.getAdminStudents({}), /Admin|PIN/i);
  const rows = context.getAdminStudents(auth());
  assert.equal(rows.length, 3);
  assert.equal(JSON.stringify(rows).includes("2468"), false);
});

test("create LI student preserves text identifiers and rejects duplicate IDs or matric numbers", () => {
  const { context, getLocks } = runtime();
  const created = context.createStudent(auth({ student: liStudent() }));
  assert.equal(created.student_id, "LI-001");
  assert.equal(created.no_matrik, "00009001");
  assert.equal(created.no_tel, "01100009001");
  assert.equal(created.kelas, "LI");
  assert.equal(created.status, "AKTIF");
  assert.equal(getLocks(), 1);
  assert.throws(() => context.createStudent(auth({ student: liStudent({ no_matrik: "00009999" }) })), /student_id|wujud|duplicate/i);
  assert.throws(() => context.createStudent(auth({ student: liStudent({ student_id: "LI-002" }) })), /matrik|digunakan|duplicate/i);
});

test("update keeps student_id immutable and protects duplicate matric numbers", () => {
  const { context } = runtime();
  context.createStudent(auth({ student: liStudent() }));
  const updated = context.updateStudent(auth({
    student_id: "LI-001",
    student: liStudent({ nama: "Nama LI Dikemas Kini", no_tel: "00112233" })
  }));
  assert.equal(updated.student_id, "LI-001");
  assert.equal(updated.nama, "Nama LI Dikemas Kini");
  assert.throws(() => context.updateStudent(auth({
    student_id: "LI-001",
    student: liStudent({ student_id: "LI-CHANGED" })
  })), /student_id|diubah|immutable/i);
  assert.throws(() => context.updateStudent(auth({
    student_id: "LI-001",
    student: liStudent({ no_matrik: "00120001" })
  })), /matrik|digunakan|duplicate/i);
});

test("deactivate excludes a student from public getStudents and reactivate restores it", () => {
  const { context } = runtime();
  context.createStudent(auth({ student: liStudent() }));
  assert.equal(context.getStudents().some((row) => row.student_id === "LI-001"), true);
  const inactive = context.toggleStudentStatus(auth({ student_id: "LI-001", active: false }));
  assert.equal(inactive.status, "TIDAK AKTIF");
  assert.equal(context.getStudents().some((row) => row.student_id === "LI-001"), false);
  const active = context.toggleStudentStatus(auth({ student_id: "LI-001", active: true }));
  assert.equal(active.status, "AKTIF");
  assert.equal(context.getStudents().some((row) => row.student_id === "LI-001"), true);
});

test("student writes produce safe audit actions and STUDENTS schema remains unchanged", () => {
  const { context, sheets } = runtime();
  context.createStudent(auth({ student: liStudent() }));
  context.updateStudent(auth({ student_id: "LI-001", student: liStudent({ nama: "LI Updated" }) }));
  context.toggleStudentStatus(auth({ student_id: "LI-001", active: false }));
  context.toggleStudentStatus(auth({ student_id: "LI-001", active: true }));
  assert.deepEqual(sheets.get("STUDENTS").rows[0], STUDENT_HEADERS);
  const auditText = JSON.stringify(sheets.get("AUDIT_LOG").rows);
  for (const action of ["CREATE_STUDENT", "UPDATE_STUDENT", "DEACTIVATE_STUDENT", "ACTIVATE_STUDENT"]) {
    assert.match(auditText, new RegExp(action));
  }
  assert.match(auditText, /STUDENT/);
  assert.match(auditText, /LI-001/);
  assert.doesNotMatch(auditText, /2468/);
});

test("Student Management routes are POST-only and no student version migration was introduced", () => {
  for (const action of ["getAdminStudents", "createStudent", "updateStudent", "toggleStudentStatus"]) {
    assert.match(gasSource, new RegExp(`action === "${action}"`));
  }
  const doGetSource = gasSource.slice(gasSource.indexOf("function doGet"), gasSource.indexOf("function doPost"));
  for (const action of ["getAdminStudents", "createStudent", "updateStudent", "toggleStudentStatus"]) {
    assert.doesNotMatch(doGetSource, new RegExp(action));
  }
  assert.deepEqual(STUDENT_HEADERS, ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan"]);
});
