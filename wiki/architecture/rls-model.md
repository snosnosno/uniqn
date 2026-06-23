---
area: architecture
updated: 2026-06-23
status: current
sources:
  - uniqn-mobile/supabase/migrations/20260525153952_fix_job_postings_anon_public_select.sql
  - uniqn-mobile/supabase/migrations/20260515030000_jpc_extend_existing_rls.sql
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

마이그레이션 `uniqn-mobile/supabase/migrations/20260525153952_fix_job_postings_anon_public_select.sql`:
> `jp_select_managed`(TO PUBLIC)이 `is_workspace_member()` 호출 → anon이 함수 권한에서 abort.

수정: `ALTER POLICY jp_select_managed ON public.job_postings TO authenticated;`
(주장: `pitfall_anon_rls_secdef_function_poison.md` 기반 — 현재 코드 마이그레이션 파일로 검증됨)

## 함정 2: JPC JOIN inline → 재귀 42P17 (주장)

마이그레이션 `uniqn-mobile/supabase/migrations/20260515030000_jpc_extend_existing_rls.sql`에서 `workspaces_select_owner_or_member` USING에 `EXISTS(SELECT 1 FROM job_postings JOIN job_posting_collaborators ...)` inline 추가 → jp DELETE 시 cycle (memory `pitfall_rls_jpc_recursion_widespread.md`).

수정 방향: JPC 존재 여부를 plpgsql SECURITY DEFINER 함수 `is_workspace_jpc_member()`로 격리 (PR#91/PR#92 기반, 주장).

## 함정 3: WITH CHECK self-SELECT → 재귀 (주장)

WITH CHECK 안 `SELECT count(*) FROM workspaces WHERE owner_id = auth.uid()` → PostgreSQL cycle 가드 트리거 (memory `pitfall_rls_with_check_self_select_recursion.md`, 2026-05-08 hotfix).

수정 패턴: self-SELECT를 `plpgsql STABLE SECURITY DEFINER` 함수로 분리. SQL 함수는 inline 가능성 있어 SECDEF 무효화 위험.

## 원칙: job_postings INSERT는 의도적으로 느슨 (검증됨)

`job_postings`의 INSERT RLS는 **느슨**하다: `job_postings_insert_authenticated` WITH CHECK `auth.uid() IS NOT NULL`. 실제 권한(owner/workspace 멤버/협업자)은 **앱 레이어**가 검사하는 설계. pgTAP `jpc_job_postings_rls.test.sql`이 계약으로 명시 — owner/editor/collaborator/**outsider 모두 INSERT=ALLOW**("정책상 ALLOW — app layer 권한 검사 필수").

→ "owner_id 위조 가능"으로 보여 `owner_id = auth.uid()`로 순진하게 조이면 워크스페이스 editor/collaborator 정당 INSERT가 막혀 `jpc_job_postings_rls`가 4/16 깨진다(실측). 결제 RPC가 가졌던 `p_owner_id=auth.uid()` 바인딩은 **결제 경로 한정**이었고 일반 INSERT 계약 아님. 조이려면 협업 경로 전수검증 + 테스트 계약 변경이 필요한 별도 작업. ([[wallet-iap-removal]] 중 한 세션이 조였다가 "느슨 유지" 결정으로 철회.)

## 주요 테이블별 RLS 요약 (주장: memory 기반)

| 테이블 | anon | authenticated |
|---|---|---|
| `job_postings` | 공개 status만 읽기 | 본인 workspace + collaborator |
| `workspaces` | 없음 | owner or member (SECDEF helper) |
| `wallets` | 없음 | 본인만(DML REVOKE, PR#168) |
| `applications` | 없음 | 본인 지원 or 공고 소유자 |

## 관련

- [[layers]] — Service/Repository에서 Supabase 호출 방식
- [[roles]] — UserRole과 RLS authenticated 계층 매핑
- [[enum-divergence]] — RLS와 함께 발생한 읽기 증발 패턴
- [[test-db-grants]] — 테이블 GRANT 레이어를 테스트에서 명시화한 결정
- [[wallet-pgtap-caller-binding]] — SECDEF RPC 호출자 바인딩 가드 + pgTAP 회귀
- [[wallet-iap-removal]] — 느슨 INSERT 설계 확정 맥락(조임 철회)
