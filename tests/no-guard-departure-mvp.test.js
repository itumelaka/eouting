const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function between(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(from, -1, `missing ${start}`);
  assert.notEqual(to, -1, `missing ${end}`);
  return source.slice(from, to);
}

function createFixture(options = {}) {
  const audits = (options.audits || []).map((row) => ({ ...row }));
  const updates = [];
  const telegramMessages = [];
  let lockCalls = 0;
  const properties = new Map();
  if (options.featureEnabled !== false) properties.set("NO_GUARD_DEPARTURE_ENABLED", "true");
  let row = {
    request_id: "R1", student_id: options.owner === false ? "S2" : "S1",
    no_matrik: options.owner === false ? "M2" : "M1", nama: "Ali",
    jenis_permohonan: "PULANG_BERMALAM", status: options.status || "DILULUSKAN_WARDEN",
    lokasi: "Klinik Merlimau", masa_keluar: options.masa_keluar || "", guard_keluar_by: options.guard_keluar_by || ""
  };
  const context = {
    EOUTING_APP_URL: "https://itumelaka.github.io/eouting/",
    DEPARTURE_CONFIRMATION_AUDIT: {
      requested: "DEPARTURE_CONFIRMATION_REQUESTED", wardenCheckout: "WARDEN_REMOTE_CHECKOUT"
    },
    NO_GUARD_DEPARTURE_PROPERTY: "NO_GUARD_DEPARTURE_ENABLED",
    STATUS: { approved: "DILULUSKAN_WARDEN", out: "KELUAR" },
    SHEETS: { audit: "AUDIT_LOG" },
    getSheet_: (name) => ({ name }),
    getRowsAsObjects_: (sheet) => sheet.name === "AUDIT_LOG" ? audits.map((item) => ({ ...item })) : [],
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties.has(key) ? properties.get(key) : null,
        setProperty: (key, value) => properties.set(key, String(value))
      })
    },
    findActiveStudent_: options.invalidStudent ? () => null : () => ({ student_id: "S1", no_matrik: "M1", nama: "Ali" }),
    findActiveWarden_: options.invalidWarden ? () => null : () => ({ nama_warden: "Warden A", role: "WARDEN" }),
    deriveWardenStaffRole: () => "WARDEN",
    findActiveGuard_: () => ({ nama_guard: "Guard A" }),
    findRowByRequestId_: () => ({ sheet: {}, rowNumber: 2, record: { ...row } }),
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    isNoGuardDepartureEnabled_: () => properties.get("NO_GUARD_DEPARTURE_ENABLED") === "true",
    now_: () => "2026-08-21 18:05:00",
    formatTelegramDateTime_: () => "21/08/2026 18:05",
    requestTypeLabel_: () => "Pulang Bermalam",
    safeTelegramCaptionValue_: (value) => String(value || "-").replace(/[\u0000-\u001F\u007F]/g, " ").trim(),
    updateRowByHeaders_: (_sheet, _rowNumber, values) => {
      updates.push({ ...values });
      row = { ...row, ...values };
    },
    appendAuditLog: (action, requestId, role, name, details) => {
      const audit = { timestamp: "2026-08-21 18:05:00", action, request_id: requestId, user_role: role, user_name: name, details };
      audits.push(audit);
      return audit;
    },
    withScriptLock_: (callback) => { lockCalls += 1; return callback(); },
    SpreadsheetApp: { flush() {} },
    invalidateOperationalRecordsCache_: () => {},
    hasCellValue_: (value) => value !== "" && value !== null && value !== undefined,
    sendTelegramMessage_: (message) => {
      telegramMessages.push(message);
      return options.telegramResult !== false;
    },
    console
  };
  vm.createContext(context);
  vm.runInContext(between(gasSource, "function getDepartureConfirmationAuditState_", "function approveRequest"), context);
  vm.runInContext(between(gasSource, "function confirmOut", "function confirmIn"), context);
  return { context, audits, updates, telegramMessages, properties, get row() { return row; }, get lockCalls() { return lockCalls; } };
}

const requestPayload = { request_id: "R1", student_id: "S1", no_matrik: "M1" };
const wardenPayload = { request_id: "R1", nama_warden: "Warden A", pin: "949494" };

