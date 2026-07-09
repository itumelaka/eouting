const APP_VERSION = "1.4.2";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec";
const ALLOW_MOCK_MODE = new URLSearchParams(window.location.search).get("mock") === "1";
const LIVE_API_UNSTABLE_MESSAGE = "Sambungan live tidak stabil. Sila cuba lagi.";

let students = [
  { id: "S001", no_matrik: "M001", name: "Ahmad Hakimi", className: "SKM 1", gender: "Lelaki", status: "Aktif" },
  { id: "S002", no_matrik: "M002", name: "Nur Aisyah", className: "SKM 1", gender: "Perempuan", status: "Aktif" },
  { id: "S003", no_matrik: "M003", name: "Muhammad Amir", className: "SKM 2", gender: "Lelaki", status: "Aktif" }
];

let wardens = [
  "Abang Wal Haffalrais Bin Abang Sabaki",
  "Siti Aishah Binti Ismail",
  "Sheikh Bukhori Bin Sheikh Ghadzi"
];

let guards = [
  "Pos Guard Utama",
  "Guard Bertugas 2"
];

const STATUS = {
  pending: "Menunggu Kelulusan",
  approved: "Diluluskan Warden",
  rejected: "Ditolak Warden",
  out: "Sedang Keluar",
  returned: "Sudah Pulang"
};

const REQUEST_TYPE = {
  normal: "OUTING_BIASA",
  emergency: "KECEMASAN",
  overnight: "PULANG_BERMALAM"
};

const REQUEST_TYPE_LABEL = {
  OUTING_BIASA: "Outing Biasa",
  KECEMASAN: "Kecemasan",
  PULANG_BERMALAM: "Pulang Bermalam"
};

const SESSION_STORAGE_KEY = "eouting_session_v1";
const SESSION_DURATION_MS = {
  student: 24 * 60 * 60 * 1000,
  warden: 12 * 60 * 60 * 1000,
  guard: 12 * 60 * 60 * 1000
};

const BM_MONTHS = [
  "Januari",
  "Februari",
  "Mac",
  "April",
  "Mei",
  "Jun",
  "Julai",
  "Ogos",
  "September",
  "Oktober",
  "November",
  "Disember"
];

let outingRecords = [];
let nextRequestNumber = 1;
let currentSession = null;
let isLiveMode = false;
let dataModeMessage = "";
let studentRefreshIntervalId = null;
let studentLastUpdatedAt = null;
let monitoringRefreshIntervalId = null;
let monitorLastUpdatedAt = null;
let toastTimerId = null;
const guardActionLocks = {};
const DEBUG_STUDENT_RECORDS = false;

const els = {
  todayDate: document.querySelector("#todayDate"),
  todayDay: document.querySelector("#todayDay"),
  currentTime: document.querySelector("#currentTime"),
  appShell: document.querySelector(".app-shell"),
  accessScreen: document.querySelector("#accessScreen"),
  appWorkspace: document.querySelector("#appWorkspace"),
  studentLoginPanel: document.querySelector("#studentLoginPanel"),
  wardenLoginPanel: document.querySelector("#wardenLoginPanel"),
  guardLoginPanel: document.querySelector("#guardLoginPanel"),
  roleGrid: document.querySelector("#roleGrid"),
  studentLoginSelect: document.querySelector("#studentLoginSelect"),
  matricInput: document.querySelector("#matricInput"),
  studentRememberInput: document.querySelector("#studentRememberInput"),
  studentLoginMessage: document.querySelector("#studentLoginMessage"),
  wardenSelect: document.querySelector("#wardenSelect"),
  wardenLoginMessage: null,
  wardenPinInput: null,
  wardenRememberInput: null,
  guardSelect: document.querySelector("#guardSelect"),
  guardLoginMessage: null,
  guardPinInput: null,
  guardRememberInput: null,
  logoutButton: document.querySelector("#logoutButton"),
  sessionRole: document.querySelector("#sessionRole"),
  sessionName: document.querySelector("#sessionName"),
  ruleNotice: document.querySelector("#ruleNotice"),
  loggedStudentName: document.querySelector("#loggedStudentName"),
  loggedStudentMeta: document.querySelector("#loggedStudentMeta"),
  requestTypeSelect: document.querySelector("#requestTypeSelect"),
  emergencyFields: document.querySelector("#emergencyFields"),
  overnightFields: document.querySelector("#overnightFields"),
  requestForm: document.querySelector("#requestForm"),
  purposeInput: document.querySelector("#purposeInput"),
  locationInput: document.querySelector("#locationInput"),
  returnDateInput: document.querySelector("#returnDateInput"),
  expectedReturnTimeInput: document.querySelector("#expectedReturnTimeInput"),
  vehicleTypeSelect: document.querySelector("#vehicleTypeSelect"),
  vehicleDetailInput: document.querySelector("#vehicleDetailInput"),
  emergencyReasonInput: document.querySelector("#emergencyReasonInput"),
  guardianPhoneInput: document.querySelector("#guardianPhoneInput"),
  guardianRelationSelect: document.querySelector("#guardianRelationSelect"),
  emergencyNoteInput: document.querySelector("#emergencyNoteInput"),
  studentMessage: document.querySelector("#studentMessage"),
  studentRecordsList: document.querySelector("#studentRecordsList"),
  studentRefreshButton: null,
  studentLastUpdated: null,
  wardenList: document.querySelector("#wardenList"),
  wardenApprovedList: document.querySelector("#wardenApprovedList"),
  guardApprovedList: document.querySelector("#guardApprovedList"),
  guardOutList: document.querySelector("#guardOutList"),
  allRecordsList: document.querySelector("#allRecordsList"),
  countPending: document.querySelector("#countPending"),
  countApproved: document.querySelector("#countApproved"),
  countOut: document.querySelector("#countOut"),
  countReturned: document.querySelector("#countReturned"),
  countLate: document.querySelector("#countLate"),
  countNotReturned: document.querySelector("#countNotReturned"),
  countEmergency: document.querySelector("#countEmergency"),
  appVersionText: document.querySelector("#appVersionText"),
  systemRefreshButton: document.querySelector("#systemRefreshButton"),
  dataModeIndicator: null,
  liveRetryButton: null
};

document.querySelectorAll("[data-role-choice]").forEach((button) => {
  button.addEventListener("click", () => showLoginPanel(button.dataset.roleChoice));
});

function setupAccessEnhancements() {
  setupClayRoleNav();
  setupStaffPinFields();
  setupMonitoringPanel();
  setupStatisticsPanel();
}

function setupClayRoleNav() {
  if (!els.roleGrid) {
    return;
  }

  els.roleGrid.classList.add("clay-role-nav");
  const roleLabels = {
    student: "Pelajar",
    warden: "Warden",
    guard: "Guard"
  };

  els.roleGrid.querySelectorAll("[data-role-choice]").forEach((button) => {
    const role = button.dataset.roleChoice;
    button.classList.add("clay-role-button");
    button.innerHTML = `<strong>${roleLabels[role] || button.textContent}</strong>`;
  });

  if (!els.roleGrid.querySelector('[data-role-choice="monitor"]')) {
    const monitorButton = document.createElement("button");
    monitorButton.className = "role-card clay-role-button";
    monitorButton.type = "button";
    monitorButton.dataset.roleChoice = "monitor";
    monitorButton.innerHTML = "<strong>Pemantauan Semasa</strong>";
    monitorButton.addEventListener("click", openMonitoringPage);
    els.roleGrid.appendChild(monitorButton);
  }

  if (!els.roleGrid.querySelector('[data-role-choice="stats"]')) {
    const statsButton = document.createElement("button");
    statsButton.className = "role-card clay-role-button";
    statsButton.type = "button";
    statsButton.dataset.roleChoice = "stats";
    statsButton.innerHTML = "<strong>Statistik</strong>";
    statsButton.addEventListener("click", openStatisticsPage);
    els.roleGrid.appendChild(statsButton);
  }
}

function setupStaffPinFields() {
  if (!els.wardenPinInput) {
    const wardenButton = els.wardenLoginPanel.querySelector('button[type="submit"]');
    const label = document.createElement("label");
    label.setAttribute("for", "wardenPinInput");
    label.textContent = "PIN";
    els.wardenPinInput = document.createElement("input");
    els.wardenPinInput.id = "wardenPinInput";
    els.wardenPinInput.type = "password";
    els.wardenPinInput.inputMode = "numeric";
    els.wardenPinInput.autocomplete = "current-password";
    els.wardenPinInput.placeholder = "PIN Warden";
    const rememberLabel = document.createElement("label");
    rememberLabel.className = "remember-device";
    els.wardenRememberInput = document.createElement("input");
    els.wardenRememberInput.id = "wardenRememberInput";
    els.wardenRememberInput.type = "checkbox";
    const rememberText = document.createElement("span");
    rememberText.textContent = "Ingat peranti ini";
    rememberLabel.appendChild(els.wardenRememberInput);
    rememberLabel.appendChild(rememberText);
    els.wardenLoginMessage = document.createElement("p");
    els.wardenLoginMessage.className = "form-message";
    els.wardenLoginPanel.insertBefore(label, wardenButton);
    els.wardenLoginPanel.insertBefore(els.wardenPinInput, wardenButton);
    els.wardenLoginPanel.insertBefore(rememberLabel, wardenButton);
    els.wardenLoginPanel.appendChild(els.wardenLoginMessage);
  }

  if (!els.guardPinInput) {
    const guardButton = els.guardLoginPanel.querySelector('button[type="submit"]');
    const label = document.createElement("label");
    label.setAttribute("for", "guardPinInput");
    label.textContent = "PIN";
    els.guardPinInput = document.createElement("input");
    els.guardPinInput.id = "guardPinInput";
    els.guardPinInput.type = "password";
    els.guardPinInput.inputMode = "numeric";
    els.guardPinInput.autocomplete = "current-password";
    els.guardPinInput.placeholder = "PIN Guard";
    const rememberLabel = document.createElement("label");
    rememberLabel.className = "remember-device";
    els.guardRememberInput = document.createElement("input");
    els.guardRememberInput.id = "guardRememberInput";
    els.guardRememberInput.type = "checkbox";
    const rememberText = document.createElement("span");
    rememberText.textContent = "Ingat peranti ini";
    rememberLabel.appendChild(els.guardRememberInput);
    rememberLabel.appendChild(rememberText);
    els.guardLoginMessage = document.createElement("p");
    els.guardLoginMessage.className = "form-message";
    els.guardLoginPanel.insertBefore(label, guardButton);
    els.guardLoginPanel.insertBefore(els.guardPinInput, guardButton);
    els.guardLoginPanel.insertBefore(rememberLabel, guardButton);
    els.guardLoginPanel.appendChild(els.guardLoginMessage);
  }
}

function setupMonitoringPanel() {
  if (document.querySelector("#monitor")) {
    return;
  }

  const panel = document.createElement("section");
  panel.className = "app-workspace monitor-workspace";
  panel.id = "monitorWorkspace";
  panel.innerHTML = `
    <div class="session-bar">
      <div>
        <span>Paparan</span>
        <strong>Pemantauan Semasa</strong>
      </div>
      <button class="secondary-action" id="monitorBackButton" type="button">Tukar Peranan</button>
    </div>
    <section class="tab-panel active" id="monitor">
      <div class="section-heading">
        <h2>Pemantauan Semasa</h2>
        <p>Read-only. Akses boleh dihadkan kepada Warden/HEP pada versi akan datang.</p>
      </div>
      <div class="monitor-actions">
        <button class="secondary-action" id="monitorRefreshButton" type="button">Refresh</button>
        <small id="monitorLastUpdated"></small>
      </div>
      <div class="summary-grid monitor-summary" id="monitorSummary"></div>
      <h3 class="list-title">Rekod Hari Ini</h3>
      <div class="record-list" id="monitorRecordsList"></div>
    </section>
  `;
  els.appShell.appendChild(panel);
  els.monitorWorkspace = panel;
  els.monitorBackButton = panel.querySelector("#monitorBackButton");
  els.monitorRefreshButton = panel.querySelector("#monitorRefreshButton");
  els.monitorLastUpdated = panel.querySelector("#monitorLastUpdated");
  els.monitorSummary = panel.querySelector("#monitorSummary");
  els.monitorRecordsList = panel.querySelector("#monitorRecordsList");
  els.monitorBackButton.addEventListener("click", closeMonitoringPage);
  els.monitorRefreshButton.addEventListener("click", refreshMonitoringRecords);
}

function setupStatisticsPanel() {
  if (document.querySelector("#statsWorkspace")) {
    return;
  }

  // Future version can restrict Statistik to Warden/HEP only.
  const panel = document.createElement("section");
  panel.className = "app-workspace stats-workspace";
  panel.id = "statsWorkspace";
  panel.innerHTML = `
    <div class="session-bar">
      <div>
        <span>Paparan</span>
        <strong>Statistik Outing</strong>
      </div>
      <button class="secondary-action" id="statsBackButton" type="button">Tukar Peranan</button>
    </div>
    <section class="tab-panel active" id="stats">
      <div class="section-heading">
        <h2>Statistik Outing</h2>
        <p>Ringkasan bulanan kekerapan outing pelajar</p>
      </div>
      <div class="stats-filter-card">
        <div class="stats-filter-grid">
          <div class="stats-filter-field">
            <label for="statsMonthSelect">Bulan</label>
            <select id="statsMonthSelect"></select>
          </div>
          <div class="stats-filter-field stats-filter-year">
            <label for="statsYearSelect">Tahun</label>
            <select id="statsYearSelect"></select>
          </div>
          <div class="stats-filter-field">
            <label for="statsClassSelect">Kelas</label>
            <select id="statsClassSelect"></select>
          </div>
        </div>
        <div class="stats-filter-actions">
          <button class="primary-action" id="statsGenerateButton" type="button">Jana Statistik</button>
          <button class="secondary-action" id="statsRefreshButton" type="button">Refresh</button>
        </div>
      </div>
      <div class="summary-grid stats-summary" id="statsSummary"></div>
      <section class="stats-section">
        <div class="student-record-heading">
          <h3>🏆 Juara Outing Bulanan</h3>
          <p>Ranking berdasarkan jumlah permohonan outing bulan ini.</p>
        </div>
        <div class="stats-list" id="statsLeaderboard"></div>
      </section>
      <section class="stats-section">
        <div class="student-record-heading">
          <h3>Ringkasan Mengikut Kelas</h3>
        </div>
        <div class="stats-list" id="statsClassSummary"></div>
      </section>
      <section class="stats-section">
        <div class="student-record-heading">
          <h3>Pecahan Status</h3>
        </div>
        <div class="status-pill-grid" id="statsStatusSummary"></div>
      </section>
    </section>
  `;
  els.appShell.appendChild(panel);
  els.statsWorkspace = panel;
  els.statsBackButton = panel.querySelector("#statsBackButton");
  els.statsMonthSelect = panel.querySelector("#statsMonthSelect");
  els.statsYearSelect = panel.querySelector("#statsYearSelect");
  els.statsClassSelect = panel.querySelector("#statsClassSelect");
  els.statsGenerateButton = panel.querySelector("#statsGenerateButton");
  els.statsRefreshButton = panel.querySelector("#statsRefreshButton");
  els.statsSummary = panel.querySelector("#statsSummary");
  els.statsLeaderboard = panel.querySelector("#statsLeaderboard");
  els.statsClassSummary = panel.querySelector("#statsClassSummary");
  els.statsStatusSummary = panel.querySelector("#statsStatusSummary");
  els.statsBackButton.addEventListener("click", closeStatisticsPage);
  els.statsGenerateButton.addEventListener("click", loadStatistics);
  els.statsRefreshButton.addEventListener("click", loadStatistics);
  setStatisticsYearOptions();
}

