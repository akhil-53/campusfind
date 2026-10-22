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
  SELECT (r.role_name IN ('FACULTY', 'ADMIN') AND m.is_active AND dm.level_rank > COALESCE(ds.level_rank, 0))
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
  NEW.marks_claimed := v_marks;   -- snapshot; API sends an empty string
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
      UPDATE lost_reports SET status = 'OPEN' WHERE report_id = NEW.report_id;  -- job retries
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
