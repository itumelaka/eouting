const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

const ADMIN_HEADERS = ["admin_id", "nama_admin", "pin", "status", "catatan", "created_at", "updated_at"];
const AUDIT_HEADERS = ["timestamp", "action", "request_id", "user_role", "user_name", "details", "entity_type", "entity_id"];
const OUTING_HEADERS = [
  "type_code", "display_name", "description", "active", "sort_order", "allowed_days",
  "application_open_time", "application_close_time", "fixed_return_time", "same_day_only",
  "require_leave_date", "require_return_date", "require_return_time", "require_guardian_phone",
  "require_guardian_relation", "require_emergency_reason", "require_purpose", "require_location",
  "require_vehicle", "require_warden_approval", "require_selfie", "config_version", "created_at",
  "created_by", "updated_at", "updated_by", "departure_allowed_days", "earliest_departure_time"
];
const PUBLIC_FIELDS = [
  "type_code", "display_name", "description", "sort_order", "allowed_days",
  "application_open_time", "application_close_time", "departure_allowed_days", "earliest_departure_time", "fixed_return_time", "same_day_only",
  "require_leave_date", "require_return_date", "require_return_time", "require_guardian_phone",
  "require_guardian_relation", "require_emergency_reason", "require_purpose", "require_location",
  "require_vehicle", "require_warden_approval", "require_selfie"
];

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
  }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getRange(row, column, rowCount, columnCount) {
    return {
      getValues: () => Array.from({ length: rowCount }, (_, rowOffset) => (
        Array.from({ length: columnCount }, (_, columnOffset) => {
          const sourceRow = this.rows[row - 1 + rowOffset] || [];
          const value = sourceRow[column - 1 + columnOffset];
          return value === undefined ? "" : value;
        })
      )),
      setValues: (values) => {
        values.forEach((sourceRow, rowOffset) => {
          const targetRowIndex = row - 1 + rowOffset;
          while (this.rows.length <= targetRowIndex) this.rows.push([]);
          sourceRow.forEach((value, columnOffset) => {
            this.rows[targetRowIndex][column - 1 + columnOffset] = value;
          });
        });
      },
      setValue: (value) => {
        const targetRowIndex = row - 1;
        while (this.rows.length <= targetRowIndex) this.rows.push([]);
        this.rows[targetRowIndex][column - 1] = value;
      },
      clearContent: () => {
        const targetRowIndex = row - 1;
        while (this.rows.length <= targetRowIndex) this.rows.push([]);
        this.rows[targetRowIndex][column - 1] = "";
      }
    };
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  appendRow(row) { this.rows.push(row.slice()); }
  setFrozenRows() {}
}

function createContext({ adminStatus = "AKTIF", featureEnabled = false } = {}) {
  const sheets = new Map();
  sheets.set("ADMIN_USERS", new FakeSheet("ADMIN_USERS", [
    ADMIN_HEADERS,
    ["ADM-001", "ADMIN TEST", "2468", adminStatus, "", "2026-08-03", "2026-08-03"]
  ]));
  sheets.set("AUDIT_LOG", new FakeSheet("AUDIT_LOG", [AUDIT_HEADERS]));
  const properties = { OUTING_CONFIG_V2_ENABLED: featureEnabled ? "true" : "false" };
  let lockCount = 0;
  let releaseCount = 0;
  const spreadsheet = {
    getSheetByName(name) { return sheets.get(name) || null; },
    insertSheet(name) {
      const sheet = new FakeSheet(name);
      sheets.set(name, sheet);
      return sheet;
    }
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => spreadsheet },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null,
        setProperty: (key, value) => { properties[key] = String(value); }
      })
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => { lockCount += 1; return true; },
        releaseLock: () => { releaseCount += 1; }
      })
    },
    Utilities: { formatDate: () => "2026-08-03 10:00:00" }
  });
  vm.runInContext(gasSource, context);
  return {
    context,
    sheets,
    properties,
    getLockCounts: () => ({ lockCount, releaseCount })
  };
}

