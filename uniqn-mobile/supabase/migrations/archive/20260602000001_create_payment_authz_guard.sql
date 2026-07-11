-- Fix-1b: create_job_posting_with_payment_atomically 호출자 인가 가드 복원
--
-- 근거: docs/planning/2026-06-02-monetization-review-findings.md (payment-rpc-owner-not-bound, P1)
-- 문제: SECURITY DEFINER 가 job_postings 의 jp_insert RLS(역할 체크) 를 우회하고, p_owner_id 를
--       auth.uid() 로 검증하지 않아 임의 authenticated 사용자가 타인 비용으로 결제·공고 위조 가능.
-- 사실: 생성 플로우는 항상 ownerId = caller(auth.uid) (useJobManagement → createJobPosting(input, user.uid))
--       이고 workspace 도 owner 자신 것에서 해결되므로(getDefaultWorkspaceIdForOwner), caller=owner 바인딩이
--       legit 플로우를 깨지 않는다. 협업자 비대칭(P0-2)은 취소/환불 경로에만 적용(생성 대리 없음).
--
-- 가드(본문 외 로직 변경 없음 — INSERT/cost/consume 본문은 현행 보존):
--   - service_role(백엔드, auth.uid()=NULL)은 신뢰 → 통과
--   - authenticated 는 employer/admin 역할이어야(jp_insert RLS 동치) + 본인(p_owner_id=auth.uid) 공고만
--     (admin 은 대리 생성 허용 — 기존 RLS 가 admin 역할에 임의 owner INSERT 허용한 것과 동치)
--   - payload.workspace_id 가 있으면 p_owner_id 소유 워크스페이스여야(타 워크스페이스 침투 차단)

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
    -- 역할 게이트: jp_insert RLS (admin|employer) 동치
    IF v_role NOT IN ('admin', 'employer') THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: role % cannot create job postings', v_role;
    END IF;
    -- owner 위조 차단: 본인 공고만 (admin 은 대리 생성 허용)
    IF v_role <> 'admin' AND v_caller <> p_owner_id THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: caller cannot create posting for another owner';
    END IF;
    -- 타 워크스페이스 침투 차단: payload.workspace_id 가 있으면 p_owner_id 소유여야
    v_payload_ws := NULLIF(p_posting_payload->>'workspace_id', '')::uuid;
    IF v_payload_ws IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.workspaces WHERE id = v_payload_ws AND owner_id = p_owner_id
       ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: workspace not owned by owner';
    END IF;
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
$function$;

-- 권한: 직접 호출은 authenticated(본문 가드가 인가) + service_role. anon 차단 유지.
REVOKE EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(uuid, jsonb, wallet_reason) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_job_posting_with_payment_atomically(uuid, jsonb, wallet_reason) TO authenticated, service_role;
