const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");

function sourceBetween(startText, endText) {
  const start = appSource.indexOf(startText);
  const end = appSource.indexOf(endText, start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return appSource.slice(start, end);
}

function policyMessage(message) {
  const context = vm.createContext({});
  vm.runInContext(sourceBetween("function getSafeGuardPolicyMessageV220", "function setOperationalOutingTypesV220"), context);
  return context.getSafeGuardPolicyMessageV220(new Error(message));
}

test("Guard safely surfaces only approved date, time and day policy messages", () => {
  const dateMessage = "Tarikh keluar yang diluluskan ialah 14 Ogos 2026. Sahkan Keluar hanya boleh dibuat pada tarikh tersebut.";
  const timeMessage = "Pelajar hanya dibenarkan keluar mulai 5:00 petang.";
  const dayMessage = "Pulang Bermalam hanya dibenarkan keluar pada hari Jumaat.";
  assert.equal(policyMessage(dateMessage), dateMessage);
  assert.equal(policyMessage(timeMessage), timeMessage);
  assert.equal(policyMessage(dayMessage), dayMessage);
});

test("Guard keeps unrelated, network and internal errors generic", () => {
  for (const message of [
    "Failed to fetch",
    "Sistem live tidak stabil.",
    "Exception: Range not found at Code.gs:2201",
    "Exception: Pulang Bermalam hanya dibenarkan keluar pada hari Jumaat.",
    "TypeError: Cannot read properties of undefined"
  ]) {
    assert.equal(policyMessage(message), "");
  }
  const confirmOutSource = sourceBetween("async function confirmOut", "async function confirmIn");
  assert.match(confirmOutSource, /getSafeGuardPolicyMessageV220\(error\) \|\| "Gagal disimpan\. Sila tekan Cuba Lagi\."/);
  assert.doesNotMatch(confirmOutSource, /showError\(error\.message/);
});
