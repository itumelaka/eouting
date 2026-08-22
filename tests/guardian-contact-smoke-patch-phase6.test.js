const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function functionSource(name, nextName) {
  const start = appSource.indexOf(`function ${name}`);
  const end = appSource.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return appSource.slice(start, end);
}

function mapRecord(record) {
  const context = vm.createContext({
    REQUEST_TYPE: { normal: "OUTING_BIASA" },
    mapLiveStatus: (status) => status,
    parseDateValue: (value) => value || null,
    normalizeWardenStaffRole: (role) => role || "WARDEN"
  });
  vm.runInContext(functionSource("mapLiveRecord", "mapPublicMonitoringRecord"), context);
  return JSON.parse(JSON.stringify(context.mapLiveRecord(record)));
}

function shortcut(record, mode) {
  const context = vm.createContext({
    escapeHtml: (value) => String(value == null ? "" : value),
    getRecordId: (row) => row.request_id || row.id || ""
  });
  vm.runInContext(functionSource("guardianContactShortcutHtml", "guardianContactPanelHtml"), context);
  return context.guardianContactShortcutHtml(record, mode);
}

test("pending emergency renders the shortcut after safe projection-flag normalization", () => {
  const mapped = mapRecord({
    request_id: "PENDING-E",
    status: "MENUNGGU_KELULUSAN",
    jenis_permohonan: "KECEMASAN",
    guardian_contact_available: "true"
  });
  assert.equal(mapped.guardian_contact_available, true);
  assert.match(shortcut(mapped, "warden"), /data-guardian-contact="PENDING-E"[\s\S]*Hubungi Penjaga/);
});

test("approved emergency with a literal backend boolean renders the shortcut", () => {
  const mapped = mapRecord({
    request_id: "APPROVED-E",
    status: "DILULUSKAN_WARDEN",
    jenis_permohonan: "KECEMASAN",
    guardian_contact_available: true
  });
  assert.equal(mapped.guardian_contact_available, true);
  assert.match(shortcut(mapped, "warden-readonly"), /Hubungi Penjaga/);
});

test("false, missing, and arbitrary projection values do not render a shortcut", () => {
  for (const value of [false, undefined, "false", "yes", 1]) {
    const mapped = mapRecord({ request_id: "NO", guardian_contact_available: value });
    assert.equal(mapped.guardian_contact_available, false);
    assert.equal(shortcut(mapped, "warden"), "");
  }
});

test("Student, Guard, Public, and generic card modes cannot render the Warden shortcut", () => {
  const eligible = { request_id: "PRIVATE", guardian_contact_available: true };
  for (const mode of ["student", "guard-out", "guard-in", "dashboard", "public"]) {
    assert.equal(shortcut(eligible, mode), "");
  }
  const recordCard = functionSource("recordCard", "guardOperationalCard");
  assert.match(recordCard, /guardianContactShortcutHtml\(record, mode\)/);
});

test("Warden operational sections keep pending, No-Guard, approved-risk, then checklist order", () => {
  const pendingHeading = indexSource.indexOf("Menunggu Kelulusan");
  const pendingList = indexSource.indexOf('id="wardenList"');
  const noGuardHeading = indexSource.indexOf("Menunggu Pengesahan Keluar", pendingList);
  const noGuardList = indexSource.indexOf('id="wardenDepartureConfirmationList"');
  const approvedHeading = indexSource.indexOf("Telah Diluluskan / Risiko Pulang");
  const approvedList = indexSource.indexOf('id="wardenApprovedList"');
  assert.ok(pendingHeading < pendingList);
  assert.ok(pendingList < noGuardHeading && noGuardHeading < noGuardList);
  assert.ok(noGuardList < approvedHeading && approvedHeading < approvedList);

  const effectiveChecklistStart = appSource.lastIndexOf("function ensureWardenSemesterChecklist");
  const effectiveChecklistEnd = appSource.indexOf("\nfunction renderWardenSemesterChecklist", effectiveChecklistStart);
  const effectiveChecklist = appSource.slice(effectiveChecklistStart, effectiveChecklistEnd);
  assert.match(effectiveChecklist, /sectionAnchor = els\.wardenApprovedList \|\| els\.wardenList/);
  assert.match(effectiveChecklist, /insertBefore\(panel, sectionAnchor\.nextSibling\)/);
});

test("Phase 3 pending sort remains the renderWarden authority and is not reimplemented", () => {
  const renderWarden = functionSource("renderWarden", "guardianContactShortcutHtml");
  assert.match(renderWarden, /sortWardenPendingRequests\([\s\S]*status === STATUS\.pending/);
  assert.doesNotMatch(renderWarden, /\.sort\s*\(|operational_urgency[^\n]*pendingRecords/);
});
