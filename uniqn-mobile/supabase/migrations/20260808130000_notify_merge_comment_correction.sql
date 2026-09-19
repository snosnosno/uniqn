-- 알림 병합 COMMENT 정정 — "저장 한 번 = 알림 한 통" 은 사실이 아니었다
--
-- 근거: 2026-08-07 머지 리뷰 MEDIUM #3 (docs/planning/2026-08-08-next-session-prompts.md B-3).
--
-- ── 무엇이 틀렸는가 ─────────────────────────────────────────────────────────
-- 20260806120000_notify_merge_time_change.sql 은 머리말(:12-13)과 COMMENT(:453)에서
-- **"저장 한 번 = 알림 한 통"** 을 불변식으로 선언했다. 그런데 그 마이그레이션의 병합은
-- `notify_on_work_log_update` **한 함수 안**에서만 일어난다.
--
-- `check_in_ts` / `check_out_ts` 가 같은 UPDATE 에 실리면
-- `notify_on_work_log_checkinout_update`(트리거 work_log_notify_checkinout_update,
-- 최신 정의는 20260807160000)가 **독립적으로 발화**한다. 그 함수의 게이트는
--   v_did_check_in  := OLD.check_in_ts  IS NULL AND NEW.check_in_ts  IS NOT NULL
--   v_did_check_out := OLD.check_out_ts IS NULL AND NEW.check_out_ts IS NOT NULL
-- 이고, 앞 함수가 무엇을 보냈는지 알지 못한다. 그래서 구인자가 시트에서 출퇴근을
-- **처음** 입력하며 시간까지 함께 고치면 한 번의 저장에 여러 통이 나간다.
--
-- ── 왜 동작이 아니라 선언을 고치는가 ────────────────────────────────────────
-- 그 통들은 **같은 사실의 중복이 아니다.** 각각 다른 사건을 알린다:
--   · 근무시간이 바뀌었다        (notify_on_work_log_update, Case 2 — 예정 변경까지 병합됨)
--   · 출근 처리됐다              (checkinout)
--   · 퇴근 처리됐다              (checkinout)
--   · 근무 평가를 남겨 달라       (checkinout, 퇴근 시 스태프에게)
-- 이걸 한 통으로 접으면 카테고리(출퇴근 vs 일정변경)·링크·푸시 게이트가 서로 다른
-- 알림들을 하나에 욱여넣게 되고, 수신자별 라우팅 판별자가 소멸한다 —
-- 20260807160000 이 **되돌린 바로 그 회귀**(타입 병합으로 카테고리 탭에서 증발)와 같은 모양이다.
--
-- 그래서 실제로 지켜지고 있는 계약은 "저장 한 번 = 알림 한 통"이 아니라
-- **"같은 사실을 두 번 말하지 않는다"** 이고, 20260806120000 의 병합이 보장하는 것도 그것이다.
-- COMMENT 를 그 사실에 맞춘다.
--
-- ⚠️ 알림 **통수 자체**를 줄이는 것은 별개 판단이다(알림 계약 P2 #397 의 읽기 쪽 —
--    카테고리 탭·그룹핑·푸시 게이트까지 함께 봐야 한다). 이 마이그레이션은 다루지 않는다.
--
-- 방식: COMMENT 갱신만. 함수 본문·트리거·권한은 **손대지 않는다**.
-- 파리티: 함수 수·정책 수 증감 0.

COMMENT ON FUNCTION public.notify_on_work_log_update() IS
  'work_logs UPDATE 시 6가지 알림 통합 처리: 취소 / 이력 기반 근무시간 변경 / 출근 예정 시각(time_slot) 변경 / 정산 완료 / 지급 완료 되돌리기 / 음수 정산 admin broadcast. '
  '이력 기반 변경과 출근 예정 시각 변경이 같은 UPDATE 에서 동시에 성립하면 앞의 한 통에 병합해 싣고 뒤는 침묵한다(같은 사실을 두 번 말하지 않는다). '
  '⚠️ 이것은 이 함수 안에서만 성립한다 — 같은 UPDATE 가 check_in_ts/check_out_ts 도 바꾸면 notify_on_work_log_checkinout_update 가 독립 발화하므로 한 번의 저장이 여러 통이 될 수 있다. 그 통들은 서로 다른 사실(시간 변경 / 출근 / 퇴근 / 평가 요청)이라 중복이 아니다.';
