INSERT INTO STUDENT_GROUPS (
  group_code, display_name, institution_required, active,
  sort_order, config_version, created_at, created_by, updated_at, updated_by
) VALUES
  ('A2','A2',0,1,10,1,'2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4','2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4'),
  ('A3','A3',0,1,20,1,'2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4','2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4'),
  ('LI','LI',1,1,30,7,'2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4','2026-09-21 10:38:23','Admin'),
  ('TEST','Test Sahaja',0,1,40,1,'2026-08-26 17:01:44','Admin','2026-08-26 17:01:44','Admin'),
  ('UNISZA','LI',1,1,50,4,'2026-09-21 08:49:04','Admin','2026-09-21 11:59:58','Admin')
ON CONFLICT(group_code) DO UPDATE SET
  display_name=excluded.display_name,
  institution_required=excluded.institution_required,
  active=excluded.active,
  sort_order=excluded.sort_order,
  config_version=excluded.config_version,
  updated_at=excluded.updated_at,
  updated_by=excluded.updated_by;

INSERT INTO LI_INSTITUTIONS (
  institution_code, display_name, active,
  sort_order, config_version, created_at, created_by, updated_at, updated_by
) VALUES
  ('UMK','UMK',0,10,5,'2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4','2026-08-28 21:28:45','Admin'),
  ('UPM','UPM',0,20,5,'2026-08-22 13:06:24','SYSTEM_MIGRATION_V2.4','2026-09-11 21:56:53','Admin'),
  ('TESTTING','Testing',1,30,1,'2026-08-26 17:00:57','Admin','2026-08-26 17:00:57','Admin'),
  ('UNISZA','UNISZA',1,40,1,'2026-09-21 08:48:31','Admin','2026-09-21 08:48:31','Admin')
ON CONFLICT(institution_code) DO UPDATE SET
  display_name=excluded.display_name,
  active=excluded.active,
  sort_order=excluded.sort_order,
  config_version=excluded.config_version,
  updated_at=excluded.updated_at,
  updated_by=excluded.updated_by;
