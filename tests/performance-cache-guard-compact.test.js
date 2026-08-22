const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

function makeCache(options = {}) {
  const values = new Map();
  return {
    values,
    get(key) {
      if (options.throwOnGet) throw new Error("cache unavailable");
      return values.has(key) ? values.get(key) : null;
    },
    put(key, value, ttl) {
      if (options.throwOnPut) throw new Error("payload too large");
      values.set(key, value);
      this.lastPut = { key, value, ttl };
    },
    remove(key) {
      if (options.throwOnRemove) throw new Error("cache unavailable");
      values.delete(key);
      this.lastRemoved = key;
    }
  };
}

function loadGas(cache = makeCache()) {
  const properties = new Map();
  let uuid = 0;
  const context = vm.createContext({
    console: { warn() {} },
    CacheService: { getScriptCache: () => cache },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => {}
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.has(key) ? properties.get(key) : null,
        setProperty: (key, value) => properties.set(key, String(value))
      })
    },
    Utilities: {
      formatDate: () => "2026-08-20",
      getUuid: () => `uuid-${++uuid}`
    }
  });
  vm.runInContext(gasSource, context);
  return { context, cache, properties };
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function installRows(context, rowsBySheet) {
  let reads = 0;
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => {
    reads += 1;
    return (rowsBySheet[sheet.name] || []).map((row) => ({ ...row }));
  };
  return () => reads;
}

test("safe active Student directory is cached for 600 seconds", () => {
  const { context, cache } = loadGas();
  const reads = installRows(context, {
    STUDENTS: [
      { student_id: "S1", no_matrik: "SECRET", nama: "Ali", kelas: "A3", status: "Aktif" },
      { student_id: "S2", no_matrik: "HIDDEN", nama: "Inactive", kelas: "B1", status: "Tidak Aktif" }
    ]
  });

  assert.deepEqual(json(context.getStudents()), [{ student_id: "S1", nama: "Ali", kelas: "A3" }]);
  assert.deepEqual(json(context.getStudents()), [{ student_id: "S1", nama: "Ali", kelas: "A3" }]);
  assert.equal(reads(), 1);
  assert.equal(cache.lastPut.ttl, 600);
  assert.doesNotMatch(cache.lastPut.value, /SECRET|HIDDEN|no_matrik|pin/i);
});

test("Warden and Guard safe directories use independent 900-second caches", () => {
  const { context, cache } = loadGas();
  const reads = installRows(context, {
    WARDENS: [{ warden_id: "W1", nama_warden: "Pn HEP", email: "w@example.test", no_tel: "1", pin: "1111", status: "Aktif", catatan: "HEP" }],
    GUARDS: [{ guard_id: "G1", nama_guard: "En Guard", email: "g@example.test", no_tel: "2", pin: "2222", status: "Aktif", catatan: "Syif A" }]
  });

  const wardens = context.getWardens();
  const guards = context.getGuards();
  const cachedWardens = context.getWardens();
  const cachedGuards = context.getGuards();
  assert.deepEqual(json(cachedWardens), json(wardens));
  assert.deepEqual(json(cachedGuards), json(guards));
  assert.deepEqual(json(wardens), [{
    warden_id: "W1",
    nama_warden: "Pn HEP",
    staffRole: "WARDEN",
    email: "w@example.test",
    no_tel: "1",
    status: "Aktif",
    catatan: "HEP"
  }]);
  assert.deepEqual(json(guards), [{ nama_guard: "En Guard" }]);
  assert.equal(reads(), 2);
  assert.equal(cache.lastPut.ttl, 900);
  assert.doesNotMatch(JSON.stringify(wardens), /pin|password|credential/i);
  assert.doesNotMatch(JSON.stringify([...cache.values.values()]), /1111|2222|"pin"|password|credential|guard_id/i);
});

