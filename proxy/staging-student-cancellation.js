import { mirrorOutingRequestToSheets } from "./staging-worker-base.js";

const text = value => String(value ?? "").trim();
const normalized = value => text(value).toLowerCase();
const fault = (status, code, message) => Object.assign(new Error(message), { status, code });

function malaysiaTimestamp(date) {
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
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
}

function telegramDateTime(value) {
  const raw = text(value);
  if (!raw) return "-";
  const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
    ? raw.replace(" ", "T") + "+08:00"
    : raw);
  if (Number.isNaN(date.getTime())) return raw;
  const stamp = malaysiaTimestamp(date);
  return `${stamp.slice(8, 10)}/${stamp.slice(5, 7)}/${stamp.slice(0, 4)} ${stamp.slice(11, 16)}`;
}

async function requestTypeLabel(record, env) {
  try {
    const config = await env.DB.prepare(
      "SELECT display_name FROM OUTING_TYPES WHERE type_code = ? LIMIT 1"
    ).bind(record.jenis_permohonan).first();
    if (text(config?.display_name)) return text(config.display_name);
  } catch { /* Match GAS built-in fallback when config lookup is unavailable. */ }
  return ({
    OUTING_BIASA: "Outing Biasa",
    OUTING_HUJUNG_MINGGU: "Outing Sabtu / Ahad",
    KECEMASAN: "Kecemasan",
    PULANG_BERMALAM: "Pulang Bermalam",
    CUTI_SEMESTER: "CUTI SEMESTER"
  })[record.jenis_permohonan] || record.jenis_permohonan || "-";
}

async function previousStatusLabel(previousStatus, record, env) {
  if (previousStatus === "MENUNGGU_KELULUSAN") return "Menunggu Kelulusan Warden";
  if (previousStatus !== "DILULUSKAN_WARDEN") return "Status Tidak Diketahui";
  try {
    const directory = await env.DB.prepare("SELECT warden_id, nama FROM WARDENS").all();
    const staff = (directory.results || []).find(row => normalized(row.nama) === normalized(record.warden_approve_by));
    if (/^HEP-/i.test(text(staff?.warden_id))) return "Diluluskan HEP";
  } catch { /* GAS falls back to WARDEN when the role cannot be resolved. */ }
  return "Diluluskan Warden";
}

