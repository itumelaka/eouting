const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

const outingHeaders = [
  "type_code", "display_name", "description", "active", "sort_order", "allowed_days",
  "application_open_time", "application_close_time", "fixed_return_time", "same_day_only",
  "require_leave_date", "require_return_date", "require_return_time", "require_guardian_phone",
  "require_guardian_relation", "require_emergency_reason", "require_purpose", "require_location",
  "require_vehicle", "require_warden_approval", "require_selfie", "config_version", "created_at",
  "created_by", "updated_at", "updated_by", "departure_allowed_days", "earliest_departure_time",
  "application_open_date", "application_close_date"
];

function completeConfig(overrides = {}) {
  return {
    type_code: "OUTING_CUSTOM",
    display_name: "Outing Custom",
    description: "Jenis ujian",
    active: true,
    sort_order: 10,
    allowed_days: "AHAD,ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU",
    application_open_time: "",
    application_close_time: "",
    fixed_return_time: "",
    same_day_only: false,
    require_leave_date: true,
    require_return_date: false,
    require_return_time: false,
    require_guardian_phone: false,
    require_guardian_relation: false,
    require_emergency_reason: false,
    require_purpose: true,
    require_location: true,
    require_vehicle: false,
    require_warden_approval: true,
    require_selfie: true,
    config_version: 1,
    created_at: "",
    created_by: "",
    updated_at: "",
    updated_by: "",
    departure_allowed_days: "",
    earliest_departure_time: "",
    ...overrides
  };
}

function sheetFromRows(headers, rows) {
  const values = [headers, ...rows.map((row) => headers.map((header) => row[header] === undefined ? "" : row[header]))];
  return {
    getDataRange() {
      return { getValues: () => values.map((row) => row.slice()) };
    }
  };
}

function formatDate(date, timeZone, pattern) {
  const value = date instanceof Date ? date : new Date(date);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  if (pattern === "yyyy-MM-dd") return `${parts.year}-${parts.month}-${parts.day}`;
  if (pattern === "yyyy") return parts.year;
  if (pattern === "M") return String(Number(parts.month));
  if (pattern === "HH:mm") return `${parts.hour}:${parts.minute}`;
  if (pattern === "H") return String(Number(parts.hour));
  if (pattern === "m") return String(Number(parts.minute));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

function createGasContext({ flag = false, configs = [completeConfig()], requests = [] } = {}) {
  const sheets = {
    OUTING_TYPES: sheetFromRows(outingHeaders, configs),
    OUTING_REQUESTS: sheetFromRows([
      "request_id", "tarikh", "jenis_permohonan", "student_id", "no_matrik", "nama", "kelas",
      "status", "masa_mohon", "masa_keluar", "masa_masuk", "lewat"
    ], requests)
  };
  const context = vm.createContext({
    console,
    Intl,
    Date,
    Set,
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: (key) => key === "OUTING_CONFIG_V2_ENABLED" ? String(flag) : "" })
    },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: (name) => sheets[name] || null }),
      flush() {}
    },
    Utilities: {
      formatDate,
      base64Decode: (value) => Buffer.from(value, "base64")
    },
    Session: { getScriptTimeZone: () => "Asia/Kuala_Lumpur" },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) }
  });
  vm.runInContext(gasSource, context);
  context.validateAdminCredentials_ = (payload) => {
    if (!payload || payload.pin !== "2468") throw new Error("Admin dan PIN diperlukan.");
    return { admin_id: "ADMIN-1" };
  };
  context.now_ = () => "2026-08-10 12:00:00";
  context.getSheet_ = (name) => sheets[name];
  return { context, sheets };
}

test("Admin-only readiness reports legacy mode separately from config readiness", () => {
  const { context } = createGasContext({ flag: false });
  assert.throws(() => context.getOutingConfigReadiness({}), /Admin|PIN/i);
  const result = context.getOutingConfigReadiness({ pin: "2468" });
  assert.equal(result.config_mode, "LEGACY");
  assert.equal(result.config_mode_label, "Legacy (Production)");
  assert.equal(result.ready, true);
  assert.deepEqual(Array.from(result.reasons), []);
});

