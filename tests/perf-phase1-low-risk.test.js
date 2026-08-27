const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function extractFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  assert.ok(match, `Missing function ${name}`);
  const braceStart = source.indexOf("{", match.index);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(match.index, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("saved Student restore reuses the single startup records request", () => {
  const startSession = extractFunction(app, "startSession");
  const startStudent = extractFunction(app, "startStudentSession");
  const restore = extractFunction(app, "restoreSavedSession");

  assert.equal((startSession.match(/refreshStudentLiveRecords\(true\)/g) || []).length, 1);
  assert.match(startSession, /return initialRecordsRequest/);
  assert.match(startStudent, /const initialRecordsRequest = startSession\("student", student\)/);
  assert.match(startStudent, /return initialRecordsRequest/);
  assert.match(restore, /const initialRecordsRequest = startStudentSession\(student\)/);
  assert.match(restore, /await initialRecordsRequest/);
  assert.doesNotMatch(restore, /loadTodayRecords\(/);
  assert.match(restore, /session\.role === "warden"[\s\S]*?await wardenDirectoryLoadPromisePerf01/);
  assert.match(restore, /session\.role === "guard"[\s\S]*?await guardDirectoryLoadPromisePerf01/);
});

test("Warden reconciliation refreshes records without reloading physical-presence roster", () => {
  const action = extractFunction(app, "updateStatus");
  const reconcile = extractFunction(app, "reconcileWardenRecordsAfterActionPerf01");
  const recordsOnly = extractFunction(app, "loadWardenOperationalRecordsOnlyPerf01");
  const fetchRecords = extractFunction(app, "fetchWardenOperationalRecordsPerf01");
  const fullRefresh = extractFunction(app, "loadWardenRecordsOnly");

  assert.match(action, /const updatedRecord = await apiPost\(action/);
  assert.match(action, /applyAuthoritativeWardenRecordPerf01\(id, updatedRecord\)/);
  assert.match(action, /reconcileWardenRecordsAfterActionPerf01\(\)/);
  assert.doesNotMatch(action, /await reconcileWardenRecordsAfterActionPerf01/);
  assert.match(reconcile, /fetchWardenOperationalRecordsPerf01\(reconciliationGeneration\)/);
  assert.match(recordsOnly, /const loadGeneration = wardenMutationGenerationPerf01/);
  assert.match(recordsOnly, /wardenMutationGenerationPerf01 !== loadGeneration/);
  assert.match(fetchRecords, /pendingEntry\.wardenMutationGeneration < requiredMutationGeneration/);
  assert.match(fetchRecords, /await pendingEntry\.request/);
  assert.doesNotMatch(`${reconcile}\n${recordsOnly}\n${fetchRecords}`, /getCurrentHostelRoster/);
  assert.match(fullRefresh, /getCurrentHostelRoster/);
});

test("newer Warden mutations discard stale reconciliation and trigger one fresh follow-up", async () => {
  const firstReconciliation = deferred();
  const secondReconciliation = deferred();
  const gates = [firstReconciliation, secondReconciliation];
  let fetchCount = 0;
  const context = vm.createContext({
    console: { error() {} },
    fetchWardenOperationalRecordsPerf01: () => {
      const gate = gates[fetchCount];
      fetchCount += 1;
      return gate.promise;
    },
    updateWardenLastUpdated() {},
    render() {}
  });
  vm.runInContext(`
    let outingRecords = [
      { id: "REQ-A", status: "pending" },
      { id: "REQ-B", status: "pending" }
    ];
    let wardenMutationGenerationPerf01 = 0;
    let wardenReconcileRequestedGenerationPerf01 = 0;
    let wardenReconcileInFlightPerf01 = null;
    const mapLiveRecord = (record) => ({ ...record });
    const getRecordId = (record) => record.id;
    ${extractFunction(app, "applyWardenOperationalRecordsPerf01")}
    ${extractFunction(app, "applyAuthoritativeWardenRecordPerf01")}
    ${extractFunction(app, "reconcileWardenRecordsAfterActionPerf01")}
    globalThis.readRecords = () => outingRecords.map((record) => ({ ...record }));
  `, context);

  context.applyAuthoritativeWardenRecordPerf01("REQ-A", { id: "REQ-A", status: "approved" });
  const reconciliation = context.reconcileWardenRecordsAfterActionPerf01();
  context.applyAuthoritativeWardenRecordPerf01("REQ-B", { id: "REQ-B", status: "approved" });
  context.reconcileWardenRecordsAfterActionPerf01();
  assert.equal(fetchCount, 1, "the second mutation must coalesce behind the active reconciliation");

  firstReconciliation.resolve([
    { id: "REQ-A", status: "approved" },
    { id: "REQ-B", status: "pending" }
  ]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetchCount, 2, "one genuinely fresh reconciliation must start after the stale one settles");
  assert.deepEqual(
    Array.from(context.readRecords(), (record) => record.status),
    ["approved", "approved"],
    "the stale response must not overwrite B's authoritative mutation response"
  );

  secondReconciliation.resolve([
    { id: "REQ-A", status: "approved" },
    { id: "REQ-B", status: "approved" }
  ]);
  await reconciliation;
  assert.deepEqual(Array.from(context.readRecords(), (record) => record.status), ["approved", "approved"]);
});

test("automatic and manual Warden/Guard refreshes cannot overlap", () => {
  assert.match(extractFunction(app, "refreshWardenRecords"), /if \(isWardenLoading\) return false/);
  const guard = extractFunction(app, "refreshGuardRecords");
  assert.match(guard, /if \(isGuardLoading\) return false/);
  assert.ok(guard.indexOf("isGuardLoading = true") < guard.indexOf("await apiPost"));
  assert.match(guard, /finally \{\s*isGuardLoading = false/);
});

test("core mutations perform one request lookup and reconstruct the written record", () => {
  for (const name of ["approveRequest", "rejectRequest", "confirmOut", "confirmIn"]) {
    const source = extractFunction(gas, name);
    assert.equal((source.match(/findRowByRequestId_\(requestId\)/g) || []).length, 1, `${name} must scan once`);
    assert.match(source, /Object\.assign\(\{\}, found\.record/);
    assert.match(source, /SpreadsheetApp\.flush\(\)/);
    assert.match(source, /withScriptLock_/);
  }

  const submit = extractFunction(gas, "submitRequest");
  assert.match(submit, /const persisted = findRowByRequestId_\(requestId\)/);
  assert.match(submit, /String\(persisted\.record\.status \|\| ""\)\.trim\(\) !== computedInitialStatus/);
});

test("Warden and Guard directory results are applied as each request settles", async () => {
  const start = app.indexOf("loadLiveMasters = async function loadLiveMastersWithStudentLoadingState");
  const end = app.indexOf("function setStudentDropdownState", start);
  const source = app.slice(start, end);
  const studentGate = deferred();
  const wardenGate = deferred();
  const guardGate = deferred();
  const applied = [];
  const requests = {
    getStudentLoginDirectory: studentGate.promise,
    getWardens: wardenGate.promise,
    getGuards: guardGate.promise
  };
  const context = vm.createContext({
    console: { warn() {}, error() {} },
    loadLiveMasters() {},
    apiGet: (action) => requests[action],
    setStudentDropdownState() {},
    normalizeStudentLoginDirectoryV240: (value) => value,
    applyStudentLoginDirectoryV240: () => applied.push("student"),
    updateWardenMasterList: () => applied.push("warden"),
    updateGuardMasterList: () => applied.push("guard"),
    updateDataModeIndicator() {},
    renderStudentDropdownState() {},
    showStudentLoadFailurePanel() {},
    showModeNotice() {},
    students: [],
    isLiveMode: false,
    dataModeMessage: ""
  });
  vm.runInContext(source, context);
  const loading = context.loadLiveMasters();
  let studentLoadSettled = false;
  loading.then(() => { studentLoadSettled = true; });

  wardenGate.resolve([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(applied, ["warden"], "Warden names must not wait for Student or Guard");

  studentGate.resolve([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(studentLoadSettled, true, "Student startup must not wait for the Guard directory");
  assert.deepEqual(applied, ["warden", "student"]);

  guardGate.reject(new Error("guard unavailable"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(applied, ["warden", "student"], "a Guard failure must not suppress Warden data");
});
