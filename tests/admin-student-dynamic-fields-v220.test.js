const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function sourceBetween(start, end) {
  return appSource.slice(appSource.indexOf(start), appSource.indexOf(end));
}

function createAdminTimeFixture(initialValue = "07:37") {
  const makeTimeInput = (value = "") => ({
    value,
    focused: false,
    dispatchEvent() {},
    focus() { this.focused = true; }
  });
  const timeInput = makeTimeInput(initialValue);
  const elements = {
    adminEarliestDepartureTimeInput: timeInput,
    adminTypeCodeInput: { value: "KLINIK" },
    adminDisplayNameInput: { value: "Keluar ke Klinik" },
    adminDescriptionInput: { value: "Rawatan" },
    adminSortOrderInput: { value: "6" },
    adminOpenTimeInput: makeTimeInput("12:00"),
    adminCloseTimeInput: makeTimeInput("18:00"),
    adminFixedReturnTimeInput: makeTimeInput("22:00"),
    adminAllowedDays: {},
    adminDepartureAllowedDays: {},
    adminActiveInput: { value: "true" }
  };
  const context = vm.createContext({ elements, Event: class Event {} });
  vm.runInContext(`
    const els = elements;
    let adminEditingTypeCode = "KLINIK";
    function getAdminSelectedDaysV220(container) {
      return container === els.adminAllowedDays ? ["ISNIN"] : [];
    }
    function getAdminRuleInputMapV200() { return []; }
    ${sourceBetween("function clearAdminTimeInputV200", "async function loadAdminOutingConfigReadinessV220")}
    ${sourceBetween("function collectAdminOutingTypeConfigV200", "async function handleAdminTypeSubmitV200")}
    globalThis.clearTime = clearAdminTimeInputV200;
    globalThis.collect = collectAdminOutingTypeConfigV200;
  `, context);
  return context;
}

function createStudentFieldFixture(typeCode) {
  const title = { textContent: "Maklumat Pulang Bermalam" };
  const leaveDateLabel = { textContent: "Tarikh Keluar / Tarikh Mula Cuti" };
  const makeField = () => ({ value: "", disabled: false, required: false, readOnly: false, hidden: false });
  const elements = {
    leaveDateInput: makeField(),
    returnDateInput: makeField(),
    expectedReturnTimeInput: makeField(),
    guardianPhoneInput: makeField(),
    guardianRelationSelect: makeField(),
    emergencyReasonInput: makeField(),
    purposeInput: makeField(),
    locationInput: makeField(),
    vehicleTypeSelect: makeField(),
    vehicleDetailInput: makeField(),
    emergencyNoteInput: { ...makeField(), hidden: true },
    overnightFields: {
      querySelector: (selector) => selector === "h3" ? title : leaveDateLabel
    },
    emergencyFields: {}
  };
  const context = vm.createContext({ elements, title, leaveDateLabel, selectedTypeCode: typeCode });
  vm.runInContext(`
    const els = elements;
    const REQUEST_TYPE = {
      normal: "OUTING_BIASA",
      weekend: "OUTING_HUJUNG_MINGGU",
      emergency: "KECEMASAN",
      overnight: "PULANG_BERMALAM",
      semester: "CUTI_SEMESTER"
    };
    let studentPreviousOutingTypeCodeV200 = "";
    function setFieldAndLabelHiddenV160(field, hidden) { field.hidden = hidden; }
    function setSectionVisibleV164(section, visible) { section.visible = visible; }
    function syncStudentSameDayReturnV200() {}
    ${sourceBetween("function setConfigFieldStateV200", "function syncStudentSameDayReturnV200")}
    globalThis.applyConfig = applyStudentOutingTypeConfigV200;
  `, context);
  return context;
}

