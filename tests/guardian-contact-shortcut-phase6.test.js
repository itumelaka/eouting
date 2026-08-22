const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function request(overrides = {}) {
  return {
    request_id: "R-P6",
    jenis_permohonan: "KECEMASAN",
    status: "MENUNGGU_KELULUSAN",
    telefon_waris: "012-345 6789",
    hubungan_waris: "Ibu",
    warden_approve_by: "",
    masa_approve: "",
    masa_keluar: "",
    masa_masuk: "",
    ...overrides
  };
}

function fixture(record = request(), options = {}) {
  const audits = [];
  const context = vm.createContext({ console, Date, Intl });
  vm.runInContext(gasSource, context);
  context.findActiveWarden_ = (name, pin) => {
    if (pin !== "2468") return null;
    if (name === "Warden A") return { warden_id: "W-001", nama_warden: name };
    if (name === "HEP A") return { warden_id: "HEP-001", nama_warden: name };
    return null;
  };
  context.findRowByRequestId_ = (requestId) => requestId === record.request_id
    ? { record, rowNumber: 2 }
    : null;
  context.getOperationalUrgency_ = () => options.urgency || {
    applicable: record.status === "KELUAR",
    state: options.urgencyState || null,
    timing_valid: record.status === "KELUAR"
  };
  context.appendAuditLog = (action, requestId, role, name, details) => {
    if (options.auditFailure) return false;
    const row = { action, request_id: requestId, user_role: role, user_name: name, details };
    audits.push(row);
    return row;
  };
  return { context, record, audits };
}

function access(f, actor = "Warden A") {
  return plain(f.context.getGuardianContact({
    request_id: f.record.request_id,
    nama_warden: actor,
    pin: "2468"
  }));
}

test("authenticated Warden and HEP can access pending emergency contact", () => {
  for (const actor of ["Warden A", "HEP A"]) {
    const f = fixture();
    const result = access(f, actor);
    assert.deepEqual(result, {
      available: true,
      guardian_name: "",
      guardian_relation: "Ibu",
      guardian_phone: "012-345 6789",
      call_uri: "tel:0123456789"
    });
    assert.equal(f.audits[0].user_role, actor.startsWith("HEP") ? "HEP" : "Warden");
  }
});

test("approved emergency remains eligible", () => {
  const f = fixture(request({ status: "DILULUSKAN_WARDEN" }));
  assert.equal(access(f).available, true);
  assert.equal(JSON.parse(f.audits[0].details).context, "EMERGENCY_REQUEST");
});

test("only authoritative KELUAR CRITICAL and ACTION_REQUIRED urgency are eligible", () => {
  for (const state of ["CRITICAL", "ACTION_REQUIRED"]) {
    const f = fixture(request({ jenis_permohonan: "OUTING_BIASA", status: "KELUAR" }), { urgencyState: state });
    assert.equal(access(f).available, true);
    assert.equal(JSON.parse(f.audits[0].details).context, `${state}_RETURN`);
  }
  for (const state of ["NORMAL", "DUE_SOON", "LATE"]) {
    const f = fixture(request({ jenis_permohonan: "OUTING_BIASA", status: "KELUAR" }), { urgencyState: state });
    assert.throws(() => access(f), /tidak lagi tersedia/);
    assert.equal(f.audits.length, 0);
  }
});

test("ordinary pending and every terminal lifecycle are denied", () => {
  const denied = [
    request({ jenis_permohonan: "OUTING_BIASA" }),
    request({ status: "SELESAI" }),
    request({ status: "DITOLAK_WARDEN" }),
    request({ status: "DIBATALKAN_PELAJAR" })
  ];
  for (const row of denied) {
    const f = fixture(row);
    assert.throws(() => access(f), /tidak lagi tersedia/);
    assert.equal(f.audits.length, 0);
  }
});

test("Guard, Student, Public-shaped callers and invalid Wardens are denied", () => {
  const f = fixture();
  for (const payload of [
    { request_id: "R-P6", role: "guard", nama_guard: "Guard A", pin: "2468" },
    { request_id: "R-P6", role: "student", student_id: "S1", pin: "2468" },
    { request_id: "R-P6" },
    { request_id: "R-P6", nama_warden: "Unknown", pin: "2468" },
    { request_id: "R-P6", nama_warden: "Warden A", pin: "wrong" }
  ]) {
    assert.throws(() => f.context.getGuardianContact(payload), /Akses sesi warden tidak sah/);
  }
  assert.equal(f.audits.length, 0);
});

test("missing or malformed phones return unavailable and never form unsafe tel URIs", () => {
  for (const phone of ["", "abc0123456789", "+60+123", "0123;alert(1)", "123"] ) {
    const f = fixture(request({ telefon_waris: phone }));
    assert.deepEqual(access(f), { available: false });
    assert.equal(f.audits.length, 0);
  }
  const valid = fixture();
  assert.equal(valid.context.normalizeGuardianPhoneForTel_("+60 (12) 345-6789"), "+60123456789");
  assert.equal(valid.context.normalizeGuardianPhoneForTel_("012.345.6789"), "0123456789");
});

test("authoritative recheck blocks a card that became stale before contact fetch", () => {
  const row = request();
  const f = fixture(row);
  const projected = plain(f.context.projectGuardianContactBoundary_([
    { ...row, operational_urgency: { state: null } }
  ], "warden"));
  assert.equal(projected[0].guardian_contact_available, true);
  row.status = "SELESAI";
  assert.throws(() => access(f), /tidak lagi tersedia/);
  assert.equal(f.audits.length, 0);
});

