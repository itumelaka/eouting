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
  assert.match(batch, /photo_data_uri/);
  assert.doesNotMatch(batch, /photo_file_id:\s*student\.photo_file_id/);
  assert.match(app, /apiPost\("getStudentProfilePhotos"/);
  const adminLoader = extractFunction(app, "loadAdminStudentsV200", "setAdminStudentsBusyV200");
  assert.match(adminLoader, /filter\(\(student\) => student\.has_profile_photo\)/);
  assert.match(adminLoader, /map\(\(student\) => student\.student_id\)/);
});

test("frontend cache canonicalizes every profile-photo store, read and delete", () => {
  const context = vm.createContext({});
  vm.runInContext(extractFunction(app, "profilePhotoCacheKey", "profilePhotoInitials"), context);
  assert.equal(context.profilePhotoCacheKey(" A2-002 "), "a2-002");
  assert.equal(context.profilePhotoCacheKey("a2-002"), "a2-002");

  const cacheOperations = Array.from(app.matchAll(/studentProfilePhotos\.(?:get|set|delete)\(([^\n;]+)/g), (match) => match[1]);
  assert.ok(cacheOperations.length >= 5);
  cacheOperations.forEach((operation) => assert.match(operation, /profilePhotoCacheKey\(/));
  const markup = extractFunction(app, "profilePhotoMarkup", "buildProfilePhotoAccessPayload");
  assert.match(markup, /profile-photo-placeholder/);
});

test("batch failures stay non-blocking, rate-limited and free of sensitive diagnostics", () => {
  const loader = extractFunction(app, "loadProfilePhotosForStudents", "warnProfilePhotoBatchFailure");
  const warning = extractFunction(app, "warnProfilePhotoBatchFailure", "renderProfilePhotoConsumers");
  assert.equal((loader.match(/apiPost\("getStudentProfilePhotos"/g) || []).length, 1);
  assert.match(loader, /catch \(error\)[\s\S]*warnProfilePhotoBatchFailure\(error\)/);
  assert.doesNotMatch(loader, /throw error|showError|showToast/);
  assert.match(warning, /60000/);
  assert.match(warning, /Profile photo batch request failed/);
  assert.match(warning, /error_type:\s*safeType/);
  assert.doesNotMatch(warning, /student|photo_file_id|photo_data_uri|credential|image_base64|error\.message/i);
});

test("Student UI compresses to a 3:4 JPEG and preserves the current photo on failure", () => {
  assert.match(html, /id="studentProfilePhotoInput"[^>]*accept="image\/jpeg,image\/png,image\/webp"/s);
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