function adminPayload(extra = {}) {
  return { admin_id: "ADM-001", pin: "2468", ...extra };
}

function completeConfig(typeCode = "LAWATAN_KELUARGA") {
  return {
    type_code: typeCode,
    display_name: "Lawatan Keluarga",
    description: "Lawatan keluarga yang diluluskan.",
    active: true,
    sort_order: 10,
    allowed_days: "SABTU,AHAD",
    application_open_time: "08:00",
    application_close_time: "18:00",
    departure_allowed_days: "JUMAAT",
    earliest_departure_time: "14:00",
    fixed_return_time: "22:00",
    same_day_only: true,
    require_leave_date: true,
    require_return_date: true,
    require_return_time: true,
    require_guardian_phone: true,
    require_guardian_relation: true,
    require_emergency_reason: false,
    require_purpose: true,
    require_location: true,
    require_vehicle: true,
    require_warden_approval: true,
    require_selfie: true
  };
}

function seed(context) {
  context.setupAdminOutingConfigV200();
}

function sheetObjects(sheet) {
  const [headers, ...rows] = sheet.rows;
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

test("admin login succeeds without returning PIN", () => {
  const { context } = createContext();
  const result = context.loginAdmin(adminPayload());
  assert.equal(result.admin_id, "ADM-001");
  assert.equal(result.nama_admin, "ADMIN TEST");
  assert.equal(Object.prototype.hasOwnProperty.call(result, "pin"), false);
  assert.doesNotMatch(JSON.stringify(result), /2468/);
});

test("admin login rejects wrong PIN and inactive accounts", () => {
  assert.throws(() => createContext().context.loginAdmin(adminPayload({ pin: "0000" })), /PIN|aktif/i);
  assert.throws(() => createContext({ adminStatus: "TIDAK_AKTIF" }).context.loginAdmin(adminPayload()), /PIN|aktif/i);
});

test("public config falls back to five safe legacy types while feature flag is false", () => {
  const { context, properties } = createContext({ featureEnabled: false });
  const rows = context.getOutingTypes();
  assert.equal(rows.length, 5);
  assert.equal(properties.OUTING_CONFIG_V2_ENABLED, "false");
  rows.forEach((row) => {
    assert.deepEqual(Object.keys(row), PUBLIC_FIELDS);
    assert.equal(Object.prototype.hasOwnProperty.call(row, "active"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, "config_version"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(row, "created_by"), false);
    assert.equal(typeof row.require_selfie, "boolean");
  });
});

test("enabled public config returns active rows only in sort order", () => {
  const { context, sheets } = createContext({ featureEnabled: true });
  seed(context);
  const sheet = sheets.get("OUTING_TYPES");
  const activeIndex = OUTING_HEADERS.indexOf("active");
  const sortIndex = OUTING_HEADERS.indexOf("sort_order");
  sheet.rows[1][sortIndex] = 20;
  sheet.rows[2][activeIndex] = false;

  const rows = context.getOutingTypes();
  assert.equal(rows.length, 4);
  assert.equal(rows.some((row) => row.type_code === "OUTING_HUJUNG_MINGGU"), false);
  assert.equal(rows.at(-1).type_code, "OUTING_BIASA");
  rows.forEach((row) => assert.deepEqual(Object.keys(row), PUBLIC_FIELDS));
});

test("admin config read requires credentials and includes metadata without admin data", () => {
  const { context } = createContext();
  seed(context);
  assert.throws(() => context.getAdminOutingTypes({}), /Admin|PIN/i);
  const rows = context.getAdminOutingTypes(adminPayload());
  assert.equal(rows.length, 5);
  assert.equal(rows[0].config_version, 1);
  assert.ok(rows[0].created_at);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "pin"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "nama_admin"), false);
});

