import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

const moduleUnderTest = await import('../proxy/staging-warden-decisions.js').catch(error => {
  if (error.code === 'ERR_MODULE_NOT_FOUND') return {};
  throw error;
});

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE WARDENS (warden_id TEXT PRIMARY KEY,nama TEXT,status TEXT,pin TEXT);
    CREATE TABLE OUTING_REQUESTS (request_id TEXT PRIMARY KEY,status TEXT,nama TEXT,no_matrik TEXT,
      jenis_permohonan TEXT,kelas TEXT,tujuan TEXT,lokasi TEXT,jenis_kenderaan TEXT,
      catatan TEXT,warden_approve_by TEXT,masa_approve TEXT,masa_mohon TEXT,
      tarikh TEXT,tarikh_balik TEXT,masa_balik_dijangka TEXT,telefon_waris TEXT,hubungan_waris TEXT,
      student_email TEXT,selfie_url TEXT);
    CREATE TABLE OUTING_TYPES (type_code TEXT PRIMARY KEY,display_name TEXT);
    CREATE TABLE AUDIT_LOG (timestamp TEXT,action TEXT,request_id TEXT,user_role TEXT,
      user_name TEXT,details TEXT,entity_type TEXT,entity_id TEXT);
    INSERT INTO WARDENS VALUES ('W-TEST','Test Warden',' aKtIf ',' 0123 '),('HEP-TEST','Test HEP','AKTIF','0456'),('W-OFF','Inactive','Tidak Aktif','0123');
    INSERT INTO OUTING_REQUESTS VALUES ('TEST-REQUEST','MENUNGGU_KELULUSAN','Test Student','TEST-M',
      'PULANG_BERMALAM','TEST CLASS','Test purpose','Test location','Bas','Existing note',NULL,NULL,
      '2026-09-20 10:00:00','2026-09-20','2026-09-21','20:00','TEST PHONE','TEST RELATION','test@example.invalid','test-selfie');
    INSERT INTO OUTING_TYPES VALUES ('PULANG_BERMALAM','Pulang Bermalam');`);
  const sent = [];
  let beforeUpdate;
  const DB = { prepare(sql) {
    const statement = (values = []) => ({
      bind(...args) { return statement(args); },
      async first() { return db.prepare(sql).get(...values) || null; },
      async all() { return { results: db.prepare(sql).all(...values) }; },
      async run() {
        if (/^UPDATE OUTING_REQUESTS/.test(sql.trim()) && beforeUpdate) { const hook = beforeUpdate; beforeUpdate = null; hook(); }
        return { success: true, meta: { changes: Number(db.prepare(sql).run(...values).changes) } };
      }
    });
    return statement();
  }};
  const env = { DB, TELEGRAM_ENABLED: '1', TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' };
  const options = { now: () => new Date('2026-09-20T03:04:05Z'), fetchImpl: async (url, init) => {
    assert.notEqual(db.prepare('SELECT status FROM OUTING_REQUESTS').get().status, 'MENUNGGU_KELULUSAN');
    sent.push(JSON.parse(init.body));
    return new Response('{}', { status: 200 });
  }};
  const call = async (action = 'approveRequest', payload = {}, overrides = {}) => {
    assert.equal(typeof moduleUnderTest.handleWardenDecision, 'function', 'decision handler is implemented');
    const request = new Request(`https://staging.invalid/api/d1/${action}`, { method: 'POST', body: JSON.stringify({request_id:'TEST-REQUEST',warden_name:' test WARDEN ',pin:' 0123 ',...payload}) });
    const response = await moduleUnderTest.handleWardenDecision(request, env, new Headers(), action, {...options,...overrides});
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.error, undefined);
    return body.data;
  };
  return { db, sent, call, env, options, beforeUpdate: hook => { beforeUpdate = hook; } };
}

test('approval persists canonical identity, Malaysia time, full response and one post-write audit/Telegram', async () => {
  const f = fixture(); const row = await f.call();
  assert.equal(row.status, 'DILULUSKAN_WARDEN');
  assert.equal(row.warden_approve_by, 'Test Warden');
  assert.equal(row.warden_approve_role, 'WARDEN');
  assert.equal(row.masa_approve, '2026-09-20 11:04:05');
  assert.equal(row.selfie_url, 'test-selfie');
  assert.equal(row.student_email, 'test@example.invalid');
  const audit = f.db.prepare('SELECT * FROM AUDIT_LOG').all();
  assert.equal(audit.length, 1);
  assert.deepEqual({...audit[0]}, {timestamp:'2026-09-20 11:04:05',action:'APPROVE_REQUEST',request_id:'TEST-REQUEST',user_role:'Warden',user_name:'Test Warden',details:JSON.stringify({student_name:'Test Student',no_matrik:'TEST-M',jenis_permohonan:'PULANG_BERMALAM'}),entity_type:'',entity_id:''});
  assert.equal(f.sent.length, 1);
  assert.match(f.sent[0].text, /^✅ Pulang Bermalam - Permohonan Diluluskan Warden/);
  for (const text of ['Test Student','TEST-M','TEST CLASS','Test purpose','Test location','Bas','21/09/2026','20:00','TEST PHONE','TEST RELATION','Warden: Test Warden','20/09/2026 11:04']) assert.ok(f.sent[0].text.includes(text), text);
});

for (const alias of ['warden_name','nama_warden','user_name','warden_id']) test(`HEP approval authenticates ${alias} and derives role from ID`, async () => {
  const f = fixture(); const row = await f.call('approveRequest', {warden_name:'', [alias]:alias==='warden_id'?'HEP-TEST':' test hep ',pin:'0456'});
  assert.equal(row.warden_approve_role,'HEP');
  assert.equal(f.db.prepare('SELECT user_role FROM AUDIT_LOG').get().user_role,'HEP');
  assert.match(f.sent[0].text,/Permohonan Diluluskan HEP/);
});

