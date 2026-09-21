import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { handleStudentCancellation } from "../proxy/staging-student-cancellation.js";

test("cancelStudentRequest preserves production transition, audit, response and Telegram contract", async () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`
    CREATE TABLE STUDENTS (student_id TEXT PRIMARY KEY, no_matrik TEXT, nama TEXT, status TEXT);
    CREATE TABLE OUTING_REQUESTS (
      request_id TEXT PRIMARY KEY, student_id TEXT, no_matrik TEXT, nama TEXT,
      jenis_permohonan TEXT, status TEXT, warden_approve_by TEXT,
      sebab_batal_pelajar TEXT, masa_batal_pelajar TEXT, dibatalkan_oleh TEXT
    );
    CREATE TABLE OUTING_TYPES (type_code TEXT PRIMARY KEY, display_name TEXT);
    CREATE TABLE WARDENS (warden_id TEXT PRIMARY KEY, nama TEXT);
    CREATE TABLE AUDIT_LOG (
      timestamp TEXT, action TEXT, request_id TEXT, user_role TEXT,
      user_name TEXT, details TEXT, entity_type TEXT, entity_id TEXT
    );
    INSERT INTO STUDENTS VALUES ('STU-1','M-1','Ali','Aktif');
    INSERT INTO OUTING_REQUESTS VALUES
      ('REQ-1','STU-1','M-1','Ali','PULANG_BERMALAM','DILULUSKAN_WARDEN','Pegawai HEP',NULL,NULL,NULL);
    INSERT INTO OUTING_TYPES VALUES ('PULANG_BERMALAM','Pulang Bermalam');
    INSERT INTO WARDENS VALUES ('HEP-1','Pegawai HEP');
  `);
  const DB = {
    prepare(sql) {
      const statement = values => ({
        bind: (...next) => statement(next),
        first: async () => database.prepare(sql).get(...values) || null,
        all: async () => ({ results: database.prepare(sql).all(...values) }),
        run: async () => {
          const result = database.prepare(sql).run(...values);
          return { success: true, meta: { changes: Number(result.changes || 0) } };
        }
      });
      return statement([]);
    }
  };
  const telegram = [];
  const request = new Request("https://staging.invalid/api/d1/cancelStudentRequest", {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "cancelStudentRequest",
      request_id: "REQ-1",
      student_id: "STU-1",
      no_matrik: "M-1",
      sebab_batal_pelajar: "  Urusan keluarga  "
    })
  });
  const response = await handleStudentCancellation(request, {
    DB,
    TELEGRAM_ENABLED: "1",
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_CHAT_ID: "test-chat"
  }, new Headers({ "Content-Type": "application/json" }), {
    now: () => new Date("2026-09-21T02:03:04Z"),
    fetchImpl: async (_url, init) => {
      telegram.push(JSON.parse(init.body));
      return new Response("{}", { status: 200 });
    }
  });

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.deepEqual({
    status: body.data.status,
    reason: body.data.sebab_batal_pelajar,
    cancelledAt: body.data.masa_batal_pelajar,
    actor: body.data.dibatalkan_oleh
  }, {
    status: "DIBATALKAN_PELAJAR",
    reason: "Urusan keluarga",
    cancelledAt: "2026-09-21 10:03:04",
    actor: "PELAJAR"
  });
  const stored = database.prepare("SELECT * FROM OUTING_REQUESTS WHERE request_id='REQ-1'").get();
  assert.equal(stored.status, "DIBATALKAN_PELAJAR");
  const audit = database.prepare("SELECT * FROM AUDIT_LOG").get();
  assert.equal(audit.action, "CANCEL_STUDENT_REQUEST");
  assert.equal(audit.user_role, "Student");
  assert.deepEqual(JSON.parse(audit.details), {
    student_name: "Ali",
    no_matrik: "M-1",
    jenis_permohonan: "PULANG_BERMALAM",
    status_sebelum: "DILULUSKAN_WARDEN",
    sebab_batal_pelajar: "Urusan keluarga"
  });
  assert.equal(telegram.length, 1);
  assert.match(telegram[0].text, /^🚫 PERMOHONAN DIBATALKAN PELAJAR/);
  assert.match(telegram[0].text, /Status sebelum batal: Diluluskan HEP/);
});
