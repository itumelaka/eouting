const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function malaysiaParts(value) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23", timeZone: "Asia/Kuala_Lumpur"
  }).formatToParts(value).reduce((result, part) => {
    if (part.type !== "literal") result[part.type] = part.value;
    return result;
  }, {});
}

function formatDate(value, timeZone, format) {
  assert.equal(timeZone, "Asia/Kuala_Lumpur");
  const parts = malaysiaParts(value);
  if (format === "HH:mm") return `${parts.hour}:${parts.minute}`;
  if (format === "yyyy-MM-dd") return `${parts.year}-${parts.month}-${parts.day}`;
  if (format === "yyyy-MM-dd'T'HH:mm:ss") {
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  }
  if (format === "yyyy-MM-dd HH:mm:ss") {
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function createContext(fixedNow) {
  const NativeDate = Date;
  class FixedDate extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : [fixedNow || "2026-08-20T12:00:00+08:00"]));
    }
    static now() {
      return new NativeDate(fixedNow || "2026-08-20T12:00:00+08:00").getTime();
    }
  }
  const context = vm.createContext({
    console,
    Date: FixedDate,
    Intl,
    Utilities: { formatDate, getUuid: () => "uuid" },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock() {} })
    }
  });
  vm.runInContext(gasSource, context);
  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function outsideRecord(overrides = {}) {
  return {
    request_id: "REQ-1",
    status: "KELUAR",
    jenis_permohonan: "OUTING_BIASA",
    tarikh: "2026-08-20",
    tarikh_balik: "2026-08-20",
    masa_balik_dijangka: "22:00",
    masa_keluar: "2026-08-20 18:00:00",
    masa_masuk: "",
    ...overrides
  };
}

test("urgency boundaries use exact elapsed time", () => {
  const context = createContext();
  const record = outsideRecord();
  const cases = [
    ["2026-08-20T21:29:59+08:00", "NORMAL", 0],
    ["2026-08-20T21:30:00+08:00", "DUE_SOON", 1],
    ["2026-08-20T22:00:00+08:00", "DUE_SOON", 1],
    ["2026-08-20T22:00:01+08:00", "LATE", 2],
    ["2026-08-20T22:29:59+08:00", "LATE", 2],
    ["2026-08-20T22:30:00+08:00", "CRITICAL", 3],
    ["2026-08-20T22:59:59+08:00", "CRITICAL", 3],
    ["2026-08-20T23:00:00+08:00", "ACTION_REQUIRED", 4]
  ];
  cases.forEach(([now, state, rank]) => {
    const result = context.getOperationalUrgency_(record, new Date(now));
    assert.equal(result.state, state, now);
    assert.equal(result.severity_rank, rank, now);
    assert.equal(result.timing_valid, true, now);
    assert.equal(result.needs_review, false, now);
  });
});

test("same-day targets prefer snapshotted return fields and use a safe daily date fallback", () => {
  const context = createContext();
  const explicit = plain(context.resolveExpectedReturnTarget_(outsideRecord({
    tarikh: "2026-08-19", tarikh_balik: "2026-08-20", masa_balik_dijangka: "19:15"
  })));
  assert.equal(explicit.expected_return_at, "2026-08-20T19:15:00+08:00");
  assert.equal(explicit.used_date_fallback, false);

  const fallback = plain(context.resolveExpectedReturnTarget_(outsideRecord({
    tarikh: "2026-08-20", tarikh_balik: "", masa_balik_dijangka: "21:30"
  })));
  assert.equal(fallback.expected_return_at, "2026-08-20T21:30:00+08:00");
  assert.equal(fallback.used_date_fallback, true);
});

test("multi-day and midnight-crossing targets remain Malaysia-local", () => {
  const context = createContext();
  const record = outsideRecord({
    jenis_permohonan: "PULANG_BERMALAM",
    tarikh: "2026-08-20",
    tarikh_balik: "2026-08-21",
    masa_balik_dijangka: "00:15"
  });
  const target = context.resolveExpectedReturnTarget_(record);
  assert.equal(target.expected_return_at, "2026-08-21T00:15:00+08:00");
  assert.equal(context.getOperationalUrgency_(record, new Date("2026-08-21T00:15:00+08:00")).state, "DUE_SOON");
  assert.equal(context.getOperationalUrgency_(record, new Date("2026-08-21T00:15:01+08:00")).state, "LATE");
});

