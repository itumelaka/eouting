const SPREADSHEET_ID = "1QQ0WKstUTVib6rlMC6TT-mQDAvcSdUGIV2d69no60Pg";

const SHEETS = {
  students: "STUDENTS",
  wardens: "WARDENS",
  guards: "GUARDS",
  requests: "OUTING_REQUESTS",
  audit: "AUDIT_LOG",
  outingTypes: "OUTING_TYPES",
  adminUsers: "ADMIN_USERS"
};

const OUTING_CONFIG_V2_PROPERTY = "OUTING_CONFIG_V2_ENABLED";

const HEADERS = {
  STUDENTS: ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan", "photo_file_id", "photo_updated_at"],
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
    "masa_balik_dijangka",
    "selfie_status",
    "selfie_file_id",
    "selfie_url",
    "masa_selfie",
    "selfie_telegram_message_id"
  ],
  AUDIT_LOG: ["timestamp", "action", "request_id", "user_role", "user_name", "details", "entity_type", "entity_id"],
  OUTING_TYPES: [
    "type_code",
    "display_name",
    "description",
    "active",
    "sort_order",
    "allowed_days",
    "application_open_time",
    "application_close_time",
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
    "require_selfie",
    "config_version",
    "created_at",
    "created_by",
    "updated_at",
    "updated_by"
  ],
  ADMIN_USERS: [
    "admin_id",
    "nama_admin",
    "pin",
    "status",
    "catatan",
    "created_at",
    "updated_at"
  ]
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
  weekend: "OUTING_HUJUNG_MINGGU",
  emergency: "KECEMASAN",
  overnight: "PULANG_BERMALAM",
  semester: "CUTI_SEMESTER"
};

const OUTING_TYPE_BOOLEAN_FIELDS = [
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

const OUTING_TYPE_TIME_FIELDS = [
  "application_open_time",
  "application_close_time",
  "fixed_return_time"
];

const PUBLIC_OUTING_TYPE_FIELDS = [
  "type_code",
  "display_name",
  "description",
  "sort_order",
  "allowed_days",
  "application_open_time",
  "application_close_time",
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
    if (action === "getOutingTypes") return jsonResponse(getOutingTypes());

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
    if (action === "loginAdmin") return jsonResponse(loginAdmin(payload));
    if (action === "getTodayRecords") return jsonResponse(getOperationalTodayRecords(payload));
    if (action === "getStudentAnnualSummary") return jsonResponse(getStudentAnnualSummary(payload));
    if (action === "getAdminIndividualStats") return jsonResponse(getAdminIndividualStats(payload));
    if (action === "getAdminMonitoring") return jsonResponse(getAdminMonitoring(payload));
    if (action === "searchAdminMasterRecords") return jsonResponse(searchAdminMasterRecords(payload));
    if (action === "getAdminStaff") return jsonResponse(getAdminStaff(payload));
    if (action === "createStaff") return jsonResponse(createStaff(payload));
    if (action === "updateStaff") return jsonResponse(updateStaff(payload));
    if (action === "toggleStaffStatus") return jsonResponse(toggleStaffStatus(payload));
    if (action === "getAdminOutingTypes") return jsonResponse(getAdminOutingTypes(payload));
    if (action === "createOutingType") return jsonResponse(createOutingType(payload));
    if (action === "updateOutingType") return jsonResponse(updateOutingType(payload));
    if (action === "toggleOutingType") return jsonResponse(toggleOutingType(payload));
    if (action === "getAdminStudents") return jsonResponse(getAdminStudents(payload));
    if (action === "getStudentProfilePhotos") return jsonResponse(getStudentProfilePhotos(payload));
    if (action === "submitStudentProfilePhoto") return jsonResponse(submitStudentProfilePhoto(payload));
    if (action === "removeStudentProfilePhoto") return jsonResponse(removeStudentProfilePhoto(payload));
    if (action === "createStudent") return jsonResponse(createStudent(payload));
    if (action === "updateStudent") return jsonResponse(updateStudent(payload));
    if (action === "toggleStudentStatus") return jsonResponse(toggleStudentStatus(payload));
    if (action === "submitRequest") return jsonResponse(submitRequest(payload));
    if (action === "approveRequest") return jsonResponse(approveRequest(payload));
    if (action === "rejectRequest") return jsonResponse(rejectRequest(payload));
    if (action === "confirmOut") return jsonResponse(confirmOut(payload));
    if (action === "confirmIn") return jsonResponse(confirmIn(payload));
    if (action === "submitReturnSelfie") return jsonResponse(submitReturnSelfie(payload));

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

function setupAdminOutingConfigV200() {
  const outingTypesSheet = getSheet_(SHEETS.outingTypes);
  const adminUsersSheet = getSheet_(SHEETS.adminUsers);
  const auditSheet = getSheet_(SHEETS.audit);

  ensureHeaders_(outingTypesSheet, HEADERS.OUTING_TYPES);
  ensureHeaders_(adminUsersSheet, HEADERS.ADMIN_USERS);
  ensureHeaders_(auditSheet, HEADERS.AUDIT_LOG);

  [outingTypesSheet, adminUsersSheet, auditSheet].forEach((sheet) => {
    try {
      sheet.setFrozenRows(1);
    } catch (error) {
      // Freezing is a UI convenience only; migration must remain idempotent.
    }
  });

  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(OUTING_CONFIG_V2_PROPERTY) === null) {
    properties.setProperty(OUTING_CONFIG_V2_PROPERTY, "false");
  }

  const existingTypeCodes = {};
  getRowsAsObjects_(outingTypesSheet).forEach((row) => {
    const typeCode = normalizeText_(row.type_code);
    if (typeCode) {
      existingTypeCodes[typeCode] = true;
    }
  });

  const migrationTime = now_();
  const createdBy = "SYSTEM_MIGRATION_V2.0";
  const seedTypes = getDefaultOutingTypeSeedsV200_(migrationTime, createdBy);
  const createdTypeCodes = [];

  seedTypes.forEach((seed) => {
    const normalizedTypeCode = normalizeText_(seed.type_code);
    if (existingTypeCodes[normalizedTypeCode]) {
      return;
    }

    appendObjectRow_(outingTypesSheet, HEADERS.OUTING_TYPES, seed);
    existingTypeCodes[normalizedTypeCode] = true;
    createdTypeCodes.push(seed.type_code);
  });

  return {
    ok: true,
    sheets: [SHEETS.outingTypes, SHEETS.adminUsers, SHEETS.audit],
    created_type_codes: createdTypeCodes,
    total_seed_types: seedTypes.length,
    outing_config_v2_enabled: isOutingConfigV2Enabled_()
  };
}

function getDefaultOutingTypeSeedsV200_(timestamp, createdBy) {
  const allDays = "AHAD,ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU";
  const common = {
    active: true,
    application_close_time: "",
    require_purpose: true,
    require_location: true,
    require_vehicle: true,
    require_warden_approval: true,
    require_selfie: true,
    config_version: 1,
    created_at: timestamp,
    created_by: createdBy,
    updated_at: timestamp,
    updated_by: createdBy
  };

  return [
    {
      ...common,
      type_code: REQUEST_TYPE.normal,
      display_name: "Outing Biasa",
      description: "Outing harian pada Selasa atau Rabu selepas 5:00 petang.",
      sort_order: 1,
      allowed_days: "SELASA,RABU",
      application_open_time: "17:00",
      fixed_return_time: "22:00",
      same_day_only: true,
      require_leave_date: false,
      require_return_date: false,
      require_return_time: false,
      require_guardian_phone: false,
      require_guardian_relation: false,
      require_emergency_reason: false
    },
    {
      ...common,
      type_code: REQUEST_TYPE.weekend,
      display_name: "Outing Sabtu / Ahad",
      description: "Outing hujung minggu yang mesti keluar dan pulang pada hari yang sama.",
      sort_order: 2,
      allowed_days: "SABTU,AHAD",
      application_open_time: "",
      fixed_return_time: "22:00",
      same_day_only: true,
      require_leave_date: true,
      require_return_date: true,
      require_return_time: true,
      require_guardian_phone: false,
      require_guardian_relation: false,
      require_emergency_reason: false
    },
    {
      ...common,
      type_code: REQUEST_TYPE.emergency,
      display_name: "Kecemasan",
      description: "Permohonan kecemasan dengan sebab kecemasan wajib diisi.",
      sort_order: 3,
      allowed_days: allDays,
      application_open_time: "",
      fixed_return_time: "22:00",
      same_day_only: true,
      require_leave_date: false,
      require_return_date: false,
      require_return_time: false,
      require_guardian_phone: false,
      require_guardian_relation: false,
      require_emergency_reason: true
    },
    {
      ...common,
      type_code: REQUEST_TYPE.overnight,
      display_name: "Pulang Bermalam",
      description: "Pulang bermalam dengan tarikh, masa pulang dan maklumat waris.",
      sort_order: 4,
      allowed_days: allDays,
      application_open_time: "",
      fixed_return_time: "",
      same_day_only: false,
      require_leave_date: false,
      require_return_date: true,
      require_return_time: true,
      require_guardian_phone: true,
      require_guardian_relation: true,
      require_emergency_reason: false
    },
    {
      ...common,
      type_code: REQUEST_TYPE.semester,
      display_name: "Cuti Semester",
      description: "Cuti semester dengan tarikh dan masa pulang serta maklumat waris.",
      sort_order: 5,
      allowed_days: allDays,
      application_open_time: "",
      fixed_return_time: "",
      same_day_only: false,
      require_leave_date: false,
      require_return_date: true,
      require_return_time: true,
      require_guardian_phone: true,
      require_guardian_relation: true,
      require_emergency_reason: false
    }
  ];
}

function isOutingConfigV2Enabled_() {
  const value = PropertiesService.getScriptProperties().getProperty(OUTING_CONFIG_V2_PROPERTY);
  return normalizeText_(value) === "true";
}

function getOutingTypeInput_(payload) {
  if (payload && payload.outing_type && typeof payload.outing_type === "object") {
    return payload.outing_type;
  }
  if (payload && payload.config && typeof payload.config === "object") {
    return payload.config;
  }
  return payload || {};
}

function getEditableOutingTypeFields_() {
  return [
    "display_name",
    "description",
    "active",
    "sort_order",
    "allowed_days",
    "application_open_time",
    "application_close_time",
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
}

function validateOutingTypeConfig_(input, options) {
  const data = input || {};
  const config = options || {};
  const typeCode = normalizeOutingTypeCode_(config.typeCode || data.type_code);
  const displayName = String(data.display_name || "").trim();
  const description = String(data.description || "").trim();

  if (config.requireTypeCode && !typeCode) {
    throw new Error("type_code diperlukan.");
  }
  if (!displayName) {
    throw new Error("display_name diperlukan.");
  }
  if (displayName.length > 100) {
    throw new Error("display_name terlalu panjang.");
  }
  if (description.length > 500) {
    throw new Error("description terlalu panjang.");
  }

  const sortOrder = Number(data.sort_order);
  if (!Number.isInteger(sortOrder) || sortOrder < 1 || sortOrder > 9999) {
    throw new Error("sort_order mesti nombor bulat antara 1 dan 9999.");
  }

  const result = {
    type_code: typeCode,
    display_name: displayName,
    description: description,
    sort_order: sortOrder,
    allowed_days: normalizeAllowedDays_(data.allowed_days)
  };

  OUTING_TYPE_TIME_FIELDS.forEach((field) => {
    result[field] = normalizeOptionalTime_(data[field], field);
  });
  OUTING_TYPE_BOOLEAN_FIELDS.forEach((field) => {
    result[field] = requireBoolean_(data[field], field);
  });

  return result;
}

function normalizeOutingTypeCode_(value) {
  const typeCode = String(value || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{2,49}$/.test(typeCode)) {
    throw new Error("type_code mesti uppercase, bermula dengan huruf dan hanya mengandungi A-Z, 0-9 atau underscore.");
  }
  return typeCode;
}

function assertImmutableTypeCode_(typeCode, input) {
  const data = input || {};
  const submittedTypeCode = data.type_code || data.new_type_code || data.updated_type_code;
  if (submittedTypeCode && normalizeOutingTypeCode_(submittedTypeCode) !== typeCode) {
    throw new Error("type_code tidak boleh diubah selepas dicipta.");
  }
}

function normalizeAllowedDays_(value) {
  const allowedDayNames = ["AHAD", "ISNIN", "SELASA", "RABU", "KHAMIS", "JUMAAT", "SABTU"];
  const rawDays = Array.isArray(value) ? value : String(value || "").split(",");
  const days = [];

  rawDays.forEach((day) => {
    const normalizedDay = String(day || "").trim().toUpperCase();
    if (!normalizedDay) {
      return;
    }
    if (allowedDayNames.indexOf(normalizedDay) === -1) {
      throw new Error("allowed_days mengandungi hari yang tidak sah: " + normalizedDay);
    }
    if (days.indexOf(normalizedDay) === -1) {
      days.push(normalizedDay);
    }
  });

  if (days.length === 0) {
    throw new Error("allowed_days mesti mengandungi sekurang-kurangnya satu hari.");
  }
  return days.join(",");
}

function normalizeOptionalTime_(value, fieldName) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  if (!text) {
    return "";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error(fieldName + " mesti menggunakan format HH:mm atau dikosongkan.");
  }
  return text;
}

function requireBoolean_(value, fieldName) {
  if (value !== true && value !== false) {
    throw new Error(fieldName + " mesti boolean true atau false.");
  }
  return value;
}

function normalizeStoredBoolean_(value) {
  if (value === true || value === false) {
    return value;
  }
  const normalized = normalizeText_(value);
  if (normalized === "true" || normalized === "ya" || normalized === "1") {
    return true;
  }
  return false;
}

function getOutingTypeTimeZone_() {
  let timeZone = "";

  try {
    const spreadsheet = SpreadsheetApp.getActive();
    if (spreadsheet && typeof spreadsheet.getSpreadsheetTimeZone === "function") {
      timeZone = String(spreadsheet.getSpreadsheetTimeZone() || "").trim();
    }
  } catch (error) {
    timeZone = "";
  }

  if (!timeZone) {
    try {
      timeZone = String(Session.getScriptTimeZone() || "").trim();
    } catch (error) {
      timeZone = "";
    }
  }

  return timeZone || "Asia/Kuala_Lumpur";
}

function normalizeStoredTimeOnly_(value) {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (isNaN(value.getTime())) {
      return "";
    }
    return Utilities.formatDate(value, getOutingTypeTimeZone_(), "HH:mm");
  }

  const text = String(value).trim();
  const match = text.match(/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/);
  return match ? match[1] + ":" + match[2] : "";
}

