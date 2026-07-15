---
area: decisions
updated: 2026-07-16
status: current
sources:
  - uniqn-mobile/src/utils/supabase.ts
  - memory/pitfall_denormalized_counter_drift.md
  - memory/pitfall_realtime_publication_required.md
  - memory/pitfall_rpc_raise_exception_unmapped_unknown.md
  - memory/pitfall_rls_violation_multi_cause_mapping.md
  - memory/pitfall_test_seed_zod_schema_first.md
  - memory/pitfall_supabase_auth_users_seed.md
  - memory/pitfall_supabase_storage_drop_policy.md
  - memory/pitfall_users_rls_cross_lookup.md
  - memory/pitfall_notification_outbox_misnomer.md
  - memory/pitfall_staff_assignments_settlements_dont_exist.md
tags: [supabase, postgres, trigger, realtime, error-mapping, seed, storage]
---

# 결정: Supabase 쓰기 경로 함정 모음

**한 줄:** 카운터·리얼타임·에러 매핑·시드·스토리지·"존재하지 않는 테이블"까지, Supabase 쓰기 경로에서 조용히 재발하는 함정의 종합 규칙. RLS/SECDEF 계열은 [[rls-model]]·[[secdef-hardening]].

## 비정규화 카운터 = 트리거 + 델타 표준 (검증 필요)
집계 컬럼(예: `filled_positions`)은 앱 로직이 아니라 **DB 트리거 + 델타**로만 갱신한다.
- INSERT/UPDATE/DELETE **3경로 전부** + status 전이를 **열거**해야 드리프트가 안 생긴다([[capacity-full]]의 dead counter 제거와 같은 원리).
- hydrate 시점 방어는 임시일 뿐 — 근본 해결은 트리거 재설계, 방어는 후속 PR로 제거(memory `feedback_temp_defense_then_root_cause`).
- 출처: memory `pitfall_denormalized_counter_drift`.

## 새 테이블은 realtime publication 명시 등록 (검증 필요)
Realtime 구독이 안 되면 대개 테이블이 publication에 없다.
- 규칙: `ALTER PUBLICATION supabase_realtime ADD TABLE ...` 명시 + `pg_publication_tables`로 사전 확인.
- 출처: memory `pitfall_realtime_publication_required`.

## RPC 커스텀 예외는 handleSupabaseError에 개별 매핑 (검증 필요)
`RAISE EXCEPTION`의 커스텀 문구(P0001)는 매핑이 없으면 **UNKNOWN으로 오분류**된다.
- 규칙: 새 RPC 예외마다 `handleSupabaseError`에 `message.includes('MAX_CAPACITY')` 식 개별 분기 추가.
- RLS 위반(42501)은 **원인이 여러 개** — 단일 메시지로 매핑 금지(memory `pitfall_rls_violation_multi_cause_mapping`).
- 출처: memory `pitfall_rpc_raise_exception_unmapped_unknown`.

## 테스트 시드는 zod 스키마 우선 (검증 필요)
raw JSONB `INSERT`는 앱의 zod 검증을 우회하므로, **읽기 시점에 strict zod가 행을 증발**시킨다.
- 규칙: 시드 데이터는 앱 zod 스키마를 만족하도록 생성(psql 직접 INSERT 금지 or 스키마 정합).
- `auth.users` 직접 시드 4함정: NULL 토큰은 **빈 문자열**로, `provider_id`=UUID, `identity_data.sub`=UUID, `auth.identities` provider 레코드도 생성(memory `pitfall_supabase_auth_users_seed`).
- 출처: memory `pitfall_test_seed_zod_schema_first`.

## storage.objects 정책은 CREATE POLICY만 단독 (검증 필요)
`storage.objects`는 소유권 제약으로 `DROP POLICY`를 단독 실행할 권한이 없다 — `CREATE POLICY`(멱등 재생성)만 가능. 출처: memory `pitfall_supabase_storage_drop_policy`.

## 존재하지 않거나 오해되는 테이블 (참조)
쓰기 대상 테이블명을 잘못 짚는 재발 — 아래는 prod 진실:
- `notification_outbox` **없음** → `public.notifications` 직접 INSERT + AFTER trigger.
- `staff_assignments`/`settlements` **없음** → 스태프=`applications`, 정산=`work_logs.payroll_*`.
- `users`는 RLS self/admin only → cross lookup은 SECDEF RPC 필수(`from('users')` 직접호출 0건).

## 관련
- [[rls-model]] — RLS 계층·재귀 함정(쓰기 시 42501의 원인 중 하나)
- [[secdef-hardening]] — SECDEF 함수 하드닝(users cross-lookup RPC의 안전 규칙)
- [[capacity-full]] — dead counter 제거 결정(카운터 트리거 규칙의 선례)
- [[layers]] — Service→Repository→Supabase 쓰기 단방향(직접 호출 금지)
- [[test-db-grants]] — 시드/pgTAP 권한 레이어
