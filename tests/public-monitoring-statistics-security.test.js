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

function createFrontendRecordContext(currentSession, overrides = {}) {
  const calls = { get: 0, post: 0, notices: [] };
  const context = vm.createContext({
    currentSession,
    isLiveMode: true,
    outingRecords: [],
    studentLastUpdatedAt: null,
    els: { monitorWorkspace: null },
    apiGet: async () => {
      calls.get += 1;
      return [{ kelas: "A2", status: "KELUAR" }];
    },
    apiPost: async (_action, payload) => {
      calls.post += 1;
      calls.payload = plain(payload);
      return [{ request_id: "OUT-001", nama: "PELAJAR SULIT" }];
    },
    mapLiveRecord: (record) => ({ ...record, mappedAs: "operational" }),
    mapPublicMonitoringRecord: (record) => ({ ...record, mappedAs: "public" }),
    render: () => {},
    renderMonitoring: () => {},
    updateStudentLastUpdated: () => {},
    showModeNotice: (message) => calls.notices.push(message),
    ...overrides
  });
  const loadStart = appSource.indexOf("async function loadTodayRecords");
  const loadEnd = appSource.indexOf("\nasync function apiPost(", loadStart);
  assert.notEqual(loadStart, -1, "loadTodayRecords must exist");
  assert.notEqual(loadEnd, -1, "loadTodayRecords boundary must exist");
  vm.runInContext([
    appSource.slice(loadStart, loadEnd),
    extractFunction(appSource, "buildTodayRecordsAccessPayload", "refreshSystemCaches")
  ].join("\n"), context);
  return { calls, context };
}

test("public getTodayRecords returns only the approved named monitoring fields", () => {
  const context = createGasContext();
  const records = plain(context.getTodayRecords());

  assert.deepEqual(records, [
    {
      nama: "PELAJAR SULIT",
      kelas: "A2",
      jenis_permohonan: "KECEMASAN",
      status: "KELUAR",
      lewat: "Tidak",
      belum_masuk: true
    },
    {
      nama: "PELAJAR KEDUA",
      kelas: "A3",
      jenis_permohonan: "OUTING_BIASA",
      status: "MENUNGGU_KELULUSAN",
      lewat: "Tidak",
      belum_masuk: false
    }
  ]);
  records.forEach((record) => {
    assert.deepEqual(Object.keys(record).sort(), [
      "belum_masuk", "jenis_permohonan", "kelas", "lewat", "nama", "status"
    ]);
  });
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
  assert.equal(wardenRecords[0].nama, "PELAJAR SULIT");

  const guardRecords = plain(context.getOperationalTodayRecords({
    role: "guard",
    nama_guard: "GUARD TEST",
    pin: "5678"
  }));
  assert.equal(guardRecords.length, 2);
  assert.equal(guardRecords[0].request_id, "OUT-001");
  assert.equal(guardRecords[0].nama, "PELAJAR SULIT");
});

test("real student, warden and guard runtime sessions build valid POST credentials", () => {
  const cases = [
    {
      session: { role: "student", user: { id: "S001", student_id: "S001", no_matrik: "0825-0001" } },
      expected: { role: "student", student_id: "S001", no_matrik: "0825-0001" }
    },
    {
      session: { role: "warden", user: { name: "WARDEN TEST", pin: "1234" } },
      expected: { role: "warden", nama_warden: "WARDEN TEST", pin: "1234" }
    },
    {
      session: { role: "guard", user: { name: "GUARD TEST", pin: "5678" } },
      expected: { role: "guard", nama_guard: "GUARD TEST", pin: "5678" }
    }
  ];

  cases.forEach(({ session, expected }) => {
    const { context } = createFrontendRecordContext(session);
    assert.deepEqual(plain(context.buildTodayRecordsAccessPayload()), expected);
  });
});

