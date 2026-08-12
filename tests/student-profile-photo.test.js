const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const gas = fs.readFileSync(path.join(root, "gas", "Code.gs"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function extractFunction(source, name, nextName) {
  const start = source.search(new RegExp(`(?:async\\s+)?function ${name}`));
  const boundary = start === -1 ? null : source.slice(start).match(new RegExp(`\\n(?:async\\s+)?function ${nextName}`));
  const end = boundary ? start + boundary.index : -1;
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${name} boundary must exist`);
  return source.slice(start, end);
}

test("STUDENTS adds only private profile metadata through an idempotent setup helper", () => {
  assert.match(gas, /STUDENTS:\s*\[[^\]]*"photo_file_id"[^\]]*"photo_updated_at"/s);
  const setup = extractFunction(gas, "setupStudentProfilePhotos", "validateProfilePhotoImage_");
  assert.match(setup, /ensureHeaders_\(sheet,\s*HEADERS\.STUDENTS\)/);
  assert.match(setup, /PROFILE_PHOTO_FOLDER_ID/);
  assert.match(setup, /1EpnqLVO8iWHRpF8MuqsyVAN55T7eq5X3/);
  assert.doesNotMatch(setup, /createFolder|appendRow/);
});

test("Admin student normalization exposes safe photo metadata without Drive identifiers", () => {
  const context = vm.createContext({
    Utilities: { formatDate: () => "2026-08-09 10:11:12" },
    hasCellValue_: (value) => value !== null && value !== undefined && String(value).trim() !== ""
  });
  vm.runInContext([
    extractFunction(gas, "normalizeStudentRecord_", "normalizeProfilePhotoUpdatedAt_"),
    extractFunction(gas, "normalizeProfilePhotoUpdatedAt_", "sortAdminStudents_")
  ].join("\n"), context);

  const withPhoto = context.normalizeStudentRecord_({
    student_id: " A2-002 ",
    photo_file_id: "PRIVATE-FILE-ID",
    photo_updated_at: " 2026-08-09 10:11:12 "
  });
  const withoutPhoto = context.normalizeStudentRecord_({ student_id: "A2-003" });
  assert.equal(withPhoto.student_id, "A2-002");
  assert.equal(withPhoto.has_profile_photo, true);
  assert.equal(withPhoto.photo_updated_at, "2026-08-09 10:11:12");
  assert.equal(withoutPhoto.has_profile_photo, false);
  assert.equal(withoutPhoto.photo_updated_at, "");
  assert.equal(Object.hasOwn(withPhoto, "photo_file_id"), false);

  const staffValidation = extractFunction(gas, "validateStaffInput_", "getAdminStaff");
  assert.doesNotMatch(staffValidation, /has_profile_photo|photo_updated_at|photo_file_id/);
});

test("profile actions are authenticated POST-only and public GET projections contain no photo data", () => {
  const getRouter = gas.slice(gas.indexOf("function doGet"), gas.indexOf("function doPost"));
  const postRouter = gas.slice(gas.indexOf("function doPost"), gas.indexOf("function setupDatabase"));
  for (const action of ["getStudentProfilePhotos", "submitStudentProfilePhoto", "removeStudentProfilePhoto"]) {
    assert.doesNotMatch(getRouter, new RegExp(action));
    assert.match(postRouter, new RegExp(action));
  }
  const publicRecords = extractFunction(gas, "getTodayRecords", "getOperationalTodayRecords");
  assert.doesNotMatch(publicRecords, /photo|file_id|data_uri/i);
});

test("student upload revalidates existing credentials and cannot target another row", () => {
  const upload = extractFunction(gas, "submitStudentProfilePhoto", "validateProfilePhotoViewer_");
  assert.match(upload, /findActiveStudent_\(studentId,\s*noMatrik\)/);
  assert.match(upload, /findStudentRowById_\(sheet,\s*student\.student_id\)/);
  assert.match(upload, /found\.record\.no_matrik/);
  assert.doesNotMatch(upload, /payload\.target_student_id/);
});

test("backend and client reject unsafe MIME and oversized profile inputs", () => {
  const validation = extractFunction(gas, "validateProfilePhotoImage_", "getProfilePhotoFolder_");
  assert.match(validation, /image\/jpeg/);
  assert.match(validation, /image\/png/);
  assert.match(validation, /image\/webp/);
  assert.doesNotMatch(validation, /image\/svg/);
  assert.match(validation, /800 \* 1024/);
  const selection = extractFunction(app, "handleStudentProfilePhotoSelection", "compressStudentProfilePhoto");
  assert.match(selection, /2 \* 1024 \* 1024/);
  assert.match(selection, /image\/jpeg/);
  assert.match(selection, /image\/png/);
  assert.match(selection, /image\/webp/);
});

test("replacement uploads first, saves metadata, then safely trashes only the old profile file", () => {
  const upload = extractFunction(gas, "submitStudentProfilePhoto", "validateProfilePhotoViewer_");
  const createAt = upload.indexOf("folder.createFile");
  const updateAt = upload.indexOf("updateRowByHeaders_");
  const trashAt = upload.indexOf("safelyTrashProfilePhoto_");
  assert.ok(createAt >= 0 && createAt < updateAt && updateAt < trashAt);
  assert.match(upload, /if \(!metadataSaved && newFile\)/);
  const safety = extractFunction(gas, "safelyTrashProfilePhoto_", "submitStudentProfilePhoto");
  assert.match(safety, /getVerifiedProfilePhotoFile_/);
  assert.match(extractFunction(gas, "getVerifiedProfilePhotoFile_", "safelyTrashProfilePhoto_"), /isFileInFolder_/);
});

test("one compact authenticated batch call serves Student, Warden, Guard and Admin", () => {
  const auth = extractFunction(gas, "validateProfilePhotoViewer_", "getStudentProfilePhotos");
  assert.match(auth, /role === "student"/);
  assert.match(auth, /findActiveWarden_/);
  assert.match(auth, /findActiveGuard_/);
  assert.match(auth, /validateAdminCredentials_/);
  const batch = extractFunction(gas, "getStudentProfilePhotos", "removeStudentProfilePhoto");
  assert.match(batch, /Pelajar hanya boleh mengakses foto profil sendiri/);
  assert.match(batch, /Foto hanya boleh diakses untuk rekod operasi semasa/);
  assert.match(batch, /requestedIds\.length > 100/);
  assert.match(batch, /photo_variant/);
  assert.match(batch, /variant === "thumbnail"/);
  assert.match(batch, /fetchProfilePhotoThumbnails_\(photoEntries\)/);
  assert.match(batch, /photo_data_uri/);
  assert.doesNotMatch(batch, /photo_file_id:\s*student\.photo_file_id/);
  assert.match(app, /apiPost\("getStudentProfilePhotos"/);
  const adminLoader = extractFunction(app, "loadAdminStudentsV200", "setAdminStudentsBusyV200");
  assert.match(adminLoader, /filter\(\(student\) => student\.has_profile_photo\)/);
  assert.match(adminLoader, /map\(\(student\) => student\.student_id\)/);
});

test("Drive thumbnails are fetched server-side and expose only safe image data", () => {
  const calls = [];
  const context = vm.createContext({
    Buffer, JSON, encodeURIComponent,
    console: { warn: () => {} },
    ScriptApp: { getOAuthToken: () => "PRIVATE-OAUTH-TOKEN" },
    Utilities: { base64Encode: (bytes) => Buffer.from(bytes).toString("base64") },
    UrlFetchApp: {
      fetchAll(requests) {
        calls.push(requests);
        if (calls.length === 1) {
          return requests.map(() => ({
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify({ thumbnailLink: "https://private.example/thumb", trashed: false })
          }));
        }
        return requests.map(() => ({
          getResponseCode: () => 200,
          getBlob: () => ({ getContentType: () => "image/jpeg", getBytes: () => [1, 2, 3, 4] })
        }));
      }
    }
  });
  vm.runInContext(extractFunction(gas, "fetchProfilePhotoThumbnails_", "removeStudentProfilePhoto"), context);
  const result = context.fetchProfilePhotoThumbnails_([{
    studentId: "A2-002", fileId: "PRIVATE-FILE-ID", photoUpdatedAt: "2026-08-09"
  }]);
  assert.equal(calls.length, 2);
  assert.match(calls[0][0].url, /fields=thumbnailLink/);
  assert.equal(calls[0][0].headers.Authorization, "Bearer PRIVATE-OAUTH-TOKEN");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [{
    student_id: "A2-002",
    photo_data_uri: "data:image/jpeg;base64,AQIDBA==",
    photo_updated_at: "2026-08-09"
  }]);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-FILE-ID|thumbnailLink|private\.example|OAUTH|Bearer/i);
});

test("Drive thumbnail failure safely returns no bulk full-image fallback", () => {
  const context = vm.createContext({
    console: { warn: () => {} },
    ScriptApp: { getOAuthToken: () => "token" },
    UrlFetchApp: { fetchAll: () => { throw new Error("private details"); } }
  });
  const helper = extractFunction(gas, "fetchProfilePhotoThumbnails_", "removeStudentProfilePhoto");
  vm.runInContext(helper, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.fetchProfilePhotoThumbnails_([{ fileId: "x" }]))), []);
  assert.doesNotMatch(helper, /\.file\.getBlob|800 \* 1024/);
});

test("frontend keeps canonicalized thumbnail and full-image caches separate", () => {
  const context = vm.createContext({});
  vm.runInContext(extractFunction(app, "profilePhotoCacheKey", "profilePhotoInitials"), context);
  assert.equal(context.profilePhotoCacheKey(" A2-002 "), "a2-002");
  assert.equal(context.profilePhotoCacheKey("a2-002"), "a2-002");

  const cacheOperations = Array.from(app.matchAll(/profilePhoto(?:Thumbnails|FullImages)\.(?:get|set|delete)\(([^\n;]+)/g), (match) => match[1]);
  assert.ok(cacheOperations.length >= 10);
  cacheOperations.forEach((operation) => assert.match(operation, /profilePhotoCacheKey\(|\bkey\b/));
  assert.match(app, /let profilePhotoThumbnails = new Map\(\)/);
  assert.match(app, /let profilePhotoFullImages = new Map\(\)/);
  const markup = extractFunction(app, "profilePhotoMarkup", "buildProfilePhotoAccessPayload");
  assert.match(markup, /profile-photo-placeholder/);
});

test("batch failures stay non-blocking, rate-limited and free of sensitive diagnostics", () => {
  const loader = extractFunction(app, "loadProfilePhotoThumbnailsForStudents", "loadFullProfilePhotoForStudent");
  const warning = extractFunction(app, "warnProfilePhotoBatchFailure", "renderProfilePhotoConsumers");
  assert.equal((loader.match(/apiPost\("getStudentProfilePhotos"/g) || []).length, 1);
  assert.match(loader, /photo_variant: "thumbnail"/);
  assert.match(loader, /catch \(error\)[\s\S]*warnProfilePhotoBatchFailure\(error\)/);
  assert.doesNotMatch(loader, /throw error|showError|showToast/);
  assert.match(warning, /60000/);
  assert.match(warning, /Profile photo batch request failed/);
  assert.match(warning, /error_type:\s*safeType/);
  assert.doesNotMatch(warning, /student|photo_file_id|photo_data_uri|credential|image_base64|error\.message/i);
});

test("Student UI compresses to a 3:4 JPEG and preserves the current photo on failure", () => {
  assert.match(html, /id="studentProfilePhotoCameraInput"[^>]*accept="image\/\*"[^>]*capture="user"/s);
  assert.match(html, /id="studentProfilePhotoGalleryInput"[^>]*accept="image\/\*"/s);
  assert.match(html, /Gunakan gambar muka yang jelas seperti gambar ukuran pasport/);
  const compression = extractFunction(app, "compressStudentProfilePhoto", "startStudentSession");
  assert.match(compression, /targetRatio = 3 \/ 4/);
  assert.match(compression, /600 \/ sourceWidth/);
  assert.match(compression, /800 \/ sourceHeight/);
  const upload = extractFunction(app, "handleStudentProfilePhotoSelection", "compressStudentProfilePhoto");
  assert.match(upload, /studentProfileUploadInFlight/);
  assert.doesNotMatch(upload, /studentProfilePhotos\.delete/);
});

test("Student identity header reuses the self-photo cache with an initials fallback", () => {
  assert.match(html, /id="studentIdentityProfilePhoto"/);
  const render = extractFunction(app, "renderStudentProfilePhotoArea", "handleStudentProfilePhotoSelection");
  assert.match(render, /studentIdentityProfilePhoto\.innerHTML = profilePhotoMarkup/);
  assert.match(render, /profile-photo-identity/);
  assert.doesNotMatch(render, /apiPost|getStudentProfilePhotos/);
  assert.match(css, /\.profile-photo-identity[\s\S]*?width:\s*54px/);
  assert.match(extractFunction(app, "profilePhotoMarkup", "buildProfilePhotoAccessPayload"), /profilePhotoInitials/);
});

test("real authorised thumbnails open an accessible cached-image preview while placeholders stay inert", () => {
  const markup = extractFunction(app, "profilePhotoMarkup", "setupProfilePhotoPreview");
  assert.match(markup, /<button class="\$\{className\} profile-photo-preview-trigger"/);
  assert.match(markup, /data-profile-photo-preview/);
  assert.match(markup, /aria-label="Lihat foto profil/);
  assert.match(markup, /<span class="\$\{className\} profile-photo-placeholder"/);
  assert.doesNotMatch(markup.slice(markup.indexOf("profile-photo-placeholder")), /data-profile-photo-preview/);

  assert.match(html, /id="profilePhotoModal"[^>]*role="dialog"[^>]*aria-modal="true"/s);
  assert.match(html, /id="profilePhotoModalClose"[^>]*aria-label="Tutup paparan foto profil"/s);
  assert.match(css, /\.profile-photo-modal[\s\S]*?background:\s*rgba\(3, 14, 30, 0\.82\)/);
  assert.match(css, /\.profile-photo-modal-dialog img[\s\S]*?max-height:\s*82vh[\s\S]*?object-fit:\s*contain/);
});

test("preview shows the thumbnail immediately, then loads one authenticated full image", () => {
  const open = extractFunction(app, "openProfilePhotoPreview", "closeProfilePhotoPreview");
  const close = extractFunction(app, "closeProfilePhotoPreview", "buildProfilePhotoAccessPayload");
  const click = extractFunction(app, "handleProfilePhotoPreviewClick", "handleProfilePhotoPreviewKeydown");
  const keydown = extractFunction(app, "handleProfilePhotoPreviewKeydown", "openProfilePhotoPreview");
  assert.match(open, /if \(!currentSession/);
  assert.match(open, /profilePhotoThumbnails\.get\(key\)/);
  assert.match(open, /profilePhotoFullImages\.get\(key\)/);
  assert.match(open, /profilePhotoModalImage\.src = fullDataUri \|\| thumbnailDataUri/);
  assert.match(open, /Memuatkan foto penuh/);
  assert.match(open, /await loadFullProfilePhotoForStudent\(studentId, options\)/);
  assert.match(open, /Foto penuh gagal dimuatkan/);
  assert.match(open, /profilePhotoModalName\.textContent = studentName/);
  assert.match(open, /profilePhotoModalMeta\.textContent = studentMeta/);
  assert.match(open, /document\.body\.style\.overflow = "hidden"/);
  assert.match(click, /event\.target === els\.profilePhotoModal/);
  assert.match(click, /#profilePhotoModalRetry/);
  assert.match(click, /profilePhotoModalClose/);
  assert.match(keydown, /event\.key === "Escape"/);
  assert.match(keydown, /event\.key === "Tab"[\s\S]*profilePhotoModalClose\.focus\(\)/);
  assert.match(close, /removeAttribute\("src"\)/);
  assert.match(close, /document\.body\.style\.overflow = profilePhotoPreviewBodyOverflow/);
  assert.match(close, /trigger\.focus\(\)/);
});

test("full-image loader requests one student once and reuses its session cache", async () => {
  const calls = [];
  const context = vm.createContext({
    Map, Set,
    currentSession: { role: "admin" },
    isLiveMode: true,
    profilePhotoFullImages: new Map(),
    profilePhotoFullLoadedKeys: new Set(),
    profilePhotoFullPendingRequests: new Map(),
    profilePhotoCacheVersions: new Map(),
    profilePhotoSessionGeneration: 0,
    buildProfilePhotoAccessPayload: (ids) => ({ student_ids: ids }),
    apiPost: async (action, payload) => {
      calls.push([action, payload.student_ids, payload.photo_variant]);
      return { photos: [{ student_id: "A2-002", photo_data_uri: "data:image/jpeg;base64,RlVMTA==" }] };
    }
  });
  vm.runInContext("let currentSession = globalThis.currentSession; let isLiveMode = globalThis.isLiveMode; let profilePhotoFullImages = globalThis.profilePhotoFullImages; let profilePhotoFullLoadedKeys = globalThis.profilePhotoFullLoadedKeys; let profilePhotoFullPendingRequests = globalThis.profilePhotoFullPendingRequests; let profilePhotoCacheVersions = globalThis.profilePhotoCacheVersions; let profilePhotoSessionGeneration = globalThis.profilePhotoSessionGeneration;", context);
  vm.runInContext(extractFunction(app, "profilePhotoCacheKey", "invalidateProfilePhotoCaches"), context);
  vm.runInContext(extractFunction(app, "safeProfilePhotoDataUri", "profilePhotoMarkup"), context);
  vm.runInContext(extractFunction(app, "loadFullProfilePhotoForStudent", "warnProfilePhotoBatchFailure"), context);

  const [first, concurrent] = await Promise.all([
    context.loadFullProfilePhotoForStudent(" A2-002 "),
    context.loadFullProfilePhotoForStudent("A2-002")
  ]);
  const second = await context.loadFullProfilePhotoForStudent("A2-002");
  assert.equal(first.photo_data_uri, "data:image/jpeg;base64,RlVMTA==");
  assert.equal(concurrent.photo_data_uri, first.photo_data_uri);
  assert.equal(second.photo_data_uri, first.photo_data_uri);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [["getStudentProfilePhotos", ["A2-002"], "full"]]);
});

test("operational consumers never bulk-request full images and mutations invalidate both caches", () => {
  for (const loaderName of ["loadAdminMonitoringV210", "loadAdminStudentsV200", "loadTodayRecords", "refreshGuardRecords", "loadWardenRecords"]) {
    const start = app.search(new RegExp(`(?:async\\s+)?function ${loaderName}`));
    assert.notEqual(start, -1, `${loaderName} must exist`);
    const next = app.slice(start + 1).search(/\n(?:async\s+)?function /);
    const source = app.slice(start, next === -1 ? app.length : start + 1 + next);
    assert.doesNotMatch(source, /loadFullProfilePhotoForStudent/);
    if (/ProfilePhoto/.test(source)) assert.match(source, /loadProfilePhotoThumbnailsForStudents/);
  }
  const invalidation = extractFunction(app, "invalidateProfilePhotoCaches", "clearProfilePhotoSessionCaches");
  assert.match(invalidation, /profilePhotoThumbnails\.delete/);
  assert.match(invalidation, /profilePhotoFullImages\.delete/);
  assert.match(extractFunction(app, "removeAdminStudentProfilePhoto", "setupStaffPinFields"), /invalidateProfilePhotoCaches/);
  assert.match(extractFunction(app, "handleStudentProfilePhotoSelection", "compressStudentProfilePhoto"), /invalidateProfilePhotoCaches/);
});

test("delegated preview interaction survives Admin rerenders across every authorised role", () => {
  const listeners = { click: [], keydown: [] };
  const modal = { hidden: true, dataset: {}, closest: () => null };
  const closeButton = {
    focused: false,
    closest: (selector) => selector === "#profilePhotoModalClose" ? closeButton : null,
    focus() { this.focused = true; }
  };
  const image = {
    alt: "",
    src: "",
    removeAttribute(name) { if (name === "src") this.src = ""; }
  };
  const name = { textContent: "" };
  const meta = { hidden: false, textContent: "" };
  const body = { style: { overflow: "" } };
  const documentMock = {
    body,
    addEventListener(type, handler) { listeners[type].push(handler); },
    contains: () => true
  };
  const thumbnailCache = new Map();
  const fullCache = new Map();
  const status = { hidden: true, textContent: "" };
  const retry = { hidden: true, closest: (selector) => selector === "#profilePhotoModalRetry" ? retry : null };
  const context = vm.createContext({
    Map,
    currentSession: { role: "admin" },
    document: documentMock,
    els: {
      profilePhotoModal: modal,
      profilePhotoModalClose: closeButton,
      profilePhotoModalImage: image,
      profilePhotoModalName: name,
      profilePhotoModalMeta: meta,
      profilePhotoModalStatus: status,
      profilePhotoModalRetry: retry
    },
    escapeHtml: (value) => String(value),
    openAdminStudentEditEditorV200: () => {},
    loadAdminStudentsV200: () => {},
    removeAdminStudentProfilePhoto: () => {},
    profilePhotoThumbnails: thumbnailCache,
    profilePhotoFullImages: fullCache,
    loadFullProfilePhotoForStudent: async () => ({ photo_data_uri: "data:image/jpeg;base64,RlVMTA==" }),
    toggleAdminStudentStatusV200: () => {},
    profilePhotoPreviewTrigger: null,
    profilePhotoPreviewBodyOverflow: ""
  });
  vm.runInContext([
    extractFunction(app, "profilePhotoCacheKey", "profilePhotoInitials"),
    extractFunction(app, "profilePhotoInitials", "safeProfilePhotoDataUri"),
    extractFunction(app, "safeProfilePhotoDataUri", "profilePhotoMarkup"),
    extractFunction(app, "profilePhotoMarkup", "setupProfilePhotoPreview"),
    extractFunction(app, "setupProfilePhotoPreview", "handleProfilePhotoPreviewClick"),
    extractFunction(app, "handleProfilePhotoPreviewClick", "handleProfilePhotoPreviewKeydown"),
    extractFunction(app, "handleProfilePhotoPreviewKeydown", "openProfilePhotoPreview"),
    extractFunction(app, "openProfilePhotoPreview", "closeProfilePhotoPreview"),
    extractFunction(app, "closeProfilePhotoPreview", "buildProfilePhotoAccessPayload"),
    extractFunction(app, "handleAdminStudentListActionV200", "openAdminStudentCreateEditorV200")
  ].join("\n"), context);

  context.setupProfilePhotoPreview();
  context.setupProfilePhotoPreview();
  assert.equal(listeners.click.length, 1, "preview delegation must be installed exactly once");
  assert.equal(listeners.keydown.length, 1);

  const dataUri = "data:image/jpeg;base64,QUJDRA==";
  thumbnailCache.set("a2-002", { photo_data_uri: dataUri });
  const createTrigger = () => ({
    dataset: {
      profilePhotoPreview: " A2-002 ",
      profilePhotoName: "Pelajar Admin",
      profilePhotoMeta: "A2 · A2-002"
    },
    focused: false,
    closest(selector) { return selector === "[data-profile-photo-preview]" ? this : null; },
    focus() { this.focused = true; }
  });

  const firstTrigger = createTrigger();
  const firstImage = { closest: (selector) => selector === "[data-profile-photo-preview]" ? firstTrigger : null };
  const adminEvent = { target: firstImage };
  context.handleAdminStudentListActionV200(adminEvent);
  listeners.click[0](adminEvent);
  assert.equal(modal.hidden, false);
  assert.equal(image.src, dataUri);
  assert.equal(name.textContent, "Pelajar Admin");
  assert.equal(meta.textContent, "A2 · A2-002");
  assert.equal(body.style.overflow, "hidden");

  listeners.click[0]({ target: closeButton });
  assert.equal(modal.hidden, true);
  assert.equal(image.src, "");
  assert.equal(firstTrigger.focused, true);

  const rerenderedMarkup = context.profilePhotoMarkup("A2-002", "Pelajar Admin", "profile-photo-thumbnail", "A2 · A2-002");
  assert.match(rerenderedMarkup, /data-profile-photo-preview="A2-002"/);
  const rerenderedTrigger = createTrigger();
  listeners.click[0]({ target: rerenderedTrigger });
  assert.equal(modal.hidden, false, "a newly rendered Admin trigger must use the same delegated listener");

  listeners.keydown[0]({ key: "Escape", preventDefault() {} });
  assert.equal(modal.hidden, true);
  listeners.click[0]({ target: rerenderedTrigger });
  listeners.click[0]({ target: modal });
  assert.equal(modal.hidden, true, "backdrop click must close the modal");

  for (const role of ["student", "warden", "guard"]) {
    context.currentSession = { role };
    listeners.click[0]({ target: createTrigger() });
    assert.equal(modal.hidden, false, `${role} must retain authorised cached preview behavior`);
    context.closeProfilePhotoPreview();
  }

  context.currentSession = null;
  listeners.click[0]({ target: createTrigger() });
  assert.equal(modal.hidden, true, "an unauthenticated trigger cannot open a cached photo");
  thumbnailCache.delete("a2-002");
  assert.doesNotMatch(context.profilePhotoMarkup("A2-002", "Tiada Foto"), /data-profile-photo-preview/);
});

test("Admin photo indicators intentionally rerender after the single asynchronous batch", () => {
  const loader = extractFunction(app, "loadAdminStudentsV200", "setAdminStudentsBusyV200");
  const consumers = extractFunction(app, "renderProfilePhotoConsumers", "renderStudentProfilePhotoArea");
  assert.ok(loader.indexOf("renderAdminStudentsV200()") < loader.indexOf("loadProfilePhotoThumbnailsForStudents("));
  assert.match(loader, /filter\(\(student\) => student\.has_profile_photo\)/);
  assert.match(consumers, /currentSession\.role === "admin"[\s\S]*activeAdminSectionV200 === "students"[\s\S]*renderAdminStudentsV200\(\)/);
  assert.match(extractFunction(app, "openProfilePhotoPreview", "closeProfilePhotoPreview"), /loadFullProfilePhotoForStudent/);
});

test("preview remains absent from public monitoring and does not expose Drive identifiers", () => {
  const publicMonitoring = extractFunction(gas, "getTodayRecords", "getOperationalTodayRecords");
  const frontendPreview = [
    extractFunction(app, "profilePhotoMarkup", "setupProfilePhotoPreview"),
    extractFunction(app, "openProfilePhotoPreview", "closeProfilePhotoPreview")
  ].join("\n");
  assert.doesNotMatch(publicMonitoring, /profile-photo-preview|photo_data_uri|photo_file_id|drive/i);
  assert.doesNotMatch(frontendPreview, /photo_file_id|drive\.google|drive\/d\/|file_id/);
  assert.doesNotMatch(html.slice(html.indexOf('id="publicMonitoringPanel"'), html.indexOf('id="appWorkspace"')), /profilePhoto|profile-photo-preview/i);
});

test("Warden and Guard operational cards render compact photos and neutral placeholders", () => {
  const card = extractFunction(app, "recordCard", "guardReturnCard");
  const guardReturn = extractFunction(app, "guardReturnCard", "getGuardReturnTiming");
  assert.match(card, /profilePhotoMarkup/);
  assert.match(guardReturn, /profilePhotoMarkup/);
  assert.match(app, /profile-photo-placeholder/);
  assert.match(css, /\.profile-photo-frame[\s\S]*?aspect-ratio:\s*3 \/ 4/);
  assert.match(css, /flex:\s*0 0 64px/);
  assert.match(css, /object-fit:\s*cover/);
  assert.match(css, /#guardOvernightNotReturnedSection[\s\S]*?repeat\(2/);
  assert.match(card, /\$\{actions\}/);
  assert.match(guardReturn, /\$\{actions\}/);
});

test("Admin thumbnail removal requires confirmation, authentication and a safe audit", () => {
  assert.match(app, /data-admin-student-photo-remove/);
  const clientRemoval = extractFunction(app, "removeAdminStudentProfilePhoto", "setupStaffPinFields");
  assert.match(clientRemoval, /window\.confirm/);
  assert.match(clientRemoval, /buildAdminCredentialPayloadV200/);
  const serverRemoval = extractFunction(gas, "removeStudentProfilePhoto", "getTodayRecords");
  assert.match(serverRemoval, /validateAdminCredentials_/);
  assert.match(serverRemoval, /photo_file_id:\s*""/);
  assert.match(serverRemoval, /safelyTrashProfilePhoto_/);
  assert.match(serverRemoval, /REMOVE_STUDENT_PROFILE_PHOTO/);
  assert.doesNotMatch(serverRemoval, /base64|photo_data_uri/);
});

test("profile photos stay separate from return selfies, Telegram and public Drive sharing", () => {
  const upload = extractFunction(gas, "submitStudentProfilePhoto", "validateProfilePhotoViewer_");
  assert.doesNotMatch(upload, /selfie_|sendTelegram|telegram/i);
  assert.doesNotMatch(gas, /setSharing\s*\(/);
  assert.match(gas, /SELFIE_FOLDER_ID/);
  assert.match(gas, /PROFILE_PHOTO_FOLDER_ID/);
  assert.match(app, /submitReturnSelfie/);
  assert.match(app, /confirmOut/);
  assert.match(app, /confirmIn/);
});