els.studentLoginPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedStudent = students.find((item) => item.id === els.studentLoginSelect.value);
  const enteredMatric = els.matricInput.value.trim().toUpperCase();

  if (isLiveMode) {
    try {
      const student = await apiPost("loginStudent", {
        nama: selectedStudent ? selectedStudent.name : "",
        no_matrik: enteredMatric
      });
      const mappedStudent = mapLiveStudent(student);
      rememberSessionIfRequested("student", mappedStudent, els.studentRememberInput);
      startStudentSession(mappedStudent);
    } catch (error) {
      els.studentLoginMessage.textContent = error.message;
      showError(error.message, "Log Masuk Gagal");
    }
    return;
  }

  if (!selectedStudent || selectedStudent.no_matrik !== enteredMatric) {
    const message = "Nama pelajar dan nombor matrik tidak sepadan.";
    els.studentLoginMessage.textContent = message;
    showError(message, "Log Masuk Gagal");
    return;
  }

  rememberSessionIfRequested("student", selectedStudent, els.studentRememberInput);
  startStudentSession(selectedStudent);
});

els.wardenLoginPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.wardenSelect.value;
  const pin = els.wardenPinInput ? els.wardenPinInput.value.trim() : "";
  if (els.wardenLoginMessage) els.wardenLoginMessage.textContent = "";

  if (isLiveMode) {
    try {
      const warden = await apiPost("loginWarden", { nama_warden: name, pin });
      startSession("warden", {
        name: warden.nama_warden || name,
        pin,
        email: warden.email || "",
        phone: warden.no_tel || ""
      });
      rememberSessionIfRequested("warden", {
        name: warden.nama_warden || name,
        nama_warden: warden.nama_warden || name,
        pin,
        email: warden.email || "",
        phone: warden.no_tel || ""
      }, els.wardenRememberInput);
    } catch (error) {
      const message = "Nama warden atau PIN tidak sah.";
      if (els.wardenLoginMessage) els.wardenLoginMessage.textContent = message;
      showError(message, "PIN Tidak Sah");
    }
    return;
  }

  if (pin && pin !== "949494") {
    const message = "Nama warden atau PIN tidak sah.";
    if (els.wardenLoginMessage) els.wardenLoginMessage.textContent = message;
    showError(message, "PIN Tidak Sah");
    return;
  }

  const mockWarden = { name, nama_warden: name, pin };
  rememberSessionIfRequested("warden", mockWarden, els.wardenRememberInput);
  startSession("warden", mockWarden);
});

els.guardLoginPanel.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = els.guardSelect.value;
  const pin = els.guardPinInput ? els.guardPinInput.value.trim() : "";
  if (els.guardLoginMessage) els.guardLoginMessage.textContent = "";

  if (isLiveMode) {
    try {
      const guard = await apiPost("loginGuard", { nama_guard: name, pin });
      startSession("guard", {
        name: guard.nama_guard || name,
        pin,
        email: guard.email || "",
        phone: guard.no_tel || ""
      });
      rememberSessionIfRequested("guard", {
        name: guard.nama_guard || name,
        nama_guard: guard.nama_guard || name,
        pin,
        email: guard.email || "",
        phone: guard.no_tel || ""
      }, els.guardRememberInput);
    } catch (error) {
      const message = "Nama guard atau PIN tidak sah.";
      if (els.guardLoginMessage) els.guardLoginMessage.textContent = message;
      showError(message, "PIN Tidak Sah");
    }
    return;
  }

  if (pin && pin !== "949494") {
    const message = "Nama guard atau PIN tidak sah.";
    if (els.guardLoginMessage) els.guardLoginMessage.textContent = message;
    showError(message, "PIN Tidak Sah");
    return;
  }

  const mockGuard = { name, nama_guard: name, pin };
  rememberSessionIfRequested("guard", mockGuard, els.guardRememberInput);
  startSession("guard", mockGuard);
});

