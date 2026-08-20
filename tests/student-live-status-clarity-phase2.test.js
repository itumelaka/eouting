const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
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

function urgencyContext() {
  const context = vm.createContext({
    Date,
    Intl,
    Math,
    escapeHtml: String,
    formatDisplayDate: (value) => {
      const date = new Date(value);
      const parts = new Intl.DateTimeFormat("ms-MY", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Kuala_Lumpur"
      }).format(date);
      return parts;
    },
    parseFlexibleDate: (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    },
    getRecordId: (record) => record.request_id || ""
  });
  [
    "studentLifecycleStatus",
    "getStudentOperationalUrgency",
    "formatStudentOperationalDuration",
    "formatStudentMalaysiaTime",
    "isSameMalaysiaDate",
    "formatStudentExpectedReturn",
    "studentNextActionMessage",
    "studentUrgencyPresentation",
    "studentLifecycleGuidanceHtml",
    "studentOperationalGuidanceHtml"
  ].forEach((name) => vm.runInContext(extractFunction(name), context));
  return context;
}

function activeRecord(state, extra = {}) {
  return {
    request_id: `R-${state}`,
    rawStatus: "KELUAR",
    status: "KELUAR",
    masa_keluar: "2026-08-20T17:18:00+08:00",
    operational_urgency: {
      applicable: true,
      state,
      expected_return_at: "2026-08-20T22:00:00+08:00",
      evaluated_at: "2026-08-20T20:18:00+08:00",
      timing_valid: true,
      needs_review: false,
      next_action_code: "NONE",
      next_transition_at: "2026-08-20T21:30:00+08:00"
    },
    ...extra
  };
}

test("Student renders every authoritative urgency state with respectful BM guidance", () => {
  const context = urgencyContext();
  const now = new Date("2026-08-20T20:18:00+08:00");
  const cases = [
    ["NORMAL", "ANDA SEDANG BERADA DI LUAR", "Masih dalam tempoh dibenarkan"],
    ["DUE_SOON", "MASA PULANG HAMPIR TIBA", "Sila bersedia untuk kembali ke asrama"],
    ["LATE", "ANDA TELAH LEWAT", "Sila kembali ke asrama dan lapor kepada Guard"],
    ["CRITICAL", "LEWAT — PERLU TINDAKAN", "hubungi Warden jika terdapat masalah"],
    ["ACTION_REQUIRED", "TINDAKAN SEGERA DIPERLUKAN", "hubungi Warden/HEP"]
  ];
  const actionCodes = {
    NORMAL: "NONE",
    DUE_SOON: "PREPARE_RETURN",
    LATE: "RETURN_NOW",
    CRITICAL: "FOLLOW_UP",
    ACTION_REQUIRED: "ACTION_REQUIRED"
  };
  cases.forEach(([state, title, instruction]) => {
    const record = activeRecord(state);
    record.operational_urgency.next_action_code = actionCodes[state];
    const html = context.studentOperationalGuidanceHtml(record, now);
    assert.match(html, new RegExp(title));
    assert.match(html, new RegExp(instruction));
    assert.match(html, /data-student-urgency-countdown/);
    assert.doesNotMatch(html, new RegExp(`>${state}<`));
  });
});

test("invalid timing asks for review without fabricating countdown or lateness", () => {
  const context = urgencyContext();
  const record = activeRecord(null);
  record.operational_urgency = {
    applicable: true,
    state: null,
    timing_valid: false,
    needs_review: true,
    next_action_code: "REVIEW_TIMING"
  };
  const html = context.studentOperationalGuidanceHtml(record, new Date());
  assert.match(html, /MAKLUMAT WAKTU PULANG PERLU DISEMAK/);
  assert.match(html, /Sila rujuk Warden\/HEP/);
  assert.doesNotMatch(html, /data-student-urgency-countdown|ANDA TELAH LEWAT|Sepatutnya pulang/);
});

test("non-KELUAR lifecycle ignores urgency and keeps lifecycle guidance visible", () => {
  const context = urgencyContext();
  const pending = activeRecord("ACTION_REQUIRED", {
    rawStatus: "MENUNGGU_KELULUSAN",
    status: "MENUNGGU_KELULUSAN",
    masa_mohon: "2026-08-20T20:12:00+08:00"
  });
  const html = context.studentOperationalGuidanceHtml(pending, new Date());
  assert.match(html, /MENUNGGU KELULUSAN/);
  assert.match(html, /menunggu tindakan Warden/);
  assert.doesNotMatch(html, /TINDAKAN SEGERA DIPERLUKAN|data-student-urgency-countdown/);
});

