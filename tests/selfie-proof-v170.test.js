const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function extractFunction(source, name, nextName) {
  const start = Math.max(
    source.lastIndexOf(`function ${name}`),
    source.lastIndexOf(`async function ${name}`)
  );
  assert.notEqual(start, -1, `${name} must exist`);
  const boundaries = nextName ? [
    source.indexOf(`\nfunction ${nextName}`, start),
    source.indexOf(`\nasync function ${nextName}`, start)
  ].filter((index) => index !== -1) : [];
  const end = boundaries.length ? Math.min(...boundaries) : -1;
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return source.slice(start, end);
}

function makeSelfieUiContext() {
  const context = vm.createContext({
    currentSession: { role: "student" },
    RETURN_SELFIE_STATUS: { pending: "BELUM_HANTAR", submitted: "SUDAH_HANTAR" },
    RETURN_SELFIE_TYPES: new Set([
      "OUTING_BIASA",
      "KECEMASAN",
      "PULANG_BERMALAM",
      "CUTI_SEMESTER"
    ]),
    reverseDisplayStatus: (status) => status === "Sudah Pulang" ? "SELESAI" : status,
    isRecordForCurrentStudent: () => true,
    escapeHtml: String,
    formatDisplayDateTime: String,
    getRecordId: (record) => record.request_id
  });
  vm.runInContext([
    extractFunction(appSource, "isReturnSelfieSubmitted", "isReturnSelfieEligible"),
    extractFunction(appSource, "isReturnSelfieEligible", "returnSelfieProofHtml"),
    extractFunction(appSource, "returnSelfieProofHtml", "bindStudentReturnSelfieControls")
  ].join("\n"), context);
  return context;
}

function completedRecord(type = "OUTING_BIASA", overrides = {}) {
  return {
    request_id: `REQ-${type}`,
    rawStatus: "SELESAI",
    status: "Sudah Pulang",
    masa_masuk: "2026-07-26 20:00:00",
    jenis_permohonan: type,
    selfie_status: "",
    ...overrides
  };
}

test("completed record without selfie shows the return selfie action", () => {
  const context = makeSelfieUiContext();
  const html = context.returnSelfieProofHtml(completedRecord());
  assert.match(html, /Bukti Selfie Belum Dihantar/);
  assert.match(html, /Ambil Selfie &amp; Lapor Pulang/);
  assert.match(html, /accept="image\/\*"/);
  assert.match(html, /capture="user"/);
});

test("non-completed record does not show the return selfie action", () => {
  const context = makeSelfieUiContext();
  assert.equal(context.returnSelfieProofHtml(completedRecord("OUTING_BIASA", {
    rawStatus: "KELUAR",
    status: "Sedang Keluar"
  })), "");
});

test("submitted completed record shows status but no upload action", () => {
  const context = makeSelfieUiContext();
  const html = context.returnSelfieProofHtml(completedRecord("OUTING_BIASA", {
    selfie_status: "SUDAH_HANTAR",
    masa_selfie: "2026-07-26 20:05:00"
  }));
  assert.match(html, /Bukti Selfie Dihantar/);
  assert.match(html, /Masa Bukti/);
  assert.doesNotMatch(html, /data-selfie-submit/);
});

test("all four request types support return selfie proof", () => {
  const context = makeSelfieUiContext();
  ["OUTING_BIASA", "KECEMASAN", "PULANG_BERMALAM", "CUTI_SEMESTER"].forEach((type) => {
    assert.equal(context.isReturnSelfieEligible(completedRecord(type)), true, type);
  });
});

test("effective mapLiveRecord maps every private selfie field", () => {
  const effectiveMapper = appSource.slice(appSource.lastIndexOf("mapLiveRecord = function mapLiveRecordWithPulangBermalamFields"));
  [
    "selfie_status",
    "selfie_file_id",
    "selfie_url",
    "masa_selfie",
    "selfie_telegram_message_id"
  ].forEach((field) => assert.match(effectiveMapper, new RegExp(field)));
});

