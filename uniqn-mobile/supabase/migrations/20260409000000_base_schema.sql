-- ============================================================================
-- 20260409000000_base_schema.sql
-- UNIQN Base Schema — Docker 로컬 Supabase 실행을 위한 전체 스키마
-- 이 마이그레이션은 이후 모든 증분 마이그레이션보다 먼저 실행됨
-- 멱등성 보장: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensions
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------------------
-- 1. ENUM 타입
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('admin', 'employer', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_category AS ENUM ('notice', 'update', 'event', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.announcement_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.application_status AS ENUM ('applied', 'confirmed', 'rejected', 'cancelled', 'completed', 'cancellation_pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.board_type AS ENUM ('notice', 'schedule', 'free', 'tda');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inquiry_status AS ENUM ('open', 'in_progress', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_category AS ENUM ('application', 'attendance', 'settlement', 'job', 'system', 'admin', 'review');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_status AS ENUM ('pending', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.posting_status AS ENUM ('draft', 'pending', 'approved', 'active', 'closed', 'cancelled', 'expired', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.posting_type AS ENUM ('regular', 'fixed', 'tournament', 'urgent');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.review_sentiment AS ENUM ('positive', 'neutral', 'negative');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.staff_role AS ENUM ('dealer', 'floor', 'serving', 'manager', 'staff', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.work_log_status AS ENUM ('scheduled', 'checked_in', 'checked_out', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------

-- users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  nickname text,
  phone text,
  role public.user_role NOT NULL DEFAULT 'staff',
  photo_url text,
  phone_verified boolean DEFAULT false,
  identity_verified boolean DEFAULT false,
  identity_verified_at timestamptz,
  identity_provider text,
  identity jsonb,
  gender text,
  birth_date text,
  region text,
  experience_years integer,
  career text,
  note text,
  social_provider text,
  terms_agreed boolean DEFAULT false,
  privacy_agreed boolean DEFAULT false,
  marketing_agreed boolean DEFAULT false,
  employer_agreements jsonb,
  employer_registered_at timestamptz,
  bubble_score jsonb DEFAULT '{"score":50,"neutralCount":0,"negativeCount":0,"positiveCount":0,"totalReviewCount":0}'::jsonb,
  status text DEFAULT 'active',
  profile_completed boolean DEFAULT false,
  is_active boolean DEFAULT true,
  fcm_tokens jsonb DEFAULT '{}'::jsonb,
  deletion_requested_at timestamptz,
  deletion_scheduled_for timestamptz,
  is_orphan boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- job_postings
CREATE TABLE IF NOT EXISTS public.job_postings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  schema_version integer DEFAULT 3,
  title text NOT NULL,
  description text,
  status public.posting_status NOT NULL DEFAULT 'draft',
  owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  owner_name text,
  posting_type public.posting_type DEFAULT 'regular',
  work_date text,
  work_dates text[],
  last_work_date date,
  role_keys text[],
  total_positions integer DEFAULT 0,
  filled_positions integer DEFAULT 0,
  view_count integer DEFAULT 0,
  stats jsonb DEFAULT '{"filledPositions":0,"totalApplicants":0,"activeApplicants":0,"confirmedApplicants":0,"cancellationPendingApplicants":0}'::jsonb,
  closed_at timestamptz,
  closed_reason text,
  tags text[],
  contact_phone text,
  location jsonb NOT NULL DEFAULT '{}'::jsonb,
  schedule jsonb NOT NULL DEFAULT '{}'::jsonb,
  role_catalog jsonb DEFAULT '[]'::jsonb,
  compensation jsonb DEFAULT '{}'::jsonb,
  questions jsonb DEFAULT '{"items":[]}'::jsonb,
  fixed_config jsonb,
  tournament_config jsonb,
  urgent_config jsonb,
  rejection_reason text,
  og_image_url text,
  is_featured boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.job_postings ENABLE ROW LEVEL SECURITY;

-- applications
CREATE TABLE IF NOT EXISTS public.applications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  status public.application_status NOT NULL DEFAULT 'applied',
  applicant_name text NOT NULL,
  applicant_phone text,
  applicant_email text,
  applicant_role public.user_role,
  applicant_nickname text,
  applicant_photo_url text,
  job_posting_title text,
  job_posting_date text,
  recruitment_type text,
  custom_role text,
  message text,
  assignments jsonb DEFAULT '[]'::jsonb,
  original_application jsonb,
  confirmation_history jsonb DEFAULT '[]'::jsonb,
  pre_question_answers jsonb,
  processed_by text,
  processed_at timestamptz,
  rejection_reason text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  is_read boolean DEFAULT false,
  notes text,
  cancellation_request jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- work_logs
CREATE TABLE IF NOT EXISTS public.work_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  assignment_group_id text,
  date text NOT NULL,
  is_fixed_posting boolean DEFAULT false,
  staff_name text,
  staff_nickname text,
  staff_photo_url text,
  check_in_time jsonb,
  check_out_time jsonb,
  status public.work_log_status NOT NULL DEFAULT 'scheduled',
  role public.staff_role NOT NULL DEFAULT 'staff',
  custom_role text,
  payroll_status public.payroll_status DEFAULT 'pending',
  payroll_amount numeric,
  payroll_date timestamptz,
  payroll_notes text,
  no_show_at jsonb,
  no_show_reason text,
  modification_history jsonb DEFAULT '[]'::jsonb,
  role_change_history jsonb DEFAULT '[]'::jsonb,
  settlement_modification_history jsonb DEFAULT '[]'::jsonb,
  has_time_modification_logs boolean DEFAULT false,
  custom_salary_info jsonb,
  custom_allowances jsonb,
  custom_tax_settings jsonb,
  notes text,
  time_slot text,
  owner_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  work_duration numeric,
  PRIMARY KEY (id)
);
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;

-- notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  category public.notification_category,
  title text NOT NULL,
  body text NOT NULL,
  link text,
  data jsonb,
  is_read boolean DEFAULT false,
  priority text DEFAULT 'normal',
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  category public.announcement_category NOT NULL DEFAULT 'notice',
  status public.announcement_status NOT NULL DEFAULT 'draft',
  priority integer DEFAULT 0,
  is_pinned boolean DEFAULT false,
  target_audience jsonb DEFAULT '{"type":"all"}'::jsonb,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  view_count integer DEFAULT 0,
  published_at timestamptz,
  image_url text,
  image_storage_path text,
  images jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- reviews
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  work_log_id uuid NOT NULL REFERENCES public.work_logs(id) ON DELETE CASCADE,
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  job_posting_title text,
  work_date text,
  reviewer_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewer_name text NOT NULL,
  reviewer_type text NOT NULL,
  reviewee_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewee_name text NOT NULL,
  sentiment public.review_sentiment NOT NULL,
  tags text[] DEFAULT '{}'::text[],
  comment text,
  bubble_score_change integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- inquiries
CREATE TABLE IF NOT EXISTS public.inquiries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  user_email text,
  user_name text,
  category text DEFAULT 'general',
  subject text NOT NULL,
  message text NOT NULL,
  status public.inquiry_status DEFAULT 'open',
  attachments jsonb DEFAULT '[]'::jsonb,
  response text,
  responder_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  responder_name text,
  responded_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL,
  reporter_type text NOT NULL,
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reporter_name text NOT NULL,
  target_id uuid NOT NULL,
  target_name text NOT NULL,
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  job_posting_title text,
  work_log_id uuid REFERENCES public.work_logs(id) ON DELETE SET NULL,
  work_date text,
  description text NOT NULL,
  evidence_urls text[],
  status text DEFAULT 'pending',
  severity public.report_severity DEFAULT 'medium',
  reviewer_id text,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- action_logs
CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata jsonb,
  ip_address text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- event_qr_codes (T-C1 fix: includes assignment_group_id + time_slot)
CREATE TABLE IF NOT EXISTS public.event_qr_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  code text NOT NULL,
  work_date text,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  assignment_group_id text,
  time_slot text,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.event_qr_codes ENABLE ROW LEVEL SECURITY;

-- job_posting_templates
CREATE TABLE IF NOT EXISTS public.job_posting_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.job_posting_templates ENABLE ROW LEVEL SECURITY;

-- app_config
CREATE TABLE IF NOT EXISTS public.app_config (
  key text NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (key)
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- notification_settings
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  push_enabled boolean NOT NULL DEFAULT true,
  categories jsonb DEFAULT '{}'::jsonb,
  quiet_hours jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- user_consents
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL,
  version text,
  agreed boolean NOT NULL DEFAULT false,
  agreed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- board_posts (id is text PK)
CREATE TABLE IF NOT EXISTS public.board_posts (
  id text NOT NULL DEFAULT (gen_random_uuid())::text,
  board_type public.board_type NOT NULL DEFAULT 'free',
  source text DEFAULT 'board',
  title text NOT NULL,
  body text NOT NULL,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  visibility text DEFAULT 'public',
  status text DEFAULT 'active',
  linked_job_posting_id uuid REFERENCES public.job_postings(id) ON DELETE SET NULL,
  is_auto_created boolean DEFAULT false,
  is_locked boolean DEFAULT false,
  locked_by text,
  locked_at timestamptz,
  like_count integer DEFAULT 0,
  dislike_count integer DEFAULT 0,
  comment_count integer DEFAULT 0,
  view_count integer DEFAULT 0,
  image_attachments jsonb DEFAULT '[]'::jsonb,
  last_activity_at timestamptz,
  announcement_category public.announcement_category,
  is_pinned boolean DEFAULT false,
  job_summary jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.board_posts ENABLE ROW LEVEL SECURITY;

-- board_comments
CREATE TABLE IF NOT EXISTS public.board_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  parent_comment_id uuid REFERENCES public.board_comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  author_name text NOT NULL,
  author_role text NOT NULL,
  mentioned_user_ids text[] DEFAULT '{}'::text[],
  reaction_counts jsonb DEFAULT '{}'::jsonb,
  is_pinned boolean DEFAULT false,
  pinned_at timestamptz,
  pinned_by text,
  status text DEFAULT 'active',
  image_attachments jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.board_comments ENABLE ROW LEVEL SECURITY;

-- board_memberships
CREATE TABLE IF NOT EXISTS public.board_memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  board_type public.board_type DEFAULT 'schedule',
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  post_id text NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  job_posting_id uuid NOT NULL REFERENCES public.job_postings(id) ON DELETE CASCADE,
  role text DEFAULT 'confirmed',
  display_name text,
  can_read boolean DEFAULT true,
  can_comment boolean DEFAULT true,
  title text,
  work_date text,
  author_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  last_activity_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.board_memberships ENABLE ROW LEVEL SECURITY;

-- board_votes
CREATE TABLE IF NOT EXISTS public.board_votes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.board_votes ENABLE ROW LEVEL SECURITY;

-- board_reports
CREATE TABLE IF NOT EXISTS public.board_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  post_id text NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text DEFAULT 'pending',
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id)
);
ALTER TABLE public.board_reports ENABLE ROW LEVEL SECURITY;

-- board_comment_reactions
CREATE TABLE IF NOT EXISTS public.board_comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  post_id text NOT NULL REFERENCES public.board_posts(id) ON DELETE CASCADE,
  comment_id uuid NOT NULL REFERENCES public.board_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('thumbs_up','heart','laugh','surprised','sad','angry')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE public.board_comment_reactions ENABLE ROW LEVEL SECURITY;

-- rate_limits (token bucket)
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  key text NOT NULL,
  tokens integer DEFAULT 0,
  last_refill timestamptz DEFAULT now(),
  expires_at timestamptz,
  PRIMARY KEY (id)
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. RLS Policies (simplified baseline — service_role has full access)
-- ----------------------------------------------------------------------------

-- Helper: is_admin() — checks app_metadata.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- users
DROP POLICY IF EXISTS "users_select_self_or_admin" ON public.users;
CREATE POLICY "users_select_self_or_admin" ON public.users
  FOR SELECT USING ((SELECT auth.uid()) = id OR public.is_admin() OR (SELECT auth.role()) = 'authenticated');

DROP POLICY IF EXISTS "users_insert_self" ON public.users;
CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "users_update_self_or_admin" ON public.users;
CREATE POLICY "users_update_self_or_admin" ON public.users
  FOR UPDATE USING ((SELECT auth.uid()) = id OR public.is_admin());

DROP POLICY IF EXISTS "users_delete_admin" ON public.users;
CREATE POLICY "users_delete_admin" ON public.users
  FOR DELETE USING (public.is_admin());

-- job_postings
DROP POLICY IF EXISTS "job_postings_select_all" ON public.job_postings;
CREATE POLICY "job_postings_select_all" ON public.job_postings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "job_postings_insert_authenticated" ON public.job_postings;
CREATE POLICY "job_postings_insert_authenticated" ON public.job_postings
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "job_postings_update_owner_or_admin" ON public.job_postings;
CREATE POLICY "job_postings_update_owner_or_admin" ON public.job_postings
  FOR UPDATE USING (owner_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "job_postings_delete_owner_or_admin" ON public.job_postings;
CREATE POLICY "job_postings_delete_owner_or_admin" ON public.job_postings
  FOR DELETE USING (owner_id = (SELECT auth.uid()) OR public.is_admin());

-- applications
DROP POLICY IF EXISTS "applications_select_involved" ON public.applications;
CREATE POLICY "applications_select_involved" ON public.applications
  FOR SELECT USING (
    applicant_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = job_posting_id AND jp.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "applications_insert_applicant" ON public.applications;
CREATE POLICY "applications_insert_applicant" ON public.applications
  FOR INSERT WITH CHECK (applicant_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "applications_update_involved" ON public.applications;
CREATE POLICY "applications_update_involved" ON public.applications
  FOR UPDATE USING (
    applicant_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = job_posting_id AND jp.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "applications_delete_admin" ON public.applications;
CREATE POLICY "applications_delete_admin" ON public.applications
  FOR DELETE USING (public.is_admin());

-- work_logs
DROP POLICY IF EXISTS "work_logs_select_involved" ON public.work_logs;
CREATE POLICY "work_logs_select_involved" ON public.work_logs
  FOR SELECT USING (
    staff_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "work_logs_insert_owner_or_admin" ON public.work_logs;
CREATE POLICY "work_logs_insert_owner_or_admin" ON public.work_logs
  FOR INSERT WITH CHECK (
    owner_id = (SELECT auth.uid()) OR public.is_admin()
  );

DROP POLICY IF EXISTS "work_logs_update_involved" ON public.work_logs;
CREATE POLICY "work_logs_update_involved" ON public.work_logs
  FOR UPDATE USING (
    staff_id = (SELECT auth.uid())
    OR owner_id = (SELECT auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "work_logs_delete_admin" ON public.work_logs;
CREATE POLICY "work_logs_delete_admin" ON public.work_logs
  FOR DELETE USING (public.is_admin());

-- notifications
DROP POLICY IF EXISTS "notifications_select_recipient" ON public.notifications;
CREATE POLICY "notifications_select_recipient" ON public.notifications
  FOR SELECT USING (recipient_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "notifications_insert_service" ON public.notifications;
CREATE POLICY "notifications_insert_service" ON public.notifications
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL OR public.is_admin());

DROP POLICY IF EXISTS "notifications_update_recipient" ON public.notifications;
CREATE POLICY "notifications_update_recipient" ON public.notifications
  FOR UPDATE USING (recipient_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "notifications_delete_recipient" ON public.notifications;
CREATE POLICY "notifications_delete_recipient" ON public.notifications
  FOR DELETE USING (recipient_id = (SELECT auth.uid()) OR public.is_admin());

-- announcements
DROP POLICY IF EXISTS "announcements_select_published_or_admin" ON public.announcements;
CREATE POLICY "announcements_select_published_or_admin" ON public.announcements
  FOR SELECT USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "announcements_write_admin" ON public.announcements;
CREATE POLICY "announcements_write_admin" ON public.announcements
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- reviews
DROP POLICY IF EXISTS "reviews_select_all" ON public.reviews;
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "reviews_insert_reviewer" ON public.reviews;
CREATE POLICY "reviews_insert_reviewer" ON public.reviews
  FOR INSERT WITH CHECK (reviewer_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "reviews_update_admin" ON public.reviews;
CREATE POLICY "reviews_update_admin" ON public.reviews
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "reviews_delete_admin" ON public.reviews;
CREATE POLICY "reviews_delete_admin" ON public.reviews
  FOR DELETE USING (public.is_admin());

-- inquiries
DROP POLICY IF EXISTS "inquiries_select_involved" ON public.inquiries;
CREATE POLICY "inquiries_select_involved" ON public.inquiries
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "inquiries_insert_self" ON public.inquiries;
CREATE POLICY "inquiries_insert_self" ON public.inquiries
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()) OR (SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "inquiries_update_admin" ON public.inquiries;
CREATE POLICY "inquiries_update_admin" ON public.inquiries
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "inquiries_delete_admin" ON public.inquiries;
CREATE POLICY "inquiries_delete_admin" ON public.inquiries
  FOR DELETE USING (public.is_admin());

-- reports
DROP POLICY IF EXISTS "reports_select_admin_or_reporter" ON public.reports;
CREATE POLICY "reports_select_admin_or_reporter" ON public.reports
  FOR SELECT USING (reporter_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "reports_insert_authenticated" ON public.reports;
CREATE POLICY "reports_insert_authenticated" ON public.reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "reports_update_admin" ON public.reports;
CREATE POLICY "reports_update_admin" ON public.reports
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "reports_delete_admin" ON public.reports;
CREATE POLICY "reports_delete_admin" ON public.reports
  FOR DELETE USING (public.is_admin());

-- action_logs
DROP POLICY IF EXISTS "action_logs_select_admin" ON public.action_logs;
CREATE POLICY "action_logs_select_admin" ON public.action_logs
  FOR SELECT USING (public.is_admin() OR user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "action_logs_insert_any" ON public.action_logs;
CREATE POLICY "action_logs_insert_any" ON public.action_logs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "action_logs_delete_admin" ON public.action_logs;
CREATE POLICY "action_logs_delete_admin" ON public.action_logs
  FOR DELETE USING (public.is_admin());

-- event_qr_codes
DROP POLICY IF EXISTS "event_qr_codes_select_involved" ON public.event_qr_codes;
CREATE POLICY "event_qr_codes_select_involved" ON public.event_qr_codes
  FOR SELECT USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = job_posting_id AND jp.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "event_qr_codes_insert_authenticated" ON public.event_qr_codes;
CREATE POLICY "event_qr_codes_insert_authenticated" ON public.event_qr_codes
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "event_qr_codes_update_involved" ON public.event_qr_codes;
CREATE POLICY "event_qr_codes_update_involved" ON public.event_qr_codes
  FOR UPDATE USING (
    user_id = (SELECT auth.uid())
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.job_postings jp WHERE jp.id = job_posting_id AND jp.owner_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "event_qr_codes_delete_admin" ON public.event_qr_codes;
CREATE POLICY "event_qr_codes_delete_admin" ON public.event_qr_codes
  FOR DELETE USING (public.is_admin());

-- job_posting_templates
DROP POLICY IF EXISTS "job_posting_templates_select_owner" ON public.job_posting_templates;
CREATE POLICY "job_posting_templates_select_owner" ON public.job_posting_templates
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "job_posting_templates_insert_owner" ON public.job_posting_templates;
CREATE POLICY "job_posting_templates_insert_owner" ON public.job_posting_templates
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "job_posting_templates_update_owner" ON public.job_posting_templates;
CREATE POLICY "job_posting_templates_update_owner" ON public.job_posting_templates
  FOR UPDATE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "job_posting_templates_delete_owner" ON public.job_posting_templates;
CREATE POLICY "job_posting_templates_delete_owner" ON public.job_posting_templates
  FOR DELETE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- app_config
DROP POLICY IF EXISTS "app_config_select_all" ON public.app_config;
CREATE POLICY "app_config_select_all" ON public.app_config
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "app_config_write_admin" ON public.app_config;
CREATE POLICY "app_config_write_admin" ON public.app_config
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- notification_settings
DROP POLICY IF EXISTS "notification_settings_select_self" ON public.notification_settings;
CREATE POLICY "notification_settings_select_self" ON public.notification_settings
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "notification_settings_insert_self" ON public.notification_settings;
CREATE POLICY "notification_settings_insert_self" ON public.notification_settings
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "notification_settings_update_self" ON public.notification_settings;
CREATE POLICY "notification_settings_update_self" ON public.notification_settings
  FOR UPDATE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "notification_settings_delete_self" ON public.notification_settings;
CREATE POLICY "notification_settings_delete_self" ON public.notification_settings
  FOR DELETE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- user_consents
DROP POLICY IF EXISTS "user_consents_select_self" ON public.user_consents;
CREATE POLICY "user_consents_select_self" ON public.user_consents
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "user_consents_insert_self" ON public.user_consents;
CREATE POLICY "user_consents_insert_self" ON public.user_consents
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "user_consents_update_self" ON public.user_consents;
CREATE POLICY "user_consents_update_self" ON public.user_consents
  FOR UPDATE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "user_consents_delete_admin" ON public.user_consents;
CREATE POLICY "user_consents_delete_admin" ON public.user_consents
  FOR DELETE USING (public.is_admin());

-- board_posts
DROP POLICY IF EXISTS "board_posts_select_public" ON public.board_posts;
CREATE POLICY "board_posts_select_public" ON public.board_posts
  FOR SELECT USING (visibility = 'public' OR author_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "board_posts_insert_authenticated" ON public.board_posts;
CREATE POLICY "board_posts_insert_authenticated" ON public.board_posts
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "board_posts_update_author_or_admin" ON public.board_posts;
CREATE POLICY "board_posts_update_author_or_admin" ON public.board_posts
  FOR UPDATE USING (author_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "board_posts_delete_author_or_admin" ON public.board_posts;
CREATE POLICY "board_posts_delete_author_or_admin" ON public.board_posts
  FOR DELETE USING (author_id = (SELECT auth.uid()) OR public.is_admin());

-- board_comments
DROP POLICY IF EXISTS "board_comments_select_all" ON public.board_comments;
CREATE POLICY "board_comments_select_all" ON public.board_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "board_comments_insert_authenticated" ON public.board_comments;
CREATE POLICY "board_comments_insert_authenticated" ON public.board_comments
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "board_comments_update_author_or_admin" ON public.board_comments;
CREATE POLICY "board_comments_update_author_or_admin" ON public.board_comments
  FOR UPDATE USING (author_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "board_comments_delete_author_or_admin" ON public.board_comments;
CREATE POLICY "board_comments_delete_author_or_admin" ON public.board_comments
  FOR DELETE USING (author_id = (SELECT auth.uid()) OR public.is_admin());

-- board_memberships
DROP POLICY IF EXISTS "board_memberships_select_member_or_admin" ON public.board_memberships;
CREATE POLICY "board_memberships_select_member_or_admin" ON public.board_memberships
  FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "board_memberships_insert_authenticated" ON public.board_memberships;
CREATE POLICY "board_memberships_insert_authenticated" ON public.board_memberships
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "board_memberships_update_self_or_admin" ON public.board_memberships;
CREATE POLICY "board_memberships_update_self_or_admin" ON public.board_memberships
  FOR UPDATE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "board_memberships_delete_self_or_admin" ON public.board_memberships;
CREATE POLICY "board_memberships_delete_self_or_admin" ON public.board_memberships
  FOR DELETE USING (user_id = (SELECT auth.uid()) OR public.is_admin());

-- board_votes
DROP POLICY IF EXISTS "board_votes_select_all" ON public.board_votes;
CREATE POLICY "board_votes_select_all" ON public.board_votes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "board_votes_insert_self" ON public.board_votes;
CREATE POLICY "board_votes_insert_self" ON public.board_votes
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "board_votes_update_self" ON public.board_votes;
CREATE POLICY "board_votes_update_self" ON public.board_votes
  FOR UPDATE USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "board_votes_delete_self" ON public.board_votes;
CREATE POLICY "board_votes_delete_self" ON public.board_votes
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- board_reports
DROP POLICY IF EXISTS "board_reports_select_admin_or_reporter" ON public.board_reports;
CREATE POLICY "board_reports_select_admin_or_reporter" ON public.board_reports
  FOR SELECT USING (reporter_id = (SELECT auth.uid()) OR public.is_admin());

DROP POLICY IF EXISTS "board_reports_insert_authenticated" ON public.board_reports;
CREATE POLICY "board_reports_insert_authenticated" ON public.board_reports
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "board_reports_update_admin" ON public.board_reports;
CREATE POLICY "board_reports_update_admin" ON public.board_reports
  FOR UPDATE USING (public.is_admin());

DROP POLICY IF EXISTS "board_reports_delete_admin" ON public.board_reports;
CREATE POLICY "board_reports_delete_admin" ON public.board_reports
  FOR DELETE USING (public.is_admin());

-- board_comment_reactions
DROP POLICY IF EXISTS "board_comment_reactions_select_all" ON public.board_comment_reactions;
CREATE POLICY "board_comment_reactions_select_all" ON public.board_comment_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "board_comment_reactions_insert_self" ON public.board_comment_reactions;
CREATE POLICY "board_comment_reactions_insert_self" ON public.board_comment_reactions
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "board_comment_reactions_delete_self" ON public.board_comment_reactions;
CREATE POLICY "board_comment_reactions_delete_self" ON public.board_comment_reactions
  FOR DELETE USING (user_id = (SELECT auth.uid()));

-- rate_limits (service role only in practice)
DROP POLICY IF EXISTS "rate_limits_select_admin" ON public.rate_limits;
CREATE POLICY "rate_limits_select_admin" ON public.rate_limits
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "rate_limits_write_admin" ON public.rate_limits;
CREATE POLICY "rate_limits_write_admin" ON public.rate_limits
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. Indexes (commonly queried columns)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_job_postings_owner_id ON public.job_postings(owner_id);
CREATE INDEX IF NOT EXISTS idx_job_postings_status ON public.job_postings(status);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_id ON public.applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_applications_job_posting_id ON public.applications(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);
CREATE INDEX IF NOT EXISTS idx_work_logs_staff_id ON public.work_logs(staff_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_job_posting_id ON public.work_logs(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_owner_id ON public.work_logs(owner_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_application_id ON public.work_logs(application_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON public.work_logs(date);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_reviews_work_log_id ON public.reviews(work_log_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON public.reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_event_qr_codes_user_id ON public.event_qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_event_qr_codes_job_posting_id ON public.event_qr_codes(job_posting_id);
CREATE INDEX IF NOT EXISTS idx_board_comments_post_id ON public.board_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_board_memberships_post_id ON public.board_memberships(post_id);
CREATE INDEX IF NOT EXISTS idx_board_memberships_user_id ON public.board_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires_at ON public.rate_limits(expires_at);

-- ----------------------------------------------------------------------------
-- 5. Realtime Publications
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'users',
    'job_postings',
    'applications',
    'work_logs',
    'notifications',
    'announcements',
    'reviews',
    'inquiries',
    'reports',
    'event_qr_codes',
    'board_posts',
    'board_comments',
    'board_memberships',
    'board_votes',
    'board_comment_reactions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- publication may not exist yet in Docker Supabase; ignore silently
      NULL;
    END;
  END LOOP;
END $$;

-- ============================================================================
-- END 20260409000000_base_schema.sql
-- ============================================================================
