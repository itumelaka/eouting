const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
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

function formMarkup(id) {
  const match = indexSource.match(new RegExp(`<form[^>]*id="${id}"[\\s\\S]*?<\\/form>`));
  assert.ok(match, `${id} form must exist`);
  return match[0];
}

test("all four login flows use native form submit semantics and their existing handlers", () => {
  const handlers = [
    ["studentLoginPanel", "handleStudentLoginSubmitV211"],
    ["wardenLoginPanel", "handleWardenLoginSubmitV211"],
    ["guardLoginPanel", "handleGuardLoginSubmitV211"],
    ["adminLoginPanel", "handleAdminLoginV200"]
  ];
  handlers.forEach(([formId, handler]) => {
    assert.match(formMarkup(formId), /<button[^>]*type="submit"/);
    assert.match(appSource, new RegExp(`els\\.${formId}\\.addEventListener\\("submit", ${handler}\\)`));
    assert.match(extractFunction(appSource, handler), /event\.preventDefault\(\)/);
  });
  assert.doesNotMatch(handlers.map(([formId]) => formMarkup(formId)).join("\n"), /onkeydown|onkeypress|onclick=/i);
});

test("Student, Warden/HEP and Guard share one scoped in-flight submission lock", () => {
  const context = vm.createContext({});
  vm.runInContext(extractFunction(appSource, "setLoginFormSubmittingV211"), context);
  const button = { disabled: false, textContent: "Masuk", dataset: {} };
  const form = { dataset: {}, querySelector: () => button };

  assert.equal(context.setLoginFormSubmittingV211(form, true, "Mengesahkan..."), true);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, "Mengesahkan...");
  assert.equal(context.setLoginFormSubmittingV211(form, true, "Mengesahkan..."), false);
  assert.equal(context.setLoginFormSubmittingV211(form, false), true);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, "Masuk");

  for (const handler of ["handleStudentLoginSubmitV211", "handleWardenLoginSubmitV211", "handleGuardLoginSubmitV211"]) {
    const source = extractFunction(appSource, handler);
    assert.match(source, /setLoginFormSubmittingV211\([^,]+, true, "Mengesahkan\.\.\."\)/);
    assert.match(source, /finally[\s\S]*setLoginFormSubmittingV211\([^,]+, false\)/);
  }
});

test("scoped Enter requests the existing form submit and ignores unsafe targets", () => {
  const submitButton = { disabled: false, clickCalls: 0, click() { this.clickCalls += 1; } };
  const form = {
    dataset: {},
    requestCalls: 0,
    querySelector: () => submitButton,
    requestSubmit(button) { assert.strictEqual(button, submitButton); this.requestCalls += 1; }
  };
  const els = {
    adminStaffForm: {},
    adminStaffPin: { value: "" },
    adminStaffEditorMessage: { textContent: "" }
  };
  const context = vm.createContext({ els, adminEditingStaffV210: null });
  vm.runInContext("const els = globalThis.els; let adminEditingStaffV210 = globalThis.adminEditingStaffV210;", context);
  vm.runInContext(extractFunction(appSource, "isSafeEnterSubmitTargetV211"), context);
  vm.runInContext(extractFunction(appSource, "handleScopedFormEnterV211"), context);

  function keyEvent(target, overrides = {}) {
    return Object.assign({
      key: "Enter", target, currentTarget: form, defaultPrevented: false, isComposing: false,
      altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
      preventDefault() { this.defaultPrevented = true; }
    }, overrides);
  }

  const inputEvent = keyEvent({ tagName: "INPUT", type: "password", isContentEditable: false });
  context.handleScopedFormEnterV211(inputEvent);
  assert.equal(inputEvent.defaultPrevented, true);
  assert.equal(form.requestCalls, 1);

  const textareaEvent = keyEvent({ tagName: "TEXTAREA", isContentEditable: false });
  context.handleScopedFormEnterV211(textareaEvent);
  assert.equal(textareaEvent.defaultPrevented, false);
  assert.equal(form.requestCalls, 1);

  const checkboxEvent = keyEvent({ tagName: "INPUT", type: "checkbox", isContentEditable: false });
  context.handleScopedFormEnterV211(checkboxEvent);
  assert.equal(checkboxEvent.defaultPrevented, false);
  assert.equal(form.requestCalls, 1);

  submitButton.disabled = true;
  const disabledEvent = keyEvent({ tagName: "INPUT", type: "text", isContentEditable: false });
  context.handleScopedFormEnterV211(disabledEvent);
  assert.equal(disabledEvent.defaultPrevented, true);
  assert.equal(form.requestCalls, 1);
});

test("Admin login and safe editor forms reject a duplicate submit while their Save button is disabled", () => {
  const guardedHandlers = [
    ["handleAdminLoginV200", "adminLoginButton"],
    ["handleAdminStudentSubmitV200", "adminSaveStudentButton"],
    ["saveAdminStaffV210", "adminStaffSaveButton"],
    ["handleAdminTypeSubmitV200", "adminSaveTypeButton"]
  ];
  guardedHandlers.forEach(([handler, button]) => {
    const source = extractFunction(appSource, handler);
    assert.match(source, new RegExp(`if \\(els\\.${button}\\.disabled\\) return;`));
  });
  for (const formId of ["adminStudentForm", "adminStaffForm", "adminOutingTypeForm"]) {
    assert.match(formMarkup(formId), /<button[^>]*type="submit"/);
  }
});

test("textarea Enter remains native newline behavior with no invented submit shortcut", () => {
  const textareas = Array.from(indexSource.matchAll(/<textarea\b[^>]*id="([^"]+)"[^>]*>/g), (match) => match[1]);
  assert.ok(textareas.length >= 6);
  textareas.forEach((id) => {
    assert.doesNotMatch(appSource, new RegExp(`${id}[^\\n]*addEventListener\\("keydown"`));
  });
  assert.doesNotMatch(appSource, /Ctrl\+Enter|ctrlKey[\s\S]{0,120}requestSubmit|textarea[\s\S]{0,120}requestSubmit/i);
  assert.match(extractFunction(appSource, "isSafeEnterSubmitTargetV211"), /tagName === "TEXTAREA"[\s\S]*return false/);
});

test("generic Enter is not wired to operational or destructive actions", () => {
  assert.doesNotMatch(appSource, /document\.addEventListener\("keydown"[\s\S]{0,240}(?:confirmOut|confirmIn|updateStatus|toggleAdminStudentStatusV200|removeAdminStudentProfilePhoto)/);
  for (const actionHook of ["data-out", "data-in", "data-approve", "data-reject", "data-admin-student-toggle", "data-admin-student-photo-remove", "data-staff-toggle"]) {
    const pattern = new RegExp(`<button[^>]*type="button"[^>]*${actionHook}|<button[^>]*${actionHook}[^>]*type="button"`);
    assert.match(appSource, pattern, `${actionHook} must remain an explicit button action`);
  }
  assert.match(indexSource, /id="logoutButton"[^>]*type="button"/);
  const setup = extractFunction(appSource, "setupScopedEnterSubmissionV211");
  assert.doesNotMatch(setup, /requestForm|logoutButton|approve|reject|toggle|photo|guardOut|guardIn/);
  assert.match(extractFunction(appSource, "handleScopedFormEnterV211"), /adminEditingStaffV210[\s\S]*Gunakan butang Simpan Staff untuk mengesahkan reset PIN/);
});
