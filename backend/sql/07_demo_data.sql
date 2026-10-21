-- 07_demo_data.sql
-- Demo accounts with test hashed passwords or Google auth
-- Note: password_hash for break-glass admin 'admin123' (bcrypt cost 12)
-- $2b$12$eX8m6l/c8Jc4OQjXW2sSDe6f7fX5Xj9Z7.kMkWcK8o6eA9xL9bWqa (or set directly)

-- 1. Insert Dean, HOD, Faculty, Staff, Admin, Students
-- Roles: 1 STUDENT, 2 STAFF, 3 FACULTY, 4 ADMIN
-- Designations: 1 Faculty, 2 HOD, 3 Dean

-- Dean
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES ('Dr. K. Dean', 'dean@vit.ac.in', 3, 3, NULL, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- HOD (reports to Dean)
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES ('Dr. S. HOD', 'hod@vit.ac.in', 3, 2, (SELECT user_id FROM users WHERE email = 'dean@vit.ac.in'), TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Faculty 1 (reports to HOD)
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES ('Prof. Rajesh Kumar', 'rajesh.faculty@vit.ac.in', 3, 1, (SELECT user_id FROM users WHERE email = 'hod@vit.ac.in'), TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Faculty 2 (reports to HOD)
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES ('Prof. Ananya Sharma', 'ananya.faculty@vit.ac.in', 3, 1, (SELECT user_id FROM users WHERE email = 'hod@vit.ac.in'), TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Staff
INSERT INTO users (full_name, email, role_id, is_active)
VALUES ('SJT LF Desk Staff', 'staff@vit.ac.in', 2, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Admin (break-glass credentials: admin@vit.ac.in / admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (full_name, email, role_id, is_active, password_hash)
VALUES ('CampusFind Admin', 'admin@vit.ac.in', 4, TRUE, '$2b$10$NkNEMoyN268sgo8j4aHVhOjIHyEpNIAU8MMa9Qkh8lBwwvbbMfsNm')
ON CONFLICT (email) DO NOTHING;

-- Students
INSERT INTO users (full_name, email, reg_no, role_id, is_active)
VALUES ('Aarav Patel', 'aarav.patel2023@vitstudent.ac.in', '23BCE1042', 1, TRUE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (full_name, email, reg_no, role_id, is_active)
VALUES ('Pooja Verma', 'pooja.verma2024@vitstudent.ac.in', '24BCT0089', 1, TRUE)
ON CONFLICT (email) DO NOTHING;

-- Set theft handler to Faculty 1
UPDATE system_settings
SET setting_value = (SELECT user_id::text FROM users WHERE email = 'rajesh.faculty@vit.ac.in')
WHERE setting_key = 'theft_handler_user_id';
