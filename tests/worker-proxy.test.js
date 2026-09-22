const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const { webcrypto } = require("node:crypto");
const source = fs.readFileSync(path.join(__dirname, "../proxy/staging-worker-base.js"), "utf8");
const origin = "https://itumelaka.github.io";
const upstream = "https://script.google.com/macros/s/TEST_DEPLOYMENT/exec";
const destination = "https://script.googleusercontent.com/macros/echo?user_content_key=SECRET&lib=TEST";

function runtime(fetchImpl, options = {}) {
  const calls = [], logs = [];
  const context = vm.createContext({
    URL, Headers, Response, TextDecoder, Uint8Array, AbortController,
    crypto: webcrypto,
console: {
  info: (value) => logs.push(value),
  error: (value) => logs.push(value)
},
    setTimeout: options.setTimeout || setTimeout,
    clearTimeout: options.clearTimeout || clearTimeout,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return fetchImpl(url, init, calls.length);
    }
  });
  vm.runInContext(
    source.replace(/export\s*\{[\s\S]*?\};?\s*$/, "this.handle = handleRequest;"),
    context
  );
  return {
    calls, logs,
    run: (request, env = {}, executionContext) =>
  context.handle(
    request,
    { GAS_UPSTREAM_URL: upstream, ...env },
    executionContext
  )
  };
}
function req(method = "GET", options = {}) {
  const headers = new Headers({ Origin: origin, ...options.headers });
  if (options.noOrigin) headers.delete("Origin");
  if (method === "POST" && !headers.has("Content-Type")) headers.set("Content-Type", "text/plain;charset=utf-8");
  return new Request(options.url || `https://proxy.test/api/gas${method === "GET" ? "?action=health" : ""}`, {
    method, headers, ...(method === "POST" ? { body: options.body ?? '{"action":"loginWarden","pin":"SECRET_PIN"}' } : {})
  });
}
function json(body = '{"ok":true,"data":{"status":"ok"}}') {
  return new Response(body, { headers: { "Content-Type": "application/json" } });
}
async function expectError(rt, request, status, code, env) {
  const response = await rt.run(request, env);
  assert.equal(response.status, status);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json();
  assert.equal(body.code, code);
  assert.equal(body.ok, false);
  assert.match(body.request_id, /^[0-9a-f-]{36}$/);
  return body;
}

