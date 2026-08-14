const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const parameterStart = appSource.indexOf("(", start);
  let parameterDepth = 0;
  let bodyStart = -1;
  for (let index = parameterStart; index < appSource.length; index += 1) {
    if (appSource[index] === "(") parameterDepth += 1;
    if (appSource[index] === ")") parameterDepth -= 1;
    if (parameterDepth === 0 && appSource[index] === ")") {
      bodyStart = appSource.indexOf("{", index + 1);
      break;
    }
  }
  assert.notEqual(bodyStart, -1, `Missing body for ${name}`);

  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

const formatAdminTimeOnlyV200 = Function(
  `${extractFunction("getMalayDaypartLabel")}\n${extractFunction("normalizeTimeOnlyValue")}\n${extractFunction("formatAdminTimeOnlyV200")}\nreturn formatAdminTimeOnlyV200;`
)();

test("formats synthetic Google Sheets ISO timestamps without showing the date", () => {
  assert.equal(formatAdminTimeOnlyV200("1899-12-30T10:04:35.000Z"), "5:00 Petang");
  assert.equal(formatAdminTimeOnlyV200("1899-12-30T15:04:35.000Z"), "10:00 Malam");
});

test("formats HH:mm and HH:mm:ss strings consistently", () => {
  assert.equal(formatAdminTimeOnlyV200("10:04"), "10:04 Pagi");
  assert.equal(formatAdminTimeOnlyV200("22:15:59"), "10:15 Malam");
});

test("preserves empty values as Tiada masa tetap", () => {
  assert.equal(formatAdminTimeOnlyV200(""), "Tiada masa tetap");
  assert.equal(formatAdminTimeOnlyV200(null), "Tiada masa tetap");
});

test("returns a safe label for invalid values", () => {
  assert.equal(formatAdminTimeOnlyV200("not-a-time"), "Masa tidak sah");
  assert.equal(formatAdminTimeOnlyV200("25:99"), "Masa tidak sah");
});

test("Date objects preserve their encoded clock time without local timezone conversion", () => {
  assert.equal(
    formatAdminTimeOnlyV200(new Date("1899-12-30T15:04:35.000Z")),
    "10:00 Malam"
  );
});

test("Admin cards use the formatter for open and fixed return time", () => {
  assert.match(appSource, /Buka \$\{formatAdminTimeOnlyV200\(type\.application_open_time\)\}/);
  assert.match(appSource, /Tutup \$\{formatAdminTimeOnlyV200\(type\.application_close_time\)\}/);
  assert.match(appSource, /Pulang \$\{formatAdminTimeOnlyV200\(type\.fixed_return_time\)\}/);
});
