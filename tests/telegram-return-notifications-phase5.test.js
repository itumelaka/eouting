const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

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
  if (format === "yyyy-MM-dd'T'HH:mm:ss") return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  if (format === "yyyy-MM-dd HH:mm:ss") return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function outsideRecord(requestId, returnTime, overrides = {}) {
  return {
    request_id: requestId,
    student_id: `S-${requestId}`,
    no_matrik: `M-${requestId}`,
    nama: `Pelajar ${requestId}`,
    status: "KELUAR",
    jenis_permohonan: "OUTING_BIASA",
    tarikh: "2026-08-20",
    tarikh_balik: "2026-08-20",
    masa_balik_dijangka: returnTime,
    masa_keluar: "2026-08-20 18:00:00",
    telefon_waris: "0199999999",
    hubungan_waris: "Ibu",
    operational_secret: "DIAGNOSTIC-SECRET",
    ...overrides
  };
}

function createFixture(records, auditRows = [], sendResults = []) {
  const events = [];
  const sends = [];
  const audits = auditRows.map((row) => ({ ...row }));
  let lockCount = 0;
  const context = vm.createContext({
    console,
    Date,
    Intl,
    Utilities: { formatDate, getUuid: () => `uuid-${events.length}` },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }
  });
  vm.runInContext(gasSource, context);
  context.getTodayRecordRows_ = () => records.map((record) => ({ ...record }));
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => sheet.name === "AUDIT_LOG" ? audits.map((row) => ({ ...row })) : [];
  context.withScriptLock_ = (callback) => {
    lockCount += 1;
    events.push("lock:start");
    try { return callback(); } finally { events.push("lock:end"); }
  };
  context.sendTelegramMessage_ = (message) => {
    events.push("send");
    sends.push(message);
    return sendResults.length ? sendResults.shift() : true;
  };
  context.appendAuditLog = (action, requestId, userRole, userName, details, entityType, entityId) => {
    events.push(`audit:${requestId}`);
    const row = { action, request_id: requestId, user_role: userRole, user_name: userName, details, entity_type: entityType, entity_id: entityId };
    audits.push(row);
    return row;
  };
  return {
    context, events, sends, audits,
    get lockCount() { return lockCount; }
  };
}

function stage(result, name) {
  return plain(result.stages).find((item) => item.stage === name);
}

test("authoritative DUE_SOON, CRITICAL and ACTION_REQUIRED map to their exact audit stages", () => {
  const fixture = createFixture([
    outsideRecord("DUE", "22:00"),
    outsideRecord("CRITICAL", "21:15"),
    outsideRecord("ACTION", "20:30")
  ]);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  assert.deepEqual(stage(result, "DUE_SOON").candidate_request_ids, ["DUE"]);
  assert.equal(stage(result, "DUE_SOON").audit_event, "RETURN_REMINDER_SENT");
  assert.deepEqual(stage(result, "CRITICAL").candidate_request_ids, ["CRITICAL"]);
  assert.equal(stage(result, "CRITICAL").audit_event, "RETURN_CRITICAL_SENT");
  assert.deepEqual(stage(result, "ACTION_REQUIRED").candidate_request_ids, ["ACTION"]);
  assert.equal(stage(result, "ACTION_REQUIRED").audit_event, "RETURN_ACTION_REQUIRED_SENT");
});

test("NORMAL, ordinary LATE, needs_review and every non-KELUAR lifecycle are excluded", () => {
  const records = [
    outsideRecord("NORMAL", "23:00"),
    outsideRecord("LATE", "21:30"),
    outsideRecord("REVIEW", "25:00"),
    ...["MENUNGGU_KELULUSAN", "DILULUSKAN_WARDEN", "SELESAI", "DITOLAK_WARDEN", "DIBATALKAN_PELAJAR"]
      .map((status, index) => outsideRecord(`NONOUT-${index}`, "22:00", { status }))
  ];
  const fixture = createFixture(records);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  assert.deepEqual(plain(result.eligible_request_ids), []);
  const skipped = plain(result.skipped);
  assert.ok(skipped.some((item) => item.request_id === "NORMAL" && item.reason === "STATE_NOT_ELIGIBLE"));
  assert.ok(skipped.some((item) => item.request_id === "LATE" && item.reason === "STATE_NOT_ELIGIBLE"));
  assert.ok(skipped.some((item) => item.request_id === "REVIEW" && item.reason === "TIMING_REVIEW_REQUIRED"));
});