test("fresh staff login responses without PIN retain the entered PIN in runtime credentials", () => {
  const context = vm.createContext({ currentSession: null });
  vm.runInContext([
    extractFunction(appSource, "mapLiveStaffSessionUser", "mapLiveRecord"),
    extractFunction(appSource, "buildTodayRecordsAccessPayload", "refreshSystemCaches")
  ].join("\n"), context);

  const wardenUser = plain(context.mapLiveStaffSessionUser(
    "warden",
    { nama_warden: "WARDEN TEST", email: "warden@example.test", no_tel: "0111111111" },
    "WARDEN INPUT",
    "1234"
  ));
  assert.equal(wardenUser.pin, "1234");
  assert.equal(wardenUser.nama_warden, "WARDEN TEST");
  context.currentSession = { role: "warden", user: wardenUser };
  assert.deepEqual(plain(context.buildTodayRecordsAccessPayload()), {
    role: "warden",
    nama_warden: "WARDEN TEST",
    pin: "1234"
  });

  const guardUser = plain(context.mapLiveStaffSessionUser(
    "guard",
    { nama_guard: "GUARD TEST", email: "guard@example.test", no_tel: "0122222222" },
    "GUARD INPUT",
    "5678"
  ));
  assert.equal(guardUser.pin, "5678");
  assert.equal(guardUser.nama_guard, "GUARD TEST");
  context.currentSession = { role: "guard", user: guardUser };
  assert.deepEqual(plain(context.buildTodayRecordsAccessPayload()), {
    role: "guard",
    nama_guard: "GUARD TEST",
    pin: "5678"
  });
});

test("staff runtime credentials are reused by remember-device storage and restore", () => {
  let storedSession = null;
  const context = vm.createContext({
    SESSION_DURATION_MS: { warden: 1000, guard: 1000 },
    localStorage: {
      setItem: (_key, value) => { storedSession = JSON.parse(value); }
    },
    SESSION_STORAGE_KEY: "test_session",
    console
  });
  vm.runInContext(extractFunction(appSource, "saveSession", "getSavedSession"), context);

  context.saveSession("warden", { name: "WARDEN TEST", nama_warden: "WARDEN TEST", pin: "1234" });
  assert.equal(storedSession.nama_warden, "WARDEN TEST");
  assert.equal(storedSession.pin, "1234");

  context.saveSession("guard", { name: "GUARD TEST", nama_guard: "GUARD TEST", pin: "5678" });
  assert.equal(storedSession.nama_guard, "GUARD TEST");
  assert.equal(storedSession.pin, "5678");

  const restoreFunction = extractFunction(appSource, "restoreSavedSession", "findStudentForSavedSession");
  assert.match(restoreFunction, /nama_warden:\s*wardenName[\s\S]*pin:\s*session\.pin/);
  assert.match(restoreFunction, /nama_guard:\s*guardName[\s\S]*pin:\s*session\.pin/);
});

test("authenticated records use POST and retain operational names without undefined values", async () => {
  for (const session of [
    { role: "student", user: { student_id: "S001", no_matrik: "0825-0001" } },
    { role: "warden", user: { name: "WARDEN TEST", pin: "1234" } },
    { role: "guard", user: { name: "GUARD TEST", pin: "5678" } }
  ]) {
    const { calls, context } = createFrontendRecordContext(session);
    await context.loadTodayRecords();
    assert.equal(calls.post, 1);
    assert.equal(calls.get, 0);
    assert.equal(context.outingRecords[0].nama, "PELAJAR SULIT");
    assert.equal(Object.values(context.outingRecords[0]).includes(undefined), false);
  }
});

test("authenticated session with missing credentials errors without public GET fallback", async () => {
  const { calls, context } = createFrontendRecordContext({ role: "warden" });

  assert.throws(() => context.buildTodayRecordsAccessPayload(), /sesi|credential|akses/i);
  await context.loadTodayRecords();

  assert.equal(calls.get, 0);
  assert.equal(calls.post, 0);
  assert.deepEqual(plain(context.outingRecords), []);
  assert.equal(calls.notices.length, 1);
});

