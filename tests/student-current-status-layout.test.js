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
  const start = appSource.lastIndexOf(`function ${name}(`);
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
    formatDisplayDate: (value) => ({
      "2026-08-12": "12 Ogos 2026",
      "2026-08-10": "10 Ogos 2026",
      "2026-08-09": "9 Ogos 2026",
      "2026-08-08": "8 Ogos 2026",
      "2026-08-07": "7 Ogos 2026",
      "2026-08-06": "6 Ogos 2026"
    }[value] || "-"),
    parseFlexibleDate: (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00Z`) : null,
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
    "studentHistoryStatusLabel",
    "studentHistoryDateValue",
    "studentHistorySortTimestamp",
    "studentHistoryRow",
    "renderStudentHistoryRecords"
  ].forEach((name) => vm.runInContext(extractFunction(name), context));
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
  const historyHeading = indexSource.indexOf("Rekod Outing Saya");
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

test("Rekod Outing Saya includes all lifecycle summaries without duplicating detailed actions", () => {
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
  const html = context.renderStudentHistoryRecords([actionable, rejected, completed, cancelled]);

  assert.match(html, /Selesai/);
  assert.match(html, /Ditolak/);
  assert.match(html, /Dibatalkan/);
  assert.doesNotMatch(html, /data-student-cancel|data-selfie-submit|button|Lihat Butiran/);
});

test("compact history maps every lifecycle status to its concise Student label", () => {
  const context = statusContext();
  const expected = [
    ["MENUNGGU_KELULUSAN", "Menunggu kelulusan"],
    ["DILULUSKAN_WARDEN", "Diluluskan"],
    ["KELUAR", "Masih di luar"],
    ["SELESAI", "Selesai"],
    ["DITOLAK_WARDEN", "Ditolak"],
    ["DIBATALKAN_PELAJAR", "Dibatalkan"]
  ];
  expected.forEach(([status, label], index) => {
    const item = record(`R-${index}`, status, { tarikh: "2026-08-12" });
    assert.equal(context.studentHistoryStatusLabel(item), label);
    assert.match(context.renderStudentHistoryRecords([item]), new RegExp(label));
  });
});

test("each compact row contains only Malay date, outing type and concise status", () => {
  const context = statusContext();
  const html = context.studentHistoryRow(record("PRIVATE", "KELUAR", {
    tarikh: "2026-08-12",
    tujuan: "Butiran tujuan rahsia",
    lokasi: "Lokasi rahsia",
    jenis_kenderaan: "Kenderaan rahsia",
    catatan: "Catatan rahsia",
    warden_approve_by: "Nama Warden",
    guard_keluar_by: "Nama Guard",
    selfie_status: "BELUM_HANTAR"
  }));
  assert.match(html, /12 Ogos 2026/);
  assert.match(html, /OUTING_BIASA/);
  assert.match(html, /Masih di luar/);
  assert.doesNotMatch(html, /PRIVATE|rahsia|Warden|Guard|BELUM_HANTAR|button|record-actions|return-selfie/);
  assert.equal((html.match(/<span/g) || []).length, 3);
});

test("compact history sorts newest outing date first and keeps refresh plus annual count visible", () => {
  const context = statusContext();
  const html = context.renderStudentHistoryRecords([
    record("OLD", "SELESAI", { tarikh: "2026-08-08" }),
    record("NEW", "KELUAR", { tarikh: "2026-08-12" }),
    record("MIDDLE", "DILULUSKAN_WARDEN", { tarikh: "2026-08-10" })
  ]);
  assert.ok(html.indexOf("12 Ogos 2026") < html.indexOf("10 Ogos 2026"));
  assert.ok(html.indexOf("10 Ogos 2026") < html.indexOf("8 Ogos 2026"));

  const refresh = indexSource.indexOf('id="studentHistoryRefreshControls"');
  const annual = indexSource.indexOf('id="studentAnnualSummary"');
  const heading = indexSource.indexOf('id="studentOutingHistoryTitle">Rekod Outing Saya');
  assert.ok(refresh >= 0 && refresh < annual && annual < heading);
  assert.match(appSource, /textContent = "Refresh Status"/);
  assert.match(appSource, /Jumlah Outing \$\{Number\(studentAnnualSummary\.year\)\}/);
});

test("top Status Semasa keeps live records while lower history uses the authenticated annual response", () => {
  const renderSource = extractFunction("renderStudent");
  const annualLoaderSource = extractFunction("loadStudentAnnualSummary");
  const refreshSource = extractFunction("refreshStudentLiveRecords");
  const refreshControlsSource = extractFunction("ensureStudentRefreshControls");
  const startSessionSource = extractFunction("startSession");

  assert.match(renderSource, /const studentRecords = outingRecords\.filter\(isRecordForCurrentStudent\)/);
  assert.match(renderSource, /selectStudentCurrentRecord\(studentRecords\)/);
  assert.match(renderSource, /renderStudentCurrentStatus\(currentRecord\)/);
  assert.match(renderSource, /renderStudentAnnualHistory\(\)/);
  assert.doesNotMatch(renderSource, /renderStudentHistoryRecords\(studentRecords\)/);
  assert.match(annualLoaderSource, /normalizeStudentAnnualSummary\(response\)/);
  assert.match(annualLoaderSource, /renderStudentAnnualHistory\(\)/);
  assert.match(refreshSource, /requests = \[loadTodayRecords\(\)\]/);
  assert.match(refreshSource, /requests\.push\(loadStudentAnnualSummary\(\)\)/);
  assert.match(refreshControlsSource, /refreshStudentLiveRecords\(true\)/);
  assert.match(startSessionSource, /role === "student"[\s\S]*refreshStudentLiveRecords\(true\)/);
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
