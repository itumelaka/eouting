const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");

function extractFunction(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  const end = appSource.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return appSource.slice(start, end);
}

function extractOptionalFunction(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  if (start === -1) return "";
  const end = appSource.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return appSource.slice(start, end);
}

function makeList() {
  let html = "";
  let buttons = [];

  return {
    get innerHTML() {
      return html;
    },
    set innerHTML(value) {
      html = String(value);
      buttons = Array.from(html.matchAll(/data-(in|out)="([^"]+)"/g), ([, action, id]) => ({
        action,
        dataset: { [action]: id },
        listeners: [],
        addEventListener(type, handler) {
          this.listeners.push({ type, handler });
        }
      }));
    },
    querySelectorAll(selector) {
      if (selector === "[data-in]") return buttons.filter((button) => button.action === "in");
      if (selector === "[data-out]") return buttons.filter((button) => button.action === "out");
      return [];
    },
    get buttons() {
      return buttons;
    }
  };
}

function makeRecord(id, requestType, status = "Sedang Keluar") {
  return {
    id,
    request_id: id,
    jenis_permohonan: requestType,
    status,
    outAt: status === "Sedang Keluar" ? new Date("2026-07-14T08:00:00+08:00") : null,
    masa_keluar: status === "Sedang Keluar" ? "2026-07-14 08:00:00" : "",
    returnedAt: null,
    masa_masuk: ""
  };
}

function loadGuardRenderContext(records) {
  const generalList = makeList();
  const approvedList = makeList();
  const specialList = makeList();
  const confirmedIds = [];
  const context = vm.createContext({
    STATUS: { approved: "Diluluskan Warden", out: "Sedang Keluar" },
    REQUEST_TYPE: {
      normal: "OUTING_BIASA",
      emergency: "KECEMASAN",
      overnight: "PULANG_BERMALAM",
      semester: "CUTI_SEMESTER"
    },
    outingRecords: records,
    els: { guardApprovedList: approvedList, guardOutList: generalList },
    document: {
      querySelector(selector) {
        return selector.includes("guardOvernightNotReturnedSection") ? specialList : null;
      }
    },
    ensureGuardRefreshControls() {},
    emptyState: (message) => `<div class="empty-state">${message}</div>`,
    recordCard(record, mode) {
      const action = mode === "guard-in" ? `<button data-in="${record.request_id}">Sahkan Masuk</button>` : "";
      return `<article id="record-card-${record.request_id}" data-record-card="1" data-request-type="${record.jenis_permohonan}">${action}</article>`;
    },
    confirmOut() {},
    confirmIn(id) {
      confirmedIds.push(id);
    }
  });

  vm.runInContext([
    extractFunction("getRecordId", "getRecordStudentId"),
    extractOptionalFunction("uniqueRecordsByRequestId", "renderGuard"),
    extractFunction("renderGuard", "renderDashboard"),
    extractFunction("renderOvernightListV15", "isOvernightNotReturnedV15"),
    extractFunction("isOvernightNotReturnedV15", "ensureCsvExportButtonsV15")
  ].join("\n"), context);

  return { context, generalList, specialList, confirmedIds };
}

function renderOperationalSections(fixture) {
  fixture.context.renderGuard();
  fixture.context.renderOvernightListV15(
    "#guardOvernightNotReturnedSection [data-overnight-not-returned-list]",
    "guard-in"
  );
}

function renderedIds(list) {
  return Array.from(list.innerHTML.matchAll(/id="record-card-([^"]+)"/g), ([, id]) => id);
}

test("each OUT category renders once in its correct Guard operational section", () => {
  const fixture = loadGuardRenderContext([
    makeRecord("REQ-NORMAL", "OUTING_BIASA"),
    makeRecord("REQ-EMERGENCY", "KECEMASAN"),
    makeRecord("REQ-OVERNIGHT", "PULANG_BERMALAM"),
    makeRecord("REQ-SEMESTER", "CUTI_SEMESTER")
  ]);

  renderOperationalSections(fixture);

  assert.deepEqual(renderedIds(fixture.generalList), ["REQ-NORMAL", "REQ-EMERGENCY"]);
  assert.deepEqual(renderedIds(fixture.specialList), ["REQ-OVERNIGHT", "REQ-SEMESTER"]);
  const buttons = [...fixture.generalList.buttons, ...fixture.specialList.buttons];
  assert.equal(buttons.length, 4);
  assert.equal(new Set(buttons.map((button) => button.dataset.in)).size, 4);
});

