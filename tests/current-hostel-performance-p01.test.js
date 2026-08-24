const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function extractFunction(source, name) {
  const start = source.lastIndexOf(`function ${name}(`);
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

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPresenceFunctions() {
  const context = vm.createContext({
    Map,
    JSON,
    STATUS: { out: "KELUAR" },
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    isActive_: (status) => String(status || "").trim().toLowerCase() === "aktif",
    now_: () => "2026-08-25 12:00:00"
  });
  [
    "parseDateForSort_",
    "isRecordForStudent_",
    "currentHostelRequestTimestamp_",
    "currentHostelRequestIdentityKey_",
    "isLaterCurrentHostelRequestCandidate_",
    "buildLatestCurrentHostelRequestMap_",
    "selectAuthoritativeCurrentRequestForStudent_",
    "buildCurrentHostelPresenceFromRows_",
    "toPublicCurrentHostelSummary_",
    "toAuthenticatedCurrentHostelRoster_"
  ].forEach((name) => vm.runInContext(extractFunction(gasSource, name), context));
  return context;
}

function student(id, group = "A2", extra = {}) {
  return { student_id: id, no_matrik: `M-${id}`, nama: `Nama ${id}`, kelas: group, status: "AKTIF", ...extra };
}

let requestSequence = 0;

function request(id, status, requestedAt, extra = {}) {
  requestSequence += 1;
  return { request_id: `R-${id}-${requestSequence}`, student_id: id, no_matrik: `M-${id}`, status, masa_mohon: requestedAt, ...extra };
}

function legacySelect(context, targetStudent, requestRows) {
  let selected = null;
  let selectedTimestamp = -1;
  requestRows.forEach((row) => {
    if (!context.isRecordForStudent_(row, targetStudent)) return;
    const timestamp = context.currentHostelRequestTimestamp_(row);
    if (!selected || timestamp >= selectedTimestamp) {
      selected = row;
      selectedTimestamp = timestamp;
    }
  });
  return selected;
}

function parityFixture() {
  const students = [
    student("A"), student("B"), student("C"), student("D"),
    student("E", "A3"), student("F", "A3"), student("G", "A3"), student("H", "A3"),
    student("INACTIVE", "A2", { status: "TIDAK AKTIF" }),
    student("LI", "LI", { institution_code: "UMK", nama: "Zara LI" }),
    student("TIE", "A2"), student("INVALID", "A2"), student("LEGACY", "A2"), student("STRICT", "A2")
  ];
  const requests = [
    request("B", "MENUNGGU_KELULUSAN", "2026-08-25 08:00:00"),
    request("C", "DILULUSKAN_WARDEN", "2026-08-25 08:01:00"),
    request("D", "KELUAR", "2026-08-25 08:02:00"),
    request("E", "KELUAR", "2026-08-20 08:00:00"),
    request("E", "SELESAI", "2026-08-21 08:00:00"),
    request("F", "SELESAI", "2026-08-20 08:00:00"),
    request("F", "KELUAR", "2026-08-21 08:00:00"),
    request("G", "DITOLAK_WARDEN", "2026-08-25 08:03:00"),
    request("H", "DIBATALKAN_PELAJAR", "2026-08-25 08:04:00"),
    request("INACTIVE", "KELUAR", "2026-08-25 08:05:00"),
    request("TIE", "SELESAI", "2026-08-25 09:00:00"),
    request("TIE", "KELUAR", "2026-08-25 09:00:00"),
    request("INVALID", "KELUAR", ""),
    request("INVALID", "SELESAI", "not-a-date"),
    { request_id: "R-LEGACY", no_matrik: "M-LEGACY", status: "KELUAR", masa_mohon: "2026-08-25 10:00:00" },
    { request_id: "R-STRICT-MISMATCH", student_id: "STRICT", no_matrik: "WRONG", status: "KELUAR", masa_mohon: "2026-08-25 11:00:00" },
    { request_id: "R-STRICT-ID", student_id: "STRICT", status: "SELESAI", masa_mohon: "2026-08-25 10:00:00" }
  ];
  const groups = [
    { key: "GROUP:A2", label: "A2", students: students.filter((item) => item.kelas === "A2" && item.status === "AKTIF").map(({ student_id, nama }) => ({ student_id, nama })) },
    { key: "GROUP:A3", label: "A3", students: students.filter((item) => item.kelas === "A3").map(({ student_id, nama }) => ({ student_id, nama })) },
    { key: "GROUP:LI:UMK", label: "LI UMK", students: [{ student_id: "LI", nama: "Zara LI" }] }
  ];
  return { students, requests, directory: { mode: "dynamic", groups } };
}

test("P0-1 builds the latest-request map once and performs one request pass", () => {
  const context = loadPresenceFunctions();
  const { students, requests, directory } = parityFixture();
  let timestampReads = 0;
  const originalTimestamp = context.currentHostelRequestTimestamp_;
  context.currentHostelRequestTimestamp_ = (row) => {
    timestampReads += 1;
    return originalTimestamp(row);
  };

  context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "now");
  assert.equal(timestampReads, requests.length, "each request must be timestamped exactly once");

  const builder = extractFunction(gasSource, "buildCurrentHostelPresenceFromRows_");
  assert.equal((builder.match(/buildLatestCurrentHostelRequestMap_\(/g) || []).length, 1);
  assert.match(builder, /selectAuthoritativeCurrentRequestForStudent_\(student, latestRequestByStudent\)/);
  const selector = extractFunction(gasSource, "selectAuthoritativeCurrentRequestForStudent_");
  assert.match(selector, /latestRequestByStudent\.get\(key\)/);
  assert.doesNotMatch(selector, /requestRows|\.forEach\(function \(row\)/);
  assert.doesNotMatch(builder, /getSheet_|getRange|getValue|getRowsAsObjects_/);
});

test("P0-1 map preserves legacy lifecycle, identity, invalid-date and row-order semantics", () => {
  const context = loadPresenceFunctions();
  const { students, requests, directory } = parityFixture();
  const latestRequestByStudent = context.buildLatestCurrentHostelRequestMap_(requests);

  students.forEach((item) => {
    const before = legacySelect(context, item, requests);
    const after = context.selectAuthoritativeCurrentRequestForStudent_(item, latestRequestByStudent);
    assert.equal(after && after.request_id, before && before.request_id, item.student_id);
  });

  const presence = context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "now");
  assert.equal(presence.total_active_students, 13);
  assert.equal(presence.total_out_now, 4);
  assert.equal(presence.total_in_hostel, 9);
  const names = presence.groups.flatMap((group) => group.students.map((item) => item.nama));
  for (const id of ["A", "B", "C", "E", "G", "H", "INVALID", "STRICT"]) {
    assert.ok(names.includes(`Nama ${id}`), `${id} must remain in hostel`);
  }
  for (const id of ["D", "F", "TIE", "LEGACY", "INACTIVE"]) {
    assert.equal(names.includes(`Nama ${id}`), false, `${id} must not appear in the roster`);
  }
  assert.equal(presence.groups.find((group) => group.label === "LI UMK").count, 1);
});

function makeCache(options = {}) {
  const values = new Map();
  return {
    values,
    get(key) {
      if (options.throwOnGet) throw new Error("cache unavailable");
      return values.has(key) ? values.get(key) : null;
    },
    put(key, value, ttl) {
      if (options.throwOnPut) throw new Error("cache unavailable");
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

function loadGasForCache(cache = makeCache()) {
  const properties = new Map();
  let uuid = 0;
  const context = vm.createContext({
    console: { warn() {} },
    CacheService: { getScriptCache: () => cache },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.has(key) ? properties.get(key) : null,
        setProperty: (key, value) => properties.set(key, String(value))
      })
    },
    Utilities: {
      formatDate: () => "2026-08-25 12:00:00",
      getUuid: () => `uuid-${++uuid}`
    }
  });
  vm.runInContext(gasSource, context);
  context.now_ = () => "2026-08-25 12:00:00";
  return { context, cache, properties };
}

function installPresenceRows(context, state) {
  let sheetReads = 0;
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => {
    sheetReads += 1;
    return (state[sheet.name] || []).map((row) => ({ ...row }));
  };
  context.getStudentLoginDirectory = () => state.directory;
  context.validateCurrentHostelRosterViewer_ = () => "warden";
  return () => sheetReads;
}

function cacheFixture() {
  const students = [student("A"), student("B", "LI", { institution_code: "UMK", nama: "Zara LI" })];
  return {
    STUDENTS: students,
    OUTING_REQUESTS: [],
    directory: {
      mode: "dynamic",
      groups: [
        { key: "GROUP:A2", label: "A2", students: [{ student_id: "A", nama: "Nama A" }] },
        { key: "GROUP:LI:UMK", label: "LI UMK", students: [{ student_id: "B", nama: "Zara LI" }] }
      ]
    }
  };
}

test("shared 20-second snapshot serves public aggregate and authenticated roster with privacy intact", () => {
  const { context, cache } = loadGasForCache();
  const state = cacheFixture();
  const reads = installPresenceRows(context, state);

  const publicSummary = context.getCurrentHostelSummary();
  const roster = context.getCurrentHostelRoster({ role: "warden" });
  assert.equal(reads(), 2, "STUDENTS and OUTING_REQUESTS must each be read only on the first call");
  assert.equal(cache.lastPut.ttl, 20);
  assert.deepEqual(Object.keys(json(publicSummary)).sort(), ["generated_at", "hostel_groups", "total_active_students", "total_in_hostel", "total_out_now"]);
  assert.doesNotMatch(JSON.stringify(publicSummary), /Nama A|Zara LI|"(?:nama|student_id|no_matrik|students)"\s*:/);
  assert.deepEqual(json(roster.groups.flatMap((group) => group.students.map((item) => item.nama))), ["Nama A", "Zara LI"]);
  roster.groups.flatMap((group) => group.students).forEach((item) => assert.deepEqual(Object.keys(json(item)), ["nama"]));
  assert.doesNotMatch(cache.lastPut.value, /student_id|no_matrik|pin|guardian|phone|photo|request_id/i);
});

test("state and student invalidation cannot leave a stale presence snapshot", () => {
  const { context } = loadGasForCache();
  const state = cacheFixture();
  const reads = installPresenceRows(context, state);

  assert.equal(context.loadCurrentHostelPresence_().total_out_now, 0);
  state.OUTING_REQUESTS.push(request("A", "KELUAR", "2026-08-25 10:00:00"));
  assert.equal(context.loadCurrentHostelPresence_().total_out_now, 0, "the live row is intentionally hidden until invalidation");
  context.invalidateOperationalRecordsCache_();
  assert.equal(context.loadCurrentHostelPresence_().total_out_now, 1);

  state.STUDENTS[0].status = "TIDAK AKTIF";
  context.invalidateStudentDirectoryCache_();
  const afterStudentChange = context.loadCurrentHostelPresence_();
  assert.equal(afterStudentChange.total_active_students, 1);
  assert.equal(afterStudentChange.total_out_now, 0);
  assert.equal(reads(), 6, "each invalidation must force one fresh two-sheet calculation");
});

test("cache failures fall back to live calculation without changing projections", () => {
  const { context } = loadGasForCache(makeCache({ throwOnGet: true, throwOnPut: true }));
  const state = cacheFixture();
  const reads = installPresenceRows(context, state);
  const first = context.getCurrentHostelSummary();
  const second = context.getCurrentHostelSummary();
  assert.deepEqual(json(second), json(first));
  assert.equal(reads(), 4, "failed cache access must recompute from both sheets");
  assert.doesNotMatch(JSON.stringify(first), /Nama A|Zara LI|"(?:nama|student_id|no_matrik|students)"\s*:/);
});

test("all authoritative state and grouping mutations reach the centralized presence invalidator", () => {
  for (const name of [
    "submitRequest", "cancelStudentRequest", "approveRequest", "rejectRequest",
    "confirmOut", "confirmIn", "confirmWardenRemoteCheckout"
  ]) {
    assert.match(extractFunction(gasSource, name), /invalidateOperationalRecordsCache_\(/, name);
  }
  for (const name of ["createStudent", "updateStudent", "toggleStudentStatus"]) {
    assert.match(extractFunction(gasSource, name), /invalidateStudentDirectoryCache_\(/, name);
  }
  for (const name of [
    "createStudentGroup", "updateStudentGroup", "toggleStudentGroupStatus",
    "createLiInstitution", "updateLiInstitution", "toggleLiInstitutionStatus", "setStudentGroupConfigEnabled"
  ]) {
    assert.match(extractFunction(gasSource, name), /invalidateStudentGroupConfigCacheV240_\(/, name);
  }
  assert.match(extractFunction(gasSource, "migrateStudentInstitutionCodesCoreV240_"), /invalidateStudentLoginDirectoryCacheV240_\(/);
  assert.match(extractFunction(gasSource, "invalidateOperationalRecordsCache_"), /invalidateCurrentHostelPresenceCache_\(/);
  assert.match(extractFunction(gasSource, "invalidateStudentLoginDirectoryCacheV240_"), /invalidateCurrentHostelPresenceCache_\(/);
  assert.equal((gasSource.match(/removeScriptCache_\("currentHostelPresence"\)/g) || []).length, 1);
});

test("P0-1 changes neither current-hostel response schemas nor Sheet headers", () => {
  assert.deepEqual(
    Object.keys(json(loadPresenceFunctions().toPublicCurrentHostelSummary_({
      generated_at: "now", total_active_students: 0, total_out_now: 0, total_in_hostel: 0, groups: []
    }))).sort(),
    ["generated_at", "hostel_groups", "total_active_students", "total_in_hostel", "total_out_now"]
  );
  const headers = gasSource.slice(gasSource.indexOf("const HEADERS"), gasSource.indexOf("const STATUS"));
  assert.doesNotMatch(headers, /CURRENT_HOSTEL|HOSTEL_PRESENCE|IN_HOSTEL/);
});
