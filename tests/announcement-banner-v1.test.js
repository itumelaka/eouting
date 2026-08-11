const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gasSource = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const cssSource = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

const HEADERS = {
  ADMIN_USERS: ["admin_id", "nama_admin", "pin", "status", "catatan", "created_at", "updated_at"],
  STUDENTS: ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status"],
  WARDENS: ["warden_id", "nama_warden", "email", "no_tel", "pin", "status", "catatan"],
  GUARDS: ["guard_id", "nama_guard", "email", "no_tel", "pin", "status", "catatan"],
  AUDIT_LOG: ["timestamp", "action", "request_id", "user_role", "user_name", "details", "entity_type", "entity_id"]
};

class FakeSheet {
  constructor(rows) { this.rows = rows.map((row) => row.slice()); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getRange(row, column, rowCount, columnCount) {
    return {
      getValues: () => Array.from({ length: rowCount }, (_, rowOffset) => (
        Array.from({ length: columnCount }, (_, columnOffset) => (
          (this.rows[row - 1 + rowOffset] || [])[column - 1 + columnOffset] ?? ""
        ))
      )),
      setValues: (values) => values.forEach((sourceRow, rowOffset) => {
        const target = row - 1 + rowOffset;
        while (this.rows.length <= target) this.rows.push([]);
        sourceRow.forEach((value, columnOffset) => { this.rows[target][column - 1 + columnOffset] = value; });
      }),
      setValue: (value) => {
        while (this.rows.length < row) this.rows.push([]);
        this.rows[row - 1][column - 1] = value;
      }
    };
  }
  getDataRange() { return this.getRange(1, 1, this.getLastRow(), this.getLastColumn()); }
  appendRow(row) { this.rows.push(row.slice()); }
}

function createContext() {
  const properties = {};
  const sheets = new Map([
    ["ADMIN_USERS", new FakeSheet([HEADERS.ADMIN_USERS, ["ADM-1", "ADMIN TEST", "2468", "AKTIF", "", "", ""]])],
    ["STUDENTS", new FakeSheet([HEADERS.STUDENTS, ["S-1", "M-1", "PELAJAR TEST", "", "", "A2", "", "AKTIF"]])],
    ["WARDENS", new FakeSheet([HEADERS.WARDENS, ["W-1", "WARDEN TEST", "", "", "1357", "AKTIF", ""]])],
    ["GUARDS", new FakeSheet([HEADERS.GUARDS, ["G-1", "GUARD TEST", "", "", "9753", "AKTIF", ""]])],
    ["AUDIT_LOG", new FakeSheet([HEADERS.AUDIT_LOG])]
  ]);
  const spreadsheet = { getSheetByName: (name) => sheets.get(name) || null };
  const context = vm.createContext({
    console,
    SpreadsheetApp: { openById: () => spreadsheet },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => properties[key] ?? null,
        setProperty: (key, value) => { properties[key] = String(value); },
        setProperties: (values) => Object.entries(values).forEach(([key, value]) => { properties[key] = String(value); })
      })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate: () => "2026-08-11 11:35:00" }
  });
  vm.runInContext(gasSource, context);
  return { context, properties, sheets };
}

const admin = (extra = {}) => ({ admin_id: "ADM-1", pin: "2468", ...extra });
const update = (extra = {}) => admin({ text: "Makluman operasi", active: true, important: false, ...extra });

test("Admin reads defaults and updates trimmed text, active and important state", () => {
  const { context, properties } = createContext();
  const initial = context.getAnnouncementBannerAdmin(admin());
  assert.equal(initial.active, false);
  assert.equal(initial.text, "");

  const saved = context.updateAnnouncementBanner(update({ text: "  Makluman operasi  ", important: true }));
  assert.equal(saved.text, "Makluman operasi");
  assert.equal(saved.active, true);
  assert.equal(saved.important, true);
  assert.equal(saved.updated_at, "2026-08-11 11:35:00");
  assert.equal(saved.updated_by, "ADM-1");
  assert.equal(properties.ANNOUNCEMENT_BANNER_ACTIVE, "true");

  const disabled = context.updateAnnouncementBanner(update({ active: false, important: false }));
  assert.equal(disabled.active, false);
  assert.equal(disabled.important, false);
});

