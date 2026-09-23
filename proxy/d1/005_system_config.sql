CREATE TABLE IF NOT EXISTS SYSTEM_CONFIG (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TEXT,
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_system_config_updated_at
ON SYSTEM_CONFIG (updated_at);
