-- 근무표 안전 계약: 배치 해제 감사 + owner-only 정산 확정
--
-- ⚠️ 정산 완료 잠금을 이 마이그에 **두지 않는다**(2026-09-12 결정).
-- 초안은 `enforce_settled_work_log_lock()` + `tr_settled_work_log_lock` 으로 완료건의
-- 거의 모든 컬럼을 잠그고 "payroll_status 를 pending 으로 되돌린 뒤 수정"을 우회로 규정했다.
-- 그러나 그 경로는 우회가 아니라 **기존 설계의 정식 정정 경로**다 —
-- `protect_work_log_payroll_columns()`(20260813100000) 가 이미 완료건 custom_* 잠금·
-- 노쇼 전환 차단·staff 차단을 담당하며, 그 에러 메시지가
-- "정산을 되돌린 후 다시 시도하세요" 라고 직접 안내한다.
-- 초안 락은 그 위에 중복으로 얹히면서 기존 계약 3건을 깼다(CI pgTAP 9파일 red):
--   · "잠금은 실적 축 전용" — 역할·역할명·메모는 열려 있어야 한다
--   · "2단계 탈출 경로 유지" — 정산을 되돌리면 노쇼 전환이 열린다
--   · "정산을 함께 되돌리는 한 문장 UPDATE 는 통과" (범위 축소 절)
-- 운영상 정산 오류를 고칠 수단을 없애는 쪽이 위험이 크다고 판단해 락은 빼고,
-- 새로 얹는 보호는 owner-only 검사 하나로 좁힌다.
DROP TRIGGER IF EXISTS tr_settled_work_log_lock ON public.work_logs;
DROP FUNCTION IF EXISTS public.enforce_settled_work_log_lock();

CREATE TABLE IF NOT EXISTS public.work_schedule_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_log_id uuid NOT NULL REFERENCES public.work_logs(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('assignment_released')),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 2 AND 200),
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_schedule_audit_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_work_schedule_audit_events_work_log_created
  ON public.work_schedule_audit_events(work_log_id, created_at DESC);

CREATE POLICY work_schedule_audit_events_select_participant
  ON public.work_schedule_audit_events FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.work_logs wl
      WHERE wl.id = work_log_id
        AND (
          wl.staff_id = auth.uid()
          OR wl.owner_id = auth.uid()
          OR public.is_workspace_member(
            (SELECT jp.workspace_id FROM public.job_postings jp WHERE jp.id = wl.job_posting_id),
            auth.uid()
          )
        )
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.work_schedule_audit_events FROM anon, authenticated;
GRANT SELECT ON public.work_schedule_audit_events TO authenticated;

