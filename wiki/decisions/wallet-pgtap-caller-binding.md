---
area: decisions
updated: 2026-07-19
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260621090100_bind_mutation_rpcs_to_auth_uid.sql
  - uniqn-mobile/supabase/tests/anon_rpc_security_hardening.test.sql
  - uniqn-mobile/supabase/fixtures/jpc_helpers.sql
  - memory/pitfall_195_caller_binding_broke_pgtap_dbtests.md
  - PR#195
  - PR#198
  - PR#277
tags: [db-tests, pgtap, rls, security, auth, regression, test-harness]
---

# pgTAP caller-binding 회귀 — 하드닝이 테스트 하네스를 깨뜨림

**결정/교훈:** `auth.uid()`를 읽는 가드/정책을 추가하면 **pgTAP 테스트 하네스도 함께 갱신**해야 한다. 안 하면 db-tests가 RED가 되고, 그 RED는 "방금 변경"이 아니라 **선행 하드닝 회귀**일 수 있다.

> **2회 재발한 클래스다** (1회차 PR#195→#198, 2회차 PR#267→#277). 공통 구조: 운영 코드의 `auth.uid()` 의존이 강해질 때마다, 그 컨텍스트를 **느슨하게 흉내내던 테스트 하네스**가 먼저 깨진다. prod는 무영향인데 CI만 red가 되므로 원인을 운영 결함으로 오진하기 쉽다.

## 무슨 일
PR#195가 변이 SECDEF RPC(`confirm_application`·`cancel_application_atomically`·`process_qr_checkin_atomically`·`apply_with_capacity_check`)에 가드 추가:
`IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM <actor_param> AND NOT is_admin()) THEN 거부` (`20260621090100_bind_mutation_rpcs_to_auth_uid.sql`).

pgTAP는 superuser `DO` 블록에서 RPC를 직접 호출 → `auth.uid()`=NULL → 전부 거부("unauthorized" / "PERMISSION_DENIED: 호출자 인증 불일치"). **프로덕션·e2e는 JWT 보유라 정상** = 테스트 하네스만 깨진 것. #195는 db-tests RED인 채 master 직접 머지됨([[test-db-grants]] 동일 클래스: 머지 게이트가 required check 강제 안 함).

## 수정 (PR#198, CI GREEN 검증)
- 각 하드닝 RPC 호출 **직전**에 actor와 동일 uuid로 JWT 주입:
  `PERFORM set_config('request.jwt.claims', json_build_object('sub', <actor>, 'role','authenticated')::text, true);`
  (`auth.uid()`는 `request.jwt.claims` JSON의 `sub`를 읽음.)
- `anon_rpc_security_hardening.test.sql`: `has_function_privilege`는 **미존재 함수에 ERROR로 중단** → phantom `list_all_applications(application_status)` 단언 제거. `check_email_exists(text)`는 가입경로 anon 호출이라 `GRANT EXECUTE ... TO anon` 명시 추가(암묵→명시 grant 갭, [[test-db-grants]] / [[e2e-cli-grant-drift]] 패턴).

## 2회차 (PR#267 → #277) — 인라인 주입이 남긴 stale GUC
1회차는 "JWT를 아예 안 넣어서" 깨졌고, 2회차는 "**일부만** 넣어서" 깨졌다. 더 찾기 어려운 형태다.

`auth.uid()`는 singular GUC(`request.jwt.claim.sub`)를 **먼저** 읽고 plural은 fallback인데, `auth.jwt()`/`get_my_role()`은 **plural만** 읽는다. 테스트가 `app_metadata`를 실으려고 plural만 인라인 주입하자 직전 케이스의 singular가 살아남아, **역할 게이트는 통과하는데 owner 바인딩만 `42501`로 실패**했다. PR#267이 `owner_id = auth.uid()`를 추가하기 전까지 이 오염은 무해했다 — 즉 **red의 시작일이 원인의 발생일이 아니다**. 상세: [[jpc-rls-stale-guc]].

## 운영 규칙
- **테스트 컨텍스트 주입은 헬퍼 단일 경로로.** 테스트 파일에서 `set_config` 인라인 주입 금지 — 헬퍼는 singular/plural을 **함께** 갱신해야 한다(`jpc_helpers.sql:154-190`). 최소 수정으로 때우면 `auth.uid()`를 읽는 정책이 늘 때마다 재발한다.
- db-tests RED 시 "방금 변경" 의심 전에 **직전 머지의 db-tests 결과를 `gh run`으로 실측 대조**. 실패 테스트가 변경과 무관하면 선행 회귀.
- **하네스 결함 vs 운영 결함 판별**: 오염원이 `fixtures/`·`tests/`에만 있고 마이그레이션에 0건이면 prod 무영향이다. 재현 충실성은 로컬↔prod **정책 md5 일치**로 담보한다.
- db-tests는 `supabase/**` 변경 PR만 실행 → 회귀 잠복([[test-db-grants]]).

## 관련
- [[jpc-rls-stale-guc]] — 2회차 상세 기록(PR#277)
- [[test-db-grants]] — 같은 테스트-DB 함정 계열(grant 드리프트)
- [[rls-model]] — 호출자 바인딩은 RLS 외 SECDEF RPC 권한 레이어
- [[wallet-iap-removal]] — 1회차 발견 맥락(지갑 제거 PR의 db-tests RED 추적 중 확정)
