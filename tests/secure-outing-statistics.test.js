const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const claspIgnore = fs.readFileSync(path.join(root, ".claspignore"), "utf8");

class FakeSheet {
  constructor(rows) {
    this.rows = rows;
  }

  getDataRange() {
    return { getValues: () => this.rows };
  }
}

function table(headers, rows) {
  return new FakeSheet([headers, ...rows.map((row) => headers.map((header) => row[header] ?? ""))]);
}

function formatMalaysiaDate(date, pattern) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date).reduce((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  if (pattern === "yyyy") return parts.year;
  if (pattern === "M") return String(Number(parts.month));
  if (pattern === "yyyy-MM-dd") return `${parts.year}-${parts.month}-${parts.day}`;
  if (pattern === "yyyy-MM-dd HH:mm:ss") return `${parts.year}-${parts.month}-${parts.day} 00:00:00`;
  return "";
}

function createContext(requestRows) {
  const studentHeaders = ["student_id", "no_matrik", "nama", "kelas", "status"];
  const adminHeaders = ["admin_id", "nama_admin", "pin", "status"];
  const requestHeaders = [
    "request_id", "tarikh", "jenis_permohonan", "student_id", "no_matrik", "nama", "kelas",
    "masa_mohon", "status", "masa_keluar", "masa_masuk"
  ];
  const sheets = new Map([
    ["STUDENTS", table(studentHeaders, [
      { student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "AKTIF" },
      { student_id: "S2", no_matrik: "M2", nama: "Bakar", kelas: "A3", status: "AKTIF" }
    ])],
    ["ADMIN_USERS", table(adminHeaders, [
      { admin_id: "ADMIN1", nama_admin: "Admin Satu", pin: "2468", status: "AKTIF" }
    ])],
    ["OUTING_REQUESTS", table(requestHeaders, requestRows)]
  ]);
  const spreadsheet = { getSheetByName: (name) => sheets.get(name) || null };
  const context = vm.createContext({
    console,
    Intl,
    Date,
    Math,
    Number,
    Object,
    String,
    Array,
    JSON,
    isNaN,
    SpreadsheetApp: { openById: () => spreadsheet },
    Utilities: { formatDate: (date, timezone, pattern) => formatMalaysiaDate(date, pattern) }
  });
  vm.runInContext(gasSource, context);
  return context;
}

function currentMalaysiaYear() {
  return Number(new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric"
  }).format(new Date()));
}

test("student annual summary counts only the authenticated student's SELESAI records in the current year", () => {
  const year = currentMalaysiaYear();
  const context = createContext([
    { request_id: "R1", tarikh: `${year}-01-03`, jenis_permohonan: "OUTING_BIASA", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "SELESAI" },
    { request_id: "R2", tarikh: `${year}-02-04`, jenis_permohonan: "JENIS_MASA_DEPAN", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "SELESAI" },
    { request_id: "R3", tarikh: `${year}-03-05`, jenis_permohonan: "PULANG_BERMALAM", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "KELUAR" },
    { request_id: "R4", tarikh: `${year - 1}-12-30`, jenis_permohonan: "KECEMASAN", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "SELESAI" },
    { request_id: "R5", tarikh: `${year}-04-06`, jenis_permohonan: "OUTING_BIASA", student_id: "S2", no_matrik: "M2", nama: "Bakar", kelas: "A3", status: "SELESAI" }
  ]);

  const result = context.getStudentAnnualSummary({ student_id: "S1", no_matrik: "M1" });
  assert.equal(result.year, year);
  assert.equal(result.total_outings, 2);
  assert.throws(
    () => context.getStudentAnnualSummary({ student_id: "S1", no_matrik: "WRONG" }),
    /Akses sesi pelajar tidak sah/
  );
});

