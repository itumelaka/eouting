const GAS_WEB_APP_URL = "";

const students = [
  { id: "S001", no_matrik: "M001", name: "Ahmad Hakimi", className: "SKM 1", gender: "Lelaki", status: "Aktif" },
  { id: "S002", no_matrik: "M002", name: "Nur Aisyah", className: "SKM 1", gender: "Perempuan", status: "Aktif" },
  { id: "S003", no_matrik: "M003", name: "Muhammad Amir", className: "SKM 2", gender: "Lelaki", status: "Aktif" }
];

const wardens = [
  "Abang Wal Haffalrais Bin Abang Sabaki",
  "Siti Aishah Binti Ismail",
  "Sheikh Bukhori Bin Sheikh Ghadzi"
];

const guards = [
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

let outingRecords = [];
let nextRequestNumber = 1;
let currentSession = null;

const els = {
  todayDate: document.querySelector("#todayDate"),
  todayDay: document.querySelector("#todayDay"),
  currentTime: document.querySelector("#currentTime"),
  accessScreen: document.querySelector("#accessScreen"),
  appWorkspace: document.querySelector("#appWorkspace"),
  studentLoginPanel: document.querySelector("#studentLoginPanel"),
  wardenLoginPanel: document.querySelector("#wardenLoginPanel"),
  guardLoginPanel: document.querySelector("#guardLoginPanel"),
  studentLoginSelect: document.querySelector("#studentLoginSelect"),
  matricInput: document.querySelector("#matricInput"),
  studentLoginMessage: document.querySelector("#studentLoginMessage"),
  wardenSelect: document.querySelector("#wardenSelect"),
  guardSelect: document.querySelector("#guardSelect"),
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
  countEmergency: document.querySelector("#countEmergency")
};

document.querySelectorAll("[data-role-choice]").forEach((button) => {
  button.addEventListener("click", () => showLoginPanel(button.dataset.roleChoice));
});

els.studentLoginPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  const student = students.find((item) => item.id === els.studentLoginSelect.value);
  const enteredMatric = els.matricInput.value.trim().toUpperCase();

  if (!student || student.no_matrik !== enteredMatric) {
    els.studentLoginMessage.textContent = "Nama pelajar dan nombor matrik tidak sepadan.";
    return;
  }

  startSession("student", student);
});

els.wardenLoginPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  startSession("warden", { name: els.wardenSelect.value });
});

els.guardLoginPanel.addEventListener("submit", (event) => {
  event.preventDefault();
  startSession("guard", { name: els.guardSelect.value });
});

els.logoutButton.addEventListener("click", () => {
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

els.requestTypeSelect.addEventListener("change", updateEmergencyFields);

els.requestForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const requestType = els.requestTypeSelect.value;

  if (!canSubmitRequest(requestType, new Date())) {
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
}

function startSession(role, user) {
  // Mock frontend access only. Real GAS backend must validate role and identity later.
  currentSession = { role, user };
  els.accessScreen.classList.add("hidden");
  els.appWorkspace.classList.add("active");
  els.sessionRole.textContent = roleLabel(role);
  els.sessionName.textContent = user.name;
  applyRoleView();
  render();
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

  const studentRecords = outingRecords.filter((record) => record.studentId === currentSession.user.id);
  els.studentRecordsList.innerHTML = studentRecords.length
    ? studentRecords.map((record) => recordCard(record, "student")).join("")
    : emptyState("Belum ada rekod permohonan untuk pelajar ini.");
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

function updateStatus(id, status) {
  if (!currentSession || currentSession.role !== "warden") {
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
}

function confirmOut(id) {
  if (!currentSession || currentSession.role !== "guard") {
    return;
  }

  outingRecords = outingRecords.map((record) => {
    if (record.id !== id) {
      return record;
    }

    if (record.status !== STATUS.approved) {
      alert("Guard hanya boleh sahkan keluar selepas warden meluluskan permohonan.");
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
}

function confirmIn(id) {
  if (!currentSession || currentSession.role !== "guard") {
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
        <strong>No. Telefon Waris / Penjaga:</strong> ${escapeHtml(record.telefon_waris || "-")}<br>
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

  return new Date(value).toLocaleTimeString("ms-MY", {
    hour: "2-digit",
    minute: "2-digit"
  });
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

populateStudents();
populateStaff();
updateEmergencyFields();
updateClock();
setInterval(updateClock, 1000);
