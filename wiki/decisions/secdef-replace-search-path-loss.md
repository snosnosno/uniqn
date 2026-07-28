---
area: decisions
updated: 2026-07-28
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260727180000_cancel_rpc_rebase_on_seat_basis.sql
  - uniqn-mobile/supabase/migrations/20260719070500_rate_limit_insert_atomic.sql
  - uniqn-mobile/supabase/migrations/20260711100000_secdef_pg_temp_batch_and_overload_drop.sql
  - uniqn-mobile/supabase/migrations/20260719061931_nickname_search_rate_limit.sql
  - uniqn-mobile/supabase/tests/parity_baseline_guard.test.sql
  - uniqn-mobile/supabase/tests/weekly_grid_security_regression.test.sql
  - PR#273
  - PR#360
  - memory/project_nickname_search_unification_20260718
tags: [secdef, postgres, search-path, volatility, pgtap, migration, regression, rebase]
---

# 결정: 기존 함수를 `CREATE OR REPLACE` 할 때 조용히 잃는 것들

**한 줄:** `CREATE OR REPLACE FUNCTION`은 **DDL에 안 적은 함수 속성을 이전 값으로 물려받지 않는다** — `ALTER FUNCTION … SET search_path`로 나중에 보정해둔 설정과 volatility가 통째로 원본형으로 되돌아간다. 그래서 남의 함수를 재정의하기 전에 **현재 `proconfig`/`provolatile`를 실측**해 DDL에 명시적으로 다시 적어야 한다. 신규 SECDEF를 **작성할 때**의 3규칙은 [[secdef-hardening]], 이 페이지는 **재정의할 때**의 회귀 클래스다.

## 실증 — `check_rate_limit` 재정의가 pg_temp 일괄 보정을 지웠다

1. `20260711100000_secdef_pg_temp_batch_and_overload_drop.sql`이 SECDEF 함수 62종에 `pg_temp`를 **일괄 보정**했다(temp-table shadowing 방어).
2. PR#273이 rate limit 최초 INSERT 레이스를 고치려고 `check_rate_limit`을 **baseline 원본 형태(`pg_catalog, public`)로** `CREATE OR REPLACE` 했다.
3. 그 보정이 조용히 유실됐다. 예외도, 경고도 없다 — 함수는 정상 동작한다.
4. **prod에 적용한 뒤에** CI가 검거했다: `parity_baseline_guard.test.sql:73-83`의 7번 단언 "SECDEF `search_path` `pg_temp` 누락 함수 0"이 red.
5. prod는 `ALTER FUNCTION … SET search_path`로 복구, repo 파일은 DDL에 `pg_temp`를 박고 **주석으로 봉인**했다(`20260719070500_rate_limit_insert_atomic.sql:31-34` — "실제 발생 → 이 주석으로 봉인"). 코드로 검증됨.

### 규칙
- 기존 SECDEF 함수를 REPLACE하기 전에 `SELECT proconfig, provolatile FROM pg_proc WHERE oid = '…'::regprocedure` **실측** → DDL에 그대로 재기입.
- 특히 **일괄 보정 마이그레이션의 대상 함수**(여기선 62종)는 baseline 원본 DDL을 복붙하면 100% 회귀한다. baseline은 보정 **이전** 상태이기 때문이다([[prod-parity-baseline]]).
- 이 회귀는 런타임 증상이 없다 → **가드가 유일한 탐지 수단**. parity 가드 없이 prod에 나갔으면 다음 감사 때까지 몰랐을 것.

## 확장 (2026-07-28, PR#360) — 재정의의 **베이스는 "가장 최근 정의"여야 한다**

위 절은 "DDL에 안 적은 속성"이 유실된다는 이야기였다. 더 넓은 회귀 클래스가 하나 더 있다: **어느 마이그레이션 파일을 복사해 와서 고치는가**.

- PR#360 이 취소 RPC 를 재정의하면서 07-11 판 정의를 베이스로 삼았다. 그 사이 07-18 이 같은 함수에 세 가지 개선(`pg_temp` search_path·DELETE 선행 순서·트리거 위임)을 넣어 뒀는데, 07-11 을 복사한 순간 **그 셋이 통째로 되돌아갔다**. 파일 diff 상으로는 "RPC 를 고쳤다"로만 보인다.
- 이 상태로 **prod 적용까지 갔고**, 머지 직전 CI(pgTAP)가 검거했다. E2E 실패도 flake 가 아니라 이 회귀가 원인이었다.
- 해소본이 `20260727180000_cancel_rpc_rebase_on_seat_basis.sql` 이다("rebase" 라는 파일명이 이 사고의 이름이다). 코드로 검증됨.

