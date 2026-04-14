-- Add covering indexes for 14 unindexed foreign keys.
-- Addresses advisor lint 0001_unindexed_foreign_keys.
-- Improves CASCADE delete/update and JOIN performance.
--
-- Note: regular CREATE INDEX (not CONCURRENTLY) because apply_migration
-- wraps in transaction. Current data volumes are small (new DB), so
-- table-level ShareLock duration is negligible.

CREATE INDEX IF NOT EXISTS idx_ann_author
  ON public.announcements (author_id);

CREATE INDEX IF NOT EXISTS idx_bcr_post
  ON public.board_comment_reactions (post_id);

CREATE INDEX IF NOT EXISTS idx_bcr_user
  ON public.board_comment_reactions (user_id);

CREATE INDEX IF NOT EXISTS idx_bc_author
  ON public.board_comments (author_id);

CREATE INDEX IF NOT EXISTS idx_bc_parent
  ON public.board_comments (parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_bm_post
  ON public.board_memberships (post_id);

CREATE INDEX IF NOT EXISTS idx_brep_reporter
  ON public.board_reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_bv_user
  ON public.board_votes (user_id);

CREATE INDEX IF NOT EXISTS idx_qr_user
  ON public.event_qr_codes (user_id);

CREATE INDEX IF NOT EXISTS idx_rep_job_posting
  ON public.reports (job_posting_id);

CREATE INDEX IF NOT EXISTS idx_rep_work_log
  ON public.reports (work_log_id);

CREATE INDEX IF NOT EXISTS idx_rev_job_posting
  ON public.reviews (job_posting_id);

CREATE INDEX IF NOT EXISTS idx_wl_application
  ON public.work_logs (application_id);

CREATE INDEX IF NOT EXISTS idx_wl_owner
  ON public.work_logs (owner_id);
