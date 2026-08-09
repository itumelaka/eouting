const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const styleSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

function createMonitoringContext(withPhoto) {
  const context = vm.createContext({
    Map,
    Number,
    REQUEST_TYPE_LABEL: { OUTING_BIASA: "Outing Biasa" },
    adminMonitoringFilterV210: "all",
    adminMonitoringV210: {
      kpis: { pending: 1, approved: 0, out: 0, not_returned: 0, late: 0, emergency: 0 },
      records: [{
        student_id: "A2-002", no_matrik: "M002", nama: "Ali Ahmad", kelas: "A2",
        jenis_permohonan: "OUTING_BIASA", status: "MENUNGGU_KELULUSAN", lewat: false
      }]
    },
    els: { adminMonitoringKpis: { innerHTML: "" }, adminMonitoringList: { innerHTML: "" } },
    animateRollingNumbers: () => {},
    escapeHtml: (value) => String(value),
    formatAdminMonitoringRequestV210: () => "09 Ogos 2026",
    formatDisplayDateTime: () => "-",
    formatAdminExpectedReturnV210: () => "-"
  });
  vm.runInContext("const REQUEST_TYPE_LABEL = globalThis.REQUEST_TYPE_LABEL; let adminMonitoringFilterV210 = globalThis.adminMonitoringFilterV210; let adminMonitoringV210 = globalThis.adminMonitoringV210; const els = globalThis.els;", context);
  vm.runInContext("let profilePhotoThumbnails = new Map(); let profilePhotoFullImages = new Map();", context);
  vm.runInContext([
    extractFunction(appSource, "profilePhotoCacheKey"),
    extractFunction(appSource, "profilePhotoInitials"),
    extractFunction(appSource, "safeProfilePhotoDataUri"),
    extractFunction(appSource, "profilePhotoMarkup"),
    extractFunction(appSource, "adminMonitoringStatusLabelV210"),
    extractFunction(appSource, "renderAdminMonitoringV210")
  ].join("\n"), context);
  if (withPhoto) {
    vm.runInContext('profilePhotoThumbnails.set("a2-002", { photo_data_uri: "data:image/png;base64,AAAA" });', context);
  }
  return context;
}

test("Admin monitoring renders a secure clickable cached photo and an inert placeholder when absent", () => {
  const withPhoto = createMonitoringContext(true);
  withPhoto.renderAdminMonitoringV210();
  assert.match(withPhoto.els.adminMonitoringList.innerHTML, /admin-monitoring-thumbnail/);
  assert.match(withPhoto.els.adminMonitoringList.innerHTML, /<button[^>]*data-profile-photo-preview="A2-002"/);

  const withoutPhoto = createMonitoringContext(false);
  withoutPhoto.renderAdminMonitoringV210();
  assert.match(withoutPhoto.els.adminMonitoringList.innerHTML, /profile-photo-placeholder/);
  assert.doesNotMatch(withoutPhoto.els.adminMonitoringList.innerHTML, /data-profile-photo-preview/);
  assert.match(styleSource, /\.admin-monitoring-thumbnail\s*\{[^}]*flex-basis:56px[^}]*width:56px/s);
});

