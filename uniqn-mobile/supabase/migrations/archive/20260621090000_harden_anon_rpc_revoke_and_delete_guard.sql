-- 2026-06-21 보안 하드닝 (P0/P1): anon이 호출 가능한 위험 SECDEF RPC EXECUTE 회수 +
--   permanently_delete_user 의 NULL-취약 권한 가드 수정.
--
-- 배경(prod 실측):
--  * anon 역할에 공개 anon 키로 호출 가능한 SECURITY DEFINER RPC 다수가 EXECUTE 부여돼 있음
--    (pitfall_supabase_new_function_anon_default_grant: public 신규 함수는 anon/authenticated
--     EXECUTE 자동부여 → 하드닝 REVOKE 누락 시 잠복).
--  * permanently_delete_user 의 가드 `IF auth.uid() != p_user_id AND NOT is_admin()` 는
--    anon(auth.uid()=NULL)에서 `NULL != x`=NULL, `NULL AND true`=NULL → IF NULL=거짓 → 가드 스킵.
--    → 미인증 임의 사용자 삭제 가능(probe 실증: anon 호출 시 PERMISSION_DENIED 가 아닌 USER_NOT_FOUND).
--
-- REVOKE 안전성:
--  * 대상 32개 함수는 RLS 정책 표현식에서 호출되지 않음(poison 무관, pg_policy 전수 확인).
--  * 미인증(가입/공개 공유 페이지) 경로에서 실제 호출되는 함수는 제외(allowlist 유지):
--    check_email/phone/nickname_exists, increment_view_count,
--    increment_board_post_view_count, increment_announcement_view_count, get_posting_filled_counts.
--  * authenticated/service_role 권한은 유지(GRANT 재부여)하여 정상 클라이언트 회귀 없음.
-- 멱등: 함수 미존재 시 REVOKE/GRANT 가 에러를 던지지 않도록 DO 블록으로 감싼다.

-- 이름 기반 REVOKE: pg_proc 에서 oid 를 찾아 모든 오버로드를 정확한 시그니처로 처리
-- (하드코딩 시그니처 불일치로 인한 조용한 스킵=보안구멍 잔존 방지).
DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'permanently_delete_user','update_user_role','confirm_application',
    'cancel_application_atomically','process_qr_checkin_atomically','apply_with_capacity_check',
    'create_report','create_workspace','register_as_employer','toggle_comment_reaction',
    'increment_template_usage','sync_schedule_board','approve_employer_application',
    'reject_employer_application','review_report','list_all_applications','list_all_event_qr_codes',
    'list_all_managed_postings','list_all_work_logs','list_all_workspace_members',
    'get_job_posting_stats','get_latest_employer_application','get_unread_notification_count',
    'decrement_unread_counter','reset_unread_counter','check_user_rate_limit',
    'fn_cleanup_expired_fcm_tokens','fn_cleanup_rate_limits','fn_expire_by_last_work_date',
    'fn_expire_fixed_postings_batch','fn_send_review_reminders','rls_auto_enable'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
    RAISE NOTICE 'hardened: %', rec.sig;
  END LOOP;
END $$;

-- permanently_delete_user: NULL-안전 가드로 교체 (본문은 prod 실측과 동일, 가드 라인만 수정).
CREATE OR REPLACE FUNCTION public.permanently_delete_user(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_user record;
  v_deleted_apps int;
  v_deleted_wlogs int;
  v_deleted_notifs int;
BEGIN
  -- NULL-안전 권한 가드: 미인증(auth.uid() IS NULL) 호출 차단 + 본인/관리자만 허용.
  IF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능';
  END IF;

  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: %', p_user_id;
  END IF;

  -- 1. 지원서 익명화
  UPDATE public.applications SET
    applicant_name = '[deleted]', applicant_nickname = NULL,
    applicant_phone = NULL, applicant_email = NULL,
    applicant_photo_url = NULL, updated_at = now()
  WHERE applicant_id = p_user_id;
  GET DIAGNOSTICS v_deleted_apps = ROW_COUNT;

  -- 2. 근무기록 익명화 (staff)
  UPDATE public.work_logs SET
    staff_name = '[deleted]', staff_nickname = NULL,
    staff_photo_url = NULL, updated_at = now()
  WHERE staff_id = p_user_id;
  GET DIAGNOSTICS v_deleted_wlogs = ROW_COUNT;

  -- 3. 근무기록 owner_id NULL (employer 탈퇴)
  UPDATE public.work_logs SET owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id;

  -- 4. 공고 active → closed + owner_id NULL
  UPDATE public.job_postings SET
    status = 'closed', closed_at = now(), closed_reason = 'owner_deleted',
    owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id AND status = 'active';

  -- 4b. 나머지 공고 owner_id NULL
  UPDATE public.job_postings SET owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id;

  -- 5. 공지사항 익명화
  UPDATE public.announcements SET author_id = NULL WHERE author_id = p_user_id;

  -- 6. 게시판 게시물 익명화
  UPDATE public.board_posts SET author_id = NULL WHERE author_id = p_user_id;

  -- 7. 게시판 댓글 익명화
  UPDATE public.board_comments SET author_id = NULL WHERE author_id = p_user_id;

  -- 8. 게시판 투표 삭제
  DELETE FROM public.board_votes WHERE user_id = p_user_id;

  -- 9. 게시판 신고 익명화
  UPDATE public.board_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;

  -- 10. 이벤트 QR 코드 삭제
  DELETE FROM public.event_qr_codes WHERE user_id = p_user_id;

  -- 11. 문의사항 익명화
  UPDATE public.inquiries SET user_id = NULL WHERE user_id = p_user_id;

  -- 12. 신고 익명화
  UPDATE public.reports SET reporter_id = NULL WHERE reporter_id = p_user_id;

  -- 13. 리뷰 익명화 (FK + 이름 모두)
  UPDATE public.reviews SET reviewer_id = NULL, reviewer_name = '[deleted]'
  WHERE reviewer_id = p_user_id;
  UPDATE public.reviews SET reviewee_id = NULL, reviewee_name = '[deleted]'
  WHERE reviewee_id = p_user_id;

  -- 14. 알림 삭제
  DELETE FROM public.notifications WHERE recipient_id = p_user_id;
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;

  -- 15. 알림 설정 삭제
  DELETE FROM public.notification_settings WHERE user_id = p_user_id;

  -- 16. public.users 삭제
  DELETE FROM public.users WHERE id = p_user_id;

  -- 17. auth.users 삭제
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'anonymizedApplications', v_deleted_apps,
    'anonymizedWorkLogs', v_deleted_wlogs,
    'deletedNotifications', v_deleted_notifs
  );
END;
$function$;

-- permanently_delete_user 는 위 REVOKE 루프로 anon EXECUTE 회수됨(authenticated 유지).
