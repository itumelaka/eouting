const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { webcrypto } = require("node:crypto");
const source = fs.readFileSync(path.join(__dirname, "../proxy/staging-worker-base.js"), "utf8");
const origin = "https://itumelaka.github.io";
const upstream = "https://script.google.com/macros/s/TEST_DEPLOYMENT/exec";
const destination = "https://script.googleusercontent.com/macros/echo?user_content_key=SECRET&lib=TEST";

function individualStatsFixture(rows = [], authenticated = true) {
  const queries = [];
  const statement = (sql, values = []) => ({
    bind(...args) { return statement(sql, args); },
    async first() {
      queries.push({ sql, values });
      assert.match(sql, /FROM ADMIN_USERS/);
      assert.match(sql, /LOWER\(status\) = 'aktif'/);
      return authenticated ? { admin_id: "ADMIN-TEST" } : null;
    },
    async all() {
      queries.push({ sql, values });
      assert.match(sql, /FROM OUTING_REQUESTS/);
      assert.match(sql, /WHERE status = 'SELESAI'/);
      return { results: rows.filter(row => row.status === "SELESAI") };
    }
  });
  const rt = runtime(() => { throw new Error("Statistics must not call GAS"); });
  return { ...rt, queries, run: (payload = {}, method = "POST") => rt.run(req(method, {
    url: "https://proxy.test/api/d1/getAdminIndividualStats",
    headers: { Origin: "http://localhost:8000" },
    body: JSON.stringify({ admin_id: "ADMIN-TEST", pin: "TEST_PIN", ...payload })
  }), { STAGING_ORIGIN: "http://localhost:8000", DB: { prepare: sql => statement(sql) } }) };
}

test("individual stats: D1-only grouping, date fallback, class filter and count/name sorting preserve response", async () => {
  const base = { status: "SELESAI", tarikh: "2026-08-01", kelas: "A3" };
  const f = individualStatsFixture([
    { ...base, student_id: "S1", nama: "Zara" },
    { ...base, student_id: " S1 ", nama: "New name" },
    { ...base, no_matrik: "M2", nama: "bakar", kelas: " a3 " },
    { ...base, nama: "Ali", tarikh: "invalid", masa_mohon: "2026-08-31T23:30:00Z" },
    { ...base, student_id: "S4", nama: "Other month", tarikh: "2026-07-31", masa_mohon: "2026-08-01" },
    { ...base, student_id: "S5", nama: "Other year", tarikh: "2025-08-01" },
    { ...base, student_id: "S6", nama: "Other class", kelas: "A4" },
    { ...base, student_id: "S7", nama: "Not completed", status: "KELUAR" },
    { ...base, student_id: "S8", nama: "No date", tarikh: "bad" },
    { ...base }
  ]);
  const response = await f.run({ month: "8", year: "2026", kelas: " a3 " });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(Object.keys(body.data).sort(), ["generated_at", "kelas", "month", "students", "year"]);
  assert.equal(body.data.month, 8);
  assert.equal(body.data.year, 2026);
  assert.equal(body.data.kelas, " a3 ");
  assert.match(body.data.generated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.deepEqual(body.data.students, [
    { student_name: "Zara", kelas: "A3", total_outings: 2, total_duration_minutes: 0, total_duration: "0 minit" },
    { student_name: "Ali", kelas: "A3", total_outings: 1, total_duration_minutes: 0, total_duration: "0 minit" },
    { student_name: "bakar", kelas: "a3", total_outings: 1, total_duration_minutes: 0, total_duration: "0 minit" }
  ]);
  assert.equal(f.calls.length, 0);
});

test("individual stats: durations use explicit Malaysia semantics and GAS day/hour/minute formatting", async () => {
  const cases = [
    ["Offset", "2026-08-01T08:00:00+08:00", "2026-08-01T00:45:59Z", 45, "45 minit"],
    ["Local", "2026-08-01 08:00:00", "2026-08-02 02:25:00", 1105, "18 jam 25 minit"],
    ["Mixed", "2026-08-01 08:00:00", "2026-08-04T04:12:00Z", 4572, "3 hari 4 jam 12 minit"],
    ["Day", "2026-08-01 08:00:00", "2026-08-02 08:00:00", 1440, "1 hari"],
    ["Missing", "", "2026-08-01 08:00:00", 0, "0 minit"],
    ["Invalid", "invalid", "2026-08-01 08:00:00", 0, "0 minit"],
    ["Reversed", "2026-08-01 09:00:00", "2026-08-01 08:00:00", 0, "0 minit"],
    ["Equal", "2026-08-01 08:00:00", "2026-08-01T00:00:00Z", 0, "0 minit"]
  ];
  const f = individualStatsFixture(cases.map(([nama, masa_keluar, masa_masuk]) => ({
    nama, masa_keluar, masa_masuk, status: "SELESAI", tarikh: "2026-08-01"
  })));
  const response = await f.run({ month: 8, year: 2026 });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  for (const [name, , , minutes, formatted] of cases) {
    const student = data.students.find(row => row.student_name === name);
    assert.equal(student.total_duration_minutes, minutes, name);
    assert.equal(student.total_duration, formatted, name);
    assert.equal(student.kelas, "Tidak Dinyatakan");
  }
  assert.equal(f.calls.length, 0);
});

test("individual stats: duration sums per student and unnamed students have safe defaults", async () => {
  const base = { student_id: "S1", status: "SELESAI", tarikh: "2026-08-01", masa_keluar: "2026-08-01 08:00:00", masa_masuk: "2026-08-01 08:30:00" };
  const f = individualStatsFixture([base, { ...base }]);
  assert.deepEqual((await (await f.run({ month: 8, year: 2026 })).json()).data.students, [{
    student_name: "Tidak Dinyatakan", kelas: "Tidak Dinyatakan", total_outings: 2,
    total_duration_minutes: 60, total_duration: "1 jam"
  }]);
  assert.equal(f.calls.length, 0);
});

test("individual stats: omitted month/year default to Malaysia now and empty scope is an empty array", async () => {
  const f = individualStatsFixture();
  const before = new Date();
  const response = await f.run();
  assert.equal(response.status, 200);
  const { data } = await response.json();
  const keys = [before, new Date()].map(date => new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date));
  assert.ok(keys.some(key => key.startsWith(`${data.year}-${String(data.month).padStart(2, "0")}`)));
  assert.ok(keys.some(key => data.generated_at.startsWith(key)));
  assert.equal(data.kelas, "");
  assert.deepEqual(data.students, []);
  assert.equal(f.calls.length, 0);
});

test("individual stats: invalid month/year return 400 before reading requests", async () => {
  for (const invalid of [{ month: 0 }, { month: 13 }, { month: 1.5 }, { month: "bad" }, { year: 1999 }, { year: 2026.5 }, { year: "bad" }]) {
    const f = individualStatsFixture();
    const response = await f.run({ month: 8, year: 2026, ...invalid });
    assert.equal(response.status, 400, JSON.stringify(invalid));
    assert.equal((await response.json()).error, "Bulan atau tahun statistik tidak sah.");
    assert.equal(f.queries.length, 1);
    assert.equal(f.calls.length, 0);
  }
});

test("individual stats: admin name aliases and invalid auth follow the monitoring contract", async () => {
  for (const alias of ["nama_admin", "admin_name", "name"]) {
    const f = individualStatsFixture();
    assert.equal((await f.run({ [alias]: " Test Admin ", pin: " TEST_PIN " })).status, 200);
    assert.deepEqual(f.queries[0].values, ["ADMIN-TEST", "Test Admin", "TEST_PIN"]);
    assert.equal(f.calls.length, 0);
  }
  const f = individualStatsFixture([], false);
  const response = await f.run();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "ADMIN_SESSION_INVALID");
  assert.equal(f.queries.length, 1);
  assert.equal(f.calls.length, 0);
});

test("individual stats: OPTIONS supported and GET rejected without DB or GAS access", async () => {
  const f = individualStatsFixture();
  const options = await f.run({}, "OPTIONS");
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal((await f.run({}, "GET")).status, 405);
  assert.equal(f.queries.length, 0);
  assert.equal(f.calls.length, 0);
});

function masterRecordsFixture(rows = [], options = {}) {
  const queries = [];
  const statement = (sql, values = []) => ({
    bind(...args) { return statement(sql, args); },
    async first() {
      queries.push({ sql, values });
      assert.match(sql, /FROM ADMIN_USERS/);
      assert.match(sql, /LOWER\(status\) = 'aktif'/);
      return options.authenticated === false ? null : { admin_id: "ADMIN-TEST" };
    },
    async all() {
      queries.push({ sql, values });
      if (sql.includes("FROM OUTING_REQUESTS")) return { results: rows };
      if (sql.includes("FROM WARDENS")) return { results: options.wardens || [] };
      throw new Error("Unexpected D1 query");
    }
  });
  const rt = runtime(() => { throw new Error("Master search must not call GAS"); });
  const run = (payload = {}, method = "POST", rawBody) => rt.run(req(method, {
    url: "https://proxy.test/api/d1/searchAdminMasterRecords",
    headers: { Origin: "http://localhost:8000" },
    body: rawBody ?? JSON.stringify({ admin_id: "ADMIN-TEST", pin: "TEST_PIN", ...payload })
  }), { STAGING_ORIGIN: "http://localhost:8000", DB: { prepare: sql => statement(sql) } });
  return { ...rt, run, queries };
}

test("master search: admin authentication, name aliases and no GAS call", async () => {
  for (const alias of ["nama_admin", "admin_name", "name"]) {
    const f = masterRecordsFixture();
    assert.equal((await f.run({ admin_id: "", [alias]: " Test Admin ", pin: " TEST_PIN " })).status, 200);
    assert.deepEqual(f.queries[0].values, ["", "Test Admin", "TEST_PIN"]);
    assert.match(f.queries[1].sql, /FROM OUTING_REQUESTS/);
    assert.match(f.queries[2].sql, /FROM WARDENS/);
    assert.equal(f.calls.length, 0);
  }
  const invalid = masterRecordsFixture([], { authenticated: false });
  const response = await invalid.run();
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "ADMIN_SESSION_INVALID");
  assert.equal(invalid.queries.length, 1);
  assert.equal(invalid.calls.length, 0);
});