test("successful access audit contains actor and context but no sensitive contact values", () => {
  const f = fixture();
  access(f);
  assert.equal(f.audits.length, 1);
  assert.equal(f.audits[0].action, "GUARDIAN_CONTACT_ACCESSED");
  assert.equal(f.audits[0].request_id, "R-P6");
  assert.equal(f.audits[0].user_name, "Warden A");
  assert.equal(JSON.parse(f.audits[0].details).context, "EMERGENCY_REQUEST");
  assert.doesNotMatch(JSON.stringify(f.audits), /012|telefon|guardian_phone|hubungan_waris|Ibu/);
});

test("contact access has no lifecycle, approval, Telegram, SMS or WhatsApp mutation path", () => {
  const row = request({ status: "DILULUSKAN_WARDEN", warden_approve_by: "Warden Lama", masa_approve: "2026-08-22 09:00:00" });
  const before = JSON.stringify(row);
  const f = fixture(row);
  access(f);
  assert.equal(JSON.stringify(row), before);
  const source = gasSource.slice(gasSource.indexOf("function getGuardianContact(payload)"), gasSource.indexOf("function addOperationalUrgency_"));
  assert.doesNotMatch(source, /updateRowByHeaders_|sendTelegramMessage_|sendSms|WhatsApp|confirmOut|confirmIn|approveRequest|rejectRequest/);
});

test("broad operational projections remove guardian values from Warden, Guard and Student", () => {
  const f = fixture();
  const row = { ...f.record, operational_urgency: { state: null } };
  const warden = plain(f.context.projectGuardianContactBoundary_([row], "warden"))[0];
  assert.equal(warden.guardian_contact_available, true);
  assert.equal("telefon_waris" in warden, false);
  assert.equal("hubungan_waris" in warden, false);
  for (const role of ["guard", "student"]) {
    const projected = plain(f.context.projectGuardianContactBoundary_([row], role))[0];
    assert.equal("telefon_waris" in projected, false);
    assert.equal("hubungan_waris" in projected, false);
    assert.equal("guardian_contact_available" in projected, false);
  }
  const publicProjection = gasSource.slice(gasSource.indexOf("function getTodayRecords()"), gasSource.indexOf("function isNoGuardDepartureEnabled_"));
  assert.doesNotMatch(publicProjection, /telefon_waris|hubungan_waris|guardian_contact/);
});

test("Warden UI reveals contact only after authenticated fetch and preserves Phase 3 controls", () => {
  const shortcut = appSource.slice(appSource.indexOf("function guardianContactShortcutHtml"), appSource.indexOf("function wardenDepartureConfirmationCard"));
  assert.match(shortcut, /guardian_contact_available !== true/);
  assert.match(shortcut, /apiPost\("getGuardianContact"/);
  assert.match(shortcut, /Nama Penjaga[\s\S]*Hubungan[\s\S]*No\. Telefon[\s\S]*Telefon Sekarang/);
  assert.match(shortcut, /href="\$\{escapeHtml\(contact\.call_uri\)\}"/);
  assert.doesNotMatch(shortcut.slice(0, shortcut.indexOf("async function fetchGuardianContact")), /guardian_phone[^\n]*data-guardian-contact=/);
  const actions = appSource.slice(appSource.indexOf("function actionButtons"), appSource.indexOf("function badgeClass"));
  assert.match(actions, /data-approve[\s\S]*Luluskan[\s\S]*data-reject[\s\S]*Tolak/);
  assert.match(indexSource, /Telah Diluluskan \/ Risiko Pulang/);
});

test("routing is POST-only and sensitive values are absent from public, Guard and Student DOM helpers", () => {
  const getRouter = gasSource.slice(gasSource.indexOf("function doGet"), gasSource.indexOf("function doPost"));
  const postRouter = gasSource.slice(gasSource.indexOf("function doPost"), gasSource.indexOf("function setupDatabase"));
  assert.doesNotMatch(getRouter, /getGuardianContact/);
  assert.match(postRouter, /getGuardianContact/);
  const liveMapper = appSource.slice(appSource.indexOf("function mapLiveRecord"), appSource.indexOf("function mapPublicMonitoringRecord"));
  assert.doesNotMatch(liveMapper, /telefon_waris|hubungan_waris/);
  const guardCard = appSource.slice(appSource.indexOf("function guardOperationalCard"), appSource.indexOf("function getGuardReturnTiming"));
  assert.doesNotMatch(guardCard, /telefon_waris|hubungan_waris|guardianContactHtml/);
  const emergency = appSource.slice(appSource.indexOf("function emergencyDetailHtml"), appSource.indexOf("function guardianContactHtml"));
  assert.doesNotMatch(emergency, /telefon_waris|hubungan_waris|tel:/);
});

test("Phase 6 adds no request schema, trigger, notification, or emergency approval mechanism", () => {
  const header = gasSource.slice(gasSource.indexOf("OUTING_REQUESTS: ["), gasSource.indexOf("AUDIT_LOG:"));
  assert.doesNotMatch(header, /guardian_contact_available|guardian_name|call_uri/);
  const phase6 = gasSource.slice(gasSource.indexOf("function projectGuardianContactBoundary_"), gasSource.indexOf("function addOperationalUrgency_"));
  assert.doesNotMatch(phase6, /ScriptApp|PropertiesService|createTrigger|sendTelegram|approveRequest|rejectRequest|updateRowByHeaders_|status\s*=\s*STATUS|masa_approve\s*=/);
});
