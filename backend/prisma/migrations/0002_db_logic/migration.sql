-- ==========================================
-- 02_functions.sql
-- ==========================================
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

-- ==========================================
-- 03_triggers.sql
-- ==========================================
CREATE OR REPLACE FUNCTION fn_touch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch   BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION fn_touch();

DROP TRIGGER IF EXISTS trg_reports_touch ON lost_reports;
CREATE TRIGGER trg_reports_touch BEFORE UPDATE ON lost_reports FOR EACH ROW EXECUTE FUNCTION fn_touch();

CREATE OR REPLACE FUNCTION fn_users_hierarchy() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_ok BOOLEAN;
BEGIN
  IF NEW.reports_to_id IS NULL THEN RETURN NEW; END IF;
  SELECT (r.role_name = 'FACULTY' AND m.is_active AND dm.level_rank > COALESCE(ds.level_rank, 0))
    INTO v_ok
  FROM users m JOIN roles r ON r.role_id = m.role_id
  LEFT JOIN designations dm ON dm.designation_id = m.designation_id
  LEFT JOIN designations ds ON ds.designation_id = NEW.designation_id
  WHERE m.user_id = NEW.reports_to_id;
  IF NOT COALESCE(v_ok, FALSE) THEN
    RAISE EXCEPTION 'reports_to must be an active faculty member with a higher designation'
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (
    WITH RECURSIVE chain(id) AS (
      SELECT NEW.reports_to_id
      UNION
      SELECT u.reports_to_id FROM users u JOIN chain c ON u.user_id = c.id WHERE u.reports_to_id IS NOT NULL)
    SELECT 1 FROM chain WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'Hierarchy cycle detected' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_hierarchy ON users;
CREATE TRIGGER trg_users_hierarchy BEFORE INSERT OR UPDATE OF reports_to_id, designation_id ON users
FOR EACH ROW EXECUTE FUNCTION fn_users_hierarchy();

CREATE OR REPLACE FUNCTION fn_assignment_check() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users u JOIN roles r ON r.role_id = u.role_id
                 WHERE u.user_id = NEW.assigned_to AND r.role_name = 'FACULTY' AND u.is_active) THEN
    RAISE EXCEPTION 'Assignee % is not an active faculty member', NEW.assigned_to;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_assignment_check ON assignments;
CREATE TRIGGER trg_assignment_check BEFORE INSERT ON assignments
FOR EACH ROW EXECUTE FUNCTION fn_assignment_check();

