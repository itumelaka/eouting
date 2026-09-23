CREATE TABLE IF NOT EXISTS ADMIN_USERS (
  admin_id TEXT PRIMARY KEY,
  nama_admin TEXT NOT NULL,
  pin TEXT NOT NULL,
  status TEXT NOT NULL,
  catatan TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_users_nama_admin
ON ADMIN_USERS (nama_admin);

CREATE INDEX IF NOT EXISTS idx_admin_users_status
ON ADMIN_USERS (status);