function normalizeOutingTypeRecord_(row) {
  const source = row || {};
  const result = {};
  HEADERS.OUTING_TYPES.forEach((field) => {
    result[field] = source[field] === undefined || source[field] === null ? "" : source[field];
  });
  result.type_code = String(result.type_code || "").trim().toUpperCase();
  result.display_name = String(result.display_name || "").trim();
  result.description = String(result.description || "").trim();
  result.sort_order = Number(result.sort_order) || 0;
  result.allowed_days = String(result.allowed_days || "").trim().toUpperCase();
  OUTING_TYPE_TIME_FIELDS.forEach((field) => {
    result[field] = normalizeStoredTimeOnly_(result[field]);
  });
  OUTING_TYPE_BOOLEAN_FIELDS.forEach((field) => {
    result[field] = normalizeStoredBoolean_(result[field]);
  });
  result.config_version = Number(result.config_version) > 0
    ? Math.floor(Number(result.config_version))
    : 1;
  return result;
}

function toPublicOutingType_(row) {
  return pickDefined_(row, PUBLIC_OUTING_TYPE_FIELDS);
}

function toAdminOutingType_(row) {
  const result = pickDefined_(row, HEADERS.OUTING_TYPES);
  OUTING_TYPE_TIME_FIELDS.forEach((field) => {
    result[field] = normalizeStoredTimeOnly_(result[field]);
  });
  return result;
}

function pickDefined_(object, keys) {
  const result = {};
  keys.forEach((key) => {
    result[key] = object[key] === undefined || object[key] === null ? "" : object[key];
  });
  return result;
}

function sortOutingTypes_(rows) {
  return rows.slice().sort((left, right) => {
    const sortDifference = Number(left.sort_order || 0) - Number(right.sort_order || 0);
    if (sortDifference !== 0) {
      return sortDifference;
    }
    return String(left.display_name || left.type_code || "")
      .localeCompare(String(right.display_name || right.type_code || ""));
  });
}

function findOutingTypeRowByCode_(sheet, typeCode) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }
  const headers = values[0].map((header) => String(header).trim());
  const typeCodeIndex = headers.indexOf("type_code");
  if (typeCodeIndex === -1) {
    return null;
  }

  for (let index = 1; index < values.length; index += 1) {
    if (normalizeText_(values[index][typeCodeIndex]) === normalizeText_(typeCode)) {
      const record = {};
      headers.forEach((header, columnIndex) => {
        record[header] = values[index][columnIndex];
      });
      return {
        sheet: sheet,
        rowNumber: index + 1,
        record: record
      };
    }
  }
  return null;
}

function validateExpectedConfigVersion_(value) {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 1) {
    throw new Error("expected_config_version mesti nombor bulat positif.");
  }
  return version;
}

function assertConfigVersionMatches_(currentVersion, expectedVersion) {
  if (Number(currentVersion) !== Number(expectedVersion)) {
    throw new Error(
      "CONFIG_VERSION_CONFLICT: konfigurasi telah berubah. Muat semula sebelum menyimpan."
    );
  }
}

function getOutingTypeChanges_(current, next) {
  const changes = {};
  getEditableOutingTypeFields_().forEach((field) => {
    if (field === "active") {
      return;
    }
    if (String(current[field]) !== String(next[field])) {
      changes[field] = { from: current[field], to: next[field] };
    }
  });
  return changes;
}

function getSafeAdminIdentity_(admin) {
  return String(admin.admin_id || admin.nama_admin || "ADMIN").trim().slice(0, 100);
}

function withScriptLock_(callback, timeoutMessage) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    const safeTimeoutMessage = typeof timeoutMessage === "string" && timeoutMessage.trim()
      ? timeoutMessage.trim()
      : "Konfigurasi sedang dikemas kini. Sila cuba sebentar lagi.";
    throw new Error(safeTimeoutMessage);
  }
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getStudents() {
  const sheet = getSheet_(SHEETS.students);
  return getRowsAsObjects_(sheet)
    .filter((row) => isActive_(row.status))
    .map((row) => pick_(row, ["student_id", "nama", "kelas"]));
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
  const studentId = payload.student_id || payload.id;
  const noMatrik = payload.no_matrik || payload.matric;

  if (!studentId || !noMatrik) {
    throw new Error("student_id dan no_matrik diperlukan.");
  }

  const student = findActiveStudent_(studentId, noMatrik);

  if (!student) {
    throw new Error("Pelajar tidak dijumpai atau tidak aktif.");
  }

  const result = pick_(student, ["student_id", "no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status"]);
  result.has_profile_photo = hasCellValue_(student.photo_file_id);
  result.photo_updated_at = student.photo_updated_at || "";
  return result;
}

function loginWarden(payload) {
  const wardenName = String(payload.nama_warden || payload.warden_name || payload.name || "").trim();
  const pin = String(payload.pin === undefined || payload.pin === null ? "" : payload.pin).trim();

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
  const guardName = String(payload.nama_guard || payload.guard_name || payload.name || "").trim();
  const pin = String(payload.pin === undefined || payload.pin === null ? "" : payload.pin).trim();

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

function loginAdmin(payload) {
  const admin = validateAdminCredentials_(payload);
  return pick_(admin, ["admin_id", "nama_admin", "status", "catatan", "created_at", "updated_at"]);
}

function validateAdminCredentials_(payload) {
  const data = payload || {};
  const adminId = String(data.admin_id || "").trim();
  const adminName = String(data.nama_admin || data.admin_name || data.name || "").trim();
  const pin = String(data.pin === undefined || data.pin === null ? "" : data.pin).trim();

  if ((!adminId && !adminName) || !pin) {
    throw new Error("ID atau nama Admin dan PIN diperlukan.");
  }

  const admin = getAdminByCredentials_(adminId, adminName, pin);
  if (!admin) {
    throw new Error("Admin tidak dijumpai, tidak aktif atau PIN tidak sah.");
  }

  return admin;
}

function getAdminByCredentials_(adminId, adminName, pin) {
  const normalizedId = normalizeText_(adminId);
  const normalizedName = normalizeText_(adminName);
  const normalizedPin = String(pin === undefined || pin === null ? "" : pin).trim();

  if ((!normalizedId && !normalizedName) || !normalizedPin) {
    return null;
  }

  return getRowsAsObjects_(getSheet_(SHEETS.adminUsers)).find((admin) => {
    const identityMatches =
      (normalizedId && normalizeText_(admin.admin_id) === normalizedId) ||
      (normalizedName && normalizeText_(admin.nama_admin) === normalizedName);
    return identityMatches &&
      isActive_(admin.status) &&
      String(admin.pin === undefined || admin.pin === null ? "" : admin.pin).trim() === normalizedPin;
  }) || null;
}

function getOutingTypes() {
  if (!isOutingConfigV2Enabled_()) {
    return getLegacyPublicOutingTypes_();
  }

  const rows = getRowsAsObjects_(getSheet_(SHEETS.outingTypes));
  if (rows.length === 0) {
    return getLegacyPublicOutingTypes_();
  }

  return sortOutingTypes_(rows
    .map(normalizeOutingTypeRecord_)
    .filter((row) => row.active))
    .map(toPublicOutingType_);
}

function getLegacyPublicOutingTypes_() {
  return sortOutingTypes_(getDefaultOutingTypeSeedsV200_("", "")
    .map(normalizeOutingTypeRecord_)
    .filter((row) => row.active))
    .map(toPublicOutingType_);
}

function getAdminOutingTypes(payload) {
  validateAdminCredentials_(payload);
  return sortOutingTypes_(getRowsAsObjects_(getSheet_(SHEETS.outingTypes))
    .map(normalizeOutingTypeRecord_))
    .map(toAdminOutingType_);
}

function getStudentInput_(payload) {
  if (payload && payload.student && typeof payload.student === "object") {
    return payload.student;
  }
  return payload || {};
}

function normalizeStudentStatus_(value, useDefault) {
  const normalized = String(value === undefined || value === null ? "" : value)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!normalized && useDefault) {
    return "AKTIF";
  }
  if (normalized !== "AKTIF" && normalized !== "TIDAK AKTIF") {
    throw new Error("status pelajar mesti AKTIF atau TIDAK AKTIF.");
  }
  return normalized;
}

function validateStudentInput_(input, options) {
  const source = input || {};
  const config = options || {};
  const studentId = String(config.studentId || source.student_id || "").trim();
  const noMatrik = String(source.no_matrik === undefined || source.no_matrik === null ? "" : source.no_matrik).trim();
  const nama = String(source.nama || "").trim();
  const email = String(source.email || "").trim();
  const noTel = String(source.no_tel === undefined || source.no_tel === null ? "" : source.no_tel).trim();
  const kelas = String(source.kelas || "").trim().toUpperCase();
  const jantina = String(source.jantina || "").trim();
  const catatan = String(source.catatan || "").trim();

  if (!studentId) {
    throw new Error("student_id diperlukan.");
  }
  if (studentId.length > 100 || /[\u0000-\u001F\u007F]/.test(studentId)) {
    throw new Error("student_id tidak sah.");
  }
  if (!noMatrik) {
    throw new Error("no_matrik diperlukan.");
  }
  if (noMatrik.length > 100 || /[\u0000-\u001F\u007F]/.test(noMatrik)) {
    throw new Error("no_matrik tidak sah.");
  }
  if (!nama) {
    throw new Error("nama pelajar diperlukan.");
  }
  if (nama.length > 200) {
    throw new Error("nama pelajar terlalu panjang.");
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("email pelajar tidak sah.");
  }
  if (email.length > 200) {
    throw new Error("email pelajar terlalu panjang.");
  }
  if (noTel.length > 50) {
    throw new Error("no_tel pelajar terlalu panjang.");
  }
  if (["A2", "A3", "LI"].indexOf(kelas) === -1) {
    throw new Error("kelas pelajar mesti A2, A3 atau LI.");
  }
  if (jantina.length > 50) {
    throw new Error("jantina pelajar terlalu panjang.");
  }
  if (catatan.length > 500) {
    throw new Error("catatan pelajar terlalu panjang.");
  }

  return {
    student_id: studentId,
    no_matrik: noMatrik,
    nama: nama,
    email: email,
    no_tel: noTel,
    kelas: kelas,
    jantina: jantina,
    status: normalizeStudentStatus_(source.status, Boolean(config.defaultActive)),
    catatan: catatan
  };
}

function normalizeStudentRecord_(row) {
  const source = row || {};
  return {
    student_id: String(source.student_id || "").trim(),
    no_matrik: String(source.no_matrik === undefined || source.no_matrik === null ? "" : source.no_matrik).trim(),
    nama: String(source.nama || "").trim(),
    email: String(source.email || "").trim(),
    no_tel: String(source.no_tel === undefined || source.no_tel === null ? "" : source.no_tel).trim(),
    kelas: String(source.kelas || "").trim().toUpperCase(),
    jantina: String(source.jantina || "").trim(),
    status: String(source.status || "").trim().toUpperCase(),
    catatan: String(source.catatan || "").trim(),
    has_profile_photo: hasCellValue_(source.photo_file_id),
    photo_updated_at: normalizeProfilePhotoUpdatedAt_(source.photo_updated_at)
  };
}

