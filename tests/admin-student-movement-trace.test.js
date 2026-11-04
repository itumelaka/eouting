const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const gas=read('gas/Code.gs'), app=read('assets/app.js'), html=read('index.html'), css=read('assets/style.css');
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
test('Admin gating, escaped report, explicit browser print and A4 scoped markup',()=>{assert.match(extract(app,'loadAdminTraceStudents'),/currentSession.role !== "admin"/);assert.match(app,/currentSession\?\.role !== "admin"/);assert.match(html,/id="adminTracePanel"[^>]*hidden/);assert.match(html,/Cetak \/ Simpan PDF/);assert.match(css,/@page \{ size:A4 landscape/);assert.match(css,/printing-student-trace > :not\(#adminTracePrintCopy\)\{display:none!important/);const c=vm.createContext({escapeHtml:v=>String(v).replaceAll('<','&lt;'),formatDisplayDateTime:v=>v,formatAdminTraceDateTime:v=>v,requestTypeLabel:v=>v});vm.runInContext(extract(app,'renderAdminTraceReport').split('document.querySelector')[0],c);const r=context().getAdminStudentMovementTrace(input);r.student.name='<script>';assert.doesNotMatch(c.renderAdminTraceReport(r),/<script>/);assert.match(c.renderAdminTraceReport(r),/LAPORAN JEJAK/);});

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
 assert.match(css,/@page \{ size:A4 landscape; margin:8mm/);assert.match(css,/body\.printing-student-trace\{[^}]*max-width:none!important[^}]*min-height:0!important[^}]*padding:0!important/);
 assert.match(css,/#adminTracePrintCopy\{[^}]*width:100%!important;max-width:none!important[^}]*break-inside:auto/);
 assert.match(css,/#adminTracePrintCopy \.trace-summary\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/#adminTracePrintCopy \.trace-metadata\{[^}]*grid-template-columns:1fr 1fr/);
 assert.match(css,/#adminTracePrintCopy table\{[^}]*font-size:9pt/);assert.match(css,/#adminTracePrintCopy thead\{display:table-header-group/);
 assert.match(css,/#adminTracePrintCopy \.trace-report-notes\{[^}]*break-inside:avoid;break-before:avoid/);
 assert.doesNotMatch(css.slice(css.indexOf('@media print',css.indexOf('.trace-summary{'))),/zoom:|transform:scale/);
});
