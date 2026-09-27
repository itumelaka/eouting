const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { createHash, createHmac } = require("node:crypto");
const test = require("node:test");

const gas = fs.readFileSync(path.join(__dirname, "../gas/Code.gs"), "utf8");
const adapterSource = gas.slice(gas.indexOf("// Photo adapter v1 signs UTF-8 fields"));
const driveHelpers = gas.slice(gas.indexOf("function getProfilePhotoFolder_"),
  gas.indexOf("function safelyTrashProfilePhoto_"));
const secret = "STAGING_TEST_PHOTO_SECRET";
const folderId = "EXPECTED_FOLDER";

function canonical(payload) {
  return JSON.stringify({ photo_variant: payload.photo_variant, entries: payload.entries.map(entry => ({
    student_id: entry.student_id, photo_file_id: entry.photo_file_id,
    photo_updated_at: entry.photo_updated_at
  })) });
}

function signed(payload = { photo_variant: "full", entries: [{
  student_id: "STU-001", photo_file_id: "DRIVE-001", photo_updated_at: "2026-09-23 13:00:00"
}] }, overrides = {}) {
  const auth = { version: "1", key_id: "staging1", timestamp: Math.floor(Date.now() / 1000),
    nonce: "12345678-1234-4234-8234-123456789abc", ...overrides };
  const hash = createHash("sha256").update(canonical(payload), "utf8").digest("hex");
  const message = [auth.version, auth.key_id, auth.timestamp, auth.nonce,
    "getTrustedProfilePhotos", hash].join("\n");
  auth.signature = createHmac("sha256", secret).update(message, "utf8").digest("hex");
  return { action: "getTrustedProfilePhotos", payload, auth };
}

function runtime(options = {}) {
  const cache = new Map();
  const calls = { sheet: 0, content: 0, mutation: 0, files: 0 };
  const file = { getParents: () => {
    let done = false;
    return { hasNext: () => !done && !options.wrongFolder,
      next: () => { done = true; return { getId: () => folderId }; } };
  }, isTrashed: () => !!options.trashed, getMimeType: () => options.mime || "image/jpeg",
  getBlob: () => { calls.content++; return { getBytes: () => [1, 2, 3] }; } };
  const context = vm.createContext({
    Date, JSON, String, Number, Array, Object, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key =>
      key === "PROFILE_PHOTO_FOLDER_ID" ? folderId : key === "PHOTO_ADAPTER_KEY_staging1" ?
        (options.wrongSecret || secret) : null }) },
    Utilities: { Charset: { UTF_8: "utf8" }, DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_algorithm, value) => [...createHash("sha256").update(value, "utf8").digest()],
      computeHmacSha256Signature: (value, key) => [...createHmac("sha256", key).update(value, "utf8").digest()],
      base64Encode: bytes => Buffer.from(bytes).toString("base64") },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    DriveApp: { getFolderById: () => ({ getName: () => "photos", getId: () => folderId }),
      getFileById: () => { calls.files++; if (options.missingFile) throw Error("PRIVATE DRIVE ID"); return file; } },
    getSheet_: () => { calls.sheet++; throw Error("Sheet access prohibited"); },
    jsonResponse: data => ({ ok: true, data }), errorResponse: error => ({ ok: false, error }),
    fetchProfilePhotoThumbnails_: () => []
  });
  vm.runInContext(driveHelpers + adapterSource, context);
  return { context, calls };
}

test("trusted read accepts valid HMAC, uses signed Drive ID and never reads Sheet", () => {
  const r = runtime();
  const result = r.context.getTrustedProfilePhotos_(signed());
  assert.equal(result.ok, true);
  assert.equal(result.data.photos.length, 1);
  assert.match(result.data.photos[0].photo_data_uri, /^data:image\/jpeg;base64,/);
  assert.equal(r.calls.sheet, 0);
  assert.equal(r.calls.files, 1);
  assert.equal(r.calls.mutation, 0);
});

test("trusted read rejects wrong secret, payload tamper, extra fields and action tamper before Drive", () => {
  for (const kind of ["secret", "payload", "extra", "action"]) {
    const r = runtime(kind === "secret" ? { wrongSecret: "WRONG_SECRET" } : {});
    const request = signed();
    if (kind === "payload") request.payload.entries[0].photo_file_id = "OTHER_FILE";
    if (kind === "extra") request.payload.entries[0].untrusted = "OTHER_FILE";
    if (kind === "action") request.action = "otherAction";
    const result = r.context.getTrustedProfilePhotos_(request);
    assert.equal(result.ok, false, kind);
    assert.equal(r.calls.files, 0, kind);
    assert.doesNotMatch(JSON.stringify(result), /DRIVE-001|OTHER_FILE|STAGING_TEST_PHOTO_SECRET/);
  }
});

test("trusted read rejects past and future timestamps beyond 60 seconds", () => {
  for (const offset of [-61, 61]) {
    const r = runtime();
    const result = r.context.getTrustedProfilePhotos_(signed(undefined, {
      timestamp: Math.floor(Date.now() / 1000) + offset }));
    assert.equal(result.error, "TRUSTED_REQUEST_EXPIRED");
    assert.equal(r.calls.files, 0);
  }
});

test("trusted read rejects replay but accepts a different signed nonce", () => {
  const r = runtime();
  const first = signed();
  assert.equal(r.context.getTrustedProfilePhotos_(first).ok, true);
  assert.equal(r.context.getTrustedProfilePhotos_(first).error, "TRUSTED_REQUEST_REPLAY");
  assert.equal(r.context.getTrustedProfilePhotos_(signed(undefined, {
    nonce: "12345678-1234-4234-8234-123456789abd" })).ok, true);
  assert.equal(r.calls.files, 2);
});

test("canonical payload ignores object insertion order while binding every field", () => {
  const a = { photo_variant: "full", entries: [{ student_id: "S", photo_file_id: "F", photo_updated_at: "T" }] };
  const b = { entries: [{ photo_updated_at: "T", photo_file_id: "F", student_id: "S" }], photo_variant: "full" };
  assert.equal(canonical(a), canonical(b));
  const r = runtime();
  assert.equal(r.context.canonicalTrustedPhotoPayload_(b), canonical(a));
  const request = signed(a);
  request.payload = b;
  assert.equal(r.context.getTrustedProfilePhotos_(request).ok, true);
});

test("trusted read excludes wrong-folder, trashed, unsupported MIME and unavailable files", () => {
  for (const option of [{ wrongFolder: true }, { trashed: true }, { mime: "text/html" }, { missingFile: true }]) {
    const r = runtime(option);
    assert.equal(r.context.getTrustedProfilePhotos_(signed()).data.photos.length, 0);
    assert.equal(r.calls.content, 0);
    assert.equal(r.calls.sheet, 0);
  }
});

test("trusted read enforces batch limit, full-image size and safe failures", () => {
  const r = runtime();
  const entries = Array.from({ length: 101 }, (_, i) => ({ student_id: `S${i}`,
    photo_file_id: `F${i}`, photo_updated_at: "" }));
  assert.equal(r.context.getTrustedProfilePhotos_(signed({ photo_variant: "full", entries })).error,
    "TRUSTED_REQUEST_INVALID");
  assert.equal(r.calls.files, 0);
  const source = gas.slice(gas.indexOf("function getTrustedProfilePhotos_("));
  assert.match(source, /bytes\.length > 800 \* 1024/);
  assert.match(gas, /bytes\.length > 256 \* 1024/);
  assert.doesNotMatch(source, /getSheet_|getRowsAsObjects_|appendRow|setValue|setValues|deleteSheet/);
});