test("create validates fields, prevents duplicates and uses a script lock", () => {
  const runtime = createContext();
  seed(runtime.context);
  const created = runtime.context.createOutingType(adminPayload({ outing_type: completeConfig() }));
  assert.equal(created.type_code, "LAWATAN_KELUARGA");
  assert.equal(created.config_version, 1);
  assert.deepEqual(runtime.getLockCounts(), { lockCount: 1, releaseCount: 1 });
  assert.throws(
    () => runtime.context.createOutingType(adminPayload({ outing_type: completeConfig("lawatan_keluarga") })),
    /telah wujud/i
  );
  assert.throws(
    () => runtime.context.createOutingType(adminPayload({ outing_type: { ...completeConfig("JENIS_BARU"), allowed_days: "MONDAY" } })),
    /allowed_days/i
  );
  assert.throws(
    () => runtime.context.createOutingType(adminPayload({ outing_type: { ...completeConfig("JENIS_BARU"), departure_allowed_days: "FRIDAY" } })),
    /allowed_days/i
  );
  assert.throws(
    () => runtime.context.createOutingType(adminPayload({ outing_type: { ...completeConfig("JENIS_BARU"), earliest_departure_time: "25:00" } })),
    /earliest_departure_time/i
  );
  assert.throws(
    () => runtime.context.createOutingType(adminPayload({ outing_type: { ...completeConfig("JENIS_BARU"), require_selfie: "true" } })),
    /boolean/i
  );
});

test("update rejects immutable type_code and optimistic version conflicts", () => {
  const { context } = createContext();
  seed(context);
  assert.throws(() => context.updateOutingType(adminPayload({
    type_code: "OUTING_BIASA",
    expected_config_version: 1,
    outing_type: { type_code: "OUTING_BARU", display_name: "Nama Baru" }
  })), /tidak boleh diubah/i);
  assert.throws(() => context.updateOutingType(adminPayload({
    type_code: "OUTING_BIASA",
    expected_config_version: 99,
    outing_type: { display_name: "Nama Baru" }
  })), /CONFIG_VERSION_CONFLICT/);
});

test("update increments version, preserves creation metadata and audits safe changes", () => {
  const { context, sheets } = createContext();
  seed(context);
  const before = context.getAdminOutingTypes(adminPayload())[0];
  const updated = context.updateOutingType(adminPayload({
    type_code: before.type_code,
    expected_config_version: before.config_version,
    outing_type: {
      display_name: "Outing Harian",
      departure_allowed_days: "JUMAAT",
      earliest_departure_time: "17:00"
    }
  }));
  assert.equal(updated.config_version, 2);
  assert.equal(updated.created_at, before.created_at);
  assert.equal(updated.created_by, before.created_by);
  const audit = sheetObjects(sheets.get("AUDIT_LOG")).at(-1);
  assert.equal(audit.action, "UPDATE_OUTING_TYPE");
  assert.equal(audit.entity_type, "OUTING_TYPE");
  assert.equal(audit.entity_id, before.type_code);
  assert.equal(audit.user_name, "ADM-001");
  assert.match(String(audit.details), /departure_allowed_days/);
  assert.match(String(audit.details), /earliest_departure_time/);
  assert.doesNotMatch(String(audit.details), /2468/);
});

test("update explicitly clears existing application window times and blank survives reread", () => {
  const { context, sheets } = createContext();
  seed(context);
  const before = context.getAdminOutingTypes(adminPayload())
    .find((type) => type.type_code === "OUTING_BIASA");
  const sheet = sheets.get("OUTING_TYPES");
  const closeTimeIndex = OUTING_HEADERS.indexOf("application_close_time");
  const rowIndex = sheet.rows.findIndex((row) => row[0] === before.type_code);
  sheet.rows[rowIndex][closeTimeIndex] = "12:00";

  const updated = context.updateOutingType(adminPayload({
    type_code: before.type_code,
    expected_config_version: before.config_version,
    outing_type: {
      application_open_time: "",
      application_close_time: ""
    }
  }));

  assert.equal(updated.application_open_time, "");
  assert.equal(updated.application_close_time, "");
  assert.equal(sheet.rows[rowIndex][OUTING_HEADERS.indexOf("application_open_time")], "");
  assert.equal(sheet.rows[rowIndex][closeTimeIndex], "");
  const reloaded = context.getAdminOutingTypes(adminPayload())
    .find((type) => type.type_code === before.type_code);
  assert.equal(reloaded.application_open_time, "");
  assert.equal(reloaded.application_close_time, "");
});

