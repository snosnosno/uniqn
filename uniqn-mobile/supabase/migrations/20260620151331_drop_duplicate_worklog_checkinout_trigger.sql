-- 출퇴근/평가 알림 중복 발송 회귀 해소
--
-- 증상: 출근 확인·퇴근 확인·스태프 출근·평가 요청 알림이 각각 정확히 2번씩 발송됨.
--
-- 근본 원인: work_logs UPDATE에 대해 동일한 함수 notify_on_work_log_checkinout_update()
--   를 호출하는 트리거가 두 개 공존.
--     1) work_log_notify_checkinout_update  — 구버전(20260417050000), AFTER UPDATE(전체)
--     2) tr_notify_work_log_checkinout       — 신버전(20260421190000), AFTER UPDATE OF check_in_ts, check_out_ts
--   20260421190000에서 함수를 CREATE OR REPLACE 하면서 신규 트리거를 추가했으나
--   구버전 트리거를 DROP하지 않아, 한 번의 출퇴근 UPDATE가 함수를 2회 실행 → 알림 2배 INSERT.
--
-- 수정: 구버전 트리거를 제거하고, 더 정밀한 신버전 트리거(tr_notify_work_log_checkinout)만 유지.
--   함수 본문은 그대로 유지(두 트리거가 같은 함수를 가리켰으므로 동작 동일, 발송 횟수만 1배로 정상화).
--
-- 멱등: DROP TRIGGER IF EXISTS — 이미 제거된 환경(로컬/재적용)에서도 안전.

DROP TRIGGER IF EXISTS work_log_notify_checkinout_update ON public.work_logs;
