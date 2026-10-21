# CampusFind - Build Documentation

Oct 19, 2026 · @Jitendra

## 1. Overview and how to use this doc

CampusFind replaces the paper lost-and-found process in SJT block with a role-based web app: students file lost reports, staff log found items, the database suggests matches to faculty only, overdue cases escalate Faculty → HOD → Dean, and a QR-verifiable handover letter is generated as a PDF. Two people build it in 2 days, phase by phase, with an AI IDE.

**What changed from the original design**

| Area | Original | Now |
| --- | --- | --- |
| Matching | Same category = 50 points, description ignored | Weighted score: location 25, time window 25, text similarity 40 (pg\_trgm), colour 10; minimum score setting |
| Found item triggers | Only on new report | On new report AND on new found item (both directions) |
| Failed or no-show verification | Report stuck in VISIT\_SCHEDULED | Procedure moves report back to ASSIGNED and marks the match FAILED |
| Student finds item in room search | Report reopens with no item record | Staff log or pick the item; a match is created automatically with source ROOM\_SEARCH |
| No faculty available | Report stays OPEN forever | Scheduled job retries assignment every run |
| Notifications | Table never filled | Triggers write notifications on every status change and assignment; optional email |
| Deadlines | Hard-coded 48 hours | All durations in system\_settings (minutes), so a demo can use 2-minute deadlines |
| Audit | No actor recorded | Backend sets app.user\_id per transaction; triggers read it into audit\_logs.user\_id |
| Hierarchy | Self-reference only | Admin page to add HOD and Dean, set reports\_to; trigger blocks cycles |
| Photos | Storage undefined | Supabase Storage private bucket, signed URLs for staff and faculty only |
| Handover letter | Plain letter number | Letter number + random verify code + QR; public page /verify/:code |
| Timestamps | TIMESTAMP | TIMESTAMPTZ (no IST/UTC bugs between Supabase, Render and browsers) |

**How to use this doc with an AI IDE (Cursor, Windsurf, Copilot, Claude Code)**

1. Keep this whole doc open as context, or paste sections 3, 4 and 5 into a file `docs/SPEC.md` in the repo and tell the AI to read it first.
2. Build one phase at a time, in order. Each phase lists its goal, the exact items to build, and a "Done when" checklist.
3. Give the AI one phase at a time with this prompt: *"Read docs/SPEC.md. Implement Phase N exactly as specified. Do not invent tables, columns, statuses or endpoints that are not in the spec. When finished, show me how to verify each item in the Done-when list."*
4. Never let the AI rename statuses or columns. Every status string in sections 4 and 5 is used by triggers, the API and the UI.
5. After each phase, tick its Done-when list, commit, and push to `dev`.

**Golden rules for the whole project**

- The database is the source of truth for workflow: triggers and procedures change statuses; the API only calls them.
- Staff never receive `identifying_marks`. Students never receive found items, matches, photos or shelf codes.
- Every multi-step write runs inside one transaction.
- No secret is ever committed. `.env` is in `.gitignore` before the first commit.

## 2. Tech stack and accounts

The stack is React + Express + PostgreSQL + Prisma + Google OAuth/JWT, hosted free on Vercel, Render and Supabase.

| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React 18 + Vite, Tailwind CSS, React Router v6, TanStack Query, React Hook Form + Zod, react-hot-toast, Recharts | Google button via `@react-oauth/google` |
| Backend | Node 20, Express 4, express-validator, helmet, cors, express-rate-limit, morgan | ES modules |
| Database | PostgreSQL 15+ on Supabase | Extensions: `pg_trgm`, `pg_cron` |
| ORM | Prisma 5 | Models map to snake\_case tables with `@@map` / `@map` |
| Auth | Google Identity Services ID token → `google-auth-library` verify → own JWT (`jsonwebtoken`) | Domain check on server |
| Passwords | bcrypt (cost 12) | Only for the break-glass admin account |
| File storage | Supabase Storage, private bucket `item-images` | `@supabase/supabase-js` with service key on backend only |
| PDF + QR | pdfkit + qrcode | Letter generated on request, not stored |
| Email (optional) | Nodemailer with Gmail app password, or Resend | Off by default (`EMAIL_ENABLED=false`) |
| Scheduling | `pg_cron` on Supabase, every 5 minutes | Local Docker: `node-cron` fallback when `ENABLE_APP_CRON=true` |
| Testing | Jest + Supertest (backend) |  |
| Containers | Docker, Docker Compose, Docker Hub |  |
| CI/CD | GitHub Actions |  |
| Domain | DuckDNS subdomain → CNAME/redirect to the Vercel URL |  |

**Accounts to create in the first hour (Person B does this while Person A starts the schema)**

1. **GitHub**: private repo `campusfind`, both members as collaborators, branches `main` and `dev`.
2. **Supabase**: new project (region Mumbai `ap-south-1`). Copy two connection strings: the pooled one (port 6543, add `?pgbouncer=true&connection_limit=1`) as `DATABASE_URL`, and the direct one (port 5432) as `DIRECT_URL`. Database → Extensions: enable `pg_trgm` and `pg_cron`. Storage: create private bucket `item-images`.
3. **Google Cloud Console**: new project → OAuth consent screen (External, testing mode, add both members and test accounts as test users) → Credentials → OAuth client ID (Web). Authorised JavaScript origins: `http://localhost:5173` and the Vercel URL. Copy the Client ID.
4. **Render**: account linked to GitHub (backend web service later).
5. **Vercel**: account linked to GitHub (frontend later).
6. **Docker Hub**: account and two repos, `campusfind-backend` and `campusfind-frontend`. Create an access token for CI.
7. **DuckDNS**: claim a subdomain, for example `campusfind.duckdns.org`.

**Environment variables**

| Variable | Where | Example / meaning |
| --- | --- | --- |
| DATABASE\_URL | backend | Supabase pooled URL (port 6543) |
| DIRECT\_URL | backend | Supabase direct URL (port 5432), used by migrations |
| JWT\_SECRET | backend | 64 random hex characters |
| JWT\_EXPIRES\_IN | backend | `8h` |
| GOOGLE\_CLIENT\_ID | backend + frontend (`VITE_GOOGLE_CLIENT_ID`) | from Google Cloud |
| STUDENT\_DOMAIN / STAFF\_DOMAIN | backend | `vitstudent.ac.in` / `vit.ac.in` |
| BOOTSTRAP\_ADMIN\_EMAILS | backend | comma list of `@vit.ac.in` emails that become ADMIN on first login |
| SUPABASE\_URL / SUPABASE\_SERVICE\_KEY | backend only | storage access; never in frontend |
| CORS\_ORIGIN | backend | Vercel URL and `http://localhost:5173` |
| APP\_BASE\_URL | backend | frontend URL, used in QR codes and email links |
| EMAIL\_ENABLED, SMTP\_USER, SMTP\_PASS | backend | optional email |
| ENABLE\_APP\_CRON | backend | `true` only in local Docker |
| VITE\_API\_URL | frontend | Render backend URL + `/api` |

Commit a `.env.example` with these keys and empty values. Never commit `.env`.

## 3. Roles, login rules and hierarchy

Everyone lives in one `users` table; `role_id` decides permissions and `designation_id` + `reports_to_id` form the escalation chain.

**Roles**

| Role | Can do | Can never see |
| --- | --- | --- |
| STUDENT | File, view and withdraw own lost reports; see own status timeline, visit notices, scheduled verification, notifications; download own handover letter | Found items, matches, photos, shelf codes, other students' reports |
| STAFF (SJT lost-and-found room) | Log found items with photos; list and search found items; see NOT\_FOUND cases; record room visits and CCTV outcomes; dispose or donate unclaimed items | `identifying_marks`, matches |
| FACULTY (includes HOD and Dean) | See own queue: report, marks, suggested matches with photos; shortlist, dismiss, schedule verification, record outcome, declare NOT\_FOUND; toggle own availability; theft handler sees theft cases | Cases never assigned to them |
| ADMIN | Everything: dashboard, users, hierarchy, categories, locations, settings, audit log, reassign any case | — |

**Login rules (enforced on the server, never only in the UI)**