els.logoutButton.addEventListener("click", () => {
  clearSavedSession();
  stopStudentAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = null;
  els.appWorkspace.classList.remove("active");
  els.accessScreen.classList.remove("hidden");
  hideLoginPanels();
  els.studentLoginMessage.textContent = "";
  showInfo("Anda telah log keluar.");
});

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.classList.contains("hidden")) {
      return;
    }

    document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.tab}`).classList.add("active");
  });
});

async function apiGet(action) {
  return apiGetWithParams(action);
}

async function apiGetWithParams(action, params = {}) {
  const searchParams = new URLSearchParams({
    action,
    _ts: String(Date.now())
  });

  Object.keys(params).forEach((key) => {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      searchParams.set(key, params[key]);
    }
  });

  return fetchApiGetWithRetry(action, searchParams);
}

async function fetchApiGetWithRetry(action, searchParams) {
  const retryDelays = [0, 600, 1200];
  let lastError = null;

  for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
    if (retryDelays[attempt]) {
      await delay(retryDelays[attempt]);
    }

    searchParams.set("_ts", String(Date.now()));

    try {
      const response = await fetch(`${GAS_WEB_APP_URL}?${searchParams.toString()}`, {
        cache: "no-store"
      });
      return await parseApiResponse(response, action);
    } catch (error) {
      lastError = error;
      console.warn(`Live API GET failed. Attempt ${attempt + 1}/${retryDelays.length}.`, {
        action,
        message: error.message
      });
    }
  }

  throw lastError || new Error(LIVE_API_UNSTABLE_MESSAGE);
}

async function apiPost(action, payload) {
  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.error || `API POST failed: ${action}`);
  }

  return result.data;
}

async function loadLiveMasters() {
  if (!GAS_WEB_APP_URL) {
    if (ALLOW_MOCK_MODE) {
      setMockMode("");
    } else {
      setLiveUnavailableMode("GAS Web App URL belum diset.");
    }
    return;
  }

  try {
    const [liveStudents, liveWardens, liveGuards] = await Promise.all([
      apiGet("getStudents"),
      apiGet("getWardens"),
      apiGet("getGuards")
    ]);

    students = liveStudents.map(mapLiveStudent);
    wardens = liveWardens.map((warden) => warden.nama_warden || warden.name).filter(Boolean);
    guards = liveGuards.map((guard) => guard.nama_guard || guard.name).filter(Boolean);
    isLiveMode = true;
    dataModeMessage = "";
    populateStudents();
    populateStaff();
    await loadTodayRecords();
    updateDataModeIndicator();
    hideLiveRetryButton();
  } catch (error) {
    if (ALLOW_MOCK_MODE) {
      setMockMode(`Live API unavailable. Using mock data. ${error.message}`);
    } else {
      setLiveUnavailableMode(error.message);
    }
  }
}

async function loadTodayRecords() {
  if (!isLiveMode) {
    render();
    return;
  }

  try {
    const records = await apiGet("getTodayRecords");
    outingRecords = records.map(mapLiveRecord);
    if (currentSession && currentSession.role === "student") {
      studentLastUpdatedAt = new Date();
      updateStudentLastUpdated();
    }
    render();
    if (els.monitorWorkspace && els.monitorWorkspace.classList.contains("active")) {
      renderMonitoring();
    }
  } catch (error) {
    showModeNotice(`Live records unavailable: ${error.message}`);
    render();
  }
}

async function apiPost(action, payload) {
  const response = await fetch(GAS_WEB_APP_URL, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, ...payload })
  });
  return parseApiResponse(response, action);
}

async function parseApiResponse(response, action) {
  const text = await response.text();
  const trimmed = text.trim();

  if (trimmed.startsWith("<")) {
    console.warn("Live API returned HTML instead of JSON.", {
      action,
      status: response.status,
      preview: trimmed.slice(0, 160)
    });
    throw new Error(LIVE_API_UNSTABLE_MESSAGE);
  }

  let result = null;
  try {
    result = JSON.parse(text);
  } catch (error) {
    console.warn("Live API JSON parse failed.", {
      action,
      status: response.status,
      message: error.message,
      preview: trimmed.slice(0, 160)
    });
    throw new Error(LIVE_API_UNSTABLE_MESSAGE);
  }

  if (!response.ok || !result.ok) {
    throw new Error(cleanApiError(result.error));
  }

  return result.data;
}

function cleanApiError(message) {
  const text = String(message || "").trim();
  if (!text || text.startsWith("<") || text.includes("Unexpected token")) {
    return LIVE_API_UNSTABLE_MESSAGE;
  }
  return text;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapLiveStudent(student) {
  return {
    id: student.student_id || student.id || "",
    student_id: student.student_id || student.id || "",
    studentId: student.student_id || student.id || "",
    no_matrik: student.no_matrik || "",
    noMatrik: student.no_matrik || "",
    name: student.nama || student.name || "",
    nama: student.nama || student.name || "",
    email: student.email || student.student_email || "",
    phone: student.no_tel || "",
    className: student.kelas || student.className || "",
    kelas: student.kelas || student.className || "",
    gender: student.jantina || student.gender || "",
    jantina: student.jantina || student.gender || "",
    status: student.status || ""
  };
}

function mapLiveRecord(record) {
  return {
    raw: record,
    id: record.request_id || "",
    request_id: record.request_id || "",
    studentId: record.student_id || "",
    student_id: record.student_id || "",
    no_matrik: record.no_matrik || "",
    noMatrik: record.no_matrik || "",
    studentName: record.nama || "",
    nama: record.nama || "",
    name: record.nama || "",
    className: record.kelas || "",
    kelas: record.kelas || "",
    gender: record.jantina || "",
    jenis_permohonan: record.jenis_permohonan || REQUEST_TYPE.normal,
    purpose: record.tujuan || "",
    tujuan: record.tujuan || "",
    location: record.lokasi || "",
    lokasi: record.lokasi || "",
    jenis_kenderaan: record.jenis_kenderaan || "",
    butiran_kenderaan: record.butiran_kenderaan || "",
    sebab_kecemasan: record.sebab_kecemasan || "",
    telefon_waris: record.telefon_waris || "",
    hubungan_waris: record.hubungan_waris || "",
    catatan_kecemasan: record.catatan_kecemasan || "",
    rawStatus: record.status || "",
    status: mapLiveStatus(record.status),
    lewat: record.lewat === "Ya",
    lewatText: record.lewat || "",
    requestedAt: parseDateValue(record.masa_mohon),
    masa_mohon: record.masa_mohon || "",
    approvedAt: parseDateValue(record.masa_approve),
    masa_approve: record.masa_approve || "",
    rejectedAt: record.status === "DITOLAK_WARDEN" ? parseDateValue(record.masa_approve) : null,
    outAt: parseDateValue(record.masa_keluar),
    masa_keluar: record.masa_keluar || "",
    returnedAt: parseDateValue(record.masa_masuk),
    masa_masuk: record.masa_masuk || "",
    approvedBy: record.status === "DILULUSKAN_WARDEN" || record.status === "KELUAR" || record.status === "SELESAI"
      ? record.warden_approve_by || ""
      : "",
    warden_approve_by: record.warden_approve_by || "",
    rejectedBy: record.status === "DITOLAK_WARDEN" ? record.warden_approve_by || "" : "",
    guardOutBy: record.guard_keluar_by || "",
    guard_keluar_by: record.guard_keluar_by || "",
    guardInBy: record.guard_masuk_by || "",
    guard_masuk_by: record.guard_masuk_by || "",
    catatan: record.catatan || ""
  };
}

function mapLiveStatus(status) {
  const statusMap = {
    MENUNGGU_KELULUSAN: STATUS.pending,
    DILULUSKAN_WARDEN: STATUS.approved,
    DITOLAK_WARDEN: STATUS.rejected,
    KELUAR: STATUS.out,
    SELESAI: STATUS.returned
  };

  return statusMap[status] || status || STATUS.pending;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function setMockMode(message) {
  isLiveMode = false;
  dataModeMessage = message || "";
  updateDataModeIndicator();
  populateStudents();
  populateStaff();
  render();
}

function setLiveUnavailableMode(message) {
  isLiveMode = false;
  dataModeMessage = message || LIVE_API_UNSTABLE_MESSAGE;
  students = [];
  wardens = [];
  guards = [];
  outingRecords = [];
  populateStudents();
  populateStaff();
  updateDataModeIndicator();
  showLiveRetryButton();
  hideLoginPanels();
  els.appWorkspace.classList.remove("active");
  els.accessScreen.classList.remove("hidden");
  showError(
    "Sistem tidak dapat berhubung dengan Google Sheets buat masa ini. Sila tekan Cuba Lagi atau Muat Semula Sistem.",
    "Sambungan Live Tidak Stabil"
  );
}

function showLiveRetryButton() {
  if (!els.dataModeIndicator) {
    setupDataModeIndicator();
  }

  if (!els.dataModeIndicator) {
    return;
  }

  if (!els.liveRetryButton) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "live-retry-button";
    button.textContent = "Cuba Lagi";
    button.addEventListener("click", retryLiveConnection);
    els.dataModeIndicator.insertAdjacentElement("afterend", button);
    els.liveRetryButton = button;
  }

  els.liveRetryButton.hidden = false;
  els.liveRetryButton.disabled = false;
}

function hideLiveRetryButton() {
  if (els.liveRetryButton) {
    els.liveRetryButton.hidden = true;
    els.liveRetryButton.disabled = false;
  }
}

async function retryLiveConnection() {
  if (els.liveRetryButton) {
    els.liveRetryButton.disabled = true;
  }

  try {
    await loadLiveMasters();
    if (isLiveMode) {
      showSuccess("Sambungan live berjaya dipulihkan.", "Live Mode");
    }
  } finally {
    if (els.liveRetryButton && !isLiveMode) {
      els.liveRetryButton.disabled = false;
    }
  }
}

function updateDataModeIndicator() {
  if (!els.dataModeIndicator) {
    els.dataModeIndicator = document.createElement("p");
    els.dataModeIndicator.setAttribute("aria-live", "polite");
    els.dataModeIndicator.style.margin = "0 0 12px";
    els.dataModeIndicator.style.fontWeight = "700";
    els.dataModeIndicator.style.color = isLiveMode ? "#15573b" : (ALLOW_MOCK_MODE ? "#8a2600" : "#9b111e");
    els.appShell.insertBefore(els.dataModeIndicator, els.appShell.firstElementChild);
  }

  const isLiveUnavailable = !isLiveMode && !ALLOW_MOCK_MODE && Boolean(dataModeMessage);
  els.dataModeIndicator.style.color = isLiveMode || (!ALLOW_MOCK_MODE && !dataModeMessage) ? "#15573b" : (ALLOW_MOCK_MODE ? "#8a2600" : "#9b111e");
  els.dataModeIndicator.style.background = !isLiveMode && ALLOW_MOCK_MODE ? "#fff0d9" : "";
  els.dataModeIndicator.style.border = !isLiveMode && ALLOW_MOCK_MODE ? "1px solid #ffb65c" : "";
  els.dataModeIndicator.style.borderRadius = !isLiveMode && ALLOW_MOCK_MODE ? "8px" : "";
  els.dataModeIndicator.style.padding = !isLiveMode && ALLOW_MOCK_MODE ? "8px 10px" : "";
  els.dataModeIndicator.textContent = isLiveMode
    ? "Live Mode: Google Sheets"
    : ALLOW_MOCK_MODE
      ? `Mock Mode: Demo Data${dataModeMessage ? ` - ${dataModeMessage}` : ""}`
    : isLiveUnavailable
      ? "Live Mode: Google Sheets - Sambungan tidak stabil"
      : "Live Mode: Google Sheets";
}

function showModeNotice(message) {
  dataModeMessage = message;
  updateDataModeIndicator();
}

function ensureToastHost() {
  let host = document.querySelector(".toast-host");

  if (!host) {
    host = document.createElement("div");
    host.className = "toast-host";
    host.setAttribute("aria-live", "polite");
    host.setAttribute("aria-atomic", "true");
    document.body.appendChild(host);
  }

  return host;
}

function dismissToast() {
  const host = document.querySelector(".toast-host");

  if (toastTimerId) {
    window.clearTimeout(toastTimerId);
    toastTimerId = null;
  }

  if (host) {
    host.innerHTML = "";
  }
}

function showToast(message, type = "info", title = "") {
  const host = ensureToastHost();
  const safeType = ["error", "success", "warning", "info"].includes(type) ? type : "info";
  const titleMap = {
    error: "Ralat",
    success: "Berjaya",
    warning: "Perhatian",
    info: "Makluman"
  };
  const iconMap = {
    error: "!",
    success: "OK",
    warning: "!",
    info: "i"
  };

  if (toastTimerId) {
    window.clearTimeout(toastTimerId);
  }

  host.innerHTML = `
    <article class="toast-card ${safeType}" role="status">
      <div class="toast-icon" aria-hidden="true">${escapeHtml(iconMap[safeType])}</div>
      <div class="toast-content">
        <strong>${escapeHtml(title || titleMap[safeType])}</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button class="toast-close" type="button" aria-label="Tutup makluman">x</button>
    </article>
  `;

  const closeButton = host.querySelector(".toast-close");
  if (closeButton) {
    closeButton.addEventListener("click", dismissToast);
  }

  toastTimerId = window.setTimeout(dismissToast, 4000);
}

function showError(message, title = "Ralat") {
  showToast(message, "error", title);
}

function showSuccess(message, title = "Berjaya") {
  showToast(message, "success", title);
}

function showWarning(message, title = "Perhatian") {
  showToast(message, "warning", title);
}

function showInfo(message, title = "Makluman") {
  showToast(message, "info", title);
}

function setupAppVersionUi() {
  if (els.appVersionText) {
    els.appVersionText.textContent = `eOuting ITU • v${APP_VERSION}`;
  }

  if (els.systemRefreshButton) {
    els.systemRefreshButton.addEventListener("click", refreshSystemCaches);
  }
}

async function refreshSystemCaches() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.toLowerCase().includes("eouting"))
          .map((cacheName) => caches.delete(cacheName))
      );
    }
  } catch (error) {
    console.warn("System refresh cache cleanup failed:", error);
  } finally {
    window.location.reload();
  }
}

function setupServiceWorkerUpdates() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("./service-worker.js");
      watchServiceWorkerUpdate(registration);
      await registration.update();
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    document.documentElement.dataset.swControllerChanged = "true";
  });
}

function watchServiceWorkerUpdate(registration) {
  if (!registration) {
    return;
  }

  registration.addEventListener("updatefound", () => {
    const newWorker = registration.installing;
    if (!newWorker) {
      return;
    }

    newWorker.addEventListener("statechange", () => {
      if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
        showUpdatePrompt();
      }
    });
  });
}

function showUpdatePrompt() {
  if (document.querySelector(".update-prompt")) {
    return;
  }

  const host = ensureToastHost();
  if (toastTimerId) {
    window.clearTimeout(toastTimerId);
    toastTimerId = null;
  }

  host.innerHTML = `
    <article class="toast-card info update-prompt" role="status">
      <div class="toast-icon" aria-hidden="true">i</div>
      <div class="toast-content">
        <strong>Versi Baru Tersedia</strong>
        <p>Sistem eOuting telah dikemas kini. Sila muat semula untuk versi terbaru.</p>
        <button class="toast-action" type="button">Muat Semula</button>
      </div>
      <button class="toast-close" type="button" aria-label="Tutup makluman">x</button>
    </article>
  `;

  const reloadButton = host.querySelector(".toast-action");
  const closeButton = host.querySelector(".toast-close");
  if (reloadButton) reloadButton.addEventListener("click", () => window.location.reload());
  if (closeButton) closeButton.addEventListener("click", dismissToast);
}

function startStudentSession(student) {
  try {
    startSession("student", student);
  } catch (error) {
    console.warn("Student view render warning:", error);
    if (!els.studentRecordsList || !els.studentRecordsList.innerHTML.trim()) {
      showError("Paparan rekod gagal dimuat. Sila tekan Refresh Status.", "Paparan Rekod");
    }
  }
}

// Basic pilot device-session persistence. For production, replace PIN persistence with backend session token or Google login.
function rememberSessionIfRequested(role, user, checkbox) {
  if (!checkbox || !checkbox.checked) {
    clearSavedSession();
    return;
  }

  saveSession(role, user);
}

function saveSession(role, user) {
  const duration = SESSION_DURATION_MS[role];
  if (!duration || !user) {
    return;
  }

  const session = {
    role,
    displayName: user.name || user.nama || user.nama_warden || user.nama_guard || "",
    expiresAt: Date.now() + duration
  };

  if (role === "student") {
    session.student_id = user.student_id || user.studentId || user.id || "";
    session.no_matrik = user.no_matrik || user.noMatrik || "";
    session.nama = user.nama || user.name || "";
    session.email = user.email || "";
    session.kelas = user.kelas || user.className || "";
  }

  if (role === "warden") {
    session.nama_warden = user.nama_warden || user.name || "";
    session.pin = user.pin || "";
  }

  if (role === "guard") {
    session.nama_guard = user.nama_guard || user.name || "";
    session.pin = user.pin || "";
  }

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn("Unable to save device session.");
  }
}

function getSavedSession() {
  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!rawSession) {
      return null;
    }

    const session = JSON.parse(rawSession);
    if (!session.expiresAt || Date.now() > Number(session.expiresAt)) {
      clearSavedSession();
      return null;
    }

    return session;
  } catch (error) {
    clearSavedSession();
    return null;
  }
}

function clearSavedSession() {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to clear device session.");
  }
}

async function restoreSavedSession() {
  const session = getSavedSession();
  if (!session) {
    return false;
  }

  if (session.role === "student") {
    const student = findStudentForSavedSession(session) || {
      id: session.student_id || "",
      student_id: session.student_id || "",
      studentId: session.student_id || "",
      no_matrik: session.no_matrik || "",
      noMatrik: session.no_matrik || "",
      name: session.nama || session.displayName || "",
      nama: session.nama || session.displayName || "",
      email: session.email || "",
      className: session.kelas || "",
      kelas: session.kelas || ""
    };
    startStudentSession(student);
    if (isLiveMode) {
      await loadTodayRecords();
    }
    return true;
  }

  if (session.role === "warden") {
    const wardenName = session.nama_warden || session.displayName || "";
    const isKnownWarden = wardens.some((warden) => normalizeValue(warden) === normalizeValue(wardenName));
    if (!session.pin || !isKnownWarden) {
      clearSavedSession();
      showInfo("Sesi warden tamat. Sila log masuk semula.");
      return false;
    }

    startSession("warden", {
      name: wardenName,
      nama_warden: wardenName,
      pin: session.pin
    });
    return true;
  }

  if (session.role === "guard") {
    const guardName = session.nama_guard || session.displayName || "";
    const isKnownGuard = guards.some((guard) => normalizeValue(guard) === normalizeValue(guardName));
    if (!session.pin || !isKnownGuard) {
      clearSavedSession();
      showInfo("Sesi guard tamat. Sila log masuk semula.");
      return false;
    }

    startSession("guard", {
      name: guardName,
      nama_guard: guardName,
      pin: session.pin
    });
    return true;
  }

  clearSavedSession();
  return false;
}

function findStudentForSavedSession(session) {
  return students.find((student) => (
    (session.student_id && normalizeValue(student.student_id || student.studentId || student.id) === normalizeValue(session.student_id)) ||
    (session.no_matrik && normalizeValue(student.no_matrik || student.noMatrik) === normalizeValue(session.no_matrik)) ||
    (session.nama && normalizeValue(student.nama || student.name) === normalizeValue(session.nama))
  ));
}

function setupFeedbackMessageObservers() {
  observeFeedbackMessage(els.studentMessage, inferStudentMessageToast);
}

function observeFeedbackMessage(element, resolver) {
  if (!element || element.dataset.toastObserved === "true") {
    return;
  }

  element.dataset.toastObserved = "true";
  let lastMessage = "";
  const observer = new MutationObserver(() => {
    const message = element.textContent.trim();

    if (!message || message === lastMessage) {
      return;
    }

    lastMessage = message;
    const toast = resolver(message);
    showToast(message, toast.type, toast.title);
  });

  observer.observe(element, {
    childList: true,
    characterData: true,
    subtree: true
  });
}

function inferStudentMessageToast(message) {
  const lowerMessage = normalizeValue(message);

  if (lowerMessage.includes("telah dihantar")) {
    return { type: "success", title: "Permohonan Dihantar" };
  }

  if (
    lowerMessage.includes("hanya dibuka") ||
    lowerMessage.includes("sila") ||
    lowerMessage.includes("sudah mempunyai")
  ) {
    return { type: "warning", title: "Perhatian" };
  }

  if (lowerMessage.includes("gagal") || lowerMessage.includes("ralat")) {
    return { type: "error", title: "Ralat" };
  }

  return { type: "info", title: "Makluman" };
}

function ensureStudentRefreshControls() {
  if (els.studentRefreshButton) {
    return;
  }

  const controls = document.createElement("div");
  controls.style.display = "grid";
  controls.style.gap = "6px";
  controls.style.margin = "10px 0";

  els.studentRefreshButton = document.createElement("button");
  els.studentRefreshButton.className = "secondary-action";
  els.studentRefreshButton.type = "button";
  els.studentRefreshButton.textContent = "Refresh Status";
  els.studentRefreshButton.addEventListener("click", async () => {
    await refreshStudentLiveRecords();
  });

  els.studentLastUpdated = document.createElement("small");
  els.studentLastUpdated.style.color = "#5b6678";

  controls.appendChild(els.studentRefreshButton);
  controls.appendChild(els.studentLastUpdated);
  els.studentRecordsList.parentNode.insertBefore(controls, els.studentRecordsList);
}

async function refreshStudentLiveRecords() {
  if (!currentSession || currentSession.role !== "student") {
    stopStudentAutoRefresh();
    return;
  }

  if (isLiveMode) {
    await loadTodayRecords();
  } else {
    renderStudent();
  }

  studentLastUpdatedAt = new Date();
  updateStudentLastUpdated();
}

function startStudentAutoRefresh() {
  stopStudentAutoRefresh();

  if (!isLiveMode || !currentSession || currentSession.role !== "student") {
    return;
  }

  studentRefreshIntervalId = window.setInterval(() => {
    refreshStudentLiveRecords();
  }, 30000);
}

function stopStudentAutoRefresh() {
  if (studentRefreshIntervalId) {
    window.clearInterval(studentRefreshIntervalId);
    studentRefreshIntervalId = null;
  }
}

function openMonitoringPage() {
  stopStudentAutoRefresh();
  hideLoginPanels();
  currentSession = null;
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.remove("active");
  if (els.monitorWorkspace) {
    els.monitorWorkspace.classList.add("active");
  }
  refreshMonitoringRecords();
  startMonitoringAutoRefresh();
}

function closeMonitoringPage() {
  stopMonitoringAutoRefresh();
  if (els.monitorWorkspace) {
    els.monitorWorkspace.classList.remove("active");
  }
  els.accessScreen.classList.remove("hidden");
}

async function refreshMonitoringRecords() {
  if (isLiveMode) {
    await loadTodayRecords();
  } else {
    renderMonitoring();
  }
  monitorLastUpdatedAt = new Date();
  updateMonitoringLastUpdated();
}

function startMonitoringAutoRefresh() {
  stopMonitoringAutoRefresh();
  if (!isLiveMode) {
    return;
  }

  monitoringRefreshIntervalId = window.setInterval(() => {
    refreshMonitoringRecords();
  }, 30000);
}

function stopMonitoringAutoRefresh() {
  if (monitoringRefreshIntervalId) {
    window.clearInterval(monitoringRefreshIntervalId);
    monitoringRefreshIntervalId = null;
  }
}

function updateMonitoringLastUpdated() {
  if (!els.monitorLastUpdated) {
    return;
  }

  els.monitorLastUpdated.textContent = monitorLastUpdatedAt
    ? `Dikemaskini: ${formatDisplayTime(monitorLastUpdatedAt)}`
    : "";
}

function renderMonitoring() {
  if (!els.monitorSummary || !els.monitorRecordsList) {
    return;
  }

  const summaryItems = [
    ["Menunggu Kelulusan", countByStatus(STATUS.pending)],
    ["Diluluskan", countByStatus(STATUS.approved)],
    ["Sedang Keluar", countByStatus(STATUS.out)],
    ["Selesai", countByStatus(STATUS.returned)],
    ["Lewat", outingRecords.filter((record) => record.lewat).length],
    ["Ditolak", countByStatus(STATUS.rejected)],
    ["Kecemasan", outingRecords.filter((record) => record.jenis_permohonan === REQUEST_TYPE.emergency).length]
  ];

  els.monitorSummary.innerHTML = summaryItems.map(([label, value]) => `
    <article class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join("");

  els.monitorRecordsList.innerHTML = outingRecords.length
    ? outingRecords.map(monitorRecordCard).join("")
    : emptyState("Belum ada rekod outing hari ini.");
}

