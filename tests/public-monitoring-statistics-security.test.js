const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

const requestRows = [
  {
    request_id: "OUT-001",
    tarikh: "2026-07-13",
    hari: "Isnin",
    jenis_permohonan: "KECEMASAN",
    student_id: "S001",
    no_matrik: "0825-0001",
    nama: "PELAJAR SULIT",
    student_email: "student@example.test",
    kelas: "A2",
    tujuan: "Rawatan peribadi",
    lokasi: "Alamat klinik terperinci",
    jenis_kenderaan: "Kereta keluarga",
    butiran_kenderaan: "ABC1234",
    sebab_kecemasan: "Butiran kesihatan sulit",
    telefon_waris: "0199999999",
    hubungan_waris: "Ibu",
    catatan_kecemasan: "Catatan sulit",
    masa_mohon: "2026-07-13 08:00:00",
    status: "KELUAR",
    warden_approve_by: "WARDEN DALAMAN",
    masa_approve: "2026-07-13 08:10:00",
    masa_keluar: "2026-07-13 08:20:00",
    guard_keluar_by: "GUARD DALAMAN",
    masa_masuk: "",
    guard_masuk_by: "",
    lewat: "Tidak",
    selfie_whatsapp: "https://example.test/private-selfie",
    catatan: "Catatan operasi",
    tarikh_balik: "2026-07-13",
    hari_balik: "Isnin",
    masa_balik_dijangka: "22:00"
  },
  {
    request_id: "OUT-002",
    tarikh: "2026-07-13",
    jenis_permohonan: "OUTING_BIASA",
    student_id: "S002",
    no_matrik: "0825-0002",
    nama: "PELAJAR KEDUA",
    kelas: "A3",
    masa_mohon: "2026-07-13 09:00:00",
    status: "MENUNGGU_KELULUSAN",
    lewat: "Tidak"
  }
];

