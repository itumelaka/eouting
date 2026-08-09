const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");

function extractFinalFunction(name, nextName) {
  const asyncStart = appSource.lastIndexOf(`async function ${name}`);
  const functionStart = appSource.lastIndexOf(`function ${name}`);
  const start = asyncStart !== -1 && functionStart === asyncStart + 6
    ? asyncStart
    : Math.max(asyncStart, functionStart);
  assert.notEqual(start, -1, `${name} must exist`);

  const boundaries = [`\nfunction ${nextName}`, `\nasync function ${nextName}`]
    .map((marker) => appSource.indexOf(marker, start))
    .filter((index) => index !== -1);
  assert.ok(boundaries.length, `${name} boundary must exist`);
  return appSource.slice(start, Math.min(...boundaries));
}

function fakeClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    toggle: (name, force) => {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
      } else if (force) values.add(name);
      else values.delete(name);
    }
  };
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

function createLifecycleContext(options = {}) {
  const request = options.request || deferred();
  const calls = {
    apiGet: [],
    mapped: [],
    render: 0,
    timestamp: 0,
    scroll: [],
    errors: [],
    intervals: 0,
    clears: 0,
    loginPanelsHidden: 0,
    scrollAfterActivation: false
  };
  const hadCachedData = options.hadCachedData === true;
  const oldRecords = options.oldRecords || [{ nama: "DATA LAMA" }];
  const monitorNameList = {
    classList: fakeClassList(),
    children: hadCachedData ? [{}] : [],
    innerHTML: hadCachedData ? "KAD LAMA" : ""
  };
  const els = {
    accessScreen: { classList: fakeClassList() },
    appWorkspace: { classList: fakeClassList(["active"]) },
    publicMonitoringPanel: {
      classList: fakeClassList(),
      hidden: true,
      scrollIntoView: (settings) => calls.scroll.push(settings)
    },
    monitorNavButton: {
      classList: fakeClassList(),
      setAttribute: (name, value) => {
        if (name === "aria-pressed") calls.ariaPressed = value;
      }
    },
    monitorLoading: { hidden: true },
    monitorSummary: { classList: fakeClassList(), innerHTML: hadCachedData ? "RINGKASAN LAMA" : "" },
    monitorNameList,
    monitorRefreshButton: { disabled: false, textContent: "Refresh" }
  };

  const context = vm.createContext({
    console: { error: () => {} },
    els,
    isLiveMode: false,
    apiGet: async (action) => {
      calls.apiGet.push(action);
      return request.promise;
    },
    mapPublicMonitoringRecord: (record) => {
      calls.mapped.push(record);
      return { ...record, publicMapped: true };
    },
    renderMonitoringPageV1612: () => { calls.render += 1; },
    updateMonitorLastUpdatedV1612: () => {
      calls.timestamp += 1;
      vm.runInContext("monitorLastUpdatedAt = new Date(0)", context);
    },
    emptyState: (message) => `ERROR: ${message}`,
    showError: (message, title) => calls.errors.push({ message, title }),
    isIntentionalNavigationV200: (eventOrOptions) => Boolean(eventOrOptions && (
      eventOrOptions.type === "click" || eventOrOptions.intentional === true
    )),
    scheduleIntentionalScrollV200: (target) => {
      calls.scrollAfterActivation = target.classList.contains("active");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    hideLoginPanels: () => { calls.loginPanelsHidden += 1; },
    window: {
      setInterval: () => {
        calls.intervals += 1;
        return 100 + calls.intervals;
      },
      clearInterval: () => { calls.clears += 1; }
    }
  });

  vm.runInContext(`
    let activeRefreshPage = "access";
    let monitoringRefreshIntervalId = null;
    let monitorLastUpdatedAt = null;
    let monitorIsLoading = false;
    let monitorHasLoadedOnce = ${hadCachedData};
    let outingRecords = ${JSON.stringify(oldRecords)};
  `, context);
  vm.runInContext(extractFinalFunction("stopMonitoringAutoRefresh", "updateMonitoringLastUpdated"), context);
  vm.runInContext(extractFinalFunction("setPublicMonitoringPanelActiveV200", "deactivatePublicMonitoringPanelV200"), context);
  vm.runInContext(extractFinalFunction("deactivatePublicMonitoringPanelV200", "openMonitoringPage"), context);
  vm.runInContext(extractFinalFunction("openMonitoringPage", "loadPublicMonitoringRecords"), context);
  vm.runInContext(extractFinalFunction("loadPublicMonitoringRecords", "refreshMonitoringRecords"), context);
  vm.runInContext(extractFinalFunction("refreshMonitoringRecords", "setMonitorLoadingState"), context);
  vm.runInContext(extractFinalFunction("setMonitorLoadingState", "renderMonitoringPageV1612"), context);
  vm.runInContext(`
    globalThis.readMonitoringState = () => ({
      activeRefreshPage,
      monitoringRefreshIntervalId,
      monitorLastUpdatedAt,
      monitorIsLoading,
      monitorHasLoadedOnce,
      outingRecords
    });
  `, context);

  return { context, calls, els, request };
}

test("first monitoring click activates before scrolling and performs one public mapped render", async () => {
  const { context, calls, els, request } = createLifecycleContext();

  const firstOpen = context.openMonitoringPage({ type: "click" });

  assert.equal(els.publicMonitoringPanel.hidden, false);
  assert.equal(els.publicMonitoringPanel.classList.contains("active"), true);
  assert.equal(els.monitorNavButton.classList.contains("active"), true);
  assert.equal(calls.ariaPressed, "true");
  assert.equal(els.accessScreen.classList.contains("hidden"), false);
  assert.equal(els.appWorkspace.classList.contains("active"), false);
  assert.equal(calls.scrollAfterActivation, true);
  assert.deepEqual(JSON.parse(JSON.stringify(calls.scroll)), [{ behavior: "smooth", block: "start" }]);
  assert.deepEqual(calls.apiGet, ["getTodayRecords"]);
  assert.equal(els.monitorLoading.hidden, false);

  const repeatedOpen = context.openMonitoringPage({ type: "click" });
  const autoRefresh = context.refreshMonitoringRecords("auto");
  assert.equal(calls.apiGet.length, 1, "repeated click and auto refresh must share the active request");

  const rawRecords = [{ nama: "NAMA PELAJAR", kelas: "A2", status: "KELUAR" }];
  request.resolve(rawRecords);
  await Promise.all([firstOpen, repeatedOpen, autoRefresh]);

  const state = context.readMonitoringState();
  assert.equal(calls.render, 1);
  assert.equal(calls.mapped.length, 1);
  assert.equal(state.outingRecords[0].publicMapped, true);
  assert.equal(state.monitorHasLoadedOnce, true);
  assert.equal(calls.timestamp, 1);
  assert.equal(els.monitorLoading.hidden, true);
  assert.equal(calls.intervals, 1);
});

test("failed first load does not mark monitoring successful or set a new timestamp", async () => {
  const { context, calls, els, request } = createLifecycleContext();

  const refresh = context.openMonitoringPage({ type: "click" });
  assert.equal(els.publicMonitoringPanel.hidden, false);
  assert.equal(els.monitorLoading.hidden, false);
  assert.equal(calls.apiGet.length, 1);
  request.reject(new Error("network unavailable"));
  await refresh;

  const state = context.readMonitoringState();
  assert.equal(state.monitorHasLoadedOnce, false);
  assert.equal(state.monitorLastUpdatedAt, null);
  assert.equal(calls.timestamp, 0);
  assert.equal(calls.render, 0);
  assert.match(els.monitorNameList.innerHTML, /gagal dimuat/i);
});

test("successful empty first load renders once and timestamps only after success", async () => {
  const { context, calls, els, request } = createLifecycleContext();

  const firstOpen = context.openMonitoringPage({ type: "click" });
  assert.equal(els.publicMonitoringPanel.hidden, false);
  assert.equal(els.monitorLoading.hidden, false);
  assert.equal(calls.apiGet.length, 1);

  request.resolve([]);
  await firstOpen;

  const state = context.readMonitoringState();
  assert.deepEqual(JSON.parse(JSON.stringify(state.outingRecords)), []);
  assert.equal(calls.render, 1);
  assert.equal(calls.timestamp, 1);
  assert.equal(els.monitorLoading.hidden, true);
});

test("non-intentional monitoring open does not auto-scroll", async () => {
  const request = deferred();
  const { context, calls } = createLifecycleContext({ request });
  const open = context.openMonitoringPage();
  assert.deepEqual(calls.scroll, []);
  request.resolve([]);
  await open;
});

test("switching away stops monitoring and reopening creates no duplicate interval", async () => {
  const firstRequest = deferred();
  const { context, calls, els } = createLifecycleContext({ request: firstRequest });
  const firstOpen = context.openMonitoringPage({ type: "click" });
  firstRequest.resolve([]);
  await firstOpen;

  assert.equal(calls.intervals, 1);
  context.deactivatePublicMonitoringPanelV200();
  assert.equal(els.publicMonitoringPanel.hidden, true);
  assert.equal(els.monitorNavButton.classList.contains("active"), false);
  assert.equal(calls.ariaPressed, "false");
  assert.equal(calls.clears, 1);
  assert.equal(context.readMonitoringState().monitoringRefreshIntervalId, null);

  const reopened = context.openMonitoringPage({ type: "click" });
  await reopened;
  assert.equal(calls.intervals, 2, "reopening creates one replacement interval after the old one is cleared");
  const repeated = context.openMonitoringPage({ type: "click" });
  await repeated;
  assert.equal(calls.intervals, 2, "repeated active clicks must not create duplicate intervals");
});

test("Pelajar, Warden and Guard choices collapse monitoring before showing login", () => {
  const panels = {
    studentLoginPanel: { classList: fakeClassList() },
    wardenLoginPanel: { classList: fakeClassList() },
    guardLoginPanel: { classList: fakeClassList() },
    studentLoginMessage: { textContent: "lama" }
  };
  let deactivations = 0;
  const context = vm.createContext({
    els: panels,
    deactivatePublicMonitoringPanelV200: () => { deactivations += 1; },
    hideLoginPanels: () => {
      panels.studentLoginPanel.classList.remove("active");
      panels.wardenLoginPanel.classList.remove("active");
      panels.guardLoginPanel.classList.remove("active");
    }
  });
  vm.runInContext(extractFinalFunction("showLoginPanel", "hideLoginPanels"), context);

  for (const role of ["student", "warden", "guard"]) {
    context.showLoginPanel(role);
    assert.equal(panels[`${role}LoginPanel`].classList.contains("active"), true);
  }
  assert.equal(deactivations, 3);
});

test("failed cached refresh retains old records and uses the friendly refresh error", async () => {
  const { context, calls, els, request } = createLifecycleContext({ hadCachedData: true });

  const refresh = context.refreshMonitoringRecords("button");
  assert.equal(els.monitorNameList.innerHTML, "KAD LAMA");
  request.reject(new Error("network unavailable"));
  await refresh;

  const state = context.readMonitoringState();
  assert.equal(els.monitorNameList.innerHTML, "KAD LAMA");
  assert.equal(state.outingRecords[0].nama, "DATA LAMA");
  assert.equal(calls.render, 0);
  assert.equal(calls.timestamp, 0);
  assert.equal(calls.errors.length, 1);
});

test("public monitoring loader is GET-only and independent from generic or authenticated loaders", () => {
  const loaderSource = extractFinalFunction("loadPublicMonitoringRecords", "refreshMonitoringRecords");
  const refreshSource = extractFinalFunction("refreshMonitoringRecords", "setMonitorLoadingState");

  assert.match(loaderSource, /apiGet\("getTodayRecords"\)/);
  assert.match(loaderSource, /mapPublicMonitoringRecord/);
  assert.doesNotMatch(loaderSource, /apiPost|currentSession|isLiveMode|loadTodayRecords/);
  assert.doesNotMatch(refreshSource, /\brender\s*\(|loadTodayRecords|renderMonitoring\s*\(/);
});
