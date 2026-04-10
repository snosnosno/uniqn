# Phase 1A: PostgreSQL Schema + RLS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create all 20 PostgreSQL tables, RLS policies, triggers, and indexes for the UNIQN Mobile app's Supabase backend.

**Architecture:** Firestore document collections (NoSQL) mapped to relational PostgreSQL tables with proper foreign keys, JSONB for nested objects, and RLS for row-level security. All migrations applied via Supabase MCP `apply_migration` tool. Project ID: `ygfxukhktpqymahfrvbz`.

**Tech Stack:** PostgreSQL 17, Supabase RLS, pg_cron, pg_net

---

## Task 1: Helper Functions + Enums

**Purpose:** Create reusable helper functions and enum types used across all tables.

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_helpers_and_enums`:

```sql
-- Helper: auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper: get current user's role from JWT
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    ''
  );
$$ LANGUAGE sql STABLE;

-- Helper: XSS detection
CREATE OR REPLACE FUNCTION check_xss_fields()
RETURNS TRIGGER AS $$
DECLARE
  field_value TEXT;
  field_name TEXT;
  xss_pattern TEXT := '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed';
BEGIN
  FOR field_name IN SELECT unnest(TG_ARGV)
  LOOP
    EXECUTE format('SELECT ($1).%I::text', field_name) INTO field_value USING NEW;
    IF field_value IS NOT NULL AND field_value ~* xss_pattern THEN
      RAISE EXCEPTION 'XSS pattern detected in field: %', field_name;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enum types
