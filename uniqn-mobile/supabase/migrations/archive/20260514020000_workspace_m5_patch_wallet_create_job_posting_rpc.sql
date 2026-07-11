-- 공고 워크스페이스 협업 편집 (PR #5 amendment) — wallet RPC workspace_id 주입
-- M3 후 job_postings.workspace_id NOT NULL 이라 기존 wallet RPC 가 INSERT 시 NOT NULL 위반.
-- 수정: 페이로드에 workspace_id 가 없으면 owner 의 workspace 에서 자동 주입.
-- 기존 RPC 시그니처 / 동작 / 권한 보존 — workspace_id resolution 만 추가.
-- 의존성 — M2 백필 완료 (모든 active employer 가 workspace 보유) 가 전제.

CREATE OR REPLACE FUNCTION public.create_job_posting_with_payment_atomically(
  p_owner_id        UUID,
  p_posting_payload JSONB,
  p_cost_diamonds   INT,
  p_reason          wallet_reason
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_posting_id        UUID;
  v_consume_result    JSONB;
  v_diamonds_consumed INT := 0;
  v_heart_consumed    INT := 0;
  v_defaults          JSONB;
  v_final_payload     JSONB;
  v_resolved_workspace_id UUID;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;
  IF p_posting_payload IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: cannot be NULL';
  END IF;
  IF p_cost_diamonds < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: cost_diamonds % must be >= 0', p_cost_diamonds;
  END IF;

  -- workspace_id 자동 주입: 페이로드에 없으면 owner 의 1번째 workspace 에서 lookup
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

  v_defaults := jsonb_build_object(
    'id',                gen_random_uuid(),
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

  v_final_payload := v_defaults || p_posting_payload || jsonb_build_object('owner_id', p_owner_id);

  IF v_resolved_workspace_id IS NOT NULL THEN
    v_final_payload := v_final_payload || jsonb_build_object('workspace_id', v_resolved_workspace_id);
  END IF;

  INSERT INTO public.job_postings
  SELECT * FROM jsonb_populate_record(NULL::public.job_postings, v_final_payload)
  RETURNING id INTO v_posting_id;

  IF p_cost_diamonds > 0 THEN
    v_consume_result := public.consume_diamonds_atomically(
      p_owner_id,
      p_cost_diamonds,
      p_reason,
      v_posting_id,
      'job_posting'
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

COMMENT ON FUNCTION public.create_job_posting_with_payment_atomically IS
  'job_postings INSERT + 다이아 차감을 단일 트랜잭션으로. workspace_id 자동 주입 (M3 NOT NULL 호환). consume RPC가 INSUFFICIENT_BALANCE 던지면 공고 INSERT까지 롤백. tournament(cost=0)는 차감 skip.';
