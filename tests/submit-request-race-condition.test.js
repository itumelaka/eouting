const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const end = source.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return source.slice(start, end);
}

test("submitRequest keeps the fresh duplicate read, ID, append and flush in one ScriptLock", () => {
  const source = extractFunction(gasSource, "submitRequest", "approveRequest");
  const lockStart = source.indexOf("withScriptLock_(function ()");
  const requestSheetRead = source.indexOf("getSheet_(SHEETS.requests)", lockStart);
  const requestRowsRead = source.indexOf("getRowsAsObjects_(requestSheet)", requestSheetRead);
  const duplicateCheck = source.indexOf("hasActiveRequestForStudent_(student, requestRows)", requestRowsRead);
  const requestId = source.indexOf("createRequestId_(now)", duplicateCheck);
  const append = source.indexOf("appendObjectRow_(requestSheet", requestId);
  const flush = source.indexOf("SpreadsheetApp.flush()", append);
  const audit = source.indexOf("appendAuditLog", flush);

  [lockStart, requestSheetRead, requestRowsRead, duplicateCheck, requestId, append, flush, audit]
    .forEach((position) => assert.notEqual(position, -1));
  assert.ok(lockStart < requestSheetRead);
  assert.ok(requestSheetRead < requestRowsRead);
  assert.ok(requestRowsRead < duplicateCheck);
  assert.ok(duplicateCheck < requestId);
  assert.ok(requestId < append);
  assert.ok(append < flush);
  assert.ok(flush < audit, "non-atomic notifications must run after the locked write");
});

test("ScriptLock helper always releases the lock after the atomic callback", () => {
  const source = extractFunction(gasSource, "withScriptLock_", "getStudents");
  assert.match(source, /LockService\.getScriptLock\(\)/);
  assert.match(source, /tryLock\(30000\)/);
  assert.match(source, /try\s*{[\s\S]*return callback\(\);[\s\S]*}\s*finally\s*{[\s\S]*lock\.releaseLock\(\)/);
});

test("submission lock timeout is specific while Admin operations keep the configuration default", () => {
  const helperSource = extractFunction(gasSource, "withScriptLock_", "getStudents");
  const submitSource = extractFunction(gasSource, "submitRequest", "approveRequest");
  const context = vm.createContext({
    LockService: {
      getScriptLock: () => ({ tryLock: () => false })
    }
  });
  vm.runInContext(helperSource, context);

  assert.throws(
    () => context.withScriptLock_(() => {}),
    /Konfigurasi sedang dikemas kini\. Sila cuba sebentar lagi\./
  );
  assert.throws(
    () => context.withScriptLock_(() => {}, "Permohonan sedang diproses. Sila cuba sebentar lagi."),
    /Permohonan sedang diproses\. Sila cuba sebentar lagi\./
  );
  assert.match(submitSource, /}, "Permohonan sedang diproses\. Sila cuba sebentar lagi\."\);/);
  assert.match(gasSource, /return withScriptLock_\(function \(\) \{/);
});

test("only pending, warden-approved and out statuses block a new request", () => {
  const source = extractFunction(gasSource, "isActiveRequestStatus_", "hasActiveRequestForStudent_");
  const context = vm.createContext({
    STATUS: {
      pending: "MENUNGGU_KELULUSAN",
      approved: "DILULUSKAN_WARDEN",
      rejected: "DITOLAK_WARDEN",
      out: "KELUAR",
      done: "SELESAI"
    }
  });
  vm.runInContext(source, context);

  assert.equal(context.isActiveRequestStatus_("MENUNGGU_KELULUSAN"), true);
  assert.equal(context.isActiveRequestStatus_("DILULUSKAN_WARDEN"), true);
  assert.equal(context.isActiveRequestStatus_("KELUAR"), true);
  assert.equal(context.isActiveRequestStatus_("DITOLAK_WARDEN"), false);
  assert.equal(context.isActiveRequestStatus_("SELESAI"), false);
});

test("normal student submission ignores repeated submits and exposes loading feedback", () => {
  const start = appSource.indexOf('els.requestForm.addEventListener("submit", async (event) =>');
  const end = appSource.indexOf("function showLoginPanel", start);
  const source = appSource.slice(start, end);
  const setStateSource = extractFunction(appSource, "setStudentRequestSubmitting", "getRecordId");

  assert.match(source, /if \(studentRequestSubmissionInFlight\)\s*{\s*return;/);
  assert.ok(source.indexOf("studentRequestSubmissionInFlight") < source.indexOf('apiPost("submitRequest"'));
  assert.match(source, /setStudentRequestSubmitting\(true, "Menghantar permohonan\.\.\."\)/);
  assert.match(source, /finally\s*{\s*setStudentRequestSubmitting\(false\);/);
  const refresh = source.indexOf("await loadTodayRecords()");
  const refreshedRender = source.indexOf("renderStudent()", refresh);
  const unlock = source.indexOf("setStudentRequestSubmitting(false)", refreshedRender);
  assert.ok(refresh < refreshedRender);
  assert.ok(refreshedRender < unlock);
  assert.match(setStateSource, /submitButton\.disabled = studentRequestSubmissionInFlight/);
  assert.match(setStateSource, /document\.createElement\("span"\)/);
  assert.match(setStateSource, /loadingLabel\.textContent = "Menghantar\.\.\."/);
  assert.match(setStateSource, /classList\.toggle\("is-loading", studentRequestSubmissionInFlight\)/);
  assert.match(setStateSource, /replaceChildren\(spinner, loadingLabel\)/);
  assert.match(setStateSource, /replaceChildren\(\.\.\.originalState\.childNodes\)/);
  assert.match(setStateSource, /setAttribute\("aria-busy"/);
  assert.doesNotMatch(setStateSource, /innerHTML/);
  assert.match(styleSource, /#requestForm \.primary-action\.is-loading:disabled/);
  assert.match(styleSource, /\.student-submit-spinner/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*animation: studentSubmitSpin/);
});

test("semester submission shares the same in-flight guard and loading state", () => {
  const source = extractFunction(appSource, "submitSemesterRequestV160", "validateSemesterRequestV160");
  assert.match(source, /if \(studentRequestSubmissionInFlight\)\s*{\s*return;/);
  assert.match(source, /setStudentRequestSubmitting\(true, "Menghantar permohonan Cuti Semester\.\.\."\)/);
  assert.match(source, /finally\s*{\s*setStudentRequestSubmitting\(false\);/);
  assert.ok(source.indexOf("await loadTodayRecords()") < source.indexOf("render()"));
  assert.ok(source.indexOf("render()") < source.indexOf("setStudentRequestSubmitting(false)"));
});
