const APP_VERSION = "2.0.0";
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwZ9VjS-pYd5_GVMcWDLKcDYVzLlvOH4hfBpf5OVE0Pal8qDCoim80I_xcZ4RbWkZ1f/exec";
const GITHUB_PAGES_BETA_GAS_WEB_APP_URL_V200 = "https://script.google.com/macros/s/AKfycbxabjcCzkbRgXAAUUV417DrvstQDx-Ys6yaAXQGVtXbJosdzaN7LGSx5i_VUaQY0km1/exec";
const BETA_API_OVERRIDE_SESSION_KEY_V200 = "eouting_beta_api_override_v200";

function isLocalBetaApiHostV200(hostname) {
  const normalizedHostname = String(hostname || "").trim().toLowerCase();
  return normalizedHostname === "localhost" || normalizedHostname === "127.0.0.1";
}

function isGitHubPagesBetaEnvironmentV200(locationLike) {
  const currentLocation = locationLike || {};
  const hostname = String(currentLocation.hostname || "").trim().toLowerCase();
  const pathname = String(currentLocation.pathname || "/");
  const protocol = String(currentLocation.protocol || "").trim().toLowerCase();
  const secureProtocol = !protocol || protocol === "https:";
  const betaPath = pathname === "/eoutingV2" || pathname.startsWith("/eoutingV2/");
  return secureProtocol && hostname === "itumelaka.github.io" && betaPath;
}

function normalizeBetaApiOverrideV200(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return "";

  try {
    const url = new URL(rawValue);
    const isAllowed = url.protocol === "https:" &&
      url.hostname === "script.google.com" &&
      !url.port &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname);
    return isAllowed ? `${url.origin}${url.pathname}` : "";
  } catch (error) {
    return "";
  }
}

function resolveGasWebAppUrlV200(locationLike, storage) {
  const currentLocation = locationLike || {};
  const isLocalhost = isLocalBetaApiHostV200(currentLocation.hostname);
  const productionResult = { url: GAS_WEB_APP_URL, isBeta: false };

  if (isGitHubPagesBetaEnvironmentV200(currentLocation)) {
    try {
      storage.removeItem(BETA_API_OVERRIDE_SESSION_KEY_V200);
    } catch (error) {
      // The fixed GitHub Pages beta endpoint never depends on browser storage.
    }
    return { url: GITHUB_PAGES_BETA_GAS_WEB_APP_URL_V200, isBeta: true };
  }

  if (!isLocalhost) {
    try {
      storage.removeItem(BETA_API_OVERRIDE_SESSION_KEY_V200);
    } catch (error) {
      // Storage may be unavailable; production endpoint remains authoritative.
    }
    return productionResult;
  }

  let queryValue = null;
  try {
    queryValue = new URLSearchParams(currentLocation.search || "").get("api");
  } catch (error) {
    queryValue = null;
  }

  if (queryValue !== null) {
    const normalizedQueryUrl = normalizeBetaApiOverrideV200(queryValue);
    try {
      if (normalizedQueryUrl) {
        storage.setItem(BETA_API_OVERRIDE_SESSION_KEY_V200, normalizedQueryUrl);
      } else {
        storage.removeItem(BETA_API_OVERRIDE_SESSION_KEY_V200);
      }
    } catch (error) {
      return productionResult;
    }
  }

  let storedValue = "";
  try {
    storedValue = storage.getItem(BETA_API_OVERRIDE_SESSION_KEY_V200) || "";
  } catch (error) {
    return productionResult;
  }

  const normalizedStoredUrl = normalizeBetaApiOverrideV200(storedValue);
  if (!normalizedStoredUrl) {
    try {
      storage.removeItem(BETA_API_OVERRIDE_SESSION_KEY_V200);
    } catch (error) {
      // Invalid/unavailable storage must never prevent the production fallback.
    }
    return productionResult;
  }

  return { url: normalizedStoredUrl, isBeta: true };
}

const ACTIVE_API_ENDPOINT_V200 = resolveGasWebAppUrlV200(window.location, window.sessionStorage);

function getGasWebAppUrlV200() {
  return ACTIVE_API_ENDPOINT_V200.url;
}

const ALLOW_MOCK_MODE = new URLSearchParams(window.location.search).get("mock") === "1";
const MOCK_ADMIN_QA = ALLOW_MOCK_MODE
  ? Object.freeze({ admin_id: "ADMIN-MOCK", nama_admin: "Admin Mock QA", pin: "2468" })
  : null;
const MOCK_ADMIN_ACTIONS_V200 = new Set([
  "loginAdmin",
  "getAdminOutingTypes",
  "createOutingType",
  "updateOutingType",
  "toggleOutingType",
  "getAdminIndividualStats",
  "getAdminStudents",
  "createStudent",
  "updateStudent",
  "toggleStudentStatus"
]);
const LIVE_API_UNSTABLE_MESSAGE = "Sambungan live tidak stabil. Sila cuba lagi.";

let students = [
  { id: "S001", no_matrik: "M001", name: "Ahmad Hakimi", className: "A2", gender: "Lelaki", status: "Aktif" },
  { id: "S002", no_matrik: "M002", name: "Nur Aisyah", className: "A2", gender: "Perempuan", status: "Aktif" },
  { id: "S003", no_matrik: "M003", name: "Muhammad Amir", className: "A3", gender: "Lelaki", status: "Aktif" }
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
  weekend: "OUTING_HUJUNG_MINGGU",
  emergency: "KECEMASAN",
  overnight: "PULANG_BERMALAM",
  semester: "CUTI_SEMESTER"
};

const REQUEST_TYPE_LABEL = {
  OUTING_BIASA: "Outing Biasa",
  OUTING_HUJUNG_MINGGU: "Outing Sabtu / Ahad",
  KECEMASAN: "Kecemasan",
  PULANG_BERMALAM: "Pulang Bermalam",
  CUTI_SEMESTER: "Cuti Semester"
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
let wardenRefreshIntervalId = null;
let wardenLastUpdatedAt = null;
let isWardenLoading = false;
let wardenHasLoadedOnce = false;
let guardRefreshIntervalId = null;
let guardLastUpdatedAt = null;
let monitoringRefreshIntervalId = null;
let monitorLastUpdatedAt = null;
let monitorIsLoading = false;
let monitorHasLoadedOnce = false;
let toastTimerId = null;
let activeRefreshPage = "access";
let selectedStudentLoginClass = "A2";
let studentLoginClassInitialized = false;
let wardenChecklistTypeFilter = "all";
let wardenChecklistRecords = [];
let adminRuntimeCredential = null;
let adminOutingTypes = [];
let adminEditingTypeCode = "";
let adminStudentsV200 = [];
let adminEditingStudentIdV200 = "";
let activeAdminSectionV200 = "outing";
let studentOutingTypesV200 = buildLegacyStudentOutingTypesV200();
let studentOutingTypesLoadingV200 = false;
let studentOutingTypesUsingFallbackV200 = true;
let studentPreviousOutingTypeCodeV200 = "";
let studentRequestSubmissionInFlight = false;
let studentSubmitButtonContentState = null;
let studentAnnualSummary = null;
let mockAdminOutingTypesV200 = ALLOW_MOCK_MODE ? buildMockAdminOutingTypesV200() : [];
let mockAdminStudentsV200 = ALLOW_MOCK_MODE ? buildMockAdminStudentsV200() : [];
let mockAdminReadErrorPendingV200 = ALLOW_MOCK_MODE
  && new URLSearchParams(window.location.search).get("mockAdminError") === "1";
let mockAdminConflictPendingV200 = ALLOW_MOCK_MODE
  && new URLSearchParams(window.location.search).get("mockAdminConflict") === "1";
let mockPublicOutingTypesErrorPendingV200 = ALLOW_MOCK_MODE
  && new URLSearchParams(window.location.search).get("mockOutingTypes") === "error-once";
const guardActionLocks = {};
const wardenActionLocks = {};
const DEBUG_STUDENT_RECORDS = false;
const RETURN_SELFIE_STATUS = {
  pending: "BELUM_HANTAR",
  submitted: "SUDAH_HANTAR"
};
const RETURN_SELFIE_TYPES = new Set(Object.values(REQUEST_TYPE));
const returnSelfieDrafts = new Map();

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
  adminLoginPanel: document.querySelector("#adminLoginPanel"),
  adminIdentityInput: document.querySelector("#adminIdentityInput"),
  adminPinInput: document.querySelector("#adminPinInput"),
  adminLoginButton: document.querySelector("#adminLoginButton"),
  adminLoginMessage: document.querySelector("#adminLoginMessage"),
  roleGrid: document.querySelector("#roleGrid"),
  studentLoginSelect: document.querySelector("#studentLoginSelect"),
  studentClassFilter: document.querySelector("#studentClassFilter"),
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
  studentOutingTypesState: document.querySelector("#studentOutingTypesState"),
  studentOutingTypesMessage: document.querySelector("#studentOutingTypesMessage"),
  studentOutingTypesRetryButton: document.querySelector("#studentOutingTypesRetryButton"),
  emergencyFields: document.querySelector("#emergencyFields"),
  overnightFields: document.querySelector("#overnightFields"),
  requestForm: document.querySelector("#requestForm"),
  purposeInput: document.querySelector("#purposeInput"),
  locationInput: document.querySelector("#locationInput"),
  leaveDateInput: document.querySelector("#leaveDateInput"),
  returnDateInput: document.querySelector("#returnDateInput"),
  expectedReturnTimeInput: document.querySelector("#expectedReturnTimeInput"),
  vehicleTypeSelect: document.querySelector("#vehicleTypeSelect"),
  vehicleDetailInput: document.querySelector("#vehicleDetailInput"),
  emergencyReasonInput: document.querySelector("#emergencyReasonInput"),
  guardianPhoneInput: document.querySelector("#guardianPhoneInput"),
  guardianRelationSelect: document.querySelector("#guardianRelationSelect"),
  emergencyNoteInput: document.querySelector("#emergencyNoteInput"),
  studentMessage: document.querySelector("#studentMessage"),
  studentAnnualSummary: document.querySelector("#studentAnnualSummary"),
  studentRecordsList: document.querySelector("#studentRecordsList"),
  studentRefreshButton: null,
  studentLastUpdated: null,
  wardenList: document.querySelector("#wardenList"),
  wardenApprovedList: document.querySelector("#wardenApprovedList"),
  wardenSemesterChecklist: null,
  wardenSemesterCount: null,
  wardenSemesterSummary: null,
  wardenSemesterList: null,
  wardenChecklistFilterButtons: null,
  wardenCopyNamesButton: null,
  wardenRefreshPanel: null,
  wardenRefreshButton: null,
  wardenLastUpdated: null,
  wardenLoading: null,
  wardenUtilityActions: null,
  wardenReloadAction: null,
  guardApprovedList: document.querySelector("#guardApprovedList"),
  guardOutList: document.querySelector("#guardOutList"),
  guardRefreshButton: null,
  guardLastUpdated: null,
  allRecordsList: document.querySelector("#allRecordsList"),
  countPending: document.querySelector("#countPending"),
  countApproved: document.querySelector("#countApproved"),
  countOut: document.querySelector("#countOut"),
  countReturned: document.querySelector("#countReturned"),
  countLate: document.querySelector("#countLate"),
  countNotReturned: document.querySelector("#countNotReturned"),
  countEmergency: document.querySelector("#countEmergency"),
  adminDashboard: document.querySelector("#admin"),
  adminStatisticsButton: document.querySelector("#adminStatisticsButton"),
  adminOutingTab: document.querySelector("#adminOutingTab"),
  adminStudentsTab: document.querySelector("#adminStudentsTab"),
  adminOutingSettingsPanel: document.querySelector("#adminOutingSettingsPanel"),
  adminStudentManagementPanel: document.querySelector("#adminStudentManagementPanel"),
  adminDashboardMessage: document.querySelector("#adminDashboardMessage"),
  adminTypeList: document.querySelector("#adminTypeList"),
  adminRefreshButton: document.querySelector("#adminRefreshButton"),
  adminAddTypeButton: document.querySelector("#adminAddTypeButton"),
  adminTypeEditor: document.querySelector("#adminTypeEditor"),
  adminEditorTitle: document.querySelector("#adminEditorTitle"),
  adminEditorCancelButton: document.querySelector("#adminEditorCancelButton"),
  adminOutingTypeForm: document.querySelector("#adminOutingTypeForm"),
  adminConfigVersionInput: document.querySelector("#adminConfigVersionInput"),
  adminTypeCodeInput: document.querySelector("#adminTypeCodeInput"),
  adminDisplayNameInput: document.querySelector("#adminDisplayNameInput"),
  adminDescriptionInput: document.querySelector("#adminDescriptionInput"),
  adminSortOrderInput: document.querySelector("#adminSortOrderInput"),
  adminActiveField: document.querySelector("#adminActiveField"),
  adminActiveInput: document.querySelector("#adminActiveInput"),
  adminOpenTimeInput: document.querySelector("#adminOpenTimeInput"),
  adminCloseTimeInput: document.querySelector("#adminCloseTimeInput"),
  adminFixedReturnTimeInput: document.querySelector("#adminFixedReturnTimeInput"),
  adminAllowedDays: document.querySelector("#adminAllowedDays"),
  adminSameDayInput: document.querySelector("#adminSameDayInput"),
  adminRequireLeaveDateInput: document.querySelector("#adminRequireLeaveDateInput"),
  adminRequireReturnDateInput: document.querySelector("#adminRequireReturnDateInput"),
  adminRequireReturnTimeInput: document.querySelector("#adminRequireReturnTimeInput"),
  adminRequireGuardianPhoneInput: document.querySelector("#adminRequireGuardianPhoneInput"),
  adminRequireGuardianRelationInput: document.querySelector("#adminRequireGuardianRelationInput"),
  adminRequireEmergencyReasonInput: document.querySelector("#adminRequireEmergencyReasonInput"),
  adminRequirePurposeInput: document.querySelector("#adminRequirePurposeInput"),
  adminRequireLocationInput: document.querySelector("#adminRequireLocationInput"),
  adminRequireVehicleInput: document.querySelector("#adminRequireVehicleInput"),
  adminRequireWardenApprovalInput: document.querySelector("#adminRequireWardenApprovalInput"),
  adminRequireSelfieInput: document.querySelector("#adminRequireSelfieInput"),
  adminEditorMessage: document.querySelector("#adminEditorMessage"),
  adminSaveTypeButton: document.querySelector("#adminSaveTypeButton"),
  adminStudentsRefreshButton: document.querySelector("#adminStudentsRefreshButton"),
  adminAddStudentButton: document.querySelector("#adminAddStudentButton"),
  adminStudentClassFilter: document.querySelector("#adminStudentClassFilter"),
  adminStudentStatusFilter: document.querySelector("#adminStudentStatusFilter"),
  adminStudentSearchInput: document.querySelector("#adminStudentSearchInput"),
  adminStudentsMessage: document.querySelector("#adminStudentsMessage"),
  adminStudentList: document.querySelector("#adminStudentList"),
  adminStudentEditor: document.querySelector("#adminStudentEditor"),
  adminStudentEditorTitle: document.querySelector("#adminStudentEditorTitle"),
  adminStudentEditorCancelButton: document.querySelector("#adminStudentEditorCancelButton"),
  adminStudentForm: document.querySelector("#adminStudentForm"),
  adminStudentIdInput: document.querySelector("#adminStudentIdInput"),
  adminStudentMatricInput: document.querySelector("#adminStudentMatricInput"),
  adminStudentNameInput: document.querySelector("#adminStudentNameInput"),
  adminStudentEmailInput: document.querySelector("#adminStudentEmailInput"),
  adminStudentPhoneInput: document.querySelector("#adminStudentPhoneInput"),
  adminStudentClassInput: document.querySelector("#adminStudentClassInput"),
  adminStudentGenderInput: document.querySelector("#adminStudentGenderInput"),
  adminStudentStatusInput: document.querySelector("#adminStudentStatusInput"),
  adminStudentNoteInput: document.querySelector("#adminStudentNoteInput"),
  adminStudentEditorMessage: document.querySelector("#adminStudentEditorMessage"),
  adminSaveStudentButton: document.querySelector("#adminSaveStudentButton"),
  appVersionText: document.querySelector("#appVersionText"),
  betaApiIndicator: document.querySelector("#betaApiIndicator"),
  dataModeIndicator: null,
  liveRetryButton: null
};

document.querySelectorAll("[data-role-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.roleChoice === "admin") {
      showAdminLoginPanelV200();
      return;
    }
    if (els.adminLoginPanel) {
      els.adminLoginPanel.classList.remove("active");
    }
    const roleChoice = button.dataset.roleChoice;
    showLoginPanel(roleChoice);
    scheduleIntentionalScrollV200(getAccessPanelForRoleV200(roleChoice));
  });
});

function getAccessPanelForRoleV200(role) {
  const panels = {
    student: els.studentLoginPanel,
    warden: els.wardenLoginPanel,
    guard: els.guardLoginPanel
  };
  return panels[role] || null;
}

function prefersReducedMotionV200() {
  return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

function isIntentionalNavigationV200(eventOrOptions) {
  return Boolean(eventOrOptions && (
    eventOrOptions.type === "click" || eventOrOptions.intentional === true
  ));
}

function scheduleIntentionalScrollV200(target) {
  if (!target || typeof target.scrollIntoView !== "function") return;
  const scroll = () => target.scrollIntoView({
    behavior: prefersReducedMotionV200() ? "auto" : "smooth",
    block: "start"
  });
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(scroll);
  } else {
    scroll();
  }
}

function setupAccessEnhancements() {
  setupClayRoleNav();
  setupStaffPinFields();
  setupStudentClassFilter();
  setupStudentLiClassV200();
  setupStudentOutingTypesV200();
  setupMonitoringPanel();
  setupStatisticsPanel();
  setupAdminDashboardV200();
}

function setupStudentLiClassV200() {
  const liButton = document.querySelector('[data-student-class="LI"]');
  if (liButton && liButton.dataset.liReady !== "1") {
    liButton.dataset.liReady = "1";
    liButton.addEventListener("click", () => {
      selectedStudentLoginClass = "LI";
      refreshStudentClassChoicesV200();
    });
  }
  refreshStudentClassChoicesV200();
}

function refreshStudentClassChoicesV200() {
  if (!els.studentClassFilter) return;
  const hasLiStudents = students.some((student) => String(student.className || student.kelas || "").trim().toUpperCase() === "LI");
  const liButton = els.studentClassFilter.querySelector('[data-student-class="LI"]');
  if (liButton) liButton.hidden = !hasLiStudents;
  let selectionChanged = false;
  if (selectedStudentLoginClass === "LI" && !hasLiStudents) {
    selectedStudentLoginClass = students.some((student) => String(student.className || student.kelas || "").trim().toUpperCase() === "A2")
      ? "A2"
      : "A3";
    selectionChanged = true;
  }
  els.studentClassFilter.querySelectorAll("[data-student-class]").forEach((button) => {
    const active = button.dataset.studentClass === selectedStudentLoginClass;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  if (selectedStudentLoginClass === "LI") renderLiStudentLoginOptionsV200();
  if (selectionChanged && typeof renderStudentDropdownState === "function") renderStudentDropdownState();
}

function renderLiStudentLoginOptionsV200() {
  if (!els.studentLoginSelect) return;
  const liStudents = students.filter((student) => String(student.className || student.kelas || "").trim().toUpperCase() === "LI");
  if (!liStudents.length) {
    els.studentLoginSelect.innerHTML = '<option value="">Tiada pelajar LI ditemui</option>';
    els.studentLoginSelect.disabled = true;
    return;
  }
  els.studentLoginSelect.innerHTML = '<option value="">Pilih nama pelajar</option>' + liStudents.map((student) =>
    `<option value="${escapeHtml(student.id || student.student_id || "")}">${escapeHtml(student.name || student.nama || "-")}</option>`
  ).join("");
  els.studentLoginSelect.disabled = false;
}

function showAdminLoginPanelV200() {
  document.querySelectorAll(".access-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll("[data-role-choice]").forEach((button) => {
    button.classList.toggle("active", button.dataset.roleChoice === "admin");
  });
  if (els.adminLoginPanel) {
    els.adminLoginPanel.classList.add("active");
  }
  setAdminLoginMessageV200("");
  if (els.adminIdentityInput) {
    els.adminIdentityInput.focus();
  }
}

function setupAdminDashboardV200() {
  if (!els.adminLoginPanel || els.adminLoginPanel.dataset.ready === "1") {
    return;
  }
  els.adminLoginPanel.dataset.ready = "1";
  els.adminLoginPanel.addEventListener("submit", handleAdminLoginV200);
  els.adminRefreshButton.addEventListener("click", loadAdminOutingTypesV200);
  els.adminAddTypeButton.addEventListener("click", openAdminCreateEditorV200);
  els.adminEditorCancelButton.addEventListener("click", closeAdminEditorV200);
  els.adminOutingTypeForm.addEventListener("submit", handleAdminTypeSubmitV200);
  els.adminTypeList.addEventListener("click", handleAdminTypeListActionV200);
  if (els.adminOutingTab) {
    els.adminOutingTab.addEventListener("click", () => setAdminSectionV200("outing"));
  }
  if (els.adminStudentsTab) {
    els.adminStudentsTab.addEventListener("click", () => setAdminSectionV200("students"));
  }
  if (els.adminStudentsRefreshButton) {
    els.adminStudentsRefreshButton.addEventListener("click", loadAdminStudentsV200);
  }
  if (els.adminAddStudentButton) {
    els.adminAddStudentButton.addEventListener("click", openAdminStudentCreateEditorV200);
  }
  if (els.adminStatisticsButton) {
    els.adminStatisticsButton.addEventListener("click", openAdminStatisticsPageV200);
  }
  if (els.adminStudentEditorCancelButton) {
    els.adminStudentEditorCancelButton.addEventListener("click", closeAdminStudentEditorV200);
  }
  if (els.adminStudentForm) {
    els.adminStudentForm.addEventListener("submit", handleAdminStudentSubmitV200);
  }
  if (els.adminStudentList) {
    els.adminStudentList.addEventListener("click", handleAdminStudentListActionV200);
  }
  [els.adminStudentClassFilter, els.adminStudentStatusFilter].forEach((control) => {
    if (control) control.addEventListener("change", renderAdminStudentsV200);
  });
  if (els.adminStudentSearchInput) {
    els.adminStudentSearchInput.addEventListener("input", renderAdminStudentsV200);
  }
  els.adminTypeCodeInput.addEventListener("input", () => {
    if (!els.adminTypeCodeInput.readOnly) {
      els.adminTypeCodeInput.value = els.adminTypeCodeInput.value
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, "");
    }
  });
  els.logoutButton.addEventListener("click", (event) => {
    if (currentSession && currentSession.role === "admin") {
      event.stopImmediatePropagation();
      exitAdminSessionV200();
    }
  }, { capture: true });
}

async function handleAdminLoginV200(event) {
  event.preventDefault();
  const identity = els.adminIdentityInput.value.trim();
  const pin = els.adminPinInput.value.trim();
  if (!identity || !pin) {
    setAdminLoginMessageV200("ID atau nama Admin dan PIN diperlukan.", true);
    return;
  }

  setAdminLoginLoadingV200(true);
  setAdminLoginMessageV200("Mengesahkan akses Admin...");
  try {
    const admin = await apiPost("loginAdmin", {
      admin_id: identity,
      nama_admin: identity,
      pin: pin
    });
    adminRuntimeCredential = {
      admin_id: admin.admin_id || "",
      nama_admin: admin.nama_admin || identity,
      pin: pin
    };
    els.adminPinInput.value = "";
    setAdminLoginMessageV200("Log masuk berjaya.");
    startAdminSessionV200(admin);
  } catch (error) {
    adminRuntimeCredential = null;
    els.adminPinInput.value = "";
    setAdminLoginMessageV200("ID atau nama Admin atau PIN tidak sah.", true);
  } finally {
    setAdminLoginLoadingV200(false);
  }
}

function setAdminLoginLoadingV200(isLoading) {
  if (!els.adminLoginButton) return;
  els.adminLoginButton.disabled = Boolean(isLoading);
  els.adminLoginButton.textContent = isLoading ? "Mengesahkan..." : "Masuk sebagai Admin";
}

function setAdminLoginMessageV200(message, isError) {
  if (!els.adminLoginMessage) return;
  els.adminLoginMessage.textContent = message || "";
  els.adminLoginMessage.classList.toggle("error", Boolean(isError));
}

function startAdminSessionV200(admin) {
  currentSession = {
    role: "admin",
    user: {
      admin_id: admin.admin_id || "",
      nama_admin: admin.nama_admin || "Admin",
      status: admin.status || "AKTIF"
    }
  };
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.add("active");
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  els.adminDashboard.classList.add("active");
  const tabs = document.querySelector(".tabs");
  if (tabs) tabs.hidden = true;
  if (els.ruleNotice) els.ruleNotice.hidden = true;
  els.sessionRole.textContent = "Admin";
  els.sessionName.textContent = admin.nama_admin || admin.admin_id || "Admin";
  closeAdminEditorV200();
  closeAdminStudentEditorV200();
  setAdminSectionV200("outing");
  loadAdminOutingTypesV200();
}

function clearAdminRuntimeCredentialV200() {
  adminRuntimeCredential = null;
  adminOutingTypes = [];
  adminEditingTypeCode = "";
  adminStudentsV200 = [];
  adminEditingStudentIdV200 = "";
  activeAdminSectionV200 = "outing";
  if (els.adminPinInput) els.adminPinInput.value = "";
  if (els.adminIdentityInput) els.adminIdentityInput.value = "";
  if (els.adminTypeList) els.adminTypeList.innerHTML = "";
  if (els.adminDashboardMessage) els.adminDashboardMessage.textContent = "";
  if (els.adminOutingTypeForm) els.adminOutingTypeForm.reset();
  if (els.adminTypeEditor) els.adminTypeEditor.hidden = true;
  if (els.adminStudentList) els.adminStudentList.innerHTML = "";
  if (els.adminStudentsMessage) els.adminStudentsMessage.textContent = "";
  if (els.adminStudentForm) els.adminStudentForm.reset();
  if (els.adminStudentEditor) els.adminStudentEditor.hidden = true;
  const tabs = document.querySelector(".tabs");
  if (tabs) tabs.hidden = false;
  if (els.ruleNotice) els.ruleNotice.hidden = false;
}

function exitAdminSessionV200() {
  clearAdminRuntimeCredentialV200();
  currentSession = null;
  els.appWorkspace.classList.remove("active");
  els.accessScreen.classList.remove("hidden");
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll(".access-panel").forEach((panel) => panel.classList.remove("active"));
  document.querySelectorAll("[data-role-choice]").forEach((button) => button.classList.remove("active"));
  els.sessionRole.textContent = "-";
  els.sessionName.textContent = "-";
  showAdminLoginPanelV200();
}

function buildAdminCredentialPayloadV200() {
  if (!adminRuntimeCredential || !adminRuntimeCredential.pin) {
    throw new Error("Sesi Admin telah tamat. Sila log masuk semula.");
  }
  return {
    admin_id: adminRuntimeCredential.admin_id || "",
    nama_admin: adminRuntimeCredential.nama_admin || "",
    pin: adminRuntimeCredential.pin
  };
}