test("public outing projections cache config-driven and legacy behavior separately", () => {
  const { context, cache } = loadGas();
  let enabled = true;
  let sheetReads = 0;
  context.isOutingConfigV2Enabled_ = () => enabled;
  context.getSheet_ = () => ({ name: "OUTING_TYPES" });
  context.getRowsAsObjects_ = () => {
    sheetReads += 1;
    return [{ type_code: "NORMAL", display_name: "Normal", active: true, sort_order: 1, require_selfie: true, created_by: "SECRET" }];
  };
  context.normalizeOutingTypeRecord_ = (row) => ({ ...row });
  context.sortOutingTypes_ = (rows) => rows;
  const publicProjection = (typeCode, displayName, sortOrder = 1) => ({
    type_code: typeCode, display_name: displayName, description: "", sort_order: sortOrder,
    allowed_days: "", application_open_date: "", application_close_date: "",
    application_open_time: "", application_close_time: "",
    departure_allowed_days: "", earliest_departure_time: "", fixed_return_time: "",
    same_day_only: false, require_leave_date: false, require_return_date: false,
    require_return_time: false, require_guardian_phone: false, require_guardian_relation: false,
    require_emergency_reason: false, require_purpose: false, require_location: false,
    require_vehicle: false, require_warden_approval: true, require_selfie: true
  });
  context.toPublicOutingType_ = (row) => publicProjection(row.type_code, row.display_name, row.sort_order);
  context.getLegacyPublicOutingTypes_ = () => [publicProjection("LEGACY", "Legacy")];

  assert.equal(context.getOutingTypes()[0].type_code, "NORMAL");
  assert.equal(context.getOutingTypes()[0].type_code, "NORMAL");
  assert.equal(sheetReads, 1);
  enabled = false;
  assert.equal(context.getOutingTypes()[0].type_code, "LEGACY");
  assert.equal(context.getOutingTypes()[0].type_code, "LEGACY");
  assert.equal(sheetReads, 1);
  assert.equal(cache.lastPut.ttl, 600);
  assert.doesNotMatch(JSON.stringify([...cache.values.values()]), /created_by|SECRET|pin/i);
});

test("profile-photo indicator map caches metadata only for 600 seconds", () => {
  const { context, cache } = loadGas();
  const reads = installRows(context, {
    STUDENTS: [{ student_id: "S1", photo_file_id: "PRIVATE_DRIVE_FILE", photo_updated_at: "2026-08-20", image_base64: "DATA", photo_data_uri: "data:image/jpeg;base64,SECRET" }]
  });
  const rows = [{ student_id: "S1", request_id: "R1" }];

  assert.equal(context.addProfilePhotoIndicators_(rows)[0].has_profile_photo, true);
  assert.equal(context.addProfilePhotoIndicators_(rows)[0].photo_updated_at, "2026-08-20");
  assert.equal(reads(), 1);
  assert.equal(cache.lastPut.ttl, 600);
  assert.doesNotMatch(cache.lastPut.value, /PRIVATE_DRIVE_FILE|base64|data:image|SECRET|photo_file_id/i);
});

test("today operational source rows are cached for 20 seconds before role filtering", () => {
  const { context, cache } = loadGas();
  let requestReads = 0;
  let studentAuth = 0;
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => {
    if (sheet.name === "OUTING_REQUESTS") {
      requestReads += 1;
      return [{
        request_id: "R1", student_id: "S1", jenis_permohonan: "OUTING_BIASA",
        tarikh: "2099-01-01", status: "MENUNGGU_KELULUSAN"
      }];
    }
    return [];
  };
  context.addProfilePhotoIndicators_ = (rows) => rows;
  context.findActiveStudent_ = () => {
    studentAuth += 1;
    return { student_id: "S1" };
  };

  context.getOperationalTodayRecords({ role: "student", student_id: "S1", no_matrik: "M1" });
  context.getOperationalTodayRecords({ role: "student", student_id: "S1", no_matrik: "M1" });
  assert.equal(requestReads, 1);
  assert.equal(studentAuth, 2, "Student authentication must execute on every request");
  assert.equal(cache.lastPut.ttl, 20);
});