test("Admin existing earliest time loads and edited values enter the payload", () => {
  assert.match(appSource, /adminEarliestDepartureTimeInput\.value = type\.earliest_departure_time \|\| ""/);
  const context = createAdminTimeFixture("07:37");
  assert.equal(context.collect().earliest_departure_time, "07:37");
  context.elements.adminEarliestDepartureTimeInput.value = "08:15";
  assert.equal(context.collect().earliest_departure_time, "08:15");
});

test("Admin can explicitly clear earliest time and empty round-trips without a current-time default", () => {
  const context = createAdminTimeFixture("07:37");
  context.clearTime(context.elements.adminEarliestDepartureTimeInput);
  assert.equal(context.elements.adminEarliestDepartureTimeInput.value, "");
  assert.equal(context.collect().earliest_departure_time, "");
  assert.equal(context.elements.adminEarliestDepartureTimeInput.focused, true);
  const defaultsSource = sourceBetween("function setAdminDefaultRulesV200", "function getAdminRuleInputMapV200");
  assert.doesNotMatch(defaultsSource, /adminEarliestDepartureTimeInput|new Date|currentTime/);
  assert.match(htmlSource, /adminClearEarliestDepartureTimeButton/);
  assert.match(htmlSource, /Kosong bermaksud tiada sekatan masa keluar paling awal/);
});

test("Admin can explicitly clear application open and close times into the update payload", () => {
  const context = createAdminTimeFixture();
  context.clearTime(context.elements.adminOpenTimeInput);
  context.clearTime(context.elements.adminCloseTimeInput);

  assert.equal(context.elements.adminOpenTimeInput.value, "");
  assert.equal(context.elements.adminCloseTimeInput.value, "");
  assert.equal(context.elements.adminOpenTimeInput.focused, true);
  assert.equal(context.elements.adminCloseTimeInput.focused, true);
  assert.equal(context.collect().application_open_time, "");
  assert.equal(context.collect().application_close_time, "");
  assert.match(htmlSource, /id="adminClearOpenTimeButton"[^>]*>Kosongkan</);
  assert.match(htmlSource, /id="adminClearCloseTimeButton"[^>]*>Kosongkan</);
});

test("Admin can explicitly clear fixed return time into the generic save payload", () => {
  const context = createAdminTimeFixture();
  context.clearTime(context.elements.adminFixedReturnTimeInput);

  assert.equal(context.elements.adminFixedReturnTimeInput.value, "");
  assert.equal(context.elements.adminFixedReturnTimeInput.focused, true);
  assert.equal(context.collect().fixed_return_time, "");
  assert.match(htmlSource, /id="adminClearFixedReturnTimeButton"[^>]*>Kosongkan</);
  assert.match(htmlSource, /Kosong bermaksud tiada masa pulang tetap/);
  const setupSource = sourceBetween("function setupAdminDashboardV200", "async function handleAdminLoginV200");
  assert.match(setupSource, /adminClearFixedReturnTimeButton[\s\S]*clearAdminTimeInputV200\(els\.adminFixedReturnTimeInput\)/);
});

test("Admin editor assigns backend blanks directly with no time fallback", () => {
  const editorSource = sourceBetween("function openAdminEditEditorV200", "function closeAdminEditorV200");
  assert.match(editorSource, /adminOpenTimeInput\.value = type\.application_open_time \|\| ""/);
  assert.match(editorSource, /adminCloseTimeInput\.value = type\.application_close_time \|\| ""/);
  assert.match(editorSource, /adminFixedReturnTimeInput\.value = type\.fixed_return_time \|\| ""/);
  assert.doesNotMatch(editorSource, /new Date|currentTime|00:00|12:00/);
});