function setAdminSectionV200(section) {
  const nextSection = section === "students" ? "students" : "outing";
  activeAdminSectionV200 = nextSection;
  const isOuting = nextSection === "outing";
  if (els.adminOutingTab) {
    els.adminOutingTab.classList.toggle("active", isOuting);
    els.adminOutingTab.setAttribute("aria-selected", String(isOuting));
  }
  if (els.adminStudentsTab) {
    els.adminStudentsTab.classList.toggle("active", !isOuting);
    els.adminStudentsTab.setAttribute("aria-selected", String(!isOuting));
  }
  if (els.adminOutingSettingsPanel) els.adminOutingSettingsPanel.hidden = !isOuting;
  if (els.adminStudentManagementPanel) els.adminStudentManagementPanel.hidden = isOuting;
  if (!isOuting && currentSession && currentSession.role === "admin" && !adminStudentsV200.length) {
    loadAdminStudentsV200();
  }
}

function normalizeAdminStudentV200(student) {
  const item = student || {};
  return {
    student_id: String(item.student_id || "").trim(),
    no_matrik: String(item.no_matrik || "").trim(),
    nama: String(item.nama || "").trim(),
    email: String(item.email || "").trim(),
    no_tel: String(item.no_tel || "").trim(),
    kelas: String(item.kelas || "").trim().toUpperCase(),
    jantina: String(item.jantina || "").trim(),
    status: String(item.status || "").trim().toUpperCase(),
    catatan: String(item.catatan || "").trim()
  };
}

async function loadAdminStudentsV200() {
  if (!currentSession || currentSession.role !== "admin" || !els.adminStudentList) return;
  setAdminStudentsBusyV200(true);
  setAdminStudentsMessageV200("Memuatkan senarai pelajar...");
  try {
    const response = await apiPost("getAdminStudents", buildAdminCredentialPayloadV200());
    adminStudentsV200 = (Array.isArray(response) ? response : response && response.students || [])
      .map(normalizeAdminStudentV200);
    setAdminStudentsMessageV200("");
    renderAdminStudentsV200();
  } catch (error) {
    adminStudentsV200 = [];
    els.adminStudentList.innerHTML = `
      <div class="empty-state admin-student-retry-state">
        <p>Senarai pelajar gagal dimuatkan.</p>
        <button class="secondary-action" type="button" data-admin-student-retry>Cuba Lagi</button>
      </div>`;
    setAdminStudentsMessageV200(safeAdminStudentErrorV200(error, "Senarai pelajar gagal dimuatkan."), true);
  } finally {
    setAdminStudentsBusyV200(false);
  }
}

function setAdminStudentsBusyV200(isBusy) {
  [els.adminStudentsRefreshButton, els.adminAddStudentButton].forEach((button) => {
    if (button) button.disabled = Boolean(isBusy);
  });
  if (els.adminStudentsRefreshButton) {
    els.adminStudentsRefreshButton.textContent = isBusy ? "Memuat..." : "Refresh Pelajar";
  }
  if (els.adminStudentList) els.adminStudentList.setAttribute("aria-busy", String(Boolean(isBusy)));
}

function setAdminStudentsMessageV200(message, isError) {
  if (!els.adminStudentsMessage) return;
  els.adminStudentsMessage.textContent = message || "";
  els.adminStudentsMessage.classList.toggle("error", Boolean(isError));
}

function safeAdminStudentErrorV200(error, fallback) {
  const message = String(error && error.message || "");
  if (/duplicate|sudah digunakan|telah wujud|diperlukan|tidak sah|tidak ditemui/i.test(message)) {
    return message;
  }
  return fallback;
}

function getFilteredAdminStudentsV200() {
  const classFilter = els.adminStudentClassFilter ? els.adminStudentClassFilter.value : "all";
  const statusFilter = els.adminStudentStatusFilter ? els.adminStudentStatusFilter.value : "all";
  const query = els.adminStudentSearchInput ? els.adminStudentSearchInput.value.trim().toLowerCase() : "";
  return adminStudentsV200.filter((student) => {
    const classMatches = !classFilter || classFilter === "all" || student.kelas === classFilter;
    const statusMatches = !statusFilter || statusFilter === "all" || student.status === statusFilter;
    const searchMatches = !query || [student.student_id, student.no_matrik, student.nama]
      .some((value) => String(value || "").toLowerCase().includes(query));
    return classMatches && statusMatches && searchMatches;
  });
}

function renderAdminStudentsV200() {
  if (!els.adminStudentList) return;
  const filtered = getFilteredAdminStudentsV200();
  if (!filtered.length) {
    els.adminStudentList.innerHTML = '<div class="empty-state">Tiada pelajar sepadan dengan tapisan.</div>';
    return;
  }
  els.adminStudentList.innerHTML = filtered.map(adminStudentCardV200).join("");
}

function adminStudentCardV200(student) {
  const isActive = student.status === "AKTIF";
  const liBadge = student.kelas === "LI"
    ? '<span class="student-li-badge" aria-label="Pelajar Latihan Industri (LI)">LI</span>'
    : "";
  const contact = [student.email, student.no_tel].filter(Boolean).map(escapeHtml).join(" · ") || "Tiada maklumat hubungan";
  return `
    <article class="admin-student-card ${isActive ? "is-active" : "is-inactive"}">
      <div class="admin-student-card-heading">
        <div>
          <div class="admin-student-code-row">
            <span class="admin-student-id">${escapeHtml(student.student_id)}</span>
            ${liBadge}
          </div>
          <h4>${escapeHtml(student.nama)}</h4>
          <p>${escapeHtml(student.no_matrik)} · ${escapeHtml(student.kelas || "-")} · ${escapeHtml(student.jantina || "-")}</p>
        </div>
        <span class="clay-status-badge ${isActive ? "is-active" : "is-inactive"}">${isActive ? "Aktif" : "Tidak Aktif"}</span>
      </div>
      <p class="admin-student-contact">${contact}</p>
      ${student.catatan ? `<p class="admin-student-note">${escapeHtml(student.catatan)}</p>` : ""}
      <div class="admin-student-actions">
        <button class="secondary-action" type="button" data-admin-student-edit="${escapeHtml(student.student_id)}">Edit</button>
        <button class="${isActive ? "danger-action" : "success-action"}" type="button"
          data-admin-student-toggle="${escapeHtml(student.student_id)}" data-next-active="${isActive ? "false" : "true"}">
          ${isActive ? "Nyahaktif" : "Aktifkan"}
        </button>
      </div>
    </article>`;
}

function handleAdminStudentListActionV200(event) {
  const retry = event.target.closest("[data-admin-student-retry]");
  if (retry) {
    loadAdminStudentsV200();
    return;
  }
  const edit = event.target.closest("[data-admin-student-edit]");
  if (edit) {
    openAdminStudentEditEditorV200(edit.dataset.adminStudentEdit);
    return;
  }
  const toggle = event.target.closest("[data-admin-student-toggle]");
  if (toggle) {
    toggleAdminStudentStatusV200(toggle.dataset.adminStudentToggle, toggle.dataset.nextActive === "true");
  }
}

function openAdminStudentCreateEditorV200() {
  adminEditingStudentIdV200 = "";
  els.adminStudentForm.reset();
  els.adminStudentEditorTitle.textContent = "Tambah Pelajar";
  els.adminStudentIdInput.readOnly = false;
  els.adminStudentClassInput.value = "A2";
  els.adminStudentStatusInput.value = "AKTIF";
  els.adminStudentEditorMessage.textContent = "";
  els.adminStudentEditor.hidden = false;
  els.adminStudentIdInput.focus();
}

function openAdminStudentEditEditorV200(studentId) {
  const student = adminStudentsV200.find((item) => item.student_id === studentId);
  if (!student) return;
  adminEditingStudentIdV200 = student.student_id;
  els.adminStudentEditorTitle.textContent = "Edit Pelajar";
  els.adminStudentIdInput.value = student.student_id;
  els.adminStudentIdInput.readOnly = true;
  els.adminStudentMatricInput.value = student.no_matrik;
  els.adminStudentNameInput.value = student.nama;
  els.adminStudentEmailInput.value = student.email;
  els.adminStudentPhoneInput.value = student.no_tel;
  els.adminStudentClassInput.value = student.kelas || "A2";
  els.adminStudentGenderInput.value = student.jantina;
  els.adminStudentStatusInput.value = student.status || "AKTIF";
  els.adminStudentNoteInput.value = student.catatan;
  els.adminStudentEditorMessage.textContent = "";
  els.adminStudentEditor.hidden = false;
  els.adminStudentNameInput.focus();
}

function closeAdminStudentEditorV200() {
  adminEditingStudentIdV200 = "";
  if (els.adminStudentForm) els.adminStudentForm.reset();
  if (els.adminStudentIdInput) els.adminStudentIdInput.readOnly = false;
  if (els.adminStudentEditorMessage) els.adminStudentEditorMessage.textContent = "";
  if (els.adminStudentEditor) els.adminStudentEditor.hidden = true;
}

function buildAdminStudentFormPayloadV200() {
  return {
    student_id: els.adminStudentIdInput.value.trim(),
    no_matrik: els.adminStudentMatricInput.value.trim(),
    nama: els.adminStudentNameInput.value.trim(),
    email: els.adminStudentEmailInput.value.trim(),
    no_tel: els.adminStudentPhoneInput.value.trim(),
    kelas: els.adminStudentClassInput.value,
    jantina: els.adminStudentGenderInput.value,
    status: els.adminStudentStatusInput.value,
    catatan: els.adminStudentNoteInput.value.trim()
  };
}

async function handleAdminStudentSubmitV200(event) {
  event.preventDefault();
  const student = buildAdminStudentFormPayloadV200();
  if (!student.student_id || !student.no_matrik || !student.nama) {
    setAdminStudentEditorMessageV200("ID pelajar, no. matrik dan nama diperlukan.", true);
    return;
  }
  if (student.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
    setAdminStudentEditorMessageV200("Format e-mel tidak sah.", true);
    return;
  }
  const action = adminEditingStudentIdV200 ? "updateStudent" : "createStudent";
  const verb = adminEditingStudentIdV200 ? "mengemas kini" : "menambah";
  if (!window.confirm(`Sahkan untuk ${verb} pelajar ${student.nama}?`)) return;
  els.adminSaveStudentButton.disabled = true;
  setAdminStudentEditorMessageV200("Menyimpan pelajar...");
  try {
    const payload = Object.assign(buildAdminCredentialPayloadV200(), { student });
    if (adminEditingStudentIdV200) payload.student_id = adminEditingStudentIdV200;
    await apiPost(action, payload);
    closeAdminStudentEditorV200();
    await loadAdminStudentsV200();
    await refreshPublicStudentsAfterAdminWriteV200();
    setAdminStudentsMessageV200("Maklumat pelajar berjaya disimpan.");
  } catch (error) {
    setAdminStudentEditorMessageV200(safeAdminStudentErrorV200(error, "Maklumat pelajar gagal disimpan."), true);
  } finally {
    els.adminSaveStudentButton.disabled = false;
  }
}

function setAdminStudentEditorMessageV200(message, isError) {
  if (!els.adminStudentEditorMessage) return;
  els.adminStudentEditorMessage.textContent = message || "";
  els.adminStudentEditorMessage.classList.toggle("error", Boolean(isError));
}

async function toggleAdminStudentStatusV200(studentId, active) {
  const student = adminStudentsV200.find((item) => item.student_id === studentId);
  if (!student) return;
  const actionText = active ? "aktifkan" : "nyahaktifkan";
  if (!window.confirm(`Sahkan untuk ${actionText} ${student.nama}?`)) return;
  setAdminStudentsBusyV200(true);
  try {
    await apiPost("toggleStudentStatus", Object.assign(buildAdminCredentialPayloadV200(), {
      student_id: studentId,
      active
    }));
    await loadAdminStudentsV200();
    await refreshPublicStudentsAfterAdminWriteV200();
    setAdminStudentsMessageV200(`Pelajar berjaya di${active ? "aktifkan" : "nyahaktifkan"}.`);
  } catch (error) {
    setAdminStudentsMessageV200(safeAdminStudentErrorV200(error, "Status pelajar gagal dikemas kini."), true);
  } finally {
    setAdminStudentsBusyV200(false);
  }
}

async function refreshPublicStudentsAfterAdminWriteV200() {
  if (ALLOW_MOCK_MODE) {
    students = mockAdminStudentsV200
      .filter((student) => student.status === "AKTIF")
      .map((student) => ({
        id: student.student_id,
        no_matrik: student.no_matrik,
        name: student.nama,
        className: student.kelas,
        gender: student.jantina,
        status: student.status
      }));
    refreshStudentClassChoicesV200();
    return;
  }
  try {
    const response = await apiGet("getStudents");
    const rows = Array.isArray(response) ? response : response && response.students || [];
    students = rows.map(mapLiveStudent).filter((student) => student.id && student.name);
    refreshStudentClassChoicesV200();
  } catch (error) {
    // Admin write is already complete; the next login refresh will reload public students.
  }
}

async function loadAdminOutingTypesV200() {
  if (!currentSession || currentSession.role !== "admin") {
    return;
  }
  setAdminDashboardBusyV200(true);
  setAdminDashboardMessageV200("Memuatkan jenis outing...");
  els.adminTypeList.innerHTML = '<div class="empty-state">Memuatkan konfigurasi...</div>';
  try {
    const rows = await apiPost("getAdminOutingTypes", buildAdminCredentialPayloadV200());
    adminOutingTypes = Array.isArray(rows) ? rows.slice().sort(adminOutingTypeSortV200) : [];
    renderAdminOutingTypesV200();
    setAdminDashboardMessageV200("");
  } catch (error) {
    adminOutingTypes = [];
    renderAdminOutingTypesErrorV200(error);
  } finally {
    setAdminDashboardBusyV200(false);
  }
}

function adminOutingTypeSortV200(left, right) {
  const difference = Number(left.sort_order || 0) - Number(right.sort_order || 0);
  return difference || String(left.display_name || left.type_code || "")
    .localeCompare(String(right.display_name || right.type_code || ""));
}

function renderAdminOutingTypesV200() {
  if (!adminOutingTypes.length) {
    els.adminTypeList.innerHTML = '<div class="empty-state">Tiada jenis outing dikonfigurasi.</div>';
    return;
  }
  els.adminTypeList.innerHTML = adminOutingTypes.map((type) => {
    const active = type.active === true;
    const timeSummaryItems = [
      type.application_open_time ? `Buka ${formatAdminTimeOnlyV200(type.application_open_time)}` : "",
      type.application_close_time ? `Tutup ${formatAdminTimeOnlyV200(type.application_close_time)}` : "",
      type.fixed_return_time ? `Pulang ${formatAdminTimeOnlyV200(type.fixed_return_time)}` : ""
    ].filter(Boolean);
    const timeSummary = (timeSummaryItems.length ? timeSummaryItems : ["Tiada masa tetap"])
      .map((item) => `<span>${escapeHtml(item)}</span>`)
      .join("");
    return `
      <article class="admin-type-card ${active ? "is-active" : "is-inactive"}" data-admin-type-code="${escapeHtml(type.type_code)}">
        <div class="admin-type-card-heading">
          <div>
            <small>${escapeHtml(type.type_code)}</small>
            <h3>${escapeHtml(type.display_name)}</h3>
          </div>
          <span class="status-badge ${active ? "approved" : "rejected"}">${active ? "Aktif" : "Tidak Aktif"}</span>
        </div>
        <p>${escapeHtml(type.description || "Tiada penerangan.")}</p>
        <dl class="admin-type-meta">
          <div><dt>Turutan</dt><dd>${escapeHtml(type.sort_order)}</dd></div>
          <div><dt>Hari</dt><dd>${escapeHtml(formatAdminDaysV200(type.allowed_days))}</dd></div>
          <div><dt>Masa</dt><dd class="admin-time-stack">${timeSummary}</dd></div>
          <div><dt>Versi</dt><dd>v${escapeHtml(type.config_version)}</dd></div>
        </dl>
        <div class="admin-type-actions">
          <button class="secondary-action" type="button" data-admin-edit="${escapeHtml(type.type_code)}">Edit</button>
          <button class="${active ? "danger-action" : "primary-action"}" type="button" data-admin-toggle="${escapeHtml(type.type_code)}">
            ${active ? "Nyahaktif" : "Aktifkan"}
          </button>
        </div>
      </article>
    `;
  }).join("");
}

function renderAdminOutingTypesErrorV200(error) {
  const message = safeAdminApiMessageV200(error, "Konfigurasi gagal dimuatkan.");
  setAdminDashboardMessageV200(message, true);
  els.adminTypeList.innerHTML = `
    <div class="empty-state admin-error-state">
      <p>${escapeHtml(message)}</p>
      <button class="secondary-action" type="button" data-admin-retry="1">Cuba Lagi</button>
    </div>
  `;
}

function handleAdminTypeListActionV200(event) {
  const retryButton = event.target.closest("[data-admin-retry]");
  if (retryButton) {
    loadAdminOutingTypesV200();
    return;
  }
  const editButton = event.target.closest("[data-admin-edit]");
  if (editButton) {
    openAdminEditEditorV200(editButton.dataset.adminEdit);
    return;
  }
  const toggleButton = event.target.closest("[data-admin-toggle]");
  if (toggleButton) {
    handleAdminToggleV200(toggleButton.dataset.adminToggle, toggleButton);
  }
}

function openAdminCreateEditorV200() {
  adminEditingTypeCode = "";
  els.adminOutingTypeForm.reset();
  els.adminEditorTitle.textContent = "Tambah Jenis Outing";
  els.adminTypeCodeInput.readOnly = false;
  els.adminTypeCodeInput.value = "";
  els.adminConfigVersionInput.value = "";
  els.adminActiveField.hidden = false;
  els.adminActiveInput.value = "true";
  els.adminSortOrderInput.value = String(getNextAdminSortOrderV200());
  setAdminDefaultRulesV200();
  setAdminEditorMessageV200("");
  els.adminTypeEditor.hidden = false;
  els.adminTypeCodeInput.focus();
  els.adminTypeEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function openAdminEditEditorV200(typeCode) {
  const type = adminOutingTypes.find((item) => item.type_code === typeCode);
  if (!type) {
    setAdminDashboardMessageV200("Jenis outing tidak ditemui. Sila refresh.", true);
    return;
  }
  adminEditingTypeCode = type.type_code;
  els.adminOutingTypeForm.reset();
  els.adminEditorTitle.textContent = `Edit ${type.display_name}`;
  els.adminTypeCodeInput.value = type.type_code;
  els.adminTypeCodeInput.readOnly = true;
  els.adminConfigVersionInput.value = String(type.config_version);
  els.adminDisplayNameInput.value = type.display_name || "";
  els.adminDescriptionInput.value = type.description || "";
  els.adminSortOrderInput.value = String(type.sort_order || 1);
  els.adminActiveField.hidden = true;
  els.adminOpenTimeInput.value = type.application_open_time || "";
  els.adminCloseTimeInput.value = type.application_close_time || "";
  els.adminFixedReturnTimeInput.value = type.fixed_return_time || "";
  setAdminAllowedDaysV200(type.allowed_days);
  getAdminRuleInputMapV200().forEach(([field, input]) => {
    input.checked = type[field] === true;
  });
  setAdminEditorMessageV200("");
  els.adminTypeEditor.hidden = false;
  els.adminDisplayNameInput.focus();
  els.adminTypeEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeAdminEditorV200() {
  adminEditingTypeCode = "";
  if (els.adminOutingTypeForm) els.adminOutingTypeForm.reset();
  if (els.adminTypeCodeInput) els.adminTypeCodeInput.readOnly = false;
  if (els.adminTypeEditor) els.adminTypeEditor.hidden = true;
  setAdminEditorMessageV200("");
}

function setAdminDefaultRulesV200() {
  els.adminAllowedDays.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = true;
  });
  getAdminRuleInputMapV200().forEach(([field, input]) => {
    input.checked = [
      "require_purpose",
      "require_location",
      "require_vehicle",
      "require_warden_approval",
      "require_selfie"
    ].includes(field);
  });
}

function getAdminRuleInputMapV200() {
  return [
    ["same_day_only", els.adminSameDayInput],
    ["require_leave_date", els.adminRequireLeaveDateInput],
    ["require_return_date", els.adminRequireReturnDateInput],
    ["require_return_time", els.adminRequireReturnTimeInput],
    ["require_guardian_phone", els.adminRequireGuardianPhoneInput],
    ["require_guardian_relation", els.adminRequireGuardianRelationInput],
    ["require_emergency_reason", els.adminRequireEmergencyReasonInput],
    ["require_purpose", els.adminRequirePurposeInput],
    ["require_location", els.adminRequireLocationInput],
    ["require_vehicle", els.adminRequireVehicleInput],
    ["require_warden_approval", els.adminRequireWardenApprovalInput],
    ["require_selfie", els.adminRequireSelfieInput]
  ];
}

function setAdminAllowedDaysV200(allowedDays) {
  const selected = new Set(String(allowedDays || "").split(",").map((day) => day.trim().toUpperCase()));
  els.adminAllowedDays.querySelectorAll('input[type="checkbox"]').forEach((input) => {
    input.checked = selected.has(input.value);
  });
}

function collectAdminOutingTypeConfigV200() {
  const allowedDays = Array.from(els.adminAllowedDays.querySelectorAll('input[type="checkbox"]:checked'))
    .map((input) => input.value);
  if (!allowedDays.length) {
    throw new Error("Pilih sekurang-kurangnya satu hari dibenarkan.");
  }
  const config = {
    type_code: els.adminTypeCodeInput.value.trim().toUpperCase(),
    display_name: els.adminDisplayNameInput.value.trim(),
    description: els.adminDescriptionInput.value.trim(),
    sort_order: Number(els.adminSortOrderInput.value),
    allowed_days: allowedDays.join(","),
    application_open_time: els.adminOpenTimeInput.value || "",
    application_close_time: els.adminCloseTimeInput.value || "",
    fixed_return_time: els.adminFixedReturnTimeInput.value || ""
  };
  getAdminRuleInputMapV200().forEach(([field, input]) => {
    config[field] = Boolean(input.checked);
  });
  if (!adminEditingTypeCode) {
    config.active = els.adminActiveInput.value === "true";
  }
  return config;
}

async function handleAdminTypeSubmitV200(event) {
  event.preventDefault();
  if (!els.adminOutingTypeForm.reportValidity()) {
    return;
  }

  let config;
  try {
    config = collectAdminOutingTypeConfigV200();
  } catch (error) {
    setAdminEditorMessageV200(error.message, true);
    return;
  }
  const isEditing = Boolean(adminEditingTypeCode);
  const confirmation = isEditing
    ? `Simpan perubahan untuk ${adminEditingTypeCode}?`
    : `Tambah jenis outing ${config.type_code}?`;
  if (!window.confirm(confirmation)) {
    return;
  }

  setAdminEditorBusyV200(true);
  setAdminEditorMessageV200(isEditing ? "Menyimpan perubahan..." : "Menambah jenis outing...");
  try {
    const credentials = buildAdminCredentialPayloadV200();
    if (isEditing) {
      const updateConfig = { ...config };
      delete updateConfig.type_code;
      delete updateConfig.active;
      await apiPost("updateOutingType", {
        ...credentials,
        type_code: adminEditingTypeCode,
        expected_config_version: Number(els.adminConfigVersionInput.value),
        outing_type: updateConfig
      });
    } else {
      await apiPost("createOutingType", {
        ...credentials,
        outing_type: config
      });
    }
    const successMessage = isEditing ? "Jenis outing berjaya dikemas kini." : "Jenis outing berjaya ditambah.";
    closeAdminEditorV200();
    await loadAdminOutingTypesV200();
    setAdminDashboardMessageV200(successMessage);
  } catch (error) {
    if (isAdminConfigConflictV200(error)) {
      closeAdminEditorV200();
      await loadAdminOutingTypesV200();
      setAdminDashboardMessageV200(
        "Konfigurasi telah berubah di tempat lain. Data terkini telah dimuatkan; buka Edit semula.",
        true
      );
    } else {
      setAdminEditorMessageV200(safeAdminApiMessageV200(error, "Konfigurasi gagal disimpan."), true);
    }
  } finally {
    setAdminEditorBusyV200(false);
  }
}

async function handleAdminToggleV200(typeCode, button) {
  const type = adminOutingTypes.find((item) => item.type_code === typeCode);
  if (!type) return;
  const nextActive = type.active !== true;
  const verb = nextActive ? "aktifkan" : "nyahaktifkan";
  if (!window.confirm(`Pasti mahu ${verb} ${type.display_name}?`)) {
    return;
  }
  button.disabled = true;
  try {
    await apiPost("toggleOutingType", {
      ...buildAdminCredentialPayloadV200(),
      type_code: type.type_code,
      expected_config_version: Number(type.config_version),
      active: nextActive
    });
    await loadAdminOutingTypesV200();
    setAdminDashboardMessageV200(`Jenis outing berjaya di${nextActive ? "aktifkan" : "nyahaktifkan"}.`);
  } catch (error) {
    if (isAdminConfigConflictV200(error)) {
      await loadAdminOutingTypesV200();
      setAdminDashboardMessageV200(
        "Konfigurasi telah berubah di tempat lain. Data terkini telah dimuatkan.",
        true
      );
    } else {
      setAdminDashboardMessageV200(safeAdminApiMessageV200(error, "Status gagal dikemas kini."), true);
    }
  } finally {
    button.disabled = false;
  }
}

function isAdminConfigConflictV200(error) {
  return String(error && error.message || error || "").includes("CONFIG_VERSION_CONFLICT");
}

function safeAdminApiMessageV200(error, fallback) {
  let message = String(error && error.message || fallback || "Ralat Admin.");
  if (adminRuntimeCredential && adminRuntimeCredential.pin) {
    message = message.split(adminRuntimeCredential.pin).join("***");
  }
  return message.slice(0, 300);
}

function setAdminDashboardBusyV200(isBusy) {
  [els.adminRefreshButton, els.adminAddTypeButton].forEach((button) => {
    if (button) button.disabled = Boolean(isBusy);
  });
}

function setAdminEditorBusyV200(isBusy) {
  if (!els.adminSaveTypeButton) return;
  els.adminSaveTypeButton.disabled = Boolean(isBusy);
  els.adminSaveTypeButton.textContent = isBusy ? "Menyimpan..." : "Simpan Jenis Outing";
}

function setAdminDashboardMessageV200(message, isError) {
  if (!els.adminDashboardMessage) return;
  els.adminDashboardMessage.textContent = message || "";
  els.adminDashboardMessage.classList.toggle("error", Boolean(isError));
}

function setAdminEditorMessageV200(message, isError) {
  if (!els.adminEditorMessage) return;
  els.adminEditorMessage.textContent = message || "";
  els.adminEditorMessage.classList.toggle("error", Boolean(isError));
}

function getNextAdminSortOrderV200() {
  const highest = adminOutingTypes.reduce((max, type) => Math.max(max, Number(type.sort_order || 0)), 0);
  return highest + 1;
}

function formatAdminDaysV200(value) {
  const labels = {
    AHAD: "Ahad",
    ISNIN: "Isnin",
    SELASA: "Selasa",
    RABU: "Rabu",
    KHAMIS: "Khamis",
    JUMAAT: "Jumaat",
    SABTU: "Sabtu"
  };
  return String(value || "").split(",")
    .map((day) => labels[day.trim().toUpperCase()] || day.trim())
    .filter(Boolean)
    .join(", ") || "-";
}

function formatAdminTimeOnlyV200(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return "Tiada masa tetap";
  }

  let hours = null;
  let minutes = null;

  if (Object.prototype.toString.call(value) === "[object Date]") {
    if (Number.isNaN(value.getTime())) {
      return "Masa tidak sah";
    }
    hours = value.getUTCHours();
    minutes = value.getUTCMinutes();
  } else {
    const text = String(value).trim();
    const timeOnlyMatch = text.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
    const isoTimeMatch = text.match(/T([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/i);
    const match = timeOnlyMatch || isoTimeMatch;
    if (!match) {
      return "Masa tidak sah";
    }
    hours = Number(match[1]);
    minutes = Number(match[2]);
  }

  const displayHour = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, "0");
  let period = "pagi";
  if (hours === 0) {
    period = "tengah malam";
  } else if (hours === 12) {
    period = "tengah hari";
  } else if (hours >= 13 && hours < 19) {
    period = "petang";
  } else if (hours >= 19) {
    period = "malam";
  }

  return `${displayHour}:${displayMinutes} ${period}`;
}