test("Warden and Guard authentication still execute on every cached operational read", () => {
  for (const role of ["warden", "guard"]) {
    const { context } = loadGas();
    let authCalls = 0;
    installRows(context, {
      OUTING_REQUESTS: [{
        request_id: "R1", student_id: "S1", jenis_permohonan: "OUTING_BIASA",
        tarikh: "2026-08-20", status: "DILULUSKAN_WARDEN"
      }],
      STUDENTS: []
    });
    context.addProfilePhotoIndicators_ = (rows) => rows;
    context.findActiveWarden_ = () => { authCalls += 1; return { warden_id: "W1" }; };
    context.findActiveGuard_ = () => { authCalls += 1; return { guard_id: "G1" }; };
    const payload = role === "warden" ? { role, nama_warden: "W", pin: "1" } : { role, nama_guard: "G", pin: "2" };
    context.getOperationalTodayRecords(payload);
    context.getOperationalTodayRecords(payload);
    assert.equal(authCalls, 2, `${role} authentication must execute on every request`);
  }
});

test("malformed cache JSON falls back to Sheets and refreshes the cache", () => {
  const { context, cache } = loadGas();
  const reads = installRows(context, { STUDENTS: [{ student_id: "S1", nama: "Ali", kelas: "A3", status: "Aktif" }] });
  cache.values.set("eouting:v1:directory:students:0", "{broken");
  assert.equal(context.getStudents()[0].student_id, "S1");
  assert.equal(reads(), 1);
  assert.doesNotMatch(cache.lastPut.value, /broken/);
});

test("valid JSON with an unsafe cached projection falls back to Sheets", () => {
  const { context, cache } = loadGas();
  const reads = installRows(context, { STUDENTS: [{ student_id: "S1", nama: "Ali", kelas: "A3", status: "Aktif" }] });
  cache.values.set("eouting:v1:directory:students:0", JSON.stringify([{ student_id: "ATTACK", nama: "Unsafe", kelas: "X", pin: "9999" }]));
  assert.equal(context.getStudents()[0].student_id, "S1");
  assert.equal(reads(), 1);
  assert.doesNotMatch(cache.lastPut.value, /pin|9999/i);
});

test("unsafe profile image content already in cache is discarded and never reused", () => {
  const { context, cache } = loadGas();
  const reads = installRows(context, { STUDENTS: [{ student_id: "S1", photo_file_id: "FILE", photo_updated_at: "2026-08-20" }] });
  cache.values.set("eouting:v1:profile-photo-indicators:0", JSON.stringify({
    s1: { has_profile_photo: true, photo_updated_at: "2026-08-19", photo_data_uri: "data:image/jpeg;base64,SECRET" }
  }));
  const result = context.addProfilePhotoIndicators_([{ student_id: "S1" }]);
  assert.equal(result[0].photo_updated_at, "2026-08-20");
  assert.equal(reads(), 1);
  assert.doesNotMatch(cache.lastPut.value, /data:image|base64|SECRET/i);
});

test("CacheService read and write failures never block correct Sheet results", () => {
  const failingRead = loadGas(makeCache({ throwOnGet: true }));
  const readCount = installRows(failingRead.context, { STUDENTS: [{ student_id: "S1", nama: "Ali", kelas: "A3", status: "Aktif" }] });
  assert.equal(failingRead.context.getStudents()[0].student_id, "S1");
  assert.equal(readCount(), 1);

  const failingWrite = loadGas(makeCache({ throwOnPut: true }));
  installRows(failingWrite.context, { STUDENTS: [{ student_id: "S2", nama: "Abu", kelas: "B1", status: "Aktif" }] });
  assert.equal(failingWrite.context.getStudents()[0].student_id, "S2");
});