function normalizeProfilePhotoUpdatedAt_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "Asia/Kuala_Lumpur", "yyyy-MM-dd HH:mm:ss");
  }
  return String(value === undefined || value === null ? "" : value).trim();
}

function sortAdminStudents_(rows) {
  const classOrder = { A2: 1, A3: 2, LI: 3 };
  return rows.slice().sort((left, right) => {
    const classDifference = (classOrder[left.kelas] || 99) - (classOrder[right.kelas] || 99);
    if (classDifference !== 0) {
      return classDifference;
    }
    return String(left.nama || left.student_id || "")
      .localeCompare(String(right.nama || right.student_id || ""));
  });
}

function findStudentRowById_(sheet, studentId) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }
  const headers = values[0].map((header) => String(header).trim());
  const studentIdIndex = headers.indexOf("student_id");
  if (studentIdIndex === -1) {
    return null;
  }
  for (let index = 1; index < values.length; index += 1) {
    if (normalizeText_(values[index][studentIdIndex]) === normalizeText_(studentId)) {
      const record = {};
      headers.forEach((header, columnIndex) => {
        record[header] = values[index][columnIndex];
      });
      return { sheet: sheet, rowNumber: index + 1, record: record };
    }
  }
  return null;
}

function findStudentRowByMatric_(sheet, noMatrik, excludedStudentId) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) {
    return null;
  }
  const headers = values[0].map((header) => String(header).trim());
  const studentIdIndex = headers.indexOf("student_id");
  const matricIndex = headers.indexOf("no_matrik");
  if (studentIdIndex === -1 || matricIndex === -1) {
    return null;
  }
  for (let index = 1; index < values.length; index += 1) {
    const sameMatric = normalizeText_(values[index][matricIndex]) === normalizeText_(noMatrik);
    const isExcluded = excludedStudentId
      && normalizeText_(values[index][studentIdIndex]) === normalizeText_(excludedStudentId);
    if (sameMatric && !isExcluded) {
      return { rowNumber: index + 1 };
    }
  }
  return null;
}

function getAdminStudents(payload) {
  validateAdminCredentials_(payload);
  return sortAdminStudents_(getRowsAsObjects_(getSheet_(SHEETS.students))
    .map(normalizeStudentRecord_));
}

function createStudent(payload) {
  const admin = validateAdminCredentials_(payload);
  const input = getStudentInput_(payload);
  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.students);
    const validated = validateStudentInput_(input, { defaultActive: true });
    if (findStudentRowById_(sheet, validated.student_id)) {
      throw new Error("student_id telah wujud.");
    }
    if (findStudentRowByMatric_(sheet, validated.no_matrik, "")) {
      throw new Error("no_matrik telah wujud.");
    }
    appendObjectRow_(sheet, HEADERS.STUDENTS, validated);
    const adminIdentity = getSafeAdminIdentity_(admin);
    appendAuditLog(
      "CREATE_STUDENT",
      "",
      "Admin",
      adminIdentity,
      JSON.stringify({ kelas: validated.kelas, status: validated.status }),
      "STUDENT",
      validated.student_id
    );
    return normalizeStudentRecord_(validated);
  });
}

function updateStudent(payload) {
  const admin = validateAdminCredentials_(payload);
  const studentId = String(payload && payload.student_id || "").trim();
  const input = getStudentInput_(payload);
  if (!studentId) {
    throw new Error("student_id diperlukan.");
  }
  if (input.student_id && normalizeText_(input.student_id) !== normalizeText_(studentId)) {
    throw new Error("student_id tidak boleh diubah selepas dicipta.");
  }

  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.students);
    const found = findStudentRowById_(sheet, studentId);
    if (!found) {
      throw new Error("Pelajar tidak dijumpai.");
    }
    const current = normalizeStudentRecord_(found.record);
    const merged = { ...current };
    ["no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan"]
      .forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(input, field)) {
          merged[field] = input[field];
        }
      });
    const validated = validateStudentInput_(merged, { studentId: current.student_id });
    if (findStudentRowByMatric_(sheet, validated.no_matrik, current.student_id)) {
      throw new Error("no_matrik telah wujud.");
    }
    const changes = {};
    ["no_matrik", "nama", "email", "no_tel", "kelas", "jantina", "status", "catatan"]
      .forEach((field) => {
        if (String(current[field] || "") !== String(validated[field] || "")) {
          changes[field] = true;
        }
      });
    const changedFields = Object.keys(changes);
    if (!changedFields.length) {
      throw new Error("Tiada perubahan pelajar untuk disimpan.");
    }
    updateRowByHeaders_(sheet, found.rowNumber, validated);
    const adminIdentity = getSafeAdminIdentity_(admin);
    appendAuditLog(
      "UPDATE_STUDENT",
      "",
      "Admin",
      adminIdentity,
      JSON.stringify({ changed_fields: changedFields }),
      "STUDENT",
      current.student_id
    );
    return normalizeStudentRecord_(validated);
  });
}

function toggleStudentStatus(payload) {
  payload = payload || {};
  if (Object.prototype.hasOwnProperty.call(payload, "active")) {
    requireBoolean_(payload.active, "active");
  }
  const admin = validateAdminCredentials_(payload);
  const studentId = String(payload && payload.student_id || "").trim();
  const requestedStatus = Object.prototype.hasOwnProperty.call(payload || {}, "active")
    ? (payload.active === true ? "AKTIF" : "TIDAK AKTIF")
    : normalizeStudentStatus_(payload && payload.status, false);
  if (!studentId) {
    throw new Error("student_id diperlukan.");
  }

  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.students);
    const found = findStudentRowById_(sheet, studentId);
    if (!found) {
      throw new Error("Pelajar tidak dijumpai.");
    }
    const current = normalizeStudentRecord_(found.record);
    if (current.status === requestedStatus) {
      throw new Error(requestedStatus === "AKTIF" ? "Pelajar sudah aktif." : "Pelajar sudah tidak aktif.");
    }
    updateRowByHeaders_(sheet, found.rowNumber, { status: requestedStatus });
    const adminIdentity = getSafeAdminIdentity_(admin);
    appendAuditLog(
      requestedStatus === "AKTIF" ? "ACTIVATE_STUDENT" : "DEACTIVATE_STUDENT",
      "",
      "Admin",
      adminIdentity,
      JSON.stringify({ status: { from: current.status, to: requestedStatus } }),
      "STUDENT",
      current.student_id
    );
    return normalizeStudentRecord_({ ...current, status: requestedStatus });
  });
}

function normalizeStaffRole_(value) {
  const role = String(value || "").trim().toUpperCase();
  if (role !== "WARDEN" && role !== "GUARD") {
    throw new Error("role staff mesti WARDEN atau GUARD.");
  }
  return role;
}

function getStaffSheetConfig_(role) {
  const normalizedRole = normalizeStaffRole_(role);
  return normalizedRole === "WARDEN"
    ? { role: normalizedRole, sheetName: SHEETS.wardens, headers: HEADERS.WARDENS, idField: "warden_id", nameField: "nama_warden" }
    : { role: normalizedRole, sheetName: SHEETS.guards, headers: HEADERS.GUARDS, idField: "guard_id", nameField: "nama_guard" };
}

function normalizeStaffStatus_(value, useDefault) {
  const text = String(value === undefined || value === null ? "" : value).trim().toUpperCase().replace(/_/g, " ");
  if (!text && useDefault) return "Aktif";
  if (text === "AKTIF") return "Aktif";
  if (text === "TIDAK AKTIF") return "Tidak Aktif";
  throw new Error("status staff mesti Aktif atau Tidak Aktif.");
}

function toSafeAdminStaff_(row, config) {
  return {
    staff_id: String(row[config.idField] || "").trim(),
    nama: String(row[config.nameField] || "").trim(),
    role: config.role,
    status: normalizeStaffStatus_(row.status, true),
    email: String(row.email || "").trim(),
    no_tel: String(row.no_tel || "").trim(),
    catatan: String(row.catatan || "").trim(),
    pin_configured: Boolean(String(row.pin === undefined || row.pin === null ? "" : row.pin).trim())
  };
}

function findStaffRowById_(sheet, config, staffId) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return null;
  const headers = values[0].map((header) => String(header).trim());
  const idIndex = headers.indexOf(config.idField);
  if (idIndex === -1) return null;
  for (let index = 1; index < values.length; index += 1) {
    if (normalizeText_(values[index][idIndex]) === normalizeText_(staffId)) {
      const record = {};
      headers.forEach((header, columnIndex) => { record[header] = values[index][columnIndex]; });
      return { sheet: sheet, rowNumber: index + 1, record: record };
    }
  }
  return null;
}

function validateStaffInput_(input, config, options) {
  const source = input || {};
  const settings = options || {};
  const staffId = String(settings.staffId || source.staff_id || source[config.idField] || "").trim();
  const nama = String(source.nama || source[config.nameField] || "").trim();
  const pin = String(source.pin === undefined || source.pin === null ? "" : source.pin).trim();
  if (!staffId || staffId.length > 100) throw new Error("staff_id diperlukan dan mesti sah.");
  if (!nama || nama.length > 200) throw new Error("nama staff diperlukan dan mesti sah.");
  if (settings.requirePin && !pin) throw new Error("PIN diperlukan untuk staff baharu.");
  if (pin && (!/^\d{4,12}$/.test(pin))) throw new Error("PIN staff mesti 4 hingga 12 digit.");
  return {
    staff_id: staffId,
    nama: nama,
    email: String(source.email || "").trim(),
    no_tel: String(source.no_tel || "").trim(),
    pin: pin,
    status: normalizeStaffStatus_(source.status, Boolean(settings.defaultActive)),
    catatan: String(source.catatan || "").trim()
  };
}

function getAdminStaff(payload) {
  validateAdminCredentials_(payload);
  const rows = [];
  ["WARDEN", "GUARD"].forEach((role) => {
    const config = getStaffSheetConfig_(role);
    getRowsAsObjects_(getSheet_(config.sheetName)).forEach((row) => rows.push(toSafeAdminStaff_(row, config)));
  });
  return rows.sort((left, right) => left.role.localeCompare(right.role) || left.nama.localeCompare(right.nama, "ms", { sensitivity: "base" }));
}

function createStaff(payload) {
  const admin = validateAdminCredentials_(payload);
  const input = payload && payload.staff && typeof payload.staff === "object" ? payload.staff : payload || {};
  const config = getStaffSheetConfig_(input.role || payload.role);
  return withScriptLock_(function () {
    const sheet = getSheet_(config.sheetName);
    ensureHeaders_(sheet, config.headers);
    const validated = validateStaffInput_(input, config, { defaultActive: true, requirePin: true });
    if (findStaffRowById_(sheet, config, validated.staff_id)) throw new Error("staff_id telah wujud untuk role ini.");
    const duplicateName = getRowsAsObjects_(sheet).some((row) => normalizeText_(row[config.nameField]) === normalizeText_(validated.nama));
    if (duplicateName) throw new Error("Nama staff telah wujud untuk role ini.");
    const record = { email: validated.email, no_tel: validated.no_tel, pin: validated.pin, status: validated.status, catatan: validated.catatan };
    record[config.idField] = validated.staff_id;
    record[config.nameField] = validated.nama;
    appendObjectRow_(sheet, config.headers, record);
    appendAuditLog("CREATE_STAFF", "", "Admin", getSafeAdminIdentity_(admin), JSON.stringify({ role: config.role, status: validated.status }), "STAFF", config.role + ":" + validated.staff_id);
    return toSafeAdminStaff_(record, config);
  });
}

