const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec";

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
  emergency: "KECEMASAN"
};

const REQUEST_TYPE_LABEL = {
  OUTING_BIASA: "Outing Biasa",
  KECEMASAN: "Kecemasan"
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
  studentLoginMessage: document.querySelector("#studentLoginMessage"),
  wardenSelect: document.querySelector("#wardenSelect"),
  wardenLoginMessage: null,
  wardenPinInput: null,
  guardSelect: document.querySelector("#guardSelect"),
  guardLoginMessage: null,
  guardPinInput: null,
  logoutButton: document.querySelector("#logoutButton"),
  sessionRole: document.querySelector("#sessionRole"),
  sessionName: document.querySelector("#sessionName"),
  ruleNotice: document.querySelector("#ruleNotice"),
  loggedStudentName: document.querySelector("#loggedStudentName"),
  loggedStudentMeta: document.querySelector("#loggedStudentMeta"),
  requestTypeSelect: document.querySelector("#requestTypeSelect"),
  emergencyFields: document.querySelector("#emergencyFields"),
  requestForm: document.querySelector("#requestForm"),
  purposeInput: document.querySelector("#purposeInput"),
  locationInput: document.querySelector("#locationInput"),
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
  dataModeIndicator: null
};

document.querySelectorAll("[data-role-choice]").forEach((button) => {
  button.addEventListener("click", () => showLoginPanel(button.dataset.roleChoice));
});

function setupAccessEnhancements() {
  setupClayRoleNav();
  setupStaffPinFields();
  setupMonitoringPanel();
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
    els.wardenLoginMessage = document.createElement("p");
    els.wardenLoginMessage.className = "form-message";
    els.wardenLoginPanel.insertBefore(label, wardenButton);
    els.wardenLoginPanel.insertBefore(els.wardenPinInput, wardenButton);
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
    els.guardLoginMessage = document.createElement("p");
    els.guardLoginMessage.className = "form-message";
    els.guardLoginPanel.insertBefore(label, guardButton);
    els.guardLoginPanel.insertBefore(els.guardPinInput, guardButton);
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
      startSession("student", mapLiveStudent(student));
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

  startSession("student", selectedStudent);
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

  startSession("warden", { name, pin });
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

  startSession("guard", { name, pin });
});

els.logoutButton.addEventListener("click", () => {
  stopStudentAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = null;
  els.appWorkspace.classList.remove("active");
  els.accessScreen.classList.remove("hidden");
  hideLoginPanels();
  els.studentLoginMessage.textContent = "";
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
  const response = await fetch(`${GAS_WEB_APP_URL}?action=${encodeURIComponent(action)}`);
  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.error || `API GET failed: ${action}`);
  }

  return result.data;
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
    setMockMode("");
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
  } catch (error) {
    setMockMode(`Live API unavailable. Using mock data. ${error.message}`);
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

function updateDataModeIndicator() {
  if (!els.dataModeIndicator) {
    els.dataModeIndicator = document.createElement("p");
    els.dataModeIndicator.setAttribute("aria-live", "polite");
    els.dataModeIndicator.style.margin = "0 0 12px";
    els.dataModeIndicator.style.fontWeight = "700";
    els.dataModeIndicator.style.color = isLiveMode ? "#15573b" : "#684200";
    els.appShell.insertBefore(els.dataModeIndicator, els.appShell.firstElementChild);
  }

  els.dataModeIndicator.style.color = isLiveMode ? "#15573b" : "#684200";
  els.dataModeIndicator.textContent = isLiveMode
    ? "Live Mode: Google Sheets"
    : `Mock Mode${dataModeMessage ? ` - ${dataModeMessage}` : ""}`;
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
    record.status === STATUS.out && isAfterReturnLimit(now)
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

  if (isLiveMode) {
    try {
      await apiPost("confirmOut", {
        request_id: id,
        nama_guard: currentSession.user.name,
        pin: currentSession.user.pin || ""
      });
      await loadTodayRecords();
      showSuccess("Pelajar telah disahkan keluar.", "Sahkan Keluar");
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

    if (record.status !== STATUS.approved) {
      showWarning("Guard hanya boleh sahkan keluar selepas warden meluluskan permohonan.");
      return record;
    }

    return {
      ...record,
      status: STATUS.out,
      outAt: new Date(),
      guardOutBy: currentSession.user.name
    };
  });
  render();
  showSuccess("Pelajar telah disahkan keluar.", "Sahkan Keluar");
}

async function confirmIn(id) {
  if (!currentSession || currentSession.role !== "guard") {
    return;
  }

  if (isLiveMode) {
    try {
      await apiPost("confirmIn", {
        request_id: id,
        nama_guard: currentSession.user.name,
        pin: currentSession.user.pin || ""
      });
      await loadTodayRecords();
      showSuccess("Pelajar telah disahkan masuk.", "Sahkan Masuk");
    } catch (error) {
      showModeNotice(`Live API error: ${error.message}`);
      showError(error.message, "Tindakan Gagal");
    }
    return;
  }

  const now = new Date();
  outingRecords = outingRecords.map((record) => {
    if (record.id !== id) {
      return record;
    }

    return {
      ...record,
      status: STATUS.returned,
      lewat: isAfterReturnLimit(now),
      returnedAt: now,
      guardInBy: currentSession.user.name
    };
  });
  render();
  showSuccess("Pelajar telah disahkan masuk.", "Sahkan Masuk");
}

function recordCard(record, mode) {
  const actions = actionButtons(record, mode);
  const emergencyBadge = record.jenis_permohonan === REQUEST_TYPE.emergency
    ? `<span class="badge badge-emergency">Kecemasan</span>`
    : "";
  const lateBadge = record.lewat ? `<span class="badge badge-late">Lewat</span>` : "";
  const notReturnedBadge = record.status === STATUS.out && isAfterReturnLimit(new Date())
    ? `<span class="badge badge-not-returned">Belum Masuk</span>`
    : "";
  const vehicleDetail = record.butiran_kenderaan || "Tiada butiran";
  const emergencyDetail = emergencyDetailHtml(record);
  const actorDetail = actorDetailHtml(record);

  return `
    <article class="record-card">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(record.studentName)}</h3>
          <div class="record-meta">${escapeHtml(record.id)} | ${escapeHtml(record.className)}</div>
        </div>
        <div class="badge-stack">
          ${emergencyBadge}
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

function requestTypeLabel(requestType) {
  return REQUEST_TYPE_LABEL[requestType] || requestType;
}

function actionButtons(record, mode) {
  if (mode === "warden") {
    return `
      <div class="record-actions">
        <button class="action-button approve-button" type="button" data-approve="${record.id}">Luluskan</button>
        <button class="action-button reject-button" type="button" data-reject="${record.id}">Tolak</button>
      </div>
    `;
  }

  if (mode === "guard-out") {
    return `
      <div class="record-actions">
        <button class="action-button out-button" type="button" data-out="${record.id}">Sahkan Keluar</button>
      </div>
    `;
  }

  if (mode === "guard-in") {
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

async function initApp() {
  setupAccessEnhancements();
  setupFeedbackMessageObservers();
  populateStudents();
  populateStaff();
  updateEmergencyFields();
  updateClock();
  setMockMode("");
  await loadLiveMasters();
}

initApp();
setInterval(updateClock, 1000);