test("same-day target shows time while overnight target includes the Malaysia date", () => {
  const context = urgencyContext();
  const now = new Date("2026-08-20T20:00:00+08:00");
  assert.equal(context.formatStudentExpectedReturn("2026-08-20T22:00:00+08:00", now), "10:00 Malam");
  assert.match(
    context.formatStudentExpectedReturn("2026-08-23T18:00:00+08:00", now),
    /23 Ogos 2026, 6:00 Petang/
  );
});

test("remaining and late durations use compact BM wording above and below one hour", () => {
  const context = urgencyContext();
  assert.equal(context.formatStudentOperationalDuration(24 * 60000, "remaining"), "24 minit");
  assert.equal(context.formatStudentOperationalDuration((102 * 60000), "remaining"), "1 jam 42 minit");
  assert.equal(context.formatStudentOperationalDuration(30 * 1000, "remaining"), "Kurang 1 minit");
  assert.equal(context.formatStudentOperationalDuration(18 * 60000, "late"), "18 minit");
  assert.equal(context.formatStudentOperationalDuration(72 * 60000, "late"), "1 jam 12 minit");
});

test("lifecycle badge stays separate and raw urgency machine codes are not Student copy", () => {
  const cardSource = extractFunction("studentStatusCard");
  assert.match(cardSource, /studentOperationalGuidanceHtml\(record/);
  assert.match(cardSource, /student-lifecycle-label/);
  assert.match(cardSource, /statusInfo\.badge/);
  const context = urgencyContext();
  const html = context.studentOperationalGuidanceHtml(activeRecord("ACTION_REQUIRED"), new Date("2026-08-20T23:12:00+08:00"));
  ["NORMAL", "DUE_SOON", "LATE", "CRITICAL", "ACTION_REQUIRED", "REVIEW_TIMING"].forEach((code) => {
    assert.doesNotMatch(html, new RegExp(`>${code}<`));
  });
});

test("existing cancellation and return-selfie actions remain in the current card", () => {
  const cardSource = extractFunction("studentStatusCard");
  assert.match(cardSource, /canStudentCancelRequest\(record\)/);
  assert.match(cardSource, /data-student-cancel/);
  assert.match(cardSource, /returnSelfieProofHtml\(record\)/);
  assert.match(cardSource, /\$\{selfieProof\}/);
});

test("completed return shows confirmation without active urgency countdown", () => {
  const context = urgencyContext();
  const completed = activeRecord("ACTION_REQUIRED", {
    rawStatus: "SELESAI",
    status: "SELESAI",
    masa_masuk: "2026-08-20T21:47:00+08:00",
    lewat: true
  });
  const html = context.studentOperationalGuidanceHtml(completed, new Date());
  assert.match(html, /KEPULANGAN DISAHKAN/);
  assert.match(html, /Masa masuk/);
  assert.doesNotMatch(html, /data-student-urgency-countdown|TINDAKAN SEGERA DIPERLUKAN/);
});

test("transition crossing refreshes authoritative records without local urgency mutation", () => {
  const updateSource = extractFunction("updateStudentUrgencyDisplay");
  const tickSource = extractFunction("handleStudentAutoRefreshTick");
  assert.match(updateSource, /nextTransitionAt/);
  assert.match(updateSource, /refreshStudentLiveRecords\(\)/);
  assert.doesNotMatch(updateSource, /operational_urgency\.state\s*=|dataset\.urgencyState\s*=|classList\.(add|replace)/);
  assert.match(tickSource, /updateStudentUrgencyDisplay/);
  assert.match(tickSource, /refreshStudentLiveRecords/);
  assert.match(extractFunction("startStudentAutoRefresh"), /handleStudentAutoRefreshTick/);
});

test("live mapping preserves authenticated urgency while public mapping stays unchanged", () => {
  const liveMap = extractFunction("mapLiveRecord");
  const publicMap = extractFunction("mapPublicMonitoringRecord");
  assert.match(liveMap, /operational_urgency/);
  assert.doesNotMatch(publicMap, /operational_urgency|expected_return_at|minutes_to_due|minutes_late|next_transition_at|next_action_code/);
});

test("semantic urgency treatments are mobile-safe and do not animate or rely on colour alone", () => {
  ["normal", "due-soon", "late", "critical", "action-required", "review"].forEach((state) => {
    assert.match(cssSource, new RegExp(`\\.student-status-${state}`));
  });
  assert.match(cssSource, /\.student-urgency-title/);
  assert.match(cssSource, /\.student-urgency-duration/);
  assert.doesNotMatch(cssSource, /student-status-[\s\S]{0,300}animation:\s*(?!none)/);
});
