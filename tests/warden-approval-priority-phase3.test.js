const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = appSource.indexOf(startMarker);
  const end = appSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  assert.notEqual(end, -1, `${endMarker} must follow ${startMarker}`);
  return appSource.slice(start, end);
}

function gasSourceBetween(startMarker, endMarker) {
  const start = gasSource.indexOf(startMarker);
  const end = gasSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `${startMarker} must exist in GAS`);
  assert.notEqual(end, -1, `${endMarker} must follow ${startMarker} in GAS`);
  return gasSource.slice(start, end);
}

function parseMalaysiaDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00+08:00`
    : text.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(:\d{2})?)$/, "$1T$2+08:00");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function createPriorityContext() {
  const context = vm.createContext({
    REQUEST_TYPE: { emergency: "KECEMASAN" },
    parseFlexibleDate: parseMalaysiaDate,
    getKualaLumpurParts(date) {
      return new Intl.DateTimeFormat("en-CA", {
        day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kuala_Lumpur"
      }).formatToParts(date).reduce((result, part) => {
        if (part.type !== "literal") result[part.type] = part.value;
        return result;
      }, {});
    },
    formatDisplayTime(date) {
      return date.toLocaleTimeString("ms-MY", {
        hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kuala_Lumpur"
      }).replace("AM", "PG").replace("PM", "PTG");
    },
    escapeHtml(value) {
      return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }
  });
  vm.runInContext(sourceBetween("function isWardenEmergencyRequest", "function renderWarden"), context);
  return context;
}

function pending(id, overrides = {}) {
  return {
    id,
    request_id: id,
    status: "Menunggu Kelulusan",
    jenis_permohonan: "OUTING_BIASA",
    masa_mohon: "2026-08-20 10:00:00",
    tarikh: "2026-08-20",
    ...overrides
  };
}

test("emergency pending requests sort first and remain oldest-waiting-first", () => {
  const context = createPriorityContext();
  const records = [
    pending("NORMAL", { masa_mohon: "2026-08-20 08:00:00" }),
    pending("E-LATE", { jenis_permohonan: "KECEMASAN", masa_mohon: "2026-08-20 09:00:00" }),
    pending("E-OLD", { jenis_permohonan: "KECEMASAN", masa_mohon: "2026-08-20 07:00:00" })
  ];
  assert.deepEqual(Array.from(context.sortWardenPendingRequests(records, new Date("2026-08-20T08:00:00Z")), (row) => row.id), [
    "E-OLD", "E-LATE", "NORMAL"
  ]);
});

test("departure within 30 minutes or already reached sorts before ordinary pending", () => {
  const context = createPriorityContext();
  const now = new Date("2026-08-20T08:45:00Z"); // 16:45 Asia/Kuala_Lumpur
  const records = [
    pending("ORDINARY", { masa_mohon: "2026-08-20 07:00:00", earliest_departure_time: "18:00" }),
    pending("SOON", { masa_mohon: "2026-08-20 09:00:00", earliest_departure_time: "17:00" }),
    pending("REACHED", { masa_mohon: "2026-08-20 08:00:00", earliest_departure_time: "16:30" })
  ];
  assert.deepEqual(Array.from(context.sortWardenPendingRequests(records, now), (row) => row.id), [
    "REACHED", "SOON", "ORDINARY"
  ]);
  assert.equal(context.getWardenDeparturePriority(records[1], now).minutes_remaining, 15);
  assert.equal(context.getWardenDeparturePriority(records[2], now).state, "reached");
});

test("ordinary pending requests use oldest known submission then deterministic fallback", () => {
  const context = createPriorityContext();
  const records = [
    pending("MISSING-A", { masa_mohon: "", requestedAt: null }),
    pending("NEW", { masa_mohon: "2026-08-20 11:00:00" }),
    pending("OLD", { masa_mohon: "2026-08-20 08:00:00" }),
    pending("MISSING-B", { masa_mohon: "", requestedAt: null })
  ];
  assert.deepEqual(Array.from(context.sortWardenPendingRequests(records, new Date("2026-08-20T04:00:00Z")), (row) => row.id), [
    "OLD", "NEW", "MISSING-A", "MISSING-B"
  ]);
  assert.deepEqual(Array.from(records, (row) => row.id), ["MISSING-A", "NEW", "OLD", "MISSING-B"], "input must not mutate");
});

test("missing or malformed departure timing never fabricates priority", () => {
  const context = createPriorityContext();
  const now = new Date("2026-08-20T08:45:00Z");
  for (const record of [
    pending("NO-TIME", { earliest_departure_time: "" }),
    pending("BAD-TIME", { earliest_departure_time: "25:70" }),
    pending("NO-DATE", { tarikh: "", earliest_departure_time: "17:00" }),
    pending("BAD-DATE", { tarikh: "not-a-date", earliest_departure_time: "17:00" })
  ]) {
    assert.equal(context.getWardenDeparturePriority(record, now), null, record.id);
    assert.equal(context.getWardenPendingPriority(record, now).rank, 2, record.id);
  }
});

test("Malaysia timezone is authoritative and return urgency cannot influence approval rank", () => {
  const context = createPriorityContext();
  const now = new Date("2026-08-20T08:45:00Z");
  const approaching = pending("KL", { earliest_departure_time: "17:00" });
  const returnCritical = pending("RETURN", {
    operational_urgency: { state: "ACTION_REQUIRED", minutes_late: 90 }
  });
  assert.equal(context.getWardenDeparturePriority(approaching, now).minutes_remaining, 15);
  assert.equal(context.getWardenPendingPriority(approaching, now).rank, 1);
  assert.equal(context.getWardenPendingPriority(returnCritical, now).rank, 2);
});

test("priority presentation is compact, factual and never implies automatic approval", () => {
  const context = createPriorityContext();
  const now = new Date("2026-08-20T08:45:00Z");
  const emergency = context.wardenPriorityPresentation(pending("E", {
    jenis_permohonan: "KECEMASAN",
    sebab_kecemasan: "Pelajar sakit"
  }), now);
  assert.match(emergency, /Kecemasan/);
  assert.match(emergency, /Perlu perhatian segera/);
  assert.match(emergency, /Sila semak maklumat dan ambil tindakan mengikut prosedur/);
  assert.doesNotMatch(emergency, /auto.?approve|lulus segera|terus dibenarkan keluar/i);

  const approaching = context.wardenPriorityPresentation(pending("D", {
    earliest_departure_time: "17:00"
  }), now);
  assert.match(approaching, /Masa keluar hampir tiba/);
  assert.match(approaching, /Dibenarkan keluar/);
  assert.match(approaching, /Baki[^<]*15 minit/);
  assert.equal(context.wardenPriorityPresentation(pending("N"), now), "");
});

test("Warden card retains emergency reason, approve/reject actions and rejection behavior", () => {
  const recordCard = sourceBetween("function recordCard", "function guardOperationalCard");
  const actionButtons = sourceBetween("function actionButtons", "function badgeClass");
  const updateStatus = sourceBetween("async function updateStatus", "async function confirmOut");
  assert.match(recordCard, /wardenPriorityPresentation\(record/);
  assert.match(recordCard, /emergencyDetailHtml\(record\)/);
  assert.match(actionButtons, /data-approve=/);
  assert.match(actionButtons, /data-reject=/);
  assert.match(updateStatus, /rejectRequest/);
  assert.match(updateStatus, /catatan: status === STATUS\.rejected/);
});

test("existing Warden checklist and non-Warden rendering boundaries remain intact", () => {
  const renderWarden = sourceBetween("function renderWarden", "function isReturnSelfieSubmitted");
  const recordCard = sourceBetween("function recordCard", "function guardOperationalCard");
  const publicMapper = sourceBetween("function mapPublicMonitoringRecord", "function mapLiveStatus");
  const studentEnd = appSource.indexOf("function selectStudentCurrentRecord");
  const studentStart = appSource.lastIndexOf("function renderStudent() {", studentEnd);
  const currentStudentRenderer = appSource.slice(studentStart, studentEnd);
  assert.match(renderWarden, /renderWardenSemesterChecklist\(outingRecords\)/);
  assert.match(recordCard, /mode === "guard-out" \|\| mode === "guard-in"/);
  assert.match(recordCard, /mode === "warden"/);
  assert.doesNotMatch(publicMapper, /wardenPriority|sebab_kecemasan|catatan_kecemasan|earliest_departure_time/);
  assert.doesNotMatch(currentStudentRenderer, /sortWardenPendingRequests|wardenPriorityPresentation/);
  assert.doesNotMatch(sourceBetween("function renderGuard", "function renderDashboard"), /sortWardenPendingRequests|wardenPriorityPresentation/);
});

test("Phase 3 styles preserve compact mobile cards without horizontal overflow", () => {
  assert.match(styleSource, /\.warden-priority-cue\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styleSource, /\.warden-priority-card[\s\S]*border-top-color/);
  assert.match(styleSource, /@media \(max-width: 719px\)[\s\S]*\.warden-priority-facts/);
});

test("Warden-only projection prefers a request snapshot then safely falls back to current config", () => {
  const context = vm.createContext({
    getOutingTypes: () => [
      { type_code: "PULANG_BERMALAM", earliest_departure_time: "17:00" },
      { type_code: "OUTING_BIASA", earliest_departure_time: "" }
    ],
    normalizeSheetTimeValue_: (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : ""
  });
  vm.runInContext(gasSourceBetween("function addWardenDeparturePriorityProjection_", "function addProfilePhotoIndicators_"), context);
  const rows = context.addWardenDeparturePriorityProjection_([
    { request_id: "SNAPSHOT", jenis_permohonan: "PULANG_BERMALAM", earliest_departure_time: "16:30" },
    { request_id: "CONFIG", jenis_permohonan: "PULANG_BERMALAM" },
    { request_id: "NONE", jenis_permohonan: "OUTING_BIASA" }
  ]);
  assert.equal(rows[0].earliest_departure_time, "16:30");
  assert.equal(rows[1].earliest_departure_time, "17:00");
  assert.equal(rows[2].earliest_departure_time, "");

  const operational = gasSourceBetween("function getOperationalTodayRecords", "function addOperationalUrgency_");
  assert.match(operational, /role === "warden"[\s\S]*addWardenDeparturePriorityProjection_/);
  assert.doesNotMatch(operational, /role === "student"[^}]*addWardenDeparturePriorityProjection_/);
  assert.doesNotMatch(operational, /role === "guard"[^}]*addWardenDeparturePriorityProjection_/);
});
