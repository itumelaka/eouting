const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(name) {
  const start = appSource.lastIndexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = appSource.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < appSource.length; index += 1) {
    if (appSource[index] === "{") depth += 1;
    if (appSource[index] === "}") depth -= 1;
    if (depth === 0) return appSource.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function visibilityContext() {
  const els = {
    studentRequestSection: { hidden: false },
    studentActiveRequestNotice: { hidden: true }
  };
  const context = vm.createContext({
    els,
    reverseDisplayStatus: (status) => ({
      Pending: "MENUNGGU_KELULUSAN",
      Approved: "DILULUSKAN_WARDEN",
      Out: "KELUAR",
      Done: "SELESAI",
      Rejected: "DITOLAK_WARDEN",
      Cancelled: "DIBATALKAN_PELAJAR"
    }[status] || status || "")
  });
  vm.runInContext(extractFunction("isActiveStudentRecord"), context);
  vm.runInContext(extractFunction("updateStudentRequestSectionVisibility"), context);
  return { context, els };
}

test("Student request heading and form share one hideable section with one compact replacement card", () => {
  const sectionStart = indexSource.indexOf('id="studentRequestSection"');
  const heading = indexSource.indexOf('<h2>Permohonan Pelajar</h2>');
  const form = indexSource.indexOf('id="requestForm"');
  const sectionEnd = indexSource.indexOf('</section>', form);
  const notice = indexSource.indexOf('id="studentActiveRequestNotice"');
  assert.ok(sectionStart >= 0 && sectionStart < heading && heading < form && form < sectionEnd);
  assert.ok(sectionEnd < notice);
  assert.equal((indexSource.match(/id="requestForm"/g) || []).length, 1);
  assert.match(indexSource, /Anda masih mempunyai permohonan aktif\. Permohonan baharu boleh dibuat selepas urusan semasa selesai\./);
  assert.match(indexSource, /id="studentActiveRequestNotice"[^>]*role="status"[^>]*aria-live="polite"[^>]*hidden/);
});

test("pending, approved and outside canonical records hide the form and reveal the notice", () => {
  for (const status of ["MENUNGGU_KELULUSAN", "DILULUSKAN_WARDEN", "KELUAR"]) {
    const { context, els } = visibilityContext();
    context.updateStudentRequestSectionVisibility({ rawStatus: status });
    assert.equal(els.studentRequestSection.hidden, true, status);
    assert.equal(els.studentActiveRequestNotice.hidden, false, status);
  }
});

test("display-status fallback still identifies canonical active requests", () => {
  for (const status of ["Pending", "Approved", "Out"]) {
    const { context, els } = visibilityContext();
    context.updateStudentRequestSectionVisibility({ status });
    assert.equal(els.studentRequestSection.hidden, true, status);
    assert.equal(els.studentActiveRequestNotice.hidden, false, status);
  }
});

test("completed, rejected and Student-cancelled records restore the request form", () => {
  for (const status of ["SELESAI", "DITOLAK_WARDEN", "DIBATALKAN_PELAJAR"]) {
    const { context, els } = visibilityContext();
    els.studentRequestSection.hidden = true;
    els.studentActiveRequestNotice.hidden = false;
    context.updateStudentRequestSectionVisibility({ rawStatus: status });
    assert.equal(els.studentRequestSection.hidden, false, status);
    assert.equal(els.studentActiveRequestNotice.hidden, true, status);
  }
});

test("no current record shows the new application form", () => {
  const { context, els } = visibilityContext();
  context.updateStudentRequestSectionVisibility(null);
  assert.equal(els.studentRequestSection.hidden, false);
  assert.equal(els.studentActiveRequestNotice.hidden, true);
});

test("Student rendering reuses the selected canonical current record for status and form visibility", () => {
  const source = extractFunction("renderStudent");
  assert.match(source, /const currentRecord = selectStudentCurrentRecord\(studentRecords\)/);
  assert.match(source, /renderStudentCurrentStatus\(currentRecord\)/);
  assert.match(source, /updateStudentRequestSectionVisibility\(currentRecord\)/);
  assert.ok(source.indexOf("renderStudentCurrentStatus(currentRecord)") < source.indexOf("updateStudentRequestSectionVisibility(currentRecord)"));
});

test("form visibility delegates active-state semantics to the existing canonical helper", () => {
  const source = extractFunction("updateStudentRequestSectionVisibility");
  assert.match(source, /isActiveStudentRecord\(currentRecord\)/);
  assert.doesNotMatch(source, /MENUNGGU_KELULUSAN|DILULUSKAN_WARDEN|KELUAR|SELESAI|DITOLAK_WARDEN|DIBATALKAN_PELAJAR/);
});

test("Status Semasa remains before both request-form states", () => {
  const currentStatus = indexSource.indexOf('id="studentCurrentStatus"');
  const requestSection = indexSource.indexOf('id="studentRequestSection"');
  const activeNotice = indexSource.indexOf('id="studentActiveRequestNotice"');
  assert.ok(currentStatus >= 0 && currentStatus < requestSection && requestSection < activeNotice);
});

test("the hidden form and notice states override their normal layout safely", () => {
  assert.match(cssSource, /\.student-request-section\[hidden\],[\s\S]*?\.student-active-request-notice\[hidden\][\s\S]*?display:\s*none\s*!important/);
  assert.match(cssSource, /\.student-active-request-notice\s*\{[\s\S]*?display:\s*grid[\s\S]*?padding:/);
});

test("the patch leaves submit handling and field configuration paths intact", () => {
  const submitHandler = appSource.slice(
    appSource.indexOf('els.requestForm.addEventListener("submit"'),
    appSource.indexOf('els.requestForm.addEventListener("input"')
  );
  assert.match(submitHandler, /submitRequest/);
  assert.match(appSource, /function updateRequestTypeFields\(/);
  assert.match(appSource, /function updateStudentSubmitState\(/);
  assert.doesNotMatch(extractFunction("updateStudentRequestSectionVisibility"), /submitRequest|updateRequestTypeFields|required|payload|apiPost/);
});