1. Frontend gets a Google ID token and posts it to `POST /api/auth/google`.
2. Backend verifies the token with `google-auth-library` (audience = `GOOGLE_CLIENT_ID`), requires `email_verified = true`, lower-cases the email.
3. Email ends with `@vitstudent.ac.in` → find or create the user as STUDENT. Student emails do not reliably contain the registration number, so ask for `reg_no` once on first login (a "complete profile" step) and validate it against `^\d{2}[A-Z]{3}\d{4}$` (e.g. `23BCT0038`).
4. Email ends with `@vit.ac.in` → the user must already exist (pre-created by an admin) and be active. If not found: reject with 403 "Your account has not been set up. Contact the admin." Exception: emails in `BOOTSTRAP_ADMIN_EMAILS` are created as ADMIN on first login.
5. Any other domain → 403.
6. On success: save `google_id` (first time), `last_login_at`; issue a JWT `{ sub: user_id, role, name, email }` signed with `JWT_SECRET`, expiry 8 hours. Frontend keeps it in memory + `localStorage` and sends `Authorization: Bearer <token>`.
7. Every request re-loads the user from the database in the auth middleware and rejects inactive users, so deactivating someone takes effect immediately.

**Faculty hierarchy and admin control**

- `designations`: Faculty (level 1), HOD (level 2), Dean (level 3). Admin can add more (e.g. Associate Dean) from the settings page.
- Each FACULTY-role user has a designation and a `reports_to_id`: Faculty → their HOD, HOD → the Dean, Dean → NULL (top).
- Admin "Users & hierarchy" page lets the admin: add a user by email (`@vit.ac.in`) with name, role, designation and reports-to; change any of these later; activate or deactivate; set availability; and see the hierarchy as a tree.
- Rules: reports-to must be an active FACULTY user with a higher `level_rank`; no self-reference (CHECK); no cycles (trigger, Phase 1); deactivating a person who still has ACTIVE assignments is blocked until the admin reassigns them.
- One faculty user is the **theft handler**; their id is stored in setting `theft_handler_user_id`, chosen from a dropdown on the settings page.
- Auto-assignment only picks FACULTY users with designation level 1, `is_active` and `is_available`. HOD and Dean receive cases only by escalation or admin reassignment.

## 4. Workflow and status lifecycle

A lost report moves through 7 statuses; every move below is made by a trigger or a stored procedure, never by a plain UPDATE from the API.

**Report status transitions (the contract between DB, API and UI)**

| # | From | To | Caused by | Side effects |
| --- | --- | --- | --- | --- |
| 1 | (new) | OPEN | Student files report | Trigger computes matches |
| 2 | OPEN | ASSIGNED | Trigger on insert, or `sp_assign_pending` job | REVIEW assignment level 1, due in `review_deadline_minutes`; faculty notified |
| 3 | ASSIGNED | VISIT\_SCHEDULED | Faculty schedules verification (insert into verifications) | Match → SHORTLISTED, marks snapshot copied, student notified with date, time, venue |
| 4 | VISIT\_SCHEDULED | RETURNED | `sp_complete_handover` (outcome VERIFIED) | Item RETURNED, match CONFIRMED, other matches on that item and report DISMISSED, assignment COMPLETED, letter created |
| 5 | VISIT\_SCHEDULED | ASSIGNED | `sp_record_verification_result` (FAILED or NO\_SHOW) | Match FAILED; faculty picks another match or declares not found |
| 6 | ASSIGNED or VISIT\_SCHEDULED | NOT\_FOUND | `sp_declare_not_found` | Pending verifications CANCELLED, assignment COMPLETED, `not_found_at` set, student told to visit SJT G03 before the deadline |
| 7 | NOT\_FOUND | ASSIGNED | Room visit FOUND\_ITEM or CCTV LOCATED | New REVIEW assignment to the last reviewer (or least-loaded if they are inactive); FOUND\_ITEM also creates a ROOM\_SEARCH match score 100 |
| 8 | NOT\_FOUND | CLOSED | CCTV NOT\_VISIBLE (reason CCTV\_NOT\_VISIBLE) or visit window expired (VISIT\_WINDOW\_EXPIRED) | Student notified |
| 9 | NOT\_FOUND | THEFT\_FORWARDED | CCTV THEFT\_SUSPECTED | THEFT\_TRACKING assignment to theft handler; student sees "forwarded for further action" |
| 10 | OPEN or ASSIGNED | CLOSED | Student withdraws (WITHDRAWN\_BY\_STUDENT) or admin closes (ADMIN\_CLOSED) | Active assignment COMPLETED, matches DISMISSED |

