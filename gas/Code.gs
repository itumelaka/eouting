const SPREADSHEET_ID = "1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg";

const SHEETS = {
  students: "STUDENTS",
  wardens: "WARDENS",
  guards: "GUARDS",
  requests: "OUTING_REQUESTS",
  audit: "AUDIT_LOG"
};

const HEADERS = {
  STUDENTS: ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan"],
  WARDENS: ["warden_id", "nama_warden", "email", "no_tel", "pin", "status", "catatan"],
  GUARDS: ["guard_id", "nama_guard", "email", "no_tel", "pin", "status", "catatan"],
  OUTING_REQUESTS: [
    "request_id",
    "tarikh",
    "hari",
    "jenis_permohonan",
    "student_id",
    "no_matrik",
    "nama",
    "student_email",
    "kelas",
    "tujuan",
    "lokasi",
    "jenis_kenderaan",
    "butiran_kenderaan",
    "sebab_kecemasan",
    "telefon_waris",
    "hubungan_waris",
    "catatan_kecemasan",
    "masa_mohon",
    "status",
    "warden_approve_by",
    "masa_approve",
    "masa_keluar",
    "guard_keluar_by",
    "masa_masuk",
    "guard_masuk_by",
    "lewat",
    "selfie_whatsapp",
    "catatan",
    "tarikh_balik",
    "hari_balik",
    "masa_balik_dijangka"
  ],
  AUDIT_LOG: ["timestamp", "action", "request_id", "user_role", "user_name", "details"]
};

const STATUS = {
  pending: "MENUNGGU_KELULUSAN",
  approved: "DILULUSKAN_WARDEN",
  rejected: "DITOLAK_WARDEN",
  out: "KELUAR",
  done: "SELESAI"
};

const REQUEST_TYPE = {
  normal: "OUTING_BIASA",
  emergency: "KECEMASAN",
  overnight: "PULANG_BERMALAM"
};

function doGet(e) {
  try {
    const action = e && e.parameter ? e.parameter.action : "";

    if (action === "health") {
      return jsonResponse({
        status: "ok",
        service: "eOuting ITU API",
        timestamp: now_()
      });
    }

    if (action === "getStudents") return jsonResponse(getStudents());
    if (action === "getWardens") return jsonResponse(getWardens());
    if (action === "getGuards") return jsonResponse(getGuards());
    if (action === "getTodayRecords") return jsonResponse(getTodayRecords());
    if (action === "getOutingStats") return jsonResponse(getOutingStats(e.parameter || {}));

    return errorResponse("Unknown action.");
  } catch (error) {
    return errorResponse(error.message || "Server error.");
  }
}

function doPost(e) {
  try {
    const body = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
    const payload = JSON.parse(body);
    const action = payload.action;

    if (action === "loginStudent") return jsonResponse(loginStudent(payload));
    if (action === "loginWarden") return jsonResponse(loginWarden(payload));
    if (action === "loginGuard") return jsonResponse(loginGuard(payload));
    if (action === "submitRequest") return jsonResponse(submitRequest(payload));
    if (action === "approveRequest") return jsonResponse(approveRequest(payload));
    if (action === "rejectRequest") return jsonResponse(rejectRequest(payload));
    if (action === "confirmOut") return jsonResponse(confirmOut(payload));
    if (action === "confirmIn") return jsonResponse(confirmIn(payload));

    return errorResponse("Unknown action.");
  } catch (error) {
    return errorResponse(error.message || "Server error.");
  }
}

function setupDatabase() {
  Object.keys(HEADERS).forEach((sheetName) => {
    const sheet = getSheet_(sheetName);
    ensureHeaders_(sheet, HEADERS[sheetName]);
    try {
      sheet.setFrozenRows(1);
    } catch (error) {
      // Freezing is a UI convenience only; setup should continue if it fails.
    }
  });

  return {
    ok: true,
    sheets: Object.keys(HEADERS)
  };
}

