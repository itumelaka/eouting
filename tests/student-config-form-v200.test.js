const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");

function extractFunction(name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(appSource);
  assert.ok(match, `Missing function ${name}`);

  const parameterStart = match.index + match[0].lastIndexOf("(");
  let parameterDepth = 0;
  let parameterEnd = -1;
  let quote = "";
  let escaped = false;
  for (let index = parameterStart; index < appSource.length; index += 1) {
    const character = appSource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "(") parameterDepth += 1;
    if (character === ")") {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }
  assert.notEqual(parameterEnd, -1, `Unclosed parameter list for ${name}`);

  const braceStart = appSource.indexOf("{", parameterEnd + 1);
  assert.notEqual(braceStart, -1, `Missing function body for ${name}`);
  let depth = 0;
  quote = "";
  escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = braceStart; index < appSource.length; index += 1) {
    const character = appSource[index];
    const nextCharacter = appSource[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && nextCharacter === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && nextCharacter === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && nextCharacter === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth === 0) return appSource.slice(match.index, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

test("student config loader runs only after a student session opens", () => {
  assert.match(extractFunction("startStudentSession"), /loadStudentOutingTypesV200\(\)/);
  assert.match(extractFunction("loadStudentOutingTypesV200"), /apiGet\("getOutingTypes"\)/);
  assert.doesNotMatch(extractFunction("initApp"), /loadStudentOutingTypesV200/);
});

test("dynamic dropdown renders type code and display name in sort order", () => {
  const normalize = extractFunction("normalizeStudentOutingTypesV200");
  const render = extractFunction("renderStudentOutingTypesV200");
  assert.match(normalize, /left\.sort_order - right\.sort_order/);
  assert.match(render, /type\.type_code/);
  assert.match(render, /type\.display_name/);
});

test("inactive config rows are excluded", () => {
  assert.match(extractFunction("normalizeStudentOutingTypesV200"), /row\.active !== false/);
  assert.match(extractFunction("mockPublicOutingTypesV200"), /type\.active === true/);
});

test("five legacy HTML options and runtime fallback remain available", () => {
  for (const typeCode of [
    "OUTING_BIASA",
    "OUTING_HUJUNG_MINGGU",
    "KECEMASAN",
    "PULANG_BERMALAM",
    "CUTI_SEMESTER"
  ]) {
    assert.match(indexSource, new RegExp(`value=["']${typeCode}["']`));
  }
  assert.match(extractFunction("useLegacyStudentOutingTypesV200"), /buildLegacyStudentOutingTypesV200\(\)/);
  assert.match(extractFunction("loadStudentOutingTypesV200"), /if \(!activeRows\.length\)/);
  assert.match(extractFunction("loadStudentOutingTypesV200"), /catch \(error\)/);
});

test("all config-driven fields are mapped to visibility and required state", () => {
  const source = extractFunction("applyStudentOutingTypeConfigV200");
  for (const field of [
    "require_leave_date",
    "require_return_date",
    "require_return_time",
    "require_guardian_phone",
    "require_guardian_relation",
    "require_emergency_reason",
    "require_purpose",
    "require_location",
    "require_vehicle",
    "same_day_only",
    "fixed_return_time",
    "departure_allowed_days"
  ]) {
    assert.match(source, new RegExp(field));
  }
});

test("hidden fields are disabled and required applies only while visible", () => {
  const source = extractFunction("setConfigFieldStateV200");
  assert.match(source, /field\.disabled = !visible/);
  assert.match(source, /field\.required = Boolean\(visible && required\)/);
  assert.match(source, /setFieldAndLabelHiddenV160\(field, !visible\)/);
});

test("fixed return time fills and locks the active return-time input", () => {
  const source = extractFunction("applyStudentOutingTypeConfigV200");
  assert.match(source, /fixedReturnTime/);
  assert.match(source, /readOnly: Boolean\(fixedReturnTime\)/);
  assert.match(source, /value: fixedReturnTime/);
});

test("configured departure days expose and require a requested leave date", () => {
  const source = extractFunction("applyStudentOutingTypeConfigV200");
  assert.match(source, /hasDepartureDayRule/);
  assert.match(source, /leaveDateRequired/);
  assert.match(source, /require_leave_date === true \|\| hasDepartureDayRule/);
});

test("type changes clear values that are no longer relevant", () => {
  const fieldState = extractFunction("setConfigFieldStateV200");
  const applyConfig = extractFunction("applyStudentOutingTypeConfigV200");
  assert.match(applyConfig, /studentPreviousOutingTypeCodeV200 !== config\.type_code/);
  assert.match(fieldState, /const shouldReset = !visible/);
  assert.match(fieldState, /options\.reset === true/);
  assert.match(fieldState, /options\.clearOnTypeChange === true/);
  assert.match(fieldState, /field\.value = ""/);
});

test("mock public config supports active data, empty and one-shot error without GAS", () => {
  const mockSource = extractFunction("mockPublicOutingTypesV200");
  const getSource = extractFunction("apiGetWithParams");
  assert.match(getSource, /ALLOW_MOCK_MODE && action === "getOutingTypes"/);
  assert.match(getSource, /return mockPublicOutingTypesV200\(\)/);
  assert.match(mockSource, /scenario === "empty"/);
  assert.match(mockSource, /scenario === "optional"/);
  assert.match(mockSource, /require_purpose: false/);
  assert.match(mockSource, /mockPublicOutingTypesErrorPendingV200 = false/);
  assert.doesNotMatch(mockSource, /fetch\(|GAS_WEB_APP_URL/);
});

test("fallback legacy preserves weekend fixed-return behaviour", () => {
  const seeds = extractFunction("buildMockAdminOutingTypesV200");
  const weekendStart = seeds.indexOf("type_code: REQUEST_TYPE.weekend");
  const emergencyStart = seeds.indexOf("type_code: REQUEST_TYPE.emergency");
  const weekend = seeds.slice(weekendStart, emergencyStart);
  assert.match(weekend, /allowed_days: "SABTU,AHAD"/);
  assert.match(weekend, /fixed_return_time: "22:00"/);
  assert.match(weekend, /same_day_only: true/);
});

test("backend submitRequest is feature-gated and the migration still defaults the flag to false", () => {
  const submitSource = gasSource.slice(
    gasSource.indexOf("function submitRequest(payload)"),
    gasSource.indexOf("function approveRequest(payload)")
  );
  assert.match(submitSource, /resolveSubmissionOutingTypeConfigV200_/);
  assert.match(submitSource, /validateConfigDrivenSubmissionV200_/);
  assert.match(gasSource, /OUTING_CONFIG_V2_ENABLED/);
  assert.match(gasSource, /setProperty\(OUTING_CONFIG_V2_PROPERTY, "false"\)/);
});