test("public mapping excludes all private selfie metadata", () => {
  const publicMapper = extractFunction(appSource, "mapPublicMonitoringRecord", "mapLiveStatus");
  [
    "selfie_status",
    "selfie_file_id",
    "selfie_url",
    "masa_selfie",
    "selfie_telegram_message_id",
    "no_matrik"
  ].forEach((field) => assert.doesNotMatch(publicMapper, new RegExp(field)));
});

test("client compression and upload action are wired correctly", () => {
  const submitSource = extractFunction(appSource, "submitReturnSelfieFromCard", "compressReturnSelfie");
  const compressionSource = extractFunction(appSource, "compressReturnSelfie", "loadReturnSelfieBitmap");
  assert.match(submitSource, /apiPost\("submitReturnSelfie"/);
  assert.match(submitSource, /image_base64:\s*compressed\.base64/);
  assert.match(compressionSource, /1280\s*\/\s*longestSide/);
  assert.match(compressionSource, /canvasToJpegBlob\(canvas,\s*0\.8\)/);
  assert.match(compressionSource, /canvasToJpegBlob\(canvas,\s*0\.75\)/);
});

test("backend duplicate prevention is lock-protected and idempotent", () => {
  const submitSource = extractFunction(gasSource, "submitReturnSelfie", "setupSelfieProofV170");
  assert.match(submitSource, /LockService\.getScriptLock\(\)/);
  assert.match(submitSource, /tryLock\(30000\)/);
  assert.match(submitSource, /Bukti selfie telah dihantar sebelum ini\./);
  assert.ok(submitSource.indexOf("findRowByRequestId_") < submitSource.indexOf("folder.createFile"));
  assert.ok(submitSource.indexOf("selfie_file_id") < submitSource.indexOf("folder.createFile"));
});

test("audit failure does not fail or roll back a completed selfie submission", () => {
  const calls = {
    audit: 0,
    deleteTelegram: 0,
    released: 0,
    trashed: 0,
    warnings: 0
  };
  const sourceRecord = {
    request_id: "REQ-AUDIT",
    student_id: "S001",
    no_matrik: "M001",
    nama: "Pelajar",
    kelas: "A2",
    jenis_permohonan: "OUTING_BIASA",
    status: "SELESAI",
    masa_masuk: "2026-07-26 20:00:00",
    guard_masuk_by: "Guard",
    selfie_status: "",
    selfie_file_id: "",
    masa_selfie: ""
  };
  const updatedRecord = {
    ...sourceRecord,
    selfie_status: "SUDAH_HANTAR",
    masa_selfie: "2026-07-26 20:05:00"
  };
  let lookupCount = 0;
  const driveFile = {
    getId: () => "FILE-1",
    getUrl: () => "https://drive.example/FILE-1",
    setTrashed: () => { calls.trashed += 1; }
  };
  const context = vm.createContext({
    STATUS: { done: "SELESAI" },
    MimeType: { JPEG: "image/jpeg" },
    console: { warn: () => { calls.warnings += 1; } },
    Utilities: {
      base64Decode: () => [1, 2, 3],
      newBlob: () => ({ getAs: () => ({ setName() { return this; } }) }),
      formatDate: () => "20260726-200500"
    },
    LockService: {
      getScriptLock: () => ({
        tryLock: () => true,
        releaseLock: () => { calls.released += 1; }
      })
    },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => "FOLDER-1" })
    },
    DriveApp: {
      getFolderById: () => ({
        getName: () => "eOuting - Bukti Selfie Pulang",
        createFile: () => driveFile
      })
    },
    findRowByRequestId_: () => {
      lookupCount += 1;
      return {
        sheet: {},
        rowNumber: 2,
        record: lookupCount === 1 ? sourceRecord : updatedRecord
      };
    },
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    hasCellValue_: (value) => value !== null && value !== undefined && String(value).trim() !== "",
    now_: () => "2026-07-26 20:05:00",
    sanitizeFilenamePart_: (value) => String(value),
    buildReturnSelfieCaption_: () => "caption",
    sendTelegramPhoto_: () => ({ ok: true, messageId: 123 }),
    updateRowByHeaders_: () => {},
    invalidateOperationalRecordsCache_: () => {},
    deleteTelegramMessage_: () => { calls.deleteTelegram += 1; },
    appendAuditLog: () => {
      calls.audit += 1;
      throw new Error("audit unavailable");
    }
  });
  vm.runInContext(extractFunction(gasSource, "submitReturnSelfie", "setupSelfieProofV170"), context);

  const result = context.submitReturnSelfie({
    request_id: "REQ-AUDIT",
    student_id: "S001",
    no_matrik: "M001",
    image_base64: "AQID",
    mime_type: "image/jpeg"
  });

  assert.equal(result.selfie_status, "SUDAH_HANTAR");
  assert.equal(calls.audit, 1);
  assert.equal(calls.warnings, 1);
  assert.equal(calls.deleteTelegram, 0);
  assert.equal(calls.trashed, 0);
  assert.equal(calls.released, 1);
});

