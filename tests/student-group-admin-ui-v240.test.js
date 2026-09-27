const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("Tetapan Pelajar contains compact Pelajar, Kumpulan, Institusi LI sub-tabs in order", () => {
  const panel = html.slice(html.indexOf('id="adminStudentManagementPanel"'), html.indexOf('id="adminMasterPanel"'));
  const labels = ["Pelajar", "Kumpulan", "Institusi LI"];
  let position = -1;
  labels.forEach((label) => {
    const next = panel.indexOf(`>${label}</button>`);
    assert.ok(next > position, `${label} must appear in order`);
    position = next;
  });
  assert.match(panel, /adminStudentPeoplePanel/);
  assert.match(panel, /adminStudentGroupsPanel/);
  assert.match(panel, /adminLiInstitutionsPanel/);
  assert.match(css, /\.admin-student-subtabs[\s\S]*grid-template-columns: repeat\(3/);
});

test("Group and institution lists keep safe create, edit and status operations", () => {
  [
    "getAdminStudentGroups", "createStudentGroup", "updateStudentGroup", "toggleStudentGroupStatus",
    "getAdminLiInstitutions", "createLiInstitution", "updateLiInstitution", "toggleLiInstitutionStatus"
  ].forEach((action) => assert.match(app, new RegExp(`apiPost\\(\\"${action}\\"|\\"${action}\\"`)));
  assert.match(html, /id="adminStudentGroupCodeInput"/);
  assert.match(html, /id="adminLiInstitutionCodeInput"/);
  assert.match(app, /expected_config_version/);
  assert.match(app, /data-config-toggle/);
  assert.equal(html.includes("deleteStudentGroup"), false);
  assert.equal(html.includes("deleteLiInstitution"), false);
});

test("Admin may enter future codes without A4 or IMU being hard-coded in runtime UI", () => {
  const studentPanel = html.slice(html.indexOf('id="adminStudentManagementPanel"'), html.indexOf('id="adminMasterPanel"'));
  assert.match(studentPanel, /pattern="\[A-Za-z\]\[A-Za-z0-9_\]\{1,31\}"/);
  assert.equal(studentPanel.includes('value="A4"'), false);
  assert.equal(studentPanel.includes('value="IMU"'), false);
  assert.match(app, /toUpperCase\(\)\.replace\(\/\[\^A-Z0-9_\]\/g/);
});

test("Student editor uses active config and conditionally shows authoritative institution assignment", () => {
  assert.match(html, /id="adminStudentInstitutionField" hidden/);
  assert.match(html, /id="adminStudentInstitutionInput"[^>]*disabled/);
  assert.match(app, /group\.active && isAssignableGroup\(group\)/);
  assert.match(app, /selectedGroupCode === "LI"/);
  assert.match(app, /!institutionCodes\.has\(group\.group_code\)/);
  assert.match(app, /adminStudentInstitutionField\.hidden = !requiresInstitution/);
  assert.match(app, /institution_code:[\s\S]*adminStudentInstitutionInput/);
});

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} source must exist`);
  return app.slice(from, to);
}

function fakeSelect(initialValue = "") {
  let value = initialValue;
  let htmlValue = "";
  return {
    options: [], disabled: false, required: false,
    get value() { return value; },
    set value(next) { value = String(next); },
    get innerHTML() { return htmlValue; },
    set innerHTML(next) {
      htmlValue = String(next);
      this.options = Array.from(htmlValue.matchAll(/<option value="([^"]*)">([^<]*)<\/option>/g))
        .map((match) => ({ value: match[1], textContent: match[2] }));
      if (!this.options.some((option) => option.value === value)) {
        value = this.options.length ? this.options[0].value : "";
      }
    }
  };
}

test("real Admin form serializes canonical LI plus UNISZA and routes createStudent payload", async () => {
  const classInput = fakeSelect();
  const institutionInput = fakeSelect();
  const institutionField = { hidden: true };
  let captured = null;
  const context = vm.createContext({
    adminStudentGroupsV240: [
      { group_code: "A2", display_name: "A2", active: true },
      { group_code: "A4", display_name: "A4", active: true },
      { group_code: "LI", display_name: "LI", active: true, institution_required: true },
      { group_code: "UNISZA", display_name: "LI", active: true, institution_required: true }
    ],
    adminLiInstitutionsV240: [
      { institution_code: "UNISZA", display_name: "UNISZA", active: true }
    ],
    adminStudentsV200: [],
    adminEditingStudentIdV200: "",
    document: { querySelector: () => null },
    escapeHtml: (value) => String(value),
    window: { confirm: () => true },
    els: {
      adminStudentClassInput: classInput,
      adminStudentInstitutionInput: institutionInput,
      adminStudentInstitutionField: institutionField,
      adminStudentClassFilter: null,
      adminMasterClass: null,
      adminStudentIdInput: { value: "QA-LI-001" },
      adminStudentMatricInput: { value: "QA-LI-001" },
      adminStudentNameInput: { value: "QA STUDENT LI UNISZA" },
      adminStudentEmailInput: { value: "" },
      adminStudentPhoneInput: { value: "" },
      adminStudentGenderInput: { value: "LELAKI" },
      adminStudentStatusInput: { value: "AKTIF" },
      adminStudentNoteInput: { value: "QA Phase 2 LI" },
      adminSaveStudentButton: { disabled: false }
    },
    buildAdminCredentialPayloadV200: () => ({
      admin_id: "ADMIN-TEST", nama_admin: "Admin Test", pin: "TEST_PIN"
    }),
    apiPost: async (action, payload) => { captured = { action, payload }; },
    setAdminStudentEditorMessageV200: () => {},
    safeAdminStudentErrorV200: (error) => error.message,
    closeAdminStudentEditorV200: () => {},
    loadAdminStudentsV200: async () => {},
    refreshPublicStudentsAfterAdminWriteV200: async () => {},
    setAdminStudentsMessageV200: () => {},
    setButtonLoadingVisualV220: () => {}
  });
  vm.runInContext([
    sourceBetween("function getAdminStudentGroupV240", "function renderSelectOptionsV240"),
    sourceBetween("function renderSelectOptionsV240", "function renderAdminStudentGroupOptionsV240"),
    sourceBetween("function renderAdminStudentGroupOptionsV240", "function updateAdminStudentInstitutionFieldV240"),
    sourceBetween("function updateAdminStudentInstitutionFieldV240", "function renderAdminStudentGroupListV240"),
    sourceBetween("function buildAdminStudentFormPayloadV200", "async function handleAdminStudentSubmitV200"),
    sourceBetween("async function handleAdminStudentSubmitV200", "function setAdminStudentEditorMessageV200")
  ].join("\n"), context);

  context.renderAdminStudentGroupOptionsV240();
  assert.deepEqual(classInput.options.map((option) => option.value), ["A2", "A4", "LI"]);
  classInput.value = "LI";
  context.updateAdminStudentInstitutionFieldV240();
  institutionInput.value = "UNISZA";
  await context.handleAdminStudentSubmitV200({ preventDefault() {} });

  assert.equal(captured.action, "createStudent");
  assert.deepEqual(JSON.parse(JSON.stringify(captured.payload.student)), {
    student_id: "QA-LI-001",
    no_matrik: "QA-LI-001",
    nama: "QA STUDENT LI UNISZA",
    email: "",
    no_tel: "",
    kelas: "LI",
    institution_code: "UNISZA",
    jantina: "LELAKI",
    status: "AKTIF",
    catatan: "QA Phase 2 LI"
  });

  classInput.value = "A4";
  context.updateAdminStudentInstitutionFieldV240("UNISZA");
  assert.equal(institutionField.hidden, true);
  assert.equal(institutionInput.disabled, true);
  assert.equal(institutionInput.required, false);
  assert.equal(institutionInput.value, "");
  await context.handleAdminStudentSubmitV200({ preventDefault() {} });
  assert.equal(captured.payload.student.kelas, "A4");
  assert.equal(captured.payload.student.institution_code, "");
});

test("inactive current group and institution remain available for unrelated edits", () => {
  assert.match(app, /currentGroup && currentGroupCode/);
  assert.match(app, /current && !current\.active/);
  assert.match(app, /Tidak Aktif — semasa/);
  assert.match(app, /renderAdminStudentGroupOptionsV240\(student\)/);
  assert.match(app, /updateAdminStudentInstitutionFieldV240\(student\.institution_code\)/);
});

test("Admin-only Student and Master filters derive their options from group config", () => {
  assert.match(app, /renderAdminStudentGroupOptionsV240/);
  assert.match(app, /els\.adminStudentClassFilter, els\.adminMasterClass/);
  assert.match(app, /referencedCodes/);
});

test("normal Tetapan Pelajar UI omits rollout, migration and technical metadata", () => {
  const panel = html.slice(html.indexOf('id="adminStudentManagementPanel"'), html.indexOf('id="adminMasterPanel"'));
  [
    "Student Group Config", "Refresh readiness", "Dry-run", "Apply migrasi",
    "Dynamic Student Login", "adminDynamicLogin", "adminStudentMigration",
    "Institusi diperlukan", "Tanpa institusi", "adminStudentGroupInstitutionRequiredInput"
  ].forEach((text) => assert.equal(panel.includes(text), false, `${text} must not be shown`));
  assert.doesNotMatch(panel, /Versi\s+\d/);
  const loader = sourceBetween("async function loadAdminStudentConfigV240", "function setAdminStudentConfigBusyV240");
  assert.match(loader, /getAdminStudentGroups/);
  assert.match(loader, /getAdminLiInstitutions/);
  assert.doesNotMatch(loader, /getStudentGroupConfigReadiness|renderAdminStudentReadinessV240/);
  assert.match(app, /getStudentGroupConfigReadiness/);
  assert.match(app, /setStudentGroupConfigEnabled/);
  assert.match(app, /runStudentInstitutionMigration/);
});

test("group cards keep inactive legacy rows visible without legacy flags or versions", () => {
  const context = vm.createContext({
    adminStudentGroupsV240: [
      { group_code: "A4", display_name: "A4", active: true, sort_order: 40, config_version: 2, institution_required: false },
      { group_code: "UNISZA", display_name: "Legacy UNISZA", active: false, sort_order: 90, config_version: 7, institution_required: true }
    ],
    adminLiInstitutionsV240: [],
    escapeHtml: (value) => String(value),
    els: { adminStudentGroupList: { innerHTML: "" }, adminLiInstitutionList: null }
  });
  vm.runInContext(
    sourceBetween("function renderAdminStudentGroupListV240", "function openAdminStudentGroupEditorV240"),
    context
  );
  context.renderAdminStudentGroupListV240();
  const cards = context.els.adminStudentGroupList.innerHTML;
  assert.match(cards, /UNISZA/);
  assert.match(cards, /Legacy UNISZA/);
  assert.match(cards, /Tidak Aktif/);
  assert.match(cards, /data-config-edit="group"/);
  assert.match(cards, /data-config-toggle="group"/);
  assert.doesNotMatch(cards, /Versi|Institusi diperlukan|Tanpa institusi/);
});

test("group editor derives the hidden compatibility flag only when creating exact LI", async () => {
  const calls = [];
  const context = vm.createContext({
    adminEditingStudentGroupCodeV240: "",
    els: {
      adminStudentGroupCodeInput: { value: "LI" },
      adminStudentGroupNameInput: { value: "Latihan Industri" },
      adminStudentGroupSortInput: { value: "30" },
      adminStudentGroupActiveInput: { checked: true },
      adminStudentGroupVersionInput: { value: "7" },
      adminSaveStudentGroupButton: { disabled: false },
      adminStudentGroupsMessage: {},
      adminStudentGroupEditorMessage: {}
    },
    buildAdminCredentialPayloadV200: () => ({ admin_id: "ADMIN-TEST", pin: "TEST_PIN" }),
    apiPost: async (action, payload) => { calls.push({ action, payload }); },
    closeAdminStudentGroupEditorV240: () => {},
    loadAdminStudentConfigV240: async () => {},
    refreshPublicStudentsAfterAdminWriteV200: async () => {},
    setStudentConfigMessageV240: () => {},
    cleanApiError: (value) => value
  });
  vm.runInContext(
    sourceBetween("async function saveAdminStudentGroupV240", "async function saveAdminLiInstitutionV240"),
    context
  );

  await context.saveAdminStudentGroupV240({ preventDefault() {} });
  assert.equal(calls[0].action, "createStudentGroup");
  assert.equal(calls[0].payload.student_group.institution_required, true);

  context.els.adminStudentGroupCodeInput.value = "A4";
  await context.saveAdminStudentGroupV240({ preventDefault() {} });
  assert.equal(calls[1].payload.student_group.institution_required, false);

  vm.runInContext('adminEditingStudentGroupCodeV240 = "UNISZA"', context);
  context.els.adminStudentGroupCodeInput.value = "UNISZA";
  await context.saveAdminStudentGroupV240({ preventDefault() {} });
  assert.equal(calls[2].action, "updateStudentGroup");
  assert.equal(calls[2].payload.group_code, "UNISZA");
  assert.equal(calls[2].payload.expected_config_version, 7);
  assert.equal(Object.prototype.hasOwnProperty.call(calls[2].payload.student_group, "institution_required"), false);
});

test("localhost routes Student Group readiness to the direct D1 endpoint", () => {
  const d1PostMap = app.slice(
    app.indexOf("const D1_POST_ENDPOINTS"),
    app.indexOf("const API_OVERRIDE_STORAGE_KEY")
  );
  assert.match(
    d1PostMap,
    /getStudentGroupConfigReadiness:\s*"getStudentGroupConfigReadiness"/
  );
  assert.match(d1PostMap, /createStudent:\s*"createStudent"/);
});

test("Student login retains legacy A2/A3/LI fallback with unchanged payload boundary", () => {
  const login = html.slice(html.indexOf('id="studentClassFilter"'), html.indexOf('id="studentLoginSelect"'));
  assert.match(login, /data-student-class="A2"/);
  assert.match(login, /data-student-class="A3"/);
  assert.match(login, /data-student-class="LI"/);
  assert.equal(login.includes('data-student-class="A4"'), false);
  const loginSubmit = app.slice(app.indexOf("async function handleStudentLogin"), app.indexOf("async function handleWardenLogin"));
  assert.match(loginSubmit, /loginStudent/);
  assert.match(loginSubmit, /student_id/);
  assert.match(loginSubmit, /no_matrik/);
  assert.equal(loginSubmit.includes("loginGroupKey"), false);
  assert.equal(loginSubmit.includes("getAdminStudentGroups"), false);
  assert.equal(gas.includes('setProperty(STUDENT_GROUP_CONFIG_PROPERTY, "true")'), false);
});

test("frontend runtime revision advances consistently to r17 without changing displayed version", () => {
  assert.match(app, /const APP_VERSION = "2\.4\.0"/);
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(serviceWorker, /eouting-cache-v2\.4\.0-r21/);
  assert.doesNotMatch(`${html}\n${serviceWorker}`, /2\.4\.0-r13/);
});
