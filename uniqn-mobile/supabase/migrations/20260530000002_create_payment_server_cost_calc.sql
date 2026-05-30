-- ============================================================
-- T2: create_job_posting_with_payment_atomically
--   - p_cost_diamonds 인자 제거 → 서버 _calc_posting_cost(T1)로 비용 산출
--   - INSERT 본문(v_defaults + jsonb_populate_record) 보존 — round-trip 검증 방식 유지
--   - 멱등: payload.id 흡수 + ON CONFLICT (id) DO NOTHING → 재시도 시 중복 공고 방지
-- 현행 정의 출처: 20260427000601 (INSERT 본문 동일)
-- 구 4-인자 시그니처는 명시 DROP (오버로드 잔존 방지)
-- ============================================================

DROP FUNCTION IF EXISTS public.create_job_posting_with_payment_atomically(UUID, JSONB, INT, wallet_reason);

CREATE OR REPLACE FUNCTION public.create_job_posting_with_payment_atomically(
  p_owner_id        UUID,
  p_posting_payload JSONB,
  p_reason          wallet_reason DEFAULT 'consume_job_posting'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_posting_id        UUID;
  v_type              TEXT;
  v_cost              INT;
  v_consume_result    JSONB;
  v_diamonds_consumed INT := 0;
  v_heart_consumed    INT := 0;
  v_defaults          JSONB;
  v_final_payload     JSONB;
  v_inserted          INT := 0;
  v_resolved_workspace_id UUID;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;
  IF p_posting_payload IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: cannot be NULL';
  END IF;

  -- 멱등 posting_id: payload.id가 있으면 그것을, 없으면 신규 생성
  v_posting_id := COALESCE((p_posting_payload->>'id')::uuid, gen_random_uuid());
  v_type := COALESCE(p_posting_payload->>'posting_type', 'regular');

  -- workspace_id 자동 주입: 페이로드에 없으면 owner 의 1번째 workspace 에서 lookup (M5 호환)
  IF NOT (p_posting_payload ? 'workspace_id') OR (p_posting_payload->>'workspace_id') IS NULL THEN
    SELECT id INTO v_resolved_workspace_id
    FROM public.workspaces
    WHERE owner_id = p_owner_id
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_resolved_workspace_id IS NULL THEN
      RAISE EXCEPTION 'WORKSPACE_NOT_FOUND: owner % has no workspace — backfill 누락', p_owner_id;
    END IF;
  END IF;

  -- 서버 권위 비용 (flag off → 0)
  v_cost := public._calc_posting_cost(v_type, p_owner_id);

  -- INSERT 본문 보존 (현행 20260427000601과 동일한 defaults + populate_record)
  v_defaults := jsonb_build_object(
    'id',                v_posting_id,
    'schema_version',    3,
    'status',            'draft',
    'posting_type',      'regular',
    'created_at',        now(),
    'updated_at',        now(),
    'location',          '{}'::jsonb,
    'schedule',          '{}'::jsonb,
    'role_catalog',      '[]'::jsonb,
    'compensation',      '{}'::jsonb,
    'questions',         jsonb_build_object('items', '[]'::jsonb),
    'stats',             jsonb_build_object(
                           'filledPositions', 0,
                           'totalApplicants', 0,
                           'activeApplicants', 0,
                           'confirmedApplicants', 0,
                           'cancellationPendingApplicants', 0
                         ),
    'total_positions',   0,
    'filled_positions',  0,
    'view_count',        0,
    'is_featured',       false
  );

  v_final_payload := v_defaults
                     || p_posting_payload
                     || jsonb_build_object('id', v_posting_id, 'owner_id', p_owner_id);

  -- workspace_id 자동 주입 적용 (M5 호환): payload에 없을 때만 resolved 값 병합
  IF v_resolved_workspace_id IS NOT NULL THEN
    v_final_payload := v_final_payload || jsonb_build_object('workspace_id', v_resolved_workspace_id);
  END IF;

  INSERT INTO public.job_postings
  SELECT * FROM jsonb_populate_record(NULL::public.job_postings, v_final_payload)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- 멱등: 이미 존재(재시도)면 차감 없이 기존 결과 반환
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'posting_id', v_posting_id,
      'idempotent', true,
      'diamonds_consumed', 0,
      'hearts_consumed', 0,
      'total_consumed', 0
    );
  END IF;

  -- 신규 삽입에 한해 차감 (cost>0). consume은 ref_id=posting_id로 멱등(T3).
  IF v_cost > 0 THEN
    v_consume_result := public.consume_diamonds_atomically(
      p_owner_id, v_cost, p_reason, v_posting_id, 'job_posting'
    );
    v_diamonds_consumed := COALESCE((v_consume_result->>'diamond_consumed')::int, 0);
    v_heart_consumed    := COALESCE((v_consume_result->>'heart_consumed')::int, 0);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'posting_id', v_posting_id,
    'diamonds_consumed', v_diamonds_consumed,
    'hearts_consumed', v_heart_consumed,
    'total_consumed', v_diamonds_consumed + v_heart_consumed
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, wallet_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, wallet_reason) TO authenticated, service_role;

COMMENT ON FUNCTION public.create_job_posting_with_payment_atomically IS
  'job_postings INSERT + 서버 비용 산출(_calc_posting_cost) + 다이아 차감을 단일 트랜잭션으로. '
  'p_cost_diamonds 클라이언트 인자 제거 → 서버 권위. '
  'ON CONFLICT DO NOTHING + GET DIAGNOSTICS 멱등. '
  'flag off → cost=0 → 무료 게시 동등(R1). '
  'T2 (wallet-client-integration lane A)';
