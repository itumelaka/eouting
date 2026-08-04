const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const roleGridStart = html.indexOf('<div class="role-grid" id="roleGrid">');
const roleGridEnd = html.indexOf('<form class="access-panel" id="studentLoginPanel">', roleGridStart);
assert.notEqual(roleGridStart, -1, "roleGrid must exist");
assert.notEqual(roleGridEnd, -1, "student login panel must follow roleGrid");
const roleGridMarkup = html.slice(roleGridStart, roleGridEnd);

test("landing role grid has five operational Clay identities", () => {
  ["student", "warden", "guard", "monitor", "stats"].forEach((role) => {
    assert.match(css, new RegExp(`data-role-choice=["']${role}["']`));
  });
  assert.match(css, /--clay-blue:/);
  assert.match(css, /--clay-purple:/);
  assert.match(css, /--clay-orange:/);
  assert.match(css, /--clay-green:/);
  assert.match(css, /--clay-turquoise:/);
  assert.match(css, /--clay-amber:/);
  assert.match(css, /grid-template-columns:\s*repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(css, /data-role-choice="monitor"\][^}]*grid-column:\s*2 \/ span 2/s);
  assert.match(css, /data-role-choice="stats"\][^}]*grid-column:\s*4 \/ span 2/s);
});

test("landing terminology keeps LI students within the existing Pelajar role", () => {
  assert.match(roleGridMarkup, /data-role-choice="student"[\s\S]*?<strong>Pelajar<\/strong>/);
  assert.match(roleGridMarkup, /data-role-choice="student"/);
  assert.doesNotMatch(roleGridMarkup, /Pelajar Latihan Industri \(LI\)|data-role-choice="li"/i);
  assert.doesNotMatch(html, /data-role-choice="li"/i);
  assert.match(app, /student:\s*"Pelajar"/);
  assert.match(html, /Pelajar Latihan Industri \(LI\)/);
  assert.match(html, /data-student-class="LI"[^>]*hidden/);
  assert.doesNotMatch(`${html}\n${app}`, /pelajar praktikal/i);
});

test("Admin management entry sits outside the main role grid and preserves its hook", () => {
  assert.doesNotMatch(roleGridMarkup, /data-role-choice="admin"/);
  assert.match(html, /class="admin-management-button"[^>]*data-role-choice="admin"/);
  assert.match(app, /document\.querySelectorAll\("\[data-role-choice\]"\)/);
  assert.match(app, /button\.dataset\.roleChoice === "admin"/);
  assert.match(css, /\.admin-management-button\s*\{/);
});

test("Admin cards render safe stacked time labels without changing action hooks", () => {
  assert.match(app, /class="admin-time-stack"/);
  assert.match(app, /data-admin-edit=/);
  assert.match(app, /data-admin-toggle=/);
  assert.match(css, /\.admin-time-stack\s*\{/);
  assert.match(css, /\.admin-time-stack span\s*\{/);
});

test("Clay UI preserves beta identity and accessibility safeguards", () => {
  assert.match(html, /id="betaApiIndicator"/);
  assert.match(html, /id="appVersionText">eOuting ITU • v2\.0\.0/);
  assert.match(css, /\.beta-api-indicator\s*\{/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});