test("OPTIONS accepts exact origin/method/header without calling GAS", async () => {
  const rt = runtime(() => { throw new Error("must not fetch"); });
  const response = await rt.run(req("OPTIONS", { headers: {
    "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"
  }}));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(rt.calls.length, 0);
});
for (const badOrigin of ["https://evil.test", "null", "https://itumelaka.github.io.evil.test", "https://itumelaka.github.io/eouting/"]) {
  test(`reject origin ${badOrigin}`, async () => {
    const rt = runtime(() => json());
    const response = await rt.run(req("GET", { headers: { Origin: badOrigin } }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
    assert.equal((await response.json()).code, "ORIGIN_NOT_ALLOWED");
    assert.equal(rt.calls.length, 0);
  });
}
test("missing Origin is rejected; explicit local origin works only in staging", async () => {
  const rt = runtime(() => json());
  await expectError(rt, req("GET", { noOrigin: true }), 403, "ORIGIN_NOT_ALLOWED");
  await expectError(rt, req("GET", { headers: { Origin: "http://localhost:8000" } }), 403, "ORIGIN_NOT_ALLOWED");
  const response = await rt.run(req("GET", { headers: { Origin: "http://localhost:8000" } }), { STAGING_ORIGIN: "http://localhost:8000" });
  assert.equal(response.status, 200);
});
test("reject method, path and preflight abuse before upstream", async () => {
  const rt = runtime(() => json());
  await expectError(rt, req("DELETE"), 405, "METHOD_NOT_ALLOWED");
  await expectError(rt, req("GET", {url:"https://proxy.test/api/gas/"}), 404, "PATH_NOT_ALLOWED");
  await expectError(rt, req("OPTIONS", {headers:{"Access-Control-Request-Method":"DELETE"}}), 405, "METHOD_NOT_ALLOWED");
  await expectError(rt, req("OPTIONS", {headers:{"Access-Control-Request-Method":"POST","Access-Control-Request-Headers":"authorization"}}), 400, "HEADERS_NOT_ALLOWED");
  assert.equal(rt.calls.length, 0);
});
test("GET approves statistics parameters and rejects unknown/duplicate parameters", async () => {
  const rt = runtime(() => json());
  const url = "https://proxy.test/api/gas?action=getOutingStats&month=9&year=2026&kelas=LI%20UMK&_ts=123";
  assert.equal((await rt.run(req("GET", {url}))).status, 200);
  assert.equal(rt.calls[0].url, upstream + "?action=getOutingStats&month=9&year=2026&kelas=LI+UMK&_ts=123");
  for (const query of ["action=loginAdmin", "action=health&url=https://evil.test", "action=health&action=health", "action=health&month=9"]) {
    await expectError(rt, req("GET", {url:"https://proxy.test/api/gas?"+query}), 400, "ACTION_NOT_ALLOWED");
  }
  assert.equal(rt.calls.length, 1);
});
test("POST preserves bytes; rejects unknown action, malformed JSON and wrong type", async () => {
  const rt = runtime(() => json());
  const raw = ' { "pin": "SECRET_PIN", "action": "approveRequest", "catatan": "Melayu ✓" } ';
  assert.equal((await rt.run(req("POST", {body:raw}))).status, 200);
  assert.equal(new TextDecoder().decode(rt.calls[0].init.body), raw);
  for (const body of ['{"action":"setupDatabase"}', '[]', 'null']) {
    await expectError(rt, req("POST", {body}), 400, "ACTION_NOT_ALLOWED");
  }
  await expectError(rt, req("POST", {body:'{'}), 400, "INVALID_REQUEST");
  await expectError(rt, req("POST", {headers:{"Content-Type":"application/json"}}), 415, "INVALID_REQUEST");
  assert.equal(rt.calls.length, 1);
});
test("actual body over 3 MiB rejected even with forged Content-Length", async () => {
  const rt = runtime(() => json());
  const body = JSON.stringify({action:"submitReturnSelfie",image_base64:"A".repeat(3*1024*1024)});
  const error = await expectError(rt, req("POST", {body,headers:{"Content-Length":"1"}}), 413, "REQUEST_TOO_LARGE");
  assert.equal(error.outcome_unknown, false);
  assert.equal(rt.calls.length, 0);
});
for (const status of [302,303]) {
  test(`GET ${status} follows approved redirect server-side`, async () => {
    const rt = runtime((_url,_init,n) => n === 1 ? new Response(null,{status,headers:{Location:destination}}) : json());
    const response = await rt.run(req());
    assert.equal(response.status,200);
    assert.equal((await response.json()).data.status,"ok");
    assert.equal(rt.calls.length,2);
    assert.equal(rt.calls[1].url,destination);
    assert.equal(rt.calls[1].init.redirect,"manual");
    assert.equal(response.headers.get("Location"),null);
  });
}
test("POST redirect uses GET without body or browser-sensitive headers", async () => {
  const rt = runtime((_url,_init,n) => n === 1 ? new Response(null,{status:302,headers:{Location:destination}}) : json());
  const response = await rt.run(req("POST", {headers:{Cookie:"COOKIE_SECRET",Authorization:"Bearer SECRET",Referer:"https://private.test", "Sec-Fetch-Site":"cross-site"}}));
  assert.equal(response.status,200);
  assert.equal(rt.calls[0].init.method,"POST");
  assert.equal(rt.calls[1].init.method,"GET");
  assert.equal(rt.calls[1].init.body,undefined);
  for (const call of rt.calls) {
    assert.equal(call.init.redirect,"manual");
    assert.doesNotMatch(JSON.stringify(call.init.headers),/cookie|authorization|referer|origin|sec-|SECRET/i);
  }
  assert.doesNotMatch(rt.logs.join(""),/SECRET_PIN|COOKIE_SECRET|user_content_key|image_base64/);
  assert.equal(rt.calls.filter(c=>c.init.method==="POST").length,1);
});
for (const location of ["https://evil.test/macros/echo", "http://script.googleusercontent.com/macros/echo", "https://u:p@script.googleusercontent.com/macros/echo", "https://script.googleusercontent.com:8443/macros/echo", "https://script.googleusercontent.com/wrong", "https://script.googleusercontent.com/macros/echo#token"]) {
  test(`reject unsafe redirect ${location}`, async () => {
    const rt = runtime(()=>new Response(null,{status:302,headers:{Location:location}}));
    const error = await expectError(rt,req("POST"),502,"UPSTREAM_DELIVERY_FAILED");
    assert.equal(error.outcome_unknown,true);
    assert.equal(rt.calls.length,1);
  });
}
test("reject unexpected redirect codes and redirect chains", async () => {
  for (const status of [301,307,308]) {
    const rt=runtime(()=>new Response(null,{status,headers:{Location:destination}}));
    await expectError(rt,req(),502,"UPSTREAM_DELIVERY_FAILED");
    assert.equal(rt.calls.length,1);
  }
  const rt=runtime(()=>new Response(null,{status:302,headers:{Location:destination}}));
  await expectError(rt,req(),502,"UPSTREAM_DELIVERY_FAILED");
  assert.equal(rt.calls.length,2);
});
test("upstream HTML 404 and invalid success responses normalize without disclosure/retry", async () => {
  for (const method of ["GET","POST"]) {
    const rt=runtime(()=>new Response("<html>PRIVATE_SECRET</html>",{status:404}));
    const error=await expectError(rt,req(method),502,"UPSTREAM_DELIVERY_FAILED");
    assert.equal(error.outcome_unknown,method==="POST");
    assert.doesNotMatch(JSON.stringify(error)+rt.logs.join(""),/PRIVATE_SECRET/);
    assert.equal(rt.calls.length,1);
  }
  for (const body of ["<html>SECRET</html>","null",'{"data":1}',"[]"]) {
    await expectError(runtime(()=>json(body)),req(),502,"UPSTREAM_INVALID_RESPONSE");
  }
});
test("timeout produces 504 and unknown POST outcome without replay", async () => {
  for (const method of ["GET","POST"]) {
    const rt=runtime(()=>new Promise(()=>{}), {setTimeout:(fn)=>{queueMicrotask(fn);return 1;},clearTimeout:()=>{}});
    const error=await expectError(rt,req(method),504,"UPSTREAM_TIMEOUT");
    assert.equal(error.outcome_unknown,method==="POST");
    assert.equal(rt.calls.length,1);
  }
});
test("GAS application error bytes are preserved with own headers", async () => {
  const raw=' {"ok":false,"error":"PIN tidak sah"} ';
  const rt=runtime(()=>new Response(raw,{headers:{"Set-Cookie":"SECRET", "Access-Control-Allow-Origin":"*"}}));
  const response=await rt.run(req("POST"));
  assert.equal(response.status,200);
  assert.equal(await response.text(),raw);
  assert.equal(response.headers.get("Set-Cookie"),null);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),origin);
  assert.equal(response.headers.get("Cache-Control"),"no-store");
});
test("optional limiter rejects before GAS; fixed upstream misconfig fails closed", async () => {
  const rt=runtime(()=>json());
  const error=await expectError(rt,req("POST"),429,"RATE_LIMITED",{API_RATE_LIMITER:{limit:async()=>({success:false})}});
  assert.equal(error.outcome_unknown,false);
  await expectError(rt,req(),503,"UPSTREAM_DELIVERY_FAILED",{GAS_UPSTREAM_URL:"https://evil.test/exec"});
  assert.equal(rt.calls.length,0);
});
test("network failure has no retry and logs contain only approved metadata", async () => {
  const rt=runtime(()=>{throw new Error("PIN=SECRET; user_content_key=SECRET");});
  await expectError(rt,req("POST"),502,"UPSTREAM_DELIVERY_FAILED");
  assert.equal(rt.calls.length,1);
  assert.deepEqual(Object.keys(JSON.parse(rt.logs[0])).sort(),["action","duration_ms","method","request_id","status"]);
  assert.doesNotMatch(rt.logs.join(""),/SECRET/);
});

