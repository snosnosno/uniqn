-- =============================================================================
-- 회원탈퇴 파이프라인 ② — 영구삭제 크론이 구조적으로 100% 실패하던 가드 수선
-- =============================================================================
-- 배경 (2026-08-07 prod 실측, 전체 감사 A1)
--   크론 `process-scheduled-deletions`(cron.job id=15, '13 17 * * *' = 02:13 KST, active)
--   → Edge Function 이 **service_role** 클라이언트로 `permanently_delete_user` 호출
--   → 함수 첫 줄 `IF auth.uid() IS NULL THEN RAISE 'PERMISSION_DENIED'` 에서 전량 차단.
--   service_role JWT 에는 `sub` 클레임이 없어 auth.uid() 가 NULL 이기 때문이다.
--
--   실제 경로로 재현 확인(prod, 데이터 무접촉):
--     vault 'service_role_key'(sb_secret_) 로 PostgREST
--     POST /rest/v1/rpc/permanently_delete_user {"p_user_id":"<비실존 UUID>"}
--     → HTTP 400 {"code":"P0001","message":"PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능"}
--     (가드가 통과했다면 USER_NOT_FOUND 가 떴어야 한다)
--   EF 는 행마다 예외를 삼켜 failed++ 후 console.error 만 남기므로
--   "매일 정상 실행되면서 처리량 영구 0" — last_work_date 죽은 크론과 동형이다.
--
-- 하는 일
--   가드 최상단에 **service_role 신뢰 채널** 분기를 추가한다.
--   판별 idiom 은 이 프로젝트 prod 에 이미 살아 있는 선례와 동일하다:
--     · check_application_tournament_approval — "레거시 GUC + 모던 JWT 양쪽 인식"
--     · protect_work_log_payroll_columns      — 동일
--   레거시 GUC(`request.jwt.claim.role`)와 모던 claims(`auth.jwt() ->> 'role'`)를 둘 다 본다.
--   prod 는 sb_secret_ 계열 키를 쓰는데 게이트웨이가 role 을 어느 형태로 싣는지에
--   의존하지 않기 위함이다.
--
--   ⚠️ `current_setting('request.jwt.claims', true)::jsonb` 를 **직접 캐스팅하지 않는다** —
--      pgTAP(anon_rpc_security_hardening.test.sql:37)이 이 GUC 에 빈 문자열('')을 세팅하고,
--      ''::jsonb 는 "invalid input syntax for type json" 으로 터진다.
--      `auth.jwt()` / `auth.role()` 은 nullif 로 이미 막혀 있어 안전하다.
--
-- 피해 상한 (설계 판정 시 ③안에서 접목)
--   신뢰 채널이라도 **아무나 지울 수 있게 열지 않는다**. 이 함수는 `DELETE FROM auth.users`
--   까지 하므로, service_role 경로는 "탈퇴 예약이 이미 만료된 deactivated 계정"으로 제한한다.
--     · EF 조회 조건이 망가지거나 서비스 키가 오용돼도 활성 계정은 삭제 불가
--     · 자격 재확인을 행 잠금(FOR UPDATE) **뒤**에 두어 탈퇴 철회(cancelDeletion)와의
--       경합이 DB 레벨에서 직렬화된다 — 철회가 먼저 커밋되면 NOT_ELIGIBLE 로 안전하게 거부
--   본인/관리자 경로에는 이 제한을 걸지 않는다(기존 UX·테스트 계약 불변).
--
-- ⚠️ 불변 계약 — supabase/tests/anon_rpc_security_hardening.test.sql 이 문자열로 핀한다:
--    시그니처 · SECURITY DEFINER · 소유자(postgres) · search_path ·
--    'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능' · 'USER_NOT_FOUND: %' 문구 ·
--    익명화 본문 전체. 아래는 baseline(20260710000002:8221)의 본문을 한 문장도 빠뜨리지 않고
--    그대로 옮기고, 가드 블록만 확장했다.
--
-- ⚠️ CREATE OR REPLACE 를 쓴다 — DROP+CREATE 금지.
--    prod `pg_default_acl` 에 anon=X 가 있어 DROP+CREATE 하면 anon EXECUTE 가 부활하고
--    같은 테스트의 L14 단언(anon 은 EXECUTE 불가)이 깨진다. (선례: #424 에서 실제로 겪음)
--
-- ⚠️ OR REPLACE 는 proconfig 를 새 문장으로 통째 교체한다 → search_path 재선언 필수.
--    (20260711100000:77 이 ALTER 로 붙여둔 pg_temp 를 잃지 않기 위함)
--
-- ⚠️ 파리티 불변: 함수 200 · 정책 111 (재정의라 pg_proc 행 수 무변화).
--
-- 선행: 20260807140000 — users.status 에 'deactivated' 가 허용돼야 삭제 대상 행이 생긴다.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.permanently_delete_user(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'auth', 'pg_temp'
    AS $function$
DECLARE
  v_user record;
  v_deleted_apps int;
  v_deleted_wlogs int;
  v_deleted_notifs int;
  -- service_role 신뢰 채널 여부 (크론 EF process-scheduled-deletions 경로)
  v_is_service boolean;
BEGIN
  -- [1] 신뢰 채널 판별 — 레거시 GUC + 모던 JWT claims 양쪽 인식.
  --     coalesce 로 boolean 을 확정한다(GUC 미설정 시 NULL 이 OR 를 오염시키지 않도록).
  v_is_service := coalesce(current_setting('request.jwt.claim.role', true) = 'service_role', false)
                  OR coalesce(auth.jwt() ->> 'role', '') = 'service_role';

  -- [2] 호출자 가드.
  --     service_role 은 [4]의 자격 재확인으로 통제하므로 여기서는 통과시킨다.
  --     그 외 경로의 조건·문구는 원문 그대로다(테스트가 정확 비교로 핀).
  IF v_is_service THEN
    NULL;  -- 통과 — 단, [4]에서 '예약 만료된 deactivated 계정'이 아니면 차단된다
  ELSIF auth.uid() IS NULL
     OR (auth.uid() IS DISTINCT FROM p_user_id AND NOT public.is_admin()) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 또는 관리자만 삭제 가능';
  END IF;

  -- [3] 대상 행 잠금. 미존재면 USER_NOT_FOUND (쓰기 0 — prod 비파괴 프로브가 이 경로를 쓴다).
  SELECT * INTO v_user FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND: %', p_user_id; END IF;

  -- [4] service_role 채널 자격 재확인 — 피해 상한.
  --     스케줄러는 '탈퇴 예약이 이미 만료된 계정'만 지울 수 있다.
  --     [3]의 행 잠금 뒤라 탈퇴 철회와의 경합이 직렬화된다.
  IF v_is_service AND (
       v_user.status IS DISTINCT FROM 'deactivated'
       OR v_user.deletion_scheduled_for IS NULL
       OR v_user.deletion_scheduled_for > now()
     ) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE_FOR_SCHEDULED_DELETION: %', p_user_id;
  END IF;

  -- [5] 익명화·삭제 본문 — baseline 20260710000002:8221 원문 그대로 (축약·재배열 금지)
  UPDATE public.applications SET
    applicant_name = '[deleted]', applicant_nickname = NULL, applicant_phone = NULL,
    applicant_email = NULL, applicant_photo_url = NULL, updated_at = now()
  WHERE applicant_id = p_user_id;
  GET DIAGNOSTICS v_deleted_apps = ROW_COUNT;

  UPDATE public.work_logs SET
    staff_name = '[deleted]', staff_nickname = NULL, staff_photo_url = NULL, updated_at = now()
  WHERE staff_id = p_user_id;
  GET DIAGNOSTICS v_deleted_wlogs = ROW_COUNT;

  UPDATE public.work_logs SET owner_id = NULL, updated_at = now() WHERE owner_id = p_user_id;

  UPDATE public.job_postings SET
    status = 'closed', closed_at = now(), closed_reason = 'owner_deleted', owner_id = NULL, updated_at = now()
  WHERE owner_id = p_user_id AND status = 'active';
  UPDATE public.job_postings SET owner_id = NULL, updated_at = now() WHERE owner_id = p_user_id;

  UPDATE public.announcements SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE public.board_posts SET author_id = NULL WHERE author_id = p_user_id;
  UPDATE public.board_comments SET author_id = NULL WHERE author_id = p_user_id;
  DELETE FROM public.board_votes WHERE user_id = p_user_id;
  UPDATE public.board_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  DELETE FROM public.event_qr_codes WHERE user_id = p_user_id;
  UPDATE public.inquiries SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  UPDATE public.reviews SET reviewer_id = NULL, reviewer_name = '[deleted]' WHERE reviewer_id = p_user_id;
  UPDATE public.reviews SET reviewee_id = NULL, reviewee_name = '[deleted]' WHERE reviewee_id = p_user_id;
  DELETE FROM public.notifications WHERE recipient_id = p_user_id;
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;
  DELETE FROM public.notification_settings WHERE user_id = p_user_id;
  DELETE FROM public.users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'anonymizedApplications', v_deleted_apps,
    'anonymizedWorkLogs', v_deleted_wlogs, 'deletedNotifications', v_deleted_notifs);
END;
$function$;

COMMENT ON FUNCTION public.permanently_delete_user(uuid) IS
  '회원 영구 삭제(익명화 + 계정 삭제). 호출 채널 3가지: ①본인 ②관리자 ③service_role(크론 EF — 예약 만료된 deactivated 계정만, 그 외는 NOT_ELIGIBLE). 가드 문구는 supabase/tests/anon_rpc_security_hardening.test.sql 이 정확 비교로 핀하므로 변경 금지.';
