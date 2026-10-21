INSERT INTO roles(role_name) VALUES ('STUDENT'),('STAFF'),('FACULTY'),('ADMIN')
ON CONFLICT (role_name) DO NOTHING;

INSERT INTO designations(title, level_rank) VALUES ('Faculty',1),('HOD',2),('Dean',3)
ON CONFLICT (title) DO NOTHING;

INSERT INTO categories(category_name) VALUES
 ('Water Bottle'),('Electronics'),('ID Card'),('Wallet'),('Bag'),('Keys'),('Calculator'),
 ('Stationery'),('Clothing'),('Spectacles'),('Jewellery'),('Books & Notes'),('Umbrella'),('Other')
ON CONFLICT (category_name) DO NOTHING;

INSERT INTO locations(block, room_name, floor_no, location_type) VALUES
 ('SJT','SJT G03',0,'COMMON_AREA'),('SJT','SJT 101',1,'CLASSROOM'),('SJT','SJT 102',1,'CLASSROOM'),
 ('SJT','SJT 201',2,'CLASSROOM'),('SJT','SJT 301',3,'EXAM_HALL'),('SJT','SJT 302',3,'EXAM_HALL'),
 ('SJT','SJT 418',4,'LAB'),('SJT','SJT Ground Floor Lobby',0,'COMMON_AREA')
ON CONFLICT (block, room_name) DO NOTHING;

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
