-- ============================================================
-- T1: 서버 권위 비용 계산 (단일소스: 표시 get_posting_cost = 과금 _calc_posting_cost)
-- 모델(Approach A §5.1): regular=1(heart), urgent=10, fixed=5, tournament=0
-- flag off / enabled=false / rollout 게이트 밖 → 0
-- rollout 버킷: abs(hashtext(owner_id)) % 100 < rollout_percentage 면 paid
-- ============================================================

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
  IF (abs(hashtext(p_owner_id::text)) % 100) >= v_rollout THEN
    RETURN 0;  -- rollout 버킷 밖
  END IF;

  RETURN v_base;
END;
$$;

REVOKE EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._calc_posting_cost(TEXT, UUID) TO authenticated, service_role;

-- 표시·과금 공유 read-only RPC
CREATE OR REPLACE FUNCTION public.get_posting_cost(
  p_type     TEXT,
  p_owner_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cost INT;
BEGIN
  v_cost := public._calc_posting_cost(p_type, p_owner_id);
  RETURN jsonb_build_object(
    'type', p_type,
    'cost', v_cost,
    'is_paid', v_cost > 0,
    'currency_hint', CASE WHEN p_type = 'regular' THEN 'heart_first' ELSE 'diamond' END
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_posting_cost(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_posting_cost(TEXT, UUID) TO authenticated, service_role;
