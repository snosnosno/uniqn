-- [P3] _calc_posting_cost rollout 버킷 hashtext INT_MIN 오버플로 교정
--
-- 근거: rev1 보안·머니 리뷰 (docs/planning/2026-06-05-rev1-security-money-fixes.md §1-3)
-- 문제: abs(hashtext(owner)) % 100 에서 hashtext = -2147483648 시 abs() 가 int4 범위 초과
--       → 'integer out of range' 예외 → 유료화 ON 상태에서 해당 owner 공고 생성 결정적 차단.
-- 수정: bigint 마스킹 (hashtext::bigint & 2147483647) 으로 0..2^31-1 (오버플로 회피 + abs 음수접힘
--       분포편향 동시 제거). 라인 1개만 변경, 현행 본문(20260530000001) 그대로 보존.
-- 안전: 현재 prod paid_types 전부 false → cost=0 → 함수가 paid_types 게이트에서 조기 return,
--       hashtext 라인 미도달. 따라서 현 시점 동작불변(유료화 ON 시에만 차이).

CREATE OR REPLACE FUNCTION public._calc_posting_cost(
  p_type     TEXT,
  p_owner_id UUID
) RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config  JSONB;
  v_base    INT;
  v_rollout INT;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;

  v_base := CASE p_type
    WHEN 'urgent'     THEN 10
    WHEN 'fixed'      THEN 5
    WHEN 'tournament' THEN 0
    ELSE 1  -- regular 및 기타
  END;

  IF v_base = 0 THEN
    RETURN 0;
  END IF;

  SELECT value INTO v_config FROM public.app_config WHERE key = 'monetization';
  IF v_config IS NULL THEN
    RETURN 0;  -- flag 미시드 = 무과금
  END IF;

  IF NOT COALESCE((v_config->>'enabled')::boolean, false) THEN
    RETURN 0;
  END IF;

  IF NOT COALESCE((v_config->'paid_types'->>p_type)::boolean, false) THEN
    RETURN 0;
  END IF;

  v_rollout := COALESCE((v_config->>'rollout_percentage')::int, 0);
  -- [FIX 2026-06-05] abs(int4) INT_MIN 오버플로 회피 + 분포편향 제거: bigint 마스킹 0..2^31-1
  IF ((hashtext(p_owner_id::text)::bigint & 2147483647) % 100) >= v_rollout THEN
    RETURN 0;  -- rollout 버킷 밖
  END IF;

  RETURN v_base;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) TO authenticated, service_role;
