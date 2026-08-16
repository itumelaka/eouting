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

test("landing role grid has four operational Clay identities without public Statistics", () => {
  ["student", "warden", "guard", "monitor"].forEach((role) => {
    assert.match(css, new RegExp(`data-role-choice=["']${role}["']`));
  });
  assert.match(css, /--clay-blue:/);
  assert.match(css, /--clay-purple:/);
  assert.match(css, /--clay-orange:/);
  assert.match(css, /--clay-green:/);
  assert.match(css, /--clay-turquoise:/);
  assert.match(css, /--clay-amber:/);
  assert.match(css, /\.clay-role-nav\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)[^}]*max-width:\s*820px/s);
  assert.doesNotMatch(css, /data-role-choice="monitor"\][^}]*grid-column/s);
  assert.match(css, /\.role-card\.clay-role-button\s*\{[^}]*min-height:\s*82px[^}]*padding:\s*12px 48px 12px 58px/s);
  assert.match(css, /\.role-card\.clay-role-button strong\s*\{[^}]*font-size:\s*clamp\(1\.08rem, 1\.5vw, 1\.2rem\)/s);
  assert.doesNotMatch(`${html}\n${app}\n${css}`, /data-role-choice=["']stats["']/);
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
  assert.match(html, /id="appVersionText">eOuting ITU • v2\.3\.2/);
  assert.match(css, /\.beta-api-indicator\s*\{/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(max-width: 520px\)/);
});