function updateStaff(payload) {
  const admin = validateAdminCredentials_(payload);
  const input = payload && payload.staff && typeof payload.staff === "object" ? payload.staff : payload || {};
  const config = getStaffSheetConfig_(payload.role || input.role);
  const staffId = String(payload.staff_id || input.staff_id || "").trim();
  if (!staffId) throw new Error("staff_id diperlukan.");
  return withScriptLock_(function () {
    const sheet = getSheet_(config.sheetName);
    const found = findStaffRowById_(sheet, config, staffId);
    if (!found) throw new Error("Staff tidak dijumpai.");
    const current = toSafeAdminStaff_(found.record, config);
    const validated = validateStaffInput_({ ...current, ...input, pin: input.pin || "", status: input.status || current.status }, config, { staffId: staffId });
    const duplicateName = getRowsAsObjects_(sheet).some((row) => normalizeText_(row[config.idField]) !== normalizeText_(staffId) && normalizeText_(row[config.nameField]) === normalizeText_(validated.nama));
    if (duplicateName) throw new Error("Nama staff telah wujud untuk role ini.");
    const updates = { email: validated.email, no_tel: validated.no_tel, status: validated.status, catatan: validated.catatan };
    updates[config.nameField] = validated.nama;
    if (validated.pin) updates.pin = validated.pin;
    updateRowByHeaders_(sheet, found.rowNumber, updates);
    const changedFields = Object.keys(updates).filter((field) => field !== "pin" && String(found.record[field] || "") !== String(updates[field] || ""));
    appendAuditLog("UPDATE_STAFF", "", "Admin", getSafeAdminIdentity_(admin), JSON.stringify({ role: config.role, changed_fields: changedFields }), "STAFF", config.role + ":" + staffId);
    if (validated.pin) appendAuditLog("RESET_STAFF_PIN", "", "Admin", getSafeAdminIdentity_(admin), JSON.stringify({ role: config.role }), "STAFF", config.role + ":" + staffId);
    return toSafeAdminStaff_({ ...found.record, ...updates }, config);
  });
}

function toggleStaffStatus(payload) {
  const admin = validateAdminCredentials_(payload);
  const config = getStaffSheetConfig_(payload && payload.role);
  const staffId = String(payload && payload.staff_id || "").trim();
  const active = requireBoolean_(payload && payload.active, "active");
  return withScriptLock_(function () {
    const sheet = getSheet_(config.sheetName);
    const found = findStaffRowById_(sheet, config, staffId);
    if (!found) throw new Error("Staff tidak dijumpai.");
    const status = active ? "Aktif" : "Tidak Aktif";
    if (isActive_(found.record.status) === active) throw new Error(active ? "Staff sudah aktif." : "Staff sudah tidak aktif.");
    updateRowByHeaders_(sheet, found.rowNumber, { status: status });
    appendAuditLog(active ? "ACTIVATE_STAFF" : "DEACTIVATE_STAFF", "", "Admin", getSafeAdminIdentity_(admin), JSON.stringify({ role: config.role, status: status }), "STAFF", config.role + ":" + staffId);
    return toSafeAdminStaff_({ ...found.record, status: status }, config);
  });
}

function createOutingType(payload) {
  const admin = validateAdminCredentials_(payload);
  const input = getOutingTypeInput_(payload);

  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.outingTypes);
    ensureHeaders_(sheet, HEADERS.OUTING_TYPES);
    const typeCode = normalizeOutingTypeCode_(input.type_code || payload.type_code);

    if (findOutingTypeRowByCode_(sheet, typeCode)) {
      throw new Error("type_code telah wujud.");
    }

    const validated = validateOutingTypeConfig_(input, {
      requireTypeCode: true,
      typeCode: typeCode
    });
    const timestamp = now_();
    const adminIdentity = getSafeAdminIdentity_(admin);
    const record = {
      ...validated,
      config_version: 1,
      created_at: timestamp,
      created_by: adminIdentity,
      updated_at: timestamp,
      updated_by: adminIdentity
    };

    appendObjectRow_(sheet, HEADERS.OUTING_TYPES, record);
    appendAuditLog(
      "CREATE_OUTING_TYPE",
      "",
      "Admin",
      adminIdentity,
      JSON.stringify({
        display_name: record.display_name,
        active: record.active,
        sort_order: record.sort_order,
        config_version: record.config_version
      }),
      "OUTING_TYPE",
      record.type_code
    );

    return normalizeOutingTypeRecord_(record);
  });
}

function updateOutingType(payload) {
  const admin = validateAdminCredentials_(payload);
  const typeCode = normalizeOutingTypeCode_(payload.type_code);
  const expectedVersion = validateExpectedConfigVersion_(payload.expected_config_version);
  const input = getOutingTypeInput_(payload);

  assertImmutableTypeCode_(typeCode, input);
  if (Object.prototype.hasOwnProperty.call(input, "active")) {
    throw new Error("Status active hanya boleh diubah melalui toggleOutingType.");
  }

  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.outingTypes);
    const found = findOutingTypeRowByCode_(sheet, typeCode);
    if (!found) {
      throw new Error("Jenis outing tidak dijumpai.");
    }

    const current = normalizeOutingTypeRecord_(found.record);
    assertConfigVersionMatches_(current.config_version, expectedVersion);
    const merged = { ...current };
    getEditableOutingTypeFields_().forEach((field) => {
      if (field !== "active" && Object.prototype.hasOwnProperty.call(input, field)) {
        merged[field] = input[field];
      }
    });

    const validated = validateOutingTypeConfig_(merged, {
      requireTypeCode: true,
      typeCode: typeCode
    });
    const changes = getOutingTypeChanges_(current, validated);
    if (Object.keys(changes).length === 0) {
      throw new Error("Tiada perubahan konfigurasi untuk disimpan.");
    }

    const adminIdentity = getSafeAdminIdentity_(admin);
    const updates = {
      ...validated,
      config_version: current.config_version + 1,
      updated_at: now_(),
      updated_by: adminIdentity
    };
    delete updates.created_at;
    delete updates.created_by;

    updateRowByHeaders_(sheet, found.rowNumber, updates);
    appendAuditLog(
      "UPDATE_OUTING_TYPE",
      "",
      "Admin",
      adminIdentity,
      JSON.stringify({
        changes: changes,
        previous_config_version: current.config_version,
        config_version: updates.config_version
      }),
      "OUTING_TYPE",
      typeCode
    );

    return normalizeOutingTypeRecord_({
      ...current,
      ...updates,
      created_at: current.created_at,
      created_by: current.created_by
    });
  });
}

function toggleOutingType(payload) {
  const admin = validateAdminCredentials_(payload);
  const typeCode = normalizeOutingTypeCode_(payload.type_code);
  const expectedVersion = validateExpectedConfigVersion_(payload.expected_config_version);
  const requestedActive = requireBoolean_(payload.active, "active");

  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.outingTypes);
    const found = findOutingTypeRowByCode_(sheet, typeCode);
    if (!found) {
      throw new Error("Jenis outing tidak dijumpai.");
    }

    const current = normalizeOutingTypeRecord_(found.record);
    assertConfigVersionMatches_(current.config_version, expectedVersion);
    if (current.active === requestedActive) {
      throw new Error(requestedActive ? "Jenis outing sudah aktif." : "Jenis outing sudah tidak aktif.");
    }

    const adminIdentity = getSafeAdminIdentity_(admin);
    const updates = {
      active: requestedActive,
      config_version: current.config_version + 1,
      updated_at: now_(),
      updated_by: adminIdentity
    };
    updateRowByHeaders_(sheet, found.rowNumber, updates);

    appendAuditLog(
      requestedActive ? "ACTIVATE_OUTING_TYPE" : "DEACTIVATE_OUTING_TYPE",
      "",
      "Admin",
      adminIdentity,
      JSON.stringify({
        active: { from: current.active, to: requestedActive },
        previous_config_version: current.config_version,
        config_version: updates.config_version
      }),
      "OUTING_TYPE",
      typeCode
    );

    return normalizeOutingTypeRecord_({ ...current, ...updates });
  });
}

function resolveSubmissionOutingTypeConfigV200_(requestType) {
  if (!isOutingConfigV2Enabled_()) {
    return null;
  }

  let typeCode = "";
  try {
    typeCode = normalizeOutingTypeCode_(requestType);
  } catch (error) {
    throw new Error("Jenis outing tidak tersedia.");
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEETS.outingTypes);
    if (!sheet) {
      throw new Error("MISSING_CONFIG_SHEET");
    }
    const found = findOutingTypeRowByCode_(sheet, typeCode);
    if (!found) {
      throw new Error("NOT_FOUND");
    }

    const stored = Object.assign({}, found.record);
    OUTING_TYPE_BOOLEAN_FIELDS.forEach((field) => {
      if (stored[field] === true || stored[field] === false) {
        return;
      }
      const value = normalizeText_(stored[field]);
      if (value === "true" || value === "ya" || value === "1") {
        stored[field] = true;
        return;
      }
      if (value === "false" || value === "tidak" || value === "0") {
        stored[field] = false;
        return;
      }
      throw new Error("INVALID_BOOLEAN_CONFIG");
    });
    const validated = validateOutingTypeConfig_(stored, {
      requireTypeCode: true,
      typeCode: typeCode
    });
    const configVersion = Number(stored.config_version);

    if (!Number.isInteger(configVersion) || configVersion < 1) {
      throw new Error("INVALID_CONFIG_VERSION");
    }
    if (!validated.active) {
      throw new Error("INACTIVE");
    }

    validated.config_version = configVersion;
    return validated;
  } catch (error) {
    if (error && error.message === "INACTIVE") {
      throw new Error("Jenis outing tidak aktif dan tidak boleh dipohon.");
    }
    if (error && error.message === "NOT_FOUND") {
      throw new Error("Jenis outing tidak tersedia.");
    }
    throw new Error("Konfigurasi jenis outing tidak sah. Sila hubungi pentadbir.");
  }
}

function normalizeSubmissionDateV200_(value, fieldLabel, required) {
  if (!hasCellValue_(value)) {
    if (required) {
      throw new Error(fieldLabel + " diperlukan.");
    }
    return "";
  }

  const text = String(value).trim();
  const dateKey = normalizeDateKey_(value);
  if (!dateKey || (!/^\d{4}-\d{2}-\d{2}$/.test(text) && Object.prototype.toString.call(value) !== "[object Date]")) {
    throw new Error(fieldLabel + " tidak sah.");
  }

  const date = new Date(dateKey + "T00:00:00+08:00");
  if (isNaN(date.getTime()) || Utilities.formatDate(date, "Asia/Kuala_Lumpur", "yyyy-MM-dd") !== dateKey) {
    throw new Error(fieldLabel + " tidak sah.");
  }
  return dateKey;
}

function normalizeSubmissionTimeV200_(value, fieldLabel, required) {
  const text = String(value === undefined || value === null ? "" : value).trim();
  if (!text) {
    if (required) {
      throw new Error(fieldLabel + " diperlukan.");
    }
    return "";
  }
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) {
    throw new Error(fieldLabel + " tidak sah.");
  }
  return text;
}

function isSubmissionTimeWithinWindowV200_(currentTime, openTime, closeTime) {
  if (openTime && closeTime) {
    return openTime <= closeTime
      ? currentTime >= openTime && currentTime <= closeTime
      : currentTime >= openTime || currentTime <= closeTime;
  }
  if (openTime) return currentTime >= openTime;
  if (closeTime) return currentTime <= closeTime;
  return true;
}

function requireSubmissionTextV200_(payload, keys, label, required) {
  const value = keys.reduce((current, key) => current || String(payload[key] || "").trim(), "");
  if (required && !value) {
    throw new Error(label + " diperlukan.");
  }
  return value;
}

function validateConfigDrivenSubmissionV200_(payload, config, now) {
  const submission = Object.assign({}, payload || {});
  const todayKey = formatDate_(now);
  const leaveDateKey = normalizeSubmissionDateV200_(
    submission.tarikh,
    "Tarikh keluar",
    config.require_leave_date
  );
  let returnDateKey = normalizeSubmissionDateV200_(
    submission.tarikh_balik,
    "Tarikh pulang ke asrama",
    config.require_return_date
  );
  const effectiveLeaveDateKey = leaveDateKey || todayKey;

  if (returnDateKey && returnDateKey < effectiveLeaveDateKey) {
    throw new Error("Tarikh pulang ke asrama tidak boleh lebih awal daripada tarikh keluar.");
  }
  if (config.same_day_only) {
    if (!returnDateKey) {
      returnDateKey = effectiveLeaveDateKey;
    }
    if (returnDateKey !== effectiveLeaveDateKey) {
      throw new Error("Jenis outing ini mesti keluar dan pulang pada hari yang sama.");
    }
  }

  const allowedDays = String(config.allowed_days || "").split(",");
  const leaveDay = getDayNameFromDateKey_(effectiveLeaveDateKey).toUpperCase();
  if (allowedDays.indexOf(leaveDay) === -1) {
    throw new Error("Jenis outing ini tidak dibenarkan pada hari yang dipilih.");
  }

  const currentTime = Utilities.formatDate(now, "Asia/Kuala_Lumpur", "HH:mm");
  if (!isSubmissionTimeWithinWindowV200_(
    currentTime,
    config.application_open_time,
    config.application_close_time
  )) {
    throw new Error("Permohonan jenis outing ini belum dibuka atau telah ditutup.");
  }

  if (config.fixed_return_time) {
    submission.masa_balik_dijangka = config.fixed_return_time;
  } else {
    submission.masa_balik_dijangka = normalizeSubmissionTimeV200_(
      submission.masa_balik_dijangka,
      "Masa dijangka pulang ke asrama",
      config.require_return_time
    );
  }

  requireSubmissionTextV200_(submission, ["telefon_waris"], "Telefon waris", config.require_guardian_phone);
  requireSubmissionTextV200_(submission, ["hubungan_waris"], "Hubungan waris", config.require_guardian_relation);
  requireSubmissionTextV200_(submission, ["sebab_kecemasan"], "Sebab kecemasan", config.require_emergency_reason);
  requireSubmissionTextV200_(submission, ["tujuan", "purpose"], "Tujuan", config.require_purpose);
  requireSubmissionTextV200_(submission, ["lokasi", "location"], "Lokasi", config.require_location);
  requireSubmissionTextV200_(submission, ["jenis_kenderaan", "vehicle_type"], "Jenis kenderaan", config.require_vehicle);

  if (leaveDateKey) submission.tarikh = leaveDateKey;
  if (returnDateKey) submission.tarikh_balik = returnDateKey;
  submission.jenis_permohonan = config.type_code;
  return submission;
}

