const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function extractFunction(source, name) {
  const functionStart = source.indexOf(`function ${name}(`);
  assert.notEqual(functionStart, -1, `${name} must exist`);
  const start = source.slice(Math.max(0, functionStart - 6), functionStart) === "async "
    ? functionStart - 6
    : functionStart;
  const parameterStart = source.indexOf("(", functionStart);
  let parameterDepth = 0;
  let bodyStart = -1;
  for (let index = parameterStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0) {
      bodyStart = source.indexOf("{", index + 1);
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `${name} body must exist`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function response(status, body, url = "https://script.googleusercontent.com/macros/echo") {
  return {
    status,
    ok: status >= 200 && status < 300,
    url,
    text: async () => typeof body === "string" ? body : JSON.stringify(body)
  };
}

function createRequestRuntime(options = {}) {
  const warnings = [];
  const delays = [];
  const clearedTimers = [];
  const runtimeWindow = {
    setTimeout: options.setTimeout || setTimeout,
    clearTimeout: (id) => {
      clearedTimers.push(id);
      if (options.clearTimeout) options.clearTimeout(id);
      else clearTimeout(id);
    }
  };
  const context = vm.createContext({
    AbortController,
    Date,
    Error,
    JSON,
    Map,
    Math: options.Math || Math,
    Promise,
    TypeError,
    URL,
    URLSearchParams,
    console: { warn: (...args) => warnings.push(args) },
    delay: async (milliseconds) => delays.push(milliseconds),
    fetch: options.fetch,
    window: runtimeWindow
  });
  const functions = [
    "apiGet",
    "apiGetWithParams",
    "normalizeApiGetParamsV19",
    "getApiGetInFlightKeyV19",
    "getLiveGetRetryDelayV19",
    "fetchApiGetWithRetry",
    "createLiveApiErrorV19",
    "getResponseHostnameV19",
    "isTransientHttpStatusV19",
    "isGoogleRedirectHostnameV19",
    "classifyLiveGetErrorV19",
    "parseApiResponse",
    "cleanApiError"
  ].map((name) => extractFunction(appSource, name)).join("\n");
  vm.runInContext(`
    const LIVE_API_UNSTABLE_MESSAGE = "Sambungan live tidak stabil. Sila cuba lagi.";
    const LIVE_GET_TIMEOUT_MS_V19 = 22000;
    const LIVE_GET_MAX_ATTEMPTS_V19 = 2;
    const LIVE_GET_RETRY_MIN_DELAY_MS_V19 = 500;
    const LIVE_GET_RETRY_MAX_DELAY_MS_V19 = 1200;
    const inFlightApiGetsV19 = new Map();
    const ALLOW_MOCK_MODE = false;
    function getGasWebAppUrlV200() { return "https://script.google.com/macros/s/PRODUCTION/exec"; }
    ${functions}
    this.apiGet = apiGet;
    this.apiGetWithParams = apiGetWithParams;
    this.fetchApiGetWithRetry = fetchApiGetWithRetry;
    this.inFlightSize = () => inFlightApiGetsV19.size;
  `, context);
  return { context, warnings, delays, clearedTimers };
}

test("r19 bounds each GET attempt at 22 seconds and uses two attempts with jitter", () => {
  const retrySource = extractFunction(appSource, "fetchApiGetWithRetry");
  assert.match(appSource, /const LIVE_GET_TIMEOUT_MS_V19 = 22000/);
  assert.match(appSource, /const LIVE_GET_MAX_ATTEMPTS_V19 = 2/);
  assert.match(retrySource, /new AbortController\(\)/);
  assert.match(retrySource, /controller\.abort\(\)/);
  assert.match(retrySource, /signal: controller\.signal/);
  assert.match(retrySource, /clearTimeout\(timeoutId\)/);
  assert.match(appSource, /LIVE_GET_RETRY_MIN_DELAY_MS_V19 = 500/);
  assert.match(appSource, /LIVE_GET_RETRY_MAX_DELAY_MS_V19 = 1200/);
  assert.match(retrySource, /delay\(getLiveGetRetryDelayV19\(\)\)/);
});

test("network failure retries once and safe diagnostics contain metadata only", async () => {
  let calls = 0;
  const runtime = createRequestRuntime({
    fetch: async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("network detail that must not be logged");
      return response(200, { ok: true, data: ["ok"] });
    },
    Math: Object.assign(Object.create(Math), { random: () => 0 })
  });
  const result = await runtime.context.fetchApiGetWithRetry("getWardens", new URLSearchParams());
  assert.deepEqual(Array.from(result), ["ok"]);
  assert.equal(calls, 2);
  assert.equal(runtime.delays.length, 1);
  assert.ok(runtime.delays[0] >= 500 && runtime.delays[0] <= 1200);
  assert.equal(runtime.warnings.length, 1);
  const metadata = runtime.warnings[0][1];
  assert.deepEqual(Object.keys(metadata).sort(), [
    "action", "attempt", "category", "elapsed_ms", "final_hostname", "status", "will_retry"
  ]);
  assert.equal(metadata.action, "getWardens");
  assert.equal(metadata.category, "network");
  assert.doesNotMatch(JSON.stringify(metadata), /network detail|user_content_key|pin|payload|token/i);
});

test("a timed-out attempt aborts and retries once without leaving timers active", async () => {
  let calls = 0;
  let timerCount = 0;
  const runtime = createRequestRuntime({
    setTimeout: (callback) => {
      timerCount += 1;
      if (timerCount === 1) queueMicrotask(callback);
      return timerCount;
    },
    clearTimeout: () => {},
    fetch: (_url, options) => {
      calls += 1;
      if (calls === 2) return Promise.resolve(response(200, { ok: true, data: "recovered" }));
      return new Promise((_resolve, reject) => {
        const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (options.signal.aborted) abort();
        else options.signal.addEventListener("abort", abort, { once: true });
      });
    }
  });
  assert.equal(await runtime.context.fetchApiGetWithRetry("health", new URLSearchParams()), "recovered");
  assert.equal(calls, 2);
  assert.equal(runtime.warnings[0][1].category, "timeout");
  assert.deepEqual(runtime.clearedTimers, [1, 2]);
});

for (const status of [408, 429, 500, 503]) {
  test(`HTTP ${status} retries once`, async () => {
    let calls = 0;
    const runtime = createRequestRuntime({
      fetch: async () => {
        calls += 1;
        return calls === 1
          ? response(status, { ok: true, data: null })
          : response(200, { ok: true, data: status });
      }
    });
    assert.equal(await runtime.context.fetchApiGetWithRetry("health", new URLSearchParams()), status);
    assert.equal(calls, 2);
  });
}

test("valid application, authentication, and validation errors never retry", async () => {
  for (const message of ["Unknown action.", "Akses sesi diperlukan.", "Bulan tidak sah."]) {
    let calls = 0;
    const runtime = createRequestRuntime({
      fetch: async () => {
        calls += 1;
        return response(200, { ok: false, error: message });
      }
    });
    await assert.rejects(
      runtime.context.fetchApiGetWithRetry("test", new URLSearchParams()),
      (error) => error.message === message && error.category === "application" && error.retryable === false
    );
    assert.equal(calls, 1, message);
    assert.equal(runtime.delays.length, 0, message);
  }
});

test("transient Google redirect HTML retries, but an unrelated HTML 404 does not", async () => {
  let calls = 0;
  const transient = createRequestRuntime({
    fetch: async () => {
      calls += 1;
      return calls === 1
        ? response(404, "<html>temporary redirect failure</html>")
        : response(200, { ok: true, data: "ok" });
    }
  });
  assert.equal(await transient.context.fetchApiGetWithRetry("health", new URLSearchParams()), "ok");
  assert.equal(calls, 2);
  assert.equal(transient.warnings[0][1].category, "google_redirect_html");
  assert.equal(transient.warnings[0][1].final_hostname, "script.googleusercontent.com");

  let permanentCalls = 0;
  const permanent = createRequestRuntime({
    fetch: async () => {
      permanentCalls += 1;
      return response(404, "<html>not found</html>", "https://example.test/not-found");
    }
  });
  await assert.rejects(permanent.context.fetchApiGetWithRetry("health", new URLSearchParams()));
  assert.equal(permanentCalls, 1);
});

test("identical normalized GETs share one in-flight Promise and registry clears after settle", async () => {
  let calls = 0;
  let releaseFirst;
  const runtime = createRequestRuntime({
    fetch: async () => {
      calls += 1;
      if (calls === 1) return new Promise((resolve) => { releaseFirst = resolve; });
      return response(200, { ok: true, data: "second" });
    }
  });
  const first = runtime.context.apiGetWithParams("getOutingStats", { year: 2026, month: 8, _ts: "ignored-a" });
  const duplicate = runtime.context.apiGetWithParams("getOutingStats", { month: 8, _ts: "ignored-b", year: 2026 });
  assert.strictEqual(first, duplicate);
  assert.equal(calls, 1);
  assert.equal(runtime.context.inFlightSize(), 1);
  releaseFirst(response(200, { ok: true, data: "first" }));
  assert.equal(await first, "first");
  await Promise.resolve();
  assert.equal(runtime.context.inFlightSize(), 0);

  const next = runtime.context.apiGetWithParams("getOutingStats", { month: 8, year: 2026 });
  assert.notStrictEqual(next, first);
  assert.equal(await next, "second");
  assert.equal(calls, 2);
});

function classList() {
  const values = new Set();
  return {
    add: (value) => values.add(value),
    remove: (value) => values.delete(value),
    toggle: (value, active) => active ? values.add(value) : values.delete(value),
    contains: (value) => values.has(value)
  };
}

function createAdminRuntime({ monitoring, roster, priorMonitoring = null, priorRoster = null }) {
  const calls = { monitoringRender: 0, rosterRender: 0, photos: 0 };
  const elements = {
    adminMonitoringRefreshButton: { disabled: false },
    adminMonitoringMessage: { textContent: "", classList: classList() },
    adminMonitoringUpdated: { textContent: "OLD TIME" },
    adminMonitoringList: { innerHTML: priorMonitoring ? "GOOD MONITORING" : "" },
    adminActionQueue: { innerHTML: priorMonitoring ? "GOOD QUEUE" : "" },
    adminCurrentHostelStatus: { textContent: "", classList: classList() },
    adminCurrentHostelRoster: { innerHTML: priorRoster ? "GOOD ROSTER" : "" }
  };
  const context = vm.createContext({
    Boolean,
    Promise,
    currentSession: { role: "admin", id: "session" },
    adminMonitoringV210: priorMonitoring,
    staffCurrentHostelRosterV240: priorRoster,
    els: elements,
    setButtonLoadingVisualV220: () => {},
    apiPost: async (action) => {
      const outcome = action === "getAdminMonitoring" ? monitoring : roster;
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
    buildAdminCredentialPayloadV200: () => ({}),
    buildCurrentHostelRosterAccessPayloadV240: () => ({}),
    emptyState: (message) => `EMPTY:${message}`,
    formatDisplayDateTime: (value) => `TIME:${value}`,
    renderAdminMonitoringV210: () => {
      calls.monitoringRender += 1;
      elements.adminMonitoringList.innerHTML = "NEW MONITORING";
      elements.adminActionQueue.innerHTML = "NEW QUEUE";
    },
    renderStaffCurrentHostelRosterV240: () => {
      calls.rosterRender += 1;
      elements.adminCurrentHostelRoster.innerHTML = "NEW ROSTER";
    },
    loadProfilePhotoThumbnailsForStudents: () => { calls.photos += 1; }
  });
  vm.runInContext([
    extractFunction(appSource, "loadAdminMonitoringV210"),
    extractFunction(appSource, "setAdminCurrentHostelStatusV19"),
    extractFunction(appSource, "showAdminCurrentHostelFailureV19")
  ].join("\n"), context);
  vm.runInContext(`
    this.load = loadAdminMonitoringV210;
    this.state = () => ({ adminMonitoringV210, staffCurrentHostelRosterV240, currentSession });
  `, context);
  return { context, calls, elements };
}

test("Admin monitoring success survives roster failure with a roster-specific state", async () => {
  const monitoring = { generated_at: "NOW", records: [{ student_id: "S1" }] };
  const runtime = createAdminRuntime({ monitoring, roster: new Error("roster failed") });
  await runtime.context.load();
  assert.equal(runtime.context.state().adminMonitoringV210, monitoring);
  assert.equal(runtime.calls.monitoringRender, 1);
  assert.equal(runtime.elements.adminMonitoringList.innerHTML, "NEW MONITORING");
  assert.equal(runtime.elements.adminActionQueue.innerHTML, "NEW QUEUE");
  assert.match(runtime.elements.adminCurrentHostelStatus.textContent, /gagal dimuatkan/);
  assert.match(runtime.elements.adminCurrentHostelRoster.innerHTML, /Senarai penghuni gagal dimuatkan/);
});

test("Admin roster success survives monitoring failure and preserves last good monitoring", async () => {
  const priorMonitoring = { generated_at: "OLD", records: [{ student_id: "OLD" }] };
  const newRoster = { total: 1, groups: [] };
  const runtime = createAdminRuntime({
    monitoring: new Error("monitoring failed"),
    roster: newRoster,
    priorMonitoring
  });
  await runtime.context.load();
  assert.equal(runtime.context.state().adminMonitoringV210, priorMonitoring);
  assert.equal(runtime.context.state().staffCurrentHostelRosterV240, newRoster);
  assert.equal(runtime.elements.adminMonitoringList.innerHTML, "GOOD MONITORING");
  assert.equal(runtime.elements.adminActionQueue.innerHTML, "GOOD QUEUE");
  assert.equal(runtime.elements.adminMonitoringUpdated.textContent, "OLD TIME");
  assert.match(runtime.elements.adminMonitoringMessage.textContent, /Data terakhir/);
  assert.equal(runtime.calls.rosterRender, 1);
});

test("failed Admin refresh preserves both prior monitoring and prior roster", async () => {
  const priorMonitoring = { generated_at: "OLD", records: [] };
  const priorRoster = { total: 2, groups: [] };
  const runtime = createAdminRuntime({
    monitoring: new Error("monitoring failed"),
    roster: new Error("roster failed"),
    priorMonitoring,
    priorRoster
  });
  await runtime.context.load();
  assert.equal(runtime.context.state().adminMonitoringV210, priorMonitoring);
  assert.equal(runtime.context.state().staffCurrentHostelRosterV240, priorRoster);
  assert.equal(runtime.elements.adminMonitoringList.innerHTML, "GOOD MONITORING");
  assert.equal(runtime.elements.adminCurrentHostelRoster.innerHTML, "GOOD ROSTER");
  assert.match(runtime.elements.adminCurrentHostelStatus.textContent, /Data terakhir/);
});

test("logout reset and request-session guard prevent stale authenticated data retention", () => {
  const reset = extractFunction(appSource, "clearAdminRuntimeCredentialV200");
  const load = extractFunction(appSource, "loadAdminMonitoringV210");
  assert.match(reset, /adminMonitoringV210 = null/);
  assert.match(reset, /staffCurrentHostelRosterV240 = null/);
  assert.match(reset, /adminCurrentHostelRoster\.innerHTML = ""/);
  assert.match(load, /const sessionAtRequest = currentSession/);
  assert.match(load, /currentSession !== sessionAtRequest/);
});

test("Student directory is applied before optional Warden and Guard master completion", () => {
  const start = appSource.indexOf("loadLiveMasters = async function loadLiveMastersWithStudentLoadingState");
  const end = appSource.indexOf("function setStudentDropdownState", start);
  const source = appSource.slice(start, end);
  assert.match(source, /const studentRequest = apiGet\("getStudentLoginDirectory"\)/);
  assert.match(source, /const staffRequests = Promise\.allSettled/);
  assert.ok(source.indexOf("await studentRequest") < source.indexOf("await staffRequests"));
  assert.ok(source.indexOf("renderStudentDropdownState(students)") < source.indexOf("await staffRequests"));
});

test("r19 resilience remains intact under the r21 presentation cache", () => {
  assert.match(htmlSource, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(htmlSource, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(workerSource, /eouting-cache-v2\.4\.0-r21/);
  assert.match(extractFunction(appSource, "fetchApiGetWithRetry"), /getGasWebAppUrlV200\(\)/);
  assert.doesNotMatch(appSource, /sessionStorage[^\n]*googleusercontent|localStorage[^\n]*googleusercontent/);
});
