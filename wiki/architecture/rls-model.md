---
area: architecture
updated: 2026-07-28
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260717093000_grid_order_sheet_security_hardening.sql
  - uniqn-mobile/supabase/migrations/20260710000002_baseline_schema_from_prod.sql
  - uniqn-mobile/supabase/migrations/archive/20260525153952_fix_job_postings_anon_public_select.sql
  - uniqn-mobile/supabase/migrations/archive/20260515030000_jpc_extend_existing_rls.sql
  - uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql
  - memory/pitfall_job_postings_insert_loose_rls_by_design.md
  - memory/pitfall_anon_rls_secdef_function_poison.md
  - memory/pitfall_rls_jpc_recursion_widespread.md
  - memory/pitfall_rls_with_check_self_select_recursion.md
  - PR#91
  - PR#92
  - PR#179
tags: [rls, postgres, security, supabase, recursion, secdef, grants]
---

# RLS 모델

**한 줄:** Row Level Security 3계층(anon·authenticated·service_role) + SECURITY DEFINER 헬퍼 함수 패턴. 3가지 함정 실전 발생 이력.

## 역할 계층

| 역할 | 가시성 |
|---|---|
| `anon` | 공개 공고(`jp_select_public_search`) 읽기만 |
| `authenticated` | 본인 데이터 + 워크스페이스 멤버십 범위 |
| `service_role` | RLS 우회(Edge Function, pgTAP) |

## 핵심 원칙

1. **permissive 정책은 OR 합산** — 하나라도 USING 절에서 함수 권한 실패 시 쿼리 전체 abort.
2. **RLS 안에서 같은 테이블 inline SELECT → cycle 감지(42P17)** — SECURITY DEFINER plpgsql 함수로 wrap 필수.
3. **SECDEF 함수는 절대 anon에 노출 금지** — 멤버십 논리는 `authenticated`에만 부여.
4. **테이블 GRANT 는 RLS와 별개의 coarse 레이어** — RLS 평가 이전에 테이블 권한이 없으면 `permission denied for table`(42501)로 abort(RLS는 0행이 아니라 권한 거부). prod 는 Supabase 기본 default-privilege 로 GRANT 보유하지만 테스트/신환경은 implicit 부여에 의존하면 깨진다 → 명시 GRANT([[test-db-grants]]).

## 함정 1: anon + SECDEF 헬퍼 → 42501 (검증됨)

마이그레이션 `uniqn-mobile/supabase/migrations/archive/20260525153952_fix_job_postings_anon_public_select.sql`:
> `jp_select_managed`(TO PUBLIC)이 `is_workspace_member()` 호출 → anon이 함수 권한에서 abort.

> ⚠️ 이 마이그레이션은 baseline squash 로 `migrations/archive/` 로 **이동했다**([[parity-baseline-squash]]) — 옛 경로로 찾으면 없다. 현행 정책 본문은 `…20260710000002_baseline_schema_from_prod.sql:13626-13636`(`jp_select_managed` TO authenticated · `jp_select_public_search`)에서 확인한다. 결론(TO authenticated 수정)은 여전히 유효하다.

수정: `ALTER POLICY jp_select_managed ON public.job_postings TO authenticated;`
(주장: `pitfall_anon_rls_secdef_function_poison.md` 기반 — 현재 코드 마이그레이션 파일로 검증됨)

## 함정 2: JPC JOIN inline → 재귀 42P17 (주장)

마이그레이션 `uniqn-mobile/supabase/migrations/archive/20260515030000_jpc_extend_existing_rls.sql`(baseline squash 로 archive 이동)에서 `workspaces_select_owner_or_member` USING에 `EXISTS(SELECT 1 FROM job_postings JOIN job_posting_collaborators ...)` inline 추가 → jp DELETE 시 cycle (memory `pitfall_rls_jpc_recursion_widespread.md`).

