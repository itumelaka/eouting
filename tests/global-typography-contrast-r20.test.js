const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const auditStart = css.indexOf("Global Typography & Contrast Audit — r20");
const auditCss = css.slice(auditStart);

function rule(selectorFragment) {
  const escaped = selectorFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = auditCss.match(new RegExp(`[^{}]*${escaped}[^{}]*\\{([^{}]*)\\}`));
  assert.ok(match, `missing r20 rule for ${selectorFragment}`);
  return match[1];
}

function luminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((value) => {
    const channel = parseInt(value, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("r20 audit layer exists and keeps focus-visible and reduced-motion safeguards", () => {
  assert.notEqual(auditStart, -1);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test("Admin Statistik table uses dark readable ink on every light surface", () => {
  assert.match(rule("#adminStatisticsPanel .individual-stats-table"), /color:\s*#172c3d/);
  assert.match(rule("#adminStatisticsPanel .individual-stats-table th"), /background:\s*#e5edf5/);
  assert.match(rule("#adminStatisticsPanel .individual-stats-table th"), /color:\s*#0b263d/);
  assert.match(rule("#adminStatisticsPanel .individual-stats-table td"), /color:\s*#263b4c/);
  assert.ok(contrast("#263b4c", "#ffffff") >= 4.5);
  assert.ok(contrast("#0b263d", "#e5edf5") >= 4.5);
});

test("Statistik headings, helper copy, KPI labels and KPI numbers retain hierarchy", () => {
  assert.match(rule("#adminStatisticsPanel .student-record-heading h3"), /color:\s*#ffffff/);
  assert.match(rule("#adminStatisticsPanel .student-record-heading p"), /color:\s*#b9ccd7/);
  assert.match(rule("#adminStatisticsPanel .stats-card span"), /color:\s*#40566a/);
  assert.match(rule("#adminStatisticsPanel .stats-card strong"), /color:\s*#0b263d/);
  assert.ok(contrast("#40566a", "#ffffff") >= 4.5);
  assert.ok(contrast("#0b263d", "#ffffff") >= 4.5);
});

test("Statistik mobile cards keep readable values and metadata labels", () => {
  assert.match(rule("#adminStatisticsPanel .individual-stats-table td::before"), /color:\s*#465d70/);
  assert.match(css, /@media \(max-width: 719px\)[\s\S]*?\.individual-stats-table tr\s*\{[\s\S]*?background:\s*#ffffff/);
  assert.ok(contrast("#465d70", "#ffffff") >= 4.5);
});

test("Student form, placeholders and disabled submit remain readable", () => {
  assert.match(css, /#pelajar #requestForm label\s*\{[\s\S]*?color:\s*#e7f2fc/);
  assert.match(rule("#pelajar #requestForm :where(input, textarea)::placeholder"), /color:\s*#566d82/);
  const disabled = rule("#pelajar :where(button, .return-selfie-picker):disabled");
  assert.match(disabled, /color:\s*#e1e9f0/);
  assert.match(disabled, /opacity:\s*1/);
});

test("Warden and Guard disabled actions stay distinct without destructive opacity", () => {
  const warden = rule("#warden :where(button, .action-button):disabled");
  const guard = rule("#guard :where(button, .action-button):disabled");
  assert.match(warden, /color:\s*#e1e9f0/);
  assert.match(guard, /color:\s*#f6ead5/);
  assert.match(warden, /opacity:\s*1/);
  assert.match(guard, /opacity:\s*1/);
});

test("Guard Search placeholder is readable on its dark control", () => {
  const search = rule("#guard #guardStudentSearch::placeholder");
  assert.match(search, /color:\s*#b5c4d4/);
  assert.match(search, /opacity:\s*1/);
  assert.ok(contrast("#b5c4d4", "#071a30") >= 4.5);
});

test("Admin config labels, helper text, placeholders and disabled inputs are readable", () => {
  assert.match(rule("#admin .admin-editor .admin-form-grid label"), /color:\s*#e4eef5/);
  assert.match(rule("#admin .admin-editor .admin-form-grid .admin-field-helper"), /color:\s*#b4c5d0/);
  assert.match(rule("#admin :where(input, textarea)::placeholder"), /color:\s*#9db0bd/);
  const disabled = rule("#admin :where(button, input, select, textarea):disabled");
  assert.match(disabled, /color:\s*#d6e1e8/);
  assert.match(disabled, /opacity:\s*1/);
});

test("active, inactive, readiness and Dynamic Login states keep explicit readable colors", () => {
  assert.match(css, /\.clay-status-badge\.is-active\s*\{[^}]*background:\s*#065f46;[^}]*color:\s*#d1fae5/);
  assert.match(css, /\.clay-status-badge\.is-inactive\s*\{[^}]*background:\s*#334155;[^}]*color:\s*#e2e8f0/);
  assert.match(css, /\.admin-config-status summary\s*\{[\s\S]*?color:\s*#d9f7f5/);
  assert.match(css, /\.admin-dynamic-login-heading strong\s*\{[\s\S]*?color:\s*#d1fae5/);
  assert.match(rule(".is-inactive"), /opacity:\s*1/);
});

test("Access role cards and Public Monitoring light surfaces retain explicit ink", () => {
  assert.match(css, /body:has\(#accessScreen:not\(\.hidden\)\) \.role-card[\s\S]*?color:/);
  assert.match(css, /\.monitor-name-row strong\s*\{[\s\S]*?color:\s*var\(--deep-navy\)/);
  assert.match(css, /\.monitor-name-meta\s*\{[\s\S]*?color:\s*var\(--muted\)/);
  assert.match(css, /\.monitor-loading\s*\{[\s\S]*?background:\s*#ffffff[\s\S]*?color:\s*var\(--muted\)/);
});

test("autofill text, background and caret stay readable on light and dark inputs", () => {
  const light = rule("#requestForm :where(input, textarea):-webkit-autofill");
  const dark = rule("#admin :where(input, textarea):-webkit-autofill");
  assert.match(light, /caret-color:\s*#0b1e36/);
  assert.match(light, /-webkit-text-fill-color:\s*#0b1e36/);
  assert.match(dark, /caret-color:\s*#f2f8fc/);
  assert.match(dark, /-webkit-text-fill-color:\s*#f2f8fc/);
});

test("semantic badges and role colors remain distinct", () => {
  for (const color of ["#2196f3", "#8b7cf6", "#f59e0b", "#2dd4bf"]) assert.match(css, new RegExp(color));
  assert.match(css, /#warden[\s\S]*?\.badge-pending\s*\{[^}]*color:\s*#2d1d00/);
  assert.match(css, /#guard[\s\S]*?\.badge-out\s*\{[^}]*color:\s*#2c1202/);
  assert.match(css, /#pelajar[\s\S]*?\.badge-returned\s*\{[^}]*color:\s*#03291d/);
});

test("r20 cache is consistent while display version remains v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r20/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r20/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r20/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r19/);
});

test("r20 presentation commit changes no application logic or GAS/backend files", () => {
  const changed = execFileSync("git", ["diff", "--name-only", "fb54c5e^", "fb54c5e"], { cwd: root, encoding: "utf8" })
    .trim().split(/\r?\n/).filter(Boolean);
  assert.ok(!changed.includes("assets/app.js"));
  assert.ok(changed.every((name) => !name.startsWith("gas/") && !name.startsWith("backend/")));
});