function monitorRecordCard(record) {
  return `
    <article class="record-card">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(getRecordName(record) || "-")}</h3>
          <div class="record-meta">${escapeHtml(getRecordId(record))} | ${escapeHtml(record.className || record.kelas || "-")}</div>
        </div>
        <div class="badge-stack">
          <span class="badge ${badgeClass(record.status)}">${escapeHtml(record.status || "-")}</span>
        </div>
      </div>
      <div class="record-detail">
        <strong>Jenis:</strong> ${escapeHtml(requestTypeLabel(record.jenis_permohonan))}<br>
        <strong>Tujuan:</strong> ${escapeHtml(record.purpose || record.tujuan || "-")}<br>
        <strong>Lokasi:</strong> ${escapeHtml(record.location || record.lokasi || "-")}<br>
        <strong>Kenderaan:</strong> ${escapeHtml(record.jenis_kenderaan || "-")}<br>
        <strong>Masa Mohon:</strong> ${escapeHtml(formatDisplayDateTime(record.masa_mohon || record.requestedAt))}<br>
        <strong>Warden:</strong> ${escapeHtml(record.warden_approve_by || record.approvedBy || "-")}<br>
        <strong>Keluar:</strong> ${escapeHtml(formatDisplayDateTime(record.masa_keluar || record.outAt))}<br>
        <strong>Masuk:</strong> ${escapeHtml(formatDisplayDateTime(record.masa_masuk || record.returnedAt))}<br>
        <strong>Lewat:</strong> ${escapeHtml(record.lewatText || (record.lewat ? "Ya" : "-"))}
      </div>
    </article>
  `;
}

function updateStudentLastUpdated() {
  if (!els.studentLastUpdated) {
    return;
  }

  els.studentLastUpdated.textContent = studentLastUpdatedAt
    ? `Dikemaskini: ${studentLastUpdatedAt.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "";
}

els.requestTypeSelect.addEventListener("change", updateEmergencyFields);

els.requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const requestType = els.requestTypeSelect.value;

  if (!isLiveMode && !canSubmitRequest(requestType, new Date())) {
    els.studentMessage.textContent = "Outing Biasa hanya dibuka pada Selasa/Rabu selepas 5:00 PM. Hanya permohonan Kecemasan boleh dihantar sekarang.";
    return;
  }

  if (requestType === REQUEST_TYPE.emergency && !els.emergencyReasonInput.value.trim()) {
    els.studentMessage.textContent = "Sila isi Sebab Kecemasan sebelum menghantar permohonan Kecemasan.";
    return;
  }

  const student = currentSession && currentSession.role === "student" ? currentSession.user : null;

  if (!student) {
    els.studentMessage.textContent = "Sila masuk sebagai Pelajar dahulu.";
    return;
  }

  if (outingRecords.some((record) => isRecordForCurrentStudent(record) && isActiveStudentRequest(record))) {
    els.studentMessage.textContent = "Anda sudah mempunyai permohonan aktif hari ini. Sila semak status di bawah.";
    renderStudent();
    return;
  }

  if (isLiveMode) {
    try {
      const payload = {
        student_id: student.id,
        no_matrik: student.no_matrik,
        nama: student.name,
        student_email: student.email || "",
        email: student.email || "",
        kelas: student.className,
        jenis_permohonan: requestType,
        tujuan: els.purposeInput.value.trim(),
        lokasi: els.locationInput.value.trim(),
        jenis_kenderaan: els.vehicleTypeSelect.value,
        butiran_kenderaan: els.vehicleDetailInput.value.trim(),
        sebab_kecemasan: els.emergencyReasonInput.value.trim(),
        telefon_waris: els.guardianPhoneInput.value.trim(),
        hubungan_waris: els.guardianRelationSelect.value,
        catatan_kecemasan: els.emergencyNoteInput.value.trim()
      };
      const savedRecord = await apiPost("submitRequest", payload);
      els.requestForm.reset();
      updateEmergencyFields();
      els.studentMessage.textContent = `Permohonan ${savedRecord.request_id || savedRecord.id} telah dihantar dan sedang menunggu kelulusan warden.`;
      await loadTodayRecords();
      renderStudent();
    } catch (error) {
      els.studentMessage.textContent = error.message;
    }
    return;
  }

  const record = {
    id: createRequestId(),
    studentId: student.id,
    no_matrik: student.no_matrik,
    studentName: student.name,
    className: student.className,
    gender: student.gender,
    jenis_permohonan: requestType,
    purpose: els.purposeInput.value.trim(),
    location: els.locationInput.value.trim(),
    jenis_kenderaan: els.vehicleTypeSelect.value,
    butiran_kenderaan: els.vehicleDetailInput.value.trim(),
    sebab_kecemasan: els.emergencyReasonInput.value.trim(),
    telefon_waris: els.guardianPhoneInput.value.trim(),
    hubungan_waris: els.guardianRelationSelect.value,
    catatan_kecemasan: els.emergencyNoteInput.value.trim(),
    status: STATUS.pending,
    lewat: false,
    requestedAt: new Date(),
    approvedAt: null,
    rejectedAt: null,
    outAt: null,
    returnedAt: null,
    approvedBy: "",
    rejectedBy: "",
    guardOutBy: "",
    guardInBy: ""
  };

  outingRecords.unshift(record);
  els.requestForm.reset();
  updateEmergencyFields();
  els.studentMessage.textContent = `Permohonan ${record.id} telah dihantar dan sedang menunggu kelulusan warden.`;
  render();
});

function showLoginPanel(role) {
  hideLoginPanels();
  els.studentLoginMessage.textContent = "";

  if (role === "student") {
    els.studentLoginPanel.classList.add("active");
    return;
  }

  if (role === "warden") {
    els.wardenLoginPanel.classList.add("active");
    return;
  }

  if (role === "guard") {
    els.guardLoginPanel.classList.add("active");
  }
}

function hideLoginPanels() {
  els.studentLoginPanel.classList.remove("active");
  els.wardenLoginPanel.classList.remove("active");
  els.guardLoginPanel.classList.remove("active");
  els.matricInput.value = "";
  if (els.wardenPinInput) els.wardenPinInput.value = "";
  if (els.guardPinInput) els.guardPinInput.value = "";
  if (els.wardenLoginMessage) els.wardenLoginMessage.textContent = "";
  if (els.guardLoginMessage) els.guardLoginMessage.textContent = "";
}

function startSession(role, user) {
  // Mock frontend access only. Real GAS backend must validate role and identity later.
  stopStudentAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = { role, user };
  if (els.monitorWorkspace) {
    els.monitorWorkspace.classList.remove("active");
  }
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.add("active");
  els.sessionRole.textContent = roleLabel(role);
  els.sessionName.textContent = user.name;
  applyRoleView();
  render();
  if (role === "student") {
    refreshStudentLiveRecords();
    startStudentAutoRefresh();
  }
}

function applyRoleView() {
  // Frontend hiding is not real security; it only helps mock UI testing.
  const allowedTabs = {
    student: ["pelajar"],
    warden: ["warden", "dashboard"],
    guard: ["guard"]
  }[currentSession.role];

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("hidden", !allowedTabs.includes(button.dataset.tab));
    button.classList.remove("active");
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.remove("active");
  });

  const firstTab = allowedTabs[0];
  document.querySelector(`[data-tab="${firstTab}"]`).classList.add("active");
  document.querySelector(`#${firstTab}`).classList.add("active");

  if (currentSession.role === "student") {
    els.loggedStudentName.textContent = currentSession.user.name;
    els.loggedStudentMeta.textContent = `${currentSession.user.no_matrik} | ${currentSession.user.className} | ${currentSession.user.gender}`;
  }
}

function roleLabel(role) {
  if (role === "student") return "Pelajar";
  if (role === "warden") return "Warden";
  if (role === "guard") return "Guard";
  return "-";
}

function updateEmergencyFields() {
  const isEmergency = els.requestTypeSelect.value === REQUEST_TYPE.emergency;
  els.emergencyFields.classList.toggle("active", isEmergency);
  els.emergencyReasonInput.required = isEmergency;

  if (!isEmergency) {
    els.emergencyReasonInput.value = "";
    els.guardianPhoneInput.value = "";
    els.guardianRelationSelect.value = "";
    els.emergencyNoteInput.value = "";
  }
}

function createRequestId() {
  const today = new Date();
  const dateCode = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("");
  const runningNumber = String(nextRequestNumber).padStart(3, "0");
  nextRequestNumber += 1;
  return `OUT-${dateCode}-${runningNumber}`;
}

function populateStudents() {
  els.studentLoginSelect.innerHTML = students
    .map((student) => `<option value="${student.id}">${student.name} - ${student.className}</option>`)
    .join("");
}

function populateStaff() {
  els.wardenSelect.innerHTML = wardens
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
  els.guardSelect.innerHTML = guards
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
}