function setupStudentClassFilter() {
  if (!els.studentClassFilter || els.studentClassFilter.dataset.ready === "1") {
    return;
  }

  els.studentClassFilter.dataset.ready = "1";
  els.studentClassFilter.querySelectorAll("[data-student-class]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedStudentLoginClass = button.dataset.studentClass || "A2";
      studentLoginClassInitialized = true;
      renderStudentLoginClassFilter();
      populateStudents();
    });
  });
  renderStudentLoginClassFilter();
}

function renderStudentLoginClassFilter() {
  if (!els.studentClassFilter) {
    return;
  }

  els.studentClassFilter.querySelectorAll("[data-student-class]").forEach((button) => {
    const isActive = button.dataset.studentClass === selectedStudentLoginClass;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

function setupClayRoleNav() {
  if (!els.roleGrid) {
    return;
  }

  els.roleGrid.classList.add("clay-role-nav");
  const roleLabels = {
    student: "Pelajar",
    warden: "Warden & HEP",
    guard: "Guard",
    admin: "Admin"
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
        <p>Paparan read-only. Hanya nama, kelas dan status semasa dipaparkan.</p>
      </div>
      <div class="monitor-actions">
        <button class="secondary-action" id="monitorRefreshButton" type="button">Refresh</button>
        <small id="monitorLastUpdated"></small>
      </div>
      <div class="monitor-loading" id="monitorLoading" hidden>Memuatkan rekod pemantauan...</div>
      <div class="summary-grid monitor-summary" id="monitorSummary"></div>
      <section class="monitor-name-panel" id="monitorNamePanel">
        <h3>Senarai Status Semasa</h3>
        <div class="monitor-name-list" id="monitorNameList"></div>
      </section>
    </section>
  `;
  els.appShell.appendChild(panel);
  els.monitorWorkspace = panel;
  els.monitorBackButton = panel.querySelector("#monitorBackButton");
  els.monitorRefreshButton = panel.querySelector("#monitorRefreshButton");
  els.monitorLastUpdated = panel.querySelector("#monitorLastUpdated");
  els.monitorLoading = panel.querySelector("#monitorLoading");
  els.monitorSummary = panel.querySelector("#monitorSummary");
  els.monitorNamePanel = panel.querySelector("#monitorNamePanel");
  els.monitorNameList = panel.querySelector("#monitorNameList");
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
          <h3>Statistik Individu Pelajar</h3>
          <p id="statsPrivacyMessage">Ringkasan agregat tersedia kepada umum; statistik individu terhad kepada Admin yang dibenarkan.</p>
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
  els.statsPrivacyMessage = panel.querySelector("#statsPrivacyMessage");
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
        student_id: selectedStudent ? selectedStudent.id : "",
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
      const runtimeWarden = mapLiveStaffSessionUser("warden", warden, name, pin);
      clearStaffLoginSuccessFeedback();
      startSession("warden", runtimeWarden);
      rememberSessionIfRequested("warden", runtimeWarden, els.wardenRememberInput);
    } catch (error) {
      if (currentSession && currentSession.role === "warden") {
        clearStaffLoginSuccessFeedback();
        return;
      }
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
  clearStaffLoginSuccessFeedback();
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
      const runtimeGuard = mapLiveStaffSessionUser("guard", guard, name, pin);
      clearStaffLoginSuccessFeedback();
      startSession("guard", runtimeGuard);
      rememberSessionIfRequested("guard", runtimeGuard, els.guardRememberInput);
    } catch (error) {
      if (currentSession && currentSession.role === "guard") {
        clearStaffLoginSuccessFeedback();
        return;
      }
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
  clearStaffLoginSuccessFeedback();
  rememberSessionIfRequested("guard", mockGuard, els.guardRememberInput);
  startSession("guard", mockGuard);
});

els.logoutButton.addEventListener("click", () => {
  clearSavedSession();
  stopWardenAutoRefresh();
  stopStudentAutoRefresh();
  stopGuardAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = null;
  els.appWorkspace.classList.remove("active");
  els.accessScreen.classList.remove("hidden");
  hideLoginPanels();
  els.studentLoginMessage.textContent = "";
  updateFooterActionsVisibility();
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

function buildMockAdminStudentsV200() {
  return [
    { student_id: "A2-MOCK-001", no_matrik: "00120001", nama: "Pelajar Mock A2", email: "a2.mock@example.test", no_tel: "0123456789", kelas: "A2", jantina: "Lelaki", status: "AKTIF", catatan: "" },
    { student_id: "A3-MOCK-001", no_matrik: "00130001", nama: "Pelajar Mock A3", email: "", no_tel: "", kelas: "A3", jantina: "Perempuan", status: "AKTIF", catatan: "" },
    { student_id: "LI-MOCK-001", no_matrik: "00009001", nama: "Pelajar Latihan Industri Mock", email: "li.mock@example.test", no_tel: "01100009001", kelas: "LI", jantina: "Perempuan", status: "AKTIF", catatan: "Untuk QA local sahaja" },
    { student_id: "LI-MOCK-002", no_matrik: "00009002", nama: "Pelajar LI Tidak Aktif", email: "", no_tel: "", kelas: "LI", jantina: "Lelaki", status: "TIDAK AKTIF", catatan: "" }
  ];
}

function buildMockAdminOutingTypesV200() {
  const timestamp = "2026-08-03T08:00:00.000Z";
  const allDays = "AHAD,ISNIN,SELASA,RABU,KHAMIS,JUMAAT,SABTU";
  const common = {
    active: true,
    application_open_time: "",
    application_close_time: "",
    fixed_return_time: "",
    same_day_only: false,
    require_leave_date: false,
    require_return_date: false,
    require_return_time: false,
    require_guardian_phone: false,
    require_guardian_relation: false,
    require_emergency_reason: false,
    require_purpose: true,
    require_location: true,
    require_vehicle: true,
    require_warden_approval: true,
    require_selfie: true,
    config_version: 1,
    created_at: timestamp,
    created_by: "MOCK-SETUP",
    updated_at: timestamp,
    updated_by: "MOCK-SETUP"
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
      same_day_only: true
    },
    {
      ...common,
      type_code: REQUEST_TYPE.weekend,
      display_name: "Outing Sabtu / Ahad",
      description: "Outing hujung minggu dan pulang pada hari yang sama.",
      sort_order: 2,
      allowed_days: "SABTU,AHAD",
      fixed_return_time: "22:00",
      same_day_only: true,
      require_leave_date: true,
      require_return_date: true,
      require_return_time: true
    },
    {
      ...common,
      type_code: REQUEST_TYPE.emergency,
      display_name: "Kecemasan",
      description: "Permohonan kecemasan dengan sebab wajib diisi.",
      sort_order: 3,
      allowed_days: allDays,
      fixed_return_time: "22:00",
      same_day_only: true,
      require_emergency_reason: true
    },
    {
      ...common,
      type_code: REQUEST_TYPE.overnight,
      display_name: "Pulang Bermalam",
      description: "Pulang bermalam dengan tarikh, masa pulang dan maklumat waris.",
      sort_order: 4,
      allowed_days: allDays,
      require_return_date: true,
      require_return_time: true,
      require_guardian_phone: true,
      require_guardian_relation: true
    },
    {
      ...common,
      type_code: REQUEST_TYPE.semester,
      display_name: "Cuti Semester",
      description: "Contoh konfigurasi tidak aktif untuk QA toggle.",
      active: false,
      sort_order: 5,
      allowed_days: allDays,
      require_return_date: true,
      require_return_time: true,
      require_guardian_phone: true,
      require_guardian_relation: true
    }
  ];
}

function buildLegacyStudentOutingTypesV200() {
  return buildMockAdminOutingTypesV200().map((type) => {
    const {
      config_version,
      created_at,
      created_by,
      updated_at,
      updated_by,
      ...publicType
    } = type;
    return { ...publicType, active: true };
  });
}

async function mockPublicOutingTypesV200() {
  if (!ALLOW_MOCK_MODE) {
    throw new Error("Mock public config tidak tersedia dalam live mode.");
  }
  await delay(250);
  const scenario = new URLSearchParams(window.location.search).get("mockOutingTypes");
  if (mockPublicOutingTypesErrorPendingV200) {
    mockPublicOutingTypesErrorPendingV200 = false;
    throw new Error("Ralat mock konfigurasi sekali sahaja.");
  }
  if (scenario === "empty") {
    return [];
  }
  const publicRows = mockAdminOutingTypesV200
    .filter((type) => type.active === true)
    .map((type) => {
      const {
        active,
        config_version,
        created_at,
        created_by,
        updated_at,
        updated_by,
        ...publicType
      } = type;
      return publicType;
    });
  if (scenario === "optional") {
    return [{
      ...publicRows[0],
      display_name: "Outing Tanpa Medan Wajib (QA)",
      require_leave_date: false,
      require_return_date: false,
      require_return_time: false,
      require_guardian_phone: false,
      require_guardian_relation: false,
      require_emergency_reason: false,
      require_purpose: false,
      require_location: false,
      require_vehicle: false,
      same_day_only: false,
      fixed_return_time: ""
    }];
  }
  return publicRows;
}

async function mockAdminApiPostV200(action, payload) {
  if (!ALLOW_MOCK_MODE || !MOCK_ADMIN_QA || !MOCK_ADMIN_ACTIONS_V200.has(action)) {
    throw new Error("Mock Admin tidak tersedia dalam live mode.");
  }
  await delay(250);
  const request = payload || {};
  const identity = String(request.admin_id || request.nama_admin || "").trim().toUpperCase();
  const validIdentity = identity === MOCK_ADMIN_QA.admin_id
    || identity === MOCK_ADMIN_QA.nama_admin.toUpperCase();
  const validPin = String(request.pin || "") === MOCK_ADMIN_QA.pin;
  if (!validIdentity || !validPin) {
    throw new Error("ID atau nama Admin atau PIN tidak sah.");
  }
  if (action === "loginAdmin") {
    return {
      admin_id: MOCK_ADMIN_QA.admin_id,
      nama_admin: MOCK_ADMIN_QA.nama_admin,
      status: "AKTIF"
    };
  }
  if (action === "getAdminIndividualStats") {
    return buildMockAdminIndividualStatsV200(request);
  }
  if (action === "getAdminStudents") {
    return cloneMockAdminValueV200(mockAdminStudentsV200);
  }

  if (action === "createStudent") {
    const student = normalizeAdminStudentV200(payload && payload.student);
    if (!student.student_id || !student.no_matrik || !student.nama) {
      throw new Error("ID pelajar, no. matrik dan nama diperlukan.");
    }
    if (mockAdminStudentsV200.some((item) => item.student_id.toUpperCase() === student.student_id.toUpperCase())) {
      throw new Error("student_id telah wujud.");
    }
    if (mockAdminStudentsV200.some((item) => item.no_matrik.toUpperCase() === student.no_matrik.toUpperCase())) {
      throw new Error("No. matrik telah digunakan.");
    }
    student.status = student.status || "AKTIF";
    mockAdminStudentsV200.push(student);
    return cloneMockAdminValueV200(student);
  }

  if (action === "updateStudent") {
    const immutableId = String(payload && payload.student_id || "").trim();
    const index = mockAdminStudentsV200.findIndex((item) => item.student_id === immutableId);
    if (index < 0) throw new Error("Pelajar tidak ditemui.");
    const student = normalizeAdminStudentV200(payload && payload.student);
    if (student.student_id && student.student_id !== immutableId) throw new Error("student_id tidak boleh diubah.");
    if (mockAdminStudentsV200.some((item, itemIndex) => itemIndex !== index && item.no_matrik.toUpperCase() === student.no_matrik.toUpperCase())) {
      throw new Error("No. matrik telah digunakan.");
    }
    mockAdminStudentsV200[index] = Object.assign({}, mockAdminStudentsV200[index], student, { student_id: immutableId });
    return cloneMockAdminValueV200(mockAdminStudentsV200[index]);
  }

  if (action === "toggleStudentStatus") {
    const studentId = String(payload && payload.student_id || "").trim();
    const student = mockAdminStudentsV200.find((item) => item.student_id === studentId);
    if (!student) throw new Error("Pelajar tidak ditemui.");
    if (typeof payload.active !== "boolean") throw new Error("Status pelajar tidak sah.");
    student.status = payload.active ? "AKTIF" : "TIDAK AKTIF";
    return cloneMockAdminValueV200(student);
  }

  if (action === "getAdminOutingTypes") {
    if (mockAdminReadErrorPendingV200) {
      mockAdminReadErrorPendingV200 = false;
      throw new Error("Ralat mock sekali sahaja. Tekan Cuba Lagi.");
    }
    return cloneMockAdminValueV200(mockAdminOutingTypesV200);
  }

  const timestamp = new Date().toISOString();
  const typeCode = String(request.type_code || request.outing_type && request.outing_type.type_code || "")
    .trim()
    .toUpperCase();
  const existingIndex = mockAdminOutingTypesV200.findIndex((item) => item.type_code === typeCode);

  if (action === "createOutingType") {
    if (!typeCode || existingIndex !== -1) {
      throw new Error(existingIndex !== -1 ? "type_code telah wujud." : "type_code diperlukan.");
    }
    const created = {
      ...cloneMockAdminValueV200(request.outing_type || {}),
      type_code: typeCode,
      active: request.outing_type && request.outing_type.active === true,
      config_version: 1,
      created_at: timestamp,
      created_by: MOCK_ADMIN_QA.admin_id,
      updated_at: timestamp,
      updated_by: MOCK_ADMIN_QA.admin_id
    };
    mockAdminOutingTypesV200.push(created);
    return cloneMockAdminValueV200(created);
  }

  if (existingIndex === -1) {
    throw new Error("Jenis outing tidak ditemui.");
  }
  const current = mockAdminOutingTypesV200[existingIndex];
  if (mockAdminConflictPendingV200) {
    mockAdminConflictPendingV200 = false;
    current.config_version += 1;
    current.updated_at = timestamp;
    current.updated_by = "MOCK-CONCURRENT-ADMIN";
    throw new Error("CONFIG_VERSION_CONFLICT: konfigurasi mock telah berubah.");
  }
  if (Number(request.expected_config_version) !== Number(current.config_version)) {
    throw new Error("CONFIG_VERSION_CONFLICT: muat semula konfigurasi terkini.");
  }

  if (action === "updateOutingType") {
    const updated = {
      ...current,
      ...cloneMockAdminValueV200(request.outing_type || {}),
      type_code: current.type_code,
      active: current.active,
      config_version: current.config_version + 1,
      created_at: current.created_at,
      created_by: current.created_by,
      updated_at: timestamp,
      updated_by: MOCK_ADMIN_QA.admin_id
    };
    mockAdminOutingTypesV200[existingIndex] = updated;
    return cloneMockAdminValueV200(updated);
  }

  const toggled = {
    ...current,
    active: request.active === true,
    config_version: current.config_version + 1,
    updated_at: timestamp,
    updated_by: MOCK_ADMIN_QA.admin_id
  };
  mockAdminOutingTypesV200[existingIndex] = toggled;
  return cloneMockAdminValueV200(toggled);
}

function cloneMockAdminValueV200(value) {
  return JSON.parse(JSON.stringify(value));
}

async function apiGet(action) {
  return apiGetWithParams(action);
}

async function apiGetWithParams(action, params = {}) {
  if (ALLOW_MOCK_MODE && action === "getOutingTypes") {
    return mockPublicOutingTypesV200();
  }
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
      const response = await fetch(`${getGasWebAppUrlV200()}?${searchParams.toString()}`, {
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

async function loadLiveMasters() {
  if (!getGasWebAppUrlV200()) {
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
    const isAuthenticated = Boolean(currentSession);
    const accessPayload = isAuthenticated ? buildTodayRecordsAccessPayload() : null;
    const records = isAuthenticated
      ? await apiPost("getTodayRecords", accessPayload)
      : await apiGet("getTodayRecords");
    outingRecords = records.map(isAuthenticated ? mapLiveRecord : mapPublicMonitoringRecord);
    if (currentSession && currentSession.role === "student") {
      studentLastUpdatedAt = new Date();
      updateStudentLastUpdated();
    }
    render();
    if (els.monitorWorkspace && els.monitorWorkspace.classList.contains("active")) {
      renderMonitoring();
    }
  } catch (error) {
    if (currentSession) {
      outingRecords = [];
    }
    showModeNotice(`Live records unavailable: ${error.message}`);
    render();
  }
}

async function apiPost(action, payload) {
  if (ALLOW_MOCK_MODE && MOCK_ADMIN_ACTIONS_V200.has(action)) {
    return mockAdminApiPostV200(action, payload);
  }
  const response = await fetch(getGasWebAppUrlV200(), {
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

function mapLiveStaffSessionUser(role, staff, enteredName, enteredPin) {
  const response = staff || {};
  const name = role === "warden"
    ? response.nama_warden || enteredName || ""
    : response.nama_guard || enteredName || "";
  const user = {
    name,
    pin: String(enteredPin || "").trim(),
    email: response.email || "",
    phone: response.no_tel || ""
  };

  if (role === "warden") {
    user.nama_warden = name;
    return user;
  }
  if (role === "guard") {
    user.nama_guard = name;
    return user;
  }
  throw new Error("Role staff tidak sah.");
}

function mapLiveRecord(record) {
  return {
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
    catatan: record.catatan || "",
    selfie_status: record.selfie_status || "",
    selfie_file_id: record.selfie_file_id || "",
    selfie_url: record.selfie_url || "",
    masa_selfie: record.masa_selfie || "",
    selfie_telegram_message_id: record.selfie_telegram_message_id || ""
  };
}

function mapPublicMonitoringRecord(record) {
  const lateText = String(record.lewat || "");
  return {
    nama: record.nama || "",
    className: record.kelas || "",
    kelas: record.kelas || "",
    jenis_permohonan: record.jenis_permohonan || REQUEST_TYPE.normal,
    rawStatus: record.status || "",
    status: mapLiveStatus(record.status),
    lewat: lateText.trim().toLowerCase() === "ya",
    lewatText: lateText,
    belum_masuk: record.belum_masuk === true
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
    "Sistem tidak dapat berhubung dengan Google Sheets buat masa ini. Sila tekan Cuba Lagi.",
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
}

function buildTodayRecordsAccessPayload() {
  if (!currentSession) {
    return null;
  }

  const user = currentSession.user || currentSession;
  if (currentSession.role === "student") {
    const payload = {
      role: "student",
      student_id: user.student_id || user.studentId || user.id || "",
      no_matrik: user.no_matrik || user.noMatrik || ""
    };
    if (!payload.student_id || !payload.no_matrik) {
      throw new Error("Credential sesi pelajar tidak lengkap.");
    }
    return payload;
  }
  if (currentSession.role === "warden") {
    const payload = { role: "warden", nama_warden: user.nama_warden || user.name || "", pin: user.pin || "" };
    if (!payload.nama_warden || !payload.pin) {
      throw new Error("Credential sesi warden tidak lengkap.");
    }
    return payload;
  }
  if (currentSession.role === "guard") {
    const payload = { role: "guard", nama_guard: user.nama_guard || user.name || "", pin: user.pin || "" };
    if (!payload.nama_guard || !payload.pin) {
      throw new Error("Credential sesi guard tidak lengkap.");
    }
    return payload;
  }
  throw new Error("Role sesi tidak sah untuk rekod operasi.");
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

function setupStudentOutingTypesV200() {
  if (els.studentOutingTypesRetryButton && els.studentOutingTypesRetryButton.dataset.ready !== "1") {
    els.studentOutingTypesRetryButton.dataset.ready = "1";
    els.studentOutingTypesRetryButton.addEventListener("click", loadStudentOutingTypesV200);
  }
  if (els.leaveDateInput && els.leaveDateInput.dataset.sameDaySyncV200 !== "1") {
    els.leaveDateInput.dataset.sameDaySyncV200 = "1";
    els.leaveDateInput.addEventListener("change", syncStudentSameDayReturnV200);
  }
}

async function loadStudentOutingTypesV200() {
  if (!currentSession || currentSession.role !== "student" || studentOutingTypesLoadingV200) {
    return;
  }
  studentOutingTypesLoadingV200 = true;
  setStudentOutingTypesStateV200("Memuatkan jenis outing...", false, false);
  if (els.requestTypeSelect) els.requestTypeSelect.disabled = true;
  try {
    const rows = await apiGet("getOutingTypes");
    const activeRows = normalizeStudentOutingTypesV200(rows);
    if (!activeRows.length) {
      useLegacyStudentOutingTypesV200("Tiada konfigurasi aktif. Lima jenis legacy digunakan.", false);
    } else {
      studentOutingTypesV200 = activeRows;
      studentOutingTypesUsingFallbackV200 = false;
      renderStudentOutingTypesV200();
      setStudentOutingTypesStateV200("", false, false);
    }
  } catch (error) {
    useLegacyStudentOutingTypesV200("Konfigurasi gagal dimuatkan. Lima jenis legacy digunakan.", true);
  } finally {
    studentOutingTypesLoadingV200 = false;
    if (els.requestTypeSelect) els.requestTypeSelect.disabled = false;
    updateRequestTypeFields();
    updateStudentSubmitState();
  }
}

function normalizeStudentOutingTypesV200(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .filter((row) => row && row.active !== false)
    .map((row) => ({
      ...row,
      type_code: String(row.type_code || "").trim().toUpperCase(),
      display_name: String(row.display_name || "").trim(),
      sort_order: Number(row.sort_order) || 0
    }))
    .filter((row) => {
      if (!row.type_code || !row.display_name || seen.has(row.type_code)) return false;
      seen.add(row.type_code);
      return true;
    })
    .sort((left, right) => (
      left.sort_order - right.sort_order
      || left.display_name.localeCompare(right.display_name)
    ));
}

function useLegacyStudentOutingTypesV200(message, showRetry) {
  studentOutingTypesV200 = buildLegacyStudentOutingTypesV200();
  studentOutingTypesUsingFallbackV200 = true;
  renderStudentOutingTypesV200();
  setStudentOutingTypesStateV200(message, true, showRetry);
}

function renderStudentOutingTypesV200() {
  if (!els.requestTypeSelect) return;
  const previousValue = els.requestTypeSelect.value;
  const rows = normalizeStudentOutingTypesV200(studentOutingTypesV200);
  const safeRows = rows.length ? rows : normalizeStudentOutingTypesV200(buildLegacyStudentOutingTypesV200());
  els.requestTypeSelect.innerHTML = safeRows
    .map((type) => `<option value="${escapeHtml(type.type_code)}">${escapeHtml(type.display_name)}</option>`)
    .join("");
  if (safeRows.some((type) => type.type_code === previousValue)) {
    els.requestTypeSelect.value = previousValue;
  }
  studentOutingTypesV200 = safeRows;
}

function setStudentOutingTypesStateV200(message, isError, showRetry) {
  if (els.studentOutingTypesMessage) {
    els.studentOutingTypesMessage.textContent = message || "";
    els.studentOutingTypesMessage.classList.toggle("error", Boolean(isError));
  }
  if (els.studentOutingTypesRetryButton) {
    els.studentOutingTypesRetryButton.hidden = !showRetry;
  }
}

function getSelectedStudentOutingTypeConfigV200() {
  const typeCode = els.requestTypeSelect ? els.requestTypeSelect.value : "";
  return studentOutingTypesV200.find((type) => type.type_code === typeCode) || null;
}

function setConfigFieldStateV200(field, visible, required, options = {}) {
  if (!field) return;
  const shouldReset = !visible || (options.reset === true && options.clearOnTypeChange === true);
  if (shouldReset) field.value = "";
  setFieldAndLabelHiddenV160(field, !visible);
  field.disabled = !visible;
  field.required = Boolean(visible && required);
  field.readOnly = Boolean(visible && options.readOnly);
  if (visible && options.value !== undefined && options.value !== null && options.value !== "") {
    field.value = String(options.value);
  }
}

function applyStudentOutingTypeConfigV200(config) {
  if (!config) return;
  const typeChanged = studentPreviousOutingTypeCodeV200 !== config.type_code;
  const sameDayOnly = config.same_day_only === true;
  const fixedReturnTime = String(config.fixed_return_time || "").trim();
  setConfigFieldStateV200(els.leaveDateInput, config.require_leave_date === true, config.require_leave_date === true, { reset: typeChanged, clearOnTypeChange: true });
  setConfigFieldStateV200(
    els.returnDateInput,
    config.require_return_date === true && !sameDayOnly,
    config.require_return_date === true && !sameDayOnly,
    { reset: typeChanged, clearOnTypeChange: true }
  );
  setConfigFieldStateV200(
    els.expectedReturnTimeInput,
    config.require_return_time === true,
    config.require_return_time === true,
    { reset: typeChanged, clearOnTypeChange: true, readOnly: Boolean(fixedReturnTime), value: fixedReturnTime }
  );
  setConfigFieldStateV200(els.guardianPhoneInput, config.require_guardian_phone === true, config.require_guardian_phone === true, { reset: typeChanged, clearOnTypeChange: true });
  setConfigFieldStateV200(els.guardianRelationSelect, config.require_guardian_relation === true, config.require_guardian_relation === true, { reset: typeChanged, clearOnTypeChange: true });
  setConfigFieldStateV200(els.emergencyReasonInput, config.require_emergency_reason === true, config.require_emergency_reason === true, { reset: typeChanged, clearOnTypeChange: true });
  setConfigFieldStateV200(els.purposeInput, config.require_purpose === true, config.require_purpose === true, { reset: typeChanged });
  setConfigFieldStateV200(els.locationInput, config.require_location === true, config.require_location === true, { reset: typeChanged });
  setConfigFieldStateV200(els.vehicleTypeSelect, config.require_vehicle === true, config.require_vehicle === true, { reset: typeChanged });
  setConfigFieldStateV200(els.vehicleDetailInput, config.require_vehicle === true, false, { reset: typeChanged });

  const overnightVisible = [els.leaveDateInput, els.returnDateInput, els.expectedReturnTimeInput]
    .some((field) => field && !field.disabled);
  const guardianVisible = [els.guardianPhoneInput, els.guardianRelationSelect, els.emergencyReasonInput]
    .some((field) => field && !field.disabled);
  setSectionVisibleV164(els.overnightFields, overnightVisible);
  setSectionVisibleV164(els.emergencyFields, guardianVisible || (els.emergencyNoteInput && !els.emergencyNoteInput.hidden));
  if (sameDayOnly) syncStudentSameDayReturnV200();
  studentPreviousOutingTypeCodeV200 = config.type_code;
}

function syncStudentSameDayReturnV200() {
  const config = getSelectedStudentOutingTypeConfigV200();
  if (!config || config.same_day_only !== true || !els.returnDateInput || !els.leaveDateInput) return;
  els.returnDateInput.value = els.leaveDateInput.value;
}

function startStudentSession(student) {
  try {
    startSession("student", student);
    loadStudentOutingTypesV200();
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
  const student = students.find((item) => (
    (session.student_id && normalizeValue(item.student_id || item.studentId || item.id) === normalizeValue(session.student_id)) ||
    (session.no_matrik && normalizeValue(item.no_matrik || item.noMatrik) === normalizeValue(session.no_matrik)) ||
    (session.nama && normalizeValue(item.nama || item.name) === normalizeValue(session.nama))
  ));

  if (!student) {
    return null;
  }

  return {
    ...student,
    no_matrik: session.no_matrik || student.no_matrik || student.noMatrik || "",
    noMatrik: session.no_matrik || student.no_matrik || student.noMatrik || "",
    email: session.email || student.email || ""
  };
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
    await refreshStudentLiveRecords(true);
  });

  els.studentLastUpdated = document.createElement("small");
  els.studentLastUpdated.style.color = "#5b6678";

  controls.appendChild(els.studentRefreshButton);
  controls.appendChild(els.studentLastUpdated);
  els.studentRecordsList.parentNode.insertBefore(controls, els.studentRecordsList);
}

async function refreshStudentLiveRecords(includeAnnualSummary = false) {
  if (!currentSession || currentSession.role !== "student") {
    stopStudentAutoRefresh();
    return;
  }

  if (isLiveMode) {
    const requests = [loadTodayRecords()];
    if (includeAnnualSummary) {
      requests.push(loadStudentAnnualSummary());
    }
    await Promise.all(requests);
  } else {
    if (includeAnnualSummary) {
      studentAnnualSummary = buildMockStudentAnnualSummary();
    }
    renderStudent();
  }

  studentLastUpdatedAt = new Date();
  updateStudentLastUpdated();
}

async function loadStudentAnnualSummary() {
  if (!currentSession || currentSession.role !== "student") {
    return;
  }

  const user = currentSession.user || {};
  const studentId = user.student_id || user.studentId || user.id || "";
  const noMatrik = user.no_matrik || user.noMatrik || "";
  if (!studentId || !noMatrik) {
    throw new Error("Credential sesi pelajar tidak lengkap.");
  }

  if (els.studentAnnualSummary) {
    els.studentAnnualSummary.textContent = "Jumlah Outing: Memuatkan...";
  }

  try {
    studentAnnualSummary = await apiPost("getStudentAnnualSummary", {
      student_id: studentId,
      no_matrik: noMatrik
    });
  } catch (error) {
    studentAnnualSummary = { year: getMalaysiaYearV200(), error: true };
  } finally {
    renderStudentAnnualSummary();
  }
}

function buildMockStudentAnnualSummary() {
  const currentYear = getMalaysiaYearV200();
  const totalOutings = outingRecords.filter((record) => {
    const status = record.rawStatus || reverseDisplayStatus(record.status);
    const date = parseFlexibleDate(record.tarikh || record.masa_mohon || record.requestedAt);
    return isRecordForCurrentStudent(record) && status === "SELESAI" && date && date.getFullYear() === currentYear;
  }).length;
  return { year: currentYear, total_outings: totalOutings };
}

function renderStudentAnnualSummary() {
  if (!els.studentAnnualSummary) {
    return;
  }
  if (!studentAnnualSummary) {
    const year = getMalaysiaYearV200();
    els.studentAnnualSummary.textContent = `Jumlah Outing ${year}: —`;
    return;
  }
  if (studentAnnualSummary.error) {
    els.studentAnnualSummary.textContent = `Jumlah Outing ${Number(studentAnnualSummary.year)}: Tidak dapat dimuatkan`;
    return;
  }
  els.studentAnnualSummary.textContent = `Jumlah Outing ${Number(studentAnnualSummary.year)}: ${Number(studentAnnualSummary.total_outings || 0)} kali`;
}

function getMalaysiaYearV200() {
  return Number(new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    timeZone: "Asia/Kuala_Lumpur"
  }).format(new Date()));
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

function obsoleteOpenMonitoringPageV1612(eventOrOptions) {
  const intentional = isIntentionalNavigationV200(eventOrOptions);
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
  const statusDisplay = getContextualStatusDisplay(record);
  return `
    <article class="record-card">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(getRecordName(record) || "-")}</h3>
          <div class="record-meta">${escapeHtml(getRecordId(record))} | ${escapeHtml(record.className || record.kelas || "-")}</div>
        </div>
        <div class="badge-stack">
          <span class="badge badge-${statusDisplay.key}">${statusDisplay.icon} ${escapeHtml(statusDisplay.label)}</span>
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

function ensureGuardRefreshControls() {
  if (!els.guardApprovedList) {
    return;
  }

  if (!els.guardRefreshButton) {
    const controls = document.createElement("div");
    controls.className = "guard-refresh-panel";
    controls.id = "guardRefreshControls";

    els.guardRefreshButton = document.createElement("button");
    els.guardRefreshButton.className = "secondary-action guard-refresh-button";
    els.guardRefreshButton.id = "guardRefreshButton";
    els.guardRefreshButton.type = "button";
    els.guardRefreshButton.textContent = "Refresh Status";

    els.guardLastUpdated = document.createElement("small");
    els.guardLastUpdated.className = "guard-last-updated";
    els.guardLastUpdated.id = "guardLastUpdated";

    controls.appendChild(els.guardRefreshButton);
    controls.appendChild(els.guardLastUpdated);
    const approvedTitle = els.guardApprovedList.previousElementSibling &&
      els.guardApprovedList.previousElementSibling.classList &&
      els.guardApprovedList.previousElementSibling.classList.contains("list-title")
      ? els.guardApprovedList.previousElementSibling
      : els.guardApprovedList;
    els.guardApprovedList.parentNode.insertBefore(controls, approvedTitle);
  }

  if (els.guardRefreshButton.dataset.guardRefreshReady !== "1") {
    els.guardRefreshButton.dataset.guardRefreshReady = "1";
    els.guardRefreshButton.addEventListener("click", () => refreshGuardRecords("button"));
  }
}

function updateGuardLastUpdated() {
  guardLastUpdatedAt = new Date();
  if (els.guardLastUpdated) {
    els.guardLastUpdated.textContent = `Dikemaskini: ${guardLastUpdatedAt.toLocaleTimeString("ms-MY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    })}`;
  }
}

async function refreshGuardRecords(source) {
  if (!currentSession || currentSession.role !== "guard") {
    return;
  }

  ensureGuardRefreshControls();
  const button = els.guardRefreshButton;
  const originalText = button ? button.textContent : "";

  if (button) {
    button.disabled = true;
    button.textContent = "Memuat semula...";
  }

  try {
    if (isLiveMode) {
      const records = await apiPost("getTodayRecords", buildTodayRecordsAccessPayload());
      outingRecords = records.map(mapLiveRecord);
      render();
    } else {
      render();
    }
    showSignedInTab("guard");
    updateGuardLastUpdated();
    if (source === "button") {
      showSuccess("Status guard telah dimuat semula.", "Refresh Status");
    }
  } catch (error) {
    console.error("Refresh status Guard gagal.", error);
    showSignedInTab("guard");
    showError("Status guard gagal dimuat semula. Sila cuba lagi.", "Refresh Gagal");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "Refresh Status";
    }
  }
}

function startGuardAutoRefresh() {
  stopGuardAutoRefresh();
  guardRefreshIntervalId = window.setInterval(() => {
    if (!currentSession || currentSession.role !== "guard" || !isWorkspaceActive(els.appWorkspace)) {
      stopGuardAutoRefresh();
      return;
    }

    refreshGuardRecords("auto");
  }, 30000);
}

function stopGuardAutoRefresh() {
  if (guardRefreshIntervalId) {
    window.clearInterval(guardRefreshIntervalId);
    guardRefreshIntervalId = null;
  }
}

els.requestTypeSelect.addEventListener("change", updateEmergencyFields);

els.requestForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (studentRequestSubmissionInFlight) {
    return;
  }

  const requestType = els.requestTypeSelect.value;
  const selectedConfig = getSelectedStudentOutingTypeConfigV200();
  const configValidationMessage = selectedConfig
    ? validateStudentOutingTypeConfigV200(selectedConfig)
    : "";
  if (configValidationMessage) {
    els.studentMessage.textContent = configValidationMessage;
    return;
  }

  if (!isLiveMode && !canSubmitRequest(requestType, new Date())) {
    els.studentMessage.textContent = "Outing Biasa hanya dibuka pada Selasa/Rabu selepas 5:00 PM. Hanya permohonan Kecemasan boleh dihantar sekarang.";
    return;
  }

  if (
    requestType === REQUEST_TYPE.emergency
    && (!selectedConfig || selectedConfig.require_emergency_reason === true)
    && !els.emergencyReasonInput.value.trim()
  ) {
    els.studentMessage.textContent = "Sila isi Sebab Kecemasan sebelum menghantar permohonan Kecemasan.";
    return;
  }

if (requestType === REQUEST_TYPE.weekend && (!selectedConfig || selectedConfig.require_leave_date === true)) {
  const leaveDate = els.leaveDateInput
    ? els.leaveDateInput.value
    : "";

  if (!leaveDate) {
    els.studentMessage.textContent = "Sila pilih tarikh Outing Sabtu / Ahad.";
    return;
  }


  const selectedDate = new Date(`${leaveDate}T12:00:00`);
  const selectedDay = selectedDate.getDay();
  const isWeekendDate = selectedDay === 0 || selectedDay === 6;

  if (!isWeekendDate) {
    els.studentMessage.textContent = "Tarikh Outing Sabtu / Ahad mestilah pada hari Sabtu atau Ahad.";
    return;
  }
}

const student = currentSession && currentSession.role === "student"
  ? currentSession.user
  : null;

if (!student) {
  els.studentMessage.textContent = "Sila masuk sebagai Pelajar dahulu.";
  return;
}

  if (outingRecords.some((record) => isRecordForCurrentStudent(record) && isActiveStudentRequest(record))) {
    els.studentMessage.textContent = "Anda sudah mempunyai permohonan aktif hari ini. Sila semak status di bawah.";
    renderStudent();
    return;
  }

  setStudentRequestSubmitting(true, "Menghantar permohonan...");

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
    } finally {
      setStudentRequestSubmitting(false);
    }
    return;
  }

  try {
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
  } finally {
    setStudentRequestSubmitting(false);
  }
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
  if (role === "warden" || role === "guard") {
    clearStaffLoginSuccessFeedback();
  }
  // Mock frontend access only. Real GAS backend must validate role and identity later.
  stopStudentAutoRefresh();
  stopGuardAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = { role, user };
  if (isLiveMode) {
    outingRecords = [];
    wardenHasLoadedOnce = false;
  }
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
    studentAnnualSummary = null;
    refreshStudentLiveRecords(true);
    startStudentAutoRefresh();
  }
  if (role === "guard") {
    refreshGuardRecords("login");
    startGuardAutoRefresh();
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
  renderStudentDropdownState(students);
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
  return (
    requestType === REQUEST_TYPE.emergency ||
    requestType === REQUEST_TYPE.weekend ||
    isApplicationOpen(date)
  );
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
  renderStudentAnnualSummary();

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

function setStudentRequestSubmitting(isSubmitting, message) {
  studentRequestSubmissionInFlight = Boolean(isSubmitting);
  const submitButton = els.requestForm
    ? els.requestForm.querySelector('button[type="submit"]')
    : null;

  if (submitButton) {
    if (studentRequestSubmissionInFlight && !studentSubmitButtonContentState) {
      studentSubmitButtonContentState = {
        button: submitButton,
        childNodes: Array.from(submitButton.childNodes),
        hadAriaBusy: submitButton.hasAttribute("aria-busy"),
        ariaBusy: submitButton.getAttribute("aria-busy")
      };

      const spinner = document.createElement("span");
      spinner.className = "student-submit-spinner";
      spinner.setAttribute("aria-hidden", "true");
      const loadingLabel = document.createElement("span");
      loadingLabel.className = "student-submit-loading-label";
      loadingLabel.textContent = "Menghantar...";
      submitButton.replaceChildren(spinner, loadingLabel);
    } else if (!studentRequestSubmissionInFlight && studentSubmitButtonContentState) {
      const originalState = studentSubmitButtonContentState;
      originalState.button.replaceChildren(...originalState.childNodes);
      if (originalState.hadAriaBusy) {
        originalState.button.setAttribute("aria-busy", originalState.ariaBusy);
      } else {
        originalState.button.removeAttribute("aria-busy");
      }
      studentSubmitButtonContentState = null;
    }

    submitButton.classList.toggle("is-loading", studentRequestSubmissionInFlight);
    submitButton.disabled = studentRequestSubmissionInFlight;
    if (studentRequestSubmissionInFlight) {
      submitButton.setAttribute("aria-busy", "true");
    }
  }

  if (studentRequestSubmissionInFlight && message && els.studentMessage) {
    els.studentMessage.textContent = message;
  }

  if (!studentRequestSubmissionInFlight) {
    updateStudentSubmitState();
  }
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

  console.debug("Student record refresh completed.");
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
  bindStudentReturnSelfieControls();
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
  const selfieProof = returnSelfieProofHtml(record);

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
      ${selfieProof}
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

function openStatisticsPage(eventOrOptions) {
  const intentional = isIntentionalNavigationV200(eventOrOptions);
  stopStudentAutoRefresh();
  stopMonitoringAutoRefresh();
  currentSession = null;
  if (els.statsBackButton) els.statsBackButton.textContent = "Tukar Peranan";
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.remove("active");
  if (els.monitorWorkspace) els.monitorWorkspace.classList.remove("active");
  activateStatisticsWorkspaceV200();
  if (intentional) {
    scheduleIntentionalScrollV200(els.statsWorkspace);
  }
  setupStatsFilters();
  loadStatistics();
}

function openAdminStatisticsPageV200(eventOrOptions) {
  if (!currentSession || currentSession.role !== "admin" || !adminRuntimeCredential) {
    showError("Sesi Admin telah tamat. Sila log masuk semula.", "Akses Statistik");
    return;
  }

  const intentional = isIntentionalNavigationV200(eventOrOptions) || Boolean(eventOrOptions);
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.remove("active");
  if (els.monitorWorkspace) els.monitorWorkspace.classList.remove("active");
  activateStatisticsWorkspaceV200();
  if (els.statsBackButton) els.statsBackButton.textContent = "Kembali ke Admin";
  if (intentional) scheduleIntentionalScrollV200(els.statsWorkspace);
  setupStatsFilters();
  loadStatistics();
}

function activateStatisticsWorkspaceV200() {
  if (!els.statsWorkspace) {
    setupStatisticsPanel();
  }
  if (!els.statsWorkspace) {
    return;
  }

  els.statsWorkspace.classList.add("active");
  const statsPanel = els.statsWorkspace.querySelector("#stats");
  if (statsPanel) {
    statsPanel.classList.add("active");
  }
}

function closeStatisticsPage() {
  els.statsWorkspace.classList.remove("active");
  if (currentSession && currentSession.role === "admin" && adminRuntimeCredential) {
    els.appWorkspace.classList.add("active");
    els.accessScreen.classList.add("hidden");
    els.adminDashboard.classList.add("active");
    return;
  }
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

  const hasAdminAccess = Boolean(currentSession && currentSession.role === "admin" && adminRuntimeCredential);
  if (!hasAdminAccess) {
    renderAdminIndividualStatsV200(null);
    return;
  }

  if (els.statsLeaderboard) {
    els.statsLeaderboard.innerHTML = emptyState("Memuatkan statistik individu...");
  }
  try {
    const individualStats = await apiPost("getAdminIndividualStats", {
      ...buildAdminCredentialPayloadV200(),
      ...params
    });
    renderAdminIndividualStatsV200(individualStats);
  } catch (error) {
    els.statsLeaderboard.innerHTML = emptyState("Statistik individu tidak dapat dimuatkan. Sila cuba lagi.");
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

    studentMap[studentKey] = true;

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

function renderAdminIndividualStatsV200(stats) {
  const hasAdminAccess = Boolean(currentSession && currentSession.role === "admin" && adminRuntimeCredential);
  if (els.statsPrivacyMessage) {
    els.statsPrivacyMessage.textContent = hasAdminAccess
      ? "Ringkasan agregat kekal tersedia; data individu ini hanya dipaparkan selepas pengesahan Admin."
      : "Ringkasan agregat tersedia kepada umum; statistik individu terhad kepada Admin yang dibenarkan.";
  }
  if (!els.statsLeaderboard) {
    return;
  }
  if (!hasAdminAccess) {
    els.statsLeaderboard.innerHTML = emptyState("Log masuk sebagai Admin untuk melihat statistik individu pelajar.");
    return;
  }

  const students = stats && Array.isArray(stats.students) ? stats.students : [];
  if (!students.length) {
    els.statsLeaderboard.innerHTML = emptyState("Tiada rekod SELESAI bagi bulan, tahun dan kelas yang dipilih.");
    return;
  }

  els.statsLeaderboard.innerHTML = `
    <div class="individual-stats-table-wrap">
      <table class="individual-stats-table">
        <thead>
          <tr><th>Pelajar</th><th>Kelas</th><th>Jumlah Outing</th><th>Jumlah Tempoh Outing</th></tr>
        </thead>
        <tbody>
          ${students.map((student) => `
            <tr>
              <td data-label="Pelajar">${escapeHtml(student.student_name || "-")}</td>
              <td data-label="Kelas">${escapeHtml(student.kelas || "-")}</td>
              <td data-label="Jumlah Outing">${Number(student.total_outings || 0)}</td>
              <td data-label="Jumlah Tempoh Outing">${escapeHtml(student.total_duration || "0 minit")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function buildMockAdminIndividualStatsV200(params) {
  const month = Number(params.month);
  const year = Number(params.year);
  const kelasFilter = normalizeValue(params.kelas);
  const studentsMap = {};
  outingRecords.forEach((record) => {
    const status = record.rawStatus || reverseDisplayStatus(record.status);
    const date = parseFlexibleDate(record.tarikh || record.masa_mohon || record.requestedAt);
    const kelas = record.kelas || record.className || "Tidak Dinyatakan";
    if (status !== "SELESAI" || !date || date.getMonth() + 1 !== month || date.getFullYear() !== year) return;
    if (kelasFilter && normalizeValue(kelas) !== kelasFilter) return;
    const key = getRecordStudentId(record) || getRecordNoMatrik(record) || getRecordName(record);
    if (!key) return;
    if (!studentsMap[key]) {
      studentsMap[key] = {
        student_name: getRecordName(record) || "Tidak Dinyatakan",
        kelas,
        total_outings: 0,
        total_duration_minutes: 0
      };
    }
    studentsMap[key].total_outings += 1;
    const keluar = parseFlexibleDate(record.masa_keluar || record.outAt);
    const masuk = parseFlexibleDate(record.masa_masuk || record.returnedAt);
    if (keluar && masuk && masuk > keluar) {
      studentsMap[key].total_duration_minutes += Math.floor((masuk - keluar) / 60000);
    }
  });
  const students = Object.values(studentsMap)
    .map((student) => ({
      ...student,
      total_duration: formatOutingDurationClientV200(student.total_duration_minutes)
    }))
    .sort((left, right) => right.total_outings - left.total_outings || left.student_name.localeCompare(right.student_name));
  return { month, year, kelas: params.kelas || "", students };
}

function formatOutingDurationClientV200(totalMinutes) {
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

  renderWardenSemesterChecklist(outingRecords);

  els.wardenList.innerHTML = pendingRecords.length
    ? pendingRecords.map((record) => recordCard(record, "warden")).join("")
    : emptyState("Tiada permohonan menunggu kelulusan.");

  els.wardenApprovedList.innerHTML = approvedRecords.length
    ? approvedRecords.map((record) => recordCard(record, "dashboard")).join("")
    : emptyState("Tiada permohonan diluluskan yang menunggu pengesahan guard.");

  els.wardenList.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(button.dataset.approve, STATUS.approved, button));
  });

  els.wardenList.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(button.dataset.reject, STATUS.rejected, button));
  });
}

