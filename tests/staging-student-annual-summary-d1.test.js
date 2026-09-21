import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import worker from "../proxy/staging-worker.js";

test("D1 annual summary authenticates and returns only the student's current Malaysia-year history", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-12-31T16:30:00Z") });
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`CREATE TABLE STUDENTS (student_id TEXT, no_matrik TEXT, status TEXT);
    CREATE TABLE OUTING_REQUESTS (student_id TEXT, tarikh TEXT, jenis_permohonan TEXT, status TEXT, tujuan TEXT);
    INSERT INTO STUDENTS VALUES ('S1','M1','Aktif'), ('S2','M2','Aktif'), ('S3','M3','Tidak Aktif');`);
  const statuses = ["MENUNGGU_KELULUSAN", "DILULUSKAN_WARDEN", "KELUAR", "SELESAI", "DITOLAK_WARDEN", "DIBATALKAN_PELAJAR"];
  const insert = db.prepare("INSERT INTO OUTING_REQUESTS VALUES (?, ?, 'OUTING_BIASA', ?, 'private')");
  statuses.forEach((status, index) => insert.run("S1", `2027-01-0${index + 1}`, status));
  insert.run("S1", "2027-12-31", "SELESAI");
  insert.run("S1", "2026-12-31", "SELESAI");
  insert.run("S1", "2028-01-01", "SELESAI");
  insert.run("S1", "2027-02-01", "UNKNOWN");
  insert.run("S2", "2027-03-01", "SELESAI");
  let outingQueries = 0;
  const DB = { prepare(sql) {
    if (sql.includes("FROM OUTING_REQUESTS")) outingQueries++;
    return { bind(...values) { return {
      first: async () => db.prepare(sql).get(...values),
      all: async () => ({ results: db.prepare(sql).all(...values) })
    }; } };
  } };
  const call = (payload, method = "POST") => worker.fetch(new Request("https://staging.invalid/api/d1/getStudentAnnualSummary", {
    method, headers: { Origin: "http://localhost:8000", "Content-Type": "text/plain;charset=utf-8" },
    ...(method === "POST" ? { body: JSON.stringify(payload) } : {})
  }), { DB, STAGING_ORIGIN: "http://localhost:8000" });
  for (const payload of [{}, { student_id: "S1", no_matrik: "WRONG" }, { student_id: "S1", no_matrik: "M2" }, { student_id: "S3", no_matrik: "M3" }]) {
    const response = await call(payload);
    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "STUDENT_SESSION_INVALID");
  }
  assert.equal(outingQueries, 0);
  const response = await call({ student_id: " S1 ", no_matrik: " M1 ", year: 2026 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Upstream-Attempts"), "0");
  assert.deepEqual(await response.json(), { ok: true, data: {
    year: 2027, total_outings: 2,
    history_records: [
      { tarikh: "2027-12-31", jenis_permohonan: "OUTING_BIASA", status: "SELESAI" },
      ...statuses.map((status, index) => ({ tarikh: `2027-01-0${index + 1}`, jenis_permohonan: "OUTING_BIASA", status })).reverse()
    ]
  } });
  assert.equal((await call(null, "GET")).status, 405);
  assert.equal((await call(null, "OPTIONS")).status, 204);
});