test("POST 303 also discards body and cancellation/response read failures never replay", async () => {
  const rt=runtime((_url,_init,n)=>n===1?new Response(null,{status:303,headers:{Location:destination}}):json());
  assert.equal((await rt.run(req("POST"))).status,200);
  assert.equal(rt.calls[1].init.method,"GET");
  assert.equal(rt.calls[1].init.body,undefined);
  const broken=runtime(()=>new Response(new ReadableStream({start(c){c.error(new Error("SECRET"));}})));
  assert.equal((await expectError(broken,req("POST"),502,"UPSTREAM_DELIVERY_FAILED")).outcome_unknown,true);
  assert.equal(broken.calls.length,1);
});
test("normal base64 upload size is preserved without body logging", async () => {
  const body=JSON.stringify({action:"submitReturnSelfie",image_base64:"A".repeat(2*1024*1024),pin:"SENSITIVE"});
  const rt=runtime(()=>json());
  assert.equal((await rt.run(req("POST",{body}))).status,200);
  assert.equal(new TextDecoder().decode(rt.calls[0].init.body),body);
  assert.doesNotMatch(rt.logs.join(""),/SENSITIVE|image_base64|AAAA/);
});
test("response validation fails closed above the documented 16 MiB cap", async () => {
  const rt=runtime(()=>json(JSON.stringify({ok:true,data:"A".repeat(16*1024*1024)})));
  await expectError(rt,req(),502,"UPSTREAM_INVALID_RESPONSE");
  assert.equal(rt.calls.length,1);
});
test("every current GAS POST handler is covered by the explicit proxy allowlist", () => {
  const gas=fs.readFileSync(path.join(__dirname,"../gas/Code.gs"),"utf8");
  const handler=gas.slice(gas.indexOf("function dispatchPost_("),gas.indexOf("function eoutingRpc("));
  const actions=[...handler.matchAll(/action === "([A-Za-z0-9]+)"/g)].map(m=>m[1]);
  const workerList=source.slice(source.indexOf("var POST_ACTIONS"),source.indexOf("var MAX_REQUEST_BYTES"));
  for(const action of actions) assert.ok(workerList.includes('"'+action+'"'),action);
});

