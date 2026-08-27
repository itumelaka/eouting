const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

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

test("shared navy surfaces receive a conservative, hierarchical brightness lift", () => {
  assert.match(css, /--access-navy-950:\s*#07172b/);
  assert.match(css, /--access-navy-900:\s*#0c2946/);
  assert.match(css, /--access-navy-800:\s*#123b62/);
  assert.match(css, /--access-panel-start:\s*rgba\(18, 50, 82, 0\.96\)/);
  assert.match(css, /--access-card-start:\s*rgba\(22, 56, 91, 0\.96\)/);
  assert.match(css, /--access-control-surface:\s*rgba\(18, 47, 76, 0\.9\)/);

  assert.ok(luminance("#07172b") < luminance("#0c2946"));
  assert.ok(luminance("#0c2946") < luminance("#123b62"));
  assert.ok(luminance("#123252") < luminance("#16385b"));
});

test("public and every authenticated role use the lifted dark surfaces", () => {
  assert.match(css, /body:has\(#accessScreen:not\(\.hidden\)\)[\s\S]*?#12365a 100%/);
  assert.match(css, /body:has\(#appWorkspace\.active #pelajar\.tab-panel\.active\)[\s\S]*?#12365a 100%/);
  assert.match(css, /body:has\(#appWorkspace\.active #warden\.tab-panel\.active\)[\s\S]*?#102d4d 52%, #1a2d58 100%/);
  assert.match(css, /body:has\(#appWorkspace\.active #guard\.tab-panel\.active\)[\s\S]*?#102b48 54%, #22314b 100%/);
  assert.match(css, /body:has\(#admin\.admin-dashboard\.active\)[\s\S]*?#0f2d47 52%, #17394b 100%/);
});

test("muted dark-surface copy and form placeholders remain WCAG AA readable", () => {
  assert.match(css, /--access-muted:\s*#9fb3c8/);
  assert.match(css, /#guardStudentSearch::placeholder\s*\{[\s\S]*?color:\s*#b5c4d4/);
  assert.match(css, /#admin :where\(input, textarea\)::placeholder\s*\{[\s\S]*?color:\s*#9db0bd/);
  assert.match(css, /#admin :where\(input, select, textarea\)::placeholder \{ color: #a4b7c4; \}/);

  assert.ok(contrast("#9fb3c8", "#16385b") >= 4.5);
  assert.ok(contrast("#aebed3", "#1d3452") >= 4.5);
  assert.ok(contrast("#b5c4d4", "#1a314e") >= 4.5);
  assert.ok(contrast("#a4b7c4", "#0f2941") >= 4.5);
});

test("light cards, semantic badges and disabled-control contrast rules stay intact", () => {
  assert.match(css, /\.monitor-loading\s*\{[\s\S]*?background:\s*#ffffff/);
  assert.match(css, /#adminStatisticsPanel \.individual-stats-table td\s*\{[\s\S]*?color:\s*#263b4c/);
  assert.match(css, /#guard[\s\S]*?\.badge-out\s*\{[^}]*background:\s*#fb923c;[^}]*color:\s*#2c1202/);
  assert.match(css, /#admin :where\(button, input, select, textarea\):disabled\s*\{[\s\S]*?opacity:\s*1/);
});
