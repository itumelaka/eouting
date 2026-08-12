const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets", "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "style.css"), "utf8");

function sourceBetween(start, end) {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from);
  assert.notEqual(from, -1, `${start} must exist`);
  assert.notEqual(to, -1, `${end} must exist`);
  return app.slice(from, to);
}

test("Student photo action sheet offers camera, gallery and cancel actions", () => {
  assert.match(html, /id="profilePhotoSourceModal"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*hidden/s);
  assert.match(html, /id="profilePhotoCameraButton"[^>]*type="button"[^>]*>Ambil Foto</);
  assert.match(html, /id="profilePhotoGalleryButton"[^>]*type="button"[^>]*>Pilih dari Galeri</);
  assert.match(html, /id="profilePhotoSourceCancel"[^>]*type="button"[^>]*>Batal</);
  assert.match(css, /\.profile-photo-source-modal[\s\S]*position:\s*fixed/);
});

test("camera prefers the selfie camera while gallery never forces capture", () => {
  const camera = html.match(/<input id="studentProfilePhotoCameraInput"[^>]*>/s)[0];
  const gallery = html.match(/<input id="studentProfilePhotoGalleryInput"[^>]*>/s)[0];
  assert.match(camera, /type="file"/);
  assert.match(camera, /accept="image\/\*"/);
  assert.match(camera, /capture="user"/);
  assert.match(gallery, /type="file"/);
  assert.match(gallery, /accept="image\/\*"/);
  assert.doesNotMatch(gallery, /capture=/);
});

test("both inputs share the existing validation, compression and upload handler", () => {
  const setup = sourceBetween("function setupStudentProfilePhotoControls", "function openProfilePhotoSourceChooser");
  const selection = sourceBetween("async function handleStudentProfilePhotoSelection", "async function compressStudentProfilePhoto");
  assert.match(setup, /\[els\.studentProfilePhotoCameraInput, els\.studentProfilePhotoGalleryInput\]/);
  assert.match(setup, /addEventListener\("change", handleStudentProfilePhotoSelection\)/);
  assert.equal((app.match(/async function handleStudentProfilePhotoSelection/g) || []).length, 1);
  assert.match(selection, /image\/jpeg/);
  assert.match(selection, /image\/png/);
  assert.match(selection, /image\/webp/);
  assert.match(selection, /2 \* 1024 \* 1024/);
  assert.match(selection, /compressStudentProfilePhoto\(file\)/);
  assert.match(selection, /apiPost\("submitStudentProfilePhoto"/);
  assert.match(selection, /invalidateProfilePhotoCaches/);
  assert.match(selection, /finally[\s\S]*studentProfileUploadInFlight = false[\s\S]*input\.value = ""/);
});

test("cancel, backdrop and Escape close cleanly and restore focus", () => {
  const chooser = sourceBetween("function openProfilePhotoSourceChooser", "function profilePhotoCacheKey");
  assert.match(chooser, /profilePhotoSourceModal\.hidden = false/);
  assert.match(chooser, /function closeProfilePhotoSourceChooser[\s\S]*profilePhotoSourceModal\.hidden = true/);
  assert.match(chooser, /trigger[\s\S]*trigger\.focus\(\)/);
  assert.match(chooser, /event\.key === "Escape"[\s\S]*closeProfilePhotoSourceChooser\(\)/);
  const setup = sourceBetween("function setupStudentProfilePhotoControls", "function openProfilePhotoSourceChooser");
  assert.match(setup, /profilePhotoSourceCancel\.addEventListener\("click", closeProfilePhotoSourceChooser\)/);
  assert.match(setup, /event\.target === els\.profilePhotoSourceModal/);
});

test("camera/gallery cancellation and all upload outcomes cannot leave a stuck upload state", () => {
  const chooser = sourceBetween("function openProfilePhotoSourceChooser", "function profilePhotoCacheKey");
  const selection = sourceBetween("async function handleStudentProfilePhotoSelection", "async function compressStudentProfilePhoto");
  assert.match(chooser, /input\.value = ""[\s\S]*closeProfilePhotoSourceChooser\(\)[\s\S]*input\.click\(\)/);
  assert.match(selection, /if \(!file \|\| studentProfileUploadInFlight/);
  assert.match(selection, /input\.value = ""[\s\S]*Pilih fail JPEG, PNG atau WebP/);
  assert.match(selection, /catch \(error\)[\s\S]*classList\.add\("error"\)/);
  assert.match(selection, /finally[\s\S]*studentProfileUploadInFlight = false[\s\S]*renderStudentProfilePhotoArea\(\)/);
});

test("return-selfie capture and processing remain a separate unchanged workflow", () => {
  const selfieMarkup = sourceBetween("function returnSelfieProofHtml", "function bindStudentReturnSelfieControls");
  const profileSetup = sourceBetween("function setupStudentProfilePhotoControls", "function profilePhotoCacheKey");
  assert.match(selfieMarkup, /class="return-selfie-input"[^>]*type="file"[^>]*accept="image\/\*"[^>]*capture="user"/s);
  assert.match(app, /function previewReturnSelfie/);
  assert.doesNotMatch(profileSetup, /returnSelfie|return-selfie|submitReturnSelfie/);
});
