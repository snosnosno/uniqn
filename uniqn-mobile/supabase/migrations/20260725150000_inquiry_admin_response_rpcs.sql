-- uniqn-mobile/supabase/migrations/20260725150000_inquiry_admin_response_rpcs.sql
-- 관리자 문의 응답/상태변경 RPC 신설 (Sentry UNIQN-MOBILE-1N 수정, 2026-07-25)
--
-- 배경: Supabase 전환(b69f6aae8)에서 InquiryRepository 가 respond_inquiry ·
-- update_inquiry_status RPC 를 호출하도록 구현됐으나, 함수를 만드는 마이그레이션이
-- 누락돼 prod 404(PGRST202 "not found in the schema cache") — 관리자 문의 응답이
-- 전 구간 불능이었다. baseline(20260710000002, prod 덤프)에도 부재 실측.
--
-- ⚠️ 시그니처 계약: 파라미터 이름은 출하된 클라이언트(1.0.4+36 포함)의 named-args
--    호출과 정확히 일치해야 한다. 이름 변경 = 기출하 바이너리 재파손.
--      respond_inquiry(p_inquiry_id, p_responder_id, p_responder_name, p_response, p_target_status)
--      update_inquiry_status(p_inquiry_id, p_target_status)
--
-- 보안(ops 1e M3 / secdef-hardening 문형):
--   - SECURITY DEFINER + search_path 고정(pg_temp 포함)
--   - NULL fail-open 차단: auth.uid() IS NULL 즉시 거부
--   - admin 게이트: public.is_admin() (JWT app_metadata.role)
--   - actor 바인딩: p_responder_id 는 호출자 auth.uid() 와 일치해야 함(위조 차단)
--   - 입력 검증: response 1~2000자 + XSS 패턴 차단(inquiries_xss_check 트리거는
--     subject/message 만 검사 — response 는 여기서 서버측 방어)
--   - PUBLIC/anon EXECUTE 회수 + authenticated 만 GRANT

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

  UPDATE public.inquiries
     SET response = v_response,
         responder_id = auth.uid(),
         responder_name = v_name,
         responded_at = now(),
         status = p_target_status,
         updated_at = now()
   WHERE id = p_inquiry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '문의 없음' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_inquiry_status(
  p_inquiry_id uuid,
  p_target_status public.inquiry_status
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION '관리자 전용' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.inquiries
     SET status = p_target_status,
         updated_at = now()
   WHERE id = p_inquiry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION '문의 없음' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- SECDEF 하드닝: anon/PUBLIC 실행 차단, authenticated 만 허용.
REVOKE EXECUTE ON FUNCTION public.respond_inquiry(uuid, uuid, text, text, public.inquiry_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_inquiry(uuid, uuid, text, text, public.inquiry_status) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_inquiry_status(uuid, public.inquiry_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_inquiry_status(uuid, public.inquiry_status) TO authenticated;
