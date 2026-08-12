const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function sourceBetween(start, end) {
  return app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
}

test("one global Clay auth loader is accessible and public monitoring stays separate", () => {
  assert.match(html, /id="authLoading"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
  assert.match(html, /id="authLoadingTitle"/);
  assert.match(html, /Mengesahkan akses dan memuatkan paparan/);
  assert.equal((html.match(/id="authLoading"/g) || []).length, 1);
  assert.match(html, /id="publicMonitoringPanel"/);
  assert.doesNotMatch(sourceBetween("function showAuthLoadingV220", "function isSafeEnterSubmitTargetV211"), /publicMonitoring/);
  assert.match(css, /\.auth-loading-card[\s\S]*linear-gradient/);
});

test("loader helper labels every role and hides only the active operation", () => {
  const helperSource = sourceBetween("let authLoadingSequenceV220", "function isSafeEnterSubmitTargetV211");
  const loading = { hidden: true };
  const title = { textContent: "" };
  const detail = { textContent: "" };
  const context = vm.createContext({ els: { authLoading: loading, authLoadingTitle: title, authLoadingDetail: detail } });
  vm.runInContext(`${helperSource}; globalThis.api={show:showAuthLoadingV220,hide:hideAuthLoadingV220};`, context);
  for (const [role, label] of [["student", "Pelajar"], ["warden", "Warden"], ["guard", "Guard"], ["admin", "Admin"]]) {
    const token = context.api.show(role, true);
    assert.equal(loading.hidden, false);
    assert.equal(title.textContent, `Memulihkan sesi ${label}...`);
    assert.equal(detail.textContent, "Mengesahkan akses dan memuatkan paparan");
    context.api.hide(token);
    assert.equal(loading.hidden, true);
  }
  const stale = context.api.show("student", true);
  const active = context.api.show("admin", true);
  context.api.hide(stale);
  assert.equal(loading.hidden, false);
  context.api.hide(active);
  assert.equal(loading.hidden, true);
});

test("manual login and restore paths always clear the shared loader", () => {
  for (const role of ["Student", "Warden", "Guard"]) {
    const source = sourceBetween(`async function handle${role}LoginSubmitV211`, `els.${role.toLowerCase()}LoginPanel.addEventListener`);
    assert.match(source, /showAuthLoadingV220/);
    assert.match(source, /finally[\s\S]*hideAuthLoadingV220/);
  }
  const adminLogin = sourceBetween("async function handleAdminLoginV200", "function setAdminLoginLoadingV200");
  const adminRestore = sourceBetween("async function restoreSavedAdminSessionV220", "function clearAdminRuntimeCredentialV200");
  const savedRestore = sourceBetween("async function restoreSavedSession", "function findStudentForSavedSession");
  for (const source of [adminLogin, adminRestore, savedRestore]) {
    assert.match(source, /showAuthLoadingV220/);
    assert.match(source, /finally[\s\S]*hideAuthLoadingV220/);
  }
  assert.match(app, /function exitAdminSessionV200\(\)[\s\S]*?hideAuthLoadingV220\(\)/);
  assert.match(app, /els\.logoutButton\.addEventListener\("click", \(\) => \{\s*hideAuthLoadingV220\(\)/);
});

test("reduced motion disables every loader animation", () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.auth-loading-card,[\s\S]*\.auth-loading-orb span[\s\S]*animation: none !important/);
});
