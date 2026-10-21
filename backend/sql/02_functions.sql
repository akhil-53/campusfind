CREATE OR REPLACE FUNCTION fn_actor() RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::INT
$$;

CREATE OR REPLACE FUNCTION fn_setting(p_key TEXT, p_default TEXT) RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT setting_value FROM system_settings WHERE setting_key = p_key), p_default)
$$;

CREATE OR REPLACE FUNCTION fn_review_due() RETURNS TIMESTAMPTZ LANGUAGE sql STABLE AS $$
  SELECT now() + make_interval(mins => fn_setting('review_deadline_minutes', '2880')::INT)
$$;

CREATE OR REPLACE FUNCTION fn_notify(p_user INT, p_title TEXT, p_msg TEXT, p_link TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO notifications(user_id, title, message, link)
  SELECT p_user, p_title, p_msg, p_link WHERE p_user IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION fn_audit(p_action TEXT, p_entity TEXT, p_id INT, p_details JSONB DEFAULT NULL)
RETURNS VOID LANGUAGE sql AS $$
  INSERT INTO audit_logs(user_id, action, entity_name, entity_id, details)
  VALUES (fn_actor(), p_action, p_entity, p_id, p_details)
$$;

-- Score 0..100: location 25, time 25 (10 if within 7 days), text similarity 40, colour 10
CREATE OR REPLACE FUNCTION fn_match_score(
  r_loc INT, r_from TIMESTAMPTZ, r_to TIMESTAMPTZ, r_text TEXT, r_color TEXT,
  f_loc INT, f_found TIMESTAMPTZ, f_text TEXT, f_color TEXT)
RETURNS INT LANGUAGE sql IMMUTABLE AS $$
  SELECT LEAST(100,
      CASE WHEN r_loc = f_loc THEN 25 ELSE 0 END
    + CASE WHEN f_found BETWEEN r_from AND r_to + interval '24 hours' THEN 25
           WHEN f_found BETWEEN r_from AND r_to + interval '7 days'   THEN 10 ELSE 0 END
    + ROUND(40 * similarity(lower(r_text), lower(f_text)))::INT
    + CASE WHEN r_color IS NOT NULL AND f_color IS NOT NULL
                AND lower(trim(r_color)) = lower(trim(f_color)) THEN 10 ELSE 0 END)
$$;

-- Least-loaded available level-1 faculty (ties -> lowest user_id)
CREATE OR REPLACE FUNCTION fn_pick_faculty() RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT u.user_id
  FROM users u
  JOIN roles r        ON r.role_id = u.role_id AND r.role_name = 'FACULTY'
  JOIN designations d ON d.designation_id = u.designation_id AND d.level_rank = 1
  LEFT JOIN assignments a ON a.assigned_to = u.user_id AND a.status = 'ACTIVE'
  WHERE u.is_active AND u.is_available
  GROUP BY u.user_id
  ORDER BY COUNT(a.assignment_id), u.user_id
  LIMIT 1
$$;

-- Assign a report that has no ACTIVE REVIEW assignment; prefer p_prefer if still active
CREATE OR REPLACE FUNCTION fn_assign_report(p_report INT, p_prefer INT DEFAULT NULL) RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_fac INT;
BEGIN
  IF EXISTS (SELECT 1 FROM assignments WHERE report_id = p_report
             AND assignment_type = 'REVIEW' AND status = 'ACTIVE') THEN
    RETURN NULL;
  END IF;
  SELECT u.user_id INTO v_fac FROM users u JOIN roles r ON r.role_id = u.role_id
   WHERE u.user_id = p_prefer AND r.role_name = 'FACULTY' AND u.is_active;
  IF v_fac IS NULL THEN v_fac := fn_pick_faculty(); END IF;
  IF v_fac IS NULL THEN RETURN NULL; END IF;
  INSERT INTO assignments(report_id, assigned_to, assignment_type, level, due_at)
  VALUES (p_report, v_fac, 'REVIEW', 1, fn_review_due());
  UPDATE lost_reports SET status = 'ASSIGNED' WHERE report_id = p_report AND status <> 'ASSIGNED';
  RETURN v_fac;
END $$;