function isReturnSelfieSubmitted(record) {
  return String(record && record.selfie_status || "").trim().toUpperCase() === RETURN_SELFIE_STATUS.submitted ||
    Boolean(record && (record.selfie_file_id || record.masa_selfie));
}

function isReturnSelfieEligible(record) {
  const rawStatus = record && (record.rawStatus || reverseDisplayStatus(record.status));
  return Boolean(
    currentSession &&
    currentSession.role === "student" &&
    record &&
    isRecordForCurrentStudent(record) &&
    rawStatus === "SELESAI" &&
    (record.masa_masuk || record.returnedAt) &&
    RETURN_SELFIE_TYPES.has(record.jenis_permohonan) &&
    !isReturnSelfieSubmitted(record)
  );
}

function returnSelfieProofHtml(record) {
  if (!record || (record.rawStatus || reverseDisplayStatus(record.status)) !== "SELESAI" || !(record.masa_masuk || record.returnedAt)) {
    return "";
  }
  if (isReturnSelfieSubmitted(record)) {
    const submittedTime = record.masa_selfie
      ? `<span>Masa Bukti: ${escapeHtml(formatDisplayDateTime(record.masa_selfie))}</span>`
      : "";
    return `
      <section class="return-selfie-proof return-selfie-proof-complete" aria-label="Status bukti selfie">
        <span class="badge badge-selfie-submitted">Bukti Selfie Dihantar</span>
        ${submittedTime}
        <strong>Bukti selfie telah dihantar</strong>
      </section>
    `;
  }
  if (!isReturnSelfieEligible(record)) {
    return "";
  }

  const recordId = getRecordId(record);
  const controlId = `return-selfie-${String(recordId || "record").replace(/[^a-z0-9_-]/gi, "-")}`;
  return `
    <section class="return-selfie-proof" data-return-selfie="${escapeHtml(recordId)}" aria-labelledby="${controlId}-title">
      <span class="badge badge-selfie-pending">Bukti Selfie Belum Dihantar</span>
      <p id="${controlId}-title">Guard telah mengesahkan anda masuk. Sila ambil selfie selepas tiba di asrama.</p>
      <label class="primary-action return-selfie-picker" for="${controlId}">
        Ambil Selfie &amp; Lapor Pulang
      </label>
      <input id="${controlId}" class="return-selfie-input" type="file" accept="image/*" capture="user"
             data-selfie-input="${escapeHtml(recordId)}" aria-label="Ambil selfie bukti pulang">
      <div class="return-selfie-preview-wrap" data-selfie-preview-wrap hidden>
        <img class="return-selfie-preview" data-selfie-preview alt="Preview selfie bukti pulang">
        <div class="return-selfie-actions">
          <button class="secondary-action" type="button" data-selfie-retake="${escapeHtml(recordId)}">Ambil Semula</button>
          <button class="primary-action" type="button" data-selfie-submit="${escapeHtml(recordId)}">Hantar Bukti</button>
        </div>
      </div>
      <p class="form-message return-selfie-message" data-selfie-message aria-live="polite"></p>
    </section>
  `;
}

function bindStudentReturnSelfieControls() {
  if (!els.studentRecordsList) {
    return;
  }
  els.studentRecordsList.querySelectorAll("[data-return-selfie]").forEach((panel) => {
    const requestId = panel.dataset.returnSelfie;
    const draft = returnSelfieDrafts.get(requestId);
    if (!draft || !draft.previewUrl) {
      return;
    }
    const preview = panel.querySelector("[data-selfie-preview]");
    const previewWrap = panel.querySelector("[data-selfie-preview-wrap]");
    const message = panel.querySelector("[data-selfie-message]");
    if (preview) preview.src = draft.previewUrl;
    if (previewWrap) previewWrap.hidden = false;
    if (message) message.textContent = "Semak gambar sebelum menghantar.";
  });
  els.studentRecordsList.querySelectorAll("[data-selfie-input]").forEach((input) => {
    input.addEventListener("change", () => previewReturnSelfie(input));
  });
  els.studentRecordsList.querySelectorAll("[data-selfie-retake]").forEach((button) => {
    button.addEventListener("click", () => resetReturnSelfieDraft(button.dataset.selfieRetake));
  });
  els.studentRecordsList.querySelectorAll("[data-selfie-submit]").forEach((button) => {
    button.addEventListener("click", () => submitReturnSelfieFromCard(button.dataset.selfieSubmit));
  });
}

function previewReturnSelfie(input) {
  const requestId = input.dataset.selfieInput;
  const panel = input.closest("[data-return-selfie]");
  const file = input.files && input.files[0];
  const message = panel && panel.querySelector("[data-selfie-message]");
  if (!file) {
    return;
  }
  if (!String(file.type || "").startsWith("image/") || file.size > 20 * 1024 * 1024) {
    input.value = "";
    if (message) message.textContent = "Sila pilih gambar yang sah dan tidak melebihi 20 MB.";
    return;
  }

  const previousDraft = returnSelfieDrafts.get(requestId);
  if (previousDraft && previousDraft.previewUrl) {
    URL.revokeObjectURL(previousDraft.previewUrl);
  }
  const previewUrl = URL.createObjectURL(file);
  returnSelfieDrafts.set(requestId, { file, previewUrl });
  const preview = panel.querySelector("[data-selfie-preview]");
  const previewWrap = panel.querySelector("[data-selfie-preview-wrap]");
  preview.src = previewUrl;
  previewWrap.hidden = false;
  if (message) message.textContent = "Semak gambar sebelum menghantar.";
}

function resetReturnSelfieDraft(requestId) {
  const panel = els.studentRecordsList.querySelector(`[data-return-selfie="${cssEscapeValue(requestId)}"]`);
  if (!panel) {
    return;
  }
  const draft = returnSelfieDrafts.get(requestId);
  if (draft && draft.previewUrl) {
    URL.revokeObjectURL(draft.previewUrl);
  }
  returnSelfieDrafts.delete(requestId);
  const input = panel.querySelector("[data-selfie-input]");
  const preview = panel.querySelector("[data-selfie-preview]");
  const previewWrap = panel.querySelector("[data-selfie-preview-wrap]");
  if (input) input.value = "";
  if (preview) preview.removeAttribute("src");
  if (previewWrap) previewWrap.hidden = true;
  if (input) input.click();
}

function cssEscapeValue(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(String(value || ""));
  }
  return String(value || "").replace(/["\\]/g, "\\$&");
}

async function submitReturnSelfieFromCard(requestId) {
  const record = findRecordById(requestId);
  const draft = returnSelfieDrafts.get(requestId);
  const panel = els.studentRecordsList.querySelector(`[data-return-selfie="${cssEscapeValue(requestId)}"]`);
  const message = panel && panel.querySelector("[data-selfie-message]");
  const buttons = panel ? panel.querySelectorAll("button, input, .return-selfie-picker") : [];
  if (!record || !isReturnSelfieEligible(record)) {
    if (message) message.textContent = "Rekod ini tidak lagi layak untuk penghantaran bukti.";
    return;
  }
  if (!draft || !draft.file) {
    if (message) message.textContent = "Ambil atau pilih selfie terlebih dahulu.";
    return;
  }

  buttons.forEach((control) => {
    if ("disabled" in control) control.disabled = true;
    control.classList.add("is-disabled");
  });
  if (message) message.textContent = "Memampatkan dan menghantar gambar...";

  try {
    const compressed = await compressReturnSelfie(draft.file);
    let result;
    if (isLiveMode) {
      result = await apiPost("submitReturnSelfie", {
        request_id: requestId,
        student_id: getCurrentStudentId(),
        no_matrik: getCurrentStudentNoMatrik(),
        image_base64: compressed.base64,
        mime_type: compressed.mimeType
      });
    } else {
      result = {
        request_id: requestId,
        selfie_status: RETURN_SELFIE_STATUS.submitted,
        masa_selfie: new Date().toISOString()
      };
    }
    outingRecords = outingRecords.map((item) => getRecordId(item) === requestId
      ? { ...item, selfie_status: result.selfie_status, masa_selfie: result.masa_selfie }
      : item);
    if (draft.previewUrl) URL.revokeObjectURL(draft.previewUrl);
    returnSelfieDrafts.delete(requestId);
    renderStudent();
    showSuccess("Bukti selfie telah dihantar.", "Bukti Pulang");
  } catch (error) {
    if (message) message.textContent = error.message || "Bukti gagal dihantar. Sila cuba lagi.";
    buttons.forEach((control) => {
      if ("disabled" in control) control.disabled = false;
      control.classList.remove("is-disabled");
    });
    showError(error.message || "Bukti gagal dihantar. Sila cuba lagi.", "Penghantaran Gagal");
  }
}

async function compressReturnSelfie(file) {
  const bitmap = await loadReturnSelfieBitmap(file);
  const longestSide = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, 1280 / longestSide);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  if (typeof bitmap.close === "function") bitmap.close();

  let blob = await canvasToJpegBlob(canvas, 0.8);
  if (blob.size > 1024 * 1024) {
    blob = await canvasToJpegBlob(canvas, 0.75);
  }
  if (!blob.size || blob.size > 1500 * 1024) {
    throw new Error("Gambar masih terlalu besar selepas dimampatkan. Sila ambil semula.");
  }
  return {
    base64: await blobToBase64(blob),
    mimeType: "image/jpeg"
  };
}