test("master search: partial search fields, exact filters and newest-first pagination", async () => {
  const rows = [
    { request_id: "REQ-OLD", nama: "Ali Rahman", no_matrik: "M-001", student_id: "S-001",
      kelas: "A1", jenis_permohonan: "KECEMASAN", status: "SELESAI",
      tarikh: "2026-08-01", masa_mohon: "2026-08-01 08:00:00" },
    { request_id: "REQ-NEW", nama: "Ali Zaid", no_matrik: "M-002", student_id: "S-002",
      kelas: "a1", jenis_permohonan: "kecemasan", status: "selesai",
      tarikh: "2026-08-02", masa_mohon: "2026-08-02 08:00:00" },
    { request_id: "REQ-OTHER", nama: "Bakar", kelas: "A2",
      jenis_permohonan: "OUTING_BIASA", status: "KELUAR", masa_mohon: "2026-08-03 08:00:00" }
  ];
  const f = masterRecordsFixture(rows);
  const filters = { search: "aLi", kelas: " A1 ", request_type: "KeCeMaSaN", status: "SeLeSaI" };
  const first = (await (await f.run({ ...filters, page_size: 1 })).json()).data;
  assert.match(first.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  assert.deepEqual([first.page, first.page_size, first.total, first.total_pages], [1, 1, 2, 2]);
  assert.equal(first.records[0].request_id, "REQ-NEW");
  const second = (await (await f.run({ ...filters, page: 2, page_size: 1 })).json()).data;
  assert.equal(second.records[0].request_id, "REQ-OLD");
  for (const [field, value, expected] of [
    ["query", "m-002", "REQ-NEW"], ["search", "s-001", "REQ-OLD"],
    ["search", "req-other", "REQ-OTHER"]
  ]) {
    const data = (await (await f.run({ [field]: value })).json()).data;
    assert.deepEqual(data.records.map(row => row.request_id), [expected]);
  }
  assert.equal(f.calls.length, 0);
});

test("master search: optional month/year, Malaysia date fallback, empty results and page cap", async () => {
  const rows = [
    { request_id: "DATE-PRIMARY", tarikh: "2026-08-31", masa_mohon: "2026-09-01T01:00:00+08:00" },
    { request_id: "DATE-FALLBACK", tarikh: "bad", masa_mohon: "2026-08-31T18:30:00Z" },
    { request_id: "DATE-SEPT", tarikh: "2026-09-01" },
    ...Array.from({ length: 55 }, (_, i) => ({
      request_id: `BULK-${i}`, tarikh: "2025-01-01", masa_mohon: `2025-01-01 00:${String(i).padStart(2, "0")}:00`
    }))
  ];
  const f = masterRecordsFixture(rows);
  const august = (await (await f.run({ month: "8", year: 2026 })).json()).data;
  assert.deepEqual(august.records.map(row => row.request_id), ["DATE-FALLBACK", "DATE-PRIMARY"]);
  assert.equal((await (await f.run({ month: 9 })).json()).data.total, 1);
  assert.equal((await (await f.run({ year: 2025 })).json()).data.total, 55);
  const all = (await (await f.run({ month: "", year: "", page_size: 999 })).json()).data;
  assert.equal(all.total, 58);
  assert.equal(all.page_size, 50);
  assert.equal(all.total_pages, 2);
  const last = (await (await f.run({ page: 2, page_size: 50 })).json()).data;
  assert.equal(last.records.length, 8);
  const empty = (await (await f.run({ search: "missing", page: 0, page_size: 0 })).json()).data;
  assert.deepEqual([empty.page, empty.page_size, empty.total, empty.total_pages], [1, 50, 0, 1]);
  assert.deepEqual(empty.records, []);
  assert.equal(f.calls.length, 0);
});

test("master search: operational projection matches monitoring duration, role and urgency shape", async () => {
  const f = masterRecordsFixture([{
    request_id: "REQ-1", student_id: "S1", no_matrik: "M1", nama: "Ali", kelas: "A1",
    jenis_permohonan: "OUTING_BIASA", status: "KELUAR", tarikh: "2020-01-01",
    masa_mohon: "2020-01-01 08:00:00", masa_keluar: "2020-01-01 08:00:00",
    masa_masuk: "2020-01-01 09:30:00", warden_approve_by: " Cik HEP ",
    masa_balik_dijangka: "21:30:00", tujuan: "Lawatan", lokasi: "Melaka"
  }], { wardens: [{ warden_id: "HEP-1", nama: "Cik HEP" }] });
  const row = (await (await f.run()).json()).data.records[0];
  assert.deepEqual(Object.keys(row).sort(), [
    "request_id", "student_id", "no_matrik", "nama", "kelas", "jenis_permohonan",
    "status", "tarikh", "masa_mohon", "masa_keluar", "masa_masuk", "tarikh_balik",
    "masa_balik_dijangka", "expected_return_at", "lewat", "tujuan", "lokasi",
    "jenis_kenderaan", "butiran_kenderaan", "warden_approve_by", "warden_approve_role",
    "masa_approve", "guard_keluar_by", "guard_masuk_by", "sebab_batal_pelajar",
    "masa_batal_pelajar", "dibatalkan_oleh", "duration_minutes", "duration",
    "operational_urgency"
  ].sort());
  assert.equal(row.duration_minutes, 90);
  assert.equal(row.duration, "1 jam 30 minit");
  assert.equal(row.warden_approve_role, "HEP");
  assert.equal(row.masa_balik_dijangka, "21:30");
  assert.equal(row.operational_urgency.state, "ACTION_REQUIRED");
  assert.equal(row.operational_urgency.next_action_code, "ACTION_REQUIRED");
  assert.equal(row.lewat, true);
  assert.equal(f.calls.length, 0);
});

test("master search: duration treats local timestamps as Malaysia time and preserves explicit offsets", async () => {
  const cases = [
    ["Local to UTC", "2026-08-01 08:00:00", "2026-08-01T00:45:59Z", 45, "45 minit"],
    ["UTC to local", "2026-08-01T00:00:00Z", "2026-08-01T09:15:00", 75, "1 jam 15 minit"],
    ["Explicit offset", "2026-08-01T08:00:00+08:00", "2026-08-01T01:30:00+00:00", 90, "1 jam 30 minit"],
    ["Missing", "", "2026-08-01 08:00:00", 0, ""],
    ["Invalid", "invalid", "2026-08-01T00:30:00Z", 0, ""],
    ["Reversed", "2026-08-01 09:00:00", "2026-08-01T00:30:00Z", 0, ""],
    ["Equal", "2026-08-01 08:00:00", "2026-08-01T00:00:00Z", 0, ""]
  ];
  const f = masterRecordsFixture(cases.map(([request_id, masa_keluar, masa_masuk]) => ({
    request_id, masa_keluar, masa_masuk
  })));
  const response = await f.run();
  assert.equal(response.status, 200);
  const { records } = (await response.json()).data;
  for (const [id, , , minutes, duration] of cases) {
    const row = records.find(record => record.request_id === id);
    assert.equal(row.duration_minutes, minutes, id);
    assert.equal(row.duration, duration, id);
  }
  assert.equal(f.calls.length, 0);
});

test("master search: bad periods and JSON return 400; OPTIONS and GET avoid D1 and GAS", async () => {
  for (const invalid of [
    { month: 0 }, { month: 13 }, { month: 1.5 }, { month: "bad" },
    { year: 1999 }, { year: 2201 }, { year: 2026.5 }, { year: "bad" }
  ]) {
    const f = masterRecordsFixture();
    const response = await f.run(invalid);
    assert.equal(response.status, 400, JSON.stringify(invalid));
    assert.equal((await response.json()).code, "INVALID_REQUEST");
    assert.equal(f.queries.length, 1);
    assert.equal(f.calls.length, 0);
  }
  for (const body of ["{", "null", "[]", "42", "\"text\""]) {
    const f = masterRecordsFixture();
    const response = await f.run({}, "POST", body);
    assert.equal(response.status, 400, body);
    assert.equal((await response.json()).code, "INVALID_REQUEST");
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 0);
  }
  const f = masterRecordsFixture();
  const options = await f.run({}, "OPTIONS");
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  const get = await f.run({}, "GET");
  assert.equal(get.status, 405);
  assert.equal((await get.json()).code, "METHOD_NOT_ALLOWED");
  assert.equal(f.queries.length, 0);
  assert.equal(f.calls.length, 0);
});

function announcementFixture(options = {}) {
  const values = new Map(Object.entries(options.config || {}));
  const queries = [], batches = [], audits = [];
  const statement = (sql, bindings = []) => ({
    sql, bindings,
    bind(...args) { return statement(sql, args); },
    async first() {
      queries.push({ sql, bindings });
      const table = ["ADMIN_USERS", "STUDENTS", "WARDENS", "GUARDS"]
        .find(name => sql.includes(`FROM ${name}`));
      assert.ok(table, "Unexpected authentication query");
      assert.match(sql, /LOWER\(status\) = 'aktif'/);
      return options.invalidRole === table ? null
        : table === "ADMIN_USERS" ? { admin_id: "ADM-1", nama_admin: "Admin Test" }
        : { id: "ACTIVE" };
    },
    async all() {
      queries.push({ sql, bindings });
      assert.match(sql, /FROM SYSTEM_CONFIG/);
      assert.equal(bindings.length, 5);
      return { results: [...values].map(([config_key, config_value]) => ({ config_key, config_value })) };
    }
  });
  const DB = {
    prepare: sql => statement(sql),
    async batch(statements) {
      batches.push(statements);
      assert.equal(statements.length, 6);
      for (const item of statements) {
        if (item.sql.includes("INSERT INTO SYSTEM_CONFIG")) {
          const [key, value, timestamp, actor] = item.bindings;
          assert.match(key, /^ANNOUNCEMENT_BANNER_/);
          assert.equal(timestamp, statements[0].bindings[2]);
          assert.equal(actor, statements[0].bindings[3]);
          values.set(key, value);
        } else {
          assert.match(item.sql, /INSERT INTO AUDIT_LOG/);
          audits.push(item.bindings);
        }
      }
    }
  };
  const rt = runtime(() => { throw new Error("Announcement routes must not call GAS"); });
  const run = (action, payload = {}, method = "POST", rawBody) => rt.run(req(method, {
    url: `https://proxy.test/api/d1/${action}`,
    headers: { Origin: "http://localhost:8000" },
    body: rawBody ?? JSON.stringify(payload)
  }), { STAGING_ORIGIN: "http://localhost:8000", DB });
  return { ...rt, run, values, queries, batches, audits };
}

