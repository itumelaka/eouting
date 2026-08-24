const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(source, name) {
  const start = source.lastIndexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function presenceContext() {
  const context = vm.createContext({
    STATUS: { out: "KELUAR" },
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    isActive_: (status) => String(status || "").trim().toLowerCase() === "aktif",
    now_: () => "2026-08-22 12:00:00"
  });
  [
    "parseDateForSort_",
    "isRecordForStudent_",
    "currentHostelRequestTimestamp_",
    "currentHostelRequestIdentityKey_",
    "isLaterCurrentHostelRequestCandidate_",
    "buildLatestCurrentHostelRequestMap_",
    "selectAuthoritativeCurrentRequestForStudent_",
    "buildCurrentHostelPresenceFromRows_",
    "toPublicCurrentHostelSummary_",
    "toAuthenticatedCurrentHostelRoster_"
  ].forEach((name) => vm.runInContext(extractFunction(gasSource, name), context));
  return context;
}

function student(id, group, extra = {}) {
  return { student_id: id, no_matrik: `M-${id}`, nama: `Nama ${id}`, kelas: group, status: "AKTIF", ...extra };
}

function request(id, status, requestedAt, extra = {}) {
  return { request_id: `R-${id}-${requestedAt}`, student_id: id, no_matrik: `M-${id}`, status, masa_mohon: requestedAt, ...extra };
}

function fixture() {
  const students = [
    student("S1", "A2"),
    student("S2", "A2"),
    student("S3", "A2"),
    student("S4", "A2"),
    student("S5", "A3"),
    student("S6", "A3"),
    student("S7", "A3"),
    student("S8", "A3", { status: "TIDAK AKTIF" }),
    student("S9", "A3"),
    student("S10", "LI", { institution_code: "IMU", nama: "Zara LI" }),
    student("S11", "A4", { nama: "Aina A4" })
  ];
  const requests = [
    request("S2", "MENUNGGU_KELULUSAN", "2026-08-22 08:00:00"),
    request("S3", "DILULUSKAN_WARDEN", "2026-08-22 08:05:00"),
    request("S4", "KELUAR", "2026-08-22 08:10:00"),
    request("S5", "SELESAI", "2026-08-22 08:15:00"),
    request("S6", "DITOLAK_WARDEN", "2026-08-22 08:20:00"),
    request("S7", "DIBATALKAN_PELAJAR", "2026-08-22 08:25:00"),
    request("S8", "KELUAR", "2026-08-22 08:30:00"),
    request("S9", "KELUAR", "2026-07-01 08:00:00"),
    request("S9", "SELESAI", "2026-08-01 08:00:00")
  ];
  const groups = [
    { key: "GROUP:A2", label: "A2", students: students.filter((item) => item.kelas === "A2").map(({ student_id, nama }) => ({ student_id, nama })) },
    { key: "GROUP:A3", label: "A3", students: students.filter((item) => item.kelas === "A3" && item.status === "AKTIF").map(({ student_id, nama }) => ({ student_id, nama })) },
    { key: "GROUP:A4", label: "A4", students: [{ student_id: "S11", nama: "Aina A4" }] },
    { key: "GROUP:LI:IMU", label: "LI IMU", students: [{ student_id: "S10", nama: "Zara LI" }] }
  ];
  return { students, requests, directory: { mode: "dynamic", groups } };
}

test("presence semantics keep every lifecycle except authoritative KELUAR in hostel", () => {
  const context = presenceContext();
  const { students, requests, directory } = fixture();
  const presence = context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "now");
  assert.equal(presence.total_active_students, 10);
  assert.equal(presence.total_out_now, 1);
  assert.equal(presence.total_in_hostel, 9);
  assert.equal(presence.total_in_hostel + presence.total_out_now, presence.total_active_students);
  const rosterNames = presence.groups.flatMap((group) => group.students.map((item) => item.nama));
  for (const id of ["S1", "S2", "S3", "S5", "S6", "S7", "S9"]) assert.ok(rosterNames.includes(`Nama ${id}`), id);
  assert.equal(rosterNames.includes("Nama S4"), false);
  assert.equal(rosterNames.includes("Nama S8"), false);
});

test("latest authoritative lifecycle wins over a historical KELUAR snapshot", () => {
  const context = presenceContext();
  const { students, requests } = fixture();
  const latestRequestByStudent = context.buildLatestCurrentHostelRequestMap_(requests);
  const current = context.selectAuthoritativeCurrentRequestForStudent_(students.find((item) => item.student_id === "S9"), latestRequestByStudent);
  assert.equal(current.status, "SELESAI");
});