async function loadReturnSelfieBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (error) {
      // Fall back to an Image element on browsers without this option.
    }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gambar tidak dapat dibaca. Sila ambil semula."));
    };
    image.src = url;
  });
}

function canvasToJpegBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Gambar tidak dapat dimampatkan."));
    }, "image/jpeg", quality);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(new Error("Gambar tidak dapat diproses."));
    reader.readAsDataURL(blob);
  });
}

function ensureWardenSemesterChecklist() {
  if (!els.wardenList || els.wardenSemesterChecklist) {
    return;
  }

  const panel = document.createElement("section");
  panel.className = "semester-checklist-panel";
  panel.innerHTML = `
    <div class="semester-checklist-heading">
      <h3>Cuti Semester</h3>
      <span id="wardenSemesterCount">Cuti Semester: 0 permohonan menunggu</span>
    </div>
    <div class="semester-checklist-list" id="wardenSemesterList"></div>
  `;

  els.wardenList.parentNode.insertBefore(panel, els.wardenList);
  els.wardenSemesterChecklist = panel;
  els.wardenSemesterCount = panel.querySelector("#wardenSemesterCount");
  els.wardenSemesterList = panel.querySelector("#wardenSemesterList");
}

function renderWardenSemesterChecklist(pendingRecords) {
  ensureWardenSemesterChecklist();

  if (!els.wardenSemesterList || !els.wardenSemesterCount) {
    return;
  }

  const semesterRecords = (pendingRecords || []).filter((record) => record.jenis_permohonan === REQUEST_TYPE.semester);
  els.wardenSemesterCount.textContent = `Cuti Semester: ${semesterRecords.length} permohonan menunggu`;

  els.wardenSemesterList.innerHTML = semesterRecords.length
    ? semesterRecords.map(semesterChecklistItem).join("")
    : `<div class="empty-state semester-checklist-empty">Tiada permohonan Cuti Semester menunggu kelulusan.</div>`;

  els.wardenSemesterList.querySelectorAll("[data-semester-jump]").forEach((button) => {
    button.addEventListener("click", () => scrollToRecordCard(button.dataset.semesterJump));
  });
}

function semesterChecklistItem(record) {
  const recordId = getRecordId(record);
  const returnDate = formatDisplayDateV160(record.tarikh_balik || record.returnDate);
  const statusText = record.status || "-";

  return `
    <button class="semester-checklist-item" type="button" data-semester-jump="${escapeHtml(recordId)}">
      <span class="semester-checkmark" aria-hidden="true"></span>
      <span class="semester-checklist-main">
        <strong>${escapeHtml(record.studentName || record.nama || "-")}</strong>
        <small>${escapeHtml(record.className || record.kelas || "-")}</small>
      </span>
      <span class="semester-checklist-meta">
        <span>${escapeHtml(returnDate)}</span>
        <small>${escapeHtml(statusText)}</small>
      </span>
    </button>
  `;
}

function scrollToRecordCard(recordId) {
  const card = document.querySelector(`#${recordDomId(recordId)}`);
  if (!card) {
    return;
  }

  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.add("record-card-focus");
  window.setTimeout(() => card.classList.remove("record-card-focus"), 1400);
}

function uniqueRecordsByRequestId(records) {
  const seenRecordIds = new Set();
  return records.filter((record) => {
    const recordId = getRecordId(record);
    if (!recordId) {
      return true;
    }

    const key = String(recordId);
    if (seenRecordIds.has(key)) {
      return false;
    }

    seenRecordIds.add(key);
    return true;
  });
}

function renderGuard() {
  ensureGuardRefreshControls();
  const approvedRecords = uniqueRecordsByRequestId(
    outingRecords.filter((record) => record.status === STATUS.approved)
  );
  const outRecords = uniqueRecordsByRequestId(outingRecords.filter((record) => (
    record.status === STATUS.out && !isOvernightNotReturnedV15(record)
  )));

  els.guardApprovedList.innerHTML = approvedRecords.length
    ? approvedRecords.map((record) => recordCard(record, "guard-out")).join("")
    : emptyState("Tiada pelajar yang telah diluluskan untuk keluar.");

  els.guardOutList.innerHTML = outRecords.length
    ? outRecords.map((record) => recordCard(record, "guard-in")).join("")
    : emptyState("Tiada pelajar sedang keluar.");

  els.guardApprovedList.querySelectorAll("[data-out]").forEach((button) => {
    button.addEventListener("click", () => confirmOut(button.dataset.out, button));
  });

  els.guardOutList.querySelectorAll("[data-in]").forEach((button) => {
    button.addEventListener("click", () => confirmIn(button.dataset.in, button));
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

function setOperationalActionLoading(button, loadingLabel) {
  if (!button || typeof button.closest !== "function") {
    return null;
  }

  const actionGroup = button.closest(".record-actions");
  if (!actionGroup) {
    return null;
  }

  const controls = Array.from(actionGroup.querySelectorAll("button"));
  const state = {
    actionGroup,
    activeButton: button,
    activeChildNodes: Array.from(button.childNodes),
    controls: controls.map((control) => ({ control, disabled: control.disabled })),
    groupHadAriaBusy: actionGroup.hasAttribute("aria-busy"),
    groupAriaBusy: actionGroup.getAttribute("aria-busy"),
    buttonHadAriaBusy: button.hasAttribute("aria-busy"),
    buttonAriaBusy: button.getAttribute("aria-busy")
  };

  controls.forEach((control) => {
    control.disabled = true;
  });

  const spinner = document.createElement("span");
  spinner.className = "student-submit-spinner operational-action-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.className = "operational-action-loading-label";
  label.textContent = loadingLabel;
  button.replaceChildren(spinner, label);
  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
  actionGroup.setAttribute("aria-busy", "true");
  return state;
}

function clearOperationalActionLoading(state) {
  if (!state) {
    return;
  }

  state.activeButton.replaceChildren(...state.activeChildNodes);
  state.activeButton.classList.remove("is-loading");
  state.controls.forEach(({ control, disabled }) => {
    control.disabled = disabled;
  });

  if (state.buttonHadAriaBusy) {
    state.activeButton.setAttribute("aria-busy", state.buttonAriaBusy);
  } else {
    state.activeButton.removeAttribute("aria-busy");
  }
  if (state.groupHadAriaBusy) {
    state.actionGroup.setAttribute("aria-busy", state.groupAriaBusy);
  } else {
    state.actionGroup.removeAttribute("aria-busy");
  }
}

async function updateStatus(id, status, button) {
  if (!currentSession || currentSession.role !== "warden") {
    return;
  }

  if (wardenActionLocks[id]) {
    return;
  }

  const isApproval = status === STATUS.approved;
  wardenActionLocks[id] = isApproval ? "approve" : "reject";
  const loadingState = setOperationalActionLoading(
    button,
    isApproval ? "Meluluskan..." : "Menolak..."
  );

  try {
    if (isLiveMode) {
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
  } catch (error) {
    showModeNotice(`Live API error: ${error.message}`);
    showError(error.message, "Tindakan Gagal");
  } finally {
    clearOperationalActionLoading(loadingState);
    delete wardenActionLocks[id];
  }
}

async function confirmOut(id, button) {
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

  const studentLabel = previousRecord.studentName || previousRecord.nama || "pelajar ini";
  const classLabel = previousRecord.className || previousRecord.kelas || "-";
  const confirmMessage = [
    "SAHKAN KELUAR",
    "",
    `Pelajar: ${studentLabel} (${classLabel})`,
    "Tindakan ini merekodkan pelajar MENINGGALKAN kampus.",
    "",
    "Teruskan dengan Sahkan Keluar?"
  ].join("\n");
  if (typeof window.confirm === "function" && !window.confirm(confirmMessage)) {
    return;
  }

  const now = new Date();
  setGuardActionPending(id, "out");
  const loadingState = setOperationalActionLoading(button, "Mengesahkan keluar...");

  try {
    if (isLiveMode) {
      await apiPost("confirmOut", {
        request_id: id,
        nama_guard: currentSession.user.name,
        pin: currentSession.user.pin || ""
      });
      await loadTodayRecords();
      showSuccess("Pelajar telah disahkan keluar.", "Sahkan Keluar");
      return;
    }

    updateLocalRecord(id, (record) => ({
      ...record,
      status: STATUS.out,
      outAt: now,
      masa_keluar: record.masa_keluar || now,
      guardOutBy: currentSession.user.name,
      guard_keluar_by: currentSession.user.name
    }));
    showSuccess("Pelajar telah disahkan keluar.", "Sahkan Keluar");
  } catch (error) {
    showModeNotice(`Live API error: ${error.message}`);
    showError("Gagal disimpan. Sila tekan Cuba Lagi.", "Tindakan Gagal");
  } finally {
    clearOperationalActionLoading(loadingState);
    clearGuardActionPending(id);
  }
}

async function confirmIn(id, button) {
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

  const studentLabel = previousRecord.studentName || previousRecord.nama || "pelajar ini";
  const classLabel = previousRecord.className || previousRecord.kelas || "-";
  const confirmMessage = [
    "SAHKAN MASUK",
    "",
    `Pelajar: ${studentLabel} (${classLabel})`,
    "Tindakan ini merekodkan pelajar TELAH KEMBALI ke kampus.",
    "",
    "Teruskan dengan Sahkan Masuk?"
  ].join("\n");
  if (typeof window.confirm === "function" && !window.confirm(confirmMessage)) {
    return;
  }

  const guardReturnNote = window.prompt("Catatan untuk pengesahan MASUK (pilihan)", "") || "";
  const now = new Date();
  setGuardActionPending(id, "in");
  const loadingState = setOperationalActionLoading(button, "Mengesahkan masuk...");

  try {
    if (isLiveMode) {
      await apiPost("confirmIn", {
        request_id: id,
        nama_guard: currentSession.user.name,
        pin: currentSession.user.pin || "",
        catatan: guardReturnNote.trim()
      });
      await loadTodayRecords();
      showSuccess("Pelajar telah disahkan masuk.", "Sahkan Masuk");
      return;
    }

    updateLocalRecord(id, (record) => ({
      ...record,
      status: STATUS.returned,
      lewat: isAfterReturnLimit(now, record),
      returnedAt: now,
      masa_masuk: record.masa_masuk || now,
      guardInBy: currentSession.user.name,
      guard_masuk_by: currentSession.user.name,
      selfie_status: RETURN_SELFIE_STATUS.pending,
      catatan: guardReturnNote.trim() || record.catatan || ""
    }));
    showSuccess("Pelajar telah disahkan masuk.", "Sahkan Masuk");
  } catch (error) {
    showModeNotice(`Live API error: ${error.message}`);
    showError("Gagal disimpan. Sila tekan Cuba Lagi.", "Tindakan Gagal");
  } finally {
    clearOperationalActionLoading(loadingState);
    clearGuardActionPending(id);
  }
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
  if (mode === "guard-in") {
    return guardReturnCard(record, actions);
  }

  const statusDisplay = getContextualStatusDisplay(record);
  const emergencyBadge = record.jenis_permohonan === REQUEST_TYPE.emergency
    ? `<span class="badge badge-emergency">Kecemasan</span>`
    : "";
  const overnightBadge = record.jenis_permohonan === REQUEST_TYPE.overnight
    ? `<span class="badge badge-overnight">Pulang Bermalam</span>`
    : "";
  const notReturnedBadge = record.status === STATUS.out && isAfterReturnLimit(new Date(), record)
    ? `<span class="badge badge-not-returned">Belum Masuk</span>`
    : "";
  const vehicleDetail = record.butiran_kenderaan || "Tiada butiran";
  const emergencyDetail = emergencyDetailHtml(record);
  const overnightDetail = overnightDetailHtml(record, mode);
  const actorDetail = actorDetailHtml(record);
  const cardClass = record.jenis_permohonan === REQUEST_TYPE.overnight ? "record-card overnight-card" : "record-card";
  const cardAttrs = recordDataAttributes(record);
  const guardActionCue = mode === "guard-out"
    ? `<div class="guard-action-cue guard-action-cue-out"><strong>Tindakan Keluar</strong><span>Pastikan pelajar berada di pos sebelum disahkan meninggalkan kampus.</span></div>`
    : "";

  return `
    <article class="${cardClass}" ${cardAttrs}>
      <div class="record-top">
        <div>
          <h3>${escapeHtml(record.studentName)}</h3>
          <div class="record-meta">${escapeHtml(record.id)} | ${escapeHtml(record.className)}</div>
        </div>
        <div class="badge-stack">
          ${emergencyBadge}
          ${overnightBadge}
          ${notReturnedBadge}
          <span class="badge badge-${statusDisplay.key}">${statusDisplay.icon} ${escapeHtml(statusDisplay.label)}</span>
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
      ${guardActionCue}
      ${actions}
    </article>
  `;
}

function guardReturnCard(record, actions) {
  const timing = getGuardReturnTiming(record, new Date());
  const requestId = getRecordId(record);
  const cardClass = record.jenis_permohonan === REQUEST_TYPE.overnight || record.jenis_permohonan === REQUEST_TYPE.semester
    ? "record-card overnight-card guard-return-card"
    : "record-card guard-return-card";
  const vehicleDetail = record.butiran_kenderaan || "Tiada butiran";

  return `
    <article class="${cardClass}" ${recordDataAttributes(record)}>
      <div class="guard-return-top">
        <h3>${escapeHtml(record.studentName || record.nama || "-")}</h3>
        <div class="record-meta">${escapeHtml(record.className || record.kelas || "-")} · ${escapeHtml(requestTypeLabel(record.jenis_permohonan))}</div>
      </div>
      <div class="guard-return-schedule">
        <p><span>Keluar:</span> <strong>${escapeHtml(formatDisplayDateTime(record.outAt || record.masa_keluar))}</strong></p>
        <p><span>Pulang:</span> <strong>${escapeHtml(timing.expectedDisplay)}</strong></p>
      </div>
      <div class="guard-return-timing ${timing.isLate ? "is-late" : "is-on-time"}" role="status">
        <strong>${escapeHtml(timing.label)}</strong>
      </div>
      <details class="guard-record-details">
        <summary>Lihat Butiran</summary>
        <div class="record-detail">
          <strong>ID Permohonan:</strong> ${escapeHtml(requestId || "-")}<br>
          <strong>Jenis Permohonan:</strong> ${escapeHtml(requestTypeLabel(record.jenis_permohonan))}<br>
          <strong>Tujuan:</strong> ${escapeHtml(record.purpose || record.tujuan || "-")}<br>
          <strong>Lokasi:</strong> ${escapeHtml(record.location || record.lokasi || "-")}<br>
          <strong>Kenderaan:</strong> ${escapeHtml(record.jenis_kenderaan || "-")}<br>
          <strong>Butiran Kenderaan:</strong> ${escapeHtml(vehicleDetail)}
          ${emergencyDetailHtml(record)}
          ${overnightDetailHtml(record, "guard-in")}
          ${actorDetailHtml(record)}
        </div>
        <div class="record-times">
          <span>Mohon: ${formatTime(record.requestedAt)}</span>
          <span>Lulus/Tolak: ${formatTime(record.approvedAt || record.rejectedAt)}</span>
        </div>
      </details>
      ${actions}
    </article>
  `;
}

function getGuardReturnTiming(record, now) {
  const deadline = getExpectedReturnDate(record) || getGuardDailyReturnDeadline(record, now);
  const requiresExplicitReturn = record && (
    record.jenis_permohonan === REQUEST_TYPE.overnight ||
    record.jenis_permohonan === REQUEST_TYPE.semester
  );
  const isLate = deadline
    ? now.getTime() > deadline.getTime()
    : (!requiresExplicitReturn && isAfterReturnLimit(now, record));
  return {
    expectedDisplay: deadline ? formatDisplayDateTime(deadline) : expectedReturnDisplay(record),
    isLate,
    label: isLate && deadline
      ? `Lewat ${formatGuardOverdueDuration(now.getTime() - deadline.getTime())}`
      : (isLate ? "Lewat" : "Dalam tempoh dibenarkan")
  };
}

function getGuardDailyReturnDeadline(record, now) {
  if (record && (record.jenis_permohonan === REQUEST_TYPE.overnight || record.jenis_permohonan === REQUEST_TYPE.semester)) {
    return null;
  }

  const parts = getKualaLumpurParts(now);
  return parseFlexibleDate(`${parts.year}-${parts.month}-${parts.day} 22:00`);
}

function formatGuardOverdueDuration(milliseconds) {
  const totalMinutes = Math.max(1, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts = [];
  if (days) parts.push(`${days} hari`);
  if (hours) parts.push(`${hours} jam`);
  if (minutes || !parts.length) parts.push(`${minutes} minit`);
  return parts.join(" ");
}

function recordDataAttributes(record) {
  const status = record.status || "";
  const requestType = record.jenis_permohonan || "";
  const isOvernight = requestType === REQUEST_TYPE.overnight;
  const isNormal = requestType === REQUEST_TYPE.normal;
  const isEmergency = requestType === REQUEST_TYPE.emergency;
  const isOut = status === STATUS.out;
  const isDone = status === STATUS.returned || status === "SELESAI";
  const isPending = status === STATUS.pending;
  const isLate = Boolean(record.lewat) || (isOut && isAfterReturnLimit(new Date(), record));

  return [
    `id="${recordDomId(getRecordId(record))}"`,
    `data-record-card="1"`,
    `data-request-type="${escapeHtml(requestType)}"`,
    `data-record-status="${escapeHtml(status)}"`,
    `data-filter-normal="${isNormal ? "1" : "0"}"`,
    `data-filter-overnight="${isOvernight ? "1" : "0"}"`,
    `data-filter-emergency="${isEmergency ? "1" : "0"}"`,
    `data-filter-pending="${isPending ? "1" : "0"}"`,
    `data-filter-out="${isOut ? "1" : "0"}"`,
    `data-filter-late="${isLate ? "1" : "0"}"`,
    `data-filter-done="${isDone ? "1" : "0"}"`
  ].join(" ");
}

function recordDomId(recordOrId) {
  const rawId = typeof recordOrId === "object" ? getRecordId(recordOrId) : recordOrId;
  const safeId = String(rawId || "record").replace(/[^a-z0-9_-]/gi, "-");
  return `record-card-${safeId}`;
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
        <strong>Hubungan Waris:</strong> ${escapeHtml(record.hubungan_waris || "-")}
        ${guardianContactHtml(record.telefon_waris)}<br>
        <strong>Catatan Kecemasan:</strong> ${escapeHtml(record.catatan_kecemasan || "-")}`;
}

function overnightDetailHtml(record, mode) {
  if (record.jenis_permohonan !== REQUEST_TYPE.overnight) {
    return "";
  }

  const expectedReturn = expectedReturnDisplay(record);
  const lateReturnLine = isAfterReturnLimit(new Date(), record)
    ? `<br><strong class="late-return-warning">Lewat Pulang Ke Asrama</strong>`
    : "";
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
        ${guardianContactHtml(record.telefon_waris)}
        ${lateReturnLine}
        ${guardLine}`;
}

function guardianContactHtml(phone) {
  const displayPhone = formatPhoneDisplay(phone);
  if (!displayPhone || displayPhone === "-") {
    return "";
  }

  const hrefPhone = String(displayPhone).replace(/[^\d+]/g, "");
  return hrefPhone
    ? `<br><a class="guardian-call-link" href="tel:${escapeHtml(hrefPhone)}">Hubungi Waris</a>`
    : "";
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

  const config = getSelectedStudentOutingTypeConfigV200();
  const configMessage = config ? validateStudentOutingTypeConfigV200(config) : "";
  if (configMessage) return configMessage;

  const now = new Date();
  const parts = getKualaLumpurParts(now);
  const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const returnDate = els.returnDateInput ? els.returnDateInput.value : "";
  const expectedReturnTime = els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : "";

  if (!config && (!returnDate || !expectedReturnTime)) {
    return "Tarikh Pulang Ke Asrama dan Masa Dijangka Pulang Ke Asrama diperlukan untuk Pulang Bermalam.";
  }

  if (returnDate < todayKey) {
    return "Tarikh Pulang Ke Asrama tidak boleh lebih awal daripada tarikh keluar.";
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
  const requestType = payload ? payload.jenis_permohonan : "";

  if (
    action === "submitRequest" &&
    payload &&
    (
      requestType === REQUEST_TYPE.overnight ||
      requestType === REQUEST_TYPE.weekend
    )
  ) {
    const leaveDate = els.leaveDateInput
      ? els.leaveDateInput.value
      : "";

    const returnDate = requestType === REQUEST_TYPE.weekend
      ? leaveDate
      : (
          els.returnDateInput
            ? els.returnDateInput.value
            : ""
        );

    payload = {
      ...payload,
      tarikh: requestType === REQUEST_TYPE.weekend
        ? leaveDate
        : payload.tarikh || "",
      hari: requestType === REQUEST_TYPE.weekend
        ? getDayNameFromDateInput(leaveDate)
        : payload.hari || "",
      tarikh_balik: returnDate,
      hari_balik: getDayNameFromDateInput(returnDate),
      masa_balik_dijangka: requestType === REQUEST_TYPE.weekend
        ? "22:00"
        : (
            els.expectedReturnTimeInput
              ? els.expectedReturnTimeInput.value
              : ""
          )
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
    lokasi: record.lokasi || mapped.lokasi || mapped.location || "",
    selfie_status: record.selfie_status || mapped.selfie_status || "",
    selfie_file_id: record.selfie_file_id || mapped.selfie_file_id || "",
    selfie_url: record.selfie_url || mapped.selfie_url || "",
    masa_selfie: record.masa_selfie || mapped.masa_selfie || "",
    selfie_telegram_message_id: record.selfie_telegram_message_id || mapped.selfie_telegram_message_id || ""
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
    showModeNotice("Gagal memuatkan data dari Google Sheets. Sila tekan Cuba Lagi.");
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

  ensureStudentLoginClassSelection(liveStudents);
  renderStudentLoginClassFilter();
  const filteredStudents = filterStudentsByLoginClass(liveStudents);
  if (!filteredStudents.length) {
    const className = selectedStudentLoginClass || "A2";
    els.studentLoginSelect.innerHTML = `<option value="">Tiada pelajar ${escapeHtml(className)} ditemui.</option>`;
    els.studentLoginSelect.disabled = true;
    setStudentLoginDisabled(true);
    return;
  }

  els.studentLoginSelect.disabled = false;
  setStudentLoginDisabled(false);
  els.studentLoginSelect.innerHTML = filteredStudents.map((student) => (
    `<option value="${escapeHtml(student.id)}">${escapeHtml(student.name)}</option>`
  )).join("");
}

function ensureStudentLoginClassSelection(studentList) {
  if (studentLoginClassInitialized) {
    return;
  }

  const a2HasStudents = filterStudentsByLoginClass(studentList, "A2").length > 0;
  const a3HasStudents = filterStudentsByLoginClass(studentList, "A3").length > 0;

  if (a2HasStudents) {
    selectedStudentLoginClass = "A2";
    studentLoginClassInitialized = true;
    return;
  }

  if (a3HasStudents) {
    selectedStudentLoginClass = "A3";
    studentLoginClassInitialized = true;
  }
}

function filterStudentsByLoginClass(studentList, className = selectedStudentLoginClass) {
  const filtered = (studentList || []).filter((student) => getStudentLoginClass(student) === className);
  if (filtered.length || hasA2OrA3Student(studentList)) {
    return filtered;
  }
  return ALLOW_MOCK_MODE ? studentList : filtered;
}

function hasA2OrA3Student(studentList) {
  return (studentList || []).some((student) => ["A2", "A3"].includes(getStudentLoginClass(student)));
}

function getStudentLoginClass(student) {
  const rawClass = String((student && (student.kelas || student.className || student.class || student.kelas_pelajar)) || "")
    .trim()
    .toUpperCase();
  const match = rawClass.match(/\bA[23]\b/);
  return match ? match[0] : rawClass;
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
    console.warn("Rekod pelajar bukan objek.");
    return null;
  }

  const id = String(row.student_id || row.id || "").trim();
  const name = String(row.nama || row.name || "").trim();
  const className = String(row.kelas || row.className || row.class || "").trim();

  if (!id || !name || !className) {
    console.warn("Rekod pelajar tidak lengkap.");
    return null;
  }

  return {
    id,
    student_id: id,
    name,
    nama: name,
    className,
    kelas: className
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

  console.warn(`Respons ${label} bukan array.`);
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
    els.studentLoginMessage.textContent = "Gagal memuatkan data dari Google Sheets. Sila tekan Cuba Lagi.";
  }

  const button = ensureStudentRetryButton();
  if (button) {
    button.hidden = false;
    button.disabled = false;
  }
}

function clearStudentLoadFailurePanel() {
  if (els.studentLoginMessage && els.studentLoginMessage.textContent.indexOf("Gagal memuatkan") !== -1) {
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
  setupRefreshPageTrackingV152();
};

function setupRefreshPageTrackingV152() {
  if (document.body && document.body.dataset.refreshPageTrackingV152 === "1") {
    return;
  }

  if (document.body) {
    document.body.dataset.refreshPageTrackingV152 = "1";
  }

  document.querySelectorAll("[data-role-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const role = button.dataset.roleChoice;
      if (role === "monitor") {
        setActiveRefreshPageV152("monitoring");
        return;
      }
      if (role === "stats") {
        setActiveRefreshPageV152("statistics");
        return;
      }
      setActiveRefreshPageV152(role === "student" ? "student" : role || "access");
    });
  });

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveRefreshPageV152(button.dataset.tab === "pelajar" ? "student" : button.dataset.tab || "access");
    });
  });

  if (els.monitorBackButton) {
    els.monitorBackButton.addEventListener("click", () => setActiveRefreshPageV152("access"));
  }

  if (els.statsBackButton) {
    els.statsBackButton.addEventListener("click", () => setActiveRefreshPageV152("access"));
  }
}

function setActiveRefreshPageV152(page) {
  activeRefreshPage = page || "access";
  try {
    if (document.body) {
      document.body.dataset.activeRefreshPage = activeRefreshPage;
    }
  } catch (error) {
    console.warn("Status halaman aktif tidak dapat disimpan.", error);
  }
}

function getActiveRefreshPageV152() {
  if (isWorkspaceActive(els.monitorWorkspace)) {
    return "monitoring";
  }

  if (isWorkspaceActive(els.statsWorkspace)) {
    return "statistics";
  }

  if (isWorkspaceActive(els.appWorkspace)) {
    const activeTab = document.querySelector("#appWorkspace .tab-button.active");
    if (activeTab && activeTab.dataset.tab) {
      return activeTab.dataset.tab === "pelajar" ? "student" : activeTab.dataset.tab;
    }

    if (currentSession && currentSession.role) {
      return currentSession.role === "student" ? "student" : currentSession.role;
    }
  }

  return activeRefreshPage || (document.body && document.body.dataset.activeRefreshPage) || "access";
}

function isValidStudentSessionV152() {
  return Boolean(currentSession && currentSession.role === "student" && currentSession.user);
}

async function refreshActiveMonitoringPageV152() {
  setActiveRefreshPageV152("monitoring");
  showMonitoringPageV152();

  try {
    if (els.monitorRecordsList) {
      els.monitorRecordsList.innerHTML = emptyState("Memuatkan rekod pemantauan...");
    }
    if (els.monitorSummary) {
      els.monitorSummary.innerHTML = emptyState("Memuatkan ringkasan...");
    }
  } catch (error) {
    console.warn("Paparan loading pemantauan gagal dikemas kini.", error);
  }

  await refreshMonitoringRecords();
  showMonitoringPageV152();
}

async function refreshActiveStatisticsPageV152() {
  setActiveRefreshPageV152("statistics");
  showStatisticsPageV152();

  try {
    if (els.statsSummary) {
      els.statsSummary.innerHTML = emptyState("Memuatkan statistik...");
    }
    if (els.statsLeaderboard) {
      els.statsLeaderboard.innerHTML = emptyState("Memuatkan statistik...");
    }
    if (els.statsClassSummary) {
      els.statsClassSummary.innerHTML = emptyState("Memuatkan ringkasan kelas...");
    }
    if (els.statsStatusSummary) {
      els.statsStatusSummary.innerHTML = emptyState("Memuatkan pecahan status...");
    }
  } catch (error) {
    console.warn("Paparan loading statistik gagal dikemas kini.", error);
  }

  await loadStatistics();
  showStatisticsPageV152();
}

async function refreshStudentLoginStateV152() {
  setActiveRefreshPageV152("student");
  showStudentLoginPageV152();
  await refreshAccessScreenMasters();
}

function showMonitoringPageV152() {
  try {
    if (els.accessScreen) els.accessScreen.classList.add("hidden");
    if (els.appWorkspace) els.appWorkspace.classList.remove("active");
    if (els.statsWorkspace) els.statsWorkspace.classList.remove("active");
    if (els.monitorWorkspace) els.monitorWorkspace.classList.add("active");
  } catch (error) {
    console.warn("Paparan Pemantauan Semasa tidak dapat dikekalkan.", error);
  }
}

function showStatisticsPageV152() {
  try {
    if (els.accessScreen) els.accessScreen.classList.add("hidden");
    if (els.appWorkspace) els.appWorkspace.classList.remove("active");
    if (els.monitorWorkspace) els.monitorWorkspace.classList.remove("active");
    activateStatisticsWorkspaceV200();
  } catch (error) {
    console.warn("Paparan Statistik tidak dapat dikekalkan.", error);
  }
}

function showStudentLoginPageV152() {
  try {
    if (els.appWorkspace) els.appWorkspace.classList.remove("active");
    if (els.monitorWorkspace) els.monitorWorkspace.classList.remove("active");
    if (els.statsWorkspace) els.statsWorkspace.classList.remove("active");
    if (els.accessScreen) els.accessScreen.classList.remove("hidden");
    hideLoginPanels();
    if (els.studentLoginPanel) els.studentLoginPanel.classList.add("active");
  } catch (error) {
    console.warn("Paparan log masuk pelajar tidak dapat dipulihkan.", error);
  }
}

function isWorkspaceActive(workspace) {
  return Boolean(workspace && workspace.classList && workspace.classList.contains("active"));
}

function isValidActiveSession() {
  return Boolean(
    currentSession &&
    currentSession.role &&
    currentSession.user &&
    (currentSession.user.name || currentSession.user.nama || currentSession.user.nama_warden || currentSession.user.nama_guard)
  );
}

async function refreshActiveStudentSession() {
  showSignedInTab("pelajar");

  try {
    if (els.studentRecordsList) {
      els.studentRecordsList.innerHTML = emptyState("Memuatkan rekod pelajar...");
    }
  } catch (error) {
    console.warn("Paparan loading pelajar gagal dikemas kini.", error);
  }

  const tasks = [loadTodayRecords()];
  if (isLiveMode) {
    tasks.push(loadLiveMasters());
  }

  const results = await Promise.allSettled(tasks);
  const failed = results.filter((result) => result.status === "rejected");
  if (failed.length === results.length) {
    throw failed[0].reason || new Error("Data pelajar gagal dimuat semula.");
  }

  showSignedInTab("pelajar");
  if (typeof render === "function") {
    render();
  }
}

async function refreshSignedInWorkspace() {
  const activeTab = document.querySelector(".tab-button.active");
  const tabName = activeTab ? activeTab.dataset.tab : (currentSession && currentSession.role) || "dashboard";

  showSignedInTab(tabName);
  await loadTodayRecords();
  showSignedInTab(tabName);
}

async function refreshAccessScreenMasters() {
  try {
    setStudentDropdownState("loading");
  } catch (error) {
    console.warn("Paparan loading senarai pelajar gagal dikemas kini.", error);
  }

  try {
    await loadLiveMasters();
  } catch (error) {
    console.error("Gagal memuatkan semula data log masuk.", error);
    try {
      setStudentDropdownState("failed");
      showStudentLoadFailurePanel();
    } catch (uiError) {
      console.warn("Paparan gagal muat senarai pelajar tidak dapat dikemas kini.", uiError);
    }
    throw error;
  }
}

function showSignedInTab(tabName) {
  try {
    if (els.accessScreen) {
      els.accessScreen.classList.add("hidden");
    }

    if (els.appWorkspace) {
      els.appWorkspace.classList.add("active");
    }

    if (els.monitorWorkspace) {
      els.monitorWorkspace.classList.remove("active");
    }

    if (els.statsWorkspace) {
      els.statsWorkspace.classList.remove("active");
    }

    document.querySelectorAll(".tab-button").forEach((button) => {
      button.classList.toggle("active", button.dataset.tab === tabName);
    });

    document.querySelectorAll("#appWorkspace .tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === tabName);
    });
    updateFooterActionsVisibility();
  } catch (error) {
    console.warn("Paparan semasa tidak dapat dikekalkan sepenuhnya.", error);
  }
}

