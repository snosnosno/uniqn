---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260803120000_time_slot_sentinel_unification.sql
  - uniqn-mobile/supabase/migrations/20260804140000_capacity_zero_fail_closed.sql
  - uniqn-mobile/supabase/tests/capacity_zero_fail_closed.test.sql
  - uniqn-mobile/src/components/employer/applicants/ConfirmedStaffCard.tsx
  - PR#409
  - PR#410
  - PR#412
  - PR#417
  - PR#424
tags: [worktime, time-slot, capacity, rpc, sentinel]
---

# 소스: 시간 모델 재설계 웨이브 R0~R1 + 3-C (PR#409·#410·#412·#417·#424)

## 핵심 — '미정'을 표현하는 방법이 여러 개면 그건 우회로가 된다

시간 '미정'을 나타내는 키가 **분열돼 있었다**. 같은 뜻인데 표기가 갈리니 정원 계산이
서로 다른 버킷을 세었고, 결과적으로 **고정공고 정원 우회**가 열려 있었다(PR#409 R0).

> 🔑 센티넬 값(미정·전체·기본)은 **DB 한 곳에서 정본화**하고, 클라이언트는 표현만 한다.
> 표기가 둘이면 "같은 값인지"를 판정하는 코드가 지점마다 생기고, 그 지점 중 하나만 틀려도
> 조용히 뚫린다. R1(PR#410)이 판정·키·쓰기를 한 표현으로 수렴시킨 이유다.

prod 기록명 `20260803025714`(레포 `20260803120000_time_slot_sentinel_unification.sql`).
⚠️ prod `time_slot` 레거시 값은 **하이픈 양쪽에 공백**이 있다 — 정규화할 때 이 형태를 반드시 포함할 것.

## 정원 0 — "미상"과 "없음"은 다르다 (PR#417)

`v_capacity = 0` 을 **"정원 미상 → 통과"** 로 처리하고 있었다. 올바른 해석은
**"자리 없음 → 거부"** 다. 0 을 falsy 로 다루면 "값이 없다"와 "값이 0이다"가 합쳐진다 —
[[error-vs-empty-state]] 와 같은 계열의 착오가 숫자 축에서 일어난 형태다.

원인 3종 중 **A·C 만 닫았고 B(축 미매칭)는 의도적으로 열어 뒀다.** 판단이 남아 있는 상태이므로
"정원 0 문제는 해결됐다"고 말하면 안 된다.

## 편집기 3곳을 한 시트·한 RPC 로 수렴 (PR#424)

근무 시간 편집 진입점이 3개였고 각자 다른 쓰기 경로를 갖고 있었다. 하나의 시트 +
하나의 RPC 로 수렴시켰다(`RoleChangeModal.tsx` 339줄 삭제 등).

🔑 `payrollStatus` 는 **3값**이다. 불리언으로 접으면 중간 상태가 사라진다.

prod 기록명 `20260806233224`·`233316`·`233616`·`234002`·`234415`(레포 접두사와 다름 — 재적용 금지).

## 연결

- 근무시간 표시 SSOT: [[worktime-ssot]]
- 자정 넘는 근무의 같은 계열: [[overnight-worktime-ssot]]
- 쓰기 경로를 RPC 로 좁히는 원칙: [[supabase-write-pitfalls]]
- 인원 표시 계약(정원/충원 축): [[headcount-daily-basis]]
- 이 웨이브의 서버측 검증 후속: [[server-validation-completeness]]