test("approved owner may request once without changing lifecycle or departure fields", () => {
  const fixture = createFixture();
  const result = fixture.context.requestDepartureConfirmation(requestPayload);
  assert.equal(fixture.lockCalls, 1);
  assert.equal(result.departure_confirmation_pending, true);
  assert.equal(fixture.audits.filter((row) => row.action === "DEPARTURE_CONFIRMATION_REQUESTED").length, 1);
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.row.status, "DILULUSKAN_WARDEN");
  assert.equal(fixture.row.masa_keluar, "");
  assert.equal(fixture.row.guard_keluar_by, "");
  assert.equal(fixture.telegramMessages.length, 1);
  assert.match(fixture.telegramMessages[0], /🚪 PENGESAHAN KELUAR TANPA GUARD/);
  assert.match(fixture.telegramMessages[0], /Pelajar: Ali/);
  assert.match(fixture.telegramMessages[0], /Jenis: Pulang Bermalam/);
  assert.match(fixture.telegramMessages[0], /Lokasi: Klinik Merlimau/);
  assert.match(fixture.telegramMessages[0], /Masa Mohon: 21\/08\/2026 18:05/);
  assert.match(fixture.telegramMessages[0], /https:\/\/itumelaka\.github\.io\/eouting\//);

  fixture.context.requestDepartureConfirmation(requestPayload);
  assert.equal(fixture.audits.filter((row) => row.action === "DEPARTURE_CONFIRMATION_REQUESTED").length, 1);
  assert.equal(fixture.telegramMessages.length, 1);
});

test("Telegram failure preserves the new pending request without departure mutation or retry spam", () => {
  const fixture = createFixture({ telegramResult: false });
  const result = fixture.context.requestDepartureConfirmation(requestPayload);
  assert.equal(result.departure_confirmation_pending, true);
  assert.equal(result.status, "DILULUSKAN_WARDEN");
  assert.equal(fixture.audits.filter((row) => row.action === "DEPARTURE_CONFIRMATION_REQUESTED").length, 1);
  assert.equal(fixture.telegramMessages.length, 1);
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.row.masa_keluar, "");
  assert.equal(fixture.row.guard_keluar_by, "");
  const projected = fixture.context.addDepartureConfirmationProjection_([{ request_id: "R1", status: "DILULUSKAN_WARDEN" }])[0];
  assert.equal(projected.departure_confirmation_pending, true);

  fixture.context.requestDepartureConfirmation(requestPayload);
  assert.equal(fixture.telegramMessages.length, 1);
  assert.equal(fixture.audits.filter((row) => row.action === "DEPARTURE_CONFIRMATION_REQUESTED").length, 1);
});

test("student request rejects invalid auth, ownership, pending and already-out records", () => {
  assert.throws(() => createFixture({ invalidStudent: true }).context.requestDepartureConfirmation(requestPayload), /sesi pelajar/);
  assert.throws(() => createFixture({ owner: false }).context.requestDepartureConfirmation(requestPayload), /pelajar lain/);
  assert.throws(() => createFixture({ status: "MENUNGGU_KELULUSAN" }).context.requestDepartureConfirmation(requestPayload), /telah diluluskan/);
  assert.throws(() => createFixture({ status: "KELUAR", masa_keluar: "2026-08-21 18:00:00" }).context.requestDepartureConfirmation(requestPayload), /telah diluluskan/);
});

test("feature gate defaults safely and blocks Student initiation while preserving unresolved audit history", () => {
  const requested = { timestamp: "2026-08-21 18:00:00", action: "DEPARTURE_CONFIRMATION_REQUESTED", request_id: "R1" };
  const fixture = createFixture({ featureEnabled: false, audits: [requested] });
  assert.throws(() => fixture.context.requestDepartureConfirmation(requestPayload), /dinyahaktifkan oleh Admin/);
  assert.equal(fixture.audits.length, 1);
  assert.equal(fixture.audits[0].action, "DEPARTURE_CONFIRMATION_REQUESTED");
  assert.equal(fixture.updates.length, 0);
  const projected = fixture.context.addDepartureConfirmationProjection_([{ request_id: "R1", status: "DILULUSKAN_WARDEN" }])[0];
  assert.equal(projected.departure_confirmation_pending, true);
  assert.equal(projected.no_guard_departure_enabled, false);
});

test("audit projection includes only approved unresolved requests", () => {
  const requested = { timestamp: "2026-08-21 18:00:00", action: "DEPARTURE_CONFIRMATION_REQUESTED", request_id: "R1" };
  const fixture = createFixture({ audits: [requested] });
  const rows = fixture.context.addDepartureConfirmationProjection_([
    { request_id: "R1", status: "DILULUSKAN_WARDEN" },
    { request_id: "R2", status: "DILULUSKAN_WARDEN" },
    { request_id: "R1", status: "KELUAR" }
  ]);
  assert.equal(rows[0].departure_confirmation_pending, true);
  assert.equal(rows[0].departure_confirmation_requested_at, requested.timestamp);
  assert.equal(rows[1].departure_confirmation_pending, false);
  assert.equal(rows[2].departure_confirmation_pending, false);

  fixture.audits.push({ timestamp: "2026-08-21 18:05:00", action: "WARDEN_REMOTE_CHECKOUT", request_id: "R1" });
  assert.equal(fixture.context.addDepartureConfirmationProjection_([{ request_id: "R1", status: "DILULUSKAN_WARDEN" }])[0].departure_confirmation_pending, false);
});