test("same-stage audits dedupe independently while lower stages do not block later escalation", () => {
  const records = [
    outsideRecord("DUE-DONE", "22:00"),
    outsideRecord("CRIT-DONE", "21:15"),
    outsideRecord("ACTION-DONE", "20:30"),
    outsideRecord("CRIT-AFTER-REMINDER", "21:15"),
    outsideRecord("ACTION-AFTER-CRITICAL", "20:30")
  ];
  const audits = [
    { request_id: "DUE-DONE", action: "RETURN_REMINDER_SENT" },
    { request_id: "CRIT-DONE", action: "RETURN_CRITICAL_SENT" },
    { request_id: "ACTION-DONE", action: "RETURN_ACTION_REQUIRED_SENT" },
    { request_id: "CRIT-AFTER-REMINDER", action: "RETURN_REMINDER_SENT" },
    { request_id: "ACTION-AFTER-CRITICAL", action: "RETURN_CRITICAL_SENT" }
  ];
  const fixture = createFixture(records, audits);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  assert.deepEqual(stage(result, "DUE_SOON").candidate_request_ids, []);
  assert.deepEqual(stage(result, "CRITICAL").candidate_request_ids, ["CRIT-AFTER-REMINDER"]);
  assert.deepEqual(stage(result, "ACTION_REQUIRED").candidate_request_ids, ["ACTION-AFTER-CRITICAL"]);
});

test("dry-run builds inspectable batches without Telegram, audit writes, row mutation or trigger installation", () => {
  const records = [outsideRecord("D1", "21:55"), outsideRecord("D2", "22:00")];
  const before = JSON.stringify(records);
  const fixture = createFixture(records);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  assert.equal(result.dry_run, true);
  assert.equal(stage(result, "DUE_SOON").batch_count, 1);
  assert.deepEqual(stage(result, "DUE_SOON").batches[0].request_ids, ["D1", "D2"]);
  assert.match(stage(result, "DUE_SOON").batches[0].message, /PERINGATAN WAKTU PULANG/);
  assert.equal(fixture.sends.length, 0);
  assert.equal(fixture.audits.length, 0);
  assert.equal(JSON.stringify(records), before);
  assert.doesNotMatch(gasSource, /ScriptApp\.(?:newTrigger|getProjectTriggers|deleteTrigger)/);
});

test("successful batches send before writing one SENT audit per request", () => {
  const fixture = createFixture([outsideRecord("C1", "21:10"), outsideRecord("C2", "21:00")]);
  const result = fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  assert.equal(fixture.sends.length, 1);
  assert.deepEqual(fixture.audits.map((row) => row.action), ["RETURN_CRITICAL_SENT", "RETURN_CRITICAL_SENT"]);
  assert.ok(fixture.events.indexOf("send") < fixture.events.indexOf("audit:C1"));
  assert.equal(result.sent_batch_count, 1);
  assert.equal(result.audit_written_count, 2);
  assert.equal(fixture.lockCount, 1);
  assert.ok(fixture.events.indexOf("lock:start") < fixture.events.indexOf("send"));
  assert.ok(fixture.events.indexOf("lock:end") > fixture.events.indexOf("audit:C1"));
});

test("Telegram failure writes no SENT audit, mutates no lifecycle data and reports a retryable failure", () => {
  const records = [outsideRecord("A1", "20:30")];
  const before = JSON.stringify(records);
  const fixture = createFixture(records, [], [false]);
  const result = fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  assert.equal(fixture.sends.length, 1);
  assert.equal(fixture.audits.length, 0);
  assert.equal(result.failed_batch_count, 1);
  assert.equal(stage(result, "ACTION_REQUIRED").batches[0].status, "SEND_FAILED");
  assert.equal(JSON.stringify(records), before);
});

test("Telegram success followed by audit failure is reported without claiming exact once", () => {
  const fixture = createFixture([outsideRecord("C1", "21:00")]);
  fixture.context.appendAuditLog = () => false;
  const result = fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  assert.equal(fixture.sends.length, 1);
  assert.equal(result.sent_batch_count, 1);
  assert.equal(result.audit_written_count, 0);
  assert.equal(result.audit_failed_count, 1);
  assert.equal(stage(result, "CRITICAL").batches[0].status, "SENT_AUDIT_PARTIAL");
  assert.match(result.exactly_once_limitation, /not one external transaction|duplicate retry/i);
});

test("same-stage students batch together with deterministic operational ordering", () => {
  const records = [
    outsideRecord("D-LATER", "22:10"), outsideRecord("D-EARLIER", "21:55"),
    outsideRecord("C-LESS", "21:10"), outsideRecord("C-MORE", "21:00"),
    outsideRecord("A-LESS", "20:30"), outsideRecord("A-MORE", "20:00")
  ];
  const fixture = createFixture(records);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  assert.deepEqual(stage(result, "DUE_SOON").candidate_request_ids, ["D-EARLIER", "D-LATER"]);
  assert.deepEqual(stage(result, "CRITICAL").candidate_request_ids, ["C-MORE", "C-LESS"]);
  assert.deepEqual(stage(result, "ACTION_REQUIRED").candidate_request_ids, ["A-MORE", "A-LESS"]);
  assert.equal(stage(result, "DUE_SOON").batch_count, 1);
  assert.equal(stage(result, "CRITICAL").batch_count, 1);
  assert.equal(stage(result, "ACTION_REQUIRED").batch_count, 1);
});

