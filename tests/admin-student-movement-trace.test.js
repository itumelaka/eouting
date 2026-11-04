const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const gas=read('gas/Code.gs'), app=read('assets/app.js'), html=read('index.html'), css=read('assets/style.css') + app.slice(app.indexOf('function getAdminTracePrintCss()'), app.indexOf('function buildAdminTracePrintDocument('));
function extract(source,name){ const start=source.indexOf('function '+name+'('); assert.ok(start>=0); const next=source.indexOf('\nfunction ',start+1); return source.slice(start,next<0?undefined:next); }
function context(){const students=[{student_id:'S1',nama:'Nama',kelas:'A2',pin:'secret'}];const rows=[
 {student_id:'S1',request_id:'B',tarikh:'2026-11-02',status:'KELUAR'},
 {student_id:'S1',request_id:'A',tarikh:'2026-11-01',status:'SELESAI',masa_keluar:'2026-11-01T08:00:00Z',masa_masuk:'2026-11-01T09:30:00Z',pin:'secret'},
 {student_id:'S1',tarikh:'2026-10-31',status:'SELESAI'}, {student_id:'S2',tarikh:'2026-11-01',status:'SELESAI'},
 {student_id:'S1',request_id:'C',tarikh:'2026-11-02',status:'DITOLAK_WARDEN'}];
const c=vm.createContext({Date,validateAdminCredentials_:p=>{if(p.pin!=='ok')throw Error('Admin');},SHEETS:{students:'students',requests:'requests'},STATUS:{done:'SELESAI'},getSheet_:s=>s,getRowsAsObjects_:s=>s==='students'?students:rows,now_:()=> '2026-11-04',parseDateForSort_:v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d:null;},formatDate_:v=>v.toISOString().slice(0,10)});
for(const name of ['getAdminStudentMovementTrace','validateMovementTraceDate_','normalizeDateKey_','calculateOutingDurationMinutes_','formatOutingDuration_'])vm.runInContext(extract(gas,name),c);return c;}
const input={pin:'ok',student_id:'S1',start_date:'2026-11-01',end_date:'2026-11-02'};
test('Admin auth runs before student lookup',()=>assert.throws(()=>context().getAdminStudentMovementTrace({...input,pin:''}),/Admin/));
test('student and strict inclusive bounded dates validated',()=>{for(const change of [{student_id:''},{student_id:'unknown'},{start_date:'2026-02-30'},{start_date:'11/01/2026'},{end_date:'2026-10-31'},{end_date:'2028-01-01'}])assert.throws(()=>context().getAdminStudentMovementTrace({...input,...change}));});
test('exact student/date filtering, all statuses, sorting, duration and minimal projection',()=>{const r=context().getAdminStudentMovementTrace(input);assert.deepEqual(Array.from(r.records,x=>x.request_id),['A','B','C']);assert.equal(r.summary.total_records,3);assert.equal(r.summary.completed_outings,1);assert.equal(r.summary.total_duration_minutes,90);assert.equal(r.records[1].duration_minutes,null);assert.equal(r.records[1].duration_label,'');assert.doesNotMatch(JSON.stringify(r),/pin|secret|no_matrik/);assert.equal(r.summary.total_duration_label,'1 jam 30 minit');});
test('no record response does not infer physical location',()=>{assert.equal(context().getAdminStudentMovementTrace({...input,start_date:'2026-12-01',end_date:'2026-12-02'}).records.length,0);assert.match(app,/Tiada rekod pergerakan keluar direkodkan dalam eOuting bagi tempoh ini\./);assert.match(app,/Laporan ini berdasarkan rekod pergerakan yang direkodkan dalam sistem eOuting sahaja\./);});
test('POST only and read only; no staging mapping',()=>{assert.doesNotMatch(extract(gas,'doGet'),/getAdminStudentMovementTrace/);assert.match(extract(gas,'doPost'),/getAdminStudentMovementTrace/);assert.doesNotMatch(extract(gas,'getAdminStudentMovementTrace'),/append|updateRow|setValue|flush|mirror|DriveApp/);assert.doesNotMatch(app.slice(0,app.indexOf('const SAFE_SESSION')),/getAdminStudentMovementTrace/);});
test('Admin gating, escaped report, explicit browser print and A4 scoped markup',()=>{assert.match(extract(app,'loadAdminTraceStudents'),/currentSession.role !== "admin"/);assert.match(app,/currentSession\?\.role !== "admin"/);assert.match(html,/id="adminTracePanel"[^>]*hidden/);assert.match(html,/Cetak \/ Simpan PDF/);assert.match(css,/@page \{ size:A4 landscape/);assert.match(app,/buildAdminTracePrintDocument/);const c=vm.createContext({escapeHtml:v=>String(v).replaceAll('<','&lt;'),formatDisplayDateTime:v=>v,formatAdminTraceDateTime:v=>v,requestTypeLabel:v=>v});vm.runInContext(extract(app,'renderAdminTraceReport').split('document.querySelector')[0],c);const r=context().getAdminStudentMovementTrace(input);r.student.name='<script>';assert.doesNotMatch(c.renderAdminTraceReport(r),/<script>/);assert.match(c.renderAdminTraceReport(r),/LAPORAN JEJAK/);});

test('full loaded collection supports immediate case-insensitive name and canonical ID search without mutation', async()=>{
 const select={value:'S-002',innerHTML:''}, search={value:''};
 const students=Array.from({length:140},(_,i)=>({student_id:'S-'+String(i).padStart(3,'0'),nama:i===2?'Nur AISYAH':'Pelajar '+i,pin:'private'}));
 const c=vm.createContext({currentSession:{role:'admin'},adminTraceStudents:[],document:{querySelector:s=>s==='#adminTraceStudent'?select:search},clearAdminTraceReport(){},escapeHtml:v=>String(v),buildAdminCredentialPayloadV200:()=>({}),apiPost:async action=>{assert.equal(action,'getAdminStudents');return students;}});
 for(const name of ['filterAdminTraceStudents','renderAdminTraceStudentChoices','loadAdminTraceStudents'])vm.runInContext((name === 'loadAdminTraceStudents' ? 'async ' : '') + extract(app,name),c);
 await c.loadAdminTraceStudents();assert.equal(c.adminTraceStudents.length,140);assert.match(select.innerHTML,/S-139/);assert.doesNotMatch(JSON.stringify(c.adminTraceStudents),/private|pin/);
 search.value='aIsYaH';c.renderAdminTraceStudentChoices();assert.match(select.innerHTML,/value="S-002"/);assert.doesNotMatch(select.innerHTML,/S-139/);assert.equal(select.value,'S-002');
 search.value='s-139';c.renderAdminTraceStudentChoices();assert.match(select.innerHTML,/value="S-139"/);assert.doesNotMatch(select.innerHTML,/AISYAH/);
 search.value='';c.renderAdminTraceStudentChoices();assert.match(select.innerHTML,/S-139/);assert.match(select.innerHTML,/AISYAH/);assert.equal(c.adminTraceStudents.length,140);
 c.currentSession.role='student';c.apiPost=()=>assert.fail('must not fetch');await c.loadAdminTraceStudents();
 assert.match(html,/id="adminTraceSearch" type="search"/);assert.match(app,/#adminTraceSearch"\)\?\.addEventListener\("input"/);
});
test('report date/time is compact Malaysia time with no fabricated missing values',()=>{
 const c=vm.createContext({Intl,parseFlexibleDate:v=>{const d=new Date(v);return Number.isFinite(d.getTime())?d:null;}});vm.runInContext(extract(app,'formatAdminTraceDateTime'),c);
 assert.equal(c.formatAdminTraceDateTime('2026-10-23T09:13:00Z'),'23/10/2026, 5:13 PTG');assert.equal(c.formatAdminTraceDateTime('2026-10-23'),'23/10/2026');assert.equal(c.formatAdminTraceDateTime(''),'-');assert.equal(c.formatAdminTraceDateTime('invalid'),'invalid');
});
test('official report branding and short-report compact layout preserve long report pagination',()=>{
 const c=vm.createContext({escapeHtml:String,formatAdminTraceDateTime:v=>v,requestTypeLabel:v=>v});vm.runInContext(extract(app,'renderAdminTraceReport').split('document.querySelector')[0],c);
 const data=context().getAdminStudentMovementTrace(input), result=c.renderAdminTraceReport(data);
 assert.equal((result.match(/src="assets\/eouting-header-logo.png"/g)||[]).length,1);assert.ok(fs.existsSync(path.join(__dirname,'../assets/eouting-header-logo.png')));
 assert.match(result,/class="trace-metadata"/);assert.match(result,/class="trace-report-notes"/);
 assert.match(css,/@page \{ size:A4 landscape; margin:8mm/);assert.match(css,/html,body\{[^}]*max-width:none[^}]*min-height:0[^}]*padding:0/);
 assert.match(css,/#adminTracePrintCopy\{[^}]*width:100%!important;max-width:none!important[^}]*break-inside:auto/);
 assert.match(css,/#adminTracePrintCopy \.trace-summary\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/#adminTracePrintCopy \.trace-metadata\{[^}]*grid-template-columns:1fr 1fr/);
 assert.match(css,/#adminTracePrintCopy table\{[^}]*font-size:9pt/);assert.match(css,/#adminTracePrintCopy thead\{display:table-header-group/);
 assert.match(css,/#adminTracePrintCopy \.trace-report-notes\{[^}]*break-inside:avoid;break-before:avoid/);
 assert.doesNotMatch(css.slice(css.indexOf('@media print',css.indexOf('.trace-summary{'))),/zoom:|transform:scale/);
});

function printHelper(name) {
 const match = new RegExp('(?:async )?function '+name+'\\(').exec(app);assert.ok(match);
 const rest=app.slice(match.index);const next=/\n(?:async )?function /.exec(rest.slice(1));return next?rest.slice(0,next.index+1):rest.split('document.querySelector')[0];
}
test('standalone print HTML contains only report and inline layout with absolute official asset',()=>{
 const c=vm.createContext({URL,document:{baseURI:'https://itumelaka.github.io/eouting/'},escapeHtml:String,formatAdminTraceDateTime:v=>v,requestTypeLabel:v=>v});
 for(const name of ['getAdminTracePrintCss','buildAdminTracePrintDocument','renderAdminTraceReport'])vm.runInContext(printHelper(name),c);
 const result=c.buildAdminTracePrintDocument(c.renderAdminTraceReport(context().getAdminStudentMovementTrace(input)));
 assert.match(result,/^<!doctype html><html lang="ms">/);assert.match(result,/<style>[\s\S]*size:A4 landscape; margin:8mm/);
 assert.match(result,/src="https:\/\/itumelaka.github.io\/eouting\/assets\/eouting-header-logo.png"/);
 assert.match(result,/<table>/);assert.match(result,/Laporan ini berdasarkan rekod/);assert.match(result,/bukan dipotong kepada julat/);
 assert.doesNotMatch(result,/<form|<button|<nav|adminTraceSearch|app-header|dashboard|admin-subtab|<script|<link/i);
 assert.doesNotMatch(app.slice(app.indexOf('function getAdminTracePrintCss')),/printing-student-trace|cloneNode|document.body.appendChild/);
 assert.match(app,/APP_VERSION\s*=\s*["']2\.4\.0["']/);
});
test('print readiness waits for document, image and fonts before layout settles',async()=>{
 const handlers={},imageHandlers={};let finishFont;
 const image={complete:false,naturalWidth:0,addEventListener:(name,fn)=>imageHandlers[name]=fn};
 const win={document:{readyState:'loading',images:[image],fonts:{ready:new Promise(r=>finishFont=r)}},addEventListener:(name,fn)=>handlers[name]=fn,setTimeout:fn=>fn()};
 const c=vm.createContext({});vm.runInContext(printHelper('waitForAdminTracePrintReady'),c);
 let ready=false;const pending=c.waitForAdminTracePrintReady(win).then(()=>ready=true);
 assert.equal(ready,false);handlers.load();await Promise.resolve();assert.equal(ready,false);
 image.naturalWidth=400;imageHandlers.load();await Promise.resolve();assert.equal(ready,false);
 finishFont();await pending;assert.equal(ready,true);
});
test('click opens popup synchronously and prints only child after readiness; afterprint closes it',async()=>{
 const events=[];let ready,afterprint;const session={role:'admin'};
 const win={closed:false,document:{open:()=>events.push('doc.open'),write:html=>{assert.equal(html,'isolated');events.push('write');},close:()=>events.push('doc.close')},addEventListener:(name,fn)=>{assert.equal(name,'afterprint');afterprint=fn;},focus:()=>events.push('focus'),print:()=>events.push('child.print'),close:()=>events.push('close')};
 const c=vm.createContext({currentSession:session,document:{querySelector:()=>({})},window:{open:()=>{events.push('open');return win;},print:()=>assert.fail('parent print forbidden')},buildAdminTracePrintDocument:()=> 'isolated',waitForAdminTracePrintReady:()=>new Promise(r=>ready=r)});
 vm.runInContext(printHelper('printAdminTraceReport'),c);const pending=c.printAdminTraceReport('<table>report</table>');assert.equal(events[0],'open');assert.ok(!events.includes('child.print'));ready();await pending;assert.ok(events.indexOf('doc.close')<events.indexOf('child.print'));assert.ok(!events.includes('close'));afterprint();assert.equal(events.at(-1),'close');
});
test('blocked popup or failed image never prints the application; non-Admin cannot open',async()=>{
 const message={},button={};let openCount=0;
 const c=vm.createContext({currentSession:{role:'admin'},document:{querySelector:s=>s==='#adminTraceMessage'?message:button},window:{open:()=>{openCount++;return null;},print:()=>assert.fail('parent print forbidden')}});
 vm.runInContext(printHelper('printAdminTraceReport'),c);await c.printAdminTraceReport('report');assert.match(message.textContent,/Benarkan pop-up/);assert.equal(button.disabled,false);
 c.currentSession.role='student';await c.printAdminTraceReport('report');assert.equal(openCount,1);
 c.currentSession.role='admin';c.window.open=()=>({document:{open(){},write(){},close(){}},print:()=>assert.fail('not ready')});c.buildAdminTracePrintDocument=()=> 'isolated';c.waitForAdminTracePrintReady=async()=>{throw Error('Imej gagal');};await c.printAdminTraceReport('report');assert.match(message.textContent,/Imej gagal/);
});