function getStudents() {
  const sheet = getSheet_(SHEETS.students);
  return getRowsAsObjects_(sheet)
    .filter((row) => isActive_(row.status))
    .map((row) => pick_(row, ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status"]));
}

function getWardens() {
  const sheet = getSheet_(SHEETS.wardens);
  return getRowsAsObjects_(sheet)
    .filter((row) => isActive_(row.status))
    .map((row) => ({
      warden_id: row.warden_id || "",
      nama_warden: row.nama_warden || "",
      email: row.email || "",
      no_tel: row.no_tel || "",
      status: row.status || "",
      catatan: row.catatan || ""
    }));
}

function getGuards() {
  const sheet = getSheet_(SHEETS.guards);
  return getRowsAsObjects_(sheet)
    .filter((row) => isActive_(row.status))
    .map((row) => ({
      guard_id: row.guard_id || "",
      nama_guard: row.nama_guard || "",
      email: row.email || "",
      no_tel: row.no_tel || "",
      status: row.status || "",
      catatan: row.catatan || ""
    }));
}

function loginStudent(payload) {
  const nama = payload.nama || payload.name;
  const noMatrik = payload.no_matrik || payload.matric;

  if (!nama || !noMatrik) {
    throw new Error("Nama dan no_matrik diperlukan.");
  }

  const student = findActiveStudent_(nama, noMatrik);

  if (!student) {
    throw new Error("Pelajar tidak dijumpai atau tidak aktif.");
  }

  return pick_(student, ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status"]);
}

function loginWarden(payload) {
  const wardenName = payload.nama_warden || payload.warden_name || payload.name;
  const pin = payload.pin;

  if (!wardenName || !pin) {
    throw new Error("Nama warden atau PIN tidak sah.");
  }

  const warden = findActiveWarden_(wardenName, pin);
  if (!warden) {
    throw new Error("Nama warden atau PIN tidak sah.");
  }

  return {
    warden_id: warden.warden_id || "",
    nama_warden: warden.nama_warden || "",
    email: warden.email || "",
    no_tel: warden.no_tel || "",
    status: warden.status || "",
    catatan: warden.catatan || ""
  };
}

function loginGuard(payload) {
  const guardName = payload.nama_guard || payload.guard_name || payload.name;
  const pin = payload.pin;

  if (!guardName || !pin) {
    throw new Error("Nama guard atau PIN tidak sah.");
  }

  const guard = findActiveGuard_(guardName, pin);
  if (!guard) {
    throw new Error("Nama guard atau PIN tidak sah.");
  }

  return {
    guard_id: guard.guard_id || "",
    nama_guard: guard.nama_guard || "",
    email: guard.email || "",
    no_tel: guard.no_tel || "",
    status: guard.status || "",
    catatan: guard.catatan || ""
  };
}

function submitRequest(payload) {
  const studentId = payload.student_id;
  const noMatrik = payload.no_matrik;
  const requestType = payload.jenis_permohonan;
  const now = new Date();

  if (!studentId || !noMatrik) {
    throw new Error("student_id dan no_matrik diperlukan.");
  }

  if (requestType !== REQUEST_TYPE.normal && requestType !== REQUEST_TYPE.emergency && requestType !== REQUEST_TYPE.overnight) {
    throw new Error("Jenis permohonan tidak sah.");
  }

  if (requestType === REQUEST_TYPE.normal && !isOutingBiasaOpen_(now)) {
    throw new Error("Outing Biasa hanya dibuka Selasa/Rabu selepas 5:00 PM.");
  }

  if (requestType === REQUEST_TYPE.emergency && !normalizeText_(payload.sebab_kecemasan)) {
    throw new Error("Sebab kecemasan diperlukan.");
  }

  if (requestType === REQUEST_TYPE.overnight) {
    validateOvernightRequest_(payload, now);
  }

  const student = findStudentByIdAndMatric_(studentId, noMatrik);

  if (!student || !isActive_(student.status)) {
    throw new Error("Pelajar tidak dijumpai atau tidak aktif.");
  }

  const requestId = createRequestId_(now);
  const record = {
    request_id: requestId,
    tarikh: formatDate_(now),
    hari: getDayName_(now),
    jenis_permohonan: requestType,
    student_id: String(student.student_id || ""),
    no_matrik: String(student.no_matrik || ""),
    nama: student.nama,
    student_email: student.email || "",
    kelas: student.kelas || "",
    tujuan: payload.tujuan || payload.purpose || "",
    lokasi: payload.lokasi || payload.location || "",
    jenis_kenderaan: payload.jenis_kenderaan || payload.vehicle_type || "",
    butiran_kenderaan: payload.butiran_kenderaan || payload.vehicle_detail || "",
    sebab_kecemasan: payload.sebab_kecemasan || "",
    telefon_waris: String(payload.telefon_waris || ""),
    hubungan_waris: payload.hubungan_waris || "",
    catatan_kecemasan: payload.catatan_kecemasan || "",
    masa_mohon: now_(),
    status: STATUS.pending,
    warden_approve_by: "",
    masa_approve: "",
    masa_keluar: "",
    guard_keluar_by: "",
    masa_masuk: "",
    guard_masuk_by: "",
    lewat: "",
    selfie_whatsapp: "",
    catatan: payload.catatan || "",
    tarikh_balik: payload.tarikh_balik || "",
    hari_balik: payload.hari_balik || getDayNameFromDateKey_(payload.tarikh_balik),
    masa_balik_dijangka: payload.masa_balik_dijangka || ""
  };

  appendObjectRow_(getSheet_(SHEETS.requests), HEADERS.OUTING_REQUESTS, record);
  appendAuditLog("SUBMIT_REQUEST", requestId, "Student", student.nama, JSON.stringify({
    jenis_permohonan: requestType
  }));
  sendTelegramMessage_(buildTelegramSubmitMessage_(record));

  return record;
}

function approveRequest(payload) {
  const requestId = payload.request_id;
  const wardenName = payload.warden_name || payload.nama_warden || payload.user_name;

  if (!requestId || !wardenName) {
    throw new Error("request_id dan nama warden diperlukan.");
  }

  const warden = findActiveWarden_(wardenName, payload.pin);
  if (!warden) {
    throw new Error("Warden tidak dijumpai atau tidak aktif.");
  }

  const found = findRowByRequestId_(requestId);
  if (!found) {
    throw new Error("Permohonan tidak dijumpai.");
  }

  if (found.record.status !== STATUS.pending) {
    throw new Error("Hanya permohonan MENUNGGU_KELULUSAN boleh diluluskan.");
  }

  updateRowByHeaders_(found.sheet, found.rowNumber, {
    status: STATUS.approved,
    warden_approve_by: warden.nama_warden,
    masa_approve: now_()
  });

  appendAuditLog("APPROVE_REQUEST", requestId, "Warden", warden.nama_warden, "");
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(telegramTitle_("✅", "Permohonan Diluluskan Warden", updatedRecord), updatedRecord));
  return updatedRecord;
}

function rejectRequest(payload) {
  const requestId = payload.request_id;
  const wardenName = payload.warden_name || payload.nama_warden || payload.user_name;

  if (!requestId || !wardenName) {
    throw new Error("request_id dan nama warden diperlukan.");
  }

  const warden = findActiveWarden_(wardenName, payload.pin);
  if (!warden) {
    throw new Error("Warden tidak dijumpai atau tidak aktif.");
  }

  const found = findRowByRequestId_(requestId);
  if (!found) {
    throw new Error("Permohonan tidak dijumpai.");
  }

  if (found.record.status !== STATUS.pending) {
    throw new Error("Hanya permohonan MENUNGGU_KELULUSAN boleh ditolak.");
  }

  updateRowByHeaders_(found.sheet, found.rowNumber, {
    status: STATUS.rejected,
    warden_approve_by: warden.nama_warden,
    masa_approve: now_(),
    catatan: payload.catatan || found.record.catatan || ""
  });

  appendAuditLog("REJECT_REQUEST", requestId, "Warden", warden.nama_warden, payload.catatan || "");
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(telegramTitle_("❌", "Permohonan Ditolak Warden", updatedRecord), updatedRecord));
  return updatedRecord;
}

function confirmOut(payload) {
  const requestId = payload.request_id;
  const guardName = payload.guard_name || payload.nama_guard || payload.user_name;

  if (!requestId || !guardName) {
    throw new Error("request_id dan nama guard diperlukan.");
  }

  const guard = findActiveGuard_(guardName, payload.pin);
  if (!guard) {
    throw new Error("Guard tidak dijumpai atau tidak aktif.");
  }

  const found = findRowByRequestId_(requestId);
  if (!found) {
    throw new Error("Permohonan tidak dijumpai.");
  }

  if (hasCellValue_(found.record.masa_keluar)) {
    return {
      ...found.record,
      message: "Rekod sudah disahkan keluar."
    };
  }

  if (found.record.status !== STATUS.approved) {
    throw new Error("Guard hanya boleh sahkan keluar selepas warden meluluskan permohonan.");
  }

  updateRowByHeaders_(found.sheet, found.rowNumber, {
    status: STATUS.out,
    masa_keluar: now_(),
    guard_keluar_by: guard.nama_guard
  });

  appendAuditLog("CONFIRM_OUT", requestId, "Guard", guard.nama_guard, "");
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(telegramTitle_("🚪", "Pelajar Disahkan Keluar", updatedRecord), updatedRecord));
  return updatedRecord;
}

