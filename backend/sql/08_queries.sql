-- Recovery rate per category
SELECT c.category_name, COUNT(*) AS total,
       COUNT(*) FILTER (WHERE r.status = 'RETURNED') AS returned,
       ROUND(100.0 * COUNT(*) FILTER (WHERE r.status = 'RETURNED') / NULLIF(COUNT(*),0), 1) AS recovery_pct
FROM lost_reports r JOIN categories c ON c.category_id = r.category_id
GROUP BY c.category_name ORDER BY total DESC;

-- Reports per room (hotspots)
SELECT l.room_name, COUNT(*) AS reports FROM lost_reports r
JOIN locations l ON l.location_id = r.location_id GROUP BY l.room_name ORDER BY reports DESC;

-- Escalations per faculty member
SELECT u.full_name, COUNT(*) AS escalated FROM assignments a
JOIN users u ON u.user_id = a.assigned_to WHERE a.status = 'ESCALATED'
GROUP BY u.full_name ORDER BY escalated DESC;

-- Average hours from report to return
SELECT ROUND(AVG(EXTRACT(EPOCH FROM (ve.completed_at - r.created_at)) / 3600)::numeric, 1) AS avg_hours
FROM lost_reports r JOIN matches m ON m.report_id = r.report_id AND m.status = 'CONFIRMED'
JOIN verifications ve ON ve.match_id = m.match_id AND ve.outcome = 'VERIFIED';

-- Reports per day, last 30 days (line chart)
SELECT date_trunc('day', created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, COUNT(*)
FROM lost_reports WHERE created_at > now() - interval '30 days' GROUP BY 1 ORDER BY 1;

-- CCTV outcomes
SELECT cctv_outcome, COUNT(*) FROM room_visits WHERE cctv_checked GROUP BY cctv_outcome;
