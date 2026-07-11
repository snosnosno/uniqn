-- Migration: fix_permanently_delete_user_final
-- Date: 2026-04-12
-- Issue: ISSUE-006 추가 수정 — 회원탈퇴 시 FK 처리 완성
-- 변경 사항:
--   1. job_postings.closed_reason CHECK 제약에 'owner_deleted' 추가 (ISSUE-007)
--   2. job_postings.owner_id nullable 변경
--   3. work_logs.owner_id nullable 변경
--   4. reviews.reviewer_id, reviewee_id nullable 변경
--   5. permanently_delete_user: auth.users 삭제 포함 최종 완성 (17단계)

-- 1. job_postings.closed_reason CHECK 제약 갱신
ALTER TABLE public.job_postings
  DROP CONSTRAINT IF EXISTS job_postings_closed_reason_check;

ALTER TABLE public.job_postings
  ADD CONSTRAINT job_postings_closed_reason_check
  CHECK (closed_reason = ANY (ARRAY[
    'manual'::text,
    'expired'::text,
    'expired_by_work_date'::text,
    'owner_deleted'::text
  ]));

-- 2. FK 컬럼 nullable 변경
ALTER TABLE public.job_postings ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.work_logs ALTER COLUMN owner_id DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN reviewer_id DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN reviewee_id DROP NOT NULL;

-- 3. permanently_delete_user 최종 완성 (auth.users 포함)
CREATE OR REPLACE FUNCTION public.permanently_delete_user(p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public', 'auth'
AS $$
DECLARE
  v_user record;
  v_deleted_apps int;
  v_deleted_wlogs int;
  v_deleted_notifs int;
BEGIN
  IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: %', p_user_id;
  END IF;

  UPDATE public.applications SET
    applicant_name = '[deleted]', applicant_nickname = NULL,
    applicant_phone = NULL, applicant_email = NULL,
    applicant_photo_url = NULL, updated_at = now()
  WHERE applicant_id = p_user_id;
  GET DIAGNOSTICS v_deleted_apps = ROW_COUNT;

  UPDATE public.work_logs SET
    staff_name = '[deleted]', staff_nickname = NULL,
    staff_photo_url = NULL, updated_at = now()
  WHERE staff_id = p_user_id;
  GET DIAGNOSTICS v_deleted_wlogs = ROW_COUNT;

  UPDATE public.work_logs SET owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id;

  UPDATE public.job_postings SET
    status = 'closed', closed_at = now(), closed_reason = 'owner_deleted',
    owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id AND status = 'active';

  UPDATE public.job_postings SET owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id;

  UPDATE public.announcements SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE public.board_posts SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE public.board_comments SET author_id = NULL WHERE author_id = p_user_id;
  DELETE FROM public.board_votes WHERE user_id = p_user_id;
  UPDATE public.board_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  DELETE FROM public.event_qr_codes WHERE user_id = p_user_id;
  UPDATE public.inquiries SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.reports SET reporter_id = NULL WHERE reporter_id = p_user_id;

  UPDATE public.reviews SET reviewer_id = NULL, reviewer_name = '[deleted]'
  WHERE reviewer_id = p_user_id;
  UPDATE public.reviews SET reviewee_id = NULL, reviewee_name = '[deleted]'
  WHERE reviewee_id = p_user_id;

  DELETE FROM public.notifications WHERE recipient_id = p_user_id;
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  DELETE FROM public.notification_settings WHERE user_id = p_user_id;
  DELETE FROM public.users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'anonymizedApplications', v_deleted_apps,
    'anonymizedWorkLogs', v_deleted_wlogs,
    'deletedNotifications', v_deleted_notifs
  );
END;
$$;