function confirmIn(payload) {
  const requestId = payload.request_id;
  const guardName = payload.guard_name || payload.nama_guard || payload.user_name;
  const now = new Date();

  if (!requestId || !guardName) {
    throw new Error("request_id dan nama guard diperlukan.");
  }

  const guard = findActiveGuard_(guardName, payload.pin);
  if (!guard) {
    throw new Error("Guard tidak dijumpai atau tidak aktif.");
  }

  const found = findRowByRequestId_(requestId);
  if (!found) {
    throw new Error("Permohonan tidak dijumpai.");
  }

  if (hasCellValue_(found.record.masa_masuk)) {
    return {
      ...found.record,
      message: "Rekod sudah disahkan masuk."
    };
  }

  if (found.record.status !== STATUS.out) {
    throw new Error("Hanya permohonan status KELUAR boleh disahkan masuk.");
  }

  const late = found.record.jenis_permohonan === REQUEST_TYPE.overnight
    ? (isOvernightLate_(now, found.record) ? "Ya" : "Tidak")
    : (isLate_(now) ? "Ya" : "Tidak");

  updateRowByHeaders_(found.sheet, found.rowNumber, {
    status: STATUS.done,
    masa_masuk: now_(),
    guard_masuk_by: guard.nama_guard,
    lewat: late
  });

  appendAuditLog("CONFIRM_IN", requestId, "Guard", guard.nama_guard, JSON.stringify({
    lewat: late
  }));
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(
    telegramTitle_(late === "Ya" ? "⚠️" : "🏁", late === "Ya" ? "Pelajar Masuk Lewat" : "Pelajar Selesai Outing", updatedRecord),
    updatedRecord
  ));
  return updatedRecord;
}