async function sendCancellationTelegram(record, previousStatus, env, fetchImpl) {
  if (!["1", "true", "yes", "ya", "enabled", "on"].includes(normalized(env.TELEGRAM_ENABLED)) ||
      !text(env.TELEGRAM_BOT_TOKEN) || !text(env.TELEGRAM_CHAT_ID)) return false;
  try {
    const message = [
      "🚫 PERMOHONAN DIBATALKAN PELAJAR",
      "",
      `Nama: ${record.nama || "-"}`,
      `No. Matrik: ${record.no_matrik || "-"}`,
      `Jenis: ${await requestTypeLabel(record, env)}`,
      `Status sebelum batal: ${await previousStatusLabel(previousStatus, record, env)}`,
      `Sebab: ${record.sebab_batal_pelajar || "-"}`,
      `Masa: ${telegramDateTime(record.masa_batal_pelajar)}`
    ].join("\n");
    const response = await fetchImpl(`https://api.telegram.org/bot${text(env.TELEGRAM_BOT_TOKEN)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: text(env.TELEGRAM_CHAT_ID), text: message })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function handleStudentCancellation(request, env, headers, options = {}) {
  if (request.method === "OPTIONS") {
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "POST") throw fault(405, "METHOD_NOT_ALLOWED", "POST required");

  let payload;
  try { payload = await request.json(); }
  catch { throw fault(400, "INVALID_REQUEST", "Invalid JSON request"); }
  const requestId = text(payload?.request_id);
  const studentId = text(payload?.student_id || payload?.id);
  const noMatrik = text(payload?.no_matrik || payload?.matric);
  const reason = text(payload?.sebab_batal_pelajar || payload?.reason);
  if (reason.length < 5) {
    throw fault(400, "INVALID_CANCELLATION_REASON", "Sebab Batal Permohonan mesti sekurang-kurangnya 5 aksara.");
  }
  if (reason.length > 500) {
    throw fault(400, "INVALID_CANCELLATION_REASON", "Sebab Batal Permohonan tidak boleh melebihi 500 aksara.");
  }
  if (!requestId || !studentId || !noMatrik) {
    throw fault(400, "INVALID_REQUEST", "request_id, student_id dan no_matrik diperlukan.");
  }

  const students = await env.DB.prepare(
    "SELECT student_id, no_matrik, nama, status FROM STUDENTS WHERE student_id = ? COLLATE NOCASE LIMIT 1"
  ).bind(studentId).all();
  const student = (students.results || []).find(row =>
    normalized(row.student_id) === normalized(studentId) &&
    normalized(row.no_matrik) === normalized(noMatrik) &&
    normalized(row.status) === "aktif"
  );
  if (!student) throw fault(401, "STUDENT_SESSION_INVALID", "Akses sesi pelajar tidak sah.");

  const readRecord = () => env.DB.prepare(
    "SELECT * FROM OUTING_REQUESTS WHERE request_id = ? LIMIT 1"
  ).bind(requestId).first();
  const record = await readRecord();
  if (!record) throw fault(404, "REQUEST_NOT_FOUND", "Permohonan tidak dijumpai.");
  if (normalized(record.student_id) !== normalized(student.student_id) ||
      normalized(record.no_matrik) !== normalized(student.no_matrik)) {
    throw fault(403, "REQUEST_NOT_OWNED", "Anda tidak dibenarkan membatalkan permohonan pelajar lain.");
  }

  const previousStatus = text(record.status).toUpperCase();
  if (!["MENUNGGU_KELULUSAN", "DILULUSKAN_WARDEN"].includes(previousStatus)) {
    throw fault(409, "INVALID_REQUEST_STATUS", "Permohonan ini tidak lagi boleh dibatalkan kerana statusnya telah berubah.");
  }

  const cancelledAt = malaysiaTimestamp((options.now || (() => new Date()))());
  const update = await env.DB.prepare(`UPDATE OUTING_REQUESTS
    SET status = ?, sebab_batal_pelajar = ?, masa_batal_pelajar = ?, dibatalkan_oleh = ?
    WHERE request_id = ? AND status = ? AND student_id = ? COLLATE NOCASE AND no_matrik = ? COLLATE NOCASE`)
    .bind("DIBATALKAN_PELAJAR", reason, cancelledAt, "PELAJAR", requestId, previousStatus,
      student.student_id, student.no_matrik).run();
  if (update.meta?.changes !== 1) {
    const authoritative = await readRecord();
    if (!authoritative) throw fault(404, "REQUEST_NOT_FOUND", "Permohonan tidak dijumpai.");
    throw fault(409, "INVALID_REQUEST_STATUS", "Permohonan ini tidak lagi boleh dibatalkan kerana statusnya telah berubah.");
  }

  const updated = {
    ...record,
    status: "DIBATALKAN_PELAJAR",
    sebab_batal_pelajar: reason,
    masa_batal_pelajar: cancelledAt,
    dibatalkan_oleh: "PELAJAR"
  };
  const details = JSON.stringify({
    student_name: student.nama || "",
    no_matrik: student.no_matrik || "",
    jenis_permohonan: updated.jenis_permohonan || "",
    status_sebelum: previousStatus,
    sebab_batal_pelajar: reason
  });
  try {
    await env.DB.prepare(`INSERT INTO AUDIT_LOG
      (timestamp, action, request_id, user_role, user_name, details, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(cancelledAt, "CANCEL_STUDENT_REQUEST", requestId, "Student", student.nama || "", details, "", "").run();
  } catch { /* Persistence already succeeded; do not make the client replay the mutation. */ }

  await sendCancellationTelegram(updated, previousStatus, env, options.fetchImpl || fetch);
  try {
  await mirrorOutingRequestToSheets(
    env,
    updated,
    options.fetchImpl || fetch
  );
} catch (mirrorError) {
  console.error(JSON.stringify({
    action: "cancelStudentRequest",
    request_id: requestId,
    event: "OUTING_REQUEST_SHEETS_MIRROR_FAILED",
    error: String(mirrorError && mirrorError.message || mirrorError)
  }));
}
  return new Response(JSON.stringify({ ok: true, data: updated }), { status: 200, headers });
}