test("authenticated session clears anonymous records before its first render", () => {
  for (const role of ["student", "warden", "guard"]) {
    let renderedRecords = null;
    const context = vm.createContext({
      currentSession: null,
      isLiveMode: true,
      outingRecords: [{ kelas: "A2", mappedAs: "public" }],
      wardenHasLoadedOnce: true,
      els: {
        monitorWorkspace: { classList: { remove: () => {} } },
        accessScreen: { classList: { add: () => {} } },
        appWorkspace: { classList: { add: () => {} } },
        sessionRole: { textContent: "" },
        sessionName: { textContent: "" }
      },
      clearStaffLoginSuccessFeedback: () => {},
      stopStudentAutoRefresh: () => {},
      stopGuardAutoRefresh: () => {},
      stopMonitoringAutoRefresh: () => {},
      roleLabel: (value) => value,
      applyRoleView: () => {},
      render: () => { renderedRecords = plain(context.outingRecords); },
      refreshStudentLiveRecords: () => {},
      startStudentAutoRefresh: () => {},
      refreshGuardRecords: () => {},
      startGuardAutoRefresh: () => {}
    });
    vm.runInContext(extractFunction(appSource, "startSession", "applyRoleView"), context);

    context.startSession(role, { name: "TEST", pin: "1234", student_id: "S001", no_matrik: "M001" });

    assert.deepEqual(renderedRecords, [], `${role} must not render anonymous records`);
    assert.deepEqual(plain(context.outingRecords), []);
    assert.equal(context.wardenHasLoadedOnce, false);
  }
});

test("full operational records map real names and never emit undefined fields", () => {
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
    extractFunction(appSource, "mapLiveRecord", "mapPublicMonitoringRecord"),
    extractFunction(appSource, "mapLiveStatus", "parseDateValue"),
    extractFunction(appSource, "parseDateValue", "setMockMode")
  ].join("\n"), context);

  const mapped = plain(context.mapLiveRecord(requestRows[0]));
  assert.equal(mapped.studentName, "PELAJAR SULIT");
  assert.equal(mapped.nama, "PELAJAR SULIT");
  assert.equal(mapped.request_id, "OUT-001");
  assert.equal(Object.values(mapped).includes(undefined), false);
});

