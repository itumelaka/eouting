const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function createContext(rows) {
  const context = vm.createContext({
    console,
    Utilities: {
      formatDate(date, _zone, format) {
        const iso = new Date(date).toISOString();
        if (format === "yyyy-MM-dd") return iso.slice(0, 10);
        if (format === "yyyy-MM-dd HH:mm:ss") return iso.slice(0, 19).replace("T", " ");
        if (format === "H") return String(new Date(date).getUTCHours());
        if (format === "m") return String(new Date(date).getUTCMinutes());
        if (format === "M") return String(new Date(date).getUTCMonth() + 1);
        if (format === "yyyy") return String(new Date(date).getUTCFullYear());
        return iso;
      }
    },
    SpreadsheetApp: {}, LockService: {}, PropertiesService: {}, ContentService: {}, UrlFetchApp: {}, DriveApp: {}, Session: {}
  });
  vm.runInContext(source, context);
  context.validateAdminCredentials_ = (payload) => {
    if (!payload || payload.pin !== "2468") throw new Error("Admin credentials required");
    return { admin_id: "ADM-1" };
  };
  context.getSheet_ = () => ({ name: "OUTING_REQUESTS" });
  context.getRowsAsObjects_ = () => rows.map((row) => ({ ...row }));
  return context;
}

test("new Admin operations are POST-only and authenticated", () => {
  const getSource = source.slice(source.indexOf("function doGet"), source.indexOf("function doPost"));
  const postSource = source.slice(source.indexOf("function doPost"), source.indexOf("function setupDatabase"));
  for (const action of ["getAdminMonitoring", "searchAdminMasterRecords", "getAdminStaff", "createStaff", "updateStaff", "toggleStaffStatus"]) {
    assert.doesNotMatch(getSource, new RegExp(action));
    assert.match(postSource, new RegExp(action));
  }
  for (const fn of ["getAdminMonitoring", "searchAdminMasterRecords", "getAdminStaff", "createStaff", "updateStaff", "toggleStaffStatus"]) {
    assert.match(source, new RegExp(`function ${fn}\\(payload\\) \\{[\\s\\S]{0,180}validateAdminCredentials_\\(payload\\)`));
  }
});

test("Admin monitoring groups pending, approved, out, overdue and emergency in one response", () => {
  const context = createContext([
    { request_id: "P1", nama: "Ali", kelas: "A2", status: "MENUNGGU_KELULUSAN", jenis_permohonan: "OUTING_BIASA", tarikh: "2026-08-09", masa_mohon: "2026-08-09 09:00:00" },
    { request_id: "A1", nama: "Bakar", kelas: "A3", status: "DILULUSKAN_WARDEN", jenis_permohonan: "KECEMASAN", tarikh: "2026-08-09", masa_mohon: "2026-08-09 10:00:00" },
    { request_id: "O1", nama: "Chong", kelas: "LI", status: "KELUAR", jenis_permohonan: "PULANG_BERMALAM", tarikh: "2026-08-01", tarikh_balik: "2020-01-01", masa_balik_dijangka: "20:00", masa_keluar: "2026-08-01 12:00:00" }
  ]);
  assert.throws(() => context.getAdminMonitoring({}), /credentials/i);
  const result = context.getAdminMonitoring({ pin: "2468" });
  assert.deepEqual(JSON.parse(JSON.stringify(result.kpis)), { pending: 1, approved: 1, out: 1, not_returned: 1, late: 1, emergency: 1 });
  assert.equal(result.records.find((row) => row.request_id === "O1").masa_keluar, "2026-08-01 12:00:00");
  assert.equal(context.getAdminMonitoring({ pin: "2468" }).records.length, 3);
  context.getRowsAsObjects_ = () => [];
  assert.equal(context.getAdminMonitoring({ pin: "2468" }).records.length, 0);
});

test("Master records search, filters, newest-first sorting and pagination are bounded", () => {
  const context = createContext([
    { request_id: "R1", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A2", jenis_permohonan: "OUTING_BIASA", status: "SELESAI", tarikh: "2026-07-01", masa_mohon: "2026-07-01 08:00:00" },
    { request_id: "R2", student_id: "S2", no_matrik: "M2", nama: "Nur Aisyah", kelas: "A3", jenis_permohonan: "KECEMASAN", status: "KELUAR", tarikh: "2026-08-09", masa_mohon: "2026-08-09 10:00:00" },
    { request_id: "R3", student_id: "S3", no_matrik: "M3", nama: "Nur Iman", kelas: "A3", jenis_permohonan: "KECEMASAN", status: "SELESAI", tarikh: "2026-08-08", masa_mohon: "2026-08-08 10:00:00" }
  ]);
  assert.throws(() => context.searchAdminMasterRecords({ search: "Nur" }), /credentials/i);
  assert.deepEqual(Array.from(context.searchAdminMasterRecords({ pin: "2468", search: "Nur" }).records, (row) => row.request_id), ["R2", "R3"]);
  assert.equal(context.searchAdminMasterRecords({ pin: "2468", search: "R1" }).records[0].nama, "Ali");
  assert.equal(context.searchAdminMasterRecords({ pin: "2468", kelas: "A3", jenis_permohonan: "KECEMASAN", status: "SELESAI", month: 8, year: 2026 }).total, 1);
  const bounded = context.searchAdminMasterRecords({ pin: "2468", page_size: 500 });
  assert.equal(bounded.page_size, 50);
});

test("staff management preserves existing WARDENS/GUARDS schema and never returns or audits PIN", () => {
  assert.match(source, /wardens:\s*"WARDENS"/);
  assert.match(source, /guards:\s*"GUARDS"/);
  assert.doesNotMatch(source.slice(source.indexOf("function toSafeAdminStaff_"), source.indexOf("function findStaffRowById_")), /pin:\s*row\.pin/);
  assert.match(source, /pin_configured:/);
  assert.match(source, /RESET_STAFF_PIN/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{[^}]*pin:/);
  const context = createContext([]);
  assert.throws(() => context.normalizeStaffRole_("ADMIN"), /WARDEN atau GUARD/);
  const safe = context.toSafeAdminStaff_({ warden_id: "W1", nama_warden: "Warden", pin: "1234", status: "Aktif" }, context.getStaffSheetConfig_("WARDEN"));
  assert.equal(safe.pin, undefined);
  assert.equal(safe.pin_configured, true);
});
