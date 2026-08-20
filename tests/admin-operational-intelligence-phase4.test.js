const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must follow ${startMarker}`);
  return appSource.slice(start, end);
}

function createContext() {
  const context = vm.createContext({
    Date,
    Intl,
    Number,
    escapeHtml: (value) => String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;"),
    formatDisplayDateTime: (value) => value ? `DT:${value}` : "-",
    formatAdminExpectedReturnV210: (record) => record.expected_return_at ? `DT:${record.expected_return_at}` : "-",
    formatAdminMonitoringRequestV210: (record) => record.masa_mohon ? `DT:${record.masa_mohon}` : "-",
    adminMonitoringStatusLabelV210: (status) => ({
      MENUNGGU_KELULUSAN: "Menunggu Kelulusan",
      KELUAR: "Sedang Keluar"
    }[status] || status || "-"),
    requestTypeLabel: (value) => ({ KECEMASAN: "Kecemasan", OUTING_BIASA: "Outing Biasa" }[value] || value),
    parseFlexibleDate(value) {
      if (!value) return null;
      const parsed = new Date(String(value).replace(" ", "T") + (/Z|[+-]\d\d:\d\d$/.test(String(value)) ? "" : "+08:00"));
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
  });
  vm.runInContext(
    sourceBetween("function getAdminOperationalUrgencyV240", "function renderAdminMonitoringV210"),
    context
  );
  return context;
}

function row(id, overrides = {}) {
  return {
    request_id: id,
    student_id: `S-${id}`,
    no_matrik: `M-${id}`,
    nama: `Pelajar ${id}`,
    kelas: "A2",
    jenis_permohonan: "OUTING_BIASA",
    status: "KELUAR",
    masa_mohon: "2026-08-20 10:00:00",
    expected_return_at: "2026-08-20 22:00:00",
    operational_urgency: {
      applicable: true,
      state: "NORMAL",
      severity_rank: 0,
      expected_return_at: "2026-08-20T22:00:00+08:00",
      minutes_to_due: 90,
      minutes_late: 0,
      needs_review: false,
      next_action_code: "NONE"
    },
    ...overrides
  };
}

test("Phase 4 KPIs use one dataset and mutually exclusive backend urgency states", () => {
  const context = createContext();
  const records = [
    row("NORMAL"),
    row("DUE", { operational_urgency: { state: "DUE_SOON", minutes_to_due: 12, needs_review: false } }),
    row("LATE", { operational_urgency: { state: "LATE", minutes_late: 14, needs_review: false } }),
    row("CRITICAL", { operational_urgency: { state: "CRITICAL", minutes_late: 42, needs_review: false } }),
    row("ACTION", { operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 78, needs_review: false } }),
    row("REVIEW", { operational_urgency: { state: null, needs_review: true, next_action_code: "REVIEW_TIMING" } }),
    row("EMERGENCY", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", operational_urgency: null }),
    row("PENDING", { status: "MENUNGGU_KELULUSAN", operational_urgency: null }),
    row("DONE", { status: "SELESAI", operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 99, needs_review: true } })
  ];
  const result = context.getAdminOperationalIntelligenceV240(records);
  assert.deepEqual(JSON.parse(JSON.stringify(result.kpis)), {
    pending: 2,
    approved: 0,
    out: 6,
    due_soon: 1,
    late: 1,
    critical: 1,
    action_required: 1,
    needs_review: 1,
    pending_emergency: 1
  });
  assert.equal(result.kpis.due_soon + result.kpis.late + result.kpis.critical + result.kpis.action_required, 4);
});

test("Perlu Tindakan excludes normal, due-soon, non-emergency pending and terminal records", () => {
  const context = createContext();
  const result = context.getAdminOperationalIntelligenceV240([
    row("NORMAL"),
    row("DUE", { operational_urgency: { state: "DUE_SOON", minutes_to_due: 8, needs_review: false } }),
    row("ACTION", { operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 75, needs_review: false } }),
    row("CRITICAL", { operational_urgency: { state: "CRITICAL", minutes_late: 40, needs_review: false } }),
    row("REVIEW", { operational_urgency: { state: null, needs_review: true } }),
    row("EMERGENCY", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", operational_urgency: null }),
    row("PENDING", { status: "MENUNGGU_KELULUSAN", operational_urgency: null }),
    row("DONE", { status: "SELESAI", operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 200 } })
  ]);
  assert.deepEqual(Array.from(result.queue, (item) => item.record.request_id), ["ACTION", "CRITICAL", "REVIEW", "EMERGENCY"]);
  assert.deepEqual(Array.from(result.queue, (item) => item.kind), ["action_required", "critical", "needs_review", "pending_emergency"]);
});

test("late severity buckets sort larger minutes_late first", () => {
  const context = createContext();
  const result = context.getAdminOperationalIntelligenceV240([
    row("A45", { operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 75, needs_review: false } }),
    row("A90", { operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 90, needs_review: false } }),
    row("C31", { operational_urgency: { state: "CRITICAL", minutes_late: 31, needs_review: false } }),
    row("C55", { operational_urgency: { state: "CRITICAL", minutes_late: 55, needs_review: false } })
  ]);
  assert.deepEqual(Array.from(result.queue, (item) => item.record.request_id), ["A90", "A45", "C55", "C31"]);
});

test("same-bucket timestamp and missing-timestamp fallback ordering is deterministic", () => {
  const context = createContext();
  const emergencies = [
    row("MISSING-B", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", masa_mohon: "", operational_urgency: null }),
    row("NEW", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", masa_mohon: "2026-08-20 11:00:00", operational_urgency: null }),
    row("OLD", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", masa_mohon: "2026-08-20 08:00:00", operational_urgency: null }),
    row("MISSING-A", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", masa_mohon: "", operational_urgency: null })
  ];
  const first = context.getAdminOperationalIntelligenceV240(emergencies);
  const second = context.getAdminOperationalIntelligenceV240(emergencies.slice().reverse());
  const expected = ["OLD", "NEW", "MISSING-A", "MISSING-B"];
  assert.deepEqual(Array.from(first.queue, (item) => item.record.request_id), expected);
  assert.deepEqual(Array.from(second.queue, (item) => item.record.request_id), expected);
});

test("invalid urgency metadata fails safely without fabricated state or action", () => {
  const context = createContext();
  const result = context.getAdminOperationalIntelligenceV240([
    row("STRING", { operational_urgency: "ACTION_REQUIRED" }),
    row("UNKNOWN", { operational_urgency: { state: "PANIC", severity_rank: 99, needs_review: false } }),
    row("CONTRADICTORY", { operational_urgency: { applicable: true, timing_valid: false, state: "CRITICAL", minutes_late: 44, needs_review: false } }),
    row("MISSING", { operational_urgency: null })
  ]);
  assert.equal(result.kpis.out, 4);
  assert.equal(result.kpis.due_soon, 0);
  assert.equal(result.kpis.late, 0);
  assert.equal(result.kpis.critical, 0);
  assert.equal(result.kpis.action_required, 0);
  assert.equal(result.queue.length, 0);
});

test("Admin action presentation uses BM labels and never exposes raw codes or guardian data", () => {
  const context = createContext();
  const intelligence = context.getAdminOperationalIntelligenceV240([
    row("ACTION", {
      telefon_waris: "0123456789",
      hubungan_waris: "Ibu",
      operational_urgency: {
        state: "ACTION_REQUIRED", minutes_late: 78, needs_review: false,
        next_action_code: "ACTION_REQUIRED", expected_return_at: "2026-08-20T22:00:00+08:00"
      }
    }),
    row("REVIEW", { operational_urgency: { state: null, needs_review: true, next_action_code: "REVIEW_TIMING" } }),
    row("EMERGENCY", { status: "MENUNGGU_KELULUSAN", jenis_permohonan: "KECEMASAN", operational_urgency: null })
  ]);
  const html = intelligence.queue.map((item) => context.renderAdminActionCardV240(item)).join("");
  assert.match(html, /Tindakan Segera/);
  assert.match(html, /1 jam 18 minit/);
  assert.match(html, /Semak Data Masa/);
  assert.match(html, /Kecemasan Menunggu/);
  assert.doesNotMatch(html, /ACTION_REQUIRED|REVIEW_TIMING|KECEMASAN_MENUNGGU/);
  assert.doesNotMatch(html, /0123456789|Ibu|telefon_waris|hubungan_waris|Hubungi Waris/);
});

test("Admin markup and styles provide a compact responsive action queue", () => {
  const phase4Styles = styleSource.slice(
    styleSource.indexOf(".admin-action-queue"),
    styleSource.indexOf(".admin-ops-list,.admin-staff-list")
  );
  assert.match(indexSource, /id="adminActionQueue"[^>]*aria-live="polite"/);
  assert.match(styleSource, /\.admin-action-queue\s*\{/);
  assert.match(styleSource, /\.admin-action-card\s*\{[^}]*overflow-wrap:anywhere/s);
  assert.match(styleSource, /@media \(max-width:760px\)[\s\S]*\.admin-action-grid[^}]*grid-template-columns:1fr/);
  assert.doesNotMatch(phase4Styles, /animation|pulse|flash/i);
});

test("Phase 4 remains Admin-only and does not alter approval authority or add local urgency thresholds", () => {
  const phase4 = sourceBetween("function getAdminOperationalUrgencyV240", "async function loadAdminMasterV210");
  const student = sourceBetween("function renderStudent()", "function isReturnSelfieSubmitted");
  const warden = sourceBetween("function renderWarden", "function isReturnSelfieSubmitted");
  const guard = sourceBetween("function renderGuard", "function renderDashboard");
  const publicMonitoring = sourceBetween("function mapPublicMonitoringRecord", "function mapLiveStatus");
  assert.doesNotMatch(phase4, /30\s*\*\s*60|60\s*\*\s*60|severity_rank\s*[><=]/);
  assert.doesNotMatch(phase4, /approveRequest|updateStatus|confirmOut|confirmIn|telefon_waris|hubungan_waris/);
  for (const source of [student, warden, guard, publicMonitoring]) {
    assert.doesNotMatch(source, /getAdminOperationalIntelligenceV240|renderAdminActionCardV240|adminActionQueue/);
  }
});

test("Admin refresh reuses the existing authoritative response path without a new timer", () => {
  const load = sourceBetween("async function loadAdminMonitoringV210", "function adminMonitoringStatusLabelV210");
  const render = sourceBetween("function renderAdminMonitoringV210", "async function loadAdminMasterV210");
  assert.match(load, /apiPost\("getAdminMonitoring"/);
  assert.match(load, /renderAdminMonitoringV210\(\)/);
  assert.match(render, /getAdminOperationalIntelligenceV240/);
  assert.match(render, /renderAdminActionQueueV240/);
  assert.doesNotMatch(`${load}\n${render}`, /setInterval|setTimeout/);
});
