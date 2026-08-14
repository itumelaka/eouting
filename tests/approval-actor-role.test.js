const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

function gasContext() {
  const context = vm.createContext({ console });
  vm.runInContext(gasSource, context);
  return context;
}

function frontendRoleContext() {
  const start = appSource.indexOf("function normalizeWardenStaffRole");
  const end = appSource.indexOf("function openProfilePhotoSourceChooser", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const context = vm.createContext({});
  vm.runInContext(appSource.slice(start, end), context);
  return context;
}

test("warden_id prefixes derive HEP and WARDEN with a legacy WARDEN fallback", () => {
  const context = gasContext();
  assert.equal(context.deriveWardenStaffRole({ warden_id: "HEP-001" }), "HEP");
  assert.equal(context.deriveWardenStaffRole({ warden_id: "hep-002" }), "HEP");
  assert.equal(context.deriveWardenStaffRole({ warden_id: "W-001" }), "WARDEN");
  assert.equal(context.deriveWardenStaffRole({ warden_id: "LEGACY-9" }), "WARDEN");
  assert.equal(context.deriveWardenStaffRole({}), "WARDEN");
});

test("loginWarden returns derived staffRole while the frontend session role remains warden", () => {
  const context = gasContext();
  context.findActiveWarden_ = () => ({
    warden_id: "HEP-001", nama_warden: "PEGAWAI HEP", status: "Aktif"
  });
  const result = context.loginWarden({ nama_warden: "PEGAWAI HEP", pin: "1234" });
  assert.equal(result.staffRole, "HEP");
  assert.match(appSource, /startSession\("warden", runtimeWarden\)/);
  assert.match(appSource, /user\.staffRole\s*=\s*normalizeWardenStaffRole\(response\.staffRole\)/);
});

test("historical approver names resolve through WARDENS IDs and fall back to WARDEN", () => {
  const context = gasContext();
  context.getSheet_ = () => ({ name: "WARDENS" });
  context.getRowsAsObjects_ = () => [
    { warden_id: "HEP-001", nama_warden: "PEGAWAI HEP" },
    { warden_id: "W-001", nama_warden: "WARDEN SATU" }
  ];
  assert.equal(context.resolveWardenApprovalRole_({ warden_approve_by: "pegawai hep" }), "HEP");
  assert.equal(context.resolveWardenApprovalRole_({ warden_approve_by: "WARDEN SATU" }), "WARDEN");
  assert.equal(context.resolveWardenApprovalRole_({ warden_approve_by: "NAMA LAMA" }), "WARDEN");
});

test("approval authenticates the WARDENS record, ignores a supplied role, and keeps the canonical lifecycle", () => {
  const context = gasContext();
  const updates = [];
  const audits = [];
  const telegram = [];
  let readCount = 0;
  context.findActiveWarden_ = () => ({ warden_id: "HEP-001", nama_warden: "PEGAWAI HEP" });
  context.withScriptLock_ = (callback) => callback();
  context.findRowByRequestId_ = () => {
    readCount += 1;
    return {
      sheet: {}, rowNumber: 2,
      record: {
        request_id: "R-1", nama: "Ali", no_matrik: "M-1",
        jenis_permohonan: "OUTING_BIASA",
        status: readCount === 1 ? "MENUNGGU_KELULUSAN" : "DILULUSKAN_WARDEN",
        warden_approve_by: readCount === 1 ? "" : "PEGAWAI HEP"
      }
    };
  };
  context.updateRowByHeaders_ = (_sheet, _row, values) => updates.push(values);
  context.now_ = () => "2026-08-14 12:00:00";
  context.SpreadsheetApp = { flush() {} };
  context.appendAuditLog = (...args) => audits.push(args);
  context.telegramTitle_ = (_icon, title) => title;
  context.buildTelegramStatusMessage_ = (title) => title;
  context.sendTelegramMessage_ = (message) => telegram.push(message);

  const result = context.approveRequest({
    request_id: "R-1", nama_warden: "PEGAWAI HEP", pin: "1234", staffRole: "WARDEN"
  });

  assert.equal(updates[0].status, "DILULUSKAN_WARDEN");
  assert.equal(updates[0].warden_approve_by, "PEGAWAI HEP");
  assert.equal(audits[0][2], "HEP");
  assert.equal(result.warden_approve_role, "HEP");
  assert.equal(telegram[0], "Permohonan Diluluskan HEP");
});

test("approval displays and Telegram actor labels follow the resolved role", () => {
  const backend = gasContext();
  const frontend = frontendRoleContext();
  assert.equal(frontend.approvalStatusLabel({ warden_approve_role: "HEP" }), "Diluluskan HEP");
  assert.equal(frontend.approvalStatusLabel({ warden_approve_role: "WARDEN" }), "Diluluskan Warden");

  const hepMessage = backend.buildTelegramStatusMessage_("Permohonan Diluluskan HEP", {
    status: "DILULUSKAN_WARDEN", warden_approve_by: "PEGAWAI HEP", warden_approve_role: "HEP"
  });
  const wardenMessage = backend.buildTelegramStatusMessage_("Permohonan Diluluskan Warden", {
    status: "DILULUSKAN_WARDEN", warden_approve_by: "WARDEN SATU", warden_approve_role: "WARDEN"
  });
  assert.match(hepMessage, /^Permohonan Diluluskan HEP/m);
  assert.match(hepMessage, /^HEP: PEGAWAI HEP/m);
  assert.match(wardenMessage, /^Permohonan Diluluskan Warden/m);
  assert.match(wardenMessage, /^Warden: WARDEN SATU/m);
  assert.equal(
    backend.studentCancellationPreviousStatusLabel_("DILULUSKAN_WARDEN", { warden_approve_role: "HEP" }),
    "Diluluskan HEP"
  );
});

test("no HEP lifecycle state or new role columns are introduced", () => {
  assert.doesNotMatch(gasSource, /DILULUSKAN_HEP/);
  assert.doesNotMatch(appSource, /DILULUSKAN_HEP/);
  const headers = gasSource.slice(gasSource.indexOf("const HEADERS"), gasSource.indexOf("const STATUS"));
  assert.doesNotMatch(headers, /staff_role|approval_role/);
});