const announcementAdmin = { admin_id: "ADM-1", pin: "2468" };
const announcementUpdate = { ...announcementAdmin, text: "Makluman operasi", active: true, important: false };

test("announcement D1: admin defaults and update use one timestamp, identity and bounded audit", async () => {
  const f = announcementFixture();
  const initial = await f.run("getAnnouncementBannerAdmin", announcementAdmin);
  assert.equal(initial.status, 200);
  assert.deepEqual((await initial.json()).data, {
    text: "", active: false, important: false, updated_at: "", updated_by: ""
  });
  const saved = await f.run("updateAnnouncementBanner", {
    ...announcementUpdate, text: `  ${"x".repeat(200)}  `, important: true
  });
  assert.equal(saved.status, 200);
  const config = (await saved.json()).data;
  assert.equal(config.text, "x".repeat(200));
  assert.equal(config.active, true);
  assert.equal(config.important, true);
  assert.match(config.updated_at, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.equal(config.updated_by, "ADM-1");
  assert.equal(f.values.get("ANNOUNCEMENT_BANNER_ACTIVE"), "true");
  assert.equal(f.values.get("ANNOUNCEMENT_BANNER_IMPORTANT"), "true");
  assert.equal(f.values.get("ANNOUNCEMENT_BANNER_TEXT"), "x".repeat(200));
  assert.equal(f.values.get("ANNOUNCEMENT_BANNER_UPDATED_AT"), config.updated_at);
  assert.equal(f.values.get("ANNOUNCEMENT_BANNER_UPDATED_BY"), config.updated_by);
  const audit = f.audits[0];
  assert.deepEqual(audit.slice(0, 5), [
    config.updated_at, "UPDATE_ANNOUNCEMENT_BANNER", "", "Admin", "ADM-1"
  ]);
  assert.deepEqual(audit.slice(6), ["SYSTEM_CONFIG", "ANNOUNCEMENT_BANNER"]);
  assert.deepEqual(JSON.parse(audit[5]), {
    active: true, important: true, text_summary: "x".repeat(120)
  });
  assert.doesNotMatch(JSON.stringify(f.batches), /2468/);
  const reread = await f.run("getAnnouncementBannerAdmin", announcementAdmin);
  assert.deepEqual((await reread.json()).data, config);
  assert.equal(f.calls.length, 0);
});

test("announcement D1: update validates exact booleans, active text and maximum length", async () => {
  for (const [override, message] of [
    [{ active: "true" }, /boolean/],
    [{ important: "false" }, /boolean/],
    [{ active: null }, /boolean/],
    [{ important: 1 }, /boolean/],
    [{ text: "   " }, /Teks pengumuman diperlukan/],
    [{ text: "x".repeat(501) }, /500 aksara/]
  ]) {
    const f = announcementFixture();
    const response = await f.run("updateAnnouncementBanner", { ...announcementUpdate, ...override });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.code, "INVALID_REQUEST");
    assert.match(body.error, message);
    assert.equal(f.batches.length, 0);
    assert.equal(f.calls.length, 0);
  }
  const f = announcementFixture();
  const saved = await f.run("updateAnnouncementBanner", {
    ...announcementUpdate, text: "", active: false
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).data.active, false);
});

test("announcement D1: all authenticated roles receive only the safe viewer projection", async () => {
  const f = announcementFixture();
  await f.run("updateAnnouncementBanner", { ...announcementUpdate, important: true });
  for (const [role, credentials, table] of [
    ["student", { student_id: "S-1", no_matrik: "M-1" }, "STUDENTS"],
    ["warden", { nama_warden: "Warden Test", pin: "1357" }, "WARDENS"],
    ["guard", { nama_guard: "Guard Test", pin: "9753" }, "GUARDS"],
    ["admin", announcementAdmin, "ADMIN_USERS"]
  ]) {
    const response = await f.run("getAnnouncementBanner", { role, ...credentials });
    assert.equal(response.status, 200, role);
    const data = (await response.json()).data;
    assert.deepEqual(data, {
      active: true, important: true, text: "Makluman operasi",
      updated_at: f.values.get("ANNOUNCEMENT_BANNER_UPDATED_AT")
    });
    assert.ok(f.queries.some(query => query.sql.includes(`FROM ${table}`)));
    assert.doesNotMatch(JSON.stringify(data), /updated_by|ANNOUNCEMENT_BANNER_|2468|1357|9753/);
  }
  assert.equal(f.calls.length, 0);
});

test("announcement D1: inactive or blank banner is hidden and invalid sessions are rejected", async () => {
  const f = announcementFixture({ config: {
    ANNOUNCEMENT_BANNER_ACTIVE: "true", ANNOUNCEMENT_BANNER_TEXT: " "
  } });
  const viewer = { role: "student", student_id: "S-1", no_matrik: "M-1" };
  assert.deepEqual((await (await f.run("getAnnouncementBanner", viewer)).json()).data, { active: false });
  f.values.set("ANNOUNCEMENT_BANNER_TEXT", "Hidden");
  f.values.set("ANNOUNCEMENT_BANNER_ACTIVE", "false");
  assert.deepEqual((await (await f.run("getAnnouncementBanner", viewer)).json()).data, { active: false });
  for (const role of ["STUDENTS", "WARDENS", "GUARDS", "ADMIN_USERS"]) {
    const invalid = announcementFixture({ invalidRole: role });
    const credentials = role === "STUDENTS" ? viewer
      : role === "WARDENS" ? { role: "warden", nama_warden: "Warden Test", pin: "1357" }
      : role === "GUARDS" ? { role: "guard", nama_guard: "Guard Test", pin: "9753" }
      : { role: "admin", ...announcementAdmin };
    const response = await invalid.run("getAnnouncementBanner", credentials);
    assert.equal(response.status, 401);
    assert.equal(invalid.calls.length, 0);
  }
  assert.equal((await f.run("getAnnouncementBanner", {})).status, 401);
  assert.equal((await f.run("getAnnouncementBanner", { role: "student" })).status, 401);
  assert.equal(f.calls.length, 0);
});

