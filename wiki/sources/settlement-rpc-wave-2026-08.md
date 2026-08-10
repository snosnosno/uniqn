---
area: sources
updated: 2026-08-09
status: current
sources:
  - uniqn-mobile/app/(employer)/venue-settlements.tsx
  - uniqn-mobile/src/components/employer/settlement/SettlementList.tsx
  - uniqn-mobile/src/components/employer/settlement/GroupedSettlementCard.tsx
  - uniqn-mobile/src/repositories/supabase/SettlementRepository.ts
  - uniqn-mobile/src/repositories/supabase/WorkLogRepositoryTransactions.ts
  - PR#387
  - PR#388
  - PR#393
  - PR#400
  - PR#402
  - PR#420
  - PR#448
tags: [settlement, rpc, payroll, trigger, pgtap]
---

# 소스: 정산 RPC 화 웨이브 (PR#387·#388·#393·#400·#402·#420)

## 편도 문을 만들지 마라 (PR#387→#388)

정산 2단 축소와 지점 정산 확정을 배선하면서 **"지급 완료" 로 가는 문만 만들고
되돌아오는 문을 안 만들었다**. 취소 진입점이 없으니 오조작이 곧 확정이 된다.
후속 PR#388 이 취소 진입점 + 게이트 status 축 SSOT 를 얹어 닫았다.

> 🔑 상태를 앞으로 미는 액션을 만들 때는 **되돌리는 액션이 있는지** 같은 PR 에서 확인한다.
> 금전 상태는 특히 그렇다 — 되돌릴 수 없으면 사용자는 액션 자체를 두려워하게 된다.

## 판정 복제는 축이 갈라지는 첫 징후 (PR#393)

선택·집계 판정이 **2곳에 복제**돼 있었다. 복제 자체보다 위험한 건, 한쪽만 고쳐질 때
"선택된 것"과 "집계된 것"이 조용히 달라진다는 점이다. 렌더 가드를 신설해 고정했다.

### ✅ M11(축 통일) 종료 — PR#448 `e9ec81aad` (2026-08-08)

`payroll_status` 의 `'failed'` 축을 `!== COMPLETED` 로 통일했다. 원장이 지목한 4곳 외
**5번째를 찾았다** — `SettlementList:171` 의 **필터 탭 카운트**도 3값 버그라 탭 합계가
'전체'와 안 맞았다(1+0≠2). 이 어긋난 합계를 **회귀 관측점**으로 썼다.

`FilterStatus` 타입도 `'all'|PayrollStatus` → `'all'|SettlementDisplayStatus` 로 좁혔다
— **고를 수 없는 값이 축에 남아 있던 것**이 원인의 절반이다.

> 🔑 "그 상태는 휴면이다"는 **반쪽만 참**이었다. 서버 RPC 가 여전히 `'failed'` 를 받는다
> (라이브 정의 = `20260802161000:301`). 휴면 판정을 할 때 **클라만 보고 결론내지 말 것** —
> 그리고 함수 정의를 인용할 땐 `grep -l ... | tail -1` 로 **최신 파일**을 짚어라
> ([[secdef-replace-search-path-loss]] 와 같은 함정: 이때 참조된 `...130000:70` 은 구파일이었다).

검증: Red-Green(5 failed → 17/17) + 31 suites / 377 tests.

## 쓰기 채널을 좁히면 기존 테스트가 깨진다 (PR#420)

`work_logs.payroll_*` 컬럼을 **RPC 전용**으로 고정해 구인자의 직접 UPDATE 우회를 차단했다
(`WorkLogRepositoryTransactions.ts` 77줄 삭제). 트리거로 채널을 좁히는 순간
**기존 pgTAP 이 깨진다** — 테스트는 예전 방식(직접 UPDATE)으로 픽스처를 만들고 있었기 때문이다.

> 🚨 트리거·정책으로 쓰기 채널을 좁히는 작업은 착수 전 `supabase/tests/` 를 **전수 grep** 한다.
> 실패를 보고 나서 고치면, 그 실패가 "테스트 결함"인지 "차단이 과했는지" 구분이 어려워진다.

prod 기록명 `work_logs_payroll_direct_write_block`(레포 `20260805120000`).

## 서버로 옮긴 것들 (PR#400·#402)

- **금액 계산기 서버 이식**(PR#402) — 클라와 서버가 각자 계산하면 반올림 한 자리에서 갈라진다.
  파리티 테스트(`settlementAmountParity.test.ts`)가 두 구현의 등가성을 고정한다.
- **신원 컬럼 고정 트리거 + `time_slot` CHECK + 정산 상태 RPC 화**(PR#400) —
  값의 출처를 클라가 못 정하게 만드는 방향. prod 기록명 `20260801212753`·`212843`.

같은 컬럼의 **마지막 read-modify-write 경로**는 PR#436 이 닫았다 → [[settlement-history-lost-update]].

## 연결

- 마지막 경로와 시그니처 방어: [[settlement-history-lost-update]]
- 쓰기 경로 함정 종합: [[supabase-write-pitfalls]]
- pgTAP 하네스가 깨지는 다른 형태: [[wallet-pgtap-caller-binding]]
- 레이어 경계: [[layers]]
