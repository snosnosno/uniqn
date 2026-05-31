-- ⚠️ DRAFT — NOT APPLIED TO PROD. 유료화(monetization flag) ON 이후 적용. Lane D.
--
-- 목적: 공고 기간 연장(extend) — 고정 비용 다이아 차감 + 근무일/만료일 p_extend_days 만큼
--   뒤로 밀고, 마감/만료/정원마감 상태면 active 로 재오픈.
--
-- 비용/멱등: consume_diamonds_atomically(owner, 5, 'consume_job_extend', posting_id, 'job_posting')
--   를 통해 5 다이아(하트 우선) 차감. consume 가 INSUFFICIENT_BALANCE 던지면 전체 롤백.
--   같은 트랜잭션 안에서 차감+연장이 atomic — 부분 적용 없음.
--
-- 날짜 연장 설계 결정(draft, 리뷰 시 재검토):
--   1) work_date / last_work_date: NULL 이 아니면 + p_extend_days 일.
--   2) work_dates[]: 배열의 각 원소를 + p_extend_days 일(전체 평행 이동). NULL/빈 배열은 무시.
--   3) fixed_config.expiresAt: 고정공고면 만료 timestamptz 를 + p_extend_days 일.
--   4) 상태: status IN ('closed','capacity_full') 이거나 closed_reason 이 만료 계열이면
--      active 로 재오픈하고 closed_at/closed_reason 클리어. cancelled 는 재오픈 금지.
--   → 어느 날짜 컬럼이 권위인지 스키마상 다중 소스라 "전부 평행 이동"을 택함. 실제 적용 전
--      도메인 확정(posting_type 별 단일 권위 컬럼) 후 정리 필요.
--
-- spec: docs/superpowers/specs (monetization Lane D). 적용 전 /review 필수.

CREATE OR REPLACE FUNCTION public.extend_job_posting(
  p_posting_id   uuid,
  p_owner_id     uuid,
  p_extend_days  integer DEFAULT 7
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_posting        public.job_postings%ROWTYPE;
  v_consume_result jsonb;
  v_extend_cost    constant integer := 5;
  v_interval       interval;
  v_reopened       boolean := false;
  v_new_work_dates text[];
  v_d              text;
  v_expires_at     timestamptz;
BEGIN
  -- 0) 입력 가드
  IF p_posting_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_POSTING_ID: cannot be NULL';
  END IF;
  IF p_owner_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_OWNER_ID: cannot be NULL';
  END IF;
  IF p_extend_days IS NULL OR p_extend_days <= 0 THEN
    RAISE EXCEPTION 'INVALID_EXTEND_DAYS: % must be positive', p_extend_days;
  END IF;

  v_interval := make_interval(days => p_extend_days);

  -- 1) 공고 잠금 + 소유자 검증
  SELECT * INTO v_posting
  FROM public.job_postings
  WHERE id = p_posting_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', p_posting_id;
  END IF;

  IF v_posting.owner_id IS DISTINCT FROM p_owner_id THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 본인 공고만 연장할 수 있습니다';
  END IF;

  -- cancelled 공고는 연장/재오픈 불가
  IF v_posting.status = 'cancelled' THEN
    RAISE EXCEPTION 'INVALID_STATE: 취소된 공고는 연장할 수 없습니다';
  END IF;

  -- 2) 고정 비용 다이아 차감 (실패 시 전체 트랜잭션 롤백)
  v_consume_result := public.consume_diamonds_atomically(
    p_owner_id,
    v_extend_cost,
    'consume_job_extend',
    p_posting_id,
    'job_posting'
  );

  -- 3) work_dates[] 각 원소 평행 이동
  IF v_posting.work_dates IS NOT NULL THEN
    v_new_work_dates := ARRAY[]::text[];
    FOREACH v_d IN ARRAY v_posting.work_dates LOOP
      v_new_work_dates := array_append(
        v_new_work_dates,
        ((v_d::date) + v_interval)::date::text
      );
    END LOOP;
  ELSE
    v_new_work_dates := v_posting.work_dates;
  END IF;

  -- 4) fixed_config.expiresAt 연장 (고정공고)
  v_expires_at := NULL;
  IF v_posting.fixed_config IS NOT NULL
     AND (v_posting.fixed_config ->> 'expiresAt') IS NOT NULL THEN
    v_expires_at := (v_posting.fixed_config ->> 'expiresAt')::timestamptz + v_interval;
  END IF;

  -- 5) 재오픈 여부 판단 (closed/capacity_full 또는 만료 계열)
  v_reopened := (
    v_posting.status IN ('closed', 'capacity_full')
    OR v_posting.closed_reason IN ('expired', 'expired_by_work_date')
  );

  -- 6) UPDATE: 날짜 평행 이동 + (필요 시) active 재오픈
  UPDATE public.job_postings
  SET
    work_date = CASE WHEN work_date IS NOT NULL
                     THEN (work_date::date + v_interval)::date::text
                     ELSE work_date END,
    last_work_date = CASE WHEN last_work_date IS NOT NULL
                          THEN (last_work_date::date + v_interval)::date::text
                          ELSE last_work_date END,
    work_dates = v_new_work_dates,
    fixed_config = CASE WHEN v_expires_at IS NOT NULL
                        THEN jsonb_set(fixed_config, '{expiresAt}', to_jsonb(v_expires_at))
                        ELSE fixed_config END,
    status = CASE WHEN v_reopened THEN 'active'::posting_status ELSE status END,
    closed_at = CASE WHEN v_reopened THEN NULL ELSE closed_at END,
    closed_reason = CASE WHEN v_reopened THEN NULL ELSE closed_reason END,
    updated_at = now()
  WHERE id = p_posting_id;

  RETURN jsonb_build_object(
    'success', true,
    'posting_id', p_posting_id,
    'extend_days', p_extend_days,
    'reopened', v_reopened,
    'diamonds_consumed', COALESCE((v_consume_result ->> 'diamond_consumed')::int, 0),
    'hearts_consumed', COALESCE((v_consume_result ->> 'heart_consumed')::int, 0)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.extend_job_posting(uuid, uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.extend_job_posting(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.extend_job_posting(uuid, uuid, integer) TO service_role;

COMMENT ON FUNCTION public.extend_job_posting IS
  '공고 기간 연장: 5다이아 차감(consume_diamonds_atomically) + 근무일/만료일 p_extend_days 평행 이동 + closed/capacity_full/만료 시 active 재오픈. SECURITY DEFINER, 소유자 검증. (DRAFT — Lane D 미적용)';
