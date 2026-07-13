const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "assets", "app.js"), "utf8");
const functionStart = appSource.indexOf("function renderStudentDropdownState");
const functionEnd = appSource.indexOf("\nfunction ensureStudentLoginClassSelection", functionStart);

assert.notEqual(functionStart, -1, "renderStudentDropdownState must exist");
assert.notEqual(functionEnd, -1, "renderStudentDropdownState boundary must exist");

const dropdownRenderer = appSource.slice(functionStart, functionEnd);

assert.match(
  dropdownRenderer,
  /<option value="\$\{escapeHtml\(student\.id\)\}">\$\{escapeHtml\(student\.name\)\}<\/option>/,
  "student.id must remain the internal option value and only the student name may be visible"
);
assert.doesNotMatch(
  dropdownRenderer,
  /no_matrik/,
  "student matric numbers must not be included in dropdown option markup"
);

console.log("PASS student login dropdown hides matric numbers and retains student.id");