function updateClock() {
  const now = new Date();
  els.todayDate.textContent = now.toLocaleDateString("ms-MY", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
  els.todayDay.textContent = now.toLocaleDateString("ms-MY", { weekday: "long" });
  els.currentTime.textContent = now.toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  updateRuleNotice(now);
  render();
}

function updateRuleNotice(now) {
  const isOpen = isApplicationOpen(now);
  els.ruleNotice.classList.toggle("ok", isOpen);
  els.ruleNotice.textContent = isOpen
    ? "Outing Biasa dibuka sekarang. Permohonan Kecemasan boleh dihantar bila-bila masa dan tetap perlu kelulusan warden."
    : "Outing Biasa belum dibuka. Permohonan biasa hanya Selasa/Rabu selepas 5:00 PM. Permohonan Kecemasan masih boleh dihantar untuk kelulusan warden.";
}

function canSubmitRequest(requestType, date) {
  return requestType === REQUEST_TYPE.emergency || isApplicationOpen(date);
}

function isApplicationOpen(date) {
  const day = date.getDay();
  const hour = date.getHours();
  const isTuesdayOrWednesday = day === 2 || day === 3;
  return isTuesdayOrWednesday && hour >= 17;
}

function isAfterReturnLimit(date) {
  return date.getHours() > 22 || (date.getHours() === 22 && date.getMinutes() > 0);
}

function render() {
  renderStudent();
  renderWarden();
  renderGuard();
  renderDashboard();
}

function renderStudent() {
  if (!currentSession || currentSession.role !== "student") {
    return;
  }

  ensureStudentRefreshControls();
  updateStudentLastUpdated();
  updateStudentSubmitAvailability();

  const studentRecords = outingRecords.filter(isRecordForCurrentStudent);
  debugStudentRecords(studentRecords);
  els.studentRecordsList.innerHTML = studentRecords.length
    ? studentRecords.map((record) => studentStatusCard(record)).join("")
    : emptyState("Belum ada rekod permohonan untuk pelajar ini.");
}

function updateStudentSubmitAvailability() {
  if (!currentSession || currentSession.role !== "student") {
    return;
  }

  const hasActiveRequest = outingRecords.some((record) => (
    isRecordForCurrentStudent(record) && isActiveStudentRequest(record)
  ));
  const submitButton = els.requestForm.querySelector('button[type="submit"]');

  if (submitButton) {
    submitButton.disabled = hasActiveRequest;
  }

  if (hasActiveRequest && (!els.studentMessage.textContent || els.studentMessage.textContent === "Anda sudah mempunyai permohonan aktif hari ini. Sila semak status di bawah.")) {
    els.studentMessage.textContent = "Anda sudah mempunyai permohonan aktif hari ini. Sila semak status di bawah.";
  } else if (els.studentMessage.textContent === "Anda sudah mempunyai permohonan aktif hari ini. Sila semak status di bawah.") {
    els.studentMessage.textContent = "";
  }
}

function isActiveStudentRequest(record) {
  const status = record.rawStatus || reverseDisplayStatus(record.status);
  return ["MENUNGGU_KELULUSAN", "DILULUSKAN_WARDEN", "KELUAR"].includes(status);
}

function getRecordId(record) {
  return record ? record.request_id || record.id || "" : "";
}

function getRecordStudentId(record) {
  return record ? record.student_id || record.studentId || (record.student && record.student.student_id) || "" : "";
}

function getRecordNoMatrik(record) {
  return record ? record.no_matrik || record.noMatrik || (record.student && record.student.no_matrik) || "" : "";
}

function getRecordName(record) {
  return record ? record.nama || record.name || record.studentName || (record.student && record.student.nama) || "" : "";
}

function getCurrentStudent() {
  return currentSession && currentSession.role === "student" ? currentSession.user : null;
}

function getCurrentStudentId() {
  const currentStudent = getCurrentStudent();
  return currentStudent ? currentStudent.student_id || currentStudent.studentId || currentStudent.id || "" : "";
}

function getCurrentStudentNoMatrik() {
  const currentStudent = getCurrentStudent();
  return currentStudent ? currentStudent.no_matrik || currentStudent.noMatrik || "" : "";
}

function getCurrentStudentName() {
  const currentStudent = getCurrentStudent();
  return currentStudent ? currentStudent.nama || currentStudent.name || "" : "";
}

function isRecordForCurrentStudent(record) {
  const recordStudentId = normalizeValue(getRecordStudentId(record));
  const recordNoMatrik = normalizeValue(getRecordNoMatrik(record));
  const recordName = normalizeValue(getRecordName(record));
  const currentStudentId = normalizeValue(getCurrentStudentId());
  const currentNoMatrik = normalizeValue(getCurrentStudentNoMatrik());
  const currentName = normalizeValue(getCurrentStudentName());

  return Boolean(
    (recordStudentId && currentStudentId && recordStudentId === currentStudentId) ||
    (recordNoMatrik && currentNoMatrik && recordNoMatrik === currentNoMatrik) ||
    (recordName && currentName && recordName === currentName)
  );
}

function debugStudentRecords(studentRecords) {
  if (!DEBUG_STUDENT_RECORDS) {
    return;
  }

  console.debug("currentStudent", getCurrentStudent());
  console.debug("todayRecords", outingRecords);
  console.debug("studentRecords", studentRecords);
}

function isRecordForStudent(record, student) {
  if (!record || !student) {
    return false;
  }

  const recordStudentId = getRecordStudentId(record);
  const recordMatric = getRecordNoMatrik(record);
  const recordName = getRecordName(record);
  const studentId = student.student_id || student.studentId || student.id || "";
  const studentMatric = student.no_matrik || student.noMatrik || "";
  const studentName = student.nama || student.name || "";

  return (
    (recordStudentId && studentId && normalizeValue(recordStudentId) === normalizeValue(studentId)) ||
    (recordMatric && studentMatric && normalizeValue(recordMatric) === normalizeValue(studentMatric)) ||
    (recordName && studentName && normalizeValue(recordName) === normalizeValue(studentName))
  );
}

function studentStatusCard(record) {
  const statusInfo = studentStatusInfo(record);
  const emergencyDetail = emergencyDetailHtml(record);
  const wardenDetail = record.warden_approve_by || record.approvedBy
    ? `<br><strong>Warden:</strong> ${escapeHtml(record.warden_approve_by || record.approvedBy)}`
    : "";
  const approvalTime = record.masa_approve || record.approvedAt
    ? `<br><strong>Masa Kelulusan:</strong> ${escapeHtml(formatDisplayDateTime(record.masa_approve || record.approvedAt))}`
    : "";
  const outDetail = record.guard_keluar_by || record.guardOutBy
    ? `<br><strong>Guard Keluar:</strong> ${escapeHtml(record.guard_keluar_by || record.guardOutBy)}`
    : "";
  const outTime = record.masa_keluar || record.outAt
    ? `<br><strong>Masa Keluar:</strong> ${escapeHtml(formatDisplayDateTime(record.masa_keluar || record.outAt))}`
    : "";
  const inDetail = record.guard_masuk_by || record.guardInBy
    ? `<br><strong>Guard Masuk:</strong> ${escapeHtml(record.guard_masuk_by || record.guardInBy)}`
    : "";
  const inTime = record.masa_masuk || record.returnedAt
    ? `<br><strong>Masa Masuk:</strong> ${escapeHtml(formatDisplayDateTime(record.masa_masuk || record.returnedAt))}`
    : "";
  const noteDetail = record.catatan
    ? `<br><strong>Catatan:</strong> ${escapeHtml(record.catatan)}`
    : "";
  const vehicleDetail = record.butiran_kenderaan
    ? `<br><strong>Butiran Kenderaan:</strong> ${escapeHtml(record.butiran_kenderaan)}`
    : "";

  return `
    <article class="record-card">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(getRecordId(record))}</h3>
          <div class="record-meta">${escapeHtml(requestTypeLabel(record.jenis_permohonan))} | ${escapeHtml(record.className || record.kelas || "-")}</div>
        </div>
        <div class="badge-stack">
          <span class="badge ${statusInfo.badgeClass}">${escapeHtml(statusInfo.badge)}</span>
        </div>
      </div>
      <p class="record-detail"><strong>Status Semasa:</strong> ${escapeHtml(statusInfo.message)}</p>
      <div class="record-detail">
        <strong>Tujuan:</strong> ${escapeHtml(record.purpose || record.tujuan || "-")}<br>
        <strong>Lokasi:</strong> ${escapeHtml(record.location || record.lokasi || "-")}<br>
        <strong>Kenderaan:</strong> ${escapeHtml(record.jenis_kenderaan || "-")}
        ${vehicleDetail}
        ${emergencyDetail}
        ${wardenDetail}
        ${approvalTime}
        ${outDetail}
        ${outTime}
        ${inDetail}
        ${inTime}
        ${noteDetail}
      </div>
      <div class="record-times">
        <span>Mohon: ${escapeHtml(formatDisplayDateTime(record.masa_mohon || record.requestedAt))}</span>
        <span>Status: ${escapeHtml(statusInfo.badge)}</span>
      </div>
    </article>
  `;
}

function studentStatusInfo(record) {
  const status = record.rawStatus || reverseDisplayStatus(record.status);

  if (status === "MENUNGGU_KELULUSAN") {
    return {
      badge: "Menunggu Kelulusan Warden",
      badgeClass: "badge-pending",
      message: "Permohonan anda telah dihantar. Sila tunggu kelulusan warden sebelum bergerak ke pos guard."
    };
  }

  if (status === "DILULUSKAN_WARDEN") {
    return {
      badge: "Diluluskan Warden",
      badgeClass: "badge-approved",
      message: "Permohonan telah diluluskan. Sila ke pos guard untuk pengesahan keluar."
    };
  }

  if (status === "DITOLAK_WARDEN") {
    return {
      badge: "Ditolak Warden",
      badgeClass: "badge-rejected",
      message: "Permohonan tidak diluluskan. Sila rujuk warden bertugas."
    };
  }

  if (status === "KELUAR") {
    return {
      badge: "Sedang Outing",
      badgeClass: "badge-out",
      message: "Anda sedang outing. Sila pulang sebelum atau pada 10:00 PM."
    };
  }

  if (status === "SELESAI") {
    const isLate = record.lewat === true || record.lewatText === "Ya";
    return {
      badge: isLate ? "Selesai - Lewat" : "Selesai",
      badgeClass: isLate ? "badge-late" : "badge-returned",
      message: isLate ? "Permohonan selesai, tetapi rekod masuk ditanda lewat." : "Permohonan selesai."
    };
  }

  return {
    badge: record.status || "Status Tidak Diketahui",
    badgeClass: badgeClass(record.status),
    message: "Sila semak status permohonan anda."
  };
}

function reverseDisplayStatus(status) {
  if (status === STATUS.pending) return "MENUNGGU_KELULUSAN";
  if (status === STATUS.approved) return "DILULUSKAN_WARDEN";
  if (status === STATUS.rejected) return "DITOLAK_WARDEN";
  if (status === STATUS.out) return "KELUAR";
  if (status === STATUS.returned) return "SELESAI";
  return status || "";
}

function canSubmitNormalOuting(date = new Date()) {
  const parts = getKualaLumpurDateTimeParts(date);
  const day = Number(parts.weekday);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  const isTuesdayOrWednesday = day === 2 || day === 3;
  const isAfterOpening = hour > 17 || (hour === 17 && minute >= 0);
  const isBeforeOrAtReturnLimit = hour < 22 || (hour === 22 && minute === 0);

  return isTuesdayOrWednesday && isAfterOpening && isBeforeOrAtReturnLimit;
}

function getKualaLumpurDateTimeParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Kuala_Lumpur"
  }).formatToParts(date);
  const result = {
    weekday: "0",
    hour: "0",
    minute: "0"
  };
  const weekdayMap = {
    Sun: "0",
    Mon: "1",
    Tue: "2",
    Wed: "3",
    Thu: "4",
    Fri: "5",
    Sat: "6"
  };

  parts.forEach((part) => {
    if (part.type === "weekday") {
      result.weekday = weekdayMap[part.value] || "0";
    }

    if (part.type === "hour") {
      result.hour = part.value;
    }

    if (part.type === "minute") {
      result.minute = part.value;
    }
  });

  return result;
}

function renderStudent() {
  if (!currentSession || currentSession.role !== "student") {
    return;
  }

  const student = currentSession.user;
  ensureStudentRefreshControls();
  els.loggedStudentName.textContent = student.name || student.nama || "-";
  els.loggedStudentMeta.textContent = `${student.className || student.kelas || "-"} | ${student.no_matrik || student.noMatrik || "-"}`;
  els.ruleNotice.className = canSubmitNormalOuting() ? "notice ok" : "notice";
  els.ruleNotice.textContent = canSubmitNormalOuting()
    ? "Outing Biasa dibuka. Permohonan kecemasan juga boleh dihantar jika perlu."
    : "Outing Biasa hanya dibuka pada Selasa/Rabu selepas 5:00 petang. Permohonan kecemasan boleh dihantar bila-bila masa.";

  const studentRecords = outingRecords.filter(isRecordForCurrentStudent);
  debugStudentRecords(studentRecords);
  els.studentRecordsList.innerHTML = renderStudentRecordSections(studentRecords);
  bindStudentHistoryToggles();
  updateStudentSubmitState();
}

function renderStudentRecordSections(studentRecords) {
  const activeRecords = studentRecords.filter(isActiveStudentRecord);
  const historyRecords = studentRecords.filter(isStudentHistoryRecord);
  const activeHtml = activeRecords.length
    ? activeRecords.map(studentStatusCard).join("")
    : emptyState("Tiada permohonan aktif.");
  const historyHtml = historyRecords.length
    ? historyRecords.map(studentHistoryCard).join("")
    : "";

  return `
    <section class="student-record-section">
      <div class="student-record-heading">
        <h3>Rekod Aktif</h3>
      </div>
      <div class="record-list">${activeHtml}</div>
    </section>
    <section class="student-record-section student-history-section">
      <div class="student-record-heading">
        <h3>Sejarah Hari Ini</h3>
        <p>Rekod selesai atau ditolak untuk rujukan hari ini.</p>
      </div>
      ${historyHtml ? `<div class="record-list student-history-list">${historyHtml}</div>` : ""}
    </section>
  `;
}

function isActiveStudentRecord(record) {
  const status = record.rawStatus || reverseDisplayStatus(record.status);
  return status === "MENUNGGU_KELULUSAN" || status === "DILULUSKAN_WARDEN" || status === "KELUAR";
}

function isStudentHistoryRecord(record) {
  const status = record.rawStatus || reverseDisplayStatus(record.status);
  return status === "SELESAI" || status === "DITOLAK_WARDEN";
}

function studentHistoryCard(record) {
  const statusInfo = studentStatusInfo(record);
  const isRejected = (record.rawStatus || reverseDisplayStatus(record.status)) === "DITOLAK_WARDEN";
  const inTime = record.masa_masuk || record.returnedAt
    ? `<span>Masuk: ${escapeHtml(formatDisplayDateTime(record.masa_masuk || record.returnedAt))}</span>`
    : "";
  const noteDetail = isRejected && record.catatan
    ? `<span>Catatan: ${escapeHtml(record.catatan)}</span>`
    : "";
  const detailsId = `history-${String(getRecordId(record) || "record").replace(/[^a-z0-9_-]/gi, "-")}`;
  const vehicleDetail = record.butiran_kenderaan
    ? `<br><strong>Butiran Kenderaan:</strong> ${escapeHtml(record.butiran_kenderaan)}`
    : "";
  const emergencyDetail = emergencyDetailHtml(record);
  const actorDetail = actorDetailHtml(record);

  return `
    <article class="history-card">
      <div class="history-summary">
        <div>
          <h4>${escapeHtml(getRecordId(record))}</h4>
          <p>${escapeHtml(requestTypeLabel(record.jenis_permohonan))} | ${escapeHtml(record.purpose || record.tujuan || "-")}</p>
        </div>
        <span class="badge ${statusInfo.badgeClass}">${escapeHtml(statusInfo.badge)}</span>
      </div>
      <div class="history-meta">
        <span>Lokasi: ${escapeHtml(record.location || record.lokasi || "-")}</span>
        <span>Mohon: ${escapeHtml(formatDisplayDateTime(record.masa_mohon || record.requestedAt))}</span>
        ${inTime}
        ${noteDetail}
      </div>
      <button class="history-toggle" type="button" data-history-toggle="${detailsId}" aria-expanded="false">
        Lihat Butiran
      </button>
      <div class="history-details" id="${detailsId}" hidden>
        <div class="record-detail">
          <strong>Status Semasa:</strong> ${escapeHtml(statusInfo.message)}<br>
          <strong>Jenis Permohonan:</strong> ${escapeHtml(requestTypeLabel(record.jenis_permohonan))}<br>
          <strong>Tujuan:</strong> ${escapeHtml(record.purpose || record.tujuan || "-")}<br>
          <strong>Lokasi:</strong> ${escapeHtml(record.location || record.lokasi || "-")}<br>
          <strong>Kenderaan:</strong> ${escapeHtml(record.jenis_kenderaan || "-")}
          ${vehicleDetail}
          ${emergencyDetail}
          ${actorDetail}
        </div>
        <div class="record-times">
          <span>Mohon: ${escapeHtml(formatDisplayDateTime(record.masa_mohon || record.requestedAt))}</span>
          <span>Lulus/Tolak: ${escapeHtml(formatDisplayDateTime(record.masa_approve || record.approvedAt || record.rejectedAt))}</span>
          <span>Keluar: ${escapeHtml(formatDisplayDateTime(record.masa_keluar || record.outAt))}</span>
          <span>Masuk: ${escapeHtml(formatDisplayDateTime(record.masa_masuk || record.returnedAt))}</span>
        </div>
      </div>
    </article>
  `;
}

function bindStudentHistoryToggles() {
  if (!els.studentRecordsList) {
    return;
  }

  els.studentRecordsList.querySelectorAll("[data-history-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const details = document.getElementById(button.dataset.historyToggle);
      if (!details) {
        console.warn("History details element not found.");
        return;
      }

      const willShow = details.hidden;
      details.hidden = !willShow;
      button.setAttribute("aria-expanded", String(willShow));
      button.textContent = willShow ? "Sembunyi Butiran" : "Lihat Butiran";
    });
  });
}

function openStatisticsPage() {
  stopStudentAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = null;
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.remove("active");
  if (els.monitorWorkspace) els.monitorWorkspace.classList.remove("active");
  els.statsWorkspace.classList.add("active");
  setupStatsFilters();
  loadStatistics();
}

function closeStatisticsPage() {
  els.statsWorkspace.classList.remove("active");
  els.accessScreen.classList.remove("hidden");
  hideLoginPanels();
}

function setupStatsFilters() {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const monthNames = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember"
  ];

  if (!els.statsMonthSelect.dataset.ready) {
    els.statsMonthSelect.innerHTML = monthNames
      .map((month, index) => `<option value="${index + 1}">${month}</option>`)
      .join("");
    els.statsMonthSelect.dataset.ready = "true";
  }

  if (!els.statsYearSelect.dataset.ready) {
    const years = [];
    for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
      years.push(year);
    }
    els.statsYearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join("");
    els.statsYearSelect.dataset.ready = "true";
  }

  els.statsMonthSelect.value = els.statsMonthSelect.value || String(currentMonth);
  els.statsYearSelect.value = els.statsYearSelect.value || String(currentYear);
  populateStatsClassFilter();
}