test("failed cache removal cannot expose a stale directory after a successful write", () => {
  const cache = makeCache({ throwOnRemove: true });
  const { context } = loadGas(cache);
  let studentName = "Before";
  context.getSheet_ = () => ({ name: "STUDENTS" });
  context.getRowsAsObjects_ = () => [{ student_id: "S1", nama: studentName, kelas: "A3", status: "Aktif" }];
  assert.equal(context.getStudents()[0].nama, "Before");
  studentName = "After";
  context.invalidateStudentDirectoryCache_();
  assert.equal(context.getStudents()[0].nama, "After");
});

test("generation-set and cache-remove failures overwrite the old entry with an invalid tombstone", () => {
  const cache = makeCache({ throwOnRemove: true });
  const { context } = loadGas(cache);
  context.PropertiesService = {
    getScriptProperties: () => ({
      getProperty: () => null,
      setProperty: () => { throw new Error("properties unavailable"); }
    })
  };
  cache.values.set("eouting:v1:directory:students:0", JSON.stringify([{ student_id: "S1", nama: "Before", kelas: "A3" }]));
  context.getSheet_ = () => ({ name: "STUDENTS" });
  context.getRowsAsObjects_ = () => [{ student_id: "S1", nama: "After", kelas: "A3", status: "Aktif" }];
  context.invalidateStudentDirectoryCache_();
  assert.equal(context.getStudents()[0].nama, "After");
});

test("an overlapping cache miss cannot republish stale data after invalidation", () => {
  const { context } = loadGas();
  let loads = 0;
  const first = context.getCachedOrLoad_("operationalTodayRecords", 20, Array.isArray, () => {
    loads += 1;
    context.invalidateOperationalRecordsCache_();
    return [{ request_id: "STALE" }];
  });
  const second = context.getCachedOrLoad_("operationalTodayRecords", 20, Array.isArray, () => {
    loads += 1;
    return [{ request_id: "FRESH" }];
  });
  assert.equal(first[0].request_id, "STALE");
  assert.equal(second[0].request_id, "FRESH");
  assert.equal(loads, 2);
});

test("operational authentication runs before any cached or Sheet-backed data load", () => {
  const { context } = loadGas();
  const order = [];
  context.findActiveGuard_ = () => { order.push("auth"); return { guard_id: "G1" }; };
  context.getTodayRecordRows_ = () => { order.push("load"); throw new Error("load failed"); };
  assert.throws(() => context.getOperationalTodayRecords({ role: "guard", nama_guard: "G", pin: "1" }), /load failed/);
  assert.deepEqual(order, ["auth", "load"]);
});

test("semantically incomplete outing and operational cache entries fall back to Sheets", () => {
  const { context, cache } = loadGas();
  let outingReads = 0;
  let requestReads = 0;
  cache.values.set("eouting:v1:outing-types:config-v2:0", JSON.stringify([{ type_code: "BROKEN", display_name: "Broken" }]));
  cache.values.set("eouting:v1:operational:today-records:0", JSON.stringify([{}]));
  context.isOutingConfigV2Enabled_ = () => true;
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => {
    if (sheet.name === "OUTING_TYPES") {
      outingReads += 1;
      return [{ type_code: "GOOD", display_name: "Good", active: true }];
    }
    requestReads += 1;
    return [{ request_id: "R1", student_id: "S1", jenis_permohonan: "OUTING_BIASA", tarikh: "2026-08-20", status: "MENUNGGU_KELULUSAN" }];
  };
  context.normalizeOutingTypeRecord_ = (row) => ({
    ...row, description: "", sort_order: 1, allowed_days: "", application_open_time: "",
    application_close_time: "", departure_allowed_days: "", earliest_departure_time: "",
    fixed_return_time: "", same_day_only: false, require_leave_date: false,
    require_return_date: false, require_return_time: false, require_guardian_phone: false,
    require_guardian_relation: false, require_emergency_reason: false, require_purpose: false,
    require_location: false, require_vehicle: false, require_warden_approval: true, require_selfie: true
  });
  context.sortOutingTypes_ = (rows) => rows;
  assert.equal(context.getOutingTypes()[0].type_code, "GOOD");
  assert.equal(context.getTodayRecordRows_()[0].request_id, "R1");
  assert.equal(outingReads, 1);
  assert.equal(requestReads, 1);
});

