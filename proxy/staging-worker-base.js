const stagingWardenDecisions = (() => {
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
const mirrorTask = mirrorOutingRequestToSheets(
  env,
  updated,
  options.fetchImpl || fetch
).catch(async (mirrorError) => {
  console.error(JSON.stringify({
    action: action,
    request_id: requestId,
    event: "OUTING_REQUEST_SHEETS_MIRROR_FAILED",
    error: String(mirrorError && mirrorError.message || mirrorError)
  }));

  try {
    await enqueueMirrorRetry(
      env,
      requestId,
      mirrorError,
      { now: options.now }
    );
  } catch (queueError) {
    console.error(JSON.stringify({
      action: action,
      request_id: requestId,
      event: "OUTING_REQUEST_MIRROR_RETRY_QUEUE_FAILED",
      error: String(queueError && queueError.message || queueError)
    }));
  }
});

if (options.context && typeof options.context.waitUntil === "function") {
  options.context.waitUntil(mirrorTask);
} else {
  await mirrorTask;
}

await decisionTelegram(updated, action, env, options.fetchImpl || fetch);

const responseData = {
  ok: true,
  data: updated
};

return new Response(JSON.stringify(responseData), {
  status: 200,
  headers
});
}

return { handleWardenDecision };
})();

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var GET_ACTIONS = /* @__PURE__ */ new Set([
  "health",
  "getStudentLoginDirectory",
  "getWardens",
  "getGuards",
  "getTodayRecords",
  "getCurrentHostelSummary",
  "getOutingStats",
  "getOutingTypes"
]);
var POST_ACTIONS = /* @__PURE__ */ new Set([
  "loginStudent",
  "loginWarden",
  "loginGuard",
  "loginAdmin",
  "getTodayRecords",
  "getCurrentHostelRoster",
  "getGuardianContact",
  "getStudentAnnualSummary",
  "getAdminIndividualStats",
  "getAdminMonitoring",
  "searchAdminMasterRecords",
  "getAdminStaff",
  "createStaff",
  "updateStaff",
  "toggleStaffStatus",
  "getAdminOutingTypes",
  "getAnnouncementBannerAdmin",
  "updateAnnouncementBanner",
  "getNoGuardDepartureConfig",
  "updateNoGuardDepartureConfig",
  "getAnnouncementBanner",
  "getOutingConfigReadiness",
  "getStudentGroupConfigReadiness",
  "setStudentGroupConfigEnabled",
  "runStudentInstitutionMigration",
  "getAdminStudentGroups",
  "createStudentGroup",
  "updateStudentGroup",
  "toggleStudentGroupStatus",
  "getAdminLiInstitutions",
  "createLiInstitution",
  "updateLiInstitution",
  "toggleLiInstitutionStatus",
  "createOutingType",
  "updateOutingType",
  "toggleOutingType",
  "getAdminStudents",
  "getStudentProfilePhotos",
  "submitStudentProfilePhoto",
  "removeStudentProfilePhoto",
  "createStudent",
  "updateStudent",
  "toggleStudentStatus",
  "submitRequest",
  "cancelStudentRequest",
  "requestDepartureConfirmation",
  "approveRequest",
  "rejectRequest",
  "confirmWardenRemoteCheckout",
  "confirmOut",
  "confirmIn",
  "submitReturnSelfie"
]);
var MAX_REQUEST_BYTES = 3 * 1024 * 1024;
var MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
function fault(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}
__name(fault, "fault");
async function readBounded(body, limit, tooLarge) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {
        });
        throw tooLarge;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
__name(readBounded, "readBounded");
function trustedUrl(value, redirect = false) {
  const url = new URL(value);
  const validPath = redirect ? url.pathname === "/macros/echo" : /^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash || url.hostname !== (redirect ? "script.googleusercontent.com" : "script.google.com") || !validPath || !redirect && url.search) throw new Error("Invalid upstream URL");
  return url;
}
__name(trustedUrl, "trustedUrl");
async function mirrorOutingRequestToSheets(env, record, fetchImpl = fetch) {
  if (!env.GAS_UPSTREAM_URL || !env.D1_MIRROR_SECRET) {
    throw new Error("D1 to Sheets mirror configuration unavailable");
  }

  if (!record || typeof record !== "object" || !record.request_id) {
    throw new Error("D1 outing request mirror record invalid");
  }

  const upstream = trustedUrl(env.GAS_UPSTREAM_URL);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);

  try {
    const body = JSON.stringify({
      action: "mirrorOutingRequestFromD1",
      mirror_secret: env.D1_MIRROR_SECRET,
      record: record
    });

    let response = await fetchImpl(upstream.href, {
      method: "POST",
      body,
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-store",
        "Content-Type": "text/plain;charset=utf-8"
      },
      redirect: "manual",
      signal: controller.signal
    });

    if (response.status === 302 || response.status === 303) {
      const destination = trustedUrl(
        response.headers.get("Location"),
        true
      );

      await response.body?.cancel();

      response = await fetchImpl(destination.href, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-store"
        },
        redirect: "manual",
        signal: controller.signal
      });
    }

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("D1 to Sheets mirror upstream failed");
    }

    const bytes = await readBounded(
      response.body,
      MAX_RESPONSE_BYTES,
      new Error("D1 to Sheets mirror response too large")
    );

    let result;

    try {
      result = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      );
    } catch {
      throw new Error("D1 to Sheets mirror response invalid");
    }

    if (
      !result ||
      result.ok !== true ||
      !result.data ||
      result.data.mirrored !== true
    ) {
      throw new Error("D1 to Sheets mirror rejected");
    }

    return result.data;
  } finally {
    clearTimeout(timer);
  }
}
function mirrorRetryTimestamp(date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

async function enqueueMirrorRetry(env, requestId, error, options = {}) {
  if (!env || !env.DB) {
    throw new Error("D1 mirror retry queue unavailable");
  }

  const normalizedRequestId = String(requestId || "").trim();

  if (!normalizedRequestId) {
    throw new Error("D1 mirror retry request id invalid");
  }

  const now = (options.now || (() => new Date()))();
  const attemptedAt = mirrorRetryTimestamp(now);
  const nextAttemptAt = mirrorRetryTimestamp(
    new Date(now.getTime() + 60 * 1000)
  );
  const errorMessage = String(
    error && error.message ? error.message : error || "Unknown mirror failure"
  );

  await env.DB.prepare(`
    INSERT INTO MIRROR_RETRY_QUEUE (
      request_id,
      attempts,
      first_failed_at,
      last_attempt_at,
      next_attempt_at,
      last_error,
      updated_at
    )
    VALUES (?, 1, ?, ?, ?, ?, ?)
    ON CONFLICT(request_id) DO UPDATE SET
      attempts = MIRROR_RETRY_QUEUE.attempts + 1,
      last_attempt_at = excluded.last_attempt_at,
      next_attempt_at = excluded.next_attempt_at,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `).bind(
    normalizedRequestId,
    attemptedAt,
    attemptedAt,
    nextAttemptAt,
    errorMessage,
    attemptedAt
  ).run();

  return true;
}
async function reconcileMirrorRetryQueue(env, options = {}) {
  if (!env || !env.DB) {
    throw new Error("D1 mirror retry queue unavailable");
  }

  const now = (options.now || (() => new Date()))();
  const nowStamp = mirrorRetryTimestamp(now);
  const mirror = options.mirror || mirrorOutingRequestToSheets;
  const limit = Number.isInteger(options.limit) && options.limit > 0
    ? Math.min(options.limit, 100)
    : 25;

  const dueResult = await env.DB.prepare(`
    SELECT request_id
    FROM MIRROR_RETRY_QUEUE
    WHERE next_attempt_at <= ?
    ORDER BY next_attempt_at ASC
    LIMIT ?
  `).bind(
    nowStamp,
    limit
  ).all();

  const dueRows = Array.isArray(dueResult?.results)
    ? dueResult.results
    : [];

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const queued of dueRows) {
    const requestId = String(queued?.request_id || "").trim();

    if (!requestId) {
      continue;
    }

    processed += 1;

    const latest = await env.DB.prepare(`
      SELECT *
      FROM OUTING_REQUESTS
      WHERE request_id = ?
      LIMIT 1
    `).bind(requestId).first();

    if (!latest) {
      await env.DB.prepare(`
        DELETE FROM MIRROR_RETRY_QUEUE
        WHERE request_id = ?
      `).bind(requestId).run();

      succeeded += 1;
      continue;
    }

    try {
      await mirror(env, latest);

      await env.DB.prepare(`
        DELETE FROM MIRROR_RETRY_QUEUE
        WHERE request_id = ?
      `).bind(requestId).run();

      succeeded += 1;
    } catch (mirrorError) {
      failed += 1;

      await enqueueMirrorRetry(
        env,
        requestId,
        mirrorError,
        { now: () => now }
      );
    }
  }

  return {
    processed,
    succeeded,
    failed
  };
}
const stagingSubmitRequestV230 = (() => {
const ACTIVE_STATUSES = [
  "MENUNGGU_KELULUSAN",
  "DILULUSKAN_WARDEN",
  "KELUAR"
];

const REQUEST_COLUMNS = [
  "request_id", "tarikh", "hari", "jenis_permohonan", "student_id",
  "no_matrik", "nama", "student_email", "kelas", "tujuan", "lokasi",
  "jenis_kenderaan", "butiran_kenderaan", "sebab_kecemasan",
  "telefon_waris", "hubungan_waris", "catatan_kecemasan", "masa_mohon",
  "status", "warden_approve_by", "masa_approve", "masa_keluar",
  "guard_keluar_by", "masa_masuk", "guard_masuk_by", "lewat",
  "selfie_whatsapp", "catatan", "tarikh_balik", "hari_balik",
  "masa_balik_dijangka", "selfie_status", "selfie_file_id", "selfie_url",
  "masa_selfie", "selfie_telegram_message_id", "sebab_batal_pelajar",
  "masa_batal_pelajar", "dibatalkan_oleh"
];

const BOOLEAN_CONFIG_FIELDS = [
  "active", "same_day_only", "require_leave_date", "require_return_date",
  "require_return_time", "require_guardian_phone", "require_guardian_relation",
  "require_emergency_reason", "require_purpose", "require_location",
  "require_vehicle", "require_warden_approval", "require_selfie"
];

function fault(status, code, message) {
  return Object.assign(new Error(message), { status, code });
}

function malaysiaParts(date) {
  const dateKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur", hour: "2-digit", minute: "2-digit",
    second: "2-digit", hour12: false
  }).format(date);
  const day = new Intl.DateTimeFormat("ms-MY", {
    timeZone: "Asia/Kuala_Lumpur", weekday: "long"
  }).format(date).toUpperCase();
  return { dateKey, time, day, timestamp: `${dateKey} ${time}` };
}

function strictBoolean(value, field) {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  const normalized = normalizeText(value).toLowerCase();
  if (["true", "ya", "1"].includes(normalized)) return true;
  if (["false", "tidak", "0"].includes(normalized)) return false;
  throw new Error(`${field} mesti boolean true atau false.`);
}

function normalizeText(value) {
  return String(value === undefined || value === null ? "" : value).trim();
}

const DAY_NAMES = ["AHAD", "ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT", "SABTU"];

function normalizeAllowedDays(value, required = true) {
  const days = normalizeText(value).split(",").map((day) => day.trim().toUpperCase()).filter(Boolean);
  if (required && !days.length) throw new Error("allowed_days mesti mengandungi sekurang-kurangnya satu hari.");
  for (const day of days) {
    if (!DAY_NAMES.includes(day)) throw new Error(`allowed_days mengandungi hari yang tidak sah: ${day}`);
  }
  return [...new Set(days)].join(",");
}

function normalizeOptionalTime(value, field) {
  const text = normalizeText(value);
  if (text && !/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error(`${field} mesti menggunakan format HH:mm atau dikosongkan.`);
  }
  return text;
}

function normalizeOptionalDate(value, field) {
  const text = normalizeText(value);
  if (!text) return "";
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) throw new Error(`${field} mesti menggunakan format YYYY-MM-DD atau dikosongkan.`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() + 1 !== month || parsed.getUTCDate() !== day) {
    throw new Error(`${field} tidak sah.`);
  }
  return text;
}

function validateOutingType(row, requestedType) {
  try {
    const typeCode = normalizeText(row.type_code).toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(typeCode) || typeCode !== requestedType) throw new Error("type_code");
    const displayName = normalizeText(row.display_name);
    const description = normalizeText(row.description);
    if (!displayName || displayName.length > 100 || description.length > 500) throw new Error("text");
    const sortOrder = Number(row.sort_order);
    const configVersion = Number(row.config_version);
    if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 9999) throw new Error("sort_order");
    if (!Number.isInteger(configVersion) || configVersion < 1) throw new Error("config_version");

    const config = { ...row, type_code: typeCode, display_name: displayName, description,
      sort_order: sortOrder, config_version: configVersion };
    config.allowed_days = normalizeAllowedDays(row.allowed_days);
    config.departure_allowed_days = normalizeAllowedDays(row.departure_allowed_days, false);
    for (const field of ["application_open_time", "application_close_time", "fixed_return_time", "earliest_departure_time"]) {
      config[field] = normalizeOptionalTime(row[field], field);
    }
    for (const field of ["application_open_date", "application_close_date"]) {
      config[field] = normalizeOptionalDate(row[field], field);
    }
    if (config.application_open_date && config.application_close_date &&
        config.application_close_date < config.application_open_date) throw new Error("date range");
    for (const field of BOOLEAN_CONFIG_FIELDS) config[field] = strictBoolean(row[field], field);
    return config;
  } catch {
    throw fault(400, "INVALID_OUTING_CONFIG", "Konfigurasi jenis outing tidak sah. Sila hubungi pentadbir.");
  }
}

function normalizeSubmissionDate(value, label, required) {
  const text = normalizeText(value);
  if (!text) {
    if (required) throw fault(400, "INVALID_REQUEST", `${label} diperlukan.`);
    return "";
  }
  try {
    return normalizeOptionalDate(text, label);
  } catch {
    throw fault(400, "INVALID_REQUEST", `${label} tidak sah.`);
  }
}

function normalizeSubmissionTime(value, label, required) {
  const text = normalizeText(value);
  if (!text) {
    if (required) throw fault(400, "INVALID_REQUEST", `${label} diperlukan.`);
    return "";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw fault(400, "INVALID_REQUEST", `${label} tidak sah.`);
  }
  return text;
}

function formatMalayDate(dateKey) {
  const months = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  const [year, month, day] = dateKey.split("-");
  return `${Number(day)} ${months[Number(month) - 1]} ${year}`;
}

function formatMalayDays(days) {
  const labels = { AHAD: "Ahad", ISNIN: "Isnin", SELASA: "Selasa", RABU: "Rabu", KHAMIS: "Khamis", JUMAAT: "Jumaat", SABTU: "Sabtu" };
  const values = [...new Set(days.map((day) => labels[day]).filter(Boolean))];
  if (values.length <= 1) return values[0] || "yang dikonfigurasi";
  if (values.length === 2) return `${values[0]} atau ${values[1]}`;
  return `${values.slice(0, -1).join(", ")} atau ${values.at(-1)}`;
}

function withinApplicationWindow(current, open, close) {
  if (open && close) return open <= close ? current >= open && current <= close : current >= open || current <= close;
  if (open) return current >= open;
  if (close) return current <= close;
  return true;
}

function requiredText(payload, keys, label, required) {
  const value = keys.reduce((found, key) => found || normalizeText(payload[key]), "");
  if (required && !value) throw fault(400, "INVALID_REQUEST", `${label} diperlukan.`);
  return value;
}

function validateSubmission(payload, config, parts) {
  const submission = { ...payload };
  const leaveDate = normalizeSubmissionDate(payload.tarikh, "Tarikh keluar", config.require_leave_date);
  let returnDate = normalizeSubmissionDate(payload.tarikh_balik, "Tarikh pulang ke asrama", config.require_return_date);
  const effectiveLeaveDate = leaveDate || parts.dateKey;

  if (config.application_open_date && parts.dateKey < config.application_open_date) {
    throw fault(400, "APPLICATION_NOT_OPEN", `Permohonan dibuka mulai ${formatMalayDate(config.application_open_date)}.`);
  }
  if (config.application_close_date && parts.dateKey > config.application_close_date) {
    throw fault(400, "APPLICATION_CLOSED", `Tempoh permohonan telah ditutup pada ${formatMalayDate(config.application_close_date)}.`);
  }
  if (returnDate && returnDate < effectiveLeaveDate) {
    throw fault(400, "INVALID_REQUEST", "Tarikh pulang ke asrama tidak boleh lebih awal daripada tarikh keluar.");
  }
  if (config.same_day_only) {
    returnDate ||= effectiveLeaveDate;
    if (returnDate !== effectiveLeaveDate) {
      throw fault(400, "INVALID_REQUEST", "Jenis outing ini mesti keluar dan pulang pada hari yang sama.");
    }
  }
  if (!config.allowed_days.split(",").includes(parts.day)) {
    throw fault(400, "APPLICATION_DAY_NOT_ALLOWED", "Permohonan jenis outing ini tidak dibenarkan pada hari ini.");
  }
  const departureDays = config.departure_allowed_days ? config.departure_allowed_days.split(",") : [];
  if (departureDays.length) {
    if (!leaveDate) {
      throw fault(400, "INVALID_REQUEST", "Tarikh keluar diperlukan untuk peraturan keluar jenis outing ini.");
    }
    if (!departureDays.includes(dayNameForDate(leaveDate))) {
      throw fault(400, "DEPARTURE_DAY_NOT_ALLOWED", `${config.display_name} hanya dibenarkan keluar pada hari ${formatMalayDays(departureDays)}.`);
    }
  }
  if (!withinApplicationWindow(parts.time.slice(0, 5), config.application_open_time, config.application_close_time)) {
    throw fault(400, "APPLICATION_TIME_CLOSED", "Permohonan jenis outing ini belum dibuka atau telah ditutup.");
  }

  submission.masa_balik_dijangka = config.fixed_return_time || normalizeSubmissionTime(
    payload.masa_balik_dijangka, "Masa dijangka pulang ke asrama", config.require_return_time
  );
  submission.telefon_waris = requiredText(payload, ["telefon_waris"], "Telefon waris", config.require_guardian_phone);
  submission.hubungan_waris = requiredText(payload, ["hubungan_waris"], "Hubungan waris", config.require_guardian_relation);
  submission.sebab_kecemasan = requiredText(payload, ["sebab_kecemasan"], "Sebab kecemasan", config.require_emergency_reason);
  submission.tujuan = requiredText(payload, ["tujuan", "purpose"], "Tujuan", config.require_purpose);
  submission.lokasi = requiredText(payload, ["lokasi", "location"], "Lokasi", config.require_location);
  submission.jenis_kenderaan = requiredText(payload, ["jenis_kenderaan", "vehicle_type"], "Jenis kenderaan", config.require_vehicle);
  submission.tarikh = effectiveLeaveDate;
  submission.tarikh_balik = returnDate;
  return submission;
}

