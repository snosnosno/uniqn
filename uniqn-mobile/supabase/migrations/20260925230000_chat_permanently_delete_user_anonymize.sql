-- ============================================================================
-- 앱 내 채팅 S4-3 — 탈퇴 익명화(D5) + 사진 삭제 큐(설계 §4-2 M7)
-- ============================================================================
-- 설계: docs/planning/2026-09-24-in-app-chat-design.md §7 탈퇴 · §4-2 M7 · §15 D5·D12
-- 계획: docs/planning/2026-09-25-chat-s4-safety-plan.md "탈퇴 익명화"
--
-- 한 줄: 탈퇴자의 채팅 메시지는 본문·사진을 지우고 이름을 '[탈퇴한 사용자]'로 바꾼다. 사진 파일은
--        SQL 로 지우면 실제 파일이 남으므로 **삭제 큐**에 적재하고 EF process-scheduled-deletions 가
--        Storage API 로 지운다(성공할 때까지 멱등 재시도).
--
--   비유: 이사 간 사람의 편지를 지우개로 지우고 서명을 '떠난 사람'으로 바꾼다. 사진은 창고에서
--         직접 빼야 하므로 '회수 목록'에 적어 두면 매일 담당자가 회수한다.
--
-- ⚠️ 순서가 핵심(M7): 사진 목록 적재 → 메시지 익명화 → (기존) DELETE FROM users.
--    users 행이 사라지면 sender_id 가 SET NULL 되어 누구 사진인지 경로로만 찾을 수 있다 — 경로
--    2세그먼트가 발신자 uid 라 여기서 찾는다(storage.objects 스캔).
-- ⚠️ 신고 증거 사진은 적재하지 않는다(D12 — 신고 처리 후 1년 보존, 탈퇴와 무관). 만료 삭제는 S5-b.
--
-- 🚨 기존 결함 동시 수정: 본문의 `DELETE FROM public.board_votes …` 가 09-10 마이그 20260910002240
--    (board_votes DROP) 이후 **모든 탈퇴(본인·관리자·크론)를 42P01 로 실패**시키고 있었다. plpgsql 은
--    실행 시점에 테이블을 찾으므로 DROP 때 오류가 나지 않았고, 기존 테스트는 가드 단계
--    (USER_NOT_FOUND)에서 멈추거나 users 를 직접 DELETE 해 본문 끝까지 실행한 적이 없었다.
--    prod 탈퇴 대기(deactivated) 0명(09-25 실측)이라 아직 피해는 없다. 그 한 문장만 뺀다.
--    chat_account_deletion_anonymize.test.sql A1 이 본문 전체를 처음으로 실행한다.
--
-- 🔑 permanently_delete_user 는 **CREATE OR REPLACE 만**(DROP+CREATE 금지 — prod pg_default_acl 의
--    anon=X 로 anon EXECUTE 가 부활한다, 20260807150000 헤더). 본문 = prod pg_proc 실측
--    (md5 273aed3a…, 2026-09-25) = 20260807150000 원문. [5] 에 채팅 블록만 끼웠다.
--    가드 문구·search_path 는 글자 그대로(anon_rpc_security_hardening.test.sql 가 행동으로 핀).
--
-- 파리티: 불변(재정의 + 정책 없는 테이블) → 245 / 106
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 사진 삭제 큐 — deny-all(RLS on · 정책 없음 · authenticated/anon 권한 없음). EF 만 읽고 쓴다
-- ----------------------------------------------------------------------------
CREATE TABLE public.chat_media_deletion_queue (
  bucket_id   text NOT NULL CHECK (bucket_id IN ('chat-media', 'chat-media-inbox')),
  object_name text NOT NULL,
  reason      text NOT NULL CHECK (reason IN ('account_deleted', 'retention_purge', 'orphan', 'evidence_expired')),
  enqueued_at timestamptz NOT NULL DEFAULT now(),
  attempts    int NOT NULL DEFAULT 0,
  last_error  text,
  PRIMARY KEY (bucket_id, object_name)
);
CREATE INDEX chat_media_deletion_queue_enqueued_idx ON public.chat_media_deletion_queue (enqueued_at);

ALTER TABLE public.chat_media_deletion_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chat_media_deletion_queue FROM anon, authenticated;
GRANT ALL ON public.chat_media_deletion_queue TO service_role;

COMMENT ON TABLE public.chat_media_deletion_queue IS
  '채팅 사진 삭제 대기열. 탈퇴 익명화(S4)·보존 purge·고아 정리(S5-b)가 적재하고 EF '
  'process-scheduled-deletions 가 Storage API 로 지운 뒤 행을 삭제한다. 실패는 attempts·last_error.';