test("announcement D1: admin routes reject other roles; method and JSON errors avoid D1 and GAS", async () => {
  for (const action of ["getAnnouncementBannerAdmin", "updateAnnouncementBanner"]) {
    const invalid = announcementFixture({ invalidRole: "ADMIN_USERS" });
    const response = await invalid.run(action, {
      role: "student", student_id: "S-1", no_matrik: "M-1", ...announcementUpdate
    });
    assert.equal(response.status, 401);
    assert.equal(invalid.batches.length, 0);
    assert.equal(invalid.calls.length, 0);
  }
  for (const action of ["getAnnouncementBannerAdmin", "updateAnnouncementBanner", "getAnnouncementBanner"]) {
    const f = announcementFixture();
    const options = await f.run(action, {}, "OPTIONS");
    assert.equal(options.status, 204);
    assert.equal(options.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    const get = await f.run(action, {}, "GET");
    assert.equal(get.status, 405);
    assert.equal((await get.json()).code, "METHOD_NOT_ALLOWED");
    for (const raw of ["{", "null", "[]"]) {
      const response = await f.run(action, {}, "POST", raw);
      assert.equal(response.status, 400);
      assert.equal((await response.json()).code, "INVALID_REQUEST");
    }
    assert.equal(f.queries.length, 0);
    assert.equal(f.calls.length, 0);
  }
});

function hostelSummaryFixture(options = {}) {
  const queries = [];
  const students = options.students || [
    { student_id: "S1", no_matrik: "M1", nama: "Private Alpha", kelas: "A1", status: "Aktif" },
    { student_id: "S2", no_matrik: "M2", nama: "Private Bravo", kelas: "A1", status: "Aktif" },
    { student_id: "S3", no_matrik: "M3", nama: "Private Charlie", kelas: "LI", institution_code: "IA", status: "Aktif" },
    { student_id: "S4", no_matrik: "M4", nama: "Private Delta", kelas: "LI", institution_code: "IB", status: "Aktif" },
    { student_id: "S5", no_matrik: "M5", nama: "Private Echo", kelas: "LI", institution_code: "UNKNOWN", status: "Aktif" },
    { student_id: "S6", no_matrik: "M6", nama: "Private Foxtrot", kelas: "A9", status: "Aktif" },
    { student_id: "S7", no_matrik: "M7", nama: "Private Inactive", kelas: "A1", status: "Tidak Aktif" }
  ];
  const requests = options.requests || [
    { source_rowid: 1, student_id: "S2", no_matrik: "M2", masa_mohon: "2026-09-24 09:00:00", status: "KELUAR" },
    { source_rowid: 2, student_id: "S2", no_matrik: "M2", masa_mohon: "2026-09-24 08:00:00", status: "SELESAI" },
    { source_rowid: 3, student_id: "S3", no_matrik: "M3", masa_mohon: "2026-09-24 09:00:00", status: "KELUAR" },
    { source_rowid: 4, student_id: "S3", no_matrik: "M3", masa_mohon: "2026-09-24 09:00:00", status: "SELESAI" }
  ];
  const groups = options.groups || [
    { group_code: "A1", display_name: "Asrama A1", institution_required: 0 },
    { group_code: "LI", display_name: "LI", institution_required: 1 }
  ];
  const institutions = options.institutions || [
    { institution_code: "IA", display_name: "Institusi A" },
    { institution_code: "IB", display_name: "Institusi B" }
  ];
  const statement = (sql, bindings = []) => ({
    bind(...args) { return statement(sql, args); },
    async first() {
      queries.push({ sql, bindings });
      assert.match(sql, /FROM ADMIN_USERS/);
      return { admin_id: "ADM-1" };
    },
    async all() {
      queries.push({ sql, bindings });
      if (sql.includes("FROM STUDENTS")) return { results: students.filter(row => row.status === "Aktif") };
      if (sql.includes("FROM OUTING_REQUESTS")) return { results: requests };
      if (sql.includes("FROM STUDENT_GROUPS")) return { results: groups };
      if (sql.includes("FROM LI_INSTITUTIONS")) return { results: institutions };
      throw new Error("Unexpected D1 query");
    }
  });
  const rt = runtime(() => { throw new Error("Hostel summary must not call GAS"); });
  const run = (action = "getCurrentHostelSummary", method = "GET", payload) => rt.run(req(method, {
    url: `https://proxy.test/api/d1/${action}`,
    headers: { Origin: "http://localhost:8000" },
    ...(payload ? { body: JSON.stringify(payload) } : {})
  }), { STAGING_ORIGIN: "http://localhost:8000", DB: { prepare: sql => statement(sql) } });
  return { ...rt, run, queries };
}

test("hostel summary: public totals, configured institution split and unconfigured fallback match roster", async () => {
  const f = hostelSummaryFixture();
  const response = await f.run();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(Object.keys(body.data).sort(), [
    "generated_at", "total_active_students", "total_out_now", "total_in_hostel", "hostel_groups"
  ].sort());
  assert.match(body.data.generated_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+08:00$/);
  assert.deepEqual([
    body.data.total_active_students, body.data.total_out_now, body.data.total_in_hostel
  ], [6, 1, 5]);
  assert.deepEqual(body.data.hostel_groups, [
    { key: "resident-group-1", label: "Asrama A1", count: 1 },
    { key: "resident-group-2", label: "LI Institusi A", count: 1 },
    { key: "resident-group-3", label: "LI Institusi B", count: 1 },
    { key: "resident-group-unconfigured", label: "Belum Dikonfigurasi", count: 2 }
  ]);
  const serialized = JSON.stringify(body);
  assert.doesNotMatch(serialized, /Private|"student_id"|"no_matrik"|"students"\s*:|"nama"\s*:|"S[1-7]"|"M[1-7]"/);
  assert.ok(body.data.hostel_groups.every(group =>
    Object.keys(group).sort().join(",") === "count,key,label"));
  const roster = (await (await f.run("getCurrentHostelRoster", "POST", {
    role: "admin", admin_id: "ADM-1", pin: "2468"
  })).json()).data;
  assert.equal(roster.total, body.data.total_in_hostel);
  assert.deepEqual(roster.groups.map(({ key, label, count }) => ({ key, label, count })),
    body.data.hostel_groups);
  assert.equal(f.calls.length, 0);
});

test("hostel summary: latest request uses student ID, matric and rowid tie break", async () => {
  const f = hostelSummaryFixture({
    students: [{ student_id: "SID", no_matrik: "MAT", nama: "Secret", kelas: "A1", status: "Aktif" }],
    requests: [
      { source_rowid: 1, student_id: "SID", no_matrik: "MAT", masa_mohon: "2026-09-24 08:00:00", status: "KELUAR" },
      { source_rowid: 2, student_id: "SID", masa_mohon: "2026-09-24 09:00:00", status: "SELESAI" },
      { source_rowid: 3, no_matrik: "MAT", masa_mohon: "2026-09-24 09:00:00", status: "KELUAR" }
    ]
  });
  const data = (await (await f.run()).json()).data;
  assert.equal(data.total_active_students, 1);
  assert.equal(data.total_out_now, 1);
  assert.equal(data.total_in_hostel, 0);
  assert.deepEqual(data.hostel_groups, [{ key: "resident-group-1", label: "Asrama A1", count: 0 }]);
  assert.equal(f.calls.length, 0);
});

test("hostel summary: GET is public, OPTIONS allows GET, and POST is rejected before D1", async () => {
  const f = hostelSummaryFixture();
  const options = await f.run("getCurrentHostelSummary", "OPTIONS");
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Methods"), "GET, OPTIONS");
  const post = await f.run("getCurrentHostelSummary", "POST", { role: "admin" });
  assert.equal(post.status, 405);
  assert.equal((await post.json()).code, "METHOD_NOT_ALLOWED");
  assert.equal((await f.run("getCurrentHostelRoster", "GET")).status, 405);
  assert.equal((await f.run("getCurrentHostelRoster", "POST", { role: "student" })).status, 401);
  assert.equal(f.queries.length, 0);
  assert.equal((await f.run()).status, 200);
  assert.equal(f.queries.filter(query => /FROM ADMIN_USERS/.test(query.sql)).length, 0);
  assert.equal(f.calls.length, 0);
});

function profilePhotoFixture(options = {}) {
  const student = { student_id: "STU-001", no_matrik: "M001", nama: "Test Student",
    status: "Aktif", photo_file_id: "", photo_updated_at: "", ...options.student };
  const queries = [], batches = [], events = [];
  const statement = (sql, values = []) => ({
    sql, values,
    bind(...args) { return statement(sql, args); },
    async first() {
      queries.push({ sql, values });
      if (options.invalidAuth) return null;
      if (sql.includes("FROM STUDENTS")) return student;
      if (/FROM (WARDENS|GUARDS)/.test(sql)) return { warden_id: "W-TEST", guard_id: "G-TEST" };
      if (sql.includes("FROM ADMIN_USERS")) return { admin_id: "ADMIN-TEST", nama_admin: "Test Admin" };
      throw new Error("Unexpected query");
    },
    async all() {
      queries.push({ sql, values });
      if (sql.includes("FROM OUTING_REQUESTS")) return { results: options.records || [] };
      if (sql.includes("FROM STUDENTS")) return { results: options.photos || [] };
      throw new Error("Unexpected query");
    }
  });
  const DB = { prepare: sql => statement(sql), async batch(statements) {
    events.push("sync"); batches.push(statements);
    if (options.syncThrows) throw new Error("PRIVATE_FILE YQ== GAS_MANAGED:PROFILE_PHOTO");
    return [{ success: true, meta: { changes: options.changes ?? 1 } },
      { success: true, meta: { changes: options.changes ?? 1 } }];
  } };
  const rt = runtime((url, init, count) => {
    events.push("GAS");
    if (options.fetch) return options.fetch(url, init, count);
    return json(JSON.stringify(options.upstream || { ok: true, data: {
      student_id: "STU-001", has_profile_photo: true, photo_updated_at: "2026-09-23 13:00:00",
      photo_file_id: "PRIVATE_FILE"
    } }));
  });
  const run = (action, payload, method = "POST") => rt.run(req(method, {
    url: `https://proxy.test/api/d1/${action}`, headers: { Origin: "http://localhost:8000" },
    body: JSON.stringify(payload)
  }), { STAGING_ORIGIN: "http://localhost:8000", DB });
  return { ...rt, run, queries, batches, events };
}

const profileStudent = { student_id: "STU-001", no_matrik: "M001" };
const profileUpload = { ...profileStudent, mime_type: "image/jpeg", image_base64: "YQ==" };
const profileAdmin = { admin_id: "ADMIN-TEST", nama_admin: "Test Admin", pin: "TEST_PIN" };

test("profile photos: student cannot fetch another student's photo", async () => {
  const f = profilePhotoFixture();
  const response = await f.run("getStudentProfilePhotos", {
    ...profileStudent, role: "student", student_ids: ["STU-OTHER"]
  });
  assert.equal(response.status, 403);
  assert.equal(f.calls.length, 0);
  assert.match(f.queries[0].sql, /student_id = \? AND no_matrik = \? AND status = 'Aktif'/);
  assert.deepEqual(f.queries[0].values, ["STU-001", "M001"]);
});

for (const role of ["warden", "guard"]) {
  test(`profile photos: ${role} cannot fetch outside current operational scope`, async () => {
    const f = profilePhotoFixture({ records: [{ student_id: "STU-OTHER", status: "SELESAI",
      tarikh: "2000-01-01", jenis_permohonan: "OUTING_BIASA" }] });
    const response = await f.run("getStudentProfilePhotos", {
      role, name: "Test Staff", pin: "TEST_PIN", student_ids: ["STU-OTHER"]
    });
    assert.equal(response.status, 403);
    assert.equal(f.calls.length, 0);
    assert.match(f.queries[0].sql, /nama = \? AND pin = \? AND status = 'Aktif'/);
    assert.deepEqual(f.queries[0].values, ["Test Staff", "TEST_PIN"]);
  });
}

test("profile photos: operational scope includes active, today's activity and open hostel returns only", async () => {
  const f = profilePhotoFixture({ records: [
    { student_id: "ACTIVE", status: "KELUAR", tarikh: "2000-01-01" },
    { student_id: "TODAY", status: "SELESAI", masa_masuk: new Date().toISOString() },
    { student_id: "HOSTEL", status: "OTHER", jenis_permohonan: "PULANG_BERMALAM" }
  ], photos: [{ student_id: "ACTIVE", photo_file_id: "GAS_MANAGED:PROFILE_PHOTO" }],
  upstream: { ok: true, data: { photos: [{ student_id: "ACTIVE", photo_data_uri: "data:image/jpeg;base64,YQ==",
    photo_updated_at: "2026-09-23 13:00:00", photo_file_id: "PRIVATE_FILE" }] } } });
  const response = await f.run("getStudentProfilePhotos", {
    role: "guard", name: "Test Staff", pin: "TEST_PIN", student_ids: ["ACTIVE", "TODAY", "HOSTEL"], photo_variant: "thumbnail"
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, data: { photos: [{ student_id: "ACTIVE",
    photo_data_uri: "data:image/jpeg;base64,YQ==", photo_updated_at: "2026-09-23 13:00:00" }] } });
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(f.calls[0].init.body).student_ids, ["ACTIVE"]);
  assert.doesNotMatch(f.calls[0].init.body, /GAS_MANAGED|photo_file_id/);
  assert.doesNotMatch(f.logs.join(""), /YQ==|PRIVATE_FILE|GAS_MANAGED|TEST_PIN/);
});

