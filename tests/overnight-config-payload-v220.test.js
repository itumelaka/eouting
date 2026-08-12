const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
const payloadBuilderSource = appSource.slice(
  appSource.indexOf("function normalizeStudentSubmissionDateV220"),
  appSource.indexOf('els.requestForm.addEventListener("submit"')
);
const fieldStateSource = appSource.slice(
  appSource.indexOf("function setConfigFieldStateV200"),
  appSource.indexOf("function applyStudentOutingTypeConfigV200")
);

function createFixture({
  leaveDate = "2026-08-12",
  returnDate = "2026-08-16",
  returnTime = "20:30"
} = {}) {
  const elements = {
    leaveDateInput: { value: leaveDate },
    returnDateInput: { value: returnDate },
    expectedReturnTimeInput: { value: returnTime },
    purposeInput: { value: "Balik bersama keluarga" },
    locationInput: { value: "Melaka" },
    vehicleTypeSelect: { value: "KERETA" },
    vehicleDetailInput: { value: "ABC 1234" },
    emergencyReasonInput: { value: "" },
    guardianPhoneInput: { value: "0123456789" },
    guardianRelationSelect: { value: "IBU" },
    emergencyNoteInput: { value: "Hubungi sebelum tiba" }
  };
  const context = vm.createContext({
    elements,
    requestTypes: {
      normal: "OUTING_BIASA",
      weekend: "OUTING_HUJUNG_MINGGU",
      emergency: "KECEMASAN",
      overnight: "PULANG_BERMALAM",
      semester: "CUTI_SEMESTER"
    }
  });
  vm.runInContext(`
    const REQUEST_TYPE = requestTypes;
    const els = elements;
    function getDayNameFromDateInput(value) {
      if (!value) return "";
      const names = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
      return names[new Date(value + "T00:00:00+08:00").getDay()];
    }
    function setFieldAndLabelHiddenV160() {}
    ${payloadBuilderSource}
    ${fieldStateSource}
    globalThis.buildPayload = buildStudentRequestPayloadV220;
    globalThis.normalizeDate = normalizeStudentSubmissionDateV220;
    globalThis.setFieldState = setConfigFieldStateV200;
  `, context);
  return context;
}

const student = {
  id: "S001",
  no_matrik: "M001",
  name: "Pelajar Ujian",
  email: "pelajar@example.test",
  className: "A3"
};

test("visible Pulang Bermalam departure date is built directly into payload.tarikh", () => {
  const context = createFixture();
  const payload = context.buildPayload(student, "PULANG_BERMALAM");

  assert.equal(payload.tarikh, "2026-08-12");
  assert.equal(payload.hari, "Rabu");
  assert.equal(payload.tarikh_balik, "2026-08-16");
  assert.equal(payload.masa_balik_dijangka, "20:30");
  assert.equal(payload.telefon_waris, "0123456789");
  assert.equal(payload.hubungan_waris, "IBU");
  assert.equal(payload.tujuan, "Balik bersama keluarga");
  assert.equal(payload.lokasi, "Melaka");
  assert.equal(payload.jenis_kenderaan, "KERETA");
  assert.equal(payload.butiran_kenderaan, "ABC 1234");
});

test("user-friendly 12/08/2026 input normalizes to canonical backend date", () => {
  const context = createFixture({ leaveDate: "12/08/2026" });
  const payload = context.buildPayload(student, "PULANG_BERMALAM");
  assert.equal(context.normalizeDate("12/08/2026"), "2026-08-12");
  assert.equal(payload.tarikh, "2026-08-12");
});

test("empty departure remains empty and return date/time are never substituted", () => {
  const context = createFixture({ leaveDate: "" });
  const payload = context.buildPayload(student, "PULANG_BERMALAM");
  assert.equal(payload.tarikh, "");
  assert.equal(payload.tarikh_balik, "2026-08-16");
  assert.equal(payload.masa_balik_dijangka, "20:30");
});

test("weekend mapping remains same-day at 22:00", () => {
  const context = createFixture({ leaveDate: "2026-08-15" });
  const payload = context.buildPayload(student, "OUTING_HUJUNG_MINGGU");
  assert.equal(payload.tarikh, "2026-08-15");
  assert.equal(payload.tarikh_balik, "2026-08-15");
  assert.equal(payload.masa_balik_dijangka, "22:00");
});

test("switching request types clears the hidden departure value", () => {
  const context = createFixture({ leaveDate: "2026-08-12" });
  assert.equal(context.buildPayload(student, "PULANG_BERMALAM").tarikh, "2026-08-12");
  context.setFieldState(context.elements.leaveDateInput, false, false);
  assert.equal(context.elements.leaveDateInput.value, "");
  assert.equal(context.buildPayload(student, "OUTING_BIASA").tarikh, "");
  assert.equal(context.buildPayload(student, "PULANG_BERMALAM").tarikh, "");
});

test("Outing Biasa, Kecemasan and Cuti Semester retain their date behavior", () => {
  for (const requestType of ["OUTING_BIASA", "KECEMASAN", "CUTI_SEMESTER"]) {
    const context = createFixture();
    const payload = context.buildPayload(student, requestType);
    assert.equal(payload.tarikh, "");
    assert.equal(payload.tarikh_balik, "");
    assert.equal(payload.masa_balik_dijangka, "");
  }
  assert.match(appSource, /function buildSemesterPayloadV160[\s\S]*tarikh: leaveDate/);
});

test("live student submit uses the payload builder instead of transport-time DOM mutation", () => {
  const submitSource = appSource.slice(
    appSource.indexOf('els.requestForm.addEventListener("submit"'),
    appSource.indexOf("function setStudentRequestSubmitting")
  );
  assert.match(submitSource, /const payload = buildStudentRequestPayloadV220\(student, requestType\)/);
  assert.doesNotMatch(appSource, /apiPostWithPulangBermalamFields|apiPostWithoutPulangBermalamFields/);
});