function populateStatsClassFilter() {
  const selectedValue = els.statsClassSelect.value;
  const classNames = Array.from(new Set(
    students.map((student) => student.kelas || student.className).filter(Boolean)
  )).sort();

  els.statsClassSelect.innerHTML = `<option value="">Semua Kelas</option>${classNames
    .map((kelas) => `<option value="${escapeHtml(kelas)}">${escapeHtml(kelas)}</option>`)
    .join("")}`;
  els.statsClassSelect.value = classNames.includes(selectedValue) ? selectedValue : "";
}

function setStatisticsYearOptions() {
  if (!els.statsYearSelect) {
    return;
  }

  const allowedYears = [2026, 2027, 2028, 2029, 2030];
  const selectedYear = Number(els.statsYearSelect.value);
  const malaysiaYear = Number(new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date()));
  const defaultYear = allowedYears.includes(malaysiaYear) ? malaysiaYear : 2026;
  const yearToUse = allowedYears.includes(selectedYear) ? selectedYear : defaultYear;

  els.statsYearSelect.innerHTML = allowedYears
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  els.statsYearSelect.value = String(yearToUse);
}

async function loadStatistics() {
  setStatisticsYearOptions();
  const params = {
    month: els.statsMonthSelect.value,
    year: els.statsYearSelect.value,
    kelas: els.statsClassSelect.value
  };

  try {
    const stats = isLiveMode
      ? await apiGetWithParams("getOutingStats", params)
      : buildMockOutingStats(params);
    renderStatistics(stats);
  } catch (error) {
    showError(error.message || "Statistik gagal dimuat.", "Statistik Gagal");
    renderStatistics(emptyStats(params));
  }
}

function buildMockOutingStats(params) {
  const month = Number(params.month);
  const year = Number(params.year);
  const kelasFilter = normalizeValue(params.kelas);
  const records = outingRecords.filter((record) => {
    const date = parseFlexibleDate(record.masa_mohon || record.requestedAt);
    if (!date) return false;
    const isSameMonth = date.getMonth() + 1 === month && date.getFullYear() === year;
    const isSameClass = !kelasFilter || normalizeValue(record.kelas || record.className) === kelasFilter;
    return isSameMonth && isSameClass;
  });
  return computeStatsFromRecords(records, month, year);
}

function computeStatsFromRecords(records, month, year) {
  const totals = {
    total_requests: records.length,
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
  const studentMap = {};
  const classMap = {};
  const statusMap = {};

  records.forEach((record) => {
    const status = record.rawStatus || reverseDisplayStatus(record.status);
    const studentKey = getRecordStudentId(record) || getRecordNoMatrik(record) || getRecordName(record) || "UNKNOWN";
    const kelas = record.kelas || record.className || "Tidak Dinyatakan";
    const late = record.lewat === true || record.lewatText === "Ya";
    const requestType = record.jenis_permohonan;
    const completed = status === "SELESAI";

    if (status === "SELESAI") totals.total_completed += 1;
    if (status === "MENUNGGU_KELULUSAN") totals.total_pending += 1;
    if (status === "DILULUSKAN_WARDEN") totals.total_approved += 1;
    if (status === "KELUAR") totals.total_out += 1;
    if (status === "DITOLAK_WARDEN") totals.total_rejected += 1;
    if (requestType === REQUEST_TYPE.emergency) totals.total_emergency += 1;
    if (requestType === REQUEST_TYPE.normal) totals.total_normal += 1;
    if (late) totals.total_late += 1;
    statusMap[status] = (statusMap[status] || 0) + 1;

    if (!studentMap[studentKey]) {
      studentMap[studentKey] = {
        student_id: getRecordStudentId(record),
        no_matrik: getRecordNoMatrik(record),
        nama: getRecordName(record),
        kelas,
        total_requests: 0,
        completed: 0,
        emergency: 0,
        normal: 0,
        late: 0,
        last_request_at: ""
      };
    }

    studentMap[studentKey].total_requests += 1;
    if (completed) studentMap[studentKey].completed += 1;
    if (requestType === REQUEST_TYPE.emergency) studentMap[studentKey].emergency += 1;
    if (requestType === REQUEST_TYPE.normal) studentMap[studentKey].normal += 1;
    if (late) studentMap[studentKey].late += 1;
    studentMap[studentKey].last_request_at = record.masa_mohon || record.requestedAt || studentMap[studentKey].last_request_at;

    if (!classMap[kelas]) {
      classMap[kelas] = { kelas, total_requests: 0, completed: 0, emergency: 0, late: 0, studentKeys: {} };
    }
    classMap[kelas].total_requests += 1;
    if (completed) classMap[kelas].completed += 1;
    if (requestType === REQUEST_TYPE.emergency) classMap[kelas].emergency += 1;
    if (late) classMap[kelas].late += 1;
    classMap[kelas].studentKeys[studentKey] = true;
  });

  totals.total_students = Object.keys(studentMap).length;

  return {
    month,
    year,
    generated_at: new Date().toISOString(),
    totals,
    leaderboard: Object.values(studentMap)
      .sort((a, b) => (
        b.total_requests - a.total_requests ||
        b.completed - a.completed ||
        b.late - a.late ||
        String(a.nama).localeCompare(String(b.nama))
      ))
      .map((student, index) => ({ rank: index + 1, ...student })),
    class_summary: Object.values(classMap).map((item) => ({
      kelas: item.kelas,
      total_requests: item.total_requests,
      completed: item.completed,
      emergency: item.emergency,
      late: item.late,
      total_students: Object.keys(item.studentKeys).length
    })),
    status_summary: Object.keys(statusMap).sort().map((status) => ({ status, count: statusMap[status] }))
  };
}

function emptyStats(params) {
  return {
    month: Number(params.month),
    year: Number(params.year),
    generated_at: "",
    totals: {
      total_requests: 0,
      total_completed: 0,
      total_pending: 0,
      total_approved: 0,
      total_out: 0,
      total_rejected: 0,
      total_emergency: 0,
      total_normal: 0,
      total_late: 0,
      total_students: 0
    },
    leaderboard: [],
    class_summary: [],
    status_summary: []
  };
}

function renderStatistics(stats) {
  const totals = stats.totals || emptyStats(stats).totals;
  els.statsSummary.innerHTML = [
    ["Jumlah Permohonan", totals.total_requests],
    ["Selesai", totals.total_completed],
    ["Kecemasan", totals.total_emergency],
    ["Lewat", totals.total_late],
    ["Pelajar Terlibat", totals.total_students]
  ].map(([label, value]) => `
    <article class="summary-card stats-card">
      <span>${escapeHtml(label)}</span>
      <strong>${Number(value || 0)}</strong>
    </article>
  `).join("");

  els.statsLeaderboard.innerHTML = stats.leaderboard && stats.leaderboard.length
    ? stats.leaderboard.slice(0, 10).map(leaderboardCard).join("")
    : emptyState("Belum ada rekod outing untuk bulan ini.");

  els.statsClassSummary.innerHTML = stats.class_summary && stats.class_summary.length
    ? stats.class_summary.map(classSummaryCard).join("")
    : emptyState("Belum ada ringkasan kelas untuk bulan ini.");

  const statusOrder = ["MENUNGGU_KELULUSAN", "DILULUSKAN_WARDEN", "DITOLAK_WARDEN", "KELUAR", "SELESAI"];
  const statusMap = {};
  (stats.status_summary || []).forEach((item) => {
    statusMap[item.status] = item.count;
  });
  els.statsStatusSummary.innerHTML = statusOrder.map((status) => `
    <span class="status-pill ${badgeClass(mapLiveStatus(status))}">${escapeHtml(status)} <strong>${Number(statusMap[status] || 0)}</strong></span>
  `).join("");
}

function leaderboardCard(item) {
  const topClass = item.rank <= 3 ? ` leaderboard-top-${item.rank}` : "";
  return `
    <article class="leaderboard-card${topClass}">
      <div class="leaderboard-rank">#${Number(item.rank || 0)}</div>
      <div>
        <h4>${escapeHtml(item.nama || "-")}</h4>
        <p>Ranking Kekerapan Outing • ${escapeHtml(item.kelas || "-")}</p>
      </div>
      <div class="leaderboard-metrics">
        <span>Jumlah <strong>${Number(item.total_requests || 0)}</strong></span>
        <span>Selesai <strong>${Number(item.completed || 0)}</strong></span>
        <span>Kecemasan <strong>${Number(item.emergency || 0)}</strong></span>
        <span>Lewat <strong>${Number(item.late || 0)}</strong></span>
      </div>
      <small>Terakhir Mohon: ${escapeHtml(formatDisplayDateTime(item.last_request_at))}</small>
    </article>
  `;
}

function classSummaryCard(item) {
  return `
    <article class="class-summary-card">
      <strong>${escapeHtml(item.kelas || "-")}</strong>
      <span>Jumlah: ${Number(item.total_requests || 0)}</span>
      <span>Selesai: ${Number(item.completed || 0)}</span>
      <span>Kecemasan: ${Number(item.emergency || 0)}</span>
      <span>Lewat: ${Number(item.late || 0)}</span>
      <span>Pelajar: ${Number(item.total_students || 0)}</span>
    </article>
  `;
}

function renderWarden() {
  const pendingRecords = outingRecords.filter((record) => record.status === STATUS.pending);
  const approvedRecords = outingRecords.filter((record) => record.status === STATUS.approved);

  els.wardenList.innerHTML = pendingRecords.length
    ? pendingRecords.map((record) => recordCard(record, "warden")).join("")
    : emptyState("Tiada permohonan menunggu kelulusan.");

  els.wardenApprovedList.innerHTML = approvedRecords.length
    ? approvedRecords.map((record) => recordCard(record, "dashboard")).join("")
    : emptyState("Tiada permohonan diluluskan yang menunggu pengesahan guard.");

  els.wardenList.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(button.dataset.approve, STATUS.approved));
  });

  els.wardenList.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(button.dataset.reject, STATUS.rejected));
  });
}

function renderGuard() {
  const approvedRecords = outingRecords.filter((record) => record.status === STATUS.approved);
  const outRecords = outingRecords.filter((record) => record.status === STATUS.out);

  els.guardApprovedList.innerHTML = approvedRecords.length
    ? approvedRecords.map((record) => recordCard(record, "guard-out")).join("")
    : emptyState("Tiada pelajar yang telah diluluskan untuk keluar.");

  els.guardOutList.innerHTML = outRecords.length
    ? outRecords.map((record) => recordCard(record, "guard-in")).join("")
    : emptyState("Tiada pelajar sedang keluar.");

  els.guardApprovedList.querySelectorAll("[data-out]").forEach((button) => {
    button.addEventListener("click", () => confirmOut(button.dataset.out));
  });

  els.guardOutList.querySelectorAll("[data-in]").forEach((button) => {
    button.addEventListener("click", () => confirmIn(button.dataset.in));
  });
}

function renderDashboard() {
  const now = new Date();
  els.countPending.textContent = countByStatus(STATUS.pending);
  els.countApproved.textContent = countByStatus(STATUS.approved);
  els.countOut.textContent = countByStatus(STATUS.out);
  els.countReturned.textContent = countByStatus(STATUS.returned);
  els.countLate.textContent = outingRecords.filter((record) => record.lewat).length;
  els.countNotReturned.textContent = outingRecords.filter((record) => (
    record.status === STATUS.out && isAfterReturnLimit(now, record)
  )).length;
  els.countEmergency.textContent = outingRecords.filter((record) => (
    record.jenis_permohonan === REQUEST_TYPE.emergency
  )).length;

  els.allRecordsList.innerHTML = outingRecords.length
    ? outingRecords.map((record) => recordCard(record, "dashboard")).join("")
    : emptyState("Belum ada rekod outing hari ini.");
}

function countByStatus(status) {
  return outingRecords.filter((record) => record.status === status).length;
}

async function updateStatus(id, status) {
  if (!currentSession || currentSession.role !== "warden") {
    return;
  }

  if (isLiveMode) {
    try {
      const action = status === STATUS.approved ? "approveRequest" : "rejectRequest";
      await apiPost(action, {
        request_id: id,
        nama_warden: currentSession.user.name,
        pin: currentSession.user.pin || "",
        catatan: status === STATUS.rejected ? "Ditolak oleh warden." : ""
      });
      await loadTodayRecords();
      showSuccess(
        status === STATUS.approved ? "Permohonan telah diluluskan." : "Permohonan telah ditolak.",
        status === STATUS.approved ? "Diluluskan" : "Ditolak"
      );
    } catch (error) {
      showModeNotice(`Live API error: ${error.message}`);
      showError(error.message, "Tindakan Gagal");
    }
    return;
  }

  outingRecords = outingRecords.map((record) => {
    if (record.id !== id) {
      return record;
    }

    return {
      ...record,
      status,
      approvedAt: status === STATUS.approved ? new Date() : record.approvedAt,
      rejectedAt: status === STATUS.rejected ? new Date() : record.rejectedAt,
      approvedBy: status === STATUS.approved ? currentSession.user.name : record.approvedBy,
      rejectedBy: status === STATUS.rejected ? currentSession.user.name : record.rejectedBy
    };
  });
  render();
  showSuccess(
    status === STATUS.approved ? "Permohonan telah diluluskan." : "Permohonan telah ditolak.",
    status === STATUS.approved ? "Diluluskan" : "Ditolak"
  );
}

async function confirmOut(id) {
  if (!currentSession || currentSession.role !== "guard") {
    return;
  }

  if (isGuardActionPending(id)) {
    return;
  }

  const previousRecord = cloneRecord(findRecordById(id));
  if (!previousRecord) {
    return;
  }

  if (previousRecord.outAt || previousRecord.masa_keluar || previousRecord.status !== STATUS.approved) {
    showWarning("Rekod ini sudah tidak memerlukan pengesahan keluar.");
    return;
  }

  const now = new Date();
  setGuardActionPending(id, "out");
  updateLocalRecord(id, (record) => ({
    ...record,
    status: STATUS.out,
    outAt: now,
    masa_keluar: record.masa_keluar || now,
    guardOutBy: currentSession.user.name,
    guard_keluar_by: currentSession.user.name,
    _guardActionPending: "out"
  }));

  if (isLiveMode) {
    try {
      const updatedRecord = await apiPost("confirmOut", {
        request_id: id,
        nama_guard: currentSession.user.name,
        pin: currentSession.user.pin || ""
      });
      mergeGuardActionSuccess(id, updatedRecord);
      showSuccess("Pelajar telah disahkan keluar.", "Sahkan Keluar");
    } catch (error) {
      restoreGuardActionFailure(id, previousRecord);
      showModeNotice(`Live API error: ${error.message}`);
      showError("Gagal disimpan. Sila tekan Cuba Lagi.", "Tindakan Gagal");
    } finally {
      clearGuardActionPending(id);
    }
    return;
  }

  updateLocalRecord(id, (record) => removeGuardPendingState(record));
  clearGuardActionPending(id);
  showSuccess("Pelajar telah disahkan keluar.", "Sahkan Keluar");
}

