-- Finding #2 + #3: Wrap auth.uid()/get_my_role()/is_admin() in SELECT to avoid per-row evaluation.
-- Merges duplicate permissive policies (notification_settings SELECT, app_config UPDATE).
-- All DROP/CREATE pairs run in a single transaction.

-- action_logs
DROP POLICY IF EXISTS al_select ON public.action_logs;
CREATE POLICY al_select ON public.action_logs FOR SELECT TO public
  USING ((SELECT get_my_role()) = 'admin');

-- app_config (merge UPDATE duplicates into single authenticated policy)
DROP POLICY IF EXISTS config_admin_delete ON public.app_config;
CREATE POLICY config_admin_delete ON public.app_config FOR DELETE TO authenticated
  USING ((SELECT is_admin()));

DROP POLICY IF EXISTS config_admin_insert ON public.app_config;
CREATE POLICY config_admin_insert ON public.app_config FOR INSERT TO authenticated
  WITH CHECK ((SELECT is_admin()));

DROP POLICY IF EXISTS config_admin ON public.app_config;
DROP POLICY IF EXISTS config_admin_update ON public.app_config;
CREATE POLICY config_admin_update ON public.app_config FOR UPDATE TO authenticated
  USING ((SELECT is_admin()));

-- applications
DROP POLICY IF EXISTS applications_delete_own ON public.applications;
CREATE POLICY applications_delete_own ON public.applications FOR DELETE TO authenticated
  USING ((applicant_id = (SELECT auth.uid())) AND (status = ANY (ARRAY['applied'::application_status, 'cancelled'::application_status])));

DROP POLICY IF EXISTS app_insert ON public.applications;
CREATE POLICY app_insert ON public.applications FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = applicant_id);