test("Warden remote confirmation authenticates, requires an unresolved request, and writes a neutral departure", () => {
  const requested = { timestamp: "2026-08-21 18:00:00", action: "DEPARTURE_CONFIRMATION_REQUESTED", request_id: "R1" };
  assert.throws(() => createFixture({ invalidWarden: true, audits: [requested] }).context.confirmWardenRemoteCheckout(wardenPayload), /tidak dijumpai/);
  assert.throws(() => createFixture().context.confirmWardenRemoteCheckout(wardenPayload), /Tiada permohonan/);

  const fixture = createFixture({ audits: [requested] });
  const result = fixture.context.confirmWardenRemoteCheckout(wardenPayload);
  assert.equal(result.status, "KELUAR");
  assert.equal(result.masa_keluar, "2026-08-21 18:05:00");
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.updates[0])), { status: "KELUAR", masa_keluar: "2026-08-21 18:05:00" });
  assert.equal(fixture.row.guard_keluar_by, "");
  const audit = fixture.audits.find((row) => row.action === "WARDEN_REMOTE_CHECKOUT");
  assert.equal(audit.user_role, "Warden");
  assert.equal(JSON.parse(audit.details).actor_role, "WARDEN");
  assert.equal(JSON.parse(audit.details).mode, "REMOTE_NO_GUARD");
});

test("disabled feature blocks Warden remote confirmation without affecting the pending audit", () => {
  const requested = { timestamp: "2026-08-21 18:00:00", action: "DEPARTURE_CONFIRMATION_REQUESTED", request_id: "R1" };
  const fixture = createFixture({ featureEnabled: false, audits: [requested] });
  assert.throws(() => fixture.context.confirmWardenRemoteCheckout(wardenPayload), /dinyahaktifkan oleh Admin/);
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.audits.length, 1);
});

test("Admin reads, enables and disables the strict Script Properties setting with audit", () => {
  const properties = new Map();
  const audits = [];
  const context = {
    NO_GUARD_DEPARTURE_PROPERTY: "NO_GUARD_DEPARTURE_ENABLED",
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (key) => properties.has(key) ? properties.get(key) : null,
      setProperty: (key, value) => properties.set(key, String(value))
    }) },
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    validateAdminCredentials_: (payload) => {
      if (!payload || payload.pin !== "2468") throw new Error("Admin tidak sah.");
      return { admin_id: "ADMIN-1", nama_admin: "Admin Satu" };
    },
    requireBoolean_: (value, field) => {
      if (typeof value !== "boolean") throw new Error(`${field} mesti boolean.`);
      return value;
    },
    withScriptLock_: (callback) => callback(),
    getSafeAdminIdentity_: (admin) => admin.admin_id,
    appendAuditLog: (...args) => { audits.push(args); return true; }
  };
  vm.createContext(context);
  vm.runInContext(between(gasSource, "function isNoGuardDepartureEnabled_", "function getAnnouncementBannerAdmin"), context);

  assert.deepEqual(JSON.parse(JSON.stringify(context.getNoGuardDepartureConfig({ pin: "2468" }))), { enabled: false });
  assert.equal(context.updateNoGuardDepartureConfig({ pin: "2468", enabled: true }).enabled, true);
  assert.equal(properties.get("NO_GUARD_DEPARTURE_ENABLED"), "true");
  assert.equal(context.updateNoGuardDepartureConfig({ pin: "2468", enabled: false }).enabled, false);
  assert.equal(properties.get("NO_GUARD_DEPARTURE_ENABLED"), "false");
  assert.throws(() => context.updateNoGuardDepartureConfig({ pin: "0000", enabled: true }), /Admin/);
  assert.throws(() => context.updateNoGuardDepartureConfig({ pin: "2468", enabled: "true" }), /boolean/);
  assert.equal(audits.length, 2);
  assert.equal(audits[0][0], "UPDATE_NO_GUARD_DEPARTURE_CONFIG");
  assert.equal(audits[0][5], "SYSTEM_CONFIG");
  assert.equal(audits[0][6], "NO_GUARD_DEPARTURE_ENABLED");
});

test("duplicate Warden confirmation is idempotent and Guard-first blocks Warden fallback", () => {
  const requested = { timestamp: "2026-08-21 18:00:00", action: "DEPARTURE_CONFIRMATION_REQUESTED", request_id: "R1" };
  const fixture = createFixture({ audits: [requested] });
  fixture.context.confirmWardenRemoteCheckout(wardenPayload);
  const duplicate = fixture.context.confirmWardenRemoteCheckout(wardenPayload);
  assert.match(duplicate.message, /sudah disahkan keluar oleh Warden/);
  assert.equal(fixture.audits.filter((row) => row.action === "WARDEN_REMOTE_CHECKOUT").length, 1);

  const guardFirst = createFixture({ audits: [requested], status: "KELUAR", masa_keluar: "2026-08-21 18:03:00", guard_keluar_by: "Guard A" });
  assert.throws(() => guardFirst.context.confirmWardenRemoteCheckout(wardenPayload), /sudah tidak menunggu/);
});

