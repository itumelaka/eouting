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

function renderWardenFixture(records) {
  const makeList = () => ({
    innerHTML: "",
    querySelectorAll: () => []
  });
  const elements = {
    wardenList: makeList(),
    wardenApprovedList: makeList(),
    wardenDepartureConfirmationList: makeList()
  };
  const context = vm.createContext({
    STATUS: {
      pending: "Menunggu Kelulusan",
      approved: "Diluluskan Warden",
      out: "Sedang Keluar"
    },
    outingRecords: records,
    els: elements,
    sortWardenPendingRequests: (rows) => rows,
    isNoGuardDepartureEnabledForRecord: () => false,
    renderWardenSemesterChecklist() {},
    emptyState: (message) => `EMPTY:${message}`,
    recordCard: (record, mode) => `${mode}:${record.request_id}`,
    wardenDepartureConfirmationCard: (record) => `departure:${record.request_id}`,
    updateStatus() {},
    confirmWardenRemoteCheckout() {},
    fetchGuardianContact() {}
  });
  vm.runInContext(
    functionSource("isWardenApprovedOperationalRecord", "renderWarden") +
      functionSource("renderWarden", "guardianContactShortcutHtml"),
    context
  );
  context.renderWarden();
  return { context, elements };
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

test("auto-approved and human-approved emergencies share the approved-risk section without entering pending", () => {
  const records = [
    {
      request_id: "AUTO-E",
      rawStatus: "DILULUSKAN_WARDEN",
      status: "Diluluskan Warden",
      jenis_permohonan: "KECEMASAN",
      warden_approve_by: "AUTO_CONFIG_V2",
      guardian_contact_available: true
    },
    {
      request_id: "HUMAN-E",
      rawStatus: "DILULUSKAN_WARDEN",
      status: "Diluluskan Warden",
      jenis_permohonan: "KECEMASAN",
      warden_approve_by: "Warden A",
      guardian_contact_available: true
    },
    {
      request_id: "NORMAL-A",
      rawStatus: "DILULUSKAN_WARDEN",
      status: "Diluluskan Warden",
      jenis_permohonan: "OUTING_BIASA",
      warden_approve_by: "Warden A",
      guardian_contact_available: false
    },
    {
      request_id: "PENDING-E",
      rawStatus: "MENUNGGU_KELULUSAN",
      status: "Menunggu Kelulusan",
      jenis_permohonan: "KECEMASAN",
      warden_approve_by: ""
    }
  ];
  const before = JSON.stringify(records);
  const { elements } = renderWardenFixture(records);

  assert.match(elements.wardenApprovedList.innerHTML, /warden-readonly:AUTO-E/);
  assert.match(elements.wardenApprovedList.innerHTML, /warden-readonly:HUMAN-E/);
  assert.match(elements.wardenApprovedList.innerHTML, /warden-readonly:NORMAL-A/);
  assert.doesNotMatch(elements.wardenApprovedList.innerHTML, /PENDING-E/);
  assert.match(elements.wardenList.innerHTML, /warden:PENDING-E/);
  assert.doesNotMatch(elements.wardenList.innerHTML, /AUTO-E|HUMAN-E|NORMAL-A/);
  assert.equal(JSON.stringify(records), before);
});

test("approved-risk membership uses lifecycle and never approval actor identity", () => {
  const helper = functionSource("isWardenApprovedOperationalRecord", "renderWarden");
  assert.match(helper, /DILULUSKAN_WARDEN/);
  assert.doesNotMatch(helper, /warden_approve_by|AUTO_CONFIG_V2|jenis_permohonan/);

  const rawLifecycleRecord = {
    request_id: "RAW-E",
    rawStatus: "DILULUSKAN_WARDEN",
    status: "unmapped-display-value",
    jenis_permohonan: "KECEMASAN",
    warden_approve_by: "AUTO_CONFIG_V2"
  };
  const { elements } = renderWardenFixture([rawLifecycleRecord]);
  assert.match(elements.wardenApprovedList.innerHTML, /warden-readonly:RAW-E/);
  assert.doesNotMatch(elements.wardenList.innerHTML, /warden:/);
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
