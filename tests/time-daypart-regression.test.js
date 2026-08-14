const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function frontendContext() {
  const context = vm.createContext({
    Intl,
    Date,
    BM_MONTHS: ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"]
  });
  vm.runInContext([
    "const BM_MONTHS = globalThis.BM_MONTHS;",
    extractFunction(appSource, "getMalayDaypartLabel"),
    extractFunction(appSource, "normalizeTimeOnlyValue"),
    extractFunction(appSource, "parseFlexibleDate"),
    extractFunction(appSource, "getKualaLumpurParts"),
    extractFunction(appSource, "formatDisplayTime"),
    extractFunction(appSource, "formatDisplayDate"),
    extractFunction(appSource, "formatExpectedReturnTime"),
    extractFunction(appSource, "expectedReturnDisplay"),
    extractFunction(appSource, "getExpectedReturnDate")
  ].join("\n"), context);
  return context;
}

function gasContext() {
  const context = vm.createContext({ console, Intl, Date });
  vm.runInContext(gasSource, context);
  context.Utilities = {
    formatDate(value, timeZone, format) {
      assert.equal(timeZone, "Asia/Kuala_Lumpur");
      if (format === "HH:mm") {
        return new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone
        }).format(value);
      }
      if (format === "yyyy-MM-dd") {
        const parts = new Intl.DateTimeFormat("en-CA", {
          year: "numeric", month: "2-digit", day: "2-digit", timeZone
        }).formatToParts(value).reduce((result, part) => {
          if (part.type !== "literal") result[part.type] = part.value;
          return result;
        }, {});
        return `${parts.year}-${parts.month}-${parts.day}`;
      }
      if (format === "dd/MM/yyyy") return "16/08/2026";
      return "2026-08-16 22:00:00";
    }
  };
  return context;
}

test("canonical backend and frontend time normalizers preserve HH:mm and recover Sheet 1899 clocks", () => {
  const backend = gasContext();
  const frontend = frontendContext();
  const sheetTime = new Date("1899-12-30T15:04:35.000Z");
  for (const context of [backend, frontend]) {
    const normalize = context.normalizeSheetTimeValue_ || context.normalizeTimeOnlyValue;
    assert.equal(normalize("22:00"), "22:00");
    assert.equal(normalize("22:00:00"), "22:00");
    assert.equal(normalize(sheetTime), "22:00");
    assert.equal(normalize(""), "");
  }
});

test("expected return display and deadline use exactly 2026-08-16 22:00 Malaysia time", () => {
  const context = frontendContext();
  const record = { tarikh_balik: "2026-08-16", masa_balik_dijangka: "22:00" };
  assert.equal(context.expectedReturnDisplay(record), "16 Ogos 2026, 10:00 PTG");
  assert.equal(
    context.getExpectedReturnDate(record).getTime(),
    new Date("2026-08-16T22:00:00+08:00").getTime()
  );
  assert.equal(context.getExpectedReturnDate({
    tarikh_balik: "2026-08-16",
    masa_balik_dijangka: "1899-12-30T15:04:35.000Z"
  }).getTime(), new Date("2026-08-16T22:00:00+08:00").getTime());
});

test("backend late comparison and Telegram use normalized 22:00 without 1899 or historical GMT text", () => {
  const context = gasContext();
  const record = {
    tarikh_balik: "2026-08-16",
    masa_balik_dijangka: new Date("1899-12-30T15:04:35.000Z")
  };
  assert.equal(context.isHostelReturnLate_(new Date("2026-08-16T21:59:59+08:00"), record), false);
  assert.equal(context.isHostelReturnLate_(new Date("2026-08-16T22:00:01+08:00"), record), true);
  const telegram = context.formatTelegramExpectedReturn_(record);
  assert.equal(telegram, "16/08/2026 22:00");
  assert.doesNotMatch(telegram, /1899|GMT\+0655|Sat Dec 30/);
});

test("Sheet object mapping normalizes request and configuration time-only fields", () => {
  const context = gasContext();
  const sheetTime = new Date("1899-12-30T15:04:35.000Z");
  const sheet = {
    getDataRange: () => ({
      getValues: () => [
        ["request_id", "masa_balik_dijangka", "fixed_return_time", "application_open_time", "application_close_time", "earliest_departure_time"],
        ["R1", sheetTime, "22:00:00", "08:00", "18:00:00", "13:00"]
      ]
    })
  };
  const row = context.getRowsAsObjects_(sheet)[0];
  assert.deepEqual(JSON.parse(JSON.stringify(row)), {
    request_id: "R1",
    masa_balik_dijangka: "22:00",
    fixed_return_time: "22:00",
    application_open_time: "08:00",
    application_close_time: "18:00",
    earliest_departure_time: "13:00"
  });
});

test("BM daypart boundaries are shared and exact", () => {
  const frontend = frontendContext();
  const backend = gasContext();
  const cases = [
    ["00:59", "Malam"], ["01:00", "Pagi"], ["11:59", "Pagi"],
    ["12:00", "Tengah Hari"], ["12:59", "Tengah Hari"],
    ["13:00", "Petang"], ["18:59", "Petang"],
    ["19:00", "Malam"], ["23:59", "Malam"]
  ];
  cases.forEach(([time, expected]) => {
    const [hour, minute] = time.split(":").map(Number);
    assert.equal(frontend.getMalayDaypartLabel(hour, minute), expected, time);
    assert.equal(backend.getMalayDaypartLabel_(hour, minute), expected, time);
  });
  assert.doesNotMatch(appSource, /Selamat (?:Pagi|Tengah Hari|Petang|Malam)/);
});

test("no manual timezone compensation remains in expected-return formatting", () => {
  const source = extractFunction(appSource, "formatExpectedReturnTime");
  assert.doesNotMatch(source, /\+\s*8\s*\*\s*60|getUTCHours|getUTCMinutes/);
  assert.match(source, /normalizeTimeOnlyValue/);
});