test("Warden-first prevents a second Guard departure transition", () => {
  const requested = { timestamp: "2026-08-21 18:00:00", action: "DEPARTURE_CONFIRMATION_REQUESTED", request_id: "R1" };
  const fixture = createFixture({ audits: [requested] });
  fixture.context.confirmWardenRemoteCheckout(wardenPayload);
  const result = fixture.context.confirmOut({ request_id: "R1", nama_guard: "Guard A", pin: "949494" });
  assert.match(result.message, /sudah disahkan keluar/);
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.row.guard_keluar_by, "");
});

test("Student and Warden UI expose only the scoped fallback controls", () => {
  const studentCard = between(appSource, "function studentStatusCard", "function studentStatusInfo");
  assert.match(studentCard, /DILULUSKAN_WARDEN/);
  assert.match(studentCard, /Mohon Pengesahan Keluar/);
  assert.match(studentCard, /Menunggu Pengesahan Keluar oleh Warden/);
  assert.doesNotMatch(studentCard, /guard_keluar_by\s*=/);
  assert.match(indexSource, /Menunggu Pengesahan Keluar[\s\S]*wardenDepartureConfirmationList/);
  const warden = between(appSource, "function renderWarden", "function isReturnSelfieSubmitted");
  assert.match(warden, /departure_confirmation_pending === true/);
  assert.match(warden, /data-warden-remote-checkout/);
  assert.match(warden, /Sahkan Keluar/);
  assert.doesNotMatch(warden, /telefon_waris|hubungan_waris|guardian|Waris/);
  assert.match(studentCard, /isNoGuardDepartureEnabledForRecord/);
  assert.match(warden, /isNoGuardDepartureEnabledForRecord/);
});

test("Admin toggle UI uses authenticated read/write endpoints and grants no checkout authority", () => {
  assert.match(indexSource, /Fallback Pengesahan Keluar Tanpa Guard/);
  assert.match(indexSource, /id="adminNoGuardDepartureEnabled"[^>]*type="checkbox"/);
  assert.match(indexSource, /Aktifkan fungsi/);
  assert.match(appSource, /apiPost\("getNoGuardDepartureConfig", buildAdminCredentialPayloadV200\(\)\)/);
  assert.match(appSource, /apiPost\("updateNoGuardDepartureConfig", Object\.assign/);
  const configBackend = between(gasSource, "function isNoGuardDepartureEnabled_", "function getAnnouncementBannerAdmin");
  assert.match(configBackend, /validateAdminCredentials_/);
  assert.match(configBackend, /withScriptLock_/);
  assert.doesNotMatch(configBackend, /status:\s*STATUS\.out|masa_keluar|guard_keluar_by|WARDEN_REMOTE_CHECKOUT/);
});

test("operational projection stays private to Student/Warden and Guard flow remains unchanged", () => {
  const projection = between(gasSource, "function getOperationalTodayRecords", "function addOperationalUrgency_");
  assert.match(projection, /role === "warden" \|\| role === "student"/);
  assert.doesNotMatch(between(appSource, "function mapPublicMonitoringRecord", "function parseDateValue"), /departure_confirmation/);
  const guard = between(appSource, "function renderGuard", "function renderDashboard");
  assert.match(guard, /record\.status === STATUS\.approved/);
  assert.match(guard, /confirmOut\(button\.dataset\.out, button\)/);
  const backend = between(gasSource, "function getDepartureConfirmationAuditState_", "function approveRequest");
  assert.match(backend, /sendTelegramMessage_\(result\.telegram_message\)/);
  assert.doesNotMatch(backend, /scanReturnOperationalNotifications_|trigger/i);
  assert.doesNotMatch(backend, /guard_keluar_by\s*:/);
  assert.match(between(gasSource, "function buildTelegramSubmitMessage_", "function studentCancellationPreviousStatusLabel_"), /appendEOutingWardenLink_/);
});

test("MVP adds no request-sheet schema field or lifecycle status", () => {
  const requestHeaders = between(gasSource, "OUTING_REQUESTS: [", "AUDIT_LOG:");
  assert.doesNotMatch(requestHeaders, /departure_confirmation/);
  const status = between(gasSource, "const STATUS =", "const DEPARTURE_CONFIRMATION_AUDIT");
  assert.doesNotMatch(status, /DEPARTURE_CONFIRMATION|REMOTE/);
  assert.match(gasSource, /const NO_GUARD_DEPARTURE_PROPERTY = "NO_GUARD_DEPARTURE_ENABLED"/);
});