test("operational cache rejects fields outside the OUTING_REQUESTS schema", () => {
  const { context, cache } = loadGas();
  let requestReads = 0;
  cache.values.set("eouting:v1:operational:today-records:0", JSON.stringify([{
    request_id: "BAD", student_id: "S1", jenis_permohonan: "OUTING_BIASA",
    tarikh: "2026-08-20", status: "MENUNGGU_KELULUSAN", pin: "9999"
  }]));
  context.getSheet_ = () => ({ name: "OUTING_REQUESTS" });
  context.getRowsAsObjects_ = () => {
    requestReads += 1;
    return [{
      request_id: "GOOD", student_id: "S1", jenis_permohonan: "OUTING_BIASA",
      tarikh: "2026-08-20", status: "MENUNGGU_KELULUSAN"
    }];
  };
  assert.equal(context.getTodayRecordRows_()[0].request_id, "GOOD");
  assert.equal(requestReads, 1);
});

test("representative real mutations invalidate after success and never after write failure", () => {
  const student = loadGas().context;
  let order = [];
  Object.assign(student, {
    validateAdminCredentials_: () => ({}), getStudentInput_: (value) => value,
    withScriptLock_: (callback) => callback(), getSheet_: () => ({}),
    validateStudentInput_: () => ({ student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "AKTIF" }),
    findStudentRowById_: () => null, findStudentRowByMatric_: () => null,
    appendObjectRow_: () => order.push("write"), invalidateStudentDirectoryCache_: () => order.push("invalidate"),
    getSafeAdminIdentity_: () => "A", appendAuditLog: () => {}, normalizeStudentRecord_: (row) => row
  });
  student.createStudent({});
  assert.deepEqual(order, ["write", "invalidate"]);
  order = [];
  student.appendObjectRow_ = () => { order.push("write"); throw new Error("write failed"); };
  assert.throws(() => student.createStudent({}), /write failed/);
  assert.deepEqual(order, ["write"]);

  const staff = loadGas().context;
  order = [];
  Object.assign(staff, {
    validateAdminCredentials_: () => ({}),
    getStaffSheetConfig_: () => ({ role: "WARDEN", sheetName: "WARDENS", headers: [], idField: "warden_id", nameField: "nama_warden" }),
    withScriptLock_: (callback) => callback(), getSheet_: () => ({}), ensureHeaders_: () => {},
    validateStaffInput_: () => ({ staff_id: "W1", nama: "W", email: "", no_tel: "", pin: "1234", status: "Aktif", catatan: "" }),
    findStaffRowById_: () => null, getRowsAsObjects_: () => [],
    appendObjectRow_: () => order.push("write"), invalidateStaffDirectoryCache_: () => order.push("invalidate"),
    appendAuditLog: () => {}, getSafeAdminIdentity_: () => "A", toSafeAdminStaff_: (row) => row
  });
  staff.createStaff({ role: "WARDEN" });
  assert.deepEqual(order, ["write", "invalidate"]);

  const outing = loadGas().context;
  order = [];
  Object.assign(outing, {
    validateAdminCredentials_: () => ({}), getOutingTypeInput_: () => ({ type_code: "X" }),
    withScriptLock_: (callback) => callback(), getSheet_: () => ({}), ensureHeaders_: () => {},
    normalizeOutingTypeCode_: () => "X", findOutingTypeRowByCode_: () => null,
    validateOutingTypeConfig_: () => ({ type_code: "X", display_name: "X", active: true }),
    now_: () => "NOW", getSafeAdminIdentity_: () => "A",
    appendObjectRow_: () => order.push("write"), invalidatePublicOutingTypesCache_: () => order.push("invalidate"),
    appendAuditLog: () => {}, normalizeOutingTypeRecord_: (row) => row
  });
  outing.createOutingType({});
  assert.deepEqual(order, ["write", "invalidate"]);

  const photo = loadGas().context;
  order = [];
  Object.assign(photo, {
    validateAdminCredentials_: () => ({}), withScriptLock_: (callback) => callback(), getSheet_: () => ({}),
    findStudentRowById_: () => ({ rowNumber: 2, record: { student_id: "S1", nama: "Ali", photo_file_id: "" } }),
    updateRowByHeaders_: () => order.push("write"), invalidateProfilePhotoIndicatorCache_: () => order.push("invalidate"),
    SpreadsheetApp: { flush: () => {} }, appendAuditLog: () => {}, getSafeAdminIdentity_: () => "A"
  });
  photo.removeStudentProfilePhoto({ student_id: "S1" });
  assert.deepEqual(order, ["write", "invalidate"]);

  const operational = loadGas().context;
  order = [];
  Object.assign(operational, {
    findActiveGuard_: () => ({ nama_guard: "G" }),
    findRowByRequestId_: () => ({ sheet: {}, rowNumber: 2, record: { request_id: "R1", status: "DILULUSKAN_WARDEN" } }),
    resolveSubmissionOutingTypeConfigV200_: () => null,
    updateRowByHeaders_: () => order.push("write"), invalidateOperationalRecordsCache_: () => order.push("invalidate"),
    SpreadsheetApp: { flush: () => {} },
    now_: () => "NOW", appendAuditLog: () => {}, sendTelegramMessage_: () => {},
    buildTelegramStatusMessage_: () => "", telegramTitle_: () => ""
  });
  operational.confirmOut({ request_id: "R1", nama_guard: "G", pin: "1" });
  assert.deepEqual(order, ["write", "invalidate"]);

  order = [];
  operational.findRowByRequestId_ = () => ({
    sheet: {}, rowNumber: 2,
    record: { request_id: "R1", status: "SEDANG_KELUAR", masa_keluar: "NOW" }
  });
  assert.match(operational.confirmOut({ request_id: "R1", nama_guard: "G", pin: "1" }).message, /sudah disahkan keluar/i);
  assert.deepEqual(order, []);

  operational.findRowByRequestId_ = () => ({ sheet: {}, rowNumber: 2, record: { request_id: "R1", status: "MENUNGGU_KELULUSAN" } });
  assert.throws(() => operational.confirmOut({ request_id: "R1", nama_guard: "G", pin: "1" }), /hanya boleh sahkan keluar/i);
  assert.deepEqual(order, []);

  operational.findRowByRequestId_ = () => ({ sheet: {}, rowNumber: 2, record: { request_id: "R1", status: "DILULUSKAN_WARDEN" } });
  operational.updateRowByHeaders_ = () => { order.push("write"); throw new Error("write failed"); };
  assert.throws(() => operational.confirmOut({ request_id: "R1", nama_guard: "G", pin: "1" }), /write failed/);
  assert.deepEqual(order, ["write"]);

  const cancellation = loadGas().context;
  order = [];
  Object.assign(cancellation, {
    findActiveStudent_: () => ({ student_id: "S1", no_matrik: "M1", nama: "Ali" }),
    getSheet_: () => ({}), ensureHeaders_: () => {},
    findRowByRequestId_: () => ({
      sheet: {}, rowNumber: 2,
      record: { request_id: "R2", student_id: "S1", no_matrik: "M1", status: "MENUNGGU_KELULUSAN", jenis_permohonan: "OUTING_BIASA" }
    }),
    updateRowByHeaders_: () => order.push("write"),
    SpreadsheetApp: { flush: () => order.push("flush") },
    invalidateOperationalRecordsCache_: () => order.push("invalidate"),
    now_: () => "NOW", appendAuditLog: () => order.push("audit"),
    sendTelegramMessage_: () => true, buildTelegramStudentCancellationMessage_: () => ""
  });
  cancellation.cancelStudentRequest({ request_id: "R2", student_id: "S1", no_matrik: "M1", sebab_batal_pelajar: "Urusan keluarga" });
  assert.deepEqual(order, ["write", "flush", "invalidate", "audit"]);

  order = [];
  cancellation.updateRowByHeaders_ = () => { order.push("write"); throw new Error("write failed"); };
  assert.throws(
    () => cancellation.cancelStudentRequest({ request_id: "R2", student_id: "S1", no_matrik: "M1", sebab_batal_pelajar: "Urusan keluarga" }),
    /write failed/
  );
  assert.deepEqual(order, ["write"]);
});