CREATE TYPE user_role AS ENUM ('admin', 'employer', 'staff');
CREATE TYPE staff_role AS ENUM ('dealer', 'floor', 'serving', 'manager', 'staff', 'other');
CREATE TYPE posting_type AS ENUM ('regular', 'fixed', 'tournament', 'urgent');
CREATE TYPE posting_status AS ENUM ('draft', 'pending', 'approved', 'active', 'closed', 'cancelled', 'expired', 'rejected');
CREATE TYPE application_status AS ENUM ('applied', 'confirmed', 'rejected', 'cancelled', 'completed', 'cancellation_pending');
CREATE TYPE work_log_status AS ENUM ('scheduled', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show');
CREATE TYPE payroll_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE notification_category AS ENUM ('application', 'attendance', 'settlement', 'job', 'system', 'admin', 'review');
CREATE TYPE board_type AS ENUM ('notice', 'schedule', 'free', 'tda');
CREATE TYPE announcement_category AS ENUM ('notice', 'update', 'event', 'maintenance');
CREATE TYPE announcement_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE review_sentiment AS ENUM ('positive', 'neutral', 'negative');
CREATE TYPE report_severity AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE inquiry_status AS ENUM ('open', 'in_progress', 'closed');
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT typname FROM pg_type WHERE typname = 'user_role';` -- should return 1 row.

- [ ] **Step 3: Verify helper function**

Run `execute_sql`: `SELECT get_my_role();` -- should return empty string (no auth context).

---

## Task 2: Users + App Config Tables

**Purpose:** Create the core users table (FK to auth.users) and app_config table.

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_users_and_app_config`:

```sql
-- Users (public profile, linked to auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT UNIQUE,
  phone TEXT UNIQUE,
  role user_role NOT NULL DEFAULT 'staff',
  photo_url TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  identity_verified BOOLEAN DEFAULT FALSE,
  identity_verified_at TIMESTAMPTZ,
  identity_provider TEXT,
  identity JSONB,
  gender TEXT CHECK (gender IN ('male', 'female')),
  birth_date TEXT,
  region TEXT,
  experience_years INTEGER,
  career TEXT,
  note TEXT,
  social_provider TEXT CHECK (social_provider IN ('apple', 'google', 'kakao', 'naver')),
  terms_agreed BOOLEAN DEFAULT FALSE,
  privacy_agreed BOOLEAN DEFAULT FALSE,
  marketing_agreed BOOLEAN DEFAULT FALSE,
  employer_agreements JSONB,
  employer_registered_at TIMESTAMPTZ,
  bubble_score JSONB DEFAULT '{"score":50,"totalReviewCount":0,"positiveCount":0,"neutralCount":0,"negativeCount":0}'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'deleted')),
  profile_completed BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  fcm_tokens JSONB DEFAULT '{}'::jsonb,
  deletion_requested_at TIMESTAMPTZ,
  deletion_scheduled_for TIMESTAMPTZ,
  is_orphan BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-update trigger
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- XSS check on user-editable text fields
CREATE TRIGGER users_xss_check
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('name', 'nickname', 'note', 'career');

-- Role sync: when users.role changes, update auth.users.raw_app_meta_data
CREATE OR REPLACE FUNCTION sync_role_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    UPDATE auth.users
    SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role::text)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER users_role_sync
  AFTER UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION sync_role_to_auth();

-- User consents (sub-collection)
CREATE TABLE public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,
  version TEXT,
  agreed BOOLEAN NOT NULL DEFAULT FALSE,
  agreed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- App config (replaces Remote Config)
CREATE TABLE public.app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed essential config
INSERT INTO public.app_config (key, value, description) VALUES
  ('force_update_version', '{"ios": "1.0.0", "android": "1.0.0", "web": "1.0.0"}'::jsonb, '강제 업데이트 최소 버전'),
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb, '점검 모드'),
  ('feature_flags', '{}'::jsonb, '기능 플래그');

-- Indexes
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_user_consents_user ON public.user_consents(user_id);
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public' ORDER BY ordinal_position;`

- [ ] **Step 3: Verify config seed**

Run `execute_sql`: `SELECT key, value FROM app_config;` -- should return 3 rows.

---

## Task 3: Job Postings + Templates Tables

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_job_postings`:

```sql
CREATE TABLE public.job_postings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_version INTEGER DEFAULT 3,
  title TEXT NOT NULL,
  description TEXT,
  status posting_status NOT NULL DEFAULT 'draft',
  owner_id UUID NOT NULL REFERENCES public.users(id),
  owner_name TEXT,
  posting_type posting_type DEFAULT 'regular',
  work_date TEXT,
  work_dates TEXT[],
  last_work_date DATE,
  role_keys TEXT[],
  total_positions INTEGER DEFAULT 0,
  filled_positions INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  stats JSONB DEFAULT '{"totalApplicants":0,"activeApplicants":0,"confirmedApplicants":0,"cancellationPendingApplicants":0,"filledPositions":0}'::jsonb,
  closed_at TIMESTAMPTZ,
  closed_reason TEXT CHECK (closed_reason IN ('manual', 'expired', 'expired_by_work_date')),
  tags TEXT[],
  contact_phone TEXT,
  location JSONB NOT NULL DEFAULT '{}'::jsonb,
  schedule JSONB NOT NULL DEFAULT '{}'::jsonb,
  role_catalog JSONB DEFAULT '[]'::jsonb,
  compensation JSONB DEFAULT '{}'::jsonb,
  questions JSONB DEFAULT '{"items":[]}'::jsonb,
  fixed_config JSONB,
  tournament_config JSONB,
  urgent_config JSONB,
  rejection_reason TEXT,
  og_image_url TEXT,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER job_postings_updated_at
  BEFORE UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER job_postings_xss_check
  BEFORE INSERT OR UPDATE ON public.job_postings
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('title', 'description');

-- Indexes (13 from Firestore)
CREATE INDEX idx_jp_owner ON public.job_postings(owner_id);
CREATE INDEX idx_jp_status_created ON public.job_postings(status, created_at DESC);
CREATE INDEX idx_jp_owner_status ON public.job_postings(owner_id, status);
CREATE INDEX idx_jp_owner_created ON public.job_postings(owner_id, created_at DESC);
CREATE INDEX idx_jp_type_status ON public.job_postings(posting_type, status, created_at DESC);
CREATE INDEX idx_jp_featured ON public.job_postings(status, is_featured DESC, created_at DESC);
CREATE INDEX idx_jp_last_work_date ON public.job_postings(last_work_date) WHERE status IN ('approved', 'active', 'closed');
CREATE INDEX idx_jp_work_date ON public.job_postings(work_date);

-- Job Posting Templates
CREATE TABLE public.job_posting_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER templates_updated_at
  BEFORE UPDATE ON public.job_posting_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_templates_user ON public.job_posting_templates(user_id);
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT count(*) FROM information_schema.columns WHERE table_name = 'job_postings';` -- should be ~30+ columns.

---

## Task 4: Applications Table

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_applications`:

```sql
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  status application_status NOT NULL DEFAULT 'applied',
  applicant_name TEXT NOT NULL,
  applicant_phone TEXT,
  applicant_email TEXT,
  applicant_role staff_role,
  applicant_nickname TEXT,
  applicant_photo_url TEXT,
  job_posting_title TEXT,
  job_posting_date TEXT,
  recruitment_type TEXT CHECK (recruitment_type IN ('event', 'fixed')),
  custom_role TEXT,
  message TEXT,
  assignments JSONB DEFAULT '[]'::jsonb,
  original_application JSONB,
  confirmation_history JSONB DEFAULT '[]'::jsonb,
  pre_question_answers JSONB,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  is_read BOOLEAN DEFAULT FALSE,
  notes TEXT,
  cancellation_request JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(job_posting_id, applicant_id)
);

CREATE TRIGGER applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER applications_xss_check
  BEFORE INSERT OR UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('message', 'notes');

-- Indexes (9 from Firestore)
CREATE INDEX idx_app_applicant ON public.applications(applicant_id, created_at DESC);
CREATE INDEX idx_app_applicant_status ON public.applications(applicant_id, status, created_at DESC);
CREATE INDEX idx_app_posting ON public.applications(job_posting_id, created_at DESC);
CREATE INDEX idx_app_posting_status ON public.applications(job_posting_id, status, created_at DESC);
CREATE INDEX idx_app_status ON public.applications(status);
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT conname FROM pg_constraint WHERE conrelid = 'public.applications'::regclass AND contype = 'u';` -- should show the unique constraint.

---

## Task 5: Work Logs Table

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_work_logs`:

```sql
CREATE TABLE public.work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.users(id),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  application_id UUID REFERENCES public.applications(id),
  assignment_group_id TEXT,
  date TEXT NOT NULL,
  is_fixed_posting BOOLEAN DEFAULT FALSE,
  staff_name TEXT,
  staff_nickname TEXT,
  staff_photo_url TEXT,
  check_in_time JSONB,
  check_out_time JSONB,
  status work_log_status NOT NULL DEFAULT 'scheduled',
  role staff_role NOT NULL DEFAULT 'staff',
  custom_role TEXT,
  payroll_status payroll_status DEFAULT 'pending',
  payroll_amount NUMERIC(12,2),
  payroll_date TIMESTAMPTZ,
  payroll_notes TEXT,
  no_show_at JSONB,
  no_show_reason TEXT,
  modification_history JSONB DEFAULT '[]'::jsonb,
  role_change_history JSONB DEFAULT '[]'::jsonb,
  settlement_modification_history JSONB DEFAULT '[]'::jsonb,
  has_time_modification_logs BOOLEAN DEFAULT FALSE,
  custom_salary_info JSONB,
  custom_allowances JSONB,
  custom_tax_settings JSONB,
  notes TEXT,
  time_slot TEXT,
  owner_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER work_logs_updated_at
  BEFORE UPDATE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_wl_staff_date ON public.work_logs(staff_id, date DESC);
CREATE INDEX idx_wl_posting_date ON public.work_logs(job_posting_id, date);
CREATE INDEX idx_wl_posting_staff ON public.work_logs(job_posting_id, staff_id);
CREATE INDEX idx_wl_status ON public.work_logs(status) WHERE status NOT IN ('completed', 'cancelled');
CREATE INDEX idx_wl_payroll ON public.work_logs(payroll_status) WHERE payroll_status = 'pending';
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT count(*) FROM information_schema.columns WHERE table_name = 'work_logs';`

---

## Task 6: Notifications Table

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_notifications`:

```sql
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  category notification_category,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notif_recipient ON public.notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notif_unread ON public.notifications(recipient_id) WHERE is_read = FALSE;
CREATE INDEX idx_notif_type ON public.notifications(recipient_id, type, created_at DESC);
CREATE INDEX idx_notif_category ON public.notifications(recipient_id, category, created_at DESC);

-- Unread counter function (replaces Cloud Function)
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $$
  SELECT count(*)::integer FROM public.notifications
  WHERE recipient_id = p_user_id AND is_read = FALSE;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT get_unread_notification_count('00000000-0000-0000-0000-000000000000'::uuid);` -- should return 0.

---

## Task 7: Board System Tables

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_board_system`:

```sql
-- Board Posts
CREATE TABLE public.board_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_type board_type NOT NULL DEFAULT 'free',
  source TEXT DEFAULT 'board' CHECK (source IN ('board', 'announcement')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'participants_only')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'locked', 'hidden', 'archived')),
  linked_job_posting_id UUID REFERENCES public.job_postings(id),
  is_auto_created BOOLEAN DEFAULT FALSE,
  is_locked BOOLEAN DEFAULT FALSE,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  like_count INTEGER DEFAULT 0,
  dislike_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  image_attachments JSONB DEFAULT '[]'::jsonb,
  last_activity_at TIMESTAMPTZ,
  announcement_category announcement_category,
  is_pinned BOOLEAN DEFAULT FALSE,
  job_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER board_posts_updated_at
  BEFORE UPDATE ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER board_posts_xss_check
  BEFORE INSERT OR UPDATE ON public.board_posts
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('title', 'body');

