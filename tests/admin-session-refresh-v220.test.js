const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
const sessionSource = appSource.slice(
  appSource.indexOf("function buildAdminLoginPayloadV220"),
  appSource.indexOf("function clearAdminRuntimeCredentialV200")
);
const adminLoginSource = appSource.slice(
  appSource.indexOf("async function handleAdminLoginV200"),
  appSource.indexOf("function setAdminLoginLoadingV200")
);

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function createFixture({ stored, rejectLogin = false, storageThrows = false } = {}) {
  const key = "eouting_admin_session_v1";
  const sessionStorage = createStorage(stored === undefined ? {} : { [key]: stored });
  if (storageThrows) {
    sessionStorage.getItem = () => { throw new Error("blocked"); };
    sessionStorage.setItem = () => { throw new Error("blocked"); };
    sessionStorage.removeItem = () => { throw new Error("blocked"); };
  }
  const localStorage = createStorage();
  const calls = [];
  const context = vm.createContext({
    window: { sessionStorage, localStorage },
    sessionStorage,
    localStorage,
    calls,
    rejectLogin,
    console: { warn() {} }
  });
  vm.runInContext(`
    const ADMIN_SESSION_STORAGE_KEY = "${key}";
    const ADMIN_SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
    let adminRuntimeCredential = null;
    let currentSession = null;
    let dashboardRestored = false;
    let loginPanelShown = false;
    let loginMessage = "";
    function showAuthLoadingV220() { return 1; }
    function hideAuthLoadingV220() {}
    async function apiPost(action, payload) {
      calls.push({ action, payload: { ...payload } });
      if (rejectLogin) throw new Error("rejected");
      return { admin_id: "ADMIN-1", nama_admin: "Admin Ujian", status: "AKTIF" };
    }
    function startAdminSessionV200(admin) {
      currentSession = { role: "admin", user: admin };
      dashboardRestored = true;
    }
    function clearAdminRuntimeCredentialV200() { adminRuntimeCredential = null; }
    function showAdminLoginPanelV200() { loginPanelShown = true; }
    function setAdminLoginMessageV200(message) { loginMessage = message; }
    ${sessionSource}
    globalThis.api = {
      save: saveAdminSessionV220,
      payload: buildAdminLoginPayloadV220,
      get: getSavedAdminSessionV220,
      clear: clearSavedAdminSessionV220,
      restore: restoreSavedAdminSessionV220,
      state: () => ({ adminRuntimeCredential, currentSession, dashboardRestored, loginPanelShown, loginMessage })
    };
  `, context);
  return { context, key, sessionStorage, localStorage };
}

test("successful Admin login creates a bounded restorable sessionStorage record", () => {
  const fixture = createFixture();
  assert.equal(fixture.context.api.save({ identity: "  original.login  ", pin: "2468" }), true);
  const saved = JSON.parse(fixture.sessionStorage.getItem(fixture.key));
  assert.deepEqual(Object.keys(saved).sort(), ["expiresAt", "identity", "pin"]);
  assert.equal(saved.identity, "original.login");
  assert.equal(saved.pin, "2468");
  assert.ok(saved.expiresAt > Date.now());
  assert.ok(saved.expiresAt <= Date.now() + 12 * 60 * 60 * 1000 + 1000);
  assert.equal(fixture.localStorage.values.size, 0);
});

test("Admin refresh revalidates credentials and restores runtime session and dashboard", async () => {
  const stored = JSON.stringify({
    identity: "original.login",
    pin: "2468",
    expiresAt: Date.now() + 60_000
  });
  const fixture = createFixture({ stored });
  assert.equal(await fixture.context.api.restore(), true);
  const state = fixture.context.api.state();
  assert.equal(state.currentSession.role, "admin");
  assert.equal(state.adminRuntimeCredential.pin, "2468");
  assert.equal(state.dashboardRestored, true);
  assert.equal(fixture.context.calls[0].action, "loginAdmin");
  assert.deepEqual(
    JSON.parse(JSON.stringify(fixture.context.calls[0].payload)),
    { admin_id: "original.login", nama_admin: "original.login", pin: "2468" }
  );
});

test("normal login and refresh use identical loginAdmin payload semantics", () => {
  const fixture = createFixture();
  const normalPayload = fixture.context.api.payload("  original.login  ", "2468");
  fixture.context.api.save({ identity: "  original.login  ", pin: "2468" });
  const saved = fixture.context.api.get();
  const restorePayload = fixture.context.api.payload(saved.identity, saved.pin);
  assert.deepEqual(JSON.parse(JSON.stringify(restorePayload)), JSON.parse(JSON.stringify(normalPayload)));
  assert.match(adminLoginSource, /apiPost\("loginAdmin", buildAdminLoginPayloadV220\(identity, pin\)\)/);
  assert.match(adminLoginSource, /saveAdminSessionV220\(\{ identity, pin \}\)/);
});