test("Admin mutation validates auth, booleans, active text and length", () => {
  const { context } = createContext();
  assert.throws(() => context.updateAnnouncementBanner(update({ pin: "0000" })), /Admin|PIN/i);
  assert.throws(() => context.updateAnnouncementBanner(update({ active: "true" })), /boolean/i);
  assert.throws(() => context.updateAnnouncementBanner(update({ important: "false" })), /boolean/i);
  assert.throws(() => context.updateAnnouncementBanner(update({ text: "   " })), /Teks pengumuman/i);
  assert.throws(() => context.updateAnnouncementBanner(update({ text: "x".repeat(501) })), /500/);
});

test("Admin update writes a bounded, secret-free audit entry", () => {
  const { context, sheets } = createContext();
  context.updateAnnouncementBanner(update({ text: "x".repeat(200), important: true }));
  const [headers, row] = sheets.get("AUDIT_LOG").rows;
  const audit = Object.fromEntries(headers.map((header, index) => [header, row[index]]));
  assert.equal(audit.action, "UPDATE_ANNOUNCEMENT_BANNER");
  assert.equal(audit.user_name, "ADM-1");
  assert.equal(audit.entity_type, "SYSTEM_CONFIG");
  assert.equal(audit.entity_id, "ANNOUNCEMENT_BANNER");
  assert.match(audit.details, /"active":true/);
  assert.match(audit.details, /"important":true/);
  assert.doesNotMatch(audit.details, /2468/);
  assert.ok(JSON.parse(audit.details).text_summary.length <= 120);
});

test("Student, Warden, Guard and Admin receive the same safe active projection", () => {
  const { context } = createContext();
  context.updateAnnouncementBanner(update({ important: true }));
  const viewers = [
    { role: "student", student_id: "S-1", no_matrik: "M-1" },
    { role: "warden", nama_warden: "WARDEN TEST", pin: "1357" },
    { role: "guard", nama_guard: "GUARD TEST", pin: "9753" },
    { role: "admin", admin_id: "ADM-1", pin: "2468" }
  ];
  viewers.forEach((viewer) => {
    const result = context.getAnnouncementBanner(viewer);
    assert.deepEqual(Object.keys(result), ["active", "important", "text", "updated_at"]);
    assert.equal(result.active, true);
    assert.equal(result.important, true);
    assert.equal(result.text, "Makluman operasi");
    assert.equal(Object.prototype.hasOwnProperty.call(result, "updated_by"), false);
    assert.doesNotMatch(JSON.stringify(result), /ANNOUNCEMENT_BANNER_|2468|1357|9753/);
  });
});

test("Inactive banner is hidden and unauthenticated viewers are rejected", () => {
  const { context } = createContext();
  context.updateAnnouncementBanner(update({ active: false }));
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.getAnnouncementBanner({ role: "student", student_id: "S-1", no_matrik: "M-1" }))),
    { active: false }
  );
  assert.throws(() => context.getAnnouncementBanner({}), /Akses sesi/i);
  assert.throws(() => context.getAnnouncementBanner({ role: "student" }), /Akses sesi/i);
});