test("readiness rejects duplicates, malformed version/time/day and inconsistent departure rules", () => {
  const configs = [
    completeConfig({ type_code: "DUPLICATE", display_name: "Pertama" }),
    completeConfig({ type_code: "duplicate", display_name: "Kedua" }),
    completeConfig({ type_code: "BAD_VERSION", config_version: 0 }),
    completeConfig({ type_code: "BAD_TIME", application_open_time: "25:99" }),
    completeConfig({ type_code: "BAD_DAY", allowed_days: "BULAN" }),
    completeConfig({ type_code: "BAD_DEPARTURE", departure_allowed_days: "JUMAAT", require_leave_date: false })
  ];
  const { context } = createGasContext({ flag: false, configs });
  const result = context.getOutingConfigReadiness({ pin: "2468" });
  assert.equal(result.ready, false);
  const reasons = result.reasons.join("\n");
  assert.match(reasons, /pendua.*DUPLICATE/i);
  assert.match(reasons, /BAD_VERSION.*config_version/i);
  assert.match(reasons, /BAD_TIME.*HH:mm/i);
  assert.match(reasons, /BAD_DAY.*hari yang tidak sah/i);
  assert.match(reasons, /BAD_DEPARTURE.*require_leave_date=true/i);
});

test("require_selfie controls confirmIn state and custom-type frontend eligibility", () => {
  const { context } = createGasContext({ flag: true });
  const updates = [];
  let record = { request_id: "REQ-1", jenis_permohonan: "OUTING_CUSTOM", status: "KELUAR", masa_masuk: "", selfie_status: "TIDAK_DIPERLUKAN" };
  context.findActiveGuard_ = () => ({ nama_guard: "Guard A" });
  context.findRowByRequestId_ = () => ({ sheet: {}, rowNumber: 2, record });
  context.isHostelReturnRequest_ = () => false;
  context.isLate_ = () => false;
  context.updateRowByHeaders_ = (sheet, rowNumber, update) => { updates.push(update); record = { ...record, ...update }; };
  context.appendAuditLog = () => true;
  context.sendTelegramMessage_ = () => true;
  context.buildTelegramStatusMessage_ = () => "";
  context.telegramTitle_ = () => "";
  context.confirmIn({ request_id: "REQ-1", guard_name: "Guard A", pin: "1234" });
  assert.equal(updates[0].selfie_status, "TIDAK_DIPERLUKAN");

  record = { request_id: "REQ-2", jenis_permohonan: "OUTING_CUSTOM", status: "KELUAR", masa_masuk: "", selfie_status: "" };
  context.confirmIn({ request_id: "REQ-2", guard_name: "Guard A", pin: "1234" });
  assert.equal(updates[1].selfie_status, "BELUM_HANTAR");

  const ui = vm.createContext({
    currentSession: { role: "student", user: { student_id: "S1", no_matrik: "M1" } },
    RETURN_SELFIE_STATUS: { submitted: "SUDAH_HANTAR", notRequired: "TIDAK_DIPERLUKAN" },
    isRecordForCurrentStudent: () => true,
    reverseDisplayStatus: () => "SELESAI"
  });
  const start = appSource.indexOf("function isReturnSelfieSubmitted");
  const end = appSource.indexOf("function returnSelfieProofHtml", start);
  vm.runInContext(appSource.slice(start, end), ui);
  assert.equal(ui.isReturnSelfieEligible({ jenis_permohonan: "OUTING_CUSTOM", rawStatus: "SELESAI", masa_masuk: "x", selfie_status: "BELUM_HANTAR" }), true);
  assert.equal(ui.isReturnSelfieEligible({ jenis_permohonan: "OUTING_CUSTOM", rawStatus: "SELESAI", masa_masuk: "x", selfie_status: "TIDAK_DIPERLUKAN" }), false);
});

