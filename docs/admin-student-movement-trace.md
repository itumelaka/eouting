# Admin Student Movement Trace V1

Enhancement to production eOuting v2.4.0; authority remains GAS/Google Sheets. No version, permissions, lifecycle or migration changes.

POST action getAdminStudentMovementTrace accepts existing Admin credentials (admin_id or nama_admin/admin_name/name, and pin), student_id, start_date and end_date (strict YYYY-MM-DD). Student must exist in master data. Dates inclusive, end >= start, maximum 366 calendar days. Filtering uses exact trimmed student_id and normalized request tarikh; all statuses included. Ascending tarikh, exit timestamp, request ID. No pagination/truncation.

Response uses existing GAS JSON envelope: student {student_id,name,class}, period {start_date,end_date}, generated_at, summary {total_records,completed_outings,total_duration_minutes,total_duration_label}, records [{request_id,tarikh,jenis_permohonan,tujuan,lokasi,masa_keluar,masa_masuk,status,duration_minutes,duration_label}]. Invalid/missing timestamp pairs yield null duration_minutes and empty label, excluded from totals. Valid durations use whole recorded outing, not clipped to period; completed_outings counts SELESAI.

Existing Admin authentication and error envelope apply; POST only, no public route. Browser print offers A4 landscape report; no GAS PDF/Drive access. All dynamic values escaped. Report represents recorded eOuting movements only: absence of records is not proof of physical presence on campus.

Master Records pagination/text search and completed-only monthly statistics cannot supply this report directly; dedicated minimal projection reuses auth, date and duration helpers without extra urgency/staff lookups. D1 staging remains untouched; parity is a future follow-up before any cutover. Mock QA supports an authenticated empty report.