for (const existing of ["", "PRIVATE_EXISTING_FILE"]) {
  test(`profile photos: submit calls GAS once then ${existing ? "replaces existing file ID with sentinel" : "sets sentinel"} without leaking metadata`, async () => {
    const f = profilePhotoFixture({ student: { photo_file_id: existing } });
    const response = await f.run("submitStudentProfilePhoto", { ...profileUpload, photo_file_id: "UNTRUSTED_FILE" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, data: { student_id: "STU-001",
      has_profile_photo: true, photo_updated_at: "2026-09-23 13:00:00" } });
    assert.deepEqual(f.events, ["GAS", "sync"]);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(JSON.parse(f.calls[0].init.body), { action: "submitStudentProfilePhoto", ...profileUpload });
    const [update, audit] = f.batches[0];
    assert.match(update.sql, /UPDATE STUDENTS SET photo_file_id = \?, photo_updated_at = \?/);
    assert.deepEqual(update.values.slice(0, 3), ["GAS_MANAGED:PROFILE_PHOTO", "2026-09-23 13:00:00", "STU-001"]);
    assert.match(audit.sql, /WHERE changes\(\) = 1/);
    assert.equal(audit.values[1], "UPDATE_STUDENT_PROFILE_PHOTO");
    assert.doesNotMatch(JSON.stringify(audit) + f.logs.join(""), /YQ==|PRIVATE_|GAS_MANAGED|photo_file_id|image_base64/);
  });
}

test("profile photos: admin removal calls GAS once then clears D1 and audits without file IDs", async () => {
  const f = profilePhotoFixture({ student: { photo_file_id: "GAS_MANAGED:PROFILE_PHOTO" },
    upstream: { ok: true, data: { student_id: "STU-001", has_profile_photo: false, photo_updated_at: "" } } });
  const response = await f.run("removeStudentProfilePhoto", { ...profileAdmin, student_id: "STU-001" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, data: {
    student_id: "STU-001", has_profile_photo: false, photo_updated_at: "" } });
  assert.deepEqual(f.events, ["GAS", "sync"]);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { action: "removeStudentProfilePhoto", ...profileAdmin, student_id: "STU-001" });
  const [update, audit] = f.batches[0];
  assert.deepEqual(update.values.slice(0, 3), ["", "", "STU-001"]);
  assert.equal(audit.values[1], "REMOVE_STUDENT_PROFILE_PHOTO");
  assert.match(audit.sql, /WHERE changes\(\) = 1/);
  assert.doesNotMatch(f.calls[0].init.body + JSON.stringify(audit) + f.logs.join(""), /GAS_MANAGED|photo_file_id|YQ==/);
});

for (const action of ["submitStudentProfilePhoto", "removeStudentProfilePhoto"]) {
  for (const failure of [{ syncThrows: true }, { changes: 0 }]) {
    test(`profile photos: ${action} sync failure ${JSON.stringify(failure)} never retries or exposes internals`, async () => {
      const f = profilePhotoFixture({ ...failure, upstream: { ok: true, data: { student_id: "STU-001",
        has_profile_photo: action === "submitStudentProfilePhoto", photo_updated_at: action === "submitStudentProfilePhoto" ? "2026-09-23 13:00:00" : "" } } });
      const response = await f.run(action, action === "submitStudentProfilePhoto" ? profileUpload : { ...profileAdmin, student_id: "STU-001" });
      assert.equal(response.status, 500);
      const body = await response.json();
      assert.equal(body.code, "PROFILE_PHOTO_D1_SYNC_FAILED");
      assert.match(body.error, /jangan.*semula/i);
      assert.equal(f.calls.length, 1);
      assert.doesNotMatch(JSON.stringify(body) + f.logs.join(""), /PRIVATE_FILE|YQ==|GAS_MANAGED/);
    });
  }
}

test("profile photos: invalid auth and invalid images never reach GAS", async () => {
  const denied = profilePhotoFixture({ invalidAuth: true });
  assert.equal((await denied.run("submitStudentProfilePhoto", profileUpload)).status, 401);
  assert.equal(denied.calls.length, 0);
  for (const invalid of [{ mime_type: "text/plain" }, { image_base64: "bad" }, { image_base64: "A".repeat(1100 * 1024 + 4) }]) {
    const f = profilePhotoFixture();
    assert.equal((await f.run("submitStudentProfilePhoto", { ...profileUpload, ...invalid })).status, 400);
    assert.equal(f.calls.length, 0);
  }
});

test("profile photos: rejected or malformed GAS result never syncs D1", async () => {
  for (const result of [{ ok: false, error: "Rejected" }, { ok: true, data: { student_id: "OTHER", has_profile_photo: true, photo_updated_at: "now" } }]) {
    const f = profilePhotoFixture({ upstream: result });
    assert.equal((await f.run("submitStudentProfilePhoto", profileUpload)).status, 502);
    assert.equal(f.batches.length, 0);
    assert.equal(f.calls.length, 1);
  }
});

test("profile photos: trusted redirect uses one POST and one bodyless GET", async () => {
  const f = profilePhotoFixture({ fetch: (url, init, count) => count === 1
    ? new Response(null, { status: 302, headers: { Location: destination } })
    : json(JSON.stringify({ ok: true, data: { student_id: "STU-001", has_profile_photo: true, photo_updated_at: "2026-09-23 13:00:00" } })) });
  assert.equal((await f.run("submitStudentProfilePhoto", profileUpload)).status, 200);
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].init.method, "POST");
  assert.equal(f.calls[1].init.method, "GET");
  assert.equal(f.calls[1].init.body, undefined);
  assert.equal(f.calls[1].url, destination);
});

test("profile photos: getter filters absent D1 photo presence and validates limits before GAS", async () => {
  const f = profilePhotoFixture();
  const response = await f.run("getStudentProfilePhotos", { ...profileAdmin, role: "admin", student_ids: ["NO-PHOTO", "MISSING"] });
  assert.deepEqual(await response.json(), { ok: true, data: { photos: [] } });
  assert.equal(f.calls.length, 0);
  const query = f.queries.find(query => query.sql.includes("FROM STUDENTS"));
  assert.match(query.sql, /photo_file_id IS NOT NULL AND TRIM\(photo_file_id\) <> ''/);
  assert.deepEqual(query.values, ["no-photo", "missing"]);
  for (const invalid of [{ student_ids: Array(101).fill("STU-001") }, { photo_variant: "original" }]) {
    const bad = profilePhotoFixture();
    assert.equal((await bad.run("getStudentProfilePhotos", { ...profileStudent, role: "student", ...invalid })).status, 400);
    assert.equal(bad.calls.length, 0);
  }
});

test("profile photos: unauthorized GAS photos and malformed removal responses fail closed", async () => {
  const f = profilePhotoFixture({ photos: [{ student_id: "STU-001" }], upstream: { ok: true, data: { photos: [
    { student_id: "OTHER", photo_data_uri: "data:image/jpeg;base64,YQ==", photo_updated_at: "now" }
  ] } } });
  const response = await f.run("getStudentProfilePhotos", { ...profileStudent, role: "student" });
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /YQ==|OTHER/);
  for (const data of [
    { student_id: "OTHER", has_profile_photo: false, photo_updated_at: "" },
    { student_id: "STU-001", has_profile_photo: true, photo_updated_at: "" },
    { student_id: "STU-001", has_profile_photo: false, photo_updated_at: "old" }
  ]) {
    const bad = profilePhotoFixture({ upstream: { ok: true, data } });
    assert.equal((await bad.run("removeStudentProfilePhoto", { ...profileAdmin, student_id: "STU-001" })).status, 502);
    assert.equal(bad.batches.length, 0);
    assert.equal(bad.calls.length, 1);
  }
});

test("profile photos: all routes support OPTIONS, reject GET and reject unauthenticated callers", async () => {
  for (const action of ["getStudentProfilePhotos", "submitStudentProfilePhoto", "removeStudentProfilePhoto"]) {
    const f = profilePhotoFixture({ invalidAuth: true });
    assert.equal((await f.run(action, {}, "OPTIONS")).status, 204);
    assert.equal((await f.run(action, {}, "GET")).status, 405);
    assert.equal((await f.run(action, { ...profileUpload, ...profileAdmin, role: "student" })).status, 401);
    assert.equal(f.calls.length, 0);
    assert.equal(f.batches.length, 0);
  }
});

function todayRecordsFixture(requests = [], wardens = []) {
  const queries = [];
  const statement = (sql, values = []) => ({
    bind(...args) { return statement(sql, args); },
    async first() {
      queries.push({ sql, values });
      if (sql.includes("FROM GUARDS")) return { guard_id: "G-TEST" };
      throw new Error("Unexpected D1 first query");
    },
    async all() {
      queries.push({ sql, values });
      if (sql.includes("FROM OUTING_REQUESTS")) {
        assert.doesNotMatch(sql, /warden_approve_role/);
        return { results: requests };
      }
      if (sql.includes("FROM WARDENS")) return { results: wardens };
      if (sql.includes("FROM STUDENTS") || sql.includes("FROM OUTING_TYPES") ||
          sql.includes("FROM AUDIT_LOG")) return { results: [] };
      throw new Error("Unexpected D1 all query");
    }
  });
  const rt = runtime(() => { throw new Error("Today records must not call GAS"); });
  const run = (method = "GET", payload = {}) => rt.run(req(method, {
    url: "https://proxy.test/api/d1/getTodayRecords",
    headers: { Origin: "http://localhost:8000" },
    body: JSON.stringify(payload)
  }), { STAGING_ORIGIN: "http://localhost:8000", DB: { prepare: sql => statement(sql) } });
  return { ...rt, queries, run };
}

