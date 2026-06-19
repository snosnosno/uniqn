-- ============================================================
-- M3: cancel_job_posting_with_refund_atomically — 취소+환불 단일 원자 RPC (P1-2 봉쇄)
--
-- 결함(P1): 클라이언트가 status UPDATE(durable) 후 별개 refund RPC를 best-effort 호출하고
--           실패를 swallow → "취소됐는데 환불 미적립"이 조용히 발생(사용자 알림도 없음).
--
-- 수정: status update + 환불을 **동일 트랜잭션 단일 RPC**로 통합.
--   · 인가: service_role(NULL caller) / owner 본인 / JPC 협업자 (refund RPC와 동일 가드).
--   · 환불 실패(no_consumption_found·idempotent 제외) 시 RAISE → status 변경까지 전체 롤백.
--   · 멱등: 이미 cancelled면 환불 멱등 호출(부분실패 self-heal)만 보장 후 반환.
-- 패턴 모델: create_job_posting_with_payment_atomically (생성 단일 RPC 원자성).
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancel_job_posting_with_refund_atomically(
  p_posting_id uuid,
  p_owner_id   uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller     UUID := auth.uid();
  v_post_owner UUID;
  v_status     public.posting_status;
  v_refund     JSONB;
BEGIN
  IF p_posting_id IS NULL OR p_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_args');
  END IF;

  -- posting 존재 + owner 일치
  SELECT owner_id, status INTO v_post_owner, v_status
    FROM public.job_postings WHERE id = p_posting_id;
  IF v_post_owner IS NULL OR v_post_owner <> p_owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- caller 권한: service_role(NULL) / owner 본인 / JPC 협업자
  IF v_caller IS NOT NULL
     AND v_caller <> p_owner_id
     AND NOT public.is_posting_collaborator(p_posting_id, v_caller) THEN
    RETURN jsonb_build_object('success', false, 'error', 'unauthorized');
  END IF;

  -- 멱등: 이미 취소된 공고 → 환불 멱등 호출(부분실패 self-heal)만 보장
  IF v_status = 'cancelled' THEN
    v_refund := public.refund_job_cancellation_atomically(p_posting_id, p_owner_id);
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'refund', v_refund);
  END IF;

  -- status update + 환불 (동일 트랜잭션)
  UPDATE public.job_postings
     SET status = 'cancelled', updated_at = now()
   WHERE id = p_posting_id;

  v_refund := public.refund_job_cancellation_atomically(p_posting_id, p_owner_id);

  -- 환불이 실제 결함으로 실패하면 전체 롤백 (no_consumption_found=무료공고는 정상 취소)
  IF COALESCE((v_refund->>'success')::boolean, false) IS NOT TRUE
     AND COALESCE(v_refund->>'error', '') <> 'no_consumption_found' THEN
    RAISE EXCEPTION 'REFUND_FAILED: %', COALESCE(v_refund->>'error', 'unknown');
  END IF;

  RETURN jsonb_build_object('success', true, 'refund', v_refund);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancel_job_posting_with_refund_atomically(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_job_posting_with_refund_atomically(uuid, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.cancel_job_posting_with_refund_atomically IS
  '공고 취소(status=cancelled) + 환불을 단일 트랜잭션 원자화(M3). 환불 실패 시 RAISE로 취소까지 롤백 → 부분실패 swallow 제거. 인가=owner/JPC/service_role.';
