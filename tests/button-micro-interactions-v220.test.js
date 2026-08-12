const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = app.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}") depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

test("primary, secondary and compact controls share subtle hover and press primitives", () => {
  assert.match(css, /--control-hover-lift:\s*-2px/);
  assert.match(css, /--control-press-scale:\s*0\.988/);
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*:where\(button, \.return-selfie-picker\):not\(:disabled\)[\s\S]*:hover[\s\S]*translateY\(var\(--control-hover-lift\)\)/);
  assert.match(css, /:where\(button, \.return-selfie-picker\):not\(:disabled\)[\s\S]*:active[\s\S]*scale\(var\(--control-press-scale\)\)/);
  assert.match(html, /<button class="primary-action"/);
  assert.match(html, /<button class="secondary-action"/);
  assert.match(html, /class="secondary-action compact-action"/);
});

test("focus, disabled, touch and reduced-motion safeguards remain explicit", () => {
  assert.match(css, /:where\(button, \[role="button"\], \.return-selfie-picker\):focus-visible[\s\S]*outline:\s*3px solid/);
  assert.match(css, /:where\(button, \.return-selfie-picker\):disabled[\s\S]*transform:\s*none/);
  assert.match(css, /@media \(hover: none\)[\s\S]*:not\(:active\):hover[\s\S]*transform:\s*none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.has-loading-indicator::before[\s\S]*animation:\s*none/);
  assert.match(css, /touch-action:\s*manipulation/);
});

test("active application and Admin tabs keep smooth state transitions", () => {
  assert.match(css, /:where\(button, \.return-selfie-picker\)[\s\S]*transition:/);
  assert.match(html, /<button class="tab-button active"/);
  assert.match(html, /<button class="admin-subtab active"/);
  assert.match(css, /:where\(\.tab-button, \.admin-subtab, \.quick-filter-button, \.admin-management-button\)\.active/);
  assert.match(css, /\.admin-subtab\.active\s*\{[\s\S]*background:[\s\S]*box-shadow:/);
});

test("reusable loading indicator sets and clears class and aria state without delay", () => {
  const source = extractFunction("setButtonLoadingVisualV220");
  const context = vm.createContext({});
  vm.runInContext(source, context);
  const classes = new Set();
  const attributes = new Map();
  const button = {
    classList: { toggle(name, active) { if (active) classes.add(name); else classes.delete(name); } },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); }
  };

  context.setButtonLoadingVisualV220(button, true);
  assert.equal(classes.has("has-loading-indicator"), true);
  assert.equal(attributes.get("aria-busy"), "true");
  context.setButtonLoadingVisualV220(button, false);
  assert.equal(classes.has("has-loading-indicator"), false);
  assert.equal(attributes.has("aria-busy"), false);
  assert.doesNotMatch(source, /setTimeout|Promise|await/);
});

test("existing async paths reuse the visual helper while operational spinners stay intact", () => {
  assert.match(extractFunction("setLoginFormSubmittingV211"), /setButtonLoadingVisualV220\?\.\(button, true\)[\s\S]*setButtonLoadingVisualV220\?\.\(button, false\)/);
  assert.match(extractFunction("setAdminLoginLoadingV200"), /setButtonLoadingVisualV220/);
  assert.match(extractFunction("setAdminEditorBusyV200"), /setButtonLoadingVisualV220/);
  assert.match(app, /student-submit-spinner operational-action-spinner/);
  assert.match(css, /\.has-loading-indicator::before[\s\S]*border-top-color:\s*currentColor/);
});
