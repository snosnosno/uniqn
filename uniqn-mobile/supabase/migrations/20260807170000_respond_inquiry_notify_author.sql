-- uniqn-mobile/supabase/migrations/20260807170000_respond_inquiry_notify_author.sql
-- 관리자가 문의에 답변하면 문의자에게 알림을 보낸다 (전체 감사 A3 / B1, 2026-08-07)
--
-- 배경: inquiry_answered 는 클라이언트 배선이 **완비**돼 있다 —
--   타입(src/types/notification.ts) · 카테고리 admin · 라우트맵 support/inquiry ·
--   문구 템플릿 · EF 카테고리맵. 그런데 **발송자가 없다**(prod 실측 0건).
--   respond_inquiry(20260725150000)가 inquiries UPDATE 만 하고 notifications 를 안 건드린다.
--   → 문의자는 답변이 등록된 사실을 영영 모른다. 앱 어디에도 "답변 왔음" 신호가 없다.
--
-- 방식: CREATE OR REPLACE 전용. 함수 수·정책 수 증감 0 → 파리티 200/111 불변.
--
-- ⚠️ 시그니처·RETURNS 변경 금지 — 출하된 클라이언트(1.0.4+36 포함)가 named-args 로
--    호출한다(20260725150000:9-12). pgTAP inquiry_admin_rpcs.test.sql (1) 이
--    identity_arguments 완전일치를 단언한다.
-- ⚠️ 게이트 4종(admin·actor 바인딩·길이·XSS)은 20260725150000 원문 그대로다. 변경 없음.
--
-- 설계 결정 2가지:
--   ① 알림 실패가 답변을 롤백시키면 안 된다 — 관측(RAISE WARNING)만 남기고 통과시킨다.
--      notifications INSERT 는 increment_unread_counter 트리거를 태우는데 그 함수엔
--      EXCEPTION 핸들러가 없다. 카운터 이상으로 관리자의 답변이 막히는 건 더 나쁘다.
--      선례: cancel_application_atomically 의 알림 서브블록.
--   ② body 에 문의 제목을 넣지 않는다 — DB body 는 그대로 푸시 payload 가 되어
--      **잠금화면에 노출**된다. 문의 카테고리에는 payment·account·report 가 있다.
--      제목은 상세 화면이 RLS 로 다시 읽는다.

CREATE OR REPLACE FUNCTION public.respond_inquiry(
  p_inquiry_id uuid,
  p_responder_id uuid,
  p_responder_name text,
  p_response text,
  p_target_status public.inquiry_status
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_response text := btrim(coalesce(p_response, ''));
  v_name text := btrim(coalesce(p_responder_name, ''));
  v_prev_response text;
  v_author_id uuid;
BEGIN
  -- admin 게이트 (NULL fail-open 차단)
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 전용' USING ERRCODE = 'P0001';
  END IF;
  -- actor 바인딩(위조 차단): responder 는 호출자 본인
  IF auth.uid() IS DISTINCT FROM p_responder_id THEN
    RAISE EXCEPTION 'actor 불일치' USING ERRCODE = 'P0001';
  END IF;
  -- 입력 검증 (클라 respondInquirySchema 와 동일 경계: 1~2000자)
  IF char_length(v_response) < 1 OR char_length(v_response) > 2000 THEN
    RAISE EXCEPTION '응답 내용 불량' USING ERRCODE = 'P0001';
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 100 THEN
    RAISE EXCEPTION '응답자 이름 불량' USING ERRCODE = 'P0001';
  END IF;
  -- XSS 방어 (check_xss_fields 와 동일 패턴 — response 컬럼은 트리거 미커버)
  IF v_response ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed'
     OR v_name ~* '<\s*script|javascript\s*:|on\w+\s*=|<\s*iframe|<\s*object|<\s*embed' THEN
    RAISE EXCEPTION 'XSS pattern detected in field: response' USING ERRCODE = 'P0001';
  END IF;

  -- 재알림 판정을 위해 직전 답변을 읽어 둔다(같은 답변 재저장 = 무알림).
  SELECT response INTO v_prev_response
    FROM public.inquiries WHERE id = p_inquiry_id;

  UPDATE public.inquiries
     SET response = v_response,
         responder_id = auth.uid(),
         responder_name = v_name,
         responded_at = now(),
         status = p_target_status,
         updated_at = now()
   WHERE id = p_inquiry_id
  RETURNING user_id INTO v_author_id;

  -- ⚠️ 이 검사는 반드시 UPDATE 바로 다음이어야 한다. 위 SELECT 뒤로 밀리면
  --    SELECT 의 FOUND 를 보게 되어 미존재 문의가 조용히 통과한다.
  IF NOT FOUND THEN
    RAISE EXCEPTION '문의 없음' USING ERRCODE = 'P0001';
  END IF;

  IF v_author_id IS NOT NULL                          -- inquiries.user_id 는 nullable(비회원 문의)
     AND v_author_id IS DISTINCT FROM auth.uid()      -- 관리자 자문자답에 자기 알림 금지
     AND v_prev_response IS DISTINCT FROM v_response  -- 내용이 바뀔 때만 재알림
  THEN
    BEGIN
      INSERT INTO public.notifications (recipient_id, type, title, body, link, data, priority)
      VALUES (
        v_author_id,
        'inquiry_answered',
        '💬 문의 답변',
        '문의하신 내용에 답변이 등록되었습니다.',
        format('/support/inquiry/%s', p_inquiry_id),
        jsonb_build_object('inquiryId', p_inquiry_id),
        'normal'
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[respond_inquiry] notify failed for inquiry % — %', p_inquiry_id, SQLERRM;
    END;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.respond_inquiry(uuid, uuid, text, text, public.inquiry_status) IS
  '관리자 문의 답변 저장 + 문의자에게 inquiry_answered 알림. 답변 내용이 바뀔 때만 알림(같은 답변 재저장은 무알림). 알림 실패는 WARNING 만 남기고 답변은 커밋된다.';

-- SECDEF 하드닝 재기술(멱등) — CREATE OR REPLACE 는 ACL 을 보존하지만
-- 로컬 재빌드 환경에서 REVOKE 가 유실되지 않도록 명시한다.
REVOKE EXECUTE ON FUNCTION public.respond_inquiry(uuid, uuid, text, text, public.inquiry_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_inquiry(uuid, uuid, text, text, public.inquiry_status) TO authenticated;
