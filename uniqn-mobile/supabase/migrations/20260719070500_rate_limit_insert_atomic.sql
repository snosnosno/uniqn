-- check_rate_limit 최초 INSERT 원자화 — 동시성 레이스로 인한 23505 제거
--
-- 결함(로컬 스택 실측 재현): 행이 아직 없을 때 `SELECT ... FOR UPDATE` 는 잠글 행이 없어
--   아무 락도 잡지 못한다. 두 트랜잭션이 동시에 진입하면 둘 다 INSERT 를 시도해
--   `duplicate key value violates unique constraint "rate_limits_key_key"` (23505) 가 난다.
--
-- 사용자 영향: 클라 매핑(src/utils/supabase.ts)에서 23505 → VALIDATION_SCHEMA 이므로
--   사장님에게 "형식 오류"로 표시된다. 검색이 형식 오류로 실패하는 것처럼 보인다.
--
-- 도달 경로가 실재한다: rate_limits 행의 expires_at 은 window*2(=120초)인데 정리 cron 은
--   하루 1회이므로, 사용자별 "그날 첫 검색"에서는 행이 없다. 그 순간 검색 버튼 연타 또는
--   두 검색을 동시에 열면 적중한다. (useStaffNicknameSearch 는 이미 "연타 시" 순서 역전을
--   가드하고 있어 연타가 실제 시나리오임을 전제한다)
--
-- 수정: INSERT ... ON CONFLICT (key) DO UPDATE 로 원자화한다. 경쟁에서 진 쪽은 예외 대신
--   승자가 만든 행에서 토큰을 하나 더 차감한다 — 두 요청 모두 정확히 1토큰씩 소비한다.
--
-- 범위 주의: check_rate_limit 은 공용 함수다. 다만 활성 마이그 전수 조사 결과 현재
--   유일한 호출부는 20260719061931_nickname_search_rate_limit.sql 의 검색 RPC 2종이며
--   (check_user_rate_limit 경유), 이 함수는 prod 에서 아직 한 번도 실행된 적이 없다.
--   기존 동작(윈도우 리필·토큰 차감·거부 분기)은 그대로 보존한다.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_requests integer DEFAULT 30,
  p_window_seconds integer DEFAULT 60
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  -- ⚠️ pg_temp 필수: 20260711100000_secdef_pg_temp_batch_and_overload_drop.sql 이 SECDEF 함수
  --   62종에 pg_temp 를 일괄 보정했다. baseline 원본 형태(pg_catalog, public)로 CREATE OR REPLACE
  --   하면 그 보정이 조용히 유실되고 parity_baseline_guard.test.sql 의
  --   "SECDEF search_path pg_temp 누락 0" 단언이 깨진다(실제 발생 → 이 주석으로 봉인).
  SET search_path TO 'pg_catalog', 'public', 'pg_temp'
  AS $$
DECLARE
  v_record RECORD;
  v_now timestamptz := now();
  v_window_start timestamptz := v_now - (p_window_seconds || ' seconds')::interval;
  v_remaining int;
  v_tokens int;
BEGIN
  -- rate_limits 행 조회 (있으면 잠근다)
  SELECT * INTO v_record FROM public.rate_limits WHERE key = p_key FOR UPDATE;

  IF v_record IS NULL THEN
    -- 첫 요청: 원자적 INSERT. 동시 진입 시 진 쪽은 23505 대신 승자 행에서 1토큰 차감한다.
    INSERT INTO public.rate_limits (key, tokens, last_refill, expires_at)
    VALUES (p_key, p_max_requests - 1, v_now, v_now + (p_window_seconds * 2 || ' seconds')::interval)
    ON CONFLICT (key) DO UPDATE
      SET tokens = GREATEST(public.rate_limits.tokens - 1, 0)
    RETURNING tokens INTO v_tokens;

    RETURN jsonb_build_object('allowed', true, 'remaining', v_tokens, 'retryAfter', 0);
  END IF;

  -- 윈도우 리필 확인
  IF v_record.last_refill < v_window_start THEN
    -- 윈도우가 지남 → 토큰 리필
    UPDATE public.rate_limits
    SET tokens = p_max_requests - 1,
        last_refill = v_now,
        expires_at = v_now + (p_window_seconds * 2 || ' seconds')::interval
    WHERE key = p_key;

    RETURN jsonb_build_object('allowed', true, 'remaining', p_max_requests - 1, 'retryAfter', 0);
  END IF;

  -- 토큰 확인
  IF v_record.tokens > 0 THEN
    UPDATE public.rate_limits
    SET tokens = tokens - 1
    WHERE key = p_key;

    RETURN jsonb_build_object('allowed', true, 'remaining', v_record.tokens - 1, 'retryAfter', 0);
  ELSE
    -- 한도 초과 — DML 없음(예외로 롤백되어도 되돌릴 쓰기가 없다)
    v_remaining := EXTRACT(EPOCH FROM (v_record.last_refill + (p_window_seconds || ' seconds')::interval - v_now))::int;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retryAfter', GREATEST(v_remaining, 1)
    );
  END IF;
END;
$$;

ALTER FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) OWNER TO postgres;

-- 기존 ACL 재확인(멱등) — service_role 전용 유지, 클라이언트 직접 호출 차단
REVOKE ALL ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) FROM anon;
REVOKE ALL ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) FROM authenticated;
GRANT ALL ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) TO service_role;

COMMENT ON FUNCTION public.check_rate_limit(p_key text, p_max_requests integer, p_window_seconds integer) IS
  '토큰버킷 rate limit. 최초 INSERT 는 ON CONFLICT 로 원자화(동시 진입 23505 방지). 거부 분기는 DML 없음.';
