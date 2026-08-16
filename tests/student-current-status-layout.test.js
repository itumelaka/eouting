const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(name) {
  const start = appSource.lastIndexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = appSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function statusContext() {
  const context = vm.createContext({
    currentSession: { role: "student" },
    RETURN_SELFIE_STATUS: {
      pending: "BELUM_HANTAR",
      submitted: "SUDAH_HANTAR",
      notRequired: "TIDAK_DIPERLUKAN"
    },
    reverseDisplayStatus: (status) => ({
      Pending: "MENUNGGU_KELULUSAN",
      Approved: "DILULUSKAN_WARDEN",
      Out: "KELUAR",
      Done: "SELESAI",
      Rejected: "DITOLAK_WARDEN",
      Cancelled: "DIBATALKAN_PELAJAR"
    }[status] || status || ""),
    isRecordForCurrentStudent: () => true,
    escapeHtml: String,
    formatDisplayDateTime: String,
    requestTypeLabel: (value) => value || "-",
    emergencyDetailHtml: () => "",
    approvalActorLabel: () => "Diluluskan Warden",
    getRecordId: (record) => record.request_id || "",
    studentStatusInfo: (record) => ({
      badge: record.rawStatus || record.status || "-",
      badgeClass: "badge-test",
      message: "Status ujian"
    })
  });
  [
    "isReturnSelfieSubmitted",
    "isReturnSelfieNotRequired",
    "isReturnSelfieEligible",
    "returnSelfieProofHtml",
    "canStudentCancelRequest",
    "studentStatusCard",
    "selectStudentCurrentRecord",
    "renderStudentCurrentStatus",
    "isStudentHistoryRecord",
    "renderStudentHistoryRecords"
  ].forEach((name) => vm.runInContext(extractFunction(name), context));
  context.studentHistoryCard = (record) => `<article data-history="${record.request_id}"></article>`;
  context.emptyState = (message) => `<p class="empty-state">${message}</p>`;
  return context;
}

function record(requestId, rawStatus, extra = {}) {
  return {
    request_id: requestId,
    rawStatus,
    status: rawStatus,
    jenis_permohonan: "OUTING_BIASA",
    ...extra
  };
}

test("Student hierarchy places identity and Status Semasa above the request form and history", () => {
  const identity = indexSource.indexOf('class="identity-panel"');
  const current = indexSource.indexOf('id="studentCurrentStatus"');
  const form = indexSource.indexOf('id="requestForm"');
  const historyHeading = indexSource.indexOf("Rekod Saya");
  const history = indexSource.indexOf('id="studentRecordsList"');
  assert.ok(identity >= 0 && identity < current);
  assert.ok(current < form);
  assert.ok(form < historyHeading && historyHeading < history);
  assert.match(indexSource, /id="studentCurrentStatusTitle">Status Semasa</);
});

test("current record selection follows KELUAR, approved, pending, then actionable selfie priority", () => {
  const context = statusContext();
  const pending = record("PENDING", "MENUNGGU_KELULUSAN");
  const approved = record("APPROVED", "DILULUSKAN_WARDEN");
  const outside = record("OUT", "KELUAR");
  const selfie = record("SELFIE", "SELESAI", {
    masa_masuk: "2026-08-16 22:00:00",
    selfie_status: "BELUM_HANTAR"
  });

  assert.equal(context.selectStudentCurrentRecord([pending]).request_id, "PENDING");
  assert.equal(context.selectStudentCurrentRecord([approved]).request_id, "APPROVED");
  assert.equal(context.selectStudentCurrentRecord([outside]).request_id, "OUT");
  assert.equal(context.selectStudentCurrentRecord([selfie]).request_id, "SELFIE");
  assert.equal(context.selectStudentCurrentRecord([selfie, pending, approved, outside]).request_id, "OUT");
});

test("top current card reuses cancellation and eligible return-selfie actions", () => {
  const context = statusContext();
  const pendingHtml = context.renderStudentCurrentStatus(record("PENDING", "MENUNGGU_KELULUSAN"));
  assert.match(pendingHtml, /data-student-current-record="PENDING"/);
  assert.match(pendingHtml, /data-student-cancel="PENDING"[^>]*>Batal Permohonan/);

  const selfieHtml = context.renderStudentCurrentStatus(record("SELFIE", "SELESAI", {
    masa_masuk: "2026-08-16 22:00:00",
    selfie_status: "BELUM_HANTAR"
  }));
  assert.match(selfieHtml, /data-student-current-record="SELFIE"/);
  assert.match(selfieHtml, /Ambil Selfie &amp; Lapor Pulang/);
  assert.match(selfieHtml, /data-selfie-submit="SELFIE"/);
  const bindingSource = [
    extractFunction("getStudentReturnSelfieRoots"),
    extractFunction("findStudentReturnSelfiePanel"),
    extractFunction("bindStudentReturnSelfieControls")
  ].join("\n");
  assert.match(bindingSource, /els\.studentCurrentStatus/);
  assert.match(bindingSource, /els\.studentRecordsList/);
  assert.match(bindingSource, /findStudentReturnSelfiePanel/);
});

test("Rekod Saya excludes the selected actionable record and retains historical outcomes", () => {
  const context = statusContext();
  const actionable = record("ACTIONABLE", "SELESAI", {
    masa_masuk: "2026-08-16 22:00:00",
    selfie_status: "BELUM_HANTAR"
  });
  const rejected = record("REJECTED", "DITOLAK_WARDEN");
  const completed = record("COMPLETED", "SELESAI", {
    masa_masuk: "2026-08-15 20:00:00",
    selfie_status: "SUDAH_HANTAR"
  });
  const cancelled = record("CANCELLED", "DIBATALKAN_PELAJAR");
  const html = context.renderStudentHistoryRecords(
    [actionable, rejected, completed, cancelled],
    actionable
  );

  assert.doesNotMatch(html, /ACTIONABLE/);
  assert.match(html, /REJECTED/);
  assert.match(html, /COMPLETED/);
  assert.match(html, /CANCELLED/);
});

test("no current record uses a compact top empty state", () => {
  const context = statusContext();
  const html = context.renderStudentCurrentStatus(null);
  assert.match(html, /class="student-current-empty"/);
  assert.match(html, /Tiada permohonan aktif\./);
  assert.doesNotMatch(html, /record-card|empty-state/);
});

test("mobile current status remains compact, single-column and touch friendly", () => {
  assert.match(cssSource, /\.student-current-status-section\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(cssSource, /@media \(max-width: 520px\)[\s\S]*?\.student-current-card \.record-actions,[\s\S]*?grid-template-columns:\s*1fr/);
  assert.match(cssSource, /\.student-current-card \.record-top\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.match(cssSource, /\.student-current-card \.badge\s*\{[\s\S]*?overflow-wrap:\s*anywhere[\s\S]*?white-space:\s*normal/);
  assert.match(cssSource, /\.student-current-card :where\(button, \.return-selfie-picker\)[\s\S]*?min-height:\s*48px[\s\S]*?width:\s*100%/);
  assert.doesNotMatch(cssSource, /\.student-current-status-section[\s\S]{0,300}position:\s*(fixed|sticky)/);
});
