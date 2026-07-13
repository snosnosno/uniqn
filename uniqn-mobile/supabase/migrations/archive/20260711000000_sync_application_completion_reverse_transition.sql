-- 노쇼 취소(M2) 지원: 지원서 완료 동기화 트리거에 역전이 추가
--
-- 배경: fn_sync_application_completion 은 work_logs 전건이 종결 상태
--       (checked_out/completed/no_show)가 되면 applications 를
--       confirmed→completed 로 전이시키는 단방향 로직만 있어,
--       노쇼 취소·상태 정정으로 종결이 풀려도 지원서가 completed 에 갇힌다.
-- 조치: 전건 종결이 아니게 되면 completed→confirmed 역전이를 추가한다.
--       클라이언트는 work_logs 단일 UPDATE 만 수행하면 지원서 상태가
--       같은 트랜잭션 안에서 원자적으로 정합된다(다중 문서 클라 쓰기 불필요).
--
-- 안전성(prod 실측 완료, 2026-07-11):
--   - fn_update_job_posting_stats: confirmed/completed 모두 filled 집합
--     → completed→confirmed 는 filled_positions 불변, stats 델타는 원 전이와
--     대칭(totalApplicants/confirmedApplicants +1 ↔ 원 전이 시 -1)이라 드리프트 없음
--   - notify_on_application_update: '지원 확정' 알림은 OLD.status='applied' 한정
--     → completed→confirmed 역전이는 어떤 알림도 발화하지 않음
CREATE OR REPLACE FUNCTION public.fn_sync_application_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_application_id uuid;
  v_total_logs int;
  v_completed_logs int;
BEGIN
  -- work_log의 application_id로 연관 지원서 찾기
  v_application_id := NEW.application_id;
  IF v_application_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 해당 지원서의 모든 work_log 상태 확인
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('checked_out', 'completed', 'no_show'))
  INTO v_total_logs, v_completed_logs
  FROM public.work_logs
  WHERE application_id = v_application_id;

  IF v_total_logs > 0 AND v_total_logs = v_completed_logs THEN
    -- 모든 work_log가 종결 상태면 지원서를 completed로
    UPDATE public.applications
    SET status = 'completed', updated_at = now()
    WHERE id = v_application_id AND status = 'confirmed';
  ELSIF v_total_logs > 0 THEN
    -- 역전이: 일부 종결이 해제(노쇼 취소·상태 정정)되면 completed 지원서를 confirmed로 복구
    UPDATE public.applications
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_application_id AND status = 'completed';
  END IF;

  RETURN NEW;
END;
$$;
