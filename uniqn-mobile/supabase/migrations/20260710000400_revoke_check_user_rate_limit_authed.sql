-- 2026-07-10 보안 하드닝 (P1): check_user_rate_limit authenticated EXECUTE 회수
--
-- 배경(authenticated SECDEF 감사, lens-authed HIGH #6):
--  * check_user_rate_limit(p_user_id, p_operation, p_max_requests, p_window_seconds) 은
--    p_user_id(클라 통제)를 auth.uid() 검증 없이 그대로 rate-limit 키에 넣는다
--    (`check_rate_limit('user:'||p_user_id||':'||p_operation, ...)`).
--    → 인증된 임의 사용자가 표적 user_id 의 특정 operation 버킷을 선제 소진시켜
--      피해자 정상요청을 레이트리밋으로 차단(선택적 DoS) 가능.
--  * 전 저장소 호출자 0(src/app/functions 실측) = dead code. anon 은 이미 false.
--
-- 수정: authenticated/PUBLIC/anon EXECUTE 회수(service_role 유지 — rate-limit 패밀리 일관).
--   dead 라 정상 클라 무회귀. 향후 사용 시엔 본문에 auth.uid() 바인딩 필수(재도입 게이트).

DO $$
DECLARE rec record;
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'check_user_rate_limit'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', rec.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', rec.sig);
  END LOOP;
END $$;
