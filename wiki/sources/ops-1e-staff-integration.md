---
area: sources
updated: 2026-07-08
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260708100000_ops_1e_staff_table_and_enum.sql
  - uniqn-mobile/supabase/migrations/20260708100100_ops_1e_staff_rpcs.sql
  - uniqn-mobile/supabase/migrations/20260708100200_ops_1e_grants_and_realtime.sql
  - PR#230
  - memory/project_ops_1e_staff_integration_design.md
tags: [ops, tournament, staff, migration, security]
---

# 소스: 라이브 운영(ops) 1e 스태프 연동 (2026-07-08)

> T-HOLDEM 대회 운영 엔진의 스태프 슬라이스. **PR#230 머지**(master `5018d4bc4`) + prod 마이그 적용 완료. 대회 딜러/스태프 로스터를 공고 확정 스태프에서 끌어오고 테이블에 배정한다. 여기서는 **기능 골자 + 출하 과정의 재사용 교훈 3건**만 합성한다(상세 진행 이력은 `memory/project_ops_1e_staff_integration_design`).

## 무엇을 했나 (기능, 코드 검증됨)
- **ops_staff 신설** — 대회별 딜러/스태프 스냅샷 테이블. SELECT-only RLS(`is_ops_member` 재사용), **쓰기는 SECDEF RPC 전용**, 이름은 INSERT 시점 고정(users 변경 무관). `20260708100000_ops_1e_staff_table_and_enum.sql:27-67`
- **대회↔공고 N:1 연결(owner 전용)** — `ops_set_tournament_posting`. 연결 변경은 `is_ops_member`의 워크스페이스 분기를 바꾸므로 **대회 소유자만** 허용(멤버는 거부). `20260708100100_ops_1e_staff_rpcs.sql:42-45`
- **work_logs 스냅샷 import(읽기 전용)** — `ops_import_staff_from_posting`. 확정 스태프 SSOT=`work_logs`, `DISTINCT ON(staff_id) ORDER BY date DESC` 최신 배정 채택, `ON CONFLICT DO NOTHING` 멱등. **work_logs에 쓰지 않음**. `20260708100100:114-142`
- **딜러 테이블 배정(move 시맨틱)** — `ops_assign_table_staff`. 같은 스태프 재배정 시 이전 테이블 자동 해제, NULL=해제(멱등), 로스터 멤버십 강제. 딜러-테이블 1:1 partial UNIQUE 백스톱. `20260708100100:272-355`
- 수동 추가/제거 — `ops_add_staff`(SEC-1 롤 게이트로 이름 하베스팅 차단, `20260708100100:181-186`)·`ops_remove_staff`(cascade-clear). STAFF 탭(7번째 세그먼트)·딜러 피커 UI(클라 계층).

## 재사용 교훈 (출하 과정)
### 1. 마이그 타임스탬프 충돌 → [[migration-timestamp-collision]]
병렬 세션이 같은 `20260707100000` 프리픽스를 독립적으로 고름 → origin/master(reseat PR#229 포함) 리베이스 후 로컬/CI `supabase db reset`이 `schema_migrations_pkey`(23505)로 실패. 자기 마이그 3종을 `20260708*`로 리네임(내용 무변경)해 해소. 규칙·전말은 결정 페이지 참조.

### 2. MCP apply_migration 은 prod version 을 별도 부여
prod 3종은 MCP `apply_migration`(name=`ops_1e_*`)으로 적용 — prod `schema_migrations.version`은 **적용 시각 기준**이라 repo 파일명(`20260708100000`)과 불일치(무해한 관례 드리프트). 그래서 위 **파일명 충돌은 prod와 무관**(prod엔 충돌 없음, 파일 기반 `db reset`에서만 발현). → [[migration-timestamp-collision]]

### 3. anon-executable ops SECDEF = monitor/player 2개 불변 계약
신규 SECDEF 함수는 PUBLIC EXECUTE를 상속하고 anon도 PUBLIC의 일부 → **변이 RPC는 anon 명시 REVOKE 필수**. 1e도 신규 5종을 REVOKE(`20260708100200_ops_1e_grants_and_realtime.sql:19-29`). 회귀 가드는 **카탈로그 카운트+집합 단언**(anon-executable ops SECDEF = 정확히 2 = {monitor, player}) — 개별 함수명 단언은 "다음에 추가될 이름 모르는 함수"를 못 잡기 때문. 실측(출하 후): `get_advisors(security)` ERROR 0, anon SECDEF 집합 불변. (같은 함정의 memory 근원: `memory/pitfall_supabase_new_function_anon_default_grant`.)

## 게이트 증거 (출하, 코드/실행 검증됨)
- 병합 상태: pgTAP **644** · jest **4886** · quality EXIT0 · CI **9종 green**(E2E 10m25s) · whole-branch 리뷰(opus) **must-fix 0**.
- prod: `get_advisors(security)` **ERROR 0**(191 WARN, ops 5종=표준 `authenticated_security_definer_function_executable`), 신규 5종 `anon=false`·`authed=true` 실측.

## 연결
- 역할 모델(딜러/플로어/서빙=StaffRole vs UserRole): [[roles]]
- 쓰기 경로 계층 경계(Service→Repository→SECDEF RPC): [[layers]]
- RLS 3계층·SECDEF 함정: [[rls-model]]
- 출하 과정 마이그 워크플로우 교훈: [[migration-timestamp-collision]]