function submitRequest(payload) {
  const studentId = payload.student_id;
  const noMatrik = payload.no_matrik;
  let requestType = payload.jenis_permohonan;
  const now = new Date();

if (!studentId || !noMatrik) {
  throw new Error("student_id dan no_matrik diperlukan.");
}

  const submissionConfig = resolveSubmissionOutingTypeConfigV200_(requestType);
  if (submissionConfig) {
    payload = validateConfigDrivenSubmissionV200_(payload, submissionConfig, now);
    requestType = submissionConfig.type_code;
  } else {
    if (
      requestType !== REQUEST_TYPE.normal &&
      requestType !== REQUEST_TYPE.weekend &&
      requestType !== REQUEST_TYPE.emergency &&
      requestType !== REQUEST_TYPE.overnight &&
      requestType !== REQUEST_TYPE.semester
    ) {
      throw new Error("Jenis permohonan tidak sah.");
    }

    if (requestType === REQUEST_TYPE.normal && !isOutingBiasaOpen_(now)) {
      throw new Error("Outing Biasa hanya dibuka Selasa/Rabu selepas 5:00 PM.");
    }

    if (requestType === REQUEST_TYPE.emergency && !normalizeText_(payload.sebab_kecemasan)) {
      throw new Error("Sebab kecemasan diperlukan.");
    }

    if (requestType === REQUEST_TYPE.weekend) {
      const weekendDateKey = normalizeDateKey_(payload.tarikh);
      const weekendReturnDateKey = normalizeDateKey_(payload.tarikh_balik);
      const weekendReturnTime = String(payload.masa_balik_dijangka || "").trim();

      if (!weekendDateKey) {
        throw new Error("Tarikh Outing Sabtu / Ahad diperlukan.");
      }

      const weekendDate = new Date(weekendDateKey + "T12:00:00+08:00");
      const weekendDay = weekendDate.getDay();

      if (weekendDay !== 0 && weekendDay !== 6) {
        throw new Error("Tarikh Outing Sabtu / Ahad mestilah pada hari Sabtu atau Ahad.");
      }

      if (weekendReturnDateKey !== weekendDateKey) {
        throw new Error("Outing Sabtu / Ahad mesti pulang pada hari yang sama.");
      }

      if (weekendReturnTime !== "22:00") {
        throw new Error("Masa wajib pulang untuk Outing Sabtu / Ahad ialah 10:00 malam.");
      }
    }

    if (requestType === REQUEST_TYPE.overnight) {
      validateOvernightRequest_(payload, now);
    }

    if (requestType === REQUEST_TYPE.semester) {
      validateSemesterRequest_(payload, now);
    }
  }

  const student = findStudentByIdAndMatric_(studentId, noMatrik);

  if (!student || !isActive_(student.status)) {
    throw new Error("Pelajar tidak dijumpai atau tidak aktif.");
  }

const requiresWardenApproval = !submissionConfig || submissionConfig.require_warden_approval;

const requestDate = submissionConfig
  ? normalizeDateKey_(payload.tarikh) || formatDate_(now)
  : (
    requestType === REQUEST_TYPE.semester ||
    requestType === REQUEST_TYPE.weekend
  )
    ? normalizeDateKey_(payload.tarikh) || formatDate_(now)
    : formatDate_(now);

const record = withScriptLock_(function () {
  const requestSheet = getSheet_(SHEETS.requests);
  const requestRows = getRowsAsObjects_(requestSheet);

  if (hasActiveRequestForStudent_(student, requestRows)) {
    throw new Error("Anda masih mempunyai permohonan aktif. Sila selesaikan permohonan sedia ada dahulu.");
  }

  const requestId = createRequestId_(now);
  const requestRecord = {
    request_id: requestId,
  tarikh: requestDate,
  hari: (
    submissionConfig ||
    requestType === REQUEST_TYPE.semester ||
    requestType === REQUEST_TYPE.weekend
  )
    ? getDayNameFromDateKey_(requestDate)
    : getDayName_(now),
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
    status: requiresWardenApproval ? STATUS.pending : STATUS.approved,
    warden_approve_by: requiresWardenApproval ? "" : "AUTO_CONFIG_V2",
    masa_approve: requiresWardenApproval ? "" : now_(),
    masa_keluar: "",
    guard_keluar_by: "",
    masa_masuk: "",
    guard_masuk_by: "",
    lewat: "",
    selfie_whatsapp: "",
    selfie_status: "",
    selfie_file_id: "",
    selfie_url: "",
    masa_selfie: "",
    selfie_telegram_message_id: "",
    catatan: payload.catatan || "",
    tarikh_balik: payload.tarikh_balik || "",
    hari_balik: payload.hari_balik || getDayNameFromDateKey_(payload.tarikh_balik),
    masa_balik_dijangka: payload.masa_balik_dijangka || ""
  };

  appendObjectRow_(requestSheet, HEADERS.OUTING_REQUESTS, requestRecord);
  SpreadsheetApp.flush();
  return requestRecord;
}, "Permohonan sedang diproses. Sila cuba sebentar lagi.");
  const requestId = record.request_id;
  const auditDetails = {
    student_name: student.nama || "",
    no_matrik: String(student.no_matrik || ""),
    jenis_permohonan: requestType
  };
  if (submissionConfig) {
    auditDetails.config_version = submissionConfig.config_version;
    auditDetails.require_warden_approval = submissionConfig.require_warden_approval;
  }
  appendAuditLog("SUBMIT_REQUEST", requestId, "Student", student.nama, JSON.stringify(auditDetails));
  sendTelegramMessage_(buildTelegramSubmitMessage_(record));

  return record;
}

function approveRequest(payload) {
  const requestId = String(payload.request_id || "").trim();
  const wardenName = String(payload.warden_name || payload.nama_warden || payload.user_name || "").trim();
  const pin = String(payload.pin === undefined || payload.pin === null ? "" : payload.pin).trim();

  if (!requestId || !wardenName || !pin) {
    throw new Error("request_id, nama warden dan PIN diperlukan.");
  }

  const warden = findActiveWarden_(wardenName, pin);
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

  appendAuditLog("APPROVE_REQUEST", requestId, "Warden", warden.nama_warden, JSON.stringify({
    student_name: found.record.nama || "",
    no_matrik: found.record.no_matrik || "",
    jenis_permohonan: found.record.jenis_permohonan || ""
  }));
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(telegramTitle_("✅", "Permohonan Diluluskan Warden", updatedRecord), updatedRecord));
  return updatedRecord;
}

function rejectRequest(payload) {
  const requestId = String(payload.request_id || "").trim();
  const wardenName = String(payload.warden_name || payload.nama_warden || payload.user_name || "").trim();
  const pin = String(payload.pin === undefined || payload.pin === null ? "" : payload.pin).trim();

  if (!requestId || !wardenName || !pin) {
    throw new Error("request_id, nama warden dan PIN diperlukan.");
  }

  const warden = findActiveWarden_(wardenName, pin);
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

  appendAuditLog("REJECT_REQUEST", requestId, "Warden", warden.nama_warden, JSON.stringify({
    student_name: found.record.nama || "",
    no_matrik: found.record.no_matrik || "",
    jenis_permohonan: found.record.jenis_permohonan || "",
    catatan: payload.catatan || ""
  }));
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(telegramTitle_("❌", "Permohonan Ditolak Warden", updatedRecord), updatedRecord));
  return updatedRecord;
}

function confirmOut(payload) {
  const requestId = String(payload.request_id || "").trim();
  const guardName = String(payload.guard_name || payload.nama_guard || payload.user_name || "").trim();
  const pin = String(payload.pin === undefined || payload.pin === null ? "" : payload.pin).trim();

  if (!requestId || !guardName || !pin) {
    throw new Error("request_id, nama guard dan PIN diperlukan.");
  }

  const guard = findActiveGuard_(guardName, pin);
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

  appendAuditLog("CONFIRM_OUT", requestId, "Guard", guard.nama_guard, JSON.stringify({
    student_name: found.record.nama || "",
    no_matrik: found.record.no_matrik || "",
    jenis_permohonan: found.record.jenis_permohonan || ""
  }));
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(telegramTitle_("🚪", "Pelajar Disahkan Keluar", updatedRecord), updatedRecord));
  return updatedRecord;
}

function confirmIn(payload) {
  const requestId = String(payload.request_id || "").trim();
  const guardName = String(payload.guard_name || payload.nama_guard || payload.user_name || "").trim();
  const pin = String(payload.pin === undefined || payload.pin === null ? "" : payload.pin).trim();
  const now = new Date();

  if (!requestId || !guardName || !pin) {
    throw new Error("request_id, nama guard dan PIN diperlukan.");
  }

  const guard = findActiveGuard_(guardName, pin);
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

  const late = isHostelReturnRequest_(found.record)
    ? (isHostelReturnLate_(now, found.record) ? "Ya" : "Tidak")
    : (isLate_(now) ? "Ya" : "Tidak");
  const guardReturnNote = String(payload.catatan || payload.catatan_masuk || "").trim();

  updateRowByHeaders_(found.sheet, found.rowNumber, {
    status: STATUS.done,
    masa_masuk: now_(),
    guard_masuk_by: guard.nama_guard,
    lewat: late,
    selfie_status: "BELUM_HANTAR",
    catatan: guardReturnNote || found.record.catatan || ""
  });

  appendAuditLog("CONFIRM_IN", requestId, "Guard", guard.nama_guard, JSON.stringify({
    student_name: found.record.nama || "",
    no_matrik: found.record.no_matrik || "",
    jenis_permohonan: found.record.jenis_permohonan || "",
    lewat: late,
    catatan_masuk: guardReturnNote
  }));
  const updatedRecord = findRowByRequestId_(requestId).record;
  sendTelegramMessage_(buildTelegramStatusMessage_(
    telegramTitle_(late === "Ya" ? "⚠️" : "🏁", late === "Ya" ? "Pelajar Masuk Lewat" : "Pelajar Selesai Outing", updatedRecord),
    updatedRecord
  ));
  return updatedRecord;
}

