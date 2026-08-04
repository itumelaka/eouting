const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const serviceWorkerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

function extractFunctionSource(source, functionName) {
  const signatureIndex = source.indexOf(`function ${functionName}(`);
  assert.notEqual(signatureIndex, -1, `${functionName} must exist`);

  const parameterStart = source.indexOf("(", signatureIndex);
  let parameterDepth = 0;
  let bodyStart = -1;
  for (let index = parameterStart; index < source.length; index += 1) {
    if (source[index] === "(") parameterDepth += 1;
    if (source[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0 && source[index] === ")") {
      bodyStart = source.indexOf("{", index + 1);
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `${functionName} body must exist`);

  let braceDepth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") braceDepth += 1;
    if (source[index] === "}") braceDepth -= 1;
    if (braceDepth === 0) return source.slice(signatureIndex, index + 1);
  }
  throw new Error(`${functionName} closing brace not found`);
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    snapshot: () => Object.fromEntries(values.entries())
  };
}

function createResolver() {
  const context = vm.createContext({ URL, URLSearchParams });
  const helpers = [
    "isLocalBetaApiHostV200",
    "normalizeBetaApiOverrideV200",
    "resolveGasWebAppUrlV200"
  ].map((name) => extractFunctionSource(appSource, name)).join("\n");
  vm.runInContext(`
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/PRODUCTION_ID/exec";
    const BETA_API_OVERRIDE_SESSION_KEY_V200 = "eouting_beta_api_override_v200";
    ${helpers}
    this.resolveEndpoint = resolveGasWebAppUrlV200;
  `, context);
  return context.resolveEndpoint;
}

const validBetaUrl = "https://script.google.com/macros/s/BETA_DEPLOYMENT_ID/exec";

test("production hostname ignores and clears a beta query override", () => {
  const storage = createStorage({ eouting_beta_api_override_v200: validBetaUrl });
  const result = createResolver()({
    hostname: "itumelaka.github.io",
    search: `?api=${encodeURIComponent(validBetaUrl)}`
  }, storage);
  assert.equal(result.isBeta, false);
  assert.match(result.url, /PRODUCTION_ID/);
  assert.deepEqual(storage.snapshot(), {});
});

test("localhost and 127.0.0.1 accept a valid HTTPS script.google.com exec URL", () => {
  for (const hostname of ["localhost", "127.0.0.1"]) {
    const storage = createStorage();
    const result = createResolver()({
      hostname,
      search: `?api=${encodeURIComponent(validBetaUrl)}`
    }, storage);
    assert.equal(result.isBeta, true);
    assert.equal(result.url, validBetaUrl);
    assert.equal(storage.snapshot().eouting_beta_api_override_v200, validBetaUrl);
  }
});

test("invalid protocol and unrelated domains are rejected and cleared", () => {
  for (const invalidUrl of [
    "http://script.google.com/macros/s/BETA_DEPLOYMENT_ID/exec",
    "https://example.com/macros/s/BETA_DEPLOYMENT_ID/exec",
    "https://script.google.com.evil.example/macros/s/BETA_DEPLOYMENT_ID/exec"
  ]) {
    const storage = createStorage({ eouting_beta_api_override_v200: validBetaUrl });
    const result = createResolver()({
      hostname: "localhost",
      search: `?api=${encodeURIComponent(invalidUrl)}`
    }, storage);
    assert.equal(result.isBeta, false);
    assert.match(result.url, /PRODUCTION_ID/);
    assert.deepEqual(storage.snapshot(), {});
  }
});

test("localhost reuses only a valid sessionStorage override", () => {
  const validStorage = createStorage({ eouting_beta_api_override_v200: validBetaUrl });
  assert.equal(createResolver()({ hostname: "localhost", search: "" }, validStorage).isBeta, true);

  const invalidStorage = createStorage({
    eouting_beta_api_override_v200: "https://unrelated.example/exec"
  });
  const result = createResolver()({ hostname: "localhost", search: "" }, invalidStorage);
  assert.equal(result.isBeta, false);
  assert.deepEqual(invalidStorage.snapshot(), {});
});

test("all live GET and POST calls use the resolved endpoint", () => {
  const getSource = extractFunctionSource(appSource, "fetchApiGetWithRetry");
  const postSource = extractFunctionSource(appSource, "apiPost");
  assert.match(getSource, /getGasWebAppUrlV200\(\)/);
  assert.match(postSource, /getGasWebAppUrlV200\(\)/);
  assert.doesNotMatch(getSource + postSource, /fetch\(GAS_WEB_APP_URL/);
});

test("beta indicator exposes only a safe label and service worker caches no endpoint", () => {
  assert.match(indexSource, /id="betaApiIndicator"[^>]*hidden>BETA API</);
  assert.doesNotMatch(indexSource, /script\.google\.com/);
  assert.doesNotMatch(serviceWorkerSource, /script\.google\.com|BETA_DEPLOYMENT_ID/);
  assert.doesNotMatch(appSource, /localStorage\.(?:getItem|setItem)\([^\n]*beta_api/i);
});