test("admin individual statistics enforce auth, filters, grouping, duration rules and sorting", () => {
  const context = createContext([
    { request_id: "C1", tarikh: "2026-08-01", jenis_permohonan: "TYPE_X", student_id: "S3", no_matrik: "M3", nama: "Cara", kelas: "A3", status: "SELESAI" },
    { request_id: "C2", tarikh: "2026-08-02", jenis_permohonan: "TYPE_Y", student_id: "S3", no_matrik: "M3", nama: "Cara", kelas: "A3", status: "SELESAI" },
    { request_id: "C3", tarikh: "2026-08-03", jenis_permohonan: "TYPE_Z", student_id: "S3", no_matrik: "M3", nama: "Cara", kelas: "A3", status: "SELESAI" },
    { request_id: "A1", tarikh: "2026-08-04", jenis_permohonan: "FUTURE_TYPE", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "SELESAI", masa_keluar: "2026-08-04 08:00:00", masa_masuk: "2026-08-04 09:30:00" },
    { request_id: "A2", tarikh: "", masa_mohon: "2026-08-05 09:00:00", jenis_permohonan: "ANY_TYPE", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A3", status: "SELESAI", masa_keluar: "invalid", masa_masuk: "2026-08-05 10:00:00" },
    { request_id: "B1", tarikh: "2026-08-06", jenis_permohonan: "OUTING_BIASA", student_id: "S2", no_matrik: "M2", nama: "Bakar", kelas: "A3", status: "SELESAI", masa_keluar: "2026-08-06 08:00:00", masa_masuk: "2026-08-08 14:00:00" },
    { request_id: "B2", tarikh: "2026-08-07", jenis_permohonan: "PULANG_BERMALAM", student_id: "S2", no_matrik: "M2", nama: "Bakar", kelas: "A3", status: "SELESAI", masa_keluar: "2026-08-07 10:00:00", masa_masuk: "2026-08-07 09:00:00" },
    { request_id: "X1", tarikh: "2026-08-08", jenis_permohonan: "TYPE_X", student_id: "S4", nama: "Kelas Lain", kelas: "A2", status: "SELESAI" },
    { request_id: "X2", tarikh: "2026-07-08", jenis_permohonan: "TYPE_X", student_id: "S1", nama: "Ali", kelas: "A3", status: "SELESAI" },
    { request_id: "X3", tarikh: "2026-08-09", jenis_permohonan: "TYPE_X", student_id: "S1", nama: "Ali", kelas: "A3", status: "DITOLAK_WARDEN" }
  ]);
  const credentials = { admin_id: "ADMIN1", nama_admin: "Admin Satu", pin: "2468" };

  assert.throws(
    () => context.getAdminIndividualStats({ month: 8, year: 2026, kelas: "A3" }),
    /PIN diperlukan/
  );
  const result = context.getAdminIndividualStats({ ...credentials, month: 8, year: 2026, kelas: "A3" });
  assert.deepEqual(Array.from(result.students, (item) => item.student_name), ["Cara", "Ali", "Bakar"]);
  assert.deepEqual(Array.from(result.students, (item) => item.total_outings), [3, 2, 2]);
  assert.equal(result.students[1].total_duration_minutes, 90);
  assert.equal(result.students[1].total_duration, "1 jam 30 minit");
  assert.equal(result.students[2].total_duration_minutes, 3240);
  assert.equal(result.students[2].total_duration, "2 hari 6 jam");
});

test("admin individual statistics return an empty collection for an empty selected scope", () => {
  const context = createContext([]);
  const result = context.getAdminIndividualStats({
    admin_id: "ADMIN1", nama_admin: "Admin Satu", pin: "2468", month: 8, year: 2026, kelas: "A3"
  });
  assert.deepEqual(Array.from(result.students), []);
});

test("duration formatter keeps incomplete movement at zero and formats accumulated units", () => {
  const context = createContext([]);
  assert.equal(context.calculateOutingDurationMinutes_({ masa_keluar: "", masa_masuk: "2026-08-01 10:00:00" }), 0);
  assert.equal(context.calculateOutingDurationMinutes_({ masa_keluar: "2026-08-01 11:00:00", masa_masuk: "2026-08-01 10:00:00" }), 0);
  assert.equal(context.formatOutingDuration_(45), "45 minit");
  assert.equal(context.formatOutingDuration_(1105), "18 jam 25 minit");
  assert.equal(context.formatOutingDuration_(4572), "3 hari 4 jam 12 minit");
});

test("public aggregate GET remains anonymous while individual data uses authenticated POST", () => {
  const doGetStart = gasSource.indexOf("function doGet(e)");
  const doPostStart = gasSource.indexOf("function doPost(e)");
  const doGetSource = gasSource.slice(doGetStart, doPostStart);
  const doPostEnd = gasSource.indexOf("function setupAdminOutingConfigV200", doPostStart);
  const doPostSource = gasSource.slice(doPostStart, doPostEnd);
  assert.match(doGetSource, /getOutingStats/);
  assert.doesNotMatch(doGetSource, /getAdminIndividualStats|getStudentAnnualSummary/);
  assert.match(doPostSource, /getAdminIndividualStats|getStudentAnnualSummary/);
  assert.match(gasSource, /function getAdminIndividualStats\(payload\)\s*{\s*validateAdminCredentials_\(payload\)/);
  assert.match(gasSource, /function getStudentAnnualSummary\(payload\)[\s\S]*findActiveStudent_/);
});

test("frontend exposes a compact self summary and Admin-only individual statistics state", () => {
  assert.match(indexSource, /id="studentAnnualSummary"/);
  assert.match(indexSource, /id="adminStatisticsButton"/);
  assert.match(appSource, /apiPost\("getStudentAnnualSummary"/);
  assert.match(appSource, /apiPost\("getAdminIndividualStats"/);
  assert.match(appSource, /Log masuk sebagai Admin untuk melihat statistik individu pelajar/);
  assert.match(appSource, /Tiada rekod SELESAI bagi bulan, tahun dan kelas yang dipilih/);
});

test("clasp upload scope whitelists only the canonical source and manifest", () => {
  assert.equal(claspIgnore.replace(/\r/g, ""), "**/**\n!appsscript.json\n!Code.gs\n");
  assert.match(gasSource, /const SPREADSHEET_ID = "1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg";/);
  assert.doesNotMatch(claspIgnore, /Code\.production-v171\.gs/);
});
