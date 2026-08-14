const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const OUTING_HEADERS = [
  "type_code", "display_name", "description", "active", "sort_order", "allowed_days",
  "application_open_time", "application_close_time", "fixed_return_time", "same_day_only",
  "require_leave_date", "require_return_date", "require_return_time", "require_guardian_phone",
  "require_guardian_relation", "require_emergency_reason", "require_purpose", "require_location",
  "require_vehicle", "require_warden_approval", "require_selfie", "config_version", "created_at",
  "created_by", "updated_at", "updated_by", "departure_allowed_days", "earliest_departure_time"
];

class FakeSheet {
  constructor(rows) { this.rows = rows.map((row) => row.slice()); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
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
      setValues: (values) => values.forEach((sourceRow, rowOffset) => {
        const targetIndex = row - 1 + rowOffset;
        while (this.rows.length <= targetIndex) this.rows.push([]);
        sourceRow.forEach((value, columnOffset) => {
          this.rows[targetIndex][column - 1 + columnOffset] = value;
        });
      })
    };
  }
  getDataRange() {
    return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1));
  }
  appendRow(row) { this.rows.push(row.slice()); }
}

function malaysiaParts(date) {
  const shifted = new Date(new Date(date).getTime() + (8 * 60 * 60 * 1000));
  const pad = (value) => String(value).padStart(2, "0");
  return {
    date: `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    hour: pad(shifted.getUTCHours()),
    minute: pad(shifted.getUTCMinutes()),
    second: pad(shifted.getUTCSeconds())
  };
}

function createContext({ featureEnabled = false, rows = [] } = {}) {
  const sheets = new Map();
  if (rows.length) sheets.set("OUTING_TYPES", new FakeSheet([OUTING_HEADERS, ...rows]));
  sheets.set("STUDENTS", new FakeSheet([
    ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan"],
    ["A3-001", "A3001", "PELAJAR UJIAN", "student@example.test", "", "A3", "P", "AKTIF", ""]
  ]));
  sheets.set("OUTING_REQUESTS", new FakeSheet([]));
  sheets.set("AUDIT_LOG", new FakeSheet([]));
  const properties = { OUTING_CONFIG_V2_ENABLED: featureEnabled ? "true" : "false" };
  let scriptLockHeld = false;
  const lockEvents = [];
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet: (name) => {
      const sheet = new FakeSheet([]);
      sheets.set(name, sheet);
      return sheet;
    }
  };
  const context = vm.createContext({
    console,
    SpreadsheetApp: {
      openById: () => spreadsheet,
      flush: () => {
        assert.equal(scriptLockHeld, true, "request append must flush while ScriptLock is held");
        lockEvents.push("flush");
      }
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => {
          assert.equal(scriptLockHeld, false);
          scriptLockHeld = true;
          lockEvents.push("tryLock");
          return true;
        },
        releaseLock: () => {
          assert.equal(scriptLockHeld, true);
          lockEvents.push("releaseLock");
          scriptLockHeld = false;
        }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : null
      })
    },
    Utilities: {
      formatDate: (date, timezone, format) => {
        assert.equal(timezone, "Asia/Kuala_Lumpur");
        const parts = malaysiaParts(date);
        if (format === "yyyy-MM-dd") return parts.date;
        if (format === "HH:mm") return `${parts.hour}:${parts.minute}`;
        if (format === "H") return String(Number(parts.hour));
        if (format === "m") return String(Number(parts.minute));
        return `${parts.date} ${parts.hour}:${parts.minute}:${parts.second}`;
      }
    }
  });
  vm.runInContext(gasSource, context);
  context.__testSheets = sheets;
  context.__testLockEvents = lockEvents;
  return context;
}

function completeConfig(overrides = {}) {
  const config = {
    type_code: "LAWATAN_KELUARGA",
    display_name: "Lawatan Keluarga",
    description: "Konfigurasi ujian.",
    active: true,
    sort_order: 10,
    allowed_days: "ISNIN",
    application_open_time: "",
    application_close_time: "",
    departure_allowed_days: "",
    earliest_departure_time: "",
    fixed_return_time: "",
    same_day_only: false,
    require_leave_date: false,
    require_return_date: false,
    require_return_time: false,
    require_guardian_phone: false,
    require_guardian_relation: false,
    require_emergency_reason: false,
    require_purpose: false,
    require_location: false,
    require_vehicle: false,
    require_warden_approval: true,
    require_selfie: true,
    config_version: 3,
    created_at: "2026-08-03 09:00:00",
    created_by: "ADM-001",
    updated_at: "2026-08-03 09:00:00",
    updated_by: "ADM-001",
    ...overrides
  };
  return OUTING_HEADERS.map((header) => config[header] === undefined ? "" : config[header]);
}

function testNow(context, iso = "2026-08-03T02:00:00Z") {
  return vm.runInContext(`new Date(${JSON.stringify(iso)})`, context);
}

function requestHeaders(context) {
  return Array.from(vm.runInContext("HEADERS.OUTING_REQUESTS.slice()", context));
}

function validate(context, config, payload = {}, iso) {
  return context.validateConfigDrivenSubmissionV200_(payload, config, testNow(context, iso));
}

test("flag false returns the untouched legacy path without requiring OUTING_TYPES", () => {
  const context = createContext({ featureEnabled: false });
  assert.equal(context.resolveSubmissionOutingTypeConfigV200_("OUTING_BIASA"), null);
});

test("submitRequest uses legacy validation while the flag is false", () => {
  const context = createContext({ featureEnabled: false });
  assert.throws(() => context.submitRequest({
    student_id: "A3-001",
    no_matrik: "A3001",
    jenis_permohonan: "KECEMASAN"
  }), /Sebab kecemasan diperlukan/);
  assert.equal(context.__testSheets.get("OUTING_TYPES"), undefined);
});

test("flag true resolves type_code case-insensitively from OUTING_TYPES", () => {
  const context = createContext({ featureEnabled: true, rows: [completeConfig()] });
  const config = context.resolveSubmissionOutingTypeConfigV200_("lawatan_keluarga");
  assert.equal(config.type_code, "LAWATAN_KELUARGA");
  assert.equal(config.config_version, 3);
});

test("submitRequest uses the active Sheet config, auto-approval rule and existing duplicate guard", () => {
  const row = completeConfig({
    allowed_days: "AHAD,ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU",
    require_warden_approval: false,
    fixed_return_time: "22:00"
  });
  const context = createContext({ featureEnabled: true, rows: [row] });
  const payload = {
    student_id: "A3-001",
    no_matrik: "A3001",
    jenis_permohonan: "lawatan_keluarga",
    masa_balik_dijangka: "19:00"
  };
  const result = context.submitRequest(payload);
  assert.equal(result.jenis_permohonan, "LAWATAN_KELUARGA");
  assert.equal(result.masa_balik_dijangka, "22:00");
  assert.equal(result.status, "DILULUSKAN_WARDEN");
  assert.equal(result.warden_approve_by, "AUTO_CONFIG_V2");
  assert.deepEqual(context.__testLockEvents, ["tryLock", "flush", "releaseLock"]);
  assert.throws(() => context.submitRequest(payload), /permohonan aktif/);
  assert.deepEqual(context.__testLockEvents, [
    "tryLock", "flush", "releaseLock", "tryLock", "releaseLock"
  ]);
});

test("config-driven approval-required requests persist the canonical pending status", () => {
  const row = completeConfig({
    allowed_days: "AHAD,ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU",
    require_warden_approval: true
  });
  const context = createContext({ featureEnabled: true, rows: [row] });
  const result = context.submitRequest({
    student_id: "A3-001",
    no_matrik: "A3001",
    jenis_permohonan: "lawatan_keluarga"
  });
  const persisted = context.findRowByRequestId_(result.request_id).record;
  assert.equal(result.status, "MENUNGGU_KELULUSAN");
  assert.equal(persisted.status, "MENUNGGU_KELULUSAN");
});

test("all five legacy outing types persist the canonical pending status", () => {
  const cases = [
    ["OUTING_BIASA", {}],
    ["OUTING_HUJUNG_MINGGU", {
      tarikh: "2099-01-04", tarikh_balik: "2099-01-04", masa_balik_dijangka: "22:00"
    }],
    ["KECEMASAN", { sebab_kecemasan: "Rawatan segera" }],
    ["PULANG_BERMALAM", { tarikh_balik: "2099-01-05", masa_balik_dijangka: "18:00" }],
    ["CUTI_SEMESTER", {
      tarikh: "2099-01-04", tarikh_balik: "2099-01-10", masa_balik_dijangka: "18:00",
      lokasi: "Rumah keluarga", telefon_waris: "0123456789"
    }]
  ];

  cases.forEach(([jenisPermohonan, extraPayload]) => {
    const context = createContext({ featureEnabled: false });
    context.isOutingBiasaOpen_ = () => true;
    const result = context.submitRequest({
      student_id: "A3-001",
      no_matrik: "A3001",
      jenis_permohonan: jenisPermohonan,
      ...extraPayload
    });
    assert.equal(result.status, "MENUNGGU_KELULUSAN", jenisPermohonan);
    assert.equal(context.findRowByRequestId_(result.request_id).record.status, "MENUNGGU_KELULUSAN", jenisPermohonan);
  });
});

test("request append maps values to the Sheet's actual header order and reads status back", () => {
  const context = createContext({ featureEnabled: false });
  context.isOutingBiasaOpen_ = () => true;
  const headers = requestHeaders(context);
  const reorderedHeaders = headers.filter((header) => header !== "status").concat("status");
  context.__testSheets.get("OUTING_REQUESTS").rows = [reorderedHeaders];

  const result = context.submitRequest({
    student_id: "A3-001", no_matrik: "A3001", jenis_permohonan: "OUTING_BIASA"
  });
  const persisted = context.findRowByRequestId_(result.request_id).record;

  assert.equal(persisted.request_id, result.request_id);
  assert.equal(persisted.nama, "PELAJAR UJIAN");
  assert.equal(persisted.status, "MENUNGGU_KELULUSAN");
  assert.equal(result.status, persisted.status);
});

test("blank or invalid computed initial statuses are rejected before persistence", () => {
  const context = createContext({ featureEnabled: false });
  for (const status of [undefined, null, "", " ", "STATUS_REKAAN"]) {
    assert.throws(() => context.validateInitialRequestStatus_(status), /Status awal permohonan tidak sah/);
  }
  assert.equal(context.validateInitialRequestStatus_("MENUNGGU_KELULUSAN"), "MENUNGGU_KELULUSAN");
  assert.equal(context.validateInitialRequestStatus_("DILULUSKAN_WARDEN"), "DILULUSKAN_WARDEN");
  assert.equal(context.__testSheets.get("OUTING_REQUESTS").rows.length, 0);
});

test("blank authoritative status is not mapped to a visual pending state", () => {
  const start = appSource.indexOf("function mapLiveStatus(status)");
  const end = appSource.indexOf("function parseDateValue", start);
  const context = vm.createContext({
    STATUS: {
      pending: "Menunggu Kelulusan", approved: "Diluluskan Warden", rejected: "Ditolak Warden",
      studentCancelled: "Dibatalkan oleh Pelajar", out: "Sedang Keluar", returned: "Sudah Pulang"
    }
  });
  vm.runInContext(appSource.slice(start, end), context);
  assert.equal(context.mapLiveStatus(""), "Status Tidak Diketahui");
  assert.notEqual(context.mapLiveStatus(""), "Menunggu Kelulusan");
  assert.equal(context.mapLiveStatus("MENUNGGU_KELULUSAN"), "Menunggu Kelulusan");
});

test("enabled resolver rejects missing, inactive and malformed configuration safely", () => {
  assert.throws(
    () => createContext({ featureEnabled: true }).resolveSubmissionOutingTypeConfigV200_("LAWATAN_KELUARGA"),
    /Konfigurasi jenis outing tidak sah/
  );
  assert.throws(
    () => createContext({ featureEnabled: true, rows: [completeConfig()] })
      .resolveSubmissionOutingTypeConfigV200_("TIADA_JENIS"),
    /tidak tersedia/
  );
  assert.throws(
    () => createContext({ featureEnabled: true, rows: [completeConfig({ active: false })] })
      .resolveSubmissionOutingTypeConfigV200_("LAWATAN_KELUARGA"),
    /tidak aktif/
  );
  assert.throws(
    () => createContext({ featureEnabled: true, rows: [completeConfig({ require_selfie: "MUNGKIN" })] })
      .resolveSubmissionOutingTypeConfigV200_("LAWATAN_KELUARGA"),
    /Konfigurasi jenis outing tidak sah/
  );
});

test("all configurable required text fields are enforced by the backend", () => {
  const context = createContext();
  const fieldCases = [
    ["require_guardian_phone", "Telefon waris"],
    ["require_guardian_relation", "Hubungan waris"],
    ["require_emergency_reason", "Sebab kecemasan"],
    ["require_purpose", "Tujuan"],
    ["require_location", "Lokasi"],
    ["require_vehicle", "Jenis kenderaan"]
  ];
  fieldCases.forEach(([flag, message]) => {
    const config = context.validateOutingTypeConfig_(
      Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig({ [flag]: true })[index]])),
      { requireTypeCode: true }
    );
    assert.throws(() => validate(context, config), new RegExp(message));
  });
});

test("fields configured optional are genuinely optional", () => {
  const context = createContext();
  const config = context.resolveSubmissionOutingTypeConfigV200_;
  const validated = context.validateOutingTypeConfig_(
    Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig()[index]])),
    { requireTypeCode: true }
  );
  assert.doesNotThrow(() => validate(context, validated));
  assert.equal(typeof config, "function");
});

test("allowed_days and application time window are enforced in Malaysia time", () => {
  const context = createContext();
  const base = Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig()[index]]));
  const wrongDay = context.validateOutingTypeConfig_({ ...base, allowed_days: "SELASA" }, { requireTypeCode: true });
  assert.throws(() => validate(context, wrongDay), /tidak dibenarkan pada hari/);

  const closed = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "11:00",
    application_close_time: "12:00"
  }, { requireTypeCode: true });
  assert.throws(() => validate(context, closed), /belum dibuka atau telah ditutup/);

  const overnight = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "22:00",
    application_close_time: "06:00"
  }, { requireTypeCode: true });
  assert.doesNotThrow(() => validate(context, overnight, {}, "2026-08-03T15:00:00Z"));
});

test("blank application times impose no threshold while configured boundaries remain strict", () => {
  const context = createContext();
  const base = Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig()[index]]));
  const unrestricted = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "",
    application_close_time: ""
  }, { requireTypeCode: true });
  assert.doesNotThrow(() => validate(context, unrestricted, {}, "2026-08-02T22:30:00Z")); // Monday 06:30
  assert.doesNotThrow(() => validate(context, unrestricted, {}, "2026-08-03T14:30:00Z")); // Monday 22:30

  const noOpeningThreshold = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "",
    application_close_time: "12:00"
  }, { requireTypeCode: true });
  assert.doesNotThrow(() => validate(context, noOpeningThreshold, {}, "2026-08-02T23:00:00Z")); // Monday 07:00

  const noClosingThreshold = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "12:00",
    application_close_time: ""
  }, { requireTypeCode: true });
  assert.doesNotThrow(() => validate(context, noClosingThreshold, {}, "2026-08-03T12:00:00Z")); // Monday 20:00

  const noonOpening = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "12:00",
    application_close_time: ""
  }, { requireTypeCode: true });
  assert.throws(
    () => validate(context, noonOpening, {}, "2026-08-03T01:00:00Z"),
    /belum dibuka atau telah ditutup/
  ); // Monday 09:00

  const configuredClosing = context.validateOutingTypeConfig_({
    ...base,
    application_open_time: "",
    application_close_time: "17:00"
  }, { requireTypeCode: true });
  assert.throws(
    () => validate(context, configuredClosing, {}, "2026-08-03T10:00:00Z"),
    /belum dibuka atau telah ditutup/
  ); // Monday 18:00

  const wrongDayWithoutTimes = context.validateOutingTypeConfig_({
    ...base,
    allowed_days: "SELASA",
    application_open_time: "",
    application_close_time: ""
  }, { requireTypeCode: true });
  assert.throws(
    () => validate(context, wrongDayWithoutTimes, {}, "2026-08-03T02:00:00Z"),
    /tidak dibenarkan pada hari/
  );
});

test("fixed_return_time overrides client input and required return time is strict", () => {
  const context = createContext();
  const base = Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig()[index]]));
  const fixed = context.validateOutingTypeConfig_({ ...base, fixed_return_time: "22:00" }, { requireTypeCode: true });
  assert.equal(validate(context, fixed, { masa_balik_dijangka: "18:30" }).masa_balik_dijangka, "22:00");

  const required = context.validateOutingTypeConfig_({ ...base, require_return_time: true }, { requireTypeCode: true });
  assert.throws(() => validate(context, required), /Masa dijangka pulang/);
  assert.throws(() => validate(context, required, { masa_balik_dijangka: "25:00" }), /tidak sah/);
});

test("same_day_only enforces equal dates and safely fills an omitted return date", () => {
  const context = createContext();
  const base = Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig()[index]]));
  const sameDay = context.validateOutingTypeConfig_({ ...base, same_day_only: true }, { requireTypeCode: true });
  assert.throws(
    () => validate(context, sameDay, { tarikh: "2026-08-03", tarikh_balik: "2026-08-04" }),
    /hari yang sama/
  );
  assert.equal(validate(context, sameDay, { tarikh: "2026-08-03" }).tarikh_balik, "2026-08-03");
});

test("server-side date validation rejects malformed and impossible dates", () => {
  const context = createContext();
  const base = Object.fromEntries(OUTING_HEADERS.map((header, index) => [header, completeConfig()[index]]));
  const required = context.validateOutingTypeConfig_({ ...base, require_leave_date: true }, { requireTypeCode: true });
  assert.throws(() => validate(context, required, { tarikh: "03/08/2026" }), /tidak sah/);
  assert.throws(() => validate(context, required, { tarikh: "2026-02-31" }), /tidak sah/);
});

test("submitRequest keeps duplicate protection, legacy Pulang Bermalam and controlled approval/audit metadata", () => {
  const submitSource = gasSource.slice(
    gasSource.indexOf("function submitRequest(payload)"),
    gasSource.indexOf("function approveRequest(payload)")
  );
  assert.match(submitSource, /hasActiveRequestForStudent_/);
  assert.match(submitSource, /validateOvernightRequest_\(payload, now\)/);
  assert.match(submitSource, /validateInitialRequestStatus_\([\s\S]*requiresWardenApproval \? STATUS\.pending : STATUS\.approved/);
  assert.match(submitSource, /requiresWardenApproval \? "" : "AUTO_CONFIG_V2"/);
  assert.match(submitSource, /auditDetails\.config_version = submissionConfig\.config_version/);
  assert.doesNotMatch(submitSource, /JSON\.stringify\(submissionConfig\)/);
});

test("the feature flag is never enabled by source code", () => {
  assert.doesNotMatch(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY,\s*"true"\)/);
  assert.match(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY,\s*"false"\)/);
});
