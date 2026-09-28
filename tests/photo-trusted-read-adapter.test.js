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
  const calls = { sheet: 0, content: 0, mutation: 0, files: 0, nameLookups: 0, requestedIds: [] };
  const file = { getParents: () => {
    let done = false;
    return { hasNext: () => !done && !options.wrongFolder,
      next: () => { done = true; return { getId: () => folderId }; } };
  }, isTrashed: () => !!options.trashed,
  setTrashed: value => {
    calls.mutation++;
    options.trashed = !!value;
  },
  getMimeType: () => options.mime || "image/jpeg",
  getId: () => "DRIVE-001",
  getDateCreated: () => new Date("2026-09-23T05:00:00Z"),
  getBlob: () => { calls.content++; return { getBytes: () => [1, 2, 3] }; } };
  const context = vm.createContext({
    Date, JSON, String, Number, Array, Object, Error,
    PropertiesService: { getScriptProperties: () => ({ getProperty: key =>
      key === "PROFILE_PHOTO_FOLDER_ID" ? folderId : key === "PHOTO_ADAPTER_KEY_staging1" ?
        (options.wrongSecret || secret) : null }) },
    Utilities: { Charset: { UTF_8: "utf8" }, DigestAlgorithm: { SHA_256: "sha256" },
      computeDigest: (_algorithm, value) => [...createHash("sha256").update(value, "utf8").digest()],
      computeHmacSha256Signature: (value, key) => [...createHmac("sha256", key).update(value, "utf8").digest()],
      base64Encode: bytes => Buffer.from(bytes).toString("base64"),
      formatDate: () => "2026-09-23 13:00:00" },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    DriveApp: { getFolderById: () => ({ getName: () => "photos", getId: () => folderId,
      getFilesByName: () => {
        calls.nameLookups++;
        let index = 0;
        const count = options.fileCount ?? 1;
        return { hasNext: () => index < count, next: () => { index++; return file; } };
      } }),
      getFileById: id => { calls.files++; calls.requestedIds.push(id);
        if (options.missingFile) throw Error("PRIVATE DRIVE ID"); return file; } },
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

function signedProbe(type = "UPLOAD", overrides = {}) {
  const payload = { operation_id: (type === "UPLOAD" ? "phu_" : "phr_") + "a".repeat(40),
    student_id: "STU-001", operation_type: type,
    expected_old_file_id: type === "REMOVE" ? "DRIVE-001" : "" };
  const auth = { version: "1", key_id: "staging1", timestamp: Math.floor(Date.now() / 1000),
    nonce: "32345678-1234-4234-8234-123456789abc", ...overrides };
  const hash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  auth.signature = createHmac("sha256", secret).update([
    auth.version, auth.key_id, auth.timestamp, auth.nonce,
    "probeTrustedPhotoOperation", hash
  ].join("\n"), "utf8").digest("hex");
  return { action: "probeTrustedPhotoOperation", payload, auth };
}

test("recovery probe uses HMAC and metadata only; unique upload result is signed", () => {
  const r = runtime();
  const request = signedProbe();
  const result = r.context.probeTrustedPhotoOperation_(request);
  assert.equal(result.ok, true);
  assert.equal(result.data.data.state, "FOUND_UNIQUE");
  assert.equal(result.data.data.photo_file_id, "DRIVE-001");
  const expected = createHmac("sha256", secret).update(
    "photo-recovery-response\n" + request.auth.nonce + "\n" + JSON.stringify(result.data.data), "utf8")
    .digest("hex");
  assert.equal(result.data.signature, expected);
  assert.equal(r.calls.sheet, 0);
  assert.equal(r.calls.content, 0);
  assert.equal(r.calls.mutation, 0);
});

test("recovery probe distinguishes upload not-found/ambiguous/unknown without mutation", () => {
  for (const [options, state] of [[{ fileCount: 0 }, "NOT_FOUND"],
    [{ fileCount: 2 }, "AMBIGUOUS"], [{ wrongFolder: true }, "UNKNOWN"],
    [{ mime: "text/html" }, "UNKNOWN"]]) {
    const r = runtime(options);
    assert.equal(r.context.probeTrustedPhotoOperation_(signedProbe()).data.data.state, state);
    assert.equal(r.calls.content, 0);
    assert.equal(r.calls.mutation, 0);
  }
});

test("recovery REMOVE probe confirms active/trashed metadata or returns unknown", () => {
  for (const [options, state] of [[{}, "ACTIVE_CONFIRMED"], [{ trashed: true }, "TRASHED_CONFIRMED"],
    [{ missingFile: true }, "UNKNOWN"], [{ wrongFolder: true }, "UNKNOWN"]]) {
    const r = runtime(options);
    const result = r.context.probeTrustedPhotoOperation_(signedProbe("REMOVE"));
    assert.equal(result.data.data.state, state);
    assert.equal(result.data.data.photo_file_id, "");
    assert.equal(r.calls.content, 0);
    assert.equal(r.calls.mutation, 0);
  }
});

test("recovery probe rejects tampered or extra fields before Drive and sanitizes failures", () => {
  for (const change of [request => { request.payload.student_id = "OTHER"; },
    request => { request.payload.photo_file_id = "PRIVATE_ID"; },
    request => { request.action = "removeTrustedProfilePhoto"; }]) {
    const r = runtime();
    const request = signedProbe(); change(request);
    const result = r.context.probeTrustedPhotoOperation_(request);
    assert.equal(result.ok, false);
    assert.equal(r.calls.files + r.calls.nameLookups, 0);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_ID|DRIVE-001|STAGING_TEST_PHOTO_SECRET/);
  }
});

function canonicalRemove(payload) {
  return JSON.stringify({
    operation_id: String(payload.operation_id || ""),
    student_id: String(payload.student_id || ""),
    expected_old_file_id: String(payload.expected_old_file_id || ""),
    expected_old_photo_updated_at: String(payload.expected_old_photo_updated_at || "")
  });
}

function signedRemove(payload = {
  operation_id: "phr_1234567890abcdef1234567890abcdef12345678",
  student_id: "STU-001",
  expected_old_file_id: "DRIVE-001",
  expected_old_photo_updated_at: "2026-09-23 13:00:00"
}, overrides = {}) {
  const auth = {
    version: "1",
    key_id: "staging1",
    timestamp: Math.floor(Date.now() / 1000),
    nonce: "22345678-1234-4234-8234-123456789abc",
    ...overrides
  };

  const hash = createHash("sha256")
    .update(canonicalRemove(payload), "utf8")
    .digest("hex");

  const message = [
    auth.version,
    auth.key_id,
    auth.timestamp,
    auth.nonce,
    "removeTrustedProfilePhoto",
    hash
  ].join("\n");

  auth.signature = createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex");

  return {
    action: "removeTrustedProfilePhoto",
    payload,
    auth
  };
}

function signedCleanup(payload = {
  operation_id: "phu_1234567890abcdef1234567890abcdef12345678",
  student_id: "STU-001",
  expected_old_file_id: "DRIVE-001",
  new_file_id: "DRIVE-NEW"
}, overrides = {}) {
  const auth = { version: "1", key_id: "staging1", timestamp: Math.floor(Date.now() / 1000),
    nonce: "32345678-1234-4234-8234-123456789abc", ...overrides };
  const canonical = JSON.stringify({ operation_id: payload.operation_id, student_id: payload.student_id,
    expected_old_file_id: payload.expected_old_file_id, new_file_id: payload.new_file_id });
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  auth.signature = createHmac("sha256", secret).update([
    auth.version, auth.key_id, auth.timestamp, auth.nonce,
    "cleanupTrustedPreviousProfilePhoto", hash
  ].join("\n"), "utf8").digest("hex");
  return { action: "cleanupTrustedPreviousProfilePhoto", payload, auth };
}

test("trusted previous-photo cleanup trashes only verified old file and signs sanitized result", () => {
  const r = runtime();
  const request = signedCleanup();
  const result = r.context.cleanupTrustedPreviousProfilePhoto_(request);
  assert.equal(result.ok, true);
  assert.equal(result.data.data.cleanup_status, "TRASHED");
  assert.equal(result.data.data.operation_id, request.payload.operation_id);
  assert.equal(result.data.signature, createHmac("sha256", secret).update(
    "photo-cleanup-response\n" + request.auth.nonce + "\n" +
    JSON.stringify(result.data.data), "utf8").digest("hex"));
  assert.equal(r.calls.mutation, 1);
  assert.deepEqual(r.calls.requestedIds, ["DRIVE-001"]);
  assert.equal(r.calls.sheet, 0);
  assert.equal(r.calls.content, 0);
  assert.doesNotMatch(JSON.stringify(result), /DRIVE-001|DRIVE-NEW|STAGING_TEST_PHOTO_SECRET/);
});

test("trusted previous-photo cleanup is idempotent for trashed old file", () => {
  const r = runtime({ trashed: true });
  const result = r.context.cleanupTrustedPreviousProfilePhoto_(signedCleanup());
  assert.equal(result.ok, true);
  assert.equal(result.data.data.cleanup_status, "ALREADY_TRASHED");
  assert.equal(r.calls.mutation, 0);
  assert.equal(r.calls.sheet, 0);
});

test("trusted previous-photo cleanup fails closed for invalid contract, folder, MIME and lookup", () => {
  for (const options of [{ wrongFolder: true }, { mime: "application/pdf" }, { missingFile: true }]) {
    const r = runtime(options);
    const result = r.context.cleanupTrustedPreviousProfilePhoto_(signedCleanup());
    assert.equal(result.ok, false);
    assert.equal(r.calls.mutation, 0);
    assert.equal(r.calls.content, 0);
    assert.equal(r.calls.sheet, 0);
    assert.doesNotMatch(JSON.stringify(result), /DRIVE-001|DRIVE-NEW|STAGING_TEST_PHOTO_SECRET/);
  }
  for (const change of [
    request => { request.payload.new_file_id = request.payload.expected_old_file_id; },
    request => { request.payload.extra = "SECRET"; },
    request => { request.payload.expected_old_file_id = "TAMPERED"; },
    request => { request.payload.operation_id = "phr_1234567890abcdef1234567890abcdef12345678"; }
  ]) {
    const r = runtime();
    const request = signedCleanup(); change(request);
    const result = r.context.cleanupTrustedPreviousProfilePhoto_(request);
    assert.equal(result.ok, false);
    assert.equal(r.calls.files, 0);
    assert.equal(r.calls.mutation, 0);
  }
});

test("trusted remove accepts signed canonical contract", () => {
  const r = runtime();
  const request = signedRemove();
  const payload = r.context.verifyTrustedPhotoRequest_(request);

  assert.equal(payload.operation_id, request.payload.operation_id);
  assert.equal(payload.student_id, "STU-001");
  assert.equal(payload.expected_old_file_id, "DRIVE-001");
  assert.equal(
    payload.expected_old_photo_updated_at,
    "2026-09-23 13:00:00"
  );

  assert.equal(r.calls.files, 0);
  assert.equal(r.calls.sheet, 0);
});

test("trusted remove trashes verified profile file once without Sheet access", () => {
  const r = runtime();

  const result = r.context.removeTrustedProfilePhoto_(signedRemove());

  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
    operation_id: "phr_1234567890abcdef1234567890abcdef12345678",
    student_id: "STU-001",
    has_profile_photo: false,
    photo_updated_at: ""
  });

  assert.equal(r.calls.files, 1);
  assert.equal(r.calls.mutation, 1);
  assert.equal(r.calls.sheet, 0);
});

test("trusted remove treats an already trashed verified file as idempotent success", () => {
  const r = runtime({ trashed: true });

  const result = r.context.removeTrustedProfilePhoto_(signedRemove());

  assert.equal(result.ok, true);
  assert.equal(result.data.has_profile_photo, false);
  assert.equal(result.data.photo_updated_at, "");

  assert.equal(r.calls.files, 1);
  assert.equal(r.calls.mutation, 0);
  assert.equal(r.calls.sheet, 0);
});

test("trusted remove fails closed for wrong-folder or unavailable files without mutation", () => {
  for (const option of [
    { wrongFolder: true },
    { missingFile: true }
  ]) {
    const r = runtime(option);

    const result = r.context.removeTrustedProfilePhoto_(signedRemove());

    assert.equal(result.ok, false);
    assert.equal(r.calls.mutation, 0);
    assert.equal(r.calls.sheet, 0);
  }
});
