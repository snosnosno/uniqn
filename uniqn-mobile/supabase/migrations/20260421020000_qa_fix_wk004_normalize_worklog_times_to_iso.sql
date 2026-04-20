-- WK-004: work_logs.check_in_time / check_out_time 잔재 Firebase Timestamp 포맷 정리
-- 기존 row가 {"seconds":N,"nanoseconds":0} 형식(Firebase Timestamp 레거시)으로 저장돼 있던 경우
-- ISO string(jsonb)으로 통일.
-- (RPC `process_qr_checkin_atomically`는 이미 to_jsonb(ISO string) 패턴으로 기록 중.)
-- 컬럼 타입(jsonb)은 유지. 향후 timestamptz 전환은 별도 대형 PR에서 검토.

UPDATE public.work_logs
SET check_in_time = to_jsonb(
  to_char(
    to_timestamp((check_in_time ->> 'seconds')::bigint) AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
)
WHERE jsonb_typeof(check_in_time) = 'object'
  AND (check_in_time ? 'seconds');

UPDATE public.work_logs
SET check_out_time = to_jsonb(
  to_char(
    to_timestamp((check_out_time ->> 'seconds')::bigint) AT TIME ZONE 'UTC',
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
)
WHERE jsonb_typeof(check_out_time) = 'object'
  AND (check_out_time ? 'seconds');
