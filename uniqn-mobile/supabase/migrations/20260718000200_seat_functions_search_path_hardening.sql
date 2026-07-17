-- ============================================================
-- 좌석 기준 통일 — 신규 함수 search_path 고정 (advisor WARN 해소)
-- 선행: 20260718000000 (해당 함수 정의)
--
-- prod advisor(security) function_search_path_mutable WARN 2건 해소:
--   · public._total_positions_from_schedule(jsonb)  (LANGUAGE sql IMMUTABLE, INVOKER)
--   · public.fn_recalc_total_and_capacity()          (LANGUAGE plpgsql, INVOKER 트리거)
-- 둘 다 SECURITY DEFINER 가 아니라 권한상승 위험은 없으나, 프로젝트 secdef-hardening
-- 관례(신규 함수 search_path 명시)에 맞춰 role-mutable search_path 를 고정한다.
-- (다른 신규 함수 fn_sync_filled_positions_seat/fn_work_logs_pin_posting_id 는 이미 SET 됨.)
-- ============================================================

ALTER FUNCTION public._total_positions_from_schedule(jsonb) SET search_path TO 'public', 'pg_temp';
ALTER FUNCTION public.fn_recalc_total_and_capacity()        SET search_path TO 'public', 'pg_temp';
