const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

const OUTING_TYPE_HEADERS = [
  "type_code",
  "display_name",
  "description",
  "active",
  "sort_order",
  "allowed_days",
  "application_open_time",
  "application_close_time",
  "fixed_return_time",
  "same_day_only",
  "require_leave_date",
  "require_return_date",
  "require_return_time",
  "require_guardian_phone",
  "require_guardian_relation",
  "require_emergency_reason",
  "require_purpose",
  "require_location",
  "require_vehicle",
  "require_warden_approval",
  "require_selfie",
  "config_version",
  "created_at",
  "created_by",
  "updated_at",
  "updated_by"
];

const ADMIN_USER_HEADERS = [
  "admin_id",
  "nama_admin",
  "pin",
  "status",
  "catatan",
  "created_at",
  "updated_at"
];

const AUDIT_HEADERS = [
  "timestamp",
  "action",
  "request_id",
  "user_role",
  "user_name",
  "details",
  "entity_type",
  "entity_id"
];

const EXPECTED_TYPE_CODES = [
  "OUTING_BIASA",
  "OUTING_HUJUNG_MINGGU",
  "KECEMASAN",
  "PULANG_BERMALAM",
  "CUTI_SEMESTER"
];

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.frozenRows = 0;
  }

  getLastRow() {
    return this.rows.length;
  }

  getLastColumn() {
    return this.rows.reduce((max, row) => Math.max(max, row.length), 0);
  }

  getRange(row, column, rowCount, columnCount) {
    return {
      getValues: () => Array.from({ length: rowCount }, (_, rowOffset) => (
        Array.from({ length: columnCount }, (_, columnOffset) => {
          const sourceRow = this.rows[row - 1 + rowOffset] || [];
          return sourceRow[column - 1 + columnOffset] === undefined
            ? ""
            : sourceRow[column - 1 + columnOffset];
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
      }
    };
  }

  getDataRange() {
    const rowCount = Math.max(this.getLastRow(), 1);
    const columnCount = Math.max(this.getLastColumn(), 1);
    return this.getRange(1, 1, rowCount, columnCount);
  }

  appendRow(row) {
    this.rows.push(row.slice());
  }

  setFrozenRows(count) {
    this.frozenRows = count;
  }
}

function createMigrationContext({ sheets = {}, properties = {} } = {}) {
  const sheetMap = new Map(Object.entries(sheets));
  const propertyValues = { ...properties };
  const spreadsheet = {
    getSheetByName(name) {
      return sheetMap.get(name) || null;
    },
    insertSheet(name) {
      const sheet = new FakeSheet(name);
      sheetMap.set(name, sheet);
      return sheet;
    }
  };

  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      openById() {
        return spreadsheet;
      }
    },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return Object.prototype.hasOwnProperty.call(propertyValues, key)
              ? propertyValues[key]
              : null;
          },
          setProperty(key, value) {
            propertyValues[key] = String(value);
          }
        };
      }
    },
    Utilities: {
      formatDate() {
        return "2026-08-03 09:00:00";
      }
    }
  });

  vm.runInContext(gasSource, context);
  return { context, sheetMap, propertyValues };
}

function rowsAsObjects(sheet) {
  const [headers, ...rows] = sheet.rows;
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

test("setupAdminOutingConfigV200 creates exact headers and five seed types once", () => {
  const { context, sheetMap } = createMigrationContext();

  const first = context.setupAdminOutingConfigV200();
  const second = context.setupAdminOutingConfigV200();

  assert.deepEqual(sheetMap.get("OUTING_TYPES").rows[0], OUTING_TYPE_HEADERS);
  assert.deepEqual(sheetMap.get("ADMIN_USERS").rows[0], ADMIN_USER_HEADERS);
  assert.deepEqual(sheetMap.get("AUDIT_LOG").rows[0], AUDIT_HEADERS);
  assert.deepEqual(rowsAsObjects(sheetMap.get("OUTING_TYPES")).map((row) => row.type_code), EXPECTED_TYPE_CODES);
  assert.deepEqual(Array.from(first.created_type_codes), EXPECTED_TYPE_CODES);
  assert.deepEqual(Array.from(second.created_type_codes), []);
  assert.equal(sheetMap.get("OUTING_TYPES").rows.length, 6);
});

test("migration appends audit headers without changing legacy rows or OUTING_REQUESTS", () => {
  const legacyAuditHeader = AUDIT_HEADERS.slice(0, 6);
  const legacyAuditRow = ["2026-07-26 12:00:00", "SUBMIT_REQUEST", "OUT-1", "Student", "Pelajar", "{}"];
  const requestRows = [
    ["request_id", "jenis_permohonan", "status"],
    ["OUT-1", "OUTING_BIASA", "SELESAI"]
  ];
  const auditSheet = new FakeSheet("AUDIT_LOG", [legacyAuditHeader, legacyAuditRow]);
  const requestSheet = new FakeSheet("OUTING_REQUESTS", requestRows);
  const { context } = createMigrationContext({
    sheets: {
      AUDIT_LOG: auditSheet,
      OUTING_REQUESTS: requestSheet
    }
  });

  context.setupAdminOutingConfigV200();

  assert.deepEqual(auditSheet.rows[0], AUDIT_HEADERS);
  assert.deepEqual(auditSheet.rows[1].slice(0, 6), legacyAuditRow);
  assert.equal(auditSheet.rows[1][6] || "", "");
  assert.equal(auditSheet.rows[1][7] || "", "");
  assert.deepEqual(requestSheet.rows, requestRows);
});

test("migration defaults OUTING_CONFIG_V2_ENABLED to false and never enables it", () => {
  const fresh = createMigrationContext();
  const result = fresh.context.setupAdminOutingConfigV200();

  assert.equal(fresh.propertyValues.OUTING_CONFIG_V2_ENABLED, "false");
  assert.equal(result.outing_config_v2_enabled, false);

  const existing = createMigrationContext({
    properties: { OUTING_CONFIG_V2_ENABLED: "true" }
  });
  existing.context.setupAdminOutingConfigV200();
  assert.equal(existing.propertyValues.OUTING_CONFIG_V2_ENABLED, "true");
  assert.doesNotMatch(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY,\s*"true"\)/);
});

test("rerunning migration preserves existing type rows and immutable type_code", () => {
  const { context, sheetMap } = createMigrationContext();
  context.setupAdminOutingConfigV200();
  const sheet = sheetMap.get("OUTING_TYPES");
  const displayNameIndex = OUTING_TYPE_HEADERS.indexOf("display_name");
  sheet.rows[1][displayNameIndex] = "Nama Sedia Ada";

  context.setupAdminOutingConfigV200();

  assert.equal(sheet.rows[1][0], "OUTING_BIASA");
  assert.equal(sheet.rows[1][displayNameIndex], "Nama Sedia Ada");
  assert.equal(sheet.rows.length, 6);
});

test("submitRequest keeps all legacy validators behind the v2 feature-gated resolver", () => {
  const submitSource = gasSource.slice(
    gasSource.indexOf("function submitRequest(payload)"),
    gasSource.indexOf("function approveRequest(payload)")
  );

  assert.match(submitSource, /resolveSubmissionOutingTypeConfigV200_/);
  assert.match(submitSource, /validateConfigDrivenSubmissionV200_/);
  for (const typeName of ["normal", "weekend", "emergency", "overnight", "semester"]) {
    assert.match(submitSource, new RegExp(`REQUEST_TYPE\\.${typeName}`));
  }
  assert.match(submitSource, /validateOvernightRequest_/);
  assert.match(submitSource, /validateSemesterRequest_/);
});