CREATE OR REPLACE FUNCTION fn_assignment_notify() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM fn_notify(NEW.assigned_to,
    CASE WHEN NEW.assignment_type = 'THEFT_TRACKING' THEN 'Theft case forwarded'
         WHEN NEW.level > 1 THEN 'Escalated case (level ' || NEW.level || ')'
         ELSE 'New case assigned' END,
    'Report #' || NEW.report_id || ' is due by '
      || to_char(NEW.due_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon HH12:MI AM'),
    '/faculty/cases/' || NEW.report_id);
  PERFORM fn_audit('ASSIGNED_L' || NEW.level, 'assignments', NEW.assignment_id,
    jsonb_build_object('report_id', NEW.report_id, 'to', NEW.assigned_to, 'type', NEW.assignment_type));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_assignment_notify ON assignments;
CREATE TRIGGER trg_assignment_notify AFTER INSERT ON assignments
FOR EACH ROW EXECUTE FUNCTION fn_assignment_notify();

CREATE OR REPLACE FUNCTION fn_new_report() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_min INT := fn_setting('min_match_score', '30')::INT;
BEGIN
  INSERT INTO matches(report_id, found_id, score)
  SELECT NEW.report_id, f.found_id, s.score
  FROM found_items f
  CROSS JOIN LATERAL (SELECT fn_match_score(NEW.location_id, NEW.lost_from, NEW.lost_to,
         concat_ws(' ', NEW.description, NEW.brand), NEW.color,
         f.location_id, f.found_at, concat_ws(' ', f.description, f.brand), f.color) AS score) s
  WHERE f.status = 'AVAILABLE' AND f.category_id = NEW.category_id
    AND f.found_at >= NEW.lost_from - interval '1 hour'
    AND s.score >= v_min;
  PERFORM fn_audit('REPORT_CREATED', 'lost_reports', NEW.report_id);
  PERFORM fn_assign_report(NEW.report_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_new_report ON lost_reports;
CREATE TRIGGER trg_new_report AFTER INSERT ON lost_reports
FOR EACH ROW EXECUTE FUNCTION fn_new_report();

CREATE OR REPLACE FUNCTION fn_new_found_item() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_min INT := fn_setting('min_match_score', '30')::INT; rec RECORD;
BEGIN
  FOR rec IN
    INSERT INTO matches(report_id, found_id, score)
    SELECT r.report_id, NEW.found_id, s.score
    FROM lost_reports r
    CROSS JOIN LATERAL (SELECT fn_match_score(r.location_id, r.lost_from, r.lost_to,
           concat_ws(' ', r.description, r.brand), r.color,
           NEW.location_id, NEW.found_at, concat_ws(' ', NEW.description, NEW.brand), NEW.color) AS score) s
    WHERE r.status IN ('OPEN','ASSIGNED','VISIT_SCHEDULED') AND r.category_id = NEW.category_id
      AND NEW.found_at >= r.lost_from - interval '1 hour' AND s.score >= v_min
    ON CONFLICT (report_id, found_id) DO NOTHING
    RETURNING report_id, score
  LOOP
    PERFORM fn_notify(a.assigned_to, 'New possible match',
            'A newly logged item scored ' || rec.score || ' for report #' || rec.report_id,
            '/faculty/cases/' || rec.report_id)
    FROM assignments a
    WHERE a.report_id = rec.report_id AND a.status = 'ACTIVE' AND a.assignment_type = 'REVIEW';
  END LOOP;
  PERFORM fn_audit('ITEM_LOGGED', 'found_items', NEW.found_id, jsonb_build_object('shelf', NEW.shelf_code));
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_new_found_item ON found_items;
CREATE TRIGGER trg_new_found_item AFTER INSERT ON found_items
FOR EACH ROW EXECUTE FUNCTION fn_new_found_item();

CREATE OR REPLACE FUNCTION fn_report_status() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_msg TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NULL; END IF;
  PERFORM fn_audit('STATUS ' || OLD.status || ' -> ' || NEW.status, 'lost_reports', NEW.report_id,
                   jsonb_build_object('closed_reason', NEW.closed_reason));
  v_msg := CASE NEW.status
    WHEN 'ASSIGNED'        THEN 'Your report is being reviewed by a faculty member.'
    WHEN 'VISIT_SCHEDULED' THEN 'A verification visit has been scheduled. Check the report for date, time and venue.'
    WHEN 'RETURNED'        THEN 'Your item has been verified and handed over.'
    WHEN 'NOT_FOUND'       THEN 'Visit ' || fn_setting('lost_found_room','SJT G03') || ' between '
         || fn_setting('room_visit_hours','9:00 AM - 5:00 PM') || ' on or before '
         || to_char((NEW.not_found_at + make_interval(days => fn_setting('visit_window_days','7')::INT))
                    AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY')
         || ' and search the room yourself. Carry your ID.'
    WHEN 'THEFT_FORWARDED' THEN 'Your case has been forwarded for further action.'
    WHEN 'CLOSED'          THEN 'Your report has been closed ('
                                || replace(lower(NEW.closed_reason), '_', ' ') || ').'
    ELSE NULL END;
  IF v_msg IS NOT NULL THEN
    PERFORM fn_notify(NEW.student_id, 'Report #' || NEW.report_id || ': ' || replace(NEW.status, '_', ' '),
                      v_msg, '/student/reports/' || NEW.report_id);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_report_status ON lost_reports;
CREATE TRIGGER trg_report_status AFTER UPDATE OF status ON lost_reports
FOR EACH ROW EXECUTE FUNCTION fn_report_status();

CREATE OR REPLACE FUNCTION fn_verification_before() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT; v_marks TEXT; v_mstatus TEXT;
BEGIN
  SELECT r.status, r.identifying_marks, m.status INTO v_status, v_marks, v_mstatus
  FROM matches m JOIN lost_reports r ON r.report_id = m.report_id WHERE m.match_id = NEW.match_id;
  IF v_status NOT IN ('ASSIGNED','VISIT_SCHEDULED') THEN
    RAISE EXCEPTION 'Cannot schedule a verification for a report in status %', v_status;
  END IF;
  IF v_mstatus NOT IN ('SUGGESTED','SHORTLISTED') THEN
    RAISE EXCEPTION 'Match is % and cannot be verified', v_mstatus;
  END IF;
  IF NEW.scheduled_at < now() - interval '5 minutes' THEN
    RAISE EXCEPTION 'Verification time cannot be in the past';
  END IF;
  NEW.marks_claimed := v_marks;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_verification_before ON verifications;
CREATE TRIGGER trg_verification_before BEFORE INSERT ON verifications
FOR EACH ROW EXECUTE FUNCTION fn_verification_before();

CREATE OR REPLACE FUNCTION fn_verification_after() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE matches SET status = 'SHORTLISTED' WHERE match_id = NEW.match_id AND status = 'SUGGESTED';
  UPDATE lost_reports r SET status = 'VISIT_SCHEDULED'
    FROM matches m WHERE m.match_id = NEW.match_id AND r.report_id = m.report_id AND r.status = 'ASSIGNED';
  PERFORM fn_notify(r.student_id, 'Verification visit scheduled',
     'Come to ' || NEW.venue || ' on '
     || to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY, HH12:MI AM')
     || '. Carry your ID card.', '/student/reports/' || r.report_id)
    FROM matches m JOIN lost_reports r ON r.report_id = m.report_id WHERE m.match_id = NEW.match_id;
  PERFORM fn_audit('VERIFICATION_SCHEDULED', 'verifications', NEW.verification_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_verification_after ON verifications;
CREATE TRIGGER trg_verification_after AFTER INSERT ON verifications
FOR EACH ROW EXECUTE FUNCTION fn_verification_after();

CREATE OR REPLACE FUNCTION fn_room_visit_before() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_status TEXT; v_item_status TEXT;
BEGIN
  SELECT status INTO v_status FROM lost_reports WHERE report_id = NEW.report_id;
  IF v_status <> 'NOT_FOUND' THEN
    RAISE EXCEPTION 'Room visits can only be recorded for NOT_FOUND reports (report is %)', v_status;
  END IF;
  IF NEW.found_id IS NOT NULL THEN
    SELECT status INTO v_item_status FROM found_items WHERE found_id = NEW.found_id;
    IF v_item_status <> 'AVAILABLE' THEN RAISE EXCEPTION 'Selected item is %', v_item_status; END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_room_visit_before ON room_visits;
CREATE TRIGGER trg_room_visit_before BEFORE INSERT ON room_visits
FOR EACH ROW EXECUTE FUNCTION fn_room_visit_before();

CREATE OR REPLACE FUNCTION fn_room_visit_after() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_last INT; v_theft INT;
BEGIN
  IF NEW.manual_search_result = 'FOUND_ITEM' OR NEW.cctv_outcome = 'LOCATED' THEN
    IF NEW.found_id IS NOT NULL THEN
      INSERT INTO matches(report_id, found_id, score, source, status)
      VALUES (NEW.report_id, NEW.found_id, 100, 'ROOM_SEARCH', 'SHORTLISTED')
      ON CONFLICT (report_id, found_id)
      DO UPDATE SET status = 'SHORTLISTED', score = 100, source = 'ROOM_SEARCH';
    END IF;
    SELECT assigned_to INTO v_last FROM assignments
     WHERE report_id = NEW.report_id AND assignment_type = 'REVIEW'
     ORDER BY assigned_at DESC LIMIT 1;
    IF fn_assign_report(NEW.report_id, v_last) IS NULL THEN
      UPDATE lost_reports SET status = 'OPEN' WHERE report_id = NEW.report_id;
    END IF;

  ELSIF NEW.cctv_outcome = 'NOT_VISIBLE' THEN
    UPDATE lost_reports SET status = 'CLOSED', closed_reason = 'CCTV_NOT_VISIBLE'
     WHERE report_id = NEW.report_id;

  ELSIF NEW.cctv_outcome = 'THEFT_SUSPECTED' THEN
    v_theft := NULLIF(fn_setting('theft_handler_user_id', ''), '')::INT;
    IF v_theft IS NULL THEN
      RAISE EXCEPTION 'No theft handler configured (setting theft_handler_user_id)';
    END IF;
    UPDATE lost_reports SET status = 'THEFT_FORWARDED' WHERE report_id = NEW.report_id;
    INSERT INTO assignments(report_id, assigned_to, assignment_type, level, due_at)
    VALUES (NEW.report_id, v_theft, 'THEFT_TRACKING', 1, fn_review_due());
  END IF;
  PERFORM fn_audit('ROOM_VISIT_' || COALESCE(NEW.cctv_outcome, NEW.manual_search_result),
                   'room_visits', NEW.visit_id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_room_visit_after ON room_visits;
CREATE TRIGGER trg_room_visit_after AFTER INSERT ON room_visits
FOR EACH ROW EXECUTE FUNCTION fn_room_visit_after();

-- ==========================================
-- 04_procedures.sql
-- ==========================================
CREATE OR REPLACE PROCEDURE sp_complete_handover(p_verification_id INT, p_observed TEXT)
LANGUAGE plpgsql AS $$
DECLARE v RECORD; v_code TEXT;
BEGIN
  SELECT m.match_id, m.report_id, m.found_id INTO v
  FROM verifications ve JOIN matches m ON m.match_id = ve.match_id
  WHERE ve.verification_id = p_verification_id AND ve.outcome = 'SCHEDULED'
  FOR UPDATE OF ve, m;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification % is not pending', p_verification_id; END IF;

  UPDATE found_items SET status = 'RETURNED' WHERE found_id = v.found_id AND status = 'AVAILABLE';
  IF NOT FOUND THEN RAISE EXCEPTION 'Item is no longer available'; END IF;

  UPDATE verifications SET outcome = 'VERIFIED', marks_observed = p_observed,
         verified_by = fn_actor(), completed_at = now()
   WHERE verification_id = p_verification_id;
  UPDATE matches SET status = 'CONFIRMED' WHERE match_id = v.match_id;
  UPDATE matches SET status = 'DISMISSED'
   WHERE match_id <> v.match_id AND (found_id = v.found_id OR report_id = v.report_id)
     AND status IN ('SUGGESTED','SHORTLISTED');
  UPDATE verifications SET outcome = 'CANCELLED'
   WHERE outcome = 'SCHEDULED' AND match_id IN
     (SELECT match_id FROM matches WHERE found_id = v.found_id OR report_id = v.report_id);
  UPDATE assignments SET status = 'COMPLETED', closed_at = now()
   WHERE report_id = v.report_id AND status = 'ACTIVE';
  UPDATE lost_reports SET status = 'RETURNED' WHERE report_id = v.report_id;

  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 10));
  INSERT INTO handover_letters(verification_id, letter_no, verify_code)
  VALUES (p_verification_id,
          'LF-' || to_char(now(), 'YYYY') || '-' || lpad(p_verification_id::text, 5, '0'), v_code);
  PERFORM fn_audit('HANDOVER_COMPLETED', 'lost_reports', v.report_id,
                   jsonb_build_object('verification_id', p_verification_id, 'found_id', v.found_id));
END $$;

CREATE OR REPLACE PROCEDURE sp_record_verification_result(
  p_verification_id INT, p_outcome TEXT, p_observed TEXT, p_remarks TEXT)
LANGUAGE plpgsql AS $$
DECLARE v RECORD;
BEGIN
  IF p_outcome NOT IN ('FAILED','NO_SHOW') THEN
    RAISE EXCEPTION 'Use sp_complete_handover for VERIFIED';
  END IF;
  SELECT m.match_id, m.report_id INTO v FROM verifications ve JOIN matches m ON m.match_id = ve.match_id
  WHERE ve.verification_id = p_verification_id AND ve.outcome = 'SCHEDULED' FOR UPDATE OF ve;
  IF NOT FOUND THEN RAISE EXCEPTION 'Verification % is not pending', p_verification_id; END IF;

  UPDATE verifications SET outcome = p_outcome, marks_observed = p_observed, remarks = p_remarks,
         verified_by = fn_actor(), completed_at = now()
   WHERE verification_id = p_verification_id;
  IF p_outcome = 'FAILED' THEN
    UPDATE matches SET status = 'FAILED' WHERE match_id = v.match_id;
  END IF;
  UPDATE lost_reports SET status = 'ASSIGNED'
   WHERE report_id = v.report_id AND status = 'VISIT_SCHEDULED'
     AND NOT EXISTS (SELECT 1 FROM verifications ve JOIN matches m ON m.match_id = ve.match_id
                     WHERE m.report_id = v.report_id AND ve.outcome = 'SCHEDULED');
  PERFORM fn_audit('VERIFICATION_' || p_outcome, 'verifications', p_verification_id);
END $$;

CREATE OR REPLACE PROCEDURE sp_declare_not_found(p_report_id INT)
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM lost_reports WHERE report_id = p_report_id
     AND status IN ('ASSIGNED','VISIT_SCHEDULED') FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report % cannot be declared not found in its current status', p_report_id;
  END IF;
  UPDATE verifications SET outcome = 'CANCELLED'
   WHERE outcome = 'SCHEDULED' AND match_id IN (SELECT match_id FROM matches WHERE report_id = p_report_id);
  UPDATE matches SET status = 'DISMISSED'
   WHERE report_id = p_report_id AND status IN ('SUGGESTED','SHORTLISTED');
  UPDATE assignments SET status = 'COMPLETED', closed_at = now()
   WHERE report_id = p_report_id AND status = 'ACTIVE' AND assignment_type = 'REVIEW';
  UPDATE lost_reports SET status = 'NOT_FOUND', not_found_at = now() WHERE report_id = p_report_id;
END $$;

CREATE OR REPLACE PROCEDURE sp_close_report(p_report_id INT, p_reason TEXT)
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE verifications SET outcome = 'CANCELLED'
   WHERE outcome = 'SCHEDULED' AND match_id IN (SELECT match_id FROM matches WHERE report_id = p_report_id);
  UPDATE matches SET status = 'DISMISSED'
   WHERE report_id = p_report_id AND status IN ('SUGGESTED','SHORTLISTED');
  UPDATE assignments SET status = 'COMPLETED', closed_at = now()
   WHERE report_id = p_report_id AND status = 'ACTIVE';
  UPDATE lost_reports SET status = 'CLOSED', closed_reason = p_reason
   WHERE report_id = p_report_id AND status IN ('OPEN','ASSIGNED','VISIT_SCHEDULED','NOT_FOUND');
  IF NOT FOUND THEN RAISE EXCEPTION 'Report % cannot be closed in its current status', p_report_id; END IF;
END $$;

CREATE OR REPLACE PROCEDURE sp_reassign(p_report_id INT, p_to INT)
LANGUAGE plpgsql AS $$
DECLARE v_type TEXT := 'REVIEW'; v_level INT := 1;
BEGIN
  SELECT assignment_type, level INTO v_type, v_level FROM assignments
   WHERE report_id = p_report_id AND status = 'ACTIVE' ORDER BY assigned_at DESC LIMIT 1;
  UPDATE assignments SET status = 'COMPLETED', closed_at = now()
   WHERE report_id = p_report_id AND status = 'ACTIVE' AND assignment_type = COALESCE(v_type, 'REVIEW');
  INSERT INTO assignments(report_id, assigned_to, assignment_type, level, due_at)
  VALUES (p_report_id, p_to, COALESCE(v_type, 'REVIEW'), COALESCE(v_level, 1), fn_review_due());
  UPDATE lost_reports SET status = 'ASSIGNED' WHERE report_id = p_report_id AND status = 'OPEN';
  PERFORM fn_audit('ADMIN_REASSIGN', 'lost_reports', p_report_id, jsonb_build_object('to', p_to));
END $$;

CREATE OR REPLACE PROCEDURE sp_escalate_overdue()
LANGUAGE plpgsql AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT a.assignment_id, a.report_id, a.assignment_type, a.level, a.assigned_to, u.reports_to_id
    FROM assignments a JOIN users u ON u.user_id = a.assigned_to
    WHERE a.status = 'ACTIVE' AND a.due_at < now()
    FOR UPDATE OF a SKIP LOCKED
  LOOP
    IF rec.reports_to_id IS NOT NULL
       AND EXISTS (SELECT 1 FROM users WHERE user_id = rec.reports_to_id AND is_active) THEN
      UPDATE assignments SET status = 'ESCALATED', closed_at = now() WHERE assignment_id = rec.assignment_id;
      INSERT INTO assignments(report_id, assigned_to, assignment_type, level, due_at)
      VALUES (rec.report_id, rec.reports_to_id, rec.assignment_type, rec.level + 1, fn_review_due());
      PERFORM fn_notify(rec.assigned_to, 'Case escalated',
        'Report #' || rec.report_id || ' passed its deadline and moved to your reporting officer.', NULL);
    ELSE
      UPDATE assignments SET due_at = fn_review_due() WHERE assignment_id = rec.assignment_id;
      PERFORM fn_audit('TOP_LEVEL_OVERDUE', 'assignments', rec.assignment_id,
                       jsonb_build_object('report_id', rec.report_id));
      PERFORM fn_notify(u.user_id, 'Top-level case overdue',
        'Report #' || rec.report_id || ' is overdue at the top of the hierarchy.', '/admin/overdue')
        FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'ADMIN' AND u.is_active;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE PROCEDURE sp_assign_pending()
LANGUAGE plpgsql AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT report_id FROM lost_reports WHERE status = 'OPEN' ORDER BY created_at LOOP
    PERFORM fn_assign_report(rec.report_id);
  END LOOP;
END $$;

CREATE OR REPLACE PROCEDURE sp_close_expired_not_found()
LANGUAGE plpgsql AS $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT report_id FROM lost_reports
     WHERE status = 'NOT_FOUND'
       AND not_found_at < now() - make_interval(days => fn_setting('visit_window_days','7')::INT)
  LOOP
    CALL sp_close_report(rec.report_id, 'VISIT_WINDOW_EXPIRED');
  END LOOP;
END $$;

CREATE OR REPLACE PROCEDURE sp_flag_unclaimed()
LANGUAGE plpgsql AS $$
DECLARE v_n INT;
BEGIN
  UPDATE found_items SET unclaimed_flagged_at = now()
   WHERE status = 'AVAILABLE' AND unclaimed_flagged_at IS NULL
     AND found_at < now() - make_interval(days => fn_setting('unclaimed_after_days','30')::INT);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n > 0 THEN
    PERFORM fn_notify(u.user_id, 'Unclaimed items',
      v_n || ' item(s) are now flagged for disposal or donation.', '/staff/items?flagged=1')
      FROM users u JOIN roles r ON r.role_id = u.role_id WHERE r.role_name = 'STAFF' AND u.is_active;
  END IF;
END $$;

CREATE OR REPLACE PROCEDURE sp_run_jobs()
LANGUAGE plpgsql AS $$
BEGIN
  CALL sp_assign_pending();
  CALL sp_escalate_overdue();
  CALL sp_close_expired_not_found();
  CALL sp_flag_unclaimed();
END $$;

-- ==========================================
-- 05_views.sql
-- ==========================================
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