test("update explicitly clears fixed return time as a true blank and preserves non-blank updates", () => {
  const { context, sheets } = createContext();
  seed(context);
  const sheet = sheets.get("OUTING_TYPES");
  const before = context.getAdminOutingTypes(adminPayload())
    .find((type) => type.type_code === "OUTING_BIASA");
  const rowIndex = sheet.rows.findIndex((row) => row[0] === before.type_code);
  const fixedTimeIndex = OUTING_HEADERS.indexOf("fixed_return_time");
  assert.equal(sheet.rows[rowIndex][fixedTimeIndex], "22:00");

  const cleared = context.updateOutingType(adminPayload({
    type_code: before.type_code,
    expected_config_version: before.config_version,
    outing_type: { fixed_return_time: "" }
  }));
  assert.equal(cleared.fixed_return_time, "");
  assert.equal(sheet.rows[rowIndex][fixedTimeIndex], "");
  assert.notEqual(sheet.rows[rowIndex][fixedTimeIndex], "00:00");
  assert.notEqual(sheet.rows[rowIndex][fixedTimeIndex], "12:00");

  const reloadedBlank = context.getAdminOutingTypes(adminPayload())
    .find((type) => type.type_code === before.type_code);
  assert.equal(reloadedBlank.fixed_return_time, "");

  const restored = context.updateOutingType(adminPayload({
    type_code: before.type_code,
    expected_config_version: cleared.config_version,
    outing_type: { fixed_return_time: "21:15" }
  }));
  assert.equal(restored.fixed_return_time, "21:15");
  assert.equal(sheet.rows[rowIndex][fixedTimeIndex], "21:15");
});

test("toggle changes only active, increments version and emits activate/deactivate audit", () => {
  const { context, sheets } = createContext();
  seed(context);
  const disabled = context.toggleOutingType(adminPayload({
    type_code: "OUTING_BIASA",
    expected_config_version: 1,
    active: false
  }));
  assert.equal(disabled.active, false);
  assert.equal(disabled.config_version, 2);
  let audit = sheetObjects(sheets.get("AUDIT_LOG")).at(-1);
  assert.equal(audit.action, "DEACTIVATE_OUTING_TYPE");
  assert.equal(audit.entity_id, "OUTING_BIASA");

  const enabled = context.toggleOutingType(adminPayload({
    type_code: "OUTING_BIASA",
    expected_config_version: 2,
    active: true
  }));
  assert.equal(enabled.config_version, 3);
  audit = sheetObjects(sheets.get("AUDIT_LOG")).at(-1);
  assert.equal(audit.action, "ACTIVATE_OUTING_TYPE");
});

test("no delete API exists and admin writes are POST-only", () => {
  assert.doesNotMatch(gasSource, /function\s+deleteOutingType|action\s*===\s*["']deleteOutingType/);
  const getRouter = gasSource.slice(gasSource.indexOf("function doGet"), gasSource.indexOf("function doPost"));
  for (const action of ["createOutingType", "updateOutingType", "toggleOutingType", "getAdminOutingTypes", "loginAdmin"]) {
    assert.doesNotMatch(getRouter, new RegExp(action));
  }
});

test("submitRequest preserves legacy validation while supporting the feature-gated v2 resolver", () => {
  const submitSource = gasSource.slice(
    gasSource.indexOf("function submitRequest(payload)"),
    gasSource.indexOf("function approveRequest(payload)")
  );
  assert.match(submitSource, /resolveSubmissionOutingTypeConfigV200_/);
  assert.match(submitSource, /if \(submissionConfig\)/);
  assert.match(submitSource, /else \{/);
  for (const typeName of ["normal", "weekend", "emergency", "overnight", "semester"]) {
    assert.match(submitSource, new RegExp(`REQUEST_TYPE\\.${typeName}`));
  }
});
