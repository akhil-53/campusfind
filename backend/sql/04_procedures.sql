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
