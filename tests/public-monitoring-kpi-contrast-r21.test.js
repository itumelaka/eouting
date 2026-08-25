const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const numericSelector = "#publicMonitoringPanel #monitorSummary .monitor-status-card > strong[data-rolling-number].rolling-number";

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `missing CSS rule for ${selector}`);
  return { declarations: match[1], index: match.index };
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

test("actual rolling Public Monitoring KPI number uses fully opaque dark ink", () => {
  const numberRule = cssRule(numericSelector);
  assert.match(numberRule.declarations, /color:\s*#0b263d/);
  assert.match(numberRule.declarations, /opacity:\s*1/);
  assert.match(numberRule.declarations, /-webkit-text-fill-color:\s*#0b263d/);
  assert.match(css, /#publicMonitoringPanel \.monitor-summary \.monitor-status-card span\s*\{[^}]*color:\s*#40566a/);
  assert.ok(contrast("#0b263d", "#ffffff") >= 4.5);
  assert.ok(contrast("#40566a", "#ffffff") >= 4.5);
});

test("no later rule overrides the actual Public Monitoring numeric paint", () => {
  const numberRule = cssRule(numericSelector);
  const afterRule = css.slice(numberRule.index + numericSelector.length + numberRule.declarations.length + 2);
  assert.doesNotMatch(afterRule, /#publicMonitoringPanel[^{}]*(?:data-rolling-number|rolling-number|monitor-status-card[^{}]*strong)[^{}]*\{[^}]*(?:color|opacity|text-fill-color)\s*:/);
});

test("all seven Public Monitoring KPI cards share the scoped readable styling", () => {
  const renderStart = app.indexOf("function renderMonitoringPageV1612");
  const renderEnd = app.indexOf("function publicMonitorStudentLabel", renderStart);
  const renderSource = app.slice(renderStart, renderEnd);
  const labels = [
    "Menunggu Kelulusan",
    "Diluluskan",
    "Sedang Keluar",
    "Sudah Pulang",
    "Lewat",
    "Belum Masuk",
    "Kecemasan"
  ];

  assert.equal((renderSource.match(/monitorSummaryCardV1612\(/g) || []).length, 7);
  for (const label of labels) assert.match(renderSource, new RegExp(`monitorSummaryCardV1612\\("${label}"`));
  assert.match(app, /<article class="summary-card monitor-status-card/);
  assert.match(app, /<strong data-rolling-number=/);
  assert.match(app, /element\.classList\.add\("rolling-number"\)/);
});

test("Penghuni Semasa Asrama KPI styling remains separate and unchanged", () => {
  assert.match(css, /\.current-hostel-kpi strong,[\s\S]*?\.current-hostel-group-count strong\s*\{[^}]*color:\s*var\(--deep-navy\)/);
  assert.doesNotMatch(numericSelector, /current-hostel/);
});

test("nearby Public Monitoring heading, helper and timestamp use readable dark-surface text", () => {
  assert.match(css, /#publicMonitoringPanel \.section-heading h2\s*\{[^}]*color:\s*#ffffff/);
  assert.match(css, /#publicMonitoringPanel \.section-heading p,[\s\S]*?#publicMonitoringPanel #monitorLastUpdated\s*\{[^}]*color:\s*#b5c4d4/);
  assert.ok(contrast("#b5c4d4", "#071a33") >= 4.5);
});

test("r21 cache identifiers are consistent and display version remains v2.4.0", () => {
  assert.match(html, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(html, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(worker, /eouting-cache-v2\.4\.0-r21/);
  assert.match(worker, /assets\/style\.css\?v=2\.4\.0-r21/);
  assert.match(worker, /assets\/app\.js\?v=2\.4\.0-r21/);
  assert.match(html, /eOuting ITU • v2\.4\.0/);
  assert.doesNotMatch(`${html}\n${worker}`, /2\.4\.0-r20/);
});