function submitReturnSelfie(payload) {
  const requestId = String(payload.request_id || "").trim();
  const studentId = String(payload.student_id || "").trim();
  const noMatrik = String(payload.no_matrik || "").trim();
  const mimeType = String(payload.mime_type || "").trim().toLowerCase();
  const imageBase64 = String(payload.image_base64 || "").trim();
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  const maxBase64Length = 2 * 1024 * 1024;

  if (!requestId) {
    throw new Error("request_id diperlukan.");
  }
  if (!studentId || !noMatrik) {
    throw new Error("student_id dan no_matrik diperlukan.");
  }
  if (allowedMimeTypes.indexOf(mimeType) === -1) {
    throw new Error("Format gambar tidak disokong.");
  }
  if (!imageBase64 ||
      imageBase64.length > maxBase64Length ||
      imageBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    throw new Error("Gambar tidak sah atau terlalu besar.");
  }

  let imageBytes;
  try {
    imageBytes = Utilities.base64Decode(imageBase64);
  } catch (error) {
    throw new Error("Gambar tidak sah atau rosak.");
  }
  if (!imageBytes || !imageBytes.length || imageBytes.length > 1500 * 1024) {
    throw new Error("Gambar tidak sah atau terlalu besar.");
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    throw new Error("Permintaan sedang diproses. Sila cuba sebentar lagi.");
  }

  let driveFile = null;
  let telegramMessageId = "";
  let completed = false;
  try {
    const found = findRowByRequestId_(requestId);
    if (!found) {
      throw new Error("Permohonan tidak dijumpai.");
    }
    const record = found.record;
    const ownsRecord =
      normalizeText_(record.student_id) === normalizeText_(studentId) &&
      normalizeText_(record.no_matrik) === normalizeText_(noMatrik);
    if (!ownsRecord) {
      throw new Error("Anda tidak dibenarkan menghantar bukti untuk rekod ini.");
    }
    if (record.status !== STATUS.done || !hasCellValue_(record.masa_masuk)) {
      throw new Error("Bukti selfie hanya boleh dihantar selepas Guard mengesahkan masuk.");
    }
    if (normalizeText_(record.selfie_status) === "sudah_hantar" ||
        hasCellValue_(record.selfie_file_id) ||
        hasCellValue_(record.masa_selfie)) {
      throw new Error("Bukti selfie telah dihantar sebelum ini.");
    }

    const properties = PropertiesService.getScriptProperties();
    const folderId = properties.getProperty("SELFIE_FOLDER_ID");
    if (!folderId) {
      throw new Error("Folder bukti selfie belum disediakan. Hubungi pentadbir.");
    }

    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
      folder.getName();
    } catch (error) {
      throw new Error("Folder bukti selfie tidak dapat diakses. Hubungi pentadbir.");
    }

    const timestamp = now_();
    const fileName = sanitizeFilenamePart_(requestId) + "_" +
      sanitizeFilenamePart_(record.no_matrik) + "_" +
      Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyyMMdd-HHmmss") + ".jpg";
    const sourceBlob = Utilities.newBlob(imageBytes, mimeType, fileName);
    const jpegBlob = mimeType === "image/jpeg"
      ? sourceBlob
      : sourceBlob.getAs(MimeType.JPEG).setName(fileName);
    driveFile = folder.createFile(jpegBlob);

    const telegramResult = sendTelegramPhoto_(jpegBlob, buildReturnSelfieCaption_(record, timestamp));
    if (!telegramResult.ok) {
      driveFile.setTrashed(true);
      driveFile = null;
      throw new Error(telegramResult.error || "Bukti tidak dapat dihantar ke Telegram. Sila cuba lagi.");
    }
    telegramMessageId = String(telegramResult.messageId || "");

    try {
      updateRowByHeaders_(found.sheet, found.rowNumber, {
        selfie_status: "SUDAH_HANTAR",
        selfie_file_id: driveFile.getId(),
        selfie_url: driveFile.getUrl(),
        masa_selfie: timestamp,
        selfie_telegram_message_id: telegramMessageId
      });
      completed = true;
    } catch (error) {
      deleteTelegramMessage_(telegramMessageId);
      telegramMessageId = "";
      driveFile.setTrashed(true);
      driveFile = null;
      throw new Error("Bukti tidak dapat disimpan dengan lengkap. Sila cuba lagi.");
    }

    try {
      appendAuditLog("SUBMIT_RETURN_SELFIE", requestId, "Student", record.nama || "", JSON.stringify({
        no_matrik: String(record.no_matrik || ""),
        jenis_permohonan: record.jenis_permohonan || ""
      }));
    } catch (auditError) {
      if (typeof console !== "undefined" && console && typeof console.warn === "function") {
        console.warn("SUBMIT_RETURN_SELFIE audit log failed.", auditError);
      }
    }
    const updatedRecord = findRowByRequestId_(requestId).record;
    return {
      request_id: updatedRecord.request_id,
      selfie_status: updatedRecord.selfie_status,
      masa_selfie: updatedRecord.masa_selfie
    };
  } catch (error) {
    if (!completed) {
      if (telegramMessageId) {
        deleteTelegramMessage_(telegramMessageId);
      }
      if (driveFile) {
        try {
          driveFile.setTrashed(true);
        } catch (cleanupError) {
          // The original actionable error is returned to the client.
        }
      }
    }
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function setupSelfieProofV170() {
  const sheet = getSheet_(SHEETS.requests);
  const beforeHeaders = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((header) => String(header).trim())
    : [];
  const selfieHeaders = [
    "selfie_status",
    "selfie_file_id",
    "selfie_url",
    "masa_selfie",
    "selfie_telegram_message_id"
  ];
  ensureHeaders_(sheet, HEADERS.OUTING_REQUESTS);
  const addedColumns = selfieHeaders.filter((header) => beforeHeaders.indexOf(header) === -1);
  const properties = PropertiesService.getScriptProperties();
  let folderId = properties.getProperty("SELFIE_FOLDER_ID") || "";
  let folderCreated = false;
  let folder;

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
      folder.getName();
    } catch (error) {
      folder = null;
    }
  }
  if (!folder) {
    const folders = DriveApp.getFoldersByName("eOuting - Bukti Selfie Pulang");
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder("eOuting - Bukti Selfie Pulang");
      folderCreated = true;
    }
    folderId = folder.getId();
    properties.setProperty("SELFIE_FOLDER_ID", folderId);
  }

  return {
    ok: true,
    sheet: SHEETS.requests,
    added_columns: addedColumns,
    folder_id: folderId,
    folder_name: folder.getName(),
    folder_created: folderCreated,
    script_property: "SELFIE_FOLDER_ID"
  };
}

function setupStudentProfilePhotos() {
  const configuredFolderId = "1EpnqLVO8iWHRpF8MuqsyVAN55T7eq5X3";
  const sheet = getSheet_(SHEETS.students);
  const beforeHeaders = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map((header) => String(header).trim())
    : [];
  ensureHeaders_(sheet, HEADERS.STUDENTS);

  const properties = PropertiesService.getScriptProperties();
  const existingFolderId = String(properties.getProperty("PROFILE_PHOTO_FOLDER_ID") || "").trim();
  if (existingFolderId && existingFolderId !== configuredFolderId) {
    throw new Error("PROFILE_PHOTO_FOLDER_ID sedia ada tidak sepadan dengan folder yang disahkan.");
  }
  const folder = DriveApp.getFolderById(configuredFolderId);
  folder.getName();
  if (!existingFolderId) {
    properties.setProperty("PROFILE_PHOTO_FOLDER_ID", configuredFolderId);
  }

  return {
    ok: true,
    sheet: SHEETS.students,
    added_columns: ["photo_file_id", "photo_updated_at"].filter((header) => beforeHeaders.indexOf(header) === -1),
    folder_id: configuredFolderId,
    folder_name: folder.getName(),
    folder_created: false,
    script_property: "PROFILE_PHOTO_FOLDER_ID"
  };
}

function validateProfilePhotoImage_(payload) {
  const mimeType = String(payload && payload.mime_type || "").trim().toLowerCase();
  const imageBase64 = String(payload && payload.image_base64 || "").trim();
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedMimeTypes.indexOf(mimeType) === -1) {
    throw new Error("Format foto profil tidak disokong.");
  }
  if (!imageBase64 || imageBase64.length > 1100 * 1024 || imageBase64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
    throw new Error("Foto profil tidak sah atau terlalu besar.");
  }
  let bytes;
  try {
    bytes = Utilities.base64Decode(imageBase64);
  } catch (error) {
    throw new Error("Foto profil tidak sah atau rosak.");
  }
  if (!bytes || !bytes.length || bytes.length > 800 * 1024) {
    throw new Error("Foto profil tidak sah atau terlalu besar.");
  }
  return { mimeType: mimeType, bytes: bytes };
}

function getProfilePhotoFolder_() {
  const folderId = String(PropertiesService.getScriptProperties().getProperty("PROFILE_PHOTO_FOLDER_ID") || "").trim();
  if (!folderId) {
    throw new Error("Folder foto profil belum disediakan. Hubungi pentadbir.");
  }
  try {
    const folder = DriveApp.getFolderById(folderId);
    folder.getName();
    return folder;
  } catch (error) {
    throw new Error("Folder foto profil tidak dapat diakses. Hubungi pentadbir.");
  }
}

function isFileInFolder_(file, folderId) {
  if (!file || !folderId) return false;
  const parents = file.getParents();
  while (parents.hasNext()) {
    if (String(parents.next().getId()) === String(folderId)) return true;
  }
  return false;
}

function getVerifiedProfilePhotoFile_(fileId, folder) {
  if (!fileId || !folder) return null;
  try {
    const file = DriveApp.getFileById(String(fileId));
    if (!isFileInFolder_(file, folder.getId()) || file.isTrashed()) return null;
    return file;
  } catch (error) {
    return null;
  }
}

function safelyTrashProfilePhoto_(fileId, folder) {
  const file = getVerifiedProfilePhotoFile_(fileId, folder);
  if (!file) return false;
  try {
    file.setTrashed(true);
    return true;
  } catch (error) {
    return false;
  }
}

function submitStudentProfilePhoto(payload) {
  const studentId = String(payload && (payload.student_id || payload.id) || "").trim();
  const noMatrik = String(payload && (payload.no_matrik || payload.matric) || "").trim();
  const student = findActiveStudent_(studentId, noMatrik);
  if (!student) {
    throw new Error("Akses sesi pelajar tidak sah.");
  }
  const image = validateProfilePhotoImage_(payload);

  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.students);
    const found = findStudentRowById_(sheet, student.student_id);
    if (!found || normalizeText_(found.record.no_matrik) !== normalizeText_(noMatrik) || !isActive_(found.record.status)) {
      throw new Error("Akses sesi pelajar tidak sah.");
    }
    const folder = getProfilePhotoFolder_();
    const oldFileId = String(found.record.photo_file_id || "").trim();
    const timestamp = now_();
    const fileName = "profile_" + sanitizeFilenamePart_(student.student_id) + "_" +
      Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyyMMdd-HHmmss") + ".jpg";
    const sourceBlob = Utilities.newBlob(image.bytes, image.mimeType, fileName);
    const jpegBlob = image.mimeType === "image/jpeg"
      ? sourceBlob
      : sourceBlob.getAs(MimeType.JPEG).setName(fileName);
    let newFile = null;
    let metadataSaved = false;
    try {
      newFile = folder.createFile(jpegBlob);
      updateRowByHeaders_(sheet, found.rowNumber, {
        photo_file_id: newFile.getId(),
        photo_updated_at: timestamp
      });
      SpreadsheetApp.flush();
      metadataSaved = true;
      if (oldFileId && oldFileId !== newFile.getId()) {
        safelyTrashProfilePhoto_(oldFileId, folder);
      }
      appendAuditLog("UPDATE_STUDENT_PROFILE_PHOTO", "", "Student", found.record.nama || "", "", "STUDENT", found.record.student_id);
      return { student_id: found.record.student_id, has_profile_photo: true, photo_updated_at: timestamp };
    } catch (error) {
      if (!metadataSaved && newFile) {
        try { newFile.setTrashed(true); } catch (cleanupError) { /* Preserve the actionable error. */ }
      }
      throw error;
    }
  }, "Foto profil sedang dikemas kini. Sila cuba sebentar lagi.");
}

function validateProfilePhotoViewer_(payload) {
  const role = normalizeText_(payload && payload.role);
  if (role === "student") {
    const student = findActiveStudent_(payload.student_id || payload.id, payload.no_matrik || payload.matric);
    if (!student) throw new Error("Akses sesi pelajar tidak sah.");
    return { role: role, studentId: String(student.student_id) };
  }
  if (role === "warden") {
    const warden = findActiveWarden_(payload.nama_warden || payload.warden_name || payload.name, payload.pin);
    if (!warden) throw new Error("Akses sesi warden tidak sah.");
    return { role: role };
  }
  if (role === "guard") {
    const guard = findActiveGuard_(payload.nama_guard || payload.guard_name || payload.name, payload.pin);
    if (!guard) throw new Error("Akses sesi guard tidak sah.");
    return { role: role };
  }
  if (role === "admin") {
    validateAdminCredentials_(payload);
    return { role: role };
  }
  throw new Error("Akses sesi diperlukan.");
}