test("oversized stages split into deterministic bounded batches", () => {
  const records = Array.from({ length: 41 }, (_value, index) => outsideRecord(
    `D-${String(index + 1).padStart(2, "0")}`, "22:00",
    { nama: `Pelajar ${String(index + 1).padStart(2, "0")}` }
  ));
  const fixture = createFixture(records);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  const due = stage(result, "DUE_SOON");
  assert.equal(due.batch_count, 2);
  assert.equal(due.batches[0].request_ids.length, 40);
  assert.equal(due.batches[1].request_ids.length, 1);
  assert.ok(due.batches.every((batch) => batch.message.length <= 3500));
});

test("operational messages exclude guardian, selfie, diagnostics and raw machine/action codes", () => {
  const fixture = createFixture([
    outsideRecord("D1", "22:00"), outsideRecord("C1", "21:00"), outsideRecord("A1", "20:00")
  ]);
  const result = fixture.context.scanReturnOperationalNotifications_({ dryRun: true, now: "2026-08-20T21:45:00+08:00" });
  const messages = plain(result.stages).flatMap((item) => item.batches.map((batch) => batch.message)).join("\n");
  assert.doesNotMatch(messages, /0199999999|Ibu|DIAGNOSTIC-SECRET|telefon_waris|hubungan_waris|selfie|next_action_code|DUE_SOON|CRITICAL|ACTION_REQUIRED/);
  assert.match(messages, /PERINGATAN WAKTU PULANG/);
  assert.match(messages, /PELAJAR LEWAT — PERLU SUSULAN/);
  assert.match(messages, /TINDAKAN SEGERA DIPERLUKAN/);
});

test("repeated scanner invocation after successful audits sends nothing twice", () => {
  const fixture = createFixture([outsideRecord("D1", "22:00"), outsideRecord("C1", "21:00")]);
  const first = fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  assert.equal(first.sent_batch_count, 2);
  const second = fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  assert.equal(second.sent_batch_count, 0);
  assert.equal(fixture.sends.length, 2);
});

test("duplicate source rows cannot create duplicate candidates or audits inside one locked scan", () => {
  const record = outsideRecord("D1", "22:00");
  const fixture = createFixture([record, { ...record }]);
  const result = fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  assert.equal(fixture.sends.length, 1);
  assert.equal(fixture.audits.length, 1);
  assert.deepEqual(stage(result, "DUE_SOON").candidate_request_ids, ["D1"]);
  assert.ok(plain(result.skipped).some((item) => item.request_id === "D1" && item.reason === "DUPLICATE_REQUEST_ID"));
});

test("a request may progress through reminder, critical and action-required exactly once each", () => {
  const records = [outsideRecord("R1", "22:00")];
  const fixture = createFixture(records);
  fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T21:45:00+08:00" });
  fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T22:45:00+08:00" });
  fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T23:15:00+08:00" });
  fixture.context.scanReturnOperationalNotifications_({ now: "2026-08-20T23:30:00+08:00" });
  assert.deepEqual(fixture.audits.map((row) => row.action), [
    "RETURN_REMINDER_SENT", "RETURN_CRITICAL_SENT", "RETURN_ACTION_REQUIRED_SENT"
  ]);
  assert.equal(fixture.sends.length, 3);
});

test("scanner is backend-only and existing role projections and Telegram/sendPhoto paths remain untouched", () => {
  assert.doesNotMatch(appSource + indexSource, /scanReturnOperationalNotifications_|RETURN_(?:REMINDER|CRITICAL|ACTION_REQUIRED)_SENT/);
  const postRouter = gasSource.slice(gasSource.indexOf("function doPost"), gasSource.indexOf("function setupDatabase"));
  assert.doesNotMatch(postRouter, /scanReturnOperationalNotifications_/);
  assert.match(gasSource, /function sendTelegramMessage_/);
  assert.match(gasSource, /function buildTelegramStatusMessage_/);
  assert.match(gasSource, /function sendTelegramPhoto_/);
  assert.match(gasSource, /function getOperationalTodayRecords/);
  assert.match(gasSource, /function getTodayRecords/);
  assert.match(gasSource, /function getAdminMonitoring/);
});
