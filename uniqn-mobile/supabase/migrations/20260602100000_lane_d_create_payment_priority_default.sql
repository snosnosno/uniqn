-- ⚠️ DRAFT — Lane D. 유료화 ON 이후 적용. (priority 마이그 20260530100000 와 한 묶음)
--
-- 문제: 20260530100000 이 job_postings.priority 를 NOT NULL DEFAULT 0 으로 추가하는데,
--   create_job_posting_with_payment_atomically 는 `INSERT ... SELECT * FROM jsonb_populate_record(
--   NULL::job_postings, payload)` 패턴이라 payload 에 없는 priority 가 NULL 로 명시 삽입되어
--   NOT NULL 위반(컬럼 DEFAULT 는 명시 NULL 에 적용 안 됨). → 공고 생성 전면 실패.
--
-- 해결: create_payment 의 v_defaults 에 'priority', 0 추가(다른 default 컬럼과 동일 처리).
--   본 정의는 master 의 Fix-1b(20260602000001_create_payment_authz_guard) 본문 + priority 기본값.
--   머지 타임스탬프 순서상 Fix-1b 다음에 적용되어 최종 정의가 된다.
--   ⚠️ master 의 create_payment 가 추가 변경되면 본 정의와 재정합 필요(Lane D 실제 머지 시 reconcile).

CREATE OR REPLACE FUNCTION public.create_job_posting_with_payment_atomically(
  p_owner_id uuid,
  p_posting_payload jsonb,
  p_reason wallet_reason DEFAULT 'consume_job_posting'::wallet_reason
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_caller            UUID := (SELECT auth.uid());
  v_role              TEXT := public.get_my_role();
  v_payload_ws        UUID;
BEGIN
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;
  IF p_posting_payload IS NULL THEN
    RAISE EXCEPTION 'INVALID_PAYLOAD: cannot be NULL';
  END IF;

  -- [Fix-1b] 호출자 인가 (service_role/백엔드는 v_caller NULL → 통과)
  IF v_caller IS NOT NULL THEN
    IF v_role NOT IN ('admin', 'employer') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: role % cannot create job postings', v_role;
    END IF;
    IF v_role <> 'admin' AND v_caller <> p_owner_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: caller cannot create posting for another owner';
    END IF;
    v_payload_ws := NULLIF(p_posting_payload->>'workspace_id', '')::uuid;
    IF v_payload_ws IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.workspaces WHERE id = v_payload_ws AND owner_id = p_owner_id
       ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: workspace not owned by owner';
    END IF;
  END IF;

  v_posting_id := COALESCE((p_posting_payload->>'id')::uuid, gen_random_uuid());
  v_type := COALESCE(p_posting_payload->>'posting_type', 'regular');

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

  v_cost := public._calc_posting_cost(v_type, p_owner_id);

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
    'is_featured',       false,
    'priority',          0  -- Lane D: NOT NULL DEFAULT 0 컬럼 — jsonb_populate_record NULL 방지
  );

  v_final_payload := v_defaults
                     || p_posting_payload
                     || jsonb_build_object('id', v_posting_id, 'owner_id', p_owner_id);

  IF v_resolved_workspace_id IS NOT NULL THEN
    v_final_payload := v_final_payload || jsonb_build_object('workspace_id', v_resolved_workspace_id);
  END IF;

  INSERT INTO public.job_postings
  SELECT * FROM jsonb_populate_record(NULL::public.job_postings, v_final_payload)
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

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
$function$;

REVOKE EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(uuid, jsonb, wallet_reason) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(uuid, jsonb, wallet_reason) TO authenticated, service_role;
