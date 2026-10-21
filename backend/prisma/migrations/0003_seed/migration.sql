-- ==========================================
-- 0003_seed / migration.sql
-- Base seed data & demo accounts
-- ==========================================

-- 1. Roles
INSERT INTO roles(role_name) VALUES ('STUDENT'),('STAFF'),('FACULTY'),('ADMIN')
ON CONFLICT (role_name) DO NOTHING;

-- 2. Designations
INSERT INTO designations(title, level_rank) VALUES ('Faculty',1),('HOD',2),('Dean',3)
ON CONFLICT (title) DO NOTHING;

-- 3. Categories
INSERT INTO categories(category_name) VALUES
 ('Water Bottle'),('Electronics'),('ID Card'),('Wallet'),('Bag'),('Keys'),('Calculator'),
 ('Stationery'),('Clothing'),('Spectacles'),('Jewellery'),('Books & Notes'),('Umbrella'),('Other')
ON CONFLICT (category_name) DO NOTHING;

-- 4. Locations (SJT block)
INSERT INTO locations(block, room_name, floor_no, location_type) VALUES
 ('SJT','SJT G03',0,'COMMON_AREA'),
 ('SJT','SJT 101',1,'CLASSROOM'),
 ('SJT','SJT 102',1,'CLASSROOM'),
 ('SJT','SJT 201',2,'CLASSROOM'),
 ('SJT','SJT 301',3,'EXAM_HALL'),
 ('SJT','SJT 302',3,'EXAM_HALL'),
 ('SJT','SJT 418',4,'LAB'),
 ('SJT','SJT Ground Floor Lobby',0,'COMMON_AREA')
ON CONFLICT (block, room_name) DO NOTHING;

-- 5. System Settings
INSERT INTO system_settings(setting_key, setting_value, description) VALUES
 ('review_deadline_minutes','2880','Minutes each assignment level gets before escalation'),
 ('visit_window_days','7','Days after NOT_FOUND for the student room visit'),
 ('unclaimed_after_days','30','Days before an available item is flagged'),
 ('min_match_score','30','Matches below this score are not stored'),
 ('room_visit_hours','9:00 AM - 5:00 PM','Shown in the not-found notice'),
 ('lost_found_room','SJT G03','Lost and found room name'),
 ('default_verification_venue','SJT G03','Default venue for verification visits'),
 ('theft_handler_user_id','','Faculty user id who receives theft cases')
ON CONFLICT (setting_key) DO NOTHING;

-- 6. Demo Users
-- Dean
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES (
  'Dr. K. Dean',
  'dean@vit.ac.in',
  (SELECT role_id FROM roles WHERE role_name = 'FACULTY'),
  (SELECT designation_id FROM designations WHERE title = 'Dean'),
  NULL,
  TRUE,
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- HOD (reports to Dean)
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES (
  'Dr. S. HOD',
  'hod@vit.ac.in',
  (SELECT role_id FROM roles WHERE role_name = 'FACULTY'),
  (SELECT designation_id FROM designations WHERE title = 'HOD'),
  (SELECT user_id FROM users WHERE email = 'dean@vit.ac.in'),
  TRUE,
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Faculty 1 (Prof. Rajesh Kumar, reports to HOD)
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES (
  'Prof. Rajesh Kumar',
  'rajesh.faculty@vit.ac.in',
  (SELECT role_id FROM roles WHERE role_name = 'FACULTY'),
  (SELECT designation_id FROM designations WHERE title = 'Faculty'),
  (SELECT user_id FROM users WHERE email = 'hod@vit.ac.in'),
  TRUE,
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Faculty 2 (Prof. Ananya Sharma, reports to HOD)
INSERT INTO users (full_name, email, role_id, designation_id, reports_to_id, is_active, is_available)
VALUES (
  'Prof. Ananya Sharma',
  'ananya.faculty@vit.ac.in',
  (SELECT role_id FROM roles WHERE role_name = 'FACULTY'),
  (SELECT designation_id FROM designations WHERE title = 'Faculty'),
  (SELECT user_id FROM users WHERE email = 'hod@vit.ac.in'),
  TRUE,
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Staff (SJT Desk)
INSERT INTO users (full_name, email, role_id, is_active)
VALUES (
  'SJT LF Desk Staff',
  'staff@vit.ac.in',
  (SELECT role_id FROM roles WHERE role_name = 'STAFF'),
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- Admin (break-glass credentials: admin@vit.ac.in / admin123)
-- bcrypt hash for 'admin123'
INSERT INTO users (full_name, email, role_id, is_active, password_hash)
VALUES (
  'CampusFind Admin',
  'admin@vit.ac.in',
  (SELECT role_id FROM roles WHERE role_name = 'ADMIN'),
  TRUE,
  '$2b$10$NkNEMoyN268sgo8j4aHVhOjIHyEpNIAU8MMa9Qkh8lBwwvbbMfsNm'
)
ON CONFLICT (email) DO UPDATE SET
  password_hash = '$2b$10$NkNEMoyN268sgo8j4aHVhOjIHyEpNIAU8MMa9Qkh8lBwwvbbMfsNm',
  role_id = (SELECT role_id FROM roles WHERE role_name = 'ADMIN');

-- Students
INSERT INTO users (full_name, email, reg_no, role_id, is_active)
VALUES (
  'Aarav Patel',
  'aarav.patel2023@vitstudent.ac.in',
  '23BCE1042',
  (SELECT role_id FROM roles WHERE role_name = 'STUDENT'),
  TRUE
)
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (full_name, email, reg_no, role_id, is_active)
VALUES (
  'Pooja Verma',
  'pooja.verma2024@vitstudent.ac.in',
  '24BCT0089',
  (SELECT role_id FROM roles WHERE role_name = 'STUDENT'),
  TRUE
)
ON CONFLICT (email) DO NOTHING;

-- 7. Configure default theft handler to Faculty 1
UPDATE system_settings
SET setting_value = COALESCE((SELECT user_id::text FROM users WHERE email = 'rajesh.faculty@vit.ac.in'), '')
WHERE setting_key = 'theft_handler_user_id';
