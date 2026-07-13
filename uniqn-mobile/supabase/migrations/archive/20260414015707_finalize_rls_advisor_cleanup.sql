-- Finalize Step D: address remaining auth_rls_initplan + multiple_permissive WARNs
-- discovered after the main RLS rewrite.
--
-- A) announcements: rewrite 4 policies using is_admin() wrapper to avoid per-row auth.jwt() evaluation.
-- B) notification_counters: drop redundant "Service role full access" policy (service_role BYPASSRLS).
-- C) job_posting_templates: drop redundant tmpl_all, keep explicit templates_*_own.

-- ==========================================
-- A) announcements
-- ==========================================

DROP POLICY IF EXISTS announcements_delete_admin ON public.announcements;
CREATE POLICY announcements_delete_admin ON public.announcements FOR DELETE TO authenticated
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS announcements_insert_admin ON public.announcements;
CREATE POLICY announcements_insert_admin ON public.announcements FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS announcements_select_published ON public.announcements;
CREATE POLICY announcements_select_published ON public.announcements FOR SELECT TO authenticated
  USING ((status = 'published'::announcement_status) OR (SELECT is_admin()));

DROP POLICY IF EXISTS announcements_update_admin ON public.announcements;
CREATE POLICY announcements_update_admin ON public.announcements FOR UPDATE TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));

-- ==========================================
-- B) notification_counters: drop dead Service role policy
-- service_role has BYPASSRLS; this policy is a no-op that only causes
-- advisor warnings by overlapping with user-facing policies on {public} role.
-- ==========================================

DROP POLICY IF EXISTS "Service role full access" ON public.notification_counters;

-- ==========================================
-- C) job_posting_templates: drop redundant tmpl_all
-- Keeps the explicit, authenticated-scoped templates_*_own policies.
-- ==========================================

DROP POLICY IF EXISTS tmpl_all ON public.job_posting_templates;
