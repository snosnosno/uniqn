---
area: decisions
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260807180000_work_log_slot_checkout_after_checkin.sql
  - uniqn-mobile/supabase/tests/work_log_slot_attendance_rpc.test.sql
  - PR#433
tags: [validation, rpc, settlement, worktime, audit]
---

# 결정: 서버 검증은 필드가 아니라 **관계**까지 봐야 한다

## 결론

`update_work_log_slot` 은 길이·XSS·형식·enum 을 전부 재현하면서 **순서만 안 봤다**(PR#433).
필드 하나하나는 유효한데 **필드 사이의 관계**(퇴근 ≥ 출근)가 무검증인 형태다.
검증 목록이 길수록 "다 봤다"는 착시가 생기지만, 목록에 없는 축은 그대로 뚫려 있다.

## 방치했을 때의 연쇄 (코드로 검증됨)

```
역전 저장 → status=checked_out 파생 → fn_settlement_amount 의 GREATEST(0, …) 가 음수를 접음
         → ₩0 정산 확정 + "지급액 0원" 알림 발송
```

**음수 방어가 오히려 사고를 완성시켰다.** `GREATEST(0, …)` 는 음수를 막는 안전장치처럼 보이지만,
잘못된 입력이 들어온 뒤에는 그 오류를 **정상 값으로 세탁**한다. 검증이 상류에 없으면
하류의 방어는 증상을 지우고 원인을 통과시킨다.

## 판정 규칙 3가지 (구현할 때 반복해서 틀리는 지점)

1. **병합 후 최종값으로 판정한다.** 부분 수정(patch)만 보고 판정하면 한쪽 필드만 바꾸는
   경로가 통째로 뚫린다 — 출근만 늦추는 요청은 patch 안에 퇴근이 없어서 무사통과한다.
2. **같음(`=`)도 거부한다.** 0분 근무는 유효한 입력이 아니다. `>` 가 아니라 `>=` 로 막을
   자리를 정확히 고를 것.
3. **한쪽이 NULL 이면 판정하지 않는다.** 아직 퇴근하지 않은 정상 상태를 실패로 만들면
   출근 자체가 막힌다. "값이 없다"와 "값이 틀렸다"는 다르다.

## 파급

`update_work_log_slot` 은 750줄 함수다. prod 적용은 **파일을 그대로 실어야** 한다 —
손으로 옮기면 주석 축약만으로 레포↔prod 정본이 갈라진다([[prod-parity-baseline]]).
2026-08-07 23:50 실측 기준 **prod 미적용** 상태.

## 연결

- 근무시간 단일 진실원: [[worktime-ssot]]
- 정본 분열 방지 규율: [[prod-parity-baseline]]
- 같은 컬럼의 다른 쓰기 경로: [[settlement-history-lost-update]]
- 검증이 있는데도 통과하는 계열: [[whitelist-silent-drop]]