test("custom config-driven types use their explicit expected return instead of 22:00", () => {
  const context = createContext();
  const record = outsideRecord({
    jenis_permohonan: "KLINIK",
    masa_balik_dijangka: "18:00"
  });
  const result = context.getOperationalUrgency_(record, new Date("2026-08-20T18:00:01+08:00"));
  assert.equal(result.expected_return_at, "2026-08-20T18:00:00+08:00");
  assert.equal(result.state, "LATE");
});

test("known legacy daily records may fall back to 22:00", () => {
  const context = createContext();
  for (const type of ["OUTING_BIASA", "KECEMASAN", "OUTING_HUJUNG_MINGGU"]) {
    const target = context.resolveExpectedReturnTarget_(outsideRecord({
      jenis_permohonan: type,
      tarikh_balik: "",
      masa_balik_dijangka: ""
    }));
    assert.equal(target.expected_return_at, "2026-08-20T22:00:00+08:00", type);
    assert.equal(target.used_time_fallback, true, type);
  }
});

test("invalid and indeterminate timing returns stable diagnostics instead of NORMAL", () => {
  const context = createContext();
  const cases = [
    [outsideRecord({ tarikh_balik: "2026-02-31" }), "INVALID_EXPECTED_RETURN_DATE"],
    [outsideRecord({ masa_balik_dijangka: "25:00" }), "INVALID_EXPECTED_RETURN_TIME"],
    [outsideRecord({ jenis_permohonan: "PULANG_BERMALAM", tarikh_balik: "", masa_balik_dijangka: "18:00" }), "MISSING_EXPECTED_RETURN_DATE"],
    [outsideRecord({ jenis_permohonan: "PULANG_BERMALAM", tarikh_balik: "2026-08-21", masa_balik_dijangka: "" }), "MISSING_EXPECTED_RETURN_TIME"],
    [outsideRecord({ jenis_permohonan: "PULANG_BERMALAM", tarikh_balik: "", masa_balik_dijangka: "" }), "MISSING_EXPECTED_RETURN_DATE"]
  ];
  cases.forEach(([record, reason]) => {
    const result = context.getOperationalUrgency_(record, new Date("2026-08-20T20:00:00+08:00"));
    assert.equal(result.state, null);
    assert.equal(result.timing_valid, false);
    assert.equal(result.needs_review, true);
    assert.equal(result.reason_code, reason);
    assert.equal(result.next_action_code, "REVIEW_TIMING");
  });
});

test("non-KELUAR lifecycle records are not active urgency records", () => {
  const context = createContext();
  const result = context.getOperationalUrgency_(outsideRecord({ status: "SELESAI" }), new Date());
  assert.equal(result.applicable, false);
  assert.equal(result.state, null);
  assert.equal(result.reason_code, "NOT_APPLICABLE");
  assert.equal(result.needs_review, false);
});

test("Sheet time-only Date values normalize without leaking 1899", () => {
  const context = createContext();
  const target = context.resolveExpectedReturnTarget_(outsideRecord({
    masa_balik_dijangka: new Date("1899-12-30T15:04:35.000Z")
  }));
  assert.equal(target.expected_return_at, "2026-08-20T22:00:00+08:00");
  assert.doesNotMatch(JSON.stringify(target), /1899/);
});

function confirmInFixture(fixedNow, record) {
  const context = createContext(fixedNow);
  const updates = [];
  let current = { ...record };
  let lockCalls = 0;
  context.findActiveGuard_ = () => ({ nama_guard: "Guard A" });
  context.withScriptLock_ = (callback) => {
    lockCalls += 1;
    return callback();
  };
  context.findRowByRequestId_ = () => ({ sheet: {}, rowNumber: 2, record: current });
  context.updateRowByHeaders_ = (_sheet, _row, update) => {
    updates.push(update);
    current = { ...current, ...update };
  };
  context.SpreadsheetApp = { flush() {} };
  context.invalidateOperationalRecordsCache_ = () => {};
  context.appendAuditLog = () => true;
  context.sendTelegramMessage_ = () => true;
  context.buildTelegramStatusMessage_ = () => "";
  context.telegramTitle_ = () => "";
  return {
    context, updates,
    get current() { return current; },
    get lockCalls() { return lockCalls; }
  };
}