test("Announcement actions are POST-only and public monitoring projection has no banner", () => {
  const getRouter = gasSource.slice(gasSource.indexOf("function doGet"), gasSource.indexOf("function doPost"));
  const postRouter = gasSource.slice(gasSource.indexOf("function doPost"), gasSource.indexOf("function setupDatabase"));
  ["getAnnouncementBannerAdmin", "updateAnnouncementBanner", "getAnnouncementBanner"].forEach((action) => {
    assert.doesNotMatch(getRouter, new RegExp(action));
    assert.match(postRouter, new RegExp(action));
  });
  const publicRecords = gasSource.slice(gasSource.indexOf("function getTodayRecords()"), gasSource.indexOf("function getAnnouncementBannerAdmin"));
  assert.doesNotMatch(publicRecords, /announcement|banner/i);
  const publicMarkup = htmlSource.slice(htmlSource.indexOf('id="publicMonitoringPanel"'), htmlSource.indexOf('id="appWorkspace"'));
  assert.doesNotMatch(publicMarkup, /announcementBanner|Notis Banner/);
});

test("Student hierarchy keeps the banner, rule notice and form without duplicate static guidance", () => {
  const bannerIndex = htmlSource.indexOf('id="announcementBanner"');
  const ruleNoticeIndex = htmlSource.indexOf('id="ruleNotice"');
  const headingIndex = htmlSource.indexOf("<h2>Permohonan Pelajar</h2>");
  const formIndex = htmlSource.indexOf('id="requestForm"');

  assert.ok(bannerIndex >= 0);
  assert.ok(ruleNoticeIndex > bannerIndex);
  assert.ok(headingIndex > ruleNoticeIndex);
  assert.ok(formIndex > headingIndex);
  assert.doesNotMatch(htmlSource, /Permohonan outing hanya dibuka pada Selasa dan Rabu bermula 5:00 PM\./);
});

test("Admin UI edits one banner and wires read/save through the authenticated section", () => {
  assert.match(htmlSource, /id="adminAnnouncementTab"[^>]*data-admin-section="announcement"/);
  assert.match(htmlSource, /id="adminAnnouncementPanel"[^>]*hidden/);
  assert.match(htmlSource, /id="adminAnnouncementText"[^>]*maxlength="500"/);
  assert.match(htmlSource, /id="adminAnnouncementImportant"[^>]*type="checkbox"/);
  assert.match(htmlSource, /id="adminAnnouncementActive"[^>]*type="checkbox"/);
  assert.match(htmlSource, /Banner ini hanya untuk makluman[\s\S]*Tetapan Outing/);
  assert.match(appSource, /apiPost\("getAnnouncementBannerAdmin", buildAdminCredentialPayloadV200\(\)\)/);
  assert.match(appSource, /apiPost\("updateAnnouncementBanner", Object\.assign/);
  assert.match(appSource, /adminAnnouncementForm\.addEventListener\("submit", saveAdminAnnouncementV1\)/);
});

test("Admin-entered HTML renders as plain text with normal/important labels and updated time", () => {
  const classes = new Set();
  let clearCount = 0;
  const els = {
    announcementBanner: { hidden: true, classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } },
    announcementBannerLabel: { textContent: "" },
    announcementBannerText: { textContent: "" },
    announcementBannerRepeat: { textContent: "" },
    announcementBannerUpdated: { textContent: "" }
  };
  const source = appSource.slice(appSource.indexOf("function renderAnnouncementBannerV1"), appSource.indexOf("function clearAnnouncementBannerV1"));
  const context = vm.createContext({ els, Boolean, String, formatDisplayTime: () => "11:35", updateAnnouncementTickerV1: () => {}, clearAnnouncementBannerV1: () => { clearCount += 1; } });
  vm.runInContext(`${source}; this.renderAnnouncementBannerV1 = renderAnnouncementBannerV1;`, context);

  context.renderAnnouncementBannerV1({ active: true, important: false, text: '<script>alert("x")</script>', updated_at: "x" });
  assert.equal(els.announcementBannerLabel.textContent, "📢 MAKLUMAN");
  assert.equal(els.announcementBannerText.textContent, '<script>alert("x")</script>');
  assert.equal(els.announcementBannerRepeat.textContent, '<script>alert("x")</script>');
  assert.equal(els.announcementBannerUpdated.textContent, "Dikemaskini 11:35");
  assert.equal(classes.has("is-important"), false);

  context.renderAnnouncementBannerV1({ active: true, important: true, text: "Penting", updated_at: "x" });
  assert.equal(els.announcementBannerLabel.textContent, "⚠️ PENTING");
  assert.equal(classes.has("is-important"), true);
  context.renderAnnouncementBannerV1({ active: false, text: "" });
  assert.equal(clearCount, 1);
  assert.doesNotMatch(source, /innerHTML/);
});