test("today records: public GET selects GAS today, active and open hostel records", async () => {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date());
  const old = "2000-01-01";
  const rows = [
    { nama: "Today date", tarikh: today, status: "SELESAI" },
    { nama: "Today return", tarikh: old, tarikh_balik: today, status: "SELESAI" },
    { nama: "Today application", tarikh: old, masa_mohon: `${today} 09:00:00`, status: "SELESAI" },
    { nama: "Today approval", tarikh: old, masa_approve: `${today} 09:00:00`, status: "SELESAI" },
    { nama: "Today departure", tarikh: old, masa_keluar: `${today} 09:00:00`, status: "SELESAI" },
    { nama: "Today arrival", tarikh: old, masa_masuk: `${today} 09:00:00`, status: "SELESAI" },
    { nama: "Today cancellation", tarikh: old, masa_batal_pelajar: `${today} 09:00:00`, status: "DIBATALKAN_PELAJAR" },
    { nama: "Pending", tarikh: old, status: "MENUNGGU_KELULUSAN" },
    { nama: "Approved", tarikh: old, status: "DILULUSKAN_WARDEN" },
    { nama: "Out", tarikh: old, status: "KELUAR" },
    { nama: "Open hostel", tarikh: old, jenis_permohonan: "PULANG_BERMALAM", status: "OTHER" },
    { nama: "Old completed", tarikh: old, status: "SELESAI" },
    { nama: "Closed hostel", tarikh: old, jenis_permohonan: "CUTI_SEMESTER", status: "DITOLAK_WARDEN" },
    { nama: "Cancelled hostel", tarikh: old, jenis_permohonan: "OUTING_HUJUNG_MINGGU", status: "DIBATALKAN_PELAJAR" }
  ];
  const f = todayRecordsFixture(rows);
  const response = await f.run();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual(body.data.map(row => row.nama), rows.slice(0, 11).map(row => row.nama));
  assert.equal(f.queries.length, 2);
  assert.equal(f.calls.length, 0);
});

test("today records: public GET returns only seven GAS fields and preserves role, lewat and belum_masuk", async () => {
  const secret = { student_id: "S-PRIVATE", no_matrik: "M-PRIVATE", request_id: "R-PRIVATE",
    telefon_waris: "0123456789", tujuan: "PRIVATE_DESTINATION", jenis_kenderaan: "PRIVATE_VEHICLE",
    operational_urgency: { state: "CRITICAL" }, photo_file_id: "PRIVATE_PHOTO" };
  const f = todayRecordsFixture([
    { ...secret, nama: "Ali", kelas: "A1", jenis_permohonan: "KECEMASAN", status: "KELUAR",
      warden_approve_by: " Dr HEP ", lewat: "Tidak", masa_masuk: " " },
    { ...secret, nama: "Bakar", status: "KELUAR", warden_approve_by: "Warden B",
      lewat: "Ya", masa_masuk: "2026-09-24 10:00:00" },
    { ...secret, nama: "Cici", status: "DILULUSKAN_WARDEN", warden_approve_by: "Dr HEP", masa_masuk: "" }
  ], [{ warden_id: "HEP-1", nama: "Dr HEP" }, { warden_id: "W-1", nama: "Warden B" }]);
  const response = await f.run();
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.deepEqual(data[0], { nama: "Ali", kelas: "A1", jenis_permohonan: "KECEMASAN",
    status: "KELUAR", warden_approve_role: "HEP", lewat: "Tidak", belum_masuk: true });
  assert.deepEqual(data.slice(1), [
    { nama: "Bakar", kelas: "", jenis_permohonan: "", status: "KELUAR",
      warden_approve_role: "WARDEN", lewat: "Ya", belum_masuk: false },
    { nama: "Cici", kelas: "", jenis_permohonan: "", status: "DILULUSKAN_WARDEN",
      warden_approve_role: "HEP", lewat: "", belum_masuk: false }
  ]);
  assert.deepEqual(Object.keys(data[0]).sort(), ["belum_masuk", "jenis_permohonan", "kelas", "lewat",
    "nama", "status", "warden_approve_role"]);
  assert.doesNotMatch(JSON.stringify(data), /PRIVATE|0123456789|operational_urgency|masa_masuk/);
  assert.equal(f.calls.length, 0);
});

test("today records: authenticated POST remains available and other methods are rejected", async () => {
  const f = todayRecordsFixture([{ student_id: "S-1", nama: "Guard view", status: "KELUAR",
    tarikh: "2000-01-01", telefon_waris: "PRIVATE_CONTACT" }]);
  const options = await f.run("OPTIONS");
  assert.equal(options.status, 204);
  assert.equal(options.headers.get("Access-Control-Allow-Methods"), "GET, POST, OPTIONS");
  const unsupported = await f.run("PUT");
  assert.equal(unsupported.status, 405);
  assert.equal((await unsupported.json()).code, "METHOD_NOT_ALLOWED");
  assert.equal(f.queries.length, 0);
  const denied = await f.run("POST");
  assert.equal(denied.status, 401);
  assert.equal((await denied.json()).code, "SESSION_REQUIRED");
  const response = await f.run("POST", { role: "guard", nama_guard: "Guard Test", pin: "1234" });
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data[0].student_id, "S-1");
  assert.equal(data[0].nama, "Guard view");
  assert.equal(data[0].telefon_waris, undefined);
  assert.ok(data[0].operational_urgency);
  assert.equal(f.calls.length, 0);
});

function runtime(fetchImpl, options = {}) {
  const calls = [], logs = [];
  const context = vm.createContext({
    URL, Headers, Response, TextDecoder, Uint8Array, AbortController,
    crypto: webcrypto,
console: {
  info: (value) => logs.push(value),
  error: (value) => logs.push(value)
},
    setTimeout: options.setTimeout || setTimeout,
    clearTimeout: options.clearTimeout || clearTimeout,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return fetchImpl(url, init, calls.length);
    }
  });
  vm.runInContext(
    source.replace(/export\s*\{[\s\S]*?\};?\s*$/, "this.handle = handleRequest;"),
    context
  );
  return {
    calls, logs,
    run: (request, env = {}, executionContext) =>
  context.handle(
    request,
    { GAS_UPSTREAM_URL: upstream, ...env },
    executionContext
  )
  };
}
function req(method = "GET", options = {}) {
  const headers = new Headers({ Origin: origin, ...options.headers });
  if (options.noOrigin) headers.delete("Origin");
  if (method === "POST" && !headers.has("Content-Type")) headers.set("Content-Type", "text/plain;charset=utf-8");
  return new Request(options.url || `https://proxy.test/api/gas${method === "GET" ? "?action=health" : ""}`, {
    method, headers, ...(method === "POST" ? { body: options.body ?? '{"action":"loginWarden","pin":"SECRET_PIN"}' } : {})
  });
}
function json(body = '{"ok":true,"data":{"status":"ok"}}') {
  return new Response(body, { headers: { "Content-Type": "application/json" } });
}
async function expectError(rt, request, status, code, env) {
  const response = await rt.run(request, env);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(body.ok, false);
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  return body;
}