async function confirmIn(id) {
  if (!currentSession || currentSession.role !== "guard") {
    return;
  }

  if (isGuardActionPending(id)) {
    return;
  }

  const previousRecord = cloneRecord(findRecordById(id));
  if (!previousRecord) {
    return;
  }

  if (!(previousRecord.outAt || previousRecord.masa_keluar) || previousRecord.returnedAt || previousRecord.masa_masuk || previousRecord.status !== STATUS.out) {
    showWarning("Rekod ini sudah tidak memerlukan pengesahan masuk.");
    return;
  }

  const now = new Date();
  setGuardActionPending(id, "in");
  updateLocalRecord(id, (record) => ({
    ...record,
    status: STATUS.returned,
    lewat: isAfterReturnLimit(now, record),
    returnedAt: now,
    masa_masuk: record.masa_masuk || now,
    guardInBy: currentSession.user.name,
    guard_masuk_by: currentSession.user.name,
    _guardActionPending: "in"
  }));

  if (isLiveMode) {
    try {
      const updatedRecord = await apiPost("confirmIn", {
        request_id: id,
        nama_guard: currentSession.user.name,
        pin: currentSession.user.pin || ""
      });
      mergeGuardActionSuccess(id, updatedRecord);
      showSuccess("Pelajar telah disahkan masuk.", "Sahkan Masuk");
    } catch (error) {
      restoreGuardActionFailure(id, previousRecord);
      showModeNotice(`Live API error: ${error.message}`);
      showError("Gagal disimpan. Sila tekan Cuba Lagi.", "Tindakan Gagal");
    } finally {
      clearGuardActionPending(id);
    }
    return;
  }

  updateLocalRecord(id, (record) => removeGuardPendingState(record));
  clearGuardActionPending(id);
  showSuccess("Pelajar telah disahkan masuk.", "Sahkan Masuk");
}

function isGuardActionPending(id) {
  return Boolean(guardActionLocks[id]);
}

function setGuardActionPending(id, action) {
  guardActionLocks[id] = action || true;
}

function clearGuardActionPending(id) {
  delete guardActionLocks[id];
}

function findRecordById(id) {
  return outingRecords.find((record) => record.id === id || record.request_id === id);
}

function cloneRecord(record) {
  return record ? { ...record } : null;
}

function updateLocalRecord(id, updater) {
  outingRecords = outingRecords.map((record) => {
    if (record.id !== id && record.request_id !== id) {
      return record;
    }

    return updater(record);
  });
  render();
}

function restoreGuardActionFailure(id, previousRecord) {
  outingRecords = outingRecords.map((record) => (
    record.id === id || record.request_id === id
      ? { ...previousRecord, _guardActionFailed: true }
      : record
  ));
  render();
}

function mergeGuardActionSuccess(id, updatedRecord) {
  const mappedRecord = updatedRecord ? mapLiveRecord(updatedRecord) : null;
  updateLocalRecord(id, (record) => removeGuardPendingState({
    ...record,
    ...(mappedRecord || {})
  }));
}

function removeGuardPendingState(record) {
  const cleaned = { ...record };
  delete cleaned._guardActionPending;
  delete cleaned._guardActionFailed;
  return cleaned;
}

function recordCard(record, mode) {
  const actions = actionButtons(record, mode);
  const emergencyBadge = record.jenis_permohonan === REQUEST_TYPE.emergency
    ? `<span class="badge badge-emergency">Kecemasan</span>`
    : "";
  const overnightBadge = record.jenis_permohonan === REQUEST_TYPE.overnight
    ? `<span class="badge badge-overnight">Pulang Bermalam</span>`
    : "";
  const lateBadge = record.lewat ? `<span class="badge badge-late">Lewat</span>` : "";
  const notReturnedBadge = record.status === STATUS.out && isAfterReturnLimit(new Date(), record)
    ? `<span class="badge badge-not-returned">Belum Masuk</span>`
    : "";
  const vehicleDetail = record.butiran_kenderaan || "Tiada butiran";
  const emergencyDetail = emergencyDetailHtml(record);
  const overnightDetail = overnightDetailHtml(record, mode);
  const actorDetail = actorDetailHtml(record);
  const cardClass = record.jenis_permohonan === REQUEST_TYPE.overnight ? "record-card overnight-card" : "record-card";

  return `
    <article class="${cardClass}">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(record.studentName)}</h3>
          <div class="record-meta">${escapeHtml(record.id)} | ${escapeHtml(record.className)}</div>
        </div>
        <div class="badge-stack">
          ${emergencyBadge}
          ${overnightBadge}
          ${lateBadge}
          ${notReturnedBadge}
          <span class="badge ${badgeClass(record.status)}">${escapeHtml(record.status)}</span>
        </div>
      </div>
      <div class="record-detail">
        <strong>Jenis Permohonan:</strong> ${escapeHtml(requestTypeLabel(record.jenis_permohonan))}<br>
        <strong>Tujuan:</strong> ${escapeHtml(record.purpose)}<br>
        <strong>Lokasi:</strong> ${escapeHtml(record.location)}<br>
        <strong>Kenderaan:</strong> ${escapeHtml(record.jenis_kenderaan)}<br>
        <strong>Butiran Kenderaan:</strong> ${escapeHtml(vehicleDetail)}
        ${emergencyDetail}
        ${overnightDetail}
        ${actorDetail}
      </div>
      <div class="record-times">
        <span>Mohon: ${formatTime(record.requestedAt)}</span>
        <span>Lulus/Tolak: ${formatTime(record.approvedAt || record.rejectedAt)}</span>
        <span>Keluar: ${formatTime(record.outAt)}</span>
        <span>Masuk: ${formatTime(record.returnedAt)}</span>
      </div>
      ${actions}
    </article>
  `;
}

function actorDetailHtml(record) {
  const lines = [];

  if (record.approvedBy) {
    lines.push(`<strong>Diluluskan Oleh:</strong> ${escapeHtml(record.approvedBy)}`);
  }

  if (record.rejectedBy) {
    lines.push(`<strong>Ditolak Oleh:</strong> ${escapeHtml(record.rejectedBy)}`);
  }

  if (record.guardOutBy) {
    lines.push(`<strong>Sahkan Keluar Oleh:</strong> ${escapeHtml(record.guardOutBy)}`);
  }

  if (record.guardInBy) {
    lines.push(`<strong>Sahkan Masuk Oleh:</strong> ${escapeHtml(record.guardInBy)}`);
  }

  return lines.length ? `<br>${lines.join("<br>")}` : "";
}

function emergencyDetailHtml(record) {
  if (record.jenis_permohonan !== REQUEST_TYPE.emergency) {
    return "";
  }

  return `<br>
        <strong>Sebab Kecemasan:</strong> ${escapeHtml(record.sebab_kecemasan || "-")}<br>
        <strong>No. Telefon Waris / Penjaga:</strong> ${escapeDisplayPhone(record.telefon_waris)}<br>
        <strong>Hubungan Waris:</strong> ${escapeHtml(record.hubungan_waris || "-")}<br>
        <strong>Catatan Kecemasan:</strong> ${escapeHtml(record.catatan_kecemasan || "-")}`;
}

function overnightDetailHtml(record, mode) {
  if (record.jenis_permohonan !== REQUEST_TYPE.overnight) {
    return "";
  }

  const expectedReturn = expectedReturnDisplay(record);
  const guardLine = mode === "guard-out" || mode === "guard-in"
    ? `<br><strong>Pulang ke asrama dijangka:</strong> ${escapeHtml(expectedReturn)}`
    : "";

  return `<br>
        <strong>Tarikh Keluar:</strong> ${escapeHtml(formatDisplayDate(record.tarikh || record.requestedAt || record.masa_mohon))}<br>
        <strong>Tarikh Pulang Ke Asrama:</strong> ${escapeHtml(formatDisplayDate(record.tarikh_balik || record.returnDate))}<br>
        <strong>Masa Dijangka Pulang Ke Asrama:</strong> ${escapeHtml(formatExpectedReturnTime(record.masa_balik_dijangka || record.expectedReturnTime))}<br>
        <strong>Destinasi Bermalam:</strong> ${escapeHtml(record.location || record.lokasi || "-")}<br>
        <strong>Tujuan Pulang Bermalam:</strong> ${escapeHtml(record.purpose || record.tujuan || "-")}<br>
        <strong>No. Telefon Waris / Penjaga:</strong> ${escapeDisplayPhone(record.telefon_waris)}
        ${guardLine}`;
}

function expectedReturnDisplay(record) {
  const dateText = formatDisplayDate(record.tarikh_balik || record.returnDate);
  const timeText = formatExpectedReturnTime(record.masa_balik_dijangka || record.expectedReturnTime);
  if (dateText === "-" && timeText === "-") {
    return "-";
  }
  return `${dateText} ${timeText}`.trim();
}

function formatExpectedReturnTime(value) {
  if (!value) {
    return "-";
  }

  const text = String(value).trim();
  if (/^\d{2}:\d{2}/.test(text)) {
    const date = parseFlexibleDate(`2000-01-01 ${text.slice(0, 5)}`);
    return formatDisplayTime(date);
  }

  return formatDisplayTime(value) || text;
}

function requestTypeLabel(requestType) {
  return REQUEST_TYPE_LABEL[requestType] || requestType;
}

function actionButtons(record, mode) {
  if (record._guardActionPending) {
    const label = record._guardActionPending === "out" ? "Menyimpan Keluar..." : "Menyimpan Masuk...";
    return `
      <div class="record-actions">
        <button class="action-button" type="button" disabled>${label}</button>
      </div>
    `;
  }

  if (mode === "warden") {
    return `
      <div class="record-actions">
        <button class="action-button approve-button" type="button" data-approve="${record.id}">Luluskan</button>
        <button class="action-button reject-button" type="button" data-reject="${record.id}">Tolak</button>
      </div>
    `;
  }

  if (mode === "guard-out" && record.status === STATUS.approved && !record.outAt && !record.masa_keluar) {
    return `
      <div class="record-actions">
        <button class="action-button out-button" type="button" data-out="${record.id}">Sahkan Keluar</button>
      </div>
    `;
  }

  if (mode === "guard-in" && record.status === STATUS.out && (record.outAt || record.masa_keluar) && !record.returnedAt && !record.masa_masuk) {
    return `
      <div class="record-actions">
        <button class="action-button in-button" type="button" data-in="${record.id}">Sahkan Masuk</button>
      </div>
    `;
  }

  return "";
}

function badgeClass(status) {
  if (status === STATUS.pending) return "badge-pending";
  if (status === STATUS.approved) return "badge-approved";
  if (status === STATUS.rejected) return "badge-rejected";
  if (status === STATUS.out) return "badge-out";
  if (status === STATUS.returned) return "badge-returned";
  return "";
}

function formatTime(value) {
  if (!value) {
    return "-";
  }

  return formatDisplayTime(value);
}

function formatDisplayDateTime(value) {
  const date = parseFlexibleDate(value);
  if (!date) {
    return "-";
  }

  const parts = getKualaLumpurParts(date);
  return `${parts.day} ${BM_MONTHS[Number(parts.month) - 1]} ${parts.year}, ${formatDisplayTime(date)}`;
}

function formatDisplayDate(value) {
  const date = parseFlexibleDate(value);
  if (!date) {
    return "-";
  }

  const parts = getKualaLumpurParts(date);
  return `${parts.day} ${BM_MONTHS[Number(parts.month) - 1]} ${parts.year}`;
}

function formatDisplayTime(value) {
  const date = parseFlexibleDate(value);
  if (!date) {
    return "-";
  }

  return date.toLocaleTimeString("ms-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur"
  }).replace("AM", "PG").replace("PM", "PTG");
}

function parseFlexibleDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  if (!text) {
    return null;
  }

  const normalizedText = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? `${text}T00:00:00+08:00`
    : text.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(:\d{2})?)$/, "$1T$2+08:00");
  const date = new Date(normalizedText);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getKualaLumpurParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).formatToParts(date);

  return parts.reduce((result, part) => {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
    return result;
  }, {});
}

function formatPhoneDisplay(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "-";
  }

  const text = String(value).trim();
  if (text.startsWith("0") || text.startsWith("+")) {
    return text;
  }

  if (/^\d{9}$/.test(text) && text.startsWith("1")) {
    return `0${text}`;
  }

  return text;
}

function escapeDisplayDateTime(value) {
  return escapeHtml(formatDisplayDateTime(value));
}

function escapeDisplayTime(value) {
  return escapeHtml(formatDisplayTime(value));
}

function escapeDisplayPhone(value) {
  return escapeHtml(formatPhoneDisplay(value));
}

