CREATE TABLE IF NOT EXISTS MIRROR_RETRY_QUEUE (
  request_id TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  first_failed_at TEXT NOT NULL,
  last_attempt_at TEXT,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mirror_retry_queue_next_attempt
ON MIRROR_RETRY_QUEUE (next_attempt_at);
