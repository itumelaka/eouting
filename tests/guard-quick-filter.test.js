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

function loadGuardFilterContext() {
  const start = appSource.indexOf("const GUARD_QUICK_FILTERS_V15");
  const end = appSource.indexOf("\nfunction ensureQuickFiltersV15", start);
  assert.notEqual(start, -1, "Guard-specific filter configuration must exist");
  assert.notEqual(end, -1, "Guard filter configuration boundary must exist");

  const context = vm.createContext({
    document: {
      createElement: () => ({ className: "", dataset: {}, textContent: "", remove() {} })
    },
    els: {}
  });
  vm.runInContext([
    appSource.slice(start, end),
    extractFunction("applyQuickFilterV15", "capitalizeFilterKeyV15"),
    extractFunction("capitalizeFilterKeyV15", "ensureOvernightMonitoringSectionsV15"),
    "globalThis.guardFilters = GUARD_QUICK_FILTERS_V15;"
  ].join("\n"), context);
  return context;
}

function makeEmptyContainer() {
  const container = {
    cards: [],
    empty: { className: "empty-state", dataset: {}, textContent: "initial", remove() {} },
    querySelectorAll: () => container.cards,
    querySelector(selector) {
      if (selector === "[data-filter-empty='1']") {
        return container.empty && container.empty.dataset.filterEmpty === "1" ? container.empty : null;
      }
      if (selector === ".empty-state") return container.empty;
      return null;
    },
    appendChild(node) {
      container.empty = node;
    }
  };
  return container;
}

test("Guard uses only filters compatible with approved and out records", () => {
  const context = loadGuardFilterContext();
  const labels = Array.from(context.guardFilters, ([, label]) => label);

  assert.deepEqual(labels, ["Semua", "Outing Harian", "Pulang Bermalam", "Cuti Semester", "Kecemasan", "Lewat"]);
  assert.ok(!labels.includes("Menunggu Kelulusan"));
  assert.ok(!labels.includes("Sedang Keluar"));
  assert.ok(!labels.includes("Selesai Hari Ini"));

  const ensureFilters = extractFunction("ensureQuickFiltersV15", "ensureQuickFilterGroupV15");
  assert.match(ensureFilters, /guardOvernightNotReturnedSection/);
  assert.match(ensureFilters, /"guard"[\s\S]*\[els\.guardApprovedList, els\.guardOutList, guardOvernightList\][\s\S]*GUARD_QUICK_FILTERS_V15[\s\S]*guardFilterEmptyMessageV15/);
});

test("Outing Harian excludes emergency records while Kecemasan includes them", () => {
  const context = loadGuardFilterContext();
  const attributeContext = vm.createContext({
    REQUEST_TYPE: {
      normal: "OUTING_BIASA",
      emergency: "KECEMASAN",
      overnight: "PULANG_BERMALAM"
    },
    STATUS: {
      pending: "Menunggu Kelulusan",
      out: "Sedang Keluar",
      returned: "Sudah Pulang"
    },
    escapeHtml: String,
    getRecordId: () => "R1",
    recordDomId: () => "record-card-R1",
    isAfterReturnLimit: () => false
  });
  vm.runInContext(extractFunction("recordDataAttributes", "recordDomId"), attributeContext);
  const attributes = attributeContext.recordDataAttributes({
    status: "Sedang Keluar",
    jenis_permohonan: "KECEMASAN"
  });
  assert.match(attributes, /data-filter-normal="0"/);
  assert.match(attributes, /data-filter-emergency="1"/);

  const card = {
    dataset: { filterNormal: "0", filterEmergency: "1" },
    hidden: false
  };
  const container = makeEmptyContainer();
  container.cards = [card];
  context.applyQuickFilterV15([container], "normal", "Tiada rekod.");
  assert.equal(card.hidden, true);
  context.applyQuickFilterV15([container], "emergency", "Tiada rekod.");
  assert.equal(card.hidden, false);
});

test("Guard updates both empty states contextually even when neither section has cards", () => {
  const context = loadGuardFilterContext();
  const approved = makeEmptyContainer();
  const out = makeEmptyContainer();
  context.els.guardApprovedList = approved;
  context.els.guardOutList = out;

  const expected = {
    overnight: [
      "Tiada rekod Pulang Bermalam yang sedia untuk keluar.",
      "Tiada rekod Pulang Bermalam yang sedang bermalam."
    ],
    semester: [
      "Tiada rekod Cuti Semester yang sedia untuk keluar.",
      "Tiada rekod Cuti Semester yang sedang bercuti."
    ],
    emergency: [
      "Tiada rekod Kecemasan yang sedia untuk keluar.",
      "Tiada rekod Kecemasan yang sedang keluar."
    ],
    late: [
      "Tiada rekod lewat yang sedia untuk keluar.",
      "Tiada pelajar lewat pulang ke asrama."
    ]
  };

  Object.entries(expected).forEach(([filter, messages]) => {
    context.applyQuickFilterV15([approved, out], filter, context.guardFilterEmptyMessageV15);
    assert.equal(approved.empty.textContent, messages[0]);
    assert.equal(out.empty.textContent, messages[1]);
  });
});