const staging = { STAGING_ORIGIN: "http://localhost:8000" };
test("staging GET retries a network failure once then succeeds with attempts header", async () => {
  const delays=[];
  const rt=runtime((_url,_init,n)=>{if(n===1)throw new Error("SECRET");return json();}, {
    setTimeout:(fn,ms)=>{if(ms===400){delays.push(ms);queueMicrotask(fn);return 0;}return setTimeout(fn,ms);}
  });
  const response=await rt.run(req(),staging);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"2");
  assert.equal(response.headers.get("Cache-Control"),"no-store");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"),origin);
  assert.deepEqual(delays,[400]);
  assert.equal(rt.calls.length,2);
  assert.ok(rt.calls.every(c=>c.url.startsWith(upstream)));
  assert.doesNotMatch(rt.logs.join(""),/SECRET/);
});
test("staging GET both delivery attempts fail; no third attempt",async()=>{
  const rt=runtime(()=>new Response("unavailable",{status:503}));
  const response=await rt.run(req(),staging);
  assert.equal(response.status,502);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"2");
  assert.equal((await response.json()).outcome_unknown,false);
  assert.equal(rt.calls.length,2);
});
test("staging GET retries googleusercontent HTML 404 from fresh exec",async()=>{
  const rt=runtime((_url,_init,n)=>{
    if(n===1||n===3)return new Response(null,{status:302,headers:{Location:destination}});
    return n===2?new Response("<html>SECRET</html>",{status:404,headers:{"Content-Type":"text/html; charset=utf-8"}}):json();
  });
  const response=await rt.run(req(),staging);
  assert.equal(response.status,200);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"2");
  assert.equal(rt.calls.length,4);
  assert.equal(rt.calls[2].url,rt.calls[0].url);
  assert.doesNotMatch(await response.text(),/SECRET|user_content_key/);
});
test("staging GET application errors, malformed JSON and unsafe redirects never retry",async()=>{
  const raw=' {"ok":false,"error":"PIN tidak sah"} ';
  const rt=runtime(()=>json(raw));
  const response=await rt.run(req(),staging);
  assert.equal(await response.text(),raw);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"1");
  assert.equal(rt.calls.length,1);
  for(const makeResponse of [
    ()=>json('{"data":1}'),()=>json('not json'),
    ()=>new Response(raw,{status:500}),
    ...[400,401,403,404,422,429].map(status=>()=>new Response(raw,{status})),
    ()=>new Response(null,{status:302,headers:{Location:"https://evil.test/"}}),
    ()=>new Response(null,{status:307,headers:{Location:destination}})
  ]) {
    const negative=runtime(makeResponse);
    const result=await negative.run(req(),staging);
    assert.equal(result.status,502);
    assert.equal(result.headers.get("X-Upstream-Attempts"),"1");
    assert.equal(negative.calls.length,1);
  }
});
test("staging POST remains one attempt with unchanged unknown outcome",async()=>{
  const rt=runtime(()=>{throw new Error("network");});
  const response=await rt.run(req("POST"),staging);
  assert.equal(response.status,502);
  assert.equal(response.headers.get("X-Upstream-Attempts"),"1");
  assert.equal((await response.json()).outcome_unknown,true);
  assert.equal(rt.calls.length,1);
});
test("staging GET timeout resets to 60s per attempt; POST stays 120s once",async()=>{
  for(const method of ["GET","POST"]) {
    const durations=[];
    const rt=runtime(()=>new Promise(()=>{}),{
      setTimeout:(fn,ms)=>{durations.push(ms);queueMicrotask(fn);return durations.length;},clearTimeout:()=>{}
    });
    const response=await rt.run(req(method),staging);
    assert.equal(response.status,504);
    assert.equal(response.headers.get("X-Upstream-Attempts"),method==="GET"?"2":"1");
    assert.deepEqual(durations,method==="GET"?[60000,400,60000]:[120000]);
    assert.ok(rt.calls.every(c=>c.init.signal.aborted));
  }
});
test("production has no retry; validation reports zero upstream attempts",async()=>{
  const rt=runtime(()=>{throw new Error("network");});
  assert.equal((await rt.run(req())).headers.get("X-Upstream-Attempts"),"1");
  assert.equal(rt.calls.length,1);
  for(const request of [req("GET",{headers:{Origin:"null"}}),req("GET",{url:"https://proxy.test/api/gas?action=unknown"})]) {
    assert.equal((await rt.run(request,staging)).headers.get("X-Upstream-Attempts"),"0");
  }
  assert.equal(rt.calls.length,1);
});

