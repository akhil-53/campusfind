CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS roles (
  role_id   SERIAL PRIMARY KEY,
  role_name VARCHAR(20) NOT NULL UNIQUE
            CHECK (role_name IN ('STUDENT','STAFF','FACULTY','ADMIN'))
);

CREATE TABLE IF NOT EXISTS designations (
  designation_id SERIAL PRIMARY KEY,
  title          VARCHAR(50) NOT NULL UNIQUE,
  level_rank     INT NOT NULL UNIQUE CHECK (level_rank > 0)  -- 1 Faculty, 2 HOD, 3 Dean
);

CREATE TABLE IF NOT EXISTS users (
  user_id        SERIAL PRIMARY KEY,
  full_name      VARCHAR(80)  NOT NULL,
  email          VARCHAR(120) NOT NULL UNIQUE,
  reg_no         VARCHAR(15)  UNIQUE,
  google_id      VARCHAR(64)  UNIQUE,
  password_hash  TEXT,
  role_id        INT NOT NULL REFERENCES roles(role_id),
  designation_id INT REFERENCES designations(designation_id),
  reports_to_id  INT REFERENCES users(user_id) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  is_available   BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_no_self_report CHECK (reports_to_id IS NULL OR reports_to_id <> user_id),
  CONSTRAINT chk_users_email_lower    CHECK (email = lower(email)),
  CONSTRAINT chk_users_email_domain   CHECK (email LIKE '%@vitstudent.ac.in' OR email LIKE '%@vit.ac.in')
);

