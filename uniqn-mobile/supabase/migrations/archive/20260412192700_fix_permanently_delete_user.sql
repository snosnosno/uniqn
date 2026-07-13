-- Migration: fix_permanently_delete_user_complete
-- Date: 2026-04-12
-- Issue: ISSUE-006 — permanently_delete_user RPC가 NO ACTION FK 테이블 11개 미처리
--        → 회원탈퇴 시 FK 제약 위반 에러
-- Fix: 16단계 처리 로직으로 모든 FK 처리 완비
-- 참고: auth.users 삭제는 앱 레이어에서 Admin API (supabase.auth.admin.deleteUser()) 별도 호출 필요

CREATE OR REPLACE FUNCTION public.permanently_delete_user(p_user_id uuid)
  RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_user record;
  v_deleted_apps int;
  v_deleted_wlogs int;
  v_deleted_notifs int;
BEGIN
  -- 본인 확인 (admin도 가능)
  IF auth.uid() != p_user_id AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능';
  END IF;

  -- 사용자 존재 확인
  SELECT * INTO v_user FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: %', p_user_id;
  END IF;

  -- 1. 지원서 익명화
  UPDATE applications SET
    applicant_name = '[deleted]', applicant_nickname = NULL,
    applicant_phone = NULL, applicant_email = NULL,
    applicant_photo_url = NULL, updated_at = now()
  WHERE applicant_id = p_user_id;
  GET DIAGNOSTICS v_deleted_apps = ROW_COUNT;

  -- 2. 근무기록 익명화 (staff)
  UPDATE work_logs SET
    staff_name = '[deleted]', staff_nickname = NULL,
    staff_photo_url = NULL, updated_at = now()
  WHERE staff_id = p_user_id;
  GET DIAGNOSTICS v_deleted_wlogs = ROW_COUNT;

  -- 3. 근무기록 owner 참조 갱신 (employer 탈퇴)
  UPDATE work_logs SET updated_at = now() WHERE owner_id = p_user_id;

  -- 4. 공고 처리 (active 공고 closed)
  UPDATE job_postings SET
    status = 'closed', closed_at = now(),
    closed_reason = 'owner_deleted', updated_at = now()
  WHERE owner_id = p_user_id AND status = 'active';

  -- 5. 공지사항 익명화 (콘텐츠 보존)
  UPDATE announcements SET author_id = NULL WHERE author_id = p_user_id;

  -- 6. 게시판 게시물 익명화 (콘텐츠 보존)
  UPDATE board_posts SET author_id = NULL WHERE author_id = p_user_id;

  -- 7. 게시판 댓글 익명화 (콘텐츠 보존)
  UPDATE board_comments SET author_id = NULL WHERE author_id = p_user_id;

  -- 8. 게시판 투표 삭제
  DELETE FROM board_votes WHERE user_id = p_user_id;

  -- 9. 게시판 신고 익명화
  UPDATE board_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;

  -- 10. 이벤트 QR 코드 삭제
  DELETE FROM event_qr_codes WHERE user_id = p_user_id;

  -- 11. 문의사항 익명화 (내용 보존)
  UPDATE inquiries SET user_id = NULL WHERE user_id = p_user_id;

  -- 12. 신고 익명화
  UPDATE reports SET reporter_id = NULL WHERE reporter_id = p_user_id;

  -- 13. 리뷰 익명화 (내용 보존)
  UPDATE reviews SET reviewer_name = '[deleted]' WHERE reviewer_id = p_user_id;
  UPDATE reviews SET reviewee_name = '[deleted]' WHERE reviewee_id = p_user_id;

  -- 14. 알림 삭제
  DELETE FROM notifications WHERE recipient_id = p_user_id;
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  -- 15. 알림 설정 삭제
  DELETE FROM notification_settings WHERE user_id = p_user_id;

  -- 16. 사용자 레코드 삭제 (CASCADE로 notification_counters 등 자동 삭제)
  DELETE FROM users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'anonymizedApplications', v_deleted_apps,
    'anonymizedWorkLogs', v_deleted_wlogs,
    'deletedNotifications', v_deleted_notifs
  );
END;
$$;
