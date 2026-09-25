-- V3 core schema baseline for a new D1 database.
-- WARDENS.email, WARDENS.no_tel, and WARDENS.catatan are deliberately added
-- by migration 006_warden_staff_profile_fields.sql, not by this baseline.
-- This file must not contain production data or credential values.
-- Migration 003_student_group_config_seed.sql is seed/config, not core schema.

CREATE TABLE WARDENS (
  warden_id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AKTIF',
  pin TEXT
);

CREATE TABLE GUARDS (
  guard_id TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  email TEXT,
  no_tel TEXT,
  pin TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif',
  catatan TEXT
);

CREATE TABLE STUDENTS (
  student_id TEXT PRIMARY KEY,
  no_matrik TEXT NOT NULL,
  nama TEXT NOT NULL,
  email TEXT,
  no_tel TEXT,
  kelas TEXT,
  jantina TEXT,
  status TEXT NOT NULL DEFAULT 'Aktif',
  catatan TEXT,
  photo_file_id TEXT,
  photo_updated_at TEXT,
  institution_code TEXT
);

CREATE TABLE OUTING_REQUESTS (
  request_id TEXT PRIMARY KEY,
  tarikh TEXT,
  hari TEXT,
  jenis_permohonan TEXT NOT NULL,
  student_id TEXT NOT NULL,
  no_matrik TEXT,
  nama TEXT NOT NULL,
  student_email TEXT,
  kelas TEXT,
  tujuan TEXT,
  lokasi TEXT,
  jenis_kenderaan TEXT,
  butiran_kenderaan TEXT,
  sebab_kecemasan TEXT,
  telefon_waris TEXT,
  hubungan_waris TEXT,
  catatan_kecemasan TEXT,
  masa_mohon TEXT NOT NULL,
  status TEXT NOT NULL,
  warden_approve_by TEXT,
  masa_approve TEXT,
  masa_keluar TEXT,
  guard_keluar_by TEXT,
  masa_masuk TEXT,
  guard_masuk_by TEXT,
  lewat TEXT,
  selfie_whatsapp TEXT,
  catatan TEXT,
  tarikh_balik TEXT,
  hari_balik TEXT,
  masa_balik_dijangka TEXT,
  selfie_status TEXT,
  selfie_file_id TEXT,
  selfie_url TEXT,
  masa_selfie TEXT,
  selfie_telegram_message_id TEXT,
  sebab_batal_pelajar TEXT,
  masa_batal_pelajar TEXT,
  dibatalkan_oleh TEXT
);

CREATE TABLE OUTING_TYPES (
  type_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER,
  allowed_days TEXT,
  application_open_time TEXT,
  application_close_time TEXT,
  fixed_return_time TEXT,
  same_day_only INTEGER NOT NULL DEFAULT 0,
  require_leave_date INTEGER NOT NULL DEFAULT 0,
  require_return_date INTEGER NOT NULL DEFAULT 0,
  require_return_time INTEGER NOT NULL DEFAULT 0,
  require_guardian_phone INTEGER NOT NULL DEFAULT 0,
  require_guardian_relation INTEGER NOT NULL DEFAULT 0,
  require_emergency_reason INTEGER NOT NULL DEFAULT 0,
  require_purpose INTEGER NOT NULL DEFAULT 0,
  require_location INTEGER NOT NULL DEFAULT 0,
  require_vehicle INTEGER NOT NULL DEFAULT 0,
  require_warden_approval INTEGER NOT NULL DEFAULT 1,
  require_selfie INTEGER NOT NULL DEFAULT 1,
  config_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT,
  departure_allowed_days TEXT,
  earliest_departure_time TEXT,
  application_open_date TEXT,
  application_close_date TEXT
);

CREATE TABLE AUDIT_LOG (
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,
  request_id TEXT,
  user_role TEXT,
  user_name TEXT,
  details TEXT,
  entity_type TEXT,
  entity_id TEXT
);

CREATE INDEX idx_outing_student_id
ON OUTING_REQUESTS(student_id);

CREATE INDEX idx_outing_status
ON OUTING_REQUESTS(status);

CREATE INDEX idx_outing_masa_mohon
ON OUTING_REQUESTS(masa_mohon);

CREATE INDEX idx_outing_tarikh
ON OUTING_REQUESTS(tarikh);

CREATE UNIQUE INDEX idx_outing_active_student_unique
ON OUTING_REQUESTS(student_id)
WHERE status IN (
  'MENUNGGU_KELULUSAN',
  'DILULUSKAN_WARDEN',
  'KELUAR'
);

CREATE UNIQUE INDEX idx_outing_active_no_matrik_unique
ON OUTING_REQUESTS(no_matrik)
WHERE status IN (
  'MENUNGGU_KELULUSAN',
  'DILULUSKAN_WARDEN',
  'KELUAR'
)
AND no_matrik IS NOT NULL
AND TRIM(no_matrik) <> '';
