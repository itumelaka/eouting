// Staging-only decision handlers. Keep production GAS rejection labels intentionally.
const text = value => String(value ?? '').trim();
const fault = (status, code, message) => Object.assign(new Error(message), { status, code });

function malaysiaTimestamp(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

function telegramDate(value) {
  const match = text(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value) || '-';
}

function telegramDateTime(value) {
  if (!value) return '-';
  const raw = text(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw) ? raw.replace(' ', 'T') + '+08:00' : raw);
  if (Number.isNaN(date.getTime())) return raw;
  const stamp = malaysiaTimestamp(date);
  return `${telegramDate(stamp)} ${stamp.slice(11, 16)}`;
}

async function decisionTelegram(record, action, env, fetchImpl) {
  if (!['1','true','yes','ya','enabled','on'].includes(text(env.TELEGRAM_ENABLED).toLowerCase()) ||
      !text(env.TELEGRAM_BOT_TOKEN) || !text(env.TELEGRAM_CHAT_ID)) return false;
  try {
    const type = record.jenis_permohonan;
    const labels = { OUTING_BIASA: 'Outing Biasa', OUTING_HUJUNG_MINGGU: 'Outing Sabtu / Ahad',
      KECEMASAN: 'Kecemasan', PULANG_BERMALAM: 'Pulang Bermalam', CUTI_SEMESTER: 'CUTI SEMESTER' };
    let label = labels[type] || type || '-';
    try {
      const config = await env.DB.prepare('SELECT display_name FROM OUTING_TYPES WHERE type_code = ? LIMIT 1').bind(type).first();
      label = text(config?.display_name) || label;
    } catch { /* Production falls back to the built-in label. */ }
    const prefix = type === 'PULANG_BERMALAM' ? 'Pulang Bermalam - ' : type === 'CUTI_SEMESTER' ? 'CUTI SEMESTER - ' : '';
    const actor = record.warden_approve_role === 'HEP' ? 'HEP' : 'Warden';
    const title = action === 'approveRequest' ? `✅ ${prefix}Permohonan Diluluskan ${actor}` : `❌ ${prefix}Permohonan Ditolak Warden`;
    const lines = [title, '', `ID: ${record.request_id || '-'}`, `Nama: ${record.nama || '-'}`,
      `No. Matrik: ${record.no_matrik || '-'}`, `Kelas: ${record.kelas || '-'}`, `Jenis: ${label}`,
      `Status: ${record.status || '-'}`, `Tujuan: ${record.tujuan || '-'}`, `Lokasi: ${record.lokasi || '-'}`,
      `Kenderaan: ${record.jenis_kenderaan || '-'}`];
    if (record.butiran_kenderaan) lines.push(`Butiran: ${record.butiran_kenderaan}`);
    if (type === 'KECEMASAN') lines.push(`Sebab Kecemasan: ${record.sebab_kecemasan || '-'}`,
      `Telefon Waris: ${record.telefon_waris || '-'}`, `Hubungan Waris: ${record.hubungan_waris || '-'}`);
    if (['OUTING_HUJUNG_MINGGU','PULANG_BERMALAM','CUTI_SEMESTER'].includes(type)) {
      if (type === 'CUTI_SEMESTER') lines.push(`Tarikh Keluar: ${telegramDate(record.tarikh)}`);
      const returnDate = telegramDate(record.tarikh_balik);
      const returnTime = text(record.masa_balik_dijangka) || '-';
      lines.push(`Tarikh Pulang Ke Asrama: ${returnDate}`, `Masa Dijangka Pulang Ke Asrama: ${returnTime}`,
        `Pulang ke asrama dijangka: ${returnDate === '-' && returnTime === '-' ? '-' : `${returnDate} ${returnTime}`}`, `Telefon Waris: ${record.telefon_waris || '-'}`,
        `Hubungan Waris: ${record.hubungan_waris || '-'}`);
    }
    if (record.warden_approve_by) lines.push(`${actor}: ${record.warden_approve_by}`);
    if (record.guard_keluar_by) lines.push(`Guard Keluar: ${record.guard_keluar_by}`);
    if (record.guard_masuk_by) lines.push(`Guard Masuk: ${record.guard_masuk_by}`);
    if (record.lewat) lines.push(`Lewat: ${record.lewat}`);
    lines.push('', `Masa Mohon: ${telegramDateTime(record.masa_mohon)}`,
      `Masa Approve/Tolak: ${telegramDateTime(record.masa_approve)}`,
      `Masa Keluar: ${telegramDateTime(record.masa_keluar)}`, `Masa Masuk: ${telegramDateTime(record.masa_masuk)}`);
    const response = await fetchImpl(`https://api.telegram.org/bot${text(env.TELEGRAM_BOT_TOKEN)}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: text(env.TELEGRAM_CHAT_ID), text: lines.join('\n') })
    });
    return response.ok;
  } catch { return false; }
}

async function handleWardenDecision(request, env, headers, action, options = {}) {
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'POST') throw fault(405, 'METHOD_NOT_ALLOWED', 'POST required');
  if (!['approveRequest','rejectRequest'].includes(action)) throw fault(400, 'INVALID_REQUEST', 'Invalid decision action');
  const payload = await request.json();
  const requestId = text(payload.request_id);
  const name = text(payload.warden_name || payload.nama_warden || payload.user_name);
  const id = text(payload.warden_id);
  const pin = text(payload.pin);
  if (!requestId || (!name && !id) || !pin) throw fault(400, 'INVALID_REQUEST', 'request_id, nama warden dan PIN diperlukan.');
  // JS normalization matches GAS for Unicode names, unlike SQLite's ASCII lower().
  const directory = name
    ? await env.DB.prepare('SELECT warden_id, nama, status, pin FROM WARDENS').all()
    : await env.DB.prepare('SELECT warden_id, nama, status, pin FROM WARDENS WHERE warden_id = ?').bind(id).all();
  const staff = directory.results.find(row => (!name || text(row.nama).toLowerCase() === name.toLowerCase()) &&
    text(row.status).toLowerCase() === 'aktif' && text(row.pin) === pin);
  if (!staff) throw fault(401, 'WARDEN_LOGIN_INVALID', 'Warden tidak dijumpai atau tidak aktif.');
  const role = /^HEP-/i.test(text(staff.warden_id)) ? 'HEP' : 'WARDEN';
  const readRecord = () => env.DB.prepare('SELECT * FROM OUTING_REQUESTS WHERE request_id = ? LIMIT 1').bind(requestId).first();
  const approve = action === 'approveRequest';
  const conflict = () => fault(409, 'INVALID_REQUEST_STATUS', `Hanya permohonan MENUNGGU_KELULUSAN boleh ${approve ? 'diluluskan' : 'ditolak'}.`);
  const missing = () => fault(404, 'REQUEST_NOT_FOUND', 'Permohonan tidak dijumpai.');
  const record = await readRecord();
  if (!record) throw missing();
  if (record.status !== 'MENUNGGU_KELULUSAN') throw conflict();
  const timestamp = malaysiaTimestamp((options.now || (() => new Date()))());
  const status = approve ? 'DILULUSKAN_WARDEN' : 'DITOLAK_WARDEN';
  // Deliberately do not trim rejection notes: production uses truthy supplied value or stored note.
  const note = payload.catatan || record.catatan || '';
  const result = approve
    ? await env.DB.prepare(`UPDATE OUTING_REQUESTS SET status = ?, warden_approve_by = ?, masa_approve = ?
        WHERE request_id = ? AND status = 'MENUNGGU_KELULUSAN'`).bind(status, staff.nama, timestamp, requestId).run()
    : await env.DB.prepare(`UPDATE OUTING_REQUESTS SET status = ?, warden_approve_by = ?, masa_approve = ?, catatan = ?
        WHERE request_id = ? AND status = 'MENUNGGU_KELULUSAN'`).bind(status, staff.nama, timestamp, note, requestId).run();
  if (result.meta?.changes !== 1) {
    const authoritative = await readRecord();
    if (!authoritative) throw missing();
    throw conflict();
  }
  // Full transition snapshot, like GAS; subsequent workflows cannot change this response's actor.
  const updated = { ...record, status, warden_approve_by: staff.nama, masa_approve: timestamp, warden_approve_role: role };
  if (!approve) updated.catatan = note;
  const details = { student_name: record.nama || '', no_matrik: record.no_matrik || '', jenis_permohonan: record.jenis_permohonan || '' };
  if (!approve) details.catatan = payload.catatan || '';
  try {
    await env.DB.prepare(`INSERT INTO AUDIT_LOG (timestamp,action,request_id,user_role,user_name,details,entity_type,entity_id)
      VALUES (?,?,?,?,?,?,?,?)`).bind(malaysiaTimestamp((options.now || (() => new Date()))()),
      approve ? 'APPROVE_REQUEST' : 'REJECT_REQUEST', requestId, approve && role === 'HEP' ? 'HEP' : 'Warden',
      staff.nama, JSON.stringify(details), '', '').run();
  } catch { /* Best effort after successful persistence, matching GAS. */ }
  await decisionTelegram(updated, action, env, options.fetchImpl || fetch);
  return new Response(JSON.stringify({ ok: true, data: updated }), { status: 200, headers });
}

export { handleWardenDecision };