function getTodayRecords() {
  const todayKey = formatDate_(new Date());
  return getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => {
      const rowDateKey = normalizeDateKey_(row.tarikh) || normalizeDateKey_(row.masa_mohon);
      const returnDateKey = normalizeDateKey_(row.tarikh_balik);
      const overnightReturningToday = row.jenis_permohonan === REQUEST_TYPE.overnight &&
        row.status === STATUS.out &&
        returnDateKey === todayKey;
      return rowDateKey === todayKey || overnightReturningToday;
    });
}

function getOutingStats(payload) {
  const now = new Date();
  const month = Number(payload.month || Utilities.formatDate(now, "Asia/Kuala_Lumpur", "M"));
  const year = Number(payload.year || Utilities.formatDate(now, "Asia/Kuala_Lumpur", "yyyy"));
  const kelasFilter = normalizeText_(payload.kelas || "");
  const rows = getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => isStatsRecordInMonth_(row, month, year))
    .filter((row) => !kelasFilter || normalizeText_(row.kelas) === kelasFilter)
    .filter((row) => normalizeText_(row.status) !== "" && normalizeText_(row.status) !== "cancelled");

  const totals = {
    total_requests: rows.length,
    total_completed: 0,
    total_pending: 0,
    total_approved: 0,
    total_out: 0,
    total_rejected: 0,
    total_emergency: 0,
    total_normal: 0,
    total_late: 0,
    total_students: 0
  };
  const studentsMap = {};
  const classMap = {};
  const statusMap = {};

  rows.forEach((row) => {
    const status = String(row.status || "");
    const requestType = String(row.jenis_permohonan || "");
    const studentKey = String(row.student_id || row.no_matrik || row.nama || "").trim() || "UNKNOWN";
    const kelas = String(row.kelas || "Tidak Dinyatakan").trim() || "Tidak Dinyatakan";
    const late = String(row.lewat || "").toLowerCase() === "ya";
    const completed = status === STATUS.done;
    const emergency = requestType === REQUEST_TYPE.emergency;
    const normal = requestType === REQUEST_TYPE.normal;
    const requestAt = row.masa_mohon || row.tarikh || "";

    if (status === STATUS.done) totals.total_completed += 1;
    if (status === STATUS.pending) totals.total_pending += 1;
    if (status === STATUS.approved) totals.total_approved += 1;
    if (status === STATUS.out) totals.total_out += 1;
    if (status === STATUS.rejected) totals.total_rejected += 1;
    if (emergency) totals.total_emergency += 1;
    if (normal) totals.total_normal += 1;
    if (late) totals.total_late += 1;

    statusMap[status] = (statusMap[status] || 0) + 1;

    if (!studentsMap[studentKey]) {
      studentsMap[studentKey] = {
        student_id: String(row.student_id || ""),
        no_matrik: String(row.no_matrik || ""),
        nama: String(row.nama || ""),
        kelas: kelas,
        total_requests: 0,
        completed: 0,
        emergency: 0,
        normal: 0,
        late: 0,
        last_request_at: ""
      };
    }

    studentsMap[studentKey].total_requests += 1;
    if (completed) studentsMap[studentKey].completed += 1;
    if (emergency) studentsMap[studentKey].emergency += 1;
    if (normal) studentsMap[studentKey].normal += 1;
    if (late) studentsMap[studentKey].late += 1;
    studentsMap[studentKey].last_request_at = laterDateValue_(studentsMap[studentKey].last_request_at, requestAt);

    if (!classMap[kelas]) {
      classMap[kelas] = {
        kelas: kelas,
        total_requests: 0,
        completed: 0,
        emergency: 0,
        late: 0,
        studentKeys: {}
      };
    }

    classMap[kelas].total_requests += 1;
    if (completed) classMap[kelas].completed += 1;
    if (emergency) classMap[kelas].emergency += 1;
    if (late) classMap[kelas].late += 1;
    classMap[kelas].studentKeys[studentKey] = true;
  });

  const leaderboard = Object.keys(studentsMap)
    .map((key) => studentsMap[key])
    .sort((a, b) => (
      b.total_requests - a.total_requests ||
      b.completed - a.completed ||
      b.late - a.late ||
      String(a.nama).localeCompare(String(b.nama))
    ))
    .map((student, index) => ({
      rank: index + 1,
      student_id: student.student_id,
      no_matrik: student.no_matrik,
      nama: student.nama,
      kelas: student.kelas,
      total_requests: student.total_requests,
      completed: student.completed,
      emergency: student.emergency,
      normal: student.normal,
      late: student.late,
      last_request_at: student.last_request_at
    }));

  const classSummary = Object.keys(classMap)
    .sort()
    .map((kelas) => ({
      kelas: classMap[kelas].kelas,
      total_requests: classMap[kelas].total_requests,
      completed: classMap[kelas].completed,
      emergency: classMap[kelas].emergency,
      late: classMap[kelas].late,
      total_students: Object.keys(classMap[kelas].studentKeys).length
    }));

  totals.total_students = Object.keys(studentsMap).length;

  return {
    month: month,
    year: year,
    generated_at: now_(),
    totals: totals,
    leaderboard: leaderboard,
    class_summary: classSummary,
    status_summary: Object.keys(statusMap).sort().map((status) => ({
      status: status,
      count: statusMap[status]
    }))
  };
}

