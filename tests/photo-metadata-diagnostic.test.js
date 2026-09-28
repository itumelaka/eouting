const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const gas = fs.readFileSync(path.join(__dirname, "..", "gas", "Code.gs"), "utf8");
const start = gas.indexOf("function runProfilePhotoMetadataDiagnostic_()");
const end = gas.indexOf("\nfunction safelyTrashProfilePhoto_", start);
assert.ok(start >= 0 && end > start);
const diagnostic = gas.slice(start, end);
function sourceFunction(name, nextName) {
  const from = gas.indexOf(`function ${name}(`);
  const to = gas.indexOf(`\nfunction ${nextName}(`, from);
  assert.ok(from >= 0 && to > from, `${name} must exist`);
  return gas.slice(from, to);
}
const realHelpers = [
  sourceFunction("isFileInFolder_", "getVerifiedProfilePhotoFile_"),
  sourceFunction("normalizeText_", "hasCellValue_"),
  sourceFunction("isActive_", "pick_")
].join("\n");

function fixture(rows, files = {}, options = {}) {
  const logs = [];
  const calls = [];
  const sheetCalls = { opens: 0, lookups: 0, inserts: 0 };
  const forbidden = () => { throw new Error("FORBIDDEN_MUTATION_OR_CONTENT_ACCESS"); };
  const folder = {
    getId: () => "FOLDER-PRIVATE",
    createFile: forbidden, setTrashed: forbidden, getBlob: forbidden
  };
  const context = vm.createContext({
    console: { log: (value) => logs.push(value) },
    SHEETS: { students: "STUDENTS" },
    SPREADSHEET_ID: "PRIVATE-SHEET",
    SpreadsheetApp: {
      openById(id) {
        assert.equal(id, "PRIVATE-SHEET");
        sheetCalls.opens += 1;
        return {
          getSheetByName(name) {
            assert.equal(name, "STUDENTS");
            sheetCalls.lookups += 1;
            return options.missingSheet ? null : {};
          },
          insertSheet() { sheetCalls.inserts += 1; return forbidden(); },
          getActiveSpreadsheet: forbidden
        };
      }
    },
    getRowsAsObjects_: () => rows,
    getProfilePhotoFolder_: () => { if (options.folderError) throw new Error("SECRET_FOLDER_ERROR"); return folder; },
    DriveApp: {
      getFileById(id) {
        calls.push(id);
        const spec = files[id];
        if (!spec || spec.openError) throw new Error("SECRET_DRIVE_ERROR");
        return {
          isTrashed: () => { if (spec.metadataError) throw new Error("SECRET_METADATA_ERROR"); return !!spec.trashed; },
          getParents: () => {
            if (spec.metadataError) throw new Error("SECRET_METADATA_ERROR");
            const parents = spec.parents || ["FOLDER-PRIVATE"];
            let index = 0;
            return {
              hasNext: () => { if (spec.parentIteratorError) throw new Error("SECRET_ITERATOR_ERROR"); return index < parents.length; },
              next: () => ({ getId: () => parents[index++] })
            };
          },
          getMimeType: () => { if (spec.metadataError) throw new Error("SECRET_METADATA_ERROR"); return spec.mime || "image/jpeg"; },
          getBlob: forbidden, setTrashed: forbidden, moveTo: forbidden,
          setSharing: forbidden, getThumbnail: forbidden
        };
      },
      createFile: forbidden
    },
    UrlFetchApp: { fetch: forbidden, fetchAll: forbidden }
  });
  vm.runInContext(realHelpers + "\n" + diagnostic, context);
  return { context, logs, calls, sheetCalls };
}

function safe(result, logs, secrets = []) {
  const serialized = JSON.stringify(result) + logs.join(" ");
  for (const secret of secrets) assert.equal(serialized.includes(secret), false, `leaked ${secret}`);
  assert.doesNotMatch(serialized, /https?:\/\/|@|SECRET_|FORBIDDEN_MUTATION_OR_CONTENT_ACCESS/);
  assert.deepEqual(Object.keys(result), ["ok", "folder_accessible", "references", "runtime_capability"]);
}

test("valid active references aggregate, including whitespace/casing and duplicate IDs", () => {
  const rows = [
    { student_id: "PRIVATE-STUDENT-1", status: " Aktif ", photo_file_id: "PRIVATE-FILE-A" },
    { student_id: "PRIVATE-STUDENT-2", status: "AKTIF", photo_file_id: "PRIVATE-FILE-A" },
    { status: " aktif ", photo_file_id: "PRIVATE-FILE-B" },
    { status: "TIDAK AKTIF", photo_file_id: "PRIVATE-FILE-C" },
    { status: "Aktif", photo_file_id: " " }
  ];
  const { context, calls, logs } = fixture(rows, { "PRIVATE-FILE-A": {}, "PRIVATE-FILE-B": { mime: "image/webp" } });
  const result = context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(result.ok, true);
  assert.equal(result.references.checked, 3);
  assert.equal(result.references.valid, 3);
  assert.equal(result.runtime_capability.read, "PASS");
  assert.equal(result.runtime_capability.create_upload, "NOT_PROVEN_WITHOUT_MUTATION");
  assert.equal(result.runtime_capability.trash_remove, "NOT_PROVEN_WITHOUT_MUTATION");
  assert.deepEqual(calls, ["PRIVATE-FILE-A", "PRIVATE-FILE-A", "PRIVATE-FILE-B"]);
  assert.equal(logs.length, 1);
  safe(result, logs, ["PRIVATE-STUDENT", "PRIVATE-FILE", "FOLDER-PRIVATE"]);
});