test("OPTIONS accepts exact origin/method/header without calling GAS", async () => {
  const rt = runtime(() => { throw new Error("must not fetch"); });
  const response = await rt.run(req("OPTIONS", { headers: {
    "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"
  }}));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(rt.calls.length, 0);
});
for (const badOrigin of ["https://evil.test", "null", "https://itumelaka.github.io.evil.test", "https://itumelaka.github.io/eouting/"]) {
  test(`reject origin ${badOrigin}`, async () => {
    const rt = runtime(() => json());
    const response = await rt.run(req("GET", { headers: { Origin: badOrigin } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal((await response.json()).code, "ORIGIN_NOT_ALLOWED");
    assert.equal(rt.calls.length, 0);
  });
}
test("missing Origin is rejected; explicit local origin works only in staging", async () => {
  const rt = runtime(() => json());
  await expectError(rt, req("GET", { noOrigin: true }), 403, "ORIGIN_NOT_ALLOWED");
  await expectError(rt, req("GET", { headers: { Origin: "http://localhost:8000" } }), 403, "ORIGIN_NOT_ALLOWED");
  const response = await rt.run(req("GET", { headers: { Origin: "http://localhost:8000" } }), { STAGING_ORIGIN: "http://localhost:8000" });
  assert.equal(response.status, 200);
});
test("reject method, path and preflight abuse before upstream", async () => {
  const rt = runtime(() => json());
  await expectError(rt, req("DELETE"), 405, "METHOD_NOT_ALLOWED");
  await expectError(rt, req("GET", {url:"https://proxy.test/api/gas/"}), 404, "PATH_NOT_ALLOWED");
  await expectError(rt, req("OPTIONS", {headers:{"Access-Control-Request-Method":"DELETE"}}), 405, "METHOD_NOT_ALLOWED");
  await expectError(rt, req("OPTIONS", {headers:{"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization"}}), 400, "HEADERS_NOT_ALLOWED");
  assert.equal(rt.calls.length, 0);
});
test("GET approves statistics parameters and rejects unknown/duplicate parameters", async () => {
  const rt = runtime(() => json());
  const url = "https://proxy.test/api/gas?action=getOutingStats&month=9&year=2026&kelas=LI%20UMK&_ts=123";
  assert.equal((await rt.run(req("GET", {url}))).status, 200);
  assert.equal(rt.calls[0].url, upstream + "?action=getOutingStats&month=9&year=2026&kelas=LI+UMK&_ts=123");
  for (const query of ["action=loginAdmin", "action=health&url=https://evil.test", "action=health&action=health", "action=health&month=9"]) {
    await expectError(rt, req("GET", {url:"https://proxy.test/api/gas?"+query}), 400, "ACTION_NOT_ALLOWED");
  }
  assert.equal(rt.calls.length, 1);
});
test("POST preserves bytes; rejects unknown action, malformed JSON and wrong type", async () => {
  const rt = runtime(() => json());
  const raw = ' { "pin": "SECRET_PIN", "action": "approveRequest", "catatan": "Melayu ✓" } ';
  assert.equal((await rt.run(req("POST", {body:raw}))).status, 200);
  assert.equal(new TextDecoder().decode(rt.calls[0].init.body), raw);
  for (const body of ['{"action":"setupDatabase"}', '[]', 'null']) {
    await expectError(rt, req("POST", {body}), 400, "ACTION_NOT_ALLOWED");
  }
  await expectError(rt, req("POST", {body:'{'}), 400, "INVALID_REQUEST");
  await expectError(rt, req("POST", {headers:{"Content-Type":"application/json"}}), 415, "INVALID_REQUEST");
  assert.equal(rt.calls.length, 1);
});
test("actual body over 3 MiB rejected even with forged Content-Length", async () => {
  const rt = runtime(() => json());
  const body = JSON.stringify({action:"submitReturnSelfie",image_base64:"A".repeat(3*1024*1024)});
  const error = await expectError(rt, req("POST", {body,headers:{"Content-Length":"1"}}), 413, "REQUEST_TOO_LARGE");
  assert.equal(error.outcome_unknown, false);
  assert.equal(rt.calls.length, 0);
});
for (const status of [302,303]) {
  test(`GET ${status} follows approved redirect server-side`, async () => {
    const rt = runtime((_url,_init,n) => n === 1 ? new Response(null,{status,headers:{Location:destination}}) : json());
    const response = await rt.run(req());
    assert.equal(response.status,200);
    assert.equal((await response.json()).data.status,"ok");
    assert.equal(rt.calls.length,2);
    assert.equal(rt.calls[1].url,destination);
    assert.equal(rt.calls[1].init.redirect,"manual");
    assert.equal(response.headers.get("Location"),null);
  });
}
test("POST redirect uses GET without body or browser-sensitive headers", async () => {
  const rt = runtime((_url,_init,n) => n === 1 ? new Response(null,{status:302,headers:{Location:destination}}) : json());
  const response = await rt.run(req("POST", {headers:{Cookie:"COOKIE_SECRET",Authorization:"Bearer SECRET",Referer:"https://private.test", "Sec-Fetch-Site":"cross-site"}}));
  assert.equal(response.status,200);
  assert.equal(rt.calls[0].init.method,"POST");
  assert.equal(rt.calls[1].init.method,"GET");
  assert.equal(rt.calls[1].init.body,undefined);
  for (const call of rt.calls) {
    assert.equal(call.init.redirect,"manual");
    assert.doesNotMatch(JSON.stringify(call.init.headers),/cookie|authorization|referer|origin|sec-|SECRET/i);
  }
  assert.doesNotMatch(rt.logs.join(""),/SECRET_PIN|COOKIE_SECRET|user_content_key|image_base64/);
  assert.equal(rt.calls.filter(c=>c.init.method==="POST").length,1);
});
for (const location of ["https://evil.test/macros/echo", "http://script.googleusercontent.com/macros/echo", "https://u:p@script.googleusercontent.com/macros/echo", "https://script.googleusercontent.com:8443/macros/echo", "https://script.googleusercontent.com/wrong", "https://script.googleusercontent.com/macros/echo#token"]) {
  test(`reject unsafe redirect ${location}`, async () => {
    const rt = runtime(()=>new Response(null,{status:302,headers:{Location:location}}));
    const error = await expectError(rt,req("POST"),502,"UPSTREAM_DELIVERY_FAILED");
    assert.equal(error.outcome_unknown,true);
    assert.equal(rt.calls.length,1);
  });
}
test("reject unexpected redirect codes and redirect chains", async () => {
  for (const status of [301,307,308]) {
    const rt=runtime(()=>new Response(null,{status,headers:{Location:destination}}));
    await expectError(rt,req(),502,"UPSTREAM_DELIVERY_FAILED");
    assert.equal(rt.calls.length,1);
  }
  const rt=runtime(()=>new Response(null,{status:302,headers:{Location:destination}}));
  await expectError(rt,req(),502,"UPSTREAM_DELIVERY_FAILED");
  assert.equal(rt.calls.length,2);
});
test("upstream HTML 404 and invalid success responses normalize without disclosure/retry", async () => {
  for (const method of ["GET","POST"]) {
    const rt=runtime(()=>new Response("<html>PRIVATE_SECRET</html>",{status:404}));
    const error=await expectError(rt,req(method),502,"UPSTREAM_DELIVERY_FAILED");
    assert.equal(error.outcome_unknown,method==="POST");
    assert.doesNotMatch(JSON.stringify(error)+rt.logs.join(""),/PRIVATE_SECRET/);
    assert.equal(rt.calls.length,1);
  }
  for (const body of ["<html>SECRET</html>","null",'{"data":1}',"[]"]) {
    await expectError(runtime(()=>json(body)),req(),502,"UPSTREAM_INVALID_RESPONSE");
  }
});
test("timeout produces 504 and unknown POST outcome without replay", async () => {
  for (const method of ["GET","POST"]) {
    const rt=runtime(()=>new Promise(()=>{}), {setTimeout:(fn)=>{queueMicrotask(fn);return 1;},clearTimeout:()=>{}});
    const error=await expectError(rt,req(method),504,"UPSTREAM_TIMEOUT");
    assert.equal(error.outcome_unknown,method==="POST");
    assert.equal(rt.calls.length,1);
  }
});
test("GAS application error bytes are preserved with own headers", async () => {
  const raw=' {"ok":false,"error":"PIN tidak sah"} ';
  const rt=runtime(()=>new Response(raw,{headers:{"Set-Cookie":"SECRET", "Access-Control-Allow-Origin":"*"}}));
  const response=await rt.run(req("POST"));
  assert.equal(response.status,200);
  assert.equal(await response.text(),raw);
  assert.equal(response.headers.get("Set-Cookie"),null);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),origin);
  assert.equal(response.headers.get("Cache-Control"),"no-store");
});
test("optional limiter rejects before GAS; fixed upstream misconfig fails closed", async () => {
  const rt=runtime(()=>json());
  const error=await expectError(rt,req("POST"),429,"RATE_LIMITED",{API_RATE_LIMITER:{limit:async()=>({success:false})}});
  assert.equal(error.outcome_unknown,false);
  await expectError(rt,req(),503,"UPSTREAM_DELIVERY_FAILED",{GAS_UPSTREAM_URL:"https://evil.test/exec"});
  assert.equal(rt.calls.length,0);
});
test("network failure has no retry and logs contain only approved metadata", async () => {
  const rt=runtime(()=>{throw new Error("PIN=SECRET; user_content_key=SECRET");});
  await expectError(rt,req("POST"),502,"UPSTREAM_DELIVERY_FAILED");
  assert.equal(rt.calls.length,1);
  assert.deepEqual(Object.keys(JSON.parse(rt.logs[0])).sort(),["action","duration_ms","method","request_id","status"]);
  assert.doesNotMatch(rt.logs.join(""),/SECRET/);
});

test("POST 303 also discards body and cancellation/response read failures never replay", async () => {
  const rt=runtime((_url,_init,n)=>n===1?new Response(null,{status:303,headers:{Location:destination}}):json());
  assert.equal((await rt.run(req("POST"))).status,200);
  assert.equal(rt.calls[1].init.method,"GET");
  assert.equal(rt.calls[1].init.body,undefined);
  const broken=runtime(()=>new Response(new ReadableStream({start(c){c.error(new Error("SECRET"));}})));
  assert.equal((await expectError(broken,req("POST"),502,"UPSTREAM_DELIVERY_FAILED")).outcome_unknown,true);
  assert.equal(broken.calls.length,1);
});
test("normal base64 upload size is preserved without body logging", async () => {
  const body=JSON.stringify({action:"submitReturnSelfie",image_base64:"A".repeat(2*1024*1024),pin:"SENSITIVE"});
  const rt=runtime(()=>json());
  assert.equal((await rt.run(req("POST",{body}))).status,200);
  assert.equal(new TextDecoder().decode(rt.calls[0].init.body),body);
  assert.doesNotMatch(rt.logs.join(""),/SENSITIVE|image_base64|AAAA/);
});
test("response validation fails closed above the documented 16 MiB cap", async () => {
  const rt=runtime(()=>json(JSON.stringify({ok:true,data:"A".repeat(16*1024*1024)})));
  await expectError(rt,req(),502,"UPSTREAM_INVALID_RESPONSE");
  assert.equal(rt.calls.length,1);
});
test("every current GAS POST handler is covered by the explicit proxy allowlist", () => {
  const gas=fs.readFileSync(path.join(__dirname,"../gas/Code.gs"),"utf8");
  const handler=gas.slice(gas.indexOf("function dispatchPost_("),gas.indexOf("function eoutingRpc("));
  const actions=[...handler.matchAll(/action === "([A-Za-z0-9]+)"/g)].map(m=>m[1]);
  const workerList=source.slice(source.indexOf("var POST_ACTIONS"),source.indexOf("var MAX_REQUEST_BYTES"));
  for(const action of actions) assert.ok(workerList.includes('"'+action+'"'),action);
});

const staging = { STAGING_ORIGIN: "http://localhost:8000" };
test("staging GET retries a network failure once then succeeds with attempts header", async () => {
  const delays=[];
  const rt=runtime((_url,_init,n)=>{if(n===1)throw new Error("SECRET");return json();}, {
    setTimeout:(fn,ms)=>{if(ms===400){delays.push(ms);queueMicrotask(fn);return 0;}return setTimeout(fn,ms);}
  });
  const response=await rt.run(req(),staging);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"2");
  assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),origin);
  assert.deepEqual(delays,[400]);
  assert.equal(rt.calls.length,2);
  assert.ok(rt.calls.every(c=>c.url.startsWith(upstream)));
  assert.doesNotMatch(rt.logs.join(""),/SECRET/);
});
test("staging GET both delivery attempts fail; no third attempt",async()=>{
  const rt=runtime(()=>new Response("unavailable",{status:503}));
  const response=await rt.run(req(),staging);
  assert.equal(response.status,502);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"2");
  assert.equal((await response.json()).outcome_unknown,false);
  assert.equal(rt.calls.length,2);
});
test("staging GET retries googleusercontent HTML 404 from fresh exec",async()=>{
  const rt=runtime((_url,_init,n)=>{
    if(n===1||n===3)return new Response(null,{status:302,headers:{Location:destination}});
    return n===2?new Response("<html>SECRET</html>",{status:404,headers:{"Content-Type":"text/html; charset=utf-8"}}):json();
  });
  const response=await rt.run(req(),staging);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"2");
  assert.equal(rt.calls.length,4);
  assert.equal(rt.calls[2].url,rt.calls[0].url);
  assert.doesNotMatch(await response.text(),/SECRET|user_content_key/);
});
test("staging GET application errors, malformed JSON and unsafe redirects never retry",async()=>{
  const raw=' {"ok":false,"error":"PIN tidak sah"} ';
  const rt=runtime(()=>json(raw));
  const response=await rt.run(req(),staging);
  assert.equal(await response.text(),raw);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"1");
  assert.equal(rt.calls.length,1);
  for(const makeResponse of [
    ()=>json('{"data":1}'),()=>json('not json'),
    ()=>new Response(raw,{status:500}),
    ...[400,401,403,404,422,429].map(status=>()=>new Response(raw,{status})),
    ()=>new Response(null,{status:302,headers:{Location:"https://evil.test/"}}),
    ()=>new Response(null,{status:307,headers:{Location:destination}})
  ]) {
    const negative=runtime(makeResponse);
    const result=await negative.run(req(),staging);
    assert.equal(result.status,502);
    assert.equal(result.headers.get("X-Upstream-Attempts"),"1");
    assert.equal(negative.calls.length,1);
  }
});
test("staging POST remains one attempt with unchanged unknown outcome",async()=>{
  const rt=runtime(()=>{throw new Error("network");});
  const response=await rt.run(req("POST"),staging);
  assert.equal(response.status,502);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"1");
  assert.equal((await response.json()).outcome_unknown,true);
  assert.equal(rt.calls.length,1);
});
test("staging GET timeout resets to 60s per attempt; POST stays 120s once",async()=>{
  for(const method of ["GET","POST"]) {
    const durations=[];
    const rt=runtime(()=>new Promise(()=>{}),{
      setTimeout:(fn,ms)=>{durations.push(ms);queueMicrotask(fn);return durations.length;},clearTimeout:()=>{}
    });
    const response=await rt.run(req(method),staging);
    assert.equal(response.status,504);
    assert.equal(response.headers.get("X-Upstream-Attempts"),method==="GET"?"2":"1");
    assert.deepEqual(durations,method==="GET"?[60000,400,60000]:[120000]);
    assert.ok(rt.calls.every(c=>c.init.signal.aborted));
  }
});
test("production has no retry; validation reports zero upstream attempts",async()=>{
  const rt=runtime(()=>{throw new Error("network");});
  assert.equal((await rt.run(req())).headers.get("X-Upstream-Attempts"),"1");
  assert.equal(rt.calls.length,1);
  for(const request of [req("GET",{headers:{Origin:"null"}}),req("GET",{url:"https://proxy.test/api/gas?action=unknown"})]) {
    assert.equal((await rt.run(request,staging)).headers.get("X-Upstream-Attempts"),"0");
  }
  assert.equal(rt.calls.length,1);
});

