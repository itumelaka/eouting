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
    "catatan"
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
  emergency: "KECEMASAN"
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

function submitRequest(payload) {
  const studentId = payload.student_id;
  const noMatrik = payload.no_matrik;
  const requestType = payload.jenis_permohonan;
  const now = new Date();

  if (!studentId || !noMatrik) {
    throw new Error("student_id dan no_matrik diperlukan.");
  }

  if (requestType !== REQUEST_TYPE.normal && requestType !== REQUEST_TYPE.emergency) {
    throw new Error("Jenis permohonan tidak sah.");
  }

  if (requestType === REQUEST_TYPE.normal && !isOutingBiasaOpen_(now)) {
    throw new Error("Outing Biasa hanya dibuka Selasa/Rabu selepas 5:00 PM.");
  }

  if (requestType === REQUEST_TYPE.emergency && !normalizeText_(payload.sebab_kecemasan)) {
    throw new Error("Sebab kecemasan diperlukan.");
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
    student_id: student.student_id,
    no_matrik: student.no_matrik,
    nama: student.nama,
    student_email: student.email || "",
    kelas: student.kelas || "",
    tujuan: payload.tujuan || payload.purpose || "",
    lokasi: payload.lokasi || payload.location || "",
    jenis_kenderaan: payload.jenis_kenderaan || payload.vehicle_type || "",
    butiran_kenderaan: payload.butiran_kenderaan || payload.vehicle_detail || "",
    sebab_kecemasan: payload.sebab_kecemasan || "",
    telefon_waris: payload.telefon_waris || "",
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
    catatan: payload.catatan || ""
  };

  appendObjectRow_(getSheet_(SHEETS.requests), HEADERS.OUTING_REQUESTS, record);
  appendAuditLog("SUBMIT_REQUEST", requestId, "Student", student.nama, JSON.stringify({
    jenis_permohonan: requestType
  }));

  return record;
}

function approveRequest(payload) {
  const requestId = payload.request_id;
  const wardenName = payload.warden_name || payload.nama_warden || payload.user_name;

  if (!requestId || !wardenName) {
    throw new Error("request_id dan nama warden diperlukan.");
  }

  const warden = findActiveWarden_(wardenName);
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
  return findRowByRequestId_(requestId).record;
}

function rejectRequest(payload) {
  const requestId = payload.request_id;
  const wardenName = payload.warden_name || payload.nama_warden || payload.user_name;

  if (!requestId || !wardenName) {
    throw new Error("request_id dan nama warden diperlukan.");
  }

  const warden = findActiveWarden_(wardenName);
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
  return findRowByRequestId_(requestId).record;
}

function confirmOut(payload) {
  const requestId = payload.request_id;
  const guardName = payload.guard_name || payload.nama_guard || payload.user_name;

  if (!requestId || !guardName) {
    throw new Error("request_id dan nama guard diperlukan.");
  }

  const guard = findActiveGuard_(guardName);
  if (!guard) {
    throw new Error("Guard tidak dijumpai atau tidak aktif.");
  }

  const found = findRowByRequestId_(requestId);
  if (!found) {
    throw new Error("Permohonan tidak dijumpai.");
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
  return findRowByRequestId_(requestId).record;
}

function confirmIn(payload) {
  const requestId = payload.request_id;
  const guardName = payload.guard_name || payload.nama_guard || payload.user_name;
  const now = new Date();

  if (!requestId || !guardName) {
    throw new Error("request_id dan nama guard diperlukan.");
  }

  const guard = findActiveGuard_(guardName);
  if (!guard) {
    throw new Error("Guard tidak dijumpai atau tidak aktif.");
  }

  const found = findRowByRequestId_(requestId);
  if (!found) {
    throw new Error("Permohonan tidak dijumpai.");
  }

  if (found.record.status !== STATUS.out) {
    throw new Error("Hanya permohonan status KELUAR boleh disahkan masuk.");
  }

  const late = isLate_(now) ? "Ya" : "Tidak";

  updateRowByHeaders_(found.sheet, found.rowNumber, {
    status: STATUS.done,
    masa_masuk: now_(),
    guard_masuk_by: guard.nama_guard,
    lewat: late
  });

  appendAuditLog("CONFIRM_IN", requestId, "Guard", guard.nama_guard, JSON.stringify({
    lewat: late
  }));
  return findRowByRequestId_(requestId).record;
}

function getTodayRecords() {
  const today = formatDate_(new Date());
  return getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => String(row.tarikh) === today);
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

function now_() {
  return Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyy-MM-dd HH:mm:ss");
}

function formatDate_(date) {
  return Utilities.formatDate(date, "Asia/Kuala_Lumpur", "yyyy-MM-dd");
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

function isLate_(date) {
  const hour = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "H"));
  const minute = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "m"));
  return hour > 22 || (hour === 22 && minute > 0);
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

function findActiveWarden_(wardenName) {
  return getRowsAsObjects_(getSheet_(SHEETS.wardens)).find((warden) => (
    normalizeText_(warden.nama_warden) === normalizeText_(wardenName) &&
    isActive_(warden.status)
  ));
}

function findActiveGuard_(guardName) {
  return getRowsAsObjects_(getSheet_(SHEETS.guards)).find((guard) => (
    normalizeText_(guard.nama_guard) === normalizeText_(guardName) &&
    isActive_(guard.status)
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