test("GET routing is public-minimum while POST routing is credentialed operational access", () => {
  const getRoute = gasSource.match(/if \(action === "getTodayRecords"\)[^\n]+/)[0];
  const postStart = gasSource.indexOf("function doPost");
  const postEnd = gasSource.indexOf("\nfunction setupDatabase", postStart);
  const postRouter = gasSource.slice(postStart, postEnd);

  assert.match(getRoute, /getTodayRecords\(\)/);
  assert.doesNotMatch(getRoute, /getOperationalTodayRecords/);
  assert.match(postRouter, /getOperationalTodayRecords\(payload\)/);
  assert.doesNotMatch(postRouter, /jsonResponse\(getTodayRecords\(\)\)/);
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

test("frontend retains the approved public name without retaining extra PII", () => {
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
    student_id: "MUST-NOT-SURVIVE",
    no_tel: "MUST-NOT-SURVIVE",
    lokasi: "MUST-NOT-SURVIVE",
    tujuan: "MUST-NOT-SURVIVE",
    telefon_waris: "MUST-NOT-SURVIVE",
    request_id: "MUST-NOT-SURVIVE",
    nama: "NAMA DIBENARKAN"
  }));
  assert.deepEqual(mapped, {
    nama: "NAMA DIBENARKAN",
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
  assert.equal(context.publicMonitorStudentLabel({ kelas: "A2", nama: "NAMA PELAJAR" }), "NAMA PELAJAR");
  assert.equal(context.publicMonitorStudentLabel({ kelas: "A2" }), "Pelajar");
  assert.match(labelFunction, /record\.nama/);
  assert.doesNotMatch(labelFunction, /record\.(no_matrik|student_id|no_tel|telefon_waris|lokasi|tujuan)/);
  assert.match(setupPanel, /monitorRefreshButton/);
  assert.match(setupPanel, /Memuatkan rekod pemantauan/);
  assert.match(setupPanel, /Paparan read-only\. Hanya nama, kelas dan status semasa dipaparkan\./);
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

test("record status display uses one contextual mapping with late precedence", () => {
  const context = vm.createContext({
    STATUS: {
      pending: "Menunggu Kelulusan",
      approved: "Diluluskan Warden",
      rejected: "Ditolak Warden",
      out: "Sedang Keluar",
      returned: "Sudah Pulang"
    },
    REQUEST_TYPE: {
      normal: "OUTING_BIASA",
      emergency: "KECEMASAN",
      overnight: "PULANG_BERMALAM",
      semester: "CUTI_SEMESTER"
    },
    isHostelReturnLateV160: () => false
  });
  vm.runInContext([
    extractFunction(appSource, "getContextualStatusDisplay", "getWardenChecklistCopyStatusIcon"),
    extractFunction(appSource, "getWardenChecklistCopyStatusIcon", "getWardenChecklistCopyHeader"),
    extractFunction(appSource, "isSemesterChecklistLate", "initApp")
  ].join("\n"), context);

  assert.deepEqual(plain(context.getContextualStatusDisplay({
    status: "Sedang Keluar",
    jenis_permohonan: "CUTI_SEMESTER"
  })), { key: "out", icon: "🏖️", label: "Sedang Bercuti" });
  assert.deepEqual(plain(context.getContextualStatusDisplay({
    status: "Sedang Keluar",
    jenis_permohonan: "PULANG_BERMALAM"
  })), { key: "out", icon: "🌙", label: "Sedang Bermalam" });
  for (const requestType of ["OUTING_BIASA", "KECEMASAN"]) {
    assert.deepEqual(plain(context.getContextualStatusDisplay({
      status: "Sedang Keluar",
      jenis_permohonan: requestType
    })), { key: "out", icon: "🚶", label: "Sedang Keluar" });
  }
  assert.deepEqual(plain(context.getContextualStatusDisplay({
    status: "Sedang Keluar",
    jenis_permohonan: "CUTI_SEMESTER",
    lewat: "Ya"
  })), { key: "late", icon: "🔴", label: "Lewat" });
  assert.deepEqual(plain(context.getContextualStatusDisplay({ status: "Sudah Pulang" })), {
    key: "returned", icon: "✅", label: "Sudah Pulang"
  });
  assert.deepEqual(plain(context.getContextualStatusDisplay({ status: "Diluluskan Warden" })), {
    key: "approved", icon: "🟢", label: "Diluluskan"
  });
  assert.deepEqual(plain(context.getContextualStatusDisplay({ status: "Menunggu Kelulusan" })), {
    key: "pending", icon: "🟡", label: "Menunggu Kelulusan"
  });
  assert.deepEqual(plain(context.getContextualStatusDisplay({ status: "Ditolak Warden" })), {
    key: "rejected", icon: "•", label: "Ditolak"
  });

  const iconRenderer = extractFunction(appSource, "getWardenChecklistCopyStatusIcon", "getWardenChecklistCopyHeader");
  const statusRenderer = extractFunction(appSource, "semesterChecklistStatus", "isSemesterChecklistLate");
  const cardRenderer = extractFunction(appSource, "recordCard", "recordDataAttributes");
  assert.match(iconRenderer, /getContextualStatusDisplay\(record\)/);
  assert.match(statusRenderer, /getContextualStatusDisplay\(record\)/);
  assert.match(cardRenderer, /getContextualStatusDisplay\(record\)/);
  const checklistItem = extractFunction(appSource, "semesterChecklistItem", "requestChecklistDateTime", true);
  assert.match(checklistItem, /getWardenChecklistCopyStatusIcon\(record\)/);
});

test("Public Monitoring release references version 1.6.25", () => {
  assert.match(appSource, /const APP_VERSION = "1\.6\.25"/);
  assert.match(fs.readFileSync(path.join(root, "service-worker.js"), "utf8"), /eouting-cache-v1\.6\.25/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8")).version, "1.6.25");
});