test("Admin refresh preserves the original absolute expiry", async () => {
  const expiresAt = Date.now() + 60_000;
  const fixture = createFixture({
    stored: JSON.stringify({ identity: "ADMIN-1", pin: "2468", expiresAt })
  });
  assert.equal(await fixture.context.api.restore(), true);
  assert.equal(JSON.parse(fixture.sessionStorage.getItem(fixture.key)).expiresAt, expiresAt);
});

test("expired and malformed Admin sessions are rejected, cleared and return to login", async () => {
  for (const stored of [
    JSON.stringify({ identity: "ADMIN-1", pin: "2468", expiresAt: Date.now() - 1 }),
    "{bad-json",
    JSON.stringify({ identity: "ADMIN-1", expiresAt: Date.now() + 60_000 }),
    JSON.stringify({ admin_id: "ADMIN-1", pin: "2468", expiresAt: Date.now() + 60_000 })
  ]) {
    const fixture = createFixture({ stored });
    assert.equal(await fixture.context.api.restore(), false);
    assert.equal(fixture.sessionStorage.getItem(fixture.key), null);
    assert.equal(fixture.context.api.state().loginPanelShown, true);
  }
});

test("backend rejection clears the Admin session without a half-authenticated UI", async () => {
  const fixture = createFixture({
    rejectLogin: true,
    stored: JSON.stringify({ identity: "ADMIN-1", pin: "bad", expiresAt: Date.now() + 60_000 })
  });
  assert.equal(await fixture.context.api.restore(), false);
  const state = fixture.context.api.state();
  assert.equal(state.currentSession, null);
  assert.equal(state.adminRuntimeCredential, null);
  assert.equal(state.loginPanelShown, true);
  assert.equal(fixture.sessionStorage.getItem(fixture.key), null);
});

test("explicit clear prevents refresh restoration and storage failures fail safely", async () => {
  const fixture = createFixture();
  fixture.context.api.save({ identity: "ADMIN-1", pin: "2468" });
  fixture.context.api.clear();
  assert.equal(await fixture.context.api.restore(), null);

  const blocked = createFixture({ storageThrows: true });
  assert.equal(blocked.context.api.save({ identity: "ADMIN-1", pin: "2468" }), false);
  assert.equal(await blocked.context.api.restore(), false);
  assert.equal(blocked.context.api.state().loginPanelShown, true);
});

test("logout and startup use the dedicated Admin session without changing staff/student persistence", () => {
  const exitSource = appSource.slice(
    appSource.indexOf("function exitAdminSessionV200"),
    appSource.indexOf("function buildAdminCredentialPayloadV200")
  );
  const initSource = appSource.slice(appSource.indexOf("async function initApp"), appSource.indexOf("initApp();"));
  const legacySource = appSource.slice(
    appSource.indexOf("function saveSession"),
    appSource.indexOf("function findStudentForSavedSession")
  );
  assert.match(exitSource, /clearSavedAdminSessionV220\(\)/);
  assert.match(initSource, /restoreSavedAdminSessionV220\(\)/);
  assert.match(initSource, /adminRestoreResult === null[\s\S]*restoreSavedSession\(\)/);
  assert.match(legacySource, /localStorage\.setItem\(SESSION_STORAGE_KEY/);
  assert.match(legacySource, /session\.nama_warden[\s\S]*session\.nama_guard/);
  assert.doesNotMatch(sessionSource, /localStorage/);
});

test("Admin restore authenticates before public master loading and inactive tabs stay lazy", () => {
  const initSource = appSource.slice(appSource.indexOf("async function initApp"), appSource.indexOf("initApp();"));
  const startSource = appSource.slice(appSource.indexOf("function startAdminSessionV200"), appSource.indexOf("function buildAdminLoginPayloadV220"));
  assert.ok(initSource.indexOf("restoreSavedAdminSessionV220()") < initSource.indexOf("loadLiveMasters()"));
  assert.match(initSource, /adminRestoreResult === true[\s\S]*return/);
  assert.doesNotMatch(startSource, /loadAdminOutingTypesV200\(\)/);
  assert.match(startSource, /setAdminSectionV200\("monitoring"\)/);
});