test("confirmIn stores exact target as Tidak and one second late as Ya", () => {
  const exact = confirmInFixture("2026-08-20T22:00:00+08:00", outsideRecord());
  exact.context.confirmIn({ request_id: "REQ-1", guard_name: "Guard A", pin: "1234" });
  assert.equal(exact.updates[0].lewat, "Tidak");
  assert.equal(exact.lockCalls, 1);

  const late = confirmInFixture("2026-08-20T22:00:01+08:00", outsideRecord());
  late.context.confirmIn({ request_id: "REQ-1", guard_name: "Guard A", pin: "1234" });
  assert.equal(late.updates[0].lewat, "Ya");
});

test("confirmIn closes the custom-type 22:00 gap and preserves repeated-confirm idempotency", () => {
  const fixture = confirmInFixture("2026-08-20T18:00:01+08:00", outsideRecord({
    jenis_permohonan: "KLINIK",
    masa_balik_dijangka: "18:00"
  }));
  fixture.context.confirmIn({ request_id: "REQ-1", guard_name: "Guard A", pin: "1234" });
  assert.equal(fixture.updates[0].lewat, "Ya");
  const repeated = fixture.context.confirmIn({ request_id: "REQ-1", guard_name: "Guard A", pin: "1234" });
  assert.equal(fixture.updates.length, 1);
  assert.match(repeated.message, /sudah disahkan masuk/i);
  assert.equal(fixture.lockCalls, 2);
});

test("confirmIn conservatively flags indeterminate multi-day timing", () => {
  const fixture = confirmInFixture("2026-08-20T18:00:00+08:00", outsideRecord({
    jenis_permohonan: "PULANG_BERMALAM",
    tarikh_balik: "",
    masa_balik_dijangka: ""
  }));
  fixture.context.confirmIn({ request_id: "REQ-1", guard_name: "Guard A", pin: "1234" });
  assert.equal(fixture.updates[0].lewat, "Ya");
});

test("authenticated projections derive urgency after source loading while public projection stays coarse", () => {
  const context = createContext("2026-08-20T21:45:00+08:00");
  const record = outsideRecord({ nama: "Ali", kelas: "A3", student_id: "S1", no_matrik: "M1" });
  context.getTodayRecordRows_ = () => [{ ...record }];
  context.addProfilePhotoIndicators_ = (rows) => rows;
  context.addWardenApprovalRoles_ = (rows) => rows;
  context.findActiveStudent_ = () => ({ student_id: "S1" });
  const operational = plain(context.getOperationalTodayRecords({
    role: "student", student_id: "S1", no_matrik: "M1"
  }));
  assert.equal(operational[0].operational_urgency.state, "DUE_SOON");

  const publicRows = plain(context.getTodayRecords());
  assert.deepEqual(Object.keys(publicRows[0]).sort(), [
    "belum_masuk", "jenis_permohonan", "kelas", "lewat", "nama", "status"
  ]);
  assert.doesNotMatch(JSON.stringify(publicRows), /operational_urgency|expected_return_at|minutes_to_due|next_action_code/);
});

test("Admin operational projection receives the same urgency object", () => {
  const context = createContext();
  context.calculateOutingDurationMinutes_ = () => 0;
  const result = context.toAdminOperationalRecord_(outsideRecord(), new Date("2026-08-20T22:30:00+08:00"), {});
  assert.equal(result.operational_urgency.state, "CRITICAL");
  assert.equal(result.lewat, true);
});

test("urgency constants stay backend-only and are not Script Properties or OUTING_TYPES fields", () => {
  assert.match(gasSource, /const OPERATIONAL_URGENCY/);
  assert.doesNotMatch(gasSource, /OPERATIONAL_URGENCY_[A-Z_]+.*getProperty/);
  const headerBlock = gasSource.slice(gasSource.indexOf("OUTING_TYPES: ["), gasSource.indexOf("ADMIN_USERS:"));
  assert.doesNotMatch(headerBlock, /urgency|critical|action_required/i);
});
