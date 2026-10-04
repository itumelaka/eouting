import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mirrorOutingRequestToSheets, reconcileMirrorRetryQueue } from "../proxy/staging-worker-base.js";
import stagingWorker from "../proxy/staging-worker.js";
import { handleStudentCancellation } from "../proxy/staging-student-cancellation.js";

function fixture() {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE STUDENTS (student_id TEXT, no_matrik TEXT, nama TEXT, status TEXT);
    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY, student_id TEXT, no_matrik TEXT, nama TEXT,
      jenis_permohonan TEXT, status TEXT, sebab_batal_pelajar TEXT,
      masa_batal_pelajar TEXT, dibatalkan_oleh TEXT
    );
    CREATE TABLE AUDIT_LOG (
      timestamp TEXT, action TEXT, request_id TEXT, user_role TEXT,
      user_name TEXT, details TEXT, entity_type TEXT, entity_id TEXT
    );
    CREATE TABLE MIRROR_RETRY_QUEUE (
      request_id TEXT PRIMARY KEY, attempts INTEGER NOT NULL,
      first_failed_at TEXT NOT NULL, last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL, last_error TEXT, updated_at TEXT NOT NULL
    );
    INSERT INTO STUDENTS VALUES ('TEST-STUDENT', 'TEST-MATRIC', 'Test Student', 'Aktif');
    INSERT INTO OUTING_REQUESTS VALUES
      ('TEST-REQUEST', 'TEST-STUDENT', 'TEST-MATRIC', 'Test Student',
       'OUTING_BIASA', 'MENUNGGU_KELULUSAN', '', '', '');
    INSERT INTO MIRROR_RETRY_QUEUE VALUES
      ('TEST-EXISTING', 3, '2026-09-01 10:00:00', '2026-09-01 10:02:00',
       '2026-09-01 10:03:00', 'existing failure', '2026-09-01 10:02:00');
  `);
  const DB = { prepare(sql) {
    const statement = (values = []) => ({
      bind: (...next) => statement(next),
      first: async () => database.prepare(sql).get(...values) || null,
      all: async () => ({ results: database.prepare(sql).all(...values) }),
      run: async () => ({ meta: { changes: Number(database.prepare(sql).run(...values).changes) } })
    });
    return statement();
  } };
  return { database, DB };
}

test("disabled direct mirror cannot fetch, even without upstream configuration", async () => {
  let calls = 0;
  for (const flag of ["false", false]) {
    await assert.rejects(mirrorOutingRequestToSheets(
      { OPERATIONAL_MIRROR_ENABLED: flag }, { request_id: "TEST-REQUEST" },
      async () => { calls++; throw new Error("Forbidden fetch"); }
    ), { code: "OPERATIONAL_MIRROR_DISABLED" });
  }
  assert.equal(calls, 0);
});

test("unspecified and enabled environments still send direct mirror", async () => {
  for (const flag of [undefined, "true"]) {
    let calls = 0;
    const result = await mirrorOutingRequestToSheets({
      OPERATIONAL_MIRROR_ENABLED: flag,
      GAS_UPSTREAM_URL: "https://script.google.com/macros/s/TEST/exec",
      D1_MIRROR_SECRET: "test-only"
    }, { request_id: "TEST-REQUEST" }, async (_url, init) => {
      calls++;
      const body = JSON.parse(init.body);
      assert.equal(body.action, "mirrorOutingRequestFromD1");
      return new Response(JSON.stringify({ ok: true, data: { mirrored: true } }));
    });
    assert.equal(calls, 1);
    assert.equal(result.mirrored, true);
  }
});

test("disabled reconciliation performs no DB access or injected mirror call", async () => {
  const result = await reconcileMirrorRetryQueue({
    OPERATIONAL_MIRROR_ENABLED: "false",
    DB: { prepare() { assert.fail("Disabled reconciliation must not read or mutate DB"); } }
  }, { mirror() { assert.fail("Disabled reconciliation must not send mirror"); } });
  assert.deepEqual(result, { processed: 0, succeeded: 0, failed: 0,
    skipped: true, reason: "OPERATIONAL_MIRROR_DISABLED" });
});

test("actual scheduled handler retains due and orphan queue rows when disabled", async () => {
  const { database, DB } = fixture();
  try {
    database.exec(`INSERT INTO MIRROR_RETRY_QUEUE VALUES
      ('TEST-REQUEST', 1, '2026-09-01 10:00:00', '2026-09-01 10:00:00',
       '2026-09-01 10:01:00', 'existing failure', '2026-09-01 10:00:00')`);
    const before = database.prepare("SELECT * FROM MIRROR_RETRY_QUEUE").all();
    const tasks = [];
    await stagingWorker.scheduled({ cron: "*/5 * * * *" }, {
      OPERATIONAL_MIRROR_ENABLED: "false", DB
    }, { waitUntil(task) { tasks.push(task); } });
    await Promise.all(tasks);
    assert.equal(tasks.length, 1);
    assert.deepEqual(database.prepare("SELECT * FROM MIRROR_RETRY_QUEUE").all(), before);
  } finally { database.close(); }
});

test("disabled mirror preserves successful D1 mutation and audit, queues new request asynchronously", async () => {
  const { database, DB } = fixture();
  try {
    const existing = database.prepare("SELECT * FROM MIRROR_RETRY_QUEUE").all();
    const tasks = [];
    let fetches = 0;
    const response = await handleStudentCancellation(new Request("https://staging.invalid/api/d1/cancelStudentRequest", {
      method: "POST", body: JSON.stringify({ request_id: "TEST-REQUEST",
        student_id: "TEST-STUDENT", no_matrik: "TEST-MATRIC", sebab_batal_pelajar: "Test reason" })
    }), { DB, OPERATIONAL_MIRROR_ENABLED: "false", TELEGRAM_ENABLED: "0" }, new Headers(), {
      now: () => new Date("2026-10-04T04:00:00Z"),
      fetchImpl: async () => { fetches++; throw new Error("Forbidden fetch"); },
      context: { waitUntil(task) { tasks.push(task); } }
    });
    await Promise.all(tasks);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.status, "DIBATALKAN_PELAJAR");
    assert.equal(database.prepare("SELECT status FROM OUTING_REQUESTS").get().status, "DIBATALKAN_PELAJAR");
    assert.equal(database.prepare("SELECT COUNT(*) AS n FROM AUDIT_LOG WHERE action='CANCEL_STUDENT_REQUEST'").get().n, 1);
    assert.equal(fetches, 0);
    const queued = database.prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id='TEST-REQUEST'").get();
    assert.equal(queued.attempts, 1);
    assert.equal(queued.last_error, "Operational mirror disabled");
    assert.equal(queued.next_attempt_at, "2026-10-04 12:01:00");
    assert.deepEqual(database.prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id='TEST-EXISTING'").all(), existing);
    await reconcileMirrorRetryQueue({ DB, OPERATIONAL_MIRROR_ENABLED: "false" });
    assert.deepEqual(database.prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id='TEST-REQUEST'").get(), queued);
  } finally { database.close(); }
});
