---
area: decisions
updated: 2026-06-19
status: current
sources:
  - uniqn-mobile/supabase/fixtures/jpc_helpers.sql
  - .github/workflows/db-tests.yml
  - PR#179
  - PR#180
tags: [db-tests, ci, grants, supabase, pgtap]
---

# 결정: 테스트 DB 권한은 명시 GRANT + CLI 버전 pin

**한 줄:** pgTAP 테스트는 Supabase 기본 default-privilege(implicit 테이블 GRANT)에 의존하지 말고, 테스트 fixture에서 **명시 GRANT** + setup-cli **버전 고정**으로 환경 드리프트에 면역시킨다.

## 왜 (검증됨)

테이블 레벨 GRANT 는 RLS(행 가시성)와 **별개의 coarse 레이어**다([[rls-model]]). pgTAP RLS 테스트는 `jpc_test_set_user()`(`uniqn-mobile/supabase/fixtures/jpc_helpers.sql:139`)로 `authenticated`/`anon` 으로 전환 후 `job_postings`/`workspaces` 에 직접 접근하므로 그 GRANT 가 존재해야 RLS 평가에 도달한다.

prod 는 Supabase 기본 default-privilege 로 GRANT 를 보유하지만, CI 의 `supabase/setup-cli` `version: latest` 가 받는 최신 이미지는 마이그레이션 생성 테이블에 implicit GRANT 를 자동부여하지 않게 드리프트 → `permission denied for table` 로 db-tests 전면 red(상세 [[db-tests-cli-grant-drift]]). 명시 GRANT 마이그레이션이 0개라 기본권한에만 의존한 게 취약점.

## 규칙

1. **테스트 grant 는 명시적으로** — `jpc_helpers.sql`(fixtures 전용, `npm run test:db:helpers` 가 로컬 컨테이너에만 등록)에서 `GRANT ALL ON ALL TABLES/SEQUENCES IN SCHEMA public TO anon, authenticated, service_role`. prod grant 상태와 동치 → CLI 버전 무관 결정적.
2. **함수는 grant 확대 금지** — 결제 RPC 하드닝이 anon/authenticated 에서 REVOKE 한 EXECUTE 를 되살리면 회귀(`wallet_grants_hardening.test.sql`). 테이블/시퀀스만.
3. **setup-cli 버전 pin** — `version: 2.107.0` + `github-token`(PR#180). `latest` 는 (a) 익명 GitHub API rate-limit, (b) 이미지 드리프트 두 사고의 단일 뿌리. 3개 워크플로우 일괄.
4. **fixtures 는 prod 등록 금지** — SECDEF 헬퍼 포함, prod 적용 시 RLS 우회 가능(catastrophic).

## 경계 (raw 수정 금지 영역과의 관계)

테스트 grant 는 `wiki/`(여기) 가 아니라 `uniqn-mobile/supabase/fixtures/` 가 단일 소스. 이 페이지는 "왜 그렇게 했는가"의 합성일 뿐, 규칙 변경은 fixture/workflow 수정으로.

## 관련
- [[rls-model]] — 테이블 GRANT vs RLS 정책 레이어(증상은 같고 원인 다름)
- [[db-tests-cli-grant-drift]] — 이 결정의 원천 소스(RED→GREEN 증거)
- [[enum-divergence]] — DB 스키마/환경 드리프트가 읽기를 깨는 또 다른 클래스
