-- create_job_posting_with_payment_atomically:
-- 다이아 차감 + job_postings INSERT를 단일 트랜잭션으로 수행
-- consume RPC가 INSUFFICIENT_BALANCE 던지면 공고 INSERT까지 롤백
-- tournament(cost=0)는 차감 skip (Decision #11)
-- Spec §6.3 race window 해결, Plan Task 7
--
-- 페이로드 규약: 호출자는 job_postings 컬럼 키를 그대로 jsonb로 전달.
-- 누락 필드는 RPC가 SQL DEFAULT 값으로 보강. owner_id는 RPC가 강제 override.
-- 보강 대상: id, status, posting_type, schema_version, created_at, updated_at,
--           location, schedule, role_catalog, compensation, questions, stats,
--           total_positions, filled_positions, view_count, is_featured

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
BEGIN
  -- 0) NULL/범위 가드
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;
  IF p_posting_payload IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: cannot be NULL';
  END IF;
  IF p_cost_diamonds < 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: cost_diamonds % must be >= 0', p_cost_diamonds;
  END IF;

  -- 1) NOT NULL/default 컬럼 보강 (jsonb_populate_record는 누락 키를 NULL로 채워 default 적용 안 됨)
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

  -- 호출자 페이로드가 default를 override, owner_id는 RPC가 마지막 강제
  v_final_payload := v_defaults || p_posting_payload || jsonb_build_object('owner_id', p_owner_id);

  -- 2) 공고 INSERT
  INSERT INTO public.job_postings
  SELECT * FROM jsonb_populate_record(NULL::public.job_postings, v_final_payload)
  RETURNING id INTO v_posting_id;

  -- 3) cost > 0이면 차감 (실패 시 전체 트랜잭션 롤백)
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

REVOKE EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, INT, wallet_reason) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, INT, wallet_reason) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(UUID, JSONB, INT, wallet_reason) TO service_role;

COMMENT ON FUNCTION public.create_job_posting_with_payment_atomically IS
  'job_postings INSERT + 다이아 차감을 단일 트랜잭션으로. consume RPC가 INSUFFICIENT_BALANCE 던지면 공고 INSERT까지 롤백. tournament(cost=0)는 차감 skip. NOT NULL 컬럼은 RPC가 SQL DEFAULT로 보강. Spec §6.3 + Decision #11';