test("successful mutation paths invalidate only their associated cache families", () => {
  const expected = {
    createStudent: "invalidateStudentDirectoryCache_",
    updateStudent: "invalidateStudentDirectoryCache_",
    toggleStudentStatus: "invalidateStudentDirectoryCache_",
    createStaff: "invalidateStaffDirectoryCache_",
    updateStaff: "invalidateStaffDirectoryCache_",
    toggleStaffStatus: "invalidateStaffDirectoryCache_",
    createOutingType: "invalidatePublicOutingTypesCache_",
    updateOutingType: "invalidatePublicOutingTypesCache_",
    toggleOutingType: "invalidatePublicOutingTypesCache_",
    submitStudentProfilePhoto: "invalidateProfilePhotoIndicatorCache_",
    removeStudentProfilePhoto: "invalidateProfilePhotoIndicatorCache_",
    submitRequest: "invalidateOperationalRecordsCache_",
    cancelStudentRequest: "invalidateOperationalRecordsCache_",
    approveRequest: "invalidateOperationalRecordsCache_",
    rejectRequest: "invalidateOperationalRecordsCache_",
    confirmOut: "invalidateOperationalRecordsCache_",
    confirmIn: "invalidateOperationalRecordsCache_",
    submitReturnSelfie: "invalidateOperationalRecordsCache_"
  };

  for (const [name, invalidator] of Object.entries(expected)) {
    const start = gasSource.indexOf(`function ${name}(`);
    const next = gasSource.indexOf("\nfunction ", start + 1);
    assert.notEqual(start, -1, `${name} must exist at current HEAD`);
    const source = gasSource.slice(start, next === -1 ? gasSource.length : next);
    assert.match(source, new RegExp(`\\b${invalidator}\\(`), `${name} must invalidate after its successful write`);
  }
});

