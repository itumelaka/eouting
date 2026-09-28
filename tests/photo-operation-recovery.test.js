const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto, createHmac } = require("node:crypto");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "../proxy/staging-worker-base.js"), "utf8");
const secret = "LOCAL_RECOVERY_TEST_SECRET";
const oldId = "PRIVATE_OLD_DRIVE_ID";
const newId = "PRIVATE_NEW_DRIVE_ID";
const oldTime = "2026-09-23 10:00:00";
const newTime = "2026-09-23 11:00:00";

function fixture(options = {}) {
  const operation = {
    operation_id: options.type === "REMOVE" ? "phr_" + "a".repeat(40) : "phu_" + "b".repeat(40),
    student_id: "QA-001", operation_type: options.type || "UPLOAD",
    status: options.status || "CREATED", expected_old_file_id: oldId,
    expected_old_photo_updated_at: oldTime,
    new_file_id: options.type === "REMOVE" ? null : newId,
    new_photo_updated_at: options.type === "REMOVE" ? null : newTime,
    attempts: 1, last_error: null, updated_at: "2026-09-23 12:00:00"
  };
  const student = { student_id: "QA-001", photo_file_id: options.studentId ?? oldId,
    photo_updated_at: options.studentTime ?? oldTime };
  const audits = options.audits || [];
  const calls = { probe: 0, cas: 0, mutation: 0, logs: [] };
  const result = (changes = 1) => ({ success: true, meta: { changes } });
  const statement = (sql, values = []) => ({
    sql, values, bind(...next) { return statement(sql, next); },
    async first() {
      if (sql.includes("FROM ADMIN_USERS")) return options.authFail ? null : { admin_id: "ADMIN-QA", nama_admin: "QA" };
      if (sql.includes("FROM PHOTO_OPERATIONS")) return values[0] === operation.operation_id ? { ...operation } : null;
      if (sql.includes("FROM STUDENTS")) return values[0] === student.student_id ? { ...student } : null;
      if (sql.includes("FROM AUDIT_LOG")) return audits.find(row => row.request_id === values[0]) || null;
      throw Error("Unexpected first: " + sql);
    },
    async run() {
      if (sql.includes("UPDATE STUDENTS")) {
        calls.cas++;
        if (options.casConflict || student.photo_file_id !== values[3] || student.photo_updated_at !== values[4]) return result(0);
        student.photo_file_id = values[0]; student.photo_updated_at = values[1]; return result();
      }
      if (sql.includes("UPDATE PHOTO_OPERATIONS")) {
        if (options.transitionConflict || operation.status !== values[values.length - 2] ||
            operation.updated_at !== values[values.length - 1]) return result(0);
        operation.status = values[0]; operation.new_file_id = values[1];
        operation.new_photo_updated_at = values[2]; operation.last_error = values[3];
        operation.updated_at = values[4];
        return result();
      }
      throw Error("Unexpected run: " + sql);
    }
  });
  const DB = { prepare: sql => statement(sql), async batch(statements) {
    if (options.batchFail) throw Error("private database failure " + oldId);
    assert.equal(statements.length, 2);
    if (options.transitionConflict || operation.status !== "CREATED") return [result(0), result(0)];
    operation.status = "COMPLETED"; operation.last_error = null;
    const action = operation.operation_type === "UPLOAD" ? "UPDATE_STUDENT_PROFILE_PHOTO" : "REMOVE_STUDENT_PROFILE_PHOTO";
    if (!audits.some(row => row.request_id === operation.operation_id && row.action === action)) {
      audits.push({ request_id: operation.operation_id, action, entity_id: student.student_id, details: "" });
      return [result(), result()];
    }
    return [result(), result(0)];
  } };
  const context = vm.createContext({ URL, Headers, Response, TextEncoder, TextDecoder, Uint8Array,
    AbortController, crypto: webcrypto, setTimeout, clearTimeout,
    console: { info: text => calls.logs.push(text), error: text => calls.logs.push(text) },
    fetch: async (_url, init) => {
      calls.probe++;
      const envelope = JSON.parse(init.body);
      assert.equal(envelope.action, "probeTrustedPhotoOperation");
      assert.equal(envelope.payload.operation_id, operation.operation_id);
      const state = options.probeState || (operation.operation_type === "UPLOAD" ? "FOUND_UNIQUE" : "TRASHED_CONFIRMED");
      const data = { operation_id: operation.operation_id, student_id: student.student_id,
        operation_type: operation.operation_type, state,
        photo_file_id: state === "FOUND_UNIQUE" ? newId : "",
        photo_updated_at: state === "FOUND_UNIQUE" ? newTime : "" };
      const canonical = JSON.stringify(data);
      const signature = createHmac("sha256", secret)
        .update("photo-recovery-response\n" + envelope.auth.nonce + "\n" + canonical, "utf8").digest("hex");
      return new Response(JSON.stringify({ ok: true, data: { data,
        signature: options.badSignature ? "0".repeat(64) : signature } }),
        { headers: { "Content-Type": "application/json" } });
    } });
  vm.runInContext(source.replace(/export\s*\{[\s\S]*?\};?\s*$/, "this.handle = handleRequest;"), context);
  const run = async (action = "recoverPhotoOperation", extra = {}) => {
    const response = await context.handle(new Request("https://proxy.test/api/d1/" + action, {
      method: "POST", headers: { Origin: "http://localhost:8000" },
      body: JSON.stringify({ admin_id: "ADMIN-QA", pin: "TEST_PIN", operation_id: operation.operation_id, ...extra })
    }), { STAGING_ORIGIN: "http://localhost:8000", DB,
      PHOTO_ADAPTER_UPSTREAM_URL: "https://script.google.com/macros/s/QA_ADAPTER/exec",
      PHOTO_ADAPTER_KEY_ID: "qa", PHOTO_ADAPTER_SECRET: secret });
    return { response, body: await response.json() };
  };
  return { run, operation, student, audits, calls };
}