### 규칙 (재정의 전 30초)
```bash
grep -l "CREATE OR REPLACE FUNCTION <함수명>" uniqn-mobile/supabase/migrations/*.sql | sort | tail -1
```
이 한 줄이 반환하는 파일이 **유일한 정당한 베이스**다. 파일명 검색·기억·"내가 저번에 만든 그거"로 고르지 말 것 — 마이그레이션은 타임스탬프 순 적용이므로 **최신 정의만이 현재 prod 의 함수 본문**이다([[prod-parity-baseline]]).

병합 국면에서는 이 함정이 [[semantic-merge-conflicts]] 와 겹친다: 두 브랜치가 같은 함수를 각자의 베이스에서 재정의하면 텍스트 충돌이 안 나면서 **나중에 적용되는 쪽이 이긴다**.

## 반증된 전제 — "STABLE이면 중첩 DML을 거부한다"는 거짓

같은 PR에서 검색 RPC 2종을 STABLE→VOLATILE로 바꿨다. 이유가 처음엔 틀렸었다.

- PostgreSQL의 read-only 강제는 **함수 자신의 `provolatile` 기준**이며 **호출 트리로 전파되지 않는다**. DML이 `check_rate_limit`(VOLATILE) 안에 있으므로, 호출자가 STABLE이어도 "터지지" 않는다.
- VOLATILE이 옳은 진짜 이유는 **플래너 폴딩 방지**다. STABLE로 두면 플래너가 호출을 접어 rate limit 카운트가 누락될 수 있다.
- 따라서 회귀 증상은 요란한 예외가 아니라 **"조용한 카운트 누락"** — 보안 기능이 켜져 있는 척하면서 세지 않는다.
- 근거: `20260719061931_nickname_search_rate_limit.sql:20-25`(마이그 주석) + `weekly_grid_security_regression.test.sql:189-193`(pgTAP 주석). 코드로 검증됨.

## 가드 설계 — 선언 가드만으로는 못 잡는다

`provolatile='v'` 단언만 두면 **rate limit 블록만 삭제하고 VOLATILE은 남기는** 회귀에서 계속 GREEN이 나온다. 선언과 본문을 **둘 다** 봐야 한다.

- E1·E2: `provolatile` 단언 (`weekly_grid_security_regression.test.sql:198-207`)
- E3·E4: `prosrc LIKE '%check_user_rate_limit%'` — **본문에 호출이 남아있는지** (`:209-215`)
- 대상 함수는 `proname` 스칼라 서브쿼리가 아니라 **`regprocedure`로 고정**한다. 향후 오버로드가 생기면 스칼라 서브쿼리가 다중행을 반환해 스위트 전체를 깨뜨린다(`:193-194`).
- 일반화: **"기능이 꺼져도 조용한" 보안 장치는 선언·본문·실동작 3층으로 단언한다.** PR#273은 21회차 실차단 스모크까지 붙였다. 단언만 있고 씨앗이 죽으면 green이 뜨는 [[test-seed-contract-drift]]의 vacuous green과 같은 실패 양식이다.

## 적용 체크리스트

기존 함수를 REPLACE하는 마이그레이션을 쓸 때:
- [ ] 현재 `proconfig`·`provolatile`·`prosecdef`·소유자·GRANT를 실측했다
- [ ] DDL에 `SET search_path`를 명시적으로 재기입했다(`pg_temp` 포함 여부 확인)
- [ ] volatility를 **부작용 유무 기준**으로 다시 판단했다(DML 추가 = VOLATILE)
- [ ] 함수가 공용이면 다른 호출부를 `prosrc` 전수 조사했다
- [ ] 조용한 회귀를 잡는 가드를 선언+본문 2층으로 추가했다
- [ ] prod MCP 적용이면 **같은 PR에서** repo 마이그와 가드 기대값을 동시 갱신했다([[prod-parity-baseline]] 규율)

## 관련

- [[secdef-hardening]] — 신규 SECDEF 작성 3규칙(anon REVOKE·`extensions` 포함·NULL fail-open). 본 페이지는 그 자매편(재정의 시점)
- [[nickname-search-unification]] — 이 규칙이 나온 원천 소스(PR#273 전체 맥락)
- [[parity-baseline-squash]] — 가드가 세는 것/안 세는 것(함수·정책만, 테이블/컬럼 제외)
- [[prod-parity-baseline]] — "prod가 진실" + MCP 핫픽스 = 같은 PR 가드 갱신 규율
- [[supabase-write-pitfalls]] — plpgsql 늦은바인딩 등 쓰기 경로 자매 함정
