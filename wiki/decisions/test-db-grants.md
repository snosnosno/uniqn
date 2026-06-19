---
area: decisions
updated: 2026-06-19
status: current
sources:
  - uniqn-mobile/supabase/fixtures/jpc_helpers.sql
  - uniqn-mobile/supabase/migrations/20260619133156_grant_table_privileges_local_stack_parity.sql
  - .github/workflows/db-tests.yml
  - PR#179
  - PR#180
  - PR#183
tags: [db-tests, e2e, ci, grants, supabase, pgtap]
---

# 결정: 테스트 DB 권한은 명시 GRANT (CLI pin은 예방일 뿐 수정 아님)

**한 줄:** 테스트 DB(pgTAP fixture·e2e 로컬 스택)는 Supabase 기본 default-privilege(implicit 테이블 GRANT)에 의존하지 말고 **명시 GRANT**로 prod와 정합시킨다. setup-cli 버전 고정은 드리프트 *예방*이지 GRANT 부재의 *수정*이 아니다(e2e에서 실측 반증).

## ⚠️ 핵심 보정: pin ≠ fix (검증됨)

같은 드리프트가 **e2e도 전면 red**로 만들었고(상세 [[e2e-cli-grant-drift]]), `version: 2.107.0` pin(#180)이 포함된 master 재실행(run 27787809344)에서도 `permission denied` 그대로 실패했다. → 2.107.0도 implicit GRANT를 자동부여하지 않으므로 **pin만으론 못 고친다.** db-tests가 #179로 green이 된 실제 원인도 pin이 아니라 fixture 명시 GRANT다. 면역의 핵심은 **명시 GRANT**, pin은 (a) 익명 rate-limit·(b) 추가 드리프트를 막는 보조일 뿐.

## 왜 (검증됨)

테이블 레벨 GRANT 는 RLS(행 가시성)와 **별개의 coarse 레이어**다([[rls-model]]). pgTAP RLS 테스트는 `jpc_test_set_user()`(`uniqn-mobile/supabase/fixtures/jpc_helpers.sql:139`)로 `authenticated`/`anon` 으로 전환 후 `job_postings`/`workspaces` 에 직접 접근하므로 그 GRANT 가 존재해야 RLS 평가에 도달한다.

prod 는 Supabase 기본 default-privilege 로 GRANT 를 보유하지만, CI 의 `supabase/setup-cli` `version: latest` 가 받는 최신 이미지는 마이그레이션 생성 테이블에 implicit GRANT 를 자동부여하지 않게 드리프트 → `permission denied for table` 로 db-tests 전면 red(상세 [[db-tests-cli-grant-drift]]). 명시 GRANT 마이그레이션이 0개라 기본권한에만 의존한 게 취약점.

## 규칙

1. **테스트 grant 는 명시적으로** — `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public TO anon, authenticated, service_role`로 prod grant 상태와 동치화 → CLI 버전 무관 결정적. **두는 위치는 무대별로 다름**: pgTAP은 `jpc_helpers.sql`(fixtures 전용, `npm run test:db:helpers`가 로컬 컨테이너에만 등록); e2e는 전체 앱을 로컬 스택에 띄우므로 **마이그레이션**(`20260619133156_..._local_stack_parity.sql`, PR#183)으로 스키마 자체를 정합화(prod 멱등 no-op).
2. **함수는 grant 확대 금지** — 결제 RPC 하드닝이 anon/authenticated 에서 REVOKE 한 EXECUTE 를 되살리면 회귀(`wallet_grants_hardening.test.sql`). 테이블/시퀀스만. 마이그레이션 경로는 추가로 wallet 4테이블 DML REVOKE 재적용(`20260605000010` 미러)으로 anon/auth 확대 방지.
3. **setup-cli 버전 pin** — `version: 2.107.0` + `github-token`(PR#180). `latest` 는 (a) 익명 GitHub API rate-limit, (b) 이미지 드리프트 두 사고의 단일 뿌리. 3개 워크플로우 일괄.
4. **fixtures 는 prod 등록 금지** — SECDEF 헬퍼 포함, prod 적용 시 RLS 우회 가능(catastrophic).

## 경계 (raw 수정 금지 영역과의 관계)

테스트 grant 는 `wiki/`(여기) 가 아니라 `uniqn-mobile/supabase/fixtures/` 가 단일 소스. 이 페이지는 "왜 그렇게 했는가"의 합성일 뿐, 규칙 변경은 fixture/workflow 수정으로.

## 관련
- [[rls-model]] — 테이블 GRANT vs RLS 정책 레이어(증상은 같고 원인 다름)
- [[db-tests-cli-grant-drift]] — db-tests(pgTAP) 쪽 원천 소스(RED→GREEN 증거)
- [[e2e-cli-grant-drift]] — e2e 쪽 원천 소스(pin≠fix 반증 + 마이그레이션 수정)
- [[enum-divergence]] — DB 스키마/환경 드리프트가 읽기를 깨는 또 다른 클래스