function isStatsRecordInMonth_(row, month, year) {
  const dateKey = normalizeDateKey_(row.tarikh) || normalizeDateKey_(row.masa_mohon);
  if (!dateKey) {
    return false;
  }

  const parts = dateKey.split("-");
  return Number(parts[0]) === Number(year) && Number(parts[1]) === Number(month);
}

function laterDateValue_(currentValue, nextValue) {
  if (!currentValue) {
    return nextValue || "";
  }

  if (!nextValue) {
    return currentValue;
  }

  const currentDate = parseDateForSort_(currentValue);
  const nextDate = parseDateForSort_(nextValue);
  return nextDate && currentDate && nextDate.getTime() > currentDate.getTime() ? nextValue : currentValue;
}

function parseDateForSort_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value;
  }

  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const parsed = new Date(text.replace(" ", "T"));
  return isNaN(parsed.getTime()) ? null : parsed;
}

function debugGetAllRequests() {
  return getRowsAsObjects_(getSheet_(SHEETS.requests));
}

function appendAuditLog(action, requestId, userRole, userName, details) {
  const record = {
    timestamp: now_(),
    action: action || "",
    request_id: requestId || "",
    user_role: userRole || "",
    user_name: userName || "",
    details: details || ""
  };

  appendObjectRow_(getSheet_(SHEETS.audit), HEADERS.AUDIT_LOG, record);
  return record;
}

function getTelegramConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const enabledValue = String(properties.getProperty("TELEGRAM_ENABLED") || "").trim().toLowerCase();
  const enabled = ["1", "true", "yes", "ya", "enabled", "on"].indexOf(enabledValue) !== -1;

  return {
    enabled: enabled,
    token: properties.getProperty("TELEGRAM_BOT_TOKEN") || "",
    chatId: properties.getProperty("TELEGRAM_CHAT_ID") || ""
  };
}

function sendTelegramMessage_(message) {
  const config = getTelegramConfig_();

  if (!config.enabled || !config.token || !config.chatId || !message) {
    return false;
  }

  try {
    const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + config.token + "/sendMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: config.chatId,
        text: message,
        disable_web_page_preview: true
      }),
      muteHttpExceptions: true
    });

    return response.getResponseCode() >= 200 && response.getResponseCode() < 300;
  } catch (error) {
    return false;
  }
}

function formatTelegramDateTime_(value) {
  if (!value) {
    return "-";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Kuala_Lumpur", "dd/MM/yyyy HH:mm");
  }

  const text = String(value).trim();
  const normalizedText = text.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(:\d{2})?)$/, "$1T$2+08:00");
  const date = new Date(normalizedText);

  if (!isNaN(date.getTime())) {
    return Utilities.formatDate(date, "Asia/Kuala_Lumpur", "dd/MM/yyyy HH:mm");
  }

  return text;
}

function formatTelegramDate_(value) {
  const dateKey = normalizeDateKey_(value);
  if (!dateKey) {
    return "-";
  }

  const date = new Date(dateKey + "T00:00:00+08:00");
  return isNaN(date.getTime()) ? dateKey : Utilities.formatDate(date, "Asia/Kuala_Lumpur", "dd/MM/yyyy");
}

function formatTelegramTime_(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "-";
  }

  if (/^\d{2}:\d{2}/.test(text)) {
    const date = new Date("2000-01-01T" + text.slice(0, 5) + ":00+08:00");
    if (!isNaN(date.getTime())) {
      return Utilities.formatDate(date, "Asia/Kuala_Lumpur", "HH:mm");
    }
  }

  return text;
}

function formatTelegramExpectedReturn_(record) {
  const dateText = formatTelegramDate_(record.tarikh_balik);
  const timeText = formatTelegramTime_(record.masa_balik_dijangka);
  if (dateText === "-" && timeText === "-") {
    return "-";
  }

  return dateText + " " + timeText;
}

function telegramTitle_(icon, text, record) {
  const prefix = record && record.jenis_permohonan === REQUEST_TYPE.overnight
    ? "Pulang Bermalam - "
    : "";
  return icon + " " + prefix + text;
}

function buildTelegramSubmitMessage_(record) {
  let title = "📌 Permohonan Outing Baru";
  if (record.jenis_permohonan === REQUEST_TYPE.emergency) {
    title = "🚨 Permohonan Kecemasan Baru";
  }
  if (record.jenis_permohonan === REQUEST_TYPE.overnight) {
    title = "🏠 Permohonan Pulang Bermalam Baru";
  }

  return buildTelegramStatusMessage_(title, record);
}

