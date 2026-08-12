const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function sourceBetween(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return source.slice(from, to);
}

function createBackend(status = "MENUNGGU_KELULUSAN", owner = true) {
  const updates = [];
  const audits = [];
  const telegram = [];
  let lockCalls = 0;
  const student = { student_id: "S1", no_matrik: "M1", nama: "Ali" };
  const row = {
    request_id: "R1", student_id: owner ? "S1" : "S2", no_matrik: owner ? "M1" : "M2",
    nama: owner ? "Ali" : "Bakar", jenis_permohonan: "CUSTOM_TYPE", status
  };
  const context = {
    STATUS: {
      pending: "MENUNGGU_KELULUSAN", approved: "DILULUSKAN_WARDEN",
      out: "KELUAR", done: "SELESAI", studentCancelled: "DIBATALKAN_PELAJAR"
    },
    SHEETS: { requests: "OUTING_REQUESTS" },
    HEADERS: { OUTING_REQUESTS: ["request_id", "status", "sebab_batal_pelajar", "masa_batal_pelajar", "dibatalkan_oleh"] },
    getSheet_: () => ({ name: "OUTING_REQUESTS" }),
    ensureHeaders_: () => {},
    findActiveStudent_: () => student,
    findRowByRequestId_: () => ({ sheet: {}, rowNumber: 2, record: { ...row } }),
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    updateRowByHeaders_: (_sheet, _rowNumber, value) => updates.push(value),
    now_: () => "2026-08-12 12:34:56",
    SpreadsheetApp: { flush() {} },
    withScriptLock_: (callback) => { lockCalls += 1; return callback(); },
    appendAuditLog: (...args) => audits.push(args),
    sendTelegramMessage_: (message) => telegram.push(message),
    buildTelegramStudentCancellationMessage_: () => "cancelled"
  };
  vm.createContext(context);
  vm.runInContext(sourceBetween(gasSource, "function validateStudentCancellationReason_", "function approveRequest"), context);
  return { context, updates, audits, telegram, get lockCalls() { return lockCalls; } };
}

test("student cancellation UI is status-generic and shown only for pending or approved", () => {
  const helper = sourceBetween(appSource, "function canStudentCancelRequest", "function canSubmitNormalOuting");
  assert.match(helper, /MENUNGGU_KELULUSAN/);
  assert.match(helper, /DILULUSKAN_WARDEN/);
  assert.doesNotMatch(helper, /jenis_permohonan|KLINIK|OUTING_BIASA/);
  assert.match(sourceBetween(appSource, "function studentStatusCard", "function studentStatusInfo"), /data-student-cancel/);
  assert.match(appSource, /DIBATALKAN_PELAJAR[\s\S]*Dibatalkan oleh Pelajar/);
});

test("responsive dialog provides required accessible textarea validation and no prompt", () => {
  assert.match(indexSource, /id="studentCancelModal" role="dialog" aria-modal="true"/);
  assert.match(indexSource, /id="studentCancelReason"[\s\S]*required minlength="5" maxlength="500"/);
  const flow = sourceBetween(appSource, "function validateStudentCancellationReason", "function bindStudentHistoryToggles");
  assert.match(flow, /\.trim\(\)/);
  assert.match(flow, /trimmed\.length < 5/);
  assert.match(flow, /trimmed\.length > 500/);
  assert.match(flow, /studentCancellationSubmitting/);
  assert.match(flow, /Membatalkan\.\.\./);
  assert.doesNotMatch(flow, /window\.prompt/);
  assert.match(flow, /event\.key === "Escape"/);
  assert.match(flow, /studentCancellationTrigger\.focus/);
});

test("backend rejects invalid reasons before any write", () => {
  for (const reason of ["", "   ", "abcd", "x".repeat(501)]) {
    const fixture = createBackend();
    assert.throws(() => fixture.context.cancelStudentRequest({ request_id: "R1", student_id: "S1", no_matrik: "M1", sebab_batal_pelajar: reason }));
    assert.equal(fixture.updates.length, 0);
  }
});

