const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const gasSource = fs.readFileSync(
  path.join(__dirname, "..", "gas", "Code.gs"),
  "utf8"
);

function extractFunctionSource(source, functionName) {
  const marker = "function " + functionName;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, functionName + " must exist");

  const bodyStart = source.indexOf("{", start + marker.length);
  assert.notEqual(bodyStart, -1, functionName + " must have a body");

  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }

  throw new Error("Unable to extract " + functionName);
}

function createTimeNormalizerContext(overrides = {}) {
  const context = {
    SpreadsheetApp: {
      getActive: () => ({
        getSpreadsheetTimeZone: () => "Asia/Kuala_Lumpur"
      })
    },
    Session: {
      getScriptTimeZone: () => "Etc/UTC"
    },
    Utilities: {
      formatDate: () => {
        throw new Error("Unexpected formatDate call");
      }
    },
    ...overrides
  };

  vm.createContext(context);
  vm.runInContext(extractFunctionSource(gasSource, "normalizeSheetTimeValue_"), context);
  return context;
}

test("Sheet Date time cells use spreadsheet timezone and return canonical HH:mm without UTC serialization", () => {
  const sheetTimes = new Map([
    [new Date("1899-12-30T02:04:35.000Z").getTime(), "09:00"],
    [new Date("1899-12-30T10:04:35.000Z").getTime(), "17:00"],
    [new Date("1899-12-30T11:04:35.000Z").getTime(), "18:00"],
    [new Date("1899-12-30T15:04:35.000Z").getTime(), "22:00"]
  ]);
  const calls = [];
  const context = createTimeNormalizerContext({
    Utilities: {
      formatDate: (value, timeZone, format) => {
        calls.push({ value, timeZone, format });
        return sheetTimes.get(value.getTime());
      }
    }
  });

  const result = [
    context.normalizeSheetTimeValue_(new Date("1899-12-30T02:04:35.000Z")),
    context.normalizeSheetTimeValue_(new Date("1899-12-30T10:04:35.000Z")),
    context.normalizeSheetTimeValue_(new Date("1899-12-30T11:04:35.000Z")),
    context.normalizeSheetTimeValue_(new Date("1899-12-30T15:04:35.000Z"))
  ];

  assert.deepEqual(result, ["09:00", "17:00", "18:00", "22:00"]);
  assert.equal(calls.length, 4);
  assert.ok(calls.every((call) => call.timeZone === "Asia/Kuala_Lumpur"));
  assert.ok(calls.every((call) => call.format === "HH:mm"));
});

test("valid HH:mm strings are preserved and do not invoke date formatting", () => {
  const context = createTimeNormalizerContext();
  assert.equal(context.normalizeSheetTimeValue_("09:00"), "09:00");
  assert.equal(context.normalizeSheetTimeValue_(" 17:00 "), "17:00");
  assert.equal(context.normalizeSheetTimeValue_("22:00:00"), "22:00");
});

test("empty and invalid stored time values normalize to an empty string", () => {
  const context = createTimeNormalizerContext();
  assert.equal(context.normalizeSheetTimeValue_(""), "");
  assert.equal(context.normalizeSheetTimeValue_(null), "");
  assert.equal(context.normalizeSheetTimeValue_(undefined), "");
  assert.equal(context.normalizeSheetTimeValue_("25:61"), "");
  assert.equal(context.normalizeSheetTimeValue_("not-a-time"), "");
  assert.equal(context.normalizeSheetTimeValue_(new Date("invalid")), "");
});

test("Sheet Date normalization always uses Asia/Kuala_Lumpur", () => {
  let usedTimeZone = "";
  const context = createTimeNormalizerContext({
    Utilities: {
      formatDate: (_value, timeZone) => {
        usedTimeZone = timeZone;
        return "09:00";
      }
    }
  });

  assert.equal(
    context.normalizeSheetTimeValue_(new Date("1899-12-30T02:04:35.000Z")),
    "09:00"
  );
  assert.equal(usedTimeZone, "Asia/Kuala_Lumpur");
});