function showStaffDashboardLoading(role) {
  showStaffDashboardTab(role);

  if (role === "warden") {
    const message = "Memuatkan senarai permohonan...";
    if (els.wardenList) els.wardenList.innerHTML = emptyState(message);
    if (els.wardenApprovedList) els.wardenApprovedList.innerHTML = emptyState(message);
    return;
  }

  if (role === "guard") {
    const message = "Memuatkan rekod keluar masuk...";
    if (els.guardApprovedList) els.guardApprovedList.innerHTML = emptyState(message);
    if (els.guardOutList) els.guardOutList.innerHTML = emptyState(message);
  }
}

function showStaffDashboardTab(role) {
  const targetTab = role === "guard" ? "guard" : "warden";

  if (els.accessScreen) {
    els.accessScreen.classList.add("hidden");
  }

  if (els.appWorkspace) {
    els.appWorkspace.classList.add("active");
  }

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === targetTab);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === targetTab);
  });
  updateFooterActionsVisibility();
}

const renderOriginalV15 = render;
render = function renderWithOperationalMonitoring() {
  renderOriginalV15();
  enhanceOperationalMonitoringV15();
};

const refreshMonitoringRecordsOriginalV15 = typeof refreshMonitoringRecords === "function" ? refreshMonitoringRecords : null;
if (refreshMonitoringRecordsOriginalV15) {
  refreshMonitoringRecords = async function refreshMonitoringRecordsWithOperationalMonitoring() {
    await refreshMonitoringRecordsOriginalV15();
    enhanceOperationalMonitoringV15();
  };
}

function enhanceOperationalMonitoringV15() {
  ensureOvernightMonitoringSectionsV15();
  renderOvernightNotReturnedSectionsV15();
  ensureQuickFiltersV15();
  ensureCsvExportButtonsV15();
  ensureReleaseNotesV15();
  updateFooterActionsVisibility();
}

const QUICK_FILTERS_V15 = [
  ["all", "Semua"],
  ["normal", "Outing Harian"],
  ["overnight", "Pulang Bermalam"],
  ["semester", "Cuti Semester"],
  ["pending", "Menunggu Kelulusan"],
  ["out", "Sedang Keluar"],
  ["late", "Lewat"],
  ["done", "Selesai Hari Ini"]
];

const GUARD_QUICK_FILTERS_V15 = [
  ["all", "Semua"],
  ["normal", "Outing Harian"],
  ["overnight", "Pulang Bermalam"],
  ["semester", "Cuti Semester"],
  ["emergency", "Kecemasan"],
  ["late", "Lewat"]
];

const GUARD_FILTER_EMPTY_MESSAGES_V15 = {
  approved: {
    all: "Tiada pelajar yang telah diluluskan untuk keluar.",
    normal: "Tiada rekod Outing Harian yang sedia untuk keluar.",
    overnight: "Tiada rekod Pulang Bermalam yang sedia untuk keluar.",
    semester: "Tiada rekod Cuti Semester yang sedia untuk keluar.",
    emergency: "Tiada rekod Kecemasan yang sedia untuk keluar.",
    late: "Tiada rekod lewat yang sedia untuk keluar."
  },
  out: {
    all: "Tiada pelajar sedang keluar.",
    normal: "Tiada rekod Outing Harian yang sedang keluar.",
    overnight: "Tiada rekod Pulang Bermalam yang sedang bermalam.",
    semester: "Tiada rekod Cuti Semester yang sedang bercuti.",
    emergency: "Tiada rekod Kecemasan yang sedang keluar.",
    late: "Tiada pelajar lewat pulang ke asrama."
  }
};

function guardFilterEmptyMessageV15(container, filterValue) {
  const section = container === els.guardApprovedList ? "approved" : "out";
  return GUARD_FILTER_EMPTY_MESSAGES_V15[section][filterValue] || "Tiada rekod untuk filter ini.";
}

function ensureQuickFiltersV15() {
  ensureQuickFilterGroupV15("warden", [els.wardenList, els.wardenApprovedList], els.wardenList, QUICK_FILTERS_V15, "Tiada permohonan menunggu tindakan.");
  const guardOvernightList = document.querySelector("#guardOvernightNotReturnedSection [data-overnight-not-returned-list]");
  ensureQuickFilterGroupV15(
    "guard",
    [els.guardApprovedList, els.guardOutList, guardOvernightList],
    els.guardApprovedList,
    GUARD_QUICK_FILTERS_V15,
    guardFilterEmptyMessageV15
  );
}

function ensureQuickFilterGroupV15(scope, containers, anchor, filters, emptyMessage) {
  if (!anchor) {
    return;
  }

  const existingGroup = document.querySelector(`[data-filter-scope="${scope}"]`);
  if (existingGroup) {
    const activeButton = existingGroup.querySelector(".quick-filter-button.active");
    applyQuickFilterV15(containers, activeButton ? activeButton.dataset.filterValue : "all", emptyMessage);
    return;
  }

  const group = document.createElement("div");
  group.className = "quick-filter-bar";
  group.dataset.filterScope = scope;
  group.innerHTML = filters.map(([value, label], index) => (
    `<button class="quick-filter-button${index === 0 ? " active" : ""}" type="button" data-filter-value="${value}">${label}</button>`
  )).join("");
  anchor.parentNode.insertBefore(group, anchor);
  group.querySelectorAll("[data-filter-value]").forEach((button) => {
    button.addEventListener("click", () => {
      group.querySelectorAll("[data-filter-value]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      applyQuickFilterV15(containers, button.dataset.filterValue, emptyMessage);
    });
  });
}

function applyQuickFilterV15(containers, filterValue, emptyMessage) {
  containers.filter(Boolean).forEach((container) => {
    const cards = Array.from(container.querySelectorAll('[data-record-card="1"]'));
    const generatedEmpty = container.querySelector("[data-filter-empty='1']");
    if (generatedEmpty) generatedEmpty.remove();
    const contextualEmptyMessage = typeof emptyMessage === "function"
      ? emptyMessage(container, filterValue)
      : emptyMessage || "Tiada rekod untuk filter ini.";
    if (!cards.length) {
      const empty = container.querySelector(".empty-state") || document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = contextualEmptyMessage;
      if (!empty.parentNode) container.appendChild(empty);
      return;
    }

    let visibleCount = 0;
    cards.forEach((card) => {
      const key = `filter${capitalizeFilterKeyV15(filterValue)}`;
      const visible = filterValue === "all" || card.dataset[key] === "1";
      card.hidden = !visible;
      if (visible) visibleCount += 1;
    });

    if (visibleCount === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.dataset.filterEmpty = "1";
      empty.textContent = contextualEmptyMessage;
      container.appendChild(empty);
    }
  });
}

function capitalizeFilterKeyV15(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function ensureOvernightMonitoringSectionsV15() {
  ensureOvernightSectionV15("guardOvernightNotReturnedSection", "Masuk · Belum Pulang Ke Asrama", els.guardOutList);
}

function ensureOvernightSectionV15(id, title, anchor) {
  if (!anchor || document.querySelector(`#${id}`)) return;
  const section = document.createElement("section");
  section.className = "operational-section";
  section.id = id;
  section.innerHTML = `
    <h3 class="list-title guard-list-title guard-list-title-in">${escapeHtml(title)}</h3>
    <p class="guard-list-hint">Keutamaan pemantauan untuk Pulang Bermalam dan Cuti Semester.</p>
    <div class="record-list" data-overnight-not-returned-list="1"></div>
  `;
  anchor.parentNode.insertBefore(section, anchor.nextSibling);
}

function renderOvernightNotReturnedSectionsV15() {
  renderOvernightListV15("#guardOvernightNotReturnedSection [data-overnight-not-returned-list]", "guard-in");
}

function renderOvernightListV15(selector, mode) {
  const list = document.querySelector(selector);
  if (!list) return;
  const records = uniqueRecordsByRequestId(outingRecords.filter(isOvernightNotReturnedV15));
  list.innerHTML = records.length
    ? records.map((record) => recordCard(record, mode)).join("")
    : emptyState("Tiada rekod Pulang Bermalam yang belum pulang.");
  list.querySelectorAll("[data-in]").forEach((button) => {
    button.addEventListener("click", () => confirmIn(button.dataset.in, button));
  });
}

function isOvernightNotReturnedV15(record) {
  return record &&
    record.status === STATUS.out &&
    (record.jenis_permohonan === REQUEST_TYPE.overnight || record.jenis_permohonan === REQUEST_TYPE.semester) &&
    Boolean(record.outAt || record.masa_keluar) &&
    !record.returnedAt &&
    !record.masa_masuk;
}

function ensureCsvExportButtonsV15() {
  const footer = document.querySelector(".app-footer");
  if (!footer) return;
  if (document.querySelector("#exportTodayCsvButton")) {
    updateFooterActionsVisibility();
    return;
  }
  const todayButton = document.createElement("button");
  todayButton.id = "exportTodayCsvButton";
  todayButton.className = "system-refresh-button";
  todayButton.type = "button";
  todayButton.textContent = "Muat Turun Laporan Hari Ini";
  todayButton.addEventListener("click", () => exportRecordsCsvV15("today"));
  const monthButton = document.createElement("button");
  monthButton.id = "exportMonthCsvButton";
  monthButton.className = "system-refresh-button";
  monthButton.type = "button";
  monthButton.textContent = "Muat Turun Laporan Bulanan";
  monthButton.addEventListener("click", () => exportRecordsCsvV15("month"));
  footer.appendChild(todayButton);
  footer.appendChild(monthButton);
  updateFooterActionsVisibility();
}

function exportRecordsCsvV15(scope) {
  try {
    const now = new Date();
    const parts = getKualaLumpurParts(now);
    const todayKey = `${parts.year}-${parts.month}-${parts.day}`;
    const monthKey = `${parts.year}-${parts.month}`;
    const records = outingRecords.filter((record) => {
      const recordDate = normalizeRecordDateKeyV15(record.tarikh || record.requestedAt || record.masa_mohon);
      return scope === "month" ? recordDate.indexOf(monthKey) === 0 : recordDate === todayKey;
    });
    if (!records.length) {
      showWarning("Tiada rekod untuk dimuat turun.");
      return;
    }
    downloadCsvV15(recordsToCsvV15(records), `eouting-${scope}-${scope === "month" ? monthKey : todayKey}.csv`);
  } catch (error) {
    console.error("CSV export gagal.", error);
    showError("Laporan CSV gagal dimuat turun.", "Export Gagal");
  }
}

function normalizeRecordDateKeyV15(value) {
  const date = parseFlexibleDate(value);
  if (!date) return "";
  const parts = getKualaLumpurParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function recordsToCsvV15(records) {
  const columns = ["request_id", "tarikh", "hari", "jenis_permohonan", "no_matrik", "nama", "kelas", "tujuan", "lokasi", "telefon_waris", "status", "masa_mohon", "masa_approve", "masa_keluar", "masa_masuk", "lewat", "tarikh_balik", "hari_balik", "masa_balik_dijangka", "catatan"];
  const rows = records.map((record) => columns.map((column) => csvEscapeV15(recordCsvValueV15(record, column))).join(","));
  return [columns.join(","), ...rows].join("\r\n");
}

function recordCsvValueV15(record, column) {
  const aliases = {
    request_id: record.request_id || record.id,
    nama: record.nama || record.studentName,
    kelas: record.kelas || record.className,
    tujuan: record.tujuan || record.purpose,
    lokasi: record.lokasi || record.location,
    masa_mohon: record.masa_mohon || record.requestedAt,
    masa_approve: record.masa_approve || record.approvedAt || record.rejectedAt,
    masa_keluar: record.masa_keluar || record.outAt,
    masa_masuk: record.masa_masuk || record.returnedAt
  };
  return aliases[column] !== undefined ? aliases[column] : record[column];
}

function csvEscapeV15(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsvV15(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ensureReleaseNotesV15() {
  const footer = document.querySelector(".app-footer");
  if (!footer) return;
  if (document.querySelector("#releaseNotesButton")) {
    updateFooterActionsVisibility();
    return;
  }
  const button = document.createElement("button");
  button.id = "releaseNotesButton";
  button.className = "system-refresh-button";
  button.type = "button";
  button.textContent = `Apa yang baharu v${APP_VERSION}`;
  button.addEventListener("click", toggleReleaseNotesV15);
  footer.appendChild(button);
  updateFooterActionsVisibility();
}

function toggleReleaseNotesV15() {
  let panel = document.querySelector("#releaseNotesPanel");
  if (!panel) {
    panel = document.createElement("section");
    panel.id = "releaseNotesPanel";
    panel.className = "release-notes-panel";
    panel.innerHTML = `
      <h3>Apa yang baharu v${APP_VERSION}</h3>
      <ul>
        <li>Bukti selfie pulang asrama untuk semua jenis permohonan</li>
        <li>Kamera depan dan preview gambar sebelum dihantar</li>
        <li>Gambar disimpan ke Google Drive</li>
        <li>Bukti gambar dihantar ke Telegram</li>
        <li>Status bukti dipaparkan kepada pelajar</li>
      </ul>
      <h3>Sejarah v1.6.26</h3>
      <ul>
        <li>Hapus kad dan butang Sahkan Masuk berganda pada dashboard Guard</li>
        <li>Asingkan Pulang Bermalam dan Cuti Semester ke bahagian Belum Pulang Ke Asrama</li>
        <li>Selaraskan quick filter Guard selepas refresh dan auto-refresh</li>
      </ul>
      <h3>Sejarah v1.6.6</h3>
      <ul>
        <li>Pulang Bermalam monitoring</li>
        <li>Belum Pulang / Lewat Pulang Ke Asrama</li>
        <li>Quick filters</li>
        <li>Catatan Guard semasa masuk</li>
        <li>Export CSV</li>
        <li>Audit log</li>
        <li>Hubungi Waris</li>
        <li>Hotfix refresh kekal pada paparan aktif</li>
        <li>Hotfix Pelajar, Pemantauan Semasa dan Statistik refresh in-place</li>
        <li>Sokongan permohonan Cuti Semester</li>
        <li>Pemantauan Cuti Semester / Belum Pulang Ke Asrama</li>
        <li>Hotfix butang hantar pelajar tidak lagi gagal semasa render</li>
        <li>Hotfix paparan medan Cuti Semester pada borang pelajar</li>
        <li>Hotfix medan waris dan tarikh Cuti Semester dipaparkan dengan betul</li>
        <li>Refactor kawalan medan borang mengikut jenis permohonan</li>
        <li>Hotfix format masa pulang Cuti Semester pada kad rekod</li>
        <li>Kemas paparan butang utiliti bawah untuk Warden sahaja</li>
        <li>Loading and refresh improvements from v1.4.x</li>
      </ul>
    `;
    const footer = document.querySelector(".app-footer");
    footer.parentNode.insertBefore(panel, footer);
    panel.hidden = true;
  }
  panel.hidden = !panel.hidden;
}

const recordCardOriginalV160 = recordCard;
recordCard = function recordCardWithSemesterSupport(record, mode) {
  let html = recordCardOriginalV160(record, mode);
  html = sanitizeReturnTimeHtmlV165(html, record);
  if (!record || record.jenis_permohonan !== REQUEST_TYPE.semester || mode === "guard-in" || mode === "guard-out") {
    return html;
  }

  html = html.replace('data-record-card="1"', 'data-record-card="1" data-filter-semester="1"');
  const details = `
    <div class="record-meta semester-return-meta">
      <span class="status-badge">Cuti Semester</span>
      <span>Tarikh Keluar: ${escapeHtml(formatDisplayDateV160(record.tarikh || record.requestedAt || record.masa_mohon))}</span>
      <span>Tarikh Pulang Ke Asrama: ${escapeHtml(formatDisplayDateV160(record.tarikh_balik))}</span>
      <span>Masa Dijangka Pulang Ke Asrama: ${escapeHtml(formatDisplayTimeV165(record.masa_balik_dijangka))}</span>
      <span>Pulang ke asrama dijangka: ${escapeHtml(formatExpectedReturnV160(record))}</span>
      ${record.telefon_waris ? `<span>Hubungi Waris: ${escapeHtml(record.telefon_waris)}</span>` : ""}
      ${isHostelReturnLateV160(record) ? '<span class="status-badge rejected">Lewat Pulang Ke Asrama</span>' : ""}
    </div>
  `;
  const articleCloseIndex = html.lastIndexOf("</article>");
  if (articleCloseIndex !== -1) {
    return html.slice(0, articleCloseIndex) + details + html.slice(articleCloseIndex);
  }

  const divCloseIndex = html.lastIndexOf("</div>");
  return divCloseIndex === -1 ? html + details : html.slice(0, divCloseIndex) + details + html.slice(divCloseIndex);
};

function sanitizeReturnTimeHtmlV165(html, record) {
  if (!html || !record || !record.masa_balik_dijangka) {
    return html;
  }

  const rawTime = String(record.masa_balik_dijangka);
  const displayTime = formatDisplayTimeV165(record.masa_balik_dijangka);
  return html
    .replaceAll(escapeHtml(rawTime), escapeHtml(displayTime))
    .replaceAll(rawTime, displayTime);
}

function updateFooterActionsVisibility() {
  const activeTab = document.querySelector("#appWorkspace .tab-button.active");
  const isWardenScreen = Boolean(
    currentSession &&
    currentSession.role === "warden" &&
    els.appWorkspace &&
    els.appWorkspace.classList.contains("active") &&
    activeTab &&
    activeTab.dataset.tab === "warden"
  );

  [
    document.querySelector("#exportTodayCsvButton"),
    document.querySelector("#exportMonthCsvButton"),
    document.querySelector("#releaseNotesButton")
  ].filter(Boolean).forEach((button) => {
    button.hidden = !isWardenScreen;
    button.style.display = isWardenScreen ? "" : "none";
  });
}

function setupFooterActionsVisibilityV166() {
  document.addEventListener("click", () => {
    window.setTimeout(updateFooterActionsVisibility, 0);
  }, true);
  updateFooterActionsVisibility();
}

function setupSemesterRequestV160() {
  ensureSemesterOptionV160();
  ensureSemesterLeaveDateFieldV160();
  updateSemesterFieldsV160();
  setupStudentSubmitStateHandlersV161();
  setupSemesterUiRepairV162();

  if (els.requestTypeSelect) {
    els.requestTypeSelect.addEventListener("change", handleRequestTypeChangeV164, true);
    els.requestTypeSelect.addEventListener("change", () => {
      window.setTimeout(() => {
        updateRequestTypeFields();
        updateStudentSubmitState();
      }, 0);
      updateRequestTypeFields();
      updateStudentSubmitState();
    });
  }

  if (els.requestForm && els.requestForm.dataset.semesterHandlerV160 !== "1") {
    els.requestForm.dataset.semesterHandlerV160 = "1";
    els.requestForm.addEventListener("submit", submitSemesterRequestV160, true);
  }
}

function handleRequestTypeChangeV164(event) {
  if (event) {
    event.stopImmediatePropagation();
  }

  updateRequestTypeFields();
  updateStudentSubmitState();
  if (els.studentMessage) {
    els.studentMessage.textContent = "";
  }
}

function setupSemesterUiRepairV162() {
  if (!els.requestForm || els.requestForm.dataset.semesterUiRepairV162 === "1") {
    return;
  }

  els.requestForm.dataset.semesterUiRepairV162 = "1";
  els.requestForm.addEventListener("input", () => {
    updateSemesterFieldsV160();
    updateStudentSubmitState();
  });
  els.requestForm.addEventListener("change", () => {
    updateSemesterFieldsV160();
    updateStudentSubmitState();
  });
}

function setupStudentSubmitStateHandlersV161() {
  if (!els.requestForm || els.requestForm.dataset.submitStateV161 === "1") {
    return;
  }

  els.requestForm.dataset.submitStateV161 = "1";
  els.requestForm.addEventListener("input", updateStudentSubmitState);
  els.requestForm.addEventListener("change", updateStudentSubmitState);
}

function ensureSemesterOptionV160() {
  if (!els.requestTypeSelect || els.requestTypeSelect.querySelector(`option[value="${REQUEST_TYPE.semester}"]`)) {
    return;
  }

  const option = document.createElement("option");
  option.value = REQUEST_TYPE.semester;
  option.textContent = "Cuti Semester";
  els.requestTypeSelect.appendChild(option);
}

function ensureSemesterLeaveDateFieldV160() {
  if (els.leaveDateInput || !els.overnightFields || !els.returnDateInput) {
    return;
  }

  const label = document.createElement("label");
  label.setAttribute("for", "leaveDateInput");
  label.dataset.semesterOnly = "1";
  label.textContent = "Tarikh Keluar / Tarikh Mula Cuti";
  const input = document.createElement("input");
  input.id = "leaveDateInput";
  input.type = "date";
  input.dataset.semesterOnly = "1";
  els.overnightFields.insertBefore(label, els.returnDateInput.previousElementSibling || els.returnDateInput);
  els.overnightFields.insertBefore(input, els.returnDateInput.previousElementSibling || els.returnDateInput);
  els.leaveDateInput = input;
}

function updateLegacyRequestTypeFieldsV164() {
  const requestType = els.requestTypeSelect ? els.requestTypeSelect.value : "";
  const isNormal = requestType === REQUEST_TYPE.normal;
  const isWeekend = requestType === REQUEST_TYPE.weekend;
  const isEmergency = requestType === REQUEST_TYPE.emergency;
  const isOvernight = requestType === REQUEST_TYPE.overnight;
  const isSemester = requestType === REQUEST_TYPE.semester;
  const purposeLabel = els.purposeInput ? document.querySelector(`label[for="${els.purposeInput.id}"]`) : null;
  const locationLabel = els.locationInput ? document.querySelector(`label[for="${els.locationInput.id}"]`) : null;

  setSectionVisibleV164(
  els.overnightFields,
  isWeekend || isOvernight || isSemester
);

setSectionVisibleV164(
  els.emergencyFields,
  isEmergency || isOvernight || isSemester
);

setFieldAndLabelHiddenV160(
  els.leaveDateInput,
  !(isWeekend || isSemester)
);

setFieldAndLabelHiddenV160(
  els.returnDateInput,
  !(isOvernight || isSemester)
);

setFieldAndLabelHiddenV160(
  els.expectedReturnTimeInput,
  !(isWeekend || isOvernight || isSemester)
);
  setFieldAndLabelHiddenV160(els.emergencyReasonInput, !isEmergency);
  setFieldAndLabelHiddenV160(els.guardianPhoneInput, !(isEmergency || isOvernight || isSemester));
  setFieldAndLabelHiddenV160(els.guardianRelationSelect, !(isEmergency || isOvernight || isSemester));
  setFieldAndLabelHiddenV160(els.emergencyNoteInput, !(isEmergency || isSemester));

const overnightTitle = els.overnightFields
  ? els.overnightFields.querySelector("h3")
  : null;

const emergencyTitle = els.emergencyFields
  ? els.emergencyFields.querySelector("h3")
  : null;

if (els.leaveDateInput) {
  els.leaveDateInput.required = false;
}

if (els.expectedReturnTimeInput) {
  els.expectedReturnTimeInput.required = false;
  els.expectedReturnTimeInput.readOnly = false;
}

if (isWeekend) {
  if (overnightTitle) {
    overnightTitle.textContent = "Maklumat Outing Sabtu / Ahad";
  }

  if (purposeLabel) {
    purposeLabel.textContent = "Tujuan Outing";
  }

  if (locationLabel) {
    locationLabel.textContent = "Lokasi Outing";
  }

  setLabelTextV163(
    els.leaveDateInput,
    "Tarikh Outing Sabtu / Ahad"
  );

  setLabelTextV163(
    els.expectedReturnTimeInput,
    "Wajib Pulang Sebelum / Pada"
  );

  if (els.leaveDateInput) {
    els.leaveDateInput.required = true;
  }

  if (els.returnDateInput) {
    els.returnDateInput.required = false;
    els.returnDateInput.value = els.leaveDateInput
      ? els.leaveDateInput.value
      : "";
  }

  if (els.expectedReturnTimeInput) {
    els.expectedReturnTimeInput.required = true;
    els.expectedReturnTimeInput.value = "22:00";
    els.expectedReturnTimeInput.readOnly = true;
  }

  if (els.locationInput) {
    els.locationInput.placeholder = "Contoh: Pekan Merlimau";
  }

  return;
}

if (isSemester) {
    if (overnightTitle) overnightTitle.textContent = "Maklumat Cuti Semester";
    if (emergencyTitle) emergencyTitle.textContent = "Maklumat Waris / Cuti Semester";
    if (purposeLabel) purposeLabel.textContent = "Tujuan Cuti Semester";
    if (locationLabel) locationLabel.textContent = "Alamat / Destinasi Semasa Cuti";
    setLabelTextV163(els.leaveDateInput, "Tarikh Keluar / Tarikh Mula Cuti");
    setLabelTextV163(els.returnDateInput, "Tarikh Pulang Ke Asrama");
    setLabelTextV163(els.expectedReturnTimeInput, "Masa Dijangka Pulang Ke Asrama");
    setLabelTextV163(els.guardianPhoneInput, "Telefon Waris");
    setLabelTextV163(els.guardianRelationSelect, "Hubungan Waris");
    setLabelTextV163(els.emergencyNoteInput, "Catatan");
    if (els.purposeInput && !els.purposeInput.value.trim()) {
      els.purposeInput.value = "Cuti Semester";
    }
    if (els.locationInput) {
      els.locationInput.placeholder = "Alamat / destinasi semasa cuti";
    }
    if (els.guardianPhoneInput) {
      els.guardianPhoneInput.placeholder = "No. telefon waris semasa cuti";
    }
    if (els.emergencyNoteInput) {
      els.emergencyNoteInput.placeholder = "Catatan cuti jika ada";
    }
    return;
  }

  if (isOvernight) {
    if (overnightTitle) overnightTitle.textContent = "Maklumat Pulang Bermalam";
    if (emergencyTitle) emergencyTitle.textContent = "Maklumat Waris";
    if (purposeLabel) purposeLabel.textContent = "Tujuan Pulang Bermalam";
    if (locationLabel) locationLabel.textContent = "Alamat / Destinasi Bermalam";
    setLabelTextV163(els.returnDateInput, "Tarikh Pulang Ke Asrama");
    setLabelTextV163(els.expectedReturnTimeInput, "Masa Dijangka Pulang Ke Asrama");
    setLabelTextV163(els.guardianPhoneInput, "Telefon Waris");
    setLabelTextV163(els.guardianRelationSelect, "Hubungan Waris");
    if (els.locationInput) {
      els.locationInput.placeholder = "Alamat / destinasi bermalam";
    }
    return;
  }

  if (isEmergency) {
    if (emergencyTitle) emergencyTitle.textContent = "Maklumat Kecemasan";
    if (purposeLabel) purposeLabel.textContent = "Tujuan Outing";
    if (locationLabel) locationLabel.textContent = "Lokasi Outing";
    setLabelTextV163(els.guardianPhoneInput, "No. Telefon Waris / Penjaga");
    setLabelTextV163(els.guardianRelationSelect, "Hubungan Waris");
    setLabelTextV163(els.emergencyNoteInput, "Catatan Kecemasan");
    if (els.locationInput) {
      els.locationInput.placeholder = "Contoh: Pekan Merlimau";
    }
    return;
  }

  if (isNormal || !requestType) {
    if (overnightTitle) overnightTitle.textContent = "Maklumat Pulang Bermalam";
    if (emergencyTitle) emergencyTitle.textContent = "Maklumat Kecemasan";
  }
  if (purposeLabel) purposeLabel.textContent = "Tujuan Outing";
  if (locationLabel) locationLabel.textContent = "Lokasi Outing";
  setLabelTextV163(els.guardianPhoneInput, "No. Telefon Waris / Penjaga");
  setLabelTextV163(els.guardianRelationSelect, "Hubungan Waris");
  setLabelTextV163(els.emergencyNoteInput, "Catatan Kecemasan");
  if (els.locationInput) {
    els.locationInput.placeholder = "Contoh: Pekan Merlimau";
  }
}

function updateRequestTypeFields() {
  updateLegacyRequestTypeFieldsV164();
  applyStudentOutingTypeConfigV200(getSelectedStudentOutingTypeConfigV200());
}

function updateSemesterFieldsV160() {
  updateRequestTypeFields();
}

function setSectionVisibleV164(section, visible) {
  if (!section) {
    return;
  }

  section.hidden = !visible;
  section.style.display = visible ? "grid" : "none";
  section.classList.toggle("active", visible);
  if (visible) {
    section.classList.remove("hidden", "is-hidden", "d-none");
  }
}

function setLabelTextV163(field, text) {
  if (!field || !text) {
    return;
  }

  const label = document.querySelector(`label[for="${field.id}"]`);
  if (label) {
    label.textContent = text;
  }
}

function setFieldAndLabelHiddenV160(field, hidden) {
  if (!field) {
    return;
  }
  field.hidden = hidden;
  field.style.display = hidden ? "none" : "";
  const label = document.querySelector(`label[for="${field.id}"]`);
  if (label) {
    label.hidden = hidden;
    label.style.display = hidden ? "none" : "";
  }
}

async function submitSemesterRequestV160(event) {
  if (!els.requestTypeSelect || els.requestTypeSelect.value !== REQUEST_TYPE.semester) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (studentRequestSubmissionInFlight) {
    return;
  }

  const message = validateSemesterRequestV160();
  if (message) {
    if (els.studentMessage) els.studentMessage.textContent = message;
    showError(message, "Permohonan Tidak Lengkap");
    return;
  }

  const student = getCurrentStudentV160();
  if (!student) {
    showError("Sesi pelajar tidak sah. Sila log masuk semula.", "Sesi Tamat");
    return;
  }

  setStudentRequestSubmitting(true, "Menghantar permohonan Cuti Semester...");

  try {
    const payload = buildSemesterPayloadV160(student);
    let savedRecord;
    if (isLiveMode) {
      savedRecord = await apiPost("submitRequest", payload);
      await loadTodayRecords();
    } else {
      savedRecord = createMockSemesterRecordV160(payload);
      outingRecords.unshift(savedRecord);
    }

    if (typeof render === "function") {
      render();
    }
    if (els.requestForm) {
      els.requestForm.reset();
    }
    if (els.studentMessage) els.studentMessage.textContent = "Permohonan Cuti Semester berjaya dihantar.";
    showSuccess("Permohonan Cuti Semester berjaya dihantar.", "Permohonan Dihantar");
    return savedRecord;
  } catch (error) {
    console.error("Permohonan Cuti Semester gagal.", error);
    const errorMessage = error.message || "Permohonan Cuti Semester gagal dihantar.";
    if (els.studentMessage) els.studentMessage.textContent = errorMessage;
    showError(errorMessage, "Permohonan Gagal");
  } finally {
    setStudentRequestSubmitting(false);
    updateSemesterFieldsV160();
  }
}

function validateSemesterRequestV160() {
  const leaveDate = els.leaveDateInput ? els.leaveDateInput.value : "";
  const returnDate = els.returnDateInput ? els.returnDateInput.value : "";
  const returnTime = els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : "";
  const location = els.locationInput ? els.locationInput.value.trim() : "";
  const guardianPhone = els.guardianPhoneInput ? els.guardianPhoneInput.value.trim() : "";
  const guardianRelation = els.guardianRelationSelect ? els.guardianRelationSelect.value.trim() : "";

  const config = getSelectedStudentOutingTypeConfigV200();
  const configMessage = config ? validateStudentOutingTypeConfigV200(config) : "";
  if (configMessage) return configMessage;
  if (!config && !returnDate) return "Tarikh Pulang Ke Asrama diperlukan.";
  if (!config && !returnTime) return "Masa Dijangka Pulang Ke Asrama diperlukan.";
  if (leaveDate && returnDate < leaveDate) return "Tarikh Pulang Ke Asrama tidak boleh lebih awal daripada tarikh keluar.";
  if (!config && !location) return "Alamat / destinasi semasa cuti diperlukan.";
  if (!config && !guardianPhone) return "Telefon waris diperlukan.";
  if (!config && !guardianRelation) return "Hubungan waris diperlukan.";
  return "";
}

function getCurrentStudentV160() {
  return currentSession && currentSession.role === "student" ? currentSession.user : null;
}

function buildSemesterPayloadV160(student) {
  const leaveDate = els.leaveDateInput.value;
  return {
    student_id: student.student_id || student.id || "",
    no_matrik: student.no_matrik || student.matric || "",
    jenis_permohonan: REQUEST_TYPE.semester,
    tarikh: leaveDate,
    hari: getDayNameFromDateKeyV160(leaveDate),
    tujuan: (els.purposeInput && els.purposeInput.value.trim()) || "Cuti Semester",
    lokasi: els.locationInput ? els.locationInput.value.trim() : "",
    jenis_kenderaan: els.vehicleTypeSelect ? els.vehicleTypeSelect.value : "",
    butiran_kenderaan: els.vehicleDetailInput ? els.vehicleDetailInput.value.trim() : "",
    telefon_waris: els.guardianPhoneInput ? els.guardianPhoneInput.value.trim() : "",
    hubungan_waris: els.guardianRelationSelect ? els.guardianRelationSelect.value : "",
    catatan: els.emergencyNoteInput ? els.emergencyNoteInput.value.trim() : "",
    tarikh_balik: els.returnDateInput ? els.returnDateInput.value : "",
    hari_balik: getDayNameFromDateKeyV160(els.returnDateInput ? els.returnDateInput.value : ""),
    masa_balik_dijangka: els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : ""
  };
}

function createMockSemesterRecordV160(payload) {
  const student = getCurrentStudentV160() || {};
  const now = new Date();
  const requestId = `MOCK-${Date.now()}-${nextRequestNumber++}`;
  return {
    ...payload,
    id: requestId,
    request_id: requestId,
    studentName: student.name || student.nama || "",
    nama: student.name || student.nama || "",
    className: student.className || student.kelas || "",
    kelas: student.className || student.kelas || "",
    requestedAt: now.toISOString(),
    masa_mohon: now.toISOString(),
    status: STATUS.pending,
    masa_keluar: "",
    masa_masuk: "",
    lewat: ""
  };
}

function getDayNameFromDateKeyV160(dateKey) {
  if (!dateKey) return "";
  const date = new Date(`${dateKey}T00:00:00+08:00`);
  if (isNaN(date.getTime())) return "";
  const days = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  return days[date.getDay()];
}

function formatDisplayDateV160(value) {
  const date = parseFlexibleDate(value);
  if (!date) return value || "-";
  const parts = getKualaLumpurParts(date);
  return `${parts.day}/${parts.month}/${parts.year}`;
}

function formatDisplayTimeV165(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return value.toLocaleTimeString("ms-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur"
    });
  }

  const text = String(value).trim();
  if (!text) {
    return "-";
  }

  const timeOnlyMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeOnlyMatch) {
    return `${timeOnlyMatch[1].padStart(2, "0")}:${timeOnlyMatch[2]}`;
  }

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleTimeString("ms-MY", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Kuala_Lumpur"
    });
  }

  return text;
}