function normalizeValue(value) {
  return String(value || "").trim().toLowerCase();
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateClock() {
  const now = new Date();
  els.todayDate.textContent = new Intl.DateTimeFormat("ms-MY", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(now);
  els.todayDay.textContent = new Intl.DateTimeFormat("ms-MY", {
    weekday: "long",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(now);
  els.currentTime.textContent = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur"
  }).format(now);
}

function updatePulangBermalamFields() {
  const isOvernight = els.requestTypeSelect && els.requestTypeSelect.value === REQUEST_TYPE.overnight;
  const isEmergency = els.requestTypeSelect && els.requestTypeSelect.value === REQUEST_TYPE.emergency;
  if (!els.overnightFields) {
    return;
  }

  els.overnightFields.classList.toggle("active", isOvernight);
  els.emergencyFields.classList.toggle("active", isOvernight || isEmergency);
  els.returnDateInput.required = isOvernight;
  els.expectedReturnTimeInput.required = isOvernight;
  els.guardianPhoneInput.required = isOvernight || isEmergency;
  els.guardianRelationSelect.required = isOvernight || isEmergency;

  const emergencyTitle = els.emergencyFields ? els.emergencyFields.querySelector("h3") : null;
  if (emergencyTitle) {
    emergencyTitle.textContent = isOvernight ? "Maklumat Waris" : "Maklumat Kecemasan";
  }

  [els.emergencyReasonInput, els.emergencyNoteInput].forEach((field) => {
    if (!field) {
      return;
    }
    field.hidden = isOvernight;
    if (field.previousElementSibling) {
      field.previousElementSibling.hidden = isOvernight;
    }
  });

  if (els.purposeInput && els.purposeInput.previousElementSibling) {
    els.purposeInput.previousElementSibling.textContent = isOvernight ? "Tujuan Pulang Bermalam" : "Tujuan Outing";
  }

  if (els.locationInput && els.locationInput.previousElementSibling) {
    els.locationInput.previousElementSibling.textContent = isOvernight ? "Alamat / Destinasi Bermalam" : "Lokasi Outing";
  }
}

if (els.requestTypeSelect) {
  els.requestTypeSelect.addEventListener("change", updatePulangBermalamFields);
}

function getTodayDateInputValue() {
  const parts = getKualaLumpurParts(new Date());
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validatePulangBermalamRequest() {
  if (!els.requestTypeSelect || els.requestTypeSelect.value !== REQUEST_TYPE.overnight) {
    return "";
  }

  const now = new Date();
  const parts = getKualaLumpurParts(now);
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const returnDate = els.returnDateInput ? els.returnDateInput.value : "";
  const expectedReturnTime = els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : "";

  if (!returnDate || !expectedReturnTime) {
    return "Tarikh Pulang Ke Asrama dan Masa Dijangka Pulang Ke Asrama diperlukan untuk Pulang Bermalam.";
  }

  if (returnDate < todayKey) {
    return "Tarikh Pulang Ke Asrama tidak boleh lebih awal daripada tarikh keluar.";
  }

  const day = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur"
  }).format(now);

  if (day === "Fri" && time <= "17:00") {
    return "Pulang Bermalam pada hari Jumaat hanya boleh bermula selepas 5:00 PM.";
  }

  return "";
}

if (els.requestForm) {
  els.requestForm.addEventListener("submit", (event) => {
    const message = validatePulangBermalamRequest();
    if (!message) {
      if (!isLiveMode && els.requestTypeSelect && els.requestTypeSelect.value === REQUEST_TYPE.overnight) {
        window.setTimeout(syncMockPulangBermalamRecord, 0);
      }
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    els.studentMessage.textContent = message;
    showError(message, "Permohonan Tidak Sah");
  }, true);
}

function syncMockPulangBermalamRecord() {
  const returnDate = els.returnDateInput ? els.returnDateInput.value : "";
  const expectedReturnTime = els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : "";
  const target = outingRecords
    .filter((record) => record.jenis_permohonan === REQUEST_TYPE.overnight && !record.tarikh_balik)
    .sort((a, b) => {
      const dateA = parseFlexibleDate(a.requestedAt || a.masa_mohon || a.tarikh);
      const dateB = parseFlexibleDate(b.requestedAt || b.masa_mohon || b.tarikh);
      return (dateB ? dateB.getTime() : 0) - (dateA ? dateA.getTime() : 0);
    })[0];

  if (!target) {
    return;
  }

  target.tarikh = target.tarikh || getTodayDateInputValue();
  target.hari = target.hari || getDayNameFromDateInput(target.tarikh);
  target.tarikh_balik = returnDate;
  target.hari_balik = getDayNameFromDateInput(returnDate);
  target.masa_balik_dijangka = expectedReturnTime;
  render();
}

const apiPostWithoutPulangBermalamFields = apiPost;
apiPost = async function apiPostWithPulangBermalamFields(action, payload) {
  if (action === "submitRequest" && payload && payload.jenis_permohonan === REQUEST_TYPE.overnight) {
    payload = {
      ...payload,
      tarikh_balik: els.returnDateInput ? els.returnDateInput.value : "",
      hari_balik: getDayNameFromDateInput(els.returnDateInput ? els.returnDateInput.value : ""),
      masa_balik_dijangka: els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : ""
    };
  }

  return apiPostWithoutPulangBermalamFields(action, payload);
};

const mapLiveRecordWithoutPulangBermalamFields = mapLiveRecord;
mapLiveRecord = function mapLiveRecordWithPulangBermalamFields(record) {
  const mapped = mapLiveRecordWithoutPulangBermalamFields(record);
  return {
    ...mapped,
    tarikh: record.tarikh || mapped.tarikh || "",
    hari: record.hari || mapped.hari || "",
    tarikh_balik: record.tarikh_balik || mapped.tarikh_balik || "",
    hari_balik: record.hari_balik || mapped.hari_balik || "",
    masa_balik_dijangka: record.masa_balik_dijangka || mapped.masa_balik_dijangka || "",
    masa_keluar: record.masa_keluar || mapped.masa_keluar || "",
    masa_masuk: record.masa_masuk || mapped.masa_masuk || "",
    guard_keluar_by: record.guard_keluar_by || mapped.guard_keluar_by || "",
    guard_masuk_by: record.guard_masuk_by || mapped.guard_masuk_by || "",
    telefon_waris: record.telefon_waris || mapped.telefon_waris || "",
    hubungan_waris: record.hubungan_waris || mapped.hubungan_waris || "",
    tujuan: record.tujuan || mapped.tujuan || mapped.purpose || "",
    lokasi: record.lokasi || mapped.lokasi || mapped.location || ""
  };
};

function getDayNameFromDateInput(value) {
  if (!value) {
    return "";
  }

  const date = parseFlexibleDate(value);
  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("ms-MY", {
    weekday: "long",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(date);
}

function isAfterReturnLimit(date, record) {
  if (record && record.jenis_permohonan === REQUEST_TYPE.overnight) {
    const expectedReturn = getExpectedReturnDate(record);
    return expectedReturn ? date.getTime() > expectedReturn.getTime() : false;
  }

  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    timeZone: "Asia/Kuala_Lumpur"
  }).format(date));
  const minute = Number(new Intl.DateTimeFormat("en-GB", {
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(date));

  return hour > 22 || (hour === 22 && minute > 0);
}

function getExpectedReturnDate(record) {
  const returnDate = record.tarikh_balik || record.returnDate;
  const returnTime = record.masa_balik_dijangka || record.expectedReturnTime;
  if (!returnDate || !returnTime) {
    return null;
  }

  return parseFlexibleDate(`${returnDate} ${String(returnTime).slice(0, 5)}`);
}

const loadLiveMastersOriginal = loadLiveMasters;
loadLiveMasters = async function loadLiveMastersWithStudentLoadingState() {
  setStudentDropdownState("loading");

  try {
    const [studentResult, wardenResult, guardResult] = await Promise.allSettled([
      apiGet("getStudents"),
      apiGet("getWardens"),
      apiGet("getGuards")
    ]);

    if (studentResult.status !== "fulfilled") {
      throw studentResult.reason || new Error("Gagal memuatkan senarai pelajar.");
    }

    const liveStudents = normalizeStudentListResponse(studentResult.value);
    students = liveStudents;
    isLiveMode = true;
    dataModeMessage = "Live Mode: Google Sheets";
    updateDataModeIndicator();
    renderStudentDropdownState(liveStudents);

    if (wardenResult.status === "fulfilled") {
      try {
        updateWardenMasterList(wardenResult.value);
      } catch (error) {
        console.warn("Respons senarai warden tidak sah.", error);
      }
    } else {
      console.warn("Gagal memuatkan senarai warden.", wardenResult.reason);
    }

    if (guardResult.status === "fulfilled") {
      try {
        updateGuardMasterList(guardResult.value);
      } catch (error) {
        console.warn("Respons senarai guard tidak sah.", error);
      }
    } else {
      console.warn("Gagal memuatkan senarai guard.", guardResult.reason);
    }
  } catch (error) {
    console.error("Gagal memuatkan senarai pelajar dari Google Sheets.", error);
    isLiveMode = true;
    dataModeMessage = "Live Mode: Google Sheets";
    updateDataModeIndicator();
    setStudentDropdownState("failed");
    showStudentLoadFailurePanel();
    showModeNotice("Gagal memuatkan senarai pelajar dari Google Sheets. Sila tekan Cuba Lagi atau Muat Semula Sistem.");
  }
};

function setStudentDropdownState(state) {
  const stateText = {
    loading: "Memuatkan senarai pelajar...",
    failed: "Gagal memuatkan senarai pelajar",
    empty: "Tiada pelajar ditemui"
  };

  if (!els.studentLoginSelect) {
    return;
  }

  els.studentLoginSelect.innerHTML = `<option value="">${escapeHtml(stateText[state] || "")}</option>`;
  els.studentLoginSelect.disabled = state !== "loaded";
  setStudentLoginDisabled(state !== "loaded");
}

function renderStudentDropdownState(liveStudents) {
  clearStudentLoadFailurePanel();

  if (!Array.isArray(liveStudents) || liveStudents.length === 0) {
    setStudentDropdownState("empty");
    return;
  }

  els.studentLoginSelect.disabled = false;
  setStudentLoginDisabled(false);
  els.studentLoginSelect.innerHTML = liveStudents.map((student) => (
    `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)} (${escapeHtml(student.no_matrik)})</option>`
  )).join("");
}

function setStudentLoginDisabled(disabled) {
  const button = els.studentLoginPanel ? els.studentLoginPanel.querySelector('button[type="submit"]') : null;
  if (button) {
    button.disabled = disabled;
  }
}

function normalizeStudentListResponse(response) {
  const rows = extractArrayResponse(response, "students");
  const normalized = rows
    .map((row) => normalizeStudentRow(row))
    .filter(Boolean);

  if (rows.length > 0 && normalized.length === 0) {
    throw new Error("Format data pelajar tidak dikenali.");
  }

  return normalized;
}

function normalizeStudentRow(row) {
  if (!row || typeof row !== "object") {
    console.warn("Rekod pelajar bukan objek.", row);
    return null;
  }

  const id = String(row.student_id || row.id || "").trim();
  const name = String(row.nama || row.name || "").trim();
  const matric = String(row.no_matrik || row.matric || "").trim();

  if (!id || !name || !matric) {
    console.warn("Rekod pelajar tidak lengkap.", row);
    return null;
  }

  return {
    id,
    student_id: id,
    no_matrik: matric,
    name,
    nama: name,
    email: row.email || row.student_email || "",
    className: row.kelas || row.className || "",
    kelas: row.kelas || row.className || "",
    gender: row.jantina || row.gender || "",
    status: row.status || ""
  };
}

function updateWardenMasterList(response) {
  const rows = extractArrayResponse(response, "wardens");
  wardens = rows
    .map((row) => row && typeof row === "object" ? String(row.nama_warden || row.name || "").trim() : String(row || "").trim())
    .filter(Boolean);

  if (els.wardenSelect) {
    els.wardenSelect.innerHTML = wardens.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }
}

function updateGuardMasterList(response) {
  const rows = extractArrayResponse(response, "guards");
  guards = rows
    .map((row) => row && typeof row === "object" ? String(row.nama_guard || row.name || "").trim() : String(row || "").trim())
    .filter(Boolean);

  if (els.guardSelect) {
    els.guardSelect.innerHTML = guards.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }
}

function extractArrayResponse(response, label) {
  if (Array.isArray(response)) {
    return response;
  }

  if (response && Array.isArray(response.data)) {
    return response.data;
  }

  console.warn(`Respons ${label} bukan array.`, response);
  throw new Error(`Respons ${label} tidak sah.`);
}

async function retryLoadStudentsOnly() {
  setStudentDropdownState("loading");
  clearStudentLoadFailurePanel();

  try {
    const response = await apiGet("getStudents");
    const liveStudents = normalizeStudentListResponse(response);
    students = liveStudents;
    isLiveMode = true;
    dataModeMessage = "Live Mode: Google Sheets";
    updateDataModeIndicator();
    renderStudentDropdownState(liveStudents);
  } catch (error) {
    console.error("Cuba Lagi gagal memuatkan senarai pelajar.", error);
    setStudentDropdownState("failed");
    showStudentLoadFailurePanel();
  }
}

function showStudentLoadFailurePanel() {
  if (els.studentLoginMessage) {
    els.studentLoginMessage.textContent = "Gagal memuatkan senarai pelajar dari Google Sheets. Sila tekan Cuba Lagi atau Muat Semula Sistem.";
  }

  const button = ensureStudentRetryButton();
  if (button) {
    button.hidden = false;
    button.disabled = false;
  }
}

function clearStudentLoadFailurePanel() {
  if (els.studentLoginMessage && els.studentLoginMessage.textContent.indexOf("Gagal memuatkan senarai pelajar") !== -1) {
    els.studentLoginMessage.textContent = "";
  }

  const button = document.querySelector("#studentLoadRetryButton");
  if (button) {
    button.hidden = true;
    button.disabled = false;
  }
}

function ensureStudentRetryButton() {
  if (!els.studentLoginPanel || !els.studentLoginMessage) {
    return null;
  }

  let button = document.querySelector("#studentLoadRetryButton");
  if (!button) {
    button = document.createElement("button");
    button.id = "studentLoadRetryButton";
    button.type = "button";
    button.className = "live-retry-button";
    button.textContent = "Cuba Lagi";
    button.addEventListener("click", retryLoadStudentsOnly);
    els.studentLoginMessage.insertAdjacentElement("afterend", button);
  }

  return button;
}

const setupAppVersionUiOriginal = setupAppVersionUi;
setupAppVersionUi = function setupAppVersionUiWithHardRefresh() {
  setupAppVersionUiOriginal();
  setupSystemRefreshHardReload();
};

function setupSystemRefreshHardReload() {
  if (!els.systemRefreshButton || els.systemRefreshButton.dataset.hardRefreshReady === "1") {
    return;
  }

  els.systemRefreshButton.dataset.hardRefreshReady = "1";
  els.systemRefreshButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    hardReloadAppShell();
  }, true);
}

async function hardReloadAppShell() {
  if (els.systemRefreshButton) {
    els.systemRefreshButton.disabled = true;
    els.systemRefreshButton.textContent = "Memuat semula...";
  }

  try {
    clearSavedSession();
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    students = [];
    setStudentDropdownState("loading");

    if ("caches" in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames
        .filter((name) => name.indexOf("eouting-cache-") === 0)
        .map((name) => caches.delete(name)));
    }

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.warn("Muat Semula Sistem tidak dapat membersihkan cache sepenuhnya.", error);
  }

  const url = new URL(window.location.href);
  url.searchParams.set("_reload", String(Date.now()));
  window.location.replace(url.toString());
}

async function initApp() {
  setupAppVersionUi();
  setupServiceWorkerUpdates();
  setupAccessEnhancements();
  setupFeedbackMessageObservers();
  updateEmergencyFields();
  updatePulangBermalamFields();
  updateClock();
  if (ALLOW_MOCK_MODE) {
    setMockMode("");
    await restoreSavedSession();
    return;
  } else {
    updateDataModeIndicator();
  }
  await loadLiveMasters();
  if (isLiveMode) {
    await restoreSavedSession();
  }
}

initApp();
setInterval(updateClock, 1000);
