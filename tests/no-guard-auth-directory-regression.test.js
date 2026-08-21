const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "gas", "appsscript.json"), "utf8"));

const adminRow = {
  admin_id: "Admin",
  nama_admin: "Burn",
  pin: "2468",
  status: "AKTIF"
};
const studentRows = [
  { student_id: "S-A2", nama: "Pelajar A2", kelas: "A2", status: "AKTIF" },
  { student_id: "S-A3", nama: "Pelajar A3", kelas: "A3", status: "AKTIF" },
  { student_id: "S-LI", nama: "Pelajar LI", kelas: "LI", status: "AKTIF" }
];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return source.slice(start, end);
}

function createGasContext(featureEnabled) {
  const properties = { NO_GUARD_DEPARTURE_ENABLED: featureEnabled ? "true" : "false" };
  const context = vm.createContext({
    console,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null
      })
    }
  });
  vm.runInContext(gasSource, context);
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => {
    if (sheet.name === "ADMIN_USERS") return [{ ...adminRow }];
    if (sheet.name === "STUDENTS") return studentRows.map((row) => ({ ...row }));
    return [];
  };
  context.getCachedOrLoad_ = (_key, _ttl, _validator, loader) => loader();
  return context;
}

test("canonical manifest preserves the established Web App execution contract", () => {
  assert.deepEqual(manifest, {
    timeZone: "Asia/Kuala_Lumpur",
    exceptionLogging: "STACKDRIVER",
    runtimeVersion: "V8",
    webapp: {
      executeAs: "USER_DEPLOYING",
      access: "ANYONE_ANONYMOUS"
    }
  });
});

for (const featureEnabled of [false, true]) {
  const state = featureEnabled ? "ON" : "OFF";

  test(`No-Guard ${state} does not affect valid Admin authentication`, () => {
    const context = createGasContext(featureEnabled);
    const result = plain(context.loginAdmin({ admin_id: "Admin", pin: "2468" }));
    assert.equal(result.admin_id, "Admin");
    assert.equal(result.nama_admin, "Burn");
    assert.equal(context.isNoGuardDepartureEnabled_(), featureEnabled);
    assert.throws(
      () => context.loginAdmin({ admin_id: "Admin", pin: "0000" }),
      /Admin tidak dijumpai|PIN tidak sah/i
    );
  });

  test(`No-Guard ${state} does not affect the dynamic Student class directory`, () => {
    const context = createGasContext(featureEnabled);
    const directory = plain(context.getStudents());
    assert.deepEqual(directory.map((student) => student.kelas), ["A2", "A3", "LI"]);
    assert.equal(context.isNoGuardDepartureEnabled_(), featureEnabled);
  });
}

test("frontend reveals LI dynamically while retaining A2 and A3", () => {
  const buttons = ["A2", "A3", "LI"].map((studentClass) => ({
    dataset: { studentClass },
    hidden: studentClass === "LI",
    classList: { toggle() {} },
    setAttribute() {}
  }));
  const context = vm.createContext({
    students: studentRows.map((row) => ({ className: row.kelas, kelas: row.kelas })),
    selectedStudentLoginClass: "A2",
    els: {
      studentClassFilter: {
        querySelector: (selector) => selector.includes('"LI"') ? buttons[2] : null,
        querySelectorAll: () => buttons
      }
    },
    renderLiStudentLoginOptionsV200() {},
    renderStudentDropdownState() {}
  });
  vm.runInContext(
    extractFunction(appSource, "refreshStudentClassChoicesV200", "renderLiStudentLoginOptionsV200"),
    context
  );
  context.refreshStudentClassChoicesV200();

  assert.deepEqual(buttons.map((button) => button.dataset.studentClass), ["A2", "A3", "LI"]);
  assert.equal(buttons[2].hidden, false);
});
