import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleRequest } from "../proxy/staging-worker-base.js";

function createFixture(featureEnabled = "true") {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE STUDENTS (
      student_id TEXT PRIMARY KEY,
      no_matrik TEXT,
      nama TEXT,
      status TEXT
    );

    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY,
      student_id TEXT,
      no_matrik TEXT,
      nama TEXT,
      jenis_permohonan TEXT,
      status TEXT,
      lokasi TEXT
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

    INSERT INTO STUDENTS VALUES
      ('STU-1', 'M-1', 'Ali', 'Aktif');

    INSERT INTO OUTING_REQUESTS VALUES
      (
        'REQ-1',
        'STU-1',
        'M-1',
        'Ali',
        'PULANG_BERMALAM',
        'DILULUSKAN_WARDEN',
        'Kampung'
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
    "https://staging.invalid/api/d1/requestDepartureConfirmation",
    {
      method: "POST",
      headers: {
        Origin: "http://localhost:8000",
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action: "requestDepartureConfirmation",
        request_id: "REQ-1",
        student_id: "STU-1",
        no_matrik: "M-1"
      })
    }
  );
}

test("D1 Student No-Guard request creates pending audit without changing lifecycle", async () => {
  const fixture = createFixture();

  const response = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  const body = await response.json();
  assert.equal(response.status, 200);

  assert.equal(body.ok, true);
  assert.equal(body.data.request_id, "REQ-1");
  assert.equal(body.data.status, "DILULUSKAN_WARDEN");
  assert.equal(body.data.departure_confirmation_pending, true);
  assert.equal(body.data.no_guard_departure_enabled, true);
  assert.equal(body.data.departure_confirmation_created, true);
  assert.ok(body.data.departure_confirmation_requested_at);

  const stored = fixture.database.prepare(
    "SELECT status FROM OUTING_REQUESTS WHERE request_id = 'REQ-1'"
  ).get();

  assert.equal(stored.status, "DILULUSKAN_WARDEN");

  const audit = fixture.database.prepare(
    "SELECT * FROM AUDIT_LOG WHERE request_id = 'REQ-1'"
  ).get();

  assert.equal(audit.action, "DEPARTURE_CONFIRMATION_REQUESTED");
  assert.equal(audit.user_role, "Student");
  assert.equal(audit.user_name, "Ali");
  assert.equal(audit.entity_type, "OUTING_REQUEST");
  assert.equal(audit.entity_id, "REQ-1");

  assert.deepEqual(JSON.parse(audit.details), {
    student_name: "Ali",
    no_matrik: "M-1",
    jenis_permohonan: "PULANG_BERMALAM",
    mode: "REMOTE_NO_GUARD"
  });
});

test("D1 Student No-Guard duplicate request does not create duplicate audit", async () => {
  const fixture = createFixture();

  const first = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(first.status, 200);

  const second = await handleRequest(
    makeRequest(),
    fixture.env,
    {}
  );

  assert.equal(second.status, 200);

  const body = await second.json();

  assert.equal(body.data.departure_confirmation_pending, true);
  assert.equal(body.data.departure_confirmation_created, false);

  const auditCount = fixture.database.prepare(
    `SELECT COUNT(*) AS total
     FROM AUDIT_LOG
     WHERE request_id = 'REQ-1'
       AND action = 'DEPARTURE_CONFIRMATION_REQUESTED'`
  ).get();

  assert.equal(Number(auditCount.total), 1);
});

test("D1 Student No-Guard feature gate fails closed", async () => {
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

  const auditCount = fixture.database.prepare(
    "SELECT COUNT(*) AS total FROM AUDIT_LOG"
  ).get();

  assert.equal(Number(auditCount.total), 0);
});