test("defensive request_id deduplication keeps one card and confirmIn action per request", () => {
  const uniqueRecords = [
    makeRecord("REQ-NORMAL", "OUTING_BIASA"),
    makeRecord("REQ-EMERGENCY", "KECEMASAN"),
    makeRecord("REQ-OVERNIGHT", "PULANG_BERMALAM"),
    makeRecord("REQ-SEMESTER", "CUTI_SEMESTER")
  ];
  const fixture = loadGuardRenderContext([...uniqueRecords, ...uniqueRecords.map((record) => ({ ...record }))]);

  renderOperationalSections(fixture);

  const buttons = [...fixture.generalList.buttons, ...fixture.specialList.buttons];
  assert.equal(buttons.length, 4);
  buttons.forEach((button) => {
    assert.equal(button.listeners.length, 1);
    button.listeners[0].handler();
  });
  assert.deepEqual(fixture.confirmedIds.sort(), uniqueRecords.map((record) => record.request_id).sort());
});

test("rendering Guard operational sections twice replaces cards without multiplying them", () => {
  const fixture = loadGuardRenderContext([
    makeRecord("REQ-NORMAL", "OUTING_BIASA"),
    makeRecord("REQ-EMERGENCY", "KECEMASAN"),
    makeRecord("REQ-OVERNIGHT", "PULANG_BERMALAM"),
    makeRecord("REQ-SEMESTER", "CUTI_SEMESTER")
  ]);

  renderOperationalSections(fixture);
  renderOperationalSections(fixture);

  const buttons = [...fixture.generalList.buttons, ...fixture.specialList.buttons];
  const ids = [...renderedIds(fixture.generalList), ...renderedIds(fixture.specialList)];
  assert.equal(buttons.length, 4);
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4, "Guard operational sections must not create duplicate DOM ids");
  buttons.forEach((button) => assert.equal(button.listeners.length, 1));
});

test("special not-returned helper accepts only eligible STATUS.out records", () => {
  const fixture = loadGuardRenderContext([]);
  const approvedOvernight = makeRecord("REQ-APPROVED", "PULANG_BERMALAM", "Diluluskan Warden");
  approvedOvernight.outAt = new Date("2026-07-14T08:00:00+08:00");
  approvedOvernight.masa_keluar = "2026-07-14 08:00:00";

  assert.equal(fixture.context.isOvernightNotReturnedV15(approvedOvernight), false);
  assert.equal(fixture.context.isOvernightNotReturnedV15(makeRecord("REQ-OUT", "PULANG_BERMALAM")), true);
});

test("Guard quick filter includes the special list and reapplies after it is rendered", () => {
  const ensureFiltersSource = extractFunction("ensureQuickFiltersV15", "ensureQuickFilterGroupV15");
  const enhancementStart = appSource.indexOf("function enhanceOperationalMonitoringV15");
  const enhancementEnd = appSource.indexOf("\nconst QUICK_FILTERS_V15", enhancementStart);
  assert.notEqual(enhancementStart, -1, "enhanceOperationalMonitoringV15 must exist");
  assert.notEqual(enhancementEnd, -1, "enhanceOperationalMonitoringV15 boundary must exist");
  const enhancementSource = appSource.slice(enhancementStart, enhancementEnd);

  assert.match(ensureFiltersSource, /guardOvernightNotReturnedSection/);
  assert.ok(
    enhancementSource.indexOf("renderOvernightNotReturnedSectionsV15()") < enhancementSource.indexOf("ensureQuickFiltersV15()"),
    "special cards must render before the active Guard quick filter is reapplied"
  );
});

test("manual and auto Guard refresh use the enhanced render path", () => {
  const refreshSource = extractFunction("refreshGuardRecords", "startGuardAutoRefresh");
  const autoRefreshSource = extractFunction("startGuardAutoRefresh", "stopGuardAutoRefresh");

  assert.match(refreshSource, /else\s*{\s*render\(\);\s*}/);
  assert.match(autoRefreshSource, /refreshGuardRecords\("auto"\)/);
});