for (const [name,pin,role] of [['Test Warden','0123','WARDEN'],['Test HEP','0456','HEP']]) test(`${role} rejection preserves production Warden labels and note fallback`, async () => {
  const f = fixture(); const row = await f.call('rejectRequest',{warden_name:name,pin,catatan:''});
  assert.equal(row.status,'DITOLAK_WARDEN'); assert.equal(row.catatan,'Existing note');
  assert.equal(row.warden_approve_by,name); assert.equal(row.warden_approve_role,role);
  const audit=f.db.prepare('SELECT * FROM AUDIT_LOG').get();
  assert.equal(audit.action,'REJECT_REQUEST'); assert.equal(audit.user_role,'Warden');
  assert.equal(JSON.parse(audit.details).catatan,'');
  assert.match(f.sent[0].text,/^❌ Pulang Bermalam - Permohonan Ditolak Warden/);
});

test('rejection preserves supplied note verbatim in record and audit',async()=>{
  const f=fixture();const row=await f.call('rejectRequest',{catatan:'  Test rejection  '});
  assert.equal(row.catatan,'  Test rejection  ');
  assert.equal(JSON.parse(f.db.prepare('SELECT details FROM AUDIT_LOG').get().details).catatan,'  Test rejection  ');
});

for(const [label,payload,status] of [['invalid PIN',{pin:'no'},401],['inactive',{warden_name:'Inactive'},401],['missing auth',{warden_name:'',pin:''},400],['missing request',{request_id:'MISSING'},404]]) test(`${label} has no persistence, audit or Telegram`,async()=>{
  const f=fixture();await assert.rejects(f.call('approveRequest',payload),error=>error.status===status);
  assert.equal(f.db.prepare('SELECT status FROM OUTING_REQUESTS').get().status,'MENUNGGU_KELULUSAN');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM AUDIT_LOG').get().n,0); assert.equal(f.sent.length,0);
});

for(const action of ['approveRequest','rejectRequest']) test(`${action} rejects sequential repeats and invalid status`,async()=>{
  const f=fixture(); await f.call(action);
  await assert.rejects(f.call(action),error=>error.status===409);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM AUDIT_LOG').get().n,1);assert.equal(f.sent.length,1);
});

test('concurrent approve/reject has exactly one winner, audit and Telegram',async()=>{
  const f=fixture();const results=await Promise.allSettled([f.call(),f.call('rejectRequest')]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM AUDIT_LOG').get().n,1);assert.equal(f.sent.length,1);
});

for(const deleted of [false,true]) test(`zero affected rows rereads authoritative ${deleted?'missing':'changed'} record`,async()=>{
  const f=fixture();f.beforeUpdate(()=>f.db.exec(deleted?"DELETE FROM OUTING_REQUESTS":"UPDATE OUTING_REQUESTS SET status='DITOLAK_WARDEN'"));
  await assert.rejects(f.call(),error=>error.status===(deleted?404:409));
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM AUDIT_LOG').get().n,0);assert.equal(f.sent.length,0);
});

for(const failure of ['audit','http','network']) test(`${failure} failure never rolls back decision or leaks into success response`,async()=>{
  const f=fixture();let attempts=0;
  if(failure==='audit') f.db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON AUDIT_LOG BEGIN SELECT RAISE(FAIL,'test audit failure'); END;");
  const row=await f.call('approveRequest',{}, {fetchImpl:async()=>{attempts++;if(failure==='network')throw new Error('internal Telegram error');return new Response('{}',{status:failure==='http'?400:200});}});
  assert.equal(row.status,'DILULUSKAN_WARDEN');assert.equal(attempts,1);
  assert.equal(f.db.prepare('SELECT status FROM OUTING_REQUESTS').get().status,'DILULUSKAN_WARDEN');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM AUDIT_LOG').get().n,failure==='audit'?0:1);
});

test('semester Telegram keeps prefix, departure date and empty return placeholder', async()=>{
  const f=fixture();f.db.exec("UPDATE OUTING_REQUESTS SET jenis_permohonan='CUTI_SEMESTER',tarikh_balik='',masa_balik_dijangka=''");
  await f.call(); assert.match(f.sent[0].text,/^✅ CUTI SEMESTER - Permohonan Diluluskan Warden/);
  assert.match(f.sent[0].text,/Tarikh Keluar: 20\/09\/2026/);
  assert.match(f.sent[0].text,/Pulang ke asrama dijangka: -\n/);
});

test('rejection HTTP failure still persists note and exactly one audit',async()=>{
  const f=fixture();let calls=0;const row=await f.call('rejectRequest',{catatan:'Rejected test'}, {fetchImpl:async()=>{calls++;return new Response('{}',{status:400});}});
  assert.equal(row.catatan,'Rejected test');assert.equal(calls,1);
  assert.equal(f.db.prepare('SELECT status FROM OUTING_REQUESTS').get().status,'DITOLAK_WARDEN');
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM AUDIT_LOG').get().n,1);
});

test('numeric zero PIN remains valid and Malaysia midnight is 00 rather than 24',async()=>{
  const f=fixture();f.db.exec("UPDATE WARDENS SET pin=' 0 ' WHERE warden_id='W-TEST'");
  const row=await f.call('approveRequest',{pin:0},{now:()=>new Date('2026-09-19T16:00:00Z')});
  assert.equal(row.masa_approve,'2026-09-20 00:00:00');
});