const studentRows = [
  { student_id: "S001", no_matrik: "0825-0001", nama: "PELAJAR SULIT", status: "Aktif" },
  { student_id: "S002", no_matrik: "0825-0002", nama: "PELAJAR KEDUA", status: "Aktif" }
];

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractFunction(source, name, nextName, useLast = false) {
  const markers = [`function ${name}`, `async function ${name}`];
  let start = -1;
  markers.forEach((marker) => {
    const index = useLast ? source.lastIndexOf(marker) : source.indexOf(marker);
    if (index > start) start = index;
  });
  let end = source.indexOf(`\nfunction ${nextName}`, start);
  if (end === -1) end = source.indexOf(`\nasync function ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return source.slice(start, end);
}

function createGasContext() {
  const context = vm.createContext({ console });
  vm.runInContext(gasSource, context);
  context.Utilities = {
    formatDate: (_date, _zone, format) => {
      if (format === "M") return "7";
      if (format === "yyyy") return "2026";
      if (format === "yyyy-MM-dd") return "2026-07-13";
      if (format === "yyyy-MM-dd HH:mm:ss") return "2026-07-13 12:00:00";
      return "2026-07-13";
    }
  };
  context.getSheet_ = (name) => ({ name });
  context.getRowsAsObjects_ = (sheet) => {
    if (sheet.name === "STUDENTS") return studentRows.map((row) => ({ ...row }));
    if (sheet.name === "WARDENS") return [{ nama_warden: "WARDEN TEST", pin: "1234", status: "Aktif" }];
    if (sheet.name === "GUARDS") return [{ nama_guard: "GUARD TEST", pin: "5678", status: "Aktif" }];
    if (sheet.name === "OUTING_REQUESTS") return requestRows.map((row) => ({ ...row }));
    return [];
  };
  return context;
}

test("public getTodayRecords returns only non-identifying monitoring fields", () => {
  const context = createGasContext();
  const records = plain(context.getTodayRecords());

  assert.deepEqual(records, [
    {
      kelas: "A2",
      jenis_permohonan: "KECEMASAN",
      status: "KELUAR",
      lewat: "Tidak",
      belum_masuk: true
    },
    {
      kelas: "A3",
      jenis_permohonan: "OUTING_BIASA",
      status: "MENUNGGU_KELULUSAN",
      lewat: "Tidak",
      belum_masuk: false
    }
  ]);
});

test("operational today records require existing credentials and students receive only their records", () => {
  const context = createGasContext();
  assert.equal(typeof context.getOperationalTodayRecords, "function");
  assert.throws(() => context.getOperationalTodayRecords({}), /akses|sesi|role/i);

  const studentRecords = plain(context.getOperationalTodayRecords({
    role: "student",
    student_id: "S001",
    no_matrik: "0825-0001"
  }));
  assert.equal(studentRecords.length, 1);
  assert.equal(studentRecords[0].request_id, "OUT-001");
  assert.equal(studentRecords[0].no_matrik, "0825-0001");

  const wardenRecords = plain(context.getOperationalTodayRecords({
    role: "warden",
    nama_warden: "WARDEN TEST",
    pin: "1234"
  }));
  assert.equal(wardenRecords.length, 2);
});

test("GET routing is public-minimum while POST routing is credentialed operational access", () => {
  const getRoute = gasSource.match(/if \(action === "getTodayRecords"\)[^\n]+/)[0];
  const postStart = gasSource.indexOf("function doPost");
  const postEnd = gasSource.indexOf("\nfunction setupDatabase", postStart);
  const postRouter = gasSource.slice(postStart, postEnd);

  assert.match(getRoute, /getTodayRecords\(\)/);
  assert.match(postRouter, /getOperationalTodayRecords\(payload\)/);
});

test("getOutingStats returns aggregate structures only", () => {
  const context = createGasContext();
  const stats = plain(context.getOutingStats({ month: 7, year: 2026 }));

  assert.deepEqual(Object.keys(stats).sort(), [
    "class_summary",
    "generated_at",
    "month",
    "status_summary",
    "totals",
    "year"
  ]);
  const serialized = JSON.stringify(stats);
  ["leaderboard", "student_id", "no_matrik", "nama", "last_request_at", "OUT-001"].forEach((field) => {
    assert.equal(serialized.includes(field), false, `statistics must not expose ${field}`);
  });
});

test("frontend maps a public monitoring response without retaining extra PII", () => {
  const context = vm.createContext({
    REQUEST_TYPE: { normal: "OUTING_BIASA" },
    STATUS: {
      pending: "Menunggu Kelulusan",
      approved: "Diluluskan Warden",
      rejected: "Ditolak Warden",
      out: "Sedang Keluar",
      returned: "Sudah Pulang"
    }
  });
  vm.runInContext([
    extractFunction(appSource, "mapLiveStatus", "parseDateValue"),
    extractFunction(appSource, "mapPublicMonitoringRecord", "mapLiveStatus")
  ].join("\n"), context);

  const mapped = plain(context.mapPublicMonitoringRecord({
    kelas: "A2",
    jenis_permohonan: "KECEMASAN",
    status: "KELUAR",
    lewat: "Tidak",
    belum_masuk: true,
    no_matrik: "MUST-NOT-SURVIVE",
    nama: "MUST-NOT-SURVIVE"
  }));
  assert.deepEqual(mapped, {
    className: "A2",
    kelas: "A2",
    jenis_permohonan: "KECEMASAN",
    rawStatus: "KELUAR",
    status: "Sedang Keluar",
    lewat: false,
    lewatText: "Tidak",
    belum_masuk: true
  });
});

test("monitoring renders safe labels and keeps loading, refresh and error fallback", () => {
  const labelFunction = extractFunction(appSource, "publicMonitorStudentLabel", "renderMonitorNameListV1613");
  const refreshFunction = extractFunction(appSource, "refreshMonitoringRecords", "setMonitorLoadingState", true);
  const setupPanel = extractFunction(appSource, "setupMonitoringPanel", "setupStatisticsPanel");

  const context = vm.createContext({});
  vm.runInContext(labelFunction, context);
  assert.equal(context.publicMonitorStudentLabel({ kelas: "A2", nama: "NAMA SULIT" }), "Pelajar A2");
  assert.doesNotMatch(labelFunction, /record\.(nama|name|studentName)/);
  assert.match(setupPanel, /monitorRefreshButton/);
  assert.match(setupPanel, /Memuatkan rekod pemantauan/);
  assert.match(refreshFunction, /setMonitorLoadingState\(true/);
  assert.match(refreshFunction, /Rekod pemantauan gagal dimuat/);
  assert.match(refreshFunction, /finally/);
});

test("statistics UI no longer consumes or renders individual leaderboard data", () => {
  const setupStart = appSource.indexOf("function setupStatisticsPanel");
  const setupEnd = appSource.indexOf("\nels.studentLoginPanel.addEventListener", setupStart);
  assert.notEqual(setupStart, -1, "setupStatisticsPanel must exist");
  assert.notEqual(setupEnd, -1, "setupStatisticsPanel boundary must exist");
  const setupStats = appSource.slice(setupStart, setupEnd);
  const renderStats = extractFunction(appSource, "renderStatistics", "classSummaryCard");

  assert.doesNotMatch(setupStats, /Juara Outing|Ranking berdasarkan/);
  assert.doesNotMatch(renderStats, /stats\.leaderboard|leaderboardCard/);
  assert.match(renderStats, /Data individu tidak dipaparkan/);
});

test("sensitive record objects are not printed to console", () => {
  const debugFunction = extractFunction(appSource, "debugStudentRecords", "isRecordForStudent");

  assert.doesNotMatch(debugFunction, /console\.debug\([^;]*(currentStudent|outingRecords|studentRecords)/s);
  assert.doesNotMatch(appSource, /console\.(?:warn|error|debug)\([^;]*no_matrik/s);
  assert.doesNotMatch(appSource, /console\.(?:warn|error|debug)\([^;]*\bstudent\s*,?\s*error/s);
});

test("Phase 2 release references version 1.6.21", () => {
  assert.match(appSource, /const APP_VERSION = "1\.6\.21"/);
  assert.match(fs.readFileSync(path.join(root, "service-worker.js"), "utf8"), /eouting-cache-v1\.6\.21/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version, "1.6.21");
});