test("Admin monitoring refresh renders records before one de-duplicated authenticated photo batch", () => {
  const loadMonitoring = extractFunction(appSource, "loadAdminMonitoringV210");
  assert.ok(loadMonitoring.indexOf("renderAdminMonitoringV210()") < loadMonitoring.indexOf("loadProfilePhotoThumbnailsForStudents("));
  assert.match(loadMonitoring, /\.map\(\(record\) => record\.student_id\)/);

  const calls = [];
  const context = vm.createContext({
    Map, Set, console,
    currentSession: { role: "admin" },
    isLiveMode: true,
    profilePhotoThumbnails: new Map(),
    profilePhotoThumbnailLoadedKeys: new Set(),
    profilePhotoThumbnailPendingKeys: new Set(),
    profilePhotoCacheVersions: new Map(),
    profilePhotoSessionGeneration: 0,
    profilePhotoBatchWarningAt: 0,
    profilePhotoBatchWarningType: "",
    apiPost: async (action, payload) => { calls.push([action, payload.student_ids, payload.photo_variant]); return { photos: [] }; },
    buildProfilePhotoAccessPayload: (ids) => ({ student_ids: ids }),
    renderProfilePhotoConsumers: () => {},
    warnProfilePhotoBatchFailure: () => {}
  });
  vm.runInContext("let profilePhotoThumbnails = globalThis.profilePhotoThumbnails; let profilePhotoThumbnailLoadedKeys = globalThis.profilePhotoThumbnailLoadedKeys; let profilePhotoThumbnailPendingKeys = globalThis.profilePhotoThumbnailPendingKeys; let profilePhotoCacheVersions = globalThis.profilePhotoCacheVersions; let profilePhotoSessionGeneration = globalThis.profilePhotoSessionGeneration; let currentSession = globalThis.currentSession; let isLiveMode = globalThis.isLiveMode;", context);
  vm.runInContext(extractFunction(appSource, "profilePhotoCacheKey"), context);
  vm.runInContext(extractFunction(appSource, "safeProfilePhotoDataUri"), context);
  vm.runInContext(`async ${extractFunction(appSource, "loadProfilePhotoThumbnailsForStudents")}`, context);

  return context.loadProfilePhotoThumbnailsForStudents(["A2-002", "A2-002", "A2-007"])
    .then(() => context.loadProfilePhotoThumbnailsForStudents(["A2-002", "A2-007"]))
    .then(() => {
      assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["getStudentProfilePhotos", ["A2-002", "A2-007"], "thumbnail"]]);
      assert.equal(context.profilePhotoThumbnailLoadedKeys.size, 2);
    });
});

test("public monitoring remains photo-free and normal record-row numbers are not rolling counters", () => {
  const publicMonitoring = [
    extractFunction(appSource, "renderMonitoringPageV1612"),
    extractFunction(appSource, "renderMonitorNameListV1613")
  ].join("\n");
  assert.doesNotMatch(publicMonitoring, /profilePhotoMarkup|data-profile-photo-preview|admin-monitoring-thumbnail/);
  assert.doesNotMatch(extractFunction(appSource, "renderAdminIndividualStatsV200"), /data-rolling-number/);
  assert.doesNotMatch(extractFunction(appSource, "renderMonitorNameListV1613"), /data-rolling-number/);
});

function createRollingContext(reducedMotion) {
  const queue = [];
  const cancelled = [];
  const context = vm.createContext({
    Map, Math, Number, String,
    rollingNumberValues: new Map(),
    rollingNumberFrames: new Map(),
    window: {
      matchMedia: () => ({ matches: reducedMotion }),
      requestAnimationFrame: (callback) => { queue.push(callback); return queue.length; },
      cancelAnimationFrame: (id) => cancelled.push(id)
    }
  });
  vm.runInContext("const rollingNumberValues = globalThis.rollingNumberValues; const rollingNumberFrames = globalThis.rollingNumberFrames;", context);
  vm.runInContext(extractFunction(appSource, "prefersReducedMotionV200"), context);
  vm.runInContext(extractFunction(appSource, "setRollingNumber"), context);
  return { context, queue, cancelled };
}

function fakeNumberElement(initial = "0") {
  return {
    textContent: initial,
    style: {},
    attributes: {},
    classList: { add() {} },
    setAttribute(name, value) { this.attributes[name] = value; }
  };
}

function flushAnimation(queue, timestamps) {
  timestamps.forEach((timestamp) => {
    const callback = queue.shift();
    assert.equal(typeof callback, "function");
    callback(timestamp);
  });
}

test("rolling KPI reaches the exact integer target and updates previous-to-new without replaying unchanged values", () => {
  const { context, queue } = createRollingContext(false);
  const element = fakeNumberElement("99");
  assert.equal(context.setRollingNumber(element, 5, "kpi"), true);
  assert.equal(element.textContent, "0");
  flushAnimation(queue, [0, 225, 450]);
  assert.equal(element.textContent, "5");

  assert.equal(context.setRollingNumber(element, 8, "kpi"), true);
  assert.equal(element.textContent, "5");
  flushAnimation(queue, [500, 725, 950]);
  assert.equal(element.textContent, "8");
  assert.equal(context.setRollingNumber(element, 8, "kpi"), false);
  assert.equal(queue.length, 0);
  assert.equal(element.textContent, "8");
  assert.equal(element.attributes["aria-label"], "8");
});

test("reduced motion bypasses rolling animation and displays the exact target immediately", () => {
  const { context, queue } = createRollingContext(true);
  const element = fakeNumberElement();
  assert.equal(context.setRollingNumber(element, 17, "reduced"), false);
  assert.equal(element.textContent, "17");
  assert.equal(queue.length, 0);
});