DROP POLICY IF EXISTS app_select ON public.applications;
CREATE POLICY app_select ON public.applications FOR SELECT TO public
  USING ((applicant_id = (SELECT auth.uid()))
    OR (job_posting_id IN (SELECT job_postings.id FROM job_postings WHERE job_postings.owner_id = (SELECT auth.uid())))
    OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS app_update ON public.applications;
CREATE POLICY app_update ON public.applications FOR UPDATE TO public
  USING ((applicant_id = (SELECT auth.uid()))
    OR (job_posting_id IN (SELECT job_postings.id FROM job_postings WHERE job_postings.owner_id = (SELECT auth.uid())))
    OR ((SELECT get_my_role()) = 'admin'));

-- board_comment_reactions
DROP POLICY IF EXISTS reaction_delete ON public.board_comment_reactions;
CREATE POLICY reaction_delete ON public.board_comment_reactions FOR DELETE TO public
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS reaction_insert ON public.board_comment_reactions;
CREATE POLICY reaction_insert ON public.board_comment_reactions FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS reaction_select ON public.board_comment_reactions;
CREATE POLICY reaction_select ON public.board_comment_reactions FOR SELECT TO public
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS reaction_update ON public.board_comment_reactions;
CREATE POLICY reaction_update ON public.board_comment_reactions FOR UPDATE TO public
  USING (user_id = (SELECT auth.uid()));

-- board_comments
DROP POLICY IF EXISTS bc_delete ON public.board_comments;
CREATE POLICY bc_delete ON public.board_comments FOR DELETE TO public
  USING ((author_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS bc_insert ON public.board_comments;
CREATE POLICY bc_insert ON public.board_comments FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS bc_update ON public.board_comments;
CREATE POLICY bc_update ON public.board_comments FOR UPDATE TO public
  USING ((author_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

-- board_memberships
DROP POLICY IF EXISTS board_memberships_delete ON public.board_memberships;
CREATE POLICY board_memberships_delete ON public.board_memberships FOR DELETE TO public
  USING ((user_id = (SELECT auth.uid())) OR (SELECT is_admin()));

DROP POLICY IF EXISTS bm_insert ON public.board_memberships;
CREATE POLICY bm_insert ON public.board_memberships FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS bm_select ON public.board_memberships;
CREATE POLICY bm_select ON public.board_memberships FOR SELECT TO public
  USING ((user_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

-- board_posts
DROP POLICY IF EXISTS bp_delete ON public.board_posts;
CREATE POLICY bp_delete ON public.board_posts FOR DELETE TO public
  USING ((author_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS bp_insert ON public.board_posts;
CREATE POLICY bp_insert ON public.board_posts FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS bp_select ON public.board_posts;
CREATE POLICY bp_select ON public.board_posts FOR SELECT TO public
  USING ((visibility = 'public'::text)
    OR (author_id = (SELECT auth.uid()))
    OR ((SELECT get_my_role()) = 'admin')
    OR (EXISTS (SELECT 1 FROM board_memberships WHERE (board_memberships.user_id = (SELECT auth.uid())) AND (board_memberships.post_id = board_posts.id))));

DROP POLICY IF EXISTS bp_update ON public.board_posts;
CREATE POLICY bp_update ON public.board_posts FOR UPDATE TO public
  USING ((author_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

-- board_reports
DROP POLICY IF EXISTS brep_insert ON public.board_reports;
CREATE POLICY brep_insert ON public.board_reports FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS brep_select ON public.board_reports;
CREATE POLICY brep_select ON public.board_reports FOR SELECT TO public
  USING ((reporter_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

-- board_votes
DROP POLICY IF EXISTS bv_delete ON public.board_votes;
CREATE POLICY bv_delete ON public.board_votes FOR DELETE TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS bv_insert ON public.board_votes;
CREATE POLICY bv_insert ON public.board_votes FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS bv_select ON public.board_votes;
CREATE POLICY bv_select ON public.board_votes FOR SELECT TO public
  USING ((SELECT auth.uid()) IS NOT NULL);

-- event_qr_codes
DROP POLICY IF EXISTS qr_delete ON public.event_qr_codes;
CREATE POLICY qr_delete ON public.event_qr_codes FOR DELETE TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS qr_insert ON public.event_qr_codes;
CREATE POLICY qr_insert ON public.event_qr_codes FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS qr_select ON public.event_qr_codes;
CREATE POLICY qr_select ON public.event_qr_codes FOR SELECT TO public
  USING ((user_id = (SELECT auth.uid()))
    OR (job_posting_id IN (SELECT job_postings.id FROM job_postings WHERE job_postings.owner_id = (SELECT auth.uid())))
    OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS qr_update ON public.event_qr_codes;
CREATE POLICY qr_update ON public.event_qr_codes FOR UPDATE TO public
  USING ((SELECT auth.uid()) = user_id);

-- inquiries
DROP POLICY IF EXISTS inquiries_delete_own ON public.inquiries;
CREATE POLICY inquiries_delete_own ON public.inquiries FOR DELETE TO authenticated
  USING ((user_id = (SELECT auth.uid())) AND (status = 'open'::inquiry_status));

DROP POLICY IF EXISTS inq_insert ON public.inquiries;
CREATE POLICY inq_insert ON public.inquiries FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS inq_select ON public.inquiries;
CREATE POLICY inq_select ON public.inquiries FOR SELECT TO public
  USING ((user_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS inq_update ON public.inquiries;
CREATE POLICY inq_update ON public.inquiries FOR UPDATE TO public
  USING ((SELECT get_my_role()) = 'admin');

-- job_posting_templates
DROP POLICY IF EXISTS tmpl_all ON public.job_posting_templates;
CREATE POLICY tmpl_all ON public.job_posting_templates FOR ALL TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS templates_delete_own ON public.job_posting_templates;
CREATE POLICY templates_delete_own ON public.job_posting_templates FOR DELETE TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS templates_insert_own ON public.job_posting_templates;
CREATE POLICY templates_insert_own ON public.job_posting_templates FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS templates_select_own ON public.job_posting_templates;
CREATE POLICY templates_select_own ON public.job_posting_templates FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS templates_update_own ON public.job_posting_templates;
CREATE POLICY templates_update_own ON public.job_posting_templates FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- job_postings
DROP POLICY IF EXISTS jp_delete ON public.job_postings;
CREATE POLICY jp_delete ON public.job_postings FOR DELETE TO public
  USING ((SELECT get_my_role()) = 'admin');

DROP POLICY IF EXISTS jp_insert ON public.job_postings;
CREATE POLICY jp_insert ON public.job_postings FOR INSERT TO public
  WITH CHECK ((SELECT get_my_role()) = ANY (ARRAY['admin'::text, 'employer'::text]));

DROP POLICY IF EXISTS jp_select ON public.job_postings;
CREATE POLICY jp_select ON public.job_postings FOR SELECT TO public
  USING ((status = ANY (ARRAY['approved'::posting_status, 'active'::posting_status, 'closed'::posting_status]))
    OR (owner_id = (SELECT auth.uid()))
    OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS jp_update ON public.job_postings;
CREATE POLICY jp_update ON public.job_postings FOR UPDATE TO public
  USING ((owner_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

-- notification_counters
DROP POLICY IF EXISTS "Users can view own unread counter" ON public.notification_counters;
CREATE POLICY "Users can view own unread counter" ON public.notification_counters FOR SELECT TO public
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own unread counter" ON public.notification_counters;
CREATE POLICY "Users can update own unread counter" ON public.notification_counters FOR UPDATE TO public
  USING ((SELECT auth.uid()) = user_id);

-- notification_settings (merge SELECT duplicates into single policy)
DROP POLICY IF EXISTS "Users can insert own notification settings" ON public.notification_settings;
CREATE POLICY "Users can insert own notification settings" ON public.notification_settings FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins can view all notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can view own notification settings" ON public.notification_settings;
CREATE POLICY "Users can view own notification settings" ON public.notification_settings FOR SELECT TO public
  USING (((SELECT auth.uid()) = user_id) OR (SELECT is_admin()));

DROP POLICY IF EXISTS "Users can update own notification settings" ON public.notification_settings;
CREATE POLICY "Users can update own notification settings" ON public.notification_settings FOR UPDATE TO public
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- notifications
DROP POLICY IF EXISTS notif_delete ON public.notifications;
CREATE POLICY notif_delete ON public.notifications FOR DELETE TO public
  USING ((recipient_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS notif_select ON public.notifications;
CREATE POLICY notif_select ON public.notifications FOR SELECT TO public
  USING (recipient_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS notif_update ON public.notifications;
CREATE POLICY notif_update ON public.notifications FOR UPDATE TO public
  USING (recipient_id = (SELECT auth.uid()));

-- reports
DROP POLICY IF EXISTS rep_insert ON public.reports;
CREATE POLICY rep_insert ON public.reports FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = reporter_id);

DROP POLICY IF EXISTS rep_select ON public.reports;
CREATE POLICY rep_select ON public.reports FOR SELECT TO public
  USING ((reporter_id = (SELECT auth.uid())) OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS rep_update ON public.reports;
CREATE POLICY rep_update ON public.reports FOR UPDATE TO public
  USING ((SELECT get_my_role()) = 'admin');

-- reviews
DROP POLICY IF EXISTS rev_insert ON public.reviews;
CREATE POLICY rev_insert ON public.reviews FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = reviewer_id);

DROP POLICY IF EXISTS rev_select ON public.reviews;
CREATE POLICY rev_select ON public.reviews FOR SELECT TO public
  USING ((reviewer_id = (SELECT auth.uid()))
    OR (reviewee_id = (SELECT auth.uid()))
    OR ((SELECT get_my_role()) = 'admin'));

-- user_consents
DROP POLICY IF EXISTS consents_insert ON public.user_consents;
CREATE POLICY consents_insert ON public.user_consents FOR INSERT TO public
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS consents_select ON public.user_consents;
CREATE POLICY consents_select ON public.user_consents FOR SELECT TO public
  USING ((SELECT auth.uid()) = user_id);

-- users
DROP POLICY IF EXISTS users_select ON public.users;
CREATE POLICY users_select ON public.users FOR SELECT TO public
  USING (((SELECT auth.uid()) = id) OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS users_update ON public.users;
CREATE POLICY users_update ON public.users FOR UPDATE TO public
  USING (((SELECT auth.uid()) = id) OR ((SELECT get_my_role()) = 'admin'));

-- work_logs
DROP POLICY IF EXISTS wl_select ON public.work_logs;
CREATE POLICY wl_select ON public.work_logs FOR SELECT TO public
  USING ((staff_id = (SELECT auth.uid()))
    OR (owner_id = (SELECT auth.uid()))
    OR ((SELECT get_my_role()) = 'admin'));

DROP POLICY IF EXISTS wl_update ON public.work_logs;
CREATE POLICY wl_update ON public.work_logs FOR UPDATE TO public
  USING ((staff_id = (SELECT auth.uid()))
    OR (owner_id = (SELECT auth.uid()))
    OR ((SELECT get_my_role()) = 'admin'));