test("recovery: CAS already succeeded but audit batch failed; manual retry completes once", async () => {
  const f = fixture({ studentId: newId, studentTime: newTime });
  const first = await f.run();
  assert.equal(first.response.status, 200);
  assert.equal(f.calls.cas, 0);
  assert.equal(f.operation.status, "COMPLETED");
  assert.equal(f.audits.length, 1);
  const second = await f.run();
  assert.equal(second.response.status, 200);
  assert.equal(f.audits.length, 1);
  assert.equal(f.calls.cas, 0);
});

test("recovery: failed audit batch after CAS is resumable without a second CAS", async () => {
  const options = { status: "PENDING", batchFail: true };
  const f = fixture(options);
  const failed = await f.run();
  assert.equal(failed.response.status, 500);
  assert.equal(f.student.photo_file_id, newId);
  assert.equal(f.operation.status, "CREATED");
  assert.equal(f.audits.length, 0);
  options.batchFail = false;
  const recovered = await f.run();
  assert.equal(recovered.response.status, 200);
  assert.equal(f.calls.cas, 1);
  assert.equal(f.operation.status, "COMPLETED");
  assert.equal(f.audits.length, 1);
});

test("recovery: PENDING upload with unique file CASes old metadata and completes", async () => {
  const f = fixture({ status: "PENDING" });
  f.operation.new_file_id = null; f.operation.new_photo_updated_at = null;
  const { response } = await f.run();
  assert.equal(response.status, 200);
  assert.equal(f.calls.cas, 1);
  assert.equal(f.student.photo_file_id, newId);
  assert.equal(f.operation.status, "COMPLETED");
});

test("recovery: unrelated D1 metadata is quarantined without CAS", async () => {
  const f = fixture({ studentId: "OTHER_PRIVATE_ID", studentTime: "other" });
  const { response } = await f.run();
  assert.equal(response.status, 409);
  assert.equal(f.operation.status, "RECONCILE_REQUIRED");
  assert.equal(f.calls.cas, 0);
  assert.equal(f.audits.length, 0);
});

test("recovery: REMOVE old + trashed clears once; empty + trashed completes without CAS", async () => {
  for (const alreadyCleared of [false, true]) {
    const f = fixture({ type: "REMOVE", studentId: alreadyCleared ? "" : oldId,
      studentTime: alreadyCleared ? "" : oldTime });
    const { response } = await f.run();
    assert.equal(response.status, 200);
    assert.equal(f.calls.cas, alreadyCleared ? 0 : 1);
    assert.equal(f.student.photo_file_id, "");
    assert.equal(f.operation.status, "COMPLETED");
    assert.equal(f.audits.length, 1);
  }
});

test("recovery: active/unknown REMOVE and missing/ambiguous/unknown UPLOAD fail closed", async () => {
  for (const [type, state] of [["REMOVE", "ACTIVE_CONFIRMED"], ["REMOVE", "UNKNOWN"],
    ["UPLOAD", "NOT_FOUND"], ["UPLOAD", "AMBIGUOUS"], ["UPLOAD", "UNKNOWN"]]) {
    const f = fixture({ type, probeState: state });
    const { response } = await f.run();
    assert.notEqual(response.status, 200, type + state);
    assert.equal(f.calls.cas, 0);
    assert.equal(f.audits.length, 0);
    assert.equal(f.student.photo_file_id, oldId);
  }
});

test("recovery: completed wrong postcondition and conditional conflict do not report success", async () => {
  for (const options of [{ status: "COMPLETED", studentId: oldId },
    { transitionConflict: true }]) {
    const f = fixture(options);
    const { response } = await f.run();
    assert.notEqual(response.status, 200);
    assert.equal(f.calls.cas, 0);
  }
});

test("recovery: inspection and errors expose no Drive ID or secret", async () => {
  const f = fixture({ probeState: "UNKNOWN" });
  const inspection = await f.run("inspectPhotoOperation");
  assert.equal(inspection.response.status, 200);
  assert.equal(f.calls.probe, 0);
  await f.run();
  const text = JSON.stringify(inspection.body) + JSON.stringify(f.calls.logs) + JSON.stringify(f.audits);
  assert.doesNotMatch(text, new RegExp(oldId + "|" + newId + "|" + secret));
});

test("recovery: requires admin and rejects browser-supplied Drive identifiers", async () => {
  const denied = fixture({ authFail: true });
  assert.equal((await denied.run()).response.status, 401);
  assert.equal(denied.calls.probe, 0);
  const fixtureWithExtra = fixture();
  assert.equal((await fixtureWithExtra.run("recoverPhotoOperation", { photo_file_id: newId })).response.status, 400);
  assert.equal(fixtureWithExtra.calls.probe, 0);
});

test("recovery: unsigned or mismatched probe response cannot change D1", async () => {
  const f = fixture({ badSignature: true });
  const { response } = await f.run();
  assert.equal(response.status, 409);
  assert.equal(f.calls.cas, 0);
  assert.equal(f.audits.length, 0);
});