test("Guard checkout and completed return change derived counts without persisted presence state", () => {
  const context = presenceContext();
  const { students, requests, directory } = fixture();
  const checkout = context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "checkout");
  const returnedRequests = requests.map((row) => row.student_id === "S4" ? { ...row, status: "SELESAI" } : row);
  const returned = context.buildCurrentHostelPresenceFromRows_(students, returnedRequests, directory, "return");
  assert.equal(checkout.total_out_now, 1);
  assert.equal(returned.total_out_now, 0);
  assert.equal(returned.total_in_hostel, checkout.total_in_hostel + 1);
  const schemaSource = gasSource.slice(gasSource.indexOf("const HEADERS"), gasSource.indexOf("const STATUS"));
  assert.doesNotMatch(schemaSource, /["']IN_HOSTEL["']|["']in_hostel["']/);
});

test("dynamic configured A4 and LI IMU groups work without runtime prefix inference", () => {
  const context = presenceContext();
  const { students, requests, directory } = fixture();
  const presence = context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "now");
  assert.equal(presence.groups.find((group) => group.label === "A4").count, 1);
  assert.equal(presence.groups.find((group) => group.label === "LI IMU").count, 1);
  const builder = extractFunction(gasSource, "buildDynamicStudentLoginDirectoryV240_");
  assert.match(builder, /student\.institution_code/);
  assert.doesNotMatch(builder, /student_id[\s\S]{0,120}(startsWith|substring|slice|split)|LIUMK|LIUPM/);
  assert.doesNotMatch(extractFunction(gasSource, "buildCurrentHostelPresenceFromRows_"), /institution_code|LIUMK|LIUPM|startsWith/);
});

test("public summary is aggregate-only and satisfies the active population equation", () => {
  const context = presenceContext();
  const { students, requests, directory } = fixture();
  const publicSummary = context.toPublicCurrentHostelSummary_(
    context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "now")
  );
  assert.deepEqual(Object.keys(publicSummary).sort(), ["generated_at", "hostel_groups", "total_active_students", "total_in_hostel", "total_out_now"]);
  assert.equal(publicSummary.total_in_hostel + publicSummary.total_out_now, publicSummary.total_active_students);
  const serialized = JSON.stringify(publicSummary);
  assert.doesNotMatch(serialized, /Nama S|Zara LI|Aina A4|"(?:nama|student_id|no_matrik|email|phone|no_tel|institution_code|students)"\s*:/);
  publicSummary.hostel_groups.forEach((group) => assert.deepEqual(Object.keys(group).sort(), ["count", "key", "label"]));
});

test("authenticated roster projects only names and sorts them alphabetically within configured groups", () => {
  const context = presenceContext();
  const { students, requests, directory } = fixture();
  students.push(student("S12", "A4", { nama: "Zulaikha A4" }));
  directory.groups.find((group) => group.label === "A4").students.push({ student_id: "S12", nama: "Zulaikha A4" });
  const roster = context.toAuthenticatedCurrentHostelRoster_(context.buildCurrentHostelPresenceFromRows_(students, requests, directory, "now"));
  const a4 = roster.groups.find((group) => group.label === "A4");
  assert.deepEqual(Array.from(a4.students, (item) => item.nama), ["Aina A4", "Zulaikha A4"]);
  roster.groups.flatMap((group) => group.students).forEach((item) => assert.deepEqual(Object.keys(item), ["nama"]));
  assert.doesNotMatch(JSON.stringify(roster), /student_id|no_matrik|email|phone|no_tel|institution_code|guardian|photo|catatan/);
});

test("roster authentication allows Admin, Warden or HEP, and Guard only", () => {
  const context = vm.createContext({
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    validateAdminCredentials_: (data) => data.pin === "admin" ? {} : (() => { throw new Error("bad admin"); })(),
    findActiveWarden_: (name, pin) => pin === "warden" && ["warden", "hep"].includes(String(name).toLowerCase()) ? {} : null,
    findActiveGuard_: (name, pin) => pin === "guard" && name === "Guard" ? {} : null
  });
  vm.runInContext(extractFunction(gasSource, "validateCurrentHostelRosterViewer_"), context);
  assert.equal(context.validateCurrentHostelRosterViewer_({ role: "admin", pin: "admin" }), "admin");
  assert.equal(context.validateCurrentHostelRosterViewer_({ role: "warden", name: "Warden", pin: "warden" }), "warden");
  assert.equal(context.validateCurrentHostelRosterViewer_({ role: "warden", name: "HEP", pin: "warden" }), "warden");
  assert.equal(context.validateCurrentHostelRosterViewer_({ role: "guard", name: "Guard", pin: "guard" }), "guard");
  assert.throws(() => context.validateCurrentHostelRosterViewer_({}), /Akses staff/);
  assert.throws(() => context.validateCurrentHostelRosterViewer_({ role: "student" }), /Akses staff/);
});

