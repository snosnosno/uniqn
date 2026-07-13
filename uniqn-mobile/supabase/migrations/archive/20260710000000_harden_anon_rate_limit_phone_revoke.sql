-- 2026-07-10 보안 하드닝 (P0): anon EXECUTE 잔존 3함수 회수
--
-- 배경(prod 라이브 감사 실측, 2026-07-10):
--  * 2026-06-21 하드닝(20260621090000)이 위험 SECDEF RPC anon EXECUTE 를 회수했으나
--    REVOKE 리스트에서 아래 3개가 누락되어 prod anon 에 여전히 노출됨:
--    - check_rate_limit(text,int,int)     : 리스트에 check_user_rate_limit 만 있고 원본 누락.
--    - check_ip_rate_limit(text,int,int)  : 위 함수의 래퍼, 동일 누락.
--    - check_phone_exists(text)           : 06-21 allowlist 가 "가입 경로 호출" 로 유지했으나
--                                           실측상 클라이언트 호출자 0(가입은 email 만 확인).
--                                           = stale allowlist. PII(전화) 열거 오라클로만 잔존.
--
--  * check_rate_limit 위험(anon 재현 확인): p_key/p_max_requests/p_window_seconds 전부
--    클라이언트 통제 → 거대 max_requests 로 자기 레이트리밋 무력화, 임의 key 로
--    rate_limits 무한 INSERT(DoS)/피해자 버킷 선점. anon 재현: max=2^31-1 → allowed=true.
--
-- 안전성:
--  * 3함수 모두 저장소(src/**, app/**, supabase/functions/**, e2e/**, migrations/**)
--    호출자 0 = dead code. anon REVOKE 로 정상 클라이언트 회귀 없음.
--  * RLS 정책 표현식에서 호출되지 않음(anon SECDEF poison 무관, pg_policy 전수 확인).
--  * check_rate_limit/check_ip_rate_limit 는 prod-only(레포 CREATE 부재) →
--    로컬에는 미존재. DO 블록 존재 가드로 멱등 skip(로컬 no-op, prod 유효).
--  * authenticated/service_role 는 유지(check_user_rate_limit 선례와 동일 정책).
--
-- 검증: 적용 후 has_function_privilege('anon', <sig>, 'EXECUTE') = false (pgTAP 회귀 동봉).

DO $$
DECLARE
  rec record;
  names text[] := ARRAY[
    'check_rate_limit', 'check_ip_rate_limit', 'check_phone_exists'
  ];
BEGIN
  FOR rec IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = ANY(names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', rec.sig);
    -- check_phone_exists 는 authenticated 유지(향후 인증 후 검증 대비 = 06-21 의도 보존).
    -- check_rate_limit/ip 는 authenticated+service_role 유지(check_user_rate_limit 선례).
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', rec.sig);
  END LOOP;
END $$;