CREATE OR REPLACE FUNCTION public.release_scheduled_assignment(
  p_work_log_id uuid,
  p_reason text
) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER
  SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_wl public.work_logs%ROWTYPE;
  v_job public.job_postings%ROWTYPE;
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_now timestamptz := now();
  v_remaining integer;
  v_start_at timestamptz;
  v_start_time text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 인증이 필요합니다';
  END IF;
  IF char_length(v_reason) NOT BETWEEN 2 AND 200
     OR v_reason ~* '<[^>]*>|javascript:|data:text/html' THEN
    RAISE EXCEPTION 'INVALID_REASON: 해제 사유를 2~200자로 입력해주세요';
  END IF;

  SELECT * INTO v_wl FROM public.work_logs WHERE id = p_work_log_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'WORK_LOG_NOT_FOUND: %', p_work_log_id;
  END IF;
  IF v_wl.application_id IS NOT NULL THEN
    RAISE EXCEPTION 'NOT_DIRECT_STAFF: 지원서 연동 스태프는 확정 취소로 처리해야 합니다';
  END IF;
  IF v_wl.status <> 'scheduled' THEN
    RAISE EXCEPTION 'INVALID_STATUS: 출근 전 확정 배치만 해제할 수 있습니다';
  END IF;
  IF COALESCE(v_wl.payroll_status = 'completed', false) THEN
    RAISE EXCEPTION 'ALREADY_SETTLED: 정산 완료 근무는 해제할 수 없습니다';
  END IF;

  SELECT * INTO v_job FROM public.job_postings WHERE id = v_wl.job_posting_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'POSTING_NOT_FOUND: %', v_wl.job_posting_id;
  END IF;
  -- workspace role가 editor 하나로만 배치 해제 capability를 표현하지 못하므로,
  -- 별도 권한 모델이 생기기 전에는 owner-only로 fail-closed 한다.
  IF NOT COALESCE(v_job.owner_id = v_actor, false) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: 배치 해제는 소유자만 처리할 수 있습니다';
  END IF;

  IF v_wl.date::date < (v_now AT TIME ZONE 'Asia/Seoul')::date THEN
    RAISE EXCEPTION 'SHIFT_ALREADY_STARTED: 예정 출근 이후에는 근태 정정으로 처리해주세요';
  END IF;
  v_start_time := public._posting_slot_key(v_wl.time_slot);
  IF v_wl.date::date = (v_now AT TIME ZONE 'Asia/Seoul')::date
     AND v_start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    v_start_at := (v_wl.date::date + v_start_time::time) AT TIME ZONE 'Asia/Seoul';
    IF v_start_at <= v_now THEN
      RAISE EXCEPTION 'SHIFT_ALREADY_STARTED: 예정 출근 이후에는 근태 정정으로 처리해주세요';
    END IF;
  END IF;

  UPDATE public.work_logs SET status = 'cancelled', updated_at = v_now
  WHERE id = p_work_log_id;

  INSERT INTO public.work_schedule_audit_events(
    work_log_id, event_type, actor_id, reason, before_data, after_data
  ) VALUES (
    p_work_log_id,
    'assignment_released',
    v_actor,
    v_reason,
    jsonb_build_object('status', v_wl.status, 'date', v_wl.date, 'timeSlot', v_wl.time_slot),
    jsonb_build_object('status', 'cancelled')
  );

  SELECT count(*) INTO v_remaining FROM public.work_logs wl
  WHERE wl.job_posting_id = v_wl.job_posting_id
    AND wl.staff_id = v_wl.staff_id
    AND wl.status NOT IN ('cancelled', 'no_show');

  UPDATE public.job_postings SET status = 'active'::posting_status, updated_at = v_now
  WHERE id = v_wl.job_posting_id
    AND filled_positions < total_positions
    AND status = 'closed'
    AND COALESCE(closed_reason, '') NOT IN ('expired', 'expired_by_work_date');

  RETURN jsonb_build_object(
    'success', true,
    'workLogId', p_work_log_id,
    'staffRemoved', v_remaining = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.release_scheduled_assignment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.release_scheduled_assignment(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.remove_direct_staff(uuid) FROM authenticated;

-- 정산 확정과 금액/일자 변경은 근무 소유자만 가능하다.
-- global admin은 일반 RPC를 우회하지 않고 후속 감사 정정 경로를 사용한다.
CREATE OR REPLACE FUNCTION public.enforce_work_log_payroll_owner()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  -- 마이그레이션/서버 내부 작업은 JWT 사용자가 없다. 클라이언트 요청은
  -- SECURITY DEFINER RPC 안에서도 auth.uid()가 유지되므로 이 값으로 구분한다.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.payroll_status = 'completed'
     AND COALESCE(NEW.payroll_amount, 0) = 0
     AND char_length(btrim(COALESCE(NEW.payroll_notes, ''))) < 2 THEN
    RAISE EXCEPTION 'ZERO_SETTLEMENT_REASON_REQUIRED: 0원 정산은 사유가 필요합니다';
  END IF;
  IF (
    NEW.payroll_status IS DISTINCT FROM OLD.payroll_status
    OR NEW.payroll_amount IS DISTINCT FROM OLD.payroll_amount
    OR NEW.payroll_date IS DISTINCT FROM OLD.payroll_date
    OR NEW.payroll_notes IS DISTINCT FROM OLD.payroll_notes
  ) AND NOT (
    COALESCE(OLD.owner_id = auth.uid(), false)
    OR EXISTS (
      SELECT 1 FROM public.job_postings jp
      WHERE jp.id = OLD.job_posting_id AND jp.owner_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'PAYROLL_OWNER_ONLY: 정산과 지급 완료는 소유자만 처리할 수 있습니다';
  END IF;
  RETURN NEW;
END;
$$;

-- 트리거 이름이 `zz_` 인 이유: work_logs 의 BEFORE UPDATE 트리거는 이름순으로 실행되고,
-- 기존 `tr_work_logs_pin_payroll`(→ `WORK_LOG_PAYROLL_RPC_ONLY`)·
-- `protect_work_log_payroll`(→ 42501) 이 "payroll 직접 UPDATE 는 RPC 전용" 계약을 지킨다.
-- `tr_work_log_payroll_owner` 로 두면 `tr_work_log_` < `tr_work_logs_` 라 이 트리거가 먼저
-- 발화해 기존 에러 계약을 가로챈다(pgTAP `work_logs_payroll_pin` 3 이 그걸 잡아낸다).
-- owner 검사는 기존 차단을 통과한 경로(= 정산 RPC 내부)에만 추가로 걸려야 하므로 뒤로 보낸다.
DROP TRIGGER IF EXISTS tr_work_log_payroll_owner ON public.work_logs;
DROP TRIGGER IF EXISTS zz_work_log_payroll_owner ON public.work_logs;
CREATE TRIGGER zz_work_log_payroll_owner
  BEFORE UPDATE OF payroll_status, payroll_amount, payroll_date, payroll_notes
  ON public.work_logs FOR EACH ROW
  EXECUTE FUNCTION public.enforce_work_log_payroll_owner();

REVOKE ALL ON FUNCTION public.enforce_work_log_payroll_owner() FROM PUBLIC, anon, authenticated;
