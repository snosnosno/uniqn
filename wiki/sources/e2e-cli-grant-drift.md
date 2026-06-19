---
area: sources
updated: 2026-06-19
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260619133156_grant_table_privileges_local_stack_parity.sql
  - uniqn-mobile/supabase/migrations/20260409000000_base_schema.sql
  - .github/workflows/e2e.yml
  - PR#183
  - PR#180
  - memory/project_e2e_systemic_failure_20260618.md
tags: [e2e, playwright, ci, supabase, grants]
---

# 소스: e2e ~96% 실패 — 같은 CLI 드리프트, 그러나 pin으론 안 고쳐짐 (2026-06-19)

> 원천: 2026-06-18 master e2e 시스템 장애 조사 + 수정 PR#183. 합성 결론은 [[test-db-grants]]. 자매 소스 [[db-tests-cli-grant-drift]](db-tests 쪽).

## 무슨 일이 있었나 (검증됨)

master e2e(`workflow_dispatch` run 27769458739, 커밋 8ce38f2ee)가 **✓5 / ✘123 / -56**, 75분 cap 도달 cancelled. 패턴: 앱 로드·로그인은 됨(smoke·미인증·로그인실패 통과), **로그인 후 기능 화면 전역 타임아웃**.

trace 실측(`gh run download`): 유일 DB 쿼리 `/rest/v1/app_config`(authenticated startup 버전체크, `uniqn-mobile/src/services/versionService.ts:72`) → **403 code 42501**. seed 로그: `permission denied for table board_posts`(service_role, 앱 코드 실행 *전*). → React/UX 코드 회귀가 만들 수 없는 순수 DB 권한 에러.

## 근본 원인 (검증됨)

[[db-tests-cli-grant-drift]]와 **동일 클래스**: `uniqn-mobile/supabase/migrations/20260409000000_base_schema.sql`은 모든 public 테이블을 CREATE만 하고 **명시 GRANT 0개**(플랫폼 default-privilege 의존). e2e도 `supabase/setup-cli` `version: latest`(당시)로 로컬 스택 기동 → 최신 이미지가 implicit GRANT 미부여 → 앱의 authenticated 쿼리·seed의 service_role 쿼리 모두 42501 → 인증 화면 데이터 로드 불가 → 셀렉터 타임아웃.

## 핵심 교훈: 버전 pin은 e2e를 못 고쳤다 (검증됨)

[[test-db-grants]] 규칙 3(setup-cli pin)이 **단독으로는 무효**임이 실측 반증됨. 현 master(#180의 `2.107.0` pin 포함)에 e2e 재실행 = **run 27787809344**: 설치 CLI=`2.107.0`인데도 `board_posts` 42501 그대로·동일 분포로 **여전히 실패**. 즉 2.107.0도 default 권한을 자동부여하지 않는다 → **pin은 드리프트 예방일 뿐 GRANT 부재를 고치지 못한다**. db-tests가 #179로 green이 된 진짜 이유도 pin이 아니라 fixture **명시 GRANT**였음.

## 수정 (검증됨)

- **PR#183** (`dc1b0c491`): 마이그레이션 `20260619133156_grant_table_privileges_local_stack_parity.sql` — prod 실측 권한 그대로 명시 GRANT. db-tests의 fixture-only 수정과 달리 **마이그레이션**으로 한 이유: e2e는 전체 앱을 로컬 스택에 띄워 돌리므로 스키마 자체가 정합해야 함.
  - `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public TO anon, authenticated, service_role` + `ALTER DEFAULT PRIVILEGES`(테이블/시퀀스만, **함수 제외**=머니 RPC anon REVOKE 보존).
  - wallet 4테이블(wallets/wallet_ledger/heart_lots/diamond_products) DML REVOKE 재적용 → `20260605000010` 하드닝 미러.
  - prod 실측 3회로 멱등·안전 검증: 일반테이블=전체 DML / wallet4=anon·auth SELECT만 / anon SELECT 없는 완전잠금 테이블=0개. prod 적용도 no-op 확인.
- 검증: PR#183 e2e `success`, **225 passed / 11 skip / 1 flaky, 11분**(75분 cap→정상화), 로그 42501 0건. Red(run 27787809344 ✘123)→Green 실측.

## 부수 교훈

- versionService는 이미 graceful(에러 시 null 폴백, throw 無)이고 splash 재시도도 상한(`MAX_PROFILE_RETRIES=5`) 있음. trace의 "app_config 42501 ×560k"는 **실 HTTP 아닌 trace 파일 아티팩트**(network 로그상 실제 요청 1건). "재시도 폭주" 추정은 조사 후 기각.
- e2e.yml은 `paths: uniqn-mobile/**` PR/dispatch에서만 실행 + **non-required 체크** → red가 잠복하며 다른 PR이 jest/quality만으로 머지됨(메모리 `feedback_master_direct_push_bypasses_e2e`).

## 관련
- [[test-db-grants]] — 이 소스가 보정하는 합성 결정(pin≠fix)
- [[db-tests-cli-grant-drift]] — 같은 드리프트의 db-tests 쪽 자매 소스
- [[rls-model]] — 테이블 GRANT vs RLS 레이어 구분(증상 동일, 원인 다름)
