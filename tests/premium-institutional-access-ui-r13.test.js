const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const premiumCss = css.slice(css.indexOf("Premium Institutional Access UI — r13"));

test("access header starts with the primary heading and keeps the integrated Admin action", () => {
  const headingStart = html.indexOf('<div class="section-heading access-heading">');
  const headingEnd = html.indexOf("</div>", html.indexOf("</button>", headingStart));
  const headingMarkup = html.slice(headingStart, headingEnd);

  assert.notEqual(headingStart, -1);
  assert.doesNotMatch(html, /Portal Akses Institusi/i);
  assert.match(headingMarkup, /<div class="access-heading-copy">\s*<h2>Masuk Sistem<\/h2>\s*<p>Sila pilih peranan anda\.<\/p>/);
  assert.match(headingMarkup, /<button class="admin-management-button"[^>]*data-role-choice="admin">/);
});

test("UI-1 keeps one canonical Student login form and every access route", () => {
  assert.equal((html.match(/<form\b[^>]*id="studentLoginPanel"/g) || []).length, 1);
  ["student", "warden", "guard"].forEach((role) => {
    assert.match(html, new RegExp(`data-role-choice="${role}"`));
  });
  assert.match(app, /dataset\.roleChoice\s*=\s*"monitor"/);
  assert.match(app, /<strong>Pemantauan Semasa<\/strong>/);
  assert.match(html, /data-role-choice="admin"/);
  assert.match(html, /id="studentLoginPanel"/);
  assert.match(html, /id="wardenLoginPanel"/);
  assert.match(html, /id="guardLoginPanel"/);
  assert.match(html, /id="adminLoginPanel"/);
  assert.match(html, /id="publicMonitoringPanel"/);
});

test("Student access controls and existing IDs remain intact", () => {
  [
    "studentClassFilter", "studentLoginGroupLabel", "studentLoginSelect", "matricInput",
    "studentRememberInput", "studentLoginMessage", "wardenSelect", "guardSelect",
    "adminIdentityInput", "adminPinInput", "todayDate", "todayDay", "currentTime"
  ].forEach((id) => assert.match(html, new RegExp(`id="${id}"`)));
  assert.match(html, /Nama Pelajar/);
  assert.match(html, /No\. Matrik/);
  assert.match(html, /Ingat peranti ini/);
  assert.match(html, /Masuk sebagai Pelajar/);
  assert.match(app, /Live Mode: Google Sheets/);
});

test("dynamic Student groups remain backend-driven, unlimited and accessible", () => {
  assert.match(app, /directoryGroups\.map\(\(group\)\s*=>/);
  assert.match(app, /data-student-login-group="\$\{escapeHtml\(group\.key\)\}"/);
  assert.match(app, /button\.setAttribute\("aria-pressed", isActive \? "true" : "false"\)/);
  assert.match(premiumCss, /\.student-class-pills\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s);
  assert.doesNotMatch(premiumCss, /\b(?:A2|A3|LI UMK|LI UPM)\b/);
  assert.doesNotMatch(app, /directoryGroups\s*\.slice\(\s*0\s*,\s*4\s*\)/);
});

test("selected roles and group chips are not communicated by colour alone", () => {
  assert.match(app, /button\.setAttribute\("aria-pressed", String\(active\)\)/);
  assert.match(premiumCss, /role-card\.clay-role-button\[aria-pressed="true"\]::after[\s\S]*?content:\s*"✓"/);
  assert.match(premiumCss, /student-class-pill\[aria-pressed="true"\]::before[\s\S]*?content:\s*"✓ "/);
});

test("authentication and public monitoring call boundaries remain unchanged", () => {
  assert.match(app, /apiPost\("loginStudent",\s*\{\s*student_id:[\s\S]*?no_matrik:\s*enteredMatric\s*\}\)/);
  assert.match(app, /apiPost\("loginWarden",\s*\{\s*nama_warden:\s*name,\s*pin\s*\}\)/);
  assert.match(app, /apiPost\("loginGuard",\s*\{\s*nama_guard:\s*name,\s*pin\s*\}\)/);
  assert.match(app, /apiPost\("loginAdmin",\s*buildAdminLoginPayloadV220\(identity, pin\)\)/);
  assert.match(app, /function openMonitoringPage\(eventOrOptions\)/);
  assert.match(app, /apiGet\("getTodayRecords"\)/);
  assert.match(app, /apiGet\("getCurrentHostelSummary"\)/);
});

test("premium access layer uses real local assets without remote image or font dependencies", () => {
  assert.match(html, /src="assets\/eouting-header-logo\.png"/);
  assert.match(html, /src="assets\/pwa-logo\.png"/);
  assert.doesNotMatch(html, /<(?:img|script|link)\b[^>]*(?:src|href)="https?:\/\//i);
  assert.doesNotMatch(premiumCss, /@import|url\(\s*["']?https?:\/\//i);
});

test("responsive access layout wraps safely from four columns to mobile", () => {
  assert.match(premiumCss, /\.clay-role-nav\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/s);
  assert.match(premiumCss, /@media \(max-width: 1099px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(premiumCss, /@media \(max-width: 620px\)[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(premiumCss, /@media \(max-width: 430px\)[\s\S]*?\.access-panel\s*\{[^}]*width:\s*100%/s);
  assert.doesNotMatch(premiumCss, /\.access-panel\s*\{[^}]*(?<!max-)width:\s*[5-9]\d{2}px/s);
});

test("date, day and time remain live in one compact metadata line", () => {
  assert.match(html, /class="time-card time-metadata"[^>]*aria-live="polite"/);
  assert.match(html, /id="todayDate"[\s\S]*?time-metadata-separator[\s\S]*?id="todayDay"[\s\S]*?time-metadata-separator[\s\S]*?id="currentTime"/);
  assert.match(premiumCss, /\.time-card\s*\{[^}]*background:\s*transparent;[^}]*border:\s*0;[^}]*box-shadow:\s*none;[^}]*flex-direction:\s*row;/s);
  assert.match(app, /function updateClock\(\)[\s\S]*?els\.todayDate\.textContent[\s\S]*?els\.todayDay\.textContent[\s\S]*?els\.currentTime\.textContent/);
});

test("polish keeps a wide Student panel and dynamic two-column mobile chips", () => {
  assert.match(premiumCss, /\.access-panel\s*\{[^}]*max-width:\s*880px/s);
  assert.match(premiumCss, /@media \(max-width: 430px\)[\s\S]*?\.student-class-pill\s*\{[^}]*flex:\s*1 1 calc\(50% - 7px\)/s);
  assert.doesNotMatch(premiumCss, /\.student-class-pills\s*\{[^}]*grid-template-columns:\s*repeat\(4/s);
});

test("accessibility styling covers focus, touch targets, autofill and reduced motion", () => {
  assert.match(premiumCss, /:focus-visible/);
  assert.match(premiumCss, /min-height:\s*(?:42|46|48|50)px/);
  assert.match(premiumCss, /input:-webkit-autofill/);
  assert.match(premiumCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /aria-labelledby="studentLoginTitle"/);
  assert.match(html, /aria-live="polite"/);
});

test("r13 access UI remains intact under the r17 frontend cache revision", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r20/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r20/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r20/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r13/);
});