function formatExpectedReturnV160(record) {
  const dateText = formatDisplayDateV160(record.tarikh_balik);
  const timeText = formatDisplayTimeV165(record.masa_balik_dijangka);
  return dateText === "-" && timeText === "-" ? "-" : `${dateText} ${timeText}`;
}

function isHostelReturnLateV160(record) {
  if (!record || (record.jenis_permohonan !== REQUEST_TYPE.overnight && record.jenis_permohonan !== REQUEST_TYPE.semester)) {
    return false;
  }

  const returnDate = normalizeRecordDateKeyV15(record.tarikh_balik);
  const returnTime = formatDisplayTimeV165(record.masa_balik_dijangka);
  if (!returnDate || !/^\d{2}:\d{2}$/.test(returnTime)) {
    return false;
  }

  const expected = new Date(`${returnDate}T${returnTime}:00+08:00`);
  return !isNaN(expected.getTime()) && Date.now() > expected.getTime() && !record.masa_masuk && !record.returnedAt;
}

function isStudentOutingTypeConfigReadyV200(config) {
  if (!config) return false;
  const requiredFields = [
    [config.require_leave_date, els.leaveDateInput],
    [config.require_return_date && !config.same_day_only, els.returnDateInput],
    [config.require_return_time, els.expectedReturnTimeInput],
    [config.require_guardian_phone, els.guardianPhoneInput],
    [config.require_guardian_relation, els.guardianRelationSelect],
    [config.require_emergency_reason, els.emergencyReasonInput],
    [config.require_purpose, els.purposeInput],
    [config.require_location, els.locationInput],
    [config.require_vehicle, els.vehicleTypeSelect]
  ];
  const fieldsReady = requiredFields.every(([required, field]) => (
    required !== true || Boolean(field && String(field.value || "").trim())
  ));
  if (!fieldsReady) return false;
  if (config.require_leave_date === true && config.allowed_days && els.leaveDateInput && els.leaveDateInput.value) {
    const allowedDays = String(config.allowed_days).split(",").map((day) => day.trim().toUpperCase());
    const selectedDay = getDayNameFromDateKeyV160(els.leaveDateInput.value).toUpperCase();
    if (allowedDays.length && !allowedDays.includes(selectedDay)) return false;
  }
  return true;
}

function validateStudentOutingTypeConfigV200(config) {
  if (isStudentOutingTypeConfigReadyV200(config)) return "";
  return "Sila lengkapkan semua maklumat wajib untuk jenis outing yang dipilih.";
}

function updateStudentSubmitState() {
  try {
    if (!els || !els.requestForm) {
      return;
    }

    const submitButton = els.requestForm.querySelector('button[type="submit"]');
    if (!submitButton) {
      return;
    }

    if (studentRequestSubmissionInFlight) {
      submitButton.disabled = true;
      return;
    }

    const hasStudentSession = Boolean(currentSession && currentSession.role === "student" && currentSession.user);
    const requestType = els.requestTypeSelect ? els.requestTypeSelect.value : "";
    updateRequestTypeFields();

    if (!hasStudentSession || !requestType) {
      submitButton.disabled = true;
      return;
    }

    const selectedConfig = getSelectedStudentOutingTypeConfigV200();
    if (selectedConfig) {
      submitButton.disabled = !isStudentOutingTypeConfigReadyV200(selectedConfig);
      return;
    }

    const purpose = els.purposeInput ? els.purposeInput.value.trim() : "";
    const location = els.locationInput ? els.locationInput.value.trim() : "";
    const vehicleType = els.vehicleTypeSelect ? els.vehicleTypeSelect.value : "";
    let isReady = Boolean(purpose && location && vehicleType);

    if (requestType === REQUEST_TYPE.emergency) {
      const emergencyReason = els.emergencyReasonInput
      ? els.emergencyReasonInput.value.trim()
      : "";

      isReady = isReady && Boolean(emergencyReason);
    }

    if (requestType === REQUEST_TYPE.weekend) {
  const leaveDate = els.leaveDateInput
    ? els.leaveDateInput.value
    : "";

  const selectedDate = leaveDate
    ? new Date(`${leaveDate}T12:00:00`)
    : null;

  const selectedDay = selectedDate
    ? selectedDate.getDay()
    : -1;

  const isWeekendDate = selectedDay === 0 || selectedDay === 6;

  isReady = isReady && Boolean(leaveDate && isWeekendDate);
}

    if (requestType === REQUEST_TYPE.overnight) {
      const returnDate = els.returnDateInput ? els.returnDateInput.value : "";
      const returnTime = els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : "";
      const guardianPhone = els.guardianPhoneInput ? els.guardianPhoneInput.value.trim() : "";
      const guardianRelation = els.guardianRelationSelect ? els.guardianRelationSelect.value.trim() : "";
      isReady = isReady && Boolean(returnDate && returnTime && guardianPhone && guardianRelation);
    }

    if (requestType === REQUEST_TYPE.semester) {
      const semesterState = getSemesterSubmitStateV162();
      isReady = semesterState.ready;
      if (!isReady) {
        console.warn("Cuti Semester submit disabled.", {
          requestType,
          missing: semesterState.missing,
          reason: semesterState.message
        });
      }
    }

    submitButton.disabled = !isReady;
  } catch (error) {
    console.warn("Status butang hantar pelajar tidak dapat dikemas kini.", error);
  }
}

function getSemesterSubmitStateV162() {
  const purpose = els.purposeInput ? els.purposeInput.value.trim() : "";
  const location = els.locationInput ? els.locationInput.value.trim() : "";
  const guardianPhone = els.guardianPhoneInput ? els.guardianPhoneInput.value.trim() : "";
  const guardianRelation = els.guardianRelationSelect ? els.guardianRelationSelect.value.trim() : "";
  const returnDate = els.returnDateInput ? els.returnDateInput.value : "";
  const returnTime = els.expectedReturnTimeInput ? els.expectedReturnTimeInput.value : "";
  const leaveDate = els.leaveDateInput ? els.leaveDateInput.value : "";
  const missing = [];

  if (!purpose) missing.push("tujuan");
  if (!location) missing.push("lokasi");
  if (!guardianPhone) missing.push("telefon_waris");
  if (!guardianRelation) missing.push("hubungan_waris");
  if (!returnDate) missing.push("tarikh_balik");
  if (!returnTime) missing.push("masa_balik_dijangka");
  if (leaveDate && returnDate && returnDate < leaveDate) missing.push("tarikh_balik_sebelum_tarikh_keluar");

  return {
    ready: missing.length === 0,
    missing,
    message: missing.length ? `Medan belum lengkap: ${missing.join(", ")}` : ""
  };
}

function resolveCurrentStudentSessionV161() {
  const candidates = [
    currentSession && currentSession.student,
    currentSession && currentSession.user,
    typeof currentStudent !== "undefined" ? currentStudent : null,
    typeof selectedStudent !== "undefined" ? selectedStudent : null
  ];

  const sessionStudent = candidates.find((candidate) => candidate && typeof candidate === "object") || null;
  const noMatrik = sessionStudent && (sessionStudent.no_matrik || sessionStudent.matric)
    ? (sessionStudent.no_matrik || sessionStudent.matric)
    : (currentSession && currentSession.no_matrik) || "";

  if (!sessionStudent && !noMatrik) {
    return null;
  }

  return {
    ...(sessionStudent || {}),
    id: (sessionStudent && (sessionStudent.id || sessionStudent.student_id)) || (currentSession && currentSession.student_id) || "",
    student_id: (sessionStudent && (sessionStudent.student_id || sessionStudent.id)) || (currentSession && currentSession.student_id) || "",
    name: (sessionStudent && (sessionStudent.name || sessionStudent.nama)) || (currentSession && currentSession.name) || "",
    nama: (sessionStudent && (sessionStudent.nama || sessionStudent.name)) || (currentSession && currentSession.nama) || "",
    no_matrik: noMatrik
  };
}

function isRecordForStudentV161(record, student) {
  if (!record || !student) {
    return false;
  }

  const recordMatric = String(record.no_matrik || record.matric || "").trim().toLowerCase();
  const studentMatric = String(student.no_matrik || student.matric || "").trim().toLowerCase();
  const recordId = String(record.student_id || record.studentId || "").trim().toLowerCase();
  const studentId = String(student.student_id || student.id || "").trim().toLowerCase();
  const recordName = String(record.nama || record.studentName || record.name || "").trim().toLowerCase();
  const studentName = String(student.nama || student.name || "").trim().toLowerCase();

  return Boolean(
    (recordMatric && studentMatric && recordMatric === studentMatric) ||
    (recordId && studentId && recordId === studentId) ||
    (recordName && studentName && recordName === studentName)
  );
}

function getStudentRecordsV161(student) {
  if (!Array.isArray(outingRecords) || !student) {
    return [];
  }

  return outingRecords.filter((record) => isRecordForStudentV161(record, student));
}

function ensureStudentRefreshEmptyStateV161(student) {
  if (!els.studentRecordsList) {
    return;
  }

  const records = getStudentRecordsV161(student);
  if (records.length > 0 || els.studentRecordsList.children.length > 0) {
    return;
  }

  els.studentRecordsList.innerHTML = emptyState("Tiada permohonan aktif.");
}

function updateStudentLastUpdatedV161() {
  studentLastUpdatedAt = new Date();
  if (els.studentLastUpdated) {
    const timeText = typeof formatTime === "function"
      ? formatTime(studentLastUpdatedAt)
      : studentLastUpdatedAt.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" });
    els.studentLastUpdated.textContent = `Dikemaskini ${timeText}`;
  }
}

async function safeRefreshStudentRecordsV161(source) {
  const student = resolveCurrentStudentSessionV161();
  if (!student) {
    console.warn("Refresh pelajar dibatalkan: sesi pelajar tidak ditemui.", { source, currentSession });
    showSignedInTab("pelajar");
    ensureStudentRefreshEmptyStateV161(null);
    updateStudentLastUpdatedV161();
    return { ok: true, skipped: true };
  }

  showSignedInTab("pelajar");

  try {
    if (els.studentRecordsList) {
      els.studentRecordsList.innerHTML = emptyState("Memuatkan rekod pelajar...");
    }
  } catch (error) {
    console.warn("Refresh pelajar: loading Rekod Saya gagal dipaparkan.", error);
  }

  try {
    console.warn("Refresh pelajar: mula reload rekod.", { source });

    if (typeof loadTodayRecords === "function") {
      await loadTodayRecords();
    } else {
      console.warn("Refresh pelajar: loadTodayRecords tidak tersedia, guna data sedia ada.");
    }

    showSignedInTab("pelajar");

    if (typeof render === "function") {
      render();
    } else if (typeof renderStudent === "function") {
      renderStudent();
    } else {
      console.warn("Refresh pelajar: render/renderStudent tidak tersedia.");
    }

    ensureStudentRefreshEmptyStateV161(student);
    updateStudentLastUpdatedV161();
    updateStudentSubmitState();
    return { ok: true };
  } catch (error) {
    console.error("Refresh pelajar gagal pada langkah reload/render.", { source, error });
    showSignedInTab("pelajar");
    ensureStudentRefreshEmptyStateV161(student);
    updateStudentLastUpdatedV161();
    throw error;
  }
}

refreshActiveStudentSession = async function refreshActiveStudentSessionV161() {
  return safeRefreshStudentRecordsV161("system-refresh");
};

function setupSafeStudentRefreshV161() {
  if (document.body && document.body.dataset.safeStudentRefreshDelegatedV161 !== "1") {
    document.body.dataset.safeStudentRefreshDelegatedV161 = "1";
    document.addEventListener("click", async (event) => {
      const button = event.target && event.target.closest ? event.target.closest("#studentRefreshButton") : null;
      if (!button) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      await runStudentRefreshButtonV161(button, "student-refresh-button");
    }, true);
  }

  const button = els.studentRefreshButton || document.querySelector("#studentRefreshButton");
  if (!button || button.dataset.safeStudentRefreshV161 === "1") {
    return;
  }

  button.dataset.safeStudentRefreshV161 = "1";
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    await runStudentRefreshButtonV161(button, "student-refresh-button");
  }, true);
}

async function runStudentRefreshButtonV161(button, source) {
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Memuat semula...";

  try {
    await safeRefreshStudentRecordsV161(source);
  } catch (error) {
    showError("Status pelajar gagal dimuat semula. Paparan semasa dikekalkan.", "Refresh Gagal");
  } finally {
    button.disabled = false;
    button.textContent = originalText || "Refresh Status";
  }
}

updateEmergencyFields = function updateEmergencyFieldsRequestTypeBridgeV164() {
  updateRequestTypeFields();
};

updatePulangBermalamFields = function updatePulangBermalamFieldsRequestTypeBridgeV164() {
  updateRequestTypeFields();
};

function scrollMonitoringWorkspaceToTop() {
  if (els.monitorWorkspace && typeof els.monitorWorkspace.scrollIntoView === "function") {
    els.monitorWorkspace.scrollIntoView({ block: "start" });
    return;
  }
  if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
    window.scrollTo(0, 0);
  }
}

async function openMonitoringPage(eventOrOptions) {
  const intentional = isIntentionalNavigationV200(eventOrOptions);
  activeRefreshPage = "monitor";
  if (els.accessScreen) {
    els.accessScreen.classList.add("hidden");
  }
  if (els.appWorkspace) {
    els.appWorkspace.classList.remove("active");
  }
  if (els.statsWorkspace) {
    els.statsWorkspace.classList.remove("active");
  }
  if (els.monitorWorkspace) {
    els.monitorWorkspace.classList.add("active");
  }
  if (intentional) {
    scheduleIntentionalScrollV200(els.monitorWorkspace);
  }

  if (!monitoringRefreshIntervalId) {
    monitoringRefreshIntervalId = setInterval(() => {
      if (activeRefreshPage === "monitor") {
        refreshMonitoringRecords("auto");
      }
    }, 30000);
  }
  await refreshMonitoringRecords("open");
}

function closeMonitoringPage() {
  activeRefreshPage = "access";
  if (monitoringRefreshIntervalId) {
    clearInterval(monitoringRefreshIntervalId);
    monitoringRefreshIntervalId = null;
  }
  if (els.monitorWorkspace) {
    els.monitorWorkspace.classList.remove("active");
  }
  if (els.accessScreen) {
    els.accessScreen.classList.remove("hidden");
  }
  if (typeof updateFooterActionsVisibility === "function") {
    updateFooterActionsVisibility();
  }
}