test("Every active banner gets the ticker class even when its text fits", () => {
  const classes = new Set();
  const variables = {};
  const els = {
    announcementBanner: { hidden: false },
    announcementBannerViewport: { classList: { add: (name) => classes.add(name) } },
    announcementBannerTrack: { style: { setProperty: (key, value) => { variables[key] = value; } } },
    announcementBannerText: { scrollWidth: 40 }
  };
  const source = appSource.slice(appSource.indexOf("function updateAnnouncementTickerV1"), appSource.indexOf("async function loadAdminAnnouncementV1"));
  const context = vm.createContext({ els, Math, window: { requestAnimationFrame: (callback) => callback() } });
  vm.runInContext(`${source}; this.updateAnnouncementTickerV1 = updateAnnouncementTickerV1;`, context);
  context.updateAnnouncementTickerV1();
  assert.equal(classes.has("is-ticking"), true);
  assert.equal(variables["--announcement-scroll-duration"], "20s");

  els.announcementBannerText.scrollWidth = 552;
  context.updateAnnouncementTickerV1();
  assert.equal(variables["--announcement-scroll-duration"], "25s");
  assert.doesNotMatch(source, /clientWidth|is-overflowing|prefersReducedMotion/);
});

test("CSS provides a seamless ticker, hover/focus pause and static reduced motion", () => {
  assert.match(htmlSource, /id="announcementBannerTrack"[\s\S]*id="announcementBannerRepeat"[^>]*aria-hidden="true"/);
  assert.doesNotMatch(htmlSource, /<marquee/i);
  assert.match(cssSource, /@keyframes announcementBannerScroll/);
  assert.match(cssSource, /\.announcement-banner-viewport\.is-ticking[\s\S]*linear infinite/);
  assert.match(cssSource, /translateX\(calc\(-50% - 1\.5rem\)\)/);
  assert.doesNotMatch(cssSource, /announcementBannerScroll[^;]*alternate/);
  assert.match(cssSource, /\.announcement-banner:hover[\s\S]*animation-play-state:\s*paused/);
  assert.match(cssSource, /\.announcement-banner:focus[\s\S]*animation-play-state:\s*paused/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.announcement-banner-track[\s\S]*animation:\s*none/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.announcement-banner-repeat[\s\S]*display:\s*none/);
  assert.match(cssSource, /touch-action:\s*manipulation/);
});

test("Banner code remains informational and does not alter outing business rules", () => {
  assert.match(gasSource, /const OUTING_CONFIG_V2_PROPERTY = "OUTING_CONFIG_V2_ENABLED"/);
  const backendBanner = gasSource.slice(gasSource.indexOf("function getAnnouncementBannerAdmin"), gasSource.indexOf("function getOperationalTodayRecords"));
  assert.doesNotMatch(backendBanner, /OUTING_CONFIG_V2_ENABLED|OUTING_TYPES|earliest_departure_time|submitRequest|approveRequest|confirmOut|confirmIn/);
  const frontendBanner = appSource.slice(appSource.indexOf("function buildAnnouncementViewerPayloadV1"), appSource.indexOf("function setAdminSectionV200"));
  assert.doesNotMatch(frontendBanner, /requestForm|submitRequest|approveRequest|confirmOut|confirmIn|profilePhoto|selfie/i);
  for (const name of ["submitRequest", "approveRequest", "confirmOut", "confirmIn"]) {
    assert.match(gasSource, new RegExp(`function ${name}\\(`));
  }
});
