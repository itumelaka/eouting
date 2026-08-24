const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function extractFunction(source, name) {
  const start = source.lastIndexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function json(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadAuditFunctions(options = {}) {
  const auditRows = options.auditRows || [];
  let sheetReads = 0;
  const context = vm.createContext({
    Map,
    DEPARTURE_CONFIRMATION_AUDIT: {
      requested: "DEPARTURE_CONFIRMATION_REQUESTED",
      wardenCheckout: "WARDEN_REMOTE_CHECKOUT"
    },
    STATUS: { approved: "DILULUSKAN_WARDEN" },
    SHEETS: { audit: "AUDIT_LOG" },
    getSheet_: (name) => ({ name }),
    getRowsAsObjects_: () => {
      sheetReads += 1;
      return auditRows;
    },
    isNoGuardDepartureEnabled_: () => options.featureEnabled !== false
  });
  [
    "createEmptyDepartureConfirmationAuditState_",
    "buildDepartureConfirmationAuditStateMap_",
    "getDepartureConfirmationAuditStateFromMap_",
    "getDepartureConfirmationAuditState_",
    "addDepartureConfirmationProjection_"
  ].forEach((name) => vm.runInContext(extractFunction(gasSource, name), context));
  return { context, getSheetReads: () => sheetReads };
}

function legacyState(requestId, auditRows) {
  const normalizedRequestId = String(requestId || "").trim();
  const state = { requested: false, requested_at: "", completed: false, completed_at: "" };
  auditRows.forEach((row) => {
    if (String(row && row.request_id || "").trim() !== normalizedRequestId) return;
    const action = String(row && row.action || "").trim();
    if (action === "DEPARTURE_CONFIRMATION_REQUESTED" && !state.requested) {
      state.requested = true;
      state.requested_at = row.timestamp || "";
    }
    if (action === "WARDEN_REMOTE_CHECKOUT") {
      state.completed = true;
      state.completed_at = row.timestamp || "";
    }
  });
  return state;
}

function auditFixture() {
  return [
    { request_id: "R1", action: "UNRELATED", timestamp: "2026-08-25 07:00:00", details: "ignored" },
    { request_id: "R1", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 08:00:00", user_role: "Student" },
    { request_id: "R2", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 08:01:00", user_role: "Student" },
    { request_id: "R1", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 09:00:00", user_role: "Student" },
    { request_id: "R3", action: "REQUEST_DEPARTURE_CONFIRMATION", timestamp: "2026-08-25 09:01:00" },
    { request_id: "R2", action: "UNRELATED_NEWER", timestamp: "2026-08-25 10:00:00" },
    { request_id: "R1", action: "WARDEN_REMOTE_CHECKOUT", timestamp: "2026-08-25 10:01:00", user_role: "Warden" },
    { request_id: "R4", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "", user_role: "Student" },
    { request_id: "R4", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 10:02:00", user_role: "Student" },
    { request_id: "R5", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "not-a-date", user_role: "Student" },
    { request_id: "R1", action: "WARDEN_REMOTE_CHECKOUT", timestamp: "2026-08-25 10:03:00", user_role: "HEP" },
    { request_id: "R6", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 11:00:00" },
    { request_id: "R6", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 11:00:00" },
    { request_id: "", action: "DEPARTURE_CONFIRMATION_REQUESTED", timestamp: "2026-08-25 12:00:00" }
  ];
}

test("P0-2 one-pass map exactly matches legacy audit state semantics", () => {
  const auditRows = auditFixture();
  const { context } = loadAuditFunctions({ auditRows });
  const stateByRequest = context.buildDepartureConfirmationAuditStateMap_(auditRows);

  for (const requestId of ["R0", "R1", "R2", "R3", "R4", "R5", "R6", ""]) {
    assert.deepEqual(
      json(context.getDepartureConfirmationAuditStateFromMap_(requestId, stateByRequest)),
      legacyState(requestId, auditRows),
      requestId || "blank request ID"
    );
    assert.deepEqual(json(context.getDepartureConfirmationAuditState_(requestId, auditRows)), legacyState(requestId, auditRows));
  }

  assert.equal(stateByRequest.has("R3"), false, "unsupported legacy-looking actions remain unrelated");
  assert.equal(stateByRequest.get("R1").requested_at, "2026-08-25 08:00:00", "first requested row wins");
  assert.equal(stateByRequest.get("R1").completed_at, "2026-08-25 10:03:00", "last checkout row wins");
  assert.equal(stateByRequest.get("R4").requested_at, "", "first blank timestamp remains authoritative");
  assert.equal(stateByRequest.get("R5").requested_at, "not-a-date", "timestamps are preserved, not reinterpreted");
  assert.equal(stateByRequest.get("R6").requested_at, "2026-08-25 11:00:00", "timestamp ties retain the first requested row");
});

test("projection reads AUDIT_LOG once, builds one map and resolves multiple records independently", () => {
  const auditRows = auditFixture();
  let actionReads = 0;
  const observedRows = auditRows.map((row) => new Proxy(row, {
    get(target, property) {
      if (property === "action") actionReads += 1;
      return target[property];
    }
  }));
  const { context, getSheetReads } = loadAuditFunctions({ auditRows: observedRows });
  const rows = context.addDepartureConfirmationProjection_([
    { request_id: "R0", status: "DILULUSKAN_WARDEN" },
    { request_id: "R1", status: "DILULUSKAN_WARDEN" },
    { request_id: "R2", status: "DILULUSKAN_WARDEN" },
    { request_id: "R4", status: "DILULUSKAN_WARDEN" },
    { request_id: "R5", status: "KELUAR" }
  ]);

  assert.equal(getSheetReads(), 1);
  assert.equal(actionReads, auditRows.length, "each audit action must be inspected once, not once per operational row");
  assert.equal(rows[0].departure_confirmation_pending, false);
  assert.equal(rows[1].departure_confirmation_pending, false, "completed checkout resolves the request");
  assert.equal(rows[2].departure_confirmation_pending, true);
  assert.equal(rows[2].departure_confirmation_requested_at, "2026-08-25 08:01:00");
  assert.equal(rows[3].departure_confirmation_pending, true);
  assert.equal(rows[3].departure_confirmation_requested_at, "");
  assert.equal(rows[4].departure_confirmation_pending, false, "non-approved lifecycle remains unchanged");
  assert.ok(rows.every((row) => row.no_guard_departure_enabled === true));
});

test("audit map values contain only the minimal projection state", () => {
  const auditRows = auditFixture();
  const { context } = loadAuditFunctions({ auditRows });
  const stateByRequest = context.buildDepartureConfirmationAuditStateMap_(auditRows);
  for (const state of stateByRequest.values()) {
    assert.deepEqual(Object.keys(json(state)).sort(), ["completed", "completed_at", "requested", "requested_at"]);
    assert.doesNotMatch(JSON.stringify(state), /details|user_role|user_name|student|warden|guard/i);
  }
});

test("P0-2 source has one audit pass, one operational pass and no per-record Sheet reads", () => {
  const projection = extractFunction(gasSource, "addDepartureConfirmationProjection_");
  assert.equal((projection.match(/buildDepartureConfirmationAuditStateMap_\(/g) || []).length, 1);
  assert.match(projection, /getDepartureConfirmationAuditStateFromMap_\(row\.request_id, departureAuditStateByRequest\)/);
  assert.doesNotMatch(projection, /getDepartureConfirmationAuditState_\(row\.request_id, auditRows\)/);
  assert.equal((projection.match(/getRowsAsObjects_\(/g) || []).length, 1);

  const mapBuilder = extractFunction(gasSource, "buildDepartureConfirmationAuditStateMap_");
  assert.match(mapBuilder, /\(auditRows \|\| \[\]\)\.forEach/);
  assert.match(mapBuilder, /departureAuditStateByRequest\.get\(requestId\)/);
  assert.match(mapBuilder, /departureAuditStateByRequest\.set\(requestId, state\)/);
  assert.doesNotMatch(mapBuilder, /getSheet_|getRange|getValue|getRowsAsObjects_/);

  const lookup = extractFunction(gasSource, "getDepartureConfirmationAuditStateFromMap_");
  assert.match(lookup, /departureAuditStateByRequest\.get/);
  assert.doesNotMatch(lookup, /forEach|filter|find|getSheet_|getRange|getValue/);
});

test("authenticated Student rows are filtered before audit enrichment without changing Warden or Guard scope", () => {
  const projectedInputs = [];
  const context = vm.createContext({
    normalizeText_: (value) => String(value || "").trim().toLowerCase(),
    findActiveStudent_: () => ({ student_id: "S1" }),
    findActiveWarden_: () => ({}),
    findActiveGuard_: () => ({}),
    addWardenApprovalRoles_: (rows) => rows,
    addProfilePhotoIndicators_: (rows) => rows,
    getTodayRecordRows_: () => [{ student_id: "S1", request_id: "R1" }, { student_id: "S2", request_id: "R2" }],
    addOperationalUrgency_: (rows) => rows,
    addWardenDeparturePriorityProjection_: (rows) => rows,
    addDepartureConfirmationProjection_: (rows) => {
      projectedInputs.push(rows.map((row) => row.request_id));
      return rows;
    },
    projectGuardianContactBoundary_: (rows) => rows
  });
  vm.runInContext(extractFunction(gasSource, "getOperationalTodayRecords"), context);

  assert.deepEqual(json(context.getOperationalTodayRecords({ role: "student", student_id: "S1" })).map((row) => row.request_id), ["R1"]);
  assert.deepEqual(projectedInputs[0], ["R1"]);
  assert.deepEqual(json(context.getOperationalTodayRecords({ role: "warden" })).map((row) => row.request_id), ["R1", "R2"]);
  assert.deepEqual(projectedInputs[1], ["R1", "R2"]);
  assert.deepEqual(json(context.getOperationalTodayRecords({ role: "guard" })).map((row) => row.request_id), ["R1", "R2"]);
  assert.equal(projectedInputs.length, 2, "Guard still receives no departure-confirmation projection");

  const source = extractFunction(gasSource, "getOperationalTodayRecords");
  assert.ok(source.indexOf("const visibleRows") < source.indexOf("addDepartureConfirmationProjection_(visibleRows)"));
});

test("P0-2 changes no lifecycle, schema, authorization, Telegram or Guard transition contract", () => {
  const requestHeaders = gasSource.slice(gasSource.indexOf("OUTING_REQUESTS: ["), gasSource.indexOf("AUDIT_LOG:"));
  assert.doesNotMatch(requestHeaders, /departure_confirmation/);
  const status = gasSource.slice(gasSource.indexOf("const STATUS ="), gasSource.indexOf("const DEPARTURE_CONFIRMATION_AUDIT"));
  assert.doesNotMatch(status, /DEPARTURE_CONFIRMATION|REMOTE/);
  assert.match(extractFunction(gasSource, "requestDepartureConfirmation"), /sendTelegramMessage_\(result\.telegram_message\)/);
  assert.match(extractFunction(gasSource, "confirmWardenRemoteCheckout"), /sendTelegramMessage_\(result\.telegram_message\)/);
  assert.match(extractFunction(gasSource, "confirmOut"), /findActiveGuard_|STATUS\.approved/);
  assert.match(extractFunction(gasSource, "confirmIn"), /findActiveGuard_|STATUS\.out/);
});