test("backend trims valid reason and atomically stores cancellation metadata", () => {
  const fixture = createBackend("MENUNGGU_KELULUSAN");
  const result = fixture.context.cancelStudentRequest({ request_id: "R1", student_id: "S1", no_matrik: "M1", sebab_batal_pelajar: "  Balik bersama keluarga  " });
  assert.equal(fixture.lockCalls, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.updates[0])), {
    status: "DIBATALKAN_PELAJAR", sebab_batal_pelajar: "Balik bersama keluarga",
    masa_batal_pelajar: "2026-08-12 12:34:56", dibatalkan_oleh: "PELAJAR"
  });
  assert.equal(result.status, "DIBATALKAN_PELAJAR");
  assert.equal(fixture.audits[0][0], "CANCEL_STUDENT_REQUEST");
  assert.equal(fixture.telegram.length, 0);
});

test("backend permits approved cancellation and sends a non-blocking lifecycle notification", () => {
  const fixture = createBackend("DILULUSKAN_WARDEN");
  fixture.context.cancelStudentRequest({ request_id: "R1", student_id: "S1", no_matrik: "M1", reason: "Pelan keluarga berubah" });
  assert.equal(fixture.updates[0].status, "DIBATALKAN_PELAJAR");
  assert.deepEqual(fixture.telegram, ["cancelled"]);
});

test("backend rejects another student's request and every non-cancellable state", () => {
  const other = createBackend("MENUNGGU_KELULUSAN", false);
  assert.throws(() => other.context.cancelStudentRequest({ request_id: "R1", student_id: "S1", no_matrik: "M1", reason: "Sebab yang sah" }), /pelajar lain/);
  for (const status of ["KELUAR", "SELESAI", "DITOLAK_WARDEN", "DIBATALKAN_PELAJAR", "UNKNOWN_TERMINAL"]) {
    const fixture = createBackend(status);
    assert.throws(() => fixture.context.cancelStudentRequest({ request_id: "R1", student_id: "S1", no_matrik: "M1", reason: "Sebab yang sah" }), /statusnya telah berubah/);
    assert.equal(fixture.updates.length, 0);
  }
});

test("cancelled requests are terminal across duplicate, Warden, Guard, history and statistics logic", () => {
  const activeHelper = sourceBetween(gasSource, "function isActiveRequestStatus_", "function hasActiveRequestForStudent_");
  assert.doesNotMatch(activeHelper, /studentCancelled|DIBATALKAN_PELAJAR/);
  assert.match(sourceBetween(appSource, "function renderWarden", "function isReturnSelfieSubmitted"), /record\.status === STATUS\.pending[\s\S]*record\.status === STATUS\.approved/);
  assert.match(sourceBetween(appSource, "function renderGuard", "function renderDashboard"), /record\.status === STATUS\.approved[\s\S]*record\.status === STATUS\.out/);
  assert.match(sourceBetween(appSource, "function isStudentHistoryRecord", "function studentHistoryCard"), /DIBATALKAN_PELAJAR/);
  assert.match(gasSource, /const completed = status === STATUS\.done/);
  assert.match(gasSource, /if \(status === STATUS\.done\) totals\.total_completed \+= 1/);
});

test("race safety re-reads cancellation and Guard confirm-out status under ScriptLock", () => {
  const cancel = sourceBetween(gasSource, "function cancelStudentRequest", "function approveRequest");
  const confirmOut = sourceBetween(gasSource, "function confirmOut", "function confirmIn");
  for (const source of [cancel, confirmOut]) {
    const lock = source.indexOf("withScriptLock_");
    const read = source.indexOf("findRowByRequestId_", lock);
    const status = source.indexOf("record.status", read);
    const update = source.indexOf("updateRowByHeaders_", status);
    assert.ok(lock !== -1 && read > lock && status > read && update > status);
  }
});

test("public projection never exposes cancellation reason while authenticated records do", () => {
  const publicProjection = sourceBetween(appSource, "function mapPublicMonitoringRecord", "function parseDateValue");
  assert.doesNotMatch(publicProjection, /sebab_batal_pelajar|masa_batal_pelajar/);
  const authenticatedProjection = sourceBetween(appSource, "function mapLiveRecord", "function mapPublicMonitoringRecord");
  assert.match(authenticatedProjection, /sebab_batal_pelajar/);
});
