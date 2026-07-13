const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

const fullStudent = {
  student_id: "S001",
  no_matrik: "0825-0001",
  nama: "PELAJAR CONTOH",
  email: "student@example.test",
  no_tel: "0123456789",
  kelas: "A2",
  jantina: "Lelaki",
  status: "Aktif",
  catatan: "PII tidak boleh terdedah",
  alamat: "Alamat peribadi",
  nama_waris: "Nama waris",
  telefon_waris: "0199999999"
};

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  let end = source.indexOf(`\nfunction ${nextName}`, start);
  if (end === -1) {
    end = source.indexOf(`\nasync function ${nextName}`, start);
  }
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return source.slice(start, end);
}

function createGasContext(rows = [fullStudent]) {
  const context = vm.createContext({ console });
  vm.runInContext(gasSource, context);
  context.getSheet_ = () => ({});
  context.getRowsAsObjects_ = () => rows.map((row) => ({ ...row }));
  return context;
}

test("public getStudents returns only the minimum directory fields", () => {
  const context = createGasContext();
  const result = plain(context.getStudents());

  assert.deepEqual(result, [{
    student_id: "S001",
    nama: "PELAJAR CONTOH",
    kelas: "A2"
  }]);
  assert.deepEqual(Object.keys(result[0]).sort(), ["kelas", "nama", "student_id"]);
});

test("frontend maps and filters a minimal public student directory", () => {
  const context = vm.createContext({
    ALLOW_MOCK_MODE: false,
    console: { warn() {} },
    selectedStudentLoginClass: "A2"
  });
  vm.runInContext([
    extractFunction(appSource, "normalizeStudentRow", "updateWardenMasterList"),
    extractFunction(appSource, "filterStudentsByLoginClass", "hasA2OrA3Student"),
    extractFunction(appSource, "hasA2OrA3Student", "getStudentLoginClass"),
    extractFunction(appSource, "getStudentLoginClass", "setStudentLoginDisabled")
  ].join("\n"), context);

  const mapped = plain(context.normalizeStudentRow({
    student_id: "S001",
    nama: "PELAJAR CONTOH",
    kelas: "A2"
  }));

  assert.deepEqual(mapped, {
    id: "S001",
    student_id: "S001",
    name: "PELAJAR CONTOH",
    nama: "PELAJAR CONTOH",
    className: "A2",
    kelas: "A2"
  });
  assert.deepEqual(plain(context.filterStudentsByLoginClass([mapped], "A2")), [mapped]);
});

test("frontend login submits student_id and the entered matric number", () => {
  const start = appSource.indexOf('els.studentLoginPanel.addEventListener("submit"');
  const end = appSource.indexOf('els.wardenLoginPanel.addEventListener("submit"', start);
  const loginHandler = appSource.slice(start, end);

  assert.match(loginHandler, /student_id:\s*selectedStudent \? selectedStudent\.id : ""/);
  assert.doesNotMatch(loginHandler, /nama:\s*selectedStudent/);
  assert.match(loginHandler, /no_matrik:\s*enteredMatric/);
});

test("backend login validates student_id and matric against the full sheet row", () => {
  const context = createGasContext();

  const authenticated = plain(context.loginStudent({
    student_id: "S001",
    no_matrik: "0825-0001"
  }));
  assert.equal(authenticated.student_id, "S001");
  assert.equal(authenticated.no_matrik, "0825-0001");
  assert.throws(
    () => context.loginStudent({ student_id: "S001", no_matrik: "SALAH" }),
    /tidak dijumpai|tidak aktif/i
  );
});

test("remembered session retains authenticated fields when the directory is minimal", () => {
  const context = vm.createContext({
    students: [{
      id: "S001",
      student_id: "S001",
      name: "PELAJAR CONTOH",
      nama: "PELAJAR CONTOH",
      className: "A2",
      kelas: "A2"
    }],
    normalizeValue: (value) => String(value || "").trim().toLowerCase()
  });
  vm.runInContext(
    extractFunction(appSource, "findStudentForSavedSession", "setupFeedbackMessageObservers"),
    context
  );

  const restored = plain(context.findStudentForSavedSession({
    student_id: "S001",
    no_matrik: "0825-0001",
    nama: "PELAJAR CONTOH",
    email: "student@example.test",
    kelas: "A2"
  }));

  assert.equal(restored.no_matrik, "0825-0001");
  assert.equal(restored.email, "student@example.test");
  assert.equal(restored.id, "S001");
});

test("student directory validation does not log raw response records", () => {
  const normalizer = extractFunction(appSource, "normalizeStudentRow", "updateWardenMasterList");
  const extractor = extractFunction(appSource, "extractArrayResponse", "retryLoadStudentsOnly");

  assert.doesNotMatch(normalizer, /console\.warn\([^;]*,\s*row\s*\)/s);
  assert.doesNotMatch(extractor, /console\.warn\([^;]*,\s*response\s*\)/s);
});
