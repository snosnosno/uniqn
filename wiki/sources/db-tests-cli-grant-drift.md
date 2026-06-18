---
area: sources
updated: 2026-06-19
status: current
sources:
  - uniqn-mobile/supabase/fixtures/jpc_helpers.sql
  - .github/workflows/db-tests.yml
  - PR#179
  - PR#180
  - memory/pitfall_supabase_cli_latest_drift_implicit_table_grant.md
tags: [db-tests, pgtap, ci, supabase, grants]
---

# 소스: db-tests "permission denied" 회귀 — CLI 이미지 드리프트 (2026-06-19)

> 원천: 2026-06-18 master DB Tests(pg_prove) 조사 + 수정 PR#179/#180. 합성 결론은 [[test-db-grants]].

## 무슨 일이 있었나 (검증됨)

master **DB Tests (pg_prove)** 가 #175 시점 8개 테스트 fail — `job_postings_anon_public_select` + `jpc_*_rls`(6) + `workspace_archive`. CI 실 로그(run 27768845292):
> `jpc_work_logs_rls.test.sql:39: ERROR:  permission denied for table job_postings`
> `Files=28, Tests=100 ... Result: FAIL`

`#172` 의 red 는 **별개** — `supabase/setup-cli@v1` 의 `version: latest` 가 익명 GitHub API 'resolve latest' 호출에서 rate limit → Setup 단계 6초 실패(테스트 0개 실행). 마지막 정상 = #170(2026-06-05).

## 근본 원인 (검증됨)

`uniqn-mobile/supabase/fixtures/jpc_helpers.sql:139` 의 `jpc_test_set_user()` 는 `set_config('role','authenticated',true)`(= `SET LOCAL ROLE authenticated`)로 전환 후 `public.job_postings`/`workspaces` 에 **직접 접근** → 테이블 레벨 GRANT 필요.

- **prod**: `information_schema.role_table_grants` 실측 — anon/authenticated/service_role 이 해당 테이블에 ALL GRANT 보유 → **앱 정상, 영향 0**.
- **CI 로컬**: `version: latest` 가 받는 최신 Supabase 이미지가 마이그레이션 생성 테이블에 implicit GRANT 를 더 이상 자동부여 안 함. job_postings/workspaces 명시 GRANT 마이그레이션은 **0개**(기본 default-privilege 의존). 코드 무변경인데 6/5 pass → 6/18 fail 로 드리프트.

핵심: 이 GRANT 는 RLS(행 가시성)와 **별개의 coarse 레이어**다. RLS 평가 전에 테이블 권한에서 42501 abort → [[rls-model]] 의 "permissive OR abort" 와 같은 표면 증상이지만 원인은 GRANT 부재.

## 수정 (검증됨)

- **PR#179** (`0c33032cc`): `jpc_helpers.sql`(fixtures 전용·prod 미적용, `docker exec psql -U postgres` 로 로컬 컨테이너에만 실행)에 prod 동치 `GRANT ALL ON ALL TABLES/SEQUENCES ... TO anon, authenticated, service_role` 추가. **함수는 제외**(결제 RPC 하드닝이 REVOKE 한 EXECUTE 되살림 방지 → `wallet_grants_hardening.test.sql` 회귀 차단).
- **PR#180** (`70614e403`): 3개 워크플로우(db-tests/e2e/deploy-edge-functions) `version: latest` → `version: 2.107.0` 고정 + `github-token: ${{ github.token }}`. 드리프트 + 익명 rate-limit 동시 예방.
- 검증: master 머지 커밋 db-tests `success`(2m39s), `Files=28, Tests=193, Result: PASS`. RED→GREEN 실측.

## 교훈

- db-tests.yml 은 `paths: uniqn-mobile/supabase/**` 변경 PR/push 에서만 실행 → 회귀가 잠복하다 다음 supabase PR(#175)에서 표면화. "red 시작 커밋(#172)" ≠ 실제 원인.
- 테스트가 Supabase 기본 default-privilege 에 의존하면 CLI 버전에 취약. 같은 비결정성 클래스: [[enum-divergence]] 가 아니라 환경 드리프트(메모리 `pitfall_e2e_runner_contention_timeout`).

## 관련
- [[test-db-grants]] — 이 소스의 합성 결정/규칙
- [[rls-model]] — 테이블 GRANT vs RLS 레이어 구분
- [[enum-divergence]] — 또 다른 "읽기 레코드 증발" 클래스(원인은 다름)