Terminal statuses: RETURNED, CLOSED, THEFT\_FORWARDED (the theft handler's assignment may still be ACTIVE and escalate; the report status stays THEFT\_FORWARDED).

**Stage by stage**

1. **Item found.** Someone hands an item to SJT G03. Staff log category, room found in, found\_at, a generic description ("black steel bottle"), colour, brand, 1–3 photos and a unique shelf code (format `SH-A01`). No marks or contents. Trigger matches it against open reports and notifies the assigned faculty of new matches.
2. **Report filed.** Student signs in with Google, fills category, room, `lost_from` and `lost_to` (max 24 hours apart, not in the future), description, colour, brand and identifying marks. Trigger computes matches and assigns the least-loaded available level-1 faculty.
3. **Faculty review.** Faculty queue shows each case with due time, the marks, and match cards (photo, description, score, found time, room). Faculty shortlist or dismiss matches, then schedule a verification on one match: date-time and venue (default from setting `default_verification_venue`).
4. **Escalation.** Every 5 minutes `sp_run_jobs` runs `sp_escalate_overdue`: an ACTIVE assignment past `due_at` becomes ESCALATED and a new ACTIVE one goes to `reports_to_id` at level + 1. At the top (Dean, `reports_to_id` NULL) the deadline is renewed, an audit row TOP\_LEVEL\_OVERDUE is written, and all admins are notified. Scheduling a verification does not stop the clock; recording the outcome or declaring not found does.
5. **Verification and handover.** At the visit, faculty compares the claimed marks (shown) with the item, types the observed marks and picks VERIFIED, FAILED or NO\_SHOW. VERIFIED runs `sp_complete_handover` in one transaction; the letter PDF (with QR) is downloaded, printed, signed by the student and the item is handed over. Staff or faculty then click "Mark handed over" to set `handed_over_at`.
6. **Not found → room search → CCTV → theft.** After NOT\_FOUND the student sees: "Visit SJT G03 between 9:00 AM and 5:00 PM on or before \<date> and search the room yourself. Carry your ID." (hours and window from settings). Staff record the visit: FOUND\_ITEM (staff select the found item, or log it first) or NOT\_FOUND; if NOT\_FOUND and the student asks in person, staff check CCTV and record LOCATED, NOT\_VISIBLE or THEFT\_SUSPECTED. CCTV requests are never made online.
7. **Housekeeping.** The job closes NOT\_FOUND reports older than `visit_window_days`, flags AVAILABLE items older than `unclaimed_after_days` (sets `unclaimed_flagged_at`, notifies staff), and retries assignment for OPEN reports. Staff can mark flagged items DISPOSED or DONATED with a reason.

## 5. Database design

The database has 16 tables in 3NF; the DDL below is the exact target, so paste it into the AI as-is rather than letting it design its own.

**Relationships**

| # | Relationship | Cardinality | Implemented by |
| --- | --- | --- | --- |
| 1 | Role has Users | 1 : N | users.role\_id |
| 2 | Designation applies to Users | 1 : N | users.designation\_id |
| 3 | User reports to User | N : 1 (self) | users.reports\_to\_id |
| 4 | Category classifies FoundItems and LostReports | 1 : N | category\_id in both |
| 5 | Location is where items are found and lost | 1 : N | location\_id in both |
| 6 | Staff user logs FoundItems | 1 : N | found\_items.logged\_by |
| 7 | FoundItem has ItemImages | 1 : N | item\_images.found\_id |
| 8 | Student files LostReports | 1 : N | lost\_reports.student\_id |
| 9 | LostReport ↔ FoundItem | M : N | matches (bridge) |
| 10 | LostReport has Assignments to faculty | 1 : N | assignments.report\_id, assigned\_to |
| 11 | Match has Verifications | 1 : N | verifications.match\_id |
| 12 | Verification produces HandoverLetter | 1 : 1 | handover\_letters.verification\_id UNIQUE |
| 13 | LostReport has RoomVisits handled by staff | 1 : N | room\_visits.report\_id, handled\_by |
| 14 | User receives Notifications, generates AuditLogs | 1 : N | user\_id in both |

**Normalization notes**

- 1NF: every column atomic; images, matches, assignments, visits are separate tables.
- 2NF: matches holds only attributes of the (report, item) pair: score, source, status.
- 3NF: role names, designation titles, categories and room details are stored once and referenced by key.
- Deliberate snapshot: `verifications.marks_claimed` copies the report's marks at scheduling time (a point-in-time fact; the report can be edited later). It is filled by a trigger, not by the API.

**Full DDL (file `backend/sql/01_schema.sql`)**

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE roles (
  role_id   SERIAL PRIMARY KEY,
  role_name VARCHAR(20) NOT NULL UNIQUE
            CHECK (role_name IN ('STUDENT','STAFF','FACULTY','ADMIN'))
);

CREATE TABLE designations (
  designation_id SERIAL PRIMARY KEY,
  title          VARCHAR(50) NOT NULL UNIQUE,
  level_rank     INT NOT NULL UNIQUE CHECK (level_rank > 0)  -- 1 Faculty, 2 HOD, 3 Dean
);

CREATE TABLE users (
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

CREATE TABLE categories (
  category_id   SERIAL PRIMARY KEY,
  category_name VARCHAR(40) NOT NULL UNIQUE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE locations (
  location_id   SERIAL PRIMARY KEY,
  block         VARCHAR(20) NOT NULL DEFAULT 'SJT',
  room_name     VARCHAR(30) NOT NULL,
  floor_no      INT,
  location_type VARCHAR(15) NOT NULL DEFAULT 'CLASSROOM'
                CHECK (location_type IN ('CLASSROOM','EXAM_HALL','LAB','COMMON_AREA')),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_location UNIQUE (block, room_name)
);

CREATE TABLE found_items (
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

CREATE TABLE item_images (
  image_id     SERIAL PRIMARY KEY,
  found_id     INT NOT NULL REFERENCES found_items(found_id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,          -- path inside the private bucket item-images
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lost_reports (
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

CREATE TABLE matches (
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

CREATE TABLE assignments (
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

CREATE TABLE verifications (
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

CREATE TABLE handover_letters (
  letter_id       SERIAL PRIMARY KEY,
  verification_id INT NOT NULL UNIQUE REFERENCES verifications(verification_id),
  letter_no       VARCHAR(20) NOT NULL UNIQUE,   -- LF-2026-00042
  verify_code     VARCHAR(12) NOT NULL UNIQUE,   -- random, printed as QR
  generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  handed_over_at  TIMESTAMPTZ
);

CREATE TABLE room_visits (
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

CREATE TABLE system_settings (
  setting_key   VARCHAR(50) PRIMARY KEY,
  setting_value VARCHAR(200) NOT NULL,
  description   VARCHAR(200),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title           VARCHAR(80) NOT NULL,
  message         TEXT NOT NULL,
  link            VARCHAR(200),
  is_read         BOOLEAN NOT NULL DEFAULT FALSE,
  emailed_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  log_id      BIGSERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(user_id) ON DELETE SET NULL,  -- NULL = system job
  action      VARCHAR(60) NOT NULL,
  entity_name VARCHAR(30) NOT NULL,
  entity_id   INT,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_users_role        ON users(role_id, is_active);
CREATE INDEX idx_users_reports_to  ON users(reports_to_id);
CREATE INDEX idx_reports_student   ON lost_reports(student_id, status);
CREATE INDEX idx_reports_status_nf ON lost_reports(status, not_found_at);
CREATE INDEX idx_found_match       ON found_items(category_id, status, found_at);
CREATE INDEX idx_found_desc_trgm   ON found_items  USING GIN (description gin_trgm_ops);
CREATE INDEX idx_reports_desc_trgm ON lost_reports USING GIN (description gin_trgm_ops);
CREATE INDEX idx_matches_report    ON matches(report_id, status);
CREATE INDEX idx_matches_found     ON matches(found_id, status);
CREATE INDEX idx_assign_queue      ON assignments(assigned_to, status, due_at);
CREATE INDEX idx_assign_due        ON assignments(due_at) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_active_assignment ON assignments(report_id, assignment_type) WHERE status = 'ACTIVE';
CREATE UNIQUE INDEX uq_one_scheduled_verification ON verifications(match_id) WHERE outcome = 'SCHEDULED';
CREATE INDEX idx_visits_report     ON room_visits(report_id);
CREATE INDEX idx_notif_user        ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_audit_entity      ON audit_logs(entity_name, entity_id);
CREATE INDEX idx_audit_created     ON audit_logs(created_at DESC);
```

**System settings (seed rows)**

| Key | Default | Meaning |
| --- | --- | --- |
| review\_deadline\_minutes | 2880 | Time each assignment level gets before escalation (48 h). Set 2 for the demo |
| visit\_window\_days | 7 | Days after NOT\_FOUND for the room visit |
| unclaimed\_after\_days | 30 | Days before an AVAILABLE item is flagged |
| min\_match\_score | 30 | Matches below this score are not stored |
| room\_visit\_hours | 9:00 AM - 5:00 PM | Shown in the not-found notice |
| lost\_found\_room | SJT G03 | Shown in notices and letters |
| default\_verification\_venue | SJT G03 | Pre-filled in the schedule form |
| theft\_handler\_user\_id | (empty) | Faculty who receives THEFT\_TRACKING cases |

## 6. Phase 0: Project setup (Day 1, 9:00–10:30)

Phase 0 ends with an empty but running backend and frontend, connected to Supabase, pushed to GitHub on `main` and `dev`.

**Folder structure**

```
campusfind/
  backend/
    prisma/
      schema.prisma
      migrations/
        0001_init/migration.sql        <- 01_schema.sql
        0002_db_logic/migration.sql    <- 02_functions.sql + 03_triggers.sql + 04_procedures.sql + 05_views.sql
        0003_seed/migration.sql        <- 06_seed.sql
    sql/                              (the same SQL, split for reading and for the report)
      01_schema.sql 02_functions.sql 03_triggers.sql 04_procedures.sql 05_views.sql 06_seed.sql
      07_demo_data.sql 08_queries.sql
    src/
      app.js  server.js
      config/        env.js prisma.js supabase.js
      middleware/    auth.js authorize.js validate.js errorHandler.js rateLimit.js
      routes/        auth.js reports.js foundItems.js faculty.js matches.js verifications.js
                     letters.js staff.js roomVisits.js notifications.js admin.js public.js
      services/      dbActor.js storage.js pdf.js notify.js
      jobs/          localCron.js
      utils/         httpError.js pagination.js
    tests/           auth.test.js reports.test.js rbac.test.js
    .env.example  Dockerfile  package.json  jest.config.js
  frontend/
    src/
      main.jsx  App.jsx
      api/           client.js  (axios instance + one function per endpoint)
      auth/          AuthContext.jsx  ProtectedRoute.jsx
      components/    Layout.jsx Navbar.jsx StatusBadge.jsx Pagination.jsx DataTable.jsx
                     ConfirmDialog.jsx EmptyState.jsx ErrorBoundary.jsx NotificationBell.jsx
      pages/         student/ staff/ faculty/ admin/ Login.jsx VerifyLetter.jsx NotFound.jsx
    .env.example  Dockerfile  nginx.conf  package.json  tailwind.config.js
  scripts/          backup.sh  restore.sh
  docs/             SPEC.md  er-diagram.png
  docker-compose.yml
  .github/workflows/ci.yml
  .gitignore  README.md
```

**Steps**

1. Create the repo; first commit is `.gitignore` only, containing `node_modules/`, `.env`, `.env.*` (but not `.env.example`), `dist/`, `coverage/`, `*.dump`, `*.pem`.
2. Backend: `npm init -y`, set `"type": "module"`; install `express cors helmet morgan express-rate-limit express-validator jsonwebtoken google-auth-library bcrypt @prisma/client @supabase/supabase-js multer pdfkit qrcode nodemailer node-cron dotenv`; dev: `prisma nodemon jest supertest`.
3. `npx prisma init`. In `schema.prisma` set `datasource db { provider = "postgresql" url = env("DATABASE_URL") directUrl = env("DIRECT_URL") }`.
4. Frontend: `npm create vite@latest frontend -- --template react`; install `react-router-dom @tanstack/react-query axios react-hook-form zod @hookform/resolvers @react-oauth/google react-hot-toast recharts dayjs`; set up Tailwind.
5. Backend `GET /api/health` returns `{ ok: true, db: true }` after running `SELECT 1` through Prisma. Frontend shows a placeholder home page.
6. Push `main`, create `dev` from it. From now on work on feature branches (`feat/db-logic`, `feat/auth`, ...) and merge into `dev` by Pull Request.

**Prisma migration strategy (important)**

Prisma cannot express CHECK constraints, partial indexes, triggers or procedures, so the SQL files are the source of truth and Prisma only reads them:

1. Put the SQL into hand-made migration folders as shown above and run `npx prisma migrate deploy` (never `migrate dev`, which would try to "fix" drift and drop your triggers).
2. Run `npx prisma db pull` to generate models from the live database, then rename models to PascalCase with `@@map("table_name")` and fields to camelCase with `@map("column_name")`.
3. Run `npx prisma generate`. Commit `schema.prisma` and the migrations.
4. Any later schema change = a new numbered SQL migration folder + `migrate deploy` + `db pull`.

**Done when**

- [ ] Both members can clone, `npm install`, and run backend (port 4000) and frontend (port 5173)
- [ ] `/api/health` returns db true against Supabase
- [ ] `.env` is ignored; `.env.example` is committed
- [ ] `main` and `dev` branches exist, branch protection on `main` (PR required)

## 7. Phase 1: Database logic (Day 1, 10:30–15:00, Person A)

Phase 1 puts all workflow rules in PostgreSQL: 12 trigger functions, 10 procedures, 8 views and one scheduled job. All SQL below was run and tested on PostgreSQL 16 against every transition in section 4; paste it as-is.

**Order of files:** `01_schema.sql` (section 5) → `02_functions.sql` → `03_triggers.sql` → `04_procedures.sql` → `05_views.sql` → `06_seed.sql`. Run them in the Supabase SQL editor first to check, then wrap them into the Prisma migration folders from Phase 0.

**How the actor gets into the audit log:** the backend runs every write in a transaction that first sets `app.user_id` (local to that transaction). Triggers read it with `fn_actor()`; scheduled jobs leave it empty, so they log NULL (system).

```js
// backend/src/services/dbActor.js
export const asUser = (userId, fn) =>
  prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.user_id', ${String(userId)}, true)`;
    return fn(tx);
  });
// usage: await asUser(req.user.id, tx => tx.$executeRaw`CALL sp_declare_not_found(${id}::int)`);
```

**02\_functions.sql** (helpers)

```sql
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
```

**03\_triggers.sql**

| Trigger | Table, timing | What it does |
| --- | --- | --- |
| trg\_users\_touch, trg\_reports\_touch | users, lost\_reports BEFORE UPDATE | Set updated\_at |
| trg\_users\_hierarchy | users BEFORE INSERT/UPDATE | Reports-to must be active FACULTY with a higher level; blocks cycles |
| trg\_assignment\_check | assignments BEFORE INSERT | Assignee must be an active FACULTY user |
| trg\_assignment\_notify | assignments AFTER INSERT | Notify assignee, audit |
| trg\_new\_report | lost\_reports AFTER INSERT | Compute matches, auto-assign |
| trg\_new\_found\_item | found\_items AFTER INSERT | Match against open reports, notify their reviewers |
| trg\_report\_status | lost\_reports AFTER UPDATE OF status | Audit + student notification per status |
| trg\_verification\_before | verifications BEFORE INSERT | Validate state, snapshot marks\_claimed |
| trg\_verification\_after | verifications AFTER INSERT | Match SHORTLISTED, report VISIT\_SCHEDULED, notify student |
| trg\_room\_visit\_before | room\_visits BEFORE INSERT | Only for NOT\_FOUND reports; picked item must be AVAILABLE |
| trg\_room\_visit\_after | room\_visits AFTER INSERT | Route: reopen, close, or forward theft |

```sql
CREATE OR REPLACE FUNCTION fn_touch() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_users_touch   BEFORE UPDATE ON users        FOR EACH ROW EXECUTE FUNCTION fn_touch();
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
CREATE TRIGGER trg_room_visit_after AFTER INSERT ON room_visits
FOR EACH ROW EXECUTE FUNCTION fn_room_visit_after();
```

**04\_procedures.sql**

| Procedure | Called by | Effect |
| --- | --- | --- |
| sp\_complete\_handover(verification\_id, observed) | Faculty: outcome VERIFIED | Atomic handover + letter row |
| sp\_record\_verification\_result(id, outcome, observed, remarks) | Faculty: FAILED / NO\_SHOW | Match FAILED (NO\_SHOW keeps it SHORTLISTED), report back to ASSIGNED |
| sp\_declare\_not\_found(report\_id) | Faculty | Cancel visits, dismiss matches, complete assignment, NOT\_FOUND |
| sp\_close\_report(report\_id, reason) | Student withdraw, admin, job | Cancel everything, CLOSED with reason |
| sp\_reassign(report\_id, to\_user) | Admin | Complete active assignment, new one to chosen faculty |
| sp\_escalate\_overdue() | Job | Escalate up the chain or renew + alert admins at top |
| sp\_assign\_pending() | Job | Retry assignment for OPEN reports |
| sp\_close\_expired\_not\_found() | Job | Close NOT\_FOUND past the visit window |
| sp\_flag\_unclaimed() | Job | Flag old AVAILABLE items, notify staff |
| sp\_run\_jobs() | pg\_cron every 5 min | Calls the four job procedures |

```sql
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

-- Supabase (run once in the SQL editor after enabling pg_cron):
-- SELECT cron.schedule('campusfind-jobs', '*/5 * * * *', 'CALL sp_run_jobs()');
```

**05\_views.sql**

| View | Used by | Note |
| --- | --- | --- |
| v\_faculty\_queue | GET /faculty/queue (filtered by assigned\_to) | Includes marks; faculty only |
| v\_report\_matches | Case detail page | Match cards |
| v\_not\_found\_cases | Staff page | No identifying\_marks by design |
| v\_overdue\_cases | Admin overdue page | at\_top = no one left to escalate to |
| v\_escalation\_history | Case timeline | Every level as a row |
| v\_theft\_cases | Theft handler page | Includes CCTV notes |
| v\_hierarchy | Admin hierarchy tree | Recursive CTE |
| v\_dashboard\_stats | Admin dashboard cards | One row of counts |

```sql
CREATE VIEW v_faculty_queue AS
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

CREATE VIEW v_report_matches AS
SELECT m.match_id, m.report_id, m.score, m.source, m.status AS match_status, m.created_at,
       f.found_id, f.description, f.color, f.brand, f.shelf_code, f.found_at, f.status AS item_status,
       l.room_name
FROM matches m
JOIN found_items f ON f.found_id = m.found_id
JOIN locations l   ON l.location_id = f.location_id;

CREATE VIEW v_not_found_cases AS
SELECT r.report_id, u.reg_no, u.full_name, c.category_name, l.room_name,
       r.description, r.color, r.brand, r.lost_from, r.lost_to, r.not_found_at,
       r.not_found_at + make_interval(days => fn_setting('visit_window_days','7')::INT) AS visit_deadline
FROM lost_reports r
JOIN users u      ON u.user_id = r.student_id
JOIN categories c ON c.category_id = r.category_id
JOIN locations l  ON l.location_id = r.location_id
WHERE r.status = 'NOT_FOUND';

CREATE VIEW v_overdue_cases AS
SELECT a.assignment_id, a.report_id, a.assignment_type, a.level, a.due_at,
       u.full_name AS assignee, d.title AS designation, (u.reports_to_id IS NULL) AS at_top
FROM assignments a
JOIN users u ON u.user_id = a.assigned_to
LEFT JOIN designations d ON d.designation_id = u.designation_id
WHERE a.status = 'ACTIVE' AND a.due_at < now();

CREATE VIEW v_escalation_history AS
SELECT a.report_id, a.level, a.assignment_type, u.full_name AS assignee, d.title AS designation,
       a.status, a.assigned_at, a.due_at, a.closed_at
FROM assignments a
JOIN users u ON u.user_id = a.assigned_to
LEFT JOIN designations d ON d.designation_id = u.designation_id;

CREATE VIEW v_theft_cases AS
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

CREATE VIEW v_hierarchy AS
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

CREATE VIEW v_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM lost_reports WHERE status IN ('OPEN','ASSIGNED','VISIT_SCHEDULED')) AS active_reports,
  (SELECT COUNT(*) FROM lost_reports WHERE status = 'NOT_FOUND')       AS not_found,
  (SELECT COUNT(*) FROM lost_reports WHERE status = 'RETURNED')        AS returned,
  (SELECT COUNT(*) FROM lost_reports WHERE status = 'THEFT_FORWARDED') AS theft_forwarded,
  (SELECT COUNT(*) FROM assignments  WHERE status = 'ACTIVE' AND due_at < now()) AS overdue,
  (SELECT COUNT(*) FROM found_items  WHERE status = 'AVAILABLE')       AS items_in_room,
  (SELECT COUNT(*) FROM found_items  WHERE unclaimed_flagged_at IS NOT NULL
                                       AND status = 'AVAILABLE')     AS flagged_items;
```

**06\_seed.sql**

```sql
INSERT INTO roles(role_name) VALUES ('STUDENT'),('STAFF'),('FACULTY'),('ADMIN');
INSERT INTO designations(title, level_rank) VALUES ('Faculty',1),('HOD',2),('Dean',3);
INSERT INTO categories(category_name) VALUES
 ('Water Bottle'),('Electronics'),('ID Card'),('Wallet'),('Bag'),('Keys'),('Calculator'),
 ('Stationery'),('Clothing'),('Spectacles'),('Jewellery'),('Books & Notes'),('Umbrella'),('Other');
INSERT INTO locations(block, room_name, floor_no, location_type) VALUES
 ('SJT','SJT G03',0,'COMMON_AREA'),('SJT','SJT 101',1,'CLASSROOM'),('SJT','SJT 102',1,'CLASSROOM'),
 ('SJT','SJT 201',2,'CLASSROOM'),('SJT','SJT 301',3,'EXAM_HALL'),('SJT','SJT 302',3,'EXAM_HALL'),
 ('SJT','SJT 418',4,'LAB'),('SJT','SJT Ground Floor Lobby',0,'COMMON_AREA');
INSERT INTO system_settings(setting_key, setting_value, description) VALUES
 ('review_deadline_minutes','2880','Minutes each assignment level gets before escalation'),
 ('visit_window_days','7','Days after NOT_FOUND for the student room visit'),
 ('unclaimed_after_days','30','Days before an available item is flagged'),
 ('min_match_score','30','Matches below this score are not stored'),
 ('room_visit_hours','9:00 AM - 5:00 PM','Shown in the not-found notice'),
 ('lost_found_room','SJT G03','Lost and found room name'),
 ('default_verification_venue','SJT G03','Default venue for verification visits'),
 ('theft_handler_user_id','','Faculty user id who receives theft cases');
```

Replace the room list with the real SJT rooms (admin can also add them from the UI later). Keep a separate `07_demo_data.sql` (not a migration) with: 1 Dean, 1 HOD, 2 faculty, 1 staff, 1 admin, 2 students, a few found items; use your own real Google accounts' emails for the people you will log in as during the demo.

**08\_queries.sql (joins and aggregates for the admin dashboard and the report)**

```sql
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
```

**Done when (run each in the SQL editor with demo data)**

- [ ] A report for a matching item creates a match with score above 80 and an ACTIVE level-1 assignment; report status ASSIGNED
- [ ] A second report goes to the other faculty (least-loaded)
- [ ] Logging an item after a report creates the match and notifies the reviewer
- [ ] Scheduling a verification sets VISIT\_SCHEDULED and copies the marks into marks\_claimed
- [ ] sp\_complete\_handover returns the item, creates letter LF-YYYY-00001, and a second call fails with "not pending"
- [ ] NO\_SHOW moves the report back to ASSIGNED
- [ ] Not found → room visit FOUND\_ITEM creates a score-100 ROOM\_SEARCH match and reassigns to the last reviewer
- [ ] Room visit with CCTV THEFT\_SUSPECTED creates a THEFT\_TRACKING assignment; NOT\_VISIBLE closes the report
- [ ] Forcing `due_at` into the past and calling `sp_run_jobs()` escalates Faculty → HOD → Dean, then logs TOP\_LEVEL\_OVERDUE
- [ ] Making a Dean report to a Faculty member fails; assigning a case to a student fails
- [ ] With all faculty unavailable a report stays OPEN; the job assigns it once someone is available
- [ ] pg\_cron job `campusfind-jobs` appears in `cron.job`

## 8. Phase 2: Backend core, auth and RBAC (Day 1, 10:30–15:00, Person B)

Phase 2 delivers Google login, JWT, role checks and the shared backend plumbing every later route uses. Person B builds this in parallel with Phase 1; it needs only the `users` and `roles` tables.

**App setup (`src/app.js`)** in this order: `helmet()`, `cors({ origin: CORS_ORIGIN.split(','), credentials: false })`, `express.json({ limit: '1mb' })`, `morgan('dev')`, a general rate limit (300 requests / 15 min / IP) and a strict one on `/api/auth` (20 / 15 min), then routers under `/api`, then a 404 handler, then the error handler. `src/config/env.js` reads and validates every variable from section 2 at boot and exits with a clear message if one is missing.

**Auth endpoints**

| Method + path | Body | Response | Rules |
| --- | --- | --- | --- |
| POST /api/auth/google | `{ credential }` (Google ID token) | `{ token, user }` | Rules 1–6 from section 3 |
| POST /api/auth/complete-profile | `{ regNo }` | `{ user }` | Students only, once; regex `^\d{2}[A-Z]{3}\d{4}$`; unique |
| POST /api/auth/admin-login | `{ email, password }` | `{ token, user }` | Break-glass admin only (bcrypt); rate-limited 5 / 15 min |
| GET /api/auth/me | — | `{ user }` with role, designation, needsProfile flag | Any logged-in user |
| POST /api/auth/logout | — | 204 | Client discards the token |

`user` object returned everywhere: `{ id, fullName, email, regNo, role, designation, isAvailable, needsProfile }`. Never return `password_hash` or `google_id`.

**Middleware**

1. `auth` — reads `Authorization: Bearer`, verifies with `JWT_SECRET`, loads the user by `sub` from the database with role and designation, rejects missing or inactive users with 401, sets `req.user = { id, role, designationLevel, email }`.
2. `authorize(...roles)` — 403 unless `req.user.role` is in the list. Example: `router.post('/', auth, authorize('STAFF','ADMIN'), ...)`.
3. `requireProfile` — for students, 403 with code `PROFILE_INCOMPLETE` until `reg_no` is set (applied to report routes).
4. `validate` — runs express-validator chains and returns 422 `{ error: 'VALIDATION', details: [{ field, message }] }`.
5. `errorHandler` — maps errors to JSON `{ error, message }`: own `HttpError` → its status; Prisma `P2002` (unique) → 409; Prisma `P2025` → 404; PostgreSQL errors raised by triggers/procedures (`RAISE EXCEPTION`, code `P0001`) → 409 with the database message (these are business-rule errors such as "Verification 3 is not pending"); `23514` check violation → 422; anything else → 500 with a generic message (log the real one, never send stack traces).

**Row-level access helpers (`src/services/access.js`)** — use them in every route that takes an id:

- `assertOwnReport(user, reportId)` — student owns it, else 404 (not 403, so ids cannot be probed).
- `assertFacultyOnCase(user, reportId)` — faculty has an ACTIVE assignment on this report, or had one before (read-only for past ones). Admin always passes. Write actions require ACTIVE.
- `assertTheftHandler(user)` — user id equals setting `theft_handler_user_id`.

**Field whitelists (prevent leaks)** — define one Prisma `select` object per audience and reuse it:

- `reportForStudent`: all of the student's own report fields (including the marks they typed), plus scheduled verification time and venue, plus letter number when RETURNED. No matches, no found items.
- `reportForStaff`: id, student reg\_no and name, category, room, description, colour, brand, lost window, status, not\_found\_at. Never `identifying_marks`.
- `reportForFaculty`: full report including `identifying_marks`.

**Security checklist**

- Google token audience checked; `email_verified` required; domain checked on the server.
- JWT secret 64 hex chars, 8 h expiry; token rejected if the user is deactivated.
- All SQL through Prisma or tagged-template `$queryRaw` / `$executeRaw` (parameterised). Never `$queryRawUnsafe` and never string concatenation.
- The app connects with a dedicated Postgres role `campusfind_app` that has only SELECT/INSERT/UPDATE/DELETE on tables, USAGE on sequences and EXECUTE on functions/procedures; migrations run as the owner. (Optional on Supabase free tier; document it if skipped.)
- Uploads: images only (`image/jpeg`, `image/png`, `image/webp`), max 3 files, 3 MB each, via multer memory storage.

**Done when**

- [ ] Logging in with a `@vitstudent.ac.in` account creates a STUDENT and asks for reg\_no once
- [ ] A `@vit.ac.in` account not created by an admin gets 403 with the friendly message; a bootstrap admin email becomes ADMIN
- [ ] A Gmail account gets 403
- [ ] `GET /api/auth/me` with no token → 401; with a deactivated user's token → 401
- [ ] A STUDENT calling a STAFF route → 403
- [ ] Errors come back as JSON with the right status codes

## 9. Phase 3: Feature APIs (Day 1, 15:00–20:00, both)

Phase 3 exposes every workflow step as a REST endpoint; each write endpoint is a thin wrapper that validates input, checks access, and calls one INSERT or procedure inside `asUser()`.

**Conventions**

- Base path `/api`. JSON in and out. Dates as ISO strings in UTC; the frontend shows IST.
- List endpoints take `?page=1&pageSize=10` (max 50) plus filters, and return `{ data, page, pageSize, total }` using Prisma `skip`/`take` and `count`.
- Ids in paths are integers; validate with `param('id').isInt({ min: 1 })`.
- Procedures are called with tagged templates, e.g. `` tx.$executeRaw`CALL sp_complete_handover(${id}::int, ${observed})` ``.

**Student**

| Method + path | Input | Does |
| --- | --- | --- |
| GET /api/meta | — | Active categories, locations, public settings (room, visit hours). Any logged-in user |
| POST /api/reports | categoryId, locationId, description (10–300), color?, brand?, identifyingMarks (5–1000), lostFrom, lostTo | Validate window ≤ 24 h, lostTo not in future; insert; triggers do the rest. Return report with status |
| GET /api/reports/mine | page, status? | Own reports, newest first |
| GET /api/reports/:id | — | Own report + timeline (audit rows for it, status only) + upcoming verification + letter number |
| POST /api/reports/:id/withdraw | — | `CALL sp_close_report(id, 'WITHDRAWN_BY_STUDENT')`; only OPEN or ASSIGNED |
| GET /api/letters/:verificationId/pdf | — | Student (own) or faculty (on case) or admin; streams PDF |

**Staff**

| Method + path | Input | Does |
| --- | --- | --- |
| POST /api/found-items | multipart: categoryId, locationId, description (3–200), color?, brand?, shelfCode, foundAt, images\[\] (1–3) | Upload images to Supabase `item-images/<foundId>/<uuid>.jpg` after the row insert; insert item\_images rows. If upload fails, delete the item row (compensate) and return 502 |
| GET /api/found-items | page, search (ILIKE on description, brand, shelf), categoryId, locationId, status, flagged, from, to | Staff, faculty, admin. Each row has signed photo URLs (60 min) |
| GET /api/found-items/:id | — | Detail with photos and match count |
| PATCH /api/found-items/:id | description, color, brand, shelfCode | Only while AVAILABLE |
| POST /api/found-items/:id/dispose | action (DISPOSED or DONATED), reason | Only AVAILABLE items; sets disposed\_at |
| POST /api/found-items/:id/handed-over | — | Sets `handed_over_at` on the item's letter |
| GET /api/staff/not-found-cases | page, search (reg\_no) | From `v_not_found_cases` (no marks) |
| POST /api/room-visits | reportId, manualSearchResult, foundId?, cctvChecked, cctvOutcome?, notes | Insert; triggers route the case. 409 if theft handler not set |
| GET /api/room-visits?reportId= | — | Visit history for a case |

**Faculty**

| Method + path | Input | Does |
| --- | --- | --- |
| GET /api/faculty/queue | page, overdue?, type? | From `v_faculty_queue` where assigned\_to = me; sorted by due\_at |
| GET /api/faculty/cases/:reportId | — | Report with marks, match cards (`v_report_matches` + signed photo URLs), verifications, escalation history, room visits. Access: assertFacultyOnCase |
| PATCH /api/matches/:id | status: SHORTLISTED or DISMISSED | Only own ACTIVE case; not allowed on CONFIRMED/FAILED |
| POST /api/matches | reportId, foundId | Manual match (source MANUAL, score computed with fn\_match\_score) for an item faculty found by browsing |
| POST /api/verifications | matchId, scheduledAt (future), venue | Insert with `marks_claimed: ''` (trigger fills it) |
| POST /api/verifications/:id/complete | outcome (VERIFIED, FAILED, NO\_SHOW), marksObserved, remarks? | VERIFIED → `sp_complete_handover`; else `sp_record_verification_result`. Return letter info on VERIFIED |
| POST /api/reports/:id/not-found | — | `CALL sp_declare_not_found(id)` |
| PATCH /api/faculty/me/availability | isAvailable | Toggle own auto-assignment |
| GET /api/theft-cases | page | Theft handler only; from `v_theft_cases` |
| POST /api/theft-cases/:reportId/acknowledge | notes | Completes the THEFT\_TRACKING assignment (stops escalation), writes audit with notes |

**Notifications (any logged-in user)**

| Method + path | Does |
| --- | --- |
| GET /api/notifications?unread=1 | Own notifications, newest first, page size 20 |
| GET /api/notifications/count | `{ unread }` for the bell (frontend polls every 30 s) |
| POST /api/notifications/:id/read and /read-all | Mark read |

**Admin**

| Method + path | Does |
| --- | --- |
| GET /api/admin/stats | `v_dashboard_stats` + the 08\_queries results (per category, per room, per day, escalations per faculty) |
| GET /api/admin/users?role=&search=&page= | List users with role, designation, reports-to name, active ACTIVE-assignment count |
| POST /api/admin/users | email, fullName, role, designationId?, reportsToId? — pre-provision faculty/staff/admin (`@vit.ac.in` only) |
| PATCH /api/admin/users/:id | role, designationId, reportsToId, isActive, isAvailable — DB triggers reject bad hierarchy; block deactivation if user has ACTIVE assignments (409 listing them) |
| GET /api/admin/hierarchy | `v_hierarchy` as a nested tree |
| GET/POST/PATCH /api/admin/designations, /categories, /locations | CRUD; delete only if unused, else deactivate |
| GET /api/admin/settings, PUT /api/admin/settings/:key | Edit settings; validate numbers; theft handler must be an active FACULTY |
| GET /api/admin/overdue | `v_overdue_cases` |
| GET /api/admin/reports?status=&search=&page= | All reports (with marks) |
| POST /api/admin/reports/:id/reassign | `toUserId` → `CALL sp_reassign` |
| POST /api/admin/reports/:id/close | `CALL sp_close_report(id, 'ADMIN_CLOSED')` |
| GET /api/admin/audit-logs?entity=&action=&from=&to=&page= | Audit log with actor name |
| POST /api/admin/jobs/run | `CALL sp_run_jobs()` — a button for the demo |

**Public**

| Method + path | Does |
| --- | --- |
| GET /api/health | `{ ok, db }` |
| GET /api/public/verify/:code | `{ valid, letterNo, generatedAt, category, handedOverAt }` — no names or reg numbers |

**Handover letter PDF (pdfkit, A4)** — header "VIT Vellore — Lost and Found, SJT Block"; letter number and date; "Undertaking for receipt of lost item"; student name, reg no; item category, description, shelf code, found date and room; verified by (faculty name, designation) and verification time; marks claimed vs observed; a declaration paragraph ("I confirm that the item described above belongs to me and I have received it in good condition..."); signature lines for student and faculty; QR code (`qrcode.toDataURL`) of `APP_BASE_URL/verify/<verify_code>` with the code printed under it.

**Email (optional, behind `EMAIL_ENABLED`)** — a 1-minute `setInterval` in the backend picks notifications with `emailed_at IS NULL` created in the last hour, sends one email each via Nodemailer, sets `emailed_at`. Keep it off on Render free tier if the service sleeps; in-app notifications always work.

**Local cron fallback** — if `ENABLE_APP_CRON=true`, `node-cron` runs `CALL sp_run_jobs()` every 5 minutes (for Docker Compose, where pg\_cron is not installed). On Supabase leave it false and use pg\_cron.

**Done when**

- [ ] Postman/Thunder Client collection `docs/campusfind.postman.json` covers every endpoint with saved tokens for each role
- [ ] Full happy path via API only: item logged → report → queue shows it with match → schedule → VERIFIED → PDF downloads with QR → public verify returns valid
- [ ] Not-found path via API: declare → staff sees case without marks → room visit THEFT\_SUSPECTED → theft handler sees it
- [ ] Student cannot GET another student's report (404); staff response never contains `identifyingMarks`
- [ ] Pagination returns correct `total` on every list endpoint

## 10. Phase 4: Frontend (Day 1 evening – Day 2, 14:00, Person B leads)

Phase 4 builds 22 pages across 4 roles on one shared layout; start with the shell and the student flow, because every other page reuses its table, form and badge components.

**Shell (build first, about 1.5 hours)**

- `AuthContext`: holds `token` and `user`; on load reads the token from `localStorage` and calls `/auth/me`; `login(credential)` posts to `/auth/google`; `logout()` clears both.
- `api/client.js`: axios with `baseURL = VITE_API_URL`, adds the Bearer token, on 401 logs out and redirects to `/login`, turns error JSON into `toast.error(message)`. One exported function per endpoint (`getMyReports`, `createReport`, ...).
- TanStack Query for every GET (`queryKey` per resource, invalidated after mutations), so lists refresh after actions.
- `ProtectedRoute roles={[...]}`: not logged in → `/login`; wrong role → `/403`; student without reg\_no → `/complete-profile`.
- `Layout`: left sidebar (collapses to a top bar with menu button under 768 px), menu items by role, notification bell with unread count (poll `/notifications/count` every 30 s) and dropdown list, user name + role + logout.
- Shared components: `StatusBadge` (one colour per status, used everywhere), `DataTable` (columns, loading skeleton, empty state), `Pagination`, `SearchBar` with 300 ms debounce, `FilterSelect`, `ConfirmDialog`, `ImageUploader` (preview, max 3), `Timeline`, `ErrorBoundary` around routes, `NotFound`.
- All dates shown with dayjs in IST: `DD MMM YYYY, hh:mm A`. All forms: React Hook Form + Zod with the same limits as the backend validators.

**Status badge colours**

| Status | Colour | Student-facing label |
| --- | --- | --- |
| OPEN | grey | Submitted |
| ASSIGNED | blue | Under review |
| VISIT\_SCHEDULED | purple | Visit scheduled |
| RETURNED | green | Returned |
| NOT\_FOUND | amber | Not found — visit the room |
| THEFT\_FORWARDED | red | Forwarded for further action |
| CLOSED | slate | Closed |

**Pages**

| Route | Role | Contents |
| --- | --- | --- |
| /login | public | App name, one-line purpose, Google sign-in button (`@react-oauth/google` with `hosted_domain` hint), small "Admin login" link |
| /verify/:code | public | Letter validity check page (green valid / red invalid) |
| /complete-profile | student | Reg no field, one time |
| /student | student | Cards: active reports, returned; button "Report a lost item"; latest notifications |
| /student/report-new | student | Form: category, room, lost from/to (datetime pickers, max 24 h, not future), description, colour, brand, identifying marks (with help text: "Only the verifying faculty will see this") |
| /student/reports | student | Table: id, category, room, filed on, status badge; filter by status; pagination |
| /student/reports/:id | student | Details, status timeline, scheduled visit box (date, time, venue, "carry ID"), not-found notice with deadline, letter download when RETURNED, Withdraw button when OPEN/ASSIGNED |
| /staff | staff | Cards: items in room, flagged unclaimed, not-found cases today; buttons "Log found item", "Record room visit" |
| /staff/items/new | staff | Form with photo upload and shelf code; after save show the shelf code large so it can be written on the tag |
| /staff/items | staff | Table with thumbnail, shelf, category, room, found at, status; search + category/room/status/flagged filters; pagination; row actions: edit, dispose/donate, mark handed over |
| /staff/not-found | staff | Table from v\_not\_found\_cases with visit deadline; search by reg no; "Record visit" opens the form |
| /staff/visits/new?reportId= | staff | Step 1 manual search result; if FOUND\_ITEM pick item (searchable list of AVAILABLE items in that category) or log a new one first; step 2 (only if not found) CCTV checked? outcome + notes; confirmation dialog for THEFT\_SUSPECTED |
| /faculty | faculty | Queue table sorted by due time: report id, category, room, student, due in (red when overdue), level badge (L1/L2/L3), open matches count; availability toggle at the top |
| /faculty/cases/:id | faculty | Left: report incl. marks (highlighted box), lost window, student. Right: match cards (photo carousel, description, colour, brand, shelf, found time and room, score bar, source) with Shortlist / Dismiss / Schedule visit. Below: verifications list with "Record outcome", escalation history, room visits. Header actions: Declare not found (confirm) |
| (modal) Schedule visit | faculty | Date-time (future), venue (default from settings) |
| (modal) Record outcome | faculty | Shows marks claimed; textarea marks observed; outcome radio VERIFIED / FAILED / NO\_SHOW; on VERIFIED show letter download button |
| /faculty/theft | theft handler | Theft cases with CCTV notes; Acknowledge with notes |
| /admin | admin | Stat cards (v\_dashboard\_stats), line chart reports per day (30 days), bar chart per category with recovery %, bar chart reports per room, table escalations per faculty, "Run jobs now" button |
| /admin/users | admin | Table + search + role filter; Add user dialog (email, name, role, designation, reports to — dropdown filtered to higher designations); edit; activate/deactivate |
| /admin/hierarchy | admin | Tree view (Dean → HOD → Faculty) with drag-free "Change reports-to" action per node and each person's active case count |
| /admin/reports, /admin/overdue | admin | All reports with filters; overdue list with Reassign dialog |
| /admin/settings | admin | Tabs: Settings (key-value form; theft handler dropdown), Categories, Locations, Designations |
| /admin/audit | admin | Audit table with filters by entity, action, date range |

**UX rules**

- Every destructive or irreversible action (declare not found, VERIFIED, dispose, theft suspected, deactivate) opens a confirm dialog naming what will happen.
- Buttons show a spinner and are disabled while their request runs (no double submits).
- Every list has loading, empty and error states.
- Photos load from signed URLs; never construct storage URLs in the frontend.

**Done when**

- [ ] Each role sees only its menu; typing another role's URL shows 403
- [ ] Student can file, list, open and withdraw a report on a 375 px phone screen
- [ ] Staff can log an item with 3 photos and find it again with search and filters
- [ ] Faculty can run the full case page flow including letter download
- [ ] Admin can add a HOD and a Dean, set reports-to, and see the tree update
- [ ] Bell count updates within 30 s of a new notification

## 11. Phase 5: Docker, CI/CD, deployment and backup (Day 2, 10:00–16:00, Person A leads)

Phase 5 ends with a live URL on a DuckDNS domain, images on Docker Hub, CI on every PR, auto-deploy on merge to `main`, and a tested backup and restore.

**backend/Dockerfile**

```dockerfile
FROM node:20-slim
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
ENV NODE_ENV=production PORT=4000
EXPOSE 4000
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
```

(`prisma` must be in `dependencies`, not devDependencies, for this to work.)

**frontend/Dockerfile** (multi-stage, served by nginx with SPA fallback)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

`nginx.conf`: `server { listen 80; root /usr/share/nginx/html; location / { try_files $uri /index.html; } }`

**docker-compose.yml** (local full stack; uses plain Postgres 16, which includes pg\_trgm but not pg\_cron, so the backend's node-cron runs the jobs)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: campusfind, POSTGRES_PASSWORD: campusfind, POSTGRES_DB: campusfind }
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck: { test: ["CMD-SHELL", "pg_isready -U campusfind"], interval: 5s, retries: 10 }
  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      DATABASE_URL: postgresql://campusfind:campusfind@db:5432/campusfind
      DIRECT_URL: postgresql://campusfind:campusfind@db:5432/campusfind
      ENABLE_APP_CRON: "true"
    ports: ["4000:4000"]
    depends_on: { db: { condition: service_healthy } }
  frontend:
    build:
      context: ./frontend
      args: { VITE_API_URL: "http://localhost:4000/api", VITE_GOOGLE_CLIENT_ID: "${VITE_GOOGLE_CLIENT_ID}" }
    ports: ["8080:80"]
    depends_on: [backend]
volumes: { pgdata: {} }
```

Add `http://localhost:8080` to the Google OAuth origins and `CORS_ORIGIN` for the Docker run.

**.github/workflows/ci.yml**

```yaml
name: ci
on:
  pull_request: { branches: [dev, main] }
  push: { branches: [main] }
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_USER: ci, POSTGRES_PASSWORD: ci, POSTGRES_DB: ci }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://ci:ci@localhost:5432/ci
      DIRECT_URL: postgresql://ci:ci@localhost:5432/ci
      JWT_SECRET: ci-secret-ci-secret-ci-secret-ci-secret
      GOOGLE_CLIENT_ID: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci && npx prisma migrate deploy && npm run lint && npm test
        working-directory: backend
      - run: npm ci && npm run lint && npm run build
        working-directory: frontend
  docker:
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/login-action@v3
        with: { username: "${{ secrets.DOCKERHUB_USERNAME }}", password: "${{ secrets.DOCKERHUB_TOKEN }}" }
      - uses: docker/build-push-action@v6
        with: { context: ./backend, push: true, tags: "${{ secrets.DOCKERHUB_USERNAME }}/campusfind-backend:latest,${{ secrets.DOCKERHUB_USERNAME }}/campusfind-backend:${{ github.sha }}" }
      - uses: docker/build-push-action@v6
        with:
          context: ./frontend
          push: true
          build-args: |
            VITE_API_URL=${{ secrets.PROD_API_URL }}
            VITE_GOOGLE_CLIENT_ID=${{ secrets.GOOGLE_CLIENT_ID }}
          tags: "${{ secrets.DOCKERHUB_USERNAME }}/campusfind-frontend:latest"
      - name: Trigger Render deploy
        run: curl -fsS -X POST "${{ secrets.RENDER_DEPLOY_HOOK }}"
```

GitHub secrets: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `RENDER_DEPLOY_HOOK`, `PROD_API_URL`, `GOOGLE_CLIENT_ID`. Vercel deploys the frontend on its own from `main` through its GitHub integration.

**Deployment steps**

1. **Database (Supabase):** run `npx prisma migrate deploy` from a laptop with `DIRECT_URL` set, run `07_demo_data.sql` in the SQL editor, enable pg\_cron and run the `cron.schedule` line from Phase 1. Check `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5;` after 5 minutes.
2. **Backend (Render):** New Web Service → from the repo, root `backend`, runtime Docker (uses the Dockerfile), instance Free, region Singapore. Add every backend env var. Health check path `/api/health`. Copy the deploy hook URL into GitHub secrets. Note: the free instance sleeps after 15 minutes idle and takes about 50 s to wake — open the URL 2 minutes before a demo.
3. **Frontend (Vercel):** import the repo, root `frontend`, framework Vite, env `VITE_API_URL=https://<render-app>.onrender.com/api` and `VITE_GOOGLE_CLIENT_ID`. Add `frontend/vercel.json`: `{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }` so deep links work.
4. **Google OAuth:** add the Vercel URL and the DuckDNS URL to Authorised JavaScript origins. Set backend `CORS_ORIGIN` and `APP_BASE_URL` to the final URL.
5. **Domain (DuckDNS):** in DuckDNS set your subdomain's IP to `76.76.21.21` (Vercel's address). In Vercel → Domains add `campusfind.duckdns.org`. If Vercel asks for TXT verification, set it with `https://www.duckdns.org/update?domains=campusfind&token=<token>&txt=<value>`. Wait for the certificate, then open `https://campusfind.duckdns.org`.
6. **Docker Hub:** after the first merge to `main`, confirm both images appear with the `latest` and SHA tags.

**Backup and restore (`scripts/backup.sh`, `scripts/restore.sh`)**

```bash
#!/usr/bin/env bash
# backup.sh  -- needs DIRECT_URL in the environment; pg_dump major version >= server version
set -euo pipefail
mkdir -p backups
FILE="backups/campusfind_$(date +%Y%m%d_%H%M%S).dump"
pg_dump "$DIRECT_URL" --format=custom --no-owner --no-privileges \
  --schema=public --file="$FILE"
echo "Backup written to $FILE"
```

```bash
#!/usr/bin/env bash
# restore.sh <dump file> <target database url>
set -euo pipefail
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$2" "$1"
echo "Restored $1"
```

If the laptop's `pg_dump` is older than Supabase's Postgres, run it from Docker: `docker run --rm -v "$PWD/backups:/b" postgres:17 pg_dump "$DIRECT_URL" -Fc --no-owner --schema=public -f /b/campusfind.dump`. Optional nightly backup: a scheduled GitHub Action (`cron: '30 20 * * *'` = 2:00 AM IST) that runs backup.sh and uploads the dump as a workflow artifact with 7-day retention.

Restore demo (record with timestamps visible): count rows in `lost_reports` → run backup → delete a few rows → count again → restore into the local Docker database (or a fresh Supabase branch) → count shows the original number.

**Done when**

- [ ] `docker compose up --build` starts the full stack locally and login works on `http://localhost:8080`
- [ ] CI runs green on a PR to `dev`; merge to `main` pushes images and triggers the Render deploy
- [ ] Live URL on DuckDNS loads over HTTPS and Google login works there
- [ ] Backup file created, rows deleted and restored successfully

## 12. Phase 6: Testing and demo (Day 2, 16:00–20:00, both)

Phase 6 proves every path works on the live URL and rehearses a 10-minute demo; set `review_deadline_minutes` to 2 before the demo and back to 2880 after.

**Automated tests (Jest + Supertest, run in CI)** — tests create JWTs directly with `JWT_SECRET` for seeded users, so Google is not needed in CI.

| File | Tests |
| --- | --- |
| auth.test.js | No token → 401; bad token → 401; inactive user → 401; non-college domain rejected (mock the Google verifier) |
| rbac.test.js | Student on staff route → 403; staff on admin route → 403; student reading another student's report → 404; staff not-found list has no `identifyingMarks` key |
| reports.test.js | Create report → 201 and status ASSIGNED; window over 24 h → 422; future lost\_to → 422; withdraw ASSIGNED → CLOSED; withdraw RETURNED → 409 |
| workflow.test.js | Full happy path through the API ending in RETURNED and a letter; double complete → 409; not-found → room visit FOUND\_ITEM → ASSIGNED |
| escalation.test.js | Set due\_at in the past, call `/admin/jobs/run`, expect level 2 assignment to the HOD |

**Manual test checklist (live URL, real Google accounts)**

- [ ] Student login, profile completion, file report on phone width
- [ ] Staff logs item with photos; photo visible to faculty, not to student (try the URL in student session → 404)
- [ ] Faculty sees match with score, shortlists, schedules visit; student gets notification with time and venue
- [ ] VERIFIED produces a PDF with QR; scanning QR on a phone opens /verify and shows valid
- [ ] FAILED and NO\_SHOW return the case to the queue
- [ ] Not found → staff record visit with CCTV THEFT\_SUSPECTED → theft handler sees the case; student sees "forwarded"
- [ ] Escalation with 2-minute deadline: Faculty → HOD → Dean → admin alert
- [ ] Admin adds a new HOD and moves a faculty member under them; cycle attempt shows an error toast
- [ ] Settings change (e.g. visit window) shows up in the next not-found notice
- [ ] Audit log shows the actor's name for user actions and "System" for job actions
- [ ] Search, filters and pagination on staff items, admin users, admin reports, audit log
- [ ] Backup and restore demo recorded

**Demo script (10 minutes, three browser profiles: student, staff, faculty; admin in a fourth or incognito)**

1. (Admin) Show the hierarchy tree Dean → HOD → 2 Faculty; settings with 2-minute deadline and theft handler. 1 min
2. (Staff) Log "black steel bottle, Milton" found in SJT 101 with a photo; show shelf code. 1 min
3. (Student) File a lost report for a black Milton bottle in SJT 101 with marks "cat sticker near cap". Status shows Under review. 1 min
4. (Faculty) Queue shows the case with a 90+ score match and the marks; schedule visit; student's bell shows the visit. 2 min
5. (Faculty) Record VERIFIED with observed marks; download the letter; scan the QR with a phone. 1.5 min
6. (Student) File a second report for earbuds; (Faculty) declare not found; (Staff) record visit, CCTV THEFT\_SUSPECTED; (Theft handler) case appears. 2 min
7. (Admin) Leave a third report untouched; after 2 minutes press "Run jobs now" and show it moved to the HOD in the escalation history; open the dashboard charts and audit log. 1.5 min

Have the database objects open in the Supabase table editor to show triggers, procedures and views if asked.

## 13. Two-person, 2-day schedule

Person A owns the database, workflow APIs and DevOps; Person B owns accounts, auth, the remaining APIs and the frontend; both test on the evening of Day 2.

&#91;embedded content: 2-day plan · 2 lanes · 4 merge gates\]

If a gate slips, cut from the end of the list below rather than skipping a gate.

**Handoff rules**

- Agree on the API contract in section 9 before 10:30 on Day 1; Person B can build the frontend against it with mocked responses until the real endpoint lands.
- One feature branch per phase block; small PRs into `dev`; the other person reviews within 30 minutes. `main` gets merged only at the 16:00 Day 2 gate and after.
- Never edit a merged SQL migration; add a new numbered one. Announce every schema change in your chat, then both run `prisma db pull && prisma generate`.
- Keep one shared Postman collection and one `.env` shared privately (never in Git).
- Each person gives their AI IDE only the sections for their phase plus sections 3, 4 and 5, and pastes the phase's Done-when list at the end of the prompt.

**If time runs short, drop in this order (least visible first)**

1. Email notifications (in-app ones stay)
2. Manual match creation (POST /api/matches)
3. Admin designations CRUD (seeded Faculty, HOD, Dean are enough)
4. Nightly backup Action (keep the manual backup and restore demo)
5. Hierarchy tree view (keep the users table with the reports-to column)

Never drop: Google login with domain rules, RBAC, the triggers and procedures, escalation, handover letter, Docker, deployment and the backup demo.
