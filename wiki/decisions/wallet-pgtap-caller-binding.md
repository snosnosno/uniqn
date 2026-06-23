---
area: decisions
updated: 2026-06-23
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260621090100_bind_mutation_rpcs_to_auth_uid.sql
  - uniqn-mobile/supabase/tests/anon_rpc_security_hardening.test.sql
  - memory/pitfall_195_caller_binding_broke_pgtap_dbtests.md
  - PR#195
  - PR#198
tags: [db-tests, pgtap, rls, security, auth, regression]
---

# pgTAP caller-binding 회귀 — 하드닝이 테스트 하네스를 깨뜨림

**결정/교훈:** 변이 RPC에 `auth.uid()` 호출자 바인딩 가드를 추가하면 **pgTAP 테스트도 함께 갱신**해야 한다. 안 하면 db-tests가 RED가 되고, 그 RED는 "방금 변경"이 아니라 **선행 하드닝 회귀**일 수 있다.

## 무슨 일
PR#195가 변이 SECDEF RPC(`confirm_application`·`cancel_application_atomically`·`process_qr_checkin_atomically`·`apply_with_capacity_check`)에 가드 추가:
`IF auth.uid() IS NULL OR (auth.uid() IS DISTINCT FROM <actor_param> AND NOT is_admin()) THEN 거부` (`20260621090100_bind_mutation_rpcs_to_auth_uid.sql`).

pgTAP는 superuser `DO` 블록에서 RPC를 직접 호출 → `auth.uid()`=NULL → 전부 거부("unauthorized" / "PERMISSION_DENIED: 호출자 인증 불일치"). **프로덕션·e2e는 JWT 보유라 정상** = 테스트 하네스만 깨진 것. #195는 db-tests RED인 채 master 직접 머지됨([[test-db-grants]] 동일 클래스: 머지 게이트가 required check 강제 안 함).

## 수정 (PR#198, CI GREEN 검증)
- 각 하드닝 RPC 호출 **직전**에 actor와 동일 uuid로 JWT 주입:
  `PERFORM set_config('request.jwt.claims', json_build_object('sub', <actor>, 'role','authenticated')::text, true);`
  (`auth.uid()`는 `request.jwt.claims` JSON의 `sub`를 읽음.)
- `anon_rpc_security_hardening.test.sql`: `has_function_privilege`는 **미존재 함수에 ERROR로 중단** → phantom `list_all_applications(application_status)` 단언 제거. `check_email_exists(text)`는 가입경로 anon 호출이라 `GRANT EXECUTE ... TO anon` 명시 추가(암묵→명시 grant 갭, [[test-db-grants]] / [[e2e-cli-grant-drift]] 패턴).

## 운영 규칙
- db-tests RED 시 "방금 변경" 의심 전에 **직전 머지의 db-tests 결과를 `gh run`으로 실측 대조**. 실패 테스트가 변경과 무관하면 선행 회귀.
- db-tests는 `supabase/**` 변경 PR만 실행 → 회귀 잠복([[test-db-grants]]).

## 관련
- [[test-db-grants]] — 같은 테스트-DB 함정 계열(grant 드리프트)
- [[rls-model]] — 호출자 바인딩은 RLS 외 SECDEF RPC 권한 레이어
- [[wallet-iap-removal]] — 이 회귀 발견 맥락(지갑 제거 PR의 db-tests RED 추적 중 확정)