수정 방향: JPC 존재 여부를 plpgsql SECURITY DEFINER 함수 `is_workspace_jpc_member()`로 격리 (PR#91/PR#92 기반, 주장).

## 함정 3: WITH CHECK self-SELECT → 재귀 (주장)

WITH CHECK 안 `SELECT count(*) FROM workspaces WHERE owner_id = auth.uid()` → PostgreSQL cycle 가드 트리거 (memory `pitfall_rls_with_check_self_select_recursion.md`, 2026-05-08 hotfix).

수정 패턴: self-SELECT를 `plpgsql STABLE SECURITY DEFINER` 함수로 분리. SQL 함수는 inline 가능성 있어 SECDEF 무효화 위험.

## 원칙: job_postings INSERT는 앱-역할 게이트 + owner 바인딩 (prod 실측, 2026-07-28)

> ⚠️ **이 절은 2026-07-28 에 정반대로 뒤집혔다.** 이전 판은 INSERT RLS 가 "의도적으로 느슨"(`job_postings_insert_authenticated` WITH CHECK `auth.uid() IS NOT NULL`, outsider 포함 전원 ALLOW)하다고 기록했으나, **그 정책은 prod 에 존재한 적이 없다** — `migrations/archive/` 의 구세대 정의를 옮겨 적은 로컬 잔상이었다. 이 페이지를 근거로 "느슨하니 조여야겠다"고 판단하면 **이미 있는 owner 바인딩을 되돌리게 된다.**

현재 계약은 정책 2개의 결합이다(`pg_policy` prod 조회로 **검증됨**):

- **`jp_insert`** (PERMISSIVE) — `uniqn-mobile/supabase/migrations/20260717093000_grid_order_sheet_security_hardening.sql:426-431`:
  `get_my_role() ∈ {admin, employer}` **AND** (`owner_id = auth.uid()` OR admin).
  뒤 절(owner 바인딩)이 PR#267 하드닝에서 impersonation — 피해자 명의 스캠 공고 — 방어로 추가됐다([[secdef-hardening]]).
- **`jp_container_no_direct_insert`** (RESTRICTIVE) — `…20260710000002_baseline_schema_from_prod.sql:13599`: `status <> 'container'`. 컨테이너 행은 직접 INSERT 불가(전용 RPC 경유).

⇒ pgTAP 계약(`uniqn-mobile/supabase/tests/jpc_job_postings_rls.test.sql:18`): owner·ws_editor·collaborator(전부 employer 역할) ALLOW · **staff outsider DENY(42501)**. 같은 파일 `:11-12` 가 "구세대 '의도적 느슨' 정책은 로컬 전용 잔상이며 prod 엔 부재"라고 직접 적어 두었다 — **테스트 파일이 위키보다 먼저 진실을 알고 있었다.**

⚠️ `jp_insert` 는 **재정의가 2회 있었다.** 수정 시 반드시 "가장 최근 정의"(현재 `20260717093000`)를 베이스로 삼을 것 — baseline 정의를 복사하면 owner 바인딩이 통째로 되돌아간다([[secdef-replace-search-path-loss]]).

## 주요 테이블별 RLS 요약 (주장: memory 기반)

| 테이블 | anon | authenticated |
|---|---|---|
| `job_postings` | 공개 status만 읽기 | 본인 workspace + collaborator |
| `workspaces` | 없음 | owner or member (SECDEF helper) |
| `applications` | 없음 | 본인 지원 or 공고 소유자 |

> `wallets` 행(구 `본인만·DML REVOKE`, PR#168)은 **삭제됐다** — 지갑/IAP 전체 제거로 테이블 자체가 사라졌다. baseline 스키마에 `wallet` 문자열이 **0건**이고 정의는 `migrations/archive/` 에만 남아 있다([[wallet-iap-removal]]).

## 관련

- [[secdef-hardening]] — SECDEF 함수 하드닝 3규칙(anon EXECUTE REVOKE·search_path extensions·plpgsql NULL fail-open) — 본 페이지 재귀/poison 함정의 자매
- [[supabase-write-pitfalls]] — 쓰기 경로 함정(카운터 트리거·realtime publication·RPC 예외 매핑·시드 zod·users cross-lookup RPC)
- [[layers]] — Service/Repository에서 Supabase 호출 방식
- [[roles]] — UserRole과 RLS authenticated 계층 매핑
- [[enum-divergence]] — RLS와 함께 발생한 읽기 증발 패턴
- [[test-db-grants]] — 테이블 GRANT 레이어를 테스트에서 명시화한 결정
- [[wallet-pgtap-caller-binding]] — SECDEF RPC 호출자 바인딩 가드 + pgTAP 회귀
- [[wallet-iap-removal]] — 느슨 INSERT 설계 확정 맥락(조임 철회)
