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
  const timeInput = {
    value: initialValue,
    focused: false,
    dispatchEvent() {},
    focus() { this.focused = true; }
  };
  const elements = {
    adminEarliestDepartureTimeInput: timeInput,
    adminTypeCodeInput: { value: "KLINIK" },
    adminDisplayNameInput: { value: "Keluar ke Klinik" },
    adminDescriptionInput: { value: "Rawatan" },
    adminSortOrderInput: { value: "6" },
    adminOpenTimeInput: { value: "" },
    adminCloseTimeInput: { value: "" },
    adminFixedReturnTimeInput: { value: "" },
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
    ${sourceBetween("function clearAdminEarliestDepartureTimeV220", "async function loadAdminOutingConfigReadinessV220")}
    ${sourceBetween("function collectAdminOutingTypeConfigV200", "async function handleAdminTypeSubmitV200")}
    globalThis.clearTime = clearAdminEarliestDepartureTimeV220;
    globalThis.collect = collectAdminOutingTypeConfigV200;
  `, context);
  return context;
}

function createStudentFieldFixture(typeCode) {
  const title = { textContent: "Maklumat Pulang Bermalam" };
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
    overnightFields: { querySelector: () => title },
    emergencyFields: {}
  };
  const context = vm.createContext({ elements, title, selectedTypeCode: typeCode });
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
  context.clearTime();
  assert.equal(context.elements.adminEarliestDepartureTimeInput.value, "");
  assert.equal(context.collect().earliest_departure_time, "");
  assert.equal(context.elements.adminEarliestDepartureTimeInput.focused, true);
  const defaultsSource = sourceBetween("function setAdminDefaultRulesV200", "function getAdminRuleInputMapV200");
  assert.doesNotMatch(defaultsSource, /adminEarliestDepartureTimeInput|new Date|currentTime/);
  assert.match(htmlSource, /adminClearEarliestDepartureTimeButton/);
  assert.match(htmlSource, /Kosong bermaksud tiada sekatan masa keluar paling awal/);
});

test("custom KLINIK uses a neutral section and shows only its configured return-time field", () => {
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

  assert.equal(context.title.textContent, "Maklumat Tambahan");
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
  assert.equal(context.elements.leaveDateInput.hidden, false);
  assert.equal(context.elements.returnDateInput.hidden, false);
  assert.equal(context.elements.expectedReturnTimeInput.hidden, false);
  assert.equal(context.elements.guardianPhoneInput.hidden, false);
  assert.equal(context.elements.guardianRelationSelect.hidden, false);
});

test("legacy renderer keeps dedicated titles for Weekend, Cuti Semester, Outing Biasa and Kecemasan", () => {
  const legacySource = sourceBetween("function updateLegacyRequestTypeFieldsV164", "function updateRequestTypeFields");
  assert.match(legacySource, /Maklumat Outing Sabtu \/ Ahad/);
  assert.match(legacySource, /Maklumat Cuti Semester/);
  assert.match(legacySource, /Maklumat Pulang Bermalam/);
  assert.match(legacySource, /Maklumat Kecemasan/);
  assert.match(legacySource, /if \(isNormal \|\| !requestType\)/);
});