test("backend validates record ownership", () => {
  const submitSource = extractFunction(gasSource, "submitReturnSelfie", "setupSelfieProofV170");
  assert.match(submitSource, /record\.student_id/);
  assert.match(submitSource, /record\.no_matrik/);
  assert.match(submitSource, /Anda tidak dibenarkan menghantar bukti untuk rekod ini/);
  assert.doesNotMatch(submitSource, /payload\.(nama|kelas|selfie_url)/);
});

test("backend requires SELESAI and masa_masuk", () => {
  const submitSource = extractFunction(gasSource, "submitReturnSelfie", "setupSelfieProofV170");
  assert.match(submitSource, /record\.status !== STATUS\.done/);
  assert.match(submitSource, /!hasCellValue_\(record\.masa_masuk\)/);
});

test("setup migration adds only missing columns and reuses Script Properties", () => {
  const setupSource = extractFunction(gasSource, "setupSelfieProofV170", "getTodayRecords");
  assert.match(setupSource, /ensureHeaders_\(sheet,\s*HEADERS\.OUTING_REQUESTS\)/);
  assert.match(setupSource, /beforeHeaders\.indexOf\(header\) === -1/);
  assert.match(setupSource, /getProperty\("SELFIE_FOLDER_ID"\)/);
  assert.match(setupSource, /getFoldersByName\("eOuting - Bukti Selfie Pulang"\)/);
  assert.match(setupSource, /setProperty\("SELFIE_FOLDER_ID"/);
});

test("existing confirmIn status transition and Guard note remain intact", () => {
  const confirmInSource = extractFunction(gasSource, "confirmIn", "submitReturnSelfie");
  assert.match(confirmInSource, /status:\s*STATUS\.done/);
  assert.match(confirmInSource, /masa_masuk:\s*now_\(\)/);
  assert.match(confirmInSource, /guard_masuk_by:\s*guard\.nama_guard/);
  assert.match(confirmInSource, /selfie_status:\s*requiresReturnSelfie\s*\?\s*"BELUM_HANTAR"\s*:\s*"TIDAK_DIPERLUKAN"/);
  assert.match(confirmInSource, /catatan:\s*guardReturnNote/);
});

test("service worker bypasses sensitive API and selfie image responses", () => {
  assert.match(workerSource, /isApiRequest_\(requestUrl\)\s*\|\|\s*isSensitiveImageRequest_/);
  const sensitiveSource = extractFunction(workerSource, "isSensitiveImageRequest_", "isFreshAsset_");
  assert.match(sensitiveSource, /request\.destination !== "image"/);
  assert.match(sensitiveSource, /target\.includes\("selfie"\)/);
  assert.match(sensitiveSource, /target\.includes\("bukti"\)/);
});
