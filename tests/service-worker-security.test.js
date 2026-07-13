const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const workerSource = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const indexSource = fs.readFileSync(path.join(root, "index.html"), "utf8");
const versionInfo = JSON.parse(fs.readFileSync(path.join(root, "version.json"), "utf8"));
const EXPECTED_VERSION = "1.6.21";
const EXPECTED_RELEASE_DATE = "2026-07-13";
const EXPECTED_RELEASE_NOTE = "Perkukuh privasi Pemantauan Semasa dan buang statistik individu.";

function createWorker(cacheNames = []) {
  const listeners = {};
  const calls = {
    add: [],
    claim: 0,
    delete: [],
    fetch: [],
    match: [],
    open: [],
    put: [],
    skipWaiting: 0
  };
  const cache = {
    add: async (asset) => calls.add.push(asset),
    match: async (request) => {
      calls.match.push(request);
      return null;
    },
    put: async (request) => calls.put.push(request)
  };
  const response = { ok: true, clone: () => response };
  const context = vm.createContext({
    URL,
    Response,
    caches: {
      delete: async (name) => calls.delete.push(name),
      keys: async () => [...cacheNames],
      open: async (name) => {
        calls.open.push(name);
        return cache;
      }
    },
    fetch: async (request) => {
      calls.fetch.push(request);
      return response;
    },
    self: {
      addEventListener: (type, handler) => {
        listeners[type] = handler;
      },
      clients: {
        claim: async () => {
          calls.claim += 1;
        }
      },
      location: { origin: "https://eouting.example.test" },
      skipWaiting: async () => {
        calls.skipWaiting += 1;
      }
    }
  });

  vm.runInContext(workerSource, context);
  return { calls, listeners };
}

async function dispatchFetch(worker, request) {
  let responsePromise = null;
  worker.listeners.fetch({
    request,
    respondWith: (promise) => {
      responsePromise = Promise.resolve(promise);
    }
  });
  if (responsePromise) {
    await responsePromise;
  }
  return responsePromise;
}

test("GAS and action GET requests are network-only and never touch Cache Storage", async () => {
  const apiUrls = [
    "https://script.google.com/macros/s/deployment/exec?action=getStudents&_ts=1",
    "https://script.googleusercontent.com/macros/echo?user_content_key=abc",
    "https://eouting.example.test/api?action=getTodayRecords"
  ];

  for (const url of apiUrls) {
    const worker = createWorker();
    await dispatchFetch(worker, { method: "GET", mode: "cors", url });
    assert.equal(worker.calls.fetch.length, 1, `${url} must use the network`);
    assert.deepEqual(worker.calls.open, [], `${url} must not open Cache Storage`);
    assert.deepEqual(worker.calls.match, [], `${url} must not read Cache Storage`);
    assert.deepEqual(worker.calls.put, [], `${url} must not write Cache Storage`);
  }
});

test("non-GET API requests remain outside service worker caching", async () => {
  const worker = createWorker();
  const handled = await dispatchFetch(worker, {
    method: "POST",
    mode: "cors",
    url: "https://script.google.com/macros/s/deployment/exec"
  });

  assert.equal(handled, null);
  assert.deepEqual(worker.calls.open, []);
  assert.deepEqual(worker.calls.match, []);
  assert.deepEqual(worker.calls.put, []);
});

test("activate removes only old eOuting caches and claims clients", async () => {
  const worker = createWorker([
    "eouting-cache-v1.6.18",
    "eouting-cache-v1.6.19",
    "eouting-cache-v1.6.20",
    "eouting-cache-v1.6.21",
    "another-app-cache"
  ]);
  let activation = null;
  worker.listeners.activate({ waitUntil: (promise) => { activation = promise; } });
  await activation;

  assert.deepEqual(worker.calls.delete.sort(), [
    "eouting-cache-v1.6.18",
    "eouting-cache-v1.6.19",
    "eouting-cache-v1.6.20"
  ]);
  assert.equal(worker.calls.claim, 1);
});

test("static app shell and assets remain cached", async () => {
  const worker = createWorker();
  let installation = null;
  worker.listeners.install({ waitUntil: (promise) => { installation = promise; } });
  await installation;

  assert.ok(worker.calls.add.includes("./index.html"));
  assert.ok(worker.calls.add.includes(`./assets/app.js?v=${EXPECTED_VERSION}`));
  assert.ok(worker.calls.add.includes(`./assets/style.css?v=${EXPECTED_VERSION}`));

  await dispatchFetch(worker, {
    method: "GET",
    mode: "cors",
    url: `https://eouting.example.test/assets/app.js?v=${EXPECTED_VERSION}`
  });
  assert.equal(worker.calls.put.length, 1, "successful static assets must remain cacheable");
});

test("runtime version, cache name, asset URLs, footer and release notes are consistent", () => {
  const appVersion = appSource.match(/const APP_VERSION = "([^"]+)"/)[1];
  const cacheVersion = workerSource.match(/const CACHE_NAME = "eouting-cache-v([^"]+)"/)[1];

  assert.equal(versionInfo.version, EXPECTED_VERSION);
  assert.equal(appVersion, EXPECTED_VERSION);
  assert.equal(cacheVersion, EXPECTED_VERSION);
  assert.match(indexSource, new RegExp(`style\\.css\\?v=${EXPECTED_VERSION}`));
  assert.match(indexSource, new RegExp(`app\\.js\\?v=${EXPECTED_VERSION}`));
  assert.match(indexSource, new RegExp(`eOuting ITU • v${EXPECTED_VERSION}`));
  assert.match(workerSource, new RegExp(`style\\.css\\?v=${EXPECTED_VERSION}`));
  assert.match(workerSource, new RegExp(`app\\.js\\?v=${EXPECTED_VERSION}`));
  assert.equal(versionInfo.releasedAt, EXPECTED_RELEASE_DATE);
  assert.equal(versionInfo.notes, EXPECTED_RELEASE_NOTE);
});