CREATE TABLE IF NOT EXISTS categories (
  category_id   SERIAL PRIMARY KEY,
  category_name VARCHAR(40) NOT NULL UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS locations (
  location_id   SERIAL PRIMARY KEY,
  block         VARCHAR(20) NOT NULL DEFAULT 'SJT',
  room_name     VARCHAR(30) NOT NULL,
  floor_no      INT,
  location_type VARCHAR(15) NOT NULL DEFAULT 'CLASSROOM'
                CHECK (location_type IN ('CLASSROOM','EXAM_HALL','LAB','COMMON_AREA')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_location UNIQUE (block, room_name)
);

CREATE TABLE IF NOT EXISTS found_items (
  found_id        SERIAL PRIMARY KEY,
  category_id     INT NOT NULL REFERENCES categories(category_id),
  location_id     INT NOT NULL REFERENCES locations(location_id),
  logged_by       INT NOT NULL REFERENCES users(user_id),
  description     VARCHAR(200) NOT NULL,
  color           VARCHAR(30),
  brand           VARCHAR(40),
  shelf_code      VARCHAR(20) NOT NULL UNIQUE,
  status          VARCHAR(12) NOT NULL DEFAULT 'AVAILABLE'
                  CHECK (status IN ('AVAILABLE','RETURNED','DISPOSED','DONATED')),
  found_at        TIMESTAMPTZ NOT NULL,
  logged_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  unclaimed_flagged_at TIMESTAMPTZ,
  disposed_at     TIMESTAMPTZ,
  disposal_reason TEXT,
  CONSTRAINT chk_found_not_future CHECK (found_at <= logged_at + interval '5 minutes'),
  CONSTRAINT chk_disposal CHECK ((status IN ('DISPOSED','DONATED')) = (disposed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS item_images (
  image_id     SERIAL PRIMARY KEY,
  found_id     INT NOT NULL REFERENCES found_items(found_id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,          -- path inside the private bucket item-images
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lost_reports (
  report_id         SERIAL PRIMARY KEY,
  student_id        INT NOT NULL REFERENCES users(user_id),
  category_id       INT NOT NULL REFERENCES categories(category_id),
  location_id       INT NOT NULL REFERENCES locations(location_id),
  description       VARCHAR(300) NOT NULL,
  color             VARCHAR(30),
  brand             VARCHAR(40),
  identifying_marks TEXT NOT NULL,
  lost_from         TIMESTAMPTZ NOT NULL,
  lost_to           TIMESTAMPTZ NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                    CHECK (status IN ('OPEN','ASSIGNED','VISIT_SCHEDULED','RETURNED',
                                      'NOT_FOUND','THEFT_FORWARDED','CLOSED')),
  not_found_at      TIMESTAMPTZ,
  closed_reason     VARCHAR(30) CHECK (closed_reason IN ('CCTV_NOT_VISIBLE','VISIT_WINDOW_EXPIRED',
                                                         'WITHDRAWN_BY_STUDENT','ADMIN_CLOSED')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_lost_window     CHECK (lost_to >= lost_from),
  CONSTRAINT chk_lost_window_max CHECK (lost_to - lost_from <= interval '24 hours'),
  CONSTRAINT chk_lost_not_future CHECK (lost_to <= created_at + interval '5 minutes'),
  CONSTRAINT chk_not_found_ts    CHECK (status <> 'NOT_FOUND' OR not_found_at IS NOT NULL),
  CONSTRAINT chk_closed_reason   CHECK ((status = 'CLOSED') = (closed_reason IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS matches (
  match_id   SERIAL PRIMARY KEY,
  report_id  INT NOT NULL REFERENCES lost_reports(report_id) ON DELETE CASCADE,
  found_id   INT NOT NULL REFERENCES found_items(found_id) ON DELETE CASCADE,
  score      INT NOT NULL CHECK (score BETWEEN 0 AND 100),
  source     VARCHAR(12) NOT NULL DEFAULT 'AUTO' CHECK (source IN ('AUTO','ROOM_SEARCH','MANUAL')),
  status     VARCHAR(12) NOT NULL DEFAULT 'SUGGESTED'
             CHECK (status IN ('SUGGESTED','SHORTLISTED','DISMISSED','FAILED','CONFIRMED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_match UNIQUE (report_id, found_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id   SERIAL PRIMARY KEY,
  report_id       INT NOT NULL REFERENCES lost_reports(report_id) ON DELETE CASCADE,
  assigned_to     INT NOT NULL REFERENCES users(user_id),
  assignment_type VARCHAR(15) NOT NULL DEFAULT 'REVIEW' CHECK (assignment_type IN ('REVIEW','THEFT_TRACKING')),
  level           INT NOT NULL DEFAULT 1 CHECK (level >= 1),
  status          VARCHAR(10) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ESCALATED','COMPLETED')),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_at          TIMESTAMPTZ NOT NULL,
  closed_at       TIMESTAMPTZ,
  CONSTRAINT chk_due_after_assign CHECK (due_at > assigned_at),
  CONSTRAINT chk_closed_ts CHECK ((status = 'ACTIVE') = (closed_at IS NULL))
);

CREATE TABLE IF NOT EXISTS verifications (
  verification_id SERIAL PRIMARY KEY,
  match_id        INT NOT NULL REFERENCES matches(match_id) ON DELETE CASCADE,
  scheduled_by    INT NOT NULL REFERENCES users(user_id),
  scheduled_at    TIMESTAMPTZ NOT NULL,
  venue           VARCHAR(60) NOT NULL,
  marks_claimed   TEXT NOT NULL,     -- filled by trigger from lost_reports
  marks_observed  TEXT,
  outcome         VARCHAR(10) NOT NULL DEFAULT 'SCHEDULED'
                  CHECK (outcome IN ('SCHEDULED','VERIFIED','FAILED','NO_SHOW','CANCELLED')),
  verified_by     INT REFERENCES users(user_id),
  remarks         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  CONSTRAINT chk_verif_done CHECK (outcome IN ('SCHEDULED','CANCELLED')
                                   OR (completed_at IS NOT NULL AND verified_by IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS handover_letters (
  letter_id       SERIAL PRIMARY KEY,
  verification_id INT NOT NULL UNIQUE REFERENCES verifications(verification_id),
  letter_no       VARCHAR(20) NOT NULL UNIQUE,   -- LF-2026-00042
  verify_code     VARCHAR(12) NOT NULL UNIQUE,   -- random, printed as QR
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  handed_over_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS room_visits (
  visit_id             SERIAL PRIMARY KEY,
  report_id            INT NOT NULL REFERENCES lost_reports(report_id) ON DELETE CASCADE,
  handled_by           INT NOT NULL REFERENCES users(user_id),
  visited_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  manual_search_result VARCHAR(10) NOT NULL CHECK (manual_search_result IN ('FOUND_ITEM','NOT_FOUND')),
  found_id             INT REFERENCES found_items(found_id),
  cctv_checked         BOOLEAN NOT NULL DEFAULT FALSE,
  cctv_outcome         VARCHAR(16) CHECK (cctv_outcome IN ('LOCATED','NOT_VISIBLE','THEFT_SUSPECTED')),
  notes                TEXT,
  CONSTRAINT chk_cctv_outcome  CHECK (cctv_checked = (cctv_outcome IS NOT NULL)),
  CONSTRAINT chk_cctv_only_nf  CHECK (manual_search_result = 'NOT_FOUND' OR cctv_checked = FALSE),
  CONSTRAINT chk_found_item_id CHECK ((manual_search_result = 'FOUND_ITEM') = (found_id IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(200) NOT NULL,
  description   VARCHAR(200),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           VARCHAR(80) NOT NULL,
  message         TEXT NOT NULL,
  link            VARCHAR(200),
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  emailed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  log_id      BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,  -- NULL = system job
  action      VARCHAR(60) NOT NULL,
  entity_name VARCHAR(30) NOT NULL,
  entity_id   INT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_role        ON users(role_id, is_active);
CREATE INDEX IF NOT EXISTS idx_users_reports_to  ON users(reports_to_id);
CREATE INDEX IF NOT EXISTS idx_reports_student   ON lost_reports(student_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_status_nf ON lost_reports(status, not_found_at);
CREATE INDEX IF NOT EXISTS idx_found_match       ON found_items(category_id, status, found_at);
CREATE INDEX IF NOT EXISTS idx_found_desc_trgm   ON found_items  USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_reports_desc_trgm ON lost_reports USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_matches_report    ON matches(report_id, status);
CREATE INDEX IF NOT EXISTS idx_matches_found     ON matches(found_id, status);
CREATE INDEX IF NOT EXISTS idx_assign_queue      ON assignments(assigned_to, status, due_at);
CREATE INDEX IF NOT EXISTS idx_assign_due        ON assignments(due_at) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_assignment ON assignments(report_id, assignment_type) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX IF NOT EXISTS uq_one_scheduled_verification ON verifications(match_id) WHERE outcome = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS idx_visits_report     ON room_visits(report_id);
CREATE INDEX IF NOT EXISTS idx_notif_user        ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity      ON audit_logs(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created     ON audit_logs(created_at DESC);
