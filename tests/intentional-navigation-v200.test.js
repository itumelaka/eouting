const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findCallableDefinitions(name) {
  const escapedName = escapeRegExp(name);
  const patterns = [
    new RegExp(`(?:^|[\\r\\n])\\s*(?:async\\s+)?function\\s+${escapedName}\\s*\\(`, "g"),
    new RegExp(
      `(?:^|[\\r\\n])\\s*(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s+)?function(?:\\s+[A-Za-z_$][\\w$]*)?\\s*\\(`,
      "g"
    ),
    new RegExp(
      `(?:^|[\\r\\n])\\s*(?:const|let|var)\\s+${escapedName}\\s*=\\s*(?:async\\s*)?(?:\\([^\\r\\n]*\\)|[A-Za-z_$][\\w$]*)\\s*=>\\s*\\{`,
      "g"
    )
  ];
  const starts = patterns.flatMap((pattern) =>
    [...app.matchAll(pattern)].map((match) => match.index + (/^[\\r\\n]/.test(match[0]) ? 1 : 0))
  );
  return [...new Set(starts)].sort((left, right) => left - right);
}

function findBalancedClose(source, start, openCharacter, closeCharacter) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n" || character === "\r") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = "";
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === openCharacter) depth += 1;
    if (character === closeCharacter) depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function extractFunction(name) {
  const definitions = findCallableDefinitions(name);
  assert.ok(definitions.length > 0, `${name} must exist`);
  const start = definitions[definitions.length - 1];
  const declarationLineEnd = app.search.call(app.slice(start), /[\r\n]/);
  const arrow = app.indexOf("=>", start);
  const parameterStart = app.indexOf("(", start);
  const isArrow = arrow >= 0 && (declarationLineEnd < 0 || arrow < start + declarationLineEnd);
  let bodyStart;

  if (isArrow) {
    bodyStart = app.indexOf("{", arrow + 2);
  } else {
    assert.notEqual(parameterStart, -1, `${name} parameter list must exist`);
    const parameterEnd = findBalancedClose(app, parameterStart, "(", ")");
    assert.notEqual(parameterEnd, -1, `${name} parameter list must close`);
    bodyStart = app.indexOf("{", parameterEnd + 1);
  }

  assert.notEqual(bodyStart, -1, `${name} body must exist`);
  const bodyEnd = findBalancedClose(app, bodyStart, "{", "}");
  assert.notEqual(bodyEnd, -1, `${name} closing brace not found`);
  return app.slice(start, bodyEnd + 1).trimStart();
}

function countFunctionDefinitions(name) {
  return findCallableDefinitions(name).length;
}

function extractEventListenerCalls(source) {
  const calls = [];
  const marker = ".addEventListener";
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor);
    if (start < 0) break;
    const parameterStart = source.indexOf("(", start + marker.length);
    const parameterEnd = findBalancedClose(source, parameterStart, "(", ")");
    assert.notEqual(parameterEnd, -1, "addEventListener call must close");
    calls.push(source.slice(start, parameterEnd + 1));
    cursor = parameterEnd + 1;
  }
  return calls;
}

test("first monitoring activation precedes intentional scroll and loader", () => {
  for (const name of [
    "openMonitoringPage",
    "openStatisticsPage",
    "setupMonitoringPanel",
    "setupStatisticsPanel",
    "setupClayRoleNav",
    "isIntentionalNavigationV200",
    "scheduleIntentionalScrollV200"
  ]) {
    assert.equal(countFunctionDefinitions(name), 1, `${name} must have exactly one definition`);
  }
  assert.doesNotMatch(app, /\bconst\s+intentionalNavigation\b/);
  const source = extractFunction("openMonitoringPage");
  assert.match(source, /^(?:async )?function openMonitoringPage\(eventOrOptions\)/);
  const activate = source.indexOf('monitorWorkspace.classList.add("active")');
  const scroll = source.indexOf("scheduleIntentionalScrollV200(els.monitorWorkspace)");
  const refresh = source.indexOf('refreshMonitoringRecords("open")');
  assert.ok(activate >= 0);
  assert.ok(scroll > activate, "monitor must be visible before scroll is scheduled");
  assert.ok(refresh > activate, "loader must start only after monitor activation");
  assert.match(source, /isIntentionalNavigationV200\(eventOrOptions\)/);
  assert.match(source, /const intentional = isIntentionalNavigationV200\(eventOrOptions\)/);
  assert.match(source, /await refreshMonitoringRecords\("open"\)/);
  assert.doesNotMatch(source, /\bintentionalNavigation\b/);
});

