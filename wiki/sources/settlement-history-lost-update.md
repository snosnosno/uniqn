---
area: sources
updated: 2026-08-08
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260807190000_update_work_log_custom_settlement_rpc.sql
  - uniqn-mobile/src/repositories/supabase/SettlementRepository.ts
  - uniqn-mobile/supabase/tests/settlement_custom_rpc.test.sql
  - PR#436
tags: [settlement, rpc, concurrency, lost-update, audit]
---

# 소스: 정산 수정 이력 Lost Update — 마지막 쓰기 경로를 RPC 로 닫다 (PR#436)

## 무엇이 문제였나

개인 정산 금액 수정 저장이 **클라이언트 read-modify-write** 였다:
`select(work_log)` → `select(posting)` → 클라에서 이력 배열 append → `update` 통째 덮어쓰기.

잠금이 없어 두 요청이 겹치면:

```
T1 read [A] · T2 read [A] · T1 write [A,B] · T2 write [A,C]   ← B 가 사라진다
```

**에러는 나지 않는다.** 앞 이력 항목이 조용히 지워질 뿐이다. 정산 수정 이력은 금액 분쟁 시
"누가 언제 얼마로 바꿨나"의 유일한 근거이므로, 무음 유실은 **금전 사고의 증거를 지우는 것**과 같다.

## 왜 이 하나만 남아 있었나

같은 컬럼에 쓰는 형제 경로 둘은 이미 닫혀 있었다 — `update_work_log_slot`(PR#424) ·
`set_work_log_payroll_status`(PR#402). **세 경로 중 이 하나만** 잠금 없이 남아 있었다.

> 🔑 다중 쓰기를 RPC 로 옮기는 작업은 경로 단위가 아니라 **컬럼 단위로 전수**해야 한다.
> "이 기능은 RPC 화됐다"는 그 컬럼에 쓰는 모든 경로가 닫혔다는 뜻이 아니다.

## 해법에서 재사용할 부분

신규 RPC `update_work_log_custom_settlement` 는 `FOR UPDATE` 로 행을 잡고 append 를
**UPDATE 문 안에서** 수행한다. 진짜 핵심은 그 다음이다:

> **시그니처에 이력 배열 인자가 없다.** 클라가 읽은 배열을 되돌려보낼 방법 자체가 사라졌다.
> 구조가 회귀 방어의 본체이므로, pgTAP 단언 하나가 **시그니처를 고정**한다.

방어를 "검사"가 아니라 **불가능한 형태**로 만든 사례다. 검사는 우회되지만 없는 인자는 못 보낸다.

함께 서버로 넘어간 것:

- **소유권 판정** — 형제 RPC 3종과 글자 그대로 같은 술어. 갈라지면 한쪽이 넓어져도 아무도 모른다
- **정산 완료 동결** — `AlreadySettledError` → 서버 `ALREADY_SETTLED`. 트리거
  `protect_work_log_payroll_columns` 도 42501 로 막지만 그건 **내부 문구가 그대로 노출**된다
- **이력 오염 폴백** — 클라 zod `safeParse` → 서버 `jsonb_typeof`
- **`modifiedBy`/`modifiedAt` 재판정** — 클라가 보낸 값을 신뢰하지 않는다

## 남은 것

`20260807190000` 은 **prod 미적용**(2026-08-07 23:50 `list_migrations` 실측).
같은 프리픽스를 두고 [[migration-timestamp-collision]] 3회차가 났다.

## 연결

- 다중 쓰기=RPC 원칙과 그 함정들: [[supabase-write-pitfalls]]
- 레이어 경계(Presentation→Hooks→Service→Repository): [[layers]]
- 같은 "무음 유실" 계열: [[whitelist-silent-drop]]
- 프리픽스 충돌 3회차: [[migration-timestamp-collision]]