async function loadPublicMonitoringRecords() {
  const records = await apiGet("getTodayRecords");
  return (Array.isArray(records) ? records : []).map(mapPublicMonitoringRecord);
}

async function refreshMonitoringRecords(source) {
  if (monitorIsLoading) {
    return false;
  }

  const button = els.monitorRefreshButton;
  const originalText = button ? button.textContent : "";
  const hasOldData = monitorHasLoadedOnce;

  setMonitorLoadingState(true, !hasOldData);
  if (button) {
    button.disabled = true;
    button.textContent = "Memuat...";
  }

  try {
    const records = await loadPublicMonitoringRecords();
    outingRecords = records;
    renderMonitoringPageV1612();
    monitorHasLoadedOnce = true;
    updateMonitorLastUpdatedV1612();
    return true;
  } catch (error) {
    console.error("Rekod pemantauan gagal dimuat.", { source, error });
    if (!hasOldData && els.monitorNameList) {
      els.monitorNameList.innerHTML = emptyState("Rekod pemantauan gagal dimuat. Sila tekan Refresh.");
    } else {
      showError("Rekod pemantauan gagal dimuat. Sila tekan Refresh.", "Pemantauan Gagal");
    }
    return false;
  } finally {
    setMonitorLoadingState(false, false);
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "Refresh";
    }
  }
}

function setMonitorLoadingState(isLoading, clearCurrentView) {
  monitorIsLoading = isLoading;
  if (els.monitorLoading) {
    els.monitorLoading.hidden = !isLoading;
  }
  if (els.monitorSummary) {
    els.monitorSummary.classList.toggle("is-loading", isLoading);
    if (clearCurrentView) {
      els.monitorSummary.innerHTML = "";
    }
  }
  if (els.monitorNameList) {
    els.monitorNameList.classList.toggle("is-loading", isLoading);
    if (clearCurrentView) {
      els.monitorNameList.innerHTML = "";
    }
  }
}

function renderMonitoringPageV1612() {
  const records = Array.isArray(outingRecords) ? outingRecords : [];
  const counts = getMonitorCountsV1612(records);

  if (els.monitorSummary) {
    els.monitorSummary.innerHTML = [
      monitorSummaryCardV1612("Menunggu Kelulusan", counts.pending, "status-pulse-yellow"),
      monitorSummaryCardV1612("Diluluskan", counts.approved, "status-pulse-green"),
      monitorSummaryCardV1612("Sedang Keluar", counts.out, "monitor-out-card", "🚶"),
      monitorSummaryCardV1612("Sudah Pulang", counts.returned, ""),
      monitorSummaryCardV1612("Lewat", counts.late, "status-pulse-red"),
      monitorSummaryCardV1612("Belum Masuk", counts.notReturned, ""),
      monitorSummaryCardV1612("Kecemasan", counts.emergency, "")
    ].join("");
  }
  renderMonitorNameListV1613(records);
}

function publicMonitorStudentLabel(record) {
  const name = record && String(record.nama || "").trim();
  return name || "Pelajar";
}

function renderMonitorNameListV1613(records) {
  if (!els.monitorNameList) {
    return;
  }

  const nameRecords = records.filter(isMonitorNameListRecordV1613);
  if (!nameRecords.length) {
    els.monitorNameList.innerHTML = emptyState("Tiada status semasa.");
    return;
  }

  const rows = nameRecords.map((record, index) => {
    const statusDisplay = getContextualStatusDisplay(record);
    const iconClass = getMonitorNameIconClassV1613(record);
    const name = publicMonitorStudentLabel(record);
    const className = record.className || record.kelas || "-";
    const typeLabel = requestChecklistTypeLabel(record);
    return `
      <div class="monitor-name-row">
        <span class="monitor-name-icon ${iconClass}" aria-hidden="true">${statusDisplay.icon}</span>
        <span class="monitor-name-number">${index + 1}.</span>
        <div class="monitor-name-details">
          <strong>${escapeHtml(name)}</strong>
          <span class="monitor-name-meta">${escapeHtml(className)} · ${escapeHtml(typeLabel)}</span>
          <span class="badge badge-${statusDisplay.key} monitor-name-status">${escapeHtml(statusDisplay.label)}</span>
        </div>
      </div>
    `;
  }).join("");

  els.monitorNameList.innerHTML = `
    <div class="monitor-name-copy">
      <strong>SENARAI STATUS PERMOHONAN eOUTING</strong>
      <div class="monitor-name-rows">${rows}</div>
    </div>
  `;
}

function isMonitorNameListRecordV1613(record) {
  return Boolean(record && (
    record.status === STATUS.pending ||
    record.status === STATUS.approved ||
    record.status === STATUS.out ||
    record.status === STATUS.returned
  ));
}

function getMonitorNameIconClassV1613(record) {
  if (!record) return "";
  if (record.status === STATUS.pending) return "status-icon-pending";
  if (record.status === STATUS.approved) return "status-icon-approved";
  if (record.status === STATUS.out) return "status-icon-out";
  if (record.status === STATUS.returned) return "status-icon-returned";
  return "";
}

function getMonitorCountsV1612(records) {
  return records.reduce((acc, record) => {
    if (record.status === STATUS.pending) acc.pending += 1;
    if (record.status === STATUS.approved) acc.approved += 1;
    if (record.status === STATUS.out) acc.out += 1;
    if (record.status === STATUS.returned) acc.returned += 1;
    if (record.jenis_permohonan === REQUEST_TYPE.emergency) acc.emergency += 1;
    if (isMonitorLateRecordV1612(record)) acc.late += 1;
    if (record.belum_masuk === true || (record.status === STATUS.out && !record.masa_masuk && !record.returnedAt)) acc.notReturned += 1;
    return acc;
  }, {
    pending: 0,
    approved: 0,
    out: 0,
    returned: 0,
    late: 0,
    notReturned: 0,
    emergency: 0
  });
}

function monitorSummaryCardV1612(label, count, className, icon) {
  const activeClass = count > 0 ? "is-active-count is-live" : "";
  const iconHtml = icon ? `<span class="live-walk-icon" aria-hidden="true">${icon}</span>` : "";
  return `
    <article class="summary-card monitor-status-card ${className || ""} ${activeClass}">
      <span>${iconHtml}${escapeHtml(label)}</span>
      <strong>${count}</strong>
    </article>
  `;
}

function monitorRecordCardV1612(record) {
  const status = semesterChecklistStatus(record);
  const typeLabel = requestChecklistTypeLabel(record);
  const studentName = publicMonitorStudentLabel(record);
  const className = record.className || record.kelas || "-";
  return `
    <article class="record-card monitor-record-card">
      <div class="record-top">
        <div>
          <h3>${escapeHtml(studentName)}</h3>
          <p class="record-meta">${escapeHtml(className)} · ${escapeHtml(typeLabel)}</p>
        </div>
        <div class="badge-stack">
          <span class="badge badge-${status.key}">${status.icon} ${escapeHtml(status.label)}</span>
        </div>
      </div>
    </article>
  `;
}

function isMonitorLateRecordV1612(record) {
  return Boolean(record && (
    record.lewat === true ||
    String(record.lewat || "").trim().toLowerCase() === "ya" ||
    String(record.lewatText || "").trim().toLowerCase() === "ya" ||
    isHostelReturnLateV160(record)
  ));
}

function updateMonitorLastUpdatedV1612() {
  monitorLastUpdatedAt = new Date();
  if (!els.monitorLastUpdated) {
    return;
  }
  const timeText = typeof formatTime === "function"
    ? formatTime(monitorLastUpdatedAt)
    : monitorLastUpdatedAt.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" });
  els.monitorLastUpdated.textContent = `Dikemaskini ${timeText}`;
}

function clearStaffLoginSuccessFeedback() {
  if (toastTimerId) {
    clearTimeout(toastTimerId);
    toastTimerId = null;
  }
  document.querySelectorAll(".toast-card").forEach((toast) => toast.remove());
  if (els.wardenLoginMessage) els.wardenLoginMessage.textContent = "";
  if (els.guardLoginMessage) els.guardLoginMessage.textContent = "";
}

function ensureWardenRefreshControls() {
  if (!els.wardenList) {
    return;
  }

  const wardenPanel = document.querySelector("#warden");
  if (!wardenPanel) {
    return;
  }

  if (!els.wardenRefreshPanel) {
    const panel = document.createElement("section");
    panel.className = "warden-refresh-panel";
    panel.id = "wardenRefreshPanel";
    panel.innerHTML = `
      <div class="warden-refresh-top">
        <div>
          <h3>Utiliti Warden</h3>
          <small id="wardenLastUpdated"></small>
        </div>
        <button class="secondary-action warden-refresh-button" id="wardenRefreshButton" type="button">Refresh Permohonan</button>
      </div>
      <div class="warden-loading" id="wardenLoading" hidden>Memuatkan permohonan warden...</div>
      <div class="warden-utility-actions" id="wardenUtilityActions"></div>
      <div class="warden-reload-action" id="wardenReloadAction"></div>
    `;

    const heading = wardenPanel.querySelector(".section-heading");
    if (heading && heading.nextSibling) {
      wardenPanel.insertBefore(panel, heading.nextSibling);
    } else {
      wardenPanel.insertBefore(panel, wardenPanel.firstChild);
    }

    els.wardenRefreshPanel = panel;
    els.wardenRefreshButton = panel.querySelector("#wardenRefreshButton");
    els.wardenLastUpdated = panel.querySelector("#wardenLastUpdated");
    els.wardenLoading = panel.querySelector("#wardenLoading");
    els.wardenUtilityActions = panel.querySelector("#wardenUtilityActions");
    els.wardenReloadAction = panel.querySelector("#wardenReloadAction");
  }

  moveWardenUtilityButtons();

  if (els.wardenRefreshButton && els.wardenRefreshButton.dataset.ready !== "1") {
    els.wardenRefreshButton.dataset.ready = "1";
    els.wardenRefreshButton.addEventListener("click", () => refreshWardenRecords("button"));
  }
}

function moveWardenUtilityButtons() {
  if (!els.wardenUtilityActions) {
    return;
  }

  const footer = document.querySelector(".app-footer");
  if (!footer) {
    return;
  }

  Array.from(footer.querySelectorAll("button")).forEach((button) => {
    els.wardenUtilityActions.appendChild(button);
  });
}

async function refreshWardenRecords(source) {
  if (!currentSession || currentSession.role !== "warden") {
    return;
  }

  ensureWardenRefreshControls();
  const button = els.wardenRefreshButton;
  const originalText = button ? button.textContent : "";
  const hasOldData = Array.isArray(outingRecords) && outingRecords.length > 0;
  const shouldShowToast = source === "button";

  setWardenLoadingState(true, !hasOldData);
  if (button) {
    button.disabled = true;
    button.textContent = "Memuat...";
  }

  try {
    await loadWardenRecordsOnly();
    wardenHasLoadedOnce = true;
    if (typeof render === "function") {
      render();
    } else if (typeof renderWarden === "function") {
      renderWarden();
    }
    updateWardenLastUpdated();
  } catch (error) {
    console.error("Permohonan warden gagal dimuat.", { source, error });
    if (hasOldData) {
      if (typeof render === "function") {
        render();
      } else if (typeof renderWarden === "function") {
        renderWarden();
      }
      if (shouldShowToast) {
        showError("Permohonan warden gagal dimuat. Sila cuba Refresh Permohonan.", "Refresh Permohonan");
      }
    } else {
      if (typeof ensureWardenSemesterChecklist === "function") {
        ensureWardenSemesterChecklist();
      }
      if (els.wardenList) {
        els.wardenList.innerHTML = emptyState("Permohonan warden gagal dimuat. Sila cuba Refresh Permohonan.");
      }
      if (els.wardenApprovedList) {
        els.wardenApprovedList.innerHTML = emptyState("Permohonan warden gagal dimuat. Sila cuba Refresh Permohonan.");
      }
      if (els.wardenSemesterList) {
        els.wardenSemesterList.innerHTML = emptyState("Permohonan warden gagal dimuat. Sila cuba Refresh Permohonan.");
      }
    }
  } finally {
    setWardenLoadingState(false, false);
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "Refresh Permohonan";
    }
  }
}

async function loadWardenRecordsOnly() {
  if (!isLiveMode) {
    return;
  }

  const records = await apiPost("getTodayRecords", buildTodayRecordsAccessPayload());
  if (!Array.isArray(records)) {
    throw new Error("Format rekod warden tidak sah.");
  }
  outingRecords = records.map(mapLiveRecord);
}

function setWardenLoadingState(isLoading, clearCurrentView) {
  isWardenLoading = isLoading;
  if (els.wardenLoading) {
    els.wardenLoading.hidden = !isLoading;
  }
  if (els.wardenList) {
    els.wardenList.classList.toggle("is-loading", isLoading);
    if (clearCurrentView) {
      els.wardenList.innerHTML = "";
    }
  }
  if (els.wardenApprovedList) {
    els.wardenApprovedList.classList.toggle("is-loading", isLoading);
    if (clearCurrentView) {
      els.wardenApprovedList.innerHTML = "";
    }
  }
  if (els.wardenSemesterList) {
    els.wardenSemesterList.classList.toggle("is-loading", isLoading);
    if (clearCurrentView) {
      els.wardenSemesterList.innerHTML = "";
    }
  }
}

function updateWardenLastUpdated() {
  wardenLastUpdatedAt = new Date();
  if (!els.wardenLastUpdated) {
    return;
  }
  const timeText = typeof formatTime === "function"
    ? formatTime(wardenLastUpdatedAt)
    : wardenLastUpdatedAt.toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit" });
  els.wardenLastUpdated.textContent = `Dikemaskini: ${timeText}`;
}

function startWardenAutoRefresh() {
  if (!currentSession || currentSession.role !== "warden") {
    return;
  }
  if (wardenRefreshIntervalId) {
    return;
  }
  wardenRefreshIntervalId = setInterval(() => {
    if (!currentSession || currentSession.role !== "warden") {
      stopWardenAutoRefresh();
      return;
    }
    refreshWardenRecords("auto");
  }, 60000);
}

function stopWardenAutoRefresh() {
  if (wardenRefreshIntervalId) {
    clearInterval(wardenRefreshIntervalId);
    wardenRefreshIntervalId = null;
  }
}

function ensureWardenSemesterChecklist() {
  ensureWardenRefreshControls();
  if (currentSession && currentSession.role === "warden") {
    startWardenAutoRefresh();
    if (!wardenHasLoadedOnce && !isWardenLoading) {
      refreshWardenRecords("initial");
    }
  }

  if (!els.wardenList || els.wardenSemesterChecklist) {
    return;
  }

  const panel = document.createElement("section");
  panel.className = "semester-checklist-panel";
  panel.id = "wardenSemesterChecklist";
  panel.innerHTML = `
    <div class="semester-checklist-heading">
      <h3>Checklist Permohonan</h3>
      <span id="wardenSemesterCount"></span>
    </div>
    <div class="checklist-copy-controls">
      <div class="checklist-filter-pills" id="wardenChecklistFilterButtons" aria-label="Filter jenis permohonan">
        <button class="checklist-filter-pill active" type="button" data-checklist-type="all">Semua</button>
        <button class="checklist-filter-pill" type="button" data-checklist-type="OUTING_BIASA">Outing</button>
        <button class="checklist-filter-pill" type="button" data-checklist-type="PULANG_BERMALAM">Bermalam</button>
        <button class="checklist-filter-pill" type="button" data-checklist-type="CUTI_SEMESTER">Cuti Semester</button>
        <button class="checklist-filter-pill" type="button" data-checklist-type="KECEMASAN">Kecemasan</button>
      </div>
      <button class="secondary-action checklist-copy-button" id="wardenCopyNamesButton" type="button">Copy Senarai Nama</button>
    </div>
    <div class="semester-checklist-summary" id="wardenSemesterSummary"></div>
    <div class="semester-checklist-list" id="wardenSemesterList"></div>
  `;
  els.wardenList.parentNode.insertBefore(panel, els.wardenList);
  els.wardenSemesterChecklist = panel;
  els.wardenSemesterCount = panel.querySelector("#wardenSemesterCount");
  els.wardenSemesterSummary = panel.querySelector("#wardenSemesterSummary");
  els.wardenSemesterList = panel.querySelector("#wardenSemesterList");
  els.wardenChecklistFilterButtons = panel.querySelector("#wardenChecklistFilterButtons");
  els.wardenCopyNamesButton = panel.querySelector("#wardenCopyNamesButton");
  setupWardenChecklistCopyControls();
}

function renderWardenSemesterChecklist(records) {
  ensureWardenSemesterChecklist();
  if (!els.wardenSemesterList) {
    return;
  }

  wardenChecklistRecords = records.filter((record) => Object.values(REQUEST_TYPE).includes(record.jenis_permohonan));
  const semesterRecords = filterWardenChecklistRecords(wardenChecklistRecords);
  if (els.wardenSemesterCount) {
    els.wardenSemesterCount.textContent = `Checklist Permohonan: ${semesterRecords.length} rekod`;
  }
  if (els.wardenSemesterSummary) {
    els.wardenSemesterSummary.textContent = requestChecklistTypeSummary(semesterRecords) + " · " + semesterChecklistSummary(semesterRecords);
  }

  if (!semesterRecords.length) {
    els.wardenSemesterList.innerHTML = emptyState("Tiada permohonan untuk dipaparkan.");
    return;
  }

  els.wardenSemesterList.innerHTML = semesterRecords.map(semesterChecklistItem).join("");
  els.wardenSemesterList.querySelectorAll("[data-semester-record-id]").forEach((button) => {
    if (button.dataset.semesterChecklistReady === "1") {
      return;
    }
    button.dataset.semesterChecklistReady = "1";
    button.addEventListener("click", () => {
      if (button.dataset.semesterAction === "focus") {
        scrollToRecordCard(button.dataset.semesterRecordId);
      }
    });
  });
}

function setupWardenChecklistCopyControls() {
  if (els.wardenChecklistFilterButtons && els.wardenChecklistFilterButtons.dataset.ready !== "1") {
    els.wardenChecklistFilterButtons.dataset.ready = "1";
    els.wardenChecklistFilterButtons.querySelectorAll("[data-checklist-type]").forEach((button) => {
      button.addEventListener("click", () => {
        wardenChecklistTypeFilter = button.dataset.checklistType || "all";
        updateWardenChecklistFilterButtons();
        renderWardenSemesterChecklist(wardenChecklistRecords);
      });
    });
  }

  if (els.wardenCopyNamesButton && els.wardenCopyNamesButton.dataset.ready !== "1") {
    els.wardenCopyNamesButton.dataset.ready = "1";
    els.wardenCopyNamesButton.addEventListener("click", copyWardenChecklistNames);
  }

  updateWardenChecklistFilterButtons();
}

function updateWardenChecklistFilterButtons() {
  if (!els.wardenChecklistFilterButtons) {
    return;
  }

  els.wardenChecklistFilterButtons.querySelectorAll("[data-checklist-type]").forEach((button) => {
    button.classList.toggle("active", button.dataset.checklistType === wardenChecklistTypeFilter);
  });
}

function filterWardenChecklistRecords(records) {
  if (wardenChecklistTypeFilter === "all") {
    return records;
  }
  return records.filter((record) => record.jenis_permohonan === wardenChecklistTypeFilter);
}

async function copyWardenChecklistNames() {
  const activeRecords = filterWardenChecklistRecords(wardenChecklistRecords)
    .filter(isWardenChecklistCopyActiveRecord);

  if (!activeRecords.length) {
    showError("Tiada senarai aktif untuk disalin.", "Tiada Rekod Aktif");
    return;
  }

  const text = buildWardenChecklistCopyText(activeRecords);
  const button = els.wardenCopyNamesButton;
  const originalText = button ? button.textContent : "";
  if (button) {
    button.disabled = true;
    button.textContent = "Menyalin...";
  }

  try {
    await copyTextToClipboard(text);
    showSuccess("Senarai nama telah disalin.", "Senarai Disalin");
  } catch (error) {
    console.error("Copy senarai nama gagal.", error);
    showError("Senarai nama gagal disalin. Sila cuba semula.", "Copy Gagal");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalText || "Copy Senarai Nama";
    }
  }
}

function isWardenChecklistCopyActiveRecord(record) {
  return Boolean(record && (
    record.status === STATUS.pending ||
    record.status === STATUS.approved ||
    record.status === STATUS.out ||
    record.status === STATUS.returned
  ));
}

function buildWardenChecklistCopyText(records) {
  const header = getWardenChecklistCopyHeader();
  const names = records.map((record, index) => {
    const name = record.studentName || record.nama || record.name || "-";
    return `${getWardenChecklistCopyStatusIcon(record)} ${index + 1}. ${name}`;
  });
  return [
    header,
    "",
    ...names,
    "",
    "Petunjuk:",
    "🟡 Menunggu kelulusan",
    "🟢 Diluluskan warden",
    "🚶 Sedang keluar",
    "🌙 Sedang bermalam",
    "🏖️ Sedang bercuti",
    "✅ Sudah balik ke asrama",
    "🔴 Lewat"
  ].join("\n");
}

function getContextualStatusDisplay(record) {
  const item = record || {};
  if (isSemesterChecklistLate(item)) {
    return { key: "late", icon: "🔴", label: "Lewat" };
  }
  if (item.status === STATUS.out) {
    if (item.jenis_permohonan === REQUEST_TYPE.semester) {
      return { key: "out", icon: "🏖️", label: "Sedang Bercuti" };
    }
    if (item.jenis_permohonan === REQUEST_TYPE.overnight) {
      return { key: "out", icon: "🌙", label: "Sedang Bermalam" };
    }
    return { key: "out", icon: "🚶", label: "Sedang Keluar" };
  }
  if (item.status === STATUS.pending) return { key: "pending", icon: "🟡", label: "Menunggu Kelulusan" };
  if (item.status === STATUS.approved) return { key: "approved", icon: "🟢", label: "Diluluskan" };
  if (item.status === STATUS.returned) return { key: "returned", icon: "✅", label: "Sudah Pulang" };
  if (item.status === STATUS.rejected) return { key: "rejected", icon: "•", label: "Ditolak" };
  return { key: "unknown", icon: "•", label: item.status || "-" };
}

function getWardenChecklistCopyStatusIcon(record) {
  return getContextualStatusDisplay(record).icon;
}

function getWardenChecklistCopyHeader() {
  const headers = {
    all: "SENARAI NAMA PERMOHONAN eOUTING",
    OUTING_BIASA: "SENARAI NAMA PERMOHONAN OUTING BIASA",
    PULANG_BERMALAM: "SENARAI NAMA PERMOHONAN PULANG BERMALAM",
    CUTI_SEMESTER: "SENARAI NAMA PERMOHONAN CUTI SEMESTER",
    KECEMASAN: "SENARAI NAMA PERMOHONAN KECEMASAN"
  };
  return headers[wardenChecklistTypeFilter] || headers.all;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const copied = document.execCommand("copy");
    if (!copied) {
      throw new Error("execCommand copy returned false");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}

function semesterChecklistItem(record) {
  const recordId = getRecordId(record);
  const status = semesterChecklistStatus(record);
  const canFocusCard = record.status === STATUS.pending;
  return `
    <button class="semester-checklist-item${canFocusCard ? "" : " is-readonly"}" type="button" data-semester-action="${canFocusCard ? "focus" : "readonly"}" data-semester-record-id="${escapeHtml(recordId)}" aria-disabled="${canFocusCard ? "false" : "true"}">
      <span class="semester-status-icon semester-status-${status.key}" aria-hidden="true">${getWardenChecklistCopyStatusIcon(record)}</span>
      <span class="semester-checklist-main">
        <strong>${escapeHtml(record.studentName || record.nama || "-")}</strong>
        <small>${escapeHtml(record.className || record.kelas || "-")}</small>
      </span>
      <span class="semester-checklist-meta">
        <span>${escapeHtml(requestChecklistDateTime(record))}</span>
        <small class="request-type-badge request-type-${escapeHtml(record.jenis_permohonan || "unknown")}">${escapeHtml(requestChecklistTypeLabel(record))}</small>
        <small class="semester-status-badge semester-status-${status.key}">${escapeHtml(status.label)}</small>
      </span>
    </button>
  `;
}

function requestChecklistDateTime(record) {
  const requestType = record.jenis_permohonan;
  if (requestType === REQUEST_TYPE.overnight || requestType === REQUEST_TYPE.semester) {
    return formatExpectedReturnV160(record);
  }

  const dateText = formatDisplayDateV160(record.tarikh || record.requestDate || record.requestedAt || record.masa_mohon);
  const timeText = formatDisplayTimeV165(record.masa_keluar || record.masa_masuk || record.masa_mohon || record.requestedAt);
  return dateText === "-" && timeText === "-" ? "-" : `${dateText} ${timeText}`;
}

function requestChecklistTypeLabel(record) {
  const type = record && record.jenis_permohonan;
  return REQUEST_TYPE_LABEL[type] || type || "-";
}

function requestChecklistTypeSummary(records) {
  if (!records.length) {
    return "Tiada jenis permohonan.";
  }

  const counts = records.reduce((acc, record) => {
    const type = record.jenis_permohonan || "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return [
    `Outing: ${counts[REQUEST_TYPE.normal] || 0}`,
    `Bermalam: ${counts[REQUEST_TYPE.overnight] || 0}`,
    `Cuti Semester: ${counts[REQUEST_TYPE.semester] || 0}`,
    `Kecemasan: ${counts[REQUEST_TYPE.emergency] || 0}`
  ].join(" · ");
}

function semesterChecklistSummary(records) {
  if (!records.length) {
    return "Tiada permohonan.";
  }

  const counts = records.reduce((acc, record) => {
    const status = semesterChecklistStatus(record);
    acc[status.key] = (acc[status.key] || 0) + 1;
    return acc;
  }, {});
  const parts = [
    ["pending", "Menunggu"],
    ["approved", "Diluluskan"],
    ["rejected", "Ditolak"],
    ["out", "Sedang Keluar"],
    ["returned", "Selesai"],
    ["late", "Lewat"]
  ];

  return parts
    .filter(([key]) => counts[key])
    .map(([key, label]) => `${label}: ${counts[key]}`)
    .join(" · ") || "Tiada status aktif.";
}

function semesterChecklistStatus(record) {
  return getContextualStatusDisplay(record);
}

function isSemesterChecklistLate(record) {
  return Boolean(record && (
    record.lewat === true ||
    String(record.lewat || "").trim().toLowerCase() === "ya" ||
    String(record.lewatText || "").trim().toLowerCase() === "ya" ||
    isHostelReturnLateV160(record)
  ));
}

async function initApp() {
  setupAppVersionUi();
  if (els.betaApiIndicator) {
    els.betaApiIndicator.hidden = !ACTIVE_API_ENDPOINT_V200.isBeta;
  }
  setupServiceWorkerUpdates();
  setupAccessEnhancements();
  setupFooterActionsVisibilityV166();
  setupSemesterRequestV160();
  setupSafeStudentRefreshV161();
  setupFeedbackMessageObservers();
  updateEmergencyFields();
  updatePulangBermalamFields();
  updateSemesterFieldsV160();
  updateStudentSubmitState();
  updateClock();
  if (ALLOW_MOCK_MODE) {
    setMockMode("");
    refreshStudentClassChoicesV200();
    await restoreSavedSession();
    return;
  } else {
    updateDataModeIndicator();
  }
  await loadLiveMasters();
  refreshStudentClassChoicesV200();
  if (isLiveMode) {
    await restoreSavedSession();
  }
  updateFooterActionsVisibility();
}

initApp();
setInterval(updateClock, 1000);
