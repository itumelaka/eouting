import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { handleSubmitRequest } from "../proxy/staging-submit-request.js";

class D1Statement {
  constructor(database, sql, values = []) {
    this.database = database;
    this.sql = sql;
    this.values = values;
  }

  bind(...values) {
    return new D1Statement(this.database, this.sql, values);
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { results: this.database.prepare(this.sql).all(...this.values) };
  }

  async run() {
    return this.runSync();
  }

  runSync() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return { success: true, meta: { changes: Number(result.changes || 0) } };
  }
}

class TestD1 {
  constructor(database) {
    this.database = database;
  }

  prepare(sql) {
    return new D1Statement(this.database, sql);
  }

  async batch(statements) {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const results = [];
      for (const statement of statements) results.push(statement.runSync());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

function createDatabase() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE STUDENTS (
      student_id TEXT PRIMARY KEY,
      no_matrik TEXT NOT NULL,
      nama TEXT NOT NULL,
      email TEXT,
      kelas TEXT,
      status TEXT NOT NULL
    );
    CREATE TABLE OUTING_TYPES (
      type_code TEXT PRIMARY KEY,
      display_name TEXT,
      description TEXT,
      active INTEGER,
      sort_order INTEGER,
      allowed_days TEXT,
      application_open_time TEXT,
      application_close_time TEXT,
      fixed_return_time TEXT,
      same_day_only INTEGER,
      require_leave_date INTEGER,
      require_return_date INTEGER,
      require_return_time INTEGER,
      require_guardian_phone INTEGER,
      require_guardian_relation INTEGER,
      require_emergency_reason INTEGER,
      require_purpose INTEGER,
      require_location INTEGER,
      require_vehicle INTEGER,
      require_warden_approval INTEGER,
      require_selfie INTEGER,
      config_version INTEGER,
      departure_allowed_days TEXT,
      earliest_departure_time TEXT,
      application_open_date TEXT,
      application_close_date TEXT
    );
    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY,
      tarikh TEXT, hari TEXT, jenis_permohonan TEXT,
      student_id TEXT, no_matrik TEXT, nama TEXT, student_email TEXT, kelas TEXT,
      tujuan TEXT, lokasi TEXT, jenis_kenderaan TEXT, butiran_kenderaan TEXT,
      sebab_kecemasan TEXT, telefon_waris TEXT, hubungan_waris TEXT,
      catatan_kecemasan TEXT, masa_mohon TEXT, status TEXT,
      warden_approve_by TEXT, masa_approve TEXT, masa_keluar TEXT,
      guard_keluar_by TEXT, masa_masuk TEXT, guard_masuk_by TEXT, lewat TEXT,
      selfie_whatsapp TEXT, catatan TEXT, tarikh_balik TEXT, hari_balik TEXT,
      masa_balik_dijangka TEXT, selfie_status TEXT, selfie_file_id TEXT,
      selfie_url TEXT, masa_selfie TEXT, selfie_telegram_message_id TEXT,
      sebab_batal_pelajar TEXT, masa_batal_pelajar TEXT, dibatalkan_oleh TEXT
    );
    CREATE TABLE AUDIT_LOG (
      timestamp TEXT, action TEXT, request_id TEXT, user_role TEXT,
      user_name TEXT, details TEXT, entity_type TEXT, entity_id TEXT
    );
    CREATE UNIQUE INDEX uq_active_request_student
      ON OUTING_REQUESTS(student_id)
      WHERE status IN ('MENUNGGU_KELULUSAN','DILULUSKAN_WARDEN','KELUAR');
    CREATE UNIQUE INDEX uq_active_request_matric
      ON OUTING_REQUESTS(no_matrik)
      WHERE no_matrik IS NOT NULL AND TRIM(no_matrik) <> ''
        AND status IN ('MENUNGGU_KELULUSAN','DILULUSKAN_WARDEN','KELUAR');
  `);
  return database;
}

function seedStudent(database, overrides = {}) {
  const row = {
    student_id: "STU-001",
    no_matrik: "M001",
    nama: "Nama Kanonik",
    email: "canonical@example.test",
    kelas: "A3",
    status: "Aktif",
    ...overrides
  };
  database.prepare(`INSERT INTO STUDENTS VALUES (?, ?, ?, ?, ?, ?)`).run(
    row.student_id, row.no_matrik, row.nama, row.email, row.kelas, row.status
  );
  return row;
}

function baseOutingType(overrides = {}) {
  return {
    type_code: "OUTING_BIASA",
    display_name: "Outing Biasa",
    description: "",
    active: 1,
    sort_order: 1,
    allowed_days: "ISNIN",
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
    require_selfie: 1,
    config_version: 3,
    departure_allowed_days: "",
    earliest_departure_time: "",
    application_open_date: "",
    application_close_date: "",
    ...overrides
  };
}

function seedOutingType(database, overrides = {}) {
  const row = baseOutingType(overrides);
  const fields = Object.keys(row);
  database.prepare(
    `INSERT INTO OUTING_TYPES (${fields.join(",")}) VALUES (${fields.map(() => "?").join(",")})`
  ).run(...fields.map((field) => row[field]));
  return row;
}

function requestPayload(overrides = {}) {
  return {
    student_id: "STU-001",
    no_matrik: "M001",
    nama: "Nama Tidak Dipercayai",
    email: "spoof@example.test",
    kelas: "PALSU",
    jenis_permohonan: "OUTING_BIASA",
    tujuan: "Beli keperluan",
    lokasi: "Bandar",
    jenis_kenderaan: "Bas",
    ...overrides
  };
}

function makeRequest(payload) {
  return new Request("https://staging.example/api/d1/submitRequest", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "submitRequest", ...payload })
  });
}

async function callHandler(database, payload, options = {}) {
  const telegramCalls = [];
  const fetchImpl = options.fetchImpl || (async (url, init) => {
    telegramCalls.push({ url, init });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  const response = await handleSubmitRequest(
    makeRequest(payload),
    {
      DB: options.db || new TestD1(database),
      TELEGRAM_ENABLED: "true",
      TELEGRAM_BOT_TOKEN: "test-token",
      TELEGRAM_CHAT_ID: "test-chat"
    },
    new Headers({ "Content-Type": "application/json; charset=utf-8" }),
    { now: () => new Date(options.now || "2026-09-21T02:00:00.000Z"), fetchImpl }
  );
  return { response, body: await response.json(), telegramCalls };
}

async function expectFault(database, payload, message, options = {}) {
  await assert.rejects(
    () => callHandler(database, payload, options),
    (error) => {
      assert.equal(error.message, message);
      assert.ok(Number.isInteger(error.status));
      assert.ok(error.code);
      return true;
    }
  );
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM OUTING_REQUESTS`).get().count, 0);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM AUDIT_LOG`).get().count, 0);
}

test("valid pending submission persists canonical data, audit, then Telegram", async () => {
  const database = createDatabase();
  seedStudent(database);
  seedOutingType(database);

  const result = await callHandler(database, requestPayload());

  assert.equal(result.response.status, 201);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.data.status, "MENUNGGU_KELULUSAN");

  const stored = database.prepare(`SELECT * FROM OUTING_REQUESTS`).get();
  assert.equal(stored.nama, "Nama Kanonik");
  assert.equal(stored.student_email, "canonical@example.test");
  assert.equal(stored.kelas, "A3");
  assert.equal(stored.tarikh, "2026-09-21");
  assert.equal(stored.hari, "ISNIN");
  assert.equal(stored.masa_balik_dijangka, "22:00");

  const audits = database.prepare(`SELECT * FROM AUDIT_LOG ORDER BY rowid`).all();
  assert.deepEqual(audits.map((row) => row.action), ["SUBMIT_REQUEST"]);
  assert.equal(audits[0].request_id, stored.request_id);
  assert.equal(result.telegramCalls.length, 1);
  assert.match(JSON.parse(result.telegramCalls[0].init.body).text, /Nama: Nama Kanonik/);
});

test("valid auto-approved submission writes both audits and authoritative approval fields", async () => {
  const database = createDatabase();
  seedStudent(database);
  seedOutingType(database, { require_warden_approval: 0, require_selfie: 0 });

  const result = await callHandler(database, requestPayload());
  const stored = database.prepare(`SELECT * FROM OUTING_REQUESTS`).get();
  const audits = database.prepare(`SELECT action FROM AUDIT_LOG ORDER BY rowid`).all();

  assert.equal(result.response.status, 201);
  assert.equal(stored.status, "DILULUSKAN_WARDEN");
  assert.equal(stored.warden_approve_by, "AUTO_CONFIG_V2");
  assert.equal(stored.masa_approve, "2026-09-21 10:00:00");
  assert.equal(stored.selfie_status, "TIDAK_DIPERLUKAN");
  assert.deepEqual(audits.map((row) => row.action), ["SUBMIT_REQUEST", "AUTO_APPROVE_REQUEST"]);
});

test("student_id and no_matrik must identify the same active student", async () => {
  for (const scenario of [
    { payload: { student_id: "MISSING" }, status: "Aktif" },
    { payload: { no_matrik: "WRONG" }, status: "Aktif" },
    { payload: {}, status: "Tidak Aktif" }
  ]) {
    const database = createDatabase();
    seedStudent(database, { status: scenario.status });
    seedOutingType(database);
    await expectFault(
      database,
      requestPayload(scenario.payload),
      "Pelajar tidak dijumpai atau tidak aktif."
    );
  }
});

test("OUTING_TYPES is validated fail-closed before persistence", async () => {
  const invalidConfigs = [
    { allowed_days: "ISNIN,FUNDAY" },
    { allowed_days: "" },
    { display_name: "" },
    { sort_order: 0 },
    { application_open_time: "25:00" },
    { application_open_date: "2026-02-30" },
    { application_open_date: "2026-10-01", application_close_date: "2026-09-01" },
    { config_version: 0 },
    { require_purpose: 7 }
  ];
  for (const override of invalidConfigs) {
    const database = createDatabase();
    seedStudent(database);
    seedOutingType(database, override);
    await expectFault(
      database,
      requestPayload(),
      "Konfigurasi jenis outing tidak sah. Sila hubungi pentadbir."
    );
  }
});

test("missing or inactive outing types preserve GAS business errors", async () => {
  {
    const database = createDatabase();
    seedStudent(database);
    await expectFault(database, requestPayload(), "Jenis outing tidak tersedia.");
  }
  {
    const database = createDatabase();
    seedStudent(database);
    seedOutingType(database, { active: 0 });
    await expectFault(database, requestPayload(), "Jenis outing tidak aktif dan tidak boleh dipohon.");
  }
});

test("configured required fields are enforced with GAS messages", async () => {
  const cases = [
    ["require_leave_date", "tarikh", "Tarikh keluar diperlukan."],
    ["require_return_date", "tarikh_balik", "Tarikh pulang ke asrama diperlukan."],
    ["require_return_time", "masa_balik_dijangka", "Masa dijangka pulang ke asrama diperlukan."],
    ["require_guardian_phone", "telefon_waris", "Telefon waris diperlukan."],
    ["require_guardian_relation", "hubungan_waris", "Hubungan waris diperlukan."],
    ["require_emergency_reason", "sebab_kecemasan", "Sebab kecemasan diperlukan."],
    ["require_purpose", "tujuan", "Tujuan diperlukan."],
    ["require_location", "lokasi", "Lokasi diperlukan."],
    ["require_vehicle", "jenis_kenderaan", "Jenis kenderaan diperlukan."]
  ];
  for (const [configField, payloadField, message] of cases) {
    const database = createDatabase();
    seedStudent(database);
    seedOutingType(database, {
      require_purpose: 0,
      require_location: 0,
      require_vehicle: 0,
      fixed_return_time: configField === "require_return_time" ? "" : "22:00",
      [configField]: 1
    });
    await expectFault(database, requestPayload({ [payloadField]: "" }), message);
  }
});

test("application date, day, time, departure, return and same-day policies are enforced", async () => {
  const scenarios = [
    [{ application_open_date: "2026-09-22" }, {}, "Permohonan dibuka mulai 22 September 2026."],
    [{ application_close_date: "2026-09-20" }, {}, "Tempoh permohonan telah ditutup pada 20 September 2026."],
    [{ allowed_days: "SELASA" }, {}, "Permohonan jenis outing ini tidak dibenarkan pada hari ini."],
    [{ application_open_time: "11:00", application_close_time: "12:00" }, {}, "Permohonan jenis outing ini belum dibuka atau telah ditutup."],
    [{ departure_allowed_days: "JUMAAT" }, {}, "Tarikh keluar diperlukan untuk peraturan keluar jenis outing ini."],
    [{ departure_allowed_days: "JUMAAT", require_leave_date: 1 }, { tarikh: "2026-09-21" }, "Outing Biasa hanya dibenarkan keluar pada hari Jumaat."],
    [{ same_day_only: 0, require_leave_date: 1, require_return_date: 1 }, { tarikh: "2026-09-22", tarikh_balik: "2026-09-21" }, "Tarikh pulang ke asrama tidak boleh lebih awal daripada tarikh keluar."],
    [{ same_day_only: 1, require_leave_date: 1 }, { tarikh: "2026-09-21", tarikh_balik: "2026-09-22" }, "Jenis outing ini mesti keluar dan pulang pada hari yang sama."],
    [{ require_leave_date: 1 }, { tarikh: "2026-02-30" }, "Tarikh keluar tidak sah."],
    [{ fixed_return_time: "", require_return_time: 1 }, { masa_balik_dijangka: "24:10" }, "Masa dijangka pulang ke asrama tidak sah."]
  ];
  for (const [config, payload, message] of scenarios) {
    const database = createDatabase();
    seedStudent(database);
    seedOutingType(database, config);
    await expectFault(database, requestPayload(payload), message);
  }
});

test("overnight application windows allow the wrapped interval", async () => {
  const database = createDatabase();
  seedStudent(database);
  seedOutingType(database, { application_open_time: "22:00", application_close_time: "11:00" });
  const result = await callHandler(database, requestPayload());
  assert.equal(result.response.status, 201);
});

test("active duplicate is returned as the GAS business error", async () => {
  const database = createDatabase();
  seedStudent(database);
  seedOutingType(database);
  await callHandler(database, requestPayload());
  await assert.rejects(
    () => callHandler(database, requestPayload()),
    (error) => error.message === "Anda masih mempunyai permohonan aktif. Sila selesaikan permohonan sedia ada dahulu."
  );
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM OUTING_REQUESTS`).get().count, 1);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM AUDIT_LOG`).get().count, 1);
});

test("simultaneous duplicate submissions persist exactly one request and one audit", async () => {
  const database = createDatabase();
  seedStudent(database);
  seedOutingType(database);
  const results = await Promise.allSettled([
    callHandler(database, requestPayload()),
    callHandler(database, requestPayload())
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  const rejected = results.find((result) => result.status === "rejected");
  assert.equal(rejected.reason.message, "Anda masih mempunyai permohonan aktif. Sila selesaikan permohonan sedia ada dahulu.");
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM OUTING_REQUESTS`).get().count, 1);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM AUDIT_LOG`).get().count, 1);
});

test("Telegram failure never rolls back the persisted request or audit", async () => {
  const database = createDatabase();
  seedStudent(database);
  seedOutingType(database);
  const result = await callHandler(database, requestPayload(), {
    fetchImpl: async () => { throw new Error("telegram unavailable"); }
  });
  assert.equal(result.response.status, 201);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM OUTING_REQUESTS`).get().count, 1);
  assert.equal(database.prepare(`SELECT COUNT(*) AS count FROM AUDIT_LOG`).get().count, 1);
});
