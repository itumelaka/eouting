const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const app = fs.readFileSync(path.join(__dirname,"../assets/app.js"),"utf8");
const sw = fs.readFileSync(path.join(__dirname,"../service-worker.js"),"utf8");
function extract(source,name) {
  const start=source.indexOf(`function ${name}(`);
  assert.ok(start>=0,name);
  let depth=0;
  const body=source.indexOf("{",start);
  for(let i=body;i<source.length;i++) {
    if(source[i]==="{")depth++;
    if(source[i]==="}" && --depth===0) return source.slice(source.slice(start-6,start)==="async "?start-6:start,i+1);
  }
  throw new Error(name);
}
function runtime(fetchImpl) {
  let calls=0;
  const context=vm.createContext({
    URL,URLSearchParams,AbortController,setTimeout,clearTimeout,console,
    window:{setTimeout,clearTimeout},fetch:async(...args)=>{calls++;return fetchImpl(...args);},
    delay:async()=>{},getGasWebAppUrlV200:()=>"https://proxy.test/api/gas",
    LIVE_API_UNSTABLE_MESSAGE:"Sambungan live tidak stabil. Sila cuba lagi.",
    LIVE_GET_TIMEOUT_MS_V19:22000,LIVE_GET_MAX_ATTEMPTS_V19:2,
    LIVE_GET_RETRY_MIN_DELAY_MS_V19:500,LIVE_GET_RETRY_MAX_DELAY_MS_V19:1200,
    ALLOW_MOCK_MODE:false,READ_ONLY_POST_ACTIONS_PERF01:new Set(),
    IS_HTML_SERVICE_MODE_V250:false,invokeEoutingRpcV250:()=>Promise.reject(new Error("RPC disabled")),
    USE_D1_STAGING_V300:false,
    GAS_WEB_APP_URL:"https://script.google.com/macros/s/PRODUCTION/exec",
    BETA_API_OVERRIDE_SESSION_KEY_V200:"eouting_beta_api_override_v200"
  });
  for(const name of ["getLiveGetRetryDelayV19","fetchApiGetWithRetry","createLiveApiErrorV19",
    "getResponseHostnameV19","isTransientHttpStatusV19","isGoogleRedirectHostnameV19",
    "classifyLiveGetErrorV19","parseApiResponse","cleanApiError","apiPost",
    "isLocalBetaApiHostV200","normalizeBetaApiOverrideV200","resolveGasWebAppUrlV200"])
    vm.runInContext(extract(app,name),context);
  return {context,calls:()=>calls};
}
function response(status,body) {return {status,ok:status<300,url:"https://proxy.test/api/gas",text:async()=>JSON.stringify(body)};}
for(const status of [502,504]) {
  test(`proxy ${status} GET follows existing two-attempt policy`,async()=>{
    let n=0;
    const rt=runtime(()=>++n===1?response(status,{ok:false,code:status===504?"UPSTREAM_TIMEOUT":"UPSTREAM_DELIVERY_FAILED",outcome_unknown:false}):response(200,{ok:true,data:"OK"}));
    assert.equal(await rt.context.fetchApiGetWithRetry("health",new URLSearchParams()),"OK");
    assert.equal(rt.calls(),2);
  });
}
test("GAS application errors remain application errors without retries",async()=>{
  const rt=runtime(()=>response(200,{ok:false,error:"PIN tidak sah"}));
  await assert.rejects(rt.context.fetchApiGetWithRetry("health",new URLSearchParams()),e=>e.category==="application" && e.message==="PIN tidak sah");
  assert.equal(rt.calls(),1);
});
test("unknown POST outcome shows reconciliation guidance, no retry/fallback",async()=>{
  const rt=runtime(()=>response(504,{ok:false,code:"UPSTREAM_TIMEOUT",error:"SECRET upstream detail",outcome_unknown:true}));
  await assert.rejects(rt.context.apiPost("submitRequest",{student_id:"TEST"}),e=>
    e.category==="proxy_transport" && e.outcomeUnknown && !e.retryable && /Semak rekod/.test(e.message) && !/SECRET/.test(e.message));
  assert.equal(rt.calls(),1);
});
test("rate-limit and rejected request do not enter immediate GET retry",async()=>{
  for(const [status,code] of [[429,"RATE_LIMITED"],[403,"ORIGIN_NOT_ALLOWED"],[413,"REQUEST_TOO_LARGE"]]) {
    const rt=runtime(()=>response(status,{ok:false,code,outcome_unknown:false}));
    await assert.rejects(rt.context.fetchApiGetWithRetry("health",new URLSearchParams()),e=>!e.retryable);
    assert.equal(rt.calls(),1);
  }
});
test("Worker POST connection loss also requests reconciliation and never retries",async()=>{
  const rt=runtime(()=>{throw new TypeError("SECRET network detail");});
  rt.context.getGasWebAppUrlV200=()=>"https://eouting-api-proxy-staging.itumelaka.workers.dev/api/gas";
  await assert.rejects(rt.context.apiPost("approveRequest",{request_id:"TEST"}),e=>
    e.outcomeUnknown && !e.retryable && /Semak rekod/.test(e.message) && !/SECRET/.test(e.message));
  assert.equal(rt.calls(),1);
});
test("direct GAS POST network error behavior remains unchanged",async()=>{
  const rt=runtime(()=>{throw new TypeError("network");});
  rt.context.getGasWebAppUrlV200=()=>"https://script.google.com/macros/s/PRODUCTION/exec";
  await assert.rejects(rt.context.apiPost("approveRequest",{}),/network/);
  assert.equal(rt.calls(),1);
});
test("Worker selection is explicit localhost config only; production endpoint unchanged",()=>{
  const rt=runtime(()=>{});
  const storage={getItem:()=>null,removeItem:()=>{},setItem:()=>{}};
  const worker="https://approved-worker.test/api/gas";
  for(const hostname of ["itumelaka.github.io","staging.pages.dev"]) {
    assert.match(rt.context.resolveGasWebAppUrlV200({hostname,search:"?api="+worker},storage,worker).url,/PRODUCTION/);
  }
  assert.equal(rt.context.resolveGasWebAppUrlV200({hostname:"localhost"},storage,worker).url,worker);
  assert.match(rt.context.resolveGasWebAppUrlV200({hostname:"localhost"},storage,"").url,/PRODUCTION/);
  for(const invalid of ["http://proxy.test/api/gas","https://u:p@proxy.test/api/gas","https://proxy.test/other","https://proxy.test/api/gas?url=evil"]) {
    assert.match(rt.context.resolveGasWebAppUrlV200({hostname:"localhost"},storage,invalid).url,/PRODUCTION/);
  }
  assert.match(app,/const WORKER_API_BASE_URL = "https:\/\/eouting-api-proxy-staging\.itumelaka\.workers\.dev\/api\/gas"/);
  assert.match(app,/resolveGasWebAppUrlV200\(window.location, SAFE_SESSION_STORAGE_V250, WORKER_API_BASE_URL\)/);
});
test("existing service worker bypasses cross-origin proxy requests without cache changes",()=>{
  const context=vm.createContext({self:{location:{origin:"https://itumelaka.github.io"}}});
  vm.runInContext(extract(sw,"isApiRequest_"),context);
  assert.equal(context.isApiRequest_(new URL("https://proxy.test/api/gas?action=health")),true);
  assert.equal(context.isApiRequest_(new URL("https://itumelaka.github.io/eouting/assets/app.js")),false);
  assert.match(sw,/eouting-cache-v2\.4\.0-r21/);
});
