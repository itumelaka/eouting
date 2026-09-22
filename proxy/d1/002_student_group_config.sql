CREATE TABLE IF NOT EXISTS STUDENT_GROUPS (
  group_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  institution_required INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS LI_INSTITUTIONS (
  institution_code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  config_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  created_by TEXT,
  updated_at TEXT,
  updated_by TEXT
);