function getStudentProfilePhotos(payload) {
  const viewer = validateProfilePhotoViewer_(payload || {});
  let requestedIds = Array.isArray(payload && payload.student_ids) ? payload.student_ids : [];
  requestedIds = requestedIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (viewer.role === "student") {
    if (requestedIds.length && requestedIds.some((id) => normalizeText_(id) !== normalizeText_(viewer.studentId))) {
      throw new Error("Pelajar hanya boleh mengakses foto profil sendiri.");
    }
    requestedIds = [viewer.studentId];
  }
  if (viewer.role === "warden" || viewer.role === "guard") {
    const operationalIds = {};
    getTodayRecordRows_().forEach((row) => { operationalIds[normalizeText_(row.student_id)] = true; });
    if (requestedIds.some((id) => !operationalIds[normalizeText_(id)])) {
      throw new Error("Foto hanya boleh diakses untuk rekod operasi semasa.");
    }
  }
  if (requestedIds.length > 100) {
    throw new Error("Terlalu banyak foto diminta dalam satu permintaan.");
  }
  const requested = {};
  requestedIds.forEach((id) => { requested[normalizeText_(id)] = true; });
  if (!Object.keys(requested).length) return { photos: [] };

  const folder = getProfilePhotoFolder_();
  const photos = getRowsAsObjects_(getSheet_(SHEETS.students)).reduce((result, student) => {
    if (!requested[normalizeText_(student.student_id)] || !hasCellValue_(student.photo_file_id)) return result;
    const file = getVerifiedProfilePhotoFile_(student.photo_file_id, folder);
    if (!file) return result;
    const mimeType = String(file.getMimeType() || "").toLowerCase();
    if (["image/jpeg", "image/png", "image/webp"].indexOf(mimeType) === -1) return result;
    const bytes = file.getBlob().getBytes();
    if (!bytes.length || bytes.length > 800 * 1024) return result;
    result.push({
      student_id: String(student.student_id || ""),
      photo_data_uri: "data:" + mimeType + ";base64," + Utilities.base64Encode(bytes),
      photo_updated_at: student.photo_updated_at || ""
    });
    return result;
  }, []);
  return { photos: photos };
}

function removeStudentProfilePhoto(payload) {
  const admin = validateAdminCredentials_(payload);
  const studentId = String(payload && payload.student_id || "").trim();
  if (!studentId) throw new Error("student_id diperlukan.");
  return withScriptLock_(function () {
    const sheet = getSheet_(SHEETS.students);
    const found = findStudentRowById_(sheet, studentId);
    if (!found) throw new Error("Pelajar tidak dijumpai.");
    const oldFileId = String(found.record.photo_file_id || "").trim();
    const folder = oldFileId ? getProfilePhotoFolder_() : null;
    updateRowByHeaders_(sheet, found.rowNumber, { photo_file_id: "", photo_updated_at: "" });
    SpreadsheetApp.flush();
    let fileRemoved = false;
    if (oldFileId) {
      fileRemoved = safelyTrashProfilePhoto_(oldFileId, folder);
    }
    appendAuditLog(
      "REMOVE_STUDENT_PROFILE_PHOTO", "", "Admin", getSafeAdminIdentity_(admin),
      JSON.stringify({ student_name: String(found.record.nama || ""), file_removed: fileRemoved }),
      "STUDENT", found.record.student_id
    );
    return { student_id: found.record.student_id, has_profile_photo: false, photo_updated_at: "" };
  }, "Foto profil sedang dikemas kini. Sila cuba sebentar lagi.");
}

function getTodayRecords() {
  return getTodayRecordRows_().map((row) => ({
    nama: String(row.nama || ""),
    kelas: String(row.kelas || ""),
    jenis_permohonan: String(row.jenis_permohonan || ""),
    status: String(row.status || ""),
    lewat: String(row.lewat || ""),
    belum_masuk: String(row.status || "") === STATUS.out && !hasCellValue_(row.masa_masuk)
  }));
}

function getOperationalTodayRecords(payload) {
  const role = normalizeText_(payload && payload.role);
  const rows = addProfilePhotoIndicators_(getTodayRecordRows_());

  if (role === "student") {
    const studentId = payload.student_id || payload.id;
    const noMatrik = payload.no_matrik || payload.matric;
    const student = findActiveStudent_(studentId, noMatrik);
    if (!student) {
      throw new Error("Akses sesi pelajar tidak sah.");
    }
    return rows.filter((row) => normalizeText_(row.student_id) === normalizeText_(student.student_id));
  }

  if (role === "warden") {
    const name = payload.nama_warden || payload.warden_name || payload.name;
    if (!findActiveWarden_(name, payload.pin)) {
      throw new Error("Akses sesi warden tidak sah.");
    }
    return rows;
  }

  if (role === "guard") {
    const name = payload.nama_guard || payload.guard_name || payload.name;
    if (!findActiveGuard_(name, payload.pin)) {
      throw new Error("Akses sesi guard tidak sah.");
    }
    return rows;
  }

  throw new Error("Akses sesi diperlukan.");
}

function addProfilePhotoIndicators_(rows) {
  const photoByStudentId = {};
  getRowsAsObjects_(getSheet_(SHEETS.students)).forEach((student) => {
    photoByStudentId[normalizeText_(student.student_id)] = {
      has_profile_photo: hasCellValue_(student.photo_file_id),
      photo_updated_at: student.photo_updated_at || ""
    };
  });
  return (rows || []).map((row) => {
    const photo = photoByStudentId[normalizeText_(row.student_id)] || {};
    return Object.assign({}, row, {
      has_profile_photo: Boolean(photo.has_profile_photo),
      photo_updated_at: photo.photo_updated_at || ""
    });
  });
}

function getTodayRecordRows_() {
  const todayKey = formatDate_(new Date());
  return getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => {
      const rowDateKey = normalizeDateKey_(row.tarikh) || normalizeDateKey_(row.masa_mohon);
      const returnDateKey = normalizeDateKey_(row.tarikh_balik);
      const isTodayActivity = rowDateKey === todayKey ||
        returnDateKey === todayKey ||
        isDateValueToday_(row.masa_mohon, todayKey) ||
        isDateValueToday_(row.masa_approve, todayKey) ||
        isDateValueToday_(row.masa_keluar, todayKey) ||
        isDateValueToday_(row.masa_masuk, todayKey);
      const activeRecord = isActiveRequestStatus_(row.status);
      // Active applications must stay visible even when tarikh is a future leave date.
      const hostelReturnOpen = isHostelReturnRequest_(row) && isOpenHostelReturnStatus_(row.status);
      return isTodayActivity || activeRecord || hostelReturnOpen;
    });
}

function isActiveRequestStatus_(status) {
  const text = String(status || "");
  return text === STATUS.pending || text === STATUS.approved || text === STATUS.out;
}

function hasActiveRequestForStudent_(student, requestRows) {
  const studentId = normalizeText_(student && student.student_id);
  const noMatrik = normalizeText_(student && student.no_matrik);

  if (!studentId && !noMatrik) {
    return false;
  }

  const rows = Array.isArray(requestRows)
    ? requestRows
    : getRowsAsObjects_(getSheet_(SHEETS.requests));

  return rows.some((row) => (
    isActiveRequestStatus_(row.status) &&
    (
      (studentId && normalizeText_(row.student_id) === studentId) ||
      (noMatrik && normalizeText_(row.no_matrik) === noMatrik)
    )
  ));
}

function isOpenHostelReturnStatus_(status) {
  const text = String(status || "");
  return text !== STATUS.done && text !== STATUS.rejected;
}

function isDateValueToday_(value, todayKey) {
  return normalizeDateKey_(value) === todayKey;
}

function isAdminRecordOverdue_(row, now) {
  if (String(row && row.lewat || "").trim().toLowerCase() === "ya") return true;
  if (!row || String(row.status || "") !== STATUS.out) return false;
  if (isHostelReturnRequest_(row)) return isHostelReturnLate_(now, row);
  const outingDate = normalizeDateKey_(row.tarikh) || normalizeDateKey_(row.masa_keluar);
  const today = formatDate_(now);
  return Boolean(outingDate) && (outingDate < today || (outingDate === today && isLate_(now)));
}

function toAdminOperationalRecord_(row, now) {
  const overdue = isAdminRecordOverdue_(row, now);
  const returnDate = normalizeDateKey_(row.tarikh_balik);
  const returnTime = normalizeStoredTimeOnly_(row.masa_balik_dijangka);
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
    expected_return_at: returnDate && returnTime ? returnDate + " " + returnTime + ":00" : "",
    lewat: overdue,
    tujuan: row.tujuan || "",
    lokasi: row.lokasi || "",
    jenis_kenderaan: row.jenis_kenderaan || "",
    butiran_kenderaan: row.butiran_kenderaan || "",
    warden_approve_by: row.warden_approve_by || "",
    masa_approve: row.masa_approve || "",
    guard_keluar_by: row.guard_keluar_by || "",
    guard_masuk_by: row.guard_masuk_by || "",
    duration_minutes: calculateOutingDurationMinutes_(row),
    duration: calculateOutingDurationMinutes_(row) > 0 ? formatOutingDuration_(calculateOutingDurationMinutes_(row)) : ""
  };
}

function getAdminMonitoring(payload) {
  validateAdminCredentials_(payload);
  const now = new Date();
  const activeStatuses = [STATUS.pending, STATUS.approved, STATUS.out];
  const records = getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => activeStatuses.indexOf(String(row.status || "")) !== -1)
    .map((row) => toAdminOperationalRecord_(row, now))
    .sort((left, right) => (parseDateForSort_(right.masa_mohon || right.tarikh) || new Date(0)) - (parseDateForSort_(left.masa_mohon || left.tarikh) || new Date(0)));
  const kpis = {
    pending: records.filter((row) => row.status === STATUS.pending).length,
    approved: records.filter((row) => row.status === STATUS.approved).length,
    out: records.filter((row) => row.status === STATUS.out).length,
    not_returned: records.filter((row) => row.status === STATUS.out).length,
    late: records.filter((row) => row.lewat).length,
    emergency: records.filter((row) => row.jenis_permohonan === REQUEST_TYPE.emergency).length
  };
  return { generated_at: now_(), kpis: kpis, records: records };
}

function searchAdminMasterRecords(payload) {
  validateAdminCredentials_(payload);
  const data = payload || {};
  const query = normalizeText_(data.search || data.query || "");
  const month = data.month === "" || data.month === undefined ? 0 : Number(data.month);
  const year = data.year === "" || data.year === undefined ? 0 : Number(data.year);
  const kelas = normalizeText_(data.kelas || "");
  const type = normalizeText_(data.jenis_permohonan || data.request_type || "");
  const status = normalizeText_(data.status || "");
  const page = Math.max(1, Math.floor(Number(data.page) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(Number(data.page_size) || 50)));
  if (month && (!Number.isInteger(month) || month < 1 || month > 12)) throw new Error("Bulan tidak sah.");
  if (year && (!Number.isInteger(year) || year < 2000 || year > 2200)) throw new Error("Tahun tidak sah.");
  const now = new Date();
  const filtered = getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => !query || [row.nama, row.no_matrik, row.student_id, row.request_id].some((value) => normalizeText_(value).indexOf(query) !== -1))
    .filter((row) => !kelas || normalizeText_(row.kelas) === kelas)
    .filter((row) => !type || normalizeText_(row.jenis_permohonan) === type)
    .filter((row) => !status || normalizeText_(row.status) === status)
    .filter((row) => {
      if (!month && !year) return true;
      const dateKey = normalizeDateKey_(row.tarikh) || normalizeDateKey_(row.masa_mohon);
      if (!dateKey) return false;
      const parts = dateKey.split("-");
      return (!year || Number(parts[0]) === year) && (!month || Number(parts[1]) === month);
    })
    .sort((left, right) => (parseDateForSort_(right.masa_mohon || right.tarikh) || new Date(0)) - (parseDateForSort_(left.masa_mohon || left.tarikh) || new Date(0)));
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  return {
    generated_at: now_(),
    page: page,
    page_size: pageSize,
    total: total,
    total_pages: Math.max(1, Math.ceil(total / pageSize)),
    records: filtered.slice(start, start + pageSize).map((row) => toAdminOperationalRecord_(row, now))
  };
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

    if (status === STATUS.done) totals.total_completed += 1;
    if (status === STATUS.pending) totals.total_pending += 1;
    if (status === STATUS.approved) totals.total_approved += 1;
    if (status === STATUS.out) totals.total_out += 1;
    if (status === STATUS.rejected) totals.total_rejected += 1;
    if (emergency) totals.total_emergency += 1;
    if (normal) totals.total_normal += 1;
    if (late) totals.total_late += 1;

    statusMap[status] = (statusMap[status] || 0) + 1;

    studentsMap[studentKey] = true;

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
    class_summary: classSummary,
    status_summary: Object.keys(statusMap).sort().map((status) => ({
      status: status,
      count: statusMap[status]
    }))
  };
}

function getStudentAnnualSummary(payload) {
  const data = payload || {};
  const student = findActiveStudent_(
    data.student_id || data.id,
    data.no_matrik || data.matric
  );
  if (!student) {
    throw new Error("Akses sesi pelajar tidak sah.");
  }

  const year = Number(Utilities.formatDate(new Date(), "Asia/Kuala_Lumpur", "yyyy"));
  const totalOutings = getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => isRecordForStudent_(row, student))
    .filter((row) => String(row.status || "").trim().toUpperCase() === STATUS.done)
    .filter((row) => isStatsRecordInYear_(row, year))
    .length;

  return {
    year: year,
    total_outings: totalOutings
  };
}