test("public and authenticated endpoints are routed across separate GET and POST boundaries", () => {
  const doGet = extractFunction(gasSource, "doGet");
  const doPost = extractFunction(gasSource, "doPost");
  assert.match(doGet, /getCurrentHostelSummary/);
  assert.doesNotMatch(doGet, /getCurrentHostelRoster/);
  assert.match(doPost, /getCurrentHostelRoster/);
  assert.doesNotMatch(doPost, /getCurrentHostelSummary/);
  assert.match(extractFunction(gasSource, "getCurrentHostelRoster"), /validateCurrentHostelRosterViewer_\(payload\)/);
});

test("public UI remains aggregate-only while Warden and Admin retain authenticated rosters", () => {
  assert.match(extractFunction(appSource, "loadPublicCurrentHostelSummaryV240"), /apiGet\("getCurrentHostelSummary"\)/);
  assert.doesNotMatch(extractFunction(appSource, "refreshMonitoringRecords"), /getCurrentHostelRoster/);
  assert.match(extractFunction(appSource, "buildCurrentHostelRosterAccessPayloadV240"), /buildAdminCredentialPayloadV200|buildTodayRecordsAccessPayload/);
  assert.match(htmlSource, /id="publicCurrentHostelKpis"/);
  assert.match(htmlSource, /id="wardenCurrentHostelRoster"/);
  assert.doesNotMatch(htmlSource, /id="guardCurrentHostelRoster"/);
  assert.match(htmlSource, /id="adminCurrentHostelRoster"/);
});

test("presence refresh remains for public, Warden and Admin but is removed from Guard", () => {
  assert.match(extractFunction(appSource, "refreshMonitoringRecords"), /loadPublicCurrentHostelSummaryV240/);
  assert.doesNotMatch(extractFunction(appSource, "refreshGuardRecords"), /getCurrentHostelRoster/);
  assert.match(extractFunction(appSource, "loadWardenRecordsOnly"), /getCurrentHostelRoster/);
  assert.match(extractFunction(appSource, "loadAdminMonitoringV210"), /getCurrentHostelRoster/);
  assert.match(extractFunction(appSource, "loadTodayRecords"), /getCurrentHostelRoster/);
  assert.match(extractFunction(appSource, "loadTodayRecords"), /currentSession\.role === "warden"/);
  assert.doesNotMatch(extractFunction(appSource, "renderGuard"), /renderStaffCurrentHostelRosterV240/);
});

test("resident UI remains compact and expandable without exposing private identity fields", () => {
  const renderer = extractFunction(appSource, "currentHostelRosterHtmlV240");
  assert.match(renderer, /<details class="current-hostel-group-roster">/);
  assert.match(renderer, /student\.nama/);
  assert.doesNotMatch(renderer, /student_id|no_matrik|email|phone|institution_code|photo|guardian|catatan/);
  assert.match(htmlSource, /Anggaran semasa berdasarkan rekod keluar\/masuk eOuting\./);
});

test("existing protected feature boundaries remain present and unchanged in authority", () => {
  for (const functionName of ["confirmOut", "confirmIn", "confirmWardenRemoteCheckout", "getGuardianContact", "submitRequest"]) {
    assert.notEqual(gasSource.indexOf(`function ${functionName}(`), -1, functionName);
  }
  assert.match(gasSource, /function isActiveRequestStatus_\([\s\S]*STATUS\.pending[\s\S]*STATUS\.approved[\s\S]*STATUS\.out/);
  assert.match(appSource, /function updateStudentRequestSectionVisibility\([\s\S]*isActiveStudentRecord/);
  assert.doesNotMatch(extractFunction(gasSource, "buildCurrentHostelPresenceFromRows_"), /append|setValue|setValues|updateRow|PropertiesService|sendTelegram|Telegram/);
});