function buildTelegramStatusMessage_(title, record) {
  const lines = [
    title,
    "",
    "ID: " + (record.request_id || "-"),
    "Nama: " + (record.nama || "-"),
    "No. Matrik: " + (record.no_matrik || "-"),
    "Kelas: " + (record.kelas || "-"),
    "Jenis: " + requestTypeLabel_(record.jenis_permohonan),
    "Status: " + (record.status || "-"),
    "Tujuan: " + (record.tujuan || "-"),
    "Lokasi: " + (record.lokasi || "-"),
    "Kenderaan: " + (record.jenis_kenderaan || "-")
  ];

  if (record.butiran_kenderaan) {
    lines.push("Butiran: " + record.butiran_kenderaan);
  }

  if (record.jenis_permohonan === REQUEST_TYPE.emergency) {
    lines.push("Sebab Kecemasan: " + (record.sebab_kecemasan || "-"));
    lines.push("Telefon Waris: " + (record.telefon_waris || "-"));
    lines.push("Hubungan Waris: " + (record.hubungan_waris || "-"));
  }

  if (record.jenis_permohonan === REQUEST_TYPE.overnight) {
    lines.push("Tarikh Pulang Ke Asrama: " + formatTelegramDate_(record.tarikh_balik));
    lines.push("Masa Dijangka Pulang Ke Asrama: " + formatTelegramTime_(record.masa_balik_dijangka));
    lines.push("Pulang ke asrama dijangka: " + formatTelegramExpectedReturn_(record));
    lines.push("Telefon Waris: " + (record.telefon_waris || "-"));
    lines.push("Hubungan Waris: " + (record.hubungan_waris || "-"));
  }

  if (record.warden_approve_by) {
    lines.push("Warden: " + record.warden_approve_by);
  }

  if (record.guard_keluar_by) {
    lines.push("Guard Keluar: " + record.guard_keluar_by);
  }

  if (record.guard_masuk_by) {
    lines.push("Guard Masuk: " + record.guard_masuk_by);
  }

  if (record.lewat) {
    lines.push("Lewat: " + record.lewat);
  }

  lines.push("");
  lines.push("Masa Mohon: " + formatTelegramDateTime_(record.masa_mohon));
  lines.push("Masa Approve/Tolak: " + formatTelegramDateTime_(record.masa_approve));
  lines.push("Masa Keluar: " + formatTelegramDateTime_(record.masa_keluar));
  lines.push("Masa Masuk: " + formatTelegramDateTime_(record.masa_masuk));

  return lines.join("\n");
}

function requestTypeLabel_(requestType) {
  if (requestType === REQUEST_TYPE.normal) return "Outing Biasa";
  if (requestType === REQUEST_TYPE.emergency) return "Kecemasan";
  if (requestType === REQUEST_TYPE.overnight) return "Pulang Bermalam";
  return requestType || "-";
}

function testTelegramNotification() {
  return sendTelegramMessage_("✅ Ujian Telegram eOuting ITU berjaya.");
}

function jsonResponse(data) {
  const response = {
    ok: true,
    data: data
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function errorResponse(message) {
  const response = {
    ok: false,
    error: message || "Unknown error."
  };

  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet_(name) {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
}

function getRowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return [];
  }

  const headers = values[0].map((header) => String(header).trim());
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== ""))
    .map((row) => {
      const object = {};
      headers.forEach((header, index) => {
        object[header] = row[index];
      });
      return object;
    });
}

function appendObjectRow_(sheet, headers, object) {
  ensureHeaders_(sheet, headers);
  const row = headers.map((header) => object[header] !== undefined ? object[header] : "");
  sheet.appendRow(row);
}

function findRowByRequestId_(requestId) {
  const sheet = getSheet_(SHEETS.requests);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }

  const headers = values[0].map((header) => String(header).trim());
  const requestIdIndex = headers.indexOf("request_id");
  if (requestIdIndex === -1) {
    return null;
  }

  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][requestIdIndex]) === String(requestId)) {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = values[i][index];
      });
      return {
        sheet: sheet,
        rowNumber: i + 1,
        record: record
      };
    }
  }

  return null;
}

function updateRowByHeaders_(sheet, rowNumber, updates) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map((header) => String(header).trim());

  Object.keys(updates).forEach((key) => {
    const columnIndex = headers.indexOf(key);
    if (columnIndex !== -1) {
      sheet.getRange(rowNumber, columnIndex + 1).setValue(updates[key]);
    }
  });
}

function normalizeText_(value) {
  return String(value || "").trim().toLowerCase();
}

function hasCellValue_(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function now_() {
  return Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyy-MM-dd HH:mm:ss");
}

function formatDate_(date) {
  return Utilities.formatDate(date, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
}

function normalizeDateKey_(value) {
  if (!value) {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return formatDate_(value);
  }

  const text = String(value).trim();
  const isoDateMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);

  if (isoDateMatch) {
    return isoDateMatch[1];
  }

  const parsedDate = new Date(text);
  if (!isNaN(parsedDate.getTime())) {
    return formatDate_(parsedDate);
  }

  return "";
}

function getDayName_(date) {
  const dayNames = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  return dayNames[date.getDay()];
}

function isOutingBiasaOpen_(date) {
  const day = date.getDay();
  const hour = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "H"));
  const isTuesdayOrWednesday = day === 2 || day === 3;
  return isTuesdayOrWednesday && hour >= 17;
}

