import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { enqueueMirrorRetry, reconcileMirrorRetryQueue } from "../proxy/staging-worker-base.js";

test("enqueueMirrorRetry creates durable retry state for failed Sheets mirror", async () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE MIRROR_RETRY_QUEUE (
      request_id TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      first_failed_at TEXT NOT NULL,
      last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const DB = {
    prepare(sql) {
      const statement = values => ({
        bind: (...next) => statement(next),
        first: async () => database.prepare(sql).get(...values) || null,
        run: async () => {
          const result = database.prepare(sql).run(...values);
          return {
            success: true,
            meta: { changes: Number(result.changes || 0) }
          };
        }
      });

      return statement([]);
    }
  };

  const now = new Date("2026-09-22T08:00:00Z");

  await enqueueMirrorRetry(
    { DB },
    "REQ-RETRY-1",
    new Error("D1 to Sheets mirror upstream failed"),
    { now: () => now }
  );

  const queued = database
    .prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id = ?")
    .get("REQ-RETRY-1");

  assert.equal(queued.request_id, "REQ-RETRY-1");
  assert.equal(queued.attempts, 1);
  assert.equal(queued.first_failed_at, "2026-09-22 16:00:00");
  assert.equal(queued.last_attempt_at, "2026-09-22 16:00:00");
  assert.equal(queued.next_attempt_at, "2026-09-22 16:01:00");
  assert.equal(queued.last_error, "D1 to Sheets mirror upstream failed");
  assert.equal(queued.updated_at, "2026-09-22 16:00:00");
});

test("enqueueMirrorRetry increments attempts and preserves first_failed_at", async () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE MIRROR_RETRY_QUEUE (
      request_id TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      first_failed_at TEXT NOT NULL,
      last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const DB = {
    prepare(sql) {
      const statement = values => ({
        bind: (...next) => statement(next),
        first: async () => database.prepare(sql).get(...values) || null,
        run: async () => {
          const result = database.prepare(sql).run(...values);
          return {
            success: true,
            meta: { changes: Number(result.changes || 0) }
          };
        }
      });

      return statement([]);
    }
  };

  await enqueueMirrorRetry(
    { DB },
    "REQ-RETRY-2",
    new Error("first failure"),
    { now: () => new Date("2026-09-22T08:00:00Z") }
  );

  await enqueueMirrorRetry(
    { DB },
    "REQ-RETRY-2",
    new Error("second failure"),
    { now: () => new Date("2026-09-22T08:05:00Z") }
  );

  const queued = database
    .prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id = ?")
    .get("REQ-RETRY-2");

  assert.equal(queued.attempts, 2);
  assert.equal(queued.first_failed_at, "2026-09-22 16:00:00");
  assert.equal(queued.last_attempt_at, "2026-09-22 16:05:00");
  assert.equal(queued.next_attempt_at, "2026-09-22 16:06:00");
  assert.equal(queued.last_error, "second failure");
  assert.equal(queued.updated_at, "2026-09-22 16:05:00");
});

test("reconcileMirrorRetryQueue mirrors latest OUTING_REQUESTS state and removes successful queue row", async () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE MIRROR_RETRY_QUEUE (
      request_id TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      first_failed_at TEXT NOT NULL,
      last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY,
      status TEXT,
      nama TEXT
    );

    INSERT INTO MIRROR_RETRY_QUEUE (
      request_id,
      attempts,
      first_failed_at,
      last_attempt_at,
      next_attempt_at,
      last_error,
      updated_at
    ) VALUES (
      'REQ-RECON-1',
      1,
      '2026-09-22 16:00:00',
      '2026-09-22 16:00:00',
      '2026-09-22 16:01:00',
      'mirror failed',
      '2026-09-22 16:00:00'
    );

    INSERT INTO OUTING_REQUESTS (
      request_id,
      status,
      nama
    ) VALUES (
      'REQ-RECON-1',
      'SELESAI',
      'Pelajar Terkini'
    );
  `);

  const DB = {
    prepare(sql) {
      const statement = values => ({
        bind: (...next) => statement(next),
        first: async () => database.prepare(sql).get(...values) || null,
        all: async () => ({
          results: database.prepare(sql).all(...values)
        }),
        run: async () => {
          const result = database.prepare(sql).run(...values);
          return {
            success: true,
            meta: { changes: Number(result.changes || 0) }
          };
        }
      });

      return statement([]);
    }
  };

  const mirrored = [];

  const result = await reconcileMirrorRetryQueue(
    { DB },
    {
      now: () => new Date("2026-09-22T08:02:00Z"),
      mirror: async (_env, record) => {
        mirrored.push(record);
      }
    }
  );

  assert.equal(result.processed, 1);
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 0);

  assert.equal(mirrored.length, 1);
  assert.equal(mirrored[0].request_id, "REQ-RECON-1");
  assert.equal(mirrored[0].status, "SELESAI");
  assert.equal(mirrored[0].nama, "Pelajar Terkini");

  const remaining = database
    .prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id = ?")
    .get("REQ-RECON-1");

  assert.equal(remaining, undefined);
});

test("reconcileMirrorRetryQueue keeps failed row and increments retry metadata", async () => {
  const database = new DatabaseSync(":memory:");

  database.exec(`
    CREATE TABLE MIRROR_RETRY_QUEUE (
      request_id TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      first_failed_at TEXT NOT NULL,
      last_attempt_at TEXT,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY,
      status TEXT,
      nama TEXT
    );

    INSERT INTO MIRROR_RETRY_QUEUE (
      request_id,
      attempts,
      first_failed_at,
      last_attempt_at,
      next_attempt_at,
      last_error,
      updated_at
    ) VALUES (
      'REQ-RECON-FAIL',
      1,
      '2026-09-22 16:00:00',
      '2026-09-22 16:00:00',
      '2026-09-22 16:01:00',
      'first failure',
      '2026-09-22 16:00:00'
    );

    INSERT INTO OUTING_REQUESTS (
      request_id,
      status,
      nama
    ) VALUES (
      'REQ-RECON-FAIL',
      'KELUAR',
      'Pelajar Retry'
    );
  `);

  const DB = {
    prepare(sql) {
      const statement = values => ({
        bind: (...next) => statement(next),
        first: async () => database.prepare(sql).get(...values) || null,
        all: async () => ({
          results: database.prepare(sql).all(...values)
        }),
        run: async () => {
          const result = database.prepare(sql).run(...values);
          return {
            success: true,
            meta: { changes: Number(result.changes || 0) }
          };
        }
      });

      return statement([]);
    }
  };

  const result = await reconcileMirrorRetryQueue(
    { DB },
    {
      now: () => new Date("2026-09-22T08:05:00Z"),
      mirror: async () => {
        throw new Error("still unavailable");
      }
    }
  );

  assert.equal(result.processed, 1);
  assert.equal(result.succeeded, 0);
  assert.equal(result.failed, 1);

  const queued = database
    .prepare("SELECT * FROM MIRROR_RETRY_QUEUE WHERE request_id = ?")
    .get("REQ-RECON-FAIL");

  assert.equal(queued.attempts, 2);
  assert.equal(queued.first_failed_at, "2026-09-22 16:00:00");
  assert.equal(queued.last_attempt_at, "2026-09-22 16:05:00");
  assert.equal(queued.next_attempt_at, "2026-09-22 16:06:00");
  assert.equal(queued.last_error, "still unavailable");
});
