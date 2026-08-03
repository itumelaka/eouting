const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const SAFE_MESSAGE = "Sambungan live tidak stabil. Sila cuba lagi.";

function extractFunction(name) {
  const pattern = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = pattern.exec(appSource);
  assert.ok(match, `Missing function ${name}`);
  const start = match.index;
  const braceStart = appSource.indexOf("{", start);
  let depth = 0;
  for (let index = braceStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

function buildParser() {
  const cleanSource = extractFunction("cleanApiError");
  const parserSource = extractFunction("parseApiResponse");
  return Function(
    "LIVE_API_UNSTABLE_MESSAGE",
    `${cleanSource}\n${parserSource}\nreturn parseApiResponse;`
  )(SAFE_MESSAGE);
}

function response(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    text: async () => body
  };
}

test("exactly one canonical async apiPost declaration exists", () => {
  const declarations = appSource.match(/async function apiPost\s*\(/g) || [];
  assert.equal(declarations.length, 1);
});

test("canonical apiPost keeps mock guard before live fetch", () => {
  const source = extractFunction("apiPost");
  const guardIndex = source.indexOf("ALLOW_MOCK_MODE && MOCK_ADMIN_ACTIONS_V200.has(action)");
  const mockReturnIndex = source.indexOf("return mockAdminApiPostV200(action, payload)");
  const fetchIndex = source.indexOf("fetch(GAS_WEB_APP_URL");
  assert.ok(guardIndex >= 0);
  assert.ok(mockReturnIndex > guardIndex);
  assert.ok(fetchIndex > mockReturnIndex);
});

test("canonical live transport is no-store and uses the shared parser", () => {
  const source = extractFunction("apiPost");
  assert.match(source, /cache:\s*["']no-store["']/);
  assert.match(source, /return parseApiResponse\(response, action\)/);
  assert.doesNotMatch(source, /response\.json\s*\(/);
  assert.match(source, /body:\s*JSON\.stringify\(\{ action, \.\.\.payload \}\)/);
});

test("all five Admin mock actions are explicitly intercepted only behind mock mode", () => {
  const actionSet = appSource.slice(
    appSource.indexOf("const MOCK_ADMIN_ACTIONS_V200"),
    appSource.indexOf("]);", appSource.indexOf("const MOCK_ADMIN_ACTIONS_V200")) + 3
  );
  for (const action of [
    "loginAdmin",
    "getAdminOutingTypes",
    "createOutingType",
    "updateOutingType",
    "toggleOutingType"
  ]) {
    assert.match(actionSet, new RegExp(`"${action}"`));
  }
  assert.match(extractFunction("apiPost"), /if \(ALLOW_MOCK_MODE && MOCK_ADMIN_ACTIONS_V200\.has\(action\)\)/);
});

test("live Admin actions fall through to the single GAS POST transport", () => {
  const source = extractFunction("apiPost");
  assert.equal((source.match(/fetch\(GAS_WEB_APP_URL/g) || []).length, 1);
  assert.match(source, /method:\s*["']POST["']/);
  assert.ok(source.indexOf("fetch(GAS_WEB_APP_URL") > source.indexOf("ALLOW_MOCK_MODE"));
});

test("no direct GAS POST exists outside canonical apiPost", () => {
  const canonical = extractFunction("apiPost");
  const withoutCanonical = appSource.replace(canonical, "");
  assert.doesNotMatch(withoutCanonical, /fetch\(GAS_WEB_APP_URL\s*,\s*\{[\s\S]{0,200}?method:\s*["']POST["']/);
});

test("shared parser rejects HTML and invalid JSON with the safe message", async () => {
  const parseApiResponse = buildParser();
  await assert.rejects(
    parseApiResponse(response("<html>Apps Script error</html>", { status: 500 }), "loginAdmin"),
    new RegExp(SAFE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
  await assert.rejects(
    parseApiResponse(response("not-json"), "loginAdmin"),
    new RegExp(SAFE_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  );
});

test("shared parser handles HTTP/backend failures and returns successful data", async () => {
  const parseApiResponse = buildParser();
  await assert.rejects(
    parseApiResponse(response('{"ok":true,"error":"HTTP gagal"}', { ok: false, status: 500 }), "loginAdmin"),
    /HTTP gagal/
  );
  await assert.rejects(
    parseApiResponse(response('{"ok":false,"error":"Akses ditolak"}'), "loginAdmin"),
    /Akses ditolak/
  );
  const data = await parseApiResponse(response('{"ok":true,"data":{"admin_id":"ADM-1"}}'), "loginAdmin");
  assert.deepEqual(data, { admin_id: "ADM-1" });
});