test("staging D1 submit returns before Sheets mirror finishes via waitUntil", async () => {
  const pendingTasks = [];

  const statement = (sql) => ({
    bind(...values) {
      this.values = values;
      return this;
    },
    async first() {
      if (sql.includes("FROM STUDENTS")) {
        return {
          student_id: "STU-001",
          no_matrik: "M001",
          nama: "Nama Test",
          email: "test@example.test",
          kelas: "TEST",
          status: "Aktif"
        };
      }

      if (sql.includes("FROM OUTING_TYPES")) {
        return {
          type_code: "OUTING_BIASA",
          display_name: "Outing Biasa",
          description: "",
          active: 1,
          sort_order: 1,
          allowed_days: "SELASA",
          application_open_time: "",
          application_close_time: "",
          fixed_return_time: "22:00",
          same_day_only: 1,
          require_leave_date: 0,
          require_return_date: 0,
          require_return_time: 0,
          require_guardian_phone: 0,
          require_guardian_relation: 0,
          require_emergency_reason: 0,
          require_purpose: 1,
          require_location: 1,
          require_vehicle: 1,
          require_warden_approval: 1,
          require_selfie: 0,
          config_version: 1,
          departure_allowed_days: "",
          earliest_departure_time: "",
          application_open_date: "",
          application_close_date: ""
        };
      }

      if (sql.includes("SELECT request_id FROM OUTING_REQUESTS")) {
        return null;
      }

      return null;
    },
    async run() {
      return { success: true };
    }
  });

  const DB = {
    prepare(sql) {
      return statement(sql);
    },
    async batch() {
      return [{ success: true }, { success: true }];
    }
  };

  const rt = runtime(
  (_url, init) => new Promise((_, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")));
  }),
  {
    setTimeout: (fn, ms) => {
      if (ms === 20000) {
        queueMicrotask(fn);
        return 1;
      }
      return setTimeout(fn, ms);
    },
    clearTimeout: () => {}
  }
);

  const executionContext = {
    waitUntil(promise) {
      pendingTasks.push(promise);
    }
  };

  const response = await rt.run(
    req("POST", {
      url: "https://proxy.test/api/d1/submitRequest",
      body: JSON.stringify({
        action: "submitRequest",
        student_id: "STU-001",
        no_matrik: "M001",
        jenis_permohonan: "OUTING_BIASA",
        tujuan: "Test async mirror",
        lokasi: "ITU",
        jenis_kenderaan: "Jalan kaki"
      })
    }),
    {
      ...staging,
      DB,
      D1_MIRROR_SECRET: "TEST_SECRET",
      TELEGRAM_ENABLED: "0"
    },
    executionContext
  );

  assert.equal(response.status, 201);
  assert.equal(pendingTasks.length, 1);

  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.data.status, "MENUNGGU_KELULUSAN");
});