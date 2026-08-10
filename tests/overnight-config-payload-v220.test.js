const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
const wrapperSource = appSource.slice(
  appSource.indexOf("const apiPostWithoutPulangBermalamFields"),
  appSource.indexOf("const mapLiveRecordWithoutPulangBermalamFields")
);

function createWrapperFixture({ leaveDate = "2026-08-14", returnDate = "2026-08-16", returnTime = "20:30" } = {}) {
  const calls = [];
  const context = vm.createContext({
    calls,
    basePost: async (action, payload) => {
      calls.push({ action, payload: { ...payload } });
      return payload;
    },
    requestTypes: {
      overnight: "PULANG_BERMALAM",
      weekend: "OUTING_HUJUNG_MINGGU"
    },
    elements: {
      leaveDateInput: { value: leaveDate },
      returnDateInput: { value: returnDate },
      expectedReturnTimeInput: { value: returnTime }
    }
  });
  vm.runInContext(`
    let apiPost = basePost;
    const REQUEST_TYPE = requestTypes;
    const els = elements;
    function getDayNameFromDateInput(value) {
      if (!value) return "";
      const names = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
      return names[new Date(value + "T00:00:00+08:00").getDay()];
    }
    ${wrapperSource}
    globalThis.wrappedApiPost = apiPost;
  `, context);
  return context;
}

test("visible Pulang Bermalam departure date reaches payload.tarikh with return fields intact", async () => {
  const context = createWrapperFixture();
  await context.wrappedApiPost("submitRequest", {
    student_id: "S001",
    no_matrik: "M001",
    jenis_permohonan: "PULANG_BERMALAM"
  });

  assert.equal(context.calls.length, 1);
  assert.equal(context.calls[0].payload.tarikh, "2026-08-14");
  assert.equal(context.calls[0].payload.hari, "Jumaat");
  assert.equal(context.calls[0].payload.tarikh_balik, "2026-08-16");
  assert.equal(context.calls[0].payload.masa_balik_dijangka, "20:30");
});

test("weekend mapping remains same-day at 22:00", async () => {
  const context = createWrapperFixture({ leaveDate: "2026-08-15" });
  await context.wrappedApiPost("submitRequest", {
    jenis_permohonan: "OUTING_HUJUNG_MINGGU"
  });
  assert.equal(context.calls[0].payload.tarikh, "2026-08-15");
  assert.equal(context.calls[0].payload.tarikh_balik, "2026-08-15");
  assert.equal(context.calls[0].payload.masa_balik_dijangka, "22:00");
});

test("legacy overnight mapping remains empty when its leave-date field is not active", async () => {
  const context = createWrapperFixture({ leaveDate: "" });
  await context.wrappedApiPost("submitRequest", {
    jenis_permohonan: "PULANG_BERMALAM"
  });
  assert.equal(context.calls[0].payload.tarikh, "");
  assert.equal(context.calls[0].payload.tarikh_balik, "2026-08-16");
  assert.equal(context.calls[0].payload.masa_balik_dijangka, "20:30");
});

test("Cuti Semester, Kecemasan and Outing Biasa payloads remain untouched", async () => {
  for (const requestType of ["CUTI_SEMESTER", "KECEMASAN", "OUTING_BIASA"]) {
    const context = createWrapperFixture();
    const payload = {
      jenis_permohonan: requestType,
      tarikh: "2026-09-01",
      tarikh_balik: "2026-09-02",
      masa_balik_dijangka: "19:00"
    };
    await context.wrappedApiPost("submitRequest", payload);
    assert.deepEqual(
      JSON.parse(JSON.stringify(context.calls[0].payload)),
      payload
    );
  }
});
