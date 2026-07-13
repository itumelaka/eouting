const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");

function extractFunction(name, nextName) {
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

test("Public Monitoring keeps one status list without detailed or overnight duplicate sections", () => {
  const setupSource = extractFunction("setupMonitoringPanel", "setupStatisticsPanel");
  const renderSource = extractFunction("renderMonitoringPageV1612", "publicMonitorStudentLabel");
  const quickFilterSource = extractFunction("ensureQuickFiltersV15", "ensureQuickFilterGroupV15");
  const overnightSetupSource = extractFunction("ensureOvernightMonitoringSectionsV15", "ensureOvernightSectionV15");
  const overnightRenderSource = extractFunction("renderOvernightNotReturnedSectionsV15", "renderOvernightListV15");

  assert.match(setupSource, /Senarai Status Semasa/);
  assert.doesNotMatch(setupSource, /Rekod Hari Ini|monitorRecordsList/);
  assert.doesNotMatch(renderSource, /monitorRecordCardV1612|monitorRecordsList/);
  assert.doesNotMatch(quickFilterSource, /monitorRecordsList|"monitor"/);
  assert.doesNotMatch(overnightSetupSource, /monitorOvernightNotReturnedSection|monitorRecordsList/);
  assert.doesNotMatch(overnightRenderSource, /monitorOvernightNotReturnedSection/);
});

test("Warden and Guard filter and overnight render wiring remains present", () => {
  const quickFilterSource = extractFunction("ensureQuickFiltersV15", "ensureQuickFilterGroupV15");
  const overnightSetupSource = extractFunction("ensureOvernightMonitoringSectionsV15", "ensureOvernightSectionV15");
  const overnightRenderSource = extractFunction("renderOvernightNotReturnedSectionsV15", "renderOvernightListV15");

  assert.match(quickFilterSource, /ensureQuickFilterGroupV15\("warden", \[els\.wardenList, els\.wardenApprovedList\]/);
  assert.match(quickFilterSource, /ensureQuickFilterGroupV15\("guard", \[els\.guardApprovedList, els\.guardOutList\]/);
  assert.match(overnightSetupSource, /guardOvernightNotReturnedSection/);
  assert.match(overnightRenderSource, /#guardOvernightNotReturnedSection/);
});

test("current status list renders name, class, request type, contextual status and icon", () => {
  const output = { innerHTML: "" };
  const context = vm.createContext({
    els: { monitorNameList: output },
    emptyState: (message) => message,
    isMonitorNameListRecordV1613: () => true,
    getContextualStatusDisplay: () => ({ key: "out", icon: "🏖️", label: "Sedang Bercuti" }),
    getMonitorNameIconClassV1613: () => "status-icon-out",
    publicMonitorStudentLabel: (record) => record.nama,
    requestChecklistTypeLabel: () => "Cuti Semester",
    escapeHtml: (value) => String(value)
  });
  vm.runInContext(extractFunction("renderMonitorNameListV1613", "isMonitorNameListRecordV1613"), context);

  context.renderMonitorNameListV1613([{
    nama: "NAMA PELAJAR",
    kelas: "A2",
    jenis_permohonan: "CUTI_SEMESTER",
    status: "KELUAR"
  }]);

  assert.match(output.innerHTML, /NAMA PELAJAR/);
  assert.match(output.innerHTML, /A2/);
  assert.match(output.innerHTML, /Cuti Semester/);
  assert.match(output.innerHTML, /Sedang Bercuti/);
  assert.match(output.innerHTML, /🏖️/);
});

test("monitoring summary still counts all public status categories", () => {
  const context = vm.createContext({
    STATUS: {
      pending: "MENUNGGU_KELULUSAN",
      approved: "DILULUSKAN",
      out: "KELUAR",
      returned: "SUDAH_PULANG"
    },
    REQUEST_TYPE: { emergency: "KECEMASAN" },
    isMonitorLateRecordV1612: (record) => record.lewat === true
  });
  vm.runInContext(extractFunction("getMonitorCountsV1612", "monitorSummaryCardV1612"), context);

  const counts = context.getMonitorCountsV1612([
    { status: "MENUNGGU_KELULUSAN" },
    { status: "DILULUSKAN" },
    { status: "KELUAR", belum_masuk: true },
    { status: "KELUAR", lewat: true, jenis_permohonan: "KECEMASAN" },
    { status: "SUDAH_PULANG" }
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(counts)), {
    pending: 1,
    approved: 1,
    out: 2,
    returned: 1,
    late: 1,
    notReturned: 2,
    emergency: 1
  });
});