-- ----------------------------------------------------------------------------
-- 2. permanently_delete_user — [5] 에 채팅 익명화 블록
-- ----------------------------------------------------------------------------
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
  -- (S4) board_votes 삭제 문장 제거 — 테이블이 20260910002240 에서 DROP 됐다. 남아 있으면 이 함수는
  --      가드를 통과한 모든 호출에서 42P01 로 실패한다(prod 실측 09-25: to_regclass NULL).
  UPDATE public.board_reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  DELETE FROM public.event_qr_codes WHERE user_id = p_user_id;
  UPDATE public.inquiries SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.reports SET reporter_id = NULL WHERE reporter_id = p_user_id;
  UPDATE public.reviews SET reviewer_id = NULL, reviewer_name = '[deleted]' WHERE reviewer_id = p_user_id;
  UPDATE public.reviews SET reviewee_id = NULL, reviewee_name = '[deleted]' WHERE reviewee_id = p_user_id;
  -- [5-채팅] (S4 — D5 · M7) users 삭제(SET NULL 연쇄) **전에** 해야 경로·발신자로 찾을 수 있다.
  --   ① 탈퇴자가 올린 사진(경로 2세그먼트 = uid)을 삭제 큐에 — 신고 증거 사진은 제외(D12)
  INSERT INTO public.chat_media_deletion_queue (bucket_id, object_name, reason)
  SELECT o.bucket_id, o.name, 'account_deleted'
    FROM storage.objects o
   WHERE o.bucket_id IN ('chat-media', 'chat-media-inbox')
     AND split_part(o.name, '/', 2) = p_user_id::text
     AND NOT EXISTS (SELECT 1 FROM public.reports r
                      WHERE r.evidence_snapshot -> 'imagePaths' ? o.name)
  ON CONFLICT (bucket_id, object_name) DO NOTHING;
  --   ② 탈퇴자 발신 메시지: 본문·사진 삭제 + 이름 익명화(chat_msg_shape_chk 의 삭제 형태)
  UPDATE public.chat_messages SET
    body = '', image_path = NULL, image_width = NULL, image_height = NULL,
    deleted_at = coalesce(deleted_at, now()), sender_display_name = '[탈퇴한 사용자]'
  WHERE sender_id = p_user_id;
  --   ③ 탈퇴자가 구직자인 방의 이름 스냅샷
  UPDATE public.chat_conversations SET seeker_display_name = '[탈퇴한 사용자]'
  WHERE seeker_id = p_user_id;
  --   ④ 상대가 받은 채팅 알림의 미리보기(D4 — 본문 60자 사본). 제목은 **구직자 이름일 때만** 바꾼다
  --      (구인자 측 발신 알림의 제목은 업장명이라 개인정보가 아니다 — 보안 리뷰 LOW-6)
  UPDATE public.notifications n SET
    body = '',
    title = CASE
              WHEN n.title <> '새 채팅 문의' AND EXISTS (
                     SELECT 1 FROM public.chat_conversations c
                      WHERE c.id::text = n.data ->> 'conversationId' AND c.seeker_id = p_user_id)
              THEN '[탈퇴한 사용자]'
              ELSE n.title
            END
  WHERE n.type = 'chat_message' AND n.data ->> 'senderId' = p_user_id::text;
  DELETE FROM public.notifications WHERE recipient_id = p_user_id;
  GET DIAGNOSTICS v_deleted_notifs = ROW_COUNT;
  DELETE FROM public.notification_settings WHERE user_id = p_user_id;
  DELETE FROM public.users WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN jsonb_build_object('success', true, 'anonymizedApplications', v_deleted_apps,
    'anonymizedWorkLogs', v_deleted_wlogs, 'deletedNotifications', v_deleted_notifs);
END;
$function$;

-- 권한은 CREATE OR REPLACE 로 그대로 유지된다(prod proacl = postgres·authenticated·service_role — 09-25 실측).

-- ----------------------------------------------------------------------------
-- 3. 적용 시점 자체 검증
-- ----------------------------------------------------------------------------
DO $verify$
BEGIN
  IF has_function_privilege('anon', 'public.permanently_delete_user(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.permanently_delete_user(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'permanently_delete_user 권한이 바뀌었다(anon 부활 또는 authenticated 상실)';
  END IF;
  IF has_table_privilege('authenticated', 'public.chat_media_deletion_queue', 'SELECT')
     OR has_table_privilege('anon', 'public.chat_media_deletion_queue', 'SELECT') THEN
    RAISE EXCEPTION 'chat_media_deletion_queue 가 클라이언트 롤에 열려 있다';
  END IF;
END
$verify$;
