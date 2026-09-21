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

export async function handleSubmitRequest(request, env, headers, dependencies = {}) {
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
  return new Response(JSON.stringify({ ok: true, data: record }), { status: 201, headers });
}

export { ACTIVE_STATUSES, fault };
