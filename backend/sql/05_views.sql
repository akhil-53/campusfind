CREATE OR REPLACE VIEW v_faculty_queue AS
SELECT a.assignment_id, a.assigned_to, a.assignment_type, a.level, a.assigned_at, a.due_at,
       (a.due_at < now()) AS is_overdue,
       r.report_id, r.status AS report_status, r.description, r.color, r.brand, r.identifying_marks,
       r.lost_from, r.lost_to, c.category_name, l.room_name,
       s.full_name AS student_name, s.reg_no,
       (SELECT COUNT(*) FROM matches m WHERE m.report_id = r.report_id
          AND m.status IN ('SUGGESTED','SHORTLISTED')) AS open_matches
FROM assignments a
JOIN lost_reports r ON r.report_id = a.report_id
JOIN categories c  ON c.category_id = r.category_id
JOIN locations l   ON l.location_id = r.location_id
JOIN users s       ON s.user_id = r.student_id
WHERE a.status = 'ACTIVE';

CREATE OR REPLACE VIEW v_report_matches AS
SELECT m.match_id, m.report_id, m.score, m.source, m.status AS match_status, m.created_at,
       f.found_id, f.description, f.color, f.brand, f.shelf_code, f.found_at, f.status AS item_status,
       l.room_name
FROM matches m
JOIN found_items f ON f.found_id = m.found_id
JOIN locations l   ON l.location_id = f.location_id;

CREATE OR REPLACE VIEW v_not_found_cases AS
SELECT r.report_id, u.reg_no, u.full_name, c.category_name, l.room_name,
       r.description, r.color, r.brand, r.lost_from, r.lost_to, r.not_found_at,
       r.not_found_at + make_interval(days => fn_setting('visit_window_days','7')::INT) AS visit_deadline
FROM lost_reports r
JOIN users u      ON u.user_id = r.student_id
JOIN categories c ON c.category_id = r.category_id
JOIN locations l  ON l.location_id = r.location_id
WHERE r.status = 'NOT_FOUND';

CREATE OR REPLACE VIEW v_overdue_cases AS
SELECT a.assignment_id, a.report_id, a.assignment_type, a.level, a.due_at,
       u.full_name AS assignee, d.title AS designation, (u.reports_to_id IS NULL) AS at_top
FROM assignments a
JOIN users u ON u.user_id = a.assigned_to
LEFT JOIN designations d ON d.designation_id = u.designation_id
WHERE a.status = 'ACTIVE' AND a.due_at < now();

CREATE OR REPLACE VIEW v_escalation_history AS
SELECT a.report_id, a.level, a.assignment_type, u.full_name AS assignee, d.title AS designation,
       a.status, a.assigned_at, a.due_at, a.closed_at
FROM assignments a
JOIN users u ON u.user_id = a.assigned_to
LEFT JOIN designations d ON d.designation_id = u.designation_id;

CREATE OR REPLACE VIEW v_theft_cases AS
SELECT a.assigned_to, a.due_at, r.report_id, u.reg_no, u.full_name AS student_name,
       r.description, l.room_name, r.lost_from, r.lost_to, rv.notes AS cctv_notes, rv.visited_at
FROM assignments a
JOIN lost_reports r ON r.report_id = a.report_id
JOIN users u        ON u.user_id = r.student_id
JOIN locations l    ON l.location_id = r.location_id
LEFT JOIN LATERAL (SELECT notes, visited_at FROM room_visits
                   WHERE report_id = r.report_id AND cctv_outcome = 'THEFT_SUSPECTED'
                   ORDER BY visited_at DESC LIMIT 1) rv ON TRUE
WHERE a.assignment_type = 'THEFT_TRACKING' AND a.status = 'ACTIVE';

CREATE OR REPLACE VIEW v_hierarchy AS
WITH RECURSIVE tree AS (
  SELECT u.user_id, u.full_name, u.reports_to_id, d.title, 1 AS depth, ARRAY[u.user_id] AS path
  FROM users u JOIN roles r ON r.role_id = u.role_id
  LEFT JOIN designations d ON d.designation_id = u.designation_id
  WHERE r.role_name = 'FACULTY' AND u.reports_to_id IS NULL
  UNION ALL
  SELECT u.user_id, u.full_name, u.reports_to_id, d.title, t.depth + 1, t.path || u.user_id
  FROM users u JOIN tree t ON u.reports_to_id = t.user_id
  LEFT JOIN designations d ON d.designation_id = u.designation_id
)
SELECT * FROM tree;

CREATE OR REPLACE VIEW v_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM lost_reports WHERE status IN ('OPEN','ASSIGNED','VISIT_SCHEDULED')) AS active_reports,
  (SELECT COUNT(*) FROM lost_reports WHERE status = 'NOT_FOUND')       AS not_found,
  (SELECT COUNT(*) FROM lost_reports WHERE status = 'RETURNED')        AS returned,
  (SELECT COUNT(*) FROM lost_reports WHERE status = 'THEFT_FORWARDED') AS theft_forwarded,
  (SELECT COUNT(*) FROM assignments  WHERE status = 'ACTIVE' AND due_at < now()) AS overdue,
  (SELECT COUNT(*) FROM found_items  WHERE status = 'AVAILABLE')       AS items_in_room,
  (SELECT COUNT(*) FROM found_items  WHERE unclaimed_flagged_at IS NOT NULL
                                       AND status = 'AVAILABLE')     AS flagged_items;