test("custom KLINIK uses safe fallback date wording and shows only its configured return-time field", () => {
  const context = createStudentFieldFixture("KLINIK");
  context.applyConfig({
    type_code: "KLINIK",
    same_day_only: true,
    require_leave_date: false,
    require_return_date: false,
    require_return_time: true,
    fixed_return_time: "",
    departure_allowed_days: "",
    require_guardian_phone: false,
    require_guardian_relation: false,
    require_emergency_reason: false,
    require_purpose: true,
    require_location: true,
    require_vehicle: true
  });

  assert.equal(context.title.textContent, "Maklumat Permohonan");
  assert.equal(context.leaveDateLabel.textContent, "Tarikh Keluar");
  assert.equal(context.elements.leaveDateInput.hidden, true);
  assert.equal(context.elements.returnDateInput.hidden, true);
  assert.equal(context.elements.expectedReturnTimeInput.hidden, false);
  assert.equal(context.elements.expectedReturnTimeInput.required, true);
  assert.equal(context.elements.overnightFields.visible, true);
});

test("Pulang Bermalam retains its title and configured dynamic fields", () => {
  const context = createStudentFieldFixture("PULANG_BERMALAM");
  context.applyConfig({
    type_code: "PULANG_BERMALAM",
    same_day_only: false,
    require_leave_date: true,
    require_return_date: true,
    require_return_time: true,
    fixed_return_time: "",
    departure_allowed_days: "JUMAAT",
    require_guardian_phone: true,
    require_guardian_relation: true,
    require_emergency_reason: false,
    require_purpose: true,
    require_location: true,
    require_vehicle: true
  });

  assert.equal(context.title.textContent, "Maklumat Pulang Bermalam");
  assert.equal(context.leaveDateLabel.textContent, "Tarikh Keluar");
  assert.equal(context.elements.leaveDateInput.hidden, false);
  assert.equal(context.elements.returnDateInput.hidden, false);
  assert.equal(context.elements.expectedReturnTimeInput.hidden, false);
  assert.equal(context.elements.guardianPhoneInput.hidden, false);
  assert.equal(context.elements.guardianRelationSelect.hidden, false);
});

test("Kecemasan uses its date wording without any Pulang Bermalam heading", () => {
  const context = createStudentFieldFixture("KECEMASAN");
  context.applyConfig({
    type_code: "KECEMASAN",
    same_day_only: false,
    require_leave_date: true,
    require_return_date: false,
    require_return_time: false,
    fixed_return_time: "",
    departure_allowed_days: "",
    require_guardian_phone: true,
    require_guardian_relation: true,
    require_emergency_reason: true,
    require_purpose: true,
    require_location: true,
    require_vehicle: true
  });

  assert.equal(context.title.textContent, "Maklumat Tarikh Keluar");
  assert.equal(context.leaveDateLabel.textContent, "Tarikh Keluar");
  assert.doesNotMatch(context.title.textContent, /Pulang Bermalam/);
  assert.equal(context.elements.leaveDateInput.hidden, false);
});

test("Cuti Semester uses its dedicated section and start-date wording", () => {
  const context = createStudentFieldFixture("CUTI_SEMESTER");
  context.applyConfig({
    type_code: "CUTI_SEMESTER",
    same_day_only: false,
    require_leave_date: true,
    require_return_date: true,
    require_return_time: true,
    fixed_return_time: "",
    departure_allowed_days: "",
    require_guardian_phone: true,
    require_guardian_relation: true,
    require_emergency_reason: false,
    require_purpose: true,
    require_location: true,
    require_vehicle: true
  });

  assert.equal(context.title.textContent, "Maklumat Cuti Semester");
  assert.equal(context.leaveDateLabel.textContent, "Tarikh Mula Cuti");
});

test("legacy renderer delegates shared date wording to the presentation-only label helper", () => {
  const legacySource = sourceBetween("function updateLegacyRequestTypeFieldsV164", "function updateRequestTypeFields");
  assert.match(legacySource, /applyStudentDateSectionLabelsV240\(requestType\)/);
  assert.doesNotMatch(legacySource, /Maklumat Pulang Bermalam/);
  assert.doesNotMatch(legacySource, /Tarikh Keluar \/ Tarikh Mula Cuti/);
  assert.match(legacySource, /Maklumat Kecemasan/);
  assert.match(legacySource, /if \(isNormal \|\| !requestType\)/);
});