function extractFunction(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  const end = appSource.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return appSource.slice(start, end);
}

function renderGuardCard(record, mode) {
  const context = vm.createContext({
    REQUEST_TYPE: { normal: "OUTING_BIASA", emergency: "KECEMASAN", overnight: "PULANG_BERMALAM", semester: "CUTI_SEMESTER" },
    STATUS: { out: "Sedang Keluar" },
    escapeHtml: (value) => String(value == null ? "" : value),
    getRecordId: (item) => item.request_id || item.id,
    recordDataAttributes: () => 'data-record-card="1"',
    profilePhotoMarkup: () => '<span class="profile-photo-thumbnail">PHOTO</span>',
    requestTypeLabel: (type) => ({ OUTING_BIASA: "Outing Biasa", KECEMASAN: "Kecemasan", PULANG_BERMALAM: "Pulang Bermalam", CUTI_SEMESTER: "Cuti Semester" }[type] || type),
    getContextualStatusDisplay: (item) => ({ key: item.status === "Sedang Keluar" ? "out" : "approved", icon: "", label: item.status }),
    escapeDisplayPhone: (phone) => phone || "-",
    guardianContactHtml: (phone) => phone ? `<a href="tel:${phone}">Hubungi Waris</a>` : ""
  });
  vm.runInContext(extractFunction("guardOperationalCard", "getGuardReturnTiming"), context);
  return context.guardOperationalCard(record, mode, mode === "guard-out"
    ? '<button data-out="R1">Sahkan Keluar</button>'
    : '<button data-in="R1">Sahkan Masuk</button>');
}