function getAdminIndividualStats(payload) {
  validateAdminCredentials_(payload);

  const data = payload || {};
  const now = new Date();
  const month = Number(data.month || Utilities.formatDate(now, "Asia/Kuala_Lumpur", "M"));
  const year = Number(data.year || Utilities.formatDate(now, "Asia/Kuala_Lumpur", "yyyy"));
  const kelasFilter = normalizeText_(data.kelas || "");
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
    throw new Error("Bulan atau tahun statistik tidak sah.");
  }

  const studentsMap = {};
  getRowsAsObjects_(getSheet_(SHEETS.requests))
    .filter((row) => String(row.status || "").trim().toUpperCase() === STATUS.done)
    .filter((row) => isStatsRecordInMonth_(row, month, year))
    .filter((row) => !kelasFilter || normalizeText_(row.kelas) === kelasFilter)
    .forEach((row) => {
      const studentKey = String(row.student_id || row.no_matrik || row.nama || "").trim();
      if (!studentKey) {
        return;
      }

      if (!studentsMap[studentKey]) {
        studentsMap[studentKey] = {
          student_name: String(row.nama || "Tidak Dinyatakan").trim() || "Tidak Dinyatakan",
          kelas: String(row.kelas || "Tidak Dinyatakan").trim() || "Tidak Dinyatakan",
          total_outings: 0,
          total_duration_minutes: 0
        };
      }

      studentsMap[studentKey].total_outings += 1;
      studentsMap[studentKey].total_duration_minutes += calculateOutingDurationMinutes_(row);
    });

  const students = Object.keys(studentsMap)
    .map((studentKey) => {
      const item = studentsMap[studentKey];
      return {
        student_name: item.student_name,
        kelas: item.kelas,
        total_outings: item.total_outings,
        total_duration_minutes: item.total_duration_minutes,
        total_duration: formatOutingDuration_(item.total_duration_minutes)
      };
    })
    .sort((left, right) => (
      right.total_outings - left.total_outings ||
      left.student_name.localeCompare(right.student_name, "ms", { sensitivity: "base" })
    ));

  return {
    month: month,
    year: year,
    kelas: data.kelas || "",
    generated_at: now_(),
    students: students
  };
}

function isRecordForStudent_(row, student) {
  const studentId = normalizeText_(student && student.student_id);
  const noMatrik = normalizeText_(student && student.no_matrik);
  return Boolean(
    (studentId && normalizeText_(row && row.student_id) === studentId) ||
    (noMatrik && normalizeText_(row && row.no_matrik) === noMatrik)
  );
}

function isStatsRecordInYear_(row, year) {
  const dateKey = normalizeDateKey_(row.tarikh) || normalizeDateKey_(row.masa_mohon);
  return Boolean(dateKey) && Number(dateKey.split("-")[0]) === Number(year);
}

function calculateOutingDurationMinutes_(row) {
  const keluar = parseDateForSort_(row && row.masa_keluar);
  const masuk = parseDateForSort_(row && row.masa_masuk);
  if (!keluar || !masuk || masuk.getTime() <= keluar.getTime()) {
    return 0;
  }
  return Math.floor((masuk.getTime() - keluar.getTime()) / 60000);
}

function formatOutingDuration_(totalMinutes) {
  const safeMinutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const days = Math.floor(safeMinutes / 1440);
  const hours = Math.floor((safeMinutes % 1440) / 60);
  const minutes = safeMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} hari`);
  if (hours) parts.push(`${hours} jam`);
  if (minutes || !parts.length) parts.push(`${minutes} minit`);
  return parts.join(" ");
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

function appendAuditLog(action, requestId, userRole, userName, details, entityType, entityId) {
  try {
    const record = {
      timestamp: now_(),
      action: action || "",
      request_id: requestId || "",
      user_role: userRole || "",
      user_name: userName || "",
      details: details || "",
      entity_type: entityType || "",
      entity_id: entityId || ""
    };

    appendObjectRow_(getSheet_(SHEETS.audit), HEADERS.AUDIT_LOG, record);
    return record;
  } catch (error) {
    return false;
  }
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

function sendTelegramPhoto_(photoBlob, caption) {
  const config = getTelegramConfig_();
  if (!config.enabled || !config.token || !config.chatId) {
    return {
      ok: false,
      error: "Telegram belum dikonfigurasi. Hubungi pentadbir."
    };
  }

  try {
    const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + config.token + "/sendPhoto", {
      method: "post",
      payload: {
        chat_id: config.chatId,
        photo: photoBlob,
        caption: caption
      },
      muteHttpExceptions: true
    });
    const responseCode = response.getResponseCode();
    let body = {};
    try {
      body = JSON.parse(response.getContentText() || "{}");
    } catch (error) {
      body = {};
    }
    const messageId = body && body.result ? body.result.message_id : "";
    if (responseCode >= 200 && responseCode < 300 && body.ok && messageId) {
      return {
        ok: true,
        messageId: messageId
      };
    }
    return {
      ok: false,
      error: "Bukti tidak dapat dihantar ke Telegram. Sila cuba lagi."
    };
  } catch (error) {
    return {
      ok: false,
      error: "Bukti tidak dapat dihantar ke Telegram. Sila cuba lagi."
    };
  }
}

function deleteTelegramMessage_(messageId) {
  const config = getTelegramConfig_();
  if (!config.enabled || !config.token || !config.chatId || !messageId) {
    return false;
  }
  try {
    const response = UrlFetchApp.fetch("https://api.telegram.org/bot" + config.token + "/deleteMessage", {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        chat_id: config.chatId,
        message_id: messageId
      }),
      muteHttpExceptions: true
    });
    return response.getResponseCode() >= 200 && response.getResponseCode() < 300;
  } catch (error) {
    return false;
  }
}

function buildReturnSelfieCaption_(record, selfieTime) {
  return [
    "📸 BUKTI PULANG ASRAMA",
    "",
    "Nama: " + safeTelegramCaptionValue_(record.nama),
    "No. Matrik: " + safeTelegramCaptionValue_(record.no_matrik),
    "Kelas: " + safeTelegramCaptionValue_(record.kelas),
    "Jenis: " + safeTelegramCaptionValue_(requestTypeLabel_(record.jenis_permohonan)),
    "Request ID: " + safeTelegramCaptionValue_(record.request_id),
    "Guard Masuk: " + safeTelegramCaptionValue_(record.guard_masuk_by),
    "Masa Masuk: " + safeTelegramCaptionValue_(formatTelegramDateTime_(record.masa_masuk)),
    "Masa Selfie: " + safeTelegramCaptionValue_(formatTelegramDateTime_(selfieTime))
  ].join("\n");
}

function safeTelegramCaptionValue_(value) {
  return String(value === undefined || value === null || value === "" ? "-" : value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, 300);
}

function sanitizeFilenamePart_(value) {
  const sanitized = String(value || "")
    .replace(/[^A-Za-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return sanitized.slice(0, 80) || "unknown";
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
  let prefix = "";
  if (record && record.jenis_permohonan === REQUEST_TYPE.overnight) {
    prefix = "Pulang Bermalam - ";
  }
  if (record && record.jenis_permohonan === REQUEST_TYPE.semester) {
    prefix = "CUTI SEMESTER - ";
  }
  return icon + " " + prefix + text;
}

function buildTelegramSubmitMessage_(record) {
  let title = "📌 Permohonan Outing Baru";

  if (record.jenis_permohonan === REQUEST_TYPE.weekend) {
    title = "📅 Permohonan Outing Sabtu / Ahad Baru";
  }

  if (record.jenis_permohonan === REQUEST_TYPE.emergency) {
    title = "🚨 Permohonan Kecemasan Baru";
  }

  if (record.jenis_permohonan === REQUEST_TYPE.overnight) {
    title = "🏠 Permohonan Pulang Bermalam Baru";
  }

  if (record.jenis_permohonan === REQUEST_TYPE.semester) {
    title = "🏫 Permohonan CUTI SEMESTER Baru";
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

  if (
      record.jenis_permohonan === REQUEST_TYPE.weekend ||
      record.jenis_permohonan === REQUEST_TYPE.overnight ||
      record.jenis_permohonan === REQUEST_TYPE.semester
      ) {

    if (record.jenis_permohonan === REQUEST_TYPE.semester) {
      lines.push("Tarikh Keluar: " + formatTelegramDate_(record.tarikh));
    }
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
  if (requestType === REQUEST_TYPE.weekend) return "Outing Sabtu / Ahad";
  if (requestType === REQUEST_TYPE.emergency) return "Kecemasan";
  if (requestType === REQUEST_TYPE.overnight) return "Pulang Bermalam";
  if (requestType === REQUEST_TYPE.semester) return "CUTI SEMESTER";
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

}

function validateSemesterRequest_(payload, now) {
  const leaveDateKey = normalizeDateKey_(payload.tarikh) || formatDate_(now);
  const returnDateKey = normalizeDateKey_(payload.tarikh_balik);
  const expectedReturnTime = String(payload.masa_balik_dijangka || "").trim();

  if (!returnDateKey) {
    throw new Error("Tarikh Pulang Ke Asrama diperlukan untuk Cuti Semester.");
  }

  if (!expectedReturnTime) {
    throw new Error("Masa Dijangka Pulang Ke Asrama diperlukan untuk Cuti Semester.");
  }

  if (!/^\d{2}:\d{2}/.test(expectedReturnTime)) {
    throw new Error("Masa Dijangka Pulang Ke Asrama tidak sah.");
  }

  if (returnDateKey < leaveDateKey) {
    throw new Error("Tarikh Pulang Ke Asrama tidak boleh lebih awal daripada tarikh keluar.");
  }

  if (!normalizeText_(payload.lokasi || payload.location)) {
    throw new Error("Alamat / destinasi semasa cuti diperlukan.");
  }

  if (!normalizeText_(payload.telefon_waris)) {
    throw new Error("Telefon waris diperlukan untuk Cuti Semester.");
  }
}

function isLate_(date) {
  const hour = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "H"));
  const minute = Number(Utilities.formatDate(date, "Asia/Kuala_Lumpur", "m"));
  return hour > 22 || (hour === 22 && minute > 0);
}

function isHostelReturnRequest_(record) {
  return record &&
    (
      record.jenis_permohonan === REQUEST_TYPE.weekend ||
      record.jenis_permohonan === REQUEST_TYPE.overnight ||
      record.jenis_permohonan === REQUEST_TYPE.semester
    );
}

function isHostelReturnLate_(date, record) {
  const returnDateKey = normalizeDateKey_(record.tarikh_balik);
  const expectedReturnTime = normalizeStoredTimeOnly_(record.masa_balik_dijangka);
  if (!returnDateKey || !expectedReturnTime) {
    return false;
  }

  const expectedReturn = new Date(returnDateKey + "T" + expectedReturnTime.slice(0, 5) + ":00+08:00");
  return !isNaN(expectedReturn.getTime()) && date.getTime() > expectedReturn.getTime();
}

function isOvernightLate_(date, record) {
  return isHostelReturnLate_(date, record);
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

  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
    .getValues()[0]
    .map((header) => String(header).trim());

  const isHeaderBlank = currentHeaders.every((header) => header === "");
  if (isHeaderBlank) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    return;
  }

  const missingHeaders = headers.filter((header) => currentHeaders.indexOf(header) === -1);
  if (missingHeaders.length > 0) {
    let lastHeaderIndex = -1;
    currentHeaders.forEach((header, index) => {
      if (header !== "") {
        lastHeaderIndex = index;
      }
    });
    sheet.getRange(1, lastHeaderIndex + 2, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}

function findActiveStudent_(studentId, noMatrik) {
  return getRowsAsObjects_(getSheet_(SHEETS.students)).find((student) => (
    normalizeText_(student.student_id) === normalizeText_(studentId) &&
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
  const normalizedName = normalizeText_(wardenName);
  const normalizedPin = String(pin === undefined || pin === null ? "" : pin).trim();

  if (!normalizedName || !normalizedPin) {
    return null;
  }

  return getRowsAsObjects_(getSheet_(SHEETS.wardens)).find((warden) => (
    normalizeText_(warden.nama_warden) === normalizedName &&
    isActive_(warden.status) &&
    String(warden.pin === undefined || warden.pin === null ? "" : warden.pin).trim() === normalizedPin
  ));
}

function findActiveGuard_(guardName, pin) {
  const normalizedName = normalizeText_(guardName);
  const normalizedPin = String(pin === undefined || pin === null ? "" : pin).trim();

  if (!normalizedName || !normalizedPin) {
    return null;
  }

  return getRowsAsObjects_(getSheet_(SHEETS.guards)).find((guard) => (
    normalizeText_(guard.nama_guard) === normalizedName &&
    isActive_(guard.status) &&
    String(guard.pin === undefined || guard.pin === null ? "" : guard.pin).trim() === normalizedPin
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
