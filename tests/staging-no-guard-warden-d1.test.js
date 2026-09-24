import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleRequest } from "../proxy/staging-worker-base.js";

function createFixture(featureEnabled = "true") {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE WARDENS (
      warden_id TEXT PRIMARY KEY,
      nama TEXT,
      pin TEXT,
      status TEXT
    );

    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY,
      student_id TEXT,
      no_matrik TEXT,
      nama TEXT,
      jenis_permohonan TEXT,
      status TEXT,
      lokasi TEXT,
      masa_keluar TEXT,
      guard_keluar_by TEXT
    );

    CREATE TABLE SYSTEM_CONFIG (
      config_key TEXT PRIMARY KEY,
      config_value TEXT
    );

    CREATE TABLE AUDIT_LOG (
      timestamp TEXT NOT NULL,
      action TEXT NOT NULL,
      request_id TEXT,
      user_role TEXT,
      user_name TEXT,
      details TEXT,
      entity_type TEXT,
      entity_id TEXT
    );

    CREATE TABLE MIRROR_RETRY_QUEUE (
      request_id TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      first_failed_at TEXT NOT NULL,
      last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    INSERT INTO WARDENS VALUES
      ('WARDEN-1', 'Warden Satu', '1234', 'Aktif');

    INSERT INTO OUTING_REQUESTS VALUES
      (
        'REQ-1',
        'STU-1',
        'M-1',
        'Ali',
        'PULANG_BERMALAM',
        'DILULUSKAN_WARDEN',
        'Kampung',
        NULL,
        NULL
      );

    INSERT INTO AUDIT_LOG VALUES
      (
        '2026-09-22 18:00:00',
        'DEPARTURE_CONFIRMATION_REQUESTED',
        'REQ-1',
        'Student',
        'Ali',
        '{"student_name":"Ali","no_matrik":"M-1","jenis_permohonan":"PULANG_BERMALAM","mode":"REMOTE_NO_GUARD"}',
        'OUTING_REQUEST',
        'REQ-1'
      );
  `);

  const DB = {
    prepare(sql) {
      const statement = (values) => ({
        bind: (...next) => statement(next),
        first: async () => database.prepare(sql).get(...values) || null,
        all: async () => ({
          results: database.prepare(sql).all(...values)
        }),
        run: async () => {
          const result = database.prepare(sql).run(...values);
          return {
            success: true,
            meta: {
              changes: Number(result.changes || 0)
            }
          };
        }
      });

      return statement([]);
    }
  };

  return {
    database,
    env: {
      DB,
      STAGING_ORIGIN: "http://localhost:8000",
      NO_GUARD_DEPARTURE_ENABLED: featureEnabled
    }
  };
}

function makeRequest() {
  return new Request(
    "https://staging.invalid/api/d1/confirmWardenRemoteCheckout",
    {
      method: "POST",
      headers: {
        Origin: "http://localhost:8000",
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "confirmWardenRemoteCheckout",
        request_id: "REQ-1",
        nama_warden: "Warden Satu",
        pin: "1234"
      })
    }
  );
}

test("D1 Warden No-Guard checkout changes lifecycle to KELUAR without Guard actor", async () => {
  const fixture = createFixture();

  const response = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(response.status, 200);

  const body = await response.json();

  assert.equal(body.ok, true);
  assert.equal(body.data.request_id, "REQ-1");
  assert.equal(body.data.status, "KELUAR");
  assert.ok(body.data.masa_keluar);

  const stored = fixture.database.prepare(
    "SELECT status, masa_keluar, guard_keluar_by FROM OUTING_REQUESTS WHERE request_id = 'REQ-1'"
  ).get();

  assert.equal(stored.status, "KELUAR");
  assert.ok(stored.masa_keluar);
  assert.equal(stored.guard_keluar_by, null);

  const audit = fixture.database.prepare(
    `SELECT *
     FROM AUDIT_LOG
     WHERE request_id = 'REQ-1'
       AND action = 'WARDEN_REMOTE_CHECKOUT'`
  ).get();

  assert.equal(audit.user_role, "Warden");
  assert.equal(audit.user_name, "Warden Satu");

  const details = JSON.parse(audit.details);

  assert.equal(details.student_name, "Ali");
  assert.equal(details.no_matrik, "M-1");
  assert.equal(details.jenis_permohonan, "PULANG_BERMALAM");
  assert.equal(details.actor_role, "WARDEN");
  assert.equal(details.mode, "REMOTE_NO_GUARD");
  assert.ok(details.masa_keluar);

  const retry = fixture.database.prepare(
    "SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id = 'REQ-1'"
  ).get();

  assert.ok(retry);
  assert.equal(retry.request_id, "REQ-1");
  assert.equal(Number(retry.attempts), 1);
  assert.match(retry.last_error, /mirror configuration unavailable/i);
});

test("D1 Warden No-Guard duplicate confirmation is idempotent", async () => {
  const fixture = createFixture();

  const first = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(first.status, 200);

  const firstBody = await first.json();
  const firstCheckoutAt = firstBody.data.masa_keluar;

  const second = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(second.status, 200);

  const secondBody = await second.json();

  assert.equal(secondBody.data.status, "KELUAR");
  assert.equal(secondBody.data.masa_keluar, firstCheckoutAt);

  const auditCount = fixture.database.prepare(
    `SELECT COUNT(*) AS total
     FROM AUDIT_LOG
     WHERE request_id = 'REQ-1'
       AND action = 'WARDEN_REMOTE_CHECKOUT'`
  ).get();

  assert.equal(Number(auditCount.total), 1);
});

test("D1 Warden No-Guard checkout requires pending Student confirmation request", async () => {
  const fixture = createFixture();

  fixture.database.prepare(
    `DELETE FROM AUDIT_LOG
     WHERE request_id = 'REQ-1'
       AND action = 'DEPARTURE_CONFIRMATION_REQUESTED'`
  ).run();

  const response = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(response.status, 409);

  const body = await response.json();

  assert.equal(body.ok, false);
  assert.equal(body.code, "DEPARTURE_CONFIRMATION_NOT_PENDING");

  const stored = fixture.database.prepare(
    "SELECT status, masa_keluar FROM OUTING_REQUESTS WHERE request_id = 'REQ-1'"
  ).get();

  assert.equal(stored.status, "DILULUSKAN_WARDEN");
  assert.equal(stored.masa_keluar, null);
});

test("D1 Warden No-Guard feature gate fails closed", async () => {
  const fixture = createFixture("false");

  const response = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(response.status, 403);

  const body = await response.json();

  assert.equal(body.ok, false);
  assert.equal(body.code, "NO_GUARD_DEPARTURE_DISABLED");

  const stored = fixture.database.prepare(
    "SELECT status, masa_keluar FROM OUTING_REQUESTS WHERE request_id = 'REQ-1'"
  ).get();

  assert.equal(stored.status, "DILULUSKAN_WARDEN");
  assert.equal(stored.masa_keluar, null);
});
