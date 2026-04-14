-- Finding #1: Fix 18 functions with mutable search_path
-- Uses ALTER FUNCTION ... SET to avoid touching function bodies.
-- Order: public, pg_temp (pg_temp last per Supabase linter guidance).

ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_employer_or_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.prevent_role_self_escalation() SET search_path = public, pg_temp;
ALTER FUNCTION public.apply_with_capacity_check(
  p_applicant_id uuid,
  p_job_posting_id uuid,
  p_applicant_name text,
  p_applicant_phone text,
  p_applicant_email text,
  p_applicant_nickname text,
  p_applicant_photo_url text,
  p_applicant_role text,
  p_custom_role text,
  p_job_posting_title text,
  p_job_posting_date text,
  p_recruitment_type text,
  p_message text,
  p_assignments jsonb,
  p_pre_question_answers jsonb
) SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_sync_application_completion() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_fixed_posting_expired() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_application_submitted() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_application_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_cancellation_request() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_check_in_out() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_comment_created() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_no_show() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_payroll_completed() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_post_locked() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_review_created() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_schedule_cancelled() SET search_path = public, pg_temp;
ALTER FUNCTION public.fn_notify_schedule_created() SET search_path = public, pg_temp;
ALTER FUNCTION public.decrement_unread_counter(p_user_id uuid, p_delta integer) SET search_path = public, pg_temp;