test("shared OUTING_TYPES mapper normalizes all three API time fields", () => {
  const mapperSource = extractFunctionSource(gasSource, "normalizeOutingTypeRecord_");
  assert.match(mapperSource, /OUTING_TYPE_TIME_FIELDS\.forEach/);
  assert.match(mapperSource, /result\[field\]\s*=\s*normalizeSheetTimeValue_\(result\[field\]\)/);

  const adminSource = extractFunctionSource(gasSource, "getAdminOutingTypes");
  const publicSource = extractFunctionSource(gasSource, "getOutingTypes");
  assert.match(adminSource, /\.map\(normalizeOutingTypeRecord_\)/);
  assert.match(publicSource, /\.map\(normalizeOutingTypeRecord_\)/);
  assert.doesNotMatch(
    extractFunctionSource(gasSource, "normalizeSheetTimeValue_"),
    /toISOString/
  );
});

test("actual Admin list action returns canonical Sheet times at its response boundary", () => {
  const dateValues = {
    open: new Date("1899-12-30T02:04:35.000Z"),
    close: new Date("1899-12-30T10:04:35.000Z"),
    fixed: new Date("1899-12-30T11:04:35.000Z")
  };
  const formattedTimes = new Map([
    [dateValues.open.getTime(), "09:00"],
    [dateValues.close.getTime(), "17:00"],
    [dateValues.fixed.getTime(), "18:00"]
  ]);
  const headers = [
    "type_code",
    "display_name",
    "active",
    "sort_order",
    "application_open_time",
    "application_close_time",
    "fixed_return_time",
    "config_version"
  ];
  const context = {
    HEADERS: { OUTING_TYPES: headers },
    OUTING_TYPE_TIME_FIELDS: [
      "application_open_time",
      "application_close_time",
      "fixed_return_time"
    ],
    OUTING_TYPE_BOOLEAN_FIELDS: ["active"],
    SHEETS: { outingTypes: "OUTING_TYPES" },
    SpreadsheetApp: {
      getActive: () => ({
        getSpreadsheetTimeZone: () => "Asia/Kuala_Lumpur"
      })
    },
    Session: { getScriptTimeZone: () => "Etc/UTC" },
    Utilities: {
      formatDate: (value, timeZone, format) => {
        assert.equal(timeZone, "Asia/Kuala_Lumpur");
        assert.equal(format, "HH:mm");
        return formattedTimes.get(value.getTime());
      }
    },
    validateAdminCredentials_: () => ({ admin_id: "BETA_ADMIN" }),
    getSheet_: () => ({ name: "OUTING_TYPES" }),
    getRowsAsObjects_: () => [
      {
        type_code: "TEST_BETA_ONLY",
        display_name: "Test Beta Only",
        active: true,
        sort_order: 2,
        application_open_time: dateValues.open,
        application_close_time: dateValues.close,
        fixed_return_time: dateValues.fixed,
        config_version: 1
      },
      {
        type_code: "OUTING_BIASA",
        display_name: "Outing Biasa",
        active: true,
        sort_order: 1,
        application_open_time: "17:00",
        application_close_time: "",
        fixed_return_time: "22:00",
        config_version: 1
      }
    ],
    normalizeText_: (value) => String(value || "").trim().toLowerCase()
  };

  vm.createContext(context);
  [
    "normalizeSheetTimeValue_",
    "normalizeStoredBoolean_",
    "normalizeOutingTypeRecord_",
    "pickDefined_",
    "toAdminOutingType_",
    "sortOutingTypes_",
    "getAdminOutingTypes"
  ].forEach((functionName) => {
    vm.runInContext(extractFunctionSource(gasSource, functionName), context);
  });

  const rows = context.getAdminOutingTypes({
    admin_id: "BETA_ADMIN",
    pin: "not-exposed"
  });

  assert.deepEqual(
    JSON.parse(JSON.stringify(rows.map((row) => ({
      type_code: row.type_code,
      application_open_time: row.application_open_time,
      application_close_time: row.application_close_time,
      fixed_return_time: row.fixed_return_time
    })))),
    [
      {
        type_code: "OUTING_BIASA",
        application_open_time: "17:00",
        application_close_time: "",
        fixed_return_time: "22:00"
      },
      {
        type_code: "TEST_BETA_ONLY",
        application_open_time: "09:00",
        application_close_time: "17:00",
        fixed_return_time: "18:00"
      }
    ]
  );
});