test("warden approval false is explicit auto-approval with audit while true remains pending", () => {
  const submitSource = gasSource.slice(gasSource.indexOf("function submitRequest"), gasSource.indexOf("function approveRequest"));
  assert.match(submitSource, /requiresWardenApproval\s*\?\s*STATUS\.pending\s*:\s*STATUS\.approved/);
  assert.match(submitSource, /warden_approve_by:\s*requiresWardenApproval\s*\?\s*""\s*:\s*"AUTO_CONFIG_V2"/);
  assert.match(submitSource, /masa_approve:\s*requiresWardenApproval\s*\?\s*""\s*:\s*now_\(\)/);
  assert.match(submitSource, /appendAuditLog\("AUTO_APPROVE_REQUEST"/);
  assert.match(submitSource, /reason:\s*"require_warden_approval=false"/);
});

test("custom type flows through Telegram labels, statistics grouping and dynamic filters", () => {
  const requests = [{
    request_id: "REQ-CUSTOM", tarikh: "2026-07-10", jenis_permohonan: "OUTING_CUSTOM",
    student_id: "S1", no_matrik: "M1", nama: "Pelajar", kelas: "A2", status: "SELESAI",
    masa_mohon: "2026-07-10 10:00:00", masa_keluar: "2026-07-10 11:00:00",
    masa_masuk: "2026-07-10 12:00:00", lewat: "Tidak"
  }];
  const { context } = createGasContext({ flag: true, requests });
  assert.equal(context.requestTypeLabel_("OUTING_CUSTOM"), "Outing Custom");
  const stats = context.getOutingStats({ month: 7, year: 2026 });
  assert.equal(stats.type_summary.length, 1);
  assert.equal(stats.type_summary[0].type_code, "OUTING_CUSTOM");
  assert.equal(stats.type_summary[0].display_name, "Outing Custom");
  assert.equal(stats.type_summary[0].count, 1);
  assert.doesNotMatch(appSource, /Object\.values\(REQUEST_TYPE\)\.includes\(record\.jenis_permohonan\)/);
  assert.match(appSource, /renderWardenChecklistTypeFiltersV220/);
  assert.match(indexSource, /id="adminMasterType"><option value="">Semua<\/option><\/select>/);
});

test("readiness UI is compact, accessible, read-only and never enables the production flag", () => {
  assert.match(indexSource, /<details class="admin-config-status" id="adminConfigStatus"/);
  assert.match(indexSource, /id="adminConfigStatusSummary"/);
  assert.match(indexSource, /id="adminConfigStatusLabel"/);
  assert.match(indexSource, /id="adminConfigReadinessReasons"/);
  assert.doesNotMatch(indexSource, /class="admin-config-readiness"/);
  assert.match(styleSource, /\.admin-config-status\[data-state="active"\].*#0a8a69/);
  assert.match(styleSource, /\.admin-config-status\[data-state="legacy"\].*#d88a08/);
  assert.match(styleSource, /\.admin-config-status\[data-state="issue"\].*#c43d2b/);
  assert.match(styleSource, /@media \(max-width: 520px\)[\s\S]*\.admin-heading-actions \.admin-config-status/);
  assert.doesNotMatch(indexSource, /OUTING_CONFIG_V2_ENABLED/);
  assert.doesNotMatch(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY,\s*"true"\)/);
  assert.match(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY,\s*"false"\)/);
});

function renderReadinessState(result) {
  const elements = {
    adminConfigStatus: { dataset: {}, open: true },
    adminConfigStatusSummary: {
      title: "",
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; }
    },
    adminConfigStatusLabel: { textContent: "" },
    adminConfigStatusDetails: { textContent: "" },
    adminConfigReadinessReasons: { innerHTML: "", hidden: false }
  };
  const context = vm.createContext({
    els: elements,
    escapeHtml: (value) => String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
  });
  const start = appSource.indexOf("function renderAdminOutingConfigReadinessV220");
  const end = appSource.indexOf("function getSafeGuardPolicyMessageV220", start);
  vm.runInContext(appSource.slice(start, end), context);
  context.renderAdminOutingConfigReadinessV220(result);
  return elements;
}

test("compact readiness indicator renders active, legacy and issue states accessibly", () => {
  const active = renderReadinessState({
    config_mode: "CONFIG_DRIVEN", config_mode_label: "Config-driven (Active)", ready: true, reasons: []
  });
  assert.equal(active.adminConfigStatus.dataset.state, "active");
  assert.equal(active.adminConfigStatusLabel.textContent, "Config Active");
  assert.equal(active.adminConfigStatusSummary.title, "Config-driven (Active) · Ready");

  const legacy = renderReadinessState({
    config_mode: "LEGACY", config_mode_label: "Legacy (Production)", ready: true, reasons: []
  });
  assert.equal(legacy.adminConfigStatus.dataset.state, "legacy");
  assert.equal(legacy.adminConfigStatusLabel.textContent, "Legacy");
  assert.equal(legacy.adminConfigStatusSummary.title, "Legacy (Production) · Config-driven Ready");

  const issue = renderReadinessState({
    config_mode: "CONFIG_DRIVEN", config_mode_label: "Config-driven (Active)", ready: false,
    reasons: ["OUTING_TYPES tidak lengkap."]
  });
  assert.equal(issue.adminConfigStatus.dataset.state, "issue");
  assert.equal(issue.adminConfigStatusLabel.textContent, "Config Issue");
  assert.equal(issue.adminConfigStatusSummary.title, "Config-driven Active · Not Ready");
  assert.match(issue.adminConfigStatusSummary.attributes["aria-label"], /Config Issue/);
  assert.match(issue.adminConfigReadinessReasons.innerHTML, /OUTING_TYPES tidak lengkap/);
  assert.equal(issue.adminConfigReadinessReasons.hidden, false);
});