test("normal Guard cards contain only identity, badges, the action cue and existing hooks", () => {
  const record = {
    request_id: "R1", id: "R1", student_id: "S1", studentName: "AHMAD ADAM", className: "A3",
    jenis_permohonan: "PULANG_BERMALAM", status: "Diluluskan HEP", purpose: "PRIVATE PURPOSE",
    location: "PRIVATE LOCATION", jenis_kenderaan: "Kereta", butiran_kenderaan: "ABC123",
    requestedAt: "TIME1", approvedAt: "TIME2", outAt: "TIME3", returnedAt: "TIME4",
    tarikh_balik: "2026-08-21", masa_balik_dijangka: "22:00", telefon_waris: "0123456789"
  };
  const keluar = renderGuardCard(record, "guard-out");
  assert.match(keluar, /profile-photo-thumbnail[\s\S]*AHMAD ADAM[\s\S]*R1 \| A3/);
  assert.match(keluar, /Pulang Bermalam[\s\S]*Diluluskan HEP/);
  assert.match(keluar, /TINDAKAN KELUAR[\s\S]*Pastikan pelajar berada di pos[\s\S]*data-out="R1"[\s\S]*Sahkan Keluar/);
  assert.doesNotMatch(keluar, /PRIVATE PURPOSE|PRIVATE LOCATION|ABC123|TIME1|TIME2|TIME3|TIME4|0123456789|Lihat Butiran|Jenis Permohonan:|Tujuan:|Lokasi:|Kenderaan:|Tarikh Pulang|Pulang ke asrama dijangka/);

  const masuk = renderGuardCard({ ...record, status: "Sedang Keluar" }, "guard-in");
  assert.match(masuk, /TINDAKAN MASUK[\s\S]*Pastikan pelajar telah kembali ke kampus[\s\S]*data-in="R1"[\s\S]*Sahkan Masuk/);
  assert.doesNotMatch(masuk, /Lihat Butiran|Pulang:|Keluar:|Dalam tempoh dibenarkan/);
});

test("Guard emergency exception keeps non-contact safety details and excludes guardian data", () => {
  const html = renderGuardCard({
    request_id: "R1", student_id: "S1", studentName: "Ali", className: "A3",
    jenis_permohonan: "KECEMASAN", status: "Diluluskan HEP", sebab_kecemasan: "Hospital",
    telefon_waris: "0123456789", hubungan_waris: "Ibu", catatan_kecemasan: "Alergi ubat",
    purpose: "verbose purpose", location: "verbose location", jenis_kenderaan: "verbose vehicle"
  }, "guard-out");
  for (const criticalDetail of [/Hospital/, /Alergi ubat/]) {
    assert.match(html, criticalDetail);
  }
  assert.doesNotMatch(html, /0123456789|Hubungi Waris|Ibu|verbose purpose|verbose location|verbose vehicle|Lihat Butiran/);

  const blankEmergency = renderGuardCard({
    request_id: "R2", student_id: "S2", studentName: "Abu", className: "A2",
    jenis_permohonan: "KECEMASAN", status: "Diluluskan HEP"
  }, "guard-out");
  assert.doesNotMatch(blankEmergency, /guard-emergency-safety|Sebab Kecemasan:|Waris:|Catatan:|>\s*-\s*</);
});

test("recordCard routes only Guard modes through the compact renderer", () => {
  const source = extractFunction("recordCard", "guardOperationalCard");
  assert.match(source, /mode === "guard-out" \|\| mode === "guard-in"[\s\S]*guardOperationalCard\(record, mode, actions\)/);
  assert.match(source, /record-detail[\s\S]*record-times/, "existing Student/Warden/Admin/Public Monitoring renderer must remain intact");
});
