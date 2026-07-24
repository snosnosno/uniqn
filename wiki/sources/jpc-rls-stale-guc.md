---
area: sources
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/supabase/fixtures/jpc_helpers.sql
  - uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql
  - PR#277
  - PR#267
tags: [db-tests, pgtap, rls, auth, jwt, guc, regression, test-harness]
---

# 소스: jpc RLS db-tests 이틀 red — `auth.uid()` stale GUC 오염 (PR #277, 2026-07-19)

## 한 줄
master `DB Tests (pg_prove)`가 07-17~19 이틀간 red(`jpc_job_postings_rls` 5/6/7, `42501`)였고, **prod 결함이 아니라 테스트 하네스 결함**이었다. 정책([[grid-order-sheet-security-hardening]] = PR#267)은 옳았고 이 PR은 정책을 건드리지 않았다.

## 근본 원인 — `auth.uid()`의 GUC 우선순위

`auth.uid()`는 **singular GUC를 먼저** 읽고 plural은 fallback이다 (`jpc_helpers.sql:159`에 근거 주석화):

```sql
coalesce(current_setting('request.jwt.claim.sub'), claims::jsonb->>'sub')
```

반면 `auth.jwt()` / `get_my_role()`은 **plural만** 읽는다. 이 비대칭이 결함의 전부다.

인과 사슬 (코드로 검증됨):
1. `jpc_test_set_user()`는 singular+plural을 **모두** 세팅한다 (`jpc_helpers.sql:166-171`).
2. 그런데 INSERT 케이스는 `app_metadata`를 실으려고 **plural만** 인라인 `set_config`로 주입했다.
3. 직전 SELECT 케이스의 `jpc_test_set_user(outsider)`가 남긴 **singular가 살아남아** `auth.uid()`가 outsider를 반환.
4. `get_my_role()`은 plural을 읽으니 `employer`로 **정상 통과** → PR#267이 `jp_insert`에 추가한 `owner_id = auth.uid()`**만** 실패 → `42501`.

**증상의 지문**: 역할 게이트는 통과하는데 owner 바인딩만 깨진다. PR#267 이전에는 정책이 plural만 읽는 역할 게이트뿐이라 오염이 **무해**했다 — owner 바인딩이 추가되며 잠복 결함이 드러난 것이다.

## 수정 — 최소수정 대신 주입 경로 단일화

- **fixtures**: `jpc_test_set_user_with_role(uuid, text)` 신설 (`jpc_helpers.sql:180-190`) — singular/plural을 함께 갱신하고 `app_metadata.role`까지 싣는다(prod의 실제 employer/staff JWT와 동형).
- **tests**: 인라인 `set_config` DO 블록 4개 → 헬퍼 호출로 교체 (`jpc_job_postings_rls.test.sql:81·92·104·115`).
- 두 파일에 "JWT 주입은 헬퍼 경유, 인라인 금지"를 **근거와 함께** 주석화 (`jpc_helpers.sql:154-164`, `test.sql:72`).

> 해당 블록에 singular만 추가하는 최소 수정을 **거부한 이유**: 동일 클래스 2회차다(1회차 = [[wallet-pgtap-caller-binding]] PR#195→#198). 인라인 주입을 남기면 `auth.uid()`를 읽는 정책이 늘 때마다 재발한다.

## prod 무영향 근거 (코드로 검증됨)
오염원 `jpc_test_set_user`는 `fixtures/`·`tests/` 전용이며 **마이그레이션(운영 스키마)에 0건**이다. 실제 요청은 PostgREST가 두 GUC를 일관되게 세팅한다. 로컬↔prod `jp_insert` 정책 md5 일치를 확인해 재현 충실성을 담보했다.

## 검증 증거
| 단계 | 결과 |
|---|---|
| 수정 전 재현 | 5/6/7 → `42501` (CI와 동일) |
| 원인 red-green | plural만 → `auth.uid()`=outsider 불일치 / singular+plural → 일치 + INSERT 성공 |
| 수정 후 | `jpc_job_postings_rls` **16/16** |
| **비-공허성** | outsider 역할을 employer로 뒤집자 `not ok 8` — 실제로 검증 중임 확인 |
| 전체 스위트 | pgTAP **71 파일 / 실패 0** |
| CI 최종 | master `9b729e85b` DB Tests **success** (직전 `e12f17fe1`은 failure) |

## 영속 교훈
1. **테스트 컨텍스트 주입은 헬퍼 단일 경로로.** 인라인 주입은 "지금은 무해한" 오염을 남기고, 나중에 추가되는 정책이 그걸 밟는다.
2. **하네스 오염은 조용히 잠복한다.** 결함은 07-17이 아니라 오염을 처음 읽는 정책이 생긴 시점에 발현했다 — red의 시작일이 원인의 발생일이 아니다.
3. `auth.uid()`와 `get_my_role()`이 **서로 다른 GUC를 읽는다**는 비대칭은 이 프로젝트 RLS 테스트의 상시 함정이다([[rls-model]]).
4. db-tests red를 만나면 "방금 변경" 의심 전에 **직전 머지의 결과를 `gh run`으로 실측 대조** — [[wallet-pgtap-caller-binding]]의 운영 규칙이 이번에도 유효했다.

## 관련
- [[wallet-pgtap-caller-binding]] — 동일 클래스 1회차(하드닝이 테스트 하네스를 깨뜨림)
- [[grid-order-sheet-security-hardening]] — 잠복 결함을 드러낸 owner 바인딩(PR#267)의 출처
- [[rls-model]] — RLS/SECDEF 컨텍스트 레이어
- [[secdef-hardening]] — `auth.uid()` NULL fail-open 차단 규칙과 같은 계열
- [[test-db-grants]] — 테스트 DB 하네스 함정 계열
