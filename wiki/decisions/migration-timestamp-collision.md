---
area: decisions
updated: 2026-07-08
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260708100000_ops_1e_staff_table_and_enum.sql
  - PR#230
  - PR#229
  - memory/feedback_supabase_migration_workflow.md
tags: [migration, supabase, ci, mcp]
---

# 결정: 마이그 타임스탬프 충돌 — 병렬 세션 + MCP-apply version 드리프트

## 결론
**병렬 세션이 같은 `YYYYMMDDHHMMSS` 마이그 파일 프리픽스를 독립적으로 고르면, 두 브랜치가 병합되는 순간 `supabase db reset`(로컬/CI)이 `schema_migrations_pkey`(23505, version 중복)로 실패한다.** 해소 = 나중에 머지하는 쪽이 자기(신규) 마이그를 **더 늦은 타임스탬프로 리네임**(내용 무변경). prod는 별개 메커니즘이라 영향 없음(아래).

## 무슨 일이 있었나 (증거)
- ops 1e(PR#230) M1 파일 = `20260707100000_ops_1e_staff_table_and_enum.sql`.
- 병렬 세션의 reseat fast-follow(PR#229)가 `20260707100000_ops_reseat_uuid_prevalidate.sql`를 먼저 머지.
- 1e 브랜치를 origin/master(#229 포함)에 리베이스하자 두 `20260707100000_*` 파일 공존 → `npm run db:reset` 실패:
  > `ERROR: duplicate key value violates unique constraint "schema_migrations_pkey" ... Key (version)=(20260707100000) already exists.`
- supabase CLI는 파일명 **선행 숫자**를 migration version(PK)으로 쓴다 → 프리픽스가 같으면 파일명이 달라도 version 충돌.
- 해소: 1e 3종을 `20260708100000/100100/100200`로 `git mv`(R100, 내용 무변경). 순서(M1<M2<M3) 보존·reseat와 상호 비의존 확인. 재검증 GREEN(pgTAP 644·jest 4886). 파일명 참조 주석도 갱신.

## 왜 prod엔 문제가 없나 (핵심)
prod 마이그는 **MCP `apply_migration(name, query)`** 로 적용한다(전 슬라이스 관례, `memory/feedback_supabase_migration_workflow`). MCP는 `schema_migrations.version`을 **적용 시각**으로 부여하므로 repo 파일명 타임스탬프와 무관(무해한 드리프트). 따라서:
- prod엔 애초에 파일명 프리픽스 충돌이 존재하지 않는다(#229는 prod version `20260707110021`, 1e는 별도 시각).
- **충돌은 오직 파일 기반 `db reset`(로컬 개발·CI)에서만** 터진다. MCP-apply 프로덕션은 무증상.
- 같은 이유로 파일명↔prod version 불일치는 원래 정상이다(수정 대상 아님).

## 규칙
1. **리베이스 후 `db reset`을 반드시 재실행**해 병합 상태를 검증한다 — 브랜치 base가 오래됐으면 fresh 게이트가 충돌을 못 잡는다(1e도 base(#228)에서 돈 게이트는 통과, #229 리베이스 후에야 발현).
2. 충돌 시 **나중 머지 쪽이 자기 마이그를 더 늦은 타임스탬프로 리네임**(git mv, 내용 무변경 R100). 순서 의존·타 마이그 비의존을 확인.
3. 이미 머지된 상대 마이그는 **불가침**(수정 금지).
4. 리네임 후 파일명 참조 주석·문서도 함께 갱신.

## 연결
- 마이그=MCP `apply_migration` 전용(`supabase db push` 금지)·타임스탬프 불일치 무해: `memory/feedback_supabase_migration_workflow`
- 병렬 세션 격리(워크트리+브랜치, 이 충돌의 상류 원인): `memory/feedback_isolate_worktree_parallel_session`
- "무대(로컬/CI/prod)별 동작 상이" 동류 함정: [[test-db-grants]]
- MCP-apply로 prod에 적용한 대표 사례: [[wallet-iap-removal]]
- 이 충돌이 발현한 슬라이스: [[ops-1e-staff-integration]]
