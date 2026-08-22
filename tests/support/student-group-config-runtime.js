const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..", "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

const STUDENT_HEADERS = [
  "student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status",
  "catatan", "photo_file_id", "photo_updated_at"
];
const STUDENT_HEADERS_V240 = STUDENT_HEADERS.concat(["institution_code"]);
const GROUP_HEADERS = [
  "group_code", "display_name", "institution_required", "active", "sort_order",
  "config_version", "created_at", "created_by", "updated_at", "updated_by"
];
const INSTITUTION_HEADERS = [
  "institution_code", "display_name", "active", "sort_order", "config_version",
  "created_at", "created_by", "updated_at", "updated_by"
];
const ADMIN_HEADERS = ["admin_id", "nama_admin", "pin", "status", "catatan", "created_at", "updated_at"];
const AUDIT_HEADERS = ["timestamp", "action", "request_id", "user_role", "user_name", "details", "entity_type", "entity_id"];

class FakeSheet {
  constructor(name, rows = []) {
    this.name = name;
    this.rows = rows.map((row) => row.slice());
    this.frozenRows = 0;
  }

  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getRange(row, column, rowCount = 1, columnCount = 1) {
    return {
      getValues: () => Array.from({ length: rowCount }, (_, y) => Array.from({ length: columnCount }, (_, x) => {
        const value = (this.rows[row - 1 + y] || [])[column - 1 + x];
        return value === undefined ? "" : value;
      })),
      setValues: (values) => values.forEach((source, y) => {
        while (this.rows.length <= row - 1 + y) this.rows.push([]);
        source.forEach((value, x) => { this.rows[row - 1 + y][column - 1 + x] = value; });
      }),
      setValue: (value) => {
        while (this.rows.length <= row - 1) this.rows.push([]);
        this.rows[row - 1][column - 1] = value;
      },
      clearContent: () => {
        while (this.rows.length <= row - 1) this.rows.push([]);
        this.rows[row - 1][column - 1] = "";
      }
    };
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  appendRow(row) { this.rows.push(row.slice()); }
  setFrozenRows(count) { this.frozenRows = count; }
}

function groupRow(code, overrides = {}) {
  const value = {
    group_code: code,
    display_name: code,
    institution_required: code === "LI",
    active: true,
    sort_order: code === "A2" ? 10 : (code === "A3" ? 20 : 30),
    config_version: 1,
    created_at: "2026-08-22 09:00:00",
    created_by: "TEST",
    updated_at: "2026-08-22 09:00:00",
    updated_by: "TEST",
    ...overrides
  };
  return GROUP_HEADERS.map((header) => value[header] === undefined ? "" : value[header]);
}

function institutionRow(code, overrides = {}) {
  const value = {
    institution_code: code,
    display_name: code,
    active: true,
    sort_order: code === "UMK" ? 10 : 20,
    config_version: 1,
    created_at: "2026-08-22 09:00:00",
    created_by: "TEST",
    updated_at: "2026-08-22 09:00:00",
    updated_by: "TEST",
    ...overrides
  };
  return INSTITUTION_HEADERS.map((header) => value[header] === undefined ? "" : value[header]);
}

function studentRow({
  student_id = "A2-001", no_matrik = "001", kelas = "A2", status = "AKTIF", institution_code = ""
} = {}) {
  const value = {
    student_id, no_matrik, nama: "Pelajar Ujian", email: "", no_tel: "", kelas,
    jantina: "", status, catatan: "", photo_file_id: "", photo_updated_at: "", institution_code
  };
  return STUDENT_HEADERS_V240.map((header) => value[header]);
}

function createRuntime({ sheets = {}, properties = {} } = {}) {
  const sheetMap = new Map(Object.entries(sheets));
  const propertyValues = { ...properties };
  const spreadsheet = {
    getSheetByName: (name) => sheetMap.get(name) || null,
    insertSheet(name) {
      const sheet = new FakeSheet(name);
      sheetMap.set(name, sheet);
      return sheet;
    },
    getSpreadsheetTimeZone: () => "Asia/Kuala_Lumpur"
  };
  let lockCount = 0;
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => spreadsheet, getActive: () => spreadsheet },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => Object.prototype.hasOwnProperty.call(propertyValues, key) ? propertyValues[key] : null,
        setProperty: (key, value) => { propertyValues[key] = String(value); }
      })
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => { lockCount += 1; return true; }, releaseLock: () => {} })
    },
    Session: { getScriptTimeZone: () => "Asia/Kuala_Lumpur" },
    Utilities: { formatDate: () => "2026-08-22 09:00:00", getUuid: () => "uuid-test" }
  });
  vm.runInContext(gasSource, context);
  return { context, sheetMap, propertyValues, getLockCount: () => lockCount };
}

function configuredSheets(studentRows = []) {
  return {
    STUDENT_GROUPS: new FakeSheet("STUDENT_GROUPS", [
      GROUP_HEADERS, groupRow("A2"), groupRow("A3"), groupRow("LI")
    ]),
    LI_INSTITUTIONS: new FakeSheet("LI_INSTITUTIONS", [
      INSTITUTION_HEADERS, institutionRow("UMK"), institutionRow("UPM")
    ]),
    STUDENTS: new FakeSheet("STUDENTS", [STUDENT_HEADERS_V240, ...studentRows]),
    ADMIN_USERS: new FakeSheet("ADMIN_USERS", [
      ADMIN_HEADERS, ["ADM-001", "ADMIN TEST", "2468", "AKTIF", "", "", ""]
    ]),
    AUDIT_LOG: new FakeSheet("AUDIT_LOG", [AUDIT_HEADERS])
  };
}

module.exports = {
  ADMIN_HEADERS,
  AUDIT_HEADERS,
  FakeSheet,
  GROUP_HEADERS,
  INSTITUTION_HEADERS,
  STUDENT_HEADERS,
  STUDENT_HEADERS_V240,
  configuredSheets,
  createRuntime,
  groupRow,
  institutionRow,
  studentRow
};
