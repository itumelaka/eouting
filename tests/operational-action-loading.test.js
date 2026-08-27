const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(name, nextName) {
  const asyncStart = appSource.indexOf(`async function ${name}`);
  const start = asyncStart !== -1 ? asyncStart : appSource.indexOf(`function ${name}`);
  const asyncEnd = appSource.indexOf(`async function ${nextName}`, start);
  const end = asyncEnd !== -1 ? asyncEnd : appSource.indexOf(`function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return appSource.slice(start, end);
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

class FakeClassList {
  constructor() {
    this.values = new Set();
  }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor(label = "") {
    this.childNodes = label ? [{ textContent: label }] : [];
    this.disabled = false;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.className = "";
    this.group = null;
    this.textContent = label;
  }
  closest(selector) { return selector === ".record-actions" ? this.group : null; }
  replaceChildren(...nodes) { this.childNodes = nodes; }
  hasAttribute(name) { return this.attributes.has(name); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
}

function createActionGroup(labels) {
  const group = new FakeElement();
  const buttons = labels.map((label) => new FakeElement(label));
  buttons.forEach((button) => { button.group = group; });
  group.querySelectorAll = (selector) => selector === "button" ? buttons : [];
  return { group, buttons };
}

function flushPromises() {
  return new Promise((resolve) => setImmediate(resolve));
}

function createWardenFixture() {
  const apiGate = deferred();
  const refreshGate = deferred();
  const apiCalls = [];
  const { group, buttons } = createActionGroup(["Luluskan", "Tolak"]);
  const context = vm.createContext({
    console,
    document: { createElement: () => new FakeElement() },
    currentSession: { role: "warden", user: { name: "WARDEN", pin: "1234" } },
    isLiveMode: true,
    STATUS: { approved: "Diluluskan Warden", rejected: "Ditolak Warden" },
    outingRecords: [{ id: "REQ-1", status: "Menunggu Kelulusan" }],
    apiPost: (action, payload) => {
      apiCalls.push({ action, payload });
      return action === "getTodayRecords" ? refreshGate.promise : apiGate.promise;
    },
    mapLiveRecord: (record) => ({ ...record }),
    getRecordId: (record) => record.id,
    fetchWardenOperationalRecordsPerf01: () => refreshGate.promise,
    applyWardenOperationalRecordsPerf01() {},
    updateWardenLastUpdated() {},
    showSuccess() {},
    showModeNotice() {},
    showError() {},
    render() {}
  });
  vm.runInContext([
    "const wardenActionLocks = {};",
    "let wardenMutationGenerationPerf01 = 0;",
    "let wardenReconcileRequestedGenerationPerf01 = 0;",
    "let wardenReconcileInFlightPerf01 = null;",
    extractFunction("setOperationalActionLoading", "clearOperationalActionLoading"),
    extractFunction("clearOperationalActionLoading", "updateStatus"),
    extractFunction("updateStatus", "confirmOut")
  ].join("\n"), context);
  return { context, apiGate, refreshGate, apiCalls, group, buttons };
}

function createGuardFixture(kind) {
  const apiGate = deferred();
  const refreshGate = deferred();
  const apiCalls = [];
  const label = kind === "out" ? "Sahkan Keluar" : "Sahkan Masuk";
  const { group, buttons } = createActionGroup([label]);
  const record = kind === "out"
    ? { id: "REQ-1", status: "Diluluskan Warden", outAt: null, masa_keluar: "" }
    : { id: "REQ-1", status: "Sedang Keluar", outAt: new Date(), masa_keluar: new Date(), returnedAt: null, masa_masuk: "" };
  const context = vm.createContext({
    console,
    document: { createElement: () => new FakeElement() },
    window: { prompt: () => "" },
    currentSession: { role: "guard", user: { name: "GUARD", pin: "5678" } },
    isLiveMode: true,
    STATUS: { approved: "Diluluskan Warden", out: "Sedang Keluar", returned: "Sudah Pulang" },
    RETURN_SELFIE_STATUS: { pending: "BELUM_HANTAR" },
    findRecordById: () => record,
    cloneRecord: (value) => ({ ...value }),
    isAfterReturnLimit: () => false,
    updateLocalRecord() {},
    apiPost: (action, payload) => {
      apiCalls.push({ action, payload });
      return apiGate.promise;
    },
    loadTodayRecords: () => refreshGate.promise,
    showSuccess() {},
    showWarning() {},
    showModeNotice() {},
    showError() {}
  });
  vm.runInContext([
    "const guardActionLocks = {};",
    extractFunction("setOperationalActionLoading", "clearOperationalActionLoading"),
    extractFunction("clearOperationalActionLoading", "updateStatus"),
    extractFunction("confirmOut", "confirmIn"),
    extractFunction("confirmIn", "isGuardActionPending"),
    extractFunction("isGuardActionPending", "setGuardActionPending"),
    extractFunction("setGuardActionPending", "clearGuardActionPending"),
    extractFunction("clearGuardActionPending", "findRecordById")
  ].join("\n"), context);
  return { context, apiGate, refreshGate, apiCalls, group, buttons };
}

test("Warden approve applies the authoritative record and unlocks before reconciliation", async () => {
  const fixture = createWardenFixture();
  const [approve, reject] = fixture.buttons;
  const action = fixture.context.updateStatus("REQ-1", fixture.context.STATUS.approved, approve);
  fixture.context.updateStatus("REQ-1", fixture.context.STATUS.approved, approve);

  assert.equal(fixture.apiCalls.length, 1);
  assert.equal(fixture.apiCalls[0].action, "approveRequest");
  assert.equal(approve.disabled, true);
  assert.equal(reject.disabled, true);
  assert.equal(approve.childNodes[1].textContent, "Meluluskan...");
  assert.equal(approve.getAttribute("aria-busy"), "true");

  fixture.apiGate.resolve({ id: "REQ-1", status: fixture.context.STATUS.approved });
  await flushPromises();
  await action;

  assert.equal(approve.disabled, false);
  assert.equal(reject.disabled, false);
  assert.equal(approve.childNodes[0].textContent, "Luluskan");
  assert.equal(approve.classList.contains("is-loading"), false);
  assert.equal(fixture.context.outingRecords[0].status, fixture.context.STATUS.approved);
  assert.equal(fixture.apiCalls.length, 1, "reconciliation must not launch a second mutation");
  fixture.refreshGate.resolve([]);
  await flushPromises();
});

test("Warden reject enters loading once and restores both controls after failure", async () => {
  const fixture = createWardenFixture();
  const [approve, reject] = fixture.buttons;
  const action = fixture.context.updateStatus("REQ-2", fixture.context.STATUS.rejected, reject);
  fixture.context.updateStatus("REQ-2", fixture.context.STATUS.rejected, reject);

  assert.equal(fixture.apiCalls.length, 1);
  assert.equal(fixture.apiCalls[0].action, "rejectRequest");
  assert.equal(approve.disabled, true);
  assert.equal(reject.disabled, true);
  assert.equal(reject.childNodes[1].textContent, "Menolak...");

  fixture.apiGate.reject(new Error("gagal"));
  await action;
  assert.equal(approve.disabled, false);
  assert.equal(reject.disabled, false);
  assert.equal(reject.childNodes[0].textContent, "Tolak");
  assert.equal(reject.hasAttribute("aria-busy"), false);
});

test("Guard confirm-out enters loading once and stays protected through refresh", async () => {
  const fixture = createGuardFixture("out");
  const [button] = fixture.buttons;
  const action = fixture.context.confirmOut("REQ-1", button);
  fixture.context.confirmOut("REQ-1", button);

  assert.equal(fixture.apiCalls.length, 1);
  assert.equal(fixture.apiCalls[0].action, "confirmOut");
  assert.equal(button.disabled, true);
  assert.equal(button.childNodes[1].textContent, "Mengesahkan keluar...");

  fixture.apiGate.resolve({});
  await flushPromises();
  assert.equal(button.disabled, true, "confirm-out must remain locked during record refresh/render");
  fixture.refreshGate.resolve();
  await action;
  assert.equal(button.disabled, false);
  assert.equal(button.childNodes[0].textContent, "Sahkan Keluar");
});

test("Guard confirm-in enters loading once and restores controls after failure", async () => {
  const fixture = createGuardFixture("in");
  const [button] = fixture.buttons;
  const action = fixture.context.confirmIn("REQ-1", button);
  fixture.context.confirmIn("REQ-1", button);

  assert.equal(fixture.apiCalls.length, 1);
  assert.equal(fixture.apiCalls[0].action, "confirmIn");
  assert.equal(button.disabled, true);
  assert.equal(button.childNodes[1].textContent, "Mengesahkan masuk...");

  fixture.apiGate.reject(new Error("gagal"));
  await action;
  assert.equal(button.disabled, false);
  assert.equal(button.childNodes[0].textContent, "Sahkan Masuk");
  assert.equal(button.classList.contains("is-loading"), false);
  assert.equal(fixture.group.hasAttribute("aria-busy"), false);
});

test("operational loading is DOM-safe and reuses the reduced-motion Clay spinner", () => {
  const loadingSource = extractFunction("setOperationalActionLoading", "clearOperationalActionLoading");
  const clearSource = extractFunction("clearOperationalActionLoading", "updateStatus");
  const wardenSource = extractFunction("updateStatus", "confirmOut");
  const outSource = extractFunction("confirmOut", "confirmIn");
  const inSource = extractFunction("confirmIn", "isGuardActionPending");

  assert.doesNotMatch(`${loadingSource}\n${clearSource}`, /innerHTML/);
  assert.match(loadingSource, /student-submit-spinner operational-action-spinner/);
  assert.match(loadingSource, /controls\.forEach[\s\S]*control\.disabled = true/);
  assert.match(clearSource, /control\.disabled = disabled/);
  assert.doesNotMatch(wardenSource, /await loadTodayRecords\(\)/);
  assert.match(wardenSource, /applyAuthoritativeWardenRecordPerf01/);
  assert.match(wardenSource, /reconcileWardenRecordsAfterActionPerf01\(\)/);
  assert.ok(outSource.indexOf("await loadTodayRecords()") < outSource.indexOf("clearOperationalActionLoading"));
  assert.ok(inSource.indexOf("await loadTodayRecords()") < inSource.indexOf("clearOperationalActionLoading"));
  assert.match(styleSource, /\.record-actions \.action-button\.is-loading:disabled/);
  assert.match(styleSource, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*studentSubmitSpin/);
});
