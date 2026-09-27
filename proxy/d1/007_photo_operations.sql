CREATE TABLE IF NOT EXISTS PHOTO_OPERATIONS (
  operation_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL,
  expected_old_file_id TEXT,
  expected_old_photo_updated_at TEXT,
  new_file_id TEXT,
  new_photo_updated_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photo_operations_student
ON PHOTO_OPERATIONS (student_id, created_at);

CREATE INDEX IF NOT EXISTS idx_photo_operations_status
ON PHOTO_OPERATIONS (status, updated_at);