function validateOvernightRequest_(payload, keluarDate) {
  const returnDateKey = normalizeDateKey_(payload.tarikh_balik);
  const expectedReturnTime = String(payload.masa_balik_dijangka || "").trim();
  const keluarDateKey = formatDate_(keluarDate);

  if (!returnDateKey || !expectedReturnTime) {
    throw new Error("Tarikh Pulang Ke Asrama dan Masa Dijangka Pulang Ke Asrama diperlukan untuk Pulang Bermalam.");
  }

  if (returnDateKey < keluarDateKey) {
    throw new Error("Tarikh Pulang Ke Asrama tidak boleh lebih awal daripada tarikh keluar.");
  }

  if (!/^\d{2}:\d{2}/.test(expectedReturnTime)) {
    throw new Error("Masa Dijangka Pulang Ke Asrama tidak sah.");
  }

  const day = keluarDate.getDay();
  const hour = Number(Utilities.formatDate(keluarDate, "Asia/Kuala_Lumpur", "H"));
  const minute = Number(Utilities.formatDate(keluarDate, "Asia/Kuala_Lumpur", "m"));
  if (day === 5 && (hour < 17 || (hour === 17 && minute === 0))) {
    throw new Error("Pulang Bermalam pada hari Jumaat hanya boleh bermula selepas 5:00 PM.");
  }
}

function isLate_(date) {
  const hour = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "H"));
  const minute = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "m"));
  return hour > 22 || (hour === 22 && minute > 0);
}

function isOvernightLate_(date, record) {
  const returnDateKey = normalizeDateKey_(record.tarikh_balik);
  const expectedReturnTime = String(record.masa_balik_dijangka || "").trim();
  if (!returnDateKey || !expectedReturnTime) {
    return false;
  }

  const expectedReturn = new Date(returnDateKey + "T" + expectedReturnTime.slice(0, 5) + ":00+08:00");
  return !isNaN(expectedReturn.getTime()) && date.getTime() > expectedReturn.getTime();
}

function getDayNameFromDateKey_(dateKey) {
  const normalizedDateKey = normalizeDateKey_(dateKey);
  if (!normalizedDateKey) {
    return "";
  }

  return getDayName_(new Date(normalizedDateKey + "T00:00:00+08:00"));
}

function ensureHeaders_(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length))
    .getValues()[0]
    .map((header) => String(header).trim());

  const isHeaderBlank = currentHeaders.every((header) => header === "");
  if (isHeaderBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const missingHeaders = headers.filter((header) => currentHeaders.indexOf(header) === -1);
  if (missingHeaders.length > 0) {
    sheet.getRange(1, currentHeaders.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function findActiveStudent_(nama, noMatrik) {
  return getRowsAsObjects_(getSheet_(SHEETS.students)).find((student) => (
    normalizeText_(student.nama) === normalizeText_(nama) &&
    normalizeText_(student.no_matrik) === normalizeText_(noMatrik) &&
    isActive_(student.status)
  ));
}

function findStudentByIdAndMatric_(studentId, noMatrik) {
  return getRowsAsObjects_(getSheet_(SHEETS.students)).find((student) => (
    normalizeText_(student.student_id) === normalizeText_(studentId) &&
    normalizeText_(student.no_matrik) === normalizeText_(noMatrik)
  ));
}

function findActiveWarden_(wardenName, pin) {
  return getRowsAsObjects_(getSheet_(SHEETS.wardens)).find((warden) => (
    normalizeText_(warden.nama_warden) === normalizeText_(wardenName) &&
    isActive_(warden.status) &&
    (pin === undefined || pin === null || pin === "" || String(warden.pin) === String(pin))
  ));
}

function findActiveGuard_(guardName, pin) {
  return getRowsAsObjects_(getSheet_(SHEETS.guards)).find((guard) => (
    normalizeText_(guard.nama_guard) === normalizeText_(guardName) &&
    isActive_(guard.status) &&
    (pin === undefined || pin === null || pin === "" || String(guard.pin) === String(pin))
  ));
}

function isActive_(status) {
  return normalizeText_(status) === "aktif";
}

function pick_(object, keys) {
  const result = {};
  keys.forEach((key) => {
    result[key] = object[key] || "";
  });
  return result;
}

function createRequestId_(date) {
  const datePart = Utilities.formatDate(date, "Asia/Kuala_Lumpur", "yyyyMMdd-HHmmss");
  const randomPart = Math.floor(Math.random() * 9000) + 1000;
  return "OUT-" + datePart + "-" + randomPart;
}