test("each failure has one category; unresolved subcategories never inflate totals", () => {
  const specs = {
    "PRIVATE-MISSING": { openError: true },
    "PRIVATE-TRASHED": { trashed: true },
    "PRIVATE-NESTED": { parents: ["NESTED-FOLDER"] },
    "PRIVATE-MIME": { mime: "image/svg+xml" },
    "PRIVATE-METADATA": { metadataError: true },
    "PRIVATE-VALID": { mime: "image/png" }
  };
  const rows = Object.keys(specs).map((id) => ({ status: "Aktif", photo_file_id: id }));
  const { context, logs } = fixture(rows, specs);
  const result = context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(result.references.checked, 6);
  for (const field of ["valid", "missing_or_inaccessible", "trashed", "wrong_direct_parent", "invalid_mime", "metadata_read_error"]) {
    assert.equal(result.references[field], 1, field);
  }
  assert.equal(result.references.unresolved, 2);
  assert.equal(result.runtime_capability.read, "UNKNOWN");
  safe(result, logs, Object.keys(specs));
});

test("confirmed invalid metadata without unresolved references reports READ FAIL", () => {
  const { context } = fixture([{ status: "Aktif", photo_file_id: "PRIVATE-TRASHED" }], {
    "PRIVATE-TRASHED": { trashed: true }
  });
  assert.equal(context.runProfilePhotoMetadataDiagnostic_().runtime_capability.read, "FAIL");
});

test("zero references and unavailable folder never report READ PASS", () => {
  const empty = fixture([{ status: "Aktif", photo_file_id: "" }]);
  const emptyResult = empty.context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(emptyResult.references.checked, 0);
  assert.equal(emptyResult.runtime_capability.read, "UNKNOWN");
  const unavailable = fixture([{ status: "Aktif", photo_file_id: "PRIVATE-FILE" }], {}, { folderError: true });
  const result = unavailable.context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(result.ok, false);
  assert.equal(result.folder_accessible, false);
  assert.equal(result.runtime_capability.read, "UNKNOWN");
  assert.deepEqual(unavailable.calls, []);
  safe(result, unavailable.logs, ["PRIVATE-FILE", "SECRET_FOLDER_ERROR"]);
});

test("student-source read failure returns only a sanitized incomplete result", () => {
  const { context, logs, calls } = fixture([]);
  context.getRowsAsObjects_ = () => { throw new Error("SECRET_SHEET_ERROR PRIVATE-STUDENT"); };
  const result = context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(result.ok, false);
  assert.equal(result.folder_accessible, true);
  assert.equal(result.references.checked, 0);
  assert.equal(result.runtime_capability.read, "UNKNOWN");
  assert.deepEqual(calls, []);
  safe(result, logs, ["SECRET_SHEET_ERROR", "PRIVATE-STUDENT"]);
});

test("missing STUDENTS sheet fails safely without insertSheet or Drive file reads", () => {
  const { context, logs, calls, sheetCalls } = fixture([], {}, { missingSheet: true });
  const result = context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(result.ok, false);
  assert.equal(result.folder_accessible, true);
  assert.equal(result.references.checked, 0);
  assert.equal(result.runtime_capability.read, "UNKNOWN");
  assert.deepEqual(sheetCalls, { opens: 1, lookups: 1, inserts: 0 });
  assert.deepEqual(calls, []);
  safe(result, logs, ["PRIVATE-SHEET", "FOLDER-PRIVATE"]);
});

test("actual parent iterator classifies nested and failing metadata safely", () => {
  const rows = [
    { status: "Aktif", photo_file_id: "PRIVATE-NESTED" },
    { status: "Aktif", photo_file_id: "PRIVATE-ITERATOR" }
  ];
  const { context, logs } = fixture(rows, {
    "PRIVATE-NESTED": { parents: ["OTHER-FOLDER", "NESTED-FOLDER"] },
    "PRIVATE-ITERATOR": { parentIteratorError: true }
  });
  const result = context.runProfilePhotoMetadataDiagnostic_();
  assert.equal(result.references.wrong_direct_parent, 1);
  assert.equal(result.references.metadata_read_error, 1);
  assert.equal(result.references.unresolved, 1);
  assert.equal(result.runtime_capability.read, "UNKNOWN");
  safe(result, logs, ["PRIVATE-NESTED", "PRIVATE-ITERATOR", "SECRET_ITERATOR_ERROR"]);
});

test("diagnostic has no HTTP exposure or forbidden API calls", () => {
  const getRouter = gas.slice(gas.indexOf("function doGet"), gas.indexOf("function doPost"));
  const postRouter = gas.slice(gas.indexOf("function doPost"), gas.indexOf("function setupDatabase"));
  for (const name of ["runProfilePhotoMetadataDiagnostic_", "collectProfilePhotoMetadataDiagnostic_", "classifyProfilePhotoReference_"]) {
    assert.doesNotMatch(getRouter, new RegExp(name));
    assert.doesNotMatch(postRouter, new RegExp(name));
  }
  assert.doesNotMatch(diagnostic, /getBlob|fetchAll|thumbnail|createFile|setTrashed|setSharing|updateRow|appendRow|setProperty|SpreadsheetApp\.flush/);
  assert.doesNotMatch(diagnostic, /getSheet_\(/);
  assert.match(gas, /return spreadsheet\.getSheetByName\(name\) \|\| spreadsheet\.insertSheet\(name\)/);
  assert.equal((gas.match(/function runProfilePhotoMetadataDiagnostic_\(/g) || []).length, 1);
});