test("staging D1 submit returns before Sheets mirror finishes via waitUntil", async () => {
  const pendingTasks = [];

  const statement = (sql) => ({
    bind(...values) {
      this.values = values;
      return this;
    },
    async first() {
      if (sql.includes("FROM STUDENTS")) {
        return {
          student_id: "STU-001",
          no_matrik: "M001",
          nama: "Nama Test",
          email: "test@example.test",
          kelas: "TEST",
          status: "Aktif"
        };
      }

      if (sql.includes("FROM OUTING_TYPES")) {
        return {
          type_code: "OUTING_BIASA",
          display_name: "Outing Biasa",
          description: "",
          active: 1,
          sort_order: 1,
          allowed_days: "ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU,AHAD",
          application_open_time: "",
          application_close_time: "",
          fixed_return_time: "22:00",
          same_day_only: 1,
          require_leave_date: 0,
          require_return_date: 0,
          require_return_time: 0,
          require_guardian_phone: 0,
          require_guardian_relation: 0,
          require_emergency_reason: 0,
          require_purpose: 1,
          require_location: 1,
          require_vehicle: 1,
          require_warden_approval: 1,
          require_selfie: 0,
          config_version: 1,
          departure_allowed_days: "",
          earliest_departure_time: "",
          application_open_date: "",
          application_close_date: ""
        };
      }

      if (sql.includes("SELECT request_id FROM OUTING_REQUESTS")) {
        return null;
      }

      return null;
    },
    async run() {
      return { success: true };
    }
  });

  const DB = {
    prepare(sql) {
      return statement(sql);
    },
    async batch() {
      return [{ success: true }, { success: true }];
    }
  };

  const rt = runtime(
  (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")));
  }),
  {
    setTimeout: (fn, ms) => {
      if (ms === 20000) {
        queueMicrotask(fn);
        return 1;
      }
      return setTimeout(fn, ms);
    },
    clearTimeout: () => {}
  }
);

  const executionContext = {
    waitUntil(promise) {
      pendingTasks.push(promise);
    }
  };

  const response = await rt.run(
    req("POST", {
      url: "https://proxy.test/api/d1/submitRequest",
      body: JSON.stringify({
        action: "submitRequest",
        student_id: "STU-001",
        no_matrik: "M001",
        jenis_permohonan: "OUTING_BIASA",
        tujuan: "Test async mirror",
        lokasi: "ITU",
        jenis_kenderaan: "Jalan kaki"
      })
    }),
    {
      ...staging,
      DB,
      D1_MIRROR_SECRET: "TEST_SECRET",
      TELEGRAM_ENABLED: "0"
    },
    executionContext
  );

  assert.equal(response.status, 201);
  assert.equal(pendingTasks.length, 1);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.data.status, "MENUNGGU_KELULUSAN");
});

test("staging submitReturnSelfie authenticates eligible student, syncs D1 after one GAS call and returns only selfie state", async () => {
  const payload = {
    request_id: "TEST-SELFIE-001", student_id: "STU-001", no_matrik: "M001",
    image_base64: "YQ==", mime_type: "image/jpeg"
  };
  const selfieTime = "2026-09-23 12:01:00";
  const events = [];
  const batches = [];
  const statement = (sql, values = []) => ({
    sql, values,
    bind(...args) { return statement(sql, args); },
    async first() {
      if (sql.includes("FROM STUDENTS")) {
        assert.match(sql, /student_id = \? AND no_matrik = \? AND status = 'Aktif'/);
        assert.deepEqual(values, ["STU-001", "M001"]);
        events.push("authenticate");
        return { student_id: "STU-001", no_matrik: "M001", status: "Aktif" };
      }
      if (sql.includes("FROM OUTING_REQUESTS")) {
        assert.deepEqual(values, ["TEST-SELFIE-001"]);
        events.push("read-request");
        return {
          request_id: "TEST-SELFIE-001", student_id: "STU-001", no_matrik: "M001",
          nama: "Test Student", jenis_permohonan: "OUTING_BIASA", status: "SELESAI",
          masa_masuk: "2026-09-23 12:00:00", selfie_status: "BELUM_HANTAR",
          selfie_file_id: "", masa_selfie: ""
        };
      }
      throw new Error("Unexpected query: " + sql);
    }
  });
  const DB = {
    prepare: (sql) => statement(sql),
    async batch(statements) {
      events.push("batch");
      batches.push(statements);
      return [{ success: true, meta: { changes: 1 } }, { success: true, meta: { changes: 1 } }];
    }
  };
  const rt = runtime(() => {
    events.push("upstream");
    return json(JSON.stringify({ ok: true, data: {
      request_id: "TEST-SELFIE-001", selfie_status: "SUDAH_HANTAR", masa_selfie: selfieTime,
      selfie_file_id: "PRIVATE_FILE", selfie_url: "https://drive.google.com/private",
      selfie_telegram_message_id: "PRIVATE_MESSAGE"
    } }));
  });
  const response = await rt.run(req("POST", {
    url: "https://proxy.test/api/d1/submitReturnSelfie",
    headers: { Origin: staging.STAGING_ORIGIN }, body: JSON.stringify(payload)
  }), { ...staging, DB });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, data: {
    request_id: "TEST-SELFIE-001", selfie_status: "SUDAH_HANTAR", masa_selfie: selfieTime
  } });
  assert.deepEqual(events, ["authenticate", "read-request", "upstream", "batch"]);
  assert.equal(rt.calls.length, 1);
  assert.equal(rt.calls[0].url, upstream);
  assert.equal(rt.calls[0].init.method, "POST");
  assert.equal(rt.calls[0].init.redirect, "manual");
  assert.equal(rt.calls[0].init.headers["Content-Type"], "text/plain;charset=utf-8");
  assert.deepEqual(JSON.parse(rt.calls[0].init.body), { action: "submitReturnSelfie", ...payload });
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  const [update, audit] = batches[0];
  assert.match(update.sql, /UPDATE OUTING_REQUESTS SET selfie_status = \?, masa_selfie = \?/);
  assert.match(update.sql, /status = 'SELESAI'/);
  assert.match(update.sql, /BELUM_HANTAR/);
  assert.deepEqual(update.values, ["SUDAH_HANTAR", selfieTime, "TEST-SELFIE-001", "STU-001", "M001"]);
  assert.match(audit.sql, /INSERT INTO AUDIT_LOG/);
  assert.match(audit.sql, /WHERE changes\(\) = 1/);
  assert.deepEqual(audit.values, [selfieTime, "SUBMIT_RETURN_SELFIE", "TEST-SELFIE-001",
    "Student", "Test Student", JSON.stringify({ no_matrik: "M001", jenis_permohonan: "OUTING_BIASA" }),
    "OUTING_REQUEST", "TEST-SELFIE-001"]);
  assert.doesNotMatch(rt.logs.join(""), /YQ==|image_base64|PRIVATE_FILE|PRIVATE_MESSAGE|drive\.google/);
});