test("intentional scrolling waits for layout and respects reduced motion", () => {
  const intentionalSource = extractFunction("isIntentionalNavigationV200");
  const reducedSource = extractFunction("prefersReducedMotionV200");
  const scrollSource = extractFunction("scheduleIntentionalScrollV200");
  assert.match(reducedSource, /prefers-reduced-motion: reduce/);
  assert.match(scrollSource, /requestAnimationFrame\(scroll\)/);
  assert.match(scrollSource, /scrollIntoView\(\{/);
  assert.match(scrollSource, /behavior: prefersReducedMotionV200\(\) \? "auto" : "smooth"/);
  assert.match(scrollSource, /block: "start"/);
  assert.doesNotMatch(scrollSource, /\.focus\(/);

  const calls = [];
  const context = vm.createContext({
    window: {
      matchMedia: () => ({ matches: true }),
      requestAnimationFrame: (callback) => callback()
    }
  });
  vm.runInContext(`${intentionalSource}\n${reducedSource}\n${scrollSource}`, context);
  assert.equal(context.isIntentionalNavigationV200(), false);
  assert.equal(context.isIntentionalNavigationV200({}), false);
  assert.equal(context.isIntentionalNavigationV200({ type: "restore" }), false);
  assert.equal(context.isIntentionalNavigationV200({ type: "click" }), true);
  assert.equal(context.isIntentionalNavigationV200({ intentional: true }), true);
  context.scheduleIntentionalScrollV200({ scrollIntoView: (options) => calls.push(options) });
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ behavior: "auto", block: "start" }]);
});

test("all five landing navigation targets and their existing hooks remain present", () => {
  for (const role of ["student", "warden", "guard"]) {
    assert.match(html, new RegExp(`data-role-choice="${role}"`));
  }
  assert.match(app, /Pemantauan Semasa/);
  assert.match(app, /Statistik/);
  assert.match(css, /data-role-choice="monitor"/);
  assert.match(css, /data-role-choice="stats"/);
  assert.match(app, /getAccessPanelForRoleV200\(roleChoice\)/);

  const panels = { studentLoginPanel: {}, wardenLoginPanel: {}, guardLoginPanel: {} };
  const context = vm.createContext({ els: panels });
  vm.runInContext(extractFunction("getAccessPanelForRoleV200"), context);
  assert.equal(context.getAccessPanelForRoleV200("student"), panels.studentLoginPanel);
  assert.equal(context.getAccessPanelForRoleV200("warden"), panels.wardenLoginPanel);
  assert.equal(context.getAccessPanelForRoleV200("guard"), panels.guardLoginPanel);
});

test("navigation uses existing click paths without duplicate monitoring listeners", () => {
  const landingSetup = extractFunction("setupClayRoleNav");
  const clickListeners = extractEventListenerCalls(landingSetup).filter((call) =>
    /\.addEventListener\s*\(\s*["']click["']/.test(call)
  );
  const monitoringListeners = clickListeners.filter((call) => /\bopenMonitoringPage\b/.test(call));
  const statisticsListeners = clickListeners.filter((call) => /\bopenStatisticsPage\b/.test(call));
  assert.equal(monitoringListeners.length, 1);
  assert.equal(statisticsListeners.length, 1);
  assert.doesNotMatch(monitoringListeners[0], /openMonitoringPage\s*\(\s*\)/);
  assert.doesNotMatch(statisticsListeners[0], /openStatisticsPage\s*\(\s*\)/);
});

test("compact mobile Clay navigation preserves touch targets and avoids overflow", () => {
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.role-card\.clay-role-button\s*\{[\s\S]*?min-height:\s*68px/);
  assert.match(css, /\.clay-role-nav\s*\{[\s\S]*?gap:\s*8px/);
  assert.match(css, /\.access-panel,[\s\S]*?\.monitor-workspace,[\s\S]*?\.stats-workspace\s*\{[\s\S]*?scroll-margin-top:/);
  assert.doesNotMatch(css, /\.role-card\.clay-role-button[^}]*min-width:\s*[5-9]\d{2}px/s);
});

test("statistics scroll is intentional and scheduled only after activation", () => {
  const source = extractFunction("openStatisticsPage");
  assert.match(
    source,
    /^(?:(?:async\s+)?function\s+openStatisticsPage\s*\(eventOrOptions\)|(?:const|let|var)\s+openStatisticsPage\s*=)/
  );
  const setupSource = extractFunction("setupClayRoleNav");
  const activate = source.indexOf('statsWorkspace.classList.add("active")');
  const scroll = source.indexOf("scheduleIntentionalScrollV200(els.statsWorkspace)");
  assert.ok(activate >= 0);
  assert.ok(scroll > activate);
  assert.match(source, /isIntentionalNavigationV200\(eventOrOptions\)/);
  assert.match(source, /const intentional = isIntentionalNavigationV200\(eventOrOptions\)/);
  assert.doesNotMatch(source, /\bintentionalNavigation\b/);
  assert.match(setupSource, /openStatisticsPage/);
});