function isActiveDuplicateError(error) {
  const message = normalizeText(error && error.message).toLowerCase();
  return message.includes("unique constraint") &&
    (message.includes("outing_requests.student_id") || message.includes("outing_requests.no_matrik") ||
     message.includes("uq_active_request_student") || message.includes("uq_active_request_matric"));
}

function activeDuplicateFault() {
  return fault(409, "ACTIVE_REQUEST_EXISTS", "Anda masih mempunyai permohonan aktif. Sila selesaikan permohonan sedia ada dahulu.");
}

function dayNameForDate(dateKey) {
  return new Intl.DateTimeFormat("ms-MY", {
    timeZone: "Asia/Kuala_Lumpur", weekday: "long"
  }).format(new Date(`${dateKey}T12:00:00+08:00`)).toUpperCase();
}

function randomFourDigits() {
  const bytes = new Uint16Array(1);
  crypto.getRandomValues(bytes);
  return String(1000 + (bytes[0] % 9000));
}

function buildRequestId(parts) {
  return `OUT-${parts.dateKey.replaceAll("-", "")}-${parts.time.replaceAll(":", "")}-${randomFourDigits()}`;
}

function telegramDate(value) {
  const match = normalizeText(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : normalizeText(value) || "-";
}

function telegramTime(value) {
  const match = normalizeText(value).match(/^([01]\d|2[0-3]):([0-5]\d)/);
  return match ? `${match[1]}:${match[2]}` : "-";
}

function buildTelegramMessage(record, displayName) {
  const titles = {
    OUTING_HUJUNG_MINGGU: "📅 Permohonan Outing Sabtu / Ahad Baru",
    KECEMASAN: "🚨 Permohonan Kecemasan Baru",
    PULANG_BERMALAM: "🏠 Permohonan Pulang Bermalam Baru",
    CUTI_SEMESTER: "🏫 Permohonan CUTI SEMESTER Baru"
  };
  const lines = [
    titles[record.jenis_permohonan] || "📌 Permohonan Outing Baru", "",
    `ID: ${record.request_id}`, `Nama: ${record.nama || "-"}`,
    `No. Matrik: ${record.no_matrik || "-"}`, `Kelas: ${record.kelas || "-"}`,
    `Jenis: ${displayName || record.jenis_permohonan || "-"}`,
    `Status: ${record.status || "-"}`, `Tujuan: ${record.tujuan || "-"}`,
    `Lokasi: ${record.lokasi || "-"}`, `Kenderaan: ${record.jenis_kenderaan || "-"}`
  ];
  if (record.butiran_kenderaan) lines.push(`Butiran: ${record.butiran_kenderaan}`);
  if (record.jenis_permohonan === "KECEMASAN") {
    lines.push(`Sebab Kecemasan: ${record.sebab_kecemasan || "-"}`,
      `Telefon Waris: ${record.telefon_waris || "-"}`,
      `Hubungan Waris: ${record.hubungan_waris || "-"}`);
  }
  if (["OUTING_HUJUNG_MINGGU", "PULANG_BERMALAM", "CUTI_SEMESTER"].includes(record.jenis_permohonan)) {
    if (record.jenis_permohonan === "CUTI_SEMESTER") lines.push(`Tarikh Keluar: ${telegramDate(record.tarikh)}`);
    const returnDate = telegramDate(record.tarikh_balik);
    const returnTime = telegramTime(record.masa_balik_dijangka);
    lines.push(`Tarikh Pulang Ke Asrama: ${returnDate}`,
      `Masa Dijangka Pulang Ke Asrama: ${returnTime}`,
      `Pulang ke asrama dijangka: ${returnDate === "-" && returnTime === "-" ? "-" : `${returnDate} ${returnTime}`}`,
      `Telefon Waris: ${record.telefon_waris || "-"}`,
      `Hubungan Waris: ${record.hubungan_waris || "-"}`);
  }
  if (record.warden_approve_by) lines.push(`Warden: ${record.warden_approve_by}`);
  lines.push("", `Masa Mohon: ${record.masa_mohon || "-"}`,
    `Masa Approve/Tolak: ${record.masa_approve || "-"}`, "Masa Keluar: -", "Masa Masuk: -",
    "", "eOuting ITU: https://itumelaka.github.io/eouting/");
  return lines.join("\n");
}

async function sendTelegram(env, record, displayName, fetchImpl) {
  const enabled = ["1", "true", "yes", "ya", "enabled", "on"].includes(
    normalizeText(env.TELEGRAM_ENABLED).toLowerCase()
  );
  if (!enabled || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return false;
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.TELEGRAM_CHAT_ID,
        text: buildTelegramMessage(record, displayName),
        disable_web_page_preview: true
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

function auditStatement(env, values) {
  return env.DB.prepare(`INSERT INTO AUDIT_LOG (
    timestamp, action, request_id, user_role, user_name, details, entity_type, entity_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(...values);
}

async function handleSubmitRequest(request, env, headers, dependencies = {}) {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") throw fault(405, "METHOD_NOT_ALLOWED", "POST required");

  const payload = await request.json();
  const studentId = normalizeText(payload.student_id);
  const noMatrik = normalizeText(payload.no_matrik);
  const requestType = normalizeText(payload.jenis_permohonan).toUpperCase();
  if (!studentId || !noMatrik) throw fault(400, "INVALID_REQUEST", "student_id dan no_matrik diperlukan.");
  if (!requestType) throw fault(400, "INVALID_REQUEST", "Jenis permohonan tidak sah.");

  const student = await env.DB.prepare(`SELECT student_id, no_matrik, nama, email, kelas, status
    FROM STUDENTS WHERE UPPER(TRIM(student_id)) = UPPER(TRIM(?))
      AND UPPER(TRIM(no_matrik)) = UPPER(TRIM(?)) AND LOWER(TRIM(status)) = 'aktif' LIMIT 1`
  ).bind(studentId, noMatrik).first();
  if (!student) throw fault(401, "STUDENT_NOT_FOUND", "Pelajar tidak dijumpai atau tidak aktif.");

  const outingType = await env.DB.prepare(`SELECT * FROM OUTING_TYPES
    WHERE UPPER(TRIM(type_code)) = UPPER(TRIM(?)) LIMIT 1`
  ).bind(requestType).first();
  if (!outingType) throw fault(400, "OUTING_TYPE_NOT_AVAILABLE", "Jenis outing tidak tersedia.");
  let active;
  try {
    active = strictBoolean(outingType.active, "active");
  } catch {
    throw fault(400, "INVALID_OUTING_CONFIG", "Konfigurasi jenis outing tidak sah. Sila hubungi pentadbir.");
  }
  if (!active) {
    throw fault(400, "OUTING_TYPE_NOT_AVAILABLE", "Jenis outing tidak aktif dan tidak boleh dipohon.");
  }
  const config = validateOutingType(outingType, requestType);

  const now = (dependencies.now || (() => new Date()))();
  const parts = malaysiaParts(now);
  const submission = validateSubmission(payload, config, parts);
  const requiresWardenApproval = config.require_warden_approval;
  const requireSelfie = config.require_selfie;
  const status = requiresWardenApproval ? "MENUNGGU_KELULUSAN" : "DILULUSKAN_WARDEN";
  const requestId = buildRequestId(parts);
  const existing = await env.DB.prepare(`SELECT request_id FROM OUTING_REQUESTS
    WHERE status IN ('MENUNGGU_KELULUSAN','DILULUSKAN_WARDEN','KELUAR')
      AND (student_id = ? OR (TRIM(?) <> '' AND no_matrik = ?)) LIMIT 1`
  ).bind(student.student_id, student.no_matrik, student.no_matrik).first();
  if (existing) throw activeDuplicateFault();

  const leaveDate = submission.tarikh;
  const returnDate = submission.tarikh_balik;
  const record = {
    request_id: requestId, tarikh: leaveDate, hari: dayNameForDate(leaveDate),
    jenis_permohonan: requestType, student_id: student.student_id,
    no_matrik: student.no_matrik, nama: student.nama, student_email: student.email || "",
    kelas: student.kelas || "", tujuan: submission.tujuan, lokasi: submission.lokasi,
    jenis_kenderaan: submission.jenis_kenderaan,
    butiran_kenderaan: normalizeText(payload.butiran_kenderaan || payload.vehicle_detail),
    sebab_kecemasan: submission.sebab_kecemasan,
    telefon_waris: submission.telefon_waris,
    hubungan_waris: submission.hubungan_waris,
    catatan_kecemasan: normalizeText(payload.catatan_kecemasan),
    masa_mohon: parts.timestamp, status,
    warden_approve_by: requiresWardenApproval ? "" : "AUTO_CONFIG_V2",
    masa_approve: requiresWardenApproval ? "" : parts.timestamp,
    masa_keluar: "", guard_keluar_by: "", masa_masuk: "", guard_masuk_by: "",
    lewat: "", selfie_whatsapp: "", catatan: normalizeText(payload.catatan),
    tarikh_balik: returnDate, hari_balik: returnDate ? dayNameForDate(returnDate) : "",
    masa_balik_dijangka: submission.masa_balik_dijangka, selfie_status: requireSelfie ? "" : "TIDAK_DIPERLUKAN",
    selfie_file_id: "", selfie_url: "", masa_selfie: "", selfie_telegram_message_id: "",
    sebab_batal_pelajar: "", masa_batal_pelajar: "", dibatalkan_oleh: ""
  };

  const insert = env.DB.prepare(`INSERT INTO OUTING_REQUESTS (${REQUEST_COLUMNS.join(",")})
    VALUES (${REQUEST_COLUMNS.map(() => "?").join(",")})`
  ).bind(...REQUEST_COLUMNS.map((column) => record[column]));
  const details = JSON.stringify({
    student_name: student.nama || "", no_matrik: String(student.no_matrik || ""),
    jenis_permohonan: requestType, config_version: config.config_version,
    require_warden_approval: requiresWardenApproval, require_selfie: requireSelfie
  });
  const statements = [insert, auditStatement(env, [
    parts.timestamp, "SUBMIT_REQUEST", requestId, "Student", student.nama, details,
    "OUTING_REQUEST", requestId
  ])];
  if (!requiresWardenApproval) {
    statements.push(auditStatement(env, [
      parts.timestamp, "AUTO_APPROVE_REQUEST", requestId, "System", "AUTO_CONFIG_V2",
      JSON.stringify({
        student_name: student.nama || "", no_matrik: String(student.no_matrik || ""),
        jenis_permohonan: requestType, config_version: config.config_version,
        reason: "require_warden_approval=false"
      }), "OUTING_REQUEST", requestId
    ]));
  }
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (isActiveDuplicateError(error)) throw activeDuplicateFault();
    throw error;
  }

  await sendTelegram(env, record, config.display_name, dependencies.fetchImpl || fetch);

const mirrorTask = mirrorOutingRequestToSheets(
  env,
  record,
  dependencies.fetchImpl || fetch
).catch(async (mirrorError) => {
  console.error(JSON.stringify({
    action: "submitRequest",
    request_id: requestId,
    event: "OUTING_REQUEST_SHEETS_MIRROR_FAILED",
    error: String(mirrorError && mirrorError.message || mirrorError)
  }));

  try {
    await enqueueMirrorRetry(
      env,
      requestId,
      mirrorError,
      { now: dependencies.now }
    );
  } catch (queueError) {
    console.error(JSON.stringify({
      action: "submitRequest",
      request_id: requestId,
      event: "OUTING_REQUEST_MIRROR_RETRY_QUEUE_FAILED",
      error: String(queueError && queueError.message || queueError)
    }));
  }
});

if (dependencies.context && typeof dependencies.context.waitUntil === "function") {
  dependencies.context.waitUntil(mirrorTask);
} else {
  await mirrorTask;
}

const responseData = {
  ok: true,
  data: record
};

return new Response(JSON.stringify(responseData), {
  status: 201,
  headers
});
}

async function mirrorOutingTypeToD1(env, row) {
  if (!env.DB || !row || typeof row !== "object") {
    throw new Error("D1 outing type mirror unavailable");
  }

  const typeCode = normalizeText(row.type_code).toUpperCase();
  const config = validateOutingType(row, typeCode);
  const bool = (field) => config[field] ? 1 : 0;

  await env.DB.prepare(`
    INSERT INTO OUTING_TYPES (
      type_code, display_name, description, active, sort_order,
      allowed_days, application_open_time, application_close_time,
      fixed_return_time, same_day_only, require_leave_date,
      require_return_date, require_return_time, require_guardian_phone,
      require_guardian_relation, require_emergency_reason,
      require_purpose, require_location, require_vehicle,
      require_warden_approval, require_selfie, config_version,
      created_at, created_by, updated_at, updated_by,
      departure_allowed_days, earliest_departure_time,
      application_open_date, application_close_date
    )
    VALUES (
      ?,?,?,?,?,?,?,?,?,?,
      ?,?,?,?,?,?,?,?,?,?,
      ?,?,?,?,?,?,?,?,?,?
    )
    ON CONFLICT(type_code) DO UPDATE SET
      display_name = excluded.display_name,
      description = excluded.description,
      active = excluded.active,
      sort_order = excluded.sort_order,
      allowed_days = excluded.allowed_days,
      application_open_time = excluded.application_open_time,
      application_close_time = excluded.application_close_time,
      fixed_return_time = excluded.fixed_return_time,
      same_day_only = excluded.same_day_only,
      require_leave_date = excluded.require_leave_date,
      require_return_date = excluded.require_return_date,
      require_return_time = excluded.require_return_time,
      require_guardian_phone = excluded.require_guardian_phone,
      require_guardian_relation = excluded.require_guardian_relation,
      require_emergency_reason = excluded.require_emergency_reason,
      require_purpose = excluded.require_purpose,
      require_location = excluded.require_location,
      require_vehicle = excluded.require_vehicle,
      require_warden_approval = excluded.require_warden_approval,
      require_selfie = excluded.require_selfie,
      config_version = excluded.config_version,
      created_at = excluded.created_at,
      created_by = excluded.created_by,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by,
      departure_allowed_days = excluded.departure_allowed_days,
      earliest_departure_time = excluded.earliest_departure_time,
      application_open_date = excluded.application_open_date,
      application_close_date = excluded.application_close_date
  `).bind(
    config.type_code,
    config.display_name,
    config.description,
    bool("active"),
    config.sort_order,
    config.allowed_days,
    config.application_open_time,
    config.application_close_time,
    config.fixed_return_time,
    bool("same_day_only"),
    bool("require_leave_date"),
    bool("require_return_date"),
    bool("require_return_time"),
    bool("require_guardian_phone"),
    bool("require_guardian_relation"),
    bool("require_emergency_reason"),
    bool("require_purpose"),
    bool("require_location"),
    bool("require_vehicle"),
    bool("require_warden_approval"),
    bool("require_selfie"),
    config.config_version,
    normalizeText(row.created_at),
    normalizeText(row.created_by),
    normalizeText(row.updated_at),
    normalizeText(row.updated_by),
    config.departure_allowed_days,
    config.earliest_departure_time,
    config.application_open_date,
    config.application_close_date
  ).run();
}

return { handleSubmitRequest, mirrorOutingTypeToD1, validateOutingType };

})();

async function readNoGuardDepartureEnabled(env) {
  const config = await env.DB.prepare(
    `SELECT config_value
     FROM SYSTEM_CONFIG
     WHERE config_key = ?
     LIMIT 1`
  ).bind("NO_GUARD_DEPARTURE_ENABLED").first();

  const rawValue = config
    ? String(config.config_value || "").trim().toLowerCase()
    : String(env.NO_GUARD_DEPARTURE_ENABLED || "").trim().toLowerCase();

  return [
    "1",
    "true",
    "yes",
    "ya",
    "enabled",
    "on"
  ].includes(rawValue);
}
async function handleD1DepartureConfirmationRequest(request, env, headers, options = {}) {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    throw fault(400, "INVALID_REQUEST", "Invalid JSON request");
  }

  const requestId = String(payload?.request_id || "").trim();
  const studentId = String(payload?.student_id || payload?.id || "").trim();
  const noMatrik = String(payload?.no_matrik || payload?.matric || "").trim();

  if (!requestId || !studentId || !noMatrik) {
    throw fault(
      400,
      "INVALID_REQUEST",
      "request_id, student_id dan no_matrik diperlukan."
    );
  }

  const featureEnabled =
    await readNoGuardDepartureEnabled(env);

  if (!featureEnabled) {
    throw fault(
      403,
      "NO_GUARD_DEPARTURE_DISABLED",
      "Fallback pengesahan keluar tanpa Guard dinyahaktifkan oleh Admin."
    );
  }

  const students = await env.DB.prepare(
    `SELECT student_id, no_matrik, nama, status
     FROM STUDENTS
     WHERE student_id = ? COLLATE NOCASE
     LIMIT 1`
  ).bind(studentId).all();

  const student = (students.results || []).find((row) =>
    String(row.student_id || "").trim().toLowerCase() === studentId.toLowerCase() &&
    String(row.no_matrik || "").trim().toLowerCase() === noMatrik.toLowerCase() &&
    String(row.status || "").trim().toLowerCase() === "aktif"
  );

  if (!student) {
    throw fault(
      401,
      "STUDENT_SESSION_INVALID",
      "Akses sesi pelajar tidak sah."
    );
  }

  const record = await env.DB.prepare(
    `SELECT *
     FROM OUTING_REQUESTS
     WHERE request_id = ?
     LIMIT 1`
  ).bind(requestId).first();

  if (!record) {
    throw fault(
      404,
      "REQUEST_NOT_FOUND",
      "Permohonan tidak dijumpai."
    );
  }

  const ownsRequest =
    String(record.student_id || "").trim().toLowerCase() ===
      String(student.student_id || "").trim().toLowerCase() &&
    String(record.no_matrik || "").trim().toLowerCase() ===
      String(student.no_matrik || "").trim().toLowerCase();

  if (!ownsRequest) {
    throw fault(
      403,
      "REQUEST_NOT_OWNED",
      "Anda tidak dibenarkan memohon pengesahan untuk pelajar lain."
    );
  }

  if (String(record.status || "").trim() !== "DILULUSKAN_WARDEN") {
    throw fault(
      409,
      "INVALID_REQUEST_STATUS",
      "Hanya permohonan yang telah diluluskan Warden boleh memohon pengesahan keluar."
    );
  }

  const auditRows = await env.DB.prepare(
    `SELECT timestamp, action
     FROM AUDIT_LOG
     WHERE request_id = ?
       AND action IN (
         'DEPARTURE_CONFIRMATION_REQUESTED',
         'WARDEN_REMOTE_CHECKOUT'
       )
     ORDER BY timestamp ASC`
  ).bind(requestId).all();

  const auditState = {
    requested: false,
    requested_at: "",
    completed: false
  };

  for (const audit of auditRows.results || []) {
    if (
      audit.action === "DEPARTURE_CONFIRMATION_REQUESTED" &&
      !auditState.requested
    ) {
      auditState.requested = true;
      auditState.requested_at = audit.timestamp || "";
    }

    if (audit.action === "WARDEN_REMOTE_CHECKOUT") {
      auditState.completed = true;
    }
  }

  if (auditState.completed) {
    throw fault(
      409,
      "DEPARTURE_CONFIRMATION_COMPLETED",
      "Pengesahan keluar Warden telah selesai."
    );
  }

  let inserted = false;

  if (!auditState.requested) {
    const requestedAt = mirrorRetryTimestamp(
      (options.now || (() => new Date()))()
    );

    const details = JSON.stringify({
      student_name: student.nama || "",
      no_matrik: student.no_matrik || "",
      jenis_permohonan: record.jenis_permohonan || "",
      mode: "REMOTE_NO_GUARD"
    });

    const insertResult = await env.DB.prepare(
      `INSERT INTO AUDIT_LOG (
        timestamp,
        action,
        request_id,
        user_role,
        user_name,
        details,
        entity_type,
        entity_id
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1
        FROM AUDIT_LOG
        WHERE request_id = ?
          AND action IN (
            'DEPARTURE_CONFIRMATION_REQUESTED',
            'WARDEN_REMOTE_CHECKOUT'
          )
      )`
    ).bind(
      requestedAt,
      "DEPARTURE_CONFIRMATION_REQUESTED",
      requestId,
      "Student",
      student.nama || "",
      details,
      "OUTING_REQUEST",
      requestId,
      requestId
    ).run();

    inserted = Number(insertResult.meta?.changes || 0) === 1;

    if (inserted) {
      auditState.requested = true;
      auditState.requested_at = requestedAt;
    } else {
      const latestAudit = await env.DB.prepare(
        `SELECT timestamp, action
         FROM AUDIT_LOG
         WHERE request_id = ?
           AND action IN (
             'DEPARTURE_CONFIRMATION_REQUESTED',
             'WARDEN_REMOTE_CHECKOUT'
           )
         ORDER BY timestamp ASC`
      ).bind(requestId).all();

      auditState.requested = false;
      auditState.requested_at = "";
      auditState.completed = false;

      for (const audit of latestAudit.results || []) {
        if (
          audit.action === "DEPARTURE_CONFIRMATION_REQUESTED" &&
          !auditState.requested
        ) {
          auditState.requested = true;
          auditState.requested_at = audit.timestamp || "";
        }

        if (audit.action === "WARDEN_REMOTE_CHECKOUT") {
          auditState.completed = true;
        }
      }

      if (auditState.completed) {
        throw fault(
          409,
          "DEPARTURE_CONFIRMATION_COMPLETED",
          "Pengesahan keluar Warden telah selesai."
        );
      }
    }
  }

  const telegramEnabled = ["1", "true", "yes", "ya", "enabled", "on"].includes(
    String(env.TELEGRAM_ENABLED || "").trim().toLowerCase()
  );

  if (
    inserted &&
    telegramEnabled &&
    env.TELEGRAM_BOT_TOKEN &&
    env.TELEGRAM_CHAT_ID
  ) {
    try {
      const typeLabels = {
        OUTING_BIASA: "Outing Biasa",
        OUTING_HUJUNG_MINGGU: "Outing Sabtu / Ahad",
        KECEMASAN: "Kecemasan",
        PULANG_BERMALAM: "Pulang Bermalam",
        CUTI_SEMESTER: "CUTI SEMESTER"
      };

      const typeCode = String(record.jenis_permohonan || "").trim();
      const typeLabel = typeLabels[typeCode] || typeCode || "-";

      const requestedDate = new Date(
        String(auditState.requested_at || "").replace(
          /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/,
          "$1T$2+08:00"
        )
      );

      const requestedDisplay = Number.isNaN(requestedDate.getTime())
        ? String(auditState.requested_at || "-")
        : new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kuala_Lumpur",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }).format(requestedDate).replace(",", "");

      const telegramMessage = [
        "🚪 PENGESAHAN KELUAR TANPA GUARD",
        "",
        `Pelajar: ${record.nama || "-"}`,
        `Jenis: ${typeLabel}`,
        `Lokasi: ${record.lokasi || "-"}`,
        `Masa Mohon: ${requestedDisplay}`,
        "",
        "Pelajar sedang menunggu pengesahan keluar oleh Warden.",
        "",
        "🔗 Buka eOuting Warden/HEP:",
        "https://itumelaka.github.io/eouting/"
      ].join("\n");

      await (options.fetchImpl || fetch)(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: telegramMessage,
            disable_web_page_preview: true
          })
        }
      );
    } catch (telegramError) {
      console.warn("DEPARTURE_CONFIRMATION_REQUESTED Telegram notification failed.");
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    data: {
      ...record,
      departure_confirmation_pending: true,
      departure_confirmation_requested_at: auditState.requested_at,
      no_guard_departure_enabled: true,
      departure_confirmation_created: inserted
    }
  }), {
    status: 200,
    headers
  });
}
async function handleD1WardenRemoteCheckout(request, env, headers, options = {}) {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    throw fault(400, "INVALID_REQUEST", "Invalid JSON request");
  }

  const requestId = String(payload?.request_id || "").trim();
  const wardenName = String(
    payload?.warden_name ||
    payload?.nama_warden ||
    payload?.user_name ||
    ""
  ).trim();
  const pin = String(
    payload?.pin === undefined || payload?.pin === null
      ? ""
      : payload.pin
  ).trim();

  if (!requestId || !wardenName || !pin) {
    throw fault(
      400,
      "INVALID_REQUEST",
      "request_id, nama warden dan PIN diperlukan."
    );
  }

  const wardenDirectory = await env.DB.prepare(
    `SELECT warden_id, nama, status, pin
     FROM WARDENS`
  ).all();

  const warden = (wardenDirectory.results || []).find((row) =>
    String(row.nama || "").trim().toLowerCase() === wardenName.toLowerCase() &&
    String(row.status || "").trim().toLowerCase() === "aktif" &&
    String(row.pin === undefined || row.pin === null ? "" : row.pin).trim() === pin
  );

  if (!warden) {
    throw fault(
      401,
      "WARDEN_LOGIN_INVALID",
      "Warden tidak dijumpai atau tidak aktif."
    );
  }

  if (!(await readNoGuardDepartureEnabled(env))) {
    throw fault(
      403,
      "NO_GUARD_DEPARTURE_DISABLED",
      "Fallback pengesahan keluar tanpa Guard dinyahaktifkan oleh Admin."
    );
  }

  const wardenRole = /^HEP-/i.test(
    String(warden.warden_id || "").trim()
  ) ? "HEP" : "WARDEN";

  const readRecord = () => env.DB.prepare(
    `SELECT *
     FROM OUTING_REQUESTS
     WHERE request_id = ?
     LIMIT 1`
  ).bind(requestId).first();

  const readAuditState = async () => {
    const result = await env.DB.prepare(
      `SELECT timestamp, action
       FROM AUDIT_LOG
       WHERE request_id = ?
         AND action IN (
           'DEPARTURE_CONFIRMATION_REQUESTED',
           'WARDEN_REMOTE_CHECKOUT'
         )
       ORDER BY timestamp ASC`
    ).bind(requestId).all();

    const state = {
      requested: false,
      requested_at: "",
      completed: false
    };

    for (const audit of result.results || []) {
      if (
        audit.action === "DEPARTURE_CONFIRMATION_REQUESTED" &&
        !state.requested
      ) {
        state.requested = true;
        state.requested_at = audit.timestamp || "";
      }

      if (audit.action === "WARDEN_REMOTE_CHECKOUT") {
        state.completed = true;
      }
    }

    return state;
  };

  const record = await readRecord();

  if (!record) {
    throw fault(
      404,
      "REQUEST_NOT_FOUND",
      "Permohonan tidak dijumpai."
    );
  }

  const auditState = await readAuditState();

  if (
    auditState.completed &&
    String(record.status || "").trim() === "KELUAR"
  ) {
    return new Response(JSON.stringify({
      ok: true,
      data: {
        ...record,
        message: "Rekod sudah disahkan keluar oleh Warden."
      }
    }), {
      status: 200,
      headers
    });
  }

  if (String(record.status || "").trim() !== "DILULUSKAN_WARDEN") {
    throw fault(
      409,
      "INVALID_REQUEST_STATUS",
      "Permohonan ini sudah tidak menunggu pengesahan keluar Warden."
    );
  }

  if (!auditState.requested || auditState.completed) {
    throw fault(
      409,
      "DEPARTURE_CONFIRMATION_NOT_PENDING",
      "Tiada permohonan pengesahan keluar yang belum selesai."
    );
  }

  const checkoutAt = mirrorRetryTimestamp(
    (options.now || (() => new Date()))()
  );

  const updateResult = await env.DB.prepare(
    `UPDATE OUTING_REQUESTS
     SET status = 'KELUAR',
         masa_keluar = ?
     WHERE request_id = ?
       AND status = 'DILULUSKAN_WARDEN'
       AND (masa_keluar IS NULL OR TRIM(masa_keluar) = '')`
  ).bind(
    checkoutAt,
    requestId
  ).run();

  if (
    !updateResult.meta ||
    Number(updateResult.meta.changes || 0) !== 1
  ) {
    const latestRecord = await readRecord();
    const latestAuditState = await readAuditState();

    if (
      latestRecord &&
      String(latestRecord.status || "").trim() === "KELUAR" &&
      latestAuditState.completed
    ) {
      return new Response(JSON.stringify({
        ok: true,
        data: {
          ...latestRecord,
          message: "Rekod sudah disahkan keluar oleh Warden."
        }
      }), {
        status: 200,
        headers
      });
    }

    throw fault(
      409,
      "WARDEN_REMOTE_CHECKOUT_CONFLICT",
      "Rekod berubah semasa pengesahan keluar. Sila refresh dan cuba semula."
    );
  }

  const details = JSON.stringify({
    student_name: record.nama || "",
    no_matrik: record.no_matrik || "",
    jenis_permohonan: record.jenis_permohonan || "",
    actor_role: wardenRole,
    mode: "REMOTE_NO_GUARD",
    masa_keluar: checkoutAt
  });

  await env.DB.prepare(
    `INSERT INTO AUDIT_LOG (
      timestamp,
      action,
      request_id,
      user_role,
      user_name,
      details,
      entity_type,
      entity_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    checkoutAt,
    "WARDEN_REMOTE_CHECKOUT",
    requestId,
    wardenRole === "HEP" ? "HEP" : "Warden",
    warden.nama,
    details,
    "OUTING_REQUEST",
    requestId
  ).run();

  const updatedRecord = {
    ...record,
    status: "KELUAR",
    masa_keluar: checkoutAt
  };

  const telegramEnabled = ["1", "true", "yes", "ya", "enabled", "on"].includes(
    String(env.TELEGRAM_ENABLED || "").trim().toLowerCase()
  );

  if (
    telegramEnabled &&
    env.TELEGRAM_BOT_TOKEN &&
    env.TELEGRAM_CHAT_ID
  ) {
    try {
      const typeLabels = {
        OUTING_BIASA: "Outing Biasa",
        OUTING_HUJUNG_MINGGU: "Outing Sabtu / Ahad",
        KECEMASAN: "Kecemasan",
        PULANG_BERMALAM: "Pulang Bermalam",
        CUTI_SEMESTER: "CUTI SEMESTER"
      };

      const typeCode = String(updatedRecord.jenis_permohonan || "").trim();
      const typeLabel = typeLabels[typeCode] || typeCode || "-";

      const checkoutDate = new Date(
        String(updatedRecord.masa_keluar || "").replace(
          /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/,
          "$1T$2+08:00"
        )
      );

      const checkoutDisplay = Number.isNaN(checkoutDate.getTime())
        ? String(updatedRecord.masa_keluar || "-")
        : new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Kuala_Lumpur",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false
          }).format(checkoutDate).replace(",", "");

      const telegramMessage = [
        "✅ PENGESAHAN KELUAR OLEH WARDEN",
        "",
        `Pelajar: ${updatedRecord.nama || "-"}`,
        `Jenis: ${typeLabel}`,
        `Lokasi: ${updatedRecord.lokasi || "-"}`,
        `Disahkan Oleh: ${warden.nama || "-"}`,
        `Masa Keluar: ${checkoutDisplay}`,
        "",
        "Status pelajar kini: KELUAR",
        "",
        "🔗 Buka eOuting Warden/HEP:",
        "https://itumelaka.github.io/eouting/"
      ].join("\n");

      await (options.fetchImpl || fetch)(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: telegramMessage,
            disable_web_page_preview: true
          })
        }
      );
    } catch (telegramError) {
      console.warn("WARDEN_REMOTE_CHECKOUT Telegram notification failed.");
    }
  }

  const mirrorTask = mirrorOutingRequestToSheets(
    env,
    updatedRecord,
    options.fetchImpl || fetch
  ).catch(async (mirrorError) => {
    console.error(JSON.stringify({
      action: "confirmWardenRemoteCheckout",
      request_id: requestId,
      event: "OUTING_REQUEST_SHEETS_MIRROR_FAILED",
      error: String(mirrorError && mirrorError.message || mirrorError)
    }));

    try {
      await enqueueMirrorRetry(
        env,
        requestId,
        mirrorError,
        { now: options.now }
      );
    } catch (queueError) {
      console.error(JSON.stringify({
        action: "confirmWardenRemoteCheckout",
        request_id: requestId,
        event: "OUTING_REQUEST_MIRROR_RETRY_QUEUE_FAILED",
        error: String(queueError && queueError.message || queueError)
      }));
    }
  });

  if (options.context && typeof options.context.waitUntil === "function") {
    options.context.waitUntil(mirrorTask);
  } else {
    await mirrorTask;
  }

  return new Response(JSON.stringify({
    ok: true,
    data: updatedRecord
  }), {
    status: 200,
    headers
  });
}
async function handleRequest(request, env = {}, context = {}) {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const origin = request.headers.get("Origin");
  const localOrigin = env.STAGING_ORIGIN;
  const allowedOrigin = origin === "https://itumelaka.github.io" || ["http://localhost:8000", "http://127.0.0.1:8000"].includes(localOrigin) && origin === localOrigin;
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff",
    "X-Request-ID": requestId
  });
  if (allowedOrigin) headers.set("Access-Control-Allow-Origin", origin);
  let action = "";
  let sent = false;
  let attempts = 0;
  let finalStatus = 500;
  let timer;
  const finish = /* @__PURE__ */ __name((body, status) => {
    finalStatus = status;
    headers.set("X-Upstream-Attempts", String(attempts));
    return new Response(body, { status, headers });
  }, "finish");
  try {
  const url = new URL(request.url);

  if (!allowedOrigin) {
    throw fault(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed");
  }

  if (url.pathname === "/api/d1/wardens") {
    const result = await env.DB.prepare(
      "SELECT warden_id, nama, nama AS nama_warden, status FROM WARDENS ORDER BY nama"
    ).all();

    return new Response(JSON.stringify({
      ok: true,
      data: result.results
    }), {
      status: 200,
      headers
    });
  }

  if (url.pathname === "/api/d1/guards") {
  const result = await env.DB.prepare(
    "SELECT guard_id, nama, nama AS nama_guard, status FROM GUARDS WHERE status = 'Aktif' ORDER BY nama"
  ).all();

  return new Response(JSON.stringify({
    ok: true,
    data: result.results
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/studentLoginDirectory") {
  const [groupResult, institutionResult, studentResult] = await Promise.all([
    env.DB.prepare(
      `SELECT group_code, display_name, institution_required
       FROM STUDENT_GROUPS
       WHERE active = 1
       ORDER BY sort_order, group_code`
    ).all(),
    env.DB.prepare(
      `SELECT institution_code, display_name
       FROM LI_INSTITUTIONS
       WHERE active = 1
       ORDER BY sort_order, institution_code`
    ).all(),
    env.DB.prepare(
      `SELECT student_id, nama, kelas, institution_code
       FROM STUDENTS
       WHERE status = 'Aktif'`
    ).all()
  ]);

  const groupRows = groupResult.results || [];
  const institutionRows = institutionResult.results || [];
  const students = studentResult.results || [];
  const groups = [];

  const sortStudents = (items) => items
    .filter((student) => student.student_id && student.nama)
    .sort((left, right) => {
      const nameDifference = String(left.nama).localeCompare(String(right.nama));
      return nameDifference !== 0
        ? nameDifference
        : String(left.student_id).localeCompare(String(right.student_id));
    })
    .map((student) => ({
      student_id: String(student.student_id || "").trim(),
      nama: String(student.nama || "").trim()
    }));

  for (const group of groupRows) {
    const groupCode = String(group.group_code || "").trim().toUpperCase();
    const groupStudents = students.filter(
      (student) => String(student.kelas || "").trim().toUpperCase() === groupCode
    );

    if (Number(group.institution_required || 0) !== 1) {
      if (groupStudents.length) {
        groups.push({
          key: `GROUP:${groupCode}`,
          label: String(group.display_name || "").trim(),
          students: sortStudents(groupStudents)
        });
      }
      continue;
    }

    for (const institution of institutionRows) {
      const institutionCode = String(institution.institution_code || "")
        .trim()
        .toUpperCase();

      const institutionStudents = groupStudents.filter(
        (student) =>
          String(student.institution_code || "").trim().toUpperCase() === institutionCode
      );

      if (!institutionStudents.length) continue;

      groups.push({
        key: `GROUP:${groupCode}:${institutionCode}`,
        label: `${String(group.display_name || "").trim()} ${String(
          institution.display_name || ""
        ).trim()}`.trim(),
        students: sortStudents(institutionStudents)
      });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    data: {
      mode: "dynamic",
      groups
    }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/outingTypes") {
  const result = await env.DB.prepare(
    `SELECT
      type_code,
      display_name,
      description,
      active,
      sort_order,
      allowed_days,
      application_open_time,
      application_close_time,
      fixed_return_time,
      same_day_only,
      require_leave_date,
      require_return_date,
      require_return_time,
      require_guardian_phone,
      require_guardian_relation,
      require_emergency_reason,
      require_purpose,
      require_location,
      require_vehicle,
      require_warden_approval,
      require_selfie,
      config_version,
      departure_allowed_days,
      earliest_departure_time,
      application_open_date,
      application_close_date
     FROM OUTING_TYPES
     WHERE active = 1
     ORDER BY sort_order, display_name`
  ).all();

  return new Response(JSON.stringify({
    ok: true,
    data: result.results || []
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/loginStudent") {

  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const studentId = String(payload.student_id || "").trim();
  const noMatrik = String(payload.no_matrik || "").trim();

  const row = await env.DB.prepare(
    `SELECT student_id, no_matrik, nama, email, no_tel, kelas,
            jantina, status, photo_file_id, photo_updated_at
     FROM STUDENTS
     WHERE student_id = ?
       AND no_matrik = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(studentId, noMatrik).first();

  if (!row) {
    return new Response(JSON.stringify({
      ok: false,
      error: "STUDENT_LOGIN_INVALID"
    }), {
      status: 401,
      headers
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    data: {
      ...row,
      has_profile_photo: Boolean(row.photo_file_id)
    }
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/submitRequest" || url.pathname === "/api/d1/submitOutingRequest") {
  return await stagingSubmitRequestV230.handleSubmitRequest(request, env, headers, { context });
}

if (url.pathname === "/api/d1/requestDepartureConfirmation") {
  return await handleD1DepartureConfirmationRequest(
    request,
    env,
    headers,
    { context }
  );
}
if (url.pathname === "/api/d1/confirmWardenRemoteCheckout") {
  return await handleD1WardenRemoteCheckout(
    request,
    env,
    headers,
    { context }
  );
}
if (url.pathname === "/api/d1/wardenPendingRequests") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "GET") {
    throw fault(405, "METHOD_NOT_ALLOWED", "GET required");
  }

  const result = await env.DB.prepare(
    `SELECT
      request_id,
      tarikh,
      hari,
      jenis_permohonan,
      student_id,
      no_matrik,
      nama,
      student_email,
      kelas,
      tujuan,
      lokasi,
      jenis_kenderaan,
      butiran_kenderaan,
      sebab_kecemasan,
      telefon_waris,
      hubungan_waris,
      catatan_kecemasan,
      masa_mohon,
      status,
      tarikh_balik,
      hari_balik,
      masa_balik_dijangka,
      catatan
     FROM OUTING_REQUESTS
     WHERE status = 'MENUNGGU_KELULUSAN'
     ORDER BY masa_mohon ASC`
  ).all();

  return new Response(JSON.stringify({
    ok: true,
    data: result.results || []
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/approveRequest" || url.pathname === "/api/d1/rejectRequest") {
  return await stagingWardenDecisions.handleWardenDecision(
  request,
  env,
  headers,
  url.pathname.endsWith("/approveRequest") ? "approveRequest" : "rejectRequest",
  { context }
);
}

if (url.pathname === "/api/d1/loginWarden") {
  if (request.method === "OPTIONS") {
  headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");

  return new Response(null, {
    status: 204,
    headers
  });
}
  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

const wardenId = String(payload.warden_id || "").trim();
const wardenName = String(payload.nama_warden || "").trim();
const pin = String(payload.pin || "").trim();

const row = await env.DB.prepare(
  `SELECT warden_id, nama, nama AS nama_warden, status
   FROM WARDENS
   WHERE (warden_id = ? OR nama = ?)
     AND pin = ?
     AND status = 'Aktif'
   LIMIT 1`
).bind(wardenId, wardenName, pin).first();

  if (!row) {
    return new Response(JSON.stringify({
      ok: false,
      error: "WARDEN_LOGIN_INVALID"
    }), {
      status: 401,
      headers
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    data: row
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/loginGuard") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

const guardId = String(payload.guard_id || "").trim();
const guardName = String(payload.nama_guard || "").trim();
const pin = String(payload.pin || "").trim();

const row = await env.DB.prepare(
  `SELECT guard_id, nama, nama AS nama_guard, status
   FROM GUARDS
   WHERE (guard_id = ? OR nama = ?)
     AND pin = ?
     AND status = 'Aktif'
   LIMIT 1`
).bind(guardId, guardName, pin).first();

  if (!row) {
    return new Response(JSON.stringify({
      ok: false,
      error: "GUARD_LOGIN_INVALID"
    }), {
      status: 401,
      headers
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    data: row
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/loginAdmin") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  if ((!adminId && !adminName) || !pin) {
    throw fault(
      400,
      "ADMIN_LOGIN_REQUIRED",
      "ID atau nama Admin dan PIN diperlukan."
    );
  }

  const row = await env.DB.prepare(
    `SELECT admin_id,
            nama_admin,
            status,
            catatan,
            created_at,
            updated_at
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!row) {
    throw fault(
      401,
      "ADMIN_LOGIN_INVALID",
      "Admin tidak dijumpai, tidak aktif atau PIN tidak sah."
    );
  }

  return new Response(JSON.stringify({
    ok: true,
    data: row
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getNoGuardDepartureConfig") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const config = await env.DB.prepare(
    `SELECT config_value
     FROM SYSTEM_CONFIG
     WHERE config_key = ?
     LIMIT 1`
  ).bind("NO_GUARD_DEPARTURE_ENABLED").first();

  const rawValue = config
    ? String(config.config_value || "").trim().toLowerCase()
    : String(env.NO_GUARD_DEPARTURE_ENABLED || "").trim().toLowerCase();

  const enabled = ["1", "true", "yes", "ya", "enabled", "on"].includes(rawValue);

  return new Response(JSON.stringify({
    ok: true,
    data: { enabled }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getAdminStaff") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin || payload.admin_name || payload.name || ""
  ).trim();
  const pin = String(payload.pin || "").trim();
  const admin = await env.DB.prepare(
    `SELECT admin_id FROM ADMIN_USERS
     WHERE (LOWER(admin_id) = LOWER(?) OR LOWER(nama_admin) = LOWER(?))
       AND pin = ? AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();
  if (!admin) {
    throw fault(401, "ADMIN_SESSION_INVALID", "Akses sesi admin tidak sah");
  }

  const [wardenResult, guardResult] = await Promise.all([
    env.DB.prepare("SELECT * FROM WARDENS").all(),
    env.DB.prepare("SELECT * FROM GUARDS").all()
  ]);
  const toSafeStaff = (row, role, idField) => {
    const status = String(row.status === undefined || row.status === null ? "" : row.status)
      .trim().toUpperCase().replace(/_/g, " ");
    if (status && status !== "AKTIF" && status !== "TIDAK AKTIF") {
      throw new Error("status staff mesti Aktif atau Tidak Aktif.");
    }
    return {
      staff_id: String(row[idField] || "").trim(),
      nama: String(row.nama || "").trim(),
      role,
      status: status === "TIDAK AKTIF" ? "Tidak Aktif" : "Aktif",
      email: String(row.email || "").trim(),
      no_tel: String(row.no_tel || "").trim(),
      catatan: String(row.catatan || "").trim(),
      pin_configured: Boolean(String(row.pin ?? "").trim())
    };
  };
  const staff = [
    ...(wardenResult.results || []).map(row => toSafeStaff(row, "WARDEN", "warden_id")),
    ...(guardResult.results || []).map(row => toSafeStaff(row, "GUARD", "guard_id"))
  ].sort((left, right) =>
    left.role.localeCompare(right.role) ||
    left.nama.localeCompare(right.nama, "ms", { sensitivity: "base" })
  );
  return new Response(JSON.stringify({ ok: true, data: staff }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getAdminStudentGroups") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin || payload.admin_name || payload.name || ""
  ).trim();
  const pin = String(payload.pin || "").trim();
  const admin = await env.DB.prepare(
    `SELECT admin_id FROM ADMIN_USERS
     WHERE (LOWER(admin_id) = LOWER(?) OR LOWER(nama_admin) = LOWER(?))
       AND pin = ? AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();
  if (!admin) {
    throw fault(401, "ADMIN_SESSION_INVALID", "Akses sesi admin tidak sah");
  }

  const result = await env.DB.prepare(
    `SELECT group_code, display_name, institution_required, active, sort_order, config_version,
            created_at, created_by, updated_at, updated_by
     FROM STUDENT_GROUPS`
  ).all();
  const groups = (result.results || []).map(row => {
    const group_code = String(row.group_code ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(group_code)) {
      throw new Error("group_code mesti 2-32 aksara A-Z, 0-9 atau garis bawah dan bermula dengan huruf.");
    }
    const display_name = String(row.display_name ?? "").trim();
    if (!display_name || display_name.length > 100 || /[\u0000-\u001F\u007F]/.test(display_name)) {
      throw new Error("display_name mesti teks selamat antara 1 hingga 100 aksara.");
    }
    const institutionRequiredValue = String(
      row.institution_required === null || row.institution_required === undefined ? "" : row.institution_required
    ).trim().toLowerCase();
    if (!["true", "ya", "1", "false", "tidak", "0"].includes(institutionRequiredValue)) {
      throw new Error("institution_required mesti boolean true atau false.");
    }
    const activeValue = String(row.active === null || row.active === undefined ? "" : row.active)
      .trim().toLowerCase();
    if (!["true", "ya", "1", "false", "tidak", "0"].includes(activeValue)) {
      throw new Error("active mesti boolean true atau false.");
    }
    const sort_order = Number(row.sort_order);
    if (!Number.isInteger(sort_order) || sort_order < 1) {
      throw new Error("sort_order mesti nombor bulat positif.");
    }
    const config_version = Number(row.config_version);
    if (!Number.isInteger(config_version) || config_version < 1) {
      throw new Error("config_version mesti nombor bulat positif.");
    }
    return {
      group_code,
      display_name,
      institution_required: ["true", "ya", "1"].includes(institutionRequiredValue),
      active: ["true", "ya", "1"].includes(activeValue),
      sort_order,
      config_version,
      created_at: row.created_at || "",
      created_by: row.created_by || "",
      updated_at: row.updated_at || "",
      updated_by: row.updated_by || ""
    };
  }).sort((left, right) =>
    left.sort_order - right.sort_order ||
    left.display_name.localeCompare(right.display_name) ||
    left.group_code.localeCompare(right.group_code)
  );
  return new Response(JSON.stringify({ ok: true, data: groups }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getAdminLiInstitutions") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin || payload.admin_name || payload.name || ""
  ).trim();
  const pin = String(payload.pin || "").trim();
  const admin = await env.DB.prepare(
    `SELECT admin_id FROM ADMIN_USERS
     WHERE (LOWER(admin_id) = LOWER(?) OR LOWER(nama_admin) = LOWER(?))
       AND pin = ? AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();
  if (!admin) {
    throw fault(401, "ADMIN_SESSION_INVALID", "Akses sesi admin tidak sah");
  }

  const result = await env.DB.prepare(
    `SELECT institution_code, display_name, active, sort_order, config_version,
            created_at, created_by, updated_at, updated_by
     FROM LI_INSTITUTIONS`
  ).all();
  const institutions = (result.results || []).map(row => {
    const institution_code = String(row.institution_code ?? "").trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(institution_code)) {
      throw new Error("institution_code mesti 2-32 aksara A-Z, 0-9 atau garis bawah dan bermula dengan huruf.");
    }
    const display_name = String(row.display_name ?? "").trim();
    if (!display_name || display_name.length > 100 || /[\u0000-\u001F\u007F]/.test(display_name)) {
      throw new Error("display_name mesti teks selamat antara 1 hingga 100 aksara.");
    }
    const activeValue = String(row.active === null || row.active === undefined ? "" : row.active)
      .trim().toLowerCase();
    if (!["true", "ya", "1", "false", "tidak", "0"].includes(activeValue)) {
      throw new Error("active mesti boolean true atau false.");
    }
    const sort_order = Number(row.sort_order);
    if (!Number.isInteger(sort_order) || sort_order < 1) {
      throw new Error("sort_order mesti nombor bulat positif.");
    }
    const config_version = Number(row.config_version);
    if (!Number.isInteger(config_version) || config_version < 1) {
      throw new Error("config_version mesti nombor bulat positif.");
    }
    return {
      institution_code,
      display_name,
      active: ["true", "ya", "1"].includes(activeValue),
      sort_order,
      config_version,
      created_at: row.created_at || "",
      created_by: row.created_by || "",
      updated_at: row.updated_at || "",
      updated_by: row.updated_by || ""
    };
  }).sort((left, right) =>
    left.sort_order - right.sort_order ||
    left.display_name.localeCompare(right.display_name) ||
    left.institution_code.localeCompare(right.institution_code)
  );
  return new Response(JSON.stringify({ ok: true, data: institutions }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getAdminOutingTypes") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const result = await env.DB.prepare(
    `SELECT
       type_code,
       display_name,
       description,
       active,
       sort_order,
       allowed_days,
       application_open_time,
       application_close_time,
       fixed_return_time,
       same_day_only,
       require_leave_date,
       require_return_date,
       require_return_time,
       require_guardian_phone,
       require_guardian_relation,
       require_emergency_reason,
       require_purpose,
       require_location,
       require_vehicle,
       require_warden_approval,
       require_selfie,
       config_version,
       created_at,
       created_by,
       updated_at,
       updated_by,
       departure_allowed_days,
       earliest_departure_time,
       application_open_date,
       application_close_date
     FROM OUTING_TYPES
     ORDER BY sort_order ASC, display_name ASC, type_code ASC`
  ).all();

  const booleanFields = [
    "active",
    "same_day_only",
    "require_leave_date",
    "require_return_date",
    "require_return_time",
    "require_guardian_phone",
    "require_guardian_relation",
    "require_emergency_reason",
    "require_purpose",
    "require_location",
    "require_vehicle",
    "require_warden_approval",
    "require_selfie"
  ];

  const rows = (result.results || []).map((row) => {
    const projected = { ...row };

    for (const field of booleanFields) {
      projected[field] = Number(projected[field] || 0) === 1;
    }

    projected.sort_order = Number(projected.sort_order || 0);
    projected.config_version = Number(projected.config_version || 1);

    return projected;
  });

  return new Response(JSON.stringify({
    ok: true,
    data: rows
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/createOutingType") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id, nama_admin
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const input =
    payload.outing_type &&
    typeof payload.outing_type === "object"
      ? { ...payload.outing_type }
      : {};

  const typeCode = String(
    input.type_code || payload.type_code || ""
  ).trim().toUpperCase();

  if (!typeCode) {
    throw fault(400, "INVALID_REQUEST", "type_code diperlukan.");
  }

  const existing = await env.DB.prepare(
    `SELECT type_code
     FROM OUTING_TYPES
     WHERE type_code = ?
     LIMIT 1`
  ).bind(typeCode).first();

  if (existing) {
    throw fault(400, "OUTING_TYPE_EXISTS", "type_code telah wujud.");
  }

  const actor =
    String(admin.admin_id || admin.nama_admin || "ADMIN")
      .trim()
      .slice(0, 100);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const timestamp =
    `${map.year}-${map.month}-${map.day} ` +
    `${map.hour}:${map.minute}:${map.second}`;

  const row = {
    ...input,
    type_code: typeCode,
    config_version: 1,
    created_at: timestamp,
    created_by: actor,
    updated_at: timestamp,
    updated_by: actor
  };

  const validated =
    stagingSubmitRequestV230.validateOutingType(
      row,
      typeCode
    );

  await stagingSubmitRequestV230.mirrorOutingTypeToD1(
    env,
    {
      ...validated,
      created_at: timestamp,
      created_by: actor,
      updated_at: timestamp,
      updated_by: actor
    }
  );

  await env.DB.prepare(
    `INSERT INTO AUDIT_LOG (
       timestamp,
       action,
       request_id,
       user_role,
       user_name,
       details,
       entity_type,
       entity_id
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    timestamp,
    "CREATE_OUTING_TYPE",
    "",
    "Admin",
    actor,
    JSON.stringify({
      display_name: validated.display_name,
      active: validated.active,
      sort_order: validated.sort_order,
      config_version: validated.config_version
    }),
    "OUTING_TYPE",
    typeCode
  ).run();

  return new Response(JSON.stringify({
    ok: true,
    data: validated
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/updateOutingType") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id, nama_admin
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const typeCode =
    String(payload.type_code || "").trim().toUpperCase();

  if (!typeCode) {
    throw fault(400, "INVALID_REQUEST", "type_code diperlukan.");
  }

  const expectedVersion = Number(payload.expected_config_version);

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw fault(
      400,
      "INVALID_REQUEST",
      "expected_config_version mesti nombor bulat positif."
    );
  }

  const input =
    payload.outing_type &&
    typeof payload.outing_type === "object"
      ? { ...payload.outing_type }
      : {};

  if (Object.prototype.hasOwnProperty.call(input, "type_code")) {
    const requestedTypeCode =
      String(input.type_code || "").trim().toUpperCase();

    if (requestedTypeCode && requestedTypeCode !== typeCode) {
      throw fault(
        400,
        "IMMUTABLE_TYPE_CODE",
        "type_code tidak boleh diubah."
      );
    }
  }

  if (Object.prototype.hasOwnProperty.call(input, "active")) {
    throw fault(
      400,
      "ACTIVE_REQUIRES_TOGGLE",
      "Status active hanya boleh diubah melalui toggleOutingType."
    );
  }

  const currentRaw = await env.DB.prepare(
    `SELECT *
     FROM OUTING_TYPES
     WHERE type_code = ?
     LIMIT 1`
  ).bind(typeCode).first();

  if (!currentRaw) {
    throw fault(
      404,
      "OUTING_TYPE_NOT_FOUND",
      "Jenis outing tidak dijumpai."
    );
  }

  const currentVersion = Number(currentRaw.config_version);

  if (currentVersion !== expectedVersion) {
    throw fault(
      409,
      "CONFIG_VERSION_CONFLICT",
      "CONFIG_VERSION_CONFLICT: konfigurasi telah berubah. Muat semula sebelum menyimpan."
    );
  }

  const current =
    stagingSubmitRequestV230.validateOutingType(
      currentRaw,
      typeCode
    );

  const editableFields = [
    "display_name",
    "description",
    "sort_order",
    "allowed_days",
    "application_open_date",
    "application_close_date",
    "application_open_time",
    "application_close_time",
    "departure_allowed_days",
    "earliest_departure_time",
    "fixed_return_time",
    "same_day_only",
    "require_leave_date",
    "require_return_date",
    "require_return_time",
    "require_guardian_phone",
    "require_guardian_relation",
    "require_emergency_reason",
    "require_purpose",
    "require_location",
    "require_vehicle",
    "require_warden_approval",
    "require_selfie"
  ];

  const merged = { ...current };

  for (const field of editableFields) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      merged[field] = input[field];
    }
  }

  merged.type_code = typeCode;
  merged.active = current.active;
  merged.config_version = currentVersion + 1;

  const validated =
    stagingSubmitRequestV230.validateOutingType(
      merged,
      typeCode
    );

  const changes = {};

  for (const field of editableFields) {
    if (String(current[field] ?? "") !== String(validated[field] ?? "")) {
      changes[field] = {
        from: current[field],
        to: validated[field]
      };
    }
  }

  if (Object.keys(changes).length === 0) {
    throw fault(
      400,
      "NO_CONFIG_CHANGES",
      "Tiada perubahan konfigurasi untuk disimpan."
    );
  }

  const actor =
    String(admin.admin_id || admin.nama_admin || "ADMIN")
      .trim()
      .slice(0, 100);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const timestamp =
    `${map.year}-${map.month}-${map.day} ` +
    `${map.hour}:${map.minute}:${map.second}`;

  const bool = (field) => validated[field] ? 1 : 0;

  const updateStatement = env.DB.prepare(
    `UPDATE OUTING_TYPES SET
       display_name = ?,
       description = ?,
       sort_order = ?,
       allowed_days = ?,
       application_open_date = ?,
       application_close_date = ?,
       application_open_time = ?,
       application_close_time = ?,
       departure_allowed_days = ?,
       earliest_departure_time = ?,
       fixed_return_time = ?,
       same_day_only = ?,
       require_leave_date = ?,
       require_return_date = ?,
       require_return_time = ?,
       require_guardian_phone = ?,
       require_guardian_relation = ?,
       require_emergency_reason = ?,
       require_purpose = ?,
       require_location = ?,
       require_vehicle = ?,
       require_warden_approval = ?,
       require_selfie = ?,
       config_version = ?,
       updated_at = ?,
       updated_by = ?
     WHERE type_code = ?
       AND config_version = ?`
  ).bind(
    validated.display_name,
    validated.description,
    validated.sort_order,
    validated.allowed_days,
    validated.application_open_date,
    validated.application_close_date,
    validated.application_open_time,
    validated.application_close_time,
    validated.departure_allowed_days,
    validated.earliest_departure_time,
    validated.fixed_return_time,
    bool("same_day_only"),
    bool("require_leave_date"),
    bool("require_return_date"),
    bool("require_return_time"),
    bool("require_guardian_phone"),
    bool("require_guardian_relation"),
    bool("require_emergency_reason"),
    bool("require_purpose"),
    bool("require_location"),
    bool("require_vehicle"),
    bool("require_warden_approval"),
    bool("require_selfie"),
    validated.config_version,
    timestamp,
    actor,
    typeCode,
    expectedVersion
  );

  const updateResult = await updateStatement.run();

  if (Number(updateResult?.meta?.changes || 0) !== 1) {
    throw fault(
      409,
      "CONFIG_VERSION_CONFLICT",
      "CONFIG_VERSION_CONFLICT: konfigurasi telah berubah. Muat semula sebelum menyimpan."
    );
  }

  await env.DB.prepare(
    `INSERT INTO AUDIT_LOG (
       timestamp,
       action,
       request_id,
       user_role,
       user_name,
       details,
       entity_type,
       entity_id
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    timestamp,
    "UPDATE_OUTING_TYPE",
    "",
    "Admin",
    actor,
    JSON.stringify({
      changes,
      previous_config_version: currentVersion,
      config_version: validated.config_version
    }),
    "OUTING_TYPE",
    typeCode
  ).run();

  return new Response(JSON.stringify({
    ok: true,
    data: {
      ...validated,
      created_at: currentRaw.created_at || "",
      created_by: currentRaw.created_by || "",
      updated_at: timestamp,
      updated_by: actor
    }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/toggleOutingType") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id, nama_admin
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const typeCode =
    String(payload.type_code || "").trim().toUpperCase();

  if (!typeCode) {
    throw fault(400, "INVALID_REQUEST", "type_code diperlukan.");
  }

  const expectedVersion = Number(payload.expected_config_version);

  if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
    throw fault(
      400,
      "INVALID_REQUEST",
      "expected_config_version mesti nombor bulat positif."
    );
  }

  if (payload.active !== true && payload.active !== false) {
    throw fault(
      400,
      "INVALID_REQUEST",
      "active mesti boolean true atau false."
    );
  }

  const currentRaw = await env.DB.prepare(
    `SELECT *
     FROM OUTING_TYPES
     WHERE type_code = ?
     LIMIT 1`
  ).bind(typeCode).first();

  if (!currentRaw) {
    throw fault(
      404,
      "OUTING_TYPE_NOT_FOUND",
      "Jenis outing tidak dijumpai."
    );
  }

  const currentVersion = Number(currentRaw.config_version);

  if (currentVersion !== expectedVersion) {
    throw fault(
      409,
      "CONFIG_VERSION_CONFLICT",
      "CONFIG_VERSION_CONFLICT: konfigurasi telah berubah. Muat semula sebelum menyimpan."
    );
  }

  const current =
    stagingSubmitRequestV230.validateOutingType(
      currentRaw,
      typeCode
    );

  const requestedActive = payload.active === true;

  if (current.active === requestedActive) {
    throw fault(
      400,
      "OUTING_TYPE_STATUS_UNCHANGED",
      requestedActive
        ? "Jenis outing sudah aktif."
        : "Jenis outing sudah tidak aktif."
    );
  }

  const actor =
    String(admin.admin_id || admin.nama_admin || "ADMIN")
      .trim()
      .slice(0, 100);

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const timestamp =
    `${map.year}-${map.month}-${map.day} ` +
    `${map.hour}:${map.minute}:${map.second}`;

  const nextVersion = currentVersion + 1;

  const updateResult = await env.DB.prepare(
    `UPDATE OUTING_TYPES
     SET active = ?,
         config_version = ?,
         updated_at = ?,
         updated_by = ?
     WHERE type_code = ?
       AND config_version = ?`
  ).bind(
    requestedActive ? 1 : 0,
    nextVersion,
    timestamp,
    actor,
    typeCode,
    expectedVersion
  ).run();

  if (Number(updateResult?.meta?.changes || 0) !== 1) {
    throw fault(
      409,
      "CONFIG_VERSION_CONFLICT",
      "CONFIG_VERSION_CONFLICT: konfigurasi telah berubah. Muat semula sebelum menyimpan."
    );
  }

  await env.DB.prepare(
    `INSERT INTO AUDIT_LOG (
       timestamp,
       action,
       request_id,
       user_role,
       user_name,
       details,
       entity_type,
       entity_id
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    timestamp,
    requestedActive
      ? "ACTIVATE_OUTING_TYPE"
      : "DEACTIVATE_OUTING_TYPE",
    "",
    "Admin",
    actor,
    JSON.stringify({
      active: {
        from: current.active,
        to: requestedActive
      },
      previous_config_version: currentVersion,
      config_version: nextVersion
    }),
    "OUTING_TYPE",
    typeCode
  ).run();

  return new Response(JSON.stringify({
    ok: true,
    data: {
      ...current,
      active: requestedActive,
      config_version: nextVersion,
      created_at: currentRaw.created_at || "",
      created_by: currentRaw.created_by || "",
      updated_at: timestamp,
      updated_by: actor
    }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getAdminMonitoring") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const [requestResult, wardenResult] = await Promise.all([
    env.DB.prepare(
      `SELECT *
       FROM OUTING_REQUESTS
       WHERE status IN (
         'MENUNGGU_KELULUSAN',
         'DILULUSKAN_WARDEN',
         'KELUAR'
       )`
    ).all(),

    env.DB.prepare(
      `SELECT warden_id, nama
       FROM WARDENS`
    ).all()
  ]);

  const wardenRoleByName = new Map();

  for (const warden of wardenResult.results || []) {
    wardenRoleByName.set(
      String(warden.nama || "").trim().toUpperCase(),
      /^HEP-/i.test(String(warden.warden_id || "").trim())
        ? "HEP"
        : "WARDEN"
    );
  }

  const normalizeTime = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);

    if (!match) return "";

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return "";
    }

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const normalizeDateKey = (value) => {
    const text = String(value || "").trim();
    if (!text) return "";

    const direct = text.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];

    const date = new Date(text.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    return `${map.year}-${map.month}-${map.day}`;
  };

  const malaysiaTimestamp = (date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+08:00`;
  };

  const legacyDailyTypes = new Set([
    "OUTING_BIASA",
    "KECEMASAN",
    "OUTING_HUJUNG_MINGGU"
  ]);

  const resolveExpectedReturnTarget = (row) => {
    const typeCode = String(row.jenis_permohonan || "")
      .trim()
      .toUpperCase();

    const legacyDaily = legacyDailyTypes.has(typeCode);

    let returnDate = normalizeDateKey(row.tarikh_balik);

    if (!returnDate && legacyDaily) {
      returnDate = normalizeDateKey(row.tarikh);
    }

    if (!returnDate) {
      return {
        valid: false,
        reason_code: "MISSING_EXPECTED_RETURN_DATE"
      };
    }

    let returnTime = normalizeTime(row.masa_balik_dijangka);

    if (!returnTime && legacyDaily) {
      returnTime = "22:00";
    }

    if (!returnTime) {
      return {
        valid: false,
        reason_code: "MISSING_EXPECTED_RETURN_TIME"
      };
    }

    const expectedReturnAt =
      `${returnDate}T${returnTime}:00+08:00`;

    const target = new Date(expectedReturnAt);

    if (Number.isNaN(target.getTime())) {
      return {
        valid: false,
        reason_code: "INVALID_EXPECTED_RETURN"
      };
    }

    return {
      valid: true,
      expected_return_at: expectedReturnAt,
      target_ms: target.getTime(),
      reason_code: ""
    };
  };

  const getOperationalUrgency = (row, now) => {
    const evaluatedAt = malaysiaTimestamp(now);

    if (String(row.status || "").trim() !== "KELUAR") {
      return {
        applicable: false,
        state: null,
        severity_rank: 0,
        expected_return_at: null,
        evaluated_at: evaluatedAt,
        minutes_to_due: null,
        minutes_late: null,
        next_transition_at: null,
        timing_valid: false,
        reason_code: "NOT_APPLICABLE",
        needs_review: false,
        next_action_code: "NONE"
      };
    }

    const target = resolveExpectedReturnTarget(row);

    if (!target.valid) {
      return {
        applicable: true,
        state: null,
        severity_rank: 0,
        expected_return_at: null,
        evaluated_at: evaluatedAt,
        minutes_to_due: null,
        minutes_late: null,
        next_transition_at: null,
        timing_valid: false,
        reason_code:
          target.reason_code || "INVALID_EXPECTED_RETURN",
        needs_review: true,
        next_action_code: "REVIEW_TIMING"
      };
    }

    const differenceMs = target.target_ms - now.getTime();
    const lateMs = Math.max(0, -differenceMs);

    const minutesToDue =
      Math.max(0, differenceMs) / 60000;

    const minutesLate =
      lateMs / 60000;

    let state = "NORMAL";
    let severityRank = 0;
    let nextActionCode = "NONE";
    let nextTransitionAt =
      new Date(target.target_ms - 30 * 60 * 1000);

    if (
      differenceMs <= 30 * 60 * 1000 &&
      differenceMs >= 0
    ) {
      state = "DUE_SOON";
      severityRank = 1;
      nextActionCode = "PREPARE_RETURN";
      nextTransitionAt = new Date(target.target_ms);
    } else if (
      lateMs > 0 &&
      lateMs < 30 * 60 * 1000
    ) {
      state = "LATE";
      severityRank = 2;
      nextActionCode = "RETURN_NOW";
      nextTransitionAt =
        new Date(target.target_ms + 30 * 60 * 1000);
    } else if (
      lateMs >= 30 * 60 * 1000 &&
      lateMs < 60 * 60 * 1000
    ) {
      state = "CRITICAL";
      severityRank = 3;
      nextActionCode = "FOLLOW_UP";
      nextTransitionAt =
        new Date(target.target_ms + 60 * 60 * 1000);
    } else if (lateMs >= 60 * 60 * 1000) {
      state = "ACTION_REQUIRED";
      severityRank = 4;
      nextActionCode = "ACTION_REQUIRED";
      nextTransitionAt = null;
    }

    return {
      applicable: true,
      state,
      severity_rank: severityRank,
      expected_return_at: target.expected_return_at,
      evaluated_at: evaluatedAt,
      minutes_to_due: minutesToDue,
      minutes_late: minutesLate,
      next_transition_at: nextTransitionAt
        ? malaysiaTimestamp(nextTransitionAt)
        : null,
      timing_valid: true,
      reason_code: "",
      needs_review: false,
      next_action_code: nextActionCode
    };
  };

  const parseDateForSort = (value) => {
    const text = String(value || "").trim();
    if (!text) return null;

    const parsed = new Date(text.replace(" ", "T"));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const calculateDurationMinutes = (row) => {
    const keluar = parseDateForSort(row.masa_keluar);
    const masuk = parseDateForSort(row.masa_masuk);

    if (
      !keluar ||
      !masuk ||
      masuk.getTime() <= keluar.getTime()
    ) {
      return 0;
    }

    return Math.floor(
      (masuk.getTime() - keluar.getTime()) / 60000
    );
  };

  const formatDuration = (totalMinutes) => {
    const safeMinutes =
      Math.max(0, Math.floor(Number(totalMinutes) || 0));

    const days = Math.floor(safeMinutes / 1440);
    const hours = Math.floor((safeMinutes % 1440) / 60);
    const minutes = safeMinutes % 60;

    const parts = [];

    if (days) parts.push(`${days} hari`);
    if (hours) parts.push(`${hours} jam`);
    if (minutes || !parts.length) {
      parts.push(`${minutes} minit`);
    }

    return parts.join(" ");
  };

  const now = new Date();

  const records = (requestResult.results || [])
    .map((row) => {
      const urgency = getOperationalUrgency(row, now);

      const overdue =
        String(row.lewat || "").trim().toLowerCase() === "ya" ||
        (
          urgency &&
          urgency.timing_valid &&
          Number(urgency.severity_rank || 0) >= 2
        );

      const returnDate = normalizeDateKey(row.tarikh_balik);
      const returnTime = normalizeTime(row.masa_balik_dijangka);

      const approverName =
        String(row.warden_approve_by || "")
          .trim()
          .toUpperCase();

      const durationMinutes =
        calculateDurationMinutes(row);

      return {
        request_id: row.request_id || "",
        student_id: row.student_id || "",
        no_matrik: row.no_matrik || "",
        nama: row.nama || "",
        kelas: row.kelas || "",
        jenis_permohonan: row.jenis_permohonan || "",
        status: row.status || "",
        tarikh: row.tarikh || "",
        masa_mohon: row.masa_mohon || "",
        masa_keluar: row.masa_keluar || "",
        masa_masuk: row.masa_masuk || "",
        tarikh_balik: returnDate,
        masa_balik_dijangka: returnTime,
        expected_return_at:
          returnDate && returnTime
            ? `${returnDate} ${returnTime}:00`
            : "",
        lewat: overdue,
        tujuan: row.tujuan || "",
        lokasi: row.lokasi || "",
        jenis_kenderaan: row.jenis_kenderaan || "",
        butiran_kenderaan: row.butiran_kenderaan || "",
        warden_approve_by: row.warden_approve_by || "",
        warden_approve_role:
          wardenRoleByName.get(approverName) === "HEP"
            ? "HEP"
            : "WARDEN",
        masa_approve: row.masa_approve || "",
        guard_keluar_by: row.guard_keluar_by || "",
        guard_masuk_by: row.guard_masuk_by || "",
        sebab_batal_pelajar:
          row.sebab_batal_pelajar || "",
        masa_batal_pelajar:
          row.masa_batal_pelajar || "",
        dibatalkan_oleh:
          row.dibatalkan_oleh || "",
        duration_minutes: durationMinutes,
        duration:
          durationMinutes > 0
            ? formatDuration(durationMinutes)
            : "",
        operational_urgency: urgency
      };
    })
    .sort((left, right) => {
      const rightDate =
        parseDateForSort(right.masa_mohon || right.tarikh) ||
        new Date(0);

      const leftDate =
        parseDateForSort(left.masa_mohon || left.tarikh) ||
        new Date(0);

      return rightDate.getTime() - leftDate.getTime();
    });

  const kpis = {
    pending:
      records.filter(
        (row) => row.status === "MENUNGGU_KELULUSAN"
      ).length,

    approved:
      records.filter(
        (row) => row.status === "DILULUSKAN_WARDEN"
      ).length,

    out:
      records.filter(
        (row) => row.status === "KELUAR"
      ).length,

    not_returned:
      records.filter(
        (row) => row.status === "KELUAR"
      ).length,

    late:
      records.filter(
        (row) => row.lewat === true
      ).length,

    emergency:
      records.filter(
        (row) =>
          String(row.jenis_permohonan || "")
            .trim()
            .toUpperCase() === "KECEMASAN"
      ).length
  };

  return new Response(JSON.stringify({
    ok: true,
    data: {
      generated_at: malaysiaTimestamp(now),
      kpis,
      records
    }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getOutingConfigReadiness") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  const admin = await env.DB.prepare(
    `SELECT admin_id
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const result = await env.DB.prepare(
    `SELECT *
     FROM OUTING_TYPES
     ORDER BY sort_order ASC, type_code ASC`
  ).all();

  const rows = result.results || [];
  const reasons = [];
  let activeTypeCount = 0;

  const booleanFields = [
    "active",
    "same_day_only",
    "require_leave_date",
    "require_return_date",
    "require_return_time",
    "require_guardian_phone",
    "require_guardian_relation",
    "require_emergency_reason",
    "require_purpose",
    "require_location",
    "require_vehicle",
    "require_warden_approval",
    "require_selfie"
  ];

  const timeFields = [
    "application_open_time",
    "application_close_time",
    "fixed_return_time",
    "earliest_departure_time"
  ];

  const dateFields = [
    "application_open_date",
    "application_close_date"
  ];

  const allowedDayNames = new Set([
    "AHAD",
    "ISNIN",
    "SELASA",
    "RABU",
    "KHAMIS",
    "JUMAAT",
    "SABTU"
  ]);

  const normalizeStoredBooleanStrict = (value, fieldName) => {
    if (value === true || value === false) {
      return value;
    }

    const normalized = String(value ?? "")
      .trim()
      .toLowerCase();

    if (
      normalized === "true" ||
      normalized === "ya" ||
      normalized === "1"
    ) {
      return true;
    }

    if (
      normalized === "false" ||
      normalized === "tidak" ||
      normalized === "0"
    ) {
      return false;
    }

    throw new Error(
      `${fieldName || "boolean"} mesti boolean true atau false.`
    );
  };

  const validateTypeCode = (value) => {
    const typeCode = String(value || "").trim().toUpperCase();

    if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(typeCode)) {
      throw new Error(
        "type_code mesti uppercase, bermula dengan huruf dan hanya mengandungi A-Z, 0-9 atau underscore."
      );
    }

    return typeCode;
  };

  const validateAllowedDays = (value, required) => {
    const rawDays = String(value ?? "")
      .split(",")
      .map((day) => String(day || "").trim().toUpperCase())
      .filter(Boolean);

    if (required && rawDays.length === 0) {
      throw new Error(
        "allowed_days mesti mengandungi sekurang-kurangnya satu hari."
      );
    }

    for (const day of rawDays) {
      if (!allowedDayNames.has(day)) {
        throw new Error(
          `allowed_days mengandungi hari yang tidak sah: ${day}`
        );
      }
    }

    return rawDays.join(",");
  };

  const validateTime = (value, fieldName) => {
    const text = String(value ?? "").trim();
    if (!text) return "";

    const match =
      text.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);

    if (!match) {
      throw new Error(
        `${fieldName} mesti menggunakan format HH:mm atau dikosongkan.`
      );
    }

    return `${match[1]}:${match[2]}`;
  };

  const validateDate = (value, fieldName) => {
    const text = String(value ?? "").trim();
    if (!text) return "";

    const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
      throw new Error(
        `${fieldName} mesti menggunakan format YYYY-MM-DD atau dikosongkan.`
      );
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() + 1 !== month ||
      parsed.getUTCDate() !== day
    ) {
      throw new Error(`${fieldName} tidak sah.`);
    }

    return text;
  };

  const seenTypeCodes = new Set();

  rows.forEach((row, rowIndex) => {
    const rawTypeCode = String(row.type_code || "")
      .trim()
      .toUpperCase();

    const typeLabel = rawTypeCode || `baris ${rowIndex + 2}`;

    if (rawTypeCode) {
      if (seenTypeCodes.has(rawTypeCode)) {
        reasons.push(`Kod jenis pendua: ${rawTypeCode}.`);
      } else {
        seenTypeCodes.add(rawTypeCode);
      }
    }

    let active;

    try {
      active = normalizeStoredBooleanStrict(
        row.active,
        "active"
      );
    } catch (error) {
      reasons.push(`${typeLabel}: ${error.message}`);
      return;
    }

    if (!active) {
      return;
    }

    activeTypeCount += 1;

    try {
      const typeCode = validateTypeCode(row.type_code);

      const displayName = String(row.display_name || "").trim();
      const description = String(row.description || "").trim();

      if (!displayName) {
        throw new Error("display_name diperlukan.");
      }

      if (displayName.length > 100) {
        throw new Error("display_name terlalu panjang.");
      }

      if (description.length > 500) {
        throw new Error("description terlalu panjang.");
      }

      const sortOrder = Number(row.sort_order);

      if (
        !Number.isInteger(sortOrder) ||
        sortOrder < 1 ||
        sortOrder > 9999
      ) {
        throw new Error(
          "sort_order mesti nombor bulat antara 1 dan 9999."
        );
      }

      validateAllowedDays(row.allowed_days, true);

      const departureAllowedDays =
        validateAllowedDays(
          row.departure_allowed_days,
          false
        );

      const normalizedTimes = {};

      for (const field of timeFields) {
        normalizedTimes[field] =
          validateTime(row[field], field);
      }

      const normalizedDates = {};

      for (const field of dateFields) {
        normalizedDates[field] =
          validateDate(row[field], field);
      }

      if (
        normalizedDates.application_open_date &&
        normalizedDates.application_close_date &&
        normalizedDates.application_close_date <
          normalizedDates.application_open_date
      ) {
        throw new Error(
          "Tarikh Permohonan Ditutup tidak boleh lebih awal daripada Tarikh Permohonan Dibuka."
        );
      }

      const normalizedBooleans = {};

      for (const field of booleanFields) {
        normalizedBooleans[field] =
          normalizeStoredBooleanStrict(row[field], field);
      }

      const configVersion = Number(row.config_version);

      if (
        !Number.isInteger(configVersion) ||
        configVersion < 1
      ) {
        throw new Error(
          "config_version mesti nombor bulat positif."
        );
      }

      if (
        departureAllowedDays &&
        !normalizedBooleans.same_day_only &&
        !normalizedBooleans.require_leave_date
      ) {
        throw new Error(
          "departure_allowed_days memerlukan require_leave_date=true."
        );
      }

      void typeCode;
      void normalizedTimes;
    } catch (error) {
      reasons.push(
        `${typeLabel}: ${error.message || "konfigurasi tidak sah."}`
      );
    }
  });

  if (activeTypeCount === 0) {
    reasons.push(
      "Sekurang-kurangnya satu jenis outing aktif diperlukan."
    );
  }

  const uniqueReasons = [...new Set(reasons)];

  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const checkedAt =
    `${map.year}-${map.month}-${map.day}` +
    `T${map.hour}:${map.minute}:${map.second}+08:00`;

  return new Response(JSON.stringify({
    ok: true,
    data: {
      config_mode: "CONFIG_DRIVEN",
      config_mode_label: "Config-driven (Active)",
      ready: uniqueReasons.length === 0,
      readiness_label:
        uniqueReasons.length === 0 ? "Ready" : "Not Ready",
      active_type_count: activeTypeCount,
      reasons: uniqueReasons,
      checked_at: checkedAt
    }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/updateNoGuardDepartureConfig") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

  const adminId = String(payload.admin_id || "").trim();
  const adminName = String(
    payload.nama_admin ||
    payload.admin_name ||
    payload.name ||
    ""
  ).trim();
  const pin = String(payload.pin || "").trim();

  if (payload.enabled !== true && payload.enabled !== false) {
    throw fault(
      400,
      "INVALID_REQUEST",
      "enabled mesti boolean true atau false."
    );
  }

  const admin = await env.DB.prepare(
    `SELECT admin_id, nama_admin
     FROM ADMIN_USERS
     WHERE (
       LOWER(admin_id) = LOWER(?)
       OR LOWER(nama_admin) = LOWER(?)
     )
       AND pin = ?
       AND LOWER(status) = 'aktif'
     LIMIT 1`
  ).bind(adminId, adminName, pin).first();

  if (!admin) {
    throw fault(
      401,
      "ADMIN_SESSION_INVALID",
      "Akses sesi admin tidak sah"
    );
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(new Date());

  const map = {};
  for (const part of parts) {
    map[part.type] = part.value;
  }

  const timestamp =
    `${map.year}-${map.month}-${map.day} ` +
    `${map.hour}:${map.minute}:${map.second}`;

  const enabled = payload.enabled === true;
  const configValue = enabled ? "true" : "false";
  const actorName =
    String(admin.nama_admin || admin.admin_id || "").trim();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO SYSTEM_CONFIG (
         config_key,
         config_value,
         updated_at,
         updated_by
       )
       VALUES (?, ?, ?, ?)
       ON CONFLICT(config_key) DO UPDATE SET
         config_value = excluded.config_value,
         updated_at = excluded.updated_at,
         updated_by = excluded.updated_by`
    ).bind(
      "NO_GUARD_DEPARTURE_ENABLED",
      configValue,
      timestamp,
      actorName
    ),

    env.DB.prepare(
      `INSERT INTO AUDIT_LOG (
         timestamp,
         action,
         request_id,
         user_role,
         user_name,
         details,
         entity_type,
         entity_id
       )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      timestamp,
      "UPDATE_NO_GUARD_DEPARTURE_CONFIG",
      "",
      "Admin",
      actorName,
      JSON.stringify({ enabled }),
      "SYSTEM_CONFIG",
      "NO_GUARD_DEPARTURE_ENABLED"
    )
  ]);

  return new Response(JSON.stringify({
    ok: true,
    data: { enabled }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/getStudentAnnualSummary") {
  action = "getStudentAnnualSummary";
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return finish(null, 204);
  }
  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
  const studentId = String(payload?.student_id || "").trim();
  const noMatrik = String(payload?.no_matrik || "").trim();
  if (!studentId || !noMatrik) {
    throw fault(401, "STUDENT_SESSION_INVALID", "Akses sesi pelajar tidak sah");
  }
  const student = await env.DB.prepare(
    `SELECT student_id FROM STUDENTS
     WHERE student_id = ? AND no_matrik = ? AND status = 'Aktif'
     LIMIT 1`
  ).bind(studentId, noMatrik).first();
  if (!student) {
    throw fault(401, "STUDENT_SESSION_INVALID", "Akses sesi pelajar tidak sah");
  }

  const year = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric"
  }).format(new Date()));
  const result = await env.DB.prepare(
    `SELECT tarikh, jenis_permohonan, status FROM OUTING_REQUESTS
     WHERE student_id = ? AND tarikh >= ? AND tarikh < ?
       AND status IN ('MENUNGGU_KELULUSAN', 'DILULUSKAN_WARDEN', 'KELUAR',
                      'SELESAI', 'DITOLAK_WARDEN', 'DIBATALKAN_PELAJAR')
     ORDER BY tarikh DESC`
  ).bind(student.student_id, `${year}-01-01`, `${year + 1}-01-01`).all();
  const history_records = result.results || [];
  return finish(JSON.stringify({ ok: true, data: {
    year,
    total_outings: history_records.filter((record) => record.status === "SELESAI").length,
    history_records
  } }), 200);
}

if (url.pathname === "/api/d1/getTodayRecords") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
  const role = String(payload.role || "").trim().toLowerCase();

  let authenticatedStudentId = "";

  if (role === "student") {
    const studentId = String(payload.student_id || payload.id || "").trim();
    const noMatrik = String(payload.no_matrik || payload.matric || "").trim();

    const student = await env.DB.prepare(
      `SELECT student_id
       FROM STUDENTS
       WHERE student_id = ?
         AND no_matrik = ?
         AND status = 'Aktif'
       LIMIT 1`
    ).bind(studentId, noMatrik).first();

    if (!student) {
      throw fault(401, "STUDENT_SESSION_INVALID", "Akses sesi pelajar tidak sah");
    }

    authenticatedStudentId = student.student_id;
  } else if (role === "warden") {
    const name = String(
      payload.nama_warden ||
      payload.warden_name ||
      payload.name ||
      ""
    ).trim();

    const pin = String(payload.pin || "").trim();

    const warden = await env.DB.prepare(
      `SELECT warden_id
       FROM WARDENS
       WHERE nama = ?
         AND pin = ?
         AND status = 'Aktif'
       LIMIT 1`
    ).bind(name, pin).first();

    if (!warden) {
      throw fault(401, "WARDEN_SESSION_INVALID", "Akses sesi warden tidak sah");
    }
  } else if (role === "guard") {
    const name = String(
      payload.nama_guard ||
      payload.guard_name ||
      payload.name ||
      ""
    ).trim();

    const pin = String(payload.pin || "").trim();

    const guard = await env.DB.prepare(
      `SELECT guard_id
       FROM GUARDS
       WHERE nama = ?
         AND pin = ?
         AND status = 'Aktif'
       LIMIT 1`
    ).bind(name, pin).first();

    if (!guard) {
      throw fault(401, "GUARD_SESSION_INVALID", "Akses sesi guard tidak sah");
    }
  } else {
    throw fault(401, "SESSION_REQUIRED", "Akses sesi diperlukan");
  }

  const malaysiaDateKey = (value) => {
    if (value === undefined || value === null || value === "") return "";

    const text = String(value).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    return `${map.year}-${map.month}-${map.day}`;
  };

  const malaysiaTimestamp = (date) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date);

    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }

    return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}+08:00`;
  };

  const normalizeTime = (value) => {
    const text = String(value || "").trim();

    const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) return "";

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      return "";
    }

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };

  const legacyDailyTypes = new Set([
    "OUTING_BIASA",
    "KECEMASAN",
    "OUTING_HUJUNG_MINGGU"
  ]);

  const resolveExpectedReturnTarget = (row) => {
    const typeCode = String(row.jenis_permohonan || "").trim().toUpperCase();
    const legacyDaily = legacyDailyTypes.has(typeCode);

    let returnDate = malaysiaDateKey(row.tarikh_balik);

    if (!returnDate && legacyDaily) {
      returnDate = malaysiaDateKey(row.tarikh);
    }

    if (!returnDate) {
      return {
        valid: false,
        reason_code: "MISSING_EXPECTED_RETURN_DATE"
      };
    }

    let returnTime = normalizeTime(row.masa_balik_dijangka);

    if (!returnTime && legacyDaily) {
      returnTime = "22:00";
    }

    if (!returnTime) {
      return {
        valid: false,
        reason_code: "MISSING_EXPECTED_RETURN_TIME"
      };
    }

    const expectedReturnAt = `${returnDate}T${returnTime}:00+08:00`;
    const target = new Date(expectedReturnAt);

    if (Number.isNaN(target.getTime())) {
      return {
        valid: false,
        reason_code: "INVALID_EXPECTED_RETURN"
      };
    }

    return {
      valid: true,
      expected_return_at: expectedReturnAt,
      target_ms: target.getTime(),
      reason_code: ""
    };
  };

  const getOperationalUrgency = (row, now) => {
    const evaluatedAt = malaysiaTimestamp(now);

    if (String(row.status || "").trim() !== "KELUAR") {
      return {
        applicable: false,
        state: null,
        severity_rank: 0,
        expected_return_at: null,
        evaluated_at: evaluatedAt,
        minutes_to_due: null,
        minutes_late: null,
        next_transition_at: null,
        timing_valid: false,
        reason_code: "NOT_APPLICABLE",
        needs_review: false,
        next_action_code: "NONE"
      };
    }

    const target = resolveExpectedReturnTarget(row);

    if (!target.valid) {
      return {
        applicable: true,
        state: null,
        severity_rank: 0,
        expected_return_at: null,
        evaluated_at: evaluatedAt,
        minutes_to_due: null,
        minutes_late: null,
        next_transition_at: null,
        timing_valid: false,
        reason_code: target.reason_code || "INVALID_EXPECTED_RETURN",
        needs_review: true,
        next_action_code: "REVIEW_TIMING"
      };
    }

    const differenceMs = target.target_ms - now.getTime();
    const lateMs = Math.max(0, -differenceMs);

    const minutesToDue = Math.max(0, differenceMs) / 60000;
    const minutesLate = lateMs / 60000;

    let state = "NORMAL";
    let severityRank = 0;
    let nextActionCode = "NONE";
    let nextTransitionAt = new Date(target.target_ms - (30 * 60 * 1000));

    if (differenceMs <= 30 * 60 * 1000 && differenceMs >= 0) {
      state = "DUE_SOON";
      severityRank = 1;
      nextActionCode = "PREPARE_RETURN";
      nextTransitionAt = new Date(target.target_ms);
    } else if (lateMs > 0 && lateMs < 30 * 60 * 1000) {
      state = "LATE";
      severityRank = 2;
      nextActionCode = "RETURN_NOW";
      nextTransitionAt = new Date(target.target_ms + (30 * 60 * 1000));
    } else if (
      lateMs >= 30 * 60 * 1000 &&
      lateMs < 60 * 60 * 1000
    ) {
      state = "CRITICAL";
      severityRank = 3;
      nextActionCode = "FOLLOW_UP";
      nextTransitionAt = new Date(target.target_ms + (60 * 60 * 1000));
    } else if (lateMs >= 60 * 60 * 1000) {
      state = "ACTION_REQUIRED";
      severityRank = 4;
      nextActionCode = "ACTION_REQUIRED";
      nextTransitionAt = null;
    }

    return {
      applicable: true,
      state,
      severity_rank: severityRank,
      expected_return_at: target.expected_return_at,
      evaluated_at: evaluatedAt,
      minutes_to_due: minutesToDue,
      minutes_late: minutesLate,
      next_transition_at: nextTransitionAt
        ? malaysiaTimestamp(nextTransitionAt)
        : null,
      timing_valid: true,
      reason_code: "",
      needs_review: false,
      next_action_code: nextActionCode
    };
  };

  const todayKey = malaysiaDateKey(new Date());

  const requestResult = await env.DB.prepare(
    `SELECT *
     FROM OUTING_REQUESTS
     ORDER BY masa_mohon DESC`
  ).all();

  const studentResult = await env.DB.prepare(
    `SELECT student_id, photo_file_id, photo_updated_at
     FROM STUDENTS`
  ).all();

  const wardenResult = await env.DB.prepare(
    `SELECT warden_id, nama
     FROM WARDENS`
  ).all();

  const typeResult = await env.DB.prepare(
    `SELECT type_code, earliest_departure_time
     FROM OUTING_TYPES`
  ).all();

  const auditResult = await env.DB.prepare(
    `SELECT timestamp, action, request_id
     FROM AUDIT_LOG
     WHERE action IN (
       'DEPARTURE_CONFIRMATION_REQUESTED',
       'WARDEN_REMOTE_CHECKOUT'
     )
     ORDER BY timestamp ASC`
  ).all();

  const photoByStudentId = new Map();
  for (const student of studentResult.results || []) {
    photoByStudentId.set(
      String(student.student_id || "").trim(),
      {
        has_profile_photo: Boolean(String(student.photo_file_id || "").trim()),
        photo_updated_at: student.photo_updated_at || ""
      }
    );
  }

  const wardenRoleByName = new Map();
  for (const warden of wardenResult.results || []) {
    const roleValue = /^HEP-/i.test(String(warden.warden_id || "").trim())
      ? "HEP"
      : "WARDEN";

    wardenRoleByName.set(
      String(warden.nama || "").trim().toUpperCase(),
      roleValue
    );
  }

  const departureTimeByType = new Map();
  for (const type of typeResult.results || []) {
    departureTimeByType.set(
      String(type.type_code || "").trim().toUpperCase(),
      normalizeTime(type.earliest_departure_time)
    );
  }

  const auditStateByRequest = new Map();

  for (const audit of auditResult.results || []) {
    const requestId = String(audit.request_id || "").trim();
    if (!requestId) continue;

    let state = auditStateByRequest.get(requestId);

    if (!state) {
      state = {
        requested: false,
        requested_at: "",
        completed: false
      };

      auditStateByRequest.set(requestId, state);
    }

    if (
      audit.action === "DEPARTURE_CONFIRMATION_REQUESTED" &&
      !state.requested
    ) {
      state.requested = true;
      state.requested_at = audit.timestamp || "";
    }

    if (audit.action === "WARDEN_REMOTE_CHECKOUT") {
      state.completed = true;
    }
  }

  const activeStatuses = new Set([
    "MENUNGGU_KELULUSAN",
    "DILULUSKAN_WARDEN",
    "KELUAR"
  ]);

  const hostelTypes = new Set([
    "OUTING_HUJUNG_MINGGU",
    "PULANG_BERMALAM",
    "CUTI_SEMESTER"
  ]);

  const closedHostelStatuses = new Set([
    "SELESAI",
    "DITOLAK_WARDEN",
    "DIBATALKAN_PELAJAR"
  ]);

  const now = new Date();

  let rows = (requestResult.results || []).filter((row) => {
    const rowDateKey =
      malaysiaDateKey(row.tarikh) ||
      malaysiaDateKey(row.masa_mohon);

    const returnDateKey = malaysiaDateKey(row.tarikh_balik);

    const isTodayActivity =
      rowDateKey === todayKey ||
      returnDateKey === todayKey ||
      malaysiaDateKey(row.masa_mohon) === todayKey ||
      malaysiaDateKey(row.masa_approve) === todayKey ||
      malaysiaDateKey(row.masa_keluar) === todayKey ||
      malaysiaDateKey(row.masa_masuk) === todayKey ||
      malaysiaDateKey(row.masa_batal_pelajar) === todayKey;

    const activeRecord = activeStatuses.has(String(row.status || "").trim());

    const typeCode = String(row.jenis_permohonan || "").trim().toUpperCase();

    const hostelReturnOpen =
      hostelTypes.has(typeCode) &&
      !closedHostelStatuses.has(String(row.status || "").trim());

    return isTodayActivity || activeRecord || hostelReturnOpen;
  });

  if (authenticatedStudentId) {
    rows = rows.filter(
      (row) => String(row.student_id || "").trim() === authenticatedStudentId
    );
  }

  const noGuardDepartureEnabled =
    role === "warden" || role === "student"
      ? await readNoGuardDepartureEnabled(env)
      : false;

  rows = rows.map((row) => {
    const projected = { ...row };

    const photo =
      photoByStudentId.get(String(row.student_id || "").trim()) || {};

    projected.has_profile_photo = Boolean(photo.has_profile_photo);
    projected.photo_updated_at = photo.photo_updated_at || "";

    const approverName = String(row.warden_approve_by || "")
      .trim()
      .toUpperCase();

    projected.warden_approve_role =
      wardenRoleByName.get(approverName) === "HEP"
        ? "HEP"
        : "WARDEN";

    projected.operational_urgency = getOperationalUrgency(row, now);

    if (role === "warden") {
      const typeCode = String(row.jenis_permohonan || "")
        .trim()
        .toUpperCase();

      projected.earliest_departure_time =
        normalizeTime(row.earliest_departure_time) ||
        departureTimeByType.get(typeCode) ||
        "";
    }

    if (role === "warden" || role === "student") {
      const auditState =
        auditStateByRequest.get(String(row.request_id || "").trim()) || {
          requested: false,
          requested_at: "",
          completed: false
        };

      projected.departure_confirmation_pending =
        String(row.status || "").trim() === "DILULUSKAN_WARDEN" &&
        auditState.requested &&
        !auditState.completed;

      projected.departure_confirmation_requested_at =
        auditState.requested
          ? auditState.requested_at
          : "";

      projected.no_guard_departure_enabled = noGuardDepartureEnabled;
    }

    if (role === "warden") {
      const urgencyState = String(
        projected.operational_urgency &&
        projected.operational_urgency.state ||
        ""
      ).toUpperCase();

      const requestType = String(row.jenis_permohonan || "")
        .trim()
        .toUpperCase();

      const status = String(row.status || "").trim();

      projected.guardian_contact_available =
        (
          requestType === "KECEMASAN" &&
          (
            status === "MENUNGGU_KELULUSAN" ||
            status === "DILULUSKAN_WARDEN"
          )
        ) ||
        (
          status === "KELUAR" &&
          (
            urgencyState === "CRITICAL" ||
            urgencyState === "ACTION_REQUIRED"
          )
        );

      projected.guardian_contact_available =
        projected.guardian_contact_available &&
        Boolean(String(row.telefon_waris || "").trim());
    }

    delete projected.telefon_waris;
    delete projected.hubungan_waris;

    return projected;
  });

  return new Response(JSON.stringify({
    ok: true,
    data: rows
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/getCurrentHostelRoster") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
  const role = String(payload.role || "").trim().toLowerCase();

  if (role === "warden") {
    const name = String(
      payload.nama_warden ||
      payload.warden_name ||
      payload.name ||
      ""
    ).trim();

    const pin = String(payload.pin || "").trim();

    const warden = await env.DB.prepare(
      `SELECT warden_id
       FROM WARDENS
       WHERE nama = ?
         AND pin = ?
         AND status = 'Aktif'
       LIMIT 1`
    ).bind(name, pin).first();

    if (!warden) {
      throw fault(401, "WARDEN_SESSION_INVALID", "Akses sesi warden tidak sah");
    }
  } else if (role === "guard") {
    const name = String(
      payload.nama_guard ||
      payload.guard_name ||
      payload.name ||
      ""
    ).trim();

    const pin = String(payload.pin || "").trim();

    const guard = await env.DB.prepare(
      `SELECT guard_id
       FROM GUARDS
       WHERE nama = ?
         AND pin = ?
         AND status = 'Aktif'
       LIMIT 1`
    ).bind(name, pin).first();

    if (!guard) {
      throw fault(401, "GUARD_SESSION_INVALID", "Akses sesi guard tidak sah");
    }
  } else if (role === "admin") {
    const adminId = String(payload.admin_id || "").trim();
    const adminName = String(
      payload.nama_admin ||
      payload.admin_name ||
      payload.name ||
      ""
    ).trim();

    const pin = String(payload.pin || "").trim();

    const admin = await env.DB.prepare(
      `SELECT admin_id
       FROM ADMIN_USERS
       WHERE (
         LOWER(admin_id) = LOWER(?)
         OR LOWER(nama_admin) = LOWER(?)
       )
         AND pin = ?
         AND LOWER(status) = 'aktif'
       LIMIT 1`
    ).bind(adminId, adminName, pin).first();

    if (!admin) {
      throw fault(401, "ADMIN_SESSION_INVALID", "Akses sesi admin tidak sah");
    }
  } else {
    throw fault(401, "SESSION_REQUIRED", "Akses staff diperlukan");
  }

  const [
    studentResult,
    requestResult,
    groupResult,
    institutionResult
  ] = await Promise.all([
    env.DB.prepare(
      `SELECT student_id, no_matrik, nama, kelas, institution_code
       FROM STUDENTS
       WHERE status = 'Aktif'`
    ).all(),

    env.DB.prepare(
      `SELECT rowid AS source_rowid,
              student_id,
              no_matrik,
              masa_mohon,
              status
       FROM OUTING_REQUESTS`
    ).all(),

    env.DB.prepare(
      `SELECT group_code, display_name, institution_required
       FROM STUDENT_GROUPS
       WHERE active = 1
       ORDER BY sort_order, group_code`
    ).all(),

    env.DB.prepare(
      `SELECT institution_code, display_name
       FROM LI_INSTITUTIONS
       WHERE active = 1
       ORDER BY sort_order, institution_code`
    ).all()
  ]);

  const students = studentResult.results || [];
  const requests = requestResult.results || [];
  const groupRows = groupResult.results || [];
  const institutionRows = institutionResult.results || [];

  const normalize = (value) => String(value || "").trim();

  const identityKey = (studentId, noMatrik) => {
    const sid = normalize(studentId);
    const matric = normalize(noMatrik);

    if (sid && matric) {
      return `BOTH:${JSON.stringify([sid, matric])}`;
    }

    if (sid) return `STUDENT:${sid}`;
    if (matric) return `MATRIC:${matric}`;

    return "";
  };

  const requestCandidateIsLater = (candidate, selected) => {
    if (!selected) return true;

    const candidateTime = normalize(candidate.masa_mohon);
    const selectedTime = normalize(selected.masa_mohon);

    if (candidateTime > selectedTime) return true;
    if (candidateTime < selectedTime) return false;

    return Number(candidate.source_rowid || 0) >=
      Number(selected.source_rowid || 0);
  };

  const latestRequestByIdentity = new Map();

  for (const row of requests) {
    const key = identityKey(row.student_id, row.no_matrik);
    if (!key) continue;

    const selected = latestRequestByIdentity.get(key);

    if (requestCandidateIsLater(row, selected)) {
      latestRequestByIdentity.set(key, row);
    }
  }

  const selectCurrentRequest = (student) => {
    const studentId = normalize(student.student_id);
    const noMatrik = normalize(student.no_matrik);

    const keys = [
      identityKey(studentId, noMatrik),
      identityKey(studentId, ""),
      identityKey("", noMatrik)
    ];

    let selected = null;

    for (const key of keys) {
      if (!key) continue;

      const candidate = latestRequestByIdentity.get(key);

      if (candidate && requestCandidateIsLater(candidate, selected)) {
        selected = candidate;
      }
    }

    return selected;
  };

  const configuredGroups = [];
  const groupByStudentId = new Map();

  for (const group of groupRows) {
    const groupCode = normalize(group.group_code).toUpperCase();

    const groupStudents = students.filter(
      (student) =>
        normalize(student.kelas).toUpperCase() === groupCode
    );

    if (Number(group.institution_required || 0) !== 1) {
      if (!groupStudents.length) continue;

      configuredGroups.push({
        label: normalize(group.display_name) || "Kumpulan Pelajar",
        students: groupStudents
      });

      continue;
    }

    for (const institution of institutionRows) {
      const institutionCode =
        normalize(institution.institution_code).toUpperCase();

      const institutionStudents = groupStudents.filter(
        (student) =>
          normalize(student.institution_code).toUpperCase() ===
          institutionCode
      );

      if (!institutionStudents.length) continue;

      configuredGroups.push({
        label: `${normalize(group.display_name)} ${normalize(
          institution.display_name
        )}`.trim() || "Kumpulan Pelajar",
        students: institutionStudents
      });
    }
  }

  const groups = configuredGroups.map((group, index) => {
    const projected = {
      key: `resident-group-${index + 1}`,
      label: group.label,
      count: 0,
      students: []
    };

    for (const student of group.students) {
      const studentId = normalize(student.student_id);
      if (studentId) {
        groupByStudentId.set(studentId, projected);
      }
    }

    return projected;
  });

  let fallbackGroup = null;
  let totalOutNow = 0;

  for (const student of students) {
    const currentRequest = selectCurrentRequest(student);

    const currentlyOut =
      normalize(currentRequest && currentRequest.status).toUpperCase() ===
      "KELUAR";

    if (currentlyOut) {
      totalOutNow += 1;
      continue;
    }

    let group = groupByStudentId.get(normalize(student.student_id));

    if (!group) {
      if (!fallbackGroup) {
        fallbackGroup = {
          key: "resident-group-unconfigured",
          label: "Belum Dikonfigurasi",
          count: 0,
          students: []
        };

        groups.push(fallbackGroup);
      }

      group = fallbackGroup;
    }

    group.count += 1;
    group.students.push({
      nama: normalize(student.nama) || "Pelajar"
    });
  }

  for (const group of groups) {
    group.students.sort((left, right) =>
      left.nama.localeCompare(right.nama, "ms", {
        sensitivity: "base"
      })
    );
  }

  const generatedAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(new Date()).replace(" ", "T") + "+08:00";

  return new Response(JSON.stringify({
    ok: true,
    data: {
      generated_at: generatedAt,
      total: students.length - totalOutNow,
      total_active_students: students.length,
      total_out_now: totalOutNow,
      groups
    }
  }), {
    status: 200,
    headers
  });
}
if (url.pathname === "/api/d1/confirmOut") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();

const requestId = String(payload.request_id || "").trim();
const guardId = String(payload.guard_id || "").trim();
const guardName = String(
  payload.guard_name ||
  payload.nama_guard ||
  payload.user_name ||
  ""
).trim();
const pin = String(payload.pin || "").trim();

if (!requestId || (!guardId && !guardName) || !pin) {
  throw fault(
    400,
    "INVALID_REQUEST",
    "request_id, guard identity and pin are required"
  );
}

const guard = await env.DB.prepare(
  `SELECT guard_id, nama, status
   FROM GUARDS
   WHERE (guard_id = ? OR nama = ?)
     AND pin = ?
     AND status = 'Aktif'
   LIMIT 1`
).bind(guardId, guardName, pin).first();

  if (!guard) {
    throw fault(
      401,
      "GUARD_LOGIN_INVALID",
      "Guard tidak dijumpai atau tidak aktif"
    );
  }

  const requestRow = await env.DB.prepare(
    `SELECT *
     FROM OUTING_REQUESTS
     WHERE request_id = ?
     LIMIT 1`
  ).bind(requestId).first();

  if (!requestRow) {
    throw fault(
      404,
      "REQUEST_NOT_FOUND",
      "Permohonan tidak dijumpai"
    );
  }

  if (requestRow.masa_keluar) {
    return new Response(JSON.stringify({
      ok: true,
      data: {
        request_id: requestId,
        status: requestRow.status,
        masa_keluar: requestRow.masa_keluar,
        message: "Rekod sudah disahkan keluar"
      }
    }), {
      status: 200,
      headers
    });
  }

  if (requestRow.status !== "DILULUSKAN_WARDEN") {
    throw fault(
      409,
      "INVALID_REQUEST_STATUS",
      "Guard hanya boleh sahkan keluar selepas warden meluluskan permohonan"
    );
  }

  const outingType = await env.DB.prepare(
    `SELECT
      display_name,
      departure_allowed_days,
      earliest_departure_time
     FROM OUTING_TYPES
     WHERE type_code = ?
       AND active = 1
     LIMIT 1`
  ).bind(String(requestRow.jenis_permohonan || "").trim()).first();

  const now = new Date();
  const departureAt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now).replace(" ", "T") + "+08:00";

  const todayKey = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);

  const approvedDateKey = String(requestRow.tarikh || "").trim();

  if (approvedDateKey && todayKey < approvedDateKey) {
    throw fault(
      409,
      "DEPARTURE_DATE_TOO_EARLY",
      "Sahkan Keluar hanya boleh dibuat pada tarikh keluar yang diluluskan"
    );
  }

  if (outingType && outingType.departure_allowed_days) {
    const allowedDays = String(outingType.departure_allowed_days)
      .split(",")
      .map((day) => String(day || "").trim().toUpperCase())
      .filter(Boolean);

    const dayName = new Intl.DateTimeFormat("ms-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      weekday: "long"
    }).format(now).toUpperCase();

    if (allowedDays.length && !allowedDays.includes(dayName)) {
      throw fault(
        409,
        "DEPARTURE_DAY_NOT_ALLOWED",
        "Hari keluar tidak dibenarkan untuk jenis outing ini"
      );
    }
  }

  if (outingType && outingType.earliest_departure_time) {
    const currentTime = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);

    const earliestTime = String(
      outingType.earliest_departure_time || ""
    ).trim();

    if (currentTime < earliestTime) {
      throw fault(
        409,
        "DEPARTURE_TOO_EARLY",
        "Waktu keluar paling awal belum tiba"
      );
    }
  }

  const updateResult = await env.DB.prepare(
    `UPDATE OUTING_REQUESTS
     SET status = 'KELUAR',
         masa_keluar = ?,
         guard_keluar_by = ?
     WHERE request_id = ?
       AND status = 'DILULUSKAN_WARDEN'
       AND (masa_keluar IS NULL OR TRIM(masa_keluar) = '')`
  ).bind(
    departureAt,
    guard.nama,
    requestId
  ).run();

  if (!updateResult.meta || Number(updateResult.meta.changes || 0) !== 1) {
    const latestRow = await env.DB.prepare(
      `SELECT status, masa_keluar, guard_keluar_by
       FROM OUTING_REQUESTS
       WHERE request_id = ?
       LIMIT 1`
    ).bind(requestId).first();

    if (latestRow && latestRow.masa_keluar) {
      return new Response(JSON.stringify({
        ok: true,
        data: {
          request_id: requestId,
          status: latestRow.status,
          masa_keluar: latestRow.masa_keluar,
          guard_keluar_by: latestRow.guard_keluar_by,
          message: "Rekod sudah disahkan keluar"
        }
      }), {
        status: 200,
        headers
      });
    }

    throw fault(
      409,
      "CONFIRM_OUT_CONFLICT",
      "Rekod berubah semasa pengesahan keluar. Sila refresh dan cuba semula"
    );
  }

  await env.DB.prepare(
    `INSERT INTO AUDIT_LOG (
      timestamp,
      action,
      request_id,
      user_role,
      user_name,
      details,
      entity_type,
      entity_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    departureAt,
    "CONFIRM_OUT",
    requestId,
    "Guard",
    guard.nama,
    JSON.stringify({
      student_name: requestRow.nama || "",
      no_matrik: requestRow.no_matrik || "",
      jenis_permohonan: requestRow.jenis_permohonan || ""
    }),
    "OUTING_REQUEST",
    requestId
  ).run();

  let approvalActorLabel = "Warden";

  if (requestRow.warden_approve_by) {
    const approver = await env.DB.prepare(
      `SELECT warden_id
       FROM WARDENS
       WHERE UPPER(TRIM(nama)) = UPPER(TRIM(?))
       LIMIT 1`
    ).bind(String(requestRow.warden_approve_by || "").trim()).first();

    if (approver && /^HEP-/i.test(String(approver.warden_id || "").trim())) {
      approvalActorLabel = "HEP";
    }
  }

  const updatedRecord = {
    ...requestRow,
    status: "KELUAR",
    masa_keluar: departureAt,
    guard_keluar_by: guard.nama
  };

  const requestTypeLabel =
    String(outingType && outingType.display_name || "").trim() ||
    String(updatedRecord.jenis_permohonan || "-");

  const formatTelegramDate = (value) => {
    const text = String(value || "").trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text || "-";
    }

    const [year, month, day] = text.split("-");
    return `${day}/${month}/${year}`;
  };

  const formatTelegramTime = (value) => {
    const text = String(value || "").trim();
    const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);

    return match
      ? `${match[1]}:${match[2]}`
      : "-";
  };

  const formatTelegramDateTime = (value) => {
    if (!value) {
      return "-";
    }

    const text = String(value).trim();
    const normalizedText = text.replace(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/,
      "$1T$2+08:00"
    );

    const date = new Date(normalizedText);

    if (isNaN(date.getTime())) {
      return text;
    }

    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kuala_Lumpur",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date).replace(",", "");
  };

  const telegramPrefix =
    updatedRecord.jenis_permohonan === "PULANG_BERMALAM"
      ? "Pulang Bermalam - "
      : updatedRecord.jenis_permohonan === "CUTI_SEMESTER"
        ? "CUTI SEMESTER - "
        : "";

  const telegramLines = [
    `🚪 ${telegramPrefix}Pelajar Disahkan Keluar`,
    "",
    `ID: ${updatedRecord.request_id || "-"}`,
    `Nama: ${updatedRecord.nama || "-"}`,
    `No. Matrik: ${updatedRecord.no_matrik || "-"}`,
    `Kelas: ${updatedRecord.kelas || "-"}`,
    `Jenis: ${requestTypeLabel}`,
    `Status: ${updatedRecord.status || "-"}`,
    `Tujuan: ${updatedRecord.tujuan || "-"}`,
    `Lokasi: ${updatedRecord.lokasi || "-"}`,
    `Kenderaan: ${updatedRecord.jenis_kenderaan || "-"}`
  ];

  if (updatedRecord.butiran_kenderaan) {
    telegramLines.push(`Butiran: ${updatedRecord.butiran_kenderaan}`);
  }

  if (updatedRecord.jenis_permohonan === "KECEMASAN") {
    telegramLines.push(
      `Sebab Kecemasan: ${updatedRecord.sebab_kecemasan || "-"}`,
      `Telefon Waris: ${updatedRecord.telefon_waris || "-"}`,
      `Hubungan Waris: ${updatedRecord.hubungan_waris || "-"}`
    );
  }

  if (
    updatedRecord.jenis_permohonan === "OUTING_HUJUNG_MINGGU" ||
    updatedRecord.jenis_permohonan === "PULANG_BERMALAM" ||
    updatedRecord.jenis_permohonan === "CUTI_SEMESTER"
  ) {
    if (updatedRecord.jenis_permohonan === "CUTI_SEMESTER") {
      telegramLines.push(
        `Tarikh Keluar: ${formatTelegramDate(updatedRecord.tarikh)}`
      );
    }

    const returnDate = formatTelegramDate(updatedRecord.tarikh_balik);
    const returnTime = formatTelegramTime(updatedRecord.masa_balik_dijangka);

    telegramLines.push(
      `Tarikh Pulang Ke Asrama: ${returnDate}`,
      `Masa Dijangka Pulang Ke Asrama: ${returnTime}`,
      `Pulang ke asrama dijangka: ${
        returnDate === "-" && returnTime === "-"
          ? "-"
          : `${returnDate} ${returnTime}`
      }`,
      `Telefon Waris: ${updatedRecord.telefon_waris || "-"}`,
      `Hubungan Waris: ${updatedRecord.hubungan_waris || "-"}`
    );
  }

  if (updatedRecord.warden_approve_by) {
    telegramLines.push(
      `${approvalActorLabel}: ${updatedRecord.warden_approve_by}`
    );
  }

  if (updatedRecord.guard_keluar_by) {
    telegramLines.push(`Guard Keluar: ${updatedRecord.guard_keluar_by}`);
  }

  telegramLines.push(
    "",
    `Masa Mohon: ${formatTelegramDateTime(updatedRecord.masa_mohon)}`,
    `Masa Approve/Tolak: ${formatTelegramDateTime(updatedRecord.masa_approve)}`,
    `Masa Keluar: ${formatTelegramDateTime(updatedRecord.masa_keluar)}`,
    `Masa Masuk: ${formatTelegramDateTime(updatedRecord.masa_masuk)}`
  );

  const telegramEnabled = ["1", "true", "yes", "ya", "enabled", "on"].includes(
    String(env.TELEGRAM_ENABLED || "").trim().toLowerCase()
  );

  if (
    telegramEnabled &&
    env.TELEGRAM_BOT_TOKEN &&
    env.TELEGRAM_CHAT_ID
  ) {
    try {
      await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: telegramLines.join("\n"),
            disable_web_page_preview: true
          })
        }
      );
    } catch (error) {
      // Telegram failure must not roll back confirmOut lifecycle.
    }
  }

const mirrorTask = mirrorOutingRequestToSheets(
  env,
  updatedRecord,
  fetch
).catch(async (mirrorError) => {
  console.error(JSON.stringify({
    action: "confirmOut",
    request_id: requestId,
    event: "OUTING_REQUEST_SHEETS_MIRROR_FAILED",
    error: String(mirrorError && mirrorError.message || mirrorError)
  }));

  try {
    await enqueueMirrorRetry(
      env,
      requestId,
      mirrorError
    );
  } catch (queueError) {
    console.error(JSON.stringify({
      action: "confirmOut",
      request_id: requestId,
      event: "OUTING_REQUEST_MIRROR_RETRY_QUEUE_FAILED",
      error: String(queueError && queueError.message || queueError)
    }));
  }
});

if (context && typeof context.waitUntil === "function") {
  context.waitUntil(mirrorTask);
} else {
  await mirrorTask;
}

  return new Response(JSON.stringify({
    ok: true,
    data: {
      request_id: requestId,
      status: "KELUAR",
      masa_keluar: departureAt,
      guard_keluar_by: guard.nama
    }
  }), {
    status: 200,
    headers
  });
}

if (url.pathname === "/api/d1/confirmIn") {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return new Response(null, {
      status: 204,
      headers
    });
  }

  if (request.method !== "POST") {
    throw fault(405, "METHOD_NOT_ALLOWED", "POST required");
  }

  const payload = await request.json();
const requestId = String(payload.request_id || "").trim();
const guardId = String(payload.guard_id || "").trim();
const guardName = String(
  payload.guard_name ||
  payload.nama_guard ||
  payload.user_name ||
  ""
).trim();
const pin = String(payload.pin || "").trim();
const guardReturnNote = String(
  payload.catatan || payload.catatan_masuk || ""
).trim();

if (!requestId || (!guardId && !guardName) || !pin) {
  throw fault(
    400,
    "INVALID_REQUEST",
    "request_id, guard identity and pin are required"
  );
}

const guard = await env.DB.prepare(
  `SELECT guard_id, nama, status
   FROM GUARDS
   WHERE (guard_id = ? OR nama = ?)
     AND pin = ?
     AND status = 'Aktif'
   LIMIT 1`
).bind(guardId, guardName, pin).first();

  if (!guard) {
    throw fault(
      401,
      "GUARD_LOGIN_INVALID",
      "Guard tidak dijumpai atau tidak aktif"
    );
  }

const requestRow = await env.DB.prepare(
  `SELECT *
   FROM OUTING_REQUESTS
   WHERE request_id = ?
   LIMIT 1`
).bind(requestId).first();

  if (!requestRow) {
    throw fault(
      404,
      "REQUEST_NOT_FOUND",
      "Permohonan tidak dijumpai"
    );
  }

  if (requestRow.masa_masuk) {
    return new Response(JSON.stringify({
      ok: true,
      data: {
        request_id: requestId,
        status: requestRow.status,
        masa_masuk: requestRow.masa_masuk,
        lewat: requestRow.lewat,
        selfie_status: requestRow.selfie_status,
        message: "Rekod sudah disahkan masuk"
      }
    }), {
      status: 200,
      headers
    });
  }

  if (requestRow.status !== "KELUAR") {
    throw fault(
      409,
      "INVALID_REQUEST_STATUS",
      "Hanya permohonan status KELUAR boleh disahkan masuk"
    );
  }

  const actualReturn = new Date();

  const legacyDailyTypes = [
    "OUTING_BIASA",
    "KECEMASAN",
    "OUTING_HUJUNG_MINGGU"
  ];

  const isLegacyDaily = legacyDailyTypes.includes(
    String(requestRow.jenis_permohonan || "").trim()
  );

  let returnDate = String(requestRow.tarikh_balik || "").trim();
  let returnTime = String(requestRow.masa_balik_dijangka || "").trim();

  const isValidDateKey = (value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(value + "T00:00:00+08:00");

    if (Number.isNaN(date.getTime())) {
      return false;
    }

    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);

    return formatted === value;
  };

  const normalizeTime = (value) => {
    const match = String(value || "").trim().match(
      /^([01]\d|2[0-3]):([0-5]\d)$/
    );

    return match ? `${match[1]}:${match[2]}` : "";
  };

  let targetValid = true;

  if (returnDate) {
    if (!isValidDateKey(returnDate)) {
      targetValid = false;
    }
  } else if (isLegacyDaily) {
    returnDate = String(requestRow.tarikh || "").trim();

    if (!isValidDateKey(returnDate)) {
      targetValid = false;
    }
  } else {
    targetValid = false;
  }

  if (targetValid) {
    if (returnTime) {
      returnTime = normalizeTime(returnTime);

      if (!returnTime) {
        targetValid = false;
      }
    } else if (isLegacyDaily) {
      returnTime = "22:00";
    } else {
      targetValid = false;
    }
  }

  let late = "Ya";

  if (targetValid) {
    const expectedReturn = new Date(
      `${returnDate}T${returnTime}:00+08:00`
    );

    if (!Number.isNaN(expectedReturn.getTime())) {
      late = actualReturn.getTime() > expectedReturn.getTime()
        ? "Ya"
        : "Tidak";
    }
  }

  const currentSelfieStatus = String(
    requestRow.selfie_status || ""
  ).trim().toUpperCase();

  const requiresReturnSelfie =
    currentSelfieStatus !== "TIDAK_DIPERLUKAN";

  const returnSelfieStatus = requiresReturnSelfie
    ? "BELUM_HANTAR"
    : "TIDAK_DIPERLUKAN";

  const returnNote =
    guardReturnNote || String(requestRow.catatan || "");

  const returnedAt = actualReturn.toISOString();

  await env.DB.prepare(
    `UPDATE OUTING_REQUESTS
     SET status = 'SELESAI',
         masa_masuk = ?,
         guard_masuk_by = ?,
         lewat = ?,
         selfie_status = ?,
         catatan = ?
     WHERE request_id = ?
       AND status = 'KELUAR'`
  ).bind(
    returnedAt,
    guard.nama,
    late,
    returnSelfieStatus,
    returnNote,
    requestId
  ).run();

  await env.DB.prepare(
  `INSERT INTO AUDIT_LOG (
    timestamp,
    action,
    request_id,
    user_role,
    user_name,
    details,
    entity_type,
    entity_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
).bind(
  returnedAt,
  "CONFIRM_IN",
  requestId,
  "Guard",
  guard.nama,
  JSON.stringify({
    student_name: requestRow.nama || "",
    no_matrik: requestRow.no_matrik || "",
    jenis_permohonan: requestRow.jenis_permohonan || "",
    lewat: late,
    catatan_masuk: guardReturnNote
  }),
  "OUTING_REQUEST",
  requestId
).run();

const updatedRecord = {
  ...requestRow,
  status: "SELESAI",
  masa_masuk: returnedAt,
  guard_masuk_by: guard.nama,
  lewat: late,
  selfie_status: returnSelfieStatus,
  catatan: returnNote
};

const requestTypeLabel =
  String(updatedRecord.jenis_permohonan || "-");

const formatTelegramDate = (value) => {
  const text = String(value || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text || "-";
  }

  const [year, month, day] = text.split("-");
  return `${day}/${month}/${year}`;
};

const formatTelegramTime = (value) => {
  const text = String(value || "").trim();
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);

  return match
    ? `${match[1]}:${match[2]}`
    : "-";
};

const formatTelegramDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const text = String(value).trim();
  const normalizedText = text.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/,
    "$1T$2+08:00"
  );

  const date = new Date(normalizedText);

  if (isNaN(date.getTime())) {
    return text;
  }

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date).replace(",", "");
};

const telegramTitle =
  late === "Ya"
    ? "⚠️ Pelajar Masuk Lewat"
    : "✅ Pelajar Selesai Outing";

const telegramLines = [
  telegramTitle,
  "",
  `ID: ${updatedRecord.request_id || "-"}`,
  `Nama: ${updatedRecord.nama || "-"}`,
  `No. Matrik: ${updatedRecord.no_matrik || "-"}`,
  `Kelas: ${updatedRecord.kelas || "-"}`,
  `Jenis: ${requestTypeLabel}`,
  `Status: ${updatedRecord.status || "-"}`,
  `Tujuan: ${updatedRecord.tujuan || "-"}`,
  `Lokasi: ${updatedRecord.lokasi || "-"}`,
  `Kenderaan: ${updatedRecord.jenis_kenderaan || "-"}`
];

if (updatedRecord.butiran_kenderaan) {
  telegramLines.push(`Butiran: ${updatedRecord.butiran_kenderaan}`);
}

if (updatedRecord.lewat) {
  telegramLines.push(`Lewat: ${updatedRecord.lewat}`);
}

if (updatedRecord.guard_masuk_by) {
  telegramLines.push(`Guard Masuk: ${updatedRecord.guard_masuk_by}`);
}

telegramLines.push(
  "",
  `Masa Mohon: ${formatTelegramDateTime(updatedRecord.masa_mohon)}`,
  `Masa Approve/Tolak: ${formatTelegramDateTime(updatedRecord.masa_approve)}`,
  `Masa Keluar: ${formatTelegramDateTime(updatedRecord.masa_keluar)}`,
  `Masa Masuk: ${formatTelegramDateTime(updatedRecord.masa_masuk)}`
);

const telegramEnabled = ["1", "true", "yes", "ya", "enabled", "on"].includes(
  String(env.TELEGRAM_ENABLED || "").trim().toLowerCase()
);

if (
  telegramEnabled &&
  env.TELEGRAM_BOT_TOKEN &&
  env.TELEGRAM_CHAT_ID
) {
  try {
    await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: telegramLines.join("\n"),
          disable_web_page_preview: true
        })
      }
    );
  } catch (error) {
    // Telegram failure must not roll back confirmIn lifecycle.
  }
}

const mirrorTask = mirrorOutingRequestToSheets(
  env,
  updatedRecord,
  fetch
).catch(async (mirrorError) => {
  console.error(JSON.stringify({
    action: "confirmIn",
    request_id: requestId,
    event: "OUTING_REQUEST_SHEETS_MIRROR_FAILED",
    error: String(mirrorError && mirrorError.message || mirrorError)
  }));

  try {
    await enqueueMirrorRetry(
      env,
      requestId,
      mirrorError
    );
  } catch (queueError) {
    console.error(JSON.stringify({
      action: "confirmIn",
      request_id: requestId,
      event: "OUTING_REQUEST_MIRROR_RETRY_QUEUE_FAILED",
      error: String(queueError && queueError.message || queueError)
    }));
  }
});

if (context && typeof context.waitUntil === "function") {
  context.waitUntil(mirrorTask);
} else {
  await mirrorTask;
}

  return new Response(JSON.stringify({
    ok: true,
    data: {
      request_id: requestId,
      status: "SELESAI",
      masa_masuk: returnedAt,
      guard_masuk_by: guard.nama,
      lewat: late,
      selfie_status: returnSelfieStatus,
      catatan: returnNote
    }
  }), {
    status: 200,
    headers
  });
}

  if (url.pathname !== "/api/gas") {
    throw fault(404, "PATH_NOT_ALLOWED", "API path not found");
  }

  if (!["GET", "POST", "OPTIONS"].includes(request.method)) {
      headers.set("Allow", "GET, POST, OPTIONS");
      throw fault(405, "METHOD_NOT_ALLOWED", "Method not allowed");
    }
    if (request.method === "OPTIONS") {
      const method = request.headers.get("Access-Control-Request-Method");
      const requestedHeaders = (request.headers.get("Access-Control-Request-Headers") || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean);
      if (!["GET", "POST"].includes(method)) throw fault(405, "METHOD_NOT_ALLOWED", "Preflight method not allowed");
      if (requestedHeaders.some((v) => v !== "content-type")) throw fault(400, "HEADERS_NOT_ALLOWED", "Preflight headers not allowed");
      headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
      return finish(null, 204);
    }
    let upstream;
    try {
      upstream = trustedUrl(env.GAS_UPSTREAM_URL);
    } catch {
      throw fault(503, "UPSTREAM_DELIVERY_FAILED", "Upstream configuration unavailable");
    }
    let body;
    const upstreamHeaders = { Accept: "application/json", "Cache-Control": "no-store" };
    if (request.method === "GET") {
      const candidate = url.searchParams.get("action");
      if (!GET_ACTIONS.has(candidate)) throw fault(400, "ACTION_NOT_ALLOWED", "Action not allowed");
      action = candidate;
      const allowedParams = /* @__PURE__ */ new Set(["action", "_ts", ...action === "getOutingStats" ? ["month", "year", "kelas"] : []]);
      for (const [key, value] of url.searchParams) {
        if (!allowedParams.has(key) || url.searchParams.getAll(key).length !== 1 || value.length > 256) {
          throw fault(400, "ACTION_NOT_ALLOWED", "Query parameters not allowed");
        }
        upstream.searchParams.set(key, value);
      }
    } else {
      if (url.search) throw fault(400, "ACTION_NOT_ALLOWED", "POST query not allowed");
      const type = request.headers.get("Content-Type") || "";
      if (!/^text\/plain\s*;\s*charset=utf-8\s*$/i.test(type)) {
        throw fault(415, "INVALID_REQUEST", "Expected text/plain;charset=utf-8");
      }
      body = await readBounded(
        request.body,
        MAX_REQUEST_BYTES,
        fault(413, "REQUEST_TOO_LARGE", "Request too large")
      );
      let payload;
      try {
        payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
      } catch {
        throw fault(400, "INVALID_REQUEST", "Invalid JSON request");
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload) || !POST_ACTIONS.has(payload.action)) {
        throw fault(400, "ACTION_NOT_ALLOWED", "Action not allowed");
      }
      action = payload.action;
      upstreamHeaders["Content-Type"] = type;
    }
    if (env.API_RATE_LIMITER) {
      const result = await env.API_RATE_LIMITER.limit({
        key: request.headers.get("CF-Connecting-IP") || "unknown"
      });
      if (!result.success) {
        headers.set("Retry-After", "60");
        throw fault(429, "RATE_LIMITED", "Too many requests; try again later");
      }
    }
    const maxAttempts = request.method === "GET" && ["http://localhost:8000", "http://127.0.0.1:8000"].includes(env.STAGING_ORIGIN) ? 2 : 1;
    for (attempts = 1; attempts <= maxAttempts; attempts += 1) {
      const controller = new AbortController();
      const timeoutMs = request.method === "POST" ? 12e4 : 6e4;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(fault(504, "UPSTREAM_TIMEOUT", "Upstream timed out"), { retryable: true }));
          controller.abort();
        }, timeoutMs);
      });
      const fetchOnce = /* @__PURE__ */ __name(async (url2, options) => {
        try {
          return await fetch(url2, options);
        } catch {
          throw Object.assign(fault(502, "UPSTREAM_DELIVERY_FAILED", "Upstream unavailable"), { retryable: true });
        }
      }, "fetchOnce");
      const delivery = /* @__PURE__ */ __name(async () => {
        sent = true;
        let response = await fetchOnce(upstream.href, {
          method: request.method,
          body,
          headers: upstreamHeaders,
          redirect: "manual",
          signal: controller.signal
        });
        let followedRedirect = false;
        if (response.status === 302 || response.status === 303) {
          let destination;
          try {
            destination = trustedUrl(response.headers.get("Location"), true);
          } catch {
            await response.body?.cancel();
            throw fault(502, "UPSTREAM_DELIVERY_FAILED", "Upstream redirect rejected");
          }
          await response.body?.cancel();
          followedRedirect = true;
          response = await fetchOnce(destination.href, {
            method: "GET",
            headers: { Accept: "application/json", "Cache-Control": "no-store" },
            redirect: "manual",
            signal: controller.signal
          });
        }
        if (!response.ok) {
          let applicationError = false;
          if (response.status >= 500) {
            const errorBytes = await readBounded(
              response.body,
              MAX_RESPONSE_BYTES,
              fault(502, "UPSTREAM_INVALID_RESPONSE", "Upstream response too large")
            );
            try {
              const errorBody = JSON.parse(new TextDecoder().decode(errorBytes));
              applicationError = errorBody && errorBody.ok === false;
            } catch {
            }
          }
          await response.body?.cancel();
          const temporary = !applicationError && response.status >= 500 || followedRedirect && response.status === 404 && /^text\/html(?:;|$)/i.test(response.headers.get("Content-Type") || "");
          throw Object.assign(fault(502, "UPSTREAM_DELIVERY_FAILED", "Upstream unavailable"), { retryable: temporary });
        }
        const bytes = await readBounded(
          response.body,
          MAX_RESPONSE_BYTES,
          fault(502, "UPSTREAM_INVALID_RESPONSE", "Upstream response too large")
        );
        let result;
        try {
          result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        } catch {
          throw fault(502, "UPSTREAM_INVALID_RESPONSE", "Invalid upstream response");
        }
        if (!result || Array.isArray(result) || typeof result.ok !== "boolean") {
          throw fault(502, "UPSTREAM_INVALID_RESPONSE", "Invalid upstream response");
        }
        if (
  result.ok === true &&
  ["createOutingType", "updateOutingType", "toggleOutingType"].includes(action)
) {
  try {
    await stagingSubmitRequestV230.mirrorOutingTypeToD1(env, result.data);
  } catch (mirrorError) {
    console.error(JSON.stringify({
      request_id: requestId,
      action,
      event: "OUTING_TYPE_D1_MIRROR_FAILED",
      error: String(mirrorError && mirrorError.message || mirrorError)
    }));

    result.warning = "OUTING_TYPE_D1_MIRROR_FAILED";
    return new TextEncoder().encode(JSON.stringify(result));
  }
}

return bytes;
      }, "delivery");
      try {
        return finish(await Promise.race([delivery(), timeout]), 200);
      } catch (error) {
        if (attempts >= maxAttempts || error.retryable !== true || !["UPSTREAM_TIMEOUT", "UPSTREAM_DELIVERY_FAILED"].includes(error.code)) throw error;
      } finally {
        clearTimeout(timer);
        controller.abort();
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    } catch (error) {

  const known = error && error.code && Number.isInteger(error.status);
    return finish(JSON.stringify({
      ok: false,
      error: known ? error.message : "Upstream unavailable",
      code: known ? error.code : "UPSTREAM_DELIVERY_FAILED",
      request_id: requestId,
      outcome_unknown: request.method === "POST" && sent
    }), known ? error.status : 502);
  } finally {
    clearTimeout(timer);
    console.info(JSON.stringify({
      request_id: requestId,
      action,
      method: request.method,
      status: finalStatus,
      duration_ms: Date.now() - started
    }));
  }
}
__name(handleRequest, "handleRequest");
var worker_default = { fetch: handleRequest };
export {
  worker_default as default,
  handleRequest,
  mirrorOutingRequestToSheets,
  enqueueMirrorRetry,
  reconcileMirrorRetryQueue
};