-- Board Comments
CREATE TABLE public.board_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.board_comments(id),
  body TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES public.users(id),
  author_name TEXT NOT NULL,
  author_role TEXT NOT NULL,
  mentioned_user_ids TEXT[] DEFAULT '{}',
  reaction_counts JSONB DEFAULT '{}'::jsonb,
  is_pinned BOOLEAN DEFAULT FALSE,
  pinned_at TIMESTAMPTZ,
  pinned_by TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  image_attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER board_comments_updated_at
  BEFORE UPDATE ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER board_comments_xss_check
  BEFORE INSERT OR UPDATE ON public.board_comments
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('body');

-- Board Votes
CREATE TABLE public.board_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('like', 'dislike')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Board Memberships
CREATE TABLE public.board_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_type board_type DEFAULT 'schedule',
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  role TEXT DEFAULT 'confirmed' CHECK (role IN ('author', 'confirmed', 'admin')),
  display_name TEXT,
  can_read BOOLEAN DEFAULT TRUE,
  can_comment BOOLEAN DEFAULT TRUE,
  title TEXT,
  work_date TEXT,
  author_id UUID,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, post_id)
);

CREATE TRIGGER board_memberships_updated_at
  BEFORE UPDATE ON public.board_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Board Reports
CREATE TABLE public.board_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  post_id UUID NOT NULL REFERENCES public.board_posts(id),
  reporter_id UUID NOT NULL REFERENCES public.users(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Board Indexes
CREATE INDEX idx_bp_type_created ON public.board_posts(board_type, created_at DESC);
CREATE INDEX idx_bp_author ON public.board_posts(author_id);
CREATE INDEX idx_bp_linked_jp ON public.board_posts(linked_job_posting_id) WHERE linked_job_posting_id IS NOT NULL;
CREATE INDEX idx_bc_post ON public.board_comments(post_id, created_at);
CREATE INDEX idx_bm_user ON public.board_memberships(user_id);
CREATE INDEX idx_bm_posting ON public.board_memberships(job_posting_id);
CREATE INDEX idx_br_post ON public.board_reports(post_id);
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'board%';` -- should return 4 tables.

---

## Task 8: Remaining Tables (Announcements, Reviews, Reports, Inquiries, EventQR, RateLimits, ActionLogs)

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_remaining_tables`:

```sql
-- Announcements
CREATE TABLE public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category announcement_category NOT NULL DEFAULT 'notice',
  status announcement_status NOT NULL DEFAULT 'draft',
  priority INTEGER DEFAULT 0 CHECK (priority IN (0, 1, 2)),
  is_pinned BOOLEAN DEFAULT FALSE,
  target_audience JSONB DEFAULT '{"type":"all"}'::jsonb,
  author_id UUID NOT NULL REFERENCES public.users(id),
  author_name TEXT NOT NULL,
  view_count INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  image_url TEXT,
  image_storage_path TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER announcements_xss_check
  BEFORE INSERT OR UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('title', 'content');

CREATE INDEX idx_ann_status ON public.announcements(status, priority DESC, created_at DESC);
CREATE INDEX idx_ann_pinned ON public.announcements(is_pinned DESC, created_at DESC) WHERE status = 'published';

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_log_id UUID NOT NULL REFERENCES public.work_logs(id),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  job_posting_title TEXT,
  work_date TEXT,
  reviewer_id UUID NOT NULL REFERENCES public.users(id),
  reviewer_name TEXT NOT NULL,
  reviewer_type TEXT NOT NULL CHECK (reviewer_type IN ('employer', 'staff')),
  reviewee_id UUID NOT NULL REFERENCES public.users(id),
  reviewee_name TEXT NOT NULL,
  sentiment review_sentiment NOT NULL,
  tags TEXT[] DEFAULT '{}',
  comment TEXT,
  bubble_score_change INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_rev_reviewer ON public.reviews(reviewer_id, created_at DESC);
CREATE INDEX idx_rev_reviewee ON public.reviews(reviewee_id, created_at DESC);
CREATE INDEX idx_rev_worklog ON public.reviews(work_log_id);

-- Reports
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  reporter_type TEXT NOT NULL CHECK (reporter_type IN ('employer', 'employee')),
  reporter_id UUID NOT NULL REFERENCES public.users(id),
  reporter_name TEXT NOT NULL,
  target_id UUID NOT NULL,
  target_name TEXT NOT NULL,
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  job_posting_title TEXT,
  work_log_id UUID REFERENCES public.work_logs(id),
  work_date TEXT,
  description TEXT NOT NULL,
  evidence_urls TEXT[],
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  severity report_severity DEFAULT 'medium',
  reviewer_id TEXT,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER reports_xss_check
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('description');

CREATE INDEX idx_rep_status ON public.reports(status, created_at DESC);
CREATE INDEX idx_rep_reporter ON public.reports(reporter_id);
CREATE INDEX idx_rep_severity ON public.reports(severity, status);

-- Inquiries
CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  user_email TEXT,
  user_name TEXT,
  category inquiry_status DEFAULT 'open',
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  status inquiry_status DEFAULT 'open',
  attachments JSONB DEFAULT '[]'::jsonb,
  response TEXT,
  responder_id UUID,
  responder_name TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER inquiries_updated_at
  BEFORE UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER inquiries_xss_check
  BEFORE INSERT OR UPDATE ON public.inquiries
  FOR EACH ROW EXECUTE FUNCTION check_xss_fields('subject', 'message');

CREATE INDEX idx_inq_user ON public.inquiries(user_id);
CREATE INDEX idx_inq_status ON public.inquiries(status);

-- Event QR Codes
CREATE TABLE public.event_qr_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id UUID NOT NULL REFERENCES public.job_postings(id),
  user_id UUID NOT NULL REFERENCES public.users(id),
  type TEXT NOT NULL CHECK (type IN ('checkIn', 'checkOut')),
  code TEXT NOT NULL UNIQUE,
  work_date TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_qr_posting ON public.event_qr_codes(job_posting_id);
CREATE INDEX idx_qr_code ON public.event_qr_codes(code) WHERE is_active = TRUE;

-- Rate Limits
CREATE TABLE public.rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  tokens INTEGER DEFAULT 0,
  last_refill TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_rl_expires ON public.rate_limits(expires_at);

-- Action Logs
CREATE TABLE public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_al_user ON public.action_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_al_action ON public.action_logs(action, created_at DESC);
```

- [ ] **Step 2: Verify**

Run `execute_sql`: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;` -- should return 20 tables total.

---

## Task 9: RLS Policies

**Purpose:** Enable Row Level Security on all tables and create policies matching Firestore rules.

- [ ] **Step 1: Apply migration**

Use `apply_migration` with name `create_rls_policies`:

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_posting_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- ===== USERS =====
CREATE POLICY users_select ON public.users FOR SELECT
  USING (auth.uid() = id OR get_my_role() = 'admin');

CREATE POLICY users_update ON public.users FOR UPDATE
  USING (auth.uid() = id OR get_my_role() = 'admin');

-- ===== USER CONSENTS =====
CREATE POLICY consents_select ON public.user_consents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY consents_insert ON public.user_consents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ===== APP CONFIG =====
CREATE POLICY config_select ON public.app_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY config_modify ON public.app_config FOR ALL
  USING (get_my_role() = 'admin');

-- ===== JOB POSTINGS =====
CREATE POLICY jp_select ON public.job_postings FOR SELECT
  USING (
    status IN ('approved', 'active', 'closed')
    OR owner_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY jp_insert ON public.job_postings FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'employer'));

CREATE POLICY jp_update ON public.job_postings FOR UPDATE
  USING (owner_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY jp_delete ON public.job_postings FOR DELETE
  USING (get_my_role() = 'admin');

-- ===== TEMPLATES =====
CREATE POLICY tmpl_all ON public.job_posting_templates FOR ALL
  USING (auth.uid() = user_id);

-- ===== APPLICATIONS =====
CREATE POLICY app_select ON public.applications FOR SELECT
  USING (
    applicant_id = auth.uid()
    OR job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = auth.uid())
    OR get_my_role() = 'admin'
  );

CREATE POLICY app_insert ON public.applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

CREATE POLICY app_update ON public.applications FOR UPDATE
  USING (
    applicant_id = auth.uid()
    OR job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = auth.uid())
    OR get_my_role() = 'admin'
  );

-- ===== WORK LOGS =====
CREATE POLICY wl_select ON public.work_logs FOR SELECT
  USING (
    staff_id = auth.uid()
    OR owner_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY wl_update ON public.work_logs FOR UPDATE
  USING (
    staff_id = auth.uid()
    OR owner_id = auth.uid()
    OR get_my_role() = 'admin'
  );

-- ===== NOTIFICATIONS =====
CREATE POLICY notif_select ON public.notifications FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY notif_update ON public.notifications FOR UPDATE
  USING (recipient_id = auth.uid());

CREATE POLICY notif_delete ON public.notifications FOR DELETE
  USING (recipient_id = auth.uid() OR get_my_role() = 'admin');

-- ===== BOARD POSTS =====
CREATE POLICY bp_select ON public.board_posts FOR SELECT
  USING (
    visibility = 'public'
    OR author_id = auth.uid()
    OR get_my_role() = 'admin'
    OR EXISTS (SELECT 1 FROM public.board_memberships WHERE user_id = auth.uid() AND post_id = board_posts.id)
  );

CREATE POLICY bp_insert ON public.board_posts FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY bp_update ON public.board_posts FOR UPDATE
  USING (author_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY bp_delete ON public.board_posts FOR DELETE
  USING (author_id = auth.uid() OR get_my_role() = 'admin');

-- ===== BOARD COMMENTS =====
CREATE POLICY bc_select ON public.board_comments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.board_posts bp
    WHERE bp.id = board_comments.post_id
  ));

CREATE POLICY bc_insert ON public.board_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY bc_update ON public.board_comments FOR UPDATE
  USING (author_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY bc_delete ON public.board_comments FOR DELETE
  USING (author_id = auth.uid() OR get_my_role() = 'admin');

-- ===== BOARD VOTES =====
CREATE POLICY bv_select ON public.board_votes FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY bv_insert ON public.board_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY bv_delete ON public.board_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ===== BOARD MEMBERSHIPS =====
CREATE POLICY bm_select ON public.board_memberships FOR SELECT
  USING (user_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY bm_insert ON public.board_memberships FOR INSERT
  WITH CHECK (get_my_role() IN ('admin', 'employer'));

-- ===== BOARD REPORTS =====
CREATE POLICY brep_select ON public.board_reports FOR SELECT
  USING (reporter_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY brep_insert ON public.board_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- ===== ANNOUNCEMENTS =====
CREATE POLICY ann_select ON public.announcements FOR SELECT
  USING (
    (status = 'published')
    OR get_my_role() = 'admin'
  );

CREATE POLICY ann_modify ON public.announcements FOR ALL
  USING (get_my_role() = 'admin');

-- ===== REVIEWS =====
CREATE POLICY rev_select ON public.reviews FOR SELECT
  USING (
    reviewer_id = auth.uid()
    OR reviewee_id = auth.uid()
    OR get_my_role() = 'admin'
  );

CREATE POLICY rev_insert ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- ===== REPORTS =====
CREATE POLICY rep_select ON public.reports FOR SELECT
  USING (reporter_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY rep_insert ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY rep_update ON public.reports FOR UPDATE
  USING (get_my_role() = 'admin');

-- ===== INQUIRIES =====
CREATE POLICY inq_select ON public.inquiries FOR SELECT
  USING (user_id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY inq_insert ON public.inquiries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY inq_update ON public.inquiries FOR UPDATE
  USING (get_my_role() = 'admin');

-- ===== EVENT QR =====
CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT
  USING (
    user_id = auth.uid()
    OR job_posting_id IN (SELECT id FROM public.job_postings WHERE owner_id = auth.uid())
    OR get_my_role() = 'admin'
  );

CREATE POLICY qr_insert ON public.event_qr_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE
  USING (auth.uid() = user_id);

-- ===== RATE LIMITS (service role only) =====
-- No user-facing policies; only service_role can access

-- ===== ACTION LOGS =====
CREATE POLICY al_select ON public.action_logs FOR SELECT
  USING (get_my_role() = 'admin');
```

- [ ] **Step 2: Verify RLS is enabled**

Run `execute_sql`: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;` -- should return 20 tables.

---

## Task 10: Enable Realtime + Final Verification

- [ ] **Step 1: Apply migration for Realtime**

Use `apply_migration` with name `enable_realtime`:

```sql
-- Enable realtime for subscription-heavy tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_comments;

-- Set REPLICA IDENTITY FULL for tables where we need old values in UPDATE events
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.applications REPLICA IDENTITY FULL;
ALTER TABLE public.work_logs REPLICA IDENTITY FULL;
```

- [ ] **Step 2: Final table count verification**

Run `execute_sql`:

```sql
SELECT count(*) as table_count FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
```

Expected: 20 tables.

- [ ] **Step 3: Final RLS verification**

Run `execute_sql`:

```sql
SELECT count(*) as policy_count FROM pg_policies WHERE schemaname = 'public';
```

Expected: ~40+ policies.

- [ ] **Step 4: Run security advisors**

Use `get_advisors` with type `security` to check for any RLS gaps.
